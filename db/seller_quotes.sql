-- ============================================================================
-- GUILEO · ORÇAMENTOS DO VENDEDOR (seller_quotes) — cole TUDO no SQL Editor e RUN.
-- Projeto ynihodbknhjirkdogxby · conta smart@guileoai.com. IDEMPOTENTE (pode rodar de novo).
--
-- POR QUE ESTE ARQUIVO EXISTE (o elo mais fraco do funil):
--   O gerador de orçamento do /vendedor montava um documento lindo… e ele morria na tela. O único
--   caminho de saída era /api/quote-email, que manda o orçamento PARA O PRÓPRIO VENDEDOR (modelo
--   forward). Nada persistia e o CLIENTE nunca recebia link nenhum. Consequência medível: ninguém
--   sabe quantos orçamentos existem, quantos foram abertos, nem quantos foram aceitos — e um
--   orçamento que o vendedor não consegue reabrir amanhã é uma venda que ele refaz do zero ou
--   simplesmente não faz.
--
-- O DESENHO É O MESMO DO CONTRATO (db/contracts.sql), de propósito — ele já provou funcionar:
--   • o VENDEDOR grava/lista atrás do gate do app (literal INGEST = env INGEST_SECRET — ⚠️ _gui_sched_ok NÃO existe no banco vivo; corrigido 2026-08-25 na aplicação);
--   • o CLIENTE abre e aceita por um TOKEN de capacidade, sem login nenhum (o token É a auth).
--
-- SEGURANÇA (ARQUITETURA §3): RLS ligado SEM policy pro anon — as RPCs SECURITY DEFINER abaixo
-- são o único acesso. O gate é literal hardcoded (Supabase proíbe GUC/`alter database set`).
--
-- ⚠️ NÃO GUARDAMOS O `sid` DO VENDEDOR. O sid é o CRACHÁ HMAC dele (functions/lib/sellerSession.js)
--    — uma credencial portadora: quem tem o sid É o vendedor. Credencial não se persiste em tabela
--    de dados; o escopo aqui é o E-MAIL que o servidor extraiu do crachá assinado, exatamente como
--    /api/contract usa o e-mail autenticado e ignora o do corpo.
-- ============================================================================

