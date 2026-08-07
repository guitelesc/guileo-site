// src/data/leadBoss.js
// ─────────────────────────────────────────────────────────────────────────────
// LEAD BOSS — a SEEDED bench of REAL, pre-qualified prospects the seller can action
// immediately ("já pronto pra ele só ligar e fechar"). Every lead here was verified by
// hand from the business's own public website/directory listing on 2026-07-29 — NOTHING
// is invented. Where a field wasn't public, it's left "" (the card shows an honest gap +
// a "find contact" link), never fabricated.
//
// Each lead:
//   id       stable slug (used as the localStorage status key)
//   name     business name
//   niche    a VERTICALS key (drives the AI approach + icon)
//   city     metro (for the pitch)
//   area     neighborhood
//   site     https URL (public)
//   decisor  owner / medical director / decision-maker NAME if public, else ""
//   phone    E.164 digits (US) if a public phone was listed, else ""
//   wa       true ONLY when the listed number is explicitly a WhatsApp line
//   email    public email if listed, else ""
//   heat     "hot" (verified contact + sharp pain → call first) | "warm" (verified, thinner)
//   obs      the ONE specific observation to open with — {pt,en} (es→en, hi→en fallback)
//
// This is the Miami MED SPA batch (Guileo's chosen beach-head niche). Add batches by
// appending objects; the board groups by city automatically.
// ─────────────────────────────────────────────────────────────────────────────

export const LEAD_BATCHES = [
  { id: "medspa-miami", label: { pt: "Med Spas · Miami", en: "Med Spas · Miami", es: "Med Spas · Miami", hi: "Med Spas · Miami" }, niche: "medical", city: "Miami" },
];

