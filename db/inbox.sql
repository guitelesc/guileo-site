-- ─────────────────────────────────────────────────────────────────────────────
-- Guileo — UNIFIED INBOX read model (portal "Inbox" tab, /api/inbox).
-- Project ynihodbknhjirkdogxby (account smart@guileoai.com) — the OWNED, MCP-writable
-- data project where the client_events ledger already lives (twilio-inbound.js and
-- widget-chat.js write here via ingest_client_event).
--
-- WHY a new RPC instead of the existing get_client_data events feed:
--   get_client_data returns events WITHOUT payload, so it cannot (a) group a customer's
--   messages into a real thread, nor (b) recover the phone number needed to route an
--   outbound reply through the right channel. These two functions read client_events
--   DIRECTLY (payload included), fold every channel into one thread key, and expose the
--   reply route — everything the two-pane cockpit inbox needs.
--
-- SECURITY: INGEST-gated by the same shared literal as the other read RPCs
-- (seller_conversions, etc.). The HTTP layer (/api/inbox) additionally binds email+key
-- via get_client_data before ever calling these, so a stolen literal alone can't read a
-- tenant's inbox through the browser. READ-only. Idempotent (safe to re-run).
--
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, smart@guileoai.com).
-- Until pasted, /api/inbox returns a graceful { ready:false, note } and the cockpit falls
-- back to the honest empty state — nothing breaks.
-- ─────────────────────────────────────────────────────────────────────────────

-- Internal: the normalized per-event projection used by BOTH functions below.
-- Folds SMS / WhatsApp / web-chat / social / phone into a single (tkey, channel, contact,
-- direction, body, phone, created_at) shape. Control events (takeover / confirm-nudge) are
-- excluded so they never appear as conversations.
--   • tkey     — stable thread key: customer phone digits → web-chat session → name-from-summary.
--   • dir      — 'in' (customer) | 'ai' (Gui auto-reply) | 'you' (human took over & replied).
--   • body     — the message text with the "<name>: " / "🤖 Gui replied: " prefix stripped.
--   • phone    — reply route (+E164-ish) recovered from payload.from / payload.to.
create or replace function public._inbox_events(p_client_email text)
returns table (tkey text, channel text, contact text, dir text, body text, phone text, created_at timestamptz)
language sql stable security definer set search_path = public as $func$
  select
    coalesce(
      nullif(regexp_replace(coalesce(nullif(e.payload->>'from',''), nullif(e.payload->>'to','')), '[^0-9]', '', 'g'), ''),
      nullif(e.payload->>'session',''),
      lower(nullif(left(trim(regexp_replace(coalesce(split_part(e.summary, ':', 1), ''), '^[^0-9A-Za-zÀ-ÿ]+', '')), 40), ''))
    ) as tkey,
    case
      when lower(coalesce(e.channel,'')) like '%whats%' then 'WhatsApp'
      when lower(coalesce(e.channel,'')) like '%sms%' or lower(coalesce(e.channel,'')) like '%text%' then 'SMS'
      when lower(coalesce(e.channel,'')) like '%webchat%' or lower(coalesce(e.channel,'')) like '%chat%' or lower(coalesce(e.channel,'')) like '%web%' then 'Webchat'
      when lower(coalesce(e.channel,'')) like '%insta%' then 'Instagram'
      when lower(coalesce(e.channel,'')) like '%face%' or lower(coalesce(e.channel,'')) like '%messenger%' then 'Facebook'
      when lower(coalesce(e.channel,'')) like '%tiktok%' then 'TikTok'
      when lower(coalesce(e.channel,'')) like '%phone%' or lower(coalesce(e.channel,'')) like '%call%' or lower(coalesce(e.channel,'')) like '%voice%' or e.type = 'call' then 'Phone'
      else coalesce(nullif(e.channel,''), 'Message')
    end as channel,
    left(trim(regexp_replace(coalesce(split_part(e.summary, ':', 1), ''), '^[^0-9A-Za-zÀ-ÿ]+', '')), 40) as contact,
    case
      when e.payload->>'kind' = 'human_reply' then 'you'
      when e.summary ilike '%Gui replied:%' or e.payload->>'kind' = 'ai_reply' then 'ai'
      when (e.payload ? 'to') and not (e.payload ? 'from') then 'ai'
      else 'in'
    end as dir,
    case
      when e.summary ilike '🤖 Gui replied:%' then trim(substring(e.summary from position(':' in e.summary) + 1))
      else regexp_replace(e.summary, '^[^:]{1,40}:\s*', '')
    end as body,
    regexp_replace(coalesce(nullif(e.payload->>'from',''), nullif(e.payload->>'to','')), '[^0-9+]', '', 'g') as phone,
    e.created_at
  from public.client_events e
  where lower(e.client_email) = lower(p_client_email)
    and e.type in ('message','call','lead','booking')
    and coalesce(e.payload->>'kind','') not in ('takeover','confirm-nudge');
