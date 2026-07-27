-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP CLOUD API (Meta, direct) — per-tenant creds + phone→tenant map + dedup.
-- Backs functions/api/whatsapp-cloud.js. This is the ALT path to WhatsApp that does
-- NOT depend on Twilio's blocked A2P/10DLC.
--
-- Creds live in the EXISTING client_integrations table (same as square/mindbody):
--   provider = 'whatsapp_cloud'
--   tokens   = { "phone_number_id": "...", "waba_id": "...", "access_token": "..." }
-- Written at connect time via store_integration (already live). These RPCs READ them.
--
-- Multi-tenant isolation: the inbound webhook resolves the tenant SOLELY from the
-- metadata.phone_number_id Meta sends → whatsapp_cloud_tenant_by_pnid(). One client's
-- Gui can never be reached with another client's number.
--
-- Security: every RPC is INGEST-gated on the hardcoded literal (Supabase forbids GUC),
-- SECURITY DEFINER, search_path pinned. The dedup table has RLS ON with NO anon policy
-- (only the SECURITY DEFINER RPC touches it). Idempotent DDL — safe to paste twice.
-- Paste in Supabase project ynihodbknhjirkdogxby (owner smart@guileoai.com).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) TENANT ROUTING — phone_number_id → { client_email, tokens }.
--    Returns NULL when no tenant has connected that WhatsApp number yet (webhook then
--    ACKs Meta and stays silent — never guesses a tenant).
create or replace function public.whatsapp_cloud_tenant_by_pnid(p_secret text, p_phone_number_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_phone_number_id is null or trim(p_phone_number_id) = '' then return null; end if;
  select jsonb_build_object('client_email', client_email, 'tokens', tokens)
    into v
  from client_integrations
  where provider = 'whatsapp_cloud'
    and tokens->>'phone_number_id' = trim(p_phone_number_id)
  limit 1;
  return v; -- NULL if not connected
end $$;
grant execute on function public.whatsapp_cloud_tenant_by_pnid(text, text) to anon;

-- 2) CREDS LOOKUP by tenant — for PROACTIVE sends (reminders/win-backs) where we already
--    know the client_email and need its phone_number_id + access_token.
create or replace function public.whatsapp_cloud_creds_lookup(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  return (
    select tokens
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'whatsapp_cloud'
    limit 1
  );
end $$;
grant execute on function public.whatsapp_cloud_creds_lookup(text, text) to anon;

-- 3) DEDUP — Meta re-delivers a webhook on any non-200/slow ACK. We record each Meta
--    message id once (per tenant) so a retry can never double-answer.
create table if not exists whatsapp_cloud_seen (
  msg_id        text primary key,
  client_email  text not null,
  seen_at       timestamptz not null default now()
);
alter table whatsapp_cloud_seen enable row level security;
-- No anon policy on purpose: only the SECURITY DEFINER RPC below reads/writes this table.
create index if not exists ix_wa_cloud_seen_email on whatsapp_cloud_seen(client_email, seen_at desc);

-- Returns TRUE if this msg_id was NEWLY inserted (first delivery → process it),
-- FALSE if it was already seen (a Meta retry → skip). Atomic via ON CONFLICT.
create or replace function public.whatsapp_cloud_mark_seen(p_secret text, p_email text, p_msg_id text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_rows integer := 0;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_msg_id is null or trim(p_msg_id) = '' then return true; end if; -- no id → never block
  insert into whatsapp_cloud_seen (msg_id, client_email)
    values (trim(p_msg_id), lower(trim(coalesce(p_email, ''))))
    on conflict (msg_id) do nothing;
  get diagnostics v_rows = row_count;  -- 1 = new insert, 0 = duplicate
  return v_rows > 0;
end $$;
grant execute on function public.whatsapp_cloud_mark_seen(text, text, text) to anon;

-- Optional housekeeping: prune dedup rows older than 30 days (run from cron if desired).
create or replace function public.whatsapp_cloud_prune_seen(p_secret text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  with d as (delete from whatsapp_cloud_seen where seen_at < now() - interval '30 days' returning 1)
  select count(*) into n from d;
  return n;
end $$;
grant execute on function public.whatsapp_cloud_prune_seen(text) to anon;
