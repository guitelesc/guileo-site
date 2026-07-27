-- ═════════════════════════════════════════════════════════════════════════════
-- EVAL SANDBOX TENANT — a SYNTHETIC, resolvable tenant for functions/api/agent-eval.js
-- ═════════════════════════════════════════════════════════════════════════════
-- WHY: the 'voice' golden cases run guiReply() (functions/lib/guiBrain.js) against a
-- REAL tenant so we measure the REAL brain (real prices, real prompt) with ZERO side
-- effects. Before this seed the eval pointed at natura@guileoai.com, which the TEXT
-- brain's resolver can't see (natura lives only in the voice path), so tenant.valid
-- came back false and all 7 voice cases SKIPPED. This gives the eval its own tenant.
--
-- HOW guiReply's resolver (loadTenant) validates — seed EXACTLY what it reads:
--   1) get_client_profile(secret,email) → reads client_integrations.tokens WHERE
--      provider='profile'. tenant.valid becomes true when tokens has business_name
--      (or number/twilio_number/owner). ← row #1 below.
--   2) menuBlock → biz_lookup(secret,email) → reads biz_services → the real prices the
--      price-accuracy cases assert (incl. the $118 60-min massage). ← rows #2 below.
--   3) biz_locations → the optional LOCATIONS block. ← row #3 below.
--
-- SAFETY: 100% tenant-isolated (every row scoped to eval-sandbox@guileoai.com), clearly
-- marked SYNTHETIC (never a real customer), and idempotent (delete-then-insert scoped
-- to the sandbox email — safe to paste twice, touches no other tenant, no billing table).
-- No new RPC/RLS needed: it seeds tables the existing INGEST/SCHED-gated RPCs already own.
-- ═════════════════════════════════════════════════════════════════════════════

do $$
declare v_email text := 'eval-sandbox@guileoai.com';
begin
  -- 1) PROFILE — the row get_client_profile() returns → makes tenant.valid = true.
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Guileo Eval Sandbox Spa',
      'agent_name',    'Gui',
      'lang',          'en',
      'forward_number', '',
      'synthetic',     true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());

  -- 2) SERVICES — what biz_lookup() returns → the real prices the golden set checks.
  --    'Swedish Massage' 60 min = $118 is the exact number voice-price-exact asserts.
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Swedish Massage',       60, 11800, true),
    (v_email, 'Signature Facial',      60,  9500, true),
    (v_email, 'Deep-Cleansing Facial', 50,  8500, true);

  -- 3) LOCATION — one unit so the LOCATIONS block has something honest to show.
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Guileo Eval Sandbox Spa', 'New York', '1 Test Plaza', true);
end $$;

-- PROVE (round-trip, read-only) — both should return the sandbox as guiReply will see it:
--   select get_client_profile('glo_ing_7f3da9c2b4e8','eval-sandbox@guileoai.com');
--   select biz_lookup('gss_7Kx2mQ9vR4tZ8nL','eval-sandbox@guileoai.com')->'services';
