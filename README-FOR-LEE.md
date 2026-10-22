# Guileo — Developer Guide (for Lee)

Welcome! This is your map of the Guileo codebase. Read it top to bottom before your first commit:
sections 3 and 6 prevent the mistakes that already cost us.

---

## 1. What Guileo is

Guileo is an AI platform for small businesses. Each client gets an AI voice agent that answers
the phone 24/7, books appointments, captures leads, and follows up, plus a website and a dashboard.

One React app serves everything:

| Who | URL | What it is |
|---|---|---|
| Public | `guileoai.com` | Marketing site + Gui, our AI agent widget |
| **Owner (admin)** | `guileoai.com/admin` | Funnel, leads, agents, contracts, projects |
| **Client app** | `guileoai.com/portal`, `/desk`, `/balcao`, `/minha-conta` | What a business uses day to day |
| **Client website** | `guileoai.com/novo/natura-spa` (→ `naturaspanyc.com`) | Natura Spa + Salon, our live client |

## 2. Stack

React 19 · React Router 7 · Vite 8 (Node 26) · Cloudflare Pages + Pages Functions (`functions/`, routes `/api/*`) · Supabase (data + auth) · ElevenLabs (voice agents) · Twilio (phone numbers) · Stripe (payments) · Resend (email).

## 3. Run it locally

```bash
npm install
npm run dev
```

> ⚠️ **`npm run dev` talks to PRODUCTION.** `vite.config.js` proxies `/api` to `https://guileoai.com`.
> Anything you do locally (create a lead, book, send a message) happens **for real**, on real client data.
>
> - Test logged in **only** with `e2e-test@guileoai.com` (ask Luis for the password).
> - **Never** log in or test on a real client's account (e.g. Natura Spa).
> - Never type a real phone number into a form: the platform may call it.

## 4. Where everything lives

### Admin (owner dashboard)
| File | Screen |
|---|---|
| `src/pages/Admin.jsx` | `/admin` (overview, leads, funnel) |
| `src/pages/AdminAgente.jsx` | `/admin/agente` (voice agents) |
| `src/pages/AdminProjetos.jsx` | `/admin/projetos` |
| `src/pages/Contratos.jsx` | `/admin/contratos` |
| `src/pages/AdminParceiros.jsx` | `/admin/parceiros` |
| `src/components/AdminFunil.jsx` | Site funnel widget |

### Client app
| File | Screen |
|---|---|
| `src/pages/Portal.jsx` + `src/portal/*` | `/portal` (client dashboard tabs: CRM, Billing, AI Brain, Ads…) |
| `src/pages/GuileoDesk.jsx` | `/desk` (front-desk calendar, our MindBody replacement) |
| `src/pages/Balcao.jsx` | `/balcao` |
| `src/pages/MinhaConta.jsx` | `/minha-conta` |

### Natura Spa (client website)
| File | What |
|---|---|
| `src/novo/NaturaSpa.jsx` | Main site |
| `src/novo/NaturaSpaPorta.jsx` | Entry page |
| `src/novo/NaturaStore.jsx`, `NaturaMembership.jsx`, `NaturaPoliticas.jsx` | Store, membership, policies |
| `src/novo/natura*.js` | Catalog, map, membership data |
| `public/novo/natura-spa/` | Photos and hero videos |
| `src/pages/Novo.jsx` | Router for all client sites (`/novo/:slug`) |

### Voice agent "Lilian" (Natura's AI receptionist) ↔ platform
Lilian is an ElevenLabs agent (`agent_8701kxnfhgmgefzbbwda8d86mqwj`), answering **+1 929 828 8170** via Twilio.

| File | Role |
|---|---|
| `functions/api/sync-agent.js` | Pushes the client's profile, prompt and tools to ElevenLabs |
| `functions/api/twilio-inbound.js` | Tells the agent who is calling (caller identity from CRM) |
| `functions/api/agent-schedule.js` | The agent's **booking** tool (real appointments) |
| `functions/api/agent-action.js` | The agent's **lead / action** tool |
| `functions/api/elevenlabs-webhook.js` | After each call: transcript, summary, CRM update |
| `functions/api/agente-config.js`, `agente-widget.js` | Read-only diagnostics of live agents |
| `functions/lib/provision.js` | The agent "constitution" (base prompt shared by all agents) |

### Template for adding a new client (the reusable model)
| File | Role |
|---|---|
| `functions/api/provision-client.js`, `provision-agent.js`, `provision-number.js` | Create client → agent → phone number |
| `functions/api/onboard-client.js` | Onboarding flow |
| `src/novo/_sistema/` | Shared building blocks for client websites |
| `PADRAO-VITRINE.md`, `COMBO.md` | The standard for a new client site + agent (read before building one) |

### Shared
`src/App.jsx` (all ~100 routes) · `src/components/` · `src/i18n.jsx` (all UI text, EN/PT/ES) · `src/lib/` (Supabase client, API helpers) · `src/index.css` (design tokens)

## 5. Deeper docs (in the repo root)
`ARQUITETURA.md` (system map, security gates; start here) · `MOTORES.md` (each automation engine) · `CANAIS.md` (each channel: phone, SMS, WhatsApp, Instagram…) · `IMPLEMENTACAO.md` (step-by-step operational recipes) · `JORNADA.md` (client journey). They are in Portuguese; Google Translate handles them well.

## 6. House rules (non-negotiable)

1. **Locked design.** The "warm cement" theme (`#161512`) and global color tokens don't change. Big visual changes need before/after screenshots approved.
2. **No hardcoded UI text.** Every visible string goes through `src/i18n.jsx` in all 3 languages.
3. **Email only through `functions/lib/emailTemplates.js`.** Never hand-written email HTML.
4. **Everything is per client.** All data is scoped by `client_email` (the tenant). A screen must never show another client's data.
5. **Honesty.** If a feature isn't connected yet, the UI says "pending". Never show made-up numbers or claim success without the server's real response.
6. **No secrets in code.** Keys live in Cloudflare env vars. Need a new one? Ask Luis. Never commit `.env` / `.dev.vars`.
7. **Voice agents are production.** Never edit Lilian (or any client agent) directly in the ElevenLabs dashboard: changes go through `sync-agent`, with a snapshot first (`/api/agente-config?congelar=1`).

## 7. How to deliver

1. Branch off `main`: `git checkout -b your-change`
2. Small commits, messages describing what changes **for the user**
3. Open a **Pull Request** with screenshots (desktop + mobile)
4. **Don't deploy.** Production deploys are done by Guileo after PR review.

Questions? Ask Luis before guessing.
