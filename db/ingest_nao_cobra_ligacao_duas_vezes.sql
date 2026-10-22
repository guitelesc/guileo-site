-- LIGAÇÃO COBRADA DUAS VEZES (2026-09-09, aplicado por MCP no mesmo dia)
-- `ingest_client_event` descontava 5 créditos por evento `call` POR DENTRO, sem linha em
-- credit_usage. Em 20/08 o Luis decidiu medir ligação com `consumir_creditos` (razão + alarme
-- cruzou_zero) — e o medidor escondido continuou vivo. Resultado: toda ligação custava 10 e a
-- página de preço diz 5. Descoberto porque o chat pelo agente (Chat Mode) passou pelo mesmo
-- webhook e 8 testes tiraram 84 créditos do Natura (estornados, evento f23b3e26).
-- Aqui `call` sai do medidor escondido. O resto (message 2 / reminder 3 / followup 5 / winback 5
-- / review 2 / blitz 4) FICA: é o modelo de crédito por tarefa — mudar isso é preço, decisão do dono.
create or replace function public.ingest_client_event(p_secret text, p_email text, p_type text, p_channel text, p_summary text, p_amount numeric, p_payload jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_cost int;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  insert into client_events (client_email, type, channel, summary, amount, payload)
  values (lower(trim(p_email)), p_type, coalesce(p_channel,''), coalesce(p_summary,''), coalesce(p_amount,0), coalesce(p_payload,'{}'::jsonb))
  returning id into v_id;
  v_cost := case lower(coalesce(p_type,''))
    when 'call' then 0  -- medido por consumir_creditos (com razão); aqui era a 2ª cobrança
    when 'message' then 2 when 'reminder' then 3
    when 'followup' then 5 when 'winback' then 5 when 'review' then 2 when 'blitz' then 4 else 0 end;
  if v_cost > 0 then
    update client_credits set credits = greatest(0, credits - v_cost),
        depleted_at = case when credits - v_cost <= 0 and depleted_at is null then now() else depleted_at end, updated_at = now()
      where client_email = lower(trim(p_email));
  end if;
  return v_id;
end $$;
