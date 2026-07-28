# 🛠️ ROTAS DE IMPLEMENTAÇÃO — receitas nomeadas (leia a rota, execute em minutos)

> Cada ROTA é uma receita testada. Antes de qualquer uma, o contrato de 3s é o [ARQUITETURA.md](ARQUITETURA.md).
> Convenção: `ROTA-NOME` · **Quando** · **Passos** · **Prova**. Tudo escopado por `client_email` (tenant).
> Segredos: INGEST `glo_ing_7f3da9c2b4e8` · SCHED `gss_7Kx2mQ9vR4tZ8nL` · deploy `npx wrangler pages deploy dist --project-name=guileoai --branch=main`.

---

## ROTA-ATIVAR · nascer um cliente novo
**Quando:** fechar um cliente. **Passos:** vendedor preenche tudo em `/vendedor → ➕ Cadastrar cliente` → vira draft (`onboard_drafts`) → Luis aprova em `/admin` (senha `Guileo2026`) → `onboard-client.js` cria agente ElevenLabs + cérebro + agenda + widget + código de conexão. **⚠️ Se o tenant JÁ tem `biz_*` dados** (carga manual prévia), a aprovação DUPLICA → rode `biz_admin_import(SCHED, email, {...,"replace":true})` pra limpar. **Prova:** `select status,agent_id,number from onboard_drafts where client_email=…` → status `live`.

## ROTA-NUMERO · dar voz ao agente (mapear número Twilio)
**Quando:** agente nasceu com `number=null` e precisa atender/ligar por voz. **Fluxo no /admin (card do cliente "live"):**
1. **📋 Meus números Twilio** → `POST /api/twilio-numbers` (admin-gated) lista os números da conta e diz ONDE cada um está: 🟢 `Livre` · 🔒 `Agente de [Negócio]` · 🔒 `Número do demo do site (saída)` (esse é o `+19864443334` do demo da landing — NÃO usar pra cliente).
2. Clica um 🟢 **Livre** → preenche o campo → **🔢 Mapear número** → `POST /api/bind-number {email, number}` importa no ElevenLabs convai + PATCH `agent_id` + `draft_set_number`.
**Como o lister sabe o "onde":** cruza a lista `/v1/convai/phone-numbers` (agente por número) com `onboard_drafts.agent_id → business`. **Regra:** nunca mapear o número do demo num cliente; um número = um agente. **Prova:** endpoint devolve `{ok:true, phone_number_id}` + ligar pro número → o agente atende. **Arquivos:** `functions/api/twilio-numbers.js`, `functions/api/bind-number.js`, `src/components/OnboardApprovals.jsx`.

## ROTA-GCAL · conectar o Google Agenda do cliente
**Quando:** cliente quer ver as reservas no calendário que já usa. **Passos:** dono do cliente entra no cockpit `/portal → Integrações → Conectar Google` (OAuth, 1 clique) → `gcal-connect.js` guarda o refresh_token (`client_integrations` provider='gcal'). Toda reserva depois cai lá via `gcalPush` em `agent-schedule.js`. **Precisa:** `GOOGLE_CLIENT_ID/SECRET` no Cloudflare (já setados). **Prova:** reservar → evento aparece no Google Agenda do dono.

## ROTA-WIDGET · chat da IA no site do cliente
**Quando:** cliente quer a IA atendendo por chat no site dele. **Passos:** copiar o snippet do card no `/admin` (ou montar: `<script src="https://guileoai.com/gui-widget.js" data-guileo="EMAIL_DO_CLIENTE" data-lang="pt" defer></script>`) → cliente cola no site. Logo/cor/nome vêm do perfil dele. **Prova:** curl `POST /api/widget-chat {client:EMAIL, sessionId, message}` → responde com preços reais do cliente.

## ROTA-PRECOS · atualizar serviços/preços de um cliente
**Quando:** cliente confirma preços novos. **Passos:** `select biz_admin_import('gss_7Kx2mQ9vR4tZ8nL', 'EMAIL', '{"replace":true,"locations":[…],"services":[{"name":…,"price_cents":…}],"professionals":[…]}'::jsonb)`. `price_cents=null` = "especialista confirma". **Prova:** `biz_lookup(SCHED, email)` mostra os preços novos; o chat/voz cotam na hora.

