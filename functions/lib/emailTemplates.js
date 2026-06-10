// Branded, email-safe HTML templates for Guileo transactional emails.
// Locked design system: GRAPHITE/burnt-cement dominant · GREEN almost-disappearing (detail only:
// live dot, ✓ checks, plant) · CHAMPAGNE = premium highlight · IVORY text · glassy "HD screen" feel.
// PRIMARY CTA = brushed silver/platinum pill (hero landing button). Table-based + inline CSS for
// client compatibility (Gmail app / Apple Mail / Outlook). Responsive via <head><style> @media.

const B = {
  logo: "https://guileoai.com/favicon.png",
  anim: "https://guileoai.com/email/guileo-header.gif",  // animated header banner (silver sweep)
  site: "https://guileoai.com",
  portal: "https://guileoai.com/portal",
  // graphite / cement surfaces — card lifted a touch lighter than the page for contrast ("tchan")
  bg: "#0c0b09",
  card: "#1a1812",
  panel: "#221f17",
  panel2: "#2a261c",
  line: "#332f25",
  edge: "rgba(255,255,255,0.06)",   // glass top-edge highlight
  // text
  ink: "#f3efe6",        // ivory
  ink2: "#cdc7ba",
  muted: "#8f8a7e",
  faint: "#5f5b51",
  // accents
  gold: "#d8c79b",       // champagne — premium highlight
  goldDim: "#b9a878",
  green: "#5a8f6f",      // muted graphite-green — DETAIL ONLY
};

