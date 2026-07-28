-- ═══════════════════════════════════════════════════════════════════════════════
-- DATA-PLANE HARDENING — close the cross-tenant IDOR on portal RPCs.
-- ═══════════════════════════════════════════════════════════════════════════════
-- PROBLEM (found by adversarial QA 2026-07-28): tenant RPCs are SECURITY DEFINER, granted to anon,
-- gated ONLY by a committed shared secret, and take a caller-supplied p_email. The email↔key check
-- (get_client_data) lived ONLY in the Cloudflare Worker. So a direct POST to the Supabase REST RPC
-- with the committed secret + a victim's email read/mutated ANY tenant, bypassing the cockpit.
--
-- FIX PATTERN (zero-downtime, per RPC that is PORTAL-ONLY — the Worker has the client key):
--   1. CREATE a NEW overload with an extra required p_key arg (NO default → never collides with the
--      old signature) that asserts the key INSIDE via _gui_assert_client(p_email,p_key) (→ get_client_data,
--      raise 28000 on mismatch). Grant to anon. Old signature stays live → no downtime.
--   2. Deploy the Worker to pass p_key on that call.
--   3. DROP the old (keyless) overload. Now a direct call without the client's key is rejected.
-- ⚠️ Do NOT apply to DUAL-USE RPCs (also called by the voice agent / webhooks with no client key,
--    e.g. crm_upsert_contact, crm_caller_context, ingest_client_event) — those need the service_role
--    approach instead (server-only key + revoke anon execute). See project_guileo_security_audit memory.
--
-- APPLIED + PROVEN 2026-07-28 (via MCP; this file mirrors the live DB for repo hygiene):
--   • SLICE 1: crm_list_contacts — portal contact book (highest PII). Old 3-arg dropped.
--     Proof: portal w/ correct key WORKS; 3-arg secret-only attack CLOSED (function gone); wrong key → 28000.

-- SLICE 1 — crm_list_contacts (the only live signature is now this 4-arg, key-asserting one).
create or replace function public.crm_list_contacts(p_secret text, p_email text, p_limit integer, p_key text)
returns table(id uuid, full_name text, phone text, email text, lifecycle text, ltv_cents bigint, visit_count integer, last_seen_at timestamptz, churn_risk integer, tags jsonb)
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  perform public._gui_assert_client(p_email, p_key);   -- wrong/missing key → 28000
  return query select c.id, c.full_name, c.phone, c.email, c.lifecycle, c.ltv_cents, c.visit_count, c.last_seen_at, c.churn_risk, c.tags
    from crm_contacts c where c.client_email = lower(trim(p_email)) order by c.last_seen_at desc limit greatest(1, least(p_limit, 1000));
end $$;
grant execute on function public.crm_list_contacts(text, text, integer, text) to anon;
drop function if exists public.crm_list_contacts(text, text, integer);  -- remove the keyless hole

-- SLICE 2 (batch) APPLIED + PROVEN 2026-07-28 (live DB is authoritative; same pattern as slice 1):
--   kb_list, marketing_dates_list, crm_ltv (email arg = p_client_email), biz_list_appointments,
--   crm_deal_move — each got a key-asserting overload (extra p_key, perform _gui_assert_client),
--   Workers migrated to pass p_key (crm.js/kb.js/appointments.js/growth-intel.js — the last also fixed
--   to send p_client_email, a latent bug), then the old keyless signatures were DROPPED.
--   Proof: portal-with-correct-key WORKS · wrong key → 28000 · old secret-only signature CLOSED (gone).
--   Bonus: growth-intel crm_ltv was silently broken (sent p_email vs p_client_email) — now fixed.
-- REMAINING (next slices): dual-use RPCs (crm_upsert_contact, ingest_client_event, crm_caller_context,
--   crm_deal write from agent, storm_activate, support_ticket_list admin+client) → service_role path.