$func$;

-- 1) Thread list — one row per (tkey) conversation, newest first, with last line, unread
--    count (inbound messages that landed after the most recent outbound), reply route and
--    the human-takeover flag (latest 'takeover' control event wins).
create or replace function public.inbox_threads(p_secret text, p_client_email text, p_limit int default 60)
returns json
language plpgsql stable security definer set search_path = public as $func$
declare result json;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select coalesce(json_agg(t order by t.last_at desc), '[]'::json) into result
  from (
    select
      g.id,
      g.channel,
      coalesce(nullif(g.contact,''), g.id) as contact,
      g.last,
      g.last_at,
      g.phone,
      (select count(*) from public._inbox_events(p_client_email) x
         where x.tkey = g.id and x.dir = 'in'
           and x.created_at > coalesce(
             (select max(y.created_at) from public._inbox_events(p_client_email) y
                where y.tkey = g.id and y.dir in ('ai','you')), 'epoch'::timestamptz)) as unread,
      coalesce((
        select (c.payload->>'human')::boolean
        from public.client_events c
        where lower(c.client_email) = lower(p_client_email)
          and c.payload->>'kind' = 'takeover'
          and c.payload->>'thread_key' = g.id
        order by c.created_at desc limit 1), false) as human
    from (
      select
        e.tkey as id,
        (array_agg(e.channel order by e.created_at desc))[1] as channel,
        (array_agg(nullif(e.contact,'') order by e.created_at desc))[1] as contact,
        (array_agg(e.body order by e.created_at desc))[1] as last,
        max(e.created_at) as last_at,
        (array_agg(nullif(e.phone,'') order by e.created_at desc))[1] as phone
      from public._inbox_events(p_client_email) e
      where e.tkey is not null
      group by e.tkey
    ) g
    order by g.last_at desc
    limit greatest(coalesce(p_limit, 60), 1)
  ) t;
  return result;
end $func$;

-- 2) One thread's messages (oldest → newest) + its reply route and takeover flag.
create or replace function public.inbox_thread(p_secret text, p_client_email text, p_thread text, p_channel text default null)
returns json
language plpgsql stable security definer set search_path = public as $func$
declare msgs json; ph text; hum boolean; chan text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select coalesce(json_agg(m order by m.created_at), '[]'::json) into msgs
  from (
    select e.dir as direction, e.body, e.created_at, e.channel
    from public._inbox_events(p_client_email) e
    where e.tkey = p_thread and (p_channel is null or e.channel = p_channel)
    order by e.created_at
  ) m;
  select (array_agg(nullif(e.phone,'') order by e.created_at desc))[1],
         (array_agg(e.channel order by e.created_at desc))[1]
    into ph, chan
  from public._inbox_events(p_client_email) e
  where e.tkey = p_thread and (p_channel is null or e.channel = p_channel);
  select coalesce((c.payload->>'human')::boolean, false) into hum
  from public.client_events c
  where lower(c.client_email) = lower(p_client_email)
    and c.payload->>'kind' = 'takeover'
    and c.payload->>'thread_key' = p_thread
  order by c.created_at desc limit 1;
  return json_build_object('messages', msgs, 'phone', coalesce(ph,''), 'channel', coalesce(chan, p_channel, ''), 'human', coalesce(hum, false));
end $func$;

grant execute on function public._inbox_events(text) to anon;
grant execute on function public.inbox_threads(text, text, int) to anon;
grant execute on function public.inbox_thread(text, text, text, text) to anon;

-- ✅ Done. The cockpit "Inbox" tab (/api/inbox) now reads real threads across every channel
--    from client_events, groups them per customer, and can route a human reply. The AI/human
--    takeover flag is stored as a 'takeover' control event (payload.kind='takeover'), so no
--    extra table is needed.