create table if not exists public.seller_quotes (
  id            uuid primary key default gen_random_uuid(),
  seller_email  text not null,                       -- DONO do orçamento (vem da sessão assinada)
  client_name   text,
  client_email  text,
  client_phone  text,
  itens         jsonb not null default '[]'::jsonb,  -- snapshot congelado do que foi ofertado
  total         text not null default '',            -- o total COMO FOI ESCRITO ("$1,500/mês")
  total_cents   bigint not null default 0,           -- 0 = não foi possível derivar (nunca chutar)
  currency      text not null default 'USD',
  status        text not null default 'draft',       -- draft | sent | viewed | accepted
  accepted_name text,
  accepted_at   timestamptz,
  accepted_ip   text,
  viewed_at     timestamptz,
  -- token de capacidade do link público. 32 hex — o mesmo mecanismo do sign_token do contrato.
  token         text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- reconcilia tabela pré-existente (create table if not exists NÃO acerta colunas)
alter table public.seller_quotes add column if not exists client_name   text;
alter table public.seller_quotes add column if not exists client_email  text;
alter table public.seller_quotes add column if not exists client_phone  text;
alter table public.seller_quotes add column if not exists itens         jsonb not null default '[]'::jsonb;
alter table public.seller_quotes add column if not exists total         text not null default '';
alter table public.seller_quotes add column if not exists total_cents   bigint not null default 0;
alter table public.seller_quotes add column if not exists currency      text not null default 'USD';
alter table public.seller_quotes add column if not exists status        text not null default 'draft';
alter table public.seller_quotes add column if not exists accepted_name text;
alter table public.seller_quotes add column if not exists accepted_at   timestamptz;
alter table public.seller_quotes add column if not exists accepted_ip   text;
alter table public.seller_quotes add column if not exists viewed_at     timestamptz;
alter table public.seller_quotes add column if not exists token         text;
do $$ begin
  begin alter table public.seller_quotes alter column token set default replace(gen_random_uuid()::text, '-', ''); exception when others then null; end;
  begin update public.seller_quotes set token = replace(gen_random_uuid()::text, '-', '') where token is null or length(token) < 24; exception when others then null; end;
  begin alter table public.seller_quotes add constraint seller_quotes_token_key unique (token); exception when others then null; end;
end $$;

create index if not exists seller_quotes_owner on public.seller_quotes (seller_email, status, created_at desc);
create index if not exists seller_quotes_token on public.seller_quotes (token);

alter table public.seller_quotes enable row level security;

-- ── VENDEDOR: cria/atualiza o orçamento. Devolve id + token (o COMPROVANTE).
--    Sem id/token não houve gravação — o endpoint recusa "ok" sem eles. ──────────────────────────
create or replace function public.seller_quote_upsert(
  p_secret text, p_email text, p_id uuid, p_client_name text, p_client_email text, p_client_phone text,
  p_itens jsonb, p_total text, p_total_cents bigint, p_currency text, p_status text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_token text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if coalesce(trim(p_email),'') = '' or position('@' in p_email) = 0 then raise exception 'bad seller' using errcode = '22023'; end if;

  if p_id is not null then
    -- ESCOPO SEMPRE (e-mail, id): o UUID sozinho NUNCA é chave — um vendedor jamais edita
    -- o orçamento de outro, mesmo com o id na mão.
    update seller_quotes set
      client_name = p_client_name, client_email = lower(nullif(trim(coalesce(p_client_email,'')),'')), client_phone = p_client_phone,
      itens = coalesce(p_itens, itens), total = coalesce(p_total, total),
      total_cents = greatest(coalesce(p_total_cents, total_cents), 0), currency = coalesce(nullif(p_currency,''), currency),
      -- status só ANDA para frente por aqui; `viewed`/`accepted` são do lado do cliente e o
      -- vendedor salvando de novo não pode apagar o fato de o cliente já ter aberto/aceito.
      status = case when status in ('viewed','accepted') then status else coalesce(nullif(p_status,''), status) end,
      updated_at = now()
    where id = p_id and seller_email = lower(trim(p_email))
    returning id, token into v_id, v_token;
    if v_id is not null then return jsonb_build_object('ok', true, 'id', v_id, 'token', v_token); end if;
  end if;

  insert into seller_quotes(seller_email, client_name, client_email, client_phone, itens, total, total_cents, currency, status)
  values (lower(trim(p_email)), p_client_name, lower(nullif(trim(coalesce(p_client_email,'')),'')), p_client_phone,
          coalesce(p_itens,'[]'::jsonb), coalesce(p_total,''), greatest(coalesce(p_total_cents,0),0),
          coalesce(nullif(p_currency,''), 'USD'), coalesce(nullif(p_status,''), 'sent'))
  returning id, token into v_id, v_token;
  return jsonb_build_object('ok', true, 'id', v_id, 'token', v_token);
end $$;

-- ── VENDEDOR: os orçamentos DELE (mais novos primeiro). ───────────────────────────────────────
create or replace function public.seller_quote_list(p_secret text, p_email text, p_limit int default 100)
returns table(id uuid, client_name text, client_email text, client_phone text, total text, currency text,
              status text, token text, viewed_at timestamptz, accepted_at timestamptz, accepted_name text,
              created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select q.id, q.client_name, q.client_email, q.client_phone, q.total, q.currency, q.status, q.token,
           q.viewed_at, q.accepted_at, q.accepted_name, q.created_at, q.updated_at
      from seller_quotes q
     where q.seller_email = lower(trim(p_email))
     order by q.created_at desc
     limit greatest(1, least(coalesce(p_limit, 100), 500));
end $$;

-- ── PÚBLICO (token de capacidade): o cliente ABRE o orçamento. Sem login.
--    Não devolve o e-mail do vendedor nem qualquer outro dado de outro orçamento. ──────────────
create or replace function public.seller_quote_by_token(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_token is null or length(p_token) < 24 then return 'null'::jsonb; end if;
  select jsonb_build_object(
           'id', q.id, 'client_name', q.client_name, 'itens', q.itens, 'total', q.total,
           'currency', q.currency, 'status', q.status, 'accepted_name', q.accepted_name,
           'accepted_at', q.accepted_at, 'created_at', q.created_at)
    into v from seller_quotes q where q.token = p_token limit 1;
  return coalesce(v, 'null'::jsonb);
end $$;

-- ── PÚBLICO: marcar como VISTO. draft/sent → viewed. Nunca rebaixa um aceite. ────────────────
create or replace function public.seller_quote_mark_viewed(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 24 then return false; end if;
  update seller_quotes
     set status = case when status in ('draft','sent') then 'viewed' else status end,
         viewed_at = coalesce(viewed_at, now()), updated_at = now()
   where token = p_token;
  return found;
end $$;

-- ── PÚBLICO: o cliente ACEITA. Devolve o RECIBO (id, vendedor, cliente, total) — como
--    `contrato_assinar` faz — pra avisar quem precisa saber sem uma segunda leitura. ──────────
create or replace function public.seller_quote_accept(p_token text, p_name text, p_ip text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row seller_quotes%rowtype;
begin
  if p_token is null or length(p_token) < 24 then return jsonb_build_object('ok', false, 'motivo', 'link_invalido'); end if;
  if coalesce(trim(p_name),'') = '' then return jsonb_build_object('ok', false, 'motivo', 'nome_obrigatorio'); end if;
  update seller_quotes
     set status = 'accepted', accepted_name = left(trim(p_name), 120), accepted_at = now(),
         accepted_ip = left(coalesce(p_ip,''), 60), updated_at = now()
   where token = p_token and status in ('draft','sent','viewed')
  returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'motivo', 'link_invalido_ou_ja_aceito'); end if;
  return jsonb_build_object('ok', true, 'id', v_row.id, 'vendedor', v_row.seller_email,
                            'cliente', coalesce(v_row.client_name,''), 'total', v_row.total,
                            'assinante', v_row.accepted_name, 'quando', v_row.accepted_at);
end $$;

grant execute on function public.seller_quote_upsert(text,text,uuid,text,text,text,jsonb,text,bigint,text,text) to anon;
grant execute on function public.seller_quote_list(text,text,int)   to anon;
grant execute on function public.seller_quote_by_token(text)        to anon;
grant execute on function public.seller_quote_mark_viewed(text)     to anon;
grant execute on function public.seller_quote_accept(text,text,text) to anon;

-- ✅ Pronto. /vendedor → aba Orçamento → "Salvar e gerar link" (seller_quote_upsert) → o vendedor
--    manda /orcamento/<token> → o cliente abre (by_token + mark_viewed) e aceita (accept), e o
--    orçamento aparece em "Orçamentos em aberto" com a idade dele.
