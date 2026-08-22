# 🛠️ ROTAS DE IMPLEMENTAÇÃO — receitas nomeadas (leia a rota, execute em minutos)

> Cada ROTA é uma receita testada. Antes de qualquer uma, o contrato de 3s é o [ARQUITETURA.md](ARQUITETURA.md).
> Convenção: `ROTA-NOME` · **Quando** · **Passos** · **Prova**. Tudo escopado por `client_email` (tenant).
> Segredos: INGEST `glo_ing_7f3da9c2b4e8` · SCHED `gss_Kp9mX4vR2tZ7nQ5wL8bc` · deploy `npx wrangler pages deploy dist --project-name=guileoai --branch=main`.

---

## ROTA-ATIVAR · nascer um cliente novo
**Quando:** fechar um cliente. **Passos:** vendedor preenche tudo em `/vendedor → ➕ Cadastrar cliente` → vira draft (`onboard_drafts`) → Luis aprova em `/admin` (a senha ROTACIONA — leia sempre do banco: `select pg_get_functiondef(oid) from pg_proc where proname='_admin_ok'`; anotar a senha em doc só cria doc mentiroso) → `onboard-client.js` cria agente ElevenLabs + cérebro + agenda + widget + código de conexão. **⚠️ Se o tenant JÁ tem `biz_*` dados** (carga manual prévia), a aprovação DUPLICA → rode `biz_admin_import(SCHED, email, {...,"replace":true})` pra limpar. **Prova:** `select status,agent_id,number from onboard_drafts where client_email=…` → status `live`.

## ROTA-NUMERO · dar voz ao agente (mapear número Twilio)
**Quando:** agente nasceu com `number=null` e precisa atender/ligar por voz. **Fluxo no /admin (card do cliente "live"):**
1. **📋 Meus números Twilio** → `POST /api/twilio-numbers` (admin-gated) lista os números da conta e diz ONDE cada um está: 🟢 `Livre` · 🔒 `Agente de [Negócio]` · 🔒 `Número do demo do site (saída)` (esse é o `+19864443334` do demo da landing — NÃO usar pra cliente).
2. Clica um 🟢 **Livre** → preenche o campo → **🔢 Mapear número** → `POST /api/bind-number {email, number}` importa no ElevenLabs convai + PATCH `agent_id` + `draft_set_number`.
**Como o lister sabe o "onde":** cruza a lista `/v1/convai/phone-numbers` (agente por número) com `onboard_drafts.agent_id → business`. **Regra:** nunca mapear o número do demo num cliente; um número = um agente. **Prova:** endpoint devolve `{ok:true, phone_number_id}` + ligar pro número → o agente atende. **Arquivos:** `functions/api/twilio-numbers.js`, `functions/api/bind-number.js`, `src/components/OnboardApprovals.jsx`.

## ROTA-PROVISION · conseguir um número pro cliente (reusa antes de comprar)
**Quando:** cliente novo e nenhum número livre óbvio — antes do ROTA-NUMERO. É a **única rota que gasta dinheiro sozinha**, então roda em duas etapas.
1. **Simular:** `POST /api/provision-number {token, email}` → responde `dry_run:true` com `would_reuse` (custo 0) ou `would_buy` + `cost_usd` + saldo + quantas compras já saíram hoje. **Nada acontece sem `confirm:true`.**
2. **Efetivar:** o mesmo POST com `"confirm": true` → reserva o ocioso (custo 0) ou compra. Depois: **ROTA-NUMERO** pra ligar a voz.

**As 6 travas (todas fail-closed — se a leitura falha, a rota RECUSA):** ① reusa ocioso antes de comprar · ② piso de saldo `PROVISION_BALANCE_FLOOR_USD` (padrão 25; saldo ilegível = recusa) · ③ teto diário `PROVISION_MAX_PER_DAY` (padrão 3) · ④ idempotência por tenant (`client_number_for`) · ⑤ `dry_run` padrão · ⑥ admin-only + rate-limit 6/5min.
**Por que atômico:** contar-e-depois-gastar é corrida — dois cliques simultâneos passavam os dois. `provision_claim` tranca (`pg_advisory_xact_lock`), conta o teto e **reserva o número no mesmo instante**; `provision_settle(ok=false)` solta se a compra falhar.
**Nunca oferece:** número de outro cliente (união `client_agents` + `client_integrations` + `provision_log`) nem o `+19864443334` do demo (`functions/lib/reserved.js`, compartilhado com o bind-number).
**Prova:** sem token → 401; token errado + `confirm:true` → 401 (a compra é inalcançável); `provision_claim` do mesmo número 2× → `numero_ja_reclamado`; `p_max:1` no 2º → `teto_diario`.
**Arquivos:** `functions/api/provision-number.js`, `functions/lib/reserved.js`, RPCs `provision_claim`/`provision_settle`/`client_number_for`/`client_agents_numbers`.

## ROTA-VENDEDOR-IA · o crachá que protege as ferramentas de IA
**Quando:** mexer no `/vendedor` ou no `/api/pitch-ai`. **O que é:** o login (`/api/seller-login`) devolve um `sid` — HMAC-SHA256 de `email|expira` assinado com o `INGEST_SECRET` (server-only, 30 dias, sem estado). O `pitch-ai` exige esse `sid` e recusa 401 sem ele.
**Por que existe:** o `pitch-ai` era protegido só por `sameOrigin` + limite por IP — e isso **não é autenticação**: qualquer visitante da guileoai.com chamava pelo console. Custava modelo pago pela Guileo e entregava o material de venda (dores, objeções, cunha competitiva) de graça, inclusive pra concorrente.
**Cuidado:** todo `fetch("/api/pitch-ai")` novo tem que mandar `sid: sellerSid()`; resposta `auth_required` → `sidExpired(d)` limpa a sessão e o vendedor refaz o login uma vez.
**Prova:** sem sid → 401 · sid forjado → 401 · login (roster e código do time) → sid de ~90 chars · com sid real → 200 com o texto da IA. **Arquivos:** `functions/lib/sellerSession.js`, `functions/api/seller-login.js`, `functions/api/pitch-ai.js`, `src/pages/Vendedor.jsx`.

## ROTA-CRM-CLASSIFICA · quem é cada cliente (o tanque dos motores de retenção)
**Quando:** sempre — roda sozinha no cron diário (13h/14h UTC), antes dos motores de retenção. Manual: `GET /api/crm-classify?token=DIGEST` (todos) ou `{email}` pra um tenant.
**O que faz, só com FATO:** `ltv_cents` = soma dos atendimentos concluídos × preço · `lifecycle` lead→customer(1ª reserva)→loyal(3+)→dormant(60d) · `churn_risk` 0-100 pela recência (lead nunca tem risco: quem nunca veio não "abandona") · `visit_count` real · `tags` = `prefere:<unidade>` + `servico:<top>`.
**Por que existe:** a Gui já criava a ficha e a história, mas NINGUÉM preenchia a classificação — um contato com 3 ligações desde julho seguia `lead`, LTV $0, tags `[]`. E aniversário/win-back/reativação/churn **leem exatamente esses campos**: motores prontos, tanque vazio, nada quebrava e nada disparava.
**Prova:** sem atendimento → `atualizados:0` (não promove ninguém no vácuo); com 1 atendimento concluído → `lead → customer · $118 · ["prefere:Astoria","servico:Massage"]`; apagando o atendimento, volta a `lead`.
**Arquivos:** `functions/api/crm-classify.js`, RPC `crm_classify_sweep`, wire em `functions/api/cron-tick.js`.

## ROTA-GCAL · conectar o Google Agenda do cliente
**Quando:** cliente quer ver as reservas no calendário que já usa. **Passos:** dono do cliente entra no cockpit `/portal → Integrações → Conectar Google` (OAuth, 1 clique) → `gcal-connect.js` guarda o refresh_token (`client_integrations` provider='gcal'). Toda reserva depois cai lá via `gcalPush` em `agent-schedule.js`. **Precisa:** `GOOGLE_CLIENT_ID/SECRET` no Cloudflare (já setados). **Prova:** reservar → evento aparece no Google Agenda do dono.

## ROTA-WIDGET · chat da IA no site do cliente
**Quando:** cliente quer a IA atendendo por chat no site dele. **Passos:** copiar o snippet do card no `/admin` (ou montar: `<script src="https://guileoai.com/gui-widget.js" data-guileo="EMAIL_DO_CLIENTE" data-lang="pt" defer></script>`) → cliente cola no site. Logo/cor/nome vêm do perfil dele. **Prova:** curl `POST /api/widget-chat {client:EMAIL, sessionId, message}` → responde com preços reais do cliente.

## ROTA-PRECOS · atualizar serviços/preços de um cliente
**Quando:** cliente confirma preços novos. **Passos:** `select biz_admin_import('gss_Kp9mX4vR2tZ7nQ5wL8bc', 'EMAIL', '{"replace":true,"locations":[…],"services":[{"name":…,"price_cents":…}],"professionals":[…]}'::jsonb)`. `price_cents=null` = "especialista confirma". **Prova:** `biz_lookup(SCHED, email)` mostra os preços novos; o chat/voz cotam na hora.

