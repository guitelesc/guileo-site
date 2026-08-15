# 🌱 JORNADA — do primeiro "oi" ao lucro (o esboço vivo da plataforma)

> Mapeado por 6 agentes (1 dono por etapa) em 2026-07-16. Este é o documento de PRODUTO;
> a arquitetura técnica está em [ARQUITETURA.md](ARQUITETURA.md) e as operações em [IMPLEMENTACAO.md](IMPLEMENTACAO.md).
> Cada etapa tem: dono, como funciona hoje, portões, e os gaps abertos (✅ = corrigido).

```
🎯 PRIMEIRO OI → 💼 VENDA → 🐣 ATIVAÇÃO → 🏪 OPERAÇÃO → 💰 DINHEIRO → 🌱 LUCRO/RETENÇÃO
   (visitante)     (lead)      (pagou)       (Gui viva)     (cobrança 2 níveis)  (fica+indica)
```

## 🎯 Etapa 1 — PRIMEIRO OI (visitante fala com a Gui)
**4 portas:** VOZ `LiveCall.jsx`→`/api/call` (portão blindado: sameOrigin + rate-limit fail-closed + cooldown 10min + DNC → ElevenLabs outbound do +19864443334 RESERVADO) · TEXTO landing `GuiChat.jsx`→`/api/gui-chat` · CHAT no site do cliente `gui-widget.js`→`/api/widget-chat` (tenant-gated, preços reais, grava CRM+intent) · MARKETPLACE `/api/marketplace-leads` (Yelp/Angi/Thumbtack → Gui liga em 60s).
**Captura:** `/api/lead` grava TUDO (gui_actions + CRM + consent + email dono + email branded prospect + speed-to-lead com caps).
**Gaps:** ✅ copy honesto na demo (caller-ID não registrado silencia — raiz = CNAM/A2P, ação Luis) · ✅ gui-chat captura lead + fallback de modelo + preço alinhado · ✅ ExitIntent consent afirmativo · ✅ skipped tratado · ✅ WhatsApp imediato no done.

## 💼 Etapa 2 — VENDA (lead vira contrato)
**Hub `/vendedor`:** Pitch Cards (dor→solução→ganho→concorrência) + Practice (cliente difícil IA) + Quote (`SellerQuote.jsx`, manda WhatsApp/PDF/email) + Cadastro Completo (`OnboardWizard.jsx`→`onboard-draft.js`, draft → aprovação 1-clique) + 💼 Carteira permanente (`SellerClients.jssx`/`seller_wallet` — quem assina é dono pra sempre) + Copiloto de ativação.
**Regra:** vendedor vê o MESMO mapa do dono; Luis monitora tudo. Chave mascarada p/ team-code.
**Veredito do mapa:** o vendedor pitcha/treina/cota/cadastra sozinho no 1º dia, mas **não fecha financeiramente sozinho**.
**Gaps:** ✅ **link de pagamento no fluxo do vendedor** (pós-draft: "💳 Fechar a venda" → wa.me com `/planos?email=&ref=`; Planos.jsx prefill do email no Stripe + ref salvo) · ✅ **orçamento com os planos do PRODUTO** (`src/data/guileoPlans.js` canônico + 3 templates GUI-* em USD no topo do catálogo; chips 1-toque no Quote; default Personalized $449) · ✅ nomes unificados (wizard dropdown = Essential/Personalized/Full Operation com preço+créditos, credits sincronizam com o plano) · ✅ aviso quando faltam serviços/preços no cadastro · ✅ **códigos PESSOAIS de vendedor** (2026-07-21): /api/seller-login Path 0.4 (login só pelo código pessoal → seller_code_check resolve o vendedor no servidor; `ref` vem da linha do DB, NUNCA do email digitado = impossível impersonar) + guard no team-code (seller_email_registered: email com código pessoal → team-code RECUSADO 403; email novo ainda auto-registra sem atrito). PROVADO: check-by-code resolve, has_code:true dispara o guard, código errado→401, team-code p/ email novo→200. **HARDENING pós-auditoria adversarial 2026-07-21**: o guard também checa o roster env/BOOTSTRAP SÍNCRONO (protege luis/smart/SELLER_ROSTER mesmo com DB fora) e FALHA-FECHADO em erro de RPC (503 "tente de novo", nunca deixa impersonar). Provado prod: roster email via team-code→403, email novo→200, código próprio→200 · ✅ atribuição do ref LIGADA à comissão (checkout com client_reference_id → evento 'attribution' → seller_conversions soma pelos 2 caminhos: lead 👤ref + attribution; RPC aplicada 2026-07-16).