## ROTA-IDIOMA · adicionar idioma
**Quando:** mercado novo. **UI (4 langs):** dict em `src/i18n.jsx` + cada página. **VOZ (20 langs):** `LANGS_SPOKEN` em `functions/lib/provision.js` — o agente detecta e responde. **Cadastro:** checkboxes em `OnboardWizard.jsx`. **Prova:** trocar idioma na página converte tudo; agente responde no idioma do cliente.

## ROTA-CIDADE · adicionar cidade/bairro SEO
**Quando:** expandir geografia. **Passos:** adicionar entrada em `src/data/seoCities.js` (slug, areaCodes reais, `hook:{en,pt,es}`, neighborhoods) → build → sitemap automático. **Prova:** `/ai-receptionist/SLUG` e `/for/VERTICAL/SLUG` retornam 200 com o gancho local.

## ROTA-CANAL · ligar um canal pendente (WhatsApp/IG/…)
**Quando:** a API/aprovação do canal libera. **Passos:** setar a env/creds do canal no Cloudflare → o código já wired acende sozinho (padrão scaffold-inerte). WhatsApp: aprovar sender Twilio. IG/FB/TikTok/LinkedIn/Google Business/Ads: OAuth/API key. **Prova:** o canal muda de âmbar "aguardando" pra verde "ativo" no cockpit.

## ROTA-MARKETPLACE · conectar Yelp/Angi/Thumbtack/Zillow/StreetEasy
**Quando:** cliente de serviços/imóveis vive de marketplace. **Passos:** no cockpit `Leads Marketplace` copia a URL pessoal (`/api/marketplace-leads?email=…&key=…&source=…`) → cliente cria um Zap (novo lead por e-mail → POST nessa URL) OU encaminha os e-mails de lead. Lead chega → CRM → **Gui liga em 60s**. **Prova:** `mkt_lead_record(...)` → `mkt_leads_list` mostra o lead; segundo envio deduplica.

## ROTA-SQUARE · conectar agenda Square do salão
**Quando:** salão usa Square Appointments. **Passos:** `POST /api/square-appointments {action:"connect", email, token, access_token, location_id}` (o dono cola o próprio Personal Access Token do Square) → verifica live. Depois `availability`/`book` caem no Square dele. **Prova:** `{action:"status"}` → `ready:true`. (Booksy = scaffold inerte, sem API pública.)

## ROTA-CUPOM · criar cupom/campanha branded
**Quando:** cliente quer promoção. **Passos:** cockpit `Cupons & Campanhas` → botão de gerar rápido (BOGO/1+1/aniversário/%) → salvar → compor campanha (e-mail com logo/cor do cliente) → enviar/agendar. **Prova:** `coupon_upsert`→`coupon_validate`→`coupon_redeem` (atômico, tenant-bound).

## ROTA-DATAS · aniversário + datas comemorativas automáticas
**Quando:** ligar marketing sazonal. **Passos:** cockpit `Datas & Aniversários` (toggle aniversário + adicionar Dia das Mães/Natal/Black Friday com mensagem/oferta). Dispara sozinho via cron (`/api/proactive`). **Prova:** `marketing_dates_set`→`marketing_dates_today`; envio deduplicado por `marketing_date_claim`.

## ROTA-STORM · Modo Tempestade (furacão)
**Quando:** tempestade/emergência climática. **Passos:** cockpit `Modo Tempestade` → 1 botão (datas + mensagem) fecha a agenda + avisa quem tinha horário; "Reabrir agora" dispara o blast "estamos de volta". **Prova:** `storm_activate`→agenda fechada→`storm_reopen` (blast 1×).

## ROTA-CORRIGIR-DADOS · auditar/consertar um tenant
**Quando:** dado suspeito de um cliente. **Passos (via MCP execute_sql, SEMPRE `where client_email=…`):** `biz_lookup` (agenda), `profile_extras_get` (marca/logo/voz), `crm_leads_recent`. Consertar com UPDATE escopado ou `biz_admin_import replace:true`. **NUNCA** tocar outro tenant. **Prova:** re-ler o RPC → dado correto.

