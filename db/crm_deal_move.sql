-- ============================================================================
-- Guileo · COMPANY OS — CRM deal stage move (write RPC for the Cockpit pipeline board)
-- (paste AFTER db/crm_phase2.sql, in Supabase → SQL Editor → Run). INGEST-gated.
-- The board's "→" button advances a deal one stage (inquiry → quoted → booked → won);
-- this is the single write that powers it. Tenant-scoped: a deal can only be moved
-- by the tenant that owns it (client_email match), never across tenants.
-- ============================================================================

create or replace function public.crm_deal_move(p_secret text, p_email text, p_deal_id uuid, p_stage text)
returns table(id uuid, stage text, status text)
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_stage not in ('inquiry','quoted','booked','won','lost') then raise exception 'invalid stage'; end if;
  return query
    update crm_deals d
       set stage      = p_stage,
           status     = case when p_stage = 'won' then 'won' when p_stage = 'lost' then 'lost' else 'open' end,
           updated_at = now()
     where d.id = p_deal_id
       and d.client_email = lower(trim(p_email))
    returning d.id, d.stage, d.status;
end $$;

grant execute on function public.crm_deal_move(text,text,uuid,text) to anon;

-- ✅ Done. /api/crm action:"deal_move" calls crm_deal_move → the Cockpit pipeline "→" button.