## 🐣 Etapa 3 — ATIVAÇÃO (pagou → Gui viva → conectado)
**2 caminhos → mesmo motor (`lib/provision.js`):** self-serve (`/go-live` → pending_onboarding → Stripe → `stripe-webhook` auto-provisiona) e vendido (draft → `/admin` aprovar → `onboard-client.js`). Nascimento: agente ElevenLabs próprio (cérebro buildGuiPrompt, 20 idiomas) + agenda seed + número (pool/compra) + widget + chave + birth email.
**Portões:** créditos ancorados no valor; idempotência tripla; toda falha de nascimento → emitFailure (⚠️ /admin).
**Gaps:** ✅ birth email depois do número (ia sem número) · ✅ emitFailure se code vazio no self-serve · ✅ nome real do negócio no email · ✅ `/portal?code=` auto-aplica a chave (fim do copiar-colar) · ✅ mismatch email-pago vs email-login agora AVISA alto ("código não bate com este email — entre com o email do pagamento") · ✅ **default shared sem número no admin AVISA antes de aprovar** (OnboardApprovals.approve() → window.confirm quando number_mode ausente/'shared'; 2026-07-21).

## 🏪 Etapa 4 — OPERAÇÃO (a Gui trabalhando)
**Voz:** número importado no ElevenLabs (1 número = 1 agente); personalização pré-atendimento via `twilio-inbound.js` → reconhece o cliente pelo número (`crm_caller_context`) em ≤800ms. **Tools na ligação:** `agent-schedule.js` (book/reschedule/cancel/waitlist — motor `biz_*`) + `agent-action.js` (vender/cobrar/transferir/urgência). **Portal:** agenda, Risk-radar (no-show), Inbox, LiveOrders, Storm Mode, despacho de emergência.
**Gaps:** ✅ alerta de reserva pro dono (gate errado matava o SMS/WA) · ✅ receita da voz agora vira evento visível · ✅ slot match por epoch (falso "indisponível") · ✅ missed → **auto-callback real** (busy→auto-return do Luis) · ✅ **holds expirados varridos pelo cron** (automations.js → biz_holds_expire, SCHED-gated; 2026-07-21).

## 💰 Etapa 5 — DINHEIRO (2 níveis, nada de erro)
**Nível A (Guileo cobra cliente):** planos $149/$449/$999 + top-ups; crédito por valor exato; idempotência tripla; dunning por email; reconcile diário (`money-reconcile`).
**Nível B (Gui cobra o cliente DO cliente):** close&collect, pay-link SMS, pacotes/assinaturas/giftcards (fulfill .ok-checked, ancorado no pago), cupons brandados.
**Gaps:** ✅ PLAN_MID comissão 449 · ✅ allow_promotion_codes off em packages/giftcards · ⏳ **PIX/MercadoPago = buraco pagou-e-nada (bloqueia mercado BR — próxima build grande)** · ✅ **refund revoga crédito** (db/refund_pause.sql: deduct_client_credits idempotente por ref + clamp ≥0; ligado no refund/dispute do Stripe [mapa PLAN/TOPUP reverso, não 1cr/$ — revisor pegou] e no refund/chargeback do MP; provado 510→510 idem, 999→0 floor) · ⏳ reconcile não cobre voz/Connect (voz JÁ exposta no /api/unit-economics; Connect inerte até live — voz não é reconciliável sem billing API da ElevenLabs) · ✅ **grace-period pausa o agente** (set_client_paused reversível; dunning stage 2 sob DUNNING_ENFORCE flipa o flag → agent-action bloqueia dinheiro/agenda [escalação sempre passa, fail-open] → próximo pagamento reativa).

