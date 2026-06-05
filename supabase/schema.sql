-- ═══════════════════════════════════════════════════════════════════════════
-- Guileo Growth Cockpit — Supabase / Postgres schema
-- ───────────────────────────────────────────────────────────────────────────
-- Multi-tenant SaaS dashboard. One Supabase project serves ALL clients; each
-- business is a `tenant`, and EVERY domain row carries `tenant_id`. Row Level
-- Security (RLS) guarantees a logged-in staff member can only ever read/write
-- rows belonging to their own tenant.
--
-- This file is the single source of truth that backs `src/lib/portalApi.js`
-- (the frontend "seam"). Each method in that file maps to a table here — see
-- BACKEND_CONNECT.md for the exact before/after mapping.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor and click Run.
-- It is idempotent-friendly (uses IF NOT EXISTS / CREATE OR REPLACE) so you can
-- re-run it safely while iterating.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ TABLE OF CONTENTS                                                        │
-- │   0. Extensions                                                          │
-- │   1. Tenancy core      : tenants, profiles (auth.users → tenant + role)  │
-- │   2. RLS helper        : current_tenant_id()                             │
-- │   3. Seam tables       : business_profile, kb_entries, ui_state          │
-- │   4. Conversations     : conversations, messages, calls                  │
-- │   5. Operations        : orders, order_items, bookings, deliveries,      │
-- │                          integration_connections                         │
-- │   6. Customers & growth: customers, campaigns, audiences, recurring_plans│
-- │                          reviews, followups, waitlist                    │
-- │   7. Alerts            : alerts                                          │
-- │   8. RLS enablement + policy template (applied to every table)          │
-- └─────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- 0. EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════════════
-- gen_random_uuid() lives in pgcrypto (already present on Supabase, but be safe).
create extension if not exists pgcrypto;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TENANCY CORE
-- ═══════════════════════════════════════════════════════════════════════════

-- One row per business. `vertical` is one of the 12 Growth Cockpit sectors:
-- restaurant, clinic, medical, salon, law, ecommerce, realestate, gym,
-- homeservices, auto, education, construction.
create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  vertical    text not null,
  plan        text not null default 'essential',   -- essential | personalized | full
  created_at  timestamptz not null default now()
);

-- Links a Supabase auth user to ONE tenant + a role. This is the table RLS
-- consults to decide "which tenant is this request allowed to touch?".
-- A new staff member: insert a row here after they sign up.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  full_name   text,
  email       text,
  role        text not null default 'staff',        -- owner | manager | staff
  created_at  timestamptz not null default now()
);

