-- ─────────────────────────────────────────────────────────────────────────────
-- REFERRALS ENGINE — the DB half of the "indique e ganhe 1 mês grátis" promise
-- (which was already live on the site with NO backend). Wired into
-- functions/api/stripe-webhook.js (conversion) via Stripe's client_reference_id,
-- which src/pages/Planos.jsx now appends to the Payment Link from ?ref=<slug>.
--
-- Three functions, all INGEST-gated (same literal as add_client_credits / nps_claim):
--   _ref_decode_email(p_code)                          → decode a ?ref= slug to the
--        referrer email when it is a base64url(email) (the Cockpit ReferralCard format
--        in src/portal/Grow.jsx); returns NULL for a seller-name slug (non-decodable).
--   referral_record(p_secret, p_ref_code, p_referred)  → idempotent upsert of a
--        'started' row; NEVER overwrites an already-'converted' row.
--   referral_convert(p_secret, p_referred, p_reward)   → ATOMIC one-time claim:
--        flips the 'started' row to 'converted' and returns the resolved referrer.
--        A racing/redelivered webhook sees no 'started' row → {converted:false}.
--
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, account
-- smart@guileoai.com). Until pasted, the webhook's referral block degrades to a
-- no-op (the RPCs return non-2xx → best-effort catch); the sale itself is unaffected.
-- Turns on automatically after the paste.
-- ─────────────────────────────────────────────────────────────────────────────

-- One row per referred business (unique referred_email). A referred email can only
-- ever be attributed to ONE referrer, and can only convert ONCE.
create table if not exists public.referrals (
  referred_email  text primary key,                 -- unique(referred_email)
  referrer_email  text,                             -- resolved when the slug is a base64url(email); null for seller slugs
  ref_code        text not null,                    -- the raw ?ref= slug as it arrived
  status          text not null default 'started'   -- started → converted (one-way)
                  check (status in ('started', 'converted')),
  reward_credits  int  not null default 0,          -- credits granted to each side on conversion
  created_at      timestamptz not null default now(),
  converted_at    timestamptz
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_email);

-- Lock it down — anon/PostgREST get zero rows; only the SECURITY DEFINER RPCs touch it.
alter table public.referrals enable row level security;

-- ── slug → referrer email ────────────────────────────────────────────────────
-- The Cockpit ReferralCard (src/portal/Grow.jsx) builds ?ref= as
--   btoa(unescape(encodeURIComponent(email)))  → URL-safe (-/_), padding stripped.
-- Reverse it here; return NULL on anything that isn't a clean email (seller-name
-- slugs, garbage) so the caller can route those to seller attribution instead.
create or replace function public._ref_decode_email(p_code text)
returns text
language plpgsql
immutable
as $$
declare v_b64 text; v_txt text; v_email text;
begin
  if p_code is null or length(trim(p_code)) = 0 then return null; end if;
  -- URL-safe → standard base64, then re-pad to a multiple of 4.
  v_b64 := replace(replace(trim(p_code), '-', '+'), '_', '/');
  v_b64 := v_b64 || repeat('=', (4 - length(v_b64) % 4) % 4);
  begin
    v_txt := convert_from(decode(v_b64, 'base64'), 'utf8');
  exception when others then
    return null;  -- not valid base64 → a seller-name slug
  end;
  v_email := lower(trim(coalesce(v_txt, '')));
  if v_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return v_email;
  end if;
  return null;
end
$$;

-- ── record a 'started' referral (idempotent) ─────────────────────────────────
-- Upserts the started row. On conflict it refreshes the code/referrer ONLY while the
-- row is still 'started' — a converted row is immutable (the reward can't be re-triggered
-- by a later visit with a different ?ref=). Returns the resolved referrer for the caller.
create or replace function public.referral_record(p_secret text, p_ref_code text, p_referred_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_referred text; v_code text; v_referrer text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  v_referred := lower(trim(coalesce(p_referred_email, '')));
  v_code     := trim(coalesce(p_ref_code, ''));
  if v_referred = '' or v_referred !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or v_code = '' then
    return jsonb_build_object('ok', false);
  end if;
  v_referrer := public._ref_decode_email(v_code);
  insert into referrals (referred_email, referrer_email, ref_code, status)
  values (v_referred, v_referrer, v_code, 'started')
  on conflict (referred_email) do update
    set ref_code = excluded.ref_code, referrer_email = excluded.referrer_email
    where referrals.status = 'started';   -- never touch a converted row
  return jsonb_build_object('ok', true, 'referrer_email', v_referrer, 'ref_code', v_code);
end
$$;

-- ── convert (atomic, once) ───────────────────────────────────────────────────
-- Flips the 'started' row for this referred email to 'converted' in a single guarded
-- UPDATE. The `where status = 'started'` + RETURNING is the claim: exactly one caller
-- can win, so a Stripe retry / redelivered event can never double-reward. Returns the
-- referrer so the webhook can credit both sides; {converted:false} when there was
-- nothing to claim (no started row, or already converted).
create or replace function public.referral_convert(p_secret text, p_referred_email text, p_reward_credits int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_referred text; v_reward int; v_referrer text; v_code text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  v_referred := lower(trim(coalesce(p_referred_email, '')));
  v_reward   := greatest(0, coalesce(p_reward_credits, 0));
  if v_referred = '' then return jsonb_build_object('converted', false); end if;
  update referrals
     set status = 'converted', converted_at = now(), reward_credits = v_reward
   where referred_email = v_referred and status = 'started'
   returning referrer_email, ref_code into v_referrer, v_code;
  if found then
    return jsonb_build_object('converted', true, 'referrer_email', v_referrer, 'ref_code', v_code);
  end if;
  return jsonb_build_object('converted', false);
end
$$;

grant execute on function public._ref_decode_email(text)                to anon;
grant execute on function public.referral_record(text, text, text)      to anon;
grant execute on function public.referral_convert(text, text, int)      to anon;

-- ✅ Done. The next new-client checkout that carries a client_reference_id starts
--    converting referrals: both the referrer and the referred get bonus credits
--    (= the purchased plan's credits, capped at 2000) and a '🎁 Indicação
--    convertida' event; a non-client slug is logged as seller 'attribution' instead.