export const LEADS = [
  {
    id: "miami-elegance", name: "Miami Elegance Medspa", niche: "medical", city: "Miami", area: "Doral",
    site: "https://www.miamielegance.com/", decisor: "Annette Bode (dona · master injector)",
    phone: "13059927667", wa: true, email: "annette@miamielegance.com", heat: "hot",
    obs: {
      pt: "O botão \"Book Now\" do site cai direto no WhatsApp pessoal dela — o agendamento inteiro depende de 1 pessoa e não tem cobertura fora de hora.",
      en: "The site's \"Book Now\" goes straight to her personal WhatsApp — booking depends entirely on one person, with zero after-hours coverage.",
    },
  },
  {
    id: "monaco-medspa", name: "Monaco MedSpa", niche: "medical", city: "Miami", area: "Midtown / Edgewater",
    site: "https://www.monacomedspa.com/", decisor: "Dra. Jeannette Barrueta (MD)",
    phone: "17865366117", wa: false, email: "officemanager@monacomedspa.com", heat: "hot",
    obs: {
      pt: "Está com promoções pesadas de verão (Botox $12,95/u) — campanha forte gera ligação à noite e no fim de semana, e é aí que o lead escapa.",
      en: "Running heavy summer promos (Botox $12.95/unit) — a strong campaign drives after-hours and weekend calls, exactly where leads leak.",
    },
  },
  {
    id: "avabello", name: "Avabello Aesthetics", niche: "medical", city: "Miami", area: "Miami Beach",
    site: "https://avabello.com/med-spa/", decisor: "Dr. Benjamin Eskenazi (cirurgião plástico)",
    phone: "13057984656", wa: false, email: "", heat: "hot",
    obs: {
      pt: "Não tem booking online — só \"solicitar consulta\" por formulário. Lead de alta intenção fica esperando resposta manual.",
      en: "No online booking — only a \"request a consultation\" form. High-intent leads sit waiting for a manual reply.",
    },
  },
  {
    id: "facial-mania", name: "Facial Mania Med Spa", niche: "medical", city: "Miami", area: "Gables · Doral · Kendall · Midtown",
    site: "https://facialmaniamedspamiami.com/", decisor: "",
    phone: "13053767261", wa: false, email: "", heat: "hot",
    obs: {
      pt: "Tem 4 telefones diferentes (um por unidade) e nenhum email — o cliente liga numa, ninguém atende, e não há repasse entre unidades.",
      en: "Four different phone lines (one per location) and no email — a caller hits one, nobody answers, and there's no routing between locations.",
    },
  },
  {
    id: "lovmedspa", name: "LovMedSpa", niche: "medical", city: "Miami", area: "Aventura",
    site: "https://www.lovmedspa.com/miami", decisor: "Richard Diggs (practice manager)",
    phone: "13473446225", wa: false, email: "", heat: "hot",
    obs: {
      pt: "O site lista dois números diferentes — confunde o cliente e ainda deixa horário descoberto fora do expediente do gerente.",
      en: "The site lists two different numbers — it confuses callers and still leaves hours uncovered outside the manager's shift.",
    },
  },
  {
    id: "miami-skin-spa", name: "Miami Skin Spa", niche: "medical", city: "Miami", area: "Brickell",
    site: "https://www.miamiskinspa.com/", decisor: "",
    phone: "13055571615", wa: false, email: "", heat: "hot",
    obs: {
      pt: "Promo de julho com prazo (\"book before Jul 31\") — prazo gera pico de ligação fora de hora, e não há quem atenda à noite.",
      en: "A July promo with a deadline (\"book before Jul 31\") — deadlines spike after-hours calls, and no one answers at night.",
    },
  },
  {
    id: "med-aesthetics-miami", name: "Med Aesthetics Miami", niche: "medical", city: "Miami", area: "Coral Gables · Aventura",
    site: "https://www.medaestheticsmiami.com/", decisor: "Rosanna Bermejo (fundadora)",
    phone: "13053567402", wa: false, email: "info@medaestheticsmiami.com", heat: "hot",
    obs: {
      pt: "Tem 3 unidades com 3 emails separados (Gables, Aventura, Lauderdale) — um lead pode cair no vazio entre elas.",
      en: "Three locations with three separate inboxes (Gables, Aventura, Lauderdale) — a lead can fall into the gap between them.",
    },
  },
  {
    id: "surface-level", name: "Surface Level", niche: "medical", city: "Miami", area: "Wynwood",
    site: "https://www.thesurfacelevel.com/", decisor: "",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Está \"Coming Soon\" — greenfield: ainda não montaram telefone nem booking. Pega antes de abrirem pra já nascer com a Gui no dia 1.",
      en: "It's \"Coming Soon\" — greenfield: no phone or booking set up yet. Catch them pre-launch so they open with Gui from day 1.",
    },
  },
  {
    id: "south-florida-face-body", name: "South Florida Face and Body", niche: "medical", city: "Miami", area: "Miami Beach (South of Fifth)",
    site: "https://www.southfloridafaceandbody.com/miami-beach/med-spa-services/", decisor: "Kelly Wolfe (NP · dona)",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "A dona (Kelly Wolfe, NP) faz PESSOALMENTE toda consulta e tratamento — quando ela está atendendo, não há ninguém pra pegar o telefone/lead.",
      en: "The owner (Kelly Wolfe, NP) personally does every consult and treatment — while she's in a room, no one is left to catch the phone/lead.",
    },
  },
  {
    id: "ilu-collective", name: "ILU Collective", niche: "medical", city: "Miami", area: "Coral Gables",
    site: "https://ilucollective.com/", decisor: "",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Boutique de uma unidade só (135 Madeira Ave) que vende \"os mesmos provedores te atendem sempre\" — equipe enxuta, sem recepção dedicada pra picos de ligação.",
      en: "A single-location boutique (135 Madeira Ave) selling \"the same providers every visit\" — lean team, no dedicated front desk for call spikes.",
    },
  },
  {
    id: "lumini-medspa", name: "Lumini Medical Spa", niche: "medical", city: "Miami", area: "Aventura Mall",
    site: "https://luminimedspa.com/", decisor: "",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Fica dentro do Aventura Mall — alto walk-in e telefone tocando durante atendimento; um assistente de IA pega o que a recepção do mall não consegue.",
      en: "Inside Aventura Mall — high walk-in and a phone ringing mid-treatment; an AI assistant catches what the front desk can't.",
    },
  },
  {
    id: "aurelia-med", name: "Aurelia Med Spa", niche: "medical", city: "Miami", area: "Coconut Grove / North Miami",
    site: "https://aureliamed.com/med-spa/coconut-grove/", decisor: "",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Se vende por um \"injetor top-100 dos EUA\" — agenda dele lotada = ligação perdida e lista de espera não trabalhada. A Gui captura e reagenda.",
      en: "Sells on a \"top-100 US injector\" — his packed calendar means missed calls and an unworked waitlist. Gui captures and rebooks.",
    },
  },
  {
    id: "lavish-laser", name: "Lavish Laser Medspa", niche: "medical", city: "Miami", area: "Coconut Grove",
    site: "https://lavishlasermedspa.com/", decisor: "",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Trabalha com pacotes de membership — cobrança recorrente e renovação de pacote são exatamente o que a Gui automatiza (lembrete + cobrança + reagendamento).",
      en: "Runs membership packages — recurring billing and package renewals are exactly what Gui automates (reminder + collect + rebook).",
    },
  },
  {
    id: "meraki-med", name: "MERAKI MED", niche: "medical", city: "Miami", area: "Coral Gables",
    site: "", decisor: "",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Boutique em crescimento (4.9 de nota, ~60 reviews) — nessa fase cada lead perdido fora do horário dói, e não têm recepção 24/7.",
      en: "A growing boutique (4.9 rating, ~60 reviews) — at this stage every after-hours lead lost hurts, and they have no 24/7 front desk.",
    },
  },
  {
    id: "brickell-cosmetic", name: "Brickell Cosmetic Center", niche: "medical", city: "Miami", area: "Brickell",
    site: "", decisor: "Dra. Lauren Dozier (dermatologista)",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Derm-led com nota mais baixa (4.4 / 250 reviews) — a nota sugere gargalo de atendimento/resposta, o problema exato que a Gui resolve.",
      en: "Derm-led with a lower rating (4.4 / 250 reviews) — the score hints at a response/service bottleneck, precisely what Gui fixes.",
    },
  },
  {
    id: "get-refreshed", name: "Get Refreshed", niche: "medical", city: "Miami", area: "Miami",
    site: "", decisor: "Dra. Annie Casta (diretora médica)",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Diretora médica é o rosto do negócio (4.7 / 214 reviews) — operação clínica costuma ter zero cobertura de telefone fora do horário.",
      en: "The medical director is the face of the business (4.7 / 214 reviews) — clinician-run shops usually have zero after-hours phone coverage.",
    },
  },
  {
    id: "plenitude-medspa", name: "Plenitude MedSpa", niche: "medical", city: "Miami", area: "Coral Gables",
    site: "", decisor: "Dr. Brad Herman (cirurgião plástico aposentado)",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Boutique tocada pelo dono clínico (4.8 / 80 reviews) — operação enxuta, sem recepção dedicada; a Gui vira a recepcionista que ele não contratou.",
      en: "A boutique run by its clinician-owner (4.8 / 80 reviews) — lean, no dedicated front desk; Gui becomes the receptionist he never hired.",
    },
  },
  {
    id: "lux-medspa-brickell", name: "Lux MedSpa Brickell", niche: "medical", city: "Miami", area: "Brickell (SLS LUX)",
    site: "", decisor: "",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Volume altíssimo (5.0 · 2.150 reviews) — telefone vive ocupado e agenda cheia derruba comparecimento. A Gui atende o transbordo e confirma pra cortar no-show.",
      en: "Very high volume (5.0 · 2,150 reviews) — the phone stays busy and a full calendar tanks attendance. Gui catches overflow and confirms to cut no-shows.",
    },
  },
  {
    id: "aviva-medical-spa", name: "Aviva Medical Spa", niche: "medical", city: "Miami", area: "Design District",
    site: "", decisor: "",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Estabelecido desde 2009 (5.0 · 270 reviews) — negócio maduro costuma rodar stack de agendamento antigo; alvo bom pra unificar canais.",
      en: "Established since 2009 (5.0 · 270 reviews) — mature shops usually run an old booking stack; a good target to unify channels.",
    },
  },
  {
    id: "beautyfix-brickell", name: "BeautyFix MedSpa", niche: "medical", city: "Miami", area: "Brickell",
    site: "", decisor: "",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Marca multi-unidade — intake espalhado por várias lojas é candidato clássico a unificar num só atendimento de IA.",
      en: "A multi-location brand — intake scattered across stores is a classic candidate to unify into one AI front line.",
    },
  },
  {
    id: "solea-sunny-isles", name: "SOLEA Med Spa", niche: "medical", city: "Miami", area: "Sunny Isles Beach",
    site: "https://soleabeautylounge.com/", decisor: "",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Clínica de bairro turístico (Sunny Isles) com público internacional — atendimento trilíngue 24/7 da Gui é vantagem direta aqui.",
      en: "A tourist-neighborhood clinic (Sunny Isles) with an international clientele — Gui's trilingual 24/7 answering is a direct edge here.",
    },
  },
  {
    id: "mb-advanced-beauty", name: "MB Advanced Beauty", niche: "medical", city: "Miami", area: "Sunny Isles Beach",
    site: "https://mbadvancedbeauty.com/", decisor: "",
    phone: "", wa: false, email: "", heat: "warm",
    obs: {
      pt: "Boutique premium em Sunny Isles — público de alto ticket espera resposta imediata; lead que espera esfria rápido nesse segmento.",
      en: "A premium Sunny Isles boutique — high-ticket clients expect an instant reply; a lead that waits cools fast in this segment.",
    },
  },

  // ── NYC MED SPAS (batch 2, verified 2026-07-29) ──────────────────────────────
  { id: "lola-aesthetics-bk", name: "Lola Aesthetics & Medical Spa", niche: "medical", city: "New York", area: "Williamsburg, Brooklyn", site: "https://lolaaestheticsmedispa.com", decisor: "Dr. Fredlyn Lolange", phone: "13472282309", wa: false, email: "flolangenp@gmail.com", heat: "hot",
    obs: { pt: "Consultório de uma injetora só (Dra. Fredlyn), usa Gmail pessoal como e-mail do negócio e tem agendamento pelo Boulevard, mas nenhum lembrete ou retorno automático — cliente que liga fora do horário fica sem resposta.", en: "Single-injector practice (Dr. Fredlyn) using a personal Gmail as the business email; has Boulevard booking but no automated reminders or follow-up, so anyone who calls after hours goes unanswered." } },
  { id: "artisans-aesthetics-bk", name: "Artisans Aesthetics", niche: "medical", city: "New York", area: "Bay Ridge, Brooklyn", site: "https://www.artisansaesthetics.com", decisor: "", phone: "13479097020", wa: false, email: "", heat: "hot",
    obs: { pt: "O site não mostra nenhum e-mail e fecha às terças — quem procura nesse dia só tem o telefone, e ninguém atende. Todo contato que não seja o botão de agendar vira ligação perdida.", en: "The site lists no email at all and the spa is closed Tuesdays — anyone reaching out that day has only the phone line and no one answers. Every non-booking inquiry becomes a missed call." } },
  { id: "n4-esthetic-bk", name: "N4 Esthetic Clinic", niche: "medical", city: "New York", area: "Williamsburg, Brooklyn", site: "https://n4estheticclinic.com", decisor: "", phone: "17182464772", wa: false, email: "", heat: "warm",
    obs: { pt: "Sem e-mail público: só telefone, formulário de contato e o painel de agendamento Boulevard. Pergunta de cliente fora do horário fica parada no formulário até alguém abrir.", en: "No public email — just a phone line, a contact form, and the Boulevard booking dashboard. Any after-hours question sits in the form until a human opens it." } },
  { id: "hq-medspa-flushing", name: "HQ Med Spa", niche: "medical", city: "New York", area: "Flushing, Queens", site: "https://www.hqmedspa.com", decisor: "", phone: "17187908678", wa: false, email: "hqmedspa@gmail.com", heat: "hot",
    obs: { pt: "Dupla mãe-e-filha: agendamento é só pelo Fresha, mas toda consulta e dúvida é empurrada pra WeChat ou telefone, com Gmail como e-mail do negócio — nada centralizado nem automático.", en: "Mother-daughter shop: booking is Fresha-only, but every consult and question is pushed to WeChat or phone, with a Gmail as the business email — nothing centralized or automated." } },
  { id: "drv-medspa-lic", name: "Dr. V's NY Med-Spa", niche: "medical", city: "New York", area: "Long Island City, Queens", site: "https://www.mymdspa.com", decisor: "Dr. V. Abayev", phone: "19177896963", wa: false, email: "info@mymdspa.com", heat: "hot",
    obs: { pt: "O botão 'Schedule a Consultation' não abre agenda nenhuma — cai numa página de serviço. Não existe agendamento online: pra marcar é obrigatório ligar ou preencher formulário. Cada lead depende de alguém retornar.", en: "The 'Schedule a Consultation' button opens no calendar — it just lands on a service page. There is no online booking: to book you must call or fill a form, so every lead depends on someone calling back." } },
  { id: "elite-aesthetics-flatiron", name: "Elite Aesthetics", niche: "medical", city: "New York", area: "Flatiron, Manhattan", site: "https://eliteaestheticsnyc.com", decisor: "Mariesa Porter", phone: "12126471930", wa: false, email: "", heat: "warm",
    obs: { pt: "Tem Boulevard e SMS, mas nenhum e-mail público — quem prefere escrever precisa ligar ou mandar torpedo primeiro só pra conseguir um endereço. Fricção logo na primeira pergunta.", en: "They have Boulevard and SMS but no public email — anyone who prefers writing has to call or text first just to get an address. Friction at the very first question." } },
  { id: "jected-by-josie-fidi", name: "Jected by Josie", niche: "medical", city: "New York", area: "Financial District, Manhattan", site: "https://jectedbyjosie.com", decisor: "Josie Deason", phone: "17706303624", wa: false, email: "", heat: "hot",
    obs: { pt: "Injetora solo (Josie), com um único número — e é um celular de fora do estado (770/Georgia) — e nenhum e-mail. Enquanto ela atende, quem liga cai no vazio.", en: "Solo injector (Josie) with a single line — and it's an out-of-state cell (770/Georgia) — and no email. While she's treating a client, callers hit a dead end." } },
  { id: "glowtox-west-village", name: "Glowtox NYC", niche: "medical", city: "New York", area: "West Village, Manhattan", site: "https://www.glowtoxnyc.com", decisor: "", phone: "19177568010", wa: false, email: "info@glowtoxnyc.com", heat: "warm",
    obs: { pt: "O 'Book Now' é só um formulário — não há sistema de agenda transparente por trás. A isca é a 'consulta gratuita', mas não vi nenhum retorno automático pra esses leads.", en: "The 'Book Now' is just a form — no transparent scheduling system behind it. The hook is the 'complimentary consultation', but there's no automated follow-up for those leads." } },
  { id: "lelite-medispa-harlem", name: "L'Elite MediSpa (Harlem)", niche: "medical", city: "New York", area: "Harlem, Manhattan", site: "https://lelitemedispa.com", decisor: "", phone: "13476273374", wa: false, email: "info@lelitemedispa.com", heat: "warm",
    obs: { pt: "Tem agendamento online e portal do cliente, mas nenhum canal de mensagem — sem WhatsApp, sem chat ao vivo. Fora da agenda, é ligar ou nada.", en: "Has online booking and a client portal but no messaging channel — no WhatsApp, no live chat. Outside the booking flow it's call-or-nothing." } },
  { id: "youtherapy-ues", name: "Youtherapy Med Spa", niche: "medical", city: "New York", area: "Upper East Side, Manhattan", site: "https://youtherapymedspa.com", decisor: "Dr. William Greenberg", phone: "12122537138", wa: false, email: "", heat: "warm",
    obs: { pt: "Agenda pelo Mangomint, mas nenhum e-mail público exibido — quem quer contato assíncrono só tem telefone ou formulário. Dúvida à noite espera até o dia seguinte.", en: "Books through Mangomint but shows no public email — anyone wanting async contact has only phone or a form. A question at night waits until the next day." } },
  { id: "beauty-icon-flushing", name: "The Beauty Icon Med Spa", niche: "medical", city: "New York", area: "Flushing, Queens", site: "https://beautyiconmedspa.com", decisor: "Orly Alaev", phone: "19297090009", wa: false, email: "beautyiconmedspa@gmail.com", heat: "hot",
    obs: { pt: "Usa Gmail como e-mail do negócio e tem três canais soltos pra marcar (BLVD, formulário e dois telefones) sem confirmação unificada — receita pra horário duplo e lead perdido no meio.", en: "Uses a Gmail as the business email and has three loose booking channels (BLVD, form, and two phone numbers) with no unified confirmation — a recipe for double-bookings and leads lost in the gaps." } },
  { id: "koru-ues", name: "Koru Health & Medical Aesthetics", niche: "medical", city: "New York", area: "Upper East Side, Manhattan", site: "https://korunyc.com", decisor: "Dr. Vivian Chin", phone: "12123963672", wa: false, email: "", heat: "warm",
    obs: { pt: "Agenda no Zenoti + telefone, mas não fica claro se a marcação confirma na hora ou depende de aprovação manual da equipe, e não há e-mail público — só formulário.", en: "Books via Zenoti plus phone, but it's unclear whether a booking confirms instantly or waits on manual staff approval, and there's no public email — only a form." } },

  // ── MIAMI HOME-SERVICES (HVAC / plumbing / electrical, verified 2026-07-29) ───
  { id: "miami-ac-experts", name: "Miami Air Conditioning Experts", niche: "homeservices", city: "Miami", area: "North Miami Beach", site: "https://repairacmiami.com", decisor: "", phone: "13056028827", wa: false, email: "Info@repairacmiami.com", heat: "hot",
    obs: { pt: "O agendamento online é só pra serviço NÃO-emergencial — a emergência depende de alguém atender o telefone à noite, e não há retorno automático de chamada perdida. É exatamente aí que o cliente liga pro concorrente.", en: "Online scheduling is for NON-emergency work only — emergencies depend on someone answering the phone at night, and there's no missed-call text-back. That's exactly when the customer dials the next company." } },
  { id: "air-zone-mechanical", name: "Air Zone Mechanical", niche: "homeservices", city: "Miami", area: "Miami Lakes", site: "https://www.airzoneac.com", decisor: "", phone: "13055567667", wa: false, email: "", heat: "warm",
    obs: { pt: "Anuncia 'atendimento ao vivo 24/7', mas não tem retorno de chamada perdida nem acompanhamento automático de orçamento — quando a linha satura no calor, o lead evapora.", en: "Advertises '24/7 live answer' but has no missed-call text-back and no automated quote follow-up — when the line jams during a heat wave, the lead evaporates." } },
  { id: "lion-plumbing-doral", name: "Lion Plumbing, Inc.", niche: "homeservices", city: "Miami", area: "Doral", site: "https://www.lionplumbinginc.com", decisor: "", phone: "13055974555", wa: false, email: "", heat: "warm",
    obs: { pt: "Não tem agendamento online — só telefone e um número de texto. Nenhum e-mail público e nenhum acompanhamento automático, então orçamento pedido de madrugada fica sem retorno.", en: "No online booking — just phone and a text number. No public email and no automated follow-up, so a quote requested overnight goes without a reply." } },
  { id: "fuze-electric", name: "Fuze Electric Services", niche: "homeservices", city: "Miami", area: "Kendall / Homestead", site: "https://www.4fuze.com", decisor: "", phone: "13058019293", wa: false, email: "", heat: "warm",
    obs: { pt: "Eletricista pequeno com botão de agendar, mas nenhum e-mail público e nenhum retorno de chamada perdida — a emergência elétrica noturna cai no vazio enquanto ele está em outro serviço.", en: "Small electrician with a booking button but no public email and no missed-call text-back — a nighttime electrical emergency hits a void while he's on another job." } },
  { id: "miami-electric-wizards", name: "Miami Electric Wizards", niche: "homeservices", city: "Miami", area: "Kendall / Cutler Bay", site: "https://www.miamielectricwizards.com", decisor: "", phone: "13053012901", wa: false, email: "", heat: "hot",
    obs: { pt: "Sem agendamento online, sem e-mail — só telefone e texto. Empresa pequena de caminhão: enquanto está na obra, a chamada de emergência e o pedido de orçamento ficam sem ninguém pra atender.", en: "No online booking, no email — just phone and text. Small truck-based shop: while on a job, the emergency call and the quote request have no one to catch them." } },
  { id: "hernandez-plumbing", name: "Hernandez Plumbing Co.", niche: "homeservices", city: "Miami", area: "Doral", site: "https://plumbinginmiamifl.com", decisor: "", phone: "13054283782", wa: false, email: "", heat: "warm",
    obs: { pt: "Encanadora familiar de 3 gerações (desde 1972), só telefone — sem agendamento online, sem e-mail público, sem retorno de chamada perdida. Emergência de madrugada depende de alguém acordar e atender.", en: "Third-generation family plumber (since 1972), phone-only — no online booking, no public email, no missed-call text-back. An overnight emergency depends on someone waking up to answer." } },
  { id: "emergency-ac-corp", name: "Emergency AC Corp", niche: "homeservices", city: "Miami", area: "Miami (NE 16th Ave)", site: "https://www.emergencyaccorp.com", decisor: "", phone: "18557832080", wa: false, email: "emergencyaccorp@gmail.com", heat: "warm",
    obs: { pt: "Promete 'serviço em 60 min' e usa Gmail como e-mail do negócio; tem formulário de agendar mas nenhum retorno de chamada perdida — a promessa de 60 min só vale se alguém pegar a ligação.", en: "Promises 'service in 60 minutes' and uses a Gmail as its business email; has a booking form but no missed-call text-back — the 60-minute promise only holds if someone catches the call." } },
  { id: "the-plumbers-miami", name: "The Plumbers", niche: "homeservices", city: "Miami", area: "Miami (SW 75th Ave)", site: "https://theplumbersfl.com", decisor: "", phone: "13056676924", wa: false, email: "", heat: "warm",
    obs: { pt: "Tem alertas por SMS e formulário, mas nenhum retorno automático de chamada perdida — no pico de emergência, quem não é atendido na hora liga pro próximo encanador da lista.", en: "Has SMS alerts and a form but no automated missed-call callback — at peak emergency, whoever isn't answered right away calls the next plumber on the list." } },
  { id: "247-ac-service", name: "24/7 Air Conditioning Service", niche: "homeservices", city: "Miami", area: "Miami (SW 6th St)", site: "https://24-7airconditioningservice.com", decisor: "Yunior Parra", phone: "13055540911", wa: false, email: "24.7aircservice@gmail.com", heat: "hot",
    obs: { pt: "Operação de um dono só (Yunior), Gmail como e-mail do negócio e vários botões de 'pedir orçamento' — mas nenhum acompanhamento automático nem retorno de chamada perdida, então o orçamento pedido fica sem resposta.", en: "One-owner operation (Yunior), a Gmail as the business email, and several 'request estimate' buttons — but no automated follow-up and no missed-call text-back, so a requested quote goes unanswered." } },
  { id: "family-electric-miami", name: "Family Electric", niche: "homeservices", city: "Miami", area: "Miami-Dade (NW 53rd St)", site: "https://www.electriciansflorida.com", decisor: "", phone: "19545968585", wa: false, email: "info@electriciansflorida.com", heat: "warm",
    obs: { pt: "Não tem agendamento online — só ligação e formulário. Promete 24/7, mas a linha atende três condados ao mesmo tempo, então chamada de emergência em Miami disputa com Broward e Palm Beach e se perde.", en: "No online booking — just call and form. Promises 24/7, but the line covers three counties at once, so a Miami emergency call competes with Broward and Palm Beach and gets lost." } },

  // ── LA MED SPAS (batch 3, verified 2026-07-29) ───────────────────────────────
  { id: "face-place-medical-aesthetics-weho", name: "Face Place Medical Aesthetics", niche: "medical", city: "Los Angeles", area: "West Hollywood", site: "https://www.eugeniaberchenkorn.com/", decisor: "Eugenia Berchenko, RN", phone: "13108551150", wa: false, email: "info@eugeniaberchenkorn.com", heat: "hot",
    obs: { pt: "Consultório de injetáveis tocado por uma única enfermeira (Eugenia, RN) sob supervisão de MD — enquanto ela aplica Botox, ninguém atende o telefone e a ligação do novo cliente vira caixa postal.", en: "Single-nurse injectable practice (Eugenia, RN) under MD supervision — while she is injecting Botox nobody answers the phone and the new-client call goes to voicemail." } },
  { id: "skin-story-medspa-dtla", name: "Skin Story Med Spa", niche: "medical", city: "Los Angeles", area: "Downtown LA", site: "https://skinstorymedspa.com/", decisor: "Soyeon, MSN, FNP-C", phone: "13235772311", wa: false, email: "skinstorymedspa@gmail.com", heat: "hot",
    obs: { pt: "NP sozinha dentro de uma suíte no Salons by JC, usando Gmail pessoal e agenda terceirizada (Jane) — sem recepção, chamadas durante o atendimento se perdem.", en: "Solo NP inside a Salons by JC suite, running on a personal Gmail and a third-party scheduler (Jane) — no front desk, so calls during treatments are lost." } },
  { id: "my-botox-la-studio-city", name: "My Botox LA Med Spa", niche: "medical", city: "Los Angeles", area: "Studio City", site: "https://www.mybotoxla.com/", decisor: "", phone: "18188503345", wa: false, email: "info@mybotoxla.com", heat: "hot",
    obs: { pt: "Não tem agendamento online nenhum — o site pede 'ligue, mande texto ou e-mail para marcar'; todo lead depende de alguém atender manualmente e some fora do horário.", en: "No online booking at all — the site says 'please call, text or email to schedule'; every lead depends on someone answering manually and vanishes after hours." } },
  { id: "atelier-aesthetix-bh", name: "Atelier Aesthetix", niche: "medical", city: "Los Angeles", area: "Beverly Hills", site: "https://atelieraesthetix.com/", decisor: "Natalia Guzman (lead injector)", phone: "14244848283", wa: false, email: "", heat: "hot",
    obs: { pt: "Agendamento jogado para um subdomínio terceirizado (AestheticRecord) e nenhum e-mail público — a injetora principal fica ocupada na cadeira e os leads que não fecham na hora ficam sem follow-up.", en: "Booking pushed off to a third-party subdomain (AestheticRecord) with no public email — the lead injector is busy in the chair, so leads who don't book on the spot get no follow-up." } },
  { id: "me-losangeles-aesthetics-weho", name: "me.losangeles aesthetics", niche: "medical", city: "Los Angeles", area: "West Hollywood", site: "https://www.melosangeles.com/", decisor: "Samira Soroudi, PA-C & Alma Donlic, FNP", phone: "12135835905", wa: false, email: "", heat: "warm",
    obs: { pt: "Só duas injetoras e as duas ficam atendendo ao mesmo tempo; agenda em plataforma terceirizada e sem e-mail público — quem liga durante os procedimentos não é atendido.", en: "Just two injectors, both treating at the same time; booking on a third-party platform with no public email — anyone who calls during procedures isn't picked up." } },
  { id: "skin-verse-medspa-bh", name: "Skin Verse Medical Spa", niche: "medical", city: "Los Angeles", area: "Beverly Hills", site: "https://skinversemedspa.com/", decisor: "", phone: "14242559289", wa: false, email: "info@skinversemedspa.com", heat: "warm",
    obs: { pt: "Spa pequeno que depende de botão 'Book Now' genérico e formulário — sem cobertura fora do horário para os leads que chegam à noite.", en: "Small spa relying on a generic 'Book Now' button and a form — no after-hours coverage for leads that come in at night." } },
  { id: "beauty-vault-medspa-weho", name: "Beauty Vault Medical Spa", niche: "medical", city: "Los Angeles", area: "West Hollywood", site: "https://beautyvaultmedspa.com/", decisor: "Dr. Nouriel Niamehr", phone: "13238006770", wa: false, email: "", heat: "warm",
    obs: { pt: "Agenda na plataforma Mango Mint e sem e-mail público no site — spa boutique de WeHo sem quem responda ligação enquanto os injetores estão ocupados.", en: "Booking on the Mango Mint platform with no public email on the site — boutique WeHo spa with no one to answer the phone while injectors are busy." } },
  { id: "self-care-la-santa-monica", name: "Self Care LA", niche: "medical", city: "Los Angeles", area: "Santa Monica", site: "https://selfcarela.com/", decisor: "Dr. Bharat Kothakota, MD", phone: "13233373445", wa: false, email: "", heat: "warm",
    obs: { pt: "Prática boutique na Montana Ave com equipe enxuta, toda voltada ao atendimento — a ligação de novo paciente compete com quem está na cadeira.", en: "Boutique Montana Ave practice with a lean, all-hands-on-patients team — a new-patient call competes with whoever's in the chair." } },
  { id: "smooth-skin-lounge-bh", name: "Smooth Skin Lounge", niche: "medical", city: "Los Angeles", area: "Beverly Hills", site: "https://www.smoothskinlounge.com/", decisor: "", phone: "18183087703", wa: false, email: "", heat: "warm",
    obs: { pt: "Depende de MindBody + telefone e não publica e-mail — pede 'ligue para sua consulta', então lead fora do horário fica sem resposta.", en: "Relies on MindBody + phone and publishes no email — asks you to 'call for your consultation,' so after-hours leads go unanswered." } },
  { id: "cosmetic-injectables-center-sherman-oaks", name: "Cosmetic Injectables Center", niche: "medical", city: "Los Angeles", area: "Sherman Oaks", site: "https://cosmeticinjectables.com/", decisor: "Dr. Sherly Soleiman, MD", phone: "18183220122", wa: false, email: "", heat: "warm",
    obs: { pt: "Prática Allergan Top-250 de agenda cheia com booking no Zenoti — o volume alto significa ligações de overflow perdidas quando a equipe está injetando.", en: "Allergan Top-250 practice with a packed calendar on Zenoti booking — the high volume means overflow calls get missed while the team is injecting." } },
  { id: "motykie-medspa-weho", name: "Motykie Med Spa", niche: "medical", city: "Los Angeles", area: "West Hollywood", site: "https://motykiemedspa.com/", decisor: "", phone: "13102766772", wa: false, email: "", heat: "warm",
    obs: { pt: "Sem e-mail público no site e agenda por telefone/online — spa em Sunset Blvd sem cobertura para ligações que caem durante os atendimentos.", en: "No public email on the site and phone/online booking only — Sunset Blvd spa with no coverage for calls that land during treatments." } },
  { id: "modern-medspa-la-calabasas", name: "Modern Med Spa LA", niche: "medical", city: "Los Angeles", area: "Calabasas", site: "https://www.modernmedspala.com/", decisor: "", phone: "18188230655", wa: false, email: "", heat: "warm",
    obs: { pt: "Site não nomeia provedor nem e-mail e manda 'ligar' para horários fora da grade — leads noturnos ficam sem resposta.", en: "The site names no provider and no email and tells you to 'call' for off-hours times — evening leads go unanswered." } },

  // ── MIAMI DENTAL (batch 3, verified 2026-07-29) ──────────────────────────────
  { id: "grove-smiles-dentistry-coconut-grove", name: "Grove Smiles Dentistry", niche: "clinic", city: "Miami", area: "Coconut Grove", site: "https://grove-smiles.com/", decisor: "Dr. Rita Dargham, DMD", phone: "13058580505", wa: false, email: "office@grove-smiles.com", heat: "warm",
    obs: { pt: "Prática boutique de dois dentistas — quando os dois estão em procedimento, a ligação do novo paciente e o follow-up do plano de tratamento não acontecem.", en: "Two-dentist boutique — when both are mid-procedure, the new-patient call and the treatment-plan follow-up don't happen." } },
  { id: "gables-perfect-smile-coral-gables", name: "Gables Perfect Smile", niche: "clinic", city: "Miami", area: "Coral Gables", site: "https://gablesperfectsmile.com/", decisor: "Dr. Riboul", phone: "13054438225", wa: false, email: "info@gablesperfectsmile.com", heat: "hot",
    obs: { pt: "Dentista solo (Dr. Riboul) e o único caminho de agenda é um pop-up de formulário — chamada de novo paciente durante a cadeira vira caixa postal, sem retorno.", en: "Solo dentist (Dr. Riboul) whose only booking path is a form pop-up — a new-patient call during a procedure goes to voicemail with no callback." } },
  { id: "svelta-dental-design-coral-gables", name: "Svelta Dental Design", niche: "clinic", city: "Miami", area: "Coral Gables", site: "https://sveltadental.com/", decisor: "Luis & Gretel Jardon (founders)", phone: "13054488636", wa: false, email: "", heat: "hot",
    obs: { pt: "Sem agendamento online e sem e-mail público — só 'preencha o formulário e alguém entra em contato', o que atrasa dias o retorno de leads de veneers.", en: "No online booking and no public email — just 'fill out the form and someone will reach out,' which delays veneer-lead follow-up by days." } },
  { id: "dental-studio-miami-coral-gables", name: "The Dental Studio Miami", niche: "clinic", city: "Miami", area: "Coral Gables", site: "https://thedentalstudiomiami.com/", decisor: "Dr. Maribel Carbia, DMD", phone: "13056660006", wa: false, email: "info@thedentalstudiomiami.com", heat: "warm",
    obs: { pt: "Agenda terceirizada no ZocDoc — sem sistema próprio para recuperar ligação perdida durante procedimento nem mandar follow-up do plano de tratamento.", en: "Booking outsourced to ZocDoc — no in-house system to catch a missed call during a procedure or send treatment-plan follow-ups." } },
  { id: "smile-design-miami-doral", name: "Smile Design Miami", niche: "clinic", city: "Miami", area: "Doral", site: "https://mysmiledesignmiami.com/", decisor: "Dr. Maria Becerra", phone: "17869491133", wa: false, email: "", heat: "warm",
    obs: { pt: "Tem um chatbot no site mas nenhum e-mail público — ligação de novo paciente durante atendimento ainda cai na secretária e o plano de tratamento não recebe follow-up.", en: "Has a site chatbot but no public email — a new-patient call during treatment still hits voicemail and treatment plans get no follow-up." } },
  { id: "coconut-grove-dental", name: "Coconut Grove Dental", niche: "clinic", city: "Miami", area: "Coconut Grove", site: "https://coconutgrovedental.com/", decisor: "", phone: "13058566811", wa: false, email: "info@coconutgrovedental.com", heat: "warm",
    obs: { pt: "Clínica de família com booking Flexbook — dependendo do horário, ligação de novo paciente e reativação de plano de tratamento ficam sem quem responda.", en: "Family clinic on Flexbook booking — depending on the hour, new-patient calls and treatment-plan reactivations have no one to answer." } },
  { id: "aventura-dentistry", name: "Aventura Dentistry", niche: "clinic", city: "Miami", area: "Aventura", site: "https://www.aventuradds.com/", decisor: "Dr. Diana Wohlstein, DMD", phone: "13059315626", wa: false, email: "Appointment.AventuraDDS@gmail.com", heat: "hot",
    obs: { pt: "O contato oficial da prática é um Gmail pessoal — sinal claro de operação sem sistema, perdendo chamada durante procedimento e follow-up.", en: "The practice's official contact is a personal Gmail — a clear sign of a no-system setup losing calls during procedures and follow-ups." } },
  { id: "sharp-dentistry-coconut-grove", name: "Sharp Dentistry & Associates", niche: "clinic", city: "Miami", area: "Coconut Grove", site: "https://sharpdentistry.com/", decisor: "Dr. Bruno Sharp", phone: "13058570990", wa: false, email: "", heat: "warm",
    obs: { pt: "Agenda no NexHealth e sem e-mail público — 'todos os especialistas sob um teto' significa cadeiras sempre ocupadas e ligação de novo paciente sem quem atenda.", en: "Booking on NexHealth with no public email — 'all specialists under one roof' means chairs are always full and new-patient calls have no one to answer." } },
  { id: "brickell-dentistry", name: "Brickell Dentistry", niche: "clinic", city: "Miami", area: "Brickell", site: "https://www.brickelldentistrymiami.com/", decisor: "Dr. Kimberly Padron, DDS", phone: "13053716040", wa: false, email: "", heat: "hot",
    obs: { pt: "Prática boutique que só oferece 'Request an Appointment' (formulário), sem agendamento real nem e-mail — lead de Brickell espera dias por retorno.", en: "Boutique practice offering only a 'Request an Appointment' form, with no real booking and no email — a Brickell lead waits days for a callback." } },
  { id: "brickell-avenue-dentistry", name: "Brickell Avenue Dentistry", niche: "clinic", city: "Miami", area: "Brickell", site: "https://brickellavenuedentistry.com/", decisor: "Dr. Abraham Jaskiel", phone: "13056532231", wa: false, email: "", heat: "hot",
    obs: { pt: "Só formulário de solicitação de horário, sem agendamento online nem e-mail público — chamada perdida durante procedimento não tem retorno automático.", en: "Only an appointment-request form, no online booking and no public email — a call missed during a procedure gets no automatic callback." } },

  // ── NYC HOME-SERVICES (batch 4, verified 2026-07-30) ─────────────────────────
  { id: "mr-plumber-inc-nyc", name: "Mr. Plumber Inc", niche: "homeservices", city: "New York", area: "Bronx", site: "https://mrplumber.nyc/", decisor: "", phone: "13475655130", wa: false, email: "mrplumbernyc@gmail.com", heat: "hot",
    obs: { pt: "Family-owned que promete emergência 24/7, mas o site só tem 'drop us a line' por telefone ou formulário, zero agendamento online e nenhum retorno automático de chamada perdida. Ligação de emergência fora do horário que ninguém atende vira cliente do concorrente.", en: "Family-owned shop promising 24/7 emergency, but the site only offers 'drop us a line' by phone or a contact form, no online booking and no missed-call text-back. Any after-hours emergency call nobody picks up goes straight to a competitor." } },
  { id: "figlia-and-sons-hvac", name: "Figlia & Sons", niche: "homeservices", city: "New York", area: "Manhattan (East Village)", site: "https://figliasons.com/", decisor: "", phone: "12126860094", wa: false, email: "sales@figliasons.com", heat: "hot",
    obs: { pt: "PTAC/HVAC familiar desde 1960; o próprio site diz 'For urgent service, call — the family answers'. Intake 100% telefone: se a família está em obra e não atende, a chamada urgente se perde e não há texto de retorno automático.", en: "Family PTAC/HVAC since 1960; their own site says 'For urgent service, call — the family answers.' Intake is 100% phone: when the family is on a job and cannot pick up, the urgent call is lost with no automatic text-back." } },
  { id: "s-tieger-plumbing-bronx", name: "S Tieger Plumbing", niche: "homeservices", city: "New York", area: "Bronx (Riverdale)", site: "https://www.tiegerplumbing.com/emergency-plumbing-services", decisor: "", phone: "17186016299", wa: false, email: "office@tiegerplumbing.com", heat: "hot",
    obs: { pt: "Anuncia disponibilidade imediata em emergências 'day, night, holidays and weekend', mas o único CTA é um 'CALL US NOW!' — sem agendamento online e sem retorno de chamada perdida. A promessa de noite/feriado depende de alguém levantar o telefone.", en: "Advertises immediate emergency availability 'day, night, holidays and weekend,' yet the only CTA is 'CALL US NOW!' — no online booking and no missed-call text-back. The night/holiday promise depends entirely on someone picking up the phone." } },
  { id: "daven-electric-corp", name: "Daven Electric Corp.", niche: "homeservices", city: "New York", area: "Bronx", site: "https://davenelectric.com/bronx-electrician/", decisor: "", phone: "12123901106", wa: false, email: "", heat: "hot",
    obs: { pt: "Eletricista com emergência 24h, mas a página inteira repete só 'Call Us Now' — nenhum agendamento online, nenhum formulário, nenhum retorno de chamada perdida. Cada chamada de emergência não atendida é dinheiro que vai pro próximo eletricista da lista.", en: "Electrician offering 24h emergency, but the whole page just repeats 'Call Us Now' — no online booking, no form, no missed-call text-back. Every unanswered emergency call is money handed to the next electrician on the list." } },
  { id: "dna-electric-manhattan", name: "D & A Electric", niche: "homeservices", city: "New York", area: "Harlem / Manhattan", site: "https://www.dnaelectric.com/services/manhattan-ny", decisor: "", phone: "17185882822", wa: false, email: "jamal@dnaelectric.com", heat: "hot",
    obs: { pt: "FAQ do próprio site: 'Scheduling with us is simple. Just call.' Agendamento e orçamento só por telefone, sem booking online nem retorno de chamada perdida — se ninguém atende, o orçamento nunca acontece e não há follow-up.", en: "Their own FAQ says: 'Scheduling with us is simple. Just call.' Scheduling and quotes are phone-only, with no online booking and no missed-call text-back — if nobody answers, the quote never happens and there is no follow-up." } },
  { id: "rb-mechanical-harlem", name: "RB Mechanical Plumbing & Heating", niche: "homeservices", city: "New York", area: "East Harlem", site: "https://rbplumbingnyc.com/boiler-repair-east-harlem-ny/", decisor: "", phone: "16469965806", wa: false, email: "", heat: "warm",
    obs: { pt: "Se posiciona como reparo de caldeira 'prompt' pra Harlem, mas o site mostra horário 8h-19h e fechado aos domingos — justamente quando caldeira quebra no frio. Intake só por telefone/formulário; a emergência de domingo vai pro concorrente.", en: "Positions itself as 'prompt' boiler repair for Harlem, but the site lists 8am-7pm hours and closed Sundays — exactly when a boiler dies in the cold. Intake is phone/form only; the Sunday emergency goes to a competitor." } },
  { id: "above-beyond-plumbing-heating-brooklyn", name: "Above & Beyond Plumbing & Heating", niche: "homeservices", city: "New York", area: "Brooklyn", site: "https://abovebeyondplumbing.com", decisor: "", phone: "17184844911", wa: false, email: "abovebeyondplumbing@gmail.com", heat: "hot",
    obs: { pt: "O site promete '24/7 EMERGENCY SERVICE, 365 DAYS A YEAR' mas o único caminho é 'Call for Emergency Plumbing' num número só — sem retorno automático de chamada perdida, toda emergência fora do horário que cai na caixa postal vai pro concorrente.", en: "The site promises '24/7 EMERGENCY SERVICE, 365 DAYS A YEAR' but the only path is 'Call for Emergency Plumbing' on a single line — no missed-call text-back, so every after-hours emergency that hits voicemail goes to the next company." } },
  { id: "ny-hvac-services-astoria", name: "NY HVAC Services", niche: "homeservices", city: "New York", area: "Astoria", site: "https://www.nyhvacservicesinc.com", decisor: "", phone: "17187516728", wa: false, email: "", heat: "hot",
    obs: { pt: "Família com quase 30 anos em Astoria que anuncia '24 Hour Emergency Service', mas só atende por telefone — não há agendamento online nem retorno de chamada perdida, então ligação de emergência de madrugada some sem rastro.", en: "Family shop of nearly 30 years in Astoria advertising '24 Hour Emergency Service,' but intake is phone-only — no online booking and no missed-call text-back, so a middle-of-the-night emergency call just vanishes." } },
  { id: "york-electrical-flushing", name: "York Electrical Contractors Inc.", niche: "homeservices", city: "New York", area: "Flushing", site: "https://www.yorkelectrical.com", decisor: "", phone: "17183537227", wa: false, email: "yorkelectrical@yahoo.com", heat: "hot",
    obs: { pt: "Site oferece '24/7 Emergency Service' com aviso de que 'after-hour rates may apply', mas o contato é só telefone/texto manual — nenhuma captura automática fora do horário, o cliente que não é atendido liga pro próximo eletricista.", en: "Site offers '24/7 Emergency Service' and warns 'after-hour rates may apply,' but contact is manual phone/text only — no automated after-hours capture, so an unanswered caller just dials the next electrician." } },
  { id: "e-mule-son-plumbing-middle-village", name: "E. Mule & Son Plumbing & Heating Inc", niche: "homeservices", city: "New York", area: "Middle Village", site: "https://www.emuleandsonplumbingandheating.com", decisor: "", phone: "17182857469", wa: false, email: "muleplumbing1994@gmail.com", heat: "hot",
    obs: { pt: "Familiar há 35+ anos anunciando '24/7 Emergency Service', mas o formulário de retorno só diz que vai 'get back to you as soon as possible' — sem resposta instantânea, pedidos de orçamento e emergência ficam na fila enquanto o concorrente já atendeu.", en: "Family-run for 35+ years advertising '24/7 Emergency Service,' yet the callback form only says they'll 'get back to you as soon as possible' — no instant response, so quote and emergency requests sit in a queue while a competitor already picked up." } },
  { id: "absolute-electrical-park-slope", name: "Absolute Electrical Service Inc.", niche: "homeservices", city: "New York", area: "Park Slope", site: "https://www.absoluteelectricny.com", decisor: "", phone: "17182299300", wa: false, email: "", heat: "hot",
    obs: { pt: "Promete '24/7 Emergency Service' e diz 'contact us anytime, even in the middle of the night', mas só por telefone/formulário — orçamento e emergência dependem de alguém atender, sem texto automático de chamada perdida pra segurar o lead de madrugada.", en: "Promises '24/7 Emergency Service' and says 'contact us anytime, even in the middle of the night,' but only by phone/form — quotes and emergencies depend on someone answering, with no missed-call text-back to hold the lead overnight." } },
  { id: "bob-mims-heating-air-bay-ridge", name: "Bob Mims Heating & Air Conditioning", niche: "homeservices", city: "New York", area: "Bay Ridge", site: "https://www.bobmims.com", decisor: "", phone: "17182738175", wa: false, email: "", heat: "warm",
    obs: { pt: "Diz atender '24/7, 365 Days a Year', mas o mesmo-dia só é garantido pra ligações antes das 15h E com o plano pago 'Priority Comfort Club' — quem liga tarde ou fora do horário cai pra depois e pode procurar outro.", en: "Claims to answer '24/7, 365 Days a Year,' but same-day is only guaranteed for calls before 3 PM AND with the paid 'Priority Comfort Club' plan — anyone calling late or after-hours gets pushed to later and may shop elsewhere." } },

  // ── NYC RESTAURANTS (batch 4, verified 2026-07-30) ───────────────────────────
  { id: "ponte-vecchio-bay-ridge", name: "Ponte Vecchio", niche: "restaurant", city: "New York", area: "Bay Ridge", site: "https://www.pvristorante.com/", decisor: "", phone: "17182386449", wa: false, email: "info@pvristorante.com", heat: "hot",
    obs: { pt: "No site deles a entrega é feita só via Grubhub e Seamless, que comem margem em cada pedido, e reserva é por telefone/OpenTable — num lugar de frutos do mar cheio há 35+ anos, a linha não para no rush.", en: "Their own site pushes delivery only through Grubhub and Seamless, which skim margin on every order, and reservations are by phone/OpenTable — at a packed 35-plus-year seafood spot the line doesn't stop during the rush." } },
  { id: "montes-trattoria-greenwich-village", name: "Monte's Trattoria", niche: "restaurant", city: "New York", area: "Greenwich Village", site: "https://montestrattorianyc.com/", decisor: "Pietro Mosconi", phone: "12126749456", wa: false, email: "contact@montestrattorianyc.com", heat: "warm",
    obs: { pt: "Trattoria familiar desde 1918 onde o Chef Pietro Mosconi fica na sala conversando com os clientes — reserva depende do telefone, e quem está na sala não consegue atender a ligação no pico do jantar.", en: "Family trattoria since 1918 where Chef Pietro Mosconi works the dining room chatting with guests — reservations lean on the phone, and whoever's on the floor can't pick up the call at the dinner peak." } },
  { id: "via-della-pace-east-village", name: "Via Della Pace", niche: "restaurant", city: "New York", area: "East Village", site: "https://viadellapacenyc.com/", decisor: "", phone: "12122535803", wa: false, email: "vdpnyc@yahoo.com", heat: "hot",
    obs: { pt: "O contato deles ainda é um email @yahoo e o lugar é só dinheiro (cash only) — sinal claro de operação sem tecnologia; reserva por telefone, então chamada perdida no rush é mesa perdida.", en: "Their contact is still a @yahoo email and the place is cash only — a clear low-tech operation; reservations are by phone, so a missed call during the rush is a lost table." } },
  { id: "ginos-restaurant-bay-ridge", name: "Gino's Restaurant", niche: "restaurant", city: "New York", area: "Bay Ridge", site: "https://www.ginosbayridge.com/", decisor: "", phone: "17187481698", wa: false, email: "ginos7414@gmail.com", heat: "warm",
    obs: { pt: "Instituição familiar de Bay Ridge desde 1964 que ainda toca reservas e pedidos pelo telefone com um email @gmail — nas noites de família lotadas ninguém consegue atender cada ligação.", en: "A Bay Ridge family institution since 1964 still running reservations and orders through the phone with a @gmail address — on packed family-dinner nights nobody can answer every call." } },
  { id: "lavagna-east-village", name: "Lavagna", niche: "restaurant", city: "New York", area: "East Village", site: "https://www.lavagnanyc.com/", decisor: "", phone: "12129791005", wa: false, email: "", heat: "warm",
    obs: { pt: "Toda a entrega/delivery do site cai em DoorDash e Caviar, que raspam margem em cada pedido — uma trattoria pequena e íntima com espaço de sobra pra vender direto e por reserva no telefone.", en: "All the site's takeout/delivery routes through DoorDash and Caviar, which shave margin on every order — a small, intimate trattoria with plenty of room to sell direct and take bookings off the phone." } },
  { id: "enzos-arthur-avenue-bronx", name: "Enzo's of Arthur Avenue", niche: "restaurant", city: "New York", area: "Arthur Avenue (Belmont, Bronx)", site: "https://www.enzosofarthuravenue.com/", decisor: "", phone: "17187334455", wa: false, email: "", heat: "hot",
    obs: { pt: "No site só tem um jeito de reservar: ligar. Não há reserva online nem pedido online, e eles ainda recusam Apple Pay/pagamento por aproximação. No pico do jantar da Arthur Ave, cada ligação não atendida é uma mesa perdida.", en: "The site offers exactly one way to book: call. There's no online reservation and no online ordering, and they even refuse Apple Pay/contactless. During the Arthur Ave dinner rush, every unanswered call is a lost table." } },
  { id: "alley-41-flushing-queens", name: "Alley 41", niche: "restaurant", city: "New York", area: "Flushing, Queens", site: "https://www.alley41.com/", decisor: "", phone: "17183533608", wa: false, email: "", heat: "hot",
    obs: { pt: "O site não tem reserva própria; para pedir, ele empurra o cliente pra Chowbus, DoorDash, Postmates, Ritual e Uber Eats — cinco apps que comem a margem. A única alternativa listada é 'Call Us', ou seja, telefone no auge do movimento.", en: "The site has no reservation system of its own; to order it pushes you to Chowbus, DoorDash, Postmates, Ritual and Uber Eats — five apps all skimming margin. The only alternative listed is 'Call Us', i.e. the phone at peak hours." } },
  { id: "nocciola-east-harlem-manhattan", name: "Nocciola Ristorante", niche: "restaurant", city: "New York", area: "East Harlem, Manhattan", site: "https://nocciolanyc.com/", decisor: "", phone: "16465595304", wa: false, email: "contact@nocciolanyc.com", heat: "hot",
    obs: { pt: "O próprio site diz 'Call to Inquire' — reserva e catering são só por telefone, e eles avisam que o lugar tem poucos lugares e 'recomendam fortemente reservar'. Delivery só via GrubHub/Seamless/Delivery.com, comendo margem. Uma ligação perdida = mesa perdida num salão já pequeno.", en: "The site itself says 'Call to Inquire' — reservations and catering are phone-only, and they warn seating is limited and 'strongly recommend reservations.' Delivery runs only through GrubHub/Seamless/Delivery.com, eating margin. A missed call = a lost table in an already small room." } },
  { id: "raices-colombianas-jackson-heights-queens", name: "Raices Colombianas", niche: "restaurant", city: "New York", area: "Jackson Heights, Queens", site: "https://raicescolombianasrestaurant.com/", decisor: "", phone: "17187797595", wa: false, email: "", heat: "warm",
    obs: { pt: "Os botões 'Reserve Now' do site não abrem reserva nenhuma — jogam pra página de contato, ou seja, reserva é só por telefone/formulário. O pedido online é terceirizado pro SpotOn. Sem ninguém atendendo no pico, a reserva simplesmente não acontece.", en: "The site's 'Reserve Now' buttons don't open any booking — they dump you on the contact page, so reservations are phone/form only. Online ordering is outsourced to SpotOn. With no one answering at peak, the reservation simply never happens." } },
  { id: "manettas-ristorante-lic-queens", name: "Manetta's Ristorante", niche: "restaurant", city: "New York", area: "Long Island City, Queens", site: "https://manettaslic.com/", decisor: "", phone: "17187866171", wa: false, email: "manettaslic@gmail.com", heat: "warm",
    obs: { pt: "O delivery no site só sai por Grubhub, Slice e DoorDash — três apps comendo margem em todo pedido. E para eventos a única instrução é 'Call today', ou seja, festa grande só fecha por telefone; se ninguém atende no rush, o evento vai pro concorrente.", en: "Delivery on the site runs only through Grubhub, Slice and DoorDash — three apps eating margin on every order. And for events the only instruction is 'Call today', so a big party can only close by phone; if no one answers during the rush, that event goes to a competitor." } },

  // ── CHICAGO MED SPAS (batch 5, verified 2026-07-30) ──────────────────────────
  { id: "river-north-wellness-medspa", name: "River North Wellness and Medspa", niche: "medical", city: "Chicago", area: "River North", site: "https://rnmedspa.com", decisor: "Humera Khan", phone: "13125449196", wa: false, email: "rivernorthmedspa@gmail.com", heat: "hot",
    obs: { pt: "Estúdio de uma esteticista só (Humera Khan) e o contato é um Gmail pessoal — enquanto ela atende, a ligação de agendamento fica sem resposta.", en: "Solo-esthetician studio (Humera Khan) whose only contact is a personal Gmail — while she's with a client, the booking call goes unanswered." } },
  { id: "h-med-spa-wicker-park", name: "H Med Spa", niche: "medical", city: "Chicago", area: "Wicker Park", site: "https://www.hmedicalspa.com", decisor: "", phone: "17736978316", wa: false, email: "1755chi@hmedicalspa.com", heat: "hot",
    obs: { pt: "Sem agendamento online no site: só telefone, e-mail ou texto pra marcar — cada ligação perdida é cliente perdido.", en: "No online booking on the site: appointments only by phone, email or text — every missed call is a lost client." } },
  { id: "beautify-chi-medspa", name: "Beautify CHI Med Spa", niche: "medical", city: "Chicago", area: "West Town / Wicker Park", site: "https://beautifychi.com", decisor: "", phone: "13127963949", wa: false, email: "", heat: "hot",
    obs: { pt: "Reserva só por formulário, telefone/texto ou DM no Instagram; não há agenda online, então marcar depende de alguém responder.", en: "Booking only via form, phone/text or Instagram DM; there is no online calendar, so getting a slot depends on someone replying." } },
  { id: "luxura-medspa-lakeview", name: "Luxura Med Spa (inside Robert Jeffrey Salon)", niche: "medical", city: "Chicago", area: "Lakeview", site: "https://luxuramedspa.com/locations/robert-jeffrey-salon-lakeview/", decisor: "", phone: "17734537500", wa: false, email: "", heat: "hot",
    obs: { pt: "O med spa funciona dentro do Robert Jeffrey Salon e é 'só com hora marcada', mas o site nem lista horários — quem liga cai na recepção do salão.", en: "The med spa runs inside Robert Jeffrey Salon and is 'by appointment only,' yet the site lists no hours — callers land on the salon's front desk." } },
  { id: "better-medspa-lincoln-park", name: "Better Med Spa & Wellness", niche: "medical", city: "Chicago", area: "Lincoln Park", site: "https://www.bettermedspa.com", decisor: "Dr. Brett Brechner", phone: "13122852618", wa: false, email: "hello@bettermedspa.com", heat: "warm",
    obs: { pt: "Exige consulta paga antes de quase todo tratamento e joga o cliente num painel Boulevard externo — fricção que derruba o agendamento fora do horário.", en: "Requires a paid consult before almost every treatment and pushes clients to an external Boulevard dashboard — friction that kills after-hours booking." } },
  { id: "opulence-chicago-west-loop", name: "Opulence Chicago", niche: "medical", city: "Chicago", area: "West Loop", site: "https://www.opulencechicago.com", decisor: "", phone: "13123405948", wa: false, email: "", heat: "warm",
    obs: { pt: "Nenhum e-mail público no site; a agenda fica num portal Zenoti externo — quem chega fora do horário só tem o telefone.", en: "No public email on the site; the calendar lives on an external Zenoti portal — anyone arriving after hours only has the phone." } },
  { id: "goldcoast-medspa", name: "GOLDCOAST Medspa", niche: "medical", city: "Chicago", area: "Gold Coast / Streeterville", site: "https://www.goldcoastmedspa.com", decisor: "", phone: "13126642128", wa: false, email: "", heat: "hot",
    obs: { pt: "Não aceita walk-in e não tem agenda online: só formulário de contato ou ligar — fora do horário (fecha domingo) ninguém consegue marcar.", en: "No walk-ins and no online scheduling: only a contact form or a phone call — after hours (closed Sundays) no one can book." } },
  { id: "dr-yates-lifestyle-medspa", name: "Dr. Yates Lifestyle Med Spa", niche: "medical", city: "Chicago", area: "Downtown / New East Side", site: "https://www.dryateslifestylemed.com", decisor: "Dr. William Yates", phone: "13122610872", wa: false, email: "info@dryateshairscience.com", heat: "hot",
    obs: { pt: "Só formulário de 'pedir consulta', sem agenda online real — o cliente preenche e fica esperando a equipe ligar de volta.", en: "Only a 'request a consultation' form, no real online calendar — the client fills it out and waits for staff to call back." } },
  { id: "arabella-boutique-medspa", name: "Arabella Boutique Med Spa", niche: "medical", city: "Chicago", area: "Oak Brook Terrace", site: "https://arabellaboutiquemedspa.com", decisor: "", phone: "13312777221", wa: false, email: "arabellaboutiquemedspa@gmail.com", heat: "hot",
    obs: { pt: "Provedora única, e-mail é Gmail pessoal e o site mostra horários conflitantes ('segunda sem atendimento', sábado 'uma vez por mês') — confusão que espanta agendamento.", en: "Single provider, personal-Gmail contact, and the site shows conflicting hours ('Monday no appts,' Saturday 'once a month') — confusion that scares off bookings." } },
  { id: "lifesculpt-naperville", name: "LifeSculpt", niche: "medical", city: "Chicago", area: "Naperville", site: "https://mylifesculpt.com", decisor: "", phone: "16304919946", wa: false, email: "info@mylifesculpt.com", heat: "hot",
    obs: { pt: "Promete 'consulta na mesma semana', mas não tem agenda em tempo real: tudo é formulário de 'solicitar consulta' ou ligar.", en: "Promises 'same-week appointments' but has no real-time calendar: everything is a 'request a consultation' form or a phone call." } },
  { id: "blue-seas-medspa-naperville", name: "Blue Seas Med Spa", niche: "medical", city: "Chicago", area: "Naperville", site: "https://blueseasmedspa.com", decisor: "", phone: "16303692767", wa: false, email: "", heat: "warm",
    obs: { pt: "Nenhum contato por e-mail no site; ou usa o widget Boulevard ou liga — sem canal assíncrono pra quem não quer telefonar.", en: "No email contact on the site; you either use the Boulevard widget or call — no async channel for anyone who doesn't want to phone." } },
  { id: "pure-medical-spa-gold-coast", name: "PURE Medical Spa (Gold Coast)", niche: "medical", city: "Chicago", area: "Gold Coast", site: "https://www.medspagoldcoast.com", decisor: "", phone: "13128787573", wa: false, email: "", heat: "warm",
    obs: { pt: "CTA de agendar online, mas sem formulário embutido na página — o cliente tem que clicar pra um sistema externo ou ligar, fricção que perde marcação.", en: "An online-booking CTA but no embedded form on the page — the client must click through to an external system or call, friction that loses bookings." } },

  // ── MIAMI HAIR SALONS (batch 5, verified 2026-07-30) ─────────────────────────
  { id: "studio-n-salon-wynwood", name: "Studio N Salon", niche: "salon", city: "Miami", area: "Wynwood", site: "https://studionsalon.com", decisor: "Natalie Peacock & Nichola Lynch", phone: "13056324999", wa: false, email: "", heat: "hot",
    obs: { pt: "Coletivo de cabeleireiros independentes: pra marcar você tem que 'falar direto com seu stylist' — enquanto ele está com cliente, a ligação e o DM ficam sem resposta.", en: "Collective of independent stylists: to book you must 'contact your stylist directly' — while they're with a client, the call and the DM go unanswered." } },
  { id: "la-frange-hair-studio-wynwood", name: "La Frange Hair Studio", niche: "salon", city: "Miami", area: "Wynwood", site: "https://www.lafrangehairstudio.com", decisor: "", phone: "17869727786", wa: false, email: "lafrangehairstudio@gmail.com", heat: "hot",
    obs: { pt: "O contato é um Gmail pessoal e eles mesmos dizem que 'levam tempo com cada cliente' — cadeira cheia = telefone tocando sem ninguém atender.", en: "Contact is a personal Gmail and they say themselves they 'take our time with each client' — full chairs means the phone rings with no one to answer." } },
  { id: "wynwood-hair-co", name: "Wynwood Hair Co.", niche: "salon", city: "Miami", area: "Wynwood", site: "https://www.wynwoodhairco.com", decisor: "", phone: "13053990321", wa: false, email: "", heat: "warm",
    obs: { pt: "Sem e-mail no site e reserva só pelo app Aura ou ligação — coletivo de stylists, então quem liga durante um atendimento não é atendido.", en: "No email on the site and booking only via the Aura app or a call — a stylist collective, so anyone calling mid-service isn't picked up." } },
  { id: "beach-hair-salon-miami-beach", name: "Beach Hair Salon", niche: "salon", city: "Miami", area: "Miami Beach", site: "https://beachhairsalon.com", decisor: "", phone: "17863555468", wa: false, email: "", heat: "warm",
    obs: { pt: "Só telefone ou o sistema Booker; nenhum e-mail — a ligação de marcação enquanto os stylists estão com clientes se perde.", en: "Only phone or the Booker system; no email — the booking call while stylists are with clients gets lost." } },
  { id: "havana-hair-studio-coral-gables", name: "Havana Hair Studio", niche: "salon", city: "Miami", area: "Coral Gables", site: "", decisor: "Marlon Allegue", phone: "17866412925", wa: false, email: "", heat: "hot",
    obs: { pt: "Studio de um cabeleireiro só (Marlon Allegue) que agenda pelo Instagram e 'para citas' por ligação — sem agenda online, cada DM/ligação não respondida é cliente perdido.", en: "One-stylist studio (Marlon Allegue) booking through Instagram and 'para citas' by phone — no online calendar, so every unanswered DM/call is a lost client." } },
  { id: "studio-d-brickell", name: "Studio-D Brickell", niche: "salon", city: "Miami", area: "Brickell", site: "https://www.studio-dbrickell.com", decisor: "", phone: "13053494969", wa: false, email: "", heat: "warm",
    obs: { pt: "Tem Instagram ativo mas não aceita marcação por DM; fora o Mangomint, é ligar — DM de cliente fica sem resposta.", en: "Has an active Instagram but takes no DM booking; apart from Mangomint it's a phone call — client DMs go unanswered." } },
  { id: "stubborn-hair-wynwood", name: "Stubborn Hair", niche: "salon", city: "Miami", area: "Wynwood / Edgewater", site: "https://www.stubbornhair.com", decisor: "Eddie (Eyad)", phone: "13054578272", wa: false, email: "eddiealta@stubbornhair.com", heat: "hot",
    obs: { pt: "Um stylist só (Eddie): o próprio site diz 'agenda concorrida e disponibilidade limitada' — sem ninguém atendendo, a ligação e o pedido de horário se perdem.", en: "A single stylist (Eddie): the site itself says 'high demand and limited availability' — with no one answering, the call and the booking request slip away." } },
  { id: "the-curl-whisperer-miami", name: "The Curl Whisperer", niche: "salon", city: "Miami", area: "Coral Way / Miami", site: "https://thecurlwhisperer.com", decisor: "", phone: "13053314053", wa: false, email: "", heat: "warm",
    obs: { pt: "Sem e-mail e sem opção de DM no site; fora o Meevo, só o telefone — especialista em cachos com cadeira sempre cheia perde a ligação.", en: "No email and no DM option on the site; apart from Meevo it's only the phone — a curl specialist with a constantly full chair misses the call." } },
  { id: "ela-salon-coconut-grove", name: "ELA Salon", niche: "salon", city: "Miami", area: "Coconut Grove", site: "", decisor: "", phone: "13054454000", wa: false, email: "", heat: "hot",
    obs: { pt: "Sem site próprio: só Instagram, e 'for appointments call or text' — nenhuma agenda online, a marcação depende de alguém ver a mensagem.", en: "No website of their own: just Instagram, and 'for appointments call or text' — no online calendar, booking depends on someone seeing the message." } },
  { id: "ninette-hair-studio-miami", name: "Ninette Hair Studio", niche: "salon", city: "Miami", area: "Miami", site: "https://www.ninettestudio.com", decisor: "Giannina Montanari", phone: "", wa: false, email: "", heat: "warm",
    obs: { pt: "O site não lista telefone nem endereço — só um 'Book Now' online; a dona (Giannina Montanari) não tem canal de voz, então quem prefere ligar não tem pra quem.", en: "The site lists no phone and no address — only an online 'Book Now'; the owner (Giannina Montanari) has no voice channel, so anyone who'd rather call has no one to reach." } },

  // ── 🇧🇷 CUIABÁ, MT — CLÍNICAS DE ESTÉTICA (batch 6, verified 2026-07-30) ──────
  { id: "elleve-beauty-selfcare", name: "Elleve Beauty & Selfcare", niche: "medical", city: "Cuiabá, MT", area: "Jardim Itália", site: "https://ellevebeauty.com.br/", decisor: "Dra. Tassia Poit", phone: "5565999715433", wa: true, email: "contato@ellevebeauty.com.br", heat: "hot",
    obs: { pt: "Clínica de dermatologia estética de médica única. O formulário do site só redireciona pro WhatsApp, não tem agenda online de verdade — enquanto a Dra. Tassia atende, a mensagem de quem quer botox fica sem resposta.", en: "Dermatology-led med spa run by a single doctor. The site form just redirects to WhatsApp, with no real online booking — while Dr. Tassia is with a patient, the message from someone wanting Botox goes unanswered." } },
  { id: "aline-dalavia-estetica", name: "Clínica Dra. Aline Dalávia - Estética Avançada", niche: "medical", city: "Cuiabá, MT", area: "Jardim das Américas", site: "https://alinedalavia.com.br/", decisor: "Dra. Aline Dalávia", phone: "5565993290138", wa: true, email: "", heat: "hot",
    obs: { pt: "Site diz na cara que não há agendamento online: consulta só por WhatsApp ou telefone. Médica sozinha na clínica — cada mensagem perdida é um preenchimento ou botox que fecha no concorrente.", en: "The site plainly states there is no online booking: consultations only by WhatsApp or phone. A single doctor running the clinic — every missed message is a filler or Botox that closes with a competitor." } },
  { id: "rosa-limao-estetica", name: "Rosa Limão Estética", niche: "medical", city: "Cuiabá, MT", area: "Bosque da Saúde", site: "https://www.rosalimaocuiaba.com.br/", decisor: "Regianne Correa Menezes", phone: "5565992250342", wa: true, email: "rosalimao2901@gmail.com", heat: "hot",
    obs: { pt: "Agenda 100% pelo WhatsApp, sem nenhum sistema online, e o contato oficial é um Gmail pessoal. A própria dona responde entre um atendimento e outro — o que vaza é receita.", en: "Booking is 100% over WhatsApp with no online system, and the official contact is a personal Gmail. The owner herself answers between appointments — whatever leaks is lost revenue." } },
  { id: "spazzio-corpus-cuiaba", name: "Spazzio Corpus - Estética de Resultado", niche: "medical", city: "Cuiabá, MT", area: "Baú", site: "https://www.clinicaspazziocorpus.com.br/", decisor: "", phone: "5565981291216", wa: true, email: "spazziocorpus@gmail.com", heat: "hot",
    obs: { pt: "Sem agendamento online, só WhatsApp e telefone, e o único e-mail divulgado é um Gmail. No horário de pico as mensagens acumulam e ninguém confirma o retorno.", en: "No online booking, just WhatsApp and phone, and the only email listed is a Gmail. At peak hours messages pile up and no one confirms follow-ups." } },
  { id: "clinica-idea-cuiaba", name: "Clínica IDEA - Instituto de Dermatologia e Estética", niche: "medical", city: "Cuiabá, MT", area: "Alvorada", site: "https://www.clinicaidea.com.br/", decisor: "Dra. Graciela Araújo do Espírito Santo", phone: "5565984797044", wa: true, email: "", heat: "hot",
    obs: { pt: "Dois médicos atendendo dermatologia e estética, e ainda assim a marcação é só por WhatsApp, sem agenda online. Com dois consultórios cheios, a fila de mensagens fica sem quem responda.", en: "Two doctors handling dermatology and aesthetics, yet booking is WhatsApp-only with no online scheduler. With two full rooms, the message queue has no one to answer it." } },
  { id: "tatiana-daltro-monteiro", name: "Dra. Tatiana Daltro Monteiro - Odontologia e Harmonização Facial", niche: "medical", city: "Cuiabá, MT", area: "Duque de Caxias", site: "https://dratatianadm.lovable.app/", decisor: "Dra. Tatiana Daltro Monteiro", phone: "5565993251109", wa: true, email: "", heat: "hot",
    obs: { pt: "Harmonização facial marcada só por WhatsApp/telefone, sem nenhuma confirmação automática. Dentista sozinha na cadeira: perde ligação durante o procedimento e ainda leva no-show por falta de lembrete.", en: "Facial harmonization booked only by WhatsApp/phone, with no automatic confirmation. A solo dentist in the chair: she misses calls mid-procedure and eats no-shows for lack of reminders." } },
  { id: "clinica-sante-danielle-fischer", name: "Clínica Santé - Dra. Danielle Fischer", niche: "medical", city: "Cuiabá, MT", area: "Popular", site: "https://dradaniellefischer.com.br/", decisor: "Dra. Danielle Fischer", phone: "5565992482826", wa: true, email: "", heat: "hot",
    obs: { pt: "Harmonização e botox marcados por WhatsApp e formulário, sem agenda online real. A médica atende e responde as mensagens sozinha — mistura de odonto e estética que sobrecarrega um número só.", en: "Harmonization and Botox booked via WhatsApp and a form, with no real online calendar. The doctor treats and answers messages herself — a dentistry-plus-aesthetics mix overloading a single number." } },
  { id: "clinica-mariana-mickaela", name: "Clínica Mariana Mickaela", niche: "medical", city: "Cuiabá, MT", area: "Morada da Serra", site: "https://www.marianamickaela.com.br/", decisor: "Dra. Mariana Mickaela", phone: "5565981553050", wa: true, email: "", heat: "warm",
    obs: { pt: "Tem 'agendamento online' no site, mas o canal real é o WhatsApp da própria Dra. Mariana. Sem lembrete ou confirmação automática, corre risco de falta em procedimento de valor alto.", en: "The site shows 'online booking,' but the real channel is Dr. Mariana's own WhatsApp. With no automatic reminder or confirmation, high-ticket procedures risk no-shows." } },
  { id: "clinica-morgana-toniasso", name: "Clínica de Estética Avançada Morgana Toniasso", niche: "medical", city: "Cuiabá, MT", area: "Bosque da Saúde", site: "", decisor: "Morgana Toniasso", phone: "5565981127764", wa: true, email: "", heat: "warm",
    obs: { pt: "Clínica de harmonização de dona única (Morgana), agendamento obrigatório por contato direto e sem sistema online. Com a agenda cheia, a mensagem de novo cliente esbarra e esfria.", en: "Harmonization clinic run by a single owner (Morgana), booking required through direct contact with no online system. With a full calendar, a new client's message stalls and goes cold." } },
  { id: "clinic-pelle-cleibe-rodrigues", name: "Clinic Pelle Estética Avançada", niche: "medical", city: "Cuiabá, MT", area: "Jardim Paulista", site: "", decisor: "Dra. Cleibe Rodrigues", phone: "5565993100220", wa: true, email: "", heat: "warm",
    obs: { pt: "Harmonização facial que exige agendamento por contato direto, sem sistema online. Médica única em sala de edifício — quem liga no meio do atendimento não é retornado.", en: "Facial harmonization requiring booking through direct contact, with no online system. A solo doctor in an office suite — callers who ring mid-appointment never get called back." } },
  { id: "venesse-odontologia-estetica", name: "Venésse Odontologia & Estética", niche: "medical", city: "Cuiabá, MT", area: "Quilombo", site: "https://venesse.com.br/", decisor: "Dra. Daiane Feduk", phone: "5565981459448", wa: true, email: "", heat: "warm",
    obs: { pt: "Faz botox e preenchimento labial; o site tem agendamento mas o canal real é o WhatsApp. Sem lembrete automático, o encaixe é manual e a falta come a agenda.", en: "Offers Botox and lip filler; the site has booking but the real channel is WhatsApp. With no automatic reminder, slotting is manual and no-shows eat the calendar." } },
  { id: "estetic-face-cuiaba", name: "Estetic Face Cuiabá", niche: "medical", city: "Cuiabá, MT", area: "Duque de Caxias II", site: "", decisor: "", phone: "556521364261", wa: false, email: "", heat: "warm",
    obs: { pt: "Clínica de harmonização com só um telefone fixo divulgado e nenhum canal online. Quem liga fora do horário, ou enquanto a linha está ocupada, simplesmente não é retornado.", en: "Harmonization clinic with only a landline listed and no online channel. Anyone who calls off-hours, or while the line is busy, simply never gets called back." } },

  // ── 🇧🇷 VÁRZEA GRANDE, MT — SALÕES (batch 6, verified 2026-07-30) ─────────────
  { id: "mirian-carvalho-studio-beleza", name: "Mírian Carvalho Studio de Beleza", niche: "salon", city: "Várzea Grande, MT", area: "", site: "https://mirian-carvalho-studio-de-beleza.ueniweb.com/", decisor: "Mírian Carvalho", phone: "5565999674783", wa: true, email: "", heat: "hot",
    obs: { pt: "O 'site' é só uma página única de UENI e o agendamento é 100% por telefone/WhatsApp. Cabeleireira sozinha: perde ligação enquanto está com a cliente na cadeira.", en: "The 'site' is just a single UENI page and booking is 100% by phone/WhatsApp. A solo hairdresser: she misses calls while she has a client in the chair." } },
  { id: "salao-escola-belluks", name: "Salão e Escola Belluks", niche: "salon", city: "Várzea Grande, MT", area: "Coreto Sul", site: "", decisor: "", phone: "5565992015255", wa: true, email: "", heat: "warm",
    obs: { pt: "Salão e escola tocando dois movimentos num único celular, sem agenda online. Entre aula e atendimento, a mensagem no WhatsApp fica horas sem resposta.", en: "A salon-and-school juggling two operations on a single mobile, with no online calendar. Between class and service, the WhatsApp message sits unanswered for hours." } },
  { id: "requintes-cabeleireira-vg", name: "Requintes Cabeleireira", niche: "salon", city: "Várzea Grande, MT", area: "Mapim", site: "", decisor: "", phone: "556536845890", wa: false, email: "", heat: "warm",
    obs: { pt: "Listado só com telefone fixo no Mapim, sem WhatsApp nem agenda online divulgada. Cada ligação que toca enquanto a profissional está com o secador na mão é cliente que marca noutro lugar.", en: "Listed with only a landline in Mapim, no WhatsApp or online booking shown. Every call that rings while the stylist has a blow-dryer in hand is a client who books elsewhere." } },
  { id: "espaco-fashion-hair-vg", name: "Espaço Fashion Hair", niche: "salon", city: "Várzea Grande, MT", area: "Coreto Sul", site: "", decisor: "", phone: "556536823272", wa: false, email: "", heat: "warm",
    obs: { pt: "No Coreto Sul, aparece só com linha fixa e nenhum canal digital de agendamento. Sem ninguém na recepção, a ligação no meio do corte cai no vazio.", en: "In Coreto Sul, it shows up with only a landline and no digital booking channel. With no one at reception, a call in the middle of a haircut falls into the void." } },
  { id: "mary-instituto-beleza-vg", name: "Mary Instituto de Beleza", niche: "salon", city: "Várzea Grande, MT", area: "Centro", site: "", decisor: "", phone: "556536821288", wa: false, email: "", heat: "warm",
    obs: { pt: "Instituto no Centro divulgado apenas por telefone fixo, sem WhatsApp nem agenda online. Cliente que não completa a ligação desiste e procura o salão da esquina.", en: "A downtown institute listed only by landline, no WhatsApp or online calendar. A client who can't get through the call gives up and tries the salon next door." } },
  { id: "mara-duarte-salao-estetica", name: "Mara Duarte Salão e Estética", niche: "salon", city: "Várzea Grande, MT", area: "Centro", site: "", decisor: "Mara Duarte", phone: "556536825603", wa: false, email: "", heat: "warm",
    obs: { pt: "Salão da própria Mara no Centro, listado só com telefone fixo e sem canal online. Dona atendendo e cuidando da recepção ao mesmo tempo perde marcação toda vez que a linha ocupa.", en: "Mara's own downtown salon, listed with just a landline and no online channel. The owner serving clients and manning reception at once loses bookings every time the line is busy." } },
  { id: "visual-cabeleireiros-vg", name: "Visual Cabeleireiros", niche: "salon", city: "Várzea Grande, MT", area: "Coreto Sul", site: "", decisor: "", phone: "556536821393", wa: false, email: "", heat: "warm",
    obs: { pt: "Cabeleireiro tradicional do Coreto Sul com só telefone fixo divulgado, sem WhatsApp nem agendamento online. No sábado cheio, quem liga não consegue falar e não é retornado.", en: "A traditional Coreto Sul hairdresser with only a landline listed, no WhatsApp or online booking. On a packed Saturday, callers can't get through and never get a callback." } },
  { id: "baleza-pura-cabeleireiros-vg", name: "Baleza Pura Cabeleireiros", niche: "salon", city: "Várzea Grande, MT", area: "Coreto Sul", site: "", decisor: "", phone: "556530265012", wa: false, email: "", heat: "warm",
    obs: { pt: "Aparece só com linha fixa e sem nenhuma agenda digital. Salão de bairro com equipe pequena: enquanto todo mundo está atendendo, a ligação simplesmente não é atendida.", en: "Shows up with only a landline and no digital calendar. A small neighborhood salon: while everyone is serving clients, the incoming call simply goes unanswered." } },
  { id: "veronica-soares-davino-vg", name: "Verônica Soares Davino", niche: "salon", city: "Várzea Grande, MT", area: "Cristo Rei", site: "", decisor: "Verônica Soares Davino", phone: "556536855298", wa: false, email: "", heat: "warm",
    obs: { pt: "Salão da própria Verônica no Cristo Rei, divulgado só por telefone fixo e sem canal online. Profissional autônoma na tesoura: cada chamada perdida é um horário que fica vago.", en: "Verônica's own salon in Cristo Rei, listed only by landline with no online channel. A solo professional on the scissors: every missed call is a slot left empty." } },
  { id: "escort-cabeleireiros-vg", name: "Escort Cabeleireiros", niche: "salon", city: "Várzea Grande, MT", area: "Centro", site: "", decisor: "", phone: "556536828908", wa: false, email: "", heat: "warm",
    obs: { pt: "Cabeleireiro no Centro listado apenas com telefone fixo, sem WhatsApp nem agenda online. Sem recepção dedicada, a ligação no meio do atendimento vira cliente perdido.", en: "A downtown hairdresser listed with only a landline, no WhatsApp or online calendar. With no dedicated reception, a call mid-service becomes a lost client." } },
];

