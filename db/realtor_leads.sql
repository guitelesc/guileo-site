-- ============================================================================
-- GUILEO · REALTOR LEAD-RESPONDER (Zillow / StreetEasy)  — paste in Supabase → SQL Editor → Run
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com) · Idempotent (pode rodar de novo).
-- REQUIRES: db/marketplace_leads.sql already pasted (table + _mkt_ok + the other RPCs).
--
-- WHAT THIS DOES: extends mkt_lead_record's source whitelist with 'zillow' and 'streeteasy'
-- so realtor leads keep their real source instead of collapsing to 'other'. Same signature,
-- same behavior, same gate, same idempotent dedupe — ONLY the source CASE list grows.
-- For zillow/streeteasy the endpoint stores the LISTING ADDRESS in the `service` field.
--
-- SECURITY: unchanged — SECURITY DEFINER, INGEST-gated by the literal 'glo_ing_7f3da9c2b4e8'
-- via _mkt_ok, client-scoped by p_email, table stays RLS-locked with no anon policies.
-- ============================================================================

-- ── RECORD (idempotent): insert unless the same lead already arrived in the last hour.
--    Match key = (tenant, source, normalized phone) or, when no phone, (tenant, source, email).
--    Returns jsonb { id, duplicate } so the caller knows whether to fire the callback path.
--    v2: source whitelist = yelp | angi | thumbtack | zillow | streeteasy (else 'other'). ──
create or replace function public.mkt_lead_record(
  p_secret text, p_email text, p_source text,
  p_name text default null, p_phone text default null, p_contact_email text default null,
  p_service text default null, p_message text default null, p_raw jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_source text := case when lower(coalesce(p_source,'')) in ('yelp','angi','thumbtack','zillow','streeteasy') then lower(p_source) else 'other' end;
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

-- ── GRANT (same signature — re-grant is a harmless idempotent no-op) ──────────
grant execute on function public.mkt_lead_record(text,text,text,text,text,text,text,text,jsonb) to anon;
