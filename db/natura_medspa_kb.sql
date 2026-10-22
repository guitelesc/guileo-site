-- 2026-09-28 · NATURA: a Lilian disse "We don't offer Botox" (conv_9501…). O Med Spa da Natura faz
-- Botox, preenchimento, Kybella, PRP e CoolSculpting. Causa: o treino manda negar tudo que não está
-- no catálogo de agendamento, e o catálogo (23 serviços) nunca teve o Med Spa nem o cardápio completo.
-- FONTE: src/novo/NaturaSpa.jsx (MED + MENU), transcrito de naturaspanyc.com. Os preços da página
-- para o Upper East Side batem com o catálogo confirmado (132/135/169); os de ASTORIA estão ~20%
-- atrás — por isso do cardápio geral entram só os NOMES, e preço continua vindo do catálogo.
-- Idempotente. Respostas antigas ficam guardadas como linha inativa "[backup 2026-09-28] …".
do $$
declare t constant text := 'naturaspaadm@gmail.com'; v_srv uuid; v_pro uuid;
begin
  -- 1) backups (uma vez)
  insert into client_kb (client_email, question, answer, category, active)
  select t, '[backup 2026-09-28] ' || k.question, k.answer, k.category, false
    from client_kb k
   where k.client_email = t and k.active and k.question in ('What services do you offer?', 'What services can I offer? (NEVER invent)')
     and not exists (select 1 from client_kb b where b.client_email = t and b.question = '[backup 2026-09-28] ' || k.question);

  -- 2) Med Spa
  if not exists (select 1 from client_kb where client_email = t and question = 'Do you offer Botox, fillers or other Med Spa treatments?') then
    insert into client_kb (client_email, question, answer, category, active) values (t,
      'Do you offer Botox, fillers or other Med Spa treatments?',
      'YES — never say we do not offer these. Natura Med Spa (166 East 63rd Street, Upper East Side) offers: NEUROTOXIN — Botox, Xeomin and Dysport, also for excessive sweating (underarm, palm, sole), starting at $12 to $14 per unit. VOLUME FILLER — Restylane, Juvederm, Sculptra, Radiesse (mid-face, lips, nasal contouring), starting at $700 to $900 per syringe. KYBELLA for under-chin fat, starting at $1,800 per treatment. PRP (platelet-rich plasma), including the vampire facial, starting at $800 per session. COOLSCULPTING, starting at $650. Every injectable and body treatment STARTS WITH A FREE CONSULTATION, where the provider sets the exact plan and price. So the way to close is to book the "Med Spa Consultation (free)" at the Med Spa: check availability, offer two times, recommend one and hold it. Always say "starting at", never a final price; never promise a number of units or a result. Do not give medical advice: questions about health conditions, pregnancy or medications are answered by the provider at the consultation. Note: "Hair Botox" is a different thing — a hair smoothing treatment at the salons; ask which one they mean only if it is unclear.',
      'services', true);
  end if;

  -- 3) cardápio completo — só nomes
  if not exists (select 1 from client_kb where client_email = t and question = 'What else is on the menu besides the booking catalog?') then
    insert into client_kb (client_email, question, answer, category, active) values (t,
      'What else is on the menu besides the booking catalog?',
      'These are real Natura services even when they are not in the booking catalog — never say we do not offer them. HAIR: cuts and blowouts, balayage and highlights, single and double process color, toner and gloss, Brazilian Keratin, Hair Botox, Olaplex and Kerastase treatments, extensions, up-dos, makeup, braids, bridal hair and makeup. FACE: signature, organic (Eminence), HydraFacial, deep pore cleansing, acne relief with LED, dermaplane, microdermabrasion, chemical peel, microneedling and microchanneling, photo facial, laser carbon peel, back facial. BODY: Swedish, deep tissue, hot stone, sports, pre-natal and couples massage, Brazilian lymphatic drainage, post-surgical drainage, body sculpting, ionic foot detox, reflexology. BROWS, LASHES AND WAX: brow shaping, threading, tinting, lamination, microblading, classic and volume lash sets, lash lift, face and body waxing including Brazilian. Not every service is at every location. If the service IS in the booking catalog, quote that price as "starting at" and book it. If it is NOT in the catalog, say yes we offer it, do not invent a price or a time, take the name and register a callback so a specialist confirms price and availability — and tell the caller exactly that.',
      'services', true);
  end if;

  -- 4) as duas respostas que mandavam negar
  update client_kb set updated_at = now(), answer =
    'Massages (30/60/90 min), Facials (including Deep Pore Cleansing and Microdermabrasion), Hair (cuts, color, treatments), Lashes, Waxing, Eyebrows, Laser Hair Removal, CoolSculpting and Acupuncture — and at the Med Spa: Botox and other neurotoxins, fillers, Kybella and PRP, which start with a free consultation. IMPORTANT: we do NOT do nails in-house — no manicure, no pedicure, no mani-pedi. Nails are handled by an outside partner. Quote prices only from the booking catalog or from the Med Spa entry of this FAQ, always as "starting at". If the caller asks for a real Natura service whose price you do not have, do not invent a name or a price: take their name and tell them a specialist will confirm.'
   where client_email = t and active and question = 'What services do you offer?';

  update client_kb set updated_at = now(), answer =
    'CRITICAL: Only mention services that appear in (1) the booking catalog you are given for THIS call, (2) the Med Spa entry of this FAQ, or (3) the full-menu entry of this FAQ. NEVER list a service from memory or because a spa "usually" offers it. WE DO NOT DO NAILS — no manicure, no pedicure, no mani-pedi combo. Nails are handled by an outside partner. If a caller asks for something that is in NONE of those three places, say plainly: "We do not offer that here" and, if useful, offer what we DO have. Never take a customer''s contact details to quote a service we do not provide — that promises a call back that will never come.'
   where client_email = t and active and question = 'What services can I offer? (NEVER invent)';

  -- 5) a consulta gratuita, agendável, com a equipe do Med Spa
  select id into v_srv from biz_services where client_email = t and name = 'Med Spa Consultation (free) · UES Med Spa';
  if v_srv is null then
    insert into biz_services (client_email, name, duration_min, price_cents, active, config)
    values (t, 'Med Spa Consultation (free) · UES Med Spa', 30, 0, true,
            '{"nota":"Free consultation for Botox, fillers, Kybella, PRP and CoolSculpting"}'::jsonb)
    returning id into v_srv;
  end if;
  select p.id into v_pro from biz_professionals p where p.client_email = t and p.name = 'Med Spa Team';
  if v_pro is not null and not exists (select 1 from biz_pro_services where pro_id = v_pro and service_id = v_srv) then
    insert into biz_pro_services (pro_id, service_id) values (v_pro, v_srv);
  end if;
end $$;
