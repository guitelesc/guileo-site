# 🌱 GUILEO — O MAPA (leia isto ANTES de tocar em qualquer coisa)

> **Tese:** motor de crescimento PERSONALIZADO — cada negócio tem SEU agente (nome/voz/logo/preços/canais).
> **Regra de ouro:** prove, não afirme. Toda mudança termina com build limpo + deploy + prova real (SQL/curl/screenshot).

## ⚡ O sistema em 3 segundos

```
LIGAÇÃO/CANAL → ElevenLabs (só a VOZ) → NOSSOS webhooks (Cloudflare functions/) → Supabase (cérebro+dados)
                                              ↓ espelhos: Google Calendar · e-mail branded · cockpit /portal
```

- **A voz é trocável** (ElevenLabs hoje; Retell/Vapi amanhã). **O cérebro é NOSSO** e mora em `functions/` + Supabase.
- **1 tenant = 1 client_email.** TUDO é escopado por ele. Nenhum dado cruza tenants, nunca.
- **Fonte da verdade da agenda** = `biz_appointments` (Supabase). Calendários externos são espelho.

## 🗄️ Camadas e onde mexer

| Camada | Onde | O que é |
|---|---|---|
| Landing/páginas | `src/pages/*` | 4 idiomas via `src/i18n.jsx` (chave `guileo_lang`) — TODA string visível vem de dict |
| Cockpit do cliente | `src/pages/Portal.jsx` + `src/portal/*` | Abas lazy. Registrar aba = 5 pontos no Portal.jsx (import, view-map, inject, ícone, NAV_GROUPS) |
| Vendedor | `src/pages/Vendedor.jsx` + `OnboardWizard.jsx` | Cadastro completo → draft → aprovação no /admin |
| API | `functions/api/*.js` | 1 arquivo = 1 endpoint. Padrões abaixo são LEI |
| Libs | `functions/lib/*` | `emailTemplates.js` (ÚNICA fonte de e-mail) · `provision.js` (cérebro do agente) · `guard.js` (gates) |
| Dados | Supabase `ynihodbknhjirkdogxby` | Só via RPCs SECURITY DEFINER. SQL em `db/*.sql`, aplicado via MCP |

## 🔐 Os 4 portões (decore)

| Portão | Literal/fonte | Usado por |
|---|---|---|
| INGEST | `'glo_ing_7f3da9c2b4e8'` = env `INGEST_SECRET` | RPCs de dados/CRM/marketing |
| SCHED | `_gui_sched_ok('gss_Kp9mX4vR2tZ7nQ5wL8bc')` = env `SCHED_SECRET` | RPCs que tocam agenda (`biz_*`) |
| Tenant HTTP | `get_client_data(email, key)` | Endpoints do cockpit (padrão: `noshow-radar.js`) |
| Admin/Cron | `ADMIN_TOKEN` (via `blitz_stats`) · `DIGEST_TOKEN` (`safeEq`) | /admin actions · sweeps de cron |

⚠️ Supabase **PROÍBE** `alter database set` (GUC) → gates são SEMPRE literal hardcoded na função.

## 💰 Dinheiro (nada de erro — auditado 2026-07)

- **Crédito ancorado no VALOR pago** (mapa de centavos exatos), NUNCA em metadata.
- **Idempotência em 3 camadas**: event-id (`mark_webhook_seen`) + claim por objeto-de-dinheiro (`claim_credit_event`) + unique index (stripe_session/sub_id).
- **Toda mutação de dinheiro é tenant-bound**: `(client_email, id)` — UUID sozinho NUNCA.
- **Resgates/decrementos são UPDATEs atômicos com guarda** (`where saldo >= x`), nunca read-then-write.
- **Dedupe key de retry deriva do BODY** (nunca de timestamp) — ElevenLabs/Stripe re-tentam.
- **Reconciliação**: `/api/money-reconcile` prova Stripe = ledger. Falha NUNCA é silenciosa → `emitFailure`.
- Cliente do tenant (metadata `guileo=client_charge|package|membership|giftcard`) NUNCA ganha crédito Guileo.

