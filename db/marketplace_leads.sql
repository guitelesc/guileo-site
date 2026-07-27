-- ============================================================================
-- GUILEO · MARKETPLACE LEAD-RESPONDER  (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com) · Idempotent (pode rodar de novo).
--
-- THESIS (speed-to-lead): a lead lands on Yelp/Angi/Thumbtack → Zapier/Make/email-forward
-- POSTs it to /api/marketplace-leads → row here → CRM contact → Gui CALLS the lead back in
-- ~60s (through the hardened /api/call gate) → owner alerted. 78% buy from whoever answers
-- first — Gui answers first.
--
-- SECURITY: every RPC is SECURITY DEFINER, INGEST-gated by the same literal the ingest
-- pipeline uses ('glo_ing_7f3da9c2b4e8' — see db/coupons.sql / db/capture_tools.sql),
-- granted to anon, and CLIENT-SCOPED by p_email — no tenant can read/write another tenant's
-- leads. Table has RLS ON with NO anon policies, so only the definer funcs reach it.
--
-- IDEMPOTENCY: marketplaces + Zapier RE-DELIVER webhooks. mkt_lead_record dedupes by
-- (tenant, source, phone-or-email, ~1h window) so a re-delivered lead never dupes — and
-- mkt_lead_call_claim is an ATOMIC one-shot claim so the auto-callback fires EXACTLY ONCE
-- per lead no matter how many workers race on it.
-- ============================================================================

-- ── TABLE ────────────────────────────────────────────────────────────────────
create table if not exists public.marketplace_leads (
  id              uuid primary key default gen_random_uuid(),
  client_email    text not null,
  source          text not null default 'other',   -- yelp | angi | thumbtack | other
  name            text,
  phone           text,                            -- normalized E.164-ish (digits and +)
  email           text,
  service         text,                            -- what they asked for ("deep cleaning"…)
  message         text,
  raw             jsonb not null default '{}'::jsonb,  -- ALWAYS keep the original payload
  status          text not null default 'new',     -- new | called | converted | lost
  call_claimed_at timestamptz,                     -- set once by mkt_lead_call_claim (one-shot)
  created_at      timestamptz not null default now()
);
create index if not exists idx_mkt_leads_tenant on public.marketplace_leads (client_email, created_at desc);
-- dedupe probe path: recent rows for (tenant, source)
create index if not exists idx_mkt_leads_dedupe on public.marketplace_leads (client_email, source, created_at desc);

-- ── RLS: trancado; só as funções SECURITY DEFINER acessam ────────────────────
alter table public.marketplace_leads enable row level security;

-- ── GATE helper (same literal as the ingest pipeline) ─────────────────────────
create or replace function public._mkt_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret = 'glo_ing_7f3da9c2b4e8' $$;

-- ── RECORD (idempotent): insert unless the same lead already arrived in the last hour.
--    Match key = (tenant, source, normalized phone) or, when no phone, (tenant, source, email).
--    Returns jsonb { id, duplicate } so the caller knows whether to fire the callback path. ──
create or replace function public.mkt_lead_record(
  p_secret text, p_email text, p_source text,
  p_name text default null, p_phone text default null, p_contact_email text default null,
  p_service text default null, p_message text default null, p_raw jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_source text := case when lower(coalesce(p_source,'')) in ('yelp','angi','thumbtack') then lower(p_source) else 'other' end;
  v_phone  text := nullif(regexp_replace(coalesce(p_phone,''), '[^0-9+]', '', 'g'), '');
  v_cemail text := nullif(lower(trim(coalesce(p_contact_email,''))), '');
  v_id     uuid;
begin
  if not public._mkt_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'no tenant' using errcode = 'P0002'; end if;
  if v_phone is null and v_cemail is null then raise exception 'need phone or email' using errcode = 'P0001'; end if;

  -- IDEMPOTENT: a re-delivered webhook (same tenant+source+handle within ~1h) returns the
  -- existing row instead of inserting a dupe — so the lead is never double-called/double-alerted.
  select id into v_id from public.marketplace_leads
   where client_email = v_tenant and source = v_source
     and created_at > now() - interval '1 hour'
     and ((v_phone is not null and regexp_replace(coalesce(phone,''), '[^0-9+]', '', 'g') = v_phone)
       or (v_phone is null and lower(coalesce(email,'')) = v_cemail))
   order by created_at desc limit 1;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'duplicate', true);
  end if;

  insert into public.marketplace_leads (client_email, source, name, phone, email, service, message, raw)
  values (
    v_tenant, v_source,
    nullif(left(trim(coalesce(p_name,'')), 120), ''),
    v_phone, v_cemail,
    nullif(left(trim(coalesce(p_service,'')), 160), ''),
    nullif(left(trim(coalesce(p_message,'')), 800), ''),
    coalesce(p_raw, '{}'::jsonb)
  ) returning id into v_id;
  return jsonb_build_object('id', v_id, 'duplicate', false);
end $$;

-- ── CALL CLAIM (atomic one-shot): true exactly once per lead — the winner fires the 60s
--    Gui callback; every racing/duplicate delivery loses the claim and skips the dial. ──
create or replace function public.mkt_lead_call_claim(p_secret text, p_email text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_won boolean := false;
begin
  if not public._mkt_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  update public.marketplace_leads
     set call_claimed_at = now(), status = case when status = 'new' then 'called' else status end
   where id = p_id and client_email = v_tenant and call_claimed_at is null
  returning true into v_won;
  return coalesce(v_won, false);
end $$;

-- ── LIST (tenant-scoped, newest first) ────────────────────────────────────────
create or replace function public.mkt_leads_list(p_secret text, p_email text, p_limit int default 100)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_lim int := greatest(1, least(coalesce(p_limit,100), 500));
begin
  if not public._mkt_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', l.id, 'source', l.source, 'name', l.name, 'phone', l.phone, 'email', l.email,
             'service', l.service, 'message', l.message, 'status', l.status,
             'called', l.call_claimed_at is not null, 'created_at', l.created_at
           ) order by l.created_at desc)
    from (select * from public.marketplace_leads
           where client_email = v_tenant order by created_at desc limit v_lim) l
  ), '[]'::jsonb);
end $$;

-- ── STATUS (tenant-scoped; owner marks converted/lost from the cockpit) ───────
create or replace function public.mkt_lead_status(p_secret text, p_email text, p_id uuid, p_status text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_ok boolean := false;
begin
  if not public._mkt_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  if coalesce(p_status,'') not in ('new','called','converted','lost') then raise exception 'bad status' using errcode = 'P0001'; end if;
  update public.marketplace_leads set status = p_status
   where id = p_id and client_email = v_tenant
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;

-- ── GRANTS (anon reaches ONLY the gated definer funcs — table stays RLS-locked) ─
grant execute on function public._mkt_ok(text)                                                     to anon;
grant execute on function public.mkt_lead_record(text,text,text,text,text,text,text,text,jsonb)    to anon;
grant execute on function public.mkt_lead_call_claim(text,text,uuid)                               to anon;
grant execute on function public.mkt_leads_list(text,text,int)                                     to anon;
grant execute on function public.mkt_lead_status(text,text,uuid,text)                              to anon;