## ROTA-COMPANYOS · abrir/dar AÇÃO a um departamento do Company OS
**Quando:** um dos 8 departamentos da própria Guileo (`/admin` → "🏢 Company OS · Departamentos") deve deixar de ser só KPI e ganhar OPERAÇÃO (visão-DONA cross-tenant). **Padrão (o mesmo do Sales+Support, 2026-07-23):**
1. **RPC cross-tenant** em `db/company_os_ops.sql` — leitura (`company_*_...`) + mutação, gated pelo literal INGEST, SECURITY DEFINER, EXCEPTION-guarded. A mutação afeta APENAS a linha pontual e loga o rastro no timeline do **próprio tenant dono** (`crm_timeline_events`, `channel='company-os'`) — NUNCA vaza cross-tenant. Aplicar via MCP.
2. **Endpoint** — estender `functions/api/company-os.js` com a `action` nova (admin-gated: `sameOrigin` + `blitz_stats`). RPCs de dinheiro/estado → INGEST; RPCs que já existem SCHED-gated (ex.: tickets) → passar `env.SCHED_SECRET`. Ação que "a Gui faz" e tem contato com email → mandar email branded via `reengageEmail` (funciona hoje); telefone espera A2P.
3. **UI** — expandir `src/components/CompanyOS.jsx` (card vira painel), tema claro do /admin, PT, updates otimistas com REVERT em `{error}` (nunca sucesso falso).
**Regra de ouro:** mutação cross-tenant é zona sensível → eu (Claude) construo DB+endpoint com revisão adversarial, delego só a UI. **Prova:** seed 1 registro → `action` de leitura mostra → `action` de mutação muda o estado (round-trip) → limpar o seed → curl do endpoint dá 403 same-origin. **Live 2026-07-23:** Sales (pipeline vivo: mover deal + Gui follow-up) + Support (fila: resolver + Gui responde). **Arquivos:** `db/company_os_ops.sql`, `functions/api/company-os.js`, `src/components/CompanyOS.jsx`.

## ROTA-AUTONOMIA · o dial "quanto a Gui age sozinha" por tenant
**Quando:** controlar/pausar a autonomia de um cliente. **Níveis (db/company_os_autonomy.sql):** `off` = a Gui NÃO age sozinha (dono pausou) · `safe` (default) = age só nas ações SEGURAS (email: reativar/nutrir/lembrar/agradecer) · `full` = libera voz/SMS quando A2P/consentimento existir. **DINHEIRO/risco NUNCA é automático em nível nenhum.** **Como:** `/admin` → Company OS → "🎚️ Autonomia & Saúde" → email + nível → Salvar (`autonomy_set`). O `proactive.js` lê `autonomy_all` 1×/varredura e PULA os `off` (fail-open pra safe se a leitura falhar). **Self-healing:** `company_agents_health` detecta agente sem nome próprio/sem KB (raiz do bug "atendeu como Gui") → conta no brief do dono; re-sync = 1-clique (sync-agent). **Prova:** `autonomy_set(...,'off')` → `autonomy_all` mostra → proactive pula o tenant. **Arquivos:** `db/company_os_autonomy.sql`, `functions/api/proactive.js`, `functions/api/company-os.js`, `src/components/CompanyOS.jsx`.

## ROTA-MEUOS · o Company OS do PRÓPRIO cliente (/portal, produto)
**Quando:** dar a cada cliente o cockpit dos 8 departamentos DELE. **Como:** aba "Minha Empresa" no `/portal` (src/portal/MyCompanyOS.jsx) → `POST /api/my-company-os {email, key}` (gate per-tenant get_client_data) → `my_company_os(secret,email)` devolve os 8 deptos escopados por client_email. Mesma cara do painel-dono, mas o cliente só vê o dele. **Prova:** `my_company_os(INGEST, email)` → 8 deptos reais do tenant; chave de outro cliente → 401.

