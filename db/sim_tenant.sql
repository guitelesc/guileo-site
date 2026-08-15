-- db/sim_tenant.sql — O NEGÓCIO DE MENTIRA ONDE A SIMULAÇÃO RODA.
--
-- POR QUE EXISTE: simular a jornada inteira exige ESCREVER (marca, cancela, cobra, lembra).
-- Fazer isso no tenant de um cliente real suja o histórico dele e, pior, um passo com defeito
-- pode mandar e-mail ou mensagem para um cliente de verdade. A simulação precisa de um negócio
-- próprio, descartável e claramente falso.
--
-- DUAS DECISÕES QUE PARECEM DETALHE E NÃO SÃO:
--
-- 1. EXPEDIENTE NOS 7 DIAS. Em 2026-08-08 (sexta) o painel acusou o motor de agenda de quebrado
--    porque o expediente era seg–sex: o próximo horário livre era segunda, e a sonda só sabia
--    dizer "amanhã". Uma simulação cujo resultado depende do dia da semana em que rodou não é
--    uma simulação — é uma moeda. Aqui abre todo dia, então o mesmo teste dá o mesmo resultado
--    numa terça e num domingo.
--
-- 2. AVISO SEM AVISO NENHUM. O telefone e o e-mail apontam para a própria Guileo. Se algum passo
--    disparar de verdade, quem recebe somos nós — nunca um paciente ou cliente de alguém.
--
-- Idempotente: pode rodar quantas vezes quiser.

-- ── O TENANT ─────────────────────────────────────────────────────────────────────────────────
-- A chave de acesso NÃO nasce aqui com valor fixo: um segredo em arquivo versionado vira segredo
-- público no primeiro `git push`. Nasce aleatória no banco e quem for rodar a simulação a lê de lá.
insert into public.client_credits (client_email, credits, plan, access_key, updated_at)
values ('sim@guileoai.com', 5000, 'simulacao', encode(gen_random_bytes(24), 'hex'), now())
on conflict (client_email) do update set credits = 5000, plan = 'simulacao', updated_at = now();

insert into public.client_integrations (client_email, provider, tokens)
values ('sim@guileoai.com', 'profile', jsonb_build_object(
  'business_name', 'Simulação Guileo (negócio de teste)',
  'industry', 'salon',
  'lang', 'pt',
  'tz', 'America/New_York',
  'phone', '+19864443334',
  'email', 'sim@guileoai.com'
))
on conflict (client_email, provider) do update set tokens = excluded.tokens;

-- ── LOCAL ────────────────────────────────────────────────────────────────────────────────────
insert into public.biz_locations (client_email, name, address, city, phone, tz, active)
select 'sim@guileoai.com', 'Unidade Simulação', '1 Test Street', 'New York', '+19864443334', 'America/New_York', true
where not exists (select 1 from biz_locations where client_email = 'sim@guileoai.com');

-- ── PROFISSIONAL ─────────────────────────────────────────────────────────────────────────────
insert into public.biz_professionals (client_email, name, title, active)
select 'sim@guileoai.com', 'Ana Simulação', 'Especialista', true
where not exists (select 1 from biz_professionals where client_email = 'sim@guileoai.com');

-- ── SERVIÇOS ─────────────────────────────────────────────────────────────────────────────────
-- Três, de propósito: um comum, um com SINAL (exercita o caminho de depósito) e um com AVISO
-- MÍNIMO alto (exercita a recusa de "quero agora"). Um só serviço esconderia essas regras.
insert into public.biz_services (client_email, name, duration_min, price_cents, active, min_notice_min, capacity, deposit_cents)
select * from (values
  ('sim@guileoai.com', 'Corte Simulação',    30,  6000, true,   0, 1,     0),
  ('sim@guileoai.com', 'Coloração Simulação',90, 18000, true,   0, 1,  5000),
  ('sim@guileoai.com', 'Pacote Simulação',  120, 30000, true, 240, 1,     0)
) v(a,b,c,d,e,f,g,h)
where not exists (select 1 from biz_services where client_email = 'sim@guileoai.com');

-- ── AGENDA: TODO DIA, 9h ÀS 18h ──────────────────────────────────────────────────────────────
-- weekday 0=domingo … 6=sábado. Os 7 dias, pelo motivo explicado no cabeçalho.
insert into public.biz_schedules (pro_id, location_id, weekday, start_min, end_min)
select p.id, l.id, d.weekday, 540, 1080
from biz_professionals p
join biz_locations l on l.client_email = p.client_email
cross join generate_series(0, 6) as d(weekday)
where p.client_email = 'sim@guileoai.com'
  and not exists (select 1 from biz_schedules s where s.pro_id = p.id and s.weekday = d.weekday);

-- ── O PROFISSIONAL ATENDE TUDO, EM TODO LUGAR ────────────────────────────────────────────────
insert into public.biz_pro_services (pro_id, service_id)
select p.id, s.id from biz_professionals p join biz_services s on s.client_email = p.client_email
where p.client_email = 'sim@guileoai.com'
  and not exists (select 1 from biz_pro_services x where x.pro_id = p.id and x.service_id = s.id);

insert into public.biz_pro_locations (pro_id, location_id)
select p.id, l.id from biz_professionals p join biz_locations l on l.client_email = p.client_email
where p.client_email = 'sim@guileoai.com'
  and not exists (select 1 from biz_pro_locations x where x.pro_id = p.id and x.location_id = l.id);
