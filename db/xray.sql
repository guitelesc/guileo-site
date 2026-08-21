-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- GUILEO X-RAY PÚBLICO (/raio-x) — o serviço da call de 15 min + o funil para o /admin
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Contexto: functions/api/raio-x.js já FUNCIONA sem este arquivo. Ele grava a avaliação em
-- business_evaluations (db/avaliacao.sql, já aplicado) e o lead pelo /api/lead. Este SQL faz duas
-- coisas que MELHORAM o que já roda — nenhuma delas é pré-requisito:
--
--   1) O SERVIÇO DE 15 MINUTOS. Hoje a call cai no "Guileo Demo" (30 min) porque é o único serviço
--      cadastrado no tenant da Guileo. A página promete 15 minutos; enquanto o serviço de 15 não
--      existir, o endpoint usa o que existe e a tela mostra a duração REAL devolvida pelo motor —
--      prometer 15 e reservar 30 seria a primeira mentira do relacionamento.
--   2) O FUNIL, para o /admin: pedidos → X-Rays gerados → calls marcadas → virou cliente.
--      Sem tabela nova: lê business_evaluations + gui_actions + biz_appointments, que já existem.
--      O que ainda não dá para medir aparece como NULL (não medido), nunca como 0 — é a mesma lei
--      da página que este funil mede.
--
-- Aplicar via MCP (apply_migration). Idempotente: roda 2x sem dor. NÃO foi aplicado ainda.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1) O SERVIÇO DA CALL (dado do tenant da própria Guileo — a Guileo rodando na Guileo) ───────
-- Cria "Guileo X-Ray (15 min)" e liga no profissional/unidade que já existem. Sem duplicar: o
-- insert é condicionado à ausência do nome. Ajuste o e-mail se o OWNER_EMAIL do Cloudflare mudar.
do $$
declare v_email text := 'smart@guileoai.com'; v_svc uuid; v_pro uuid; v_loc uuid;
begin
  select id into v_svc from biz_services where client_email = v_email and name = 'Guileo X-Ray (15 min)';
  if v_svc is null then
    insert into biz_services (client_email, name, duration_min, price_cents, active)
    values (v_email, 'Guileo X-Ray (15 min)', 15, 0, true)
    returning id into v_svc;
  end if;

  select id into v_pro from biz_professionals where client_email = v_email and active order by created_at limit 1;
  select id into v_loc from biz_locations     where client_email = v_email and active order by created_at limit 1;

  -- vínculo profissional↔serviço: sem ele o biz_availability não devolve vaga NENHUMA para o
  -- serviço novo, e a tela mostraria "sem horário" com a agenda cheia.
  if v_pro is not null and v_svc is not null then
    begin
      insert into biz_pro_services (pro_id, service_id) values (v_pro, v_svc) on conflict do nothing;
    exception when undefined_table then
      -- esquema mais antigo guarda os serviços num array na própria linha do profissional
      begin
        update biz_professionals set services = (select array_agg(distinct x) from unnest(coalesce(services,'{}'::uuid[]) || v_svc) x)
        where id = v_pro;
      exception when undefined_column then null; end;
    end;
  end if;
  perform v_loc; -- unidade única: o motor resolve sozinho; a variável fica para conferência manual
end $$;

-- ── 2) O FUNIL DO GUILEO X-RAY (para o /admin) ─────────────────────────────────────────────────
-- Gate: senha do /admin (_admin_ok), o mesmo portão das outras ações administrativas.
-- Janela em dias (padrão 30). Devolve os números do funil + as últimas linhas para a lista.
create or replace function public.xray_funil(p_token text, p_dias integer default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ok boolean; desde timestamptz := now() - make_interval(days => greatest(1, coalesce(p_dias,30)));
  v_gerados int; v_abertos int; v_leads int; v_calls int := null; v_clientes int := null;
  v_linhas jsonb := '[]'::jsonb;
begin
  select public._admin_ok(p_token) into ok;
  if ok is not true then return jsonb_build_object('error','unauthorized'); end if;

  -- X-Rays PEDIDOS PELO PRÓPRIO DONO: seller = 'raio-x-publico' é a marca que o endpoint grava.
  select count(*), count(*) filter (where aberto_em is not null)
    into v_gerados, v_abertos
    from business_evaluations where seller = 'raio-x-publico' and created_at >= desde;

  -- LEADS que entraram pelo funil da rota pública (a mesma porta /api/lead do resto do site).
  begin
    select count(*) into v_leads from gui_actions
     where source = 'raio-x' and created_at >= desde;
  exception when undefined_table then v_leads := null; end;

  -- CALLS marcadas na agenda da Guileo na mesma janela. ⚠️ Ainda NÃO dá para dizer que esta call
  -- veio do X-Ray: o agendamento não guarda a origem. Por isso o número sai rotulado como
  -- "todas as calls da agenda da Guileo", e não como conversão do funil — atribuir sem lastro
  -- aqui seria inventar exatamente o tipo de número que o relatório existe para não inventar.
  begin
    select count(*) into v_calls from biz_appointments
     where client_email = 'smart@guileoai.com' and created_at >= desde and status in ('booked','confirmed');
  exception when undefined_table then v_calls := null; end;

  -- FECHADOS: quantos desses domínios viraram cliente pagante. Não há hoje ligação entre o
  -- domínio pedido e a conta criada → NÃO MEDIDO. Fica null de propósito, com o motivo escrito.
  v_clientes := null;

  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) into v_linhas
  from (
    select jsonb_build_object(
      'id', id, 'site', site, 'business', business, 'score', score,
      'contato', contato, 'created_at', created_at, 'aberto_em', aberto_em
    ) as x
    from business_evaluations
    where seller = 'raio-x-publico' and created_at >= desde
    order by created_at desc limit 100
  ) t;

  return jsonb_build_object(
    'ok', true, 'dias', greatest(1, coalesce(p_dias,30)),
    'xrays_gerados', v_gerados,
    'xrays_abertos', v_abertos,                 -- o dono clicou no link = interesse real
    'leads_no_funil', v_leads,
    'calls_agenda_guileo', v_calls,
    'calls_atribuidas_ao_xray', null,           -- não medido: o agendamento não guarda a origem
    'virou_cliente', v_clientes,                -- não medido: falta ligar domínio → conta paga
    'nao_medido', jsonb_build_array(
      'calls_atribuidas_ao_xray: biz_appointments não guarda de qual origem veio a marcação',
      'virou_cliente: não existe ligação entre o domínio do X-Ray e a conta criada'
    ),
    'linhas', v_linhas
  );
end $$;

grant execute on function public.xray_funil(text,integer) to anon;

-- PROVA (depois de aplicar):
--   select public.xray_funil('senha-errada');            -- → {"error":"unauthorized"}
--   select jsonb_pretty(public.xray_funil('<senha do /admin>', 30));
--   select name, duration_min from biz_services where client_email='smart@guileoai.com';
--     -- → deve listar "Guileo X-Ray (15 min)"
--   curl -s -X POST https://guileoai.com/api/raio-x -H 'Content-Type: application/json' \
--        -H 'Origin: https://guileoai.com' -d '{"acao":"horarios"}'
--     -- → "servico":"Guileo X-Ray (15 min)"
