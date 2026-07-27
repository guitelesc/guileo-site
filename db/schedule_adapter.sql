-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEDULE ADAPTER — mirror an EXTERNAL booking into the internal cockpit.
-- Used by functions/lib/scheduleAdapter.js → mirrorExternalBooking(). When the Gui books
-- into a tenant's connected external calendar (MindBody/Square/…), we drop a shadow record
-- into biz_appointments so /portal shows the appointment. The external system stays the source
-- of truth; this row is a MIRROR, tagged with source=<provider>.
--
-- Design choices (honest + non-clashing):
--   • pro_id is left NULL → sidesteps the biz_appointments EXCLUDE(pro_id, span) constraint, so a
--     mirror can NEVER collide with an internal hold (the external calendar already deconflicted).
--   • service_id is best-effort resolved by NAME against this tenant's biz_services (NULL if none).
--   • external_ref column + a partial unique index make the mirror idempotent (retries/re-fires
--     of the same external booking update the one row instead of duplicating it).
--   • SCHED-gated (hardcoded literal — Supabase forbids GUC). Idempotent DDL. Paste in Supabase
--     (ynihodbknhjirkdogxby). Reuses the EXISTING biz_appointments table — no new table.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) track the external reference so the mirror is idempotent (no-op if already present)
alter table biz_appointments add column if not exists external_ref text;
create unique index if not exists uq_biz_appt_external
  on biz_appointments(client_email, source, external_ref)
  where external_ref is not null;

-- 2) the mirror RPC
create or replace function public.biz_mirror_external(
  p_secret text, p_email text, p_provider text, p_external_ref text,
  p_service text, p_start timestamptz, p_end timestamptz,
  p_name text, p_contact text, p_location_id uuid, p_attributes jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_service_id uuid;
  v_end timestamptz := coalesce(p_end, p_start + interval '60 minutes');
  v_id uuid;
begin
  -- SCHED gate (same literal as _gui_sched_ok / the scheduling engine)
  if p_secret is distinct from 'gss_7Kx2mQ9vR4tZ8nL' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_email is null or v_email = '' or p_start is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_args');
  end if;

  -- best-effort resolve the service by name for a nicer cockpit row (NULL if no match)
  select id into v_service_id
  from biz_services
  where client_email = v_email and lower(trim(name)) = lower(trim(coalesce(p_service, '')))
  limit 1;

  -- idempotent upsert on (client_email, source, external_ref)
  if p_external_ref is not null and p_external_ref <> '' then
    update biz_appointments
      set span = tstzrange(p_start, v_end, '[)'),
          service_id = coalesce(v_service_id, service_id),
          customer_name = coalesce(nullif(p_name, ''), customer_name),
          customer_contact = coalesce(nullif(p_contact, ''), customer_contact),
          location_id = coalesce(p_location_id, location_id),
          status = 'booked'
      where client_email = v_email and source = p_provider and external_ref = p_external_ref
      returning id into v_id;
    if v_id is not null then
      return jsonb_build_object('ok', true, 'id', v_id, 'updated', true);
    end if;
  end if;

  insert into biz_appointments(
    client_email, location_id, pro_id, service_id, customer_name, customer_contact,
    span, status, source, external_ref
  ) values (
    v_email, p_location_id, null, v_service_id, nullif(p_name, ''), nullif(p_contact, ''),
    tstzrange(p_start, v_end, '[)'), 'booked', coalesce(nullif(p_provider, ''), 'external'),
    nullif(p_external_ref, '')
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'mirrored', true);
exception when others then
  -- never surface a mirror failure to the caller (the external booking already stands)
  return jsonb_build_object('ok', false, 'reason', 'mirror_error');
end $$;

grant execute on function public.biz_mirror_external(text, text, text, text, text, timestamptz, timestamptz, text, text, uuid, jsonb) to anon;
