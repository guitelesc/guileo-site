-- ============================================================================
-- GUILEO · AUTO-APROVAÇÃO DE CADASTRO PAGO — cole TUDO no SQL Editor e RUN.
-- Projeto ynihodbknhjirkdogxby (smart@guileoai.com). Idempotente, pode colar 2×.
-- ----------------------------------------------------------------------------
-- POR QUE EXISTE: hoje o cliente PAGA (Stripe/Mercado Pago) e mesmo com o cadastro
-- completo já preenchido pelo vendedor (onboard_drafts) a Gui dele só nasce quando o
-- Luis abre o /admin e clica "Aprovar". Enquanto ninguém clica, o cliente pagou e não
-- tem produto — e o que nasce sozinho hoje pelo caminho self-serve é uma Gui MAGRA
-- (sem preços, sem menu, o "thin_agent_born" que o webhook já denuncia).
-- Este arquivo dá ao servidor as duas perguntas que faltavam para fechar isso sozinho:
--   1) "existe cadastro completo em rascunho para o e-mail que acabou de pagar?"
--   2) "este e-mail já tem crédito pago?" (para o caminho inverso: o cadastro chega
--      DEPOIS do pagamento).
-- E abre UMA chave nova no platform_settings: auto_approve_paid (0|1, nasce desligada).
--
-- ⚠️ O QUE ESTE ARQUIVO **NÃO** FAZ: aprovar sozinho um cadastro que iria ao ar no
-- NÚMERO COMPARTILHADO. Esse portão continua no servidor (onboard-draft.js devolve 409
-- confirm_required) e a auto-aprovação NUNCA manda confirm:true — vira e-mail
-- "falta 1 clique" para o dono. Número compartilhado é decisão consciente de humano.
--
-- CONTRATO (igual a db/platform_settings.sql e db/onboard_completo.sql):
-- SECURITY DEFINER, search_path=public, portão pelo LITERAL do INGEST, RLS ON sem
-- policy anon, grant execute to anon. Blocos EXCEPTION para degradar (nunca 500 por
-- tabela ausente) — o que degrada devolve "nada", e quem chama trata "nada" como
-- "não sei", nunca como "não existe".
-- ============================================================================

-- ── 1) EXISTE CADASTRO COMPLETO EM RASCUNHO PARA ESTE E-MAIL? ───────────────
-- onboard_drafts nasceu com índice por vendedor e por status, mas NUNCA por
-- client_email: não havia como perguntar "quem pagou tem cadastro?". Esta RPC é essa
-- pergunta. Só status='draft' (um 'live' já virou agente; um 'deleted' foi descartado).
-- Devolve linhas LEVES (sem o payload inteiro) — quem for aprovar chama draft_get.
-- Mais novo primeiro: se houver dois, o mais recente é o que o vendedor acabou de
-- corrigir. Mas quem chama NÃO deve escolher sozinho quando vier mais de um (ver
-- functions/lib/autoApprove.js: 2+ = ambíguo, alerta o dono e não aprova nada).
create index if not exists idx_onboard_drafts_client on public.onboard_drafts(client_email, status, created_at desc);

create or replace function public.draft_find_paid(p_secret text, p_client_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb; v_email text := lower(trim(coalesce(p_client_email, '')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_email = '' then return '[]'::jsonb; end if;
  begin
    select coalesce(jsonb_agg(r order by r->>'created_at' desc), '[]'::jsonb) into v
    from (
      select jsonb_build_object(
        'id', id, 'seller_email', seller_email, 'business', business,
        'client_email', client_email, 'created_at', created_at
      ) as r
      from onboard_drafts
      where status = 'draft'
        and lower(trim(coalesce(client_email, ''))) = v_email
    ) s;
  exception when others then
    -- tabela ausente (db/onboard_completo.sql não colado) → "não sei", nunca "não tem".
    return '[]'::jsonb;
  end;
  return coalesce(v, '[]'::jsonb);
end $$;

grant execute on function public.draft_find_paid(text, text) to anon;

-- ── 2) ESTE E-MAIL JÁ PAGOU? ────────────────────────────────────────────────
-- Verdadeiro quando existe uma linha em client_credits com credits > 0 para o e-mail.
-- É o mesmo lastro que o portal usa para dizer que alguém é cliente pagante: só
-- add_client_credits (caminho do dinheiro) cria/enche essa linha.
-- ⚠️ POR QUE credits > 0 E NÃO "existe a linha": db/refund_pause.sql já registrou o
-- caso da client_credits FANTASMA (credits 0) cunhada sem pagamento nenhum. "Tem
-- linha" não é "pagou"; "tem saldo" é.
-- A coluna do e-mail é resolvida dinamicamente (client_email vs email), o mesmo
-- cuidado que lead_converted já toma neste banco.
create or replace function public.client_has_paid(p_secret text, p_email text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_col text; v_ok boolean; v_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_email = '' then return false; end if;
  begin
    select column_name into v_col
      from information_schema.columns
     where table_schema = 'public' and table_name = 'client_credits'
       and column_name in ('client_email', 'email')
     order by case column_name when 'client_email' then 0 else 1 end
     limit 1;
    if v_col is null then return false; end if;
    execute format('select exists(select 1 from public.client_credits where lower(trim(%I)) = $1 and coalesce(credits,0) > 0)', v_col)
      into v_ok using v_email;
  exception when others then
    return false;   -- degrada: sem leitura → não dispara nada (nunca aprova no escuro)
  end;
  return coalesce(v_ok, false);
end $$;

grant execute on function public.client_has_paid(text, text) to anon;

-- ── 3) platform_settings_set — a lista branca ganha 'auto_approve_paid' ──────
-- Cópia INTEIRA da função de db/platform_settings.sql; muda SÓ a lista de chaves e a
-- validação (auto_approve_paid valida igual dunning_enforce: 0|1). Recriar a função
-- inteira aqui, em vez de "alterar", é de propósito: duas versões parciais da mesma
-- função em dois arquivos é como uma chave some quando alguém cola o arquivo antigo
-- por último. Este arquivo é o mais novo — ele contém a versão completa.
-- ⚠️ ORDEM DE COLAGEM: se um dia db/platform_settings.sql for colado DEPOIS deste, a
-- chave auto_approve_paid volta a ser recusada. Cole este por último.
create or replace function public.platform_settings_set(p_secret text, p_key text, p_value text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_key text := lower(trim(coalesce(p_key, '')));
        v_val text := trim(coalesce(p_value, ''));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_key not in ('dunning_enforce', 'grace_days', 'silent_days', 'auto_approve_paid') then
    raise exception 'chave nao permitida: %', v_key using errcode = '22023';
  end if;
  -- validação por chave — número que não é número vira "0" e zera a tolerância do dono.
  if v_key in ('dunning_enforce', 'auto_approve_paid') then
    if v_val not in ('0', '1') then raise exception '% e 0 ou 1', v_key using errcode = '22023'; end if;
  else
    if v_val !~ '^[0-9]{1,3}$' or v_val::int < 1 then
      raise exception '% tem que ser inteiro >= 1', v_key using errcode = '22023';
    end if;
  end if;
  insert into platform_settings (key, value, updated_at)
  values (v_key, v_val, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('ok', true, 'key', v_key, 'value', v_val);
end $$;

grant execute on function public.platform_settings_set(text, text, text) to anon;

-- ✅ Pronto. A chave nasce AUSENTE (= desligada): nada muda de comportamento até o
--    Luis ligar em /admin → "⚙️ Regras de cobrança" → "Aprovação automática de
--    cadastro pago". Ligar/desligar vale no próximo pagamento, sem deploy.
