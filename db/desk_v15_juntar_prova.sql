-- PROVA do desk_v15 (juntar clientes duplicados) na conta e2e-test — TUDO DESFEITO no fim (raise exception).
-- Rodar no SQL Editor DEPOIS do desk_v15_juntar.sql. O resultado esperado é um ERRO cuja mensagem começa com
-- "PROVA (desfeita): 24/24 ok". Qualquer "FALHOU passo N" diz o que quebrou. Nada fica gravado.
-- Cena: a mesma pessoa duas vezes — "Prova Juntar Silva" pelo telefone (A) e pelo e-mail (B) — e uma terceira (C).
-- TRAVA: a prova NÃO pode rodar na mesma aba/execução do desk_v15_juntar.sql — o erro final da prova desfaria o arquivo junto
-- (aconteceu em 2026-10-22: "24/24" na tela e nada no banco). Se a função foi criada nesta mesma transação, para aqui.
do $t$
begin
  if to_regprocedure('public.desk_merge(text,text,text,text)') is null then
    raise exception 'PROVA NÃO RODOU: o desk_v15_juntar.sql não está no banco. Rode-o SOZINHO numa aba e confira "aplicado = t"; depois rode esta prova noutra aba.';
  end if;
  if (select xmin from pg_proc where oid = to_regprocedure('public.desk_merge(text,text,text,text)')) = pg_current_xact_id()::xid then
    raise exception 'PROVA NÃO RODOU e NADA FOI APLICADO: o desk_v15_juntar.sql e esta prova estão na mesma execução. Rode o desk_v15_juntar.sql SOZINHO numa aba (tem de dar "aplicado = t") e a prova noutra aba.';
  end if;
end $t$;

do $prova$
declare e text := 'e2e-test@guileoai.com'; k text; s biz_services; pk uuid; r jsonb; ok int := 0; log text := '';
        a text := '+1 718 555 0177'; b text := 'prova-juntar@example.com'; c text := '+1 718 555 0188';
        ak text := '7185550177'; v_m1 uuid; v_m2 uuid; v_pp uuid; v_left int; n int;
