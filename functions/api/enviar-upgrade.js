// Cloudflare Pages Function — POST /api/enviar-upgrade
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// MANDA o e-mail do Website Upgrade para o dono do negócio. Um caminho só, reusável para todo
// prospect — antes cada envio era montado à mão, e e-mail montado à mão é como nasce HTML ad-hoc
// fora do emailTemplates.js (proibido nesta base).
//
// PORTÃO: `x-guileo-secret` = INGEST_SECRET (servidor-a-servidor). Isto MANDA e-mail para uma
// pessoa real: nunca pode ficar atrás de sameOrigin, que qualquer aba do site satisfaz.
//
// ⚠️ CHECA O RESULTADO DO ENVIO. O Resend responde 4xx em domínio não verificado, endereço ruim e
// rate limit — `r.ok` ignorado já produziu dois "sucessos" invisíveis nesta base. Sem o id do
// e-mail, não houve envio.
import { json, safeEq } from "../lib/guard.js";
import { websiteUpgradeEmail } from "../lib/emailTemplates.js";
import { CONTACT } from "../../src/data/contactData.js";
import { brandFromSite } from "../lib/brandExtract.js";

// Saturação e luminosidade mínimas — só passa cor que alguém escolheria para uma marca.
function corDeMarca(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return false;
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  const sat = mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn);
  return sat >= 0.22 && l >= 0.12 && l <= 0.88;
}

export async function onRequestPost({ request, env }) {
  const ING = (env.INGEST_SECRET || "").toString();
  if (!ING || !safeEq((request.headers.get("x-guileo-secret") || "").toString(), ING)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.RESEND_API_KEY) return json({ ok: false, error: "RESEND_API_KEY ausente" }, 503);

  const b = await request.json().catch(() => ({}));

  // ── STATUS: o e-mail chegou ou voltou? ────────────────────────────────────────────────────────
  // Sem isto, "enviado: true" significa só "o Resend aceitou" — e um endereço inexistente é
  // aceito na hora e rejeitado minutos depois, quando o servidor do destino responde. A diferença
  // entre aceito e ENTREGUE é a diferença entre achar que o prospect não respondeu e saber que
  // ele nunca recebeu. Mesma regra do resto da casa: olhar o resultado, não o envelope.
  if ((b.action || "").toString() === "status") {
    const id = (b.id || "").toString().trim();
    if (!/^[0-9a-f-]{10,}$/i.test(id)) return json({ ok: false, error: "id invalido" }, 400);
    const r = await fetch(`https://api.resend.com/emails/${id}`, { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } });
    const txt = await r.text().catch(() => "");
    if (!r.ok) return json({ ok: false, error: `resend ${r.status}: ${txt.slice(0, 140)}` }, 502);
    let d = {}; try { d = JSON.parse(txt) || {}; } catch { /* */ }
    return json({ ok: true, id, para: d.to, assunto: d.subject, estado: d.last_event || "?", quando: d.created_at || "" });
  }

  const to = (b.to || "").toString().trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(to)) return json({ ok: false, error: "destinatario invalido" }, 400);

  // ── A CARA DO NEGÓCIO DELE, AUTOMÁTICA (24/08) ────────────────────────────────────────────────
  // Antes, `capa` e `logo` eram arquivos que eu convertia à mão — funcionava pro Nonstop e para
  // mais ninguém. O e-mail sem a marca dele vira template, e template é o que o dono descarta em
  // dois segundos. Aqui a logo e a cor saem de `brandFromSite` (leitura de HTML, ZERO modelo) e a
  // capa de /api/capa — os mesmos dois motores que o Growth Report já usa.
  // ⚠️ SÓ JPG/PNG. Gmail e Outlook não renderizam webp nem svg, e um quadrado quebrado no topo é
  // pior que nenhuma imagem. O que não passar no filtro simplesmente não vai — nunca uma foto de
  // banco de imagens no lugar, que seria "um negócio qualquer vendido como o dele".
  const site = (b.site || "").toString().trim();
  if (site && (!b.logo || !b.accent)) {
    try {
      const mk = await brandFromSite(site);
      if (mk && !mk.why) {
        if (!b.logo && mk.logo_url) b.logo = mk.logo_url;
        // ⚠️ BRANCO, PRETO E CINZA NÃO SÃO COR DE MARCA (24/08). A extração devolveu #ffffff para
        // o Nonstop — que é vermelho. Um accent branco não dá erro: ele pinta o filete e o preço
        // de branco e o e-mail fica "sem marca" parecendo que tem. Falha disfarçada de sucesso é
        // a que ninguém procura. Sem saturação suficiente, prefiro o dourado da casa: assumido,
        // não fingido.
        if (!b.accent && mk.accent && corDeMarca(mk.accent)) b.accent = mk.accent;
      }
    } catch { /* marca é enfeite: falhar aqui nunca pode impedir o e-mail */ }
  }
  if (site && !b.capa) {
    try {
      const orig = new URL(request.url).origin;
      const cr = await fetch(`${orig}/api/capa?site=${encodeURIComponent(site)}`);
      if (cr.ok) { const cj = await cr.json().catch(() => null); if (cj && cj.capa) b.capa = cj.capa; }
    } catch { /* idem */ }
  }

  const { subject, html } = websiteUpgradeEmail(b);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    // 🚨 O E-MAIL PEDE RESPOSTA E SAÍA DE UM noreply@ (achado 24/08). O rodapé diz "reply telling
    // us which modules you want" — o dono responde, a resposta cai num buraco, e a gente conclui
    // que o e-mail não converteu. Um convite pra responder num endereço que não escuta é a forma
    // mais silenciosa de perder uma venda: nada falha, nada avisa, só não chega.
    body: JSON.stringify({
      from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>",
      reply_to: (b.reply_to || CONTACT.email || "").toString().trim() || undefined,
      to, subject, html,
    }),
  });
  const corpo = await r.text().catch(() => "");
  if (!r.ok) return json({ ok: false, enviado: false, motivo: `resend ${r.status}: ${corpo.slice(0, 160)}` }, 502);
  let id = ""; try { id = (JSON.parse(corpo) || {}).id || ""; } catch { /* */ }
  // "ok" sem id do que foi criado é promessa sem lastro.
  if (!id) return json({ ok: false, enviado: false, motivo: "resend aceitou sem devolver id" }, 502);
  // Reporta O QUE FOI USADO: "enviado" sem dizer se a marca dele entrou deixaria a gente
  // mandando template sem perceber. Marca ausente tem que aparecer, não sumir.
  return json({ ok: true, enviado: true, id, para: to, assunto: subject,
    marca: { logo: b.logo || "", accent: b.accent || "", capa: b.capa || "" } });
}
