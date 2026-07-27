# Luis — sua lista (o que só você pode fazer)

Tudo do meu lado (código) está pronto e no ar. Estes itens dependem da sua identidade / conta / pagamento /
aprovação de terceiros — não dá pra eu fazer no seu nome. Estão em ordem de prioridade. Cada um eu te guio ao
vivo se quiser (como fiz no Supabase e no Twilio).

## 🔴 Rápidos (minutos)
- [ ] **Mercado Pago — rotacionar o token.** Você colou ele no chat dias atrás. Gere um novo no painel do MP e
      me passe (ou cole você no Cloudflare como `MP_ACCESS_TOKEN`). Segurança.
- [ ] **Liberar os 3 números antigos da Vapi** (~$3.45/mês jogados fora). No painel da Vapi → Phone Numbers → release.
- [ ] **(opcional) Rotacionar 2 secrets que apareceram no chat:** `PEND_SECRET` (gx_pend_…) e
      `DELIVERY_WEBHOOK_SECRET` (glo_dlv_…). Não é grave (são seus), mas se quiser zerar risco eu troco num passe.

## 🟡 Twilio Pay (cartão por voz) — falta só ligar a ponta
Conector Stripe já conectado (modo TEST). Pra a Gui poder transferir a ligação pro pagamento:
- [ ] **Aponte um número Twilio** (pode ser o número da Guileo +19864443334, ou um dedicado) com o webhook de
      voz = `https://guileoai.com/api/twilio-pay` (Phone Numbers → o número → Voice → "A call comes in" → Webhook POST).
- [ ] **Me passe esse número** → eu configuro a Gui pra transferir pra lá quando o cliente quiser pagar por cartão,
      e ligo a instrução no prompt. Aí testamos com o cartão de teste do Stripe (`4242 4242 4242 4242`).
- [ ] **Depois de testar:** trocar o conector de `test` → `live` no Twilio (e garantir conta Twilio paga, não trial).

## 🟡 Delivery (agregador) — NY primeiro
- [ ] **Cadastrar no Otter (tryotter.com)** — pra restaurante independente em NY é o melhor. Costuma ser por
      "Get a demo" (contato comercial). Conectar as lojas Uber Eats / DoorDash / Grubhub lá dentro.
- [ ] No Otter, apontar o webhook de novo pedido pra:
      `https://guileoai.com/api/delivery-webhook?client=<email do restaurante>&secret=<DELIVERY_WEBHOOK_SECRET>`
- [ ] Me mandar um pedido de teste → confirmo que aparece no Live Orders. (Meu lado já está testado.)

## 🔴 WhatsApp Business API + A2P 10DLC — o mais demorado (dias)
- [ ] Verificar a empresa (nome legal, EIN/CNPJ, endereço, site) no Twilio → Messaging → Regulatory Compliance.
- [ ] Registrar Brand + Campaign (A2P 10DLC) e criar um Messaging Service com o número.
- [ ] Esperar aprovação da operadora (horas–dias). Até aprovar, SMS pra EUA pode ser filtrado; **voz funciona já**.

## 🟣 Motor #3 (previsão de no-show) — falta 1 SQL
- [ ] **Colar `db/noshow_predictor.sql`** no Supabase (conta smart@guileoai.com, projeto ynihodbknhjirkdogxby).
      Ativa o "radar de risco" (`/api/noshow-radar`) que rankeia quem vai furar antes de acontecer, e o
      `biz_mark_noshow` pra registrar no-shows (o histórico melhora a previsão com o tempo). Read-only, não cobra nada.

## 🗂️ Company OS — CRM (fases 1 e 2 já codadas; falta colar 2 SQLs)
- [ ] **Colar `db/crm_spine.sql`** (fase 1 — `crm_contacts` + resolve/list). Ativa `/api/crm`. O funil JÁ está
      ligado: cada ligação/pedido/lead chama `crm_upsert_contact` (best-effort) → no segundo que você colar, a
      caderneta de contatos começa a se encher sozinha.
- [ ] **Colar `db/crm_phase2.sql`** (fase 2 — deals + timeline 360° + segments). O funil JÁ loga timeline + abre/
      ganha deal (best-effort) → no segundo que colar, cada contato ganha histórico completo + pipeline de vendas.
- Depois disso eu construo a **view de CRM no Cockpit** (com auth da sessão) + as fases 3-4 (departamentos como
  camadas, em cima da espinha viva). Arquitetura completa: `db/company-os/`.

## 🧹 Limpeza (quando puder)
- [ ] Apagar o agente de teste na ElevenLabs: `agent_8901kvmck61qfwvtcj70c5q2gbt5` ("Pizzaria Teste E2E").
- [ ] (Linha de teste `e2e-test@guileoai.com` no banco — inofensiva, pode deixar.)

---
**Resumo:** o produto está construído e no ar. O que falta agora é mais **abrir portas (contas/aprovações)** do
que escrever código. Comece pelos 🔴 rápidos e pelo número do Twilio Pay — o resto tem ritmo próprio.
