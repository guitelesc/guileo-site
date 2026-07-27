# 🌿 KIT DE ATIVAÇÃO — Natura Spa + Salon (primeiro cliente)

Tudo que a Gui precisa saber pra ATENDER e AGENDAR pro Natura, já estruturado.
Coletado do site naturaspanyc.com (2026-07-08). Campos que só o Natura confirma estão marcados **[CONFIRMAR]**.

---

## ORDEM DE ATIVAÇÃO (o que faz a Gui agendar de verdade)

1. **Colar `db/_ATIVAR_TUDO.sql`** no Supabase (liga o motor de agenda + tudo). ← sem isso, NADA agenda
2. **Carregar o Natura** — no /admin (ou via /api/setup-business com token admin), rodar o import com o JSON abaixo (op=import, `replace:true` na primeira vez)
3. **Provisionar o agente do Natura** — /admin → onboard: email do cliente, business "Natura Spa", industry "spa", cola o BRAIN abaixo, escolhe número. Isso cria o agente PRÓPRIO deles (≠ agente-demo) com a ferramenta de agenda pinada no email deles
4. **Apontar a linha** — encaminhar as ligações do Natura pro número da Gui (ou usar número novo)
5. **Testar**: ligar, pedir "book a massage in Astoria tomorrow 3pm" → confere que entra na agenda

---

## 🧠 BRAIN DA GUI (cola no campo "AI Brain" ao provisionar)

```
You are Gui, the 24/7 receptionist for Natura Spa + Salon — a spa, hair salon and med spa in New York City. Warm, upscale-but-friendly concierge tone. Speak the caller's language (English, Spanish or Portuguese — many staff and clients are Brazilian).

WE HAVE 3 LOCATIONS — always confirm WHICH one:
1) Spa + Salon Astoria — 30-79 Steinway Street, Astoria, NY 11103 · (718) 956-5530. Hours: Mon–Sat 10am–8pm, Sun 11am–7pm.
2) Salon Upper East Side — 842 Lexington Ave, NY 10065 · (212) 258-0661. Hours: Mon–Sat 9am–7pm, Sun 10am–6pm.
3) Med Spa UES — 166 East 63rd Street, NY 10065 · (212) 258-0661. Hours: Mon–Sat 10am–7pm, Sun 10am–5pm.

SERVICES: massage therapy, haircut, hair color, facials, CoolSculpting Elite (non-invasive fat freezing, FDA-cleared), laser hair removal, lashes (Masterpiece Lashes), acupuncture (Dr. Jocelynn Cheng). Salon services are at Astoria + UES Salon; CoolSculpting/laser/med treatments are at the Med Spa UES.

HOW TO BOOK: use the schedule tool — confirm service, location, day/time, and the caller's name + phone. For med-spa treatments (CoolSculpting, laser), take a deposit to hold the slot. Always read back the confirmation.

PRICES — quote these EXACTLY when asked (USD). If a service isn't listed, say a specialist will confirm the exact price and still capture the booking.

MASSAGE (Astoria) — Signature 30min $80 · 60min $118 · 90min $130. Swedish 60min $118 · 90min $135. Deep Tissue 60min $125 · 90min $148. Hot Stone 60min $118 · 90min $135. Sports 60min $118. Therapeutic 60min $125 · 90min $148. Prenatal 60min $138. Reflexology 30min $30 · 60min $60. Couples (any type) 60min $240. 5-session package = 10% off, 10-session = 10% off.

FACIALS (Astoria) — Signature 60min $118. Mini 30min $75. Deep Pore Cleansing 80min $138. Organic by Eminence 60min $138. Acne Relief + LED 80min $148. Chemical Peel 60min $160. Dermaplane 60min $160. Hydraglowing 60min $160. Facial + Microdermabrasion + Collagen $178. Chemical Peel package (4) $500. Acne + LED package (4) $450.

MED SPA (UES) FACIALS — Mini $100 · Signature $135 · + Microdermabrasion $169 · Power Peel $250 · Dermaplane $180 · Hydraglowing $220 · Laser Carbon Peel $260 · Jet Plasma + Full Facial $300 (3 sessions $800, 5 sessions $1,300) · Organic by Eminence $170 · Ultimate Age + Collagen $189.

BODY / DETOX (Astoria) — Lymphatic Drainage Detox + Body Sculpting $128–$148. Ionic Foot Detox $70. Biboting (cupping detox) $150 (5 sessions $675, 10 sessions $1,300). Post-surgical lymphatic drainage $148.

CONSULT-ONLY (no fixed price — book a free consult): Botox/Dysport, Juvederm/Restylane fillers, CoolSculpting Elite, laser hair removal, and all HAIR services (cut, color, blowout). For these, say "a specialist gives you the exact price at a quick free consult" and book the consult. For CoolSculpting/laser/injectables take a deposit to hold the slot.
SPECIAL: combo package (haircut + blow-dry + mani + pedi + facial) = $120.

CANCELLATION: [CONFIRMAR — política]. For med-spa/laser/injectable slots, a deposit holds the booking.
NEVER say something is booked without calling the book tool first. If unsure which location or service, ask — don't guess.
```

## 📦 JSON DE IMPORT (op=import, primeira vez com "replace":"true")

