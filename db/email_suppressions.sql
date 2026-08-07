-- ============================================================================
-- GUILEO · EMAIL SUPPRESSION (CAN-SPAM opt-out) — applied via MCP 2026-07-29; committed for audit.
-- Per-tenant list: a contact who unsubscribes from THIS client's marketing never gets another
-- campaign from them. RPCs SERVICE_ROLE-ONLY. The public unsubscribe endpoint (functions/api/
-- unsubscribe.js) validates an HMAC token before calling email_suppress_add. campaign_send
-- (coupons.js) filters email_suppressed_list before sending. Project ynihodbknhjirkdogxby. Idempotent.
-- ============================================================================
create table if not exists public.email_suppressions (
  client_email  text not null,
  contact_email text not null,
  created_at    timestamptz not null default now(),
  primary key (client_email, contact_email)
);
alter table public.email_suppressions enable row level security;

create or replace function public._esup_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret = 'glo_ing_c7f2a9e4b8d16350' $$;

create or replace function public.email_suppress_add(p_secret text, p_client_email text, p_contact_email text)
returns boolean language plpgsql security definer set search_path=public as $$
declare c text := lower(trim(coalesce(p_client_email,''))); e text := lower(trim(coalesce(p_contact_email,'')));
begin
  if not public._esup_ok(p_secret) then raise exception 'unauthorized' using errcode='28000'; end if;
  if c='' or position('@' in e)=0 then return false; end if;
  insert into public.email_suppressions(client_email, contact_email) values (c, e) on conflict do nothing;
  return true;
end $$;

create or replace function public.email_suppressed_list(p_secret text, p_client_email text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c text := lower(trim(coalesce(p_client_email,''))); v jsonb;
begin
  if not public._esup_ok(p_secret) then raise exception 'unauthorized' using errcode='28000'; end if;
  if c='' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(contact_email), '[]'::jsonb) into v from public.email_suppressions where client_email=c;
  return v;
end $$;

revoke all on function public.email_suppress_add(text,text,text) from public;
revoke all on function public.email_suppress_add(text,text,text) from anon;
revoke all on function public.email_suppressed_list(text,text) from public;
revoke all on function public.email_suppressed_list(text,text) from anon;
grant execute on function public.email_suppress_add(text,text,text) to service_role;
grant execute on function public.email_suppressed_list(text,text) to service_role;