// ── READY-TO-USE material, baked from each lead (INSTANT — no network/AI needed) ──────────────
// "já deixa o brief tudo pronto pro vendedor": every card ships a finished cold email AND a
// one-page call brief the seller can copy and use immediately. The AI "refine" button is a bonus
// on top — these work offline, in the seller's language. Nothing invented: the email's first line
// and the brief's "likely pain" are the VERIFIED observation; gaps stay honest.

const firstName = (decisor) => {
  const n = (decisor || "").split("(")[0].trim();
  if (!n) return "";
  const parts = n.replace(/^(Dr\.|Dra\.|Dr|Dra)\s+/i, "").split(/\s+/);
  return parts[0] || "";
};
const obsOf = (lead, lang) => (lead.obs && (lead.obs[lang] || lead.obs.en || lead.obs.pt)) || "";

const EMAIL_TX = {
  pt: {
    subj: "recepção fora de hora no {name}?",
    greet: (nm) => (nm ? `${nm}, ` : "Olá, "),
    value: "A Guileo põe uma recepcionista de IA (voz + WhatsApp, em PT/ES/EN) que atende 24/7, agenda sozinha e liga de volta quando a linha está ocupada — um med spa parecido recupera o equivalente a ~$150 mil/ano em no-show e lead perdido.",
    cta: "Tem 15 min essa semana pra eu te mostrar rodando no site de vocês?",
  },
  en: {
    subj: "after-hours front desk at {name}?",
    greet: (nm) => (nm ? `${nm}, ` : "Hi, "),
    value: "Guileo adds an AI receptionist (voice + WhatsApp, in EN/ES/PT) that answers 24/7, books on its own, and calls back when the line is busy — a similar med spa recovers around $150K/year in no-shows and lost leads.",
    cta: "Do you have 15 minutes this week for me to show it running on your own site?",
  },
  es: {
    subj: "¿recepción fuera de horario en {name}?",
    greet: (nm) => (nm ? `${nm}, ` : "Hola, "),
    value: "Guileo pone una recepcionista de IA (voz + WhatsApp, en ES/EN/PT) que atiende 24/7, agenda sola y devuelve la llamada cuando la línea está ocupada — un med spa similar recupera unos $150 mil/año en ausencias y leads perdidos.",
    cta: "¿Tienes 15 minutos esta semana para mostrártelo funcionando en tu propio sitio?",
  },
};
EMAIL_TX.hi = EMAIL_TX.en;

