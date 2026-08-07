-- ═════════════════════════════════════════════════════════════════════════════
-- refund_total_window — REAL refunds/returns for one tenant in a window. Read-only
-- reporting (never mutates money), INGEST-gated, tenant-scoped. Feeds the cockpit
-- Timeline's "risco de retorno" stage with an ANCHORED number instead of an estimate.
-- Refunds are ledgered as NEGATIVE amounts in client_events (money_guardrails net); we
-- return the positive magnitude in cents (amount-anchored law).
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.refund_total_window(
  p_secret text, p_email text, p_since timestamptz default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_cents bigint := 0;
  v_count int := 0;
  v_since timestamptz := coalesce(p_since, now() - interval '30 days');
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_email is null or p_email = '' then raise exception 'email required' using errcode = '22023'; end if;
  begin
    select coalesce(round(sum(abs(amount)) * 100)::bigint, 0), count(*)
      into v_cents, v_count
      from public.client_events
     where lower(client_email) = lower(p_email)
       and type = 'refund'
       and created_at >= v_since;
  exception when others then
    return jsonb_build_object('ready', false, 'reason', 'client_events unavailable', 'cents', 0, 'count', 0);
  end;
  return jsonb_build_object('ready', true, 'cents', v_cents, 'count', v_count, 'since', v_since);
end $$;

grant execute on function public.refund_total_window(text, text, timestamptz) to anon;

-- Prove:
--   select public.refund_total_window('glo_ing_c7f2a9e4b8d16350','natura@guileoai.com');  -- {ready:true,cents:N,count:M}
--   select public.refund_total_window('wrong','x@y.com');                             -- ERROR 28000 (gate)
