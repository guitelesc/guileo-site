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
| INGEST | `'glo_ing_c7f2a9e4b8d16350'` = env `INGEST_SECRET` | RPCs de dados/CRM/marketing |
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
3. **Honestidade de canal**: LIVE (voz · widget/webchat · e-mail) vs PENDING de aprovação EXTERNA, código pronto, acende sozinho (**SMS US** — campanha A2P 10DLC reprovada, erro 30034 · **WhatsApp** — remetente · **IG/Messenger** — `meta-app-not-approved` · **Google Business** · **Ads**): capturado agora, sai quando aprovar. Badge verde/âmbar. Nunca fingir.
   ⚠️ **SMS NÃO ESTÁ LIVE** (esta linha dizia que estava, até 2026-08-20 — e a contradição com `functions/lib/productFacts.js` virou 12 promessas sem lastro no catálogo público). A fonte da verdade do estado REAL de cada canal é **`functions/lib/productFacts.js`**. Quando uma aprovação sair, **três arquivos mudam JUNTOS, no mesmo commit**: `functions/lib/productFacts.js` · `src/data/selfServePlans.js` · **este** ARQUITETURA.md. Os três são lidos como lei e não podem discordar. Hoje o pay-link e o alcance de review saem por **e-mail/ligação**, não por SMS.
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
- **Slug reservado `guileo`** (2026-08-18): a landing fala com esse MESMO agente de demo **por voz no navegador** (`/api/voice-web`, `PLATFORM_SLUG`), sem telefone e sem A2P. O atalho roda antes do lookup de cliente — nenhum site de cliente pode reivindicar o slug. Medidor no tenant interno `demo@guileoai.com`. Ver ROTA-VOZWEB-LANDING.

## 📸 Contas Meta (regra de ouro, como a de números)

**Uma Página do Facebook = um Instagram** (regra da Meta, não nossa). Logo: cliente com duas marcas
= duas Páginas. Isso é o caso NORMAL — restaurante com duas unidades, clínica com duas marcas, a
própria Guileo com `@guileoai` e `@guileo.ad`.

**A credencial mora por PÁGINA, em `meta_accounts` (`db/meta_multi_conta.sql`).** Um cliente tem
N linhas. `client_integrations` continua existindo e guarda a conta **primária** — é o que o resto
da plataforma lê e a queda de compatibilidade.

**A resolução responde sobre o ID QUE FOI PERGUNTADO.** `meta_tenant_for_page(id)` aceita page_id
*ou* ig_id (o webhook do Instagram entrega o ig_id como `entry.id`; o do Messenger entrega o
page_id) e devolve o token **daquela** conta. Quem varre conta a conta usa `meta_token_for_ig`,
nunca `meta_token_for_email` — este devolve o da primária e varreria a conta 2 com o token da 1.

⚠️ **Até 28/08 isto estava errado e falhava calado**, dos dois lados: a resolução achava o cliente
pelo ID certo e depois buscava a credencial por CLIENTE com `limit 1` (a Página B respondia com o
token e a identidade da Página A), e `meta_creds_store` fazia `tokens || excluded` na linha do
cliente (gravar a segunda conta APAGAVA o token da primeira). Mesma família do incidente da linha
de demo atendida pelo spa de um cliente: a busca começa pelo identificador certo e termina numa
tabela indexada por outra coisa. Índice único em `meta_accounts.ig_id` agora impede duas Páginas
reivindicarem o mesmo Instagram.

**Diagnóstico:** `ig_id` vazio com `meta=ok` significa **a conta de Instagram não está amarrada à
Página** — não é permissão, não é token. Amarrar é no Business Suite e só o dono faz.

## 💬 Guileo Direct — o funil medido (comentário → DM → conversa → lead)
Nome próprio do produto (como o Guileo Pulse; não se traduz) — `productSystem.js` id `direct`.
- **Uma linha por porta**, em `meta_direct_eventos` (`db/direct_metricas.sql`): `comentario → casou →
  segurado | dm_enviado | dm_falhou → publica_ok/falhou` e, na conversa, `dm_recebida → dm_respondida |
  dm_nao_entregue | standby`. O feed do dono (`client_events`) continua com a frase bonita; **métrica nunca
  parseia frase** — frase muda de redação, coluna não.
