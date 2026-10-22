# LEIA-DEV — Guia rápido do frontend da Guileo

Bem-vindo. Este arquivo é o ponto de partida para mexer nas telas da Guileo.
Leia até o fim antes do primeiro commit: as seções 4 e 5 evitam os erros que já custaram caro.

---

## 1. O que é

A Guileo é uma plataforma de IA para pequenos negócios. O mesmo app React serve três públicos:

- **Site público** (`guileoai.com`): a landing, páginas por cidade e por nicho, blog, planos.
- **Painel do dono da Guileo** (`/admin`): funil, leads, agentes, contratos, projetos.
- **Área do cliente** (`/portal`, `/desk`, `/balcao`, `/minha-conta`): o que o negócio usa no dia a dia.

## 2. Stack

| Camada | Tecnologia |
|---|---|
| UI | React 19, React Router 7 |
| Build | Vite 8 (Node 26) |
| Hospedagem | Cloudflare Pages |
| Backend | Cloudflare Pages Functions, em `functions/` (rotas `/api/*`) |
| Dados e login | Supabase (`src/lib/supabase.js`) |

## 3. Onde fica cada coisa

| Caminho | O que tem |
|---|---|
| `src/App.jsx` | **Todas as rotas** (cerca de 100). Comece por aqui para achar a tela de uma URL. |
| `src/pages/` | Uma tela por arquivo: `Home`, `Admin`, `Portal`, `GuileoDesk`, `Balcao`, `Planos`, `Proposta`… |
| `src/components/` | Componentes reaproveitados entre telas (`HeroOS`, `XRaySection`, `AdminFunil`, `LeadForm`…) |
| `src/portal/` | As abas da área logada do cliente (`CRM360`, `Billing`, `AIBrain`, `Ads`…) |
| `src/novo/` | Sites de vitrine feitos para clientes e prospects (`NaturaSpa`, `HairArtDesigns`…) |
| `src/i18n.jsx` | **Todos os textos**, em PT, EN e ES |
| `src/lib/` | Utilitários do front: cliente Supabase, chamadas ao portal, SEO, analytics |
| `src/index.css`, `src/App.css` | Estilos globais e tokens de design |
| `functions/` | Backend. Não é frontend, mas é para onde as telas chamam. |

## 4. Rodar local

```bash
npm install
npm run dev
```

> ⚠️ **ATENÇÃO: o `npm run dev` fala com a PRODUÇÃO.**
> O `vite.config` encaminha `/api` para `https://guileoai.com`. Tudo o que você fizer na tela
> local (criar lead, agendar, mandar mensagem) acontece **de verdade**, em dados de clientes reais.
>
> - Para testar logado, use **apenas** a conta `e2e-test@guileoai.com`. Peça a senha ao Luis.
> - **Nunca** entre ou teste na conta de um cliente real (por exemplo, a da Natura Spa).
> - Não preencha formulários com telefones de verdade: a plataforma pode ligar para o número.

`npm run build` gera a pasta `dist/` e o sitemap. `npm run lint` roda o ESLint.

## 5. Regras da casa (inegociáveis)

1. **Design travado.** O tema "cimento quente" (`#161512`) e os tokens globais de cor **não se alteram**.
   Componente novo usa os tokens existentes. Mudança visual grande vai com print antes e depois para aprovação.
2. **Nada de texto fixo na tela.** Todo texto visível passa pelo `src/i18n.jsx` nos três idiomas.
   Tela em português não pode mostrar uma palavra em inglês, nem o contrário.
3. **E-mail só por `functions/lib/emailTemplates.js`.** Nunca monte HTML de e-mail na mão.
4. **Tudo é por cliente.** Todo dado é filtrado pelo e-mail do cliente (`client_email`, o tenant).
   Uma tela nunca pode mostrar dado de outro cliente.
5. **Honestidade.** Se um recurso ainda não está ligado, a tela mostra "pendente" ou "em breve".
   Nunca exiba número inventado, nem diga que algo funcionou sem a resposta real do servidor.
6. **Sem segredos no código.** As chaves (Stripe, Twilio, ElevenLabs, Supabase service, Resend) ficam
   no Cloudflare. Se precisar de uma variável nova, peça ao Luis. Nunca faça commit de `.env` ou `.dev.vars`.

## 6. Como entregar

1. Crie uma branch a partir da `main`: `git checkout -b minha-mudanca`.
2. Faça commits pequenos, com mensagem clara do que muda **para o usuário**.
3. Abra um **Pull Request** no GitHub. Descreva o que mudou e anexe um print da tela, em claro e no celular.
4. **Não publique.** O deploy em produção é feito pela Guileo depois da revisão do PR.

## 7. Para ir mais fundo

| Arquivo | Quando ler |
|---|---|
| `ARQUITETURA.md` | Mapa do sistema inteiro: camadas, segurança, padrões |
| `CLAUDE.md` | Regras resumidas do projeto |
| `JORNADA.md` | A jornada do cliente, do primeiro contato ao pagamento |
| `MOTORES.md` | O que cada automação faz (voz, agenda, Google, Meta…) |

Dúvida, fale com o Luis antes de adivinhar.