## ROTA-IDIOMA · adicionar idioma
**Quando:** mercado novo. **UI (4 langs):** dict em `src/i18n.jsx` + cada página. **VOZ (20 langs):** `LANGS_SPOKEN` em `functions/lib/provision.js` — o agente detecta e responde. **Cadastro:** checkboxes em `OnboardWizard.jsx`. **Prova:** trocar idioma na página converte tudo; agente responde no idioma do cliente.

## ROTA-CIDADE · adicionar cidade/bairro SEO
**Quando:** expandir geografia. **Passos:** adicionar entrada em `src/data/seoCities.js` (slug, areaCodes reais, `hook:{en,pt,es}`, neighborhoods) → build → sitemap automático. **Prova:** `/ai-receptionist/SLUG` e `/for/VERTICAL/SLUG` retornam 200 com o gancho local.

## ROTA-CANAL · ligar um canal pendente (WhatsApp/IG/…)
**Quando:** a API/aprovação do canal libera. **Passos:** setar a env/creds do canal no Cloudflare → o código já wired acende sozinho (padrão scaffold-inerte). WhatsApp: aprovar sender Twilio. IG/FB/TikTok/LinkedIn/Google Business/Ads: OAuth/API key. **Prova:** o canal muda de âmbar "aguardando" pra verde "ativo" no cockpit.

## ROTA-WA-TOKEN · WhatsApp que sai de verdade (token permanente + número real)
**Quando:** a saída do WhatsApp "aceita mas não chega", ou o token de 24h venceu (é o estado de hoje: `token_kind=temp_24h`, gerado 2026-08-03).

**⚠️ LEIA ISTO ANTES: são DOIS bloqueios, não um.** O remetente cadastrado é `+1 555 660 6706`, com `env:"test"` e rótulo *"numero de teste Meta"* — o **número de sandbox**, que só entrega para até 5 destinatários pré-cadastrados, por mais válido que o token seja. Trocar só o token conserta a VALIDADE e não conserta a ENTREGA. Publicar o app (feito em 2026-08-17) também não conserta sozinho. Confundir os três é medir a coisa errada e comemorar.

**Etapa 1 — token permanente (Usuário do Sistema):** `business.facebook.com/settings` → portfólio **MED MUNDO BRASIL** → *Usuários → Usuários do sistema* → **Adicionar** (ex.: `Guileo API`, função Admin) → **Adicionar ativos**: o app **Guileo** (`2252636211962171`) e a **conta do WhatsApp** (WABA `972448889140826`), controle total nos dois → **Gerar novo token** → app Guileo → permissões `whatsapp_business_messaging` + `whatsapp_business_management` → **expiração: Nunca** → copiar (aparece UMA vez).

**Etapa 2 — guardar:** o token é POR TENANT e mora no banco, **não em env** (cliente novo = INSERT, zero deploy). Cole no card **💬 Conectar WhatsApp** do `/admin` (`src/components/WhatsAppConnect.jsx` → `POST /api/whatsapp-connect`) — o token vai direto pro banco, não passa por chat. O card **confere no Graph ANTES de gravar**: token que não responde não entra. Deixe os IDs vazios pra manter os guardados (trocar só o token é o caso normal — `store_integration` SUBSTITUI o jsonb inteiro, então a rota lê-mescla-grava). Botão **🩺 Testar** responde "ainda funciona?" sem enviar mensagem pra ninguém.

**Etapa 3 — entrega:** para atender cliente real, registrar um **número próprio** na WABA (não pode estar ativo no app WhatsApp comum) e concluir a **Verificação da Empresa**. Enquanto isso, a prova possível é adicionar o celular do Luis à lista de destinatários do número de teste.

**Prova (nesta ordem, senão o resultado engana):** ① token vivo → `GET /v19.0/{phone_number_id}?fields=display_phone_number` responde 200 (401 = token) · ② entrega → mensagem real chega no celular. `message_id` na resposta **não é prova**: foi exatamente ele que mentiu em 2026-08-03. **Arquivos:** `functions/api/whatsapp-cloud.js`, RPC `whatsapp_cloud_tenant_by_pnid`.

## ROTA-ANALISE · a análise que o prospect ganha ao marcar a demo
**Quando:** marcou demo. O prospect recebe valor ANTES da call e o vendedor entra sabendo onde dói.
1. **Gerar:** `POST /api/diagnostico {site, contato, nome, lang}` + `sid` do vendedor **ou** `token` admin → devolve `link`, `resumo` e **`tres_linhas`** (os 3 achados mais graves).
2. **Conferir o `tres_linhas`** — é o que vai no e-mail e o que o vendedor vai falar em voz alta.
3. **Mandar:** o mesmo POST com `"enviar": true` → e-mail branded (`demoAnalysisEmail`) com as 3 linhas + botão pra página. Resposta traz `envio:{ok,…}` com o motivo real se falhar.
4. **Ler depois:** `GET /api/diagnostico?id=<uuid>` (o link do prospect). A 1ª abertura grava `aberto_em` — mede interesse real.

**O que ele mede (e por que NÃO é o painel do AutoSEO):** keyword/volume é diagnóstico de quem vende conteúdo. Aqui cada achado é **uma ferida que a demo fecha**, e carrega o campo `gui` dizendo o que a agente faz. Achado sem `gui` não entra. Hoje: horas fora do expediente · sem agendamento online · formulário sem telefone · idioma único · sem caminho de avaliação · unidades > linhas · sem canal de texto.
**Honestidade que custou uma correção:** com menos de 5 dias de horário lidos, o título vira **"pelo menos Xh"** — o site do Miami Skin Spa declarava 4 dias e o total fechado saía maior que a verdade. É o número que o vendedor fala na call; errar nele derruba a análise inteira.
**Não temos e não fingimos:** volume/dificuldade de busca exige dado pago (Ahrefs/SEMrush).
**GATILHO AUTOMÁTICO (LIVE):** `action:"lead"` no `/api/demo` dispara a análise sozinho, em `waitUntil` (nunca segura a demo). O site vem de `brand.site`, guardado no cadastro da demo — antes era descartado depois de usado. **Falha em silêncio de propósito:** site ilegível ou zero achados → NÃO sai e-mail; "não conseguimos ler seu site" como boas-vindas é pior que nada. ⚠️ O campo é `site`, NUNCA `website` — `website` é honeypot anti-spam no `/api/lead` e faria todo lead de demo sumir respondendo `ok:true`.

**COMPARAÇÃO COM O VIZINHO (LIVE 2026-08-15, `GOOGLE_PLACES_KEY`):** o achado mais forte da análise. Sai assim: *"9 de 9 concorrentes próximos ficam disponíveis mais tempo que vocês"* + *"6 de 9 têm mais avaliações"*.
- **Nunca cita nome** do concorrente — documento que o prospect encaminha não pode virar fofoca do bairro.
- **Piso de 3** vizinhos COM o dado publicado; abaixo disso o achado não nasce.
- **⚠️ A CONSULTA NÃO PODE LEVAR RUA E NÚMERO.** `"med spa near 1501 South Miami Ave #201, Miami, FL"` devolveu **2** vizinhos (abaixo do piso → achado não nasceu, sem erro nenhum); cortando para cidade+estado deu **9**. O `#201` vira ruído de texto na busca. Sem o campo `vizinhos_lidos` no relatório eu teria concluído "não há dados" e AFROUXADO o piso — consertando a trava de honestidade para compensar uma busca mal escrita.
- Custa 2 chamadas Places por prospect (ficha + vizinhos). Roda também com o site lido — revisa, de propósito e por escrito, a regra "só chama o Google se o site falhar".

**⚠️ ARMADILHA DO `wrangler pages secret put`:** ele responde `✨ Success` para valor VAZIO e aceita uma chave de API como NOME do segredo. Aconteceram os dois aqui, e `secret list` mostra os dois como `Value Encrypted` — ele lista o NOME, não o conteúdo. Por isso o endpoint reporta `chave_tam`: `0` = gravada vazia, `39` = chave do Places inteira. **Segredo novo se confere pelo tamanho, nunca pelo "Success".**

**⚠️ O CAPTCHA É INTERMITENTE, NÃO PERMANENTE (corrigido 2026-08-15):** o 1º teste deu 2 de 4 sites bloqueados e eu registrei "metade dos sites" como se fosse fixo. Horas depois os MESMOS dois (naturaspanyc, monacomedspa) leram normalmente. A proteção varia por requisição/IP — então a leitura falha às vezes, não sempre. **Consequência prática: vale RETENTAR antes de desistir.** Uma medição só nunca vira taxa.
**Rede de segurança (inerte):** site recusou → `fichaDoGoogle` (Places searchText) com o nome do negócio como consulta. Traz horário real, telefone público, nota e nº de avaliações. Acende com `GOOGLE_PLACES_KEY`; sem chave devolve o motivo e a análise segue sem ele. **Do Google só nascem achados que o Google prova** (horário + avaliações) — nunca "sem agendamento online"/"só formulário"/"um idioma", que exigem ter LIDO o site. A página carrega `nota_fonte` avisando que o site não abriu.
**Zero modelo:** roda com a IA sem saldo — foi decisão depois do apagão de 14/08.
**Prova:** token lixo → 401 · `avabello.com` → 4 achados, 3 linhas, `envio:null` sem `enviar:true` · e-mail renderiza com exatamente 3 bullets (suíte 56/56).
**Arquivos:** `functions/lib/diagnostico.js`, `functions/api/diagnostico.js`, `demoAnalysisEmail` em `emailTemplates.js`, RPCs `diag_save`/`diag_get` (tabela `prospect_diagnostics`).

