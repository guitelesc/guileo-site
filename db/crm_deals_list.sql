-- ============================================================================
-- Guileo · COMPANY OS — CRM deals list (read RPC for the Cockpit pipeline board)
-- (paste AFTER db/crm_phase2.sql, in Supabase → SQL Editor → Run). Gated by _gui_sched_ok.
-- crm_phase2 created crm_deals + crm_deal_upsert (write); this adds the read the board needs.
-- ============================================================================

create or replace function public.crm_deals_list(p_secret text, p_email text, p_limit int default 300)
returns table(
  id uuid, contact_id uuid, contact_name text, title text,
  value_cents bigint, stage text, status text, source text, updated_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query
    select d.id, d.contact_id, c.full_name, d.title, d.value_cents, d.stage, d.status, d.source, d.updated_at
    from crm_deals d
    left join crm_contacts c on c.id = d.contact_id
    where d.client_email = lower(trim(p_email))
    order by (d.status = 'open') desc, d.updated_at desc
    limit greatest(1, least(p_limit, 1000));
end $$;

grant execute on function public.crm_deals_list(text,text,int) to anon;

-- ✅ Done. /api/crm action:"deals" reads crm_deals_list → the Cockpit pipeline board (inquiry→quoted→booked→won/lost).
