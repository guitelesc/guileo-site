-- ============================================================================
-- Guileo · COMPANY OS — ADMIN/LEGAL: contracts & quotes + own e-signature
-- (paste in Supabase → SQL Editor → Run). Gated by _gui_sched_ok for admin/portal reads;
-- the counterparty signs via a per-doc capability TOKEN (no login needed).
-- Two scopes: 'guileo_client' (Guileo→its client) and 'client_customer' (the client→their customers).
-- Bilingual (lang pt|en). The doc BODY is a frozen JSON snapshot so a sent doc is immutable.
-- ============================================================================

create table if not exists public.contracts (
  id                uuid primary key default gen_random_uuid(),
  client_email      text not null,                       -- the TENANT/account that owns this doc
  doc_kind          text not null default 'contract',    -- contract | quote
  party_scope       text not null default 'guileo_client', -- guileo_client | client_customer
  template_code     text,
  lang              text not null default 'pt',           -- pt | en
  title             text,
  counterparty_name text,
  counterparty_email text,
  amount_cents      bigint not null default 0,
  body              jsonb not null default '{}'::jsonb,   -- frozen snapshot: parties, scope, clauses, totals
  status            text not null default 'draft',        -- draft | sent | signed | void
  signer_name       text,
  signed_at         timestamptz,
  signer_ip         text,
  audit             jsonb not null default '[]'::jsonb,
  contact_id        uuid,
  sign_token        text not null default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists contracts_tenant on public.contracts (client_email, status, created_at desc);
create index if not exists contracts_token on public.contracts (sign_token);
alter table public.contracts enable row level security;

-- ADMIN/PORTAL: create or update a contract/quote (gated by the app secret).
create or replace function public.contract_upsert(
  p_secret text, p_email text, p_id uuid, p_kind text, p_scope text, p_template text, p_lang text,
  p_title text, p_counterparty_name text, p_counterparty_email text, p_amount_cents bigint, p_body jsonb, p_status text, p_contact_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  if p_id is not null then
    update contracts set doc_kind=coalesce(p_kind,doc_kind), party_scope=coalesce(p_scope,party_scope), template_code=p_template,
      lang=coalesce(p_lang,lang), title=p_title, counterparty_name=p_counterparty_name, counterparty_email=p_counterparty_email,
      amount_cents=greatest(coalesce(p_amount_cents,0),0), body=coalesce(p_body,body), status=coalesce(p_status,status),
      contact_id=coalesce(p_contact_id,contact_id), updated_at=now()
    where id=p_id and client_email=lower(trim(p_email)) returning id into v_id;
    if v_id is not null then return v_id; end if;
  end if;
  insert into contracts(client_email, doc_kind, party_scope, template_code, lang, title, counterparty_name, counterparty_email, amount_cents, body, status, contact_id)
  values (lower(trim(p_email)), coalesce(p_kind,'contract'), coalesce(p_scope,'guileo_client'), p_template, coalesce(p_lang,'pt'),
          p_title, p_counterparty_name, p_counterparty_email, greatest(coalesce(p_amount_cents,0),0), coalesce(p_body,'{}'::jsonb), coalesce(p_status,'draft'), p_contact_id)
  returning id into v_id;
  return v_id;
end $$;

-- ADMIN/PORTAL: list docs for a tenant.
create or replace function public.contract_list(p_secret text, p_email text, p_limit int default 200)
returns table(id uuid, doc_kind text, party_scope text, template_code text, lang text, title text, counterparty_name text, amount_cents bigint, status text, signer_name text, signed_at timestamptz, sign_token text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query select c.id, c.doc_kind, c.party_scope, c.template_code, c.lang, c.title, c.counterparty_name, c.amount_cents, c.status, c.signer_name, c.signed_at, c.sign_token, c.created_at
    from contracts c where c.client_email=lower(trim(p_email)) order by c.created_at desc limit greatest(1, least(p_limit, 1000));
end $$;

-- PUBLIC (capability token): fetch a doc to render for the signer — NO login. The token IS the auth.
create or replace function public.contract_by_token(p_token text)
returns table(id uuid, doc_kind text, lang text, title text, counterparty_name text, amount_cents bigint, body jsonb, status text, signer_name text, signed_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 24 then return; end if;
  return query select c.id, c.doc_kind, c.lang, c.title, c.counterparty_name, c.amount_cents, c.body, c.status, c.signer_name, c.signed_at
    from contracts c where c.sign_token = p_token limit 1;
end $$;

-- PUBLIC (capability token): record the signature + audit trail → status signed.
create or replace function public.contract_sign_token(p_token text, p_signer_name text, p_ip text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 24 or coalesce(trim(p_signer_name),'') = '' then return false; end if;
  update contracts set status='signed', signer_name=left(p_signer_name,120), signed_at=now(), signer_ip=left(coalesce(p_ip,''),60),
    audit = audit || jsonb_build_object('event','signed','at', now(), 'name', left(p_signer_name,120), 'ip', left(coalesce(p_ip,''),60)),
    updated_at=now()
  where sign_token = p_token and status in ('sent','draft');
  return found;
end $$;

grant execute on function public.contract_upsert(text,text,uuid,text,text,text,text,text,text,text,bigint,jsonb,text,uuid) to anon;
grant execute on function public.contract_list(text,text,int) to anon;
grant execute on function public.contract_by_token(text) to anon;
grant execute on function public.contract_sign_token(text,text,text) to anon;

-- ✅ Done. Admin generates (contract_upsert, status 'sent') → shares /sign?t=<sign_token> →
--    counterparty signs (contract_by_token + contract_sign_token) → signed doc shows in the
--    client portal profile (contract_list). PDF is rendered from the frozen body snapshot.