// SECURITY: HTML-escape any attacker-controllable field (name/business/lead text) before it is
// interpolated into the email HTML or subject — prevents script/markup injection into branded mail.
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Responsive + render-quality rules. Email clients that honor <style> (Apple Mail, Gmail app,
// most modern webmail) get full mobile stacking; the rest fall back to the inline CSS gracefully.
const HEAD_STYLE = `
  <style>
    /* Inter — the site's exact typeface. Honored by Apple Mail & co; Gmail falls back to the
       SF/Segoe stack (closest metrics). This is what makes the lettering match the site. */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    /* base reset */
    body,table,td,a{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    img{ -ms-interpolation-mode:bicubic; }
    a{ text-decoration:none; }
    @media (max-width:600px){
      .g-shell{ padding:22px 12px !important; }
      .g-card{ border-radius:18px !important; }
      .g-pad{ padding-left:22px !important; padding-right:22px !important; }
      .g-pad-head{ padding-left:22px !important; padding-right:22px !important; }
      .g-h1{ font-size:23px !important; line-height:1.24 !important; }
      .g-h1-sm{ font-size:22px !important; }
      .g-intro{ font-size:14.5px !important; }
      /* primary CTA goes full-width + comfortable tap target */
      .g-btn-wrap{ width:100% !important; }
      .g-btn{ display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; padding:16px 18px !important; font-size:15px !important; }
      .g-btn2{ display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
      /* stat row stays in one line but breathes less */
      .g-stat{ padding:12px 2px !important; }
      .g-statnum{ font-size:26px !important; }
      /* lead card meta: let channel wrap under the name instead of overflowing */
      .g-lead-chan{ font-size:10.5px !important; }
    }
    @media (prefers-color-scheme: light){
      /* keep it dark — this is an intentionally dark "screen" */
      body{ background:${B.bg} !important; }
    }
  </style>`;

// Glassy graphite shell — logo header with a soft radial screen-glow, champagne hairline, refined footer.
function shell({ preheader = "", eyebrow = "", body = "" }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">${HEAD_STYLE}</head>
<body style="margin:0;padding:0;background:${B.bg};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${B.bg};font-size:1px;line-height:1px;">${preheader}&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="g-shell" style="background:${B.bg};background-image:radial-gradient(820px 360px at 50% -80px, #18160f 0%, #0e0d0a 52%, ${B.bg} 78%);padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="g-card" style="max-width:600px;width:100%;background:${B.card};background-image:linear-gradient(180deg,#15140f 0%,${B.card} 30%);border:1px solid ${B.line};border-radius:22px;overflow:hidden;box-shadow:0 40px 100px -45px rgba(0,0,0,0.92),0 2px 0 rgba(255,255,255,0.02);">
<!-- glass top edge + champagne hairline (fine inset light lines) -->
<tr><td style="height:1px;background:${B.edge};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="height:2px;background:linear-gradient(90deg,transparent,${B.goldDim} 34%,${B.gold} 50%,${B.goldDim} 66%,transparent);font-size:0;line-height:0;">&nbsp;</td></tr>
<!-- ANIMATED header banner (silver light-sweep + logo + brand) — GIF works in Gmail/Apple/Outlook -->
<tr><td style="font-size:0;line-height:0;background:#100f0b;" align="center">
  <a href="${B.site}" style="text-decoration:none;display:block;"><img src="${B.anim}" width="600" alt="Guileo — AI Systems for Business" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" /></a>
</td></tr>
${eyebrow ? `<tr><td class="g-pad-head" style="padding:20px 40px 0 40px;background:${B.card};" align="center">
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${B.gold};">${eyebrow}</div>
</td></tr>` : ""}
<tr><td class="g-pad" style="padding:14px 40px 36px 40px;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;">${body}</td></tr>
<!-- footer -->
<tr><td class="g-pad" style="padding:22px 40px 30px 40px;border-top:1px solid ${B.line};background:#100f0b;" align="center">
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};line-height:1.85;">
    <span style="color:${B.green};font-size:9px;vertical-align:middle;">●</span>&nbsp; <span style="color:${B.ink2};font-weight:600;">Guileo</span> — AI Systems for Business<br/>
    <a href="${B.site}" style="color:${B.gold};text-decoration:none;">guileoai.com</a>
    <span style="color:${B.faint};">&nbsp;·&nbsp;</span>Work smart. Grow faster. Sleep better.
  </div>
</td></tr>
</table>
<div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;color:${B.faint};margin-top:18px;">You're receiving this because you started with Guileo.</div>
</td></tr>
</table>
</body></html>`;
}

// PRIMARY CTA — brushed SILVER / PLATINUM pill, exactly the hero landing button:
// cool metallic gradient, DARK text, glassy top sheen (inset white highlight), white ring, soft raised shadow.
function cta(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="g-btn-wrap" style="margin:6px auto 0 auto;"><tr>
  <td align="center" style="border-radius:999px;background:linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%);box-shadow:0 16px 42px -12px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.85),inset 0 -1px 0 rgba(0,0,0,0.12),0 0 0 1px rgba(255,255,255,0.35);">
    <a href="${href}" class="g-btn" style="display:inline-block;padding:15px 34px;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;font-weight:800;letter-spacing:.2px;color:#1a1813;text-decoration:none;border-radius:999px;text-shadow:0 1px 0 rgba(255,255,255,0.45);">${label}</a>
  </td></tr></table>`;
}

// SECONDARY accent button — soft champagne/glass pill, smaller. For a second tasteful action.
function cta2(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
  <td align="center" style="border-radius:999px;background:linear-gradient(180deg,rgba(216,199,155,0.16) 0%,rgba(185,168,120,0.10) 100%);border:1px solid rgba(216,199,155,0.40);box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);">
    <a href="${href}" class="g-btn2" style="display:inline-block;padding:11px 24px;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.2px;color:${B.gold};text-decoration:none;border-radius:999px;">${label}</a>
  </td></tr></table>`;
}

// Glassy graphite panel wrapper (card with top light-edge + soft depth gradient).
function panel(inner, pad = "18px 20px") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${B.panel};background-image:linear-gradient(180deg,#1f1d18 0%,${B.panel} 60%);border:1px solid ${B.line};border-radius:16px;box-shadow:inset 0 1px 0 ${B.edge},0 18px 40px -30px rgba(0,0,0,0.8);">
    <tr><td style="padding:${pad};">${inner}</td></tr></table>`;
}


// H1-AS-IMAGE — pixel-perfect site lettering (real Inter 900 + green→champagne gradient) in EVERY
// client incl. Gmail (which strips webfonts). PNGs live in public/email/h1-*.png (@2x, transparent).
// alt = the full headline text (accessibility + images-off fallback). `sub` = the personalized bit.
const H1W = { "welcome-pt":522,"welcome-en":502,"digest-pt":496,"digest-en":370,"proposal-pt":475,"proposal-en":357,"proof-pt":450,"proof-en":520,"reengage-pt":420,"reengage-en":443,"links-pt":371,"links-en":266 };
function h1img(key, lang, alt, sub = "") {
  const k = `${key}-${lang === "pt" ? "pt" : "en"}`;
  return `<img src="${B.site}/email/h1-${k}.png" width="${Math.min(H1W[k] || 460, 520)}" alt="${esc(alt)}" style="display:block;max-width:100%;height:auto;border:0;" />`
    + (sub ? `<div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:800;letter-spacing:.2px;color:${B.gold};margin-top:10px;">${sub}</div>` : "");
}
// 1) WELCOME EMAIL — new business owner just signed up.
export function welcomeEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name); business = esc(business);
  const t = lang === "pt" ? {
    subject: `Bem-vindo à Guileo, ${name} 🌱`,
    pre: `O Gui está configurado para ${business}. Veja como começar.`,
    eyebrow: "Seu sistema de crescimento está no ar",
    h1: `Bem-vindo à Guileo, ${name}`,
    intro: `O Gui — seu sistema de crescimento com IA — já está configurado para <span style="color:${B.ink};font-weight:600;">${business}</span>. A partir de hoje ele atende ligações, captura leads, agenda, faz follow-up e vende — <span style="color:${B.gold};font-weight:700;">o tempo todo</span>, enquanto você toca o negócio.`,
    stepsTitle: "Seus 3 primeiros passos",
    steps: [
      ["Conecte suas ferramentas", "Agenda, WhatsApp, Stripe, seu PDV — o Gui se integra ao que você já usa."],
      ["Deixe o Gui na recepção", "Ele atende toda ligação &amp; mensagem, qualifica cada lead, e não deixa nenhum escapar."],
      ["Veja o crescimento", "Resumos diários chegam no seu email — exatamente o que o Gui recuperou e agendou."],
    ],
    cta: "Abrir meu painel 🚀",
    cta2: "Conectar uma ferramenta 🔌",
    foot: "Dúvidas? É só responder — um humano de verdade lê cada mensagem.",
  } : {
    subject: `Welcome to Guileo, ${name} 🌱`,
    pre: `Gui is set up for ${business}. Here's how to start.`,
    eyebrow: "Your growth system is live",
    h1: `Welcome to Guileo, ${name}`,
    intro: `Gui — your AI growth system — is set up for <span style="color:${B.ink};font-weight:600;">${business}</span>. From today it answers calls, captures leads, books, follows up and sells — <span style="color:${B.gold};font-weight:700;">around the clock</span>, while you run the business.`,
    stepsTitle: "Your first 3 steps",
    steps: [
      ["Connect your tools", "Calendar, WhatsApp, Stripe, your POS — Gui plugs into the stack you already use."],
      ["Let Gui run the front desk", "It answers every call &amp; message, qualifies each lead, and never lets one slip."],
      ["Watch the growth", "Daily summaries land in your inbox — exactly what Gui recovered and booked."],
    ],
    cta: "Open my dashboard 🚀",
    cta2: "Connect a tool 🔌",
    foot: "Questions? Just reply — a real human reads every message.",
  };
  const step = (n, title, desc) => `<tr><td style="padding:9px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="42" valign="top">
        <div style="width:32px;height:32px;border-radius:10px;background:radial-gradient(120% 120% at 50% 0%, #2a2620 0%, ${B.panel2} 100%);border:1px solid ${B.line};box-shadow:inset 0 1px 0 ${B.edge};color:${B.gold};font-weight:800;font-size:13px;text-align:center;line-height:32px;font-family:'Segoe UI',Arial,sans-serif;">${n}</div>
      </td>
      <td valign="top" style="font-family:'Segoe UI',Arial,sans-serif;padding-left:4px;">
        <div style="font-size:15px;font-weight:700;color:${B.ink};letter-spacing:.1px;">${title}</div>
        <div style="font-size:13px;color:${B.muted};line-height:1.65;margin-top:3px;">${desc}</div>
      </td></tr></table></td></tr>`;
  const body = `
  ${h1img("welcome", lang, t.h1, esc(name) + " 🌱")}
  <div class="g-intro" style="font-size:15px;color:${B.ink2};line-height:1.72;margin-top:13px;">${t.intro}</div>
  <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};font-family:'Segoe UI',Arial,sans-serif;margin-bottom:6px;">${t.stepsTitle}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${t.steps.map((s, i) => step(i + 1, s[0], s[1])).join("")}
    </table>`)}
  <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.portal)}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.portal)}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body }) };
}

