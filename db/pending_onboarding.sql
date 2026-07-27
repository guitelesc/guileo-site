-- ============================================================================
-- Guileo · Self-serve AUTO-PROVISION  (paste this in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby
-- Holds a client's "brain" (captured in /go-live) keyed by email, so when their
-- Stripe payment lands the webhook builds their trained Gui automatically.
-- Gated by a dedicated server-side secret (held only in the Pages Functions,
-- never shipped to the browser).
-- ============================================================================

create table if not exists public.gui_pending_onboarding (
  email       text primary key,
  business    text,
  industry    text,
  lang        text default 'en',
  brain       text,
  phone       text,
  status      text default 'awaiting_payment',  -- awaiting_payment | provisioned | failed
  agent_id    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.gui_pending_onboarding enable row level security;
-- (no anon RLS policy on purpose — all access goes through the gated RPCs below)

-- shared server-side secret (must match PEND_SECRET in the Pages Functions)
create or replace function public._gui_pend_ok(p_secret text)
returns boolean language sql immutable as $$
  select p_secret = 'gx_pend_7Qk2mZ9vR4tLpW8n_cit3l3s';
$$;

-- UPSERT the captured brain (called by /api/selfserve-signup when the wizard submits)
create or replace function public.save_pending_onboarding(
  p_secret text, p_email text, p_business text, p_industry text,
  p_lang text, p_brain text, p_phone text
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_pend_ok(p_secret) then raise exception 'unauthorized'; end if;
  insert into public.gui_pending_onboarding(email, business, industry, lang, brain, phone, status, updated_at)
  values (lower(trim(p_email)), p_business, p_industry,
          coalesce(nullif(p_lang,''),'en'), p_brain, p_phone, 'awaiting_payment', now())
  on conflict (email) do update set
    business = excluded.business, industry = excluded.industry, lang = excluded.lang,
    brain = excluded.brain, phone = excluded.phone,
    status = case when public.gui_pending_onboarding.status = 'provisioned'
                  then public.gui_pending_onboarding.status else 'awaiting_payment' end,
    updated_at = now();
  return true;
end $$;

-- READ the captured brain (called by /api/stripe-webhook on payment). One row or none.
-- DROP first: a prior version may exist with a different return type (can't be replaced in place).
drop function if exists public.get_pending_onboarding(text,text);
create or replace function public.get_pending_onboarding(p_secret text, p_email text)
returns table(email text, business text, industry text, lang text, brain text, phone text, status text, agent_id text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_pend_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query
    select g.email, g.business, g.industry, g.lang, g.brain, g.phone, g.status, g.agent_id
    from public.gui_pending_onboarding g where g.email = lower(trim(p_email));
end $$;

-- MARK provisioned after the webhook builds the agent (so it never re-provisions)
create or replace function public.mark_pending_provisioned(p_secret text, p_email text, p_agent_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_pend_ok(p_secret) then raise exception 'unauthorized'; end if;
  update public.gui_pending_onboarding
    set status = 'provisioned', agent_id = p_agent_id, updated_at = now()
    where email = lower(trim(p_email));
  return true;
end $$;

grant execute on function public.save_pending_onboarding(text,text,text,text,text,text,text) to anon;
grant execute on function public.get_pending_onboarding(text,text) to anon;
grant execute on function public.mark_pending_provisioned(text,text,text) to anon;

-- ✅ Done. The site's functions already know the secret — nothing else to set.
