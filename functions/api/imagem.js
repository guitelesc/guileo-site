// Cloudflare Pages Function — POST /api/imagem → arte para os sites que a gente cria.
// A regra (arte sim, foto-documento não) e o porquê vivem em lib/imagemSite.js.
//
// Devolve a IMAGEM em si (o tipo é lido dos bytes), não um JSON com base64: quem chama quer pôr num `<img>` ou
// salvar num arquivo, e um base64 de 1 MB atravessando JSON é caro dos dois lados. Erro sai em
// JSON — é a única forma de dizer POR QUE não veio imagem.
import { json, sameOrigin } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { gerarImagem } from "../lib/imagemSite.js";

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    // ⚠️ LÊ O CORPO da RPC, não o status: `_admin_ok` devolve `false` com HTTP 200.
    const a = await svcJson(env, "_admin_ok", { p_token: (b.token || "").toString().slice(0, 200) }).catch(() => null);
    if (!(a === true || a?.ok === true)) return json({ error: "unauthorized" }, 401);

    const r = await gerarImagem(env, {
      pedido: b.pedido, cor: b.cor, ramo: b.ramo, estilo: b.estilo, passos: b.passos,
    });
    // A RECUSA NÃO É ERRO DE SISTEMA e não pode se parecer com um: 422 com o motivo inteiro, para
    // quem pediu entender que precisa da foto do cliente, não tentar de novo com outra palavra.
    if (!r.ok) return json({ ok: false, motivo: r.motivo, recusado: !!r.recusado, termo: r.termo || null }, r.recusado ? 422 : 502);

    return new Response(r.bytes, {
      headers: {
        "content-type": r.tipo || "application/octet-stream",
        "cache-control": "no-store",
        "x-guileo-prompt": encodeURIComponent(r.prompt.slice(0, 300)),
      },
    });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
}