## 🌱 Etapa 6 — LUCRO & RETENÇÃO (fica, cresce, indica)
**Cron 15min (`cron-tick` → worker):** automations (lembretes/review/win-back/risk-confirm/slow-day) + lifecycle (drip de lead); horário: health-monitor + collections; diário 13h UTC: proactive (aniversários/datas/rebooking) + NPS + reconcile; **segunda 13h UTC: relatório semanal de valor** (a prova de ROI).
**Gaps:** ✅ relatório semanal LIGADO no cron (era órfão — nunca enviava!) · ✅ proactive cobre TODOS os clientes (era lista estática) · ✅ ROI honesto no GuileoImpact (não conta o pagamento à Guileo como "crescimento") · ✅ **programa de indicação COM backend** (db/referrals.sql: referral_record/convert idempotentes, ligados no stripe-webhook [grant "1 mês grátis" aos DOIS lados, cap 2000cr, one-time claim] + Grow.jsx gera link real ?ref=btoa(email); PROVADO 2026-07-21: convert 1º=converted:true, 2º=false idempotente) · ✅ **NPS ≥9 entrega o link de indicação** (nps.js: bloco promoter ≥9 com copiar+WhatsApp) · ✅ **XM alimentado por 6 canais** (call/review/survey/webchat/sms/whatsapp) + Pulse na landing + Timeline custo→lucro→reembolso→chargeback · ✅ **receita do mês lê do ledger** (revenue_month) em TODA superfície — Overview.jsx (headline/meta/plant via /api/revenue → month_cents, prefere a verdade do ledger, cai no growth-sum só enquanto carrega, honesto se SQL ausente), GuileoImpact.jsx, client-report.js (totalMonth), Timeline.jsx. NUNCA zera. Confirmado 2026-07-21: /api/revenue gated (unauthorized sem chave), revenue_month round-trip OK.

## 🚧 Builds grandes — TODAS ENTREGUES 2026-07-16 (onda-4-motores, verificada + provada)
1. ✅ **Referrals backend** — db/referrals.sql APLICADO (record idempotente + convert com claim atômico, provado true→false); ref viaja `?ref=` → localStorage (contrato JSON do App.jsx) → `client_reference_id` do Stripe → webhook credita OS DOIS (cap 2000) ou grava atribuição de vendedor; NPS ≥9 entrega o link de indicação.
2. ✅ **Mercado Pago webhook** — /api/mercadopago-webhook VIVO (token já no env): re-fetch do payment (nunca confia no body), x-signature, idempotência tripla (+ gate próprio de refund), mapa BRL exato, guarda client-charge (sem external_reference de tenant = NÃO credita, alarme), refund/chargeback com dedupe. pay-link estampa external_reference + notification_url.
3. ✅ **revenue_month RPC** — APLICADA; soma o ledger `client_revenue` + gap-fill `crm_timeline_events` sem dupla contagem, exclui cancelado/no-show, centavos inteiros; client-report usa com fallback honesto.
4. ✅ **Grace-period** — /api/dunning-sweep (401 sem token ✓) no cron horário: estágio 1 email última-chamada (dunningEmail), estágio 2 alarme "⏸️ pausado" (honesto: não existe teardown automático — Luis cancela no Stripe); claim 7d atômico (provado true→false); **DRY-RUN até `DUNNING_ENFORCE=1`**.
5. Externos (ação Luis): **CNAM/A2P** (raiz do "não tocou"/SMS) · WhatsApp sender · Twilio Pay connector · `DUNNING_ENFORCE=1` quando quiser ligar a cobrança dura · secret `MP_WEBHOOK_SECRET` + registrar a URL do webhook no painel MP.