## ROTA-AVALIACAO · o score de negócio que todo prospect/cliente recebe
**Quando:** montar página de apresentação/quote de um prospect, ou medir a evolução de um cliente. ESTENDE a ROTA-ANALISE: o diagnóstico é a ferida; a avaliação é a régua (score 0-100 por aspecto) + previsões com premissa + estratégia produto-a-produto.
1. **Gerar:** `POST /api/avaliacao {site, negocio, cliente_email?, contato, seller}` + `sid` do vendedor **ou** `token` admin (ou header `x-guileo-secret` = DIGEST_TOKEN) → devolve `{id, link, avaliacao}`. Com `cliente_email` = **modo cliente** (usa catálogo com preço real, ligações, agenda interna via `avaliacao_client_snapshot`); sem = modo prospect (só o público).
2. **Ler:** `GET /api/avaliacao?id=<uuid>` (JSON; 1ª abertura grava `aberto_em`). Histórico: RPC `avaliacao_historico` — o mesmo negócio avaliado de novo mostra a curva do score (frase de renovação).
3. **Régua honesta:** cada aspecto = verificações binárias medidas; **não medido sai do denominador** e aparece como "— não medido: motivo" (sem GOOGLE_PLACES_KEY a descoberta inteira fica não-medida, nunca zerada). Previsão SEMPRE `{valor, premissa}` — sem insumo medido, `valor:null` e a premissa diz o que falta. Sem horário no site, o modo cliente usa a **agenda interna** (união de turnos via `range_agg`) e a premissa declara a fonte.
4. **Concorrentes com nome = USO INTERNO** (vendedor). A regra da ROTA-ANALISE continua: página de prospect nunca cita vizinho pelo nome.
**Zero modelo** (heurística sobre HTML + banco; roda com a Anthropic zerada). **Arquivos:** `functions/lib/avaliacao.js` (motor), `functions/api/avaliacao.js` (rota), `db/avaliacao.sql` (tabela `business_evaluations` + RPCs `avaliacao_save/get/historico/client_snapshot`, gate INGEST literal).

## ROTA-ENCAMINHA · fazer o telefone REAL do cliente cair na Gui
**Quando:** o cliente tem agente + número nosso e mesmo assim recebe ZERO ligação. Foi o caso do Natura (2026-08-14): agente ok, número ok, pipeline ok, 15 ligações no banco — **todas nossas, de teste**. Um número provisionado por nós é um número que ninguém disca: quem o mundo liga é a linha publicada do cliente (Google, porta, Instagram, cartão). Sem encaminhamento, a Gui atende um telefone que não toca.

**A escolha que importa (não é técnica, é de negócio):**
- **Condicional** — encaminha só quando OCUPADO e quando NÃO ATENDE. *É o padrão que a gente recomenda:* a recepção continua sendo humana, e a Gui pega só o que ia virar caixa postal. Zero risco de "a máquina roubou meu cliente".
- **Total (24/7)** — tudo cai na Gui. Só para linha nova, horário fechado, ou cliente que já decidiu não ter recepção.

**A pegadinha nº 1 (é ela que faz "não funcionou"):** a caixa postal da operadora também atende por tempo. Se ela pega em 20s e o encaminhamento está em 25s, **a caixa postal ganha sempre** e parece que o encaminhamento falhou. O encaminhamento tem que disparar ANTES — 4 toques (~20s) com a caixa postal em 30s.

**Os códigos (celular/fixa comum nos EUA):** `*72`+número = tudo · `*90`+número = ocupado · `*92`+número = não atende · cancelar: `*73` / `*91` / `*93`. Em VoIP/PBX (RingCentral, Google Voice, Ooma, Vonage, Spectrum Business) NÃO use código: é regra no painel ("Call Handling / Forwarding").

**Prova (3 ligações, dessa ordem — a 3ª é a que garante que não sequestrou a linha):**
1. Liga e deixa tocar além de 4 toques → **a Gui atende**.
2. Com alguém na linha, liga de novo → **a Gui atende na hora**.
3. Liga e um humano atende no 2º toque → **o humano atende**.
Depois: as 3 aparecem em `call_logs` do tenant (`select … from call_logs where client_email=…`) e no cockpit. Ligação que não aparece = encaminhou pro número errado.

**Documento pro cliente — GERADO, não escrito à mão:**
1. **Gerar o link** (admin/digest): `GET /api/encaminhar?email=<tenant>&token=<senha admin>` → devolve `{link, business, agente, numero_guileo, idioma, linhas_a_encaminhar[]}`. **Confira o `linhas_a_encaminhar` antes de mandar** — é a lista que o cliente vai digitar.
2. **Mandar o link** pro dono. Ele é HMAC do e-mail (mesmo crachá do vendedor): inadivinhável, expira em 30d, e só abre esta página.
`&lang=pt|en|es` força o idioma; sem isso usa o do cadastro.

**Por que gerado:** escrevi a versão do Natura à mão primeiro e o cadastro desmentiu duas suposições minhas — o idioma dele é `en` (eu tinha escrito em PT) e ele tem **3 unidades / 2 linhas**, não uma. Metade das ligações continuaria caindo no vazio com o documento "certo" seguido à risca. **Documento à mão é foto do que quem escreveu imaginou; este lê o cadastro.**
**Falha fechada:** sem número da Guileo → 409, o documento NÃO nasce (um passo-a-passo com o número em branco faz o cliente encaminhar pra lugar nenhum). Sem nome de negócio → 409 também.
**Dedup:** duas unidades na mesma linha viram UMA instrução; o número da Guileo nunca entra na lista (encaminhar ele pra ele mesmo = laço).
**Prova:** token forjado → 401 · sem token na porta fechada → 401 · link assinado → 200 com o documento no idioma e na marca do tenant.
**Arquivos:** `functions/api/encaminhar.js`, `functions/lib/sellerSession.js` (assinatura), RPCs `get_client_profile` / `draft_payload_for` / `client_number_lookup`. Referência visual do original à mão: `docs/encaminhamento-natura.html`.

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

## ROTA-VOZ — a agente soa nativa (e feliz) em cada idioma

**Quando:** o cliente diz "tá gringo", "não parece brasileiro", "a voz é fria/robótica"; ou depois de melhorar o critério de escolha de voz.

**Como funciona (automático, sem clique):** `functions/lib/voiceLibrary.js` garante uma voz NATIVA por idioma. Se a conta ElevenLabs não tem, ele busca na biblioteca pública e adiciona sozinho. `provision.js` põe essa voz no `language_presets[idioma].overrides.tts.voice_id` — a **voz segue o idioma**: inglês na voz do cliente, português numa brasileira, espanhol numa latina.

**Passos:**
1. Nada. Todo `POST /api/sync-agent` e todo cliente novo já resolvem sozinhos.
2. Para forçar uma reescolha depois de mudar o critério: subir `VOICE_POLICY` em `voiceLibrary.js` (`v2` → `v3`) e sincronizar. As vozes antigas ficam paradas na conta, sem uso.
3. Voz escolhida À MÃO pelo Luis no painel da ElevenLabs SEMPRE vence — o código só age quando não existe voz do idioma.

**Calor da voz:** `WARMTH` em `provision.js` (`stability: 0.45`). Quanto MAIOR o stability, mais monótona. Não mexer em `speed` — o Luis aprovou a velocidade atual.

**Prova:**
```bash
curl -s -X POST https://guileoai.com/api/sync-agent -H 'Content-Type: application/json' \
  -d '{"email":"<cliente>","key":"<connection key>","lang":"en"}' | python3 -m json.tool
```
O campo `languages.voice_by_lang` mostra NOME e SOTAQUE de cada voz — `pt-br → … · brazilian` é a prova. Id sozinho não prova nada.

**Limite honesto:** a ElevenLabs só aceita 34 idiomas de conversa. Cantonês, crioulo haitiano, bengali e punjabi NÃO existem lá — pedir um deles derruba a config inteira do agente. Lista real: `LANGS_SPOKEN` (16).

## ROTA-PROVA — "está tudo funcionando?" respondido por execução

**Quando:** antes de anunciar, depois de qualquer onda, ou sempre que alguém disser "não deu".

**Por que existe:** ler configuração diz que a chave existe; não diz que o motor gira. Em 2026-08-07
o agendamento estava "configurado" e **nunca** tinha funcionado — o defeito só apareceu executando.

**Comando:**
```bash
curl -s -X POST https://guileoai.com/api/prontidao \
  -H 'Content-Type: application/json' -H 'Origin: https://guileoai.com' -H 'Referer: https://guileoai.com/' \
  -d '{"email":"<dono>","key":"<chave de conexão>","testar":true}' | python3 -m json.tool
```