create index if not exists idx_profiles_tenant on public.profiles (tenant_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RLS HELPER
-- ───────────────────────────────────────────────────────────────────────────
-- Returns the tenant_id of the currently-authenticated user by looking up their
-- profile. Used by EVERY policy below: `tenant_id = current_tenant_id()`.
-- SECURITY DEFINER so the lookup itself isn't blocked by RLS on profiles.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. SEAM TABLES  (directly back portalApi.js methods)
-- ═══════════════════════════════════════════════════════════════════════════

-- loadProfile / saveProfile  →  one settings row per tenant (name/address/hours/phone).
-- The frontend upserts the whole profile object; columns mirror the wizard fields,
-- and `extra` jsonb catches anything not promoted to a column.
create table if not exists public.business_profile (
  tenant_id   uuid primary key references public.tenants (id) on delete cascade,
  name        text,
  address     text,
  hours       text,
  phone       text,
  vertical    text,
  extra       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- loadKB / saveKB  →  the editable "Train your AI" knowledge base.
-- One row per trained answer; the sandbox matches a customer question to these.
create table if not exists public.kb_entries (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  vertical    text,
  topic       text not null,
  triggers    text[] not null default '{}',   -- trigger keywords
  answer      text not null,
  locked      boolean not null default false,  -- e.g. "cancellations route to human"
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_kb_tenant on public.kb_entries (tenant_id);

-- loadState / saveState  →  durable UI state, keyed by an arbitrary scope string.
-- Keys the frontend uses: "<Label>:alerts", "<Label>:fups", "<Label>:wait",
-- "<Label>:notifsRead", "<Label>:integrations", "<Label>:owndelivery",
-- "<Label>:created:liveorders", "<Label>:created:schedule",
-- "<Label>:created:deliveries". Upserted by (tenant_id, key); value is jsonb.
create table if not exists public.ui_state (
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  key         text not null,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, key)
);

create index if not exists idx_ui_state_tenant on public.ui_state (tenant_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. CONVERSATIONS  (unified inbox: phone / whatsapp / sms / social)
-- ═══════════════════════════════════════════════════════════════════════════

-- One thread per customer-per-channel. The Inbox normalizes these into one feed.
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  customer_id   uuid,                              -- soft link to customers.id
  channel       text not null,                     -- phone|whatsapp|sms|instagram|facebook|tiktok
  contact_name  text,
  contact_handle text,
  status        text not null default 'open',      -- open|handled|closed
  unread        integer not null default 0,
  last_message_at timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_conv_tenant   on public.conversations (tenant_id);
create index if not exists idx_conv_status   on public.conversations (status);
create index if not exists idx_conv_created  on public.conversations (created_at);

-- sendMessage → inserts here. `from` distinguishes ai / human / customer.
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  channel         text,
  body            text not null,
  sender          text not null default 'human',   -- ai|human|customer  ("from" is reserved)
  created_at      timestamptz not null default now()
);

create index if not exists idx_msg_tenant on public.messages (tenant_id);
create index if not exists idx_msg_conv   on public.messages (conversation_id);
create index if not exists idx_msg_created on public.messages (created_at);

-- Call logs (voice AI). Powers Call Logs + AI Analytics (sentiment/intents/transcript).
create table if not exists public.calls (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  customer_id   uuid,
  direction     text not null default 'inbound',   -- inbound|outbound
  from_number   text,
  to_number     text,
  duration_sec  integer,
  status        text not null default 'completed', -- completed|missed|voicemail
  sentiment     text,                              -- positive|neutral|negative
  intent        text,
  transcript    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_calls_tenant  on public.calls (tenant_id);
create index if not exists idx_calls_status  on public.calls (status);
create index if not exists idx_calls_created on public.calls (created_at);


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. OPERATIONS  (orders / bookings / deliveries / integrations)
-- ═══════════════════════════════════════════════════════════════════════════

-- Restaurant Live Orders + Kitchen kanban. Also fed by "Create order from chat"
-- (ConvoActions → ui_state created:liveorders today; orders table once live).
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  customer_id   uuid,
  ref           text,                              -- human order # e.g. "#6337"
  channel       text,                              -- ubereats|doordash|grubhub|direct|chat|phone
  status        text not null default 'new',       -- new|preparing|ready|delivered|done|cancelled
  total_cents   integer not null default 0,
  currency      text not null default 'USD',
  source        text,                              -- 'chat' tags the gold "from chat" badge
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_orders_tenant  on public.orders (tenant_id);
create index if not exists idx_orders_status  on public.orders (status);
create index if not exists idx_orders_created on public.orders (created_at);

-- Optional line items for an order.
create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  order_id    uuid not null references public.orders (id) on delete cascade,
  name        text not null,
  qty         integer not null default 1,
  price_cents integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_order_items_tenant on public.order_items (tenant_id);
create index if not exists idx_order_items_order  on public.order_items (order_id);

-- Appointments / bookings (clinic visits, salon slots, law intakes, viewings…).
-- Also fed by "Book appointment from chat" (created:schedule today).
create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  customer_id   uuid,
  title         text,                              -- service / matter / procedure name
  provider      text,                              -- staff member (Dr. Ferreira, Tech Mike…)
  room          text,
  starts_at     timestamptz,
  duration_min  integer,
  status        text not null default 'scheduled', -- scheduled|confirmed|completed|no_show|cancelled
  source        text,                              -- 'chat' for the from-chat badge
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_bookings_tenant on public.bookings (tenant_id);
create index if not exists idx_bookings_status on public.bookings (status);
create index if not exists idx_bookings_starts on public.bookings (starts_at);

-- Delivery / dispatch board (Guileo Direct + 3rd-party apps). Also fed by
-- "create delivery from chat" (created:deliveries today).
create table if not exists public.deliveries (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  order_id      uuid references public.orders (id) on delete set null,
  customer_id   uuid,
  provider      text,                              -- ubereats|doordash|grubhub|direct|ups|fedex…
  driver        text,
  address       text,
  status        text not null default 'preparing', -- preparing|en_route|arriving|delivered|cancelled
  eta_min       integer,
  commission_cents integer not null default 0,     -- saved when using Guileo Direct
  source        text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_deliveries_tenant  on public.deliveries (tenant_id);
create index if not exists idx_deliveries_status  on public.deliveries (status);
create index if not exists idx_deliveries_created on public.deliveries (created_at);

-- Per-tenant on/off state for external integrations (Uber Eats / DoorDash /
-- UPS / FedEx / etc.) and the "own delivery" toggle. Mirrors the
-- "<Label>:integrations" / "<Label>:owndelivery" ui_state keys, but as a real
-- table once you wire OAuth/credentials. `config` jsonb holds non-secret
-- settings ONLY — store provider API secrets in Supabase Vault, never here.
create table if not exists public.integration_connections (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  provider    text not null,                       -- ubereats|doordash|grubhub|stripe|meta_ads…
  connected   boolean not null default false,
  config      jsonb not null default '{}'::jsonb,  -- non-secret settings only
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, provider)
);

create index if not exists idx_integrations_tenant on public.integration_connections (tenant_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. CUSTOMERS & GROWTH MODULES
-- ═══════════════════════════════════════════════════════════════════════════

-- CRM record. last_seen / total_spend power "Next best action" + segmentation.
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  name          text not null,
  phone         text,
  email         text,
  tags          text[] not null default '{}',
  visits        integer not null default 0,
  total_spend_cents integer not null default 0,
  last_seen     timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_customers_tenant on public.customers (tenant_id);
create index if not exists idx_customers_created on public.customers (created_at);

-- Marketing campaigns (per-sector promos / blasts).
create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  name        text not null,
  channel     text,                                -- email|sms|whatsapp|ads
  status      text not null default 'draft',       -- draft|scheduled|live|done
  audience_id uuid,
  sent        integer not null default 0,
  revenue_cents integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_campaigns_tenant on public.campaigns (tenant_id);
create index if not exists idx_campaigns_status on public.campaigns (status);

-- Ad audiences / segments (sync to ads, use in campaign).
create table if not exists public.audiences (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  name        text not null,
  size        integer not null default 0,
  criteria    jsonb not null default '{}'::jsonb,
  synced      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audiences_tenant on public.audiences (tenant_id);

-- Memberships / subscriptions / recall plans (MRR + churn risk).
create table if not exists public.recurring_plans (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  customer_id   uuid,
  name          text not null,
  amount_cents  integer not null default 0,
  interval      text not null default 'month',     -- week|month|year
  status        text not null default 'active',    -- active|paused|churn_risk|cancelled
  next_charge_at timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_recurring_tenant on public.recurring_plans (tenant_id);
create index if not exists idx_recurring_status on public.recurring_plans (status);

-- Reviews / reputation (AI-collected + request blasts).
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid,
  source      text,                                -- google|yelp|internal…
  rating      integer,                             -- 1..5
  body        text,
  status      text not null default 'received',    -- requested|received|responded
  created_at  timestamptz not null default now()
);

create index if not exists idx_reviews_tenant  on public.reviews (tenant_id);
create index if not exists idx_reviews_created on public.reviews (created_at);

-- Follow-ups: chase un-converted leads / quotes / trials / recalls.
create table if not exists public.followups (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid,
  label       text,                                -- sector-specific (quote / trial / recall…)
  value_cents integer not null default 0,
  status      text not null default 'pending',     -- pending|nudged|won|lost
  due_at      timestamptz,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_followups_tenant on public.followups (tenant_id);
create index if not exists idx_followups_status on public.followups (status);

-- Waitlist: fill empty capacity (offer slot → convert).
create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid,
  want        text,                                -- what they're waiting for
  value_cents integer not null default 0,
  status      text not null default 'waiting',     -- waiting|offered|filled|expired
  created_at  timestamptz not null default now()
);

create index if not exists idx_waitlist_tenant on public.waitlist (tenant_id);
create index if not exists idx_waitlist_status on public.waitlist (status);


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ALERTS  ("Needs attention")
-- ═══════════════════════════════════════════════════════════════════════════
-- resolveAlert → sets resolved_at. Open alerts = resolved_at IS NULL.
create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  level       text not null default 'info',        -- info|warning|urgent
  text        text not null,
  target      text,                                -- section to route "View →"
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_alerts_tenant   on public.alerts (tenant_id);
create index if not exists idx_alerts_resolved on public.alerts (resolved_at);
create index if not exists idx_alerts_created  on public.alerts (created_at);


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. ROW LEVEL SECURITY  (the multi-tenant firewall)
-- ───────────────────────────────────────────────────────────────────────────
-- THE PATTERN (read this once, it explains every block below):
--
--   1. Enable RLS on the table  → by default NO rows are visible to anyone.
--   2. Add a policy             → re-opens access, but ONLY for rows where
--                                 `tenant_id = current_tenant_id()`.
--
-- `current_tenant_id()` reads the logged-in user's tenant from `profiles`
-- (via auth.uid()). So a user can only ever touch their own tenant's data —
-- even though every client shares the same physical tables. The public anon
-- key shipped to the browser is therefore safe: it can't read anything until a
-- user authenticates, and even then only their tenant's rows.
--
-- `for all` covers SELECT/INSERT/UPDATE/DELETE. `using` filters which existing
-- rows are visible/updatable; `with check` ensures you can't INSERT/UPDATE a
-- row into someone else's tenant.
--
-- `tenants` and `profiles` get bespoke policies (their tenant scope is the row
-- itself / the user's own profile). Every other table uses the uniform
-- per-tenant template applied by the DO-block loop at the end.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── tenants: a user can see the tenant they belong to ──
alter table public.tenants enable row level security;
drop policy if exists tenant_select on public.tenants;
create policy tenant_select on public.tenants
  for select using (id = public.current_tenant_id());

-- ── profiles: a user can see/manage their own profile row ──
alter table public.profiles enable row level security;
drop policy if exists profile_self on public.profiles;
create policy profile_self on public.profiles
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- Optional: let staff see co-workers in the SAME tenant (read-only). Uncomment
-- if your UI needs a team roster.
-- drop policy if exists profile_same_tenant on public.profiles;
-- create policy profile_same_tenant on public.profiles
--   for select using (tenant_id = public.current_tenant_id());

-- ── Uniform per-tenant policy for every domain table ──
-- One policy: you may touch a row iff its tenant_id is your tenant. The loop
-- keeps this DRY and guarantees no table is accidentally left unprotected.
do $$
declare
  t text;
  domain_tables text[] := array[
    'business_profile', 'kb_entries', 'ui_state',
    'conversations', 'messages', 'calls',
    'orders', 'order_items', 'bookings', 'deliveries', 'integration_connections',
    'customers', 'campaigns', 'audiences', 'recurring_plans',
    'reviews', 'followups', 'waitlist', 'alerts'
  ];
begin
  foreach t in array domain_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists tenant_isolation on public.%I;', t);
    execute format($f$
      create policy tenant_isolation on public.%I
        for all
        using (tenant_id = public.current_tenant_id())
        with check (tenant_id = public.current_tenant_id());
    $f$, t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF SCHEMA — 21 tables, RLS on all, per-tenant isolation enforced.
-- Next: see BACKEND_CONNECT.md to wire src/lib/portalApi.js to these tables.
-- ═══════════════════════════════════════════════════════════════════════════
