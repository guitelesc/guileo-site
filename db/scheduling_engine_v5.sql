-- GUILEO MOTOR v5 — clientes + fidelidade (#5) e lista de espera (#10). Aditivo. Mesmo gate.

-- #5 — CLIENTES (identidade + pontos + última visita) — a âncora de retenção e de churn
create table if not exists biz_customers (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,            -- o negócio dono
  contact text not null,                 -- telefone/email do CLIENTE final
  name text,
  points int not null default 0,
  visits int not null default 0,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (client_email, contact)
);
create index if not exists idx_biz_customers_email on biz_customers(client_email, last_seen desc);
alter table biz_customers enable row level security;

-- upsert + pontos/visita (chamado pelo book). Pontos: +10 por visita por padrão.
create or replace function biz_customer_touch(
  p_secret text, p_email text, p_contact text, p_name text default null, p_points int default 10, p_visit boolean default true
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_points int; v_visits int;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  if coalesce(p_contact,'')='' then return jsonb_build_object('ok',false); end if;
  insert into biz_customers(client_email,contact,name,points,visits,last_seen)
    values (p_email,p_contact,p_name,greatest(p_points,0),case when p_visit then 1 else 0 end, now())
  on conflict (client_email,contact) do update
    set points = biz_customers.points + greatest(p_points,0),
        visits = biz_customers.visits + (case when p_visit then 1 else 0 end),
        name = coalesce(excluded.name, biz_customers.name),
        last_seen = now()
  returning points, visits into v_points, v_visits;
  return jsonb_build_object('ok',true,'points',v_points,'visits',v_visits);
end $$;

-- consulta pontos de um cliente (o Gui responde "você tem X pontos")
create or replace function biz_customer_points(p_secret text, p_email text, p_contact text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select jsonb_build_object('points',points,'visits',visits,'name',name) into v
    from biz_customers where client_email=p_email and contact=p_contact;
  return coalesce(v, jsonb_build_object('points',0,'visits',0));
end $$;

-- clientes inativos (pro churn-save do cron): sem visita há >= p_days
create or replace function biz_dormant_customers(p_secret text, p_email text, p_days int default 60, p_limit int default 50)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('contact',contact,'name',name,'last_seen',last_seen,'visits',visits) order by last_seen asc),'[]'::jsonb)
    into v from biz_customers
    where client_email=p_email and last_seen < now() - (p_days||' days')::interval
    limit p_limit;
  return jsonb_build_object('dormant', coalesce(v,'[]'::jsonb));
end $$;

-- #10 — LISTA DE ESPERA (preenche vaga de cancelamento)
create table if not exists biz_waitlist (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  service_id uuid references biz_services(id) on delete cascade,
  location_id uuid references biz_locations(id) on delete set null,
  contact text not null, name text,
  created_at timestamptz not null default now(),
  notified boolean not null default false
);
create index if not exists idx_biz_waitlist on biz_waitlist(client_email, service_id) where not notified;
alter table biz_waitlist enable row level security;

create or replace function biz_waitlist_add(p_secret text, p_email text, p_service_id uuid, p_location_id uuid, p_contact text, p_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  insert into biz_waitlist(client_email,service_id,location_id,contact,name)
    values (p_email,p_service_id,p_location_id,p_contact,p_name) returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end $$;

-- quem chamar quando abrir vaga (mesmo serviço, opcional mesma unidade) — o cron usa isto
create or replace function biz_waitlist_next(p_secret text, p_email text, p_service_id uuid, p_location_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select jsonb_build_object('id',id,'contact',contact,'name',name) into v from biz_waitlist
    where client_email=p_email and service_id=p_service_id and not notified
      and (p_location_id is null or location_id is null or location_id=p_location_id)
    order by created_at asc limit 1;
  if v is not null then update biz_waitlist set notified=true where id=(v->>'id')::uuid; end if;
  return coalesce(v, jsonb_build_object('empty',true));
end $$;

-- lembretes: agendamentos nas próximas p_hours horas que ainda não foram lembrados
alter table biz_appointments add column if not exists reminded boolean not null default false;
create or replace function biz_due_reminders(p_secret text, p_email text, p_hours int default 24, p_limit int default 50)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'contact',a.customer_contact,'name',a.customer_name,'service',s.name,'when',lower(a.span),'ref',a.ref) order by lower(a.span)),'[]'::jsonb)
    into v from biz_appointments a left join biz_services s on s.id=a.service_id
    where a.client_email=p_email and a.status='booked' and not a.reminded
      and lower(a.span) between now() and now() + (p_hours||' hours')::interval;
  update biz_appointments set reminded=true
    where client_email=p_email and status='booked' and not reminded
      and lower(span) between now() and now() + (p_hours||' hours')::interval;
  return jsonb_build_object('due', coalesce(v,'[]'::jsonb));
end $$;
