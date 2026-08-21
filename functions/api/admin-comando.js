// Cloudflare Pages Function — POST /api/admin-comando
// O painel de comando do dono. Uma leitura só, quatro perguntas:
//   dinheiro entrando? · operação rodou? · vendedores vendendo? · o que precisa da MINHA mão?
// AUTH: senha do /admin. A RPC faz o portão de novo (`_admin_ok`), então nem um bug aqui abriria.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "admin-comando", 60)) return json({ error: "rate" }, 429);
    const b = await request.json().catch(() => ({}));
    const d = await svcJson(env, "admin_comando", { p_token: (b.token || "").toString() });
    // A RPC LEVANTA com token errado → svcJson devolve {ok:false, erro_http:400}. Ler a resposta,
    // não o status do fetch: é a diferença entre "senha errada" e "o painel está vazio".
    if (!d || d.ok === false) return json({ error: "unauthorized" }, 401);
    return json({ ok: true, painel: d });
  } catch (e) { return json({ ok: false, motivo: String(e).slice(0, 160) }, 400); }
}