- **Quem grava:** `marcar()` em `meta-webhook.js`. Nunca atrasa o envio: as marcas saem em paralelo e só
  são esperadas no `finally`. Falhar em medir não derruba DM.
- **Lead do Direct:** o link do DM sai carimbado por `linkDoDirect()` (`utm_source=instagram&utm_medium=direct
  &utm_campaign=<id>`). Cai em `lead_attribution` pelo cookie `gui_attr` → "leads por campanha" é um COUNT.
  Primeiro toque vence (90 dias): o Direct não rouba crédito de anúncio.
- **A Gui sabe de onde a conversa veio:** `direct_contexto_pessoa` (comentário ≤7 dias) → `origemDaConversa()`
  → `guiReply({origemConversa})`, que vai ao agente de voz E ao prompt de sistema da reserva. Vem do nosso
  banco, nunca do texto da cliente — por isso pode entrar no sistema.
- **Leitura:** `direct_metricas(p_secret,p_email,p_dias)` (só service_role) → `/api/meta-comentarios`
  (lista + `action:"metricas"`, 7/30/90 dias) → `src/portal/DirectMetricas.jsx`. Os conselhos ("o que
  melhorar") são regras puras em `src/portal/directConselhos.js`, cada uma nascida de um caso real.
- **"Não sei" não é zero:** antes da medição ao vivo, conversa e denominador aparecem como "—"; sem link,
  lead é "—". Erro de leitura volta `metricas:null` + motivo, nunca um funil de zeros.

## ⏰ Cron externo (Pages não tem cron) — URLs token-gated
`/api/proactive` (datas/aniversário/rebooking) · `/api/automations` (radar/slow-day) · `/api/lifecycle` · `/api/collections?sweep=1` · `/api/nps` · `/api/money-reconcile` · `/api/health-monitor` · `/api/backup` (diário 13h/14h, `ops_run_claim('backup',20h)`)

**Alarme de operação = `avisarDono(env,{kind,summary,…})` em `functions/lib/avisarDono.js`** — a porta ÚNICA (2026-09-09): feed do /admin + e-mail para a caixa que o dono LÊ (`luistelesc@gmail.com`; `OWNER_EMAIL` sobrescreve) + WhatsApp (número de `client_notify_phone_lookup` do tenant `smart@guileoai.com`), trava de 6h por `kind` via `health_claim`, e devolve o RECIBO de cada canal (`.ok` conferido). Cron-tick avisa todo alvo não-2xx. Nunca escreva outro "manda e-mail pro dono".

---
*Atualize ESTE arquivo quando a arquitetura mudar. Ele é o contrato de 3 segundos.*

## Cérebro de texto e o nome do painel (2026-09-09)
- **O painel do cliente chama-se `Central`** (`src/portal/nome.js` → `NOME_DO_PAINEL`; um lugar só, 4 idiomas). "Growth Cockpit" morreu; `cockpit` sobrevive só como id interno de rota/aba.
- **Todo canal de texto de cliente passa por `guiReply`** (`functions/lib/guiBrain.js`). Ordem: agente de voz da ElevenLabs (Chat Mode, `chatEleven.js`) → Anthropic de reserva. Cérebro paralelo é proibido — o widget tinha um e ficou 5 dias mudo.
- **Texto pelo agente NÃO é ligação**: o webhook da ElevenLabs lê `dynamic_variables.canal === "texto"` (ou ausência de `metadata.phone_call`) e grava `message`, sem crédito de ligação, sem custo de voz, sem contato de CRM por "quem ligou". Cobrar chat é decisão de preço pendente do Luis.

## A Central para cliente real — leis de 2026-09-28
Nasceram do primeiro acesso real (Natura Spa) e da varredura de ~60 achados que veio depois.
- **Prova da Central é LOGADO.** O modo demo não tem sessão nem `real`: o travamento de boot só acontecia com sessão ativa. Conta de teste: `e2e-test@guileoai.com`.
- **Nada de `await supabase.*` dentro de `onAuthStateChange`** (espera circular com a inicialização do auth-js). Boot sempre termina: `try/finally` + teto por etapa.
- **Uma tela que quebra não derruba a Central:** `src/portal/LimiteDeTela.jsx` em volta do conteúdo, com `key={view}`. Telas carregam com `lazyRetry`.
- **Nenhuma chamada espera para sempre:** `src/lib/tetoDeRede.js` põe teto de 45s em `/api/**` e RPCs sem sinal próprio.
- **Falha ≠ vazio.** Leitura nova usa as variantes `…Detalhado` do `portalApi.js` (`{data, motivo}`) e o bloco `src/portal/FalhaDeLeitura.jsx` (frase + "tentar de novo"). Falha nunca entra no cache de 45s.
- **Cliente real nunca vê número de amostra nem "feito ✓" sem backend.** Sem motor: esconde o botão ou diz "ainda não disponível". Conta conectada cujo primeiro dado não chegou não monta tela nenhuma (portão da amostra).
- **O treino do agente nunca leva semente:** só o que o dono escreveu vai para `/api/sync-agent` (`kbDoDono`/`brainDoDono`/`nomeDoDono`).
- **Ramo vem da conta:** `identity.sector` (texto livre) → `src/portal/setor.js`. Sem correspondência não muda.
- **Resposta nossa com corpo JSON usa 503, nunca 502** — a Cloudflare troca o corpo de todo 502 por texto puro e o motivo some.
- **Servidor fala a língua da tela:** endpoints aceitam `lang`; instrução de engenharia vai em `detalhe_tecnico`, nunca na frase do cliente.
- **Orçamentos do cliente:** `/api/orcamentos` (plural, portão por chave do tenant). `/api/orcamento` é o orçamento de tokens do admin.
- **Agendamento feito vira evento `booking`** uma vez só (`ingest_booking_event`, custo 0).
- **Chave nunca em URL.** Conta e chave vão no corpo.
- **Espelho nunca é fonte:** `sync-agent` resolve nome e ramo do negócio pelo PERFIL primeiro; o nome do agente ao vivo é o último resgate. Um sync ruim não pode se perpetuar lendo o que ele mesmo escreveu.
- **Varredura só vale com controle positivo:** `npx eslint src functions -f json` filtrando `no-undef`, `react-hooks/rules-of-hooks` e `fatal`, com um arquivo plantado que ela tem que acusar.

## Entrada em operação por cliente — `live_desde` (2026-09-28)
- **Lei:** teste nosso nunca aparece como dado real do cliente. O perfil (`client_integrations` provider=`profile`) guarda `live_desde`; as leituras do painel só mostram o que aconteceu dali em diante. **Esconde, não apaga.**
- **Uma função, um ponto:** `tenant_live_desde(email)` devolve a data ou NULL. Sem data, toda leitura fica idêntica ao que era — a marcação é opt-in por cliente.
- **Coberto:** `get_client_data`, `get_call_logs`, `crm_list_contacts`, `crm_leads_today`, `cx_summary`, `cx_drivers`, `cx_detractors`. **Não coberto:** 37 leituras (agenda, negócios, caixa de entrada, receita, Company OS, automações) — lista em `db/live_desde.sql`. RPC nova que lê histórico do tenant lê de `vivo_<tabela>(email)`, nunca da tabela crua.
- **Limite:** a data esconde o ANTES. Depois do lançamento, teste é no `e2e-test@guileoai.com` ou na linha de demonstração — nunca na conta do cliente.
- **Operar:** `ROTA-LANCAR` na IMPLEMENTACAO.md. **SQL:** `db/live_desde.sql`.