## ROTA-BRIEFDONO · o "sua empresa se operou hoje" (cron diário)
**Quando:** já está ligado — a Gui manda 1×/dia (13h UTC) pro OWNER_EMAIL. **Como:** `/api/company-os-brief` (DIGEST-gated, só OWNER_EMAIL) → `company_os_autobrief` (did = o que a Gui fez 24h / needs = o que precisa do dono) → `companyBriefEmail`. Wired no cron-tick. **Prova:** render do template + endpoint 401 sem token.

## ROTA-FEATURE · adicionar uma feature nova (ciclo de 6 passos)
1 rota/aba → 2 UI (padrão da vizinha) → 3 endpoint (gate certo) → 4 SQL (`db/*.sql` via MCP) → 5 build+deploy → 6 PROVA (round-trip + curl + screenshot). Ondas paralelas = arquivos disjuntos, `Portal.jsx`/`emailTemplates.js` só o orquestrador toca. Registrar aba no Portal = 5 pontos (import, view-map, inject, ícone, NAV_GROUPS).

## ROTA-CRON · adicionar um motor ao despertador
**Quando:** novo sweep automático. **Passos:** adicionar a URL token-gated em `functions/api/cron-tick.js` (o worker `guileo-cron` chama a cada 15min). Escolher a cadência (todo tick / horário / diário). **Prova:** `POST /api/cron-tick` → `ran:{...:200}`.

## ROTA-STRIPE · organizar pagamentos
**Quando:** ligar dinheiro de ponta a ponta. **Passos:** seguir [db/STRIPE_SETUP.md](db/STRIPE_SETUP.md) — produtos nos centavos exatos + 5 eventos de webhook + estratégia Connect. **Prova:** `/api/money-reconcile` (Stripe = livro-caixa) + `money_reconcile(INGEST, 30)`.

## ROTA-CARTEIRA · carteira permanente do vendedor
**Regra do Luis:** quem cadastra o cliente ASSINA pra sempre (`assigned_seller` em `onboard_drafts`; troca SÓ via SQL admin, nunca sobrescrita). Cada cliente carrega indústria (payload→verticals[0]). **Onde:** SQL `db/seller_wallet.sql` (RPC `seller_wallet`, `draft_approve_mark` 5-args persiste `connection_code`); API `onboard-draft.js action=wallet` (admin=todas · roster=chave completa · team-code=chave MASCARADA ••••XXXX, pois o code compartilhado não prova quem pede); UI `src/components/SellerClients.jsx` no hub /vendedor aba Ativação (pipeline 🌱→✅→🤖→🟢 + 🔑 chave + 📲 wa.me pronto + selo 🤝). **Copiloto de ativação** = `/api/activation-assist` (chat IA no topo da aba; fatos sincronizados com `src/data/activation.js` — mudou ativação, muda os DOIS). **No /admin:** `src/components/ClientWallet.jsx` (coluna direita) — cartões estilo Apple Wallet empilhados (clique puxa o passe) com semáforo 🟢 no ar (live+agente+número) · 🟡 atenção (meio-nascido) · 🔵 pendente (draft) · 🔴 desativado; mesma fonte (`action=wallet` com token). **Prova:** SQL round-trip draft_save→approve_mark(code)→seller_wallet; curl `action=wallet` com GUILEO-DONO.

## ROTA-REPASSE · pagar comissão de vendedor (dinheiro — 2 cliques, idempotente)
**Quando:** acertar comissões. **Fluxo:** `/admin → Vendedores → passe do vendedor` mostra 🏆 ranking + saldo devido (`seller_balance` = ledger refund-net − repasses) → **💸 Marcar repasse pago** (valor pré-preenchido, confirm de 2 cliques com valor+nome; UI cunha `dedupe_key` por submissão — retry de rede NUNCA paga em dobro, e `duplicate:true` grita na tela). Vendedor vê saldo+histórico na aba Financeiro (`action:"mine"`, roster-only — código de time NÃO abre finanças). **Arquivos:** db/seller_payouts.sql · /api/seller-payouts · SellerFinance/SellerManager. **Prova:** `seller_payout_record` 2× mesma key → mesmo id + duplicate:true; saldo vai a zero.

