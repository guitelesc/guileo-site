-- ============================================================================
-- Guileo · COMPANY OS — RECEIVABLES: "A receber" — Gui collects overdue invoices politely
-- (paste AFTER db/crm_finance.sql, in Supabase → SQL Editor → Run). INGEST-gated.
-- Adds a pay_link + nudge memory to crm_invoices, a "what's overdue" read for the
-- collections engine, and an ATOMIC 72h dedup marker so the same invoice is never
-- nudged twice in one window — even if two runs race.
-- ============================================================================

-- pay_link: when Gui's close&collect minted a payment link for this invoice, the
-- reminder reuses it. nudged_at: when we last reminded this customer (72h dedup).
alter table public.crm_invoices add column if not exists pay_link text;
alter table public.crm_invoices add column if not exists nudged_at timestamptz;

-- Everything overdue for the tenant: sent + past due (or already flagged overdue),
-- joined to the contact so the engine knows WHO to text and whether it MAY (consent).
create or replace function public.finance_overdue_list(p_secret text, p_email text, p_limit int default 100)
returns table(
  id uuid, contact_id uuid, contact_name text, phone text, consent_sms boolean,
  number text, amount_cents bigint, due_at timestamptz, days_late int,
  pay_link text, nudged_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select i.id, i.contact_id, c.full_name, c.phone, coalesce(c.consent_sms, true),
      i.number, i.amount_cents, i.due_at,
      greatest(0, extract(day from now() - i.due_at))::int as days_late,
      i.pay_link, i.nudged_at
    -- tenant-bound JOIN: um contact_id de outro tenant vira NULL (⇒ skip "no phone")
    -- em vez de vazar nome+telefone e mandar cobrança pro cliente de outro negócio
    from crm_invoices i left join crm_contacts c
      on c.id = i.contact_id and c.client_email = i.client_email
    where i.client_email = lower(trim(p_email))
      and i.status in ('sent','overdue')
      and i.due_at is not null and i.due_at < now()
    order by i.due_at asc
    limit greatest(1, least(p_limit, 500));
end $$;

-- ATOMIC dedup claim: returns true (and stamps nudged_at) ONLY when this invoice
-- hasn't been nudged in the last 72h AND is still overdue. The engine calls this
-- BEFORE sending — a false means "someone already reminded them, stay polite, skip".
create or replace function public.finance_mark_nudged(p_secret text, p_email text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update crm_invoices i
     set nudged_at = now(), updated_at = now()
   where i.id = p_id
     and i.client_email = lower(trim(p_email))
     and i.status in ('sent','overdue')
     and i.due_at is not null and i.due_at < now()
     and (i.nudged_at is null or i.nudged_at < now() - interval '72 hours')
  returning i.id into v_id;
  return v_id is not null;
end $$;

-- BAIXA da fatura: sem transição para 'paid', o motor re-nudgaria a cada 72h um cliente
-- que JÁ PAGOU (assédio). Chamada pelo cockpit ("marcar paga") e por futuros webhooks.
alter table public.crm_invoices add column if not exists paid_at timestamptz;
create or replace function public.finance_mark_paid(p_secret text, p_email text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update crm_invoices i
     set status = 'paid', paid_at = now(), updated_at = now()
   where i.id = p_id
     and i.client_email = lower(trim(p_email))
     and i.status in ('sent','overdue')
  returning i.id into v_id;
  return v_id is not null;
end $$;

grant execute on function public.finance_overdue_list(text,text,int) to anon;
grant execute on function public.finance_mark_nudged(text,text,uuid) to anon;
grant execute on function public.finance_mark_paid(text,text,uuid) to anon;

-- ✅ Done. /api/collections action:"list" reads finance_overdue_list; action:"nudge" claims
--    finance_mark_nudged per invoice then sends the reminder → the Cockpit "💳 A receber" block.
