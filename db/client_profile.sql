-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENT PROFILE (admin wallet) — one RPC that aggregates EVERYTHING about a
-- client for the /admin Carteira expanded pass: intake payload (site, channels,
-- owner), live units + services (scheduling engine), credits, 30d pulse, and
-- what they ALREADY have vs could still contract (upsell flags). Each section
-- is wrapped in its own EXCEPTION block so a missing table never kills the
-- profile — it just returns null for that section. INGEST-gated SECURITY
-- DEFINER (admin endpoint verifies the ADMIN_TOKEN before calling).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_client_profile(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_payload jsonb := '{}'::jsonb;
  v_units jsonb := '[]'::jsonb;
  v_services jsonb := '[]'::jsonb;
  v_credits numeric;
  v_events30 int;
  v_last timestamptz;
  v_has_pkg boolean := false; v_has_mem boolean := false; v_has_coupon boolean := false;
  v_intents int := 0;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;

  -- intake payload (site, channels, owner, logo…) from the latest non-deleted draft
  begin
    select coalesce(payload, '{}'::jsonb) into v_payload
    from onboard_drafts where client_email = v_email and status <> 'deleted'
    order by created_at desc limit 1;
  exception when others then v_payload := '{}'::jsonb; end;

  -- live units (addresses) + contracted services w/ prices, straight from the scheduling engine
  begin
    select coalesce(jsonb_agg(jsonb_build_object('name', name, 'address', address, 'city', city, 'phone', phone)), '[]'::jsonb)
      into v_units from biz_locations where client_email = v_email and active;
  exception when others then v_units := '[]'::jsonb; end;
  begin
    select coalesce(jsonb_agg(jsonb_build_object('name', name, 'min', duration_min, 'price_cents', price_cents) order by price_cents desc nulls last), '[]'::jsonb)
      into v_services from biz_services where client_email = v_email and active;
  exception when others then v_services := '[]'::jsonb; end;

  -- credits balance (column name has varied across migrations — resolve dynamically)
  begin
    execute format('select %I from client_credits where lower(email) = $1 limit 1',
      (select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'client_credits'
          and column_name in ('credits','balance','credit_balance') limit 1))
      into v_credits using v_email;
  exception when others then v_credits := null; end;

  -- 30-day pulse from the real event stream
  begin
    select count(*), max(created_at) into v_events30, v_last
    from client_events where client_email = v_email and created_at > now() - interval '30 days';
  exception when others then v_events30 := null; v_last := null; end;

  -- what they already contracted vs could still buy (the upsell flags)
  begin select exists(select 1 from packages where client_email = v_email and coalesce(active, true)) into v_has_pkg; exception when others then v_has_pkg := false; end;
  begin select exists(select 1 from memberships where client_email = v_email and coalesce(active, true)) into v_has_mem; exception when others then v_has_mem := false; end;
  begin select exists(select 1 from coupons where client_email = v_email) into v_has_coupon; exception when others then v_has_coupon := false; end;
  begin select count(*) into v_intents from booking_intents where client_email = v_email and status = 'started'; exception when others then v_intents := 0; end;

  return jsonb_build_object(
    'owner', coalesce(v_payload->>'owner_name', v_payload->'contact'->>'name'),
    'phone', coalesce(v_payload->>'owner_phone', v_payload->'contact'->>'phone'),
    'site', coalesce(v_payload->>'website', v_payload->'channels'->>'website', v_payload->'channels'->>'site'),
    'channels', v_payload->'channels',
    'logo', coalesce(v_payload->>'logo_url', v_payload->>'logo'),
    'langs', v_payload->'langs',
    'units', v_units,
    'services', v_services,
    'credits', v_credits,
    'events_30d', v_events30,
    'last_event_at', v_last,
    'open_intents', v_intents,
    'has_packages', v_has_pkg, 'has_memberships', v_has_mem, 'has_coupons', v_has_coupon
  );
exception
  when sqlstate '28000' then raise;
  when others then return '{}'::jsonb;
end $$;

grant execute on function public.admin_client_profile(text, text) to anon;
