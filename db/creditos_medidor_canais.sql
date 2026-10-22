-- db/creditos_medidor_canais.sql — 2026-09-27 · aprovado pelo Luis ("adota a tarifa da tabela e liga o medidor")
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- 1) O MEDIDOR ESCONDIDO PARA DE COBRAR MENSAGEM. `ingest_client_event` descontava 2 créditos por
--    evento `message`, sem recibo: uma troca de WhatsApp custava 4, uma de SMS 6, e cada "não
--    entregue" mais 2 — enquanto a tabela vendida (CREDIT_COST) diz chat=2, sms=1. Agora mensagem é
--    medida por `consumir_creditos` (functions/lib/creditos.js), com linha em credit_usage.
--    reminder/followup/winback/review/blitz ficam como estavam (ainda sem medidor próprio).
-- 2) `consumir_creditos` VIRA ATÔMICA. Antes: exists → update → insert. Duas entregas simultâneas da
--    mesma ref passavam as duas pelo `exists` e cobravam duas vezes. Agora o INSERT da ref vem
--    primeiro (on conflict do nothing): quem perdeu a corrida recebe `repetido` sem tocar no saldo.
-- Idempotente. Assinaturas e grants inalterados (create or replace preserva).

create or replace function public.ingest_client_event(p_secret text, p_email text, p_type text, p_channel text, p_summary text, p_amount numeric, p_payload jsonb)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid; v_cost int;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  insert into client_events (client_email, type, channel, summary, amount, payload)
  values (lower(trim(p_email)), p_type, coalesce(p_channel,''), coalesce(p_summary,''), coalesce(p_amount,0), coalesce(p_payload,'{}'::jsonb))
  returning id into v_id;
  v_cost := case lower(coalesce(p_type,''))
    when 'call' then 0     -- medido por consumir_creditos (com razão); aqui era a 2ª cobrança
    when 'message' then 0  -- idem desde 2026-09-27: medido por functions/lib/creditos.js, com recibo
    when 'reminder' then 3
    when 'followup' then 5 when 'winback' then 5 when 'review' then 2 when 'blitz' then 4 else 0 end;
  if v_cost > 0 then
    update client_credits set credits = greatest(0, credits - v_cost),
        depleted_at = case when credits - v_cost <= 0 and depleted_at is null then now() else depleted_at end, updated_at = now()
      where client_email = lower(trim(p_email));
  end if;
  return v_id;
end $function$;

create or replace function public.consumir_creditos(p_secret text, p_email text, p_credits integer, p_kind text default 'call'::text, p_ref text default null::text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_tenant text := lower(trim(coalesce(p_email,'')));
  v_want   int  := greatest(0, coalesce(p_credits, 0));
  v_ref    text := nullif(trim(coalesce(p_ref,'')), '');
  v_antes  int; v_depois int; v_interno boolean; v_linhas int;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  if v_tenant = '' then return jsonb_build_object('ok', false, 'motivo', 'sem tenant'); end if;

  select credits, coalesce(internal,false) into v_antes, v_interno
    from client_credits where client_email = v_tenant;
  if v_antes is null then
    return jsonb_build_object('ok', false, 'motivo', 'cliente sem linha de credito');
  end if;
  -- Conta interna (simulação, demo, modelo) não consome: contá-la sujaria a métrica honesta.
  if v_interno then
    return jsonb_build_object('ok', true, 'interno', true, 'saldo', v_antes, 'cobrado', 0);
  end if;

  -- A REF ENTRA PRIMEIRO. O índice único decide quem cobra: a segunda entrega simultânea não insere
  -- (`v_linhas = 0`) e sai como repetida, sem tocar no saldo.
  if v_ref is not null then
    insert into credit_usage (ref, client_email, credits, kind)
    values (v_ref, v_tenant, v_want, coalesce(p_kind,'call')) on conflict (ref) do nothing;
    get diagnostics v_linhas = row_count;
    if v_linhas = 0 then
      return jsonb_build_object('ok', true, 'repetido', true, 'saldo', v_antes, 'cobrado', 0);
    end if;
  end if;

  update client_credits
     set credits = credits - v_want,             -- 👈 PODE FICAR NEGATIVO, de propósito
         updated_at = now(),
         depleted_at = case when credits > 0 and credits - v_want <= 0 then now() else depleted_at end
   where client_email = v_tenant
  returning credits + v_want, credits into v_antes, v_depois;

  return jsonb_build_object(
    'ok', true, 'saldo', v_depois, 'cobrado', v_want, 'antes', v_antes,
    'cruzou_zero', (v_antes > 0 and v_depois <= 0),
    'negativo', (v_depois < 0));
end $function$;

insert into platform_settings(key, value, updated_at) values ('creditos_canais', 'on', now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