## ROTA-TROCA · transferir carteira (só se o CLIENTE desejar)
**Regra do Luis:** cliente é do vendedor PRA SEMPRE; troca SÓ por desejo do cliente, SÓ o admin executa, motivo OBRIGATÓRIO, trilha permanente. **Fluxo:** `/admin → passe do cliente → 🤝 trocar` (dropdown vendedores ativos + motivo) → `seller_wallet_transfer` (audit na mesma transação, update por client_email — nunca uuid). **⚠️ Comissão NÃO reescreve:** o ledger corta por data da troca (`own_intervals` sobre `seller_wallet_transfers`) — o antigo mantém o que ganhou até a troca, o novo ganha dali em diante (provado: A mantém $449 pré-troca, B ganha só o pós). **Arquivos:** db/seller_transfer.sql · /api/seller-transfer · ClientWallet.

## ROTA-INTENT · lead quente capturado no widget
**Quando:** conferir/estender a captura de intenção de agendamento. **Onde:** `widget-chat.js` (BOOK_RX multi-idioma + telefone/email na conversa → RPC `booking_intent_start`, INGEST-gated, idempotente por contato aberto). **Prova:** curl widget com "book + phone" → `select * from booking_intents where source='webchat'` (repetir = mesma linha).

## ROTA-SPEEDLEAD · conectar QUALQUER form de site → Gui liga em ~60s
**Quando:** o cliente quer que, ao preencher um form (no site DELE ou hospedado no Guileo), a Gui ligue de volta na hora (speed-to-lead). **Duas formas, as duas LIGAM automaticamente pelo gate blindado `/api/call` (DNC + tetos 50/dia + 12h/telefone compartilhados):**
1. **Form hospedado no Guileo** (aba Captura → link público do form): `intake.js submit` → `intake_submit` (devolve tenant+phone) → dispara o callback via `waitUntil` (form responde na hora, Gui liga em seguida). Consentimento = o cliente-final preencheu um form de contato pedindo retorno.
2. **Form do site do cliente / Zapier / Make / qualquer no-code:** POST em `/api/marketplace-leads?client=<email do tenant>&token=<connection key>` com `{ name, phone, email, service, message, source:"website" }` → Gui liga em ~60s (claim atômico anti-duplo). Snippet HTML pro form do cliente: `fetch('https://guileoai.com/api/marketplace-leads?client=EMAIL&token=KEY',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,email,source:'website'})})`. A connection key sai do onboarding (a mesma `?code=` do portal).
**Prova:** `intake_submit` devolve `{tenant,phone,name}` (round-trip SQL provado); form submit responde `calling:true` quando há telefone + chaves ElevenLabs; a ligação passa pelo `/api/call` (nunca disca fora do gate). **Gate:** precisa `ELEVENLABS_API_KEY` + `ELEVENLABS_PHONE_NUMBER_ID`; sem eles o lead é salvo mas não liga (honesto).

## ROTA-BACKFILL · vincular o agente próprio de um cliente ao callback (Gui liga COMO o cliente)
**Quando:** um cliente EXISTENTE não dispara o callback com o agente/número dele (o `agent_id` nasceu no projeto antigo inacessível, ou nunca foi gravado no `client_agents`). **Como funciona:** `/api/call` disca AS o agente do tenant resolvendo `client_agent_resolve(email)` no caminho interno (token `x-guileo-internal`). Novos onboards gravam sozinhos (`onboard-client.js` → `client_agent_upsert`); o resolve cai pra `client_credits.agent_id` (a maioria já tem). Pra quem NÃO tem em lugar nenhum acessível: **ferramenta admin `/api/agent-backfill`** (usa `ELEVENLABS_API_KEY` server-side — a chave nunca sai do servidor):
1. `POST {token:<admin>, list:true}` → lista agentes + números da conta ElevenLabs (o `/convai/agents` às vezes dá 422; o `/convai/phone-numbers` sempre traz `phone_number → agent_id + phone_number_id`, então dá pra achar o agente pelo número/label).
2. `POST {token, email, match_number?, match_name?}` (dry) → mostra o agente que vai gravar; confira o label/nome.
3. `POST {token, email, match_number?, match_name?, apply:true}` → grava no `client_agents`.
Ou, sabendo o `agent_id`, direto: `select public.client_agent_upsert('glo_ing_7f3da9c2b4e8', email, agent_id, el_phone_number_id, number);`. **Prova:** `client_agent_resolve(email)` devolve `{agent_id, el_phone_number_id, number}`. **Exemplo real:** Natura backfilled 2026-07-20 → `agent_8701kxnfhgmgefzbbwda8d86mqwj` + +19298288170. **Cuidado:** nunca use o número RESERVADO do demo (+19864443334) como caller-ID de cliente.

