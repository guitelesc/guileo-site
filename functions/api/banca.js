// Cloudflare Pages Function — GET/POST /api/banca
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// A BANCA DE DEMO: quantos AGENTES você quiser, poucos NÚMEROS, e a visão de quem está em cada
// número AGORA.
//
// POR QUE EXISTE (Luis, 25/08): «temos 3 números no Twilio. Não tem como criar agentes pra cada um
// e, conforme eles queiram testar, eu dou o número pro cara ligar?»
// Tem — e é o desenho certo, porque agente é de graça e número custa. O que faltava não era o
// mecanismo (isso é o /api/bind-number, que já existe): era ENXERGAR. Trocar um número de agente
// às cegas é exatamente como a linha de demo da Guileo acabou atendendo como o spa da Natura.
//
// Esta rota só LÊ. A troca continua sendo o /api/bind-number, admin-gated, porque mexer em número
// muda o que um estranho ouve quando liga — e isso nunca pode ser um efeito colateral de uma tela.
//
// PORTÃO: INGEST (servidor-a-servidor / painel interno). Não devolve segredo nenhum: só quem
// atende em qual número, para o Luis não dar a um prospect um número que fala outro negócio.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { json, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { isReserved } from "../lib/reserved.js";

export async function onRequest(context) {
  const { request, env } = context;
  const ING = (env.INGEST_SECRET || "").toString();
  const dado = (request.headers.get("x-guileo-secret") || "").toString();
  if (!ING || !safeEq(dado, ING)) return json({ error: "unauthorized" }, 401);

  // A fonte é client_agents: uma linha por tenant, com o agente e o número (ou null).
  const linhas = await svcJson(env, "banca_de_demo", { p_secret: ING }).catch(() => null);
  // ⚠️ Lista ausente NÃO é "banca vazia". Se a leitura falhar e a tela mostrar zero, o Luis
  // acha que nenhum número está ocupado e aponta um que já está com outro prospect.
  if (!Array.isArray(linhas)) {
    return json({ ok: false, banca: null, motivo: "não consegui ler a banca — isto NÃO quer dizer que está vazia" }, 503);
  }

  const comNumero = linhas.filter((x) => x.number);
  const semNumero = linhas.filter((x) => !x.number);
  return json({
    ok: true,
    // Cada ocupado vem marcado se é RESERVADO — o número do demo do site nunca entra na roda.
    ocupados: comNumero.map((x) => ({ ...x, reservado: isReserved(x.number) })),
    livres_para_trocar: comNumero.filter((x) => !isReserved(x.number)).length,
    prontos_sem_numero: semNumero,
    total_agentes: linhas.length,
  });
}
