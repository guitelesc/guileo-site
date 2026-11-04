-- PROVA do desk_v17 (adicionais no /agendar) na conta e2e-test — TUDO DESFEITO no fim.
-- Rodar numa aba SEPARADA, DEPOIS do desk_v17_adicionais_site.sql dar "aplicado = t" (e a NOTICE "disponibilidade
-- idêntica antes e depois"). Resultado esperado: ERRO que começa com "PROVA (desfeita): 8/8 ok".

do $t$
begin
  if to_regprocedure('public.biz_availability_x(text,text,uuid,uuid,uuid,integer,integer,integer)') is null then
    raise exception 'PROVA NÃO RODOU: o desk_v17_adicionais_site.sql não está no banco. Rode-o SOZINHO numa aba e confira "aplicado = t"; depois rode esta prova noutra aba.';
  end if;
  if (select xmin from pg_proc where oid = to_regprocedure('public.biz_availability_x(text,text,uuid,uuid,uuid,integer,integer,integer)')) = pg_current_xact_id()::xid then
    raise exception 'PROVA NÃO RODOU e NADA FOI APLICADO: o desk_v17_adicionais_site.sql e esta prova estão na mesma execução. Rode o arquivo SOZINHO numa aba (tem de dar "aplicado = t") e a prova noutra aba.';
  end if;
end $t$;

do $prova$
declare e text := 'e2e-test@guileoai.com'; sec text := coalesce(current_setting('app.gui_sched_secret', true), '');
        s biz_services; ad uuid; base jsonb; x jsonb; r jsonb; ok int := 0; log text := ''; b0 int; sl jsonb;
begin
  -- o segredo do motor: a configuração ou, em produção (que não a tem), o 1º literal do próprio _gui_sched_ok. Fica só nesta variável.
  if sec = '' or not coalesce(public._gui_sched_ok(sec), false) then
    sec := replace((regexp_match(pg_get_functiondef('public._gui_sched_ok(text)'::regprocedure), $r$\min\s*\(\s*'((?:[^']|'')+)'$r$, 'i'))[1], '''''', '''');
  end if;
  if sec is null or sec = '' or not coalesce(public._gui_sched_ok(sec), false) then
    raise exception 'FALHOU passo 0: não consegui obter o segredo do motor (nem app.gui_sched_secret nem literal válido no _gui_sched_ok)';
  end if;
  insert into biz_services (client_email, name, duration_min, price_cents, config, active)
    values (e, 'Prova Adicional', 10, 1500, '{"addon": true}'::jsonb, true) returning id into ad;
  -- um serviço da e2e (não adicional) que tem vaga nos próximos 14 dias
  select sv.* into s from biz_services sv
   where sv.client_email = e and coalesce(sv.active, true) and not coalesce((sv.config->>'addon')::boolean, false)
     and jsonb_array_length(coalesce(public.biz_availability(sec, e, sv.id, null, null, 14, 5)->'slots', '[]'::jsonb)) > 0
   order by sv.name limit 1;
  if s.id is null then raise exception 'FALHOU passo 0: nenhum serviço da e2e com vaga'; end if;

  -- 1. a lista do site traz o adicional ativo e nenhum serviço comum
  r := public.vitrine_addons(e);
  if not coalesce((exists (select 1 from jsonb_array_elements(r) v where (v->>'id')::uuid = ad and (v->>'duration_min')::int = 10 and (v->>'price_cents')::int = 1500)
                   and not exists (select 1 from jsonb_array_elements(r) v where (v->>'id')::uuid = s.id)), false) then raise exception 'FALHOU passo 1: %', r; end if;
  ok := ok + 1;
  -- 2. sem tempo a mais, a versão _x devolve exatamente as mesmas vagas da original
  base := public.biz_availability(sec, e, s.id, null, null, 14, 40);
  x := public.biz_availability_x(sec, e, s.id, null, null, 14, 40, 0);
  if not coalesce((base->'slots' = x->'slots'), false) then raise exception 'FALHOU passo 2'; end if;
  ok := ok + 1; log := log || ' 2.' || jsonb_array_length(base->'slots') || ' vagas';
  -- 3. com +10: toda vaga dura 10 a mais e nenhuma vaga nova aparece (só somem as que não cabem)
  x := public.biz_availability_x(sec, e, s.id, null, null, 14, 40, 10);
  if not coalesce((jsonb_array_length(x->'slots') > 0
     and not exists (select 1 from jsonb_array_elements(x->'slots') v
                      where (v->>'duration_min')::int <> (select (b->>'duration_min')::int from jsonb_array_elements(base->'slots') b
                                                            where b->>'start' = v->>'start' and b->>'pro_id' = v->>'pro_id') + 10)
     and not exists (select 1 from jsonb_array_elements(x->'slots') v
                      where not exists (select 1 from jsonb_array_elements(public.biz_availability(sec, e, s.id, null, null, 14, 300)->'slots') b
                                         where b->>'start' = v->>'start' and b->>'pro_id' = v->>'pro_id'))), false) then
    raise exception 'FALHOU passo 3: %', x->'slots'; end if;
  ok := ok + 1;
  -- 4. a configuração não vaza: depois da chamada, a original volta a dar o mesmo de antes
  if not coalesce((public.biz_availability(sec, e, s.id, null, null, 14, 40)->'slots' = base->'slots'), false) then raise exception 'FALHOU passo 4'; end if;
  ok := ok + 1;
  -- 5. segredo errado = unauthorized
  if not coalesce((public.biz_availability_x('errado', e, s.id, null, null, 14, 40, 10)->>'error' = 'unauthorized'), false) then raise exception 'FALHOU passo 5'; end if;
  ok := ok + 1;
  -- 6. marcar com o adicional numa vaga da _x: o motor soma os 10 min e grava o retrato
  sl := x->'slots'->0;
  r := public.biz_book(sec, e, (sl->>'pro_id')::uuid, (sl->>'location_id')::uuid, s.id, 'Prova Adicional', '+17185550994', (sl->>'start')::timestamptz,
                       jsonb_build_object('addons', jsonb_build_array(ad)), null, 'prova-v17-' || txid_current());
  if not coalesce((r->>'ok' = 'true' and exists (select 1 from biz_appointments a where a.id = (r->>'appointment_id')::uuid
          and extract(epoch from upper(a.span) - lower(a.span)) / 60 = (sl->>'duration_min')::int
          and jsonb_array_length(a.attributes->'addons') = 1)), false) then raise exception 'FALHOU passo 6: %', r; end if;
  ok := ok + 1; log := log || ' 6.' || (sl->>'duration_min') || 'min';
  -- 7. a vaga marcada some da disponibilidade com o adicional (o motor enxerga o tempo inteiro)
  if exists (select 1 from jsonb_array_elements(public.biz_availability_x(sec, e, s.id, null, (sl->>'pro_id')::uuid, 14, 40, 10)->'slots') v where v->>'start' = sl->>'start') then
    raise exception 'FALHOU passo 7'; end if;
  ok := ok + 1;
  -- 8. o navegador (anon) não lê a lista de adicionais direto
  if has_function_privilege('anon', 'public.vitrine_addons(text)', 'execute') then raise exception 'FALHOU passo 8'; end if;
  ok := ok + 1;
  raise exception 'PROVA (desfeita): %/8 ok ·%', ok, log;
end $prova$;
