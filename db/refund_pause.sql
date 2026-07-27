-- ============================================================================
-- Guileo · REFUND-DEDUCT + GRACE-PAUSE  (paste in Supabase → SQL Editor → Run)
-- Project ynihodbknhjirkdogxby (smart@guileoai.com). Closes 2 money leaks:
--   A) refund/dispute now REVOKES credits (deduct_client_credits, idempotent, never < 0)
--   C) grace-period can PAUSE a deadbeat's agent actions (paused_at flag, reversible on pay)
-- Mirrors the repo money laws: amount-anchored, tenant-bound, idempotent, never negative,
-- INGEST-gated on the literal, SECURITY DEFINER, RLS-safe. Safe to paste twice.
-- ============================================================================

-- ── Slice C: pause flag lives ON client_credits (one row per tenant already). ──
alter table public.client_credits add column if not exists paused_at    timestamptz;
alter table public.client_credits add column if not exists pause_reason  text;

-- ── Slice A idempotency: one refund/dispute deducts EXACTLY once (Stripe/MP retry-safe). ──
create table if not exists public.credit_deduct_idem (
  ref          text primary key,        -- refund/dispute/charge id (provider-unique)
  client_email text not null,
  credits      int  not null,           -- how many were deducted for this ref
  created_at   timestamptz not null default now()
);
alter table public.credit_deduct_idem enable row level security;  -- no anon policy; RPC-only

-- ── deduct_client_credits(secret,email,credits,reason,ref) → new balance ──────
-- Revokes `credits` from the tenant, clamped so the balance NEVER goes below 0. Idempotent by
-- `ref`: a re-delivered refund webhook returns the current balance and deducts nothing. Audited.
create or replace function public.deduct_client_credits(
  p_secret text, p_email text, p_credits int, p_reason text default 'refund', p_ref text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_want   int  := greatest(0, coalesce(p_credits, 0));
  v_ref    text := nullif(trim(coalesce(p_ref, '')), '');
  v_cur    int;
  v_take   int;
  v_new    int;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'tenant required' using errcode = '22023'; end if;

  -- idempotency: this refund ref already processed → return balance, deduct nothing.
  if v_ref is not null and exists (select 1 from credit_deduct_idem where ref = v_ref) then
    select credits into v_cur from client_credits where client_email = v_tenant;
    return coalesce(v_cur, 0);
  end if;

  select credits into v_cur from client_credits where client_email = v_tenant;
  if v_cur is null then                        -- no balance row → nothing to take, but record the ref
    if v_ref is not null then
      insert into credit_deduct_idem (ref, client_email, credits) values (v_ref, v_tenant, 0)
        on conflict (ref) do nothing;
    end if;
    return 0;
  end if;

  v_take := least(v_cur, v_want);              -- never below zero
  v_new  := v_cur - v_take;
  update client_credits set credits = v_new, updated_at = now() where client_email = v_tenant;

  if v_ref is not null then
    insert into credit_deduct_idem (ref, client_email, credits) values (v_ref, v_tenant, v_take)
      on conflict (ref) do nothing;
  end if;
  return v_new;
end $$;

-- ── set_client_paused(secret,email,paused,reason) → jsonb ─────────────────────
-- Pauses/unpauses a tenant's agent ACTIONS (booking, charging, outbound dial). Reversible:
-- a successful payment webhook calls this with paused=false. Idempotent (re-set is a no-op flip).
create or replace function public.set_client_paused(
  p_secret text, p_email text, p_paused boolean, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_now timestamptz;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'tenant required' using errcode = '22023'; end if;
  v_now := case when coalesce(p_paused, false) then now() else null end;
  if coalesce(p_paused, false) then
    -- PAUSE: upsert so a paused tenant always has a row carrying the flag.
    insert into client_credits (client_email, credits, plan, paused_at, pause_reason, updated_at)
    values (v_tenant, 0, '', v_now, left(coalesce(p_reason,'past_due'),120), now())
    on conflict (client_email) do update
      set paused_at = v_now, pause_reason = left(coalesce(p_reason,'past_due'),120), updated_at = now();
  else
    -- UNPAUSE: UPDATE-only — a payment from a random consumer email must NOT mint a junk row.
    update client_credits set paused_at = null, pause_reason = null, updated_at = now()
     where client_email = v_tenant;
  end if;
  return jsonb_build_object('paused', coalesce(p_paused,false), 'at', v_now);
end $$;

-- ── is_client_paused(secret,email) → boolean (the gate calls this; absent = NOT paused). ──
create or replace function public.is_client_paused(p_secret text, p_email text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_at timestamptz;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then return false; end if;
  select paused_at into v_at from client_credits where client_email = v_tenant;
  return v_at is not null;
end $$;

grant execute on function public.deduct_client_credits(text,text,int,text,text) to anon;
grant execute on function public.set_client_paused(text,text,boolean,text)       to anon;
grant execute on function public.is_client_paused(text,text)                     to anon;

-- PROOF:
-- select public.add_client_credits('glo_ing_7f3da9c2b4e8','demo@guileoai.com',100,'test');            -- 100
-- select public.deduct_client_credits('glo_ing_7f3da9c2b4e8','demo@guileoai.com',30,'refund','rf_1'); -- 70
-- select public.deduct_client_credits('glo_ing_7f3da9c2b4e8','demo@guileoai.com',30,'refund','rf_1'); -- 70 (idempotent)
-- select public.deduct_client_credits('glo_ing_7f3da9c2b4e8','demo@guileoai.com',999,'refund','rf_2');-- 0 (never negative)
-- select public.set_client_paused('glo_ing_7f3da9c2b4e8','demo@guileoai.com',true,'past_due');        -- {paused:true}
-- select public.is_client_paused('glo_ing_7f3da9c2b4e8','demo@guileoai.com');                          -- true
-- select public.set_client_paused('glo_ing_7f3da9c2b4e8','demo@guileoai.com',false);                  -- {paused:false}
