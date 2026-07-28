# Guileo Brain & Build OS — os outros 2 pilares como orgs de agentes de IA

Mesma lógica do [COMPANY_MARKETING_OS.md](COMPANY_MARKETING_OS.md) (pilar AD), adaptada. Legenda: ✅ já roda · 🟡 parcial · ⬜ a construir.

---

## 🧠 GUILEO BRAIN — o funcionário-IA que roda a operação (Performance)
**CEO/orquestrador = o agente do cliente (Gui / Dr. Davi / etc.).** Departamentos = o que ele FAZ, do "oi" ao dinheiro.

| # | Depto | Skills-chave | Estado |
|---|---|---|---|
| 1 | Recepção 24/7 | voice-answer, dm-reply, webchat | ✅ voz + Meta DM + widget |
| 2 | Speed-to-Lead | speed-lead (liga em ~60s), missed-call-textback | ✅ /api/call + marketplace |
| 3 | Agenda | book, reschedule, availability, reminders | ✅ scheduleAdapter (MindBody/Square/interno) |
| 4 | Cotar · Fechar · Cobrar | quote, close-collect, pay-link | ✅ agent-action + spendGuard |
| 5 | Anti-falta (no-show) | noshow-radar, confirm | ✅ noshow engine |
| 6 | Reativação / win-back | winback, dormant, churn-reengage | ✅ churn engine |
| 7 | Transbordo humano | transfer, emergency-escalate | ✅ handoff + dispatch |
| 8 | Memória do cliente | remember (reconhece + chama pelo nome) | ✅ crm_caller_context (Meta ligado hoje) |
| 9 | CRM na hora | crm-log (todo canal → CRM) | ✅ crm_upsert_contact |
| 10 | Reputação / reviews | ask-review, reply-review | 🟡 GBP inerte até chave Google |
| 11 | Omnicanal | voice/WhatsApp/IG/SMS/webchat, 1 cérebro | 🟡 Meta✅ · WhatsApp/SMS aguardam chave |
| 12 | Multilíngue (20+) | auto-language | ✅ |
| 13 | Segurança | guardrails (constitution) | ✅ guiConstitution |

**Estado:** Brain é o núcleo — quase tudo ✅. Faltam só chaves externas (WhatsApp/SMS/Google), não código.

---

## 🏗️ GUILEO BUILD — a fundação, construída 1× e roda pra sempre
**CEO/orquestrador = plataforma Guileo + time (done-for-you).** Departamentos = o que a gente constrói/opera pro cliente.

| # | Depto | Skills-chave | Estado |
|---|---|---|---|
| 1 | Sites | website, landing, cro, ab-test | ✅ (a própria landing é a prova) |
| 2 | Apps | mobile-app, pwa | 🟡 done-for-you (time) |
| 3 | Loja online | store, checkout, catálogo | 🟡 (Shopify/webhook prontos) |
| 4 | Software sob medida | custom-software, api | 🟡 done-for-you |
| 5 | Integrações | connect (MindBody/Google/Meta/Stripe/MP) | ✅ conectores inertes-que-acendem |
| 6 | Deploy & uptime | deploy (zero-downtime), monitor, lazyRetry | ✅ Cloudflare Pages + hardening |
| 7 | SEO técnico | seo-scaffold, sitemap, schema | ✅ 143 combo-pages + JSON-LD |
| 8 | Domínio / DNS / e-mail | dns, email-deliver | ✅ (guileoai.com no ar) |
| 9 | Dados / DB | db-schema, RLS, RPCs gated | ✅ Supabase + padrão de segurança |
| 10 | Segurança / compliance | security, privacy, legal-pages | ✅ CSP + constitution + páginas legais |
| 11 | Analytics wiring | analytics-setup, pixels | ✅ GA/Meta/TikTok pixels |

**Estado:** Build = fundação real, a maioria ✅ como plataforma; apps/software/loja sob medida = done-for-you (time + platform).

---

## Leitura pro Luis (foco: fazer acontecer, sem retrabalho)
- **Os 3 pilares (Brain·AD·Build) JÁ existem como produto** — não reconstruir.
- O que falta pra faturar de verdade não é código: são **chaves externas** (WhatsApp, Google, Payment Links, Meta App Review) — no seu lado.
- Deltas de código reais e pequenos: Brain #10/#11 (acendem com chave) · AD ⬜ Video/PR/Events · Build apps/loja (done-for-you). 1 por vez, provado.
