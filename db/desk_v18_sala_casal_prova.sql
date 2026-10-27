-- PROVA do desk_v18 (sala de casal compartilhada) na conta e2e-test — TUDO DESFEITO no fim.
-- Rodar numa aba SEPARADA, DEPOIS do desk_v18_sala_casal.sql dar "aplicado = t".
-- Resultado esperado: ERRO que começa com "PROVA (desfeita): 10/10 ok".
-- Cria só coisas de teste (3 salas, 1 serviço, 6 profissionais "Prova …"), num horário que a agenda da e2e oferece.

do $t$
begin
  if to_regprocedure('public._biz_res_livre(text,uuid,uuid,tstzrange,uuid,uuid,uuid[],uuid)') is null then
    raise exception 'PROVA NÃO RODOU: o desk_v18_sala_casal.sql não está no banco. Rode-o SOZINHO numa aba e confira "aplicado = t"; depois rode esta prova noutra aba.';
  end if;
  if (select xmin from pg_proc where oid = to_regprocedure('public._biz_res_livre(text,uuid,uuid,tstzrange,uuid,uuid,uuid[],uuid)')) = pg_current_xact_id()::xid then
    raise exception 'PROVA NÃO RODOU e NADA FOI APLICADO: o desk_v18_sala_casal.sql e esta prova estão na mesma execução. Rode o arquivo SOZINHO numa aba (tem de dar "aplicado = t") e a prova noutra aba.';
  end if;
end $t$;

do $prova$
declare e text := 'e2e-test@guileoai.com'; sec text := coalesce(current_setting('app.gui_sched_secret', true), '');
        s1 uuid; sc uuid; s2 uuid; svc uuid; p uuid[] := '{}'; i int; sl jsonb; loc uuid; t timestamptz;
        r jsonb; g jsonb; ok int := 0; log text := ''; v uuid; a1 uuid; a2 uuid; n int;
