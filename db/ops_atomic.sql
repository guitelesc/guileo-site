-- ─────────────────────────────────────────────────────────────────────────────
-- Guileo — OPS ATOMIC: anti-oversell / anti-overbook + inventory.
-- Project ynihodbknhjirkdogxby (account smart@guileoai.com). Paste in the SQL Editor.
--
-- WHY THIS EXISTS
-- Under a phone-agent load spike (hundreds of concurrent callers, marketplace lead
-- blasts, hurricane-reopen bursts) two things MUST never happen:
--   1) OVERSELL   — hand out the last unit of a finite stock item twice.
--   2) OVERBOOK   — put two bookings into a capacity slot that only holds one
--                   (tables, chairs, rooms, delivery windows, machine time…).
-- biz_book already blocks two appointments occupying the SAME time-range (an EXCLUDE
-- gist constraint). But it does NOT know about consumable inventory, nor about a
-- resource that has N interchangeable units in the same window. This file is that
-- missing layer: one function, one transaction, row-level locks, guarded UPDATEs.
--
-- THE GUARANTEE
-- rpc_reserve_atomic() takes SELECT … FOR UPDATE on the capacity slot AND every
-- inventory item BEFORE it checks anything. Concurrent callers therefore SERIALIZE
-- on those rows: the first to grab the last unit wins, everyone else reads the
-- decremented value and is cleanly refused. No read-then-write race, ever. Locks are
-- always taken in a fixed order (capacity slot first, then items sorted by sku) so
-- two reservations touching the same rows can never deadlock each other.
--
-- MONEY/CORRECTNESS LAWS honored (ARQUITETURA "regras de dinheiro"):
--   • Every row + mutation scoped by client_email. A UUID alone NEVER authorizes.
--   • Decrements are atomic guarded UPDATEs (… where on_hand >= needed), never
--     read-then-write. Counters can never go negative (CHECK constraints back it up).
--   • Idempotent by a caller-supplied ref: a retry with the same ref returns the
--     SAME result and never double-decrements (atomic claim on ops_reservations).
--   • RLS ON, NO anon policy — the SECURITY DEFINER RPCs are the only door.
--   • Gate = the SCHED literal, hardcoded in the function (Supabase forbids the GUC
--     that _gui_sched_ok reads, so we check the literal directly — same value the
--     scheduling engine uses: 'gss_Kp9mX4vR2tZ7nQ5wL8bc').
--   • Graceful: helpers degrade inside EXCEPTION blocks; callers never 500 on a
--     missing row. Safe to paste this whole file twice (fully idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── GATE (literal, self-contained) ──────────────────────────────────────────
-- We do NOT reuse _gui_sched_ok(): its live definition reads a Postgres GUC
-- (current_setting('app.gui_sched_secret')) which Supabase blocks, so it would
-- deny everything. Per the "gates are ALWAYS a hardcoded literal in the function"
-- law, we check the SCHED literal directly.
create or replace function public._ops_sched_ok(p_secret text)
returns boolean language sql immutable as $$
  select p_secret is not distinct from 'gss_Kp9mX4vR2tZ7nQ5wL8bc'
$$;

-- ── TABLES ───────────────────────────────────────────────────────────────────
create table if not exists public.ops_inventory_items (
  id            uuid primary key default gen_random_uuid(),
  client_email  text not null,
  sku           text not null,
  name          text not null default '',
  unit          text not null default 'unit',      -- 'unit' | 'kg' | 'bottle' | 'plate'…
  on_hand       int  not null default 0,
  reserved      int  not null default 0,           -- soft holds not yet consumed
  reorder_point int  not null default 0,           -- low-stock threshold
  reorder_qty   int  not null default 0,           -- suggested PO quantity
  cost_cents    bigint not null default 0,
  is_86         boolean not null default false,    -- "86'd" = out across ALL channels in one flip
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ops_inv_on_hand_nonneg  check (on_hand  >= 0),
  constraint ops_inv_reserved_nonneg check (reserved >= 0)
);
-- one row per (tenant, sku): the key the RPCs address stock by
create unique index if not exists ops_inventory_items_email_sku
  on public.ops_inventory_items (client_email, sku);
create index if not exists ops_inventory_items_email
  on public.ops_inventory_items (client_email);

create table if not exists public.ops_capacity_slots (
  id             uuid primary key default gen_random_uuid(),
  client_email   text not null,
  resource_kind  text not null default 'seat',     -- 'table' | 'chair' | 'room' | 'window'…
  slot_start     timestamptz not null,
  slot_end       timestamptz not null,
  max_units      int not null default 1,
  booked_units   int not null default 0,
  appointment_id uuid,                              -- optional link to biz_appointments
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- the anti-overbook guards: booked_units can NEVER exceed max_units, nor go below 0
  constraint ops_cap_not_oversold check (booked_units <= max_units),
  constraint ops_cap_nonneg       check (booked_units >= 0),
  constraint ops_cap_max_pos      check (max_units    >= 0)
);
-- one materialized slot per (tenant, resource_kind, window): the address to lock
create unique index if not exists ops_capacity_slots_key
  on public.ops_capacity_slots (client_email, resource_kind, slot_start, slot_end);
create index if not exists ops_capacity_slots_email
  on public.ops_capacity_slots (client_email);

-- idempotency ledger: one row per (tenant, caller ref); stores the final result so a
-- retry with the same ref returns byte-identical output and never double-decrements.
create table if not exists public.ops_reservations (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  ref          text not null,
  result       jsonb,                               -- null while in-flight; final on commit
  created_at   timestamptz not null default now()
);
create unique index if not exists ops_reservations_email_ref
  on public.ops_reservations (client_email, ref);

-- ── RLS: locked; only the SECURITY DEFINER RPCs below reach these tables ──────
alter table public.ops_inventory_items enable row level security;
alter table public.ops_capacity_slots  enable row level security;
alter table public.ops_reservations     enable row level security;
-- (no policies on purpose: anon/authenticated get nothing; the RPCs are the door)

-- ═════════════════════════════════════════════════════════════════════════════
-- RPC · rpc_reserve_atomic — THE anti-oversell / anti-overbook gate.
--
-- Signature (positional, as the edge calls it):
--   rpc_reserve_atomic(
--     p_secret     text,                 -- SCHED literal 'gss_Kp9mX4vR2tZ7nQ5wL8bc'
--     p_email      text,                 -- tenant (client_email) — scopes EVERYTHING
--     p_contact_id uuid   default null,  -- crm_contacts.id (audit only; may be null)
--     p_service_id uuid   default null,  -- biz_services.id (audit only; may be null)
--     p_slot_start timestamptz default null,
--     p_slot_end   timestamptz default null,
--     p_units      int    default 1,     -- how many capacity units + item units to take
--     p_item_skus  text[] default '{}',  -- inventory SKUs this booking consumes
--     p_ref        text   default null   -- idempotency key (recommend: same key as bookIdem)
--   ) returns jsonb
--
-- Returns on success:
--   { ok:true, reserved_units, slot:{id,resource_kind,booked_units,max_units}|null,
--     items:[{sku,on_hand,reserved}], idempotent? }
-- Returns on refusal (NOTHING mutated):
--   { ok:false, reason:'out_of_stock'|'no_capacity'|'unauthorized'|'bad_units', sku? }
--
-- Capacity is enforced ONLY when a matching ops_capacity_slots row exists for
-- (p_email, p_slot_start, p_slot_end). No such row → the service is not
-- capacity-constrained and only inventory is checked (honest: we don't invent a limit).
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.rpc_reserve_atomic(
  p_secret text,
  p_email text,
  p_contact_id uuid default null,
  p_service_id uuid default null,
  p_slot_start timestamptz default null,
  p_slot_end timestamptz default null,
  p_units int default 1,
  p_item_skus text[] default '{}',
  p_ref text default null
) returns jsonb
language plpgsql security definer set search_path = public as $func$
declare
  v_units   int := coalesce(p_units, 1);
  v_prior   jsonb;
  v_claimed boolean := false;
  v_cap     record;
  v_has_cap boolean := false;   -- true only after a capacity row is actually SELECTed (record stays
                                -- unassigned otherwise → reading v_cap.* would raise 55000)
  v_sku     text;
  v_item    record;
  v_items   jsonb := '[]'::jsonb;
  v_slot    jsonb := null;
  v_result  jsonb;
begin
  if not _ops_sched_ok(p_secret) then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  if p_email is null or p_email = '' then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  if v_units < 1 then
    return jsonb_build_object('ok', false, 'reason', 'bad_units');
  end if;

  -- ── IDEMPOTENCY CLAIM ──────────────────────────────────────────────────────
  -- Atomically claim the ref. If someone else already owns it, block on their row
  -- (FOR UPDATE) until they commit, then return THEIR stored result — a retry can
  -- never run the decrement twice, and two concurrent same-ref calls converge.
  if p_ref is not null and p_ref <> '' then
    insert into ops_reservations (client_email, ref, result)
      values (p_email, p_ref, null)
      on conflict (client_email, ref) do nothing;
    if found then
      v_claimed := true;                      -- we own this ref; proceed to reserve
    else
      select result into v_prior from ops_reservations
        where client_email = p_email and ref = p_ref
        for update;                           -- waits for the owning txn to finish
      return coalesce(v_prior, jsonb_build_object('ok', false, 'reason', 'in_progress'));
    end if;
  end if;

  -- ── LOCK ORDER: capacity slot FIRST (fixed order → no deadlocks) ────────────
  if p_slot_start is not null and p_slot_end is not null then
    select * into v_cap from ops_capacity_slots
      where client_email = p_email
        and slot_start = p_slot_start
        and slot_end   = p_slot_end
      order by resource_kind
      limit 1
      for update;                             -- serialize concurrent bookers on this slot
    v_has_cap := found;                       -- only then is v_cap safe to read
  end if;

  -- ── LOCK each inventory item, sorted by sku (fixed order) THEN validate ─────
  -- Two passes on purpose: acquire every lock + verify availability BEFORE any
  -- mutation, so a refusal leaves the whole transaction untouched.
  for v_sku in
    select distinct s from unnest(coalesce(p_item_skus, '{}')) as s
    where s is not null and s <> ''
    order by 1
  loop
    select * into v_item from ops_inventory_items
      where client_email = p_email and sku = v_sku
      for update;
    if not found then
      -- an item the booking needs isn't stocked at all → cannot fulfill
      v_result := jsonb_build_object('ok', false, 'reason', 'out_of_stock', 'sku', v_sku);
      if v_claimed then update ops_reservations set result = v_result
        where client_email = p_email and ref = p_ref; end if;
      return v_result;
    end if;
    if v_item.is_86 or v_item.on_hand < v_units then
      v_result := jsonb_build_object('ok', false, 'reason', 'out_of_stock', 'sku', v_sku);
      if v_claimed then update ops_reservations set result = v_result
        where client_email = p_email and ref = p_ref; end if;
      return v_result;
    end if;
  end loop;

  -- ── CAPACITY CHECK (only if a slot was materialized for this window) ────────
  -- NOTE: nested IF, not `v_has_cap and (v_cap.…)` — SQL boolean evaluation is NOT guaranteed to
  -- short-circuit, so a flat AND would still read v_cap.* when the record was never assigned (55000).
  if v_has_cap then
    if (v_cap.booked_units + v_units) > v_cap.max_units then
      v_result := jsonb_build_object('ok', false, 'reason', 'no_capacity');
      if v_claimed then update ops_reservations set result = v_result
        where client_email = p_email and ref = p_ref; end if;
      return v_result;
    end if;
  end if;

  -- ── COMMIT THE RESERVATION (guarded atomic UPDATEs) ────────────────────────
  if v_has_cap then
    update ops_capacity_slots
       set booked_units = booked_units + v_units,
           appointment_id = coalesce(appointment_id, appointment_id),
           updated_at = now()
     where id = v_cap.id
       and client_email = p_email
       and booked_units + v_units <= max_units;   -- guard (belt + CHECK suspenders)
    if not found then
      -- lost the race between check and update (shouldn't happen under FOR UPDATE,
      -- but the CHECK/guard protects us regardless) → refuse, nothing else touched.
      v_result := jsonb_build_object('ok', false, 'reason', 'no_capacity');
      if v_claimed then update ops_reservations set result = v_result
        where client_email = p_email and ref = p_ref; end if;
      return v_result;
    end if;
    v_slot := jsonb_build_object(
      'id', v_cap.id, 'resource_kind', v_cap.resource_kind,
      'booked_units', v_cap.booked_units + v_units, 'max_units', v_cap.max_units);
  end if;

  for v_sku in
    select distinct s from unnest(coalesce(p_item_skus, '{}')) as s
    where s is not null and s <> ''
    order by 1
  loop
    update ops_inventory_items
       set on_hand  = on_hand  - v_units,
           reserved = reserved + v_units,
           updated_at = now()
     where client_email = p_email and sku = v_sku
       and on_hand >= v_units and is_86 = false;   -- guarded: never negative, never 86'd
    if not found then
      -- another txn took it between our lock release and here (impossible while we
      -- hold FOR UPDATE, but the guard makes the invariant unbreakable) → refuse.
      v_result := jsonb_build_object('ok', false, 'reason', 'out_of_stock', 'sku', v_sku);
      if v_claimed then update ops_reservations set result = v_result
        where client_email = p_email and ref = p_ref; end if;
      return v_result;
    end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'sku', v_sku,
      'on_hand',  (select on_hand  from ops_inventory_items where client_email = p_email and sku = v_sku),
      'reserved', (select reserved from ops_inventory_items where client_email = p_email and sku = v_sku)));
  end loop;

  v_result := jsonb_build_object(
    'ok', true,
    'reserved_units', v_units,
    'slot', v_slot,
    'items', v_items);
  if v_claimed then
    update ops_reservations set result = v_result
      where client_email = p_email and ref = p_ref;
  end if;
  return v_result;
