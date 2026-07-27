-- ============================================================================
-- Guileo · Self-serve WHITE-LABEL name  (paste in Supabase → SQL Editor → Run)
-- Adds an optional agent_name to gui_pending_onboarding so a self-serve client can
-- name their own assistant (e.g. "Sofia"); empty → defaults to "Gui".
-- Safe to run after db/pending_onboarding.sql.
-- ============================================================================

alter table public.gui_pending_onboarding add column if not exists agent_name text;

-- save: now also stores the chosen name (8th arg, defaults to '')
drop function if exists public.save_pending_onboarding(text,text,text,text,text,text,text);
create or replace function public.save_pending_onboarding(
  p_secret text, p_email text, p_business text, p_industry text,
  p_lang text, p_brain text, p_phone text, p_agent_name text default ''
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_pend_ok(p_secret) then raise exception 'unauthorized'; end if;
  insert into public.gui_pending_onboarding(email, business, industry, lang, brain, phone, agent_name, status, updated_at)
  values (lower(trim(p_email)), p_business, p_industry,
          coalesce(nullif(p_lang,''),'en'), p_brain, p_phone, nullif(p_agent_name,''), 'awaiting_payment', now())
  on conflict (email) do update set
    business = excluded.business, industry = excluded.industry, lang = excluded.lang,
    brain = excluded.brain, phone = excluded.phone, agent_name = excluded.agent_name,
    status = case when public.gui_pending_onboarding.status = 'provisioned'
                  then public.gui_pending_onboarding.status else 'awaiting_payment' end,
    updated_at = now();
  return true;
end $$;

-- read: now also returns agent_name (changes return type → must drop first)
drop function if exists public.get_pending_onboarding(text,text);
create or replace function public.get_pending_onboarding(p_secret text, p_email text)
returns table(email text, business text, industry text, lang text, brain text, phone text, status text, agent_id text, agent_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_pend_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query
    select g.email, g.business, g.industry, g.lang, g.brain, g.phone, g.status, g.agent_id, g.agent_name
    from public.gui_pending_onboarding g where g.email = lower(trim(p_email));
end $$;

grant execute on function public.save_pending_onboarding(text,text,text,text,text,text,text,text) to anon;
grant execute on function public.get_pending_onboarding(text,text) to anon;

-- ✅ Done. White-label name now flows: /go-live → pending → on payment the agent is built with that name.