begin
  if sec = '' then raise exception 'FALHOU passo 0: sem app.gui_sched_secret nesta sessão'; end if;
  -- um horário que a e2e oferece (dia aberto), e a unidade dele
  select x into sl from biz_services sv
    cross join lateral jsonb_array_elements(coalesce(public.biz_availability(sec, e, sv.id, null, null, 14, 1)->'slots', '[]'::jsonb)) x
   where sv.client_email = e and coalesce(sv.active, true) and not coalesce((sv.config->>'addon')::boolean, false)
   order by sv.name limit 1;
  if sl is null then raise exception 'FALHOU passo 0: nenhum serviço da e2e com vaga'; end if;
  t := (sl->>'start')::timestamptz; loc := (sl->>'location_id')::uuid;
  -- salas na ordem do cadastro: Sala 1 (1 lugar), Sala Casal (3), Sala 2 (1). A de casal tem 3 de propósito: o casal
  -- deixa 1 lugar VAGO, e é esse lugar vago que prova que estranho (4) e intruso (5) não entram por não serem do grupo.
  insert into biz_professionals (client_email, name, kind, active, config) values (e, 'Prova Sala 1', 'room', true, '{}') returning id into s1;
  insert into biz_professionals (client_email, name, kind, active, config) values (e, 'Prova Sala Casal', 'room', true, '{"lugares": 3}') returning id into sc;
  insert into biz_professionals (client_email, name, kind, active, config) values (e, 'Prova Sala 2', 'room', true, '{}') returning id into s2;
  insert into biz_services (client_email, name, duration_min, active, config)
    values (e, 'Prova Massagem Casal', 60, true, jsonb_build_object('recursos', jsonb_build_array(s1, sc, s2))) returning id into svc;
  for i in 1 .. 6 loop
    insert into biz_professionals (client_email, name, kind, active, config) values (e, 'Prova P' || i, 'staff', true, '{}') returning id into v;
    p := p || v;
  end loop;

  -- 1. casal num pedido só: as duas na MESMA sala, a de casal (mesmo ela sendo a 2ª do cadastro)
  g := public.biz_book_group(sec, e, loc, jsonb_build_array(
         jsonb_build_object('pro_id', p[1], 'service_id', svc, 'name', 'Prova Casal A', 'start', t),
         jsonb_build_object('pro_id', p[2], 'service_id', svc, 'name', 'Prova Casal B', 'start', t)), '{}'::jsonb, 'prova-v18-' || txid_current());
  a1 := (g->'appointments'->0->>'appointment_id')::uuid; a2 := (g->'appointments'->1->>'appointment_id')::uuid;
  if not coalesce((g->>'ok' = 'true'
     and (select count(distinct resource_id) from biz_appointment_resources where appointment_id in (a1, a2) and released_at is null) = 1
     and (select resource_id from biz_appointment_resources where appointment_id = a1 and released_at is null) = sc
     and (select count(*) from biz_appointment_resources where appointment_id in (a1, a2) and released_at is null and grupo = (g->>'grupo')::uuid) = 2), false)
  then raise exception 'FALHOU passo 1: %', g; end if;
  ok := ok + 1;
  -- 2. o pedido de casal não deixa o grupo "ligado" para quem vier depois na transação
  if coalesce(current_setting('guileo.grupo', true), '') <> '' then raise exception 'FALHOU passo 2: guileo.grupo ficou %', current_setting('guileo.grupo', true); end if;
  ok := ok + 1;
  -- 3. pessoa sozinha no mesmo horário: Sala 1 (prefere sala de 1 lugar), nunca a de casal
  r := public.biz_book(sec, e, p[3], loc, svc, 'Prova Sozinha 1', '', t, '{}'::jsonb, null, null);
  if not coalesce((r->>'ok' = 'true' and (r->>'resource_id')::uuid = s1), false) then raise exception 'FALHOU passo 3: %', r; end if;
  ok := ok + 1;
  -- 4. outra sozinha: Sala 2. A terceira: SEM sala — a de casal tem lugar vago, mas é de um grupo que não é o dela
  r := public.biz_book(sec, e, p[4], loc, svc, 'Prova Sozinha 2', '', t, '{}'::jsonb, null, null);
  if not coalesce((r->>'ok' = 'true' and (r->>'resource_id')::uuid = s2), false) then raise exception 'FALHOU passo 4a: %', r; end if;
  r := public.biz_book(sec, e, p[5], loc, svc, 'Prova Sozinha 3', '', t, '{}'::jsonb, null, null);
  if coalesce(r->>'reason', '') <> 'resource_unavailable' then raise exception 'FALHOU passo 4b: %', r; end if;
  ok := ok + 1;
  -- 5. inventar o grupo do casal nos atributos NÃO dá lugar na sala deles (o grupo só vale vindo do biz_book_group)
  r := public.biz_book(sec, e, p[5], loc, svc, 'Prova Intrusa', '', t, jsonb_build_object('grupo', g->>'grupo'), null, null);
  if coalesce(r->>'reason', '') <> 'resource_unavailable' then raise exception 'FALHOU passo 5: %', r; end if;
  ok := ok + 1;
  -- 6. o banco também recusa, por baixo de tudo: reserva direta de estranho na sala de casal cheia
  -- (solto a reserva da sozinha 1 na Sala 1 primeiro, para a recusa vir da sala de casal e não da "1 viva por agendamento")
  update biz_appointment_resources set released_at = now()
   where released_at is null and appointment_id = (select id from biz_appointments where client_email = e and customer_name = 'Prova Sozinha 1');
  begin
    insert into biz_appointment_resources (client_email, appointment_id, resource_id, span)
      select e, a.id, sc, tstzrange(t, t + interval '60 min') from biz_appointments a where a.client_email = e and a.customer_name = 'Prova Sozinha 1';
    raise exception 'FALHOU passo 6: o banco aceitou o estranho na sala de casal';
  exception when exclusion_violation then null;
  end;
  ok := ok + 1;
  -- 7. grupo de 4, três horas depois: 3 na sala de casal (3 lugares), a 4ª numa sala de 1 lugar
  g := public.biz_book_group(sec, e, loc, jsonb_build_array(
         jsonb_build_object('pro_id', p[1], 'service_id', svc, 'name', 'Prova Grupo 1', 'start', t + interval '3 hours'),
         jsonb_build_object('pro_id', p[2], 'service_id', svc, 'name', 'Prova Grupo 2', 'start', t + interval '3 hours'),
         jsonb_build_object('pro_id', p[3], 'service_id', svc, 'name', 'Prova Grupo 3', 'start', t + interval '3 hours'),
         jsonb_build_object('pro_id', p[4], 'service_id', svc, 'name', 'Prova Grupo 4', 'start', t + interval '3 hours')), '{}'::jsonb, null);
  select count(*) filter (where z.resource_id = sc), count(*) filter (where z.resource_id = s1) into n, i
    from biz_appointment_resources z
   where z.released_at is null and z.appointment_id in (select (x->>'appointment_id')::uuid from jsonb_array_elements(g->'appointments') x);
  if not coalesce((g->>'ok' = 'true' and n = 3 and i = 1), false) then raise exception 'FALHOU passo 7: casal=% sala1=% %', n, i, g; end if;
  ok := ok + 1; log := log || ' 7.casal=' || n || '+sala1=' || i;
  -- 8. remarcar a pessoa A do casal para 6h depois: a sala nova continua sendo DO GRUPO
  update biz_appointments set span = tstzrange(t + interval '6 hours', t + interval '7 hours') where id = a1;
  if not coalesce((select grupo is not null from biz_appointment_resources where appointment_id = a1 and released_at is null), false) then
    raise exception 'FALHOU passo 8'; end if;
  ok := ok + 1;
  -- 9. remarcar a B para o mesmo horário: senta ao lado da A (mesma sala)
  update biz_appointments set span = tstzrange(t + interval '6 hours', t + interval '7 hours') where id = a2;
  if not coalesce(((select resource_id from biz_appointment_resources where appointment_id = a1 and released_at is null)
                 = (select resource_id from biz_appointment_resources where appointment_id = a2 and released_at is null)), false) then
    raise exception 'FALHOU passo 9'; end if;
  ok := ok + 1;
  -- 10. o navegador (anon) não executa a escolha de sala nem lê as reservas
  if has_function_privilege('anon', 'public._biz_res_livre(text,uuid,uuid,tstzrange,uuid,uuid,uuid[],uuid)', 'execute')
     or has_table_privilege('anon', 'public.biz_appointment_resources', 'select') then raise exception 'FALHOU passo 10'; end if;
  ok := ok + 1;
  raise exception 'PROVA (desfeita): %/10 ok ·%', ok, log;
end $prova$;