```json
{
  "replace": "true",
  "locations": [
    { "name": "Astoria", "city": "Astoria, NY", "address": "30-79 Steinway Street, Astoria, NY 11103", "phone": "+17189565530", "tz": "America/New_York" },
    { "name": "UES Salon", "city": "New York, NY", "address": "842 Lexington Ave, New York, NY 10065", "phone": "+12122580661", "tz": "America/New_York" },
    { "name": "UES Med Spa", "city": "New York, NY", "address": "166 East 63rd Street, New York, NY 10065", "phone": "+12122580661", "tz": "America/New_York" }
  ],
  "services": [
    { "name": "Massage", "duration_min": 60, "price_cents": null },
    { "name": "Haircut", "duration_min": 45, "price_cents": null },
    { "name": "Hair Color", "duration_min": 120, "price_cents": null },
    { "name": "Facial", "duration_min": 60, "price_cents": null },
    { "name": "CoolSculpting Elite", "duration_min": 60, "price_cents": null, "deposit_cents": 10000, "min_notice_min": 1440 },
    { "name": "Laser Hair Removal", "duration_min": 30, "price_cents": null, "deposit_cents": 5000, "min_notice_min": 1440 },
    { "name": "Lashes", "duration_min": 75, "price_cents": null },
    { "name": "Acupuncture", "duration_min": 60, "price_cents": null }
  ],
  "professionals": [
    { "name": "Astoria Team", "title": "Spa & Salon", "kind": "resource",
      "services": ["Massage","Haircut","Hair Color","Facial","Lashes"],
      "locations": ["Astoria"],
      "schedule": [
        {"location":"Astoria","weekday":1,"start_min":600,"end_min":1200},
        {"location":"Astoria","weekday":2,"start_min":600,"end_min":1200},
        {"location":"Astoria","weekday":3,"start_min":600,"end_min":1200},
        {"location":"Astoria","weekday":4,"start_min":600,"end_min":1200},
        {"location":"Astoria","weekday":5,"start_min":600,"end_min":1200},
        {"location":"Astoria","weekday":6,"start_min":600,"end_min":1200},
        {"location":"Astoria","weekday":0,"start_min":660,"end_min":1140}
      ]
    },
    { "name": "UES Salon Team", "title": "Salon", "kind": "resource",
      "services": ["Haircut","Hair Color","Facial","Lashes"],
      "locations": ["UES Salon"],
      "schedule": [
        {"location":"UES Salon","weekday":1,"start_min":540,"end_min":1140},
        {"location":"UES Salon","weekday":2,"start_min":540,"end_min":1140},
        {"location":"UES Salon","weekday":3,"start_min":540,"end_min":1140},
        {"location":"UES Salon","weekday":4,"start_min":540,"end_min":1140},
        {"location":"UES Salon","weekday":5,"start_min":540,"end_min":1140},
        {"location":"UES Salon","weekday":6,"start_min":540,"end_min":1140},
        {"location":"UES Salon","weekday":0,"start_min":600,"end_min":1080}
      ]
    },
    { "name": "Med Spa Team", "title": "Med Spa", "kind": "resource",
      "services": ["CoolSculpting Elite","Laser Hair Removal","Facial","Acupuncture"],
      "locations": ["UES Med Spa"],
      "schedule": [
        {"location":"UES Med Spa","weekday":1,"start_min":600,"end_min":1140},
        {"location":"UES Med Spa","weekday":2,"start_min":600,"end_min":1140},
        {"location":"UES Med Spa","weekday":3,"start_min":600,"end_min":1140},
        {"location":"UES Med Spa","weekday":4,"start_min":600,"end_min":1140},
        {"location":"UES Med Spa","weekday":5,"start_min":600,"end_min":1140},
        {"location":"UES Med Spa","weekday":6,"start_min":600,"end_min":1140},
        {"location":"UES Med Spa","weekday":0,"start_min":600,"end_min":1020}
      ]
    }
  ]
}
```

Convenção: weekday 0=Dom, 1=Seg … 6=Sáb; minutos desde meia-noite (600 = 10:00, 1200 = 20:00).

## ✅ O QUE JÁ ESTÁ PRONTO (do site)
Nomes/endereços/telefones/horários das 3 unidades · lista de serviços · durações estimadas · depósito nos procedimentos med-spa · brain trilíngue.

## ❗ O QUE SÓ O NATURA CONFIRMA (perguntar na reunião)
1. **Preços** de cada serviço (pra Gui cotar exato)
2. **Política de cancelamento/depósito** real
3. **Equipe por unidade/serviço** — hoje agrupei em "times" por loja (funciona pra reservar horário); se quiserem reserva por profissional específico (Sarita, Kany, Jorge…), me passa quem faz o quê e em qual unidade
4. **MindBody**: hoje a Gui agenda na agenda da GUILEO. Sincronizar com o MindBody deles (studioid 767008 Astoria / 5734109 UES) é trabalho de integração — decidir se roda em paralelo, se a gente migra, ou se constrói o sync
5. **Idiomas** a priorizar (Astoria tem muito brasileiro → PT forte)

## ⚠️ NÃO PROMETER no pitch
- Escrita ao vivo no MindBody deles (não existe hoje) → prometer "captura + agenda Guileo + handoff"
- Preço exato falado na ligação até você me passar a tabela
