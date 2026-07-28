-- Unified lead-journey aggregate for /admin "Jornada" tab: demo → onboarding → retenção.
-- ONE token-gated read (same _admin_ok gate as admin_site_stats). Counts only, no PII.
-- SECURITY DEFINER, set search_path=public, EXCEPTION-wrapped (except the auth raise).
create or replace function public.admin_journey(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public._admin_ok(p_token) then raise exception 'unauthorized' using errcode='28000'; end if;
  select jsonb_build_object(
    'demo', (select jsonb_build_object(
        'views',          count(*) filter (where kind='view'),
        'leads',          count(*) filter (where kind='lead'),
        'checkout_start', count(*) filter (where kind='checkout_start'),
        'checkout_done',  count(*) filter (where kind='checkout_done')
      ) from public.demo_events),
    'onboarding', jsonb_build_object(
        'by_step', (select coalesce(jsonb_object_agg(step, n),'{}'::jsonb)
                    from (select coalesce(step,0) step, count(*) n from public.onboarding_state group by 1) s),
        'total',       (select count(*) from public.onboarding_state),
        'provisioned', (select count(*) from public.onboarding_state where coalesce(step,0) >= 4),
        'kickoff',     (select count(*) from public.onboarding_state where coalesce(step,0) >= 5),
        'done',        (select count(*) from public.onboarding_state where coalesce(step,0) >= 7)
      ),
    'retention', jsonb_build_object(
        'clients_total',  (select count(*) from public.client_credits),
        'clients_active', (select count(*) from public.client_credits where credits>0 and paused_at is null),
        'clients_paused', (select count(*) from public.client_credits where paused_at is not null),
        'active_30d',     (select count(distinct client_email) from public.client_events where created_at >= now() - interval '30 days')
      )
  ) into v;
  return v;
exception when others then
  if sqlstate='28000' then raise; end if;   -- keep the auth failure loud (re-locks /admin)
  return null;
end $$;

grant execute on function public.admin_journey(text) to anon;
