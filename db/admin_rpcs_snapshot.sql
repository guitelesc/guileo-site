-- ============================================================================
-- Guileo · SNAPSHOT DAS RPCs DO /ADMIN  (exportado do banco, NÃO é uma mudança)
-- Projeto ynihodbknhjirkdogxby (smart@guileoai.com) · exportado em 2026-08-25
-- via: select pg_get_functiondef(oid) from pg_proc where proname in (...);
-- ----------------------------------------------------------------------------
-- ⚠️ ISTO É UM ESPELHO DO QUE JÁ ESTÁ APLICADO, palavra por palavra. Não altera
-- nada: colar este arquivo no Supabase recria exatamente o que já existe.
--
-- POR QUE EXISTE: estas cinco funções foram coladas à mão no editor do Supabase e
-- nunca tiveram arquivo em db/. O risco não era teórico — CompanyFinance.jsx tem um
-- comentário admitindo que "company_ledger_summary e company_ledger_list foram
-- colados à mão, não vivem em db/, então 'um existe e o outro não' é o cenário
-- provável". Sem arquivo, ninguém sabe o que está aplicado, e restaurar o banco
-- significa reconstruir de memória o painel inteiro do dono.
--
-- REGRA DAQUI PRA FRENTE: mudou uma destas funções no banco, reexporte este arquivo
-- no MESMO commit. Snapshot que envelhece é pior que snapshot nenhum — ele mente com
-- cara de fonte.
--
-- NÃO ESTÁ AQUI, DE PROPÓSITO: `public._admin_ok(text)`. Ela É a senha do /admin em
-- texto puro (`select p_token = '...'`). Ela vive só no banco; para rodá-la de novo,
-- ver reference_guileo_admin_access (reset por SQL colado na hora).
-- ============================================================================