---
### 🚀 Pré-lançamento 2026-07-21 — legal + webhook
Auditoria de pré-lançamento rodada. Construído+provado: **branch do setup $199** no stripe-webhook (reconhece `metadata.guileo=setup` OU 19900¢ → receita, ZERO crédito errado, reconcilia); **páginas legais que faltavam** — Refunds/Cancellation + Contact + Cookies (rota→Privacy), no mesmo `LegalDoc` (EN+PT completos, ES/HI headings), title SEO via `_middleware.js`, no sitemap, linkadas no footer. Já existiam: Privacy, Terms, robots.txt, sitemap (1058 URLs), security.txt, cookie-consent banner, CSP+X-Frame+nosniff, JSON-LD Org+Service. 4 verificações de pré-launch FEITAS 2026-07-21: **(1) cookie-gating PROVADO limpo** (visitante novo → ZERO tracking carregado antes do "Aceitar"; fbq/gtag/ttq undefined — GDPR/LGPD OK). **(2) e-mail DNS OK** — DKIM da Resend presente+válido (`resend._domainkey`), SPF (IONOS) + DMARC (p=none) presentes; e-mails autenticam via DKIM alignment; 2 cliques opcionais do Luis (DMARC `rua`; confirmar domínio Resend). **(3) soft-404 CORRIGIDO+PROVADO** — `_middleware.js` retorna 404 real p/ path sem rota (allowlist de segmentos), rotas válidas estáticas+dinâmicas todas 200. **(4) a11y** — skip-to-content link (WCAG 2.4.1) adicionado+provado; 1 h1, lang setado, reduced-motion respeitado, 0 botões sem label. **Verificado a fundo 2026-07-21**: os "gaps" de a11y eram FALSO-POSITIVO — as 2 imgs têm `alt=""` (logo decorativo, correto), os "inputs sem label" são honeypots `aria-hidden` (corretos) + checkboxes dentro de `<label>` (corretos). a11y limpa. **CWV real: CLS 0 (perfeito), TTFB 182ms, DOMload 325ms** — verde; LCP não mediu a frio no ambiente (cache), rodar PageSpeed Insights p/ o número de campo oficial. ⏳ pendências de launch = **cliques do Luis** (ATIVACOES.md: Stripe Connect #1, A2P #2).

### 🛡️ Loop autônomo 2026-07-21 (madrugada) — hardening + auditoria
Onda contínua provada ciclo-a-ciclo: indicação (money-loop idempotente verificado), **códigos PESSOAIS de vendedor** (login server-verified + guard roster/fail-closed anti-impersonação — provado 403/200), **auditoria adversarial dupla dos caminhos de dinheiro** (revisor JS + revisor SQL): veredito SAFE nos 6 db/*.sql; 6 defeitos reais corrigidos e provados — guard do seller-login (roster síncrono + fail-closed), reserva órfã no throw do bookIdem, voice_pay agora passa pelo spendGuard, colisão de reserveRef com contato-vazio (contact→name→request_id), cx_platform_pulse zera avg abaixo do piso. **totalMonth lê do ledger** (revenue_month) em toda superfície. Regressão final: todos os gates 401/200 OK. Backlog buildável esgotado; ⏳ restantes = **bloqueados em chave externa** (PIX/MercadoPago → chaves MP; reconcile Connect → billing API ElevenLabs).

### 🤐 Onda 2026-08-03 — caça à "falha silenciosa" (promessa dita, entrega não feita)
Ligar o WhatsApp Cloud da Med Mundo expôs uma **família de bugs que nenhum teste pegava**: o
sistema declarando sucesso sem verificar o envio. Nada quebrava, nada logava erro — só o produto
emagrecendo em silêncio. Varredura completa dos conectores de saída: **7 defeitos reais, todos
corrigidos, provados e no ar** (gates 401/403/200 reconferidos, apex 200, zero downtime).

- ✅ **Nono dígito BR** — `crm_caller_context` casava telefone só no formato cru/sem "+1" (US-centric).
  WhatsApp entrega `wa_id` SEM o 9, formulário/ligação vêm COM → **a Gui nunca reconhecia cliente
  brasileiro por WhatsApp**: sem histórico, sem chamar pelo nome. `phone_variants()` + match por
  últimos 8 dígitos (`db/phone_variants_intl.sql`). Provado nos 2 sentidos + sem vazar entre tenants.
- ✅ **Resposta fantasma (WhatsApp)** — `await sendWhatsApp()` descartava o retorno e o cérebro já
  tinha gravado "🤖 Gui replied". Cockpit jurava ter respondido, cliente não recebeu nada.
  Agora checa `ok` + loga "⚠️ NÃO foi entregue: <motivo da Meta>" + retry no formato BR alternativo.
- ✅ **Resposta fantasma (Instagram/Messenger)** — bug idêntico em `meta-webhook.js`.
- ✅ **Missed-call text-back** — logava "text-back sent" ANTES de enviar. SMS falhando (A2P) = lead
  morto com o dono achando que foi atendido. Agora envia primeiro e loga a verdade.
- ✅ **Alerta de crédito zerado** — `mark_credit_alerted` (latch de uma vez só) era marcado mesmo com
  o e-mail falhando/ausente → **o Gui do cliente calava e ele nunca era avisado**. Agora o alerta do
  dono muda pra 🚨 "cliente NÃO foi avisado — LIGUE". *(Auto-revisão pegou: não marcar criaria
  tempestade de e-mail a cada 15min no cron — mantive o latch e movi a verdade pro alerta do dono.)*
- ✅ **`sendApptEmail` mentia na raiz** — devolvia `true` sem olhar `r.ok` da Resend. Corrigido +
  wrapper `apptEmailOrFlag` nas 4 chamadas (book/cancel/reschedule): falha vira evento no cockpit.
- ✅ **Oferta de vaga da lista de espera** — envio descartado; vaga liberada + oferta não entregue =
  horário vazio invisível. Agora sinaliza pro dono ligar.

**Lei nova:** todo `await send*()` da plataforma checa o retorno e loga a falha com o motivo real do
provedor; log de falha usa `svcRpc` (`ingest_client_event` é service-role — com anon o próprio log
vira outra falha silenciosa). ⏳ WhatsApp: **entrada provada** (284ms ponta a ponta), **saída
bloqueada em conta Meta** (app não publicado) — ver memória `project_guileo_whatsapp_cloud`.

### 🇧🇷 Onda 2026-08-03 — PIX: o mercado brasileiro deixa de ser um beco sem saída
O "pagou-e-nada" que a JORNADA marcava como **próxima build grande** está construído. O caminho
"fecha e cobra" era **Stripe-only**: cliente brasileiro sempre caía em *"connect Stripe to collect"*
e a venda morria na conversa. Agora a Gui gera **PIX copia-e-cola de verdade, na conta Mercado Pago
DO CLIENTE**, e o dinheiro cai direto pra ele.

- ✅ `db/pix_tenant_collect.sql` — `mp_tenant_connect` / `mp_tenant_lookup` / `pix_collect_record`
  (as 3 SECURITY DEFINER, gated por literal, **negadas a anon E authenticated** — provado).
  Receita idempotente por `(client_email, ref)`: reentrega do MP com valor diferente **não duplica
  nem sobrescreve** (provado: R$123,45 gravado, R$999,99 reentregue → 1 linha intacta).
- ✅ `functions/lib/pix.js` — cria a cobrança em `POST /v1/payments` com o token do tenant,
  `X-Idempotency-Key` (retry de rede ≠ segundo QR), teto `MAX_CHARGE_BRL`, e texto pronto pro
  WhatsApp com o copia-e-cola **sozinho na última linha** (caractere colado junto quebra no banco).
- ✅ `functions/api/pix.js` — `connect`/`status` no portão do TENANT (get_client_data),
  `charge` no portão do AGENTE. O `connect` **valida o token contra o Mercado Pago antes de guardar**:
  guardar um token quebrado seria "conectado ✅" na tela e venda não cobrada no mundo real.
- ✅ `functions/api/pix-webhook.js` — endpoint **separado**, que não importa nenhuma RPC de crédito.
  Nunca confia no corpo: busca o pagamento com o token do tenant indicado; não está na conta dele → ignora.
  Um POST forjado apontando pra uma vítima devolve `tenant-not-connected` (provado em prod).
- ✅ `agent-action.js` — PIX entra **só quando o Stripe não resolve** (zero regressão pra quem já cobra
  por Stripe); passa pelo mesmo `spendGuard`; falha de emissão vira `pix_mint_failed` visível.

**Bug de dinheiro que a auto-revisão pegou ANTES do deploy:** `cli:spa@x.com` **passa** num teste
ingênuo de e-mail (o `:` é caractere válido antes do `@`). Sem barreira, um PIX de R$799 de um
cliente-do-cliente chegando no webhook de PLANOS creditaria **500 créditos Guileo a um tenant
fantasma**. Blindado por prefixo no topo do `mercadopago-webhook.js`, antes de qualquer olhar no valor.

⏳ Falta só o Luis: colar o **Access Token de produção do Mercado Pago** do cliente (ROTA-PIX).

### 🌐 Onda 2026-08-03 — "Site · Apps · Loja" vira produto de verdade
O produto **foundation** era vendido no plano Scale e **não tinha máquina de entrega nenhuma**
no repo. Agora cada cliente tem um site real em `guileoai.com/site/:slug`, montado com o que a
plataforma JÁ sabe — e com a Gui atendendo nele.

- ✅ `db/` — `client_sites` (RLS on) + `client_site_upsert` / `client_site_public` /
  `client_site_owner` / `client_site_get`. Só `client_site_public` é anon (é um site público) e
  ela usa **allowlist explícita** de campos: campo novo no perfil não vaza sozinho.
- ✅ `functions/api/client-site.js` — GET público (404 em slug inexistente) + POST do dono
  (get/save) no portão de tenant do cockpit.
- ✅ `src/pages/ClientSite.jsx` + rota `/site/:slug` + allowlist no `_middleware.js`.
  Seção sem dado **não aparece** — nada de lorem nem depoimento inventado.
- ✅ `functions/site/[slug].js` — meta SEO **server-side**. Sem isso, o link do site de um
  cliente no WhatsApp mostraria o título da GUILEO. Provado no HTML cru:
  `<title>Natura Spa + Salon · Astoria, NY</title>`.
- ✅ `src/portal/MeuSite.jsx` — aba no cockpit: endereço, chamada, sobre, cor, publicar/tirar do ar.
  Preço e serviço **não** se editam lá de propósito: duas verdades fariam a Gui falar um valor e o
  site mostrar outro.
- ✅ Formulário → speed-to-lead reusando a máquina endurecida (dedupe + claim + DNC + teto).
  Autentica por **slug**, nunca pela chave do cliente (que ficaria visível no HTML), e o slug só
  pode ENTREGAR lead — nunca listar. Provado em prod: `{"ok":true,...,"calling":true}`.

Provas: slug inválido/roubado recusados · rascunho invisível · slug não publicado → 401 · site
renderizado com preços reais · lead de teste apagado · Natura deixado **despublicado** (publicar
site de cliente real é decisão do Luis).

### 🔎 Onda 2026-08-03 — teste real da demo (3 defeitos, todos de honestidade)
Motor de demo testado de ponta a ponta contra um site real (naturaspanyc.com, 8s de resposta).
Funciona — mas entregava calado o que não devia:
- ✅ **Logo quebrado** — `extractLogo` devolvia a string `"data:;"` (favicon inline / href ruim).
  `data:;` é **truthy**, então a vitrine renderizava uma IMAGEM QUEBRADA em cima do pitch em vez
  de cair no fallback. Agora só `http(s)` vale, e um candidato rejeitado não encerra a cadeia
  (antes um og:image inline zerava o logo de um site que tinha apple-touch-icon válido logo abaixo).
- ✅ **Demo sem cor** — só `#rrggbb` era procurado, e site moderno usa hex de 3 dígitos, `rgb()`
  ou CSS externo. Adicionados os 3 formatos + busca na 1ª folha de estilo (teto de 2,5s e 120KB).
- ✅ **A demo mentia por omissão (o pior dos três)** — quando o scrape vinha vazio, ela preenchia
  com o template do setor e respondia `source:"url"` como se tivesse lido o site. Muitos sites
  (WordPress atrás de proteção, SPA) servem página cheia ao navegador e **casca vazia a IP de
  datacenter** — exatamente o caso do naturaspanyc.com. O vendedor mostrava ao prospect um
  "personalizado" que era genérico, e levava o "não é isso que a gente faz" na frente do cliente.
  Agora a resposta traz `generic: true` + a nota do motivo. O fallback continua (demo nunca fica
  vazia); o que mudou é que ele **se declara**.

- ✅ **Screenshot ao vivo LIGADO** (era o último inerte da demo). `SCREENSHOT_API` agora aceita
  **dois** marcadores, porque os provedores discordam: `{url}` (alvo codificado, para quem recebe
  em query param) e `{raw_url}` (alvo cru no caminho — thum.io e afins dão **400** com URL
  codificada, e só `{url}` existia). Provedor atual = thum.io, **sem chave e sem custo**.
  Provado: endpoint devolve `ready:true` → a URL entrega PNG de 993KB com o site real do prospect.
  Nota: a captura mostra o site COMPLETO enquanto nosso scrape via Worker recebe a casca — é a
  confirmação visual de que a degradação é anti-bot por IP, não bug nosso.

### 🧪 Onda 2026-08-04 — qualidade da Gui POR VERTICAL, medida sozinha
O harness de eval existia e era bom — mas tinha **17 casos e ZERO dimensão de vertical**: media
preço, tom e injeção genericamente. Os riscos reais são de setor, e passar em "segurança
genérica" não diz nada sobre eles.

- ✅ `src/data/verticalEvalCases.js` — **13 casos, um por vertical**, cada um mirando o dano
  específico: clínica (dor no peito → 911, não agenda), odonto (dose de remédio), advocacia
  (mérito/assinar), restaurante (**alergia anafilática — não pode dizer que é seguro**),
  HVAC (cheiro de gás → evacuar), imobiliária (*fair housing*), contabilidade, academia,
  salão (queimadura química), auto (freio), limpeza (preço inventado), obra (alvará),
  e-commerce (reembolso sem alçada). Regra: o `never` descreve **o dano, não a palavra** —
  proibir frase é fácil de driblar, proibir comportamento é o que o juiz julga.
- ✅ Ligado em `agent-eval.js` (mesmo juiz, mesma rubrica, mesmo histórico).
- ✅ **Ligado no `cron-tick`** (00h UTC, 1×/dia). O eval tinha rodado **3 vezes na vida, a
  última 15 dias antes** — nota que depende de alguém lembrar de rodar não é monitor, é
  intenção. Agora regressão de qualidade aparece sozinha no histórico.

⚠️ Ainda **não há medição** dos 13 casos — a régua está no ar, o resultado sai no 1º tique de
00h UTC e se lê em `agent_evals` (sem token: é o cron que tem o segredo).

### 🚀 Onda 2026-08-04 — prontidão pra vender AGORA
- ✅ **Alerta de saldo** (`health-monitor`): sonda saldo Twilio (<$20) e cota de voz ElevenLabs
  (≥85%) de hora em hora, dedup 7 dias, isolado. **Sem saldo o telefone do cliente PARA e hoje
  só se descobre pela reclamação** — a mesma falha silenciosa da onda anterior, agora coberta.
  Piso em `TWILIO_BALANCE_FLOOR_USD`. Com o saldo atual ($15,37) dispara no próximo tique.
- ✅ **Motor de depoimento real** (`db` + `/api/testimonial` + FounderProof): cliente escreve →
  fila → **Luis aprova** → landing mostra. A landing tinha `QUOTES=[]` (honesto, mas condenado a
  ficar vazio pra sempre). Provado: com 1 na fila, público = `[]`. Nada publica sem aprovação.
- ✅ **`/primeira-semana`** — material de venda HONESTO: 8 capacidades que já entregam + bloco
  "ainda não" (SMS/WhatsApp) dito ANTES da venda. Prometer canal que não acendeu ganharia a
  assinatura e perderia o cliente na 1ª semana.
- ⏳ **Provisionamento 1-clique**: o mapeamento já existe (`/api/bind-number`, ROTA-NUMERO). O que
  falta é a COMPRA automática de número — **caminho de dinheiro, não entra sem revisor
  adversarial**. E não é urgente: a conta tem **5 números e só 2 em uso**; os 3 ociosos atendem
  os próximos clientes sem gastar nada.

*Atualize os ✅/⏳ a cada onda. Este arquivo + ARQUITETURA.md + IMPLEMENTACAO.md = o cérebro completo do projeto.*

---

## 🚀 Onda 2026-08-09/10 — a segunda perna: MARKETING + CRIATIVO

**Mudança de identidade (Luis):** de "IA que atende" para **agência de IA + marketing + criativo**.
A pesquisa de mercado do mesmo dia explica por que isso não é só posicionamento:

| serviço | mercado 2026 |
|---|---|
| recepcionista IA sozinha | **$25–160/mês** — commodity em guerra de preço |
| gestão de anúncios | **$500–5.000/mês** |
| retainer especializado | **$2–10k/mês**, margem 60–80% |
| verticais que mais pagam | odonto, medicina, jurídico, financeiro ($2–5k) |

→ **A IA vira a PROVA, não o produto.** O dinheiro está no retainer de anúncios — que só a Guileo
consegue provar, porque atende o telefone. O $49 é porta de entrada.

### ✅ Entregue e provado
- Medição gasto→receita por campanha · atribuição por **cookie** e por **ligação** (número por campanha)
- Importador de relatório colado (Google/Meta) — reimportar não duplica (provado: 2 importações → 2 linhas)
- **O vigia**: varre toda segunda e avisa o que precisa de decisão — inclusive a OPORTUNIDADE
- Anúncios no relatório semanal do cliente
- Criativo de post (idioma consertado) + **criativo de anúncio** com autocorreção de limite
- Aba Anúncios do cockpit: dado real; exemplo em demonstração com selo em CADA número
- Pitch card `ads` (PT/EN/ES) no /vendedor

### 🔴 Bloqueado em clique do Luis (não é código)
- **SMS/A2P** — campanha rejeitada; causa achada: apontava para a home em vez de `/sms`. Texto pronto em `db/campanha-a2p.txt`
- **Google Agenda** — app OAuth em "Testing"
- **Publicação social** — META_APP_SECRET

### ⏳ Aberto (próxima onda)
- Criativo integrado nos hubs de **vendedor** e **admin** (hoje só no cockpit do cliente)
- Envio real do e-mail do vigia (precisa do DIGEST_TOKEN — rodar `?seco=1` antes)
- ✅ **As 10 cópias de `MODEL_CHAIN` viraram 1** (2026-08-12): as 9 declarações locais agora
  importam de `lib/guiBrain.js`. Estavam TODAS idênticas — conferi antes de mexer, e é justamente
  por isso que a hora de unificar era agora: depois que uma diverge, alguém já foi atendido pelo
  modelo errado e ninguém sabe qual superfície foi.

### 2026-08-10 · Motor de agente + o fim do "sucesso" falso
- **Motor de agente** (`licoes.js` + carimbo + `/api/agent-evolve`): lição nova → sobe `VERSAO` →
  a frota inteira sobe sozinha. Provado subindo a versão 3 vezes (v3→v4→v5) com 4 agentes acompanhando.
  ✅ **A VARREDURA JÁ ESTÁ NO CRON** (verificado 2026-08-12): `cron-tick` dispara `agent-evolve` às
  13 UTC. Provado no banco — os 4 agentes subiram de v5 para v6 entre 09:01:24 e 09:01:35 (NY),
  11 segundos para a frota inteira, `total_atrasados: 0`. Esta linha estava DESATUALIZADA e pedia
  ao Luis algo que já existia — nota de manutenção do próprio JORNADA vale tanto quanto o código.
- **A ligação do Kashif** virou 4 lições: anunciou-faz, não abra assunto novo, feche o que abriu,
  cada pergunta custa um pedaço da venda.
- **Cockpit honesto**: "Successful ✓" (auto-avaliação do modelo) saiu de todas as telas e dos 4
  idiomas; ficha agora separa "ligação foi até o fim" de "resultado confirmado". A lista de
  oportunidades passou a incluir quem quis marcar e não deu para confirmar (8 casos que estavam
  invisíveis, incluindo o Kashif) com marcação própria 🔎, para não virar ruído.
- ✅ **FECHADO 2026-08-12 — o elo exato existe** (`db/elo_ligacao_agendamento.sql`). A recusa de
  amarrar por telefone+janela estava certa: no dia em que duas ligações do mesmo número acontecem
  perto, casa a pessoa errada. O elo verdadeiro é o `conversation_id`, que só o provedor sabe —
  agora ele viaja no cabeçalho `x-guileo-conv` da ferramenta de agenda e é gravado DEPOIS do book
  já ter dado certo, em tabela própria (`call_bookings`), best-effort: se a escrita falhar, o
  cliente segue agendado e só o relatório fica sem elo. **A falha cai no lado barato, nunca no
  dinheiro.** FAIL-CLOSED: um `conversation_id` fora do formato `conv_…` (ex.: o placeholder não
  substituído pelo provedor) é RECUSADO — elo falso é pior que elo nenhum, porque afirma com
  confiança que aquela ligação gerou aquele agendamento. Provado: placeholder→não liga, vazio→não
  liga, id real→liga com id, repetido→mesmo id sem duplicar.
