-- ============================================================================
-- Guileo · FOUNDATION 3 — CUSTOMER MEMORY (the customer-of-the-customer)
-- "Maria is ONE person, not a channel." (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com) · paste AFTER db/crm_spine.sql
--          (+ crm_phase2.sql / crm_capture.sql / the scheduling engine if present —
--           ALL optional here: a missing table just yields an empty field, never an error).
--
-- WHY THIS EXISTS (unify, do NOT duplicate):
--   The CRM already has the canonical person (crm_contacts) + a 360° timeline
--   (crm_timeline_events) + a phone-first greeter (crm_caller_context). But every
--   recognizer today is VOICE-CENTRIC: it resolves a caller by PHONE only. Maria on
--   web-chat / Instagram DM / WhatsApp (no phone in hand) is invisible to it, so each
--   channel greets her as a stranger — she looks like 4 people, not 1.
--
--   customer_memory_get is the ONE resolver that unifies her: it resolves the SAME
--   crm_contacts row by phone OR email, then rolls up her cross-channel history
--   (channels seen, visits, LTV, last service, no-shows, last summary) into a single
--   payload any agent (voice, web-chat, WhatsApp, IG, DM, support) injects identically.
--   It READS the existing tables — it creates NO new contact/timeline table. The WRITE
--   path stays the CRM spine (crm_upsert_contact + crm_log_event); customerMemory.js
--   delegates to those, so there is exactly one source of truth for a person's history.
--
-- SECURITY:
--   • INGEST-gated by the SAME shared literal crm_caller_context / crm_caller_lookup /
--     the ingest pipeline use ('glo_ing_c7f2a9e4b8d16350'). It returns customer PII, so it
--     must never be reachable ungated.
--   • ALWAYS tenant-scoped by p_email (client_email). A tenant can NEVER read, resolve,
--     or roll up another tenant's customer — every subquery is filtered by v_tenant.
--   • READ-only. Idempotent (safe to re-run). Unknown contact ⇒ {known:false} (graceful).
-- ============================================================================

-- ── UNIFIED CUSTOMER MEMORY: resolve ONE person by phone OR email, roll up ALL channels ──
-- Returns a jsonb SUPERSET of crm_caller_context, adding: cross-channel `channels`, `no_shows`,
-- `ltv_cents`, `lifecycle`, `first_seen`, and email-based resolution (web-chat / DM / IG).
create or replace function public.customer_memory_get(
  p_secret text, p_email text, p_phone text default null, p_contact_email text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant   text := lower(trim(p_email));
  v_phone    text := nullif(regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'),'');
  v_cemail   text := nullif(lower(trim(coalesce(p_contact_email,''))),'');
  v_bare     text;
  v_id       uuid;
  v_name     text;
  v_last     timestamptz;
  v_first    timestamptz;
  v_visits   int;
  v_life     text;
  v_ltv      bigint;
  v_service  text := '';
  v_summary  text := '';
  v_noshows  int  := 0;
  v_channels jsonb := '[]'::jsonb;
begin
  -- INGEST-gated — returns customer PII, never expose ungated (same literal as crm_caller_context).
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  -- Need at least one identifier to resolve the person.
  if v_phone is null and v_cemail is null then return jsonb_build_object('known', false); end if;
  v_bare := case when v_phone is not null then regexp_replace(v_phone, '^\+?1?', '') else null end; -- +1 / bare-10 drift

  -- RESOLVE THE SAME crm_contacts ROW by phone OR email — this is the "one person" step.
  select c.id, c.full_name, c.last_seen_at, c.first_seen_at, c.visit_count, c.lifecycle, c.ltv_cents
    into v_id, v_name, v_last, v_first, v_visits, v_life, v_ltv
    from crm_contacts c
    where c.client_email = v_tenant
      and ( (v_phone  is not null and (c.phone = v_phone or c.phone = v_bare))
         or (v_cemail is not null and lower(c.email) = v_cemail) )
    order by c.last_seen_at desc limit 1;
  if v_id is null then return jsonb_build_object('known', false); end if;

  -- LAST BOOKED SERVICE + NO-SHOW COUNT (scheduling engine optional → undefined_table ⇒ skip).
  begin
    select coalesce(s.name,'')
      into v_service
      from biz_appointments a
      left join biz_services s on s.id = a.service_id
      where a.client_email = v_tenant
        and ( (v_bare is not null and length(v_bare) >= 7
               and regexp_replace(coalesce(a.customer_contact,''),'[^0-9]','','g') like ('%' || v_bare))
           or (v_cemail is not null and lower(a.customer_contact) = v_cemail) )
      order by lower(a.span) desc nulls last limit 1;

    select count(*)::int
      into v_noshows
      from biz_appointments a
      where a.client_email = v_tenant
        and a.status = 'no_show'
        and ( (v_bare is not null and length(v_bare) >= 7
               and regexp_replace(coalesce(a.customer_contact,''),'[^0-9]','','g') like ('%' || v_bare))
           or (v_cemail is not null and lower(a.customer_contact) = v_cemail) );
  exception when undefined_table then v_service := ''; v_noshows := 0; end;

  -- CROSS-CHANNEL ROLLUP: latest 360° summary + the distinct channels this person was seen on
  -- (crm_phase2 optional → undefined_table ⇒ empty). This is what makes Maria one person across
  -- voice + chat + WhatsApp + IG instead of four strangers.
  begin
    select coalesce(e.summary,'')
      into v_summary
      from crm_timeline_events e
      where e.client_email = v_tenant and e.contact_id = v_id
      order by e.occurred_at desc limit 1;

    select coalesce(jsonb_agg(distinct ch), '[]'::jsonb)
      into v_channels
      from (
        select nullif(trim(e.channel),'') as ch
        from crm_timeline_events e
        where e.client_email = v_tenant and e.contact_id = v_id and nullif(trim(e.channel),'') is not null
      ) q;
  exception when undefined_table then v_summary := ''; v_channels := '[]'::jsonb; end;

  return jsonb_build_object(
    'known',        true,
    'id',           v_id,
    'name',         coalesce(v_name,''),
    'lifecycle',    coalesce(v_life,'lead'),
    'visits_count', coalesce(v_visits,0),
    'ltv_cents',    coalesce(v_ltv,0),
    'last_visit',   v_last,
    'first_seen',   v_first,
    'last_service', coalesce(v_service,''),
    'last_summary', coalesce(v_summary,''),
    'no_shows',     coalesce(v_noshows,0),
    'channels',     v_channels
  );
end $$;

grant execute on function public.customer_memory_get(text,text,text,text) to anon;

-- ✅ Done. functions/lib/customerMemory.js calls customer_memory_get (INGEST secret) so ANY
--    agent — voice (twilio-inbound/voice), web-chat/WhatsApp/IG/DM (guiBrain.guiReply), support —
--    greets Maria as ONE returning person. Writes still go through the CRM spine
--    (crm_upsert_contact + crm_log_event); this file adds NO contact/timeline table.
