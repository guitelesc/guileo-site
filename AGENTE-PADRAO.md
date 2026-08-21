# PADRÃO DO AGENTE DE VOZ — a norma única

> **O agente É o produto.** Um site feio custa uma visita; um agente errado custa o cliente do
> cliente. Este documento existe para PARAR DE MUDAR DE IMPROVISO: aqui está cada campo que
> importa, ONDE ele se muda, qual é o valor certo, e o incidente real que provou isso.
>
> Regra de ouro: **nada aqui se ajusta direto no painel da ElevenLabs.** Tudo se muda na FONTE
> (`functions/lib/provision.js` + `functions/lib/licoes.js`) e chega pelo `/api/sync-agent`.
> Ajuste feito no painel dura até o próximo sync — e some sem aviso.

## Como verificar (1 comando, sem adivinhação)

```
curl -s "https://guileoai.com/api/agente-config?padrao=1&agent_id=<ID>" -H "x-guileo-secret: $INGEST"
```
Devolve item a item ✅/❌. **Agente novo só vai ao ar com 100%.**

---

## 1 · IDENTIDADE — quem atende
| item | valor certo | onde muda |
|---|---|---|
| Nome na ElevenLabs | `{Agente} · {Negócio}` | `sync-agent.js` (automático) |
| Primeira fala | linguagem de CUIDADO, nunca "how may I help you" | `GREETINGS` em `provision.js` |
| **Variável na 1ª fala** | **NUNCA.** Variável ausente derruba a ligação ANTES de atender | — |
| Nome do negócio | do perfil; sync RECUSA se vazio | `sync-agent.js` |

**Incidente:** 18/08 — `{{caller_ola}}` na saudação → `Missing required dynamic variables`, ligação
com 0 segundos. O nome vai no PROMPT, nunca na primeira fala.

## 2 · IDIOMA — o mais caro de errar
| item | valor certo |
|---|---|
| Ferramenta `language_detection` | no array `tools` (**não** em `built_in_tools` — lá a ElevenLabs guarda `null` com HTTP 200) |
| Preset por idioma | `pt` **E** `pt-br` (o modelo chama com "pt"; só "pt-br" cadastrado = "Invalid language") |
| Motor por preset | `eleven_flash_v2_5` (multilíngue) — o motor da BASE inglesa é v2, monolíngue |
| Regra no prompt | "trocar de idioma é CHAMADA DE FERRAMENTA, não escolha de palavras" |

**Incidentes:** motor monolíngue por meses (voz nativa lendo com motor inglês) · ferramenta `null`
aceita com 200 · `language:"pt"` recusado por só existir `pt-br` · a agente respondia em português
sem chamar a ferramenta (voz seguia americana).

## 3 · VOZ
| item | valor certo |
|---|---|
| PT-BR | **Nina M.** `GM2UA3fbsIaLHcswCDX9` (fixada) |
| ES | **Jess** `x5O3bgPT2grYhry6qmWR` (fixada) |
| Regra | voz aprovada por ESCUTA nunca volta a sorteio (`pinned` em `voiceLibrary.js`) |
| **Pré-requisito** | **a voz precisa ESTAR NA CONTA.** Fixar o id sem adicionar → cai na voz base |

**Incidente:** 18/08 — Nina fixada sem ser adicionada; a ligação saiu com VOZ MASCULINA (a base do
agente de demo). Adicionar: `/api/agente-config?adicionar_voz=<id>&lang=pt`.

## 4 · CÉREBRO
| item | valor certo |
|---|---|
| Lições | `licoes.js`, versão atual carimbada em `client_agents.brain_version` |
| KB do cliente | até 12.000 chars (o corte de 1.600 entregava 1 de 16 itens) |
| Preços | do catálogo real, por unidade |
| Vertical | vem do PERFIL (`industry`), não do corpo da requisição |
| LLM / temperatura | `gpt-4o` / `0` — não improvisa preço |

**Incidente:** o `industry` só chegava pelo corpo; o re-sync automático não manda corpo → **nenhuma
lição por vertical chegou a nenhum agente** (spa, clínica, restaurante, jurídico).

## 5 · FERRAMENTAS
`schedule` · `do_action` · `language_detection` — as três, sempre.
Regra: **nunca prometer sem chamar** ("agendado", "mandei o link", "a equipe confirma").

## 6 · RECONHECER QUEM LIGA
Webhook de identidade instalado (`platform_settings.workspace_overrides`) devolvendo
`caller_name`, `caller_phone`, `caller_last`, `caller_note`. Instalar/conferir:
`/api/agent-evolve?identidade=1&corrigir=1`. Usar as variáveis **no prompt**, jamais na 1ª fala.

## 7 · LIMITES
`max_duration_seconds: 300`. **NUNCA mandar `daily_limit: -1`** — a ElevenLabs trata como teto
literal de −1 e recusa TODA ligação (custou ligações de cliente pagante em 16/08).

## 8 · PROVA — sem isto, não está pronto
| prova | como |
|---|---|
| Configuração | `/api/agente-config?agent_id=…` (lê a config VIVA) |
| Comportamento | `/api/agente-teste` — testes nativos da ElevenLabs, **zero Anthropic**, provam CHAMADA de ferramenta |
| Ligação real | `/api/agente-config?ligacao=1` — transcrição + idioma por turno + ferramentas usadas |

**A lei:** `200` não é prova. `queued` não é entrega. "Configurado" não é "funciona".
Só o que foi LIDO DE VOLTA conta.

---

## Checklist de cliente novo
1. Provisionar → 2. `industry` no perfil → 3. KB + preços → 4. número vinculado →
5. `?identidade=1&corrigir=1` → 6. `?padrao=1` **100%** → 7. `/api/agente-teste` **4/4** →
8. uma ligação real ouvida pelo dono.


---

## ⚠️ MUDANÇA DE NORMA — 2026-08-19 · UMA VOZ

A norma anterior exigia **voz nativa por idioma** (Nina no pt, Jess no es). **Está revogada.**

**Agora:** o agente tem UMA voz em todos os idiomas. Preset nenhum fixa `voice_id`; todos herdam
a base. Voz padrão da casa: **Bella `hpp4J3VqNfWAUOO0d1Us`**.

**Por quê:** o Luis ouviu a ligação real. O sotaque ficava melhor e a LIGAÇÃO quebrava — a
atendente virava outra pessoa no meio da conversa. Quem está do outro lado não lê isso como
"sotaque melhor", lê como transferência, e perde a confiança que a ligação inteira construiu.
Uma pessoa tem uma voz.

**Verdade técnica que fecha a discussão:** uma voz = um sotaque. Só uma voz clonada de alguém
genuinamente bilíngue teria as duas coisas, e não existe feminina brasileira-americana na
biblioteca. O que o preset ainda PRECISA carregar é o motor multilíngue (`eleven_flash_v2_5`) —
sem ele um agente inglês nem fala português.

Os itens 3 do `?padrao=1` foram INVERTIDOS (não apagados) para pegar uma regressão de volta pra
voz-por-idioma. Rota operacional: `ROTA-AGENTE` na IMPLEMENTACAO.md.