-- ── 1) admin_comando — o Painel de Comando do dono (/api/admin-comando) ──────
-- Uma leitura só, quatro perguntas: dinheiro entrando? · operação rodou? ·
-- vendedores vendendo? · o que precisa da minha mão? Exclui as contas INTERNAS
-- (sim@ / demo@ / smart@ / teste@) da contagem de clientes — foi essa exclusão que
-- acabou com o "6 clientes com 1 pagante" (ver project_guileo_metrica_honesta).
CREATE OR REPLACE FUNCTION public.admin_comando(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb; internos text[] := array['sim@guileoai.com','demo@guileoai.com','smart@guileoai.com','teste@guileoai.com'];
begin
  if not public._admin_ok(p_token) then raise exception 'unauthorized' using errcode='28000'; end if;
  select jsonb_build_object(
    'clientes_reais',   (select count(*) from client_credits where client_email <> all(internos)),
    'creditos_totais',  (select coalesce(sum(credits),0) from client_credits where client_email <> all(internos)),
    'no_vermelho',      (select count(*) from client_credits where credits < 0 and client_email <> all(internos)),
    'quase_no_fim',     (select count(*) from client_credits where credits between 0 and 100 and client_email <> all(internos)),
    'receita_30d',      (select coalesce(sum(amount),0) from client_events where type='payment' and created_at > now() - interval '30 days'),

    'ligacoes_24h',     (select count(*) from client_events where type='call'    and created_at > now() - interval '24 hours'),
    'mensagens_24h',    (select count(*) from client_events where type='message' and created_at > now() - interval '24 hours'),
    'agendamentos_24h', (select count(*) from client_events where type='booking' and created_at > now() - interval '24 hours'),
    'pedidos_24h',      (select count(*) from client_events where type='order'   and created_at > now() - interval '24 hours'),

    'vendedores',       (select count(*) from sellers where active),
    'prospects',        (select count(*) from seller_prospects),
    'prospects_sem_toque', (select count(*) from seller_prospects where coalesce(stage,'') in ('','new')),
    'prospects_sem_fone',  (select count(*) from seller_prospects where coalesce(phone,'') = ''),
    'prospects_sem_email', (select count(*) from seller_prospects where coalesce(email,'') = ''),
    'relatorios',       (select count(*) from business_evaluations),

    -- só o que É problema: `failure`, ou `ops_alert` que declara falha no próprio texto.
    'falhas_24h',       (select coalesce(jsonb_agg(x order by x->>'quando' desc), '[]'::jsonb) from (
                            select jsonb_build_object('quando', created_at, 'o_que', left(summary,150)) as x
                              from client_events
                             where created_at > now() - interval '24 hours'
                               and (type = 'failure'
                                 or (type = 'ops_alert' and (summary ilike '%falh%' or summary ilike '%erro%'
                                     or summary ilike '%FAILED%' or summary ilike '%não%')))
                             order by created_at desc limit 12) z),
    -- avisos que NÃO são problema, separados: dá para ver a atividade sem confundir com urgência.
    'avisos_24h',       (select count(*) from client_events
                          where type='ops_alert' and created_at > now() - interval '24 hours'
                            and not (summary ilike '%falh%' or summary ilike '%erro%' or summary ilike '%FAILED%' or summary ilike '%não%')),
    'canais_pendentes', (select count(*) from client_integrations where tokens->>'status' = 'pending'),
    'promessas_abertas',(select count(*) from seller_prospects sp
                          where sp.note ilike '%$50%'
                            and not exists (select 1 from client_credits cc where lower(cc.client_email) = lower(coalesce(sp.email,'')))),
    'medido_em', now()
  ) into v;
  return v;
end $function$;


-- ── 2) blitz_stats — estatística da Blitz de reativação ──────────────────────
-- Também é O PORTÃO DE ADMIN de meio /admin: vários endpoints (company-finance.js,
-- platform-status.js, onboard-client.js) chamam esta função só para saber se a senha
-- confere — ela LEVANTA com token errado, então HTTP 200 = "é a nossa equipe".
CREATE OR REPLACE FUNCTION public.blitz_stats(p_token text, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public._admin_ok(p_token) then raise exception 'unauthorized' using errcode='28000'; end if;
  return (select jsonb_build_object(
    'total', count(*), 'pending', count(*) filter (where status='pending'),
    'contacted', count(*) filter (where status in ('contacted','replied','won')),
    'replied', count(*) filter (where status in ('replied','won')), 'won', count(*) filter (where status='won'))
    from dormant_contacts where (p_email='' or client_email=lower(trim(p_email))));
end $function$;


-- ── 3) company_ledger_summary — os 4 cartões do razão da própria Guileo ──────
CREATE OR REPLACE FUNCTION public.company_ledger_summary(p_secret text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v json;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350','glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  select json_build_object(
    'monthly_recurring_cents', coalesce(sum(amount_cents) filter (where kind='expense' and recurring='monthly'),0)
       + coalesce(round(sum(amount_cents) filter (where kind='expense' and recurring='yearly')/12.0),0),
    'per_use_cents', coalesce(sum(amount_cents) filter (where kind='expense' and recurring='per_use'),0),
    'investment_cents', coalesce(sum(amount_cents) filter (where kind='investment'),0),
    'revenue_cents', coalesce(sum(amount_cents) filter (where kind='revenue'),0),
    'entries', count(*),
    'by_department', coalesce((select json_object_agg(department, dep_total) from (
        select department, sum(amount_cents) filter (where kind='expense') as dep_total
        from company_ledger group by department) t),'{}'::json)
  ) into v from company_ledger;
  return v;
exception when others then return json_build_object('error', SQLERRM); end $function$;


-- ── 4) company_ledger_list — as linhas do razão, mais novas primeiro ─────────
CREATE OR REPLACE FUNCTION public.company_ledger_list(p_secret text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350','glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  return coalesce((select json_agg(json_build_object(
    'id',id,'entry_date',entry_date,'department',department,'kind',kind,'category',category,
    'vendor',vendor,'description',description,'amount_cents',amount_cents,'currency',currency,
    'recurring',recurring,'notes',notes
  ) order by entry_date desc, created_at desc) from company_ledger), '[]'::json);
exception when others then return '[]'::json; end $function$;


-- ── 5) company_ledger_add — lançamento manual no razão ──────────────────────
CREATE OR REPLACE FUNCTION public.company_ledger_add(p_secret text, p_department text, p_kind text, p_category text, p_vendor text, p_description text, p_amount_cents bigint, p_recurring text DEFAULT ''::text, p_notes text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350','glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  if nullif(trim(coalesce(p_description,'')),'') is null then raise exception 'description required'; end if;
  insert into company_ledger(department,kind,category,vendor,description,amount_cents,recurring,notes)
  values (coalesce(nullif(trim(p_department),''),'finance'), coalesce(nullif(trim(p_kind),''),'expense'),
          coalesce(nullif(trim(p_category),''),'general'), coalesce(p_vendor,''), trim(p_description),
          coalesce(p_amount_cents,0), coalesce(p_recurring,''), coalesce(p_notes,''))
  returning id into v_id;
  return v_id;
end $function$;

-- ✅ Fim do snapshot. Nada aqui é novo; este arquivo existe para que o /admin possa
--    ser reconstruído a partir do repositório, e não da memória de quem colou.