end $func$;

grant execute on function public.rpc_reserve_atomic(text,text,uuid,uuid,timestamptz,timestamptz,int,text[],text) to anon;

-- ═════════════════════════════════════════════════════════════════════════════
-- RPC · rpc_reserve_release — give back a reservation (cancel / no-show / expiry).
-- Reverses what rpc_reserve_atomic took for a given ref, exactly once (idempotent:
-- a second release for the same ref is a no-op). Keeps reserved/booked counts honest
-- so the cockpit never shows phantom-consumed stock. SCHED-gated, tenant-scoped.
--   rpc_reserve_release(p_secret text, p_email text, p_ref text) returns jsonb
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.rpc_reserve_release(
  p_secret text, p_email text, p_ref text
) returns jsonb
language plpgsql security definer set search_path = public as $func$
declare
  v_res  record;
  v_item jsonb;
  v_sku  text;
  v_units int;
  v_slotid uuid;
begin
  if not _ops_sched_ok(p_secret) then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  if p_email is null or p_email = '' or p_ref is null or p_ref = '' then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;

  -- lock the reservation row; only a still-active (ok:true, not yet released) one reverses
  select * into v_res from ops_reservations
    where client_email = p_email and ref = p_ref for update;
  if not found or v_res.result is null or (v_res.result->>'ok') <> 'true'
     or coalesce((v_res.result->>'released')::boolean, false) then
    return jsonb_build_object('ok', true, 'released', false, 'note', 'nothing_to_release');
  end if;

  v_units := coalesce((v_res.result->>'reserved_units')::int, 1);

  -- give inventory back
  for v_item in select * from jsonb_array_elements(coalesce(v_res.result->'items','[]'::jsonb)) loop
    v_sku := v_item->>'sku';
    update ops_inventory_items
       set on_hand = on_hand + v_units,
           reserved = greatest(0, reserved - v_units),
           updated_at = now()
     where client_email = p_email and sku = v_sku;
  end loop;

  -- give capacity back
  v_slotid := nullif(v_res.result#>>'{slot,id}', '')::uuid;
  if v_slotid is not null then
    update ops_capacity_slots
       set booked_units = greatest(0, booked_units - v_units), updated_at = now()
     where id = v_slotid and client_email = p_email;
  end if;

  -- mark released so a repeat call is a clean no-op
  update ops_reservations
     set result = jsonb_set(v_res.result, '{released}', 'true'::jsonb)
   where client_email = p_email and ref = p_ref;

  return jsonb_build_object('ok', true, 'released', true, 'units', v_units);
end $func$;

grant execute on function public.rpc_reserve_release(text,text,text) to anon;

-- ═════════════════════════════════════════════════════════════════════════════
-- INVENTORY MANAGEMENT RPCs (cockpit board / agent 86-flip / PO draft)
-- ═════════════════════════════════════════════════════════════════════════════

-- Flip an item out-of-stock (or back) across ALL channels in one call.
--   ops_inventory_86(p_secret text, p_email text, p_sku text, p_on boolean) returns jsonb
create or replace function public.ops_inventory_86(
  p_secret text, p_email text, p_sku text, p_on boolean
) returns jsonb
language plpgsql security definer set search_path = public as $func$
declare v_row record;
begin
  if not _ops_sched_ok(p_secret) then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  if p_email is null or p_email = '' or p_sku is null or p_sku = '' then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;
  update ops_inventory_items
     set is_86 = coalesce(p_on, true), updated_at = now()
   where client_email = p_email and sku = p_sku
   returning * into v_row;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'sku', v_row.sku, 'is_86', v_row.is_86);