## 📐 Padrões que são LEI

1. **E-mail**: SEMPRE via `emailTemplates.js`. Branded por cliente = `brandFor(env,email)` + `clientEmailShell`.
2. **SQL novo**: arquivo próprio em `db/`, idempotente, RLS on SEM policy anon, RPC gated + `grant execute to anon`, blocos EXCEPTION pra degradar (nunca 500 por tabela ausente).
3. **Honestidade de canal**: LIVE (voz/SMS/widget/email) vs PENDING (WA/IG/Google/Ads — capturado agora, acende com a API). Badge verde/âmbar. Nunca fingir.
4. **Integrações externas** (MindBody/Google Business/Yelp API): scaffold inerte `{ready:false, note}` até env+creds — padrão `mindbody.js`.
5. **Ligação outbound**: SEMPRE pelo portão blindado (`call.js` — DNC+caps). Exceção única: ligar pro PRÓPRIO dono (notify phone).
6. **Design**: app/cockpit = cimento quente `#161512` (LOCKED — nunca retocar tokens globais); sinais: Gui laranja `#FF8A33`, info azul, live rosa, atenção âmbar, done verde. Landing tem paleta própria.
7. **IA (LLM)**: `claude-fable-5` com cadeia de fallback (`askClaude` em pitch-ai.js é a referência); mensagens começam com `user`; erro devolve status real, nunca 502 mudo.
8. **i18n**: 4 idiomas de UI (en/pt/es/hi); o AGENTE fala 20 (`LANGS_SPOKEN` em provision.js).

## 🤖 Ondas paralelas (multi-agente)

- **Dono único por arquivo.** Duas ondas simultâneas = listas de arquivos disjuntas, explícitas no prompt.
- `Portal.jsx` e `emailTemplates.js` = arquivos-quentes: **só o orquestrador (ou 1 slice designado) toca**.
- Slice que precisa mexer em arquivo alheio → escreve o patch como TEXTO no report; orquestrador aplica.
- Integração final é SEMPRE do orquestrador: aplicar SQLs (todas! conferir 1-a-1), registrar abas, build, deploy, provar.

## 🚀 Adicionar uma feature (o ciclo de 6 passos)

```
1 rota/aba → 2 UI (padrão da vizinha) → 3 endpoint (gate certo) → 4 SQL (db/*.sql via MCP)
→ 5 build+deploy (npx wrangler pages deploy dist --project-name=guileoai --branch=main)
→ 6 PROVA (round-trip SQL + curl gated + screenshot se visual)
```

## 📍 Nascimento de um cliente (o fluxo-mestre)

```
/vendedor (OnboardWizard: TUDO — negócio, agente nome+voz, unidades, serviços+preços, canais, logo)
→ draft (onboard_drafts) → /admin 1-clique Aprovar → onboard-client.js provisiona:
   agente ElevenLabs próprio + cérebro (buildGuiPrompt) + agenda (biz_admin_import)
   + número Twilio + widget branded + código de conexão do portal
```

## ☎️ Arquitetura de números (regra de ouro)
- **`+19864443334` = RESERVADO da plataforma** (demo/saída da landing, `ELEVENLABS_PHONE_NUMBER_ID`). NUNCA vai pra cliente — `bind-number.js` recusa e o picker do /admin mostra 🚫.
- **Cada cliente = 1 número PRÓPRIO** (nunca compartilhado, nunca o demo). Vem do **pool** de números livres (mapear no /admin via ROTA-NUMERO) ou **compra automática** no onboard (number_mode='buy').
- **1 número = 1 agente.** O picker marca 🟢 livre / 🔒 já usado / 🚫 reservado.

## ⏰ Cron externo (Pages não tem cron) — URLs token-gated
`/api/proactive` (datas/aniversário/rebooking) · `/api/automations` (radar/slow-day) · `/api/lifecycle` · `/api/collections?sweep=1` · `/api/nps` · `/api/money-reconcile` · `/api/health-monitor`

---
*Atualize ESTE arquivo quando a arquitetura mudar. Ele é o contrato de 3 segundos.*
