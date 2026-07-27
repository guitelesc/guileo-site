# HIPAA — Postura atual e caminho real até o BAA (runbook interno)

> **Para: Luis. Não é material de venda.** A página pública `/health-compliance` diz o que somos hoje (agendamento + contato, PHI minimizado, sem certificação HIPAA, BAA no roadmap). Este arquivo é o mapa honesto do que falta para virar "BAA-ready" de verdade — com custos e esforço reais, sem enrolação.

## 0. O que já é verdade HOJE (pode falar sem medo)

1. O agente captura só **nome, telefone, serviço, data/hora** — sem diagnóstico, sem nota clínica (minimização de PHI por design, via prompt do agente em `functions/lib/provision.js`).
2. Criptografia **em trânsito** (TLS na borda Cloudflare) e **em repouso** (criptografia gerenciada do Supabase/Postgres).
3. **Isolamento de tenant**: tudo escopado por `client_email`, RPCs SECURITY DEFINER gated, RLS on sem policy anon (regra da casa — ARQUITETURA.md).
4. **Exclusão sob solicitação** — dá pra apagar contato/lead de um tenant via SQL hoje.
5. **Consentimento TCPA/A2P** com opt-out automático (mesmo motor de compliance da página `/compliance`).

⚠️ O que NÃO pode falar: "HIPAA compliant", "certificado", "assinamos BAA". Hoje é mentira e multa.

## 1. O que um caminho de BAA REAL exige (cadeia completa)

Para a Guileo assinar BAA com uma clínica, **cada fornecedor que toca dado do paciente precisa assinar BAA com a Guileo primeiro**. A cadeia inteira, elo por elo:

1. **Supabase (banco)** — BAA disponível **só no plano Team ou acima** (~US$ 599/mês, era ~US$ 25 no Pro). É preciso ativar o add-on HIPAA, marcar o projeto como HIPAA e seguir o "shared responsibility" deles (MFA obrigatório, sem exposição de dados em logs). Esforço: 1–2 dias de config + migração de plano. **Este é o maior salto de custo fixo.**
2. **Cloudflare (edge/functions)** — BAA da Cloudflare é **Enterprise only** (contrato negociado, tipicamente 5 dígitos/ano). Alternativa realista: garantir que **PHI nunca fica em repouso na Cloudflare** (Pages/Functions só processam em trânsito, sem KV/R2/logs com PHI) e documentar isso como "conduit" — mas advogado precisa validar essa leitura. Esforço: auditoria de todos os `console.log` e de qualquer cache/KV nos `functions/api/*.js` (1–2 dias).
3. **ElevenLabs (voz)** — tem oferta HIPAA/BAA **apenas em plano Enterprise** (preço negociado; espere 4–5 dígitos/ano). O áudio da chamada passa por eles, então se a chamada contiver PHI, o BAA deles é obrigatório. Mitigação já embutida: o prompt do Gui não pergunta nada clínico — mas o PACIENTE pode falar espontaneamente, então não dá pra garantir zero PHI no áudio. Decisão de negócio: Enterprise ElevenLabs ou trocar de vendor de voz na hora do BAA (Retell/Vapi também só dão BAA em tiers altos — ver `reference_guileo_voice_platform`).
4. **Twilio (telefonia/SMS)** — Twilio **oferece BAA** para produtos "HIPAA-eligible" (Voice, SMS elegível, etc.), normalmente condicionado a conta com suporte pago/edição adequada. É o elo mais barato da cadeia. Esforço: solicitar BAA ao account manager + marcar os serviços como HIPAA no console (dias, não semanas).
5. **Stripe** — pagamento não é PHI por si só; Stripe NÃO assina BAA e não deve receber PHI. Regra: nunca colocar nome de procedimento clínico em `description`/metadata de cobrança de clínica (usar rótulo genérico "serviço agendado"). Esforço: revisar `functions/api/*` que criam checkout (meio dia).
6. **E-mail (envio branded)** — lembrete de consulta com nome+horário+clínica JÁ é PHI em contexto de saúde. O provedor de e-mail precisa de BAA ou o conteúdo precisa ser genérico ("você tem um compromisso amanhã às 14h — responda para detalhes"). Decisão de template em `emailTemplates.js` quando chegar a hora.