end $func$;

grant execute on function public.ops_inventory_86(text,text,text,boolean) to anon;

-- Create or update an item (idempotent on (client_email, sku)).
--   ops_inventory_upsert(p_secret,p_email,p_sku,p_name,p_on_hand,p_reorder_point,
--                        p_reorder_qty default 0,p_cost_cents default 0,p_unit default 'unit') returns jsonb
create or replace function public.ops_inventory_upsert(
  p_secret text, p_email text, p_sku text, p_name text,
  p_on_hand int, p_reorder_point int,
  p_reorder_qty int default 0, p_cost_cents bigint default 0, p_unit text default 'unit'
) returns jsonb
language plpgsql security definer set search_path = public as $func$
declare v_row record;
begin
  if not _ops_sched_ok(p_secret) then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  if p_email is null or p_email = '' or p_sku is null or p_sku = '' then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;
  insert into ops_inventory_items
    (client_email, sku, name, unit, on_hand, reorder_point, reorder_qty, cost_cents)
  values
    (p_email, p_sku, coalesce(p_name,''), coalesce(p_unit,'unit'),
     greatest(0, coalesce(p_on_hand,0)), greatest(0, coalesce(p_reorder_point,0)),
     greatest(0, coalesce(p_reorder_qty,0)), greatest(0, coalesce(p_cost_cents,0)))
  on conflict (client_email, sku) do update set
     name = excluded.name,
     unit = excluded.unit,
     on_hand = excluded.on_hand,
     reorder_point = excluded.reorder_point,
     reorder_qty = excluded.reorder_qty,
     cost_cents = excluded.cost_cents,
     updated_at = now()
  returning * into v_row;
  return jsonb_build_object('ok', true, 'sku', v_row.sku, 'on_hand', v_row.on_hand, 'is_86', v_row.is_86);
