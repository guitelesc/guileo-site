-- Guileo persistence MVP: one key-value table per user, mirroring the localStorage
-- keys the app already uses (gui_credits, <label>:stack, :automations, :settings,
-- :profile, gui_usage, etc). RLS makes every row private to its owner. The whole
-- portal persists across devices with zero screen changes — loadState/saveState
-- just hydrate from / sync to this table.

create table if not exists public.app_kv (
  user_id    uuid not null references auth.users(id) on delete cascade,
  k          text not null,
  v          jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, k)
);

alter table public.app_kv enable row level security;

-- Each authenticated user can only read/write their own rows.
drop policy if exists "app_kv_select_own" on public.app_kv;
create policy "app_kv_select_own" on public.app_kv
  for select using (auth.uid() = user_id);

drop policy if exists "app_kv_insert_own" on public.app_kv;
create policy "app_kv_insert_own" on public.app_kv
  for insert with check (auth.uid() = user_id);

drop policy if exists "app_kv_update_own" on public.app_kv;
create policy "app_kv_update_own" on public.app_kv
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "app_kv_delete_own" on public.app_kv;
create policy "app_kv_delete_own" on public.app_kv
  for delete using (auth.uid() = user_id);

-- keep updated_at fresh on upsert
create or replace function public.touch_app_kv() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_touch_app_kv on public.app_kv;
create trigger trg_touch_app_kv before update on public.app_kv
  for each row execute function public.touch_app_kv();