## 2. Obrigações internas (não dependem de fornecedor — dá pra começar já)

7. **Política de retenção** — definir e automatizar: transcrições e gravações de tenants de saúde expiram em N dias (sugestão: 90) via sweep de cron (`/api/lifecycle` já existe como padrão); contatos ficam até pedido de exclusão. Esforço: 1 SQL + 1 branch no sweep (1 dia).
8. **Audit logging** — HIPAA exige trilha de "quem acessou o quê, quando". Hoje temos `gui_actions`/`client_events`, mas não é trilha de ACESSO. Precisa: tabela `access_log` append-only (RLS on, sem policy), gravada por toda RPC que LÊ dado de tenant saúde, retenção 6 anos. Esforço: 2–3 dias (SQL + tocar cada RPC de leitura).
9. **Exclusão formalizada** — transformar o "apaga via SQL" em RPC `tenant_data_erase(client_email, gate)` idempotente + registro no audit log, com prazo padrão de 30 dias. Esforço: 1 dia.
10. **Risk assessment + políticas escritas** — HIPAA exige análise de risco documentada, política de resposta a incidentes (notificação de breach em até 60 dias), treinamento e um "Security Officer" nomeado (você). Dá pra fazer com template + revisão de advogado de saúde nos EUA (orçar US$ 2–5 mil) ou plataforma tipo Vanta/Drata (~US$ 10–20 mil/ano — só vale com volume de clínicas).
11. **MFA e acesso mínimo** — MFA no Supabase/Cloudflare/Twilio/Stripe de todo mundo que acessa produção (hoje: você). Esforço: 1 hora. Fazer JÁ, independente de HIPAA.

## 3. Custo total honesto (ordem de grandeza, por ano)

| Elo | Custo/ano (estimativa) | Obrigatório p/ BAA? |
|---|---|---|
| Supabase Team + HIPAA add-on | ~US$ 7.200+ | Sim |
| Cloudflare Enterprise (ou parecer "conduit") | US$ 0 (parecer) a 5 dígitos | Depende do parecer |
| ElevenLabs Enterprise (ou troca de vendor) | 4–5 dígitos, negociado | Sim (voz carrega PHI potencial) |
| Twilio BAA | ~custo do suporte pago | Sim |
| Advogado (BAA próprio + políticas + parecer) | US$ 2–5 mil (one-off) | Sim |
| **Piso realista** | **~US$ 15–30 mil no ano 1** | — |

**Conclusão de negócio:** só faz sentido quando houver pipeline de clínicas que EXIGEM BAA pagando preço de tier saúde (cobrar +US$ 300–500/mês por tenant HIPAA cobre a cadeia com ~5 clínicas). Antes disso, a postura pública honesta da página `/health-compliance` é o produto certo: vender agendamento não-clínico sem PHI.

## 4. Ordem de execução quando decidir ir (checklist)

1. Fechar 3+ clínicas em lista de espera pagando tier saúde (prova de demanda).
2. Itens internos primeiro (7–11 acima) — baratos e viram argumento de venda imediato.
3. Twilio BAA (elo mais fácil).
4. Supabase Team + HIPAA add-on; marcar projeto.
5. Parecer jurídico Cloudflare-conduit; se negativo, orçar Enterprise.
6. Negociar ElevenLabs Enterprise vs. trocar vendor de voz (decidir com os números de `reference_guileo_voice_platform`).
7. Advogado: redigir NOSSO BAA padrão para oferecer às clínicas + DPA.
8. Atualizar `/health-compliance` e `Privacy.jsx` (seção Health/HIPAA) no mesmo deploy em que o primeiro BAA for assinado — nunca antes.

## 5. Regras de honestidade até lá (LEI)

1. Nunca escrever "HIPAA compliant" em site, deck, e-mail ou proposta.
2. Se a clínica perguntar, a resposta é a página `/health-compliance` — postura completa, limites explícitos.
3. Tenant de saúde novo: conferir que o prompt do agente (provision.js) mantém a regra "não perguntar/registrar nada clínico".
4. PHI que aparecer espontaneamente em transcrição não é catástrofe hoje (não somos covered entity, não assinamos BAA), mas é o motivo pelo qual a retenção curta (item 7) deve entrar logo.