begin
  select access_key into k from client_credits where client_email = e;
  select * into s from biz_services where client_email = e and price_cents >= 2000 order by price_cents limit 1;
  if k is null or s.id is null then raise exception 'FALHOU passo 0: conta e2e sem chave ou sem serviço com preço'; end if;
  insert into packages (client_email, name, price_cents, sessions) values (e, 'Prova Juntar Pacote', 10000, 5) returning id into pk;

  -- A (telefone): perfil com alergia, alerta, confiança; uma venda; CRM com SMS registrado "sim"
  perform public.desk_client_save(e, k, a, jsonb_build_object('name', 'Prova Juntar Silva', 'allergies', 'Nut oils', 'alerts', 'Light pressure', 'trusted', true, 'tags', '["vip"]'::jsonb));
  r := public.desk_checkout(e, k, jsonb_build_object('customer_name', 'Prova Juntar Silva', 'customer_contact', a, 'request_id', 'prova-juntar-a',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', s.price_cents))));
  if not coalesce((r->>'ok' = 'true'), false) then raise exception 'FALHOU passo 0a: %', r; end if;
  insert into crm_contacts (client_email, phone, full_name) values (e, '+17185550177', 'Prova Juntar Silva');
  insert into crm_consent_log (client_email, contact_key, channel, granted, source, evidence) values (e, ak, 'sms', true, 'balcao', 'prova');
  -- B (e-mail): perfil com outra alergia e bloqueada para marcar online; compra um pacote; disse "não" a SMS
  perform public.desk_client_save(e, k, b, jsonb_build_object('name', 'Prova  Juntar Silva', 'allergies', 'Latex', 'can_book_online', false, 'tags', '["indicada"]'::jsonb));
  r := public.desk_checkout(e, k, jsonb_build_object('customer_name', 'Prova Juntar Silva', 'customer_contact', b, 'request_id', 'prova-juntar-b',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'package', 'ref_id', pk)), 'payments', jsonb_build_array(jsonb_build_object('method', 'card', 'amount_cents', 10000))));
  if not coalesce((r->>'ok' = 'true'), false) then raise exception 'FALHOU passo 0b: %', r; end if;
  select id into v_pp from package_purchases where client_email = e and package_id = pk;
  insert into crm_consent_log (client_email, contact_key, channel, granted, source, evidence) values (e, b, 'sms', false, 'balcao', 'prova');
  -- C (outro telefone, outra pessoa com o mesmo nome — só para a cadeia)
  r := public.desk_checkout(e, k, jsonb_build_object('customer_name', 'Prova Juntar Silva', 'customer_contact', c, 'request_id', 'prova-juntar-c',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', s.price_cents))));

  -- 1. sugestão: mesmo nome (com espaço duplo e tudo) junta A, B e C num grupo
  r := public.desk_merge_suggest(e, k);
  if not exists (select 1 from jsonb_array_elements(r->'groups') g where g->>'reason' = 'same_name'
                   and (select count(*) from jsonb_array_elements(g->'members') m where m->>'contact_key' in (ak, b, '7185550188')) = 3) then
    raise exception 'FALHOU passo 1: %', r; end if;
  ok := ok + 1;
  -- 2. prévia: soma as alergias, fica bloqueada online (o mais restritivo), confiança passa, SMS = não
  r := public.desk_merge_preview(e, k, a, b);
  if not coalesce((r->>'ok' = 'true' and r->'result'->>'allergies' = 'Nut oils · Latex' and r->'result'->>'can_book_online' = 'false'
          and r->'result'->>'trusted' = 'true' and r->'result'->>'email' = b and (r->'consent'->'sms'->>'result') = 'false'
          and (r->'main'->>'sales')::int = 1 and (r->'alias'->>'packages')::int = 1 and r->>'different_names' = 'false'), false) then raise exception 'FALHOU passo 2: %', r; end if;
  ok := ok + 1; log := log || ' 2.prévia ok';
  -- 3. a prévia não grava nada
  if exists (select 1 from desk_client_alias where client_email = e and alias_key = b) or not exists (select 1 from desk_clients where client_email = e and contact_key = b) then
    raise exception 'FALHOU passo 3: a prévia gravou'; end if;
  ok := ok + 1;
  -- 4. recusas: mesma ficha, ficha que não existe, contato inválido
  r := public.desk_merge(e, k, a, '718-555-0177'); if not coalesce((r->>'reason' = 'same_client'), false) then raise exception 'FALHOU passo 4a: %', r; end if;
  r := public.desk_merge(e, k, a, 'ninguem-prova@example.com'); if not coalesce((r->>'reason' = 'client_not_found'), false) then raise exception 'FALHOU passo 4b: %', r; end if;
  r := public.desk_merge(e, k, a, 'x'); if not coalesce((r->>'reason' = 'invalid_contact'), false) then raise exception 'FALHOU passo 4c: %', r; end if;
  ok := ok + 1;
  -- 5. juntar B em A
  r := public.desk_merge(e, k, a, b); v_m1 := (r->>'merge_id')::uuid;
  if not coalesce((r->>'ok' = 'true' and v_m1 is not null and (r->>'consent_records')::int = 1), false) then raise exception 'FALHOU passo 5: %', r; end if;
  ok := ok + 1;
  -- 6. a ficha pelo telefone traz a venda de A e o pacote de B, e diz que B está junta
  r := public.desk_client_card(e, k, a);
  if not coalesce((jsonb_array_length(r->'sales') = 2 and jsonb_array_length(r->'packages') = 1 and jsonb_array_length(r->'aliases') = 1
          and r->'profile'->>'allergies' = 'Nut oils · Latex' and r->'profile'->>'can_book_online' = 'false'), false) then raise exception 'FALHOU passo 6: %', r; end if;
  ok := ok + 1;
  -- 7. a ficha aberta pelo e-mail antigo cai na MESMA ficha
  r := public.desk_client_card(e, k, b);
  if not coalesce((r->>'contact_key' = ak and jsonb_array_length(r->'sales') = 2), false) then raise exception 'FALHOU passo 7: %', r->>'contact_key'; end if;
  ok := ok + 1;
  -- 8. o perfil de B saiu da tabela (guardado no registro); nada de dinheiro mudou de dono
  select sessions_total - sessions_used into v_left from package_purchases where id = v_pp;
  if exists (select 1 from desk_clients where client_email = e and contact_key = b)
     or not exists (select 1 from package_purchases where id = v_pp and contact = b) or v_left <> 5
     or not exists (select 1 from desk_sales where client_email = e and request_id = 'prova-juntar-b' and contact_key = b) then
    raise exception 'FALHOU passo 8: perfil/pacote/venda'; end if;
  ok := ok + 1;
  -- 9. consentimento: A ganhou o "não" de SMS (fonte juntar) e o espelho do CRM acompanhou
  if not coalesce(((public._consent_ultimo(e, ak))->'sms'->>'granted' = 'false' and (public._consent_ultimo(e, ak))->'sms'->>'source' = 'juntar'
          and exists (select 1 from crm_contacts where client_email = e and phone_key = ak and consent_sms = false)), false) then
    raise exception 'FALHOU passo 9: %', public._consent_ultimo(e, ak); end if;
  ok := ok + 1;
  -- 10. a busca mostra a pessoa uma vez só (pelo telefone principal)
  r := public.desk_client_search(e, k, 'prova juntar');
  if not coalesce(((select count(*) from jsonb_array_elements(r) x where x->>'contact_key' in (ak, b)) = 1
          and exists (select 1 from jsonb_array_elements(r) x where x->>'contact_key' = ak)), false) then raise exception 'FALHOU passo 10: %', r; end if;
  ok := ok + 1;
  -- 11. a sugestão não traz mais B (C continua sozinha com A? A + C ainda têm o mesmo nome → grupo de 2)
  r := public.desk_merge_suggest(e, k);
  if exists (select 1 from jsonb_array_elements(r->'groups') g, jsonb_array_elements(g->'members') m where m->>'contact_key' = b) then
    raise exception 'FALHOU passo 11: B ainda aparece'; end if;
  ok := ok + 1;
  -- 12. juntar de novo = já junta
  r := public.desk_merge(e, k, a, b); if not coalesce((r->>'reason' = 'already_merged'), false) then raise exception 'FALHOU passo 12: %', r; end if;
  r := public.desk_merge(e, k, b, c); if not coalesce((r->>'reason' = 'already_merged'), false) then raise exception 'FALHOU passo 12b: %', r; end if;
  ok := ok + 1;
  -- 13. salvar a ficha pelo e-mail antigo grava na principal (não recria B)
  perform public.desk_client_save(e, k, b, jsonb_build_object('notes', 'prefere manhã'));
  if exists (select 1 from desk_clients where client_email = e and contact_key = b)
     or not exists (select 1 from desk_clients where client_email = e and contact_key = ak and notes = 'prefere manhã') then raise exception 'FALHOU passo 13'; end if;
  ok := ok + 1;
  -- 14. cadeia: juntar C em A; desfazer o 1º antes do 2º é recusado
  r := public.desk_merge(e, k, a, c); v_m2 := (r->>'merge_id')::uuid;
  if not coalesce((r->>'ok' = 'true'), false) then raise exception 'FALHOU passo 14: %', r; end if;
  r := public.desk_merge_undo(e, k, v_m1); if not coalesce((r->>'reason' = 'undo_later_first'), false) then raise exception 'FALHOU passo 14b: %', r; end if;
  ok := ok + 1;
  -- 15. desfazer o 2º: C volta a ser ficha própria
  r := public.desk_merge_undo(e, k, v_m2);
  if not coalesce((r->>'ok' = 'true' and (public.desk_client_card(e, k, c))->>'contact_key' = '7185550188'), false) then raise exception 'FALHOU passo 15: %', r; end if;
  ok := ok + 1;
  -- 16. desfazer o 1º: B volta com o perfil dela; a edição feita depois na principal FICA (kept_edits)
  r := public.desk_merge_undo(e, k, v_m1);
  if not coalesce((r->>'ok' = 'true' and r->>'kept_edits' = 'true'), false) then raise exception 'FALHOU passo 16: %', r; end if;
  ok := ok + 1;
  r := public.desk_client_card(e, k, b);
  if not coalesce((r->>'contact_key' = b and r->'profile'->>'allergies' = 'Latex' and r->'profile'->>'can_book_online' = 'false'
          and jsonb_array_length(r->'packages') = 1 and jsonb_array_length(r->'sales') = 1), false) then raise exception 'FALHOU passo 17: %', r; end if;
  ok := ok + 1;
  -- 18. a ficha de A volta a ter só a venda dela
  r := public.desk_client_card(e, k, a);
  if not coalesce((jsonb_array_length(r->'sales') = 1 and jsonb_array_length(r->'packages') = 0 and jsonb_array_length(r->'aliases') = 0), false) then raise exception 'FALHOU passo 18: %', r; end if;
  ok := ok + 1;
  -- 19. o "não" que o juntar criou some; A volta ao "sim" de antes, no log e no espelho do CRM
  if not coalesce(((public._consent_ultimo(e, ak))->'sms'->>'granted' = 'true'
          and exists (select 1 from crm_contacts where client_email = e and phone_key = ak and consent_sms = true)), false) then
    raise exception 'FALHOU passo 19: %', public._consent_ultimo(e, ak); end if;
  ok := ok + 1;
  -- 20. o "não" que a própria B disse continua
  if not coalesce(((public._consent_ultimo(e, b))->'sms'->>'granted' = 'false' and (public._consent_ultimo(e, b))->'sms'->>'source' = 'balcao'), false) then raise exception 'FALHOU passo 20'; end if;
  ok := ok + 1;
  -- 21. desfazer de novo = já desfeito
  r := public.desk_merge_undo(e, k, v_m1); if not coalesce((r->>'reason' = 'already_undone'), false) then raise exception 'FALHOU passo 21: %', r; end if;
  ok := ok + 1;
  -- 22. "não são a mesma pessoa" tira o grupo da sugestão
  r := public.desk_merge_suggest(e, k);
  perform public.desk_merge_dismiss(e, k, (select jsonb_agg(m->'contact_key') from jsonb_array_elements(r->'groups') g, jsonb_array_elements(g->'members') m
                                             where g->>'assinatura' like '%' || ak || '%'));
  r := public.desk_merge_suggest(e, k);
  if exists (select 1 from jsonb_array_elements(r->'groups') g where g->>'assinatura' like '%' || ak || '%') then raise exception 'FALHOU passo 22: %', r; end if;
  ok := ok + 1;
  -- 23. o registro guarda as duas juntadas, desfeitas
  select count(*) into n from desk_merges where client_email = e and id in (v_m1, v_m2) and undone_at is not null;
  if n <> 2 then raise exception 'FALHOU passo 23: %', n; end if;
  ok := ok + 1;
  -- 24. chave errada não junta
  begin
    r := public.desk_merge(e, 'chave-errada', a, b);
    raise exception 'FALHOU passo 24: chave errada passou';
  exception when sqlstate '28000' then ok := ok + 1;
  end;
  raise exception 'PROVA (desfeita): %/24 ok ·%', ok, log;
end $prova$;