// 2) DAILY LEAD DIGEST — owner's morning brief of qualified leads.
export function dailyLeadsEmail({ name = "there", dateLabel = "Today", leads = [], lang = "en" } = {}) {
  name = esc(name); dateLabel = esc(dateLabel);
  leads = (Array.isArray(leads) ? leads : []).map((l) => ({ heat: l.heat, name: esc(l.name), channel: esc(l.channel), want: esc(l.want), action: esc(l.action) }));
  const t = lang === "pt" ? {
    eyebrow: "Resumo de leads do dia", h1: "Seus leads", intro1: `Bom dia ${name} — aqui está quem o Gui capturou e qualificou enquanto você estava ocupado.`, intro2: "Nada escapou.",
    sNew: "Novos leads", sHot: "Quentes", sDone: "Respondidos", cta: "Ver todos os leads →", cta2: "Abrir painel 🚀",
    foot: "O Gui já ligou ou respondeu cada um. Você só fecha.", subj: (tt, hh) => `${tt} leads novos hoje — ${hh} quentes · Guileo`, pre: (tt, hh) => `${tt} leads capturados, ${hh} quentes. O Gui respondeu todos.`,
    heat: { hot: "Quente", warm: "Morno", new: "Novo" },
  } : {
    eyebrow: "Daily lead digest", h1: "Your leads", intro1: `Morning ${name} — here's everyone Gui captured and qualified while you were busy.`, intro2: "Nothing slipped.",
    sNew: "New leads", sHot: "Hot", sDone: "Followed up", cta: "See all leads →", cta2: "Open dashboard 🚀",
    foot: "Gui already called or messaged each one back. You just close them.", subj: (tt, hh) => `${tt} new leads today — ${hh} hot · Guileo`, pre: (tt, hh) => `${tt} leads captured, ${hh} hot. Gui followed up with all of them.`,
    heat: { hot: "Hot", warm: "Warm", new: "New" },
  };
  const heat = { hot: { c: "#d98a63", l: t.heat.hot }, warm: { c: B.gold, l: t.heat.warm }, new: { c: "#7fa6ad", l: t.heat.new } };
  const total = leads.length;
  const hot = leads.filter((l) => l.heat === "hot").length;
  const stat = (n, label, color) => `<td align="center" width="33%" class="g-stat" style="padding:14px 4px;">
    <div class="g-statnum" style="font-size:30px;font-weight:800;color:${color};font-family:'Segoe UI',Arial,sans-serif;letter-spacing:-.5px;text-shadow:0 1px 0 rgba(0,0,0,0.4);">${n}</div>
    <div style="font-size:10px;color:${B.muted};text-transform:uppercase;letter-spacing:1.5px;font-family:'Segoe UI',Arial,sans-serif;margin-top:2px;">${label}</div></td>`;
  const leadCard = (l) => {
    const h = heat[l.heat] || heat.new;
    return `<tr><td style="padding:5px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${B.panel};background-image:linear-gradient(180deg,#1f1d18 0%,${B.panel} 65%);border:1px solid ${B.line};border-radius:14px;box-shadow:inset 0 1px 0 ${B.edge},0 16px 36px -30px rgba(0,0,0,0.8);">
        <tr><td style="padding:15px 17px;font-family:'Segoe UI',Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle">
              <span style="font-size:15px;font-weight:700;color:${B.ink};letter-spacing:.1px;">${l.name}</span>
              <span style="display:inline-block;margin-left:9px;font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${h.c};border:1px solid ${h.c}40;background:${h.c}14;border-radius:999px;padding:2px 9px;vertical-align:middle;">${h.l}</span>
            </td>
            <td align="right" valign="middle" class="g-lead-chan" style="font-size:11px;color:${B.muted};white-space:nowrap;">${l.channel}</td>
          </tr></table>
          <div style="font-size:13px;color:${B.ink2};line-height:1.6;margin-top:8px;">${l.want}</div>
          <div style="font-size:12px;color:${B.muted};margin-top:9px;padding-top:9px;border-top:1px solid ${B.line};">
            <span style="color:${B.green};font-weight:700;">✓</span> <span style="color:${B.ink2};">${l.action}</span>
          </div>
        </td></tr>
      </table></td></tr>`;
  };
  const body = `
  ${h1img("digest", lang, `${t.h1} — ${dateLabel}`, esc(dateLabel))}
  <div class="g-intro" style="font-size:14px;color:${B.ink2};line-height:1.65;margin-top:9px;">${t.intro1} <span style="color:${B.ink};">${t.intro2}</span></div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${B.panel};background-image:linear-gradient(180deg,#1f1d18 0%,${B.panel} 60%);border:1px solid ${B.line};border-radius:16px;box-shadow:inset 0 1px 0 ${B.edge},0 18px 40px -30px rgba(0,0,0,0.8);"><tr>
    ${stat(total, t.sNew, B.ink)}
    <td width="1" style="background:${B.line};">&nbsp;</td>
    ${stat(hot, t.sHot, "#d98a63")}
    <td width="1" style="background:${B.line};">&nbsp;</td>
    ${stat("100%", t.sDone, B.gold)}
  </tr></table>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${leads.map(leadCard).join("")}
  </table>
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.portal)}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.portal)}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;"><span style="color:${B.green};">●</span> ${t.foot}</div>`;
  return { subject: t.subj(total, hot), html: shell({ preheader: t.pre(total, hot), eyebrow: t.eyebrow, body }) };
}

