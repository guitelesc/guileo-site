-- ─────────────────────────────────────────────────────────────────────────────
-- client_number_lookup — money-safety guard for auto-provisioning.
--
-- WHY: functions/lib/provision.js → buyAndBindNumber() now calls this BEFORE buying a
-- Twilio number. If the client already has one, it re-binds the existing number instead
-- of purchasing a second one — so a rare webhook double-delivery / manual re-run can never
-- buy duplicate $1/mo numbers. The JS guard is graceful: if this function isn't installed,
-- it simply falls through to the normal purchase (no behavior change).
--
-- Paste this in the Supabase SQL Editor (project ynihodbknhjirkdogxby, account
-- smart@guileoai.com). It uses the SAME INGEST gate literal that set_client_number /
-- add_client_credits / mark_webhook_seen already use, and only READS — never writes.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.client_number_lookup(p_secret text, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  return (
    select tokens->>'number'
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'twilio_number'
    limit 1
  );
end
$$;
