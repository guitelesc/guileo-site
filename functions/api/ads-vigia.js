// Cloudflare Pages Function — GET/POST /api/ads-vigia?token=DIGEST_TOKEN
//
// O VIGIA DE ANÚNCIOS — a rotina que separa AGÊNCIA de PAINEL.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Um painel espera você abrir. Uma agência te avisa. Toda segunda esta rota varre as campanhas de
// TODOS os clientes e manda, para cada um que tem decisão a tomar, um e-mail dizendo O QUE FAZER.
//
// Antes disto o motor de anúncios era completamente passivo: media bem e ficava esperando. Se uma
// campanha começasse a queimar dinheiro numa terça, o cliente só descobria se abrisse a aba — e
// quem tem um salão para tocar não abre aba.
//
// ── AS TRÊS REGRAS ───────────────────────────────────────────────────────────────────────────
//
// 1. SILÊNCIO QUANDO NÃO HÁ NADA. E-mail semanal dizendo "está tudo bem" treina o cliente a não
//    abrir — e no dia em que a mensagem importa, ela vai para a lixeira com as outras. Não mandar
//    é parte do produto.
//
// 2. ALARME EXIGE AMOSTRA (garantido no `ads_alertas`): campanha sem gasto lançado nunca vira
//    alerta, e "corta" nunca sai com 1 ou 2 leads. Alarme falso queima a confiança no alerta.
//
// 3. OPORTUNIDADE VAI JUNTO DO PROBLEMA. Agência que só avisa de prejuízo deixa dinheiro na mesa:
//    dizer "esta campanha está pagando 10×, aumenta o orçamento" vale mais que cortar a ruim.
//
// GATE: DIGEST_TOKEN, igual a client-report.js — é o cron quem chama, não o navegador.
import { json, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { adsAlertEmail } from "../lib/emailTemplates.js";
import { brandFor } from "../lib/clientBrand.js";

async function vigiar(request, env) {
  const url = new URL(request.url);
  const tok = url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

  const dias = Math.min(90, Math.max(3, Number(url.searchParams.get("dias")) || 14));
  // `seco=1` varre e mostra QUEM seria avisado sem mandar nada. Existe porque testar um disparo
  // em massa mandando de verdade é como se testa uma vez só — e depois se pede desculpa.
  const seco = url.searchParams.get("seco") === "1";

  const r = await svcJson(env, "ads_alertas", { p_secret: env.INGEST_SECRET || "", p_days: dias });
  if (!r || r.erro_http) return json({ ok: false, error: `não consegui varrer (${r?.erro_http || "?"})` }, 502);

  // ── O TERCEIRO BALDE: 'medir' NÃO VAI PARA O CLIENTE ────────────────────────────────────────
  // `ads_alertas` passou a marcar com gravidade 'medir' a campanha que trouxe agendamento e
  // nenhum deles tem valor (serviço sem preço cadastrado, cobrança fora da Gui). O corpo do
  // e-mail (adsAlertEmail) tem exatamente DOIS blocos: "Precisa de atenção" e "Vale investir
  // mais". O `else` desta linha jogava tudo que não fosse 'alta' no segundo — então "não consigo
  // medir esta campanha" chegaria ao cliente debaixo de um título verde dizendo VALE INVESTIR
  // MAIS. Trocar um alarme errado (o de PAUSAR, corrigido no SQL) por um convite errado a gastar
  // seria consertar pela metade.
  //
  // Enquanto o template não tiver um bloco próprio, o caso fica FORA do e-mail e aparece no
  // cockpit (`/api/ads` action `alertas` → `sem_medicao`), que é onde ele tem lugar. A varredura
  // devolve a contagem para o disparo nunca ser silencioso sobre o que deixou de dizer.
  const porCliente = new Map();
  let semMedicao = 0;
  for (const a of (r.alertas || [])) {
    if (a.gravidade === "medir") { semMedicao++; continue; }
    if (a.gravidade !== "alta" && a.gravidade !== "oportunidade") continue;
    if (!porCliente.has(a.cliente)) porCliente.set(a.cliente, { urgentes: [], oportunidades: [] });
    porCliente.get(a.cliente)[a.gravidade === "alta" ? "urgentes" : "oportunidades"].push(a);
  }

  if (seco) {
    return json({
      ok: true, seco: true, clientes_com_alerta: porCliente.size, sem_medicao: semMedicao,
      previa: [...porCliente].map(([cliente, g]) => ({ cliente, urgentes: g.urgentes.length, oportunidades: g.oportunidades.length })),
    });
  }
  if (!env.RESEND_API_KEY) return json({ ok: false, error: "RESEND_API_KEY ausente — varredura feita, nada enviado", clientes_com_alerta: porCliente.size }, 503);

  const avisados = [], falhas = [];
  for (const [tenant, grupos] of porCliente) {
    try {
      const marca = await brandFor(env, tenant).catch(() => null);
      const tpl = adsAlertEmail({
        business: marca?.business || "", urgentes: grupos.urgentes, oportunidades: grupos.oportunidades,
        lang: marca?.lang || "pt", brand: marca,
      });
      const mr = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [tenant], subject: tpl.subject, html: tpl.html }),
      });
      // CONFERIR O RESULTADO DO ENVIO. "mandei" sem checar já produziu dois defeitos invisíveis
      // nesta base — o aviso que mais importa é justamente o que ninguém percebe que não chegou.
      if (mr.ok) avisados.push(tenant);
      else falhas.push({ tenant, http: mr.status });
    } catch (e) { falhas.push({ tenant, erro: String(e).slice(0, 100) }); }
  }

  // AS FALHAS VOLTAM JUNTO: varredura que só conta sucesso esconde o cliente que ficou sem aviso
  // — e é ele quem vai perguntar, no fim do mês, por que ninguém avisou.
  return json({ ok: true, clientes_com_alerta: porCliente.size, avisados: avisados.length, sem_medicao: semMedicao, falhas });
}

export const onRequestGet = ({ request, env }) => vigiar(request, env);
export const onRequestPost = ({ request, env }) => vigiar(request, env);
