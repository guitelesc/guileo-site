-- ============================================================================
-- Guileo · COMPANY OS — FINANCE department: invoices + A/R + cash-flow
-- (paste AFTER db/crm_phase2.sql, in Supabase → SQL Editor → Run). Gated by _gui_sched_ok.
-- ============================================================================

create table if not exists public.crm_invoices (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  contact_id   uuid references public.crm_contacts(id),
  deal_id      uuid references public.crm_deals(id),
  number       text,
  amount_cents bigint not null default 0,
  status       text not null default 'draft',   -- draft | sent | paid | overdue | void
  due_at       timestamptz,
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists crm_invoices_tenant on public.crm_invoices (client_email, status, due_at);
create index if not exists crm_invoices_contact on public.crm_invoices (contact_id);
alter table public.crm_invoices enable row level security;

-- Create / advance an invoice. Gui's close&collect opens one and marks it paid on payment.
create or replace function public.crm_invoice_upsert(
  p_secret text, p_email text, p_contact_id uuid, p_amount_cents bigint,
  p_status text default 'sent', p_due_at timestamptz default null, p_number text default null, p_deal_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  if p_contact_id is not null and not exists (
    select 1 from crm_contacts c where c.id = p_contact_id and c.client_email = lower(trim(p_email))
  ) then raise exception 'contact not in tenant'; end if;
  insert into crm_invoices(client_email, contact_id, deal_id, number, amount_cents, status, due_at, paid_at)
  values (lower(trim(p_email)), p_contact_id, p_deal_id, p_number, greatest(coalesce(p_amount_cents,0),0),
          coalesce(p_status,'sent'), p_due_at, case when p_status = 'paid' then now() else null end)
  returning id into v_id;
  return v_id;
end $$;

-- List invoices for the A/R view (flags overdue at read time: sent + past due).
create or replace function public.crm_invoices_list(p_secret text, p_email text, p_limit int default 300)
returns table(id uuid, contact_id uuid, contact_name text, number text, amount_cents bigint, status text, due_at timestamptz, paid_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query
    select i.id, i.contact_id, c.full_name, i.number, i.amount_cents,
      case when i.status = 'sent' and i.due_at is not null and i.due_at < now() then 'overdue' else i.status end as status,
      i.due_at, i.paid_at, i.created_at
    from crm_invoices i left join crm_contacts c on c.id = i.contact_id and c.client_email = i.client_email
    where i.client_email = lower(trim(p_email))
    order by (i.status in ('sent','overdue')) desc, coalesce(i.due_at, i.created_at) asc
    limit greatest(1, least(p_limit, 1000));
end $$;

grant execute on function public.crm_invoice_upsert(text,text,uuid,bigint,text,timestamptz,text,uuid) to anon;
grant execute on function public.crm_invoices_list(text,text,int) to anon;

-- ✅ Done. /api/crm action:"invoices" reads crm_invoices_list → the Cockpit Finance A/R board.