## ROTA-MOTOR · ligar / alterar um motor de canal (agenda, Google, Meta, etc.)
**Quando:** acender um motor novo pro cliente OU mexer num existente. **Mapa:** [MOTORES.md](MOTORES.md) = estado + arquivos + chave externa + como gasta crédito de CADA motor. **Passos:** (1) achar o motor no MOTORES.md; (2) conector = padrão inerte-que-acende-sozinho: `functions/api/<motor>.js` com connect/status/ações, retorna `ready:false` sem a env/cred (NUNCA finge); (3) cred por-tenant em `client_integrations` (provider=<motor>, via store_integration INGEST-gated); (4) se é canal de AGENDA → registrar no `scheduleAdapter.js` (prioridade + service_map); se é canal de MENSAGEM → rotear pro mesmo cérebro (widget-chat/support brain); (5) **todo motor que a Gui opera GASTA CRÉDITO** — garantir que a ação debita/loga (motor financeiro é o medidor); (6) portal: card em ScheduleSync/GoogleHub/Integrations pro cliente conectar; (7) done-for-you (Ads/posts complexos) = pedido→/admin→status honesto, não fingir automação. **Prova:** conector `ready:false` sem chave (honesto) → acende com a cred; crédito debitado; screenshot do card. **Regra:** cada motor no MOTORES.md tem UMA chave externa clara — o sistema fica inerte e verdadeiro até o Luis tê-la.

## ROTA-SINCRONIA · coerência total do sistema (rodar ao fim de TODA onda)
**Regra do Luis:** admin, landing, hub, portal, docs — TUDO de acordo e atualizado SEMPRE, todas as categorias, sem falhas. Mudou algo numa categoria → varra os pontos dela ANTES do deploy final:
- **💰 Preços/planos** — fonte única = `src/data/guileoPlans.js` (Essential $149/500cr · Personalized $449/2000cr · Full Operation $999/6000cr + BR R$799/2.499/5.499). Espelhos que TÊM que bater: `selfServePlans.js` (nomes/urls), `setup-selfserve.js` PLANS (Stripe — renomear é IN-PLACE via `legacyName`, nunca produto novo), `mercadopago-*` (mapa BRL), `Planos.jsx` (SEO title/desc + JSON-LD), hub SellerQuote/SellerContract, i18n de pricing na landing.
- **🗣️ Idiomas** — VOZ = 20 (`LANGS_SPOKEN` em provision.js) · UI = 4 (i18n.jsx EN/PT/ES/HI). Toda menção a contagem de idiomas (landing, serviceCatalog, docs, SEO) cita esses números — nunca "3/9/trilingual" fossilizado.
- **📣 Claims da landing** — feature nova grande no produto (radar, pacotes, relatório ROI…) = atualizar `i18n.jsx`/páginas pra landing não subvender nem prometer o que não existe.
- **🎛️ Admin ↔ produto** — nova capability do cliente aparece no `/admin` (carteira/passe) e nos fatos de `src/data/activation.js` (copiloto). Mudou ativação = muda `activation.js` E `/api/activation-assist` juntos.
- **🧭 Hub do vendedor** — pitch/quote/contrato/treino falam os MESMOS nomes, preços e capacidades do produto real; mercado US/BR consistente.
- **🏪 Portal do cliente** — aba nova registrada (5 pontos do ROTA-FEATURE) e o Gui Suporte/KB sabendo responder sobre ela.
- **📖 Docs vivos** — `ARQUITETURA.md` (mapa 3s), `IMPLEMENTACAO.md` (rota nova/alterada), `JORNADA.md` (gap ✅), memória do Claude.
**Prova:** grep pelos valores ANTIGOS retorna zero (`grep -rn "Guileo Starter\|9 idiomas\|trilingual…" src/ functions/ *.md`); screenshot das páginas tocadas. **É a última etapa da onda completa — sem ela a onda não terminou.**

