-- ============================================================================
-- Guileo · LIFECYCLE — the automatic nurture drip + referral attribution reads
-- (paste in Supabase → SQL Editor → Run · project ynihodbknhjirkdogxby,
--  account smart@guileoai.com). INGEST-gated, same literal as add_client_credits.
--
-- Powers functions/api/lifecycle.js (cron every few hours):
--   1. drip_log + drip_claim — ATOMIC "may I send this step to this email?" marker.
--      The engine claims BEFORE sending, so even two racing cron runs can never
--      email the same lead the same step twice (politeness over repeat — same
--      philosophy as receivables' finance_mark_nudged).
--   2. lead_converted — cheap "is this email already a paying client?" check so
--      the drip stops the moment someone converts (reads client_credits; returns
--      false gracefully if that table isn't in this project yet).
--   3. lead_ref_lookup — used by /api/stripe-webhook on a NEW client's first
--      payment: finds the most recent "👤ref:<slug>" carried by that buyer's
--      lead rows in gui_actions (90-day window), so referral conversions are
--      detected server-side without opening gui_actions to anonymous reads.
-- ============================================================================

-- One row per (email, step) ever sent by the drip machine. PK = the idempotency.
create table if not exists public.drip_log (
  email   text not null,
  step    text not null,
  sent_at timestamptz not null default now(),
  primary key (email, step)
);

-- RLS on, NO policies: anonymous can neither read nor write the table directly —
-- only the SECURITY DEFINER RPCs below touch it.
alter table public.drip_log enable row level security;

-- ATOMIC claim: returns true exactly ONCE per (email, step) — the caller sends
-- the email only on true. INSERT … ON CONFLICT DO NOTHING is race-safe: if two
-- runs collide, exactly one gets the row back.
create or replace function public.drip_claim(p_secret text, p_email text, p_step text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into drip_log (email, step)
  values (lower(trim(p_email)), lower(trim(p_step)))
  on conflict (email, step) do nothing
  returning email into v_email;
  return v_email is not null;
end $$;

-- "Already a client?" — true when the email has a client_credits row (every paid
-- signup gets one via add_client_credits). Column name resolved dynamically
-- (client_email vs email) and the whole check degrades to false if the table
-- isn't present in this project yet — the drip then simply keeps nurturing.
create or replace function public.lead_converted(p_secret text, p_email text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_col text; v_ok boolean;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select column_name into v_col
    from information_schema.columns
   where table_schema = 'public' and table_name = 'client_credits'
     and column_name in ('client_email', 'email')
   order by case column_name when 'client_email' then 0 else 1 end
   limit 1;
  if v_col is null then return false; end if;
  execute format('select exists(select 1 from public.client_credits where lower(%I) = $1)', v_col)
    into v_ok using lower(trim(p_email));
  return coalesce(v_ok, false);
end $$;

-- Most recent referral slug carried by this contact's lead rows (90 days).
-- lead.js writes it into gui_actions.details as "👤ref:<slug>"; the slug is either
-- a base64url-encoded referrer email (cockpit "Indique e ganhe" card) or a seller
-- name (?ref= links). Returns null when the buyer arrived unreferred.
create or replace function public.lead_ref_lookup(p_secret text, p_contact text)
returns text
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select substring(a.details from '👤ref:([^\s·]+)')
      from gui_actions a
     where a.action = 'lead'
       and a.details like '%👤ref:%'
       and lower(trim(coalesce(a.contact, ''))) = lower(trim(p_contact))
       and a.created_at > now() - interval '90 days'
     order by a.created_at desc
     limit 1
  );
end $$;

grant execute on function public.drip_claim(text, text, text) to anon;
grant execute on function public.lead_converted(text, text) to anon;
grant execute on function public.lead_ref_lookup(text, text) to anon;

-- ✅ Done. /api/lifecycle turns ready:true on its next cron hit (it probes drip_claim);
--    /api/stripe-webhook starts detecting referral conversions on the next new client.
