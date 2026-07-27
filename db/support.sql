-- ============================================================================
-- Guileo · SUPPORT (Gui Suporte client-facing) + BROTO (our internal admin/ops)
-- (paste in Supabase → SQL Editor → Run). Gated by _gui_sched_ok.
-- support_tickets = every support interaction (AI-resolved or escalated to a human).
-- platform_inventory = our stock: phone numbers, hardware, accounts, integrations.
-- ============================================================================

create table if not exists public.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,                       -- the tenant who opened it
  subject      text,
  category     text,                                -- setup | billing | agent | technical | feature | account | data
  status       text not null default 'open',        -- open | resolving | resolved | escalated
  priority     text not null default 'normal',       -- low | normal | high | urgent
  channel      text not null default 'portal',
  ai_handled   boolean not null default false,        -- did Gui Support resolve it instantly?
  kb_id        text,                                  -- which scenario matched (analytics)
  resolution   text,
  thread       jsonb not null default '[]'::jsonb,    -- [{role:'client'|'gui'|'human', text, at}]
  assigned_to  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists support_tickets_tenant on public.support_tickets (client_email, status, created_at desc);
create index if not exists support_tickets_queue on public.support_tickets (status, priority, created_at desc);
alter table public.support_tickets enable row level security;

-- Open a ticket (Gui Support logs every resolved interaction + every escalation).
create or replace function public.support_ticket_create(
  p_secret text, p_email text, p_subject text, p_category text, p_body text,
  p_ai_handled boolean default false, p_status text default 'open', p_kb_id text default null, p_priority text default 'normal'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  insert into support_tickets(client_email, subject, category, status, priority, ai_handled, kb_id, thread)
  values (lower(trim(p_email)), left(p_subject,200), coalesce(p_category,'other'), coalesce(p_status,'open'), coalesce(p_priority,'normal'),
          coalesce(p_ai_handled,false), p_kb_id, jsonb_build_array(jsonb_build_object('role','client','text',left(coalesce(p_body,''),2000),'at',now())))
  returning id into v_id;
  return v_id;
end $$;

-- Append a message to a ticket's thread.
create or replace function public.support_ticket_reply(p_secret text, p_id uuid, p_role text, p_text text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  update support_tickets set thread = thread || jsonb_build_object('role', coalesce(p_role,'gui'), 'text', left(coalesce(p_text,''),2000), 'at', now()), updated_at = now()
  where id = p_id;
  return found;
end $$;

-- Resolve / escalate a ticket.
create or replace function public.support_ticket_set(p_secret text, p_id uuid, p_status text, p_resolution text default null, p_assigned text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  update support_tickets set status = coalesce(p_status,status), resolution = coalesce(p_resolution,resolution), assigned_to = coalesce(p_assigned,assigned_to), updated_at = now()
  where id = p_id;
  return found;
end $$;

-- CLIENT: list my tickets.  ADMIN/BROTO: pass p_email = '' to list the WHOLE queue across tenants.
create or replace function public.support_ticket_list(p_secret text, p_email text, p_limit int default 200)
returns table(id uuid, client_email text, subject text, category text, status text, priority text, ai_handled boolean, resolution text, thread jsonb, assigned_to text, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query
    select t.id, t.client_email, t.subject, t.category, t.status, t.priority, t.ai_handled, t.resolution, t.thread, t.assigned_to, t.created_at, t.updated_at
    from support_tickets t
    where (coalesce(trim(p_email),'') = '' or t.client_email = lower(trim(p_email)))
    order by (t.status in ('open','escalated','resolving')) desc, t.priority = 'urgent' desc, t.created_at desc
    limit greatest(1, least(p_limit, 1000));
end $$;

grant execute on function public.support_ticket_create(text,text,text,text,text,boolean,text,text,text) to anon;
grant execute on function public.support_ticket_reply(text,uuid,text,text) to anon;
grant execute on function public.support_ticket_set(text,uuid,text,text,text) to anon;
grant execute on function public.support_ticket_list(text,text,int) to anon;

-- ── BROTO inventory: our stock of numbers / hardware / accounts / integrations ──
create table if not exists public.platform_inventory (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,                         -- number | hardware | account | integration
  label        text not null,
  status       text not null default 'available',      -- available | assigned | inactive
  assigned_to  text,                                  -- client_email it's allocated to
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists platform_inventory_kind on public.platform_inventory (kind, status);
alter table public.platform_inventory enable row level security;

create or replace function public.inventory_upsert(p_secret text, p_id uuid, p_kind text, p_label text, p_status text, p_assigned text default null, p_meta jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  if p_id is not null then
    update platform_inventory set kind=coalesce(p_kind,kind), label=coalesce(p_label,label), status=coalesce(p_status,status), assigned_to=p_assigned, meta=coalesce(p_meta,meta), updated_at=now() where id=p_id returning id into v_id;
    if v_id is not null then return v_id; end if;
  end if;
  insert into platform_inventory(kind,label,status,assigned_to,meta) values (coalesce(p_kind,'number'), p_label, coalesce(p_status,'available'), p_assigned, coalesce(p_meta,'{}'::jsonb)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.inventory_list(p_secret text, p_limit int default 500)
returns table(id uuid, kind text, label text, status text, assigned_to text, meta jsonb, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query select i.id, i.kind, i.label, i.status, i.assigned_to, i.meta, i.updated_at from platform_inventory i order by i.kind, i.status, i.label limit greatest(1, least(p_limit, 2000));
end $$;

grant execute on function public.inventory_upsert(text,uuid,text,text,text,text,jsonb) to anon;
grant execute on function public.inventory_list(text,int) to anon;

-- ✅ Done. /api/support powers Gui Suporte (client) + BROTO (admin). Tickets + inventory are live.
