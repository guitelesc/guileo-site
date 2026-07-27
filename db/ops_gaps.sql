-- ─────────────────────────────────────────────────────────────────────────────
-- Guileo — OPS GAPS (smaller open JORNADA ⏳ items). FUNDAÇÃO / observability.
-- Project ynihodbknhjirkdogxby (account smart@guileoai.com). Paste-twice safe.
--
-- Three small, independent RPCs that close open gaps without touching any shared
-- money/agenda RPC:
--   1) biz_holds_expire(secret, email?)  — cron sweep: release EXPIRED scheduling
--      holds back to available; optionally scoped to ONE tenant. Returns a count.
--   2) recon_costs_window(secret, since)  — observability for money-reconcile:
--      voice cost (cost_events elevenlabs) + client-money close&collect total
--      (client_revenue), clearly labelled MONITORED, NOT reconciled (voice has no
--      external counterparty API; close&collect is the CLIENT's money on Connect).
--      Flags an anomaly if voice cost > 3× the prior equal-length window.
--   3) seller_code_check(secret, code) / seller_code_set(secret, email, code) —
--      per-SELLER personal claim codes (kills the one-shared-team-code furo): given
--      just a code, resolve WHICH seller owns it; and set/rotate a seller's code.
--
-- SECURITY (same doors as the rest of the repo):
--   • biz_holds_expire is SCHED-gated by the literal 'gss_7Kx2mQ9vR4tZ8nL' (it touches
--     biz_appointments — same gate every biz_* RPC uses via _gui_sched_ok).
--   • recon_costs_window + seller_code_* are INGEST-gated by 'glo_ing_7f3da9c2b4e8'.
--   • All SECURITY DEFINER; base tables stay RLS-locked with NO anon policy — these
--     RPCs are the only door. grant execute to anon (the literal gate is the security).
--   • Every read/mutation is tenant/seller scoped by email or by the code credential.
-- Graceful: missing/renamed tables degrade to a zero/empty honest result inside
-- EXCEPTION blocks — a cron/observability call NEVER 500s. Idempotent — re-runnable.
--
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, smart@guileoai.com).
-- Prova (curl / SQL round-trip) at the bottom.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) HOLDS EXPIRE — cron-callable sweep of expired scheduling holds.
--    A 'hold' (deposit-to-book / tentative slot) carries expires_at. The engine
--    releases them LAZILY (biz_release_expired() runs on the way into each biz_*
--    RPC) — but only when the NEXT booking touches that service. On a quiet day a
--    slot held at 2:00 that expired at 2:05 keeps blocking until someone queries it.
--    This SCHED-gated wrapper lets the cron sweep them every tick, traffic or not,
--    and returns a real count. Optional p_email scopes the sweep to ONE tenant
--    (e.g. an admin "release this client's stale holds" button); NULL/'' = all.
--    (Supersedes db/holds_release.sql's gui_release_expired_holds by adding the
--     tenant scope + the released-slot list; wire THIS one — see wiring notes.)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.biz_holds_expire(
  p_secret text, p_email text default null
) returns json
language plpgsql security definer set search_path = public as $fn$
declare
  v_email    text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_released int  := 0;
begin
  -- SCHED-gated by the hardcoded literal (Supabase forbids the GUC that _gui_sched_ok reads,
  -- so that gate denies everything — same reason schedule_adapter.sql inlines the literal).
  if p_secret is distinct from 'gss_7Kx2mQ9vR4tZ8nL' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  begin
    update public.biz_appointments
       set status = 'cancelled'
     where status = 'hold'
       and expires_at is not null
       and expires_at < now()
       and (v_email is null or client_email = v_email);   -- tenant scope (NULL = all)
    get diagnostics v_released = row_count;
  exception when others then
    v_released := 0;   -- schema not there yet → honest zero, never 500
  end;

  return json_build_object('ready', true, 'released', coalesce(v_released, 0),
                           'scope', coalesce(v_email, 'all'));
