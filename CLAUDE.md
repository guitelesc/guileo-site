# Guileo — instruções do projeto

**ANTES de qualquer mudança, leia [ARQUITETURA.md](ARQUITETURA.md)** — é o mapa de 3 segundos do sistema inteiro (camadas, os 4 portões de segurança, regras de dinheiro, padrões que são lei, ciclo de 6 passos de feature, protocolo de ondas paralelas). Toda implementação segura/inteligente/rápida começa por ele. Se a arquitetura mudar, atualize o ARQUITETURA.md no mesmo commit.

**Para a visão de PRODUTO (jornada do cliente do primeiro oi ao lucro, gaps abertos, próximas builds), leia [JORNADA.md](JORNADA.md)** — o esboço vivo mapeado por 6 agentes (1 dono por etapa). Atualize os ✅/⏳ a cada onda.

**Para OPERAR clientes (ativar, mapear número, conectar canal, atualizar preços, SEO, cupons, etc.), leia [IMPLEMENTACAO.md](IMPLEMENTACAO.md)** — receitas nomeadas `ROTA-XXX`, cada uma com quando/passos/prova. Nova operação recorrente → adicione uma ROTA lá.

**Para VITRINE DE PROSPECT (COMBO MOTOR: site + agente + e-mail a partir de uma URL), leia [PADRAO-VITRINE.md](PADRAO-VITRINE.md) ANTES de escrever a primeira linha** — a lista que se COPIA, não se redescobre: hero em VÍDEO (§0), abertura (§0.1), toque Vogue (§0.2), identidade medida no pixel, o SELO dos botões, material 4K, movimento fail-open, conversão, página de booking, cabeçalho/logo e as travas do §8. O contrato do motor está em [COMBO.md](COMBO.md). Ciclo: **clona → ESTUDA (lê o PADRAO) → muda**. Padrão novo aprendido → atualize o PADRAO-VITRINE.md no mesmo commit.

**Para os MOTORES de canal (o que a Gui opera pro cliente: voz, agenda, Google, Meta, financeiro…), leia [MOTORES.md](MOTORES.md)** — o mapa vivo: estado de cada motor, arquivos, como gasta crédito (motor financeiro = medidor de tudo), e a chave externa que falta. Ligar/alterar motor → `ROTA-MOTOR` na IMPLEMENTACAO.md. Motor novo → adicione a linha no MOTORES.md.

**Para saber, CANAL POR CANAL (telefone, site, e-mail, SMS, WhatsApp, Instagram/Facebook, Google, TikTok, agenda, pagamentos), as rotas, as automações e o checklist com quem faz cada passo, leia [CANAIS.md](CANAIS.md)** — gerado de `scripts/canais_dados.py` (fonte única; edite lá e rode `python3 scripts/canais_gerar.py`).

**Para o Luis LIGAR as chaves externas (Stripe Connect, A2P, WhatsApp, Google, MindBody, custo de voz, dunning, Mercado Pago), leia [ATIVACOES.md](ATIVACOES.md)** — o runbook clique-a-clique: o que cada chave acende, onde clicar, o nome EXATO da env var no Cloudflare, e o curl de prova. O produto é inerte-que-acende-sozinho; este guia é o que falta pra faturar.

Regras-resumo (detalhes no mapa):
- Prove, não afirme: toda entrega termina com build + deploy + prova real (SQL round-trip / curl / screenshot).
- E-mail SEMPRE via `functions/lib/emailTemplates.js`. Nunca HTML ad-hoc.
- Todo dado/mutação é escopado por `client_email` (tenant). UUID sozinho nunca autoriza nada.
- SQL novo: arquivo próprio em `db/`, idempotente, RPC SECURITY DEFINER gated por literal, RLS on sem policy anon.
- Design do app/cockpit: cimento quente `#161512` LOCKED — nunca retocar tokens globais.
- Honestidade de canais/integrações: live vs pending explícito, scaffolds inertes, nunca fingir.
- Deploy: `npm run build && npx wrangler pages deploy dist --project-name=guileoai --branch=main`.