// 3) PROPOSAL / SERVICES EMAIL — "what Guileo can do for you": services + ideas + a proposal CTA.
export function proposalEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name); business = esc(business);
  const t = lang === "pt" ? {
    subject: `${name}, o que a Guileo pode fazer por ${business} 🌱`,
    pre: `Atendimento IA, anúncios, conteúdo, site, automação — ideias prontas pra ${business}.`,
    eyebrow: "Proposta · feito pra você",
    h1: `Ideias pra crescer ${business}`,
    intro: `Olá ${name} — a Guileo é o sistema de IA que cuida do <span style="color:${B.ink};font-weight:600;">atendimento, do marketing e do operacional</span> do seu negócio. Aqui está o que a gente faz e algumas ideias pra começar.`,
    servicesTitle: "O que fazemos por você",
    services: [
      ["📞", "Atendimento com IA 24/7", "Nunca perde uma ligação ou lead — atende, qualifica e agenda sozinho."],
      ["💬", "WhatsApp & SMS automático", "Responde, vende e faz follow-up sem você levantar um dedo."],
      ["📣", "Anúncios & marketing", "Tráfego que vira cliente — campanhas gerenciadas pra você."],
      ["🎬", "Vídeo & conteúdo", "Produção que engaja e posiciona sua marca."],
      ["📱", "Gestão de redes sociais", "Presença que cresce no automático, no seu tom."],
      ["🌐", "Site, app & software", "Construímos sob medida, do zero — rápido e bonito."],
      ["🤖", "Automação com IA", "O trabalho repetitivo no piloto automático."],
      ["⭐", "Reviews & reputação", "Mais 5 estrelas, mais confiança, mais vendas."],
    ],
    ideasTitle: "3 ideias pra começar já",
    ideas: [
      "Recuperar ligações perdidas → cada chamada não atendida vira agendamento.",
      "Transformar seguidores em clientes → conteúdo + anúncios que convertem.",
      "Tirar o operacional das suas costas → a IA cuida do repetitivo 24/7.",
    ],
    cta: "Quero minha proposta →",
    cta2: "Ver tudo que fazemos →",
    foot: "Responda este email com o seu negócio — montamos uma proposta sob medida pra você.",
  } : {
    subject: `${name}, what Guileo can do for ${business} 🌱`,
    pre: `AI front desk, ads, content, website, automation — ready ideas for ${business}.`,
    eyebrow: "Proposal · built for you",
    h1: `Ideas to grow ${business}`,
    intro: `Hi ${name} — Guileo is the AI system that runs your <span style="color:${B.ink};font-weight:600;">front desk, marketing and operations</span>. Here's what we do and a few ideas to start with.`,
    servicesTitle: "What we do for you",
    services: [
      ["📞", "24/7 AI front desk", "Never miss a call or lead — answers, qualifies and books on its own."],
      ["💬", "WhatsApp & SMS, automated", "Replies, sells and follows up without you lifting a finger."],
      ["📣", "Ads & marketing", "Traffic that turns into customers — campaigns managed for you."],
      ["🎬", "Video & content", "Production that engages and positions your brand."],
      ["📱", "Social media management", "A presence that grows on autopilot, in your voice."],
      ["🌐", "Website, app & software", "Built bespoke, from scratch — fast and beautiful."],
      ["🤖", "AI automation", "The repetitive work on autopilot."],
      ["⭐", "Reviews & reputation", "More 5-stars, more trust, more sales."],
    ],
    ideasTitle: "3 ideas to start now",
    ideas: [
      "Recover missed calls → every unanswered call becomes a booking.",
      "Turn followers into customers → content + ads that convert.",
      "Get operations off your back → AI handles the repetitive work 24/7.",
    ],
    cta: "Get my proposal →",
    cta2: "See everything we do →",
    foot: "Reply to this email with your business — we'll build a proposal tailored to you.",
  };
  const svc = ([ic, title, desc]) => `<tr><td style="padding:7px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="46" valign="top">
        <div style="width:36px;height:36px;border-radius:10px;background:${B.panel2};border:1px solid ${B.line};box-shadow:inset 0 1px 0 ${B.edge};font-size:18px;text-align:center;line-height:36px;">${ic}</div>
      </td>
      <td valign="top" style="font-family:'Segoe UI',Arial,sans-serif;padding-left:6px;">
        <div style="font-size:14.5px;font-weight:700;color:${B.ink};letter-spacing:.1px;">${title}</div>
        <div style="font-size:12.5px;color:${B.muted};line-height:1.55;margin-top:2px;">${desc}</div>
      </td></tr></table></td></tr>`;
  const idea = (x) => `<tr><td style="padding:5px 0;font-family:'Segoe UI',Arial,sans-serif;font-size:13.5px;color:${B.ink2};line-height:1.55;">
    <span style="color:${B.gold};font-weight:800;">→</span> ${x}</td></tr>`;
  const body = `
  ${h1img("proposal", lang, t.h1, esc(business))}
  <div class="g-intro" style="font-size:15px;color:${B.ink2};line-height:1.72;margin-top:12px;">${t.intro}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};font-family:'Segoe UI',Arial,sans-serif;margin-bottom:8px;">${t.servicesTitle}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${t.services.map(svc).join("")}</table>`)}
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};font-family:'Segoe UI',Arial,sans-serif;margin-bottom:6px;">${t.ideasTitle}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${t.ideas.map(idea).join("")}</table>`)}
  <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.site + "/marketing")}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.site)}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body }) };
}