// A finished cold email string (subject + body), <100 words, first line = the real observation.
export function buildEmail(lead, lang = "pt", sellerName = "") {
  const tx = EMAIL_TX[lang] || EMAIL_TX.pt;
  const sig = sellerName ? `${sellerName}, Guileo` : "Guileo";
  const subject = tx.subj.replace("{name}", lead.name);
  const body = `${tx.greet(firstName(lead.decisor))}${obsOf(lead, lang)}\n\n${tx.value}\n\n${tx.cta}\n— ${sig}`;
  return { subject, body, full: `${subject}\n\n${body}` };
}

const BRIEF_TX = {
  pt: {
    biz: "NEGÓCIO", dec: "DECISOR", decGap: "não público — confirme na ligação",
    pain: "PROVÁVEL DOR (o que você viu)", tries: "O QUE JÁ TENTAM",
    triesTxt: "Responder manualmente entre atendimentos; talvez uma recepção part-time; lembretes na mão. Tudo dependente de pessoa.",
    open: "ABERTURA — 3 perguntas",
    q: [
      "Quando vocês estão com um cliente na cadeira, quem atende quem liga pra agendar?",
      "Quantas mensagens/ligações chegam depois das 18h ou no fim de semana — e o que acontece com elas?",
      "Hoje, quanto do agendamento passa por uma pessoa só?",
    ],
    angle: "ÂNGULO QUE FECHA",
    angleTxt: "Não venda \"uma IA\" — venda \"parar de perder lead à noite e cortar no-show\". Mostre a demo no SITE DELES (motor de demo da Guileo) + o número de no-show recuperado. Feche com trial/garantia de 30 dias.",
  },
  en: {
    biz: "BUSINESS", dec: "DECISION-MAKER", decGap: "not public — confirm on the call",
    pain: "LIKELY PAIN (what you saw)", tries: "WHAT THEY ALREADY TRY",
    triesTxt: "Answering manually between treatments; maybe a part-time front desk; reminders by hand. All person-dependent.",
    open: "OPENING — 3 questions",
    q: [
      "When you're with a client in the chair, who answers the people calling to book?",
      "How many messages/calls come in after 6pm or on weekends — and what happens to them?",
      "Today, how much of your booking runs through one person?",
    ],
    angle: "CLOSING ANGLE",
    angleTxt: "Don't sell \"an AI\" — sell \"stop losing leads at night and cut no-shows.\" Show the demo on THEIR OWN site (Guileo demo engine) + the recovered no-show number. Close with a 30-day trial/guarantee.",
  },
  es: {
    biz: "NEGOCIO", dec: "DECISOR", decGap: "no público — confírmalo en la llamada",
    pain: "DOLOR PROBABLE (lo que viste)", tries: "LO QUE YA INTENTAN",
    triesTxt: "Responder manualmente entre tratamientos; quizá una recepción part-time; recordatorios a mano. Todo depende de una persona.",
    open: "APERTURA — 3 preguntas",
    q: [
      "Cuando están con un cliente, ¿quién atiende a los que llaman para agendar?",
      "¿Cuántos mensajes/llamadas llegan después de las 18h o el fin de semana — y qué pasa con ellos?",
      "Hoy, ¿cuánto del agendamiento pasa por una sola persona?",
    ],
    angle: "ÁNGULO QUE CIERRA",
    angleTxt: "No vendas \"una IA\" — vende \"dejar de perder leads de noche y cortar ausencias.\" Muestra la demo en SU PROPIO sitio (motor de demo de Guileo) + el número de ausencias recuperadas. Cierra con prueba/garantía de 30 días.",
  },
};
BRIEF_TX.hi = BRIEF_TX.en;