---
*Nova rota recorrente? Adicione aqui com um nome ROTA-XXX. É o índice de execução do dia a dia.*

## ROTA-DEMO — vitrine personalizada (vende na call)
**Quando:** mostrar qualquer produto na marca do cliente (call/vendedor) ou dar um link que vende sozinho.
**Passos:** entra URL/@/marca → `/api/demo action:brand` puxa marca real (logo/cores/negócio) + fatos do site → escolhe produto → prévia na marca (site+widget · IG skin · app mockup · voz · ads/SEO/email) → "copiar link" (`action:save`) = `/vitrine/:token` compartilhável → `action:lead`/`view` capturam no CRM/analytics. Onde: `DemoEngine.jsx` em /vendedor, /admin, /vitrine público + nav.
**Chave externa (acende sozinho):** `SCREENSHOT_API` (screenshot ao vivo do site; sem ela = placeholder honesto).
**Checkout embutido (demo→compra 1-clique):** botões de plano na demo → `/api/demo action:checkout` devolve o Payment Link **canônico já auditado** (KEEP_URLS) com `?client_reference_id=demo_<token>_<produto>` (sanitizado [A-Za-z0-9_-]). Stripe copia o ref na sessão → stripe-webhook loga `checkout_done` (funil fecha) **sem tocar em crédito**. Ref `demo_` é ignorado pelo bloco de comissão de vendedor. Analytics: `action:stats` (contagens view→lead→checkout_start→checkout_done por produto; painel no /vendedor+/admin).
**Voz na demo:** card "voice" tem input de telefone → `POST /api/call` (gate blindado: sameOrigin+caps+DNC+E.164) com `business`/`need` como dynamic_variables → a Gui LIGA saudando como a marca. Não é widget in-browser (convai removido). Caveat: caller-ID US não-registrado pode silenciar o toque até A2P.
**Prova:** `/api/demo` 200 · `/vitrine` 200 · SSRF bloqueado · token 64-char · checkout devolve só os 3 links · ref sanitizado · stats agrega funil · `/api/call` da demo: inválido→400, cross-origin→403.

## ROTA-ONBOARD — máquina do "sim ao kickoff" (7 passos)
**Quando:** cliente fecha → tudo dispara sozinho até o projeto começar. "Automatiza o envio, nunca a decisão."
**Passos (cadeia):** 1 contrato → 2 welcome → 3 fatura → 4 acesso (auto-provision) → 5 kickoff + **brief IA** → 6 relatório ROI mensal → 7 check-in 30/60/90 (sentimento). `/api/onboarding` (SECRET-only: cron+stripe), `onboard_status` = barra de progresso + painel de conversão. E-mails via emailTemplates.js.
**Gatilhos:** stripe-webhook (pago→avança acesso, deferido/wrapped) + cron-tick (check-in diário · report dia 1º).
**Primeiro-valor-na-1ª-hora:** pago→Gui nasce→dispara 1 ligação real pro telefone do DONO discando como a Gui dele (path interno /api/call, DNC+caps+E.164), o dono ouve a própria Gui na hora. Deferido/wrapped (nunca toca dinheiro), dedup `claim_credit_event('first_value:<email>')` (recompra não re-disca; renovação nem entra). Sem telefone→pula (welcome email leva o número). Loga client_event `first_value`.
**Chave externa:** `ESIGN_WEBHOOK` (contrato auto-assinado; inerte até setar) · `KICKOFF_URL` (link de agenda).
**Prova:** start→29% idempotente · sentiment ghost rejeitado (0 linha) · 403 sem segredo.
