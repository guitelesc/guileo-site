-- Run this in the Supabase SQL editor (project ynihodbknhjirkdogxby) to enable the clients registry.
-- Creates the per-user `clients` table with Row Level Security so each authenticated
-- user can only read/insert/update their own row (uid = auth.uid()).

create table if not exists public.clients (
  uid        uuid primary key references auth.users (id) on delete cascade,
  email      text,
  name       text,
  business   text,
  sector     text,
  contact    text,
  plan       text        default 'trial',
  credits    int         default 250,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security (no row is readable/writable until a policy allows it).
alter table public.clients enable row level security;

-- A user can read only their own row.
create policy "clients_select_own"
  on public.clients
  for select
  to authenticated
  using (uid = auth.uid());

-- A user can insert only a row that belongs to them.
create policy "clients_insert_own"
  on public.clients
  for insert
  to authenticated
  with check (uid = auth.uid());

-- A user can update only their own row.
create policy "clients_update_own"
  on public.clients
  for update
  to authenticated
  using (uid = auth.uid())
  with check (uid = auth.uid());
