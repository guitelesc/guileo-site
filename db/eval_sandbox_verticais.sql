-- ═════════════════════════════════════════════════════════════════════════════
-- EVAL SANDBOX POR VERTICAL — 13 tenants sintéticos, um por vertical (2026-08-22)
-- ═════════════════════════════════════════════════════════════════════════════
-- O DEFEITO QUE ISTO CONSERTA (e ele custou 8 versões de lição):
--   Cada caso em src/data/verticalEvalCases.js declara `vertical: "plumbing-hvac"`,
--   "accountants", "ecommerce"… e o runner NUNCA leu esse campo. Os 13 rodavam contra
--   UM tenant só — 'eval-sandbox@guileoai.com', que é um SPA. Ou seja: a gente
--   perguntava a um spa quando ele abre pra consertar o vazamento de gás, e reprovava
--   por não agendar com o contador. O juiz escreveu isso por extenso na rodada de
--   18/08: "redirected to spa services, which is wrong business entirely".
--   Enquanto isso, as lições v14→v22 foram escritas para consertar o AGENTE — e o
--   arquivo licoes.js repete "v15 nao resolveu... em DUAS rodadas identicas", porque
--   não havia o que resolver: um spa não tem alvará de obra nem política de reembolso.
--   Medição verdadeira respondendo a pergunta errada, de novo.
--
-- ⚠️ A METADE QUE ERA DEFEITO DE VERDADE CONTINUA SENDO: vazamento de gás, freio,
--   anafilaxia e queimadura química exigem "saia e ligue 911" de QUALQUER negócio.
--   Isto aqui não perdoa o agente — só para de reprová-lo pelo que não é dele.
--
-- SEGURANÇA: 100% escopado por client_email, todo tenant marcado `synthetic: true`,
-- idempotente (delete-then-insert só nos e-mails eval-*@guileoai.com), não toca em
-- nenhum tenant real nem em tabela de cobrança.
-- ═════════════════════════════════════════════════════════════════════════════

do $$
declare v_email text;
begin

  -- ── medical-clinics ───────────────────────────────────────────────────────────
  v_email := 'eval-medical-clinics@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Eval Sandbox Family Clinic', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'medical-clinics', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'New Patient Visit', 30, 15000, true),
    (v_email, 'Follow-Up Visit', 20, 9000, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Eval Sandbox Family Clinic', 'New York', '1 Test Plaza', true);

  -- ── dental-clinics ───────────────────────────────────────────────────────────
  v_email := 'eval-dental-clinics@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Eval Sandbox Dental', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'dental-clinics', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Cleaning', 45, 12000, true),
    (v_email, 'Cavity Filling', 50, 22000, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Eval Sandbox Dental', 'New York', '1 Test Plaza', true);

  -- ── law-firms ───────────────────────────────────────────────────────────
  v_email := 'eval-law-firms@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Eval Sandbox Law', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'law-firms', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Initial Consultation', 30, 25000, true),
    (v_email, 'Document Review', 60, 40000, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Eval Sandbox Law', 'New York', '1 Test Plaza', true);

  -- ── restaurants ───────────────────────────────────────────────────────────
  v_email := 'eval-restaurants@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Eval Sandbox Kitchen', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'restaurants', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Dinner Table (2)', 90, 0, true),
    (v_email, 'Private Room', 120, 20000, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Eval Sandbox Kitchen', 'New York', '1 Test Plaza', true);

  -- ── plumbing-hvac ───────────────────────────────────────────────────────────
  v_email := 'eval-plumbing-hvac@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Eval Sandbox Plumbing & HVAC', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'plumbing-hvac', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Service Call', 60, 14900, true),
    (v_email, 'Drain Cleaning', 90, 29900, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Eval Sandbox Plumbing & HVAC', 'New York', '1 Test Plaza', true);

  -- ── real-estate ───────────────────────────────────────────────────────────
  v_email := 'eval-real-estate@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Eval Sandbox Realty', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'real-estate', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Property Showing', 45, 0, true),
    (v_email, 'Listing Consultation', 60, 0, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Eval Sandbox Realty', 'New York', '1 Test Plaza', true);

  -- ── accountants ───────────────────────────────────────────────────────────
  v_email := 'eval-accountants@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Eval Sandbox Accounting', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'accountants', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Tax Return Prep', 60, 35000, true),
    (v_email, 'Bookkeeping Setup', 90, 50000, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Eval Sandbox Accounting', 'New York', '1 Test Plaza', true);

  -- ── gyms-fitness ───────────────────────────────────────────────────────────
  v_email := 'eval-gyms-fitness@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Eval Sandbox Gym', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'gyms-fitness', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Personal Training', 60, 9000, true),
    (v_email, 'Assessment', 45, 0, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Eval Sandbox Gym', 'New York', '1 Test Plaza', true);

  -- ── salons-spas ───────────────────────────────────────────────────────────
  v_email := 'eval-salons-spas@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Guileo Eval Sandbox Spa', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'salons-spas', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Swedish Massage', 60, 11800, true),
    (v_email, 'Signature Facial', 60, 9500, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Guileo Eval Sandbox Spa', 'New York', '1 Test Plaza', true);

  -- ── auto-dealerships ───────────────────────────────────────────────────────────
  v_email := 'eval-auto-dealerships@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Eval Sandbox Motors', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'auto-dealerships', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Test Drive', 45, 0, true),
    (v_email, 'Service Appointment', 90, 19900, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Eval Sandbox Motors', 'New York', '1 Test Plaza', true);

  -- ── cleaning-services ───────────────────────────────────────────────────────────
  v_email := 'eval-cleaning-services@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Eval Sandbox Cleaning', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'cleaning-services', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Standard Clean', 120, 16000, true),
    (v_email, 'Deep Clean', 240, 32000, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Eval Sandbox Cleaning', 'New York', '1 Test Plaza', true);

  -- ── home-contractors ───────────────────────────────────────────────────────────
  v_email := 'eval-home-contractors@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Eval Sandbox Contracting', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'home-contractors', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Site Estimate', 60, 0, true),
    (v_email, 'Bathroom Remodel', 480, 850000, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Eval Sandbox Contracting', 'New York', '1 Test Plaza', true);

  -- ── ecommerce ───────────────────────────────────────────────────────────
  v_email := 'eval-ecommerce@guileoai.com';
  delete from client_integrations where client_email = v_email and provider = 'profile';
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (v_email, 'profile', jsonb_build_object(
      'business_name', 'Eval Sandbox Store', 'agent_name', 'Gui', 'lang', 'en',
      'vertical', 'ecommerce', 'forward_number', '', 'synthetic', true,
      'note', 'SYNTHETIC eval sandbox — NOT a real customer. Used only by /api/agent-eval.'
    ), now());
  delete from biz_services where client_email = v_email;
  insert into biz_services (client_email, name, duration_min, price_cents, active) values
    (v_email, 'Order Support', 15, 0, true),
    (v_email, 'Returns & Exchanges', 15, 0, true);
  delete from biz_locations where client_email = v_email;
  insert into biz_locations (client_email, name, city, address, active) values
    (v_email, 'Eval Sandbox Store', 'New York', '1 Test Plaza', true);

end $$;

-- PROVA (round-trip, read-only) — o HVAC tem que voltar como HVAC, não como spa:
--   select get_client_profile('glo_ing_c7f2a9e4b8d16350','eval-plumbing-hvac@guileoai.com');
--   select get_client_profile('glo_ing_c7f2a9e4b8d16350','eval-accountants@guileoai.com');