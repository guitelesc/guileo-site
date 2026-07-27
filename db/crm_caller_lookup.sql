-- ============================================================================
-- Guileo · CALLER MEMORY — read a CRM contact by tenant + phone (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com) · paste AFTER db/crm_spine.sql
-- Powers "Oi Maria! O de sempre?": when a repeat customer calls a client's Gui number, the server
-- looks them up here (INGEST-gated, sub-second) and injects {caller_name, caller_last, caller_note}
-- as ElevenLabs dynamic variables so the agent greets them like a regular.
-- Callers: functions/api/twilio-voice.js (auto-callback) + functions/api/twilio-inbound.js
-- (ElevenLabs conversation-initiation webhook). Unknown caller ⇒ zero rows ⇒ empty vars (graceful).
-- ============================================================================

create or replace function public.crm_caller_lookup(p_secret text, p_email text, p_phone text)
returns table(full_name text, last_seen_at timestamptz, visit_count int, ltv_cents bigint, lifecycle text, last_summary text)
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_phone  text := nullif(regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'),'');
  v_id     uuid;
begin
  -- INGEST-gated (same literal the ingest pipeline uses) — this returns customer PII, never expose ungated.
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_phone is null then return; end if;

  select c.id into v_id from crm_contacts c
    where c.client_email = v_tenant
      and (c.phone = v_phone or c.phone = regexp_replace(v_phone, '^\+?1?', ''))  -- tolerate +1 / bare-10-digit drift
    order by c.last_seen_at desc limit 1;
  if v_id is null then return; end if;

  return query
    select c.full_name, c.last_seen_at, c.visit_count, c.ltv_cents, c.lifecycle,
           -- latest 360° event summary ("Booked: Corte", "Order $42 — pizza grande") — best-effort:
           -- crm_timeline_events only exists after db/crm_phase2.sql; missing table ⇒ empty note.
           coalesce((
             select e.summary from crm_timeline_events e
             where e.client_email = v_tenant and e.contact_id = v_id
             order by e.occurred_at desc limit 1
           ), '')::text
    from crm_contacts c where c.id = v_id;
exception when undefined_table then
  -- phase-2 timeline not pasted yet → return the contact with an empty last_summary
  return query
    select c.full_name, c.last_seen_at, c.visit_count, c.ltv_cents, c.lifecycle, ''::text
    from crm_contacts c where c.id = v_id;
end $$;

grant execute on function public.crm_caller_lookup(text,text,text) to anon;

-- ✅ Done. twilio-voice.js / twilio-inbound.js call this with the INGEST secret; the agent's prompt
--    (buildGuiPrompt) references {{caller_name}} {{caller_last}} {{caller_note}} — empty for new callers.
