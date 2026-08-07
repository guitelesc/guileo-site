-- ============================================================================
-- GUILEO · EMAIL CAMPAIGN PER-RECIPIENT LOG — idempotency ledger for the email-marketing motor.
-- Closes the adversarial-review gap (2026-07-30): a SAVED campaign re-sent (or a partial-send retry
-- after a mid-loop timeout) must NOT re-email a contact already sent, nor charge credits twice.
-- coupons.js campaign_send filters recipients against campaign_recipients_sent BEFORE sending, then
-- records the delivered set via campaign_recipients_mark. RPCs SERVICE_ROLE-ONLY, INGEST-gated.
-- Applied via MCP 2026-07-30. Project ynihodbknhjirkdogxby. Idempotent.
-- ============================================================================
create table if not exists public.campaign_recipient_log (
  campaign_id   text not null,
  contact_email text not null,
  sent_at       timestamptz not null default now(),
  primary key (campaign_id, contact_email)
);
alter table public.campaign_recipient_log enable row level security;

create or replace function public._crl_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret = 'glo_ing_c7f2a9e4b8d16350' $$;

create or replace function public.campaign_recipients_sent(p_secret text, p_campaign_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not public._crl_ok(p_secret) then raise exception 'unauthorized' using errcode='28000'; end if;
  if coalesce(p_campaign_id,'')='' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(contact_email), '[]'::jsonb) into v
    from public.campaign_recipient_log where campaign_id=p_campaign_id;
  return v;
end $$;

create or replace function public.campaign_recipients_mark(p_secret text, p_campaign_id text, p_emails jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare n int := 0;
begin
  if not public._crl_ok(p_secret) then raise exception 'unauthorized' using errcode='28000'; end if;
  if coalesce(p_campaign_id,'')='' then return 0; end if;
  with ins as (
    insert into public.campaign_recipient_log(campaign_id, contact_email)
    select p_campaign_id, lower(trim(e)) from jsonb_array_elements_text(coalesce(p_emails,'[]'::jsonb)) as e
    where position('@' in e) > 0
    on conflict (campaign_id, contact_email) do nothing
    returning 1
  ) select count(*) into n from ins;
  return n;
end $$;

revoke all on function public.campaign_recipients_sent(text,text) from public;
revoke all on function public.campaign_recipients_sent(text,text) from anon;
revoke all on function public.campaign_recipients_mark(text,text,jsonb) from public;
revoke all on function public.campaign_recipients_mark(text,text,jsonb) from anon;
grant execute on function public.campaign_recipients_sent(text,text) to service_role;
grant execute on function public.campaign_recipients_mark(text,text,jsonb) to service_role;
