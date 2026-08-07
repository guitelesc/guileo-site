-- ═════════════════════════════════════════════════════════════════════════════
-- returns_breakdown_window — split the money that came BACK into refunds vs disputes
-- (chargebacks). Both are ledgered by stripe-webhook.js as type='refund' negative rows,
-- distinguished by payload->>'kind' ('dispute' vs 'refund'/null). Read-only reporting,
-- INGEST-gated, tenant-scoped, amount-anchored (positive cents). Feeds the cockpit Timeline
-- with two honest lines instead of one lump. A dispute is worse than a refund (money clawed
-- back + a fee + a trust hit), so the Timeline shows it separately.
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.returns_breakdown_window(
  p_secret text, p_email text, p_since timestamptz default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_ref_cents bigint := 0; v_ref_count int := 0;
  v_dis_cents bigint := 0; v_dis_count int := 0;
  v_since timestamptz := coalesce(p_since, now() - interval '30 days');
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_email is null or p_email = '' then raise exception 'email required' using errcode = '22023'; end if;
  begin
    select
      coalesce(round(sum(abs(amount)) filter (where coalesce(payload->>'kind','refund') <> 'dispute') * 100)::bigint, 0),
      coalesce(count(*)              filter (where coalesce(payload->>'kind','refund') <> 'dispute'), 0),
      coalesce(round(sum(abs(amount)) filter (where payload->>'kind' = 'dispute') * 100)::bigint, 0),
      coalesce(count(*)              filter (where payload->>'kind' = 'dispute'), 0)
      into v_ref_cents, v_ref_count, v_dis_cents, v_dis_count
      from public.client_events
     where lower(client_email) = lower(p_email)
       and type = 'refund'
       and created_at >= v_since;
  exception when others then
    return jsonb_build_object('ready', false, 'reason', 'client_events unavailable');
  end;
  return jsonb_build_object(
    'ready', true,
    'refund_cents', v_ref_cents, 'refund_count', v_ref_count,
    'dispute_cents', v_dis_cents, 'dispute_count', v_dis_count,
    'total_cents', v_ref_cents + v_dis_cents, 'since', v_since
  );
end $$;

grant execute on function public.returns_breakdown_window(text, text, timestamptz) to anon;