end $func$;

grant execute on function public.ops_inventory_upsert(text,text,text,text,int,int,int,bigint,text) to anon;

-- Full item list for the cockpit board, each with a computed low_stock flag.
--   ops_inventory_list(p_secret text, p_email text) returns jsonb  → array
create or replace function public.ops_inventory_list(
  p_secret text, p_email text
) returns jsonb
language plpgsql security definer set search_path = public as $func$
declare v jsonb;
begin
  if not _ops_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', id, 'sku', sku, 'name', name, 'unit', unit,
             'on_hand', on_hand, 'reserved', reserved,
             'reorder_point', reorder_point, 'reorder_qty', reorder_qty,
             'cost_cents', cost_cents, 'is_86', is_86,
             'low_stock', (is_86 or on_hand <= reorder_point),
             'updated_at', updated_at
           ) order by (is_86 or on_hand <= reorder_point) desc, name asc), '[]'::jsonb)
      into v
      from ops_inventory_items
     where client_email = p_email;
  exception when others then
    v := '[]'::jsonb;   -- degrade, never 500 the board
  end;
  return coalesce(v, '[]'::jsonb);
end $func$;

grant execute on function public.ops_inventory_list(text,text) to anon;

-- Items at/below their reorder point (or 86'd) — the PO-draft feed.
--   ops_reorder_due(p_secret text, p_email text) returns jsonb  → array
create or replace function public.ops_reorder_due(
  p_secret text, p_email text
) returns jsonb
language plpgsql security definer set search_path = public as $func$
declare v jsonb;
begin
  if not _ops_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
             'sku', sku, 'name', name, 'unit', unit,
             'on_hand', on_hand, 'reorder_point', reorder_point,
             'reorder_qty', greatest(reorder_qty, reorder_point - on_hand),
             'cost_cents', cost_cents, 'is_86', is_86,
             'est_cost_cents', greatest(reorder_qty, reorder_point - on_hand) * cost_cents
           ) order by name asc), '[]'::jsonb)
      into v
      from ops_inventory_items
     where client_email = p_email
       and (is_86 or on_hand <= reorder_point);
  exception when others then
    v := '[]'::jsonb;
  end;
  return coalesce(v, '[]'::jsonb);