// ── WHATSAPP OPENER ───────────────────────────────────────────────────────────
// In Brazil WhatsApp IS the channel — a blank chat is the seller freezing at the moment of contact.
// This builds a SHORT, ready-to-send opener personalized with the lead's REAL verified gap, following
// the Guileo doctrine: dor → ganho → uma pergunta. Never aggressive, never a wall of text.
const WA_TX = {
  pt: {
    hi: (nm) => (nm ? `Oi, ${nm}! ` : "Oi, tudo bem? "),
    gain: "A Guileo instala uma recepcionista de IA que atende no seu próprio WhatsApp 24/7, agenda sozinha e confirma o horário pra reduzir falta.",
    ask: "Posso te mostrar em 10 minutos, já com o nome do seu negócio?",
  },
  en: {
    hi: (nm) => (nm ? `Hi ${nm}! ` : "Hi there! "),
    gain: "Guileo adds an AI receptionist that answers on your own WhatsApp 24/7, books on its own and confirms appointments to cut no-shows.",
    ask: "Can I show you in 10 minutes, already branded with your business name?",
  },
  es: {
    hi: (nm) => (nm ? `¡Hola, ${nm}! ` : "¡Hola! "),
    gain: "Guileo instala una recepcionista de IA que atiende en tu propio WhatsApp 24/7, agenda sola y confirma la cita para reducir ausencias.",
    ask: "¿Te lo muestro en 10 minutos, ya con el nombre de tu negocio?",
  },
};
WA_TX.hi = WA_TX.en;