**O que ele EXECUTA (não lê):**
- `marcar_falando` — ciclo real de disponibilidade + marcação em linguagem natural (dry-run, não grava)
- `reconhece_quem_liga` — busca de identidade pelo telefone (é o que faz a agente chamar pelo nome)
- `email_chega` — envia de verdade, destino travado no próprio dono

**Como ler:** `veredito` verde = provado por execução. `configurado` sozinho é amarelo, nunca verde.
Sem `testar:true` a rota só lê estado externo (Stripe/Twilio/ElevenLabs/Resend) e não executa nada.

**Cuidado que já custou caro:** sonda errada acusa motor bom. A 1ª versão passou serviço nulo para
`biz_availability` e pintou de vermelho um motor perfeito. Toda sonda precisa ser validada contra um
caso sabidamente bom antes de virar semáforo.

---

## ROTA-SIMULAR — a jornada inteira, provada em 1 comando

**Quando:** antes de anunciar, depois de mexer na agenda/cobrança/idiomas, e sempre que alguém
disser "está tudo funcionando?". Substitui a leitura de código pela jornada real.

**O que faz:** um cliente inventado liga no negócio de mentira `sim@guileoai.com`
(`db/sim_tenant.sql`) e percorre 15 passos batendo nos MESMOS endpoints da agente real:
cardápio → vaga → marcar falando → conferir que a vaga sumiu → tentar furar fila → recusar fora
do expediente → recusar frase vaga → remarcar falando → idioma do cliente → inglês não regrediu →
cobrança → trava de gasto → tenant não vaza → e-mail com a marca do cliente → cancelar devolve a vaga.

**Rodar:**
```bash
curl -s -X POST https://guileoai.com/api/simular \
  -H 'Content-Type: application/json' -H 'Origin: https://guileoai.com' \
  -d '{"email":"<dono>","key":"<chave de conexão>"}' | python3 -m json.tool
```

**Como ler o resultado — TRÊS estados, não dois:**
| | significa |
|---|---|
| ✅ `ok:true` | provado pelo EFEITO (id criado, vaga sumiu, vaga voltou) |
| ❌ `ok:false` | quebrado agora, em produção |
| ⬜ `ok:null` | **não deu para provar aqui** — o ambiente não permite o teste |

O cinza existe porque sem ele a sonda que não consegue concluir escolhe verde. Foi o que
aconteceu com a trava de gasto: o tenant de teste não tem Stripe, recusa QUALQUER valor, e
"recusou" virou verde sem a trava ter sido exercitada. Os 2 cinzas de hoje (`cobranca_decide`,
`trava_de_gasto`) só viram verde com Stripe conectado num tenant de teste.

**Segurança (não afrouxar):**
- o tenant é CONSTANTE no arquivo, nunca vem do corpo — senão a rota escreve na agenda de cliente pagante;
- porta do dono (`isOwnerEmail` + chave conferida no banco), mesma do `/api/prontidao`;
- `x-guileo-test:1` impede e-mail real; dinheiro só em `dry_run`; limpeza no `finally`.

**A armadilha que já custou 4 falsos diagnósticos:** ler o campo errado da resposta. `op:lookup`
devolve serviços como TEXTO (não objeto com `.name`), e `brandFor` devolve `business` (não
`name`). Sonda que lê o campo errado acusa motor bom — e verde pelo motivo errado é pior que
vermelho, porque manda seguir em frente. **Toda sonda nova: conferir o campo na resposta real
antes de confiar na cor.**

---

## ROTA-LIGACOES — "eu liguei, cadê os dados?"

**Quando:** alguém ligou e o painel está vazio; ou uma ligação real não virou agendamento.

**Por que existe:** banco vazio tem DUAS explicações opostas — a ligação não chegou, ou chegou e
não foi gravada — e o banco sozinho não distingue (ele é a coisa sob suspeita). `/api/ligacoes`
confronta TRÊS fontes independentes e mostra o degrau que falta:

| degrau | fonte | responde |
|---|---|---|
| 1 | Twilio | o telefone tocou? |
| 2 | ElevenLabs | a agente atendeu e conversou? |
| 3 | nosso banco | ficou registrado? |

```bash
curl -s -X POST https://guileoai.com/api/ligacoes \
  -H 'Content-Type: application/json' -H 'Origin: https://guileoai.com' \
  -d '{"email":"<dono>","key":"<chave>","horas":24}' | python3 -m json.tool
```

Detalhe de uma conversa (motivo do encerramento, quem falou, ferramentas chamadas — **nunca
transcrição**): `{"detalhe":"conv_..."}`.

**REGRA DE OURO deste arquivo:** fonte NÃO LIDA nunca vira acusação. Na primeira execução o banco
devolveu 401 e o veredito acusou "o webhook não está entregando" — o webhook estava perfeito.
Confundir "não consegui ler" com "não tem dado" acusa o inocente com a mesma confiança.

**Recusas agora deixam rastro** (`agent-schedule.js` → `logRecusa`): `book → RECUSA:<motivo> ·
pediu: <fala>`. Motivos: `sem_dia_nem_hora`, `horario_pedido_indisponivel`, `sem_vaga_nenhuma`,
`horario_tomado_na_hora`, `reserva_nao_travou`, `servico_nao_identificado`. Antes, só o SUCESSO
escrevia no log — a evidência que sobrava era justamente a dos casos que já funcionavam.

⚠️ **Consultar `biz_availability` por SQL exige o segredo SCHED correto.** Um segredo errado
devolve `{"error":"unauthorized"}`, e `coalesce(...->'slots','[]')` transforma isso em "zero
vagas" — diagnóstico de agenda quebrada num cliente saudável. **Sempre olhe a resposta CRUA antes
do comprimento da lista.**

---

## ROTA-ADS — o motor de anúncios: gastou X, voltou quanto?

**A vantagem estrutural:** Google e Meta sabem CLIQUES. O dono do negócio sabe FATURAMENTO.
Ninguém liga os dois porque o elo do meio é o TELEFONE — que nenhuma plataforma de anúncio
enxerga. A Guileo é dona desse elo (atende, marca, cobra). Fechar
`gasto → lead → ligação → agendamento → receita` é conta que o Google não faz sozinho.

**Como a origem chega:** capturada no PRIMEIRO clique (`src/lib/analytics.js`) e gravada num
cookie primário `gui_attr`. O cookie viaja sozinho para o nosso domínio, então `/api/lead`, o
widget e qualquer rota futura recebem de graça — **nenhum dos ~10 formulários precisou mudar**.
Lead do site DO CLIENTE (webhook `marketplace-leads`) manda `utm_source/utm_campaign/gclid/fbclid`
no corpo, único caminho manual.

**Lançar gasto e ler o retorno:**
```bash
curl -s -X POST https://guileoai.com/api/ads -H 'Content-Type: application/json' \
  -H 'Origin: https://guileoai.com' \
  -d '{"email":"<cliente>","key":"<chave>","action":"gasto","dia":"2026-08-09","canal":"google","campanha":"verao","valor":"$450,00","cliques":210}'
```
`action:"roi"` devolve por campanha: gasto, leads, agendamentos, receita, custo por lead, custo
por cliente, retorno e **veredito**.

**AS DUAS REGRAS QUE NÃO SE AFROUXAM:**

1. **NULL, nunca zero de mentira.** Sem gasto lançado o retorno é `null` + `porque_sem_retorno`.
   "ROAS 0" e "não sei o gasto" são opostos; mostrar o primeiro faz o cliente cortar a campanha
   que estava funcionando.
2. **VEREDITO EXIGE AMOSTRA.** Matemática não é conselho. Uma campanha de ontem tem receita 0 →
   retorno 0 → "corta". Mandar cortar antes de dar chance é o erro mais caro de uma agência —
   e foi o que a primeira versão fez ($450 às 9h, "corta" às 9h01). Agora:
   `cedo_demais` (<50 cliques ou <3 leads) · `sem_lead_apesar_do_trafego` (tráfego chegou e
   ninguém converteu → é a PÁGINA, não o anúncio) · `mantem` · `escalar` · `corta`.

**Armadilha que custou uma rodada:** `svcRpc` devolve a **Response**, não o JSON. `r.ok` é o 200 do
HTTP, não o `{ok:true}` do banco. Use **`svcJson`** (`functions/lib/sb.js`) — criado justamente
para o caminho fácil ser o certo. O mesmo engano deu falso FRACASSO no gasto e falso SUCESSO na
atribuição, no mesmo dia.

SQL: `db/ads_engine.sql` (aplicado). Arquivos: `functions/api/ads.js`, `functions/lib/atribuicao.js`.

### ROTA-ADS · complementos (2026-08-09)

**Importar relatório** — `action:"importar"` com `{canal, texto}`. Cole o export do Google Ads
(TAB) ou Meta (CSV/;). O cabeçalho é lido por NOME (pt+en), nunca por posição — layout muda e
posição fixa quebra em silêncio, gravando gasto na coluna errada. Linhas com data ambígua
(`05/08`) ou campanha vazia são RECUSADAS com o motivo, e voltam na resposta: importador que só
diz "42 importadas" esconde as 3 que ficaram de fora. **Reimportar o mesmo período SUBSTITUI**
(provado: 2 importações → 2 linhas, $218,50, não $437).