// 4) PROOF EMAIL (drip day ~2) — "what Gui already does for businesses like yours".
export function proofEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name); business = esc(business);
  const t = lang === "pt" ? {
    subject: `${name}, veja o que o Gui faz por negócios como o seu`,
    pre: `Atende, agenda e fecha 24/7 — enquanto você cuida do resto.`,
    eyebrow: "Prova · resultados reais",
    h1: `O que o Gui já faz, ${name}`,
    intro: `Você não precisa imaginar — é isto que o Gui faz todo dia por negócios como <span style="color:${B.ink};font-weight:600;">${business}</span>:`,
    points: [
      ["📞", "Atende toda ligação", "Mesmo às 21h, fim de semana, feriado — nenhuma chamada vira caixa postal."],
      ["📅", "Agenda sozinho", "Marca, confirma e lembra — a agenda enche sem você."],
      ["💬", "Faz follow-up", "Responde no WhatsApp em segundos e recupera o cliente que ia embora."],
      ["📈", "Vira dado pro marketing", "Cada conversa alimenta os anúncios — você cresce com o que já tem."],
    ],
    stat: "Em pilotos: 0 ligações perdidas · agenda mais cheia · clientes recuperados no automático.",
    cta: "Ver o Gui ao vivo →",
    cta2: "Quero pro meu negócio →",
    foot: "Responda este email — em 10 minutos te mostro funcionando no seu caso.",
  } : {
    subject: `${name}, see what Gui does for businesses like yours`,
    pre: `Answers, books and closes 24/7 — while you handle the rest.`,
    eyebrow: "Proof · real results",
    h1: `What Gui already does, ${name}`,
    intro: `You don't have to imagine it — here's what Gui does every day for businesses like <span style="color:${B.ink};font-weight:600;">${business}</span>:`,
    points: [
      ["📞", "Answers every call", "Even at 9 PM, weekends, holidays — no call goes to voicemail."],
      ["📅", "Books on its own", "Schedules, confirms and reminds — the calendar fills without you."],
      ["💬", "Follows up", "Replies on WhatsApp in seconds and wins back the client who was leaving."],
      ["📈", "Feeds your marketing", "Every conversation fuels the ads — you grow with what you already have."],
    ],
    stat: "In pilots: 0 missed calls · fuller calendar · customers won back on autopilot.",
    cta: "See Gui live →",
    cta2: "I want this for my business →",
    foot: "Reply to this email — in 10 minutes I'll show it working for your case.",
  };
  const pt_ = ([ic, ti, de]) => `<tr><td style="padding:7px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="44" valign="top"><div style="width:34px;height:34px;border-radius:10px;background:${B.panel2};border:1px solid ${B.line};box-shadow:inset 0 1px 0 ${B.edge};font-size:17px;text-align:center;line-height:34px;">${ic}</div></td>
    <td valign="top" style="font-family:'Segoe UI',Arial,sans-serif;padding-left:6px;"><div style="font-size:14px;font-weight:700;color:${B.ink};">${ti}</div><div style="font-size:12.5px;color:${B.muted};line-height:1.55;margin-top:2px;">${de}</div></td></tr></table></td></tr>`;
  const body = `
  ${h1img("proof", lang, t.h1, esc(name) + " 🌱")}
  <div class="g-intro" style="font-size:15px;color:${B.ink2};line-height:1.7;margin-top:12px;">${t.intro}</div>
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${t.points.map(pt_).join("")}</table>`)}
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div style="font-size:13px;color:${B.gold};text-align:center;font-family:'Segoe UI',Arial,sans-serif;font-weight:600;">${t.stat}</div>
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.site + "/#try")}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.site + "/marketing")}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body }) };
}

