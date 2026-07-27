-- ─────────────────────────────────────────────────────────────────────────────
-- Guileo — REAL messages backend for the portal Inbox.  (DEPLOYED 2026-06-14)
-- Ran against the DATA project muuh-pay (fccwbafkbhkyrvauzshl).
--
-- A locked client_messages table + SECURITY DEFINER RPCs that reuse the existing
-- get_client_data(p_email, p_key) as the client validator — so NO secret is stored
-- in the database. Idempotent (safe to re-run).
--
-- Inbound customer messages currently come from the existing client_events ledger
-- (the portal merges them in). A secret-gated server-side inbound writer can be added
-- later, gated via a Postgres setting / secrets table — NEVER a hardcoded literal.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.client_messages (
  id           bigint generated always as identity primary key,
  client_email text not null,
  channel      text not null default 'WhatsApp',   -- WhatsApp | SMS | Phone | Instagram | Facebook | TikTok
  contact      text not null default 'Customer',   -- the customer's name/handle (thread key with channel)
  direction    text not null default 'in',         -- in (customer) | out (you) | ai (Gui)
  body         text not null default '',
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists client_messages_email_idx on public.client_messages (lower(client_email), created_at desc);

-- Locked: no anon/public table access. All reads/writes go through the definer RPCs.
alter table public.client_messages enable row level security;

-- Validate a client by reusing the existing get_client_data; raises 28000 if the key is wrong.
create or replace function public._gui_assert_client(p_email text, p_key text) returns void
language plpgsql security definer set search_path = public as $func$
declare v json;
begin
  v := public.get_client_data(p_email, p_key);
  if v is null then raise exception 'unauthorized' using errcode = '28000'; end if;
end $func$;

-- 1) Conversation list: one row per (channel, contact), newest first, with unread count.
create or replace function public.client_conversations(p_email text, p_key text) returns json
language plpgsql security definer set search_path = public as $func$
declare result json;
begin
  perform public._gui_assert_client(p_email, p_key);
  select coalesce(json_agg(c order by c.last_at desc), '[]'::json) into result from (
    select channel, contact,
           (array_agg(body order by created_at desc))[1] as last,
           max(created_at) as last_at,
           count(*) filter (where direction = 'in' and read_at is null) as unread
    from public.client_messages
    where lower(client_email) = lower(p_email)
    group by channel, contact
  ) c;
  return result;
end $func$;

-- 2) One thread's messages (oldest → newest).
create or replace function public.client_thread(p_email text, p_key text, p_channel text, p_contact text) returns json
language plpgsql security definer set search_path = public as $func$
declare result json;
begin
  perform public._gui_assert_client(p_email, p_key);
  select coalesce(json_agg(m order by m.created_at), '[]'::json) into result from (
    select direction, body, created_at
    from public.client_messages
    where lower(client_email) = lower(p_email) and channel = p_channel and contact = p_contact
    order by created_at
  ) m;
  return result;
end $func$;

-- 3) Client sends an outbound reply from the portal.
create or replace function public.client_send_message(p_email text, p_key text, p_channel text, p_contact text, p_body text) returns json
language plpgsql security definer set search_path = public as $func$
begin
  perform public._gui_assert_client(p_email, p_key);
  if coalesce(trim(p_body), '') = '' then raise exception 'empty body'; end if;
  insert into public.client_messages (client_email, channel, contact, direction, body)
  values (lower(p_email), coalesce(p_channel, 'WhatsApp'), coalesce(p_contact, 'Customer'), 'out', left(p_body, 4000));
  return json_build_object('ok', true);
end $func$;

-- 4) Mark a thread's inbound messages read.
create or replace function public.client_mark_read(p_email text, p_key text, p_channel text, p_contact text) returns json
language plpgsql security definer set search_path = public as $func$
begin
  perform public._gui_assert_client(p_email, p_key);
  update public.client_messages set read_at = now()
  where lower(client_email) = lower(p_email) and channel = p_channel and contact = p_contact
    and direction = 'in' and read_at is null;
  return json_build_object('ok', true);
end $func$;

-- The client-facing RPCs are exposed to anon; each self-validates via the client key.
grant execute on function public.client_conversations(text, text) to anon;
grant execute on function public.client_thread(text, text, text, text) to anon;
grant execute on function public.client_send_message(text, text, text, text, text) to anon;
grant execute on function public.client_mark_read(text, text, text, text) to anon;
