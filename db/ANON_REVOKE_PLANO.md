# 🔐 Fechar o `anon` — o plano em lotes

## O problema (a maior dívida arquitetural aberta)

A chave `anon` do Supabase é **pública** — vai no bundle do navegador, qualquer um lê. O que
protege nossas RPCs é um **literal commitado no repositório** (`glo_ing_…`). Ou seja: hoje o
que segura os dados de todo cliente é *ninguém ter olhado o repo nem o segredo*. Isso não é
uma trava, é uma aposta. Com 20 clientes pagantes, é a aposta que mata a empresa.

O alvo: nenhuma RPC executável pelo `anon`. Os Workers passam a chamar tudo com a
`service_role` (`svcRpc`, em `functions/lib/sb.js`), que só o servidor tem.

## Onde estamos

| Data | Lote | Funções | Restam abertas |
|---|---|---|---|
| — | ponto de partida | — | **352** |
| 2026-08-04 | **lote 1 — ninguém chama** | 41 | **311** |
| 2026-08-04 | **lote 2 piloto** — `my_company_os` | 1 | **310** |
| 2026-08-04 | **lote 2a** — família `company-os` | 16 | **294** |

> ⚠️ O número 542 que aparece numa contagem ingênua inclui ~190 funções da extensão
> `btree_gist` (`gbt_*`, `*_dist`, `gbtreekey*`). Essas não são nossas e não entram na conta.
> Filtre por `not exists (select 1 from pg_depend where objid = p.oid and deptype = 'e')`.

## O método (repetir a cada lote)

1. **Listar** as nossas funções ainda abertas ao `anon` (com o filtro de extensão acima).
2. **Classificar por quem chama**, lendo o código todo de uma vez (grep por função é lento
   demais — 350 nomes × 3 diretórios trava):
   - aparece em `src/` ou `public/` → **o NAVEGADOR chama** → não dá pra revogar sem antes
     mover a chamada pra um endpoint do servidor;
   - só em `functions/` → candidata, mas veja o passo 3;
   - em lugar nenhum → **risco zero**.
3. **Conferir se o nome é literal.** Se algum call site montar o nome dinamicamente
   (`rpc(\`${x}\`)`), a classificação mente. Hoje só os *helpers* são genéricos; todo call
   site passa string literal — confira de novo antes de cada lote.
4. **Conferir as chamadas internas de SQL.** Uma função chamada de dentro de outra
   `SECURITY DEFINER` roda como **DONO**, então o grant do `anon` não importa. Só há risco se
   a chamadora for `SECURITY INVOKER` **e** alcançável pelo `anon`. Consulta pronta: listar as
   `not prosecdef` e ver se citam alguma candidata no `prosrc`.
5. **Gerar o volta-atrás ANTES de revogar** (`db/anon_revoke_loteN_ROLLBACK.sql`), com os
   grants exatos via `pg_get_function_identity_arguments`.
6. **Revogar**, conferir a contagem, e **provar**: chamar uma revogada com a chave anon
   (deve dar `PGRST202`/`42501`) e chamar uma que a usa por dentro (deve continuar
   funcionando — foi assim que o `blitz_stats` provou que o caminho interno está íntegro).
7. **Teste de fumaça no site vivo**: páginas 200 + os endpoints públicos respondendo o
   *gate* deles (401/404 de regra de negócio), nunca erro de permissão.

## O que o piloto ensinou (lote 2)

- **Nenhuma** das 266 do servidor usava `svcRpc` — todas passavam pelo helper anon local.
  Não existe vitória de graça no lote 2: cada função exige mudança de código.
- **186 das 266 vivem num arquivo só** (62 arquivos). Migrar arquivo inteiro é o melhor
  retorno por deploy: no `company-os.js` foram 19 chamadas de uma vez, trocando
  `await rpc(` por `await svcRpc(env, ` e **apagando o helper anon e a chave** — se ficarem
  ali, alguém reintroduz sem querer. Confira `env` no escopo de TODA chamada antes.
- **Depois que o código para de usar a anon, revogar não muda nada pra ele.** Isso derruba o
  risco do passo: o deploy é o momento arriscado, o `revoke` é só fechar a porta.
- A prova que vale é a do vazamento: chamar a função com a **chave anon + o literal do repo**
  e ver `42501 permission denied`. Foi o que o piloto mostrou, com o cliente ainda vendo os
  8 departamentos dele.

## Próximos lotes

- **Lote 2 — só o servidor chama (restam ~250).** O maior. Cada função precisa que TODO call site
  em `functions/` use `svcRpc` e não o helper `rpc` local (que usa anon). Fazer por ARQUIVO
  (não por família), um por vez, com deploy e prova entre eles. Próximos melhores alvos:
  `proactive.js` (12), `social-publish.js` (8), `automations.js` (6), `growth-intel.js` (6).
  ⚠️ `stripe-webhook.js` (7) e `agent-schedule.js` (14) são DINHEIRO e AGENDA — só com
  revisor adversarial, nunca no meio de um lote mecânico.
- **Lote 3 — o navegador chama (45).** O mais delicado: exige mover a chamada pro servidor
  antes de revogar. É onde mora o risco real de derrubar o cockpit — só com calma.
- **Depois de tudo:** rotacionar o literal `glo_ing_…` (ele está no histórico do git pra
  sempre; revogar o anon é o que o torna inútil, mas rotacionar fecha de vez).