end $fn$;

grant execute on function public.biz_holds_expire(text, text) to anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2) RECON COSTS WINDOW — observability rail for /api/money-reconcile.
--    Returns, for the window [since, now):
--      • voice_cost_cents      — what Guileo PAID ElevenLabs (cost_events, provider
--                                'elevenlabs'). MONITORED, not reconciled: voice has
--                                no external counterparty settlement API to diff against.
--      • close_collect_cents   — the client's OWN money the agent collected on the
--                                call / by pay-link (client_revenue sources
--                                gui-voice-pay | phone | stripe-link). MONITORED, not
--                                reconciled here: it settles on the CLIENT's Connect
--                                account, not Guileo's ledger (money_reconcile's charge
--                                track already proves it against the revenue ledger).
--      • anomaly               — true if voice_cost_cents > 3× the SAME-length prior
--                                window AND above a small floor (so a quiet→busy jump
--                                from $0.02 doesn't cry wolf). A runaway-voice tripwire.
--    Everything is READ-ONLY and labelled monitored_not_reconciled:true so the caller
--    can render "monitorado — não reconciliado" and never imply a settlement diff.
--    Honest: any missing table degrades that field to 0 + its *_ready:false flag.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.recon_costs_window(
  p_secret text, p_since timestamptz default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_since       timestamptz := coalesce(p_since, now() - interval '25 hours');
  v_len         interval;
  v_prev_since  timestamptz;
  v_voice       bigint  := 0;   -- current-window voice cost (cents)
  v_voice_prev  bigint  := 0;   -- prior-window voice cost (cents), for the anomaly ratio
  v_voice_ready boolean := false;
  v_cc          bigint  := 0;   -- current-window close&collect (cents)
  v_cc_ready    boolean := false;
  v_anomaly     boolean := false;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  v_len        := now() - v_since;
  v_prev_since := v_since - v_len;   -- prior window: [since - len, since)

  -- ── VOICE COST (cost_events, elevenlabs) — current + prior window ──────────
  begin
    select coalesce(sum(cost_cents), 0)::bigint
      into v_voice
      from public.cost_events
     where provider = 'elevenlabs' and created_at >= v_since;
    select coalesce(sum(cost_cents), 0)::bigint
      into v_voice_prev
      from public.cost_events
     where provider = 'elevenlabs' and created_at >= v_prev_since and created_at < v_since;
    v_voice_ready := true;
  exception when others then
    v_voice := 0; v_voice_prev := 0; v_voice_ready := false;
  end;

  -- ── CLOSE&COLLECT (client_revenue, direct-charge sources) — the client's money ──
  -- Sum amount_cents as-is so refund rows (negative) net out; clamp to >=0 for display.
  begin
    select greatest(0, coalesce(sum(amount_cents), 0))::bigint
      into v_cc
      from public.client_revenue
     where source in ('gui-voice-pay', 'phone', 'stripe-link')
       and ts >= v_since;
    v_cc_ready := true;
  exception when others then
    v_cc := 0; v_cc_ready := false;
  end;

  -- ── ANOMALY — runaway voice tripwire: >3× prior window, floored at $1.00 so a
  --    tiny base can't manufacture a scary ratio. Only meaningful when both ready.
  if v_voice_ready and v_voice > 100 and v_voice_prev > 0 and v_voice > (3 * v_voice_prev) then
    v_anomaly := true;
  end if;

  return jsonb_build_object(
    'ready', true,
    'monitored_not_reconciled', true,       -- these totals are WATCHED, not diffed
    'window', jsonb_build_object('since', v_since, 'until', now(),
                                 'prior_since', v_prev_since),
    'voice',  jsonb_build_object('ready', v_voice_ready, 'cost_cents', v_voice,
                                 'prior_cost_cents', v_voice_prev,
                                 'label', 'monitored (no external counterparty API)'),
    'close_collect', jsonb_build_object('ready', v_cc_ready, 'cents', v_cc,
                                 'label', 'client money on Connect (monitored, not reconciled here)'),
    'anomaly', v_anomaly
  );
end $fn$;

grant execute on function public.recon_costs_window(text, timestamptz) to anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3) SELLER PERSONAL CODES — per-seller claim codes instead of one shared team-code.
--    seller_code_check(secret, code) → { ok, seller_email, name, ref } for the ACTIVE
--    seller that owns this exact code (resolve by code ALONE — the code is the
--    credential). No match → { ok:false }. Never leaks other sellers' data.
--    seller_code_set(secret, email, code) → sets/rotates that seller's personal_code,
--    refusing a code already held by a DIFFERENT seller (codes must be unique to
--    identify their owner). Returns { ok, seller_email, personal_code }.
--    Both INGEST-gated + SECURITY DEFINER over the RLS-locked public.sellers table.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.seller_code_check(
  p_secret text, p_code text
) returns json
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_code text := nullif(trim(coalesce(p_code, '')), '');
  v_row  public.sellers%rowtype;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_code is null then return json_build_object('ok', false); end if;

  select * into v_row from public.sellers
   where personal_code = v_code and active
   order by created_at asc   -- deterministic if a stale dup ever exists
   limit 1;
  if not found then return json_build_object('ok', false); end if;

  return json_build_object('ok', true, 'seller_email', v_row.email,
                           'name', v_row.name, 'ref', v_row.ref_slug);
exception
  when sqlstate '28000' then raise;                     -- wrong gate must be loud
  when others then return json_build_object('ok', false); -- degrade, never 500
end $fn$;

create or replace function public.seller_code_set(
  p_secret text, p_email text, p_code text
) returns json
language plpgsql security definer set search_path = public as $fn$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_code  text := nullif(trim(coalesce(p_code, '')), '');
  v_row   public.sellers%rowtype;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'bad email' using errcode = '22023';
  end if;
  if v_code is null then
    raise exception 'empty code' using errcode = '22023';
  end if;

  -- a code identifies exactly one seller → refuse one already held by someone else
  if exists (select 1 from public.sellers where personal_code = v_code and email <> v_email) then
    return json_build_object('ok', false, 'reason', 'code already in use');
  end if;

  update public.sellers set personal_code = v_code
   where email = v_email
  returning * into v_row;
  if not found then
    return json_build_object('ok', false, 'reason', 'seller not found');
  end if;

  return json_build_object('ok', true, 'seller_email', v_row.email,
                           'personal_code', v_row.personal_code);
exception
  when sqlstate '28000' then raise;
  when sqlstate '22023' then raise;
  when others then return json_build_object('ok', false, 'reason', 'error');
end $fn$;

grant execute on function public.seller_code_check(text, text)       to anon;
grant execute on function public.seller_code_set(text, text, text)   to anon;


-- ── PROVA (rodar após colar) ──────────────────────────────────────────────────
-- 1) select public.biz_holds_expire('gss_7Kx2mQ9vR4tZ8nL');                       -- {ready:true, released:N, scope:"all"}
--    select public.biz_holds_expire('gss_7Kx2mQ9vR4tZ8nL','natura@guileoai.com'); -- só desse tenant
--    select public.biz_holds_expire('wrong');                                     -- ERROR 28000 (gate)
-- 2) select public.recon_costs_window('glo_ing_7f3da9c2b4e8', now()-interval '25 hours');
--    → { voice:{cost_cents,prior_cost_cents}, close_collect:{cents}, anomaly, monitored_not_reconciled:true }
-- 3) select public.seller_code_set('glo_ing_7f3da9c2b4e8','luis@guileoai.com','GUI-TEST-0001');  -- {ok:true,...}
--    select public.seller_code_check('glo_ing_7f3da9c2b4e8','GUI-TEST-0001');                    -- {ok:true, seller_email:"luis@..."}
--    select public.seller_code_check('glo_ing_7f3da9c2b4e8','NOPE');                             -- {ok:false}
