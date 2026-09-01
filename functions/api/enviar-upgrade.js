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
import { websiteUpgradeEmail, achadoEmail } from "../lib/emailTemplates.js";
import { svcRpc } from "../lib/sb.js";
import { CONTACT } from "../../src/data/contactData.js";

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

  /* Duas saídas do motor: o prospect cujo site foi RECONSTRUÍDO recebe o Website Upgrade; o
     prospect cujo site é bom recebe o ACHADO. Forçar o upgrade em quem não precisa é vender
     movimento lateral como melhoria — e o dono percebe. */
  const { subject, html } = (b.tipo === "achado" ? achadoEmail : websiteUpgradeEmail)(b);
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
  /* ── O ENVIO TEM QUE APARECER ONDE O VENDEDOR OLHA (24/08) ────────────────────────────────
     Luis: «onde que eu acesso isso que foi enviado?». Os e-mails saíam, o Resend confirmava, e o
     registro vivia só no terminal — a ficha do lead continuava dizendo que ninguém tinha falado
     com ele. Envio invisível é pior que envio nenhum: o vendedor liga achando que é o primeiro
     contato, ou não liga achando que já mandou.
     O clique de `mailto` na ficha já carimbava a nota (`registraEnvio`); o envio pelo SERVIDOR
     não passava por lá. Agora passa: mesma nota, mesmo lugar, com a data e o id. */
  if (b.registrar && b.registrar.seller && b.registrar.id) {
    try {
      /* 🚨 A NOTA SE APAGAVA (28/08). `sp_upsert` SOBRESCREVE a nota, e este bloco montava o
         texto a partir de `b.registrar.nota` — o que QUEM CHAMA mandou. Chamei com nota:"" e a
         ficha do Three Degrees perdeu o PRONTO:, o link do preview e o link do relatório de uma
         vez: 380 → 168 caracteres. Um "registro" que apaga o histórico é pior que não registrar.
         Agora a nota vem do BANCO (fonte da verdade), não do corpo da requisição, e a linha nova
         só entra se ainda não estiver lá — reenvio no mesmo dia não duplica o carimbo. */
      const quando = new Date().toISOString().slice(0, 10);
      const linha = `✉️ ${quando} — Website Upgrade enviado a ${to} (id ${id.slice(0, 8)})`;
      let atual = "";
      try {
        const r = await svcRpc(env, "sp_get_note", { p_secret: ING, p_id: String(b.registrar.id) });
        if (r && r.ok) atual = ((await r.json().catch(() => "")) || "").toString();
      } catch { /* sem leitura confiável, ver abaixo */ }
      // Fail-closed: se eu não consegui LER a nota atual, não escrevo nada — apagar o histórico
      // do lead é pior do que ficar sem o carimbo, que dá para repor à mão.
      if (atual) {
        if (!atual.includes(linha)) {
          await svcRpc(env, "sp_upsert", {
            p_secret: ING, p_seller_email: String(b.registrar.seller).toLowerCase(),
            p_id: String(b.registrar.id), p_note: atual + "\n" + linha,
          });
        }
      }
    } catch { /* o registro não pode desfazer um envio que já saiu */ }
  }

  return json({ ok: true, enviado: true, id, para: to, assunto: subject,
    marca: { logo: b.logo || "", accent: b.accent || "", capa: b.capa || "" } });
}
