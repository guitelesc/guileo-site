-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- UM CLIENTE, VÁRIAS CONTAS DE INSTAGRAM.  Idempotente. Depende de db/meta_integration.sql.
--
-- POR QUE (2026-08-28, medido): o MedMundo tem DUAS contas (@medmundo.br e @drmedmundo) e a
-- Guileo tem duas (@guileoai e @guileo.ad). A Meta obriga uma Página por Instagram — então duas
-- contas são duas Páginas. E o modelo antigo não aguentava isso, de dois jeitos, os dois calados:
--
--   1. meta_tenant_for_page achava o cliente pelo ID de quem RECEBEU (certo) e depois buscava a
--      credencial por CLIENTE com `limit 1` — jogando fora a informação de qual Página era. Um
--      comentário na Página B seria respondido com o token e o ig_id da Página A. Pior: o retorno
--      fazia coalesce(tokens->>'page_id', p_page_id), ou seja, PREFERIA o palpite guardado à
--      pergunta feita. Não é que ele não soubesse — é que ele não olhava.
--   2. meta_creds_store faz `tokens || excluded.tokens` na linha do cliente. Guardar a segunda
--      conta SOBRESCREVIA o token da primeira. A conta 1 ficava muda e nada acusava.
--
-- É a mesma família do incidente da linha de demo atendida pelo spa de um cliente: a busca começa
-- pelo identificador certo e termina numa tabela indexada por outra coisa.
--
-- O DESENHO: a credencial passa a morar POR PÁGINA (meta_accounts), e a resolução responde sobre
-- o ID QUE FOI PERGUNTADO. client_integrations continua existindo e continua sendo escrita — ela
-- vira a conta PRIMÁRIA do cliente (o que o resto da plataforma já lê) e a queda de compatibilidade.
--
-- ⚠️ ZERO DOWNTIME: tabela nova + backfill + funções trocadas na MESMA transação, com a assinatura
-- IDÊNTICA (nenhum chamador muda). Enquanto a tabela estiver vazia pra algum cliente, a função cai
-- no caminho antigo e responde exatamente como respondia.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.meta_accounts (
  page_id           text primary key,          -- a Página do Facebook (o nó que a API usa)
  client_email      text not null,             -- o TENANT. Várias linhas por cliente: é o ponto.
  ig_id             text,                      -- a conta de Instagram amarrada a ESTA Página
  ig_username       text,                      -- só pra tela; a decisão nunca usa o @
  page_access_token text,                      -- o token DESTA Página. Nunca sai do servidor.
  business_name     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 🚨 A TRAVA QUE FALTAVA. A Meta já garante que um Instagram pertence a UMA Página; o banco passa
-- a garantir também. Sem isso, um erro de digitação no ig_id faria DUAS Páginas reivindicarem a
-- mesma conta, e a resolução devolveria a que viesse primeiro — o defeito voltaria com outra roupa.
create unique index if not exists idx_meta_accounts_ig
  on public.meta_accounts (ig_id) where ig_id is not null and ig_id <> '';
create index if not exists idx_meta_accounts_cliente
  on public.meta_accounts (client_email);

alter table public.meta_accounts enable row level security;  -- sem policy: só SECURITY DEFINER entra

-- ── BACKFILL: o que já existe vira a primeira conta de cada cliente ─────────────────────────────
-- `on conflict do nothing` para este arquivo poder rodar de novo sem desfazer edição posterior.
insert into public.meta_accounts (page_id, client_email, ig_id, page_access_token, business_name)
select ci.tokens->>'page_id', ci.client_email,
       nullif(trim(coalesce(ci.tokens->>'ig_id','')),''),
       nullif(trim(coalesce(ci.tokens->>'page_access_token','')),''),
       ci.tokens->>'business_name'
  from public.client_integrations ci
 where ci.provider = 'meta'
   and nullif(trim(coalesce(ci.tokens->>'page_id','')),'') is not null
on conflict (page_id) do nothing;

-- ── RESOLUÇÃO: responde sobre o ID QUE FOI PERGUNTADO ───────────────────────────────────────────
-- Assinatura idêntica de propósito: meta-webhook.js e a varredura não mudam uma linha.
create or replace function public.meta_tenant_for_page(p_secret text, p_page_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id text; v_email text; v_tokens jsonb; r record;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  v_id := nullif(trim(coalesce(p_page_id,'')), '');
  if v_id is null then return null; end if;

  -- (1) O CAMINHO NOVO. O webhook do Instagram entrega o ig_id como `entry.id`, e o do Messenger
  --     entrega o page_id — por isso a busca aceita os dois. O que volta é a credencial DESTA
  --     conta, não a do cliente: é essa linha que impede a Página B de responder como a Página A.
  select a.client_email, a.page_id, a.ig_id, a.page_access_token, a.business_name into r
    from public.meta_accounts a
   where a.page_id = v_id or (a.ig_id is not null and a.ig_id <> '' and a.ig_id = v_id)
   limit 1;
  if found then
    return jsonb_build_object(
      'client_email', r.client_email, 'page_id', r.page_id, 'ig_id', r.ig_id,
      'page_access_token', r.page_access_token, 'business_name', r.business_name);
  end if;

  -- (2) A QUEDA. Cliente ainda não migrado responde exatamente como respondia antes.
  select client_email into v_email from meta_page_map where page_id = v_id limit 1;
  if v_email is null then return null; end if;
  select tokens into v_tokens from client_integrations
   where client_email = v_email and provider = 'meta' limit 1;
  v_tokens := coalesce(v_tokens, '{}'::jsonb);
  return jsonb_build_object(
    'client_email', v_email, 'page_id', coalesce(v_tokens->>'page_id', v_id),
    'ig_id', v_tokens->>'ig_id', 'page_access_token', v_tokens->>'page_access_token',
    'business_name', v_tokens->>'business_name');
exception when others then return null;
end $$;

-- ── GRAVAÇÃO: cada conta na sua linha ───────────────────────────────────────────────────────────
create or replace function public.meta_creds_store(p_secret text, p_email text, p_tokens jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_page  text;
  v_ig    text;
  v_tok   text;
  v_primaria boolean;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_email = '' then return false; end if;

  v_page := nullif(trim(coalesce(p_tokens->>'page_id','')), '');
  v_ig   := nullif(trim(coalesce(p_tokens->>'ig_id','')),   '');
  v_tok  := nullif(trim(coalesce(p_tokens->>'page_access_token','')), '');

  -- (1) A CONTA, por Página. Aqui NÃO existe merge de jsonb: cada Página tem a sua linha, e por
  --     isso guardar a segunda conta não pode mais apagar o token da primeira.
  --     COALESCE nos campos: um store parcial (só publish_mode, por exemplo) não pode zerar token.
  if v_page is not null then
    insert into public.meta_accounts (page_id, client_email, ig_id, page_access_token, business_name)
    values (v_page, v_email, v_ig, v_tok, nullif(trim(coalesce(p_tokens->>'business_name','')),''))
    on conflict (page_id) do update set
      client_email      = excluded.client_email,
      ig_id             = coalesce(excluded.ig_id, meta_accounts.ig_id),
      page_access_token = coalesce(excluded.page_access_token, meta_accounts.page_access_token),
      business_name     = coalesce(excluded.business_name, meta_accounts.business_name),
      updated_at        = now();
  end if;

  -- (2) A CONTA PRIMÁRIA do cliente (client_integrations) — o que o resto da plataforma já lê.
  --     Só é escrita quando o cliente ainda não tem primária OU quando a Página que chegou JÁ é a
  --     primária. Sem esse teste, conectar a segunda conta trocaria a identidade principal do
  --     cliente sem ninguém pedir — que é o defeito antigo com o nome novo.
  select (tokens->>'page_id' is null or tokens->>'page_id' = '' or tokens->>'page_id' = v_page)
    into v_primaria from client_integrations
   where client_email = v_email and provider = 'meta' limit 1;
  if v_primaria is null then v_primaria := true; end if;   -- cliente sem linha: esta vira a primária

  if v_primaria then
    insert into client_integrations (client_email, provider, tokens)
    values (v_email, 'meta', coalesce(p_tokens, '{}'::jsonb))
    on conflict (client_email, provider) do update
      set tokens = coalesce(client_integrations.tokens, '{}'::jsonb) || coalesce(excluded.tokens, '{}'::jsonb),
          updated_at = now();
  end if;

  -- (3) O MAPA de roteamento continua igual — ele já aceitava várias linhas por cliente.
  if v_page is not null then
    insert into meta_page_map (page_id, client_email, kind) values (v_page, v_email, 'page')
    on conflict (page_id) do update set client_email = excluded.client_email, kind = 'page', updated_at = now();
  end if;
  if v_ig is not null then
    insert into meta_page_map (page_id, client_email, kind) values (v_ig, v_email, 'ig')
    on conflict (page_id) do update set client_email = excluded.client_email, kind = 'ig', updated_at = now();
  end if;

  return true;
end $$;

-- ── O TOKEN DE UMA CONTA (a varredura de comentários precisa dele por ig_id, não por cliente) ────
-- meta_token_for_email continua existindo e devolve o da conta PRIMÁRIA. Quem varre conta a conta
-- tem que usar este, senão varre a conta 2 com o token da conta 1 e recebe um erro que parece
-- "sem permissão" quando na verdade é "conta errada".
create or replace function public.meta_token_for_ig(p_secret text, p_ig_id text)
returns text language plpgsql security definer set search_path = public as $$
declare v_tok text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  select nullif(trim(coalesce(page_access_token,'')),'') into v_tok
    from public.meta_accounts
   where (ig_id is not null and ig_id <> '' and ig_id = trim(p_ig_id)) or page_id = trim(p_ig_id)
   limit 1;
  return v_tok;
end $$;

-- ── AS CONTAS DE UM CLIENTE (pra tela e pra varredura) ──────────────────────────────────────────
-- Nunca devolve token: quem precisa do token chama meta_token_for_ig no servidor.
create or replace function public.meta_contas_do_cliente(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'page_id', page_id, 'ig_id', ig_id, 'ig_username', ig_username,
           'business_name', business_name,
           'tem_token', (nullif(trim(coalesce(page_access_token,'')),'') is not null),
           'updated_at', updated_at) order by created_at), '[]'::jsonb)
    into v from public.meta_accounts where client_email = lower(trim(p_email));
  return v;
exception when others then return '[]'::jsonb;
end $$;

grant execute on function public.meta_token_for_ig(text,text)       to anon;
grant execute on function public.meta_contas_do_cliente(text,text)  to anon;