// The message text (plain, ready to send). Uses the lead's verified observation as the opening proof
// that the seller actually looked at their business — the single thing that earns a reply.
export function buildWhatsApp(lead, lang = "pt", sellerName = "") {
  const tx = WA_TX[lang] || WA_TX.pt;
  const who = firstName(lead.decisor);
  const gap = obsOf(lead, lang);
  const sig = sellerName ? `\n— ${sellerName}, Guileo` : "";
  return `${tx.hi(who)}${gap}\n\n${tx.gain}\n\n${tx.ask}${sig}`;
}

// wa.me deep link with the opener pre-filled. "" when the lead has no WhatsApp-capable number.
export function waLink(lead, lang = "pt", sellerName = "") {
  if (!lead || !lead.wa || !lead.phone) return "";
  return `https://wa.me/${lead.phone}?text=${encodeURIComponent(buildWhatsApp(lead, lang, sellerName))}`;
}

// A finished one-page call brief string the seller skims in 2 minutes.
export function buildBrief(lead, lang = "pt") {
  const b = BRIEF_TX[lang] || BRIEF_TX.pt;
  return [
    `${b.biz}: ${lead.name} — ${lead.area}, ${lead.city}`,
    `${b.dec}: ${lead.decisor || b.decGap}`,
    ``,
    `${b.pain}: ${obsOf(lead, lang)}`,
    `${b.tries}: ${b.triesTxt}`,
    ``,
    `${b.open}:`,
    ...b.q.map((q, i) => `  ${i + 1}. ${q}`),
    ``,
    `${b.angle}: ${b.angleTxt}`,
  ].join("\n");
}

// Group leads by city for the board header. Returns [{city, leads:[...]}].
export function leadsByCity(leads = LEADS) {
  const map = new Map();
  for (const l of leads) {
    if (!map.has(l.city)) map.set(l.city, []);
    map.get(l.city).push(l);
  }
  return [...map.entries()].map(([city, ls]) => ({ city, leads: ls }));
}