end $func$;

grant execute on function public.ops_reorder_due(text,text) to anon;

-- Materialize / update a bookable capacity slot (front desk / onboarding / cron).
--   ops_capacity_upsert(p_secret,p_email,p_resource_kind,p_slot_start,p_slot_end,
--                       p_max_units,p_appointment_id default null) returns jsonb
create or replace function public.ops_capacity_upsert(
  p_secret text, p_email text, p_resource_kind text,
  p_slot_start timestamptz, p_slot_end timestamptz, p_max_units int,
  p_appointment_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $func$
declare v_row record;
begin
  if not _ops_sched_ok(p_secret) then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  if p_email is null or p_email = '' or p_slot_start is null or p_slot_end is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;
  insert into ops_capacity_slots
    (client_email, resource_kind, slot_start, slot_end, max_units, appointment_id)
  values
    (p_email, coalesce(p_resource_kind,'seat'), p_slot_start, p_slot_end,
     greatest(0, coalesce(p_max_units,1)), p_appointment_id)
  on conflict (client_email, resource_kind, slot_start, slot_end) do update set
     -- never let a shrink push max below what's already booked (keeps CHECK valid)
     max_units = greatest(excluded.max_units, ops_capacity_slots.booked_units),
     appointment_id = coalesce(excluded.appointment_id, ops_capacity_slots.appointment_id),
     updated_at = now()
  returning * into v_row;
  return jsonb_build_object('ok', true, 'id', v_row.id,
    'booked_units', v_row.booked_units, 'max_units', v_row.max_units);
end $func$;

grant execute on function public.ops_capacity_upsert(text,text,text,timestamptz,timestamptz,int,uuid) to anon;

-- ═════════════════════════════════════════════════════════════════════════════
-- PROOF — anti-oversell + anti-overbook under contention for the LAST unit.
-- Self-contained, tenant-namespaced, self-cleaning. Raises if any invariant breaks,
-- so a green run in the SQL Editor is real evidence. Safe to re-run.
--
-- Note on concurrency: true parallel sessions can't be spawned inside one script,
-- but the guarantee is structural — every path is a FOR UPDATE lock + a guarded
-- UPDATE (… where on_hand>=units / booked_units+units<=max_units) + CHECK
-- constraints. This block proves the DECISION logic + the guards + idempotency;
-- the row locks are what make it hold when the two calls below happen concurrently.
-- ═════════════════════════════════════════════════════════════════════════════
do $proof$
declare
  e text := 'proof+ops_atomic@guileoai.com';
  sec text := 'gss_Kp9mX4vR2tZ7nQ5wL8bc';
  t0 timestamptz := '2030-01-01 15:00:00+00';
  t1 timestamptz := '2030-01-01 16:00:00+00';
  r1 jsonb; r2 jsonb; r3 jsonb; lst jsonb; due jsonb;
begin
  -- clean slate
  delete from ops_reservations   where client_email = e;
  delete from ops_capacity_slots where client_email = e;
  delete from ops_inventory_items where client_email = e;

  -- one table (max 1), one bottle of wine (on_hand 1): the "last unit" of each
  perform ops_capacity_upsert(sec, e, 'table', t0, t1, 1, null);
  perform ops_inventory_upsert(sec, e, 'wine-01', 'Malbec', 1, 2, 6, 1500, 'bottle');

  -- Caller A grabs the last table + last bottle → OK
  r1 := rpc_reserve_atomic(sec, e, null, null, t0, t1, 1, array['wine-01'], 'proof-ref-A');
  if (r1->>'ok') <> 'true' then
    raise exception 'PROOF FAIL: first reservation should succeed, got %', r1;
  end if;

  -- Caller B wants the SAME table + bottle → must be refused (no double-sell/book)
  r2 := rpc_reserve_atomic(sec, e, null, null, t0, t1, 1, array['wine-01'], 'proof-ref-B');
  if (r2->>'ok') <> 'false'
     or (r2->>'reason') not in ('no_capacity','out_of_stock') then
    raise exception 'PROOF FAIL: second reservation must be refused, got %', r2;
  end if;

  -- Idempotency: A retries with the SAME ref → identical result, NO second decrement
  r3 := rpc_reserve_atomic(sec, e, null, null, t0, t1, 1, array['wine-01'], 'proof-ref-A');
  if r3 <> r1 then
    raise exception 'PROOF FAIL: idempotent retry must return the first result, got % vs %', r3, r1;
  end if;

  -- Stock is exactly 0 on_hand / 1 reserved, table fully booked — no negatives
  lst := ops_inventory_list(sec, e);
  if ((lst->0->>'on_hand')::int) <> 0 or ((lst->0->>'reserved')::int) <> 1 then
    raise exception 'PROOF FAIL: expected on_hand 0 / reserved 1, got %', lst;
  end if;
  if ((lst->0->>'low_stock')) <> 'true' then
    raise exception 'PROOF FAIL: item at 0 on_hand should read low_stock';
  end if;

  -- Reorder feed surfaces it
  due := ops_reorder_due(sec, e);
  if jsonb_array_length(due) <> 1 then
    raise exception 'PROOF FAIL: reorder_due should list the depleted item, got %', due;
  end if;

  -- 86 flip refuses even when we later restock (out across all channels in one flip)
  perform ops_inventory_upsert(sec, e, 'wine-01', 'Malbec', 5, 2, 6, 1500, 'bottle'); -- restock to 5
  perform ops_inventory_86(sec, e, 'wine-01', true);
  r2 := rpc_reserve_atomic(sec, e, null, null, null, null, 1, array['wine-01'], 'proof-ref-C');
  if (r2->>'ok') <> 'false' or (r2->>'reason') <> 'out_of_stock' then
    raise exception 'PROOF FAIL: 86 flip must refuse despite stock, got %', r2;
  end if;

  -- Release gives A's reservation back cleanly (and is idempotent)
  perform ops_inventory_86(sec, e, 'wine-01', false);
  r3 := rpc_reserve_release(sec, e, 'proof-ref-A');
  if (r3->>'released') <> 'true' then
    raise exception 'PROOF FAIL: release should return released:true, got %', r3;
  end if;
  r3 := rpc_reserve_release(sec, e, 'proof-ref-A');   -- second call = no-op
  if (r3->>'released') <> 'false' then
    raise exception 'PROOF FAIL: repeat release must be a no-op, got %', r3;
  end if;

  -- clean up the proof tenant entirely
  delete from ops_reservations   where client_email = e;
  delete from ops_capacity_slots where client_email = e;
  delete from ops_inventory_items where client_email = e;

  raise notice 'OPS_ATOMIC PROOF PASSED ✓ (anti-oversell, anti-overbook, idempotent, 86-flip, release)';
end $proof$;