**Por que não a API oficial:** Google Ads exige *developer token* (aprovação em semanas) e Meta
exige App Review para `ads_read`. Nenhuma sai em 3 dias, e não depende de código. Como
`ads_spend_set` é upsert por (dia, canal, campanha), o importador oficial um dia escreve na MESMA
tabela — zero retrabalho.

**Número por campanha (a ligação vira atribuição)** — `action:"numero"` com
`{numero, canal, campanha}`. O motor media o lead de FORMULÁRIO e era cego para o de TELEFONE,
que é o caminho principal num negócio local e o diferencial da Guileo. Agora cada campanha
anuncia a sua linha; o webhook pós-ligação lê `metadata.phone_call.agent_number` (campo real,
confirmado em ligação de verdade) e credita quem ligou. Casa por CHAVE CANÔNICA, então
`+1 (929) 828-8170` e `+19298288170` são o mesmo número. **Linha que não é de campanha não gera
atribuição** — senão "(sem campanha)" viraria um canal fantasma dominando o relatório.
SQL: `ad_numbers` + `ads_number_map` + `ads_attr_from_call`.

### ROTA-ADS · o vigia (2026-08-09) — o que separa AGÊNCIA de PAINEL

Painel espera você abrir; agência avisa. `/api/ads-vigia?token=DIGEST_TOKEN` roda **toda segunda**
pelo cron, varre as campanhas de TODOS os clientes e manda, para cada um que tem decisão a tomar,
um e-mail (`adsAlertEmail`) dizendo **o que fazer** — não "seu ROAS caiu 12%", que não é acionável
para quem tem um salão para tocar.

| motivo | gatilho | o que o cliente lê |
|---|---|---|
| `trafego_sem_lead` | ≥80 cliques, 0 lead | **é a PÁGINA, não o anúncio** — o caso mais caro e o mais consertável |
| `gastando_mais_do_que_traz` | ≥5 leads e receita < gasto | revisar público ou pausar |
| `vale_investir_mais` | ≥5 leads e retorno ≥3× | **aumentar orçamento** |

**Três regras que não se afrouxam:**
1. **Silêncio quando não há nada.** E-mail semanal dizendo "tudo bem" treina o cliente a não abrir,
   e no dia em que a mensagem importa ela vai para a lixeira junto. Não mandar é parte do produto.
2. **Alarme exige amostra.** Campanha sem gasto lançado nunca vira alerta; "corta" nunca sai com
   1–2 leads. No terceiro alarme falso ninguém mais lê.
3. **Oportunidade vai junto do problema.** Agência que só avisa de prejuízo deixa dinheiro na mesa.

`?seco=1` varre e mostra QUEM seria avisado **sem mandar nada** — disparo em massa se testa assim,
não mandando de verdade e pedindo desculpa depois. As falhas de envio voltam na resposta: varredura
que só conta sucesso esconde o cliente que ficou sem aviso, e é ele quem cobra no fim do mês.

**Um só lugar dispara.** A consulta vive em `/api/ads {action:"alertas"}`; o ENVIO só em
`ads-vigia.js`. Duas rotas capazes de mandar o mesmo e-mail em massa = duas verdades, e a que
ninguém lembra de manter é a que manda errado.

**Vendedor:** pitch card `ads` em `src/data/pitchCards.js` (PT/EN/ES) — dor "já gastei e não sei se
voltou", vantagem estrutural (o telefone é o elo que Google/Meta não veem) e a objeção REAL, que
não é preço: *"já me prometeram isso e o relatório era enfeitado"*.

### ROTA-ADS · anúncios no relatório semanal (2026-08-09) — FECHADO

O relatório que o cliente recebe toda segunda não falava **uma palavra** sobre o dinheiro que ele
investe em anúncio — metade do que ele paga. Agora `client-report.js` lê `ads_roi` dos últimos 7
dias e o template mostra:

> **$240,00 investido → 6 clientes novos** · $1.080,00 em serviços agendados · cada $1 virou **$4,50**

**Sem gasto lançado a seção SOME inteira** (não mostra $0). Um zero ali seria lido como "o anúncio
não deu nada" e faria cortar a campanha certa — a mesma regra do painel e do vigia, agora nos três
lugares onde o número aparece. Falha de leitura → `ads = null` → relatório sai igual ao de antes.

Provado nos dois estados: sem gasto a seção não aparece; com gasto mostra resultado + retorno.

### ROTA-CRIATIVO — a peça do anúncio (2026-08-10)

`POST /api/ads {action:"criativo", plataforma:"google"|"meta", objetivo?, publico?}`
→ títulos/descrições no idioma e no tom do negócio, a partir dos **fatos reais** dele.

**Por que é peça separada do post de rede social:** post é para quem já segue e rola o feed;
anúncio interrompe um estranho, tem limite duro (30 no título do Google, 90 na descrição, 125 no
texto da Meta) e precisa da promessa na primeira linha. Entregar post como "criativo de anúncio"
é o tipo de coisa que faz o cliente pagar retainer e não crescer.