// 5) RE-ENGAGE EMAIL (drip day ~7) — bring a cold lead back to the quiz.
export function reengageEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name); business = esc(business);
  const t = lang === "pt" ? {
    subject: `${name}, seu AI Growth Score está te esperando`,
    pre: `60 segundos pra ver quanto ${business} está deixando na mesa.`,
    eyebrow: "Última chamada · grátis",
    h1: `Ainda dá tempo, ${name}`,
    intro: `Em <span style="color:${B.ink};font-weight:600;">60 segundos</span> você descobre exatamente quanto ${business} está perdendo por mês com ligações e leads que escapam — e o plano pra resolver. De graça, sem compromisso.`,
    cta: "Fazer meu Growth Score →",
    cta2: "Falar com um humano →",
    foot: "Se não for a hora, sem problema — respondo qualquer dúvida por aqui.",
  } : {
    subject: `${name}, your AI Growth Score is waiting`,
    pre: `60 seconds to see what ${business} is leaving on the table.`,
    eyebrow: "Last call · free",
    h1: `There's still time, ${name}`,
    intro: `In <span style="color:${B.ink};font-weight:600;">60 seconds</span> you'll see exactly how much ${business} loses each month to missed calls and slipping leads — and the plan to fix it. Free, no strings.`,
    cta: "Get my Growth Score →",
    cta2: "Talk to a human →",
    foot: "If now's not the time, no worries — reply here with any question.",
  };
  const body = `
  ${h1img("reengage", lang, t.h1, esc(name))}
  <div class="g-intro" style="font-size:15px;color:${B.ink2};line-height:1.72;margin-top:13px;">${t.intro}</div>
  <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.site + "/quiz")}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.site + "/#try")}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body }) };
}

// 6) LINKS HUB — branded "all your links" email for Luis / partners (the V1 screen feel).
export function linksEmail({ name = "Luis", lang = "pt" } = {}) {
  const pt = lang === "pt";
  const row = (href, icon, label, sub) => `
    <tr><td style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <a href="${href}" style="text-decoration:none;display:block;">
        <span style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:${B.ink};">${icon}&nbsp; ${esc(label)}</span>
        <span style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:11.5px;color:${B.muted};">&nbsp;·&nbsp;${esc(sub)}</span>
      </a>
    </td></tr>`;
  const group = (title, rows) => panel(`
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${B.gold};padding-bottom:6px;">${title}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`);
  const body = `
    ${h1img("links", lang, pt ? `Seus acessos, ${name}` : `Your links, ${name}`, esc(name) + " 🌱")}
    <p class="g-intro" style="margin:0 0 18px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${B.ink2};">${pt ? "Tudo no ar em <b style='color:" + B.ink + "'>guileoai.com</b> — salve este e-mail." : "Everything live on <b style='color:" + B.ink + "'>guileoai.com</b> — keep this email handy."}</p>
    ${group(pt ? "🌐 Vender" : "🌐 Sell", [
      row(`${B.site}/pitch`, "🎤", pt ? "Pitch do cliente" : "Client pitch", pt ? "apresentação ≤20min" : "≤20-min deck"),
      row(`${B.site}/proposta?to=Cliente&price=1497&recover=3900`, "📄", pt ? "Proposta" : "Proposal", pt ? "personalizada por link" : "URL-personalized"),
      row(`${B.site}/parceiro`, "🤝", "Growth Partner", pt ? "deck de recrutamento" : "recruiting deck"),
    ].join(""))}
    <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
    ${group(pt ? "🧲 Captar" : "🧲 Capture", [
      row(`${B.site}/quiz`, "🎯", "AI Growth Score", pt ? "quiz que vira lead" : "lead-gen quiz"),
      row(`${B.site}/calculator`, "🧮", pt ? "Calculadora" : "Calculator", pt ? "receita perdida/mês" : "missed revenue/mo"),
      row(`${B.site}/partners`, "📈", pt ? "Parceiros" : "Partners", pt ? "ganhos do revendedor" : "reseller earnings"),
    ].join(""))}
    <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
    ${group(pt ? "🔒 Operar (você)" : "🔒 Operate (you)", [
      row(`${B.site}/admin`, "🛠️", "Admin", pt ? "comando central · leads" : "command center · leads"),
      row(`${B.portal}`, "📊", "Growth Cockpit", pt ? "o produto do cliente" : "the client product"),
      row(`${B.site}/admin/contratos`, "📜", pt ? "Contratos" : "Contracts", pt ? "10 modelos + cláusulas" : "10 models + clauses"),
      row(`${B.site}/live`, "🟢", pt ? "Ao vivo" : "Live", pt ? "atividade da Gui" : "Gui activity"),
    ].join(""))}
    <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
    ${cta(pt ? "Abrir o site →" : "Open the site →", B.site)}
    <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
    ${cta2(pt ? "📊 Growth Cockpit" : "📊 Growth Cockpit", B.portal)}`;
  return {
    subject: pt ? `🌱 Guileo — seus acessos (site, pitch, proposta, admin)` : `🌱 Guileo — your links`,
    html: shell({ preheader: pt ? "Todos os seus links Guileo, num lugar só." : "All your Guileo links in one place.", body }),
  };
}

