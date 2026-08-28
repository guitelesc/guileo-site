-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- COMENTÁRIO → DM EM VÁRIOS IDIOMAS.  Idempotente. Depende de db/meta_comment_dm.sql.
--
-- POR QUÊ: a Gui atende o telefone em 16 idiomas (LANGS_SPOKEN, functions/lib/provision.js) e
-- o comentário respondia em UM. Quem comenta "precio" em espanhol recebia português e sumia.
--
-- O DESENHO, em uma linha: o texto vira um MAPA por idioma, e a escolha do idioma acontece no
-- código puro (functions/lib/comentarios.js, testado), não aqui.
--
-- ⚠️ ZERO DOWNTIME, DE PROPÓSITO. Os dois parâmetros novos entram com DEFAULT no fim da
-- assinatura. Isso faz a chamada ANTIGA de 12 argumentos continuar resolvendo — então este SQL
-- pode subir ANTES do código novo, e nenhuma campanha para de responder no meio. O `drop` da
-- assinatura velha e o `create` da nova acontecem na MESMA transação (DDL no Postgres é
-- transacional), então não existe janela em que a função não exista.
--
-- ⚠️ dm_text CONTINUA NOT NULL e continua sendo escrito. Ele é a queda honesta: campanha antiga
-- (sem dm_i18n) responde exatamente como respondia. Idioma novo não pode calar quem já está no ar.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

alter table public.meta_comment_campaigns
  add column if not exists dm_i18n     jsonb not null default '{}'::jsonb,
  add column if not exists lang_padrao text  not null default 'en';

-- O idioma padrão tem que ser um código de 2 letras. Um "pt-BR" aqui furaria a comparação no
-- código (que trabalha com 2 letras) e cairia no padrão pra sempre, silenciosamente.
do $$ begin
  alter table public.meta_comment_campaigns
    add constraint meta_cc_lang_ok check (lang_padrao ~ '^[a-z]{2}$');
exception when duplicate_object then null; end $$;

comment on column public.meta_comment_campaigns.dm_i18n is
  'mapa idioma->texto do DM: {"en":"...","pt":"...","es":"..."}. Vazio = usa dm_text (compatível).';
comment on column public.meta_comment_campaigns.lang_padrao is
  'idioma de queda quando a detecção não decide (palavra ambígua) ou falta tradução.';

-- ── meta_campanha_salvar: aceita o mapa ─────────────────────────────────────────────────────
-- `p_dm_i18n` chega como jsonb. Chave inválida NÃO é rejeitada aqui de propósito: quem valida
-- idioma é o código, que conhece LANGS_SPOKEN. O banco guarda; o banco não opina sobre catálogo
-- de idioma — senão viraria a QUARTA lista de idiomas do sistema, e listas que se repetem divergem.
drop function if exists public.meta_campanha_salvar(text,text,uuid,text,text,text,text[],text,text,text,text,boolean);

create or replace function public.meta_campanha_salvar(
  p_secret text, p_email text, p_id uuid, p_ig_id text, p_nome text, p_media_id text,
  p_keywords text[], p_match_mode text, p_dm_text text, p_public_reply text,
  p_link_url text, p_active boolean,
  p_dm_i18n jsonb default null, p_lang_padrao text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_i18n jsonb; v_lang text;
begin
  if not public._meta_cc_ok(p_secret) then return jsonb_build_object('ok', false, 'motivo','forbidden'); end if;
  if coalesce(p_email,'') = '' or coalesce(p_ig_id,'') = '' or coalesce(p_dm_text,'') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'dados_faltando');
  end if;
  -- jsonb que não seja OBJETO vira {} — um array ou string aqui quebraria o textoDoIdioma()
  -- do lado do código, e a campanha ficaria muda sem ninguém saber por quê.
  v_i18n := case when jsonb_typeof(coalesce(p_dm_i18n,'{}'::jsonb)) = 'object'
                 then coalesce(p_dm_i18n,'{}'::jsonb) else '{}'::jsonb end;
  v_lang := lower(left(coalesce(nullif(p_lang_padrao,''),'en'), 2));

  if p_id is null then
    insert into public.meta_comment_campaigns
      (client_email, ig_id, nome, media_id, keywords, match_mode, dm_text, public_reply, link_url,
       active, dm_i18n, lang_padrao)
      values (p_email, p_ig_id, coalesce(nullif(p_nome,''),'Campanha'), nullif(p_media_id,''),
              coalesce(p_keywords,'{}'), coalesce(nullif(p_match_mode,''),'palavra'), p_dm_text,
              nullif(p_public_reply,''), nullif(p_link_url,''), coalesce(p_active, true),
              v_i18n, v_lang)
      returning id into v_id;
  else
    -- Escopo do tenant no WHERE, nunca só pelo id: UUID sozinho NÃO autoriza nada.
    -- p_dm_i18n NULL = "não mexi nisso" e preserva o que está lá; {} = "apaga". A diferença
    -- importa: uma tela que não conhece o campo não pode apagar as traduções sem querer.
    update public.meta_comment_campaigns set
      ig_id = p_ig_id, nome = coalesce(nullif(p_nome,''),'Campanha'), media_id = nullif(p_media_id,''),
      keywords = coalesce(p_keywords,'{}'), match_mode = coalesce(nullif(p_match_mode,''),'palavra'),
      dm_text = p_dm_text, public_reply = nullif(p_public_reply,''), link_url = nullif(p_link_url,''),
      active = coalesce(p_active, true),
      dm_i18n = case when p_dm_i18n is null then dm_i18n else v_i18n end,
      lang_padrao = case when p_lang_padrao is null then lang_padrao else v_lang end,
      updated_at = now()
     where id = p_id and client_email = p_email
     returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'motivo', 'nao_encontrada'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
exception when others then
  return jsonb_build_object('ok', false, 'motivo', 'erro:' || left(sqlerrm, 80));
end $$;

grant execute on function public.meta_campanha_salvar(text,text,uuid,text,text,text,text[],text,text,text,text,boolean,jsonb,text) to anon;
