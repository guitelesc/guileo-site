-- PROVA do desk_v16 (escolher a profissional no /agendar) na conta e2e-test — TUDO DESFEITO no fim.
-- Rodar numa aba SEPARADA, DEPOIS do desk_v16_agendar_pro.sql dar "aplicado = t". O resultado esperado é um ERRO
-- que começa com "PROVA (desfeita): 10/10 ok". Qualquer "FALHOU passo N" diz o que quebrou. Nada fica gravado.

-- TRAVA: a prova NÃO pode rodar na mesma execução do desk_v16_agendar_pro.sql — o erro final desfaria o arquivo junto.
do $t$
begin
  if to_regprocedure('public.vitrine_pros(text)') is null then
    raise exception 'PROVA NÃO RODOU: o desk_v16_agendar_pro.sql não está no banco. Rode-o SOZINHO numa aba e confira "aplicado = t"; depois rode esta prova noutra aba.';
  end if;
  if (select xmin from pg_proc where oid = to_regprocedure('public.vitrine_pros(text)')) = pg_current_xact_id()::xid then
    raise exception 'PROVA NÃO RODOU e NADA FOI APLICADO: o desk_v16_agendar_pro.sql e esta prova estão na mesma execução. Rode o arquivo SOZINHO numa aba (tem de dar "aplicado = t") e a prova noutra aba.';
  end if;
end $t$;

do $prova$
declare e text := 'e2e-test@guileoai.com'; k text; pa biz_professionals; sv uuid; svd int; r jsonb; x jsonb; ok int := 0; log text := '';
begin
  select access_key into k from client_credits where client_email = e;
  select p.* into pa from biz_professionals p
   where p.client_email = e and coalesce(p.kind, 'staff') = 'staff' and coalesce(p.active, true) and coalesce((p.config->>'online')::boolean, true)
     and exists (select 1 from biz_pro_services ps join biz_services s on s.id = ps.service_id and coalesce(s.active, true) where ps.pro_id = p.id)
   order by p.name limit 1;
  if k is null or pa.id is null then raise exception 'FALHOU passo 0: conta e2e sem chave ou sem profissional com serviço'; end if;
  select ps.service_id, s.duration_min into sv, svd from biz_pro_services ps join biz_services s on s.id = ps.service_id and coalesce(s.active, true)
   where ps.pro_id = pa.id order by s.name limit 1;

  -- 1. a lista do site traz a profissional, com o serviço e a duração DELA (a mesma régua do motor)
  r := public.vitrine_pros(e);
  x := (select v from jsonb_array_elements(r) v where (v->>'id')::uuid = pa.id);
  if not coalesce((x is not null and exists (select 1 from jsonb_array_elements(x->'services') s
            where (s->>'service_id')::uuid = sv and (s->>'duration_min')::int = (select dur from public._biz_eff(pa.id, sv)))), false) then
    raise exception 'FALHOU passo 1: %', x; end if;
  ok := ok + 1; log := log || ' 1.' || pa.name;
  -- 2. só equipe: nenhuma sala/equipamento na lista
  if exists (select 1 from jsonb_array_elements(r) v join biz_professionals p on p.id = (v->>'id')::uuid where coalesce(p.kind, 'staff') <> 'staff') then
    raise exception 'FALHOU passo 2: sala na lista'; end if;
  ok := ok + 1;
  -- 3. nunca contato nem pagamento: só id, nome, título, cor, unidades e serviços
  if exists (select 1 from jsonb_array_elements(r) v, jsonb_object_keys(v) kk where kk not in ('id', 'name', 'title', 'color', 'locations', 'services')) then
    raise exception 'FALHOU passo 3: campo a mais'; end if;
  ok := ok + 1;
  -- 4. "não marca pelo site": some da lista
  r := public.desk_staff_save(e, k, jsonb_build_object('id', pa.id, 'online', false));
  if not coalesce((r->>'ok' = 'true' and not exists (select 1 from jsonb_array_elements(public.vitrine_pros(e)) v where (v->>'id')::uuid = pa.id)), false) then
    raise exception 'FALHOU passo 4: %', r; end if;
  ok := ok + 1;
  -- 5. a agenda (tela de Equipe) mostra online = false — ela continua na agenda
  r := public.desk_agenda(e, k, now(), now() + interval '1 day');
  if not coalesce(((select v->>'online' from jsonb_array_elements(r->'pros') v where (v->>'id')::uuid = pa.id) = 'false'), false) then
    raise exception 'FALHOU passo 5: %', (select v from jsonb_array_elements(r->'pros') v where (v->>'id')::uuid = pa.id); end if;
  ok := ok + 1;
  -- 6. salvar outra coisa (o título) NÃO mexe na marca
  perform public.desk_staff_save(e, k, jsonb_build_object('id', pa.id, 'title', coalesce(pa.title, 'Prova')));
  if coalesce((select (config->>'online')::boolean from biz_professionals where id = pa.id), true) then raise exception 'FALHOU passo 6'; end if;
  ok := ok + 1;
  -- 7. voltar a marcar pelo site: volta à lista
  perform public.desk_staff_save(e, k, jsonb_build_object('id', pa.id, 'online', true));
  if not exists (select 1 from jsonb_array_elements(public.vitrine_pros(e)) v where (v->>'id')::uuid = pa.id) then raise exception 'FALHOU passo 7'; end if;
  ok := ok + 1;
  -- 8. a regra dela (duração própria) aparece na lista do site
  perform public.desk_staff_save(e, k, jsonb_build_object('id', pa.id, 'service_rules', jsonb_build_array(jsonb_build_object('service_id', sv, 'duration_min', coalesce(svd, 60) + 15))));
  x := (select v from jsonb_array_elements(public.vitrine_pros(e)) v where (v->>'id')::uuid = pa.id);
  if not coalesce(exists (select 1 from jsonb_array_elements(x->'services') s where (s->>'service_id')::uuid = sv
                   and (s->>'duration_min')::int = coalesce(svd, 60) + 15 and (s->>'service_duration_min')::int is not distinct from svd), false) then
    raise exception 'FALHOU passo 8: %', x->'services'; end if;
  ok := ok + 1; log := log || ' 8.' || (coalesce(svd, 60) + 15) || 'min';
  -- 9. outro negócio não vê esta equipe
  if exists (select 1 from jsonb_array_elements(public.vitrine_pros('outro-negocio-prova@example.com')) v where (v->>'id')::uuid = pa.id) then raise exception 'FALHOU passo 9'; end if;
  ok := ok + 1;
  -- 10. o navegador (anon) não chama a lista direto — só o servidor
  if has_function_privilege('anon', 'public.vitrine_pros(text)', 'execute') then raise exception 'FALHOU passo 10: anon executa'; end if;
  ok := ok + 1;
  raise exception 'PROVA (desfeita): %/10 ok ·%', ok, log;
end $prova$;