// 7) PARTNER ONBOARDING — the complete starter package for a new collaborator.
// Everything to start & understand: the sentence, the 3 tools, earnings, first 7 days.
export function partnerOnboardEmail({ name = "parceiro(a)" } = {}) {
  const row = (ic, ttl, sub, href) => `
    <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <a href="${href}" style="text-decoration:none;display:block;">
        <span style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;font-weight:800;color:${B.ink};">${ic}&nbsp; ${ttl}</span><br/>
        <span style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};">${sub} &nbsp;<span style="color:${B.gold};font-weight:800;">abrir →</span></span>
      </a>
    </td></tr>`;
  const day = (d, w) => `
    <tr><td style="padding:6px 0;">
      <span style="display:inline-block;min-width:54px;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:900;letter-spacing:1px;color:${B.gold};text-transform:uppercase;">${d}</span>
      <span style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:${B.ink};">${w}</span>
      <span style="float:right;color:${B.green};font-weight:800;">✓</span>
    </td></tr>`;
  const body = `
  <img src="${B.site}/email/h1-team-pt.png" width="503" alt="Bem-vindo ao time" style="display:block;max-width:100%;height:auto;border:0;" />
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:800;letter-spacing:.2px;color:${B.gold};margin-top:10px;">${esc(name)} 🌱</div>
  <div class="g-intro" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;color:${B.ink2};line-height:1.72;margin-top:14px;">
    Você agora é um <b style="color:${B.ink}">Growth Partner da Guileo</b>. Este e-mail tem TUDO pra você começar — salve ele.
  </div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:${B.gold};padding-bottom:8px;">O que a gente vende — em uma frase</div>
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.6;color:${B.ink};">“A Guileo instala um time de IA + marketing que atende, vende e faz crescer o negócio do cliente sozinho, 24/7 — ele escolhe o resultado, a gente entrega.”</div>`)}
  <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:${B.gold};padding-bottom:4px;">🧰 Suas 3 ferramentas</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row("🎓", "Partner Academy", "o treinamento completo: catálogo, como vender, treino com a Gui, prova e certificado (1 dia)", `${B.site}/academia`)}
      ${row("📱", "Cola de bolso", "abre no celular 2 min antes de cada reunião — perguntas, objeções, roteiro", `${B.site}/cola`)}
      ${row("🎤", "Pitch do cliente", "a apresentação de 20 min que você mostra na reunião (navega com as setas)", `${B.site}/pitch`)}
    </table>`)}
  <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:${B.gold};padding-bottom:8px;">💰 Quanto você ganha</div>
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.8;color:${B.ink2};">
      <b style="color:${B.ink}">Nível 1 · Agendador:</b> você marca a demo, o Luis fecha com você — <b style="color:${B.green}">10% por venda</b><br/>
      <b style="color:${B.ink}">Nível 2 · Closer:</b> você conduz tudo — <b style="color:${B.green}">20% por venda</b><br/>
      <span style="color:${B.muted};font-size:12.5px;">Pacote típico ($990 + 3×$1.497) → <b style="color:${B.gold}">~$1.096 por venda fechada</b>. Sem teto.</span>
    </div>`)}
  <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:${B.gold};padding-bottom:6px;">🗓️ Seus primeiros 7 dias</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${day("Dia 1", "Complete o Academy + passe no treino da Gui")}
      ${day("Dia 1", "Liste 5 donos de negócio da sua rede")}
      ${day("Dia 2", "Mande a primeira mensagem pros 5")}
      ${day("Dia 3-4", "Agende 2 demos (“a IA te liga na hora”)")}
      ${day("Dia 5-7", "Demos com o Luis · primeira comissão a caminho")}
    </table>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  ${cta("🎓 Começar o Academy agora →", `${B.site}/academia`)}
  <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
  ${cta2("💬 Falar com o Luis", "https://wa.me/19295350191?text=" + encodeURIComponent("Oi Luis! Recebi o pacote do Growth Partner e tô começando o Academy."))}`;
  return { subject: `🌱 Bem-vindo ao time, ${name} — seu pacote completo de Growth Partner`, html: shell({ preheader: "Tudo pra você começar: Academy, ferramentas, quanto ganha e o plano dos 7 dias.", body }) };
}

// 8) CLIENT INTRO — the first-touch email a partner (or Luis) sends a prospect.
export function clientIntroEmail({ name = "tudo bem?", business = "seu negócio", from = "Luis" } = {}) {
  const body = `
  <img src="${B.site}/email/h1-client-pt.png" width="552" alt="Isso muda o seu mês" style="display:block;max-width:100%;height:auto;border:0;" />
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:800;letter-spacing:.2px;color:${B.gold};margin-top:10px;">${esc(name)} 👋</div>
  <div class="g-intro" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;color:${B.ink2};line-height:1.72;margin-top:14px;">
    A Guileo instala um time de IA + marketing que <b style="color:${B.ink}">atende, vende e faz crescer ${esc(business)} sozinho, 24/7</b>. Você escolhe o resultado — a gente entrega.
  </div>
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:${B.gold};padding-bottom:8px;">Na prática, a Gui (nossa IA):</div>
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:2;color:${B.ink2};">
      📞 Atende <b style="color:${B.ink}">toda</b> ligação e mensagem — qualquer idioma, qualquer hora<br/>
      📅 Agenda, qualifica e <b style="color:${B.ink}">fecha vendas</b><br/>
      🔁 Faz follow-up de quem sumiu<br/>
      📣 E ainda toca seu marketing
    </div>`)}
  <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.8;color:${B.ink2};text-align:center;">
      🌱 No ar em <b style="color:${B.green}">7 dias</b> &nbsp;·&nbsp; 🛡️ Garantia de <b style="color:${B.gold}">30 dias</b> &nbsp;·&nbsp; 🤝 Humano supervisionando
    </div>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:${B.ink};text-align:center;">Quer ver funcionando? <span style="color:${B.gold};">A Gui pode te ligar agora.</span></div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  ${cta("📞 Quero ouvir a Gui — agendar demo →", "https://cal.com/guileo")}
  <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
  ${cta2("🌐 Conhecer a Guileo", B.site)}
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;">Abraço, ${esc(from)} · Guileo</div>`;
  return { subject: `${name}, isso aqui pode mudar o seu mês 🌱`, html: shell({ preheader: "A IA que atende, vende e cresce o seu negócio 24/7 — no ar em 7 dias.", body }) };
}