**Três travas:**
1. **Só fato real** — serviço que existe, preço cadastrado. Nada de superlativo ("o melhor", "o
   mais barato"): plataforma reprova e quem responde é o cliente, não nós.
2. **O motor se corrige.** Mede o excesso, e se estourou reescreve UMA vez dizendo exatamente o
   que passou e por quanto. Só aceita a reescrita se ficou melhor — "conserto" que piora é
   regressão. Provado: 1ª tentativa 100/90 → reescrita 73/90.
3. **Idioma vem do negócio.** Anúncio em inglês para salão brasileiro queima orçamento em clique
   que não converte.

**Duas lições de arquitetura que custaram tempo aqui:**
- `askClaude` (guiBrain.js) é o ÚNICO executor da cadeia de modelos — o arquivo diz isso e eu
  ignorei, fixei um modelo, ele não respondeu e o criativo voltou vazio. Já existiam TRÊS cópias
  da lista de modelos; a minha seria a quarta.
- **Nunca confie no formato da resposta da IA.** Pedir "só JSON" e fazer `JSON.parse` direto
  quebra: às vezes vem com ```json, às vezes com uma linha antes. Extrair do primeiro `{` ao
  último `}` sobrevive aos três casos — e no erro, devolver o texto CRU, senão o próximo fica
  adivinhando o que veio.

**Idioma do gerador de POSTS estava quebrado** (mesmo dia): `brandContext` lia nome/setor/tom e
**não lia `lang`** — todo post saía em inglês, inclusive para negócio com perfil em pt. Uma linha.
Mesma família do `fmt()` com "en-US" fixo.

---

## ROTA-CEREBRO — ensinar TODOS os agentes de uma vez (o motor de agente)

**Quando:** descobriu, numa ligação real, que o agente faz algo errado. Nunca conserte um cliente só.

**Passos**
1. Abra `functions/lib/licoes.js`.
2. Só entra o que ACONTECEU. Palpite incha o cérebro e empurra para trás a regra que salva a venda.
3. Escreva o COMPORTAMENTO ("não diga que agendou antes da ferramenta responder"), não a proibição
   vaga ("seja preciso"). E registre o incidente no comentário `// ←` acima — é o que defende a
   regra daqui a um ano, quando alguém achar que ela é óbvia e quiser removê-la.
4. **SUBA `VERSAO`.** Sem isso a lição fica no código e não chega a NENHUM agente já nascido.
5. `npm run build && npx wrangler pages deploy dist --project-name=guileoai --branch=main`
6. Pronto. O cron das 13h UTC atualiza a frota sozinho (`cron-tick.js`).
7. Para não esperar: `GET /api/agent-evolve?seco=1&token=<DIGEST_TOKEN>` mostra quem está atrasado
   sem tocar em nada; sem `seco=1` atualiza na hora (teto de 25/rodada; `&teto=N` para mudar).

**Prova:** `select client_email, brain_version from client_agents;` — todos na versão nova.
Ou `select agentes_atrasados('<INGEST_SECRET>', <VERSAO>, 50);` → `total_atrasados: 0`.

**Leis desta rota**
- O carimbo mora em `sync-agent.js`, DEPOIS do 502 da ElevenLabs. É o único ponto que sabe que o
  cérebro novo foi aceito. Carimbar antes = o banco mente E o agente some da varredura para sempre.
- A varredura NUNCA esconde falha: cliente que não subiu volta com o motivo. Um motor que engole
  erro recria exatamente a doença que veio curar.
- Sync que estoura o tempo não carimba — então a rodada seguinte tenta de novo. É por isso que
  "falhou" nesta rota é seguro, e "carimbou sem sincronizar" seria fatal.

---

## ROTA-INSTAGRAM — ligar uma conta Meta (Página + Instagram) a um tenant

**Quando:** o cliente (ou a própria Guileo, no @guileo.ad) quer que a Gui **poste** e **responda DM**.
O motor (`social-publish.js` + `meta-webhook.js`) já está pronto — falta só a autorização.

**Os três valores que o dono pega no Meta (Claude nunca digita segredo):**

1. `developers.facebook.com/tools/explorer` → selecionar o app **Guileo**
2. Permissões: `pages_show_list`, `pages_manage_metadata`, `pages_messaging`,
   `pages_read_engagement`, `instagram_basic`, `instagram_manage_messages`, `instagram_content_publish`
3. **TROCAR POR TOKEN LONGO ANTES DE LER AS PÁGINAS** — o token padrão do explorador dura 1–2h
4. `GET me/accounts` → devolve `id` (= **page_id**) e `access_token` (= **page_access_token**)
5. `GET {page_id}?fields=instagram_business_account` → devolve o **ig_id**

**Colar:**
```
POST /api/meta-connect
{ "action":"connect", "token":"<admin>", "email":"<tenant>",
  "page_id":"...", "page_access_token":"...", "ig_id":"...", "business":"..." }
```

**A trava que existe desde 2026-08-10 (e por quê):** antes de guardar, o endpoint pergunta à Meta
(`debug_token`, autenticado com `META_APP_ID|META_APP_SECRET`) se o token é válido e quando expira.
**Token que expira é RECUSADO.** Sem isso, o dono conectava, via funcionar, e no dia seguinte a
página ficava MUDA — sem erro em lugar nenhum, com o painel ainda dizendo "conectado". Token de
Página derivado de um token longo tem `expires_at = 0` (não expira): é esse que entra.

**Prova:** a resposta traz `subscribed: true` (a Meta passa a entregar as DMs no nosso webhook).
Depois: `{ "action":"status", ... }` → `connected: true`.

⚠️ **Uma página por tenant.** Em 2026-08-10 achei `naturaspaadm` e `dr@medmundobr` apontando para a
MESMA `page_id`. Inofensivo enquanto não há token; com token, mensagem de uma página cairia em dois
donos — a mesma família do bug dos números compartilhados. Confira antes de conectar.

---

## ROTA-PERFIL — o cliente nasce montado a partir do site dele

**Quando:** cadastrar cliente novo. Em vez de digitar campo por campo, cola-se a URL.

```
POST /api/perfil-do-site   { site, token }        (crachá de vendedor ou token de admin)
→ { lido:true, perfil:{ nome, telefone, endereco, horarios, idioma, servicos[], logo_url, accent }, faltando:[…] }
→ { lido:false, motivo:"…" }   quando não dá para ler (o MOTIVO em português, não só "falhou")
```

**A entrega não é só o que veio — é `faltando`.** É o roteiro do que perguntar ao dono, e é o que
transforma "me manda tudo" em "só me confirma três coisas". Sem essa lista o vendedor não sabe o
que pedir; com ela, o cliente sente que já trabalhamos por ele antes de assinar.

**Leis desta rota**
- NUNCA INVENTA (lição v1 dos agentes). Preço plausível não é preço; horário "provável" põe cliente
  na porta fechada. Só entra par "nome — valor" que aparece JUNTO no texto: número solto pode ser
  telefone, CEP ou ano.
- **Uma porta só para ler site de terceiro.** `buscarHtml` (brandExtract.js) concentra SSRF,
  redirect, tipo, tamanho e captcha. Provado recusando `localhost` e `169.254.169.254` (metadados
  da nuvem). Precisa ler site noutro lugar? Use essa função — nunca escreva um segundo buscador.
- Nome do NEGÓCIO, não título da página: a frase de efeito é cortada em toda origem, e as entidades
  HTML são decodificadas — senão a agente FALA "amp" na saudação (achado na própria prova).

**Prova:** guileoai.com → "Guileo", logo, #161512, en · naturaspanyc.com → "Natura Spa New York",
logo, #0063a8 · localhost e 169.254.169.254 → recusados.

---

## ROTA-REINVESTIR — o motor decide para onde vai o próximo dólar

**Quando usar:** o cliente gastou em anúncio e pergunta "aumento, mantenho ou corto?". Também é o
passo que transforma o motor de anúncios de linha reta em ciclo: o dinheiro que voltou vira o
orçamento da próxima rodada, e quem comprou vira semente para achar parecidos.

```
POST /api/ads   { email, key, action:"reinvestir", dias:30 }
→ { decisoes:[ { campanha, gasto, receita, receita_base, leads, retorno,
                 acao, orcamento_dia_atual, orcamento_dia_novo, porque } ],
    semente:{ pessoas, hashes[], nota }, como_usar }
```

**As regras, e por que cada uma é assim**

| retorno | ação | a razão que vai no `porque` |
|---|---|---|
| ≥ 3 | subir **+50%** | nunca dobrar: mudança grande joga a campanha de volta no aprendizado da plataforma |
| ≥ 1 | manter | paga, mas não o bastante para escalar |
| < 1 | reduzir **à metade** | metade, não zero: matar em seco joga fora o aprendizado da conta |
| — | não mexer | menos de 3 leads é amostra pequena demais para mexer no dinheiro dele |
| — | sem_dados | gasto não foi lançado |

**`receita_base` é obrigatório de ler.** Diz DE ONDE veio o número:
- `recebido` — dinheiro lançado contra aquela pessoa (`crm_timeline_events` via `crm_contacts.phone_key`)
- `tabela` — sem lançamento, caiu no preço de tabela do serviço → **é estimativa**
- `misto` — parte de cada
- `sem_valor` — agendou e não há nem lançamento nem preço

Decidir orçamento com estimativa é legítimo; decidir **sem saber que é estimativa**, não. O rótulo
é a diferença entre um número e um número honesto.

**Leis desta rota**
- **Cego não é ruim.** Receita 0 COM agendamentos sem valor → `nao_mexer`, nunca `reduzir`. Zero por
  falta de medição não é zero por falta de resultado, e cortar aí tira orçamento de campanha que
  está trazendo cliente. A resposta diz o que destrava: cadastrar o preço ou cobrar pela Gui.
- **Valor por PESSOA, nunca por agendamento.** Quem marcou duas vezes contaria a receita em dobro —
  e campanha superestimada é pior que subestimada, porque faz o dono colocar MAIS dinheiro em cima.
- **A semente sai em SHA-256**, feito na borda (`crypto.subtle.digest`). Lista de cliente em texto
  puro nunca sai da plataforma, e é exatamente o formato que Meta e Google esperam.

**A armadilha que esta rota já cobrou duas vezes (2026-08-11)**
1. `lead_attribution.phone_key` gravado com `+` por INSERT cru: o join nunca casou, receita leu 0 e
   o motor mandou REDUZIR uma campanha de 5-para-1. Hoje há CHECK que recusa formato não-canônico
   (`db/lead_attribution_chave_canonica.sql`) — mas a lição é outra: **semente que fura o caminho de
   produção não prova nada, produz acusação falsa contra código correto.**
2. Na verificação, `campanha-cega` deu o veredito CERTO pelo motivo ERRADO (caiu na regra de amostra
   pequena, não no ramo novo). **Resultado certo pelo motivo errado não é prova** — só com 3 leads o
   ramo apareceu de fato.

**Prova:** `sim@guileoai.com` (tenant `internal`, fora das métricas reais) carrega o fixture:
boa `$300→$2100 [misto] SUBIR` · ruim `$300→$0 REDUZIR` · cega `$50→$0 [sem_valor] NAO_MEXER` ·
mesma pessoa 2 agendamentos → receita NÃO dobra.

---

## ROTA-AGENTE · mexer no agente de voz sem quebrar (e voltar em 1 comando)

**Quando:** qualquer alteração no agente ElevenLabs — voz, idioma, prompt, ferramentas, lição nova.

**Por que existe:** antes, mudar e piorar era caminho sem volta — a versão boa vivia só na
ElevenLabs e sumia na mudança seguinte. Foi assim que a voz nativa por idioma foi ao ar e
quebrou a ligação da Lilian. Agora tem rede.

**Os 4 passos (nesta ordem, sempre):**

```bash
S=$INGEST_SECRET; A=<agent_id>
# 1. CONGELA o estado bom ANTES de mexer (ouro=1 marca como referência aprovada)
curl -s "https://guileoai.com/api/agente-config?secret=$S&congelar=1&ouro=1&agent_id=$A&rotulo=antes+de+<o+que+vou+mexer>"
# 2. MEXE (deploy da mudança na fonte + sync)
curl -s -X POST "https://guileoai.com/api/sync-agent" -H "x-guileo-secret: $S" \
     -H "content-type: application/json" -d "{\"email\":\"<email-do-cliente>\"}"
# 3. PROVA — só vai pro ar com 17/17
curl -s "https://guileoai.com/api/agente-config?secret=$S&padrao=1&agent_id=$A"
# 4. SE PIOROU (ou o Luis ouviu e não gostou) — a volta:
curl -s "https://guileoai.com/api/agente-config?secret=$S&voltar=1&agent_id=$A"
curl -s -X POST "https://guileoai.com/api/sync-agent" -H "x-guileo-secret: $S" \
     -H "content-type: application/json" -d "{\"email\":\"<email-do-cliente>\"}"   # cérebro da fonte
```

**Divisão de trabalho (o que cada peça restaura):**
| peça | restaura | por quê |
|---|---|---|
| `?voltar=1` | **voz + presets de idioma** | é o que o sync NÃO restaura: ele preserva a voz viva de propósito, pra não atropelar escolha de cliente |
| `POST /api/sync-agent` | **cérebro** (prompt, lições, KB, ferramentas) | já é reconstruível da fonte — não precisa de snapshot |
| `?padrao=1` | **nada** — só julga | 17 itens, cada um nascido de um incidente real |

**Regras que não se negociam:**
- Voz muda **por PATCH direto**, uma vez. Sync nenhum troca voz (ele preserva) — se você tentar
  trocar voz por sync, vai parecer que não funcionou.
- Mudança de voz/idioma **só vai ao ar depois de ouvida**. Amostra nos 3 idiomas na mesma faixa
  (`creative_generate_speech`, motor `eleven_flash_v2_5` = o das ligações).
- Norma escrita: `AGENTE-PADRAO.md`. Norma executável: `?padrao=1`. Se as duas discordarem,
  **corrija as duas** — foi o que aconteceu com a regra de voz em 2026-08-19.

**Provado em 2026-08-19:** congelei o agente de teste, quebrei a voz de propósito, rodei
`?voltar=1` → voltou e a releitura bateu (`bateu: true`). Não é promessa, é teste.

---

## ROTA-RAIOX — qualquer negócio pede o Guileo X-Ray sozinho (motor de aquisição)

**Quando:** ligar/operar a porta pública `/raio-x` (`/x-ray`), o destino de anúncio onde o dono
responde um quiz curto, recebe o X-Ray medido do próprio negócio e marca a call de 15 minutos.

**As peças:**

| peça | arquivo | o que faz |
|---|---|---|
| página | `src/pages/RaioX.jsx` | quiz de 6 passos (4 idiomas) → resultado → agenda |
| endpoint | `functions/api/raio-x.js` | `gerar` · `horarios` · `marcar` |
| motor | `functions/lib/avaliacao.js` | mede o site; o quiz entra como `declarado` |
| relatório | `/apresentacao/<uuid>` | o MESMO documento de sempre |
| SQL opcional | `db/xray.sql` | serviço de 15 min + `xray_funil` para o /admin |

**Custo por X-Ray ≈ zero:** o motor é determinístico (nenhuma chamada de IA paga). É isso que
permite ser grátis no anúncio. **Nunca** enfie um modelo neste caminho.

**As 4 travas anti-abuso** (é rota pública que varre site de terceiro): `sameOrigin` · 5/h por IP ·
3/dia por domínio · **idempotência de 7 dias por domínio** (mesmo site pedido de novo reaproveita
a avaliação em vez de re-escanear). Dez pessoas pedindo o mesmo domínio = uma leitura só.

**Honestidade:** o que o dono responde é **declarado, não medido**. Entra só nas previsões, com a
premissa dizendo por extenso de onde veio (`payload.previsoes.*.declarado === true`), e **nunca**
no score por aspecto. "Não sei" é resposta válida em toda pergunta de número → não-medido.

**Prova (2026-08-19, ambiente local contra o banco de produção):**
```bash
curl -s -X POST https://guileoai.com/api/raio-x -H 'Content-Type: application/json' \
  -H 'Origin: https://guileoai.com' \
  -d '{"acao":"gerar","site":"sweetgreen.com","nome":"X","contato":"x@example.com",
       "lang":"en","quiz":{"horas_abertas_semana":77,"ligacoes_semana":40,"ticket_medio":18}}'
# → {"ok":true,"id":"...","score":52,"lead_no_funil":true}
curl -s -X POST .../api/raio-x -d '{"acao":"horarios"}'   # → vagas REAIS da agenda da Guileo
curl -s -X POST .../api/raio-x -d '{"acao":"marcar","quando":"<slot>","contato":"x@example.com"}'
# → {"ok":true,"ref":"GUI-B763"}   (linha real em biz_appointments)
```

**Pendências conhecidas:** a call cai no serviço "Guileo Demo" (30 min) até `db/xray.sql` ser
aplicado; e `/vendedor`, `/admin` e o suporte ainda não têm o botão de gerar/listar X-Ray.

---

## ROTA-VOZWEB-LANDING — a Guileo atende por VOZ no próprio site

**Quando:** operar/alterar o botão de voz do `guileoai.com` (o convite flutuante no canto de toda
página de marketing).

**Por que existe:** a Guileo vendia agente de voz e o próprio site não tinha um. O componente
(`src/components/VoiceWeb.jsx`) e o endpoint (`functions/api/voice-web.js`) já serviam o site de
CADA cliente há semanas; faltava a landing apontar para eles. E hoje é o único canal 100% no ar:
a voz roda na ElevenLabs (**não gasta Anthropic** — por isso o chat de texto do site foi
desligado) e não passa por Twilio/operadora/A2P.

**As peças:**

| peça | arquivo | o que faz |
|---|---|---|
| convite | `src/components/VoiceAgent.jsx` | pílula flutuante → painel com **voz primeiro**, ligação depois |
| tela da voz | `src/components/VoiceWeb.jsx` | 4 idiomas + 2 peles (`tema="claro"` cliente · `"escuro"` landing) |
| motor de áudio | `src/lib/voiceWeb.js` | WebSocket + PCM, sem SDK de provedor (carregado por `lazy`) |
| endpoint | `functions/api/voice-web.js` | slug → tenant → agente → cota → URL assinada |
| teto de custo | `db/voice_web.sql` + **`db/voice_web_guileo.sql`** | reserva/devolução de minutos |

**O slug reservado:** a landing manda `slug:"guileo"`. O servidor (constante `PLATFORM_SLUG`)
traduz isso para o tenant interno `demo@guileoai.com` + o agente de demo da plataforma
(`ELEVENLABS_AGENT_ID` ou `agent_5901ktdkev68f5kb161fmeax1rdm`, o mesmo do `+19864443334`).
O atalho acontece **antes** do lookup de cliente — o que também impede um cliente de publicar um
site com slug `guileo` e herdar o agente de demo. Site de cliente segue idêntico: nada mudou no
caminho dele.

**A trava de custo (obrigatória — é a superfície de voz mais exposta do produto):** o medidor já
existia e é o mesmo dos clientes — reserva o teto ao abrir, devolve a sobra ao fechar, e conta em
4 camadas (por IP nesta rota **fail-closed**, por sessão, por dia do tenant, por dia da
plataforma). O que faltava é `db/voice_web_guileo.sql` (**não aplicado**): a linha de limites do
tenant interno — **3 min/sessão · 30 min/dia · 20 sessões/dia**. Sem ela a landing herda o padrão
de cliente pagante (4 min · 60 min/dia · 40 sessões), que é folgado demais para uma porta pública.
**Desligar a voz da landing em 1 comando, sem deploy:**
`update public.voice_web_limits set enabled=false where client_email='demo@guileoai.com';`

**Prova (2026-08-19, antes do deploy):**
```bash
# produção ainda não tem o slug reservado (esperado — sem deploy):
curl -s -X POST https://guileoai.com/api/voice-web -H 'Content-Type: application/json' \
     -d '{"action":"start","slug":"guileo"}'          # → {"ok":false,"reason":"no_site"}  [404]

# wrangler local com o código novo — o desvio da plataforma É tomado:
#   slug=guileo            → {"reason":"quota_unavailable"}  (passou de dono+agente, parou no medidor)
#   slug=naoexisteesteslug → {"reason":"no_site"} [404]      (caminho do cliente intacto)
```
Agente conferido na conta real da ElevenLabs: `GUI`, `pcm_16000` nas duas pontas (o formato que
`src/lib/voiceWeb.js` fala), `max_duration_seconds:600`, `daily_limit:5000` (não `-1`).
Landing aberta a 375px: painel com voz + ligação, sem overflow, e o caminho do erro renderiza a
frase honesta em vez de um botão que gira.

**Depois do deploy, a prova que falta** (precisa de microfone humano): abrir `guileoai.com`,
clicar no convite → 🎙️ → falar. Confirmar no banco:
`select public.voice_web_stats('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com');`

---

## ROTA-MANYCHAT — lead do Instagram/Messenger entra no nosso funil

**Quando:** o Luis ligar o ManyChat nas redes da Guileo. O ManyChat responde a DM; **esta rota é
o lado de cá** — pega o lead e joga no funil que já existe.

**O desenho:** `/api/manychat-lead` é uma **ponte**, não um CRM. Ela reencaminha para `/api/lead`
e herda de graça: `gui_actions` (feed do /admin), CRM da Guileo, atribuição de anúncio, registro
de consentimento, nurture por idioma e speed-to-lead. Mesmo desenho do `/api/raio-x`, pelo mesmo
motivo: o 12º formulário não pode nascer órfão. **Arquivo:** `functions/api/manychat-lead.js`.

> O `functions/api/meta-webhook.js` faz auto-resposta na DM pelo cérebro da Gui (exactly-once,
> anti-injeção) — mas depende de Anthropic. O ManyChat cobre a janela; o meta-webhook volta a ser
> o caminho quando o crédito voltar. **Um não mexe no outro.**

### O que o Luis precisa fazer (3 passos)

**1) Criar o segredo no Cloudflare.** Pages → projeto `guileoai` → Settings → Environment
variables → **`MANYCHAT_SECRET`** = uma frase longa e aleatória (é uma senha; não reusar nenhuma
outra). ⚠️ **Não use o INGEST aqui**: o INGEST abre as RPCs do banco inteiro, e este valor vai
ficar salvo dentro de uma ferramenta de terceiro. Sem essa variável a rota responde **503** e não
aceita nada — de propósito.

