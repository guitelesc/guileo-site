-- ─────────────────────────────────────────────────────────────────────────────
-- SELLER CONVERSIONS — the TRUTHFUL commission signal for the /vendedor hub.
-- A seller's ?ref= leads land in gui_actions (action='lead', details contains '👤ref:<ref>',
-- contact = the lead's email). A lead CONVERTED when that same email later shows up in
-- client_events with type 'payment' (the Stripe webhook ingests those). This RPC joins the
-- two and returns { converted, paid } so /api/seller-stats can compute EARNED commission
-- (pct × real payments) instead of guessing. READ-only, INGEST-gated.
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, account smart@guileoai.com).
-- Until pasted, /api/seller-stats gracefully falls back to a clearly-labeled "potential
-- commission" estimate (never presented as earned money).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.seller_conversions(p_secret text, p_ref text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if coalesce(trim(p_ref), '') = '' then return json_build_object('converted', 0, 'paid', 0); end if;
  return (
    with leads as (
      -- path 1: lead forms that carried 👤ref:<ref> (Growth Partner links)
      select distinct lower(trim(g.contact)) as email
      from gui_actions g
      where g.action = 'lead'
        and g.contact like '%@%'
        and substring(g.details from '👤ref:([^\s·]+)') = trim(p_ref)
      union
      -- path 2: checkouts that carried client_reference_id=<ref> — the seller's
      -- payment-link hand-off writes an 'attribution' client_event on the new tenant
      select distinct lower(trim(e2.client_email)) as email
      from client_events e2
      where e2.type = 'attribution'
        and e2.payload->>'seller_ref' = trim(p_ref)
    ),
    pays as (
      select e.client_email, sum(coalesce(e.amount, 0)) as paid
      from client_events e
      join leads l on lower(trim(e.client_email)) = l.email
      where e.type = 'payment'
      group by e.client_email
    )
    select json_build_object(
      'converted', (select count(*) from pays),
      'paid', coalesce((select sum(paid) from pays), 0)
    )
  );
end
$$;

grant execute on function public.seller_conversions(text, text) to anon;

-- ✅ Done. The /vendedor "💰 Comissões" card flips from "potencial (estimativa)" to real
--    earned commission (SELLER_COMMISSION_PCT% of registered payments) automatically.
