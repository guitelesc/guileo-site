// Cloudflare Pages Function — POST /api/perfil-do-site
// ═════════════════════════════════════════════════════════════════════════════════════════════
// A PONTA DE ENTRADA DO MOTOR: o cliente cola a URL do negócio e sai um perfil montado.
//
// O PROBLEMA QUE RESOLVE: hoje cadastrar cliente é alguém digitando nome, serviços, preços,
// horário e endereço, campo por campo. Isso trava o vendedor no papel de digitador e exige a
// atenção do dono justamente na hora em que ele deveria estar decidindo comprar. O site do
// negócio já carrega quase tudo — basta ler, com honestidade.
//
// ── AS DUAS REGRAS ───────────────────────────────────────────────────────────────────────────
// 1. NUNCA INVENTA. Mesma lição v1 dos agentes. Preço plausível não é preço; horário "provável"
//    põe cliente na porta fechada. O que não estava escrito volta vazio.
// 2. O QUE FALTA É PARTE DA ENTREGA. `faltando` é o roteiro do que perguntar — e é o que
//    transforma "me manda tudo" em "só me confirma três coisas". Sem essa lista o vendedor não
//    sabe o que pedir; com ela, a conversa encurta e o cliente sente que já trabalhamos por ele.
//
// SEGURANÇA: a busca reusa `buscarHtml` (brandExtract.js) — SSRF, redirect, tipo, tamanho e
// captcha já travados e revisados adversarialmente. Não existe segundo buscador para auditar.
// GATE: crachá de vendedor OU token de admin. É leitura de site público, mas dispara uma busca
// para fora a partir de URL informada — porta aberta a anônimo vira nosso servidor batendo em
// endereço de terceiro sob comando de estranho.
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";
import { perfilDoSite } from "../lib/brandExtract.js";
import { verifySession } from "../lib/sellerSession.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    // busca externa custa tempo e sai do nosso IP — 20/h por IP é generoso para um vendedor
    // cadastrando clientes e apertado para quem quiser nos usar de proxy.
    if (await rateLimited(request, env, "perfil-site", 20)) return json({ error: "too many requests" }, 429);

    const b = await request.json().catch(() => ({}));
    const site = (b.site || "").toString().trim().slice(0, 300);
    if (!site) return json({ error: "informe o site" }, 400);

    // GATE — crachá de vendedor (o mesmo do hub) OU token de admin.
    // ⚠️ O CRACHÁ FALTAVA. Este comentário prometia "crachá de vendedor" desde o primeiro dia e o
    // código só aceitava admin — zero menções a `sid` no arquivo. Resultado: a ferramenta existia,
    // o hub não conseguia usá-la, e quem lesse o cabeçalho perderia tempo procurando o bug em
    // outro lugar (perdi, hoje). Comentário que promete o que o código não faz é pior que
    // comentário nenhum: ele *desvia* a investigação em vez de só deixar de ajudar.
    const token = (b.token || "").toString().trim();
    let autorizado = !!(await verifySession(env, (b.sid || "").toString()));
    if (!autorizado) autorizado = !!(env.ADMIN_TOKEN && safeEq(token, env.ADMIN_TOKEN));
    if (!autorizado && token) {
      try {
        const g = await rpc("blitz_stats", { p_token: token, p_email: "" });
        autorizado = g.ok;
      } catch { /* mantém negado */ }
    }
    if (!autorizado) return json({ error: "unauthorized" }, 401);

    const p = await perfilDoSite(site);
    // O MOTIVO VOLTA INTEIRO. "não deu" sem razão obriga a adivinhar entre site fora do ar,
    // captcha de hospedagem e URL interna — e cada um pede uma conversa diferente com o dono.
    if (p.why) {
      const humano = p.why.startsWith("site-protegido") ? "o site bloqueia leitura automática (proteção anti-robô) — peça os dados ao dono"
        : p.why.startsWith("url-invalida") ? "endereço inválido ou interno"
        : p.why.startsWith("http-") ? `o site respondeu ${p.why.slice(5)}`
        : "não consegui ler o site";
      return json({ ok: true, lido: false, motivo: humano, detalhe: p.why });
    }
    return json({ ok: true, lido: true, perfil: p, faltando: p.faltando });
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}