**2) No ManyChat: Flow → + → External Request.**
- **Method:** `POST`
- **URL:** `https://guileoai.com/api/manychat-lead`
- **Headers:**
  - `Content-Type: application/json`
  - `x-guileo-manychat: <o mesmo valor do MANYCHAT_SECRET>`
  - *(se a tela não deixar criar cabeçalho de nome livre, use `Authorization: Bearer <segredo>` —
    a rota aceita os dois. **Nunca** na URL: query string entra em log e histórico.)*
- **Body (JSON):** monte com as variáveis do ManyChat, por exemplo:
```json
{
  "name": "{{first name}} {{last name}}",
  "phone": "{{phone}}",
  "email": "{{email}}",
  "username": "{{ig username}}",
  "channel": "instagram",
  "message": "{{last text input}}",
  "lang": "pt",
  "consent": false
}
```

**3) Testar com o botão "Test Request" do ManyChat** e conferir o lead no `/admin`.

### O formato que a rota espera (tolerante, e nunca inventa)

| o que | nomes aceitos |
|---|---|
| nome | `name` · `nome` · `full_name` · ou `first_name` + `last_name` |
| telefone | `phone` · `telefone` · `whatsapp` · `phone_number` · `celular` |
| e-mail | `email` · `e-mail` · `mail` · `email_address` |
| mensagem | `message` · `mensagem` · `text` · `last_input_text` · `pergunta` |
| negócio | `business` · `negocio` · `company` · `empresa` |
| perfil | `username` · `ig_username` · `instagram` · `handle` · `subscriber_id` |
| canal | `channel` · `canal` · `platform` → `instagram`/`messenger`/`whatsapp`/`telegram`/`sms` |
| idioma | `lang` · `language` · `idioma` · `locale` |

**Campo que não vier entra vazio — nada é inventado.** Telefone só é aceito com cara de telefone
(8–15 dígitos) e e-mail só com cara de e-mail; lixo do perfil não vira contato. **Mínimo exigido:**
`phone` **ou** `email` **ou** `username` (numa DM costuma não haver telefone, e o `@` ainda é uma
forma de responder — ele entra como contato prefixado com `@`). Sem nenhum dos três → **400**.

### ⚠️ Consentimento (TCPA — a multa é por ligação)

Quem manda DM **não** consentiu em receber ligação. Por isso o padrão é `consent:false` +
`noCall:true`: o lead entra inteiro no funil e **a Gui não liga sozinha**. Para ativar o
speed-to-lead, o fluxo do ManyChat precisa **perguntar** ("posso te ligar?") e só então mandar
`"consent": true` — aí o opt-in é real e fica gravado no log de consentimento com origem
`manychat`.

### Prova (2026-08-19, wrangler local contra o banco de produção)

| teste | resposta |
|---|---|
| sem cabeçalho de segredo | `{"erro":"forbidden"}` **403** |
| segredo errado | `{"erro":"forbidden"}` **403** |
| sem telefone/e-mail/perfil | `{"erro":"sem_contato"}` **400** |
| corpo não-JSON | `{"erro":"json_invalido"}` **400** |
| `{"nome","telefone":"n/a","ig_username","canal":"instagram"}` | `{"ok":true,"lead_no_funil":true,"contato":"@teste_ponte","canal":"Instagram","ligacao_automatica":false}` — telefone-lixo recusado, perfil virou contato |
| `Authorization: Bearer` + `email` + `consent:true` | `{"ok":true,"lead_no_funil":true,"contato":"teste.ponte@example.com","canal":"Messenger","ligacao_automatica":true}` |

`lead_no_funil` só é `true` quando o `/api/lead` respondeu `ok:true` **e** `stored !== false` —
"200 sem gravar" conta como falha e vira evento `manychat_lead_nao_entrou` no /admin.
🧹 Os dois testes acima criaram leads reais no feed (mensagem **"TESTE PONTE MANYCHAT — pode
apagar"**): apagar no /admin.

## ROTA-FECHAMENTO · do "sim" do dono até o sistema rodando (Website Upgrade)
**Quando:** o dono aceita a proposta do Website Upgrade ($500 uma vez + módulos mensais). Esta rota é a
ordem exata — cada passo tem dono (Luis ou Claude), prova, e o que ACONTECE se pular.

### 0. O sim (Luis) — 2 min
Ele responde o e-mail ou fala na ligação. **Registrar na hora quais módulos ele marcou** (é o que define
preço e trabalho). Se veio pelo modo dono (`?dono=1`), a seleção chega pronta no WhatsApp.

### 1. Cobrar (Luis + Claude) — 10 min
- **$500 do site (uma vez)** + **a mensalidade dos módulos escolhidos**. Dois preços na Stripe:
  Payment Link avulso pro setup + assinatura mensal recorrente.
- Conta live: **Med Mundo Brasil** `acct_1Tbm3wE0fF3QBRot` (a mesma da `STRIPE_SECRET_KEY`).
- **Claude cria os produtos/preços/links** (Stripe MCP) e manda pro Luis conferir ANTES de enviar ao cliente.
- ⚠️ Cobrar antes de construir: o setup existe porque o trabalho existe. Sem pagamento, nada de número.
**Prova:** pagamento confirmado no Stripe + `checkout.session.completed` no webhook.

### 2. Nascer o cliente (Luis) — 15 min · ROTA-ATIVAR
`/vendedor → ➕ Cadastrar cliente` com o cadastro completo (serviços, preços, horários, unidades) →
draft → Luis aprova no `/admin` → `onboard-client.js` cria agente ElevenLabs + cérebro + agenda + widget.
**Prova:** `select status,agent_id,number from onboard_drafts where client_email=…` → `live`.

### 3. Dar voz (Claude) — 10 min · ROTA-PROVISION → ROTA-NUMERO
Reusa número livre antes de comprar (`dry_run` primeiro, `confirm:true` depois). Mapeia no agente.
⚠️ **Conferir o saldo da Twilio antes** (piso de alerta $20) — número novo sem saldo não nasce.
**Prova:** ligar pro número → o agente atende com o nome do negócio.

### 4. Fazer o telefone DELE tocar na Gui (Luis manda, cliente executa) — 5 min · ROTA-ENCAMINHA
`GET /api/encaminhar?email=<tenant>&token=<admin>` gera o documento na marca dele, com as linhas certas.
Recomendação padrão: **condicional** (ocupado + não atende), disparo em ~4 toques (caixa postal em 30s).
⚠️ **Pular isso = a Gui atende um telefone que ninguém disca.** Foi exatamente o caso do Natura.
**Prova:** as 3 ligações do teste (toca longo → Gui; ocupado → Gui; humano no 2º toque → humano) em `call_logs`.

### 5. Entregar o site (decisão do cliente + Claude) — 30 min
Três caminhos, do mais rápido ao mais definitivo:
- **a) Subdomínio** (`new.nonstopplumbers.com`) — ele cria 1 CNAME, o site atual continua no ar. Melhor pra começar.
- **b) Domínio principal** — ele aponta o DNS pra nós; o site antigo sai do ar. Só quando ele estiver seguro.
- **c) Continuar no nosso link** (`guileoai.com/novo/<slug>`) — serve pra piloto/anúncio, não pra marca dele.
**Prova:** abrir o domínio dele e ver o site novo + o schema do CLIENTE (não o da Guileo).

### 6. Ligar os módulos comprados (Claude) — varia
- **Voz 24/7** → já ligado nos passos 2-4.
- **Motor de Orçamento** → e-mail funciona hoje; **SMS depende do A2P** (ver bloqueios).
- **Cobrança na ligação** → o cliente conecta a conta dele: cockpit → *Receber pagamentos (Stripe)* (Connect JÁ habilitado; falta só ele clicar).
- **Review Machine** → precisa do Google Business dele conectado (ATIVACOES #4).
- **Pulse** → liga junto com o cockpit; a avaliação vira mensal.
**Prova:** cada módulo com seu round-trip (ligação real, orçamento enviado, review coletada).

### 7. Entregar o painel (Luis) — 5 min
Acesso ao `/portal` com o `client_email` dele + o briefing do dono (ROTA-BRIEFDONO) ligado.
**Prova:** ele entra e vê as ligações/leads/agenda do próprio negócio.

### 🚧 Os bloqueios REAIS de hoje (falar antes, não depois)
- **SMS (A2P 10DLC):** marca aprovada, **campanha REPROVADA** (erro 30909, "call to action"). Enquanto não
  reenviar apontando pra `/sms`, missed-call text-back e orçamento por SMS **não saem**. E-mail sai.
- **Saldo Twilio:** piso $20 — conferir antes de provisionar número de cliente pagante.
- **Stripe Connect:** habilitado; só falta o CLIENTE conectar a conta dele (1 clique no cockpit).
- **Google Business:** necessário pra Review Machine operar de verdade.
