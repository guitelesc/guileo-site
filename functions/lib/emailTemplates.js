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
  // EXACT dashboard ("Growth Cockpit") design tokens — burnt-cement charcoal so the email is the
  // same world as the platform (tailwind g-cream/creamd/line/word/gold/copper/green).
  bg: "#0e0d0b",         // outer stage — a touch darker than the card
  card: "#161512",       // g-cream — burnt-cement charcoal (the dashboard surface)
  panel: "#1c1a16",      // g-creamd — lifted cement card
  panel2: "#221f18",
  line: "#2b2720",       // g-line — warm concrete border
  edge: "rgba(237,231,220,0.06)",   // warm glass top-edge highlight
  // text — dashboard warm-ivory family, kept BRIGHTER than the dashboard's body #C5BEB0 so it
  // survives Gmail dark-mode (that greige reads fine on a website but gets crushed in mail clients).
  ink: "#f4f1ea",        // body + emphasis — bright warm ivory
  ink2: "#ede7dc",       // g-word — warm-ivory headings
  muted: "#9c9485",      // secondary — warm greige (footnotes, labels)
  faint: "#6a655b",
  // accents (dashboard)
  gold: "#d6c29a",       // g-gold — champagne
  goldDim: "#c2a878",    // g-copper
  green: "#3e9468",      // g-green — the dashboard's money/positive green
};

// SECURITY: HTML-escape any attacker-controllable field (name/business/lead text) before it is
// interpolated into the email HTML or subject — prevents script/markup injection into branded mail.
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 1-tap action: the relationship CTAs open the customer's mail composer pre-addressed to the BUSINESS
// (bizEmail) with a ready message — so a customer can act in one tap. Falls back to the site if the
// business email isn't known. Pre-written messages per action × language.
const MB = {
  recall: { pt: "Oi! Quero agendar meu retorno essa semana.\n\nNome: \nMelhor horário: ", es: "¡Hola! Quiero agendar mi regreso esta semana.\n\nNombre: \nMejor horario: ", en: "Hi! I'd like to book my return visit this week.\n\nName: \nBest time: " },
  rebook: { pt: "Oi! Quero remarcar meu horário.\n\nNome: \nDias/horários bons pra mim: ", es: "¡Hola! Quiero reprogramar mi cita.\n\nNombre: \nDías/horarios que me sirven: ", en: "Hi! I'd like to reschedule.\n\nName: \nDays/times that work for me: " },
  remind: { pt: "Oi! Sobre meu horário — quero confirmar ou remarcar.\n\nNome: ", es: "¡Hola! Sobre mi cita — quiero confirmar o reprogramar.\n\nNombre: ", en: "Hi! About my appointment — I'd like to confirm or reschedule.\n\nName: " },
};
const bizMailto = (bizEmail, subject, bodyText) => bizEmail ? `mailto:${bizEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}` : "https://guileoai.com";

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
      .g-intro{ font-size:16px !important; line-height:1.7 !important; }
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
function shell({ preheader = "", eyebrow = "", body = "", lang = "en" }) {
  // FOOTER copy localized → the whole email reads in ONE language (no PT body + EN footer mix).
  // "Guileo" + "Growth Intelligence Solutions" stay (brand/company names, not translated).
  const F = {
    pt: { desc: "Sistemas de IA para Negócios", tag: "Trabalhe com inteligência. Cresça mais rápido. Durma melhor.", recv: "Você recebe este email porque começou com a Guileo." },
    es: { desc: "Sistemas de IA para Negocios", tag: "Trabaje con inteligencia. Crezca más rápido. Duerma mejor.", recv: "Recibe este correo porque comenzó con Guileo." },
    en: { desc: "AI Systems for Business", tag: "Work smart. Grow faster. Sleep better.", recv: "You're receiving this because you started with Guileo." },
  };
  const f = F[lang] || F.en;
  const htmlLang = lang === "pt" ? "pt-BR" : lang === "es" ? "es" : "en";
  // UNIFORM dark surfaces (one tone everywhere) → if Gmail dark-mode inverts, it inverts CONSISTENTLY,
  // so the text always stays readable (the old mix of darker header/footer + lighter card was what made
  // Gmail crush the body text while turning the bands cream).
  return `<!doctype html><html lang="${htmlLang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">${HEAD_STYLE}</head>
<body style="margin:0;padding:0;background:${B.bg};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${B.bg};font-size:1px;line-height:1px;">${preheader}&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="g-shell" style="background:${B.bg};padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="g-card" style="max-width:600px;width:100%;background:${B.card};border:1px solid ${B.line};border-radius:22px;overflow:hidden;box-shadow:0 40px 100px -45px rgba(0,0,0,0.92),0 2px 0 rgba(255,255,255,0.02);">
<!-- glass top edge + champagne hairline (fine inset light lines) -->
<tr><td style="height:1px;background:${B.edge};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="height:2px;background:linear-gradient(90deg,transparent,${B.goldDim} 34%,${B.gold} 50%,${B.goldDim} 66%,transparent);font-size:0;line-height:0;">&nbsp;</td></tr>
<!-- HEADER — EN keeps the animated banner; PT/ES get a clean header (sprout + Guileo + localized
     tagline) so the email stays 100% in one language. -->
${lang === "en" ? `<tr><td style="font-size:0;line-height:0;background:${B.card};" align="center">
  <a href="${B.site}" style="text-decoration:none;display:block;"><img src="${B.anim}" width="600" alt="Guileo" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" /></a>
</td></tr>` : `<tr><td style="padding:26px 40px 4px 40px;background:${B.card};" align="center">
  <a href="${B.site}" style="text-decoration:none;display:inline-block;">
    <img src="${B.logo}" width="34" height="34" alt="" style="display:inline-block;vertical-align:middle;border:0;border-radius:9px;" />
    <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:23px;font-weight:800;letter-spacing:-.3px;color:${B.ink2};">Guileo</span>
  </a>
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${B.goldDim};margin-top:7px;">${f.desc}</div>
</td></tr>`}
${eyebrow ? `<tr><td class="g-pad-head" style="padding:20px 40px 0 40px;background:${B.card};" align="center">
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${B.gold};">${eyebrow}</div>
</td></tr>` : ""}
<tr><td class="g-pad" style="padding:14px 40px 36px 40px;background:${B.card};font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;">${body}</td></tr>
<!-- footer (same dark tone as the card — uniform surface) -->
<tr><td class="g-pad" style="padding:22px 40px 30px 40px;border-top:1px solid ${B.line};background:${B.card};" align="center">
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};line-height:1.85;">
    <span style="color:${B.green};font-size:9px;vertical-align:middle;">●</span>&nbsp; <span style="color:${B.ink2};font-weight:600;">Guileo</span> — ${f.desc}<br/>
    <div style="font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${B.goldDim};margin:5px 0 7px;">Growth Intelligence Solutions</div>
    <a href="${B.site}" style="color:${B.gold};text-decoration:none;">guileoai.com</a>
    <span style="color:${B.faint};">&nbsp;·&nbsp;</span>${f.tag}
  </div>
</td></tr>
</table>
<div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;color:${B.faint};margin-top:18px;">${f.recv}</div>
</td></tr>
</table>
</body></html>`;
}

// PRIMARY CTA — GUI ORANGE pill (#FF8A33), the brand's signal color: warm gradient with depth,
// white text, glassy top sheen + soft orange glow. The single "act now" button across all emails.
function cta(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="g-btn-wrap" style="margin:6px auto 0 auto;"><tr>
  <td align="center" style="border-radius:999px;background:linear-gradient(180deg,#ff9d4d 0%,#ff8a33 52%,#f2731a 100%);box-shadow:0 16px 40px -12px rgba(255,138,51,0.55),inset 0 1px 0 rgba(255,255,255,0.38),inset 0 -1px 0 rgba(120,50,0,0.22),0 0 0 1px rgba(255,138,51,0.45);">
    <a href="${href}" class="g-btn" style="display:inline-block;padding:15px 34px;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;font-weight:800;letter-spacing:.2px;color:#ffffff;text-decoration:none;border-radius:999px;text-shadow:0 1px 1px rgba(120,50,0,0.4);">${label}</a>
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
  // The headline PNGs only exist in PT/EN. For any other language (ES today), render a real
  // styled <h1> from the localized alt text instead of showing an English image in a Spanish
  // email. `alt` is built from already-escaped inputs by every caller — safe to inline.
  if (lang !== "pt" && lang !== "en") {
    return `<h1 style="margin:4px 0 0 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:25px;line-height:1.18;font-weight:900;color:${B.ink};letter-spacing:-0.5px;">${alt}</h1>`;
  }
  const k = `${key}-${lang === "pt" ? "pt" : "en"}`;
  return `<img src="${B.site}/email/h1-${k}.png" width="${Math.min(H1W[k] || 460, 520)}" alt="${esc(alt)}" style="display:block;max-width:100%;height:auto;border:0;" />`
    + (sub ? `<div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:800;letter-spacing:.2px;color:${B.gold};margin-top:10px;">${sub}</div>` : "");
}
// 0) LEAD RECEIVED — instant reply to the PROSPECT the moment they submit a form on the site.
// Speed-to-lead: be the first touch. If Gui is also calling them now (callNow), the copy says so.
export function leadReceivedEmail({ name = "there", business = "", lang = "en", callNow = false, leak = "", industry = "" } = {}) {
  const rawName = String(name == null ? "" : name).slice(0, 120); // plain-text subject (no HTML escaping)
  name = esc(rawName); business = esc(business);
  const biz = business ? ` <span style="color:${B.ink};font-weight:600;">${business}</span>` : "";
  // #3 mirror their case: if the calculator/quiz captured a monthly leak, reflect it back (specificity converts).
  const leakDigits = String(leak == null ? "" : leak).replace(/[^0-9]/g, "");
  const leakLabel = leakDigits ? `$${Number(leakDigits).toLocaleString("en-US")}` : "";
  const T = {
    pt: {
      subject: callNow ? `${rawName}, o Gui está na linha para você 📞` : `Recebido, ${rawName} — deixa comigo 🌱`,
      pre: callNow ? "É o Gui, seu concierge de voz, ligando agora. Atenda quando puder." : "Deixa comigo. Manhã ou tarde fica melhor pra falar?",
      eyebrow: "Guileo · ao seu dispor",
      h1: callNow ? `O Gui está te ligando, ${name} 📞` : `Recebido, ${name} 🌱`,
      intro: callNow
        ? `O <b style="color:${B.gold};">Gui</b>, seu concierge de voz, está ligando <b>agora mesmo</b>. Atenda quando for cômodo — com prazer ele mostra, ao vivo, tudo o que cuida para você${biz}.`
        : `Recebemos seu interesse${biz} — já anotei tudo e estou cuidando do seu pacote sob medida. Deixa comigo.`,
      hook: leakLabel ? `Pelo seu diagnóstico, você pode estar deixando <b style="color:${B.gold};">~${leakLabel}/mês</b> na mesa em ligações e leads que escapam. É exatamente isso que o Gui recupera.` : "",
      p2: "Pra adiantar: prefere falar de <b>manhã ou à tarde</b>? Me responde aqui que eu reservo o melhor horário pra você.",
      boxHint: "✏️ Responder: manhã ou tarde?",
      cta: "Responder agora →",
      mailSubject: "Quero adiantar — Guileo",
      mailBody: "Oi! Quero adiantar. Pode falar comigo de [ manhã / tarde ].\n\nMeu negócio: \nO que eu preciso: \n\nObrigado!",
      ps: "P.S. Sem compromisso algum — se não fizer sentido pra você, eu mesmo te falo. E todo trabalho tem garantia: resultado, ou seu dinheiro de volta em 30 dias.",
      foot: "Pode responder este email à vontade — quem lê é gente de verdade, não um robô.",
    },
    es: {
      subject: callNow ? `${rawName}, Gui está en la línea para usted 📞` : `Recibido, ${rawName} — déjelo en mis manos 🌱`,
      pre: callNow ? "Es Gui, su concierge de voz, llamando ahora. Conteste cuando guste." : "Déjelo en mis manos. ¿Mañana o tarde para hablar?",
      eyebrow: "Guileo · a su disposición",
      h1: callNow ? `Gui le está llamando, ${name} 📞` : `Recibido, ${name} 🌱`,
      intro: callNow
        ? `<b style="color:${B.gold};">Gui</b>, su concierge de voz, le está llamando <b>ahora mismo</b>. Conteste cuando le resulte cómodo — con gusto le muestra, en vivo, todo lo que atiende por usted${biz}.`
        : `Recibimos su interés${biz} — ya lo anoté todo y estoy preparando su paquete a medida. Déjelo en mis manos.`,
      hook: leakLabel ? `Según su diagnóstico, podría estar dejando <b style="color:${B.gold};">~${leakLabel}/mes</b> sobre la mesa en llamadas y leads que se escapan. Justo lo que Gui recupera.` : "",
      p2: "Para adelantar: ¿prefiere hablar por la <b>mañana o por la tarde</b>? Respóndame aquí y reservo el mejor horario para usted.",
      boxHint: "✏️ Responder: ¿mañana o tarde?",
      cta: "Responder ahora →",
      mailSubject: "Quiero adelantar — Guileo",
      mailBody: "¡Hola! Quiero adelantar. Puede hablar conmigo por la [ mañana / tarde ].\n\nMi negocio: \nLo que necesito: \n\n¡Gracias!",
      ps: "P.D. Sin compromiso alguno — si no le hace sentido, yo mismo se lo digo. Y todo trabajo tiene garantía: resultado, o le devolvemos su dinero en 30 días.",
      foot: "Puede responder este correo cuando quiera — quien lee es una persona de verdad, no un robot.",
    },
    en: {
      subject: callNow ? `${rawName}, Gui is on the line for you 📞` : `Received, ${rawName} — consider it handled 🌱`,
      pre: callNow ? "It's Gui, your voice concierge, calling now. Answer whenever suits you." : "Consider it handled. Mornings or afternoons to talk?",
      eyebrow: "Guileo · at your service",
      h1: callNow ? `Gui is calling you, ${name} 📞` : `Received, ${name} 🌱`,
      intro: callNow
        ? `<b style="color:${B.gold};">Gui</b>, your voice concierge, is calling you <b>right now</b>. Pick up whenever it suits you — with pleasure, it'll show you live everything it quietly handles for you${biz}.`
        : `We've received your interest${biz} — I've noted everything and I'm preparing your tailored package. Consider it handled.`,
      hook: leakLabel ? `By your diagnostic, you may be leaving <b style="color:${B.gold};">~${leakLabel}/mo</b> on the table in missed calls and fading leads. That's exactly what Gui recovers.` : "",
      p2: "To move sooner: would <b>mornings or afternoons</b> suit you best? Reply here and I'll hold the best time for you.",
      boxHint: "✏️ Reply: mornings or afternoons?",
      cta: "Reply now →",
      mailSubject: "I'd like to move sooner — Guileo",
      mailBody: "Hi! I'd like to move sooner. You can reach me in the [ morning / afternoon ].\n\nMy business: \nWhat I need: \n\nThanks!",
      ps: "P.S. No obligation at all — if it's not a fit, I'll tell you myself. And every engagement is guaranteed: results, or your money back in 30 days.",
      foot: "Reply to this email anytime — a real person reads it, not a robot.",
    },
  };
  const t = T[lang] || T.en;
  // The box + button are a one-tap reply: open the prospect's mail composer pre-filled (real in-email
  // typing isn't possible in mail clients). Replies land in the monitored owner inbox — and every reply
  // also trains Gmail to inbox our future mail, so engineering the reply is a deliverability lever too.
  const mailto = `mailto:smart@guileoai.com?subject=${encodeURIComponent(t.mailSubject)}&body=${encodeURIComponent(t.mailBody)}`;
  const body = `
    <h1 style="margin:6px 0 12px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;line-height:1.15;font-weight:900;color:${B.ink};letter-spacing:-0.5px;">${t.h1}</h1>
    <p style="margin:0 0 14px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:${B.ink};">${t.intro}</p>
    ${t.hook ? `<p style="margin:0 0 16px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.65;color:${B.ink2};">${t.hook}</p>` : ""}
    <a href="${mailto}" style="text-decoration:none;display:block;">${panel(`
      <p style="margin:0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:${B.ink};">${t.p2}</p>
      <div style="margin-top:11px;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12.5px;font-weight:700;letter-spacing:.2px;color:#ff8a33;">${t.boxHint}</div>
    `)}</a>
    <div style="height:18px;font-size:0;line-height:0;">&nbsp;</div>
    ${cta(t.cta, mailto)}
    <div style="height:16px;font-size:0;line-height:0;">&nbsp;</div>
    <p style="margin:0 0 10px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:${B.ink2};">${t.ps}</p>
    <p style="margin:0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${B.muted};">${t.foot}</p>
  `;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// 1) WELCOME EMAIL — new business owner just signed up.
export function welcomeEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name); business = esc(business);
  const t = lang === "pt" ? {
    subject: `Seja bem-vindo à Guileo, ${name} 🌱`,
    pre: `O Gui já está a postos para ${business}. Permita-nos mostrar o caminho.`,
    eyebrow: "Tudo pronto para você",
    h1: `Seja bem-vindo à Guileo, ${name}`,
    intro: `O Gui — seu concierge de crescimento com IA — já está a postos para <span style="color:${B.ink};font-weight:600;">${business}</span>. A partir de hoje, ele atende ligações, acolhe seus leads, agenda, faz follow-up e vende — <span style="color:${B.gold};font-weight:700;">a qualquer hora</span>, enquanto você cuida do que importa.`,
    stepsTitle: "Três passos para começarmos",
    steps: [
      ["Conecte suas ferramentas", "Agenda, WhatsApp, Stripe, seu PDV — o Gui se integra com discrição ao que você já usa."],
      ["Deixe a recepção com o Gui", "Ele acolhe cada ligação &amp; mensagem, qualifica todo lead e não deixa nenhum passar."],
      ["Descanse e acompanhe", "Resumos diários chegam ao seu email — exatamente o que o Gui recuperou e agendou para você."],
    ],
    cta: "Abrir meu painel 🚀",
    cta2: "Conectar uma ferramenta 🔌",
    foot: "Qualquer coisa, é só chamar — alguém de verdade lê cada mensagem com atenção.",
  } : lang === "es" ? {
    subject: `Bienvenido a Guileo, ${name} 🌱`,
    pre: `Gui ya está en su puesto para ${business}. Permítanos mostrarle el camino.`,
    eyebrow: "Todo listo para usted",
    h1: `Bienvenido a Guileo, ${name}`,
    intro: `Gui — su concierge de crecimiento con IA — ya está en su puesto para <span style="color:${B.ink};font-weight:600;">${business}</span>. Desde hoy contesta llamadas, recibe a sus leads, agenda, hace seguimiento y vende — <span style="color:${B.gold};font-weight:700;">a toda hora</span>, mientras usted se ocupa de lo importante.`,
    stepsTitle: "Tres pasos para comenzar",
    steps: [
      ["Conecte sus herramientas", "Calendario, WhatsApp, Stripe, su punto de venta — Gui se integra con discreción a lo que ya usa."],
      ["Deje la recepción con Gui", "Recibe cada llamada &amp; mensaje, califica cada lead y no deja escapar ninguno."],
      ["Descanse y siga el pulso", "Resúmenes diarios llegan a su correo — exactamente lo que Gui recuperó y agendó por usted."],
    ],
    cta: "Abrir mi panel 🚀",
    cta2: "Conectar una herramienta 🔌",
    foot: "Para lo que necesite, solo responda — una persona de verdad lee cada mensaje con atención.",
  } : {
    subject: `Welcome to Guileo, ${name} 🌱`,
    pre: `Gui is already in place for ${business}. Allow us to show you the way.`,
    eyebrow: "Everything is ready for you",
    h1: `Welcome to Guileo, ${name}`,
    intro: `Gui — your AI growth concierge — is in place for <span style="color:${B.ink};font-weight:600;">${business}</span>. From today it answers calls, welcomes your leads, books, follows up and sells — <span style="color:${B.gold};font-weight:700;">around the clock</span>, while you tend to what matters.`,
    stepsTitle: "Three steps to begin",
    steps: [
      ["Connect your tools", "Calendar, WhatsApp, Stripe, your POS — Gui quietly weaves into the stack you already use."],
      ["Leave the front desk to Gui", "It welcomes every call &amp; message, qualifies each lead, and lets none slip away."],
      ["Rest and follow along", "Daily summaries arrive in your inbox — precisely what Gui recovered and booked for you."],
    ],
    cta: "Open my dashboard 🚀",
    cta2: "Connect a tool 🔌",
    foot: "Whenever you need anything, simply reply — a real person reads every message with care.",
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
  <div class="g-intro" style="font-size:16px;color:${B.ink2};line-height:1.72;margin-top:13px;">${t.intro}</div>
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
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// 2) DAILY LEAD DIGEST — owner's morning brief of qualified leads.
export function dailyLeadsEmail({ name = "there", dateLabel = "Today", leads = [], lang = "en" } = {}) {
  name = esc(name); dateLabel = esc(dateLabel);
  leads = (Array.isArray(leads) ? leads : []).map((l) => ({ heat: l.heat, name: esc(l.name), channel: esc(l.channel), want: esc(l.want), action: esc(l.action) }));
  const t = lang === "pt" ? {
    eyebrow: "Seu resumo do dia", h1: "Seus leads", intro1: `Bom dia, ${name} — aqui está quem o Gui acolheu e qualificou enquanto você cuidava do resto.`, intro2: "Cuidei de cada um.",
    sNew: "Novos leads", sHot: "Quentes", sDone: "Atendidos", cta: "Ver todos os leads →", cta2: "Abrir painel 🚀",
    foot: "O Gui já retornou a cada um. A você cabe apenas o prazer de fechar.", subj: (tt, hh) => `${tt} novos leads hoje — ${hh} quentes · Guileo`, pre: (tt, hh) => `${tt} leads acolhidos, ${hh} quentes. O Gui já cuidou de todos.`,
    heat: { hot: "Quente", warm: "Morno", new: "Novo" },
  } : {
    eyebrow: "Your daily brief", h1: "Your leads", intro1: `Good morning, ${name} — here's everyone Gui welcomed and qualified while you tended to the rest.`, intro2: "Every one is taken care of.",
    sNew: "New leads", sHot: "Hot", sDone: "Attended to", cta: "See all leads →", cta2: "Open dashboard 🚀",
    foot: "Gui has already followed up with each one. All that's left for you is the pleasure of closing.", subj: (tt, hh) => `${tt} new leads today — ${hh} hot · Guileo`, pre: (tt, hh) => `${tt} leads welcomed, ${hh} hot. Gui has already attended to them all.`,
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
  return { subject: t.subj(total, hot), html: shell({ preheader: t.pre(total, hot), eyebrow: t.eyebrow, body, lang }) };
}

// Company OS Owner Brief — "sua empresa se operou hoje". did = o que a Gui fez sozinha (24h);
// needs = o que precisa da sua decisão humana. Vai só pro dono (OWNER_EMAIL).
export function companyBriefEmail({ dateLabel = "Today", did = {}, needs = {}, lang = "en" } = {}) {
  dateLabel = esc(dateLabel);
  const n = (v) => Number(v || 0);
  const money = (c) => "$" + (n(c) / 100).toLocaleString(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: 0 });
  const t = lang === "pt" ? {
    eyebrow: "Company OS · Brief do dono", h1: "Sua empresa se operou hoje",
    intro: `Bom dia — enquanto você tocava o resto, a Gui trabalhou sozinha. Aqui está o dia da companhia em 30 segundos.`,
    didTitle: "O que a Gui fez sozinha (24h)", needsTitle: "Precisa de você",
    react: "clientes reativados", nurt: "leads nutridos", thank: "VIPs agradecidos", book: "agendamentos novos",
    stale: "deals parados", tickets: "tickets abertos", churn: "em risco de churn", appts: "agendamentos em 24h", leads: "leads novos (48h)", agents: "agentes p/ re-treino",
    allclear: "Tudo em dia — nada exige sua decisão agora. ✨", cta: "Abrir Company OS →",
    subject: "Company OS — sua empresa se operou hoje", pre: "O que a Gui fez sozinha + o que precisa de você.",
  } : {
    eyebrow: "Company OS · Owner brief", h1: "Your company ran itself today",
    intro: `Good morning — while you ran the rest, Gui worked on its own. Here's the company's day in 30 seconds.`,
    didTitle: "What Gui did on its own (24h)", needsTitle: "Needs you",
    react: "customers reactivated", nurt: "leads nurtured", thank: "VIPs thanked", book: "new bookings",
    stale: "stale deals", tickets: "open tickets", churn: "at churn risk", appts: "appointments in 24h", leads: "new leads (48h)", agents: "agents to retrain",
    allclear: "All clear — nothing needs your decision right now. ✨", cta: "Open Company OS →",
    subject: "Company OS — your company ran itself today", pre: "What Gui did on its own + what needs you.",
  };
  const didRow = (num, label, color) => `<td align="center" width="25%" style="padding:12px 4px;">
    <div style="font-size:26px;font-weight:800;color:${color};font-family:'Segoe UI',Arial,sans-serif;letter-spacing:-.5px;">${n(num)}</div>
    <div style="font-size:10px;color:${B.muted};text-transform:uppercase;letter-spacing:1px;font-family:'Segoe UI',Arial,sans-serif;margin-top:2px;">${label}</div></td>`;
  const needItems = [];
  if (n(needs.stale_deals_count) > 0) needItems.push(`${n(needs.stale_deals_count)} ${t.stale} · ${money(needs.stale_deals_value_cents)}`);
  if (n(needs.open_tickets) > 0) needItems.push(`${n(needs.open_tickets)} ${t.tickets}`);
  if (n(needs.churn_risk) > 0) needItems.push(`${n(needs.churn_risk)} ${t.churn}`);
  if (n(needs.appts_24h) > 0) needItems.push(`${n(needs.appts_24h)} ${t.appts}`);
  if (n(needs.new_leads_48h) > 0) needItems.push(`${n(needs.new_leads_48h)} ${t.leads}`);
  if (n(needs.agents_unhealthy) > 0) needItems.push(`${n(needs.agents_unhealthy)} ${t.agents}`);
  const needList = needItems.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${needItems.map((it) => `<tr><td style="padding:7px 0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:${B.ink2};border-bottom:1px solid ${B.line};"><span style="color:#d98a63;font-weight:700;">•</span> ${esc(it)}</td></tr>`).join("")}</table>`
    : `<div style="font-size:14px;color:${B.green};font-family:'Segoe UI',Arial,sans-serif;">${t.allclear}</div>`;
  const body = `
  <h1 style="font-size:25px;font-weight:800;color:${B.ink};margin:0;font-family:'Segoe UI',Arial,sans-serif;letter-spacing:-.4px;">${t.h1}</h1>
  <div style="font-size:12px;color:${B.muted};margin-top:4px;">${dateLabel}</div>
  <div style="font-size:14px;color:${B.ink2};line-height:1.65;margin-top:10px;">${t.intro}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:${B.gold};font-family:'Segoe UI',Arial,sans-serif;">${t.didTitle}</div>
  <div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${B.panel};border:1px solid ${B.line};border-radius:16px;box-shadow:inset 0 1px 0 ${B.edge};"><tr>
    ${didRow(did.reactivated, t.react, "#FF4FA3")}
    ${didRow(did.nurtured, t.nurt, "#E0855F")}
    ${didRow(did.thanked, t.thank, B.gold)}
    ${didRow(did.booked, t.book, B.green)}
  </tr></table>
  <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#d98a63;font-family:'Segoe UI',Arial,sans-serif;">${t.needsTitle}</div>
  <div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>
  ${needList}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.portal)}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// 3) PROPOSAL / SERVICES EMAIL — "what Guileo can do for you": services + ideas + a proposal CTA.
export function proposalEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name); business = esc(business);
  const t = lang === "pt" ? {
    subject: `${name}, o que a Guileo pode cuidar por ${business} 🌱`,
    pre: `Atendimento IA, anúncios, conteúdo, site, automação — pensados sob medida para ${business}.`,
    eyebrow: "Proposta · pensada para você",
    h1: `Ideias pra crescer ${business}`,
    intro: `Olá, ${name} — a Guileo é o sistema de IA que cuida, com discrição, do <span style="color:${B.ink};font-weight:600;">atendimento, do marketing e do operacional</span> do seu negócio. Permita-nos mostrar o que fazemos e algumas ideias para começarmos.`,
    servicesTitle: "O que cuidamos por você",
    services: [
      ["📞", "Atendimento com IA 24/7", "Nenhuma ligação ou lead se perde — ele acolhe, qualifica e agenda sozinho."],
      ["💬", "WhatsApp & SMS atendidos", "Responde, vende e faz follow-up sem que você precise levantar um dedo."],
      ["📣", "Anúncios & marketing", "Tráfego que vira cliente — campanhas conduzidas para você."],
      ["🎬", "Vídeo & conteúdo", "Produção que encanta e posiciona sua marca."],
      ["📱", "Gestão de redes sociais", "Uma presença que cresce com naturalidade, no seu tom."],
      ["🌐", "Site, app & software", "Feitos sob medida, do zero — com rapidez e bom gosto."],
      ["🤖", "Automação com IA", "O trabalho repetitivo conduzido em silêncio, por nós."],
      ["⭐", "Reviews & reputação", "Mais 5 estrelas, mais confiança, mais vendas."],
    ],
    ideasTitle: "3 ideias para começarmos já",
    ideas: [
      "Recuperar ligações perdidas → cada chamada não atendida vira agendamento.",
      "Transformar seguidores em clientes → conteúdo + anúncios que convertem.",
      "Tirar o operacional das suas costas → deixe o repetitivo conosco, 24/7.",
    ],
    cta: "Quero minha proposta →",
    cta2: "Ver tudo que cuidamos →",
    foot: "Responda este email contando sobre o seu negócio — preparamos uma proposta sob medida, com prazer.",
  } : lang === "es" ? {
    subject: `${name}, lo que Guileo puede atender por ${business} 🌱`,
    pre: `Recepción con IA, anuncios, contenido, sitio web, automatización — ideas a la medida de ${business}.`,
    eyebrow: "Propuesta · pensada para usted",
    h1: `Ideas para hacer crecer ${business}`,
    intro: `Hola, ${name} — Guileo es el sistema de IA que atiende, con discreción, <span style="color:${B.ink};font-weight:600;">la recepción, el marketing y la operación</span> de su negocio. Permítanos mostrarle lo que hacemos y algunas ideas para comenzar.`,
    servicesTitle: "Lo que atendemos por usted",
    services: [
      ["📞", "Recepción con IA 24/7", "Ninguna llamada ni lead se pierde — recibe, califica y agenda por sí sola."],
      ["💬", "WhatsApp y SMS atendidos", "Responde, vende y hace seguimiento sin que usted mueva un dedo."],
      ["📣", "Anuncios y marketing", "Tráfico que se vuelve cliente — campañas conducidas por nosotros."],
      ["🎬", "Video y contenido", "Producción que encanta y posiciona su marca."],
      ["📱", "Gestión de redes sociales", "Una presencia que crece con naturalidad, en su tono."],
      ["🌐", "Sitio web, app y software", "Hechos a la medida, desde cero — con rapidez y buen gusto."],
      ["🤖", "Automatización con IA", "El trabajo repetitivo, conducido en silencio, por nosotros."],
      ["⭐", "Reseñas y reputación", "Más 5 estrellas, más confianza, más ventas."],
    ],
    ideasTitle: "3 ideas para comenzar ya",
    ideas: [
      "Recuperar llamadas perdidas → cada llamada sin contestar se vuelve una cita.",
      "Convertir seguidores en clientes → contenido + anuncios que convierten.",
      "Quitarse la operación de encima → deje lo repetitivo con nosotros, 24/7.",
    ],
    cta: "Quiero mi propuesta →",
    cta2: "Ver todo lo que atendemos →",
    foot: "Responda este correo contándonos de su negocio — preparamos una propuesta a su medida, con gusto.",
  } : {
    subject: `${name}, what Guileo can handle for ${business} 🌱`,
    pre: `AI front desk, ads, content, website, automation — tailored ideas for ${business}.`,
    eyebrow: "Proposal · tailored for you",
    h1: `Ideas to grow ${business}`,
    intro: `Hello, ${name} — Guileo is the AI system that quietly tends to your <span style="color:${B.ink};font-weight:600;">front desk, marketing and operations</span>. Allow us to show you what we do, and a few ideas to begin with.`,
    servicesTitle: "What we tend to for you",
    services: [
      ["📞", "24/7 AI front desk", "No call or lead is ever lost — it welcomes, qualifies and books on its own."],
      ["💬", "WhatsApp & SMS, attended", "Replies, sells and follows up without you lifting a finger."],
      ["📣", "Ads & marketing", "Traffic that becomes customers — campaigns conducted for you."],
      ["🎬", "Video & content", "Production that delights and positions your brand."],
      ["📱", "Social media management", "A presence that grows gracefully, in your voice."],
      ["🌐", "Website, app & software", "Crafted bespoke, from scratch — swift and beautiful."],
      ["🤖", "AI automation", "The repetitive work quietly handled, by us."],
      ["⭐", "Reviews & reputation", "More 5-stars, more trust, more sales."],
    ],
    ideasTitle: "3 ideas to begin now",
    ideas: [
      "Recover missed calls → every unanswered call becomes a booking.",
      "Turn followers into customers → content + ads that convert.",
      "Take operations off your shoulders → leave the repetitive work with us, 24/7.",
    ],
    cta: "Get my proposal →",
    cta2: "See all we tend to →",
    foot: "Reply to this email and tell us about your business — we'll prepare a proposal tailored to you, with pleasure.",
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
  <div class="g-intro" style="font-size:16px;color:${B.ink2};line-height:1.72;margin-top:12px;">${t.intro}</div>
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
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// 4) PROOF EMAIL (drip day ~2) — "what Gui already does for businesses like yours".
export function proofEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name); business = esc(business);
  const t = lang === "pt" ? {
    subject: `${name}, veja o que o Gui já cuida por negócios como o seu`,
    pre: `Atende, agenda e fecha 24/7 — enquanto você cuida do que importa.`,
    eyebrow: "Na prática · resultados reais",
    h1: `O que o Gui já faz, ${name}`,
    intro: `Não precisa imaginar — é exatamente isto que o Gui cuida todo dia por negócios como <span style="color:${B.ink};font-weight:600;">${business}</span>:`,
    points: [
      ["📞", "Acolhe toda ligação", "Mesmo às 21h, fim de semana, feriado — nenhuma chamada vira caixa postal."],
      ["📅", "Agenda por conta própria", "Marca, confirma e lembra — a agenda se enche sem que você precise se preocupar."],
      ["💬", "Cuida do follow-up", "Responde no WhatsApp em segundos e reconquista o cliente que ia embora."],
      ["📈", "Nutre seu marketing", "Cada conversa alimenta os anúncios — você cresce com o que já tem."],
    ],
    stat: "Em pilotos: nenhuma ligação perdida · agenda mais cheia · clientes reconquistados, com naturalidade.",
    cta: "Ver o Gui ao vivo →",
    cta2: "Quero isso pro meu negócio →",
    foot: "Responda este email — com prazer, em 10 minutos mostro tudo funcionando no seu caso.",
  } : lang === "es" ? {
    subject: `${name}, vea lo que Gui ya atiende por negocios como el suyo`,
    pre: `Contesta, agenda y cierra 24/7 — mientras usted se ocupa de lo importante.`,
    eyebrow: "En la práctica · resultados reales",
    h1: `Lo que Gui ya hace, ${name}`,
    intro: `No hace falta imaginarlo — esto es exactamente lo que Gui atiende cada día por negocios como <span style="color:${B.ink};font-weight:600;">${business}</span>:`,
    points: [
      ["📞", "Recibe cada llamada", "Incluso a las 9 PM, fines de semana, feriados — ninguna llamada va al buzón."],
      ["📅", "Agenda por su cuenta", "Reserva, confirma y recuerda — el calendario se llena sin que usted se preocupe."],
      ["💬", "Se ocupa del seguimiento", "Responde en WhatsApp en segundos y recupera al cliente que se estaba yendo."],
      ["📈", "Nutre su marketing", "Cada conversación alimenta los anuncios — usted crece con lo que ya tiene."],
    ],
    stat: "En pilotos: ni una llamada perdida · calendario más lleno · clientes recuperados, con naturalidad.",
    cta: "Ver a Gui en vivo →",
    cta2: "Quiero esto para mi negocio →",
    foot: "Responda este correo — con gusto, en 10 minutos le muestro todo funcionando para su caso.",
  } : {
    subject: `${name}, see what Gui already tends to for businesses like yours`,
    pre: `Answers, books and closes 24/7 — while you tend to what matters.`,
    eyebrow: "In practice · real results",
    h1: `What Gui already does, ${name}`,
    intro: `No need to imagine it — here's precisely what Gui tends to every day for businesses like <span style="color:${B.ink};font-weight:600;">${business}</span>:`,
    points: [
      ["📞", "Welcomes every call", "Even at 9 PM, weekends, holidays — no call goes to voicemail."],
      ["📅", "Books on its own", "Schedules, confirms and reminds — the calendar fills without a worry from you."],
      ["💬", "Tends to follow-up", "Replies on WhatsApp in seconds and wins back the client who was slipping away."],
      ["📈", "Nurtures your marketing", "Every conversation feeds the ads — you grow with what you already have."],
    ],
    stat: "In pilots: not a single missed call · fuller calendar · customers won back, effortlessly.",
    cta: "See Gui live →",
    cta2: "I'd like this for my business →",
    foot: "Reply to this email — with pleasure, in 10 minutes I'll show it all working for your case.",
  };
  const pt_ = ([ic, ti, de]) => `<tr><td style="padding:7px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="44" valign="top"><div style="width:34px;height:34px;border-radius:10px;background:${B.panel2};border:1px solid ${B.line};box-shadow:inset 0 1px 0 ${B.edge};font-size:17px;text-align:center;line-height:34px;">${ic}</div></td>
    <td valign="top" style="font-family:'Segoe UI',Arial,sans-serif;padding-left:6px;"><div style="font-size:14px;font-weight:700;color:${B.ink};">${ti}</div><div style="font-size:12.5px;color:${B.muted};line-height:1.55;margin-top:2px;">${de}</div></td></tr></table></td></tr>`;
  const body = `
  ${h1img("proof", lang, t.h1, esc(name) + " 🌱")}
  <div class="g-intro" style="font-size:16px;color:${B.ink2};line-height:1.7;margin-top:12px;">${t.intro}</div>
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${t.points.map(pt_).join("")}</table>`)}
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div style="font-size:13px;color:${B.gold};text-align:center;font-family:'Segoe UI',Arial,sans-serif;font-weight:600;">${t.stat}</div>
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.site + "/#try")}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.site + "/marketing")}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// 5) RE-ENGAGE EMAIL (drip day ~7) — bring a cold lead back to the quiz.
export function reengageEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name); business = esc(business);
  const t = lang === "pt" ? {
    subject: `${name}, seu AI Growth Score aguarda você`,
    pre: `60 segundos para ver quanto ${business} está deixando passar.`,
    eyebrow: "Quando lhe convier · sem custo",
    h1: `Quando quiser, ${name}`,
    intro: `Em <span style="color:${B.ink};font-weight:600;">60 segundos</span> você descobre exatamente quanto ${business} deixa passar a cada mês com ligações e leads que escapam — e o caminho para resolver. Sem custo, sem compromisso.`,
    cta: "Fazer meu Growth Score →",
    cta2: "Falar com alguém →",
    foot: "Se não for o momento, sem problema — fico à disposição para qualquer dúvida.",
  } : lang === "es" ? {
    subject: `${name}, su AI Growth Score le espera`,
    pre: `60 segundos para ver cuánto está dejando pasar ${business}.`,
    eyebrow: "Cuando le convenga · sin costo",
    h1: `Cuando guste, ${name}`,
    intro: `En <span style="color:${B.ink};font-weight:600;">60 segundos</span> descubre exactamente cuánto deja pasar ${business} cada mes en llamadas y leads que se escapan — y el camino para resolverlo. Sin costo, sin compromiso.`,
    cta: "Hacer mi Growth Score →",
    cta2: "Hablar con alguien →",
    foot: "Si no es el momento, no hay problema — quedo a su disposición para cualquier duda.",
  } : {
    subject: `${name}, your AI Growth Score awaits you`,
    pre: `60 seconds to see what ${business} is letting slip by.`,
    eyebrow: "Whenever it suits you · no cost",
    h1: `Whenever you're ready, ${name}`,
    intro: `In <span style="color:${B.ink};font-weight:600;">60 seconds</span> you'll see exactly how much ${business} lets slip by each month through missed calls and fading leads — and the path to set it right. No cost, no obligation.`,
    cta: "Get my Growth Score →",
    cta2: "Speak with someone →",
    foot: "If now isn't the moment, no worries — I'm here whenever you have a question.",
  };
  const body = `
  ${h1img("reengage", lang, t.h1, esc(name))}
  <div class="g-intro" style="font-size:16px;color:${B.ink2};line-height:1.72;margin-top:13px;">${t.intro}</div>
  <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.site + "/quiz")}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.site + "/#try")}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// 5b) CREDIT DEPLETED — branded client alert: Gui ran out of credits, top up to resume.
export function creditDepletedEmail({ name = "there", business = "your business", lang = "en" } = {}) {
  name = esc(name); business = esc(business);
  const t = lang === "pt" ? {
    subject: "⚡ Os créditos do Gui se esgotaram — uma recarga e ele volta a atender",
    pre: `O Gui pausou as tarefas de ${business}. A recarga leva apenas um minuto.`,
    eyebrow: "Um instante · créditos",
    h1: `${name}, seus créditos se esgotaram`,
    intro: `O Gui utilizou todos os créditos de ${business} e <b style="color:${B.ink};">pausou, com cuidado, as tarefas que consomem crédito</b> — ligações, mensagens e follow-ups. Uma recarga e ele volta a atender 24/7, sem deixar nenhum cliente escapar.`,
    note: "É pré-pago: você paga apenas pelo que o Gui faz. Sem mensalidade alguma.",
    cta: "Recarregar créditos →",
  } : {
    subject: "⚡ Your Gui credits have run out — a quick top-up and it's back",
    pre: `Gui has paused tasks for ${business}. Topping up takes just a minute.`,
    eyebrow: "A moment · credits",
    h1: `${name}, your credits have run out`,
    intro: `Gui has used all of ${business}'s credits and <b style="color:${B.ink};">gently paused the tasks that draw on them</b> — calls, messages and follow-ups. A quick top-up and it's back to answering 24/7, without missing a single customer.`,
    note: "It's pay-as-you-go: you pay only for what Gui does. No subscription whatsoever.",
    cta: "Top up credits →",
  };
  const body = `
  <h1 style="font-size:24px;font-weight:800;color:${B.ink};margin:0 0 6px;">${t.h1}</h1>
  <div style="font-size:16px;color:${B.ink2};line-height:1.7;margin-top:8px;">${t.intro}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  ${panel(`<div style="font-size:13px;color:${B.muted};">${t.note}</div>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.site + "/portal?tab=billing")}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// 5c) SELF-SERVE WELCOME — sent the moment a Track-A signup pays. Carries the connection
// code that links their portal to their real, live Gui data.
export function welcomeSelfServeEmail({ name = "there", business = "your business", lang = "en", plan = "", code = "", credits = 0, number = "", forwarding = null } = {}) {
  const rawCode = String(code || ""); // pre-escape value for the auto-apply CTA link (before esc() for HTML)
  name = esc(name); business = esc(business); plan = esc(plan); code = esc(code);
  credits = (Number(credits) || 0).toLocaleString("en-US"); // numeric → safe HTML, thousands-formatted
  const t = lang === "pt" ? {
    subject: `🎉 Seja bem-vindo à Guileo — seu Gui está ativo`,
    pre: `Seu código de conexão está aqui. Entre e veja o Gui em ação.`,
    eyebrow: `Plano ${plan} · ativo`,
    h1: `${name}, seu Gui está no ar 🎉`,
    intro: `Pagamento confirmado e <b style="color:${B.ink};">${credits} créditos</b> já estão em sua conta. Agora basta conectar o painel aos seus dados reais com o código abaixo — está tudo certo.`,
    codeLabel: "Seu código de conexão",
    steps: ["Abra o painel (Growth Cockpit) e entre com ESTE e-mail — o mesmo do pagamento. Primeira vez? Crie sua senha na tela de login.", "Vá em Ajustes → Código de conexão e cole o código acima.", "Pronto — o painel mostra seus dados reais e o Gui começa a atender."],
    cta: "Abrir meu painel →",
    foot: "Guarde este e-mail — o código desbloqueia seus dados reais. Qualquer coisa, é só chamar.",
  } : {
    subject: `🎉 Welcome to Guileo — your Gui is live`,
    pre: `Your connection code is inside. Log in and watch Gui at work.`,
    eyebrow: `${plan} plan · active`,
    h1: `${name}, your Gui is live 🎉`,
    intro: `Payment confirmed, and <b style="color:${B.ink};">${credits} credits</b> are already on your account. Now simply link your dashboard to your real data with the code below — it's all taken care of.`,
    codeLabel: "Your connection code",
    steps: ["Open your dashboard (Growth Cockpit) and sign in with THIS email — the one you paid with. First time? Create your password on the login screen.", "Go to Settings → Connection code and paste the code above.", "Done — the dashboard shows your real data and Gui begins answering."],
    cta: "Open my dashboard →",
    foot: "Keep this email — the code unlocks your real data. Whenever you need anything, just reply.",
  };
  const stepsHtml = t.steps.map((s, i) => `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;color:${B.green};font-weight:800;">${i + 1}.</td><td style="padding:4px 0;font-size:14px;color:${B.ink2};line-height:1.6;">${s}</td></tr>`).join("");
  // NUMBER + call-forwarding — only when a number was provisioned. The client forwards their own
  // business line to this number so customers calling their real number reach the AI.
  const fwdLabel = lang === "pt" ? { num: "O número da sua IA", how: "Pra suas ligações caírem na IA, encaminhe seu número atual:", pick: "Escolha um:" }
    : lang === "es" ? { num: "El número de tu IA", how: "Para que tus llamadas lleguen a la IA, reenvía tu número actual:", pick: "Elige uno:" }
      : { num: "Your AI's number", how: "To route your calls to the AI, forward your current business number:", pick: "Pick one:" };
  const numberHtml = (number && forwarding) ? `
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${B.muted};font-weight:700;">${fwdLabel.num}</div>
  <div style="font-family:ui-monospace,Menlo,monospace;font-size:20px;font-weight:800;color:${B.ink};letter-spacing:1px;margin-top:6px;">${esc(number)}</div>
  <div style="font-size:13px;color:${B.ink2};line-height:1.6;margin-top:10px;">${fwdLabel.how}</div>
  <div style="font-size:12px;color:${B.muted};font-weight:700;margin-top:8px;">${fwdLabel.pick}</div>
  <div style="font-size:13px;color:${B.ink2};line-height:1.6;margin-top:4px;">📞 ${esc(forwarding.full)}</div>
  <div style="font-size:13px;color:${B.ink2};line-height:1.6;margin-top:4px;">🛟 ${esc(forwarding.missed)}</div>
  <div style="font-size:11.5px;color:${B.muted};line-height:1.5;margin-top:8px;">${esc(forwarding.note)}</div>`)}` : "";
  const body = `
  <h1 style="font-size:24px;font-weight:800;color:${B.ink};margin:0 0 6px;">${t.h1}</h1>
  <div style="font-size:16px;color:${B.ink2};line-height:1.7;margin-top:8px;">${t.intro}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  ${panel(`<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${B.muted};font-weight:700;">${t.codeLabel}</div><div style="font-family:ui-monospace,Menlo,monospace;font-size:22px;font-weight:800;color:${B.ink};letter-spacing:1px;margin-top:6px;">${code}</div>`)}
  ${numberHtml}
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  <table style="width:100%;border-collapse:collapse;">${stepsHtml}</table>
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, rawCode ? B.site + "/portal?code=" + encodeURIComponent(rawCode) : B.site + "/portal")}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// 5b) ACTION CONFIRMATION — branded confirmation sent to the CUSTOMER after the Gui takes an order,
// captures a quote, schedules a callback, or sends a payment link. Closes the "I'll send a confirmation"
// promise that previously sent nothing. kind ∈ order|quote|callback|invoice|sale.
export function actionConfirmEmail({ kind = "order", name = "there", business = "the business", details = "", amount = "", when = "", payLink = "", lang = "en" } = {}) {
  name = esc(name); business = esc(business); details = esc(details); when = esc(when);
  const amt = amount ? esc(String(amount).replace(/[^0-9.,$]/g, "")) : "";
  const PT = {
    order: { eyebrow: "Pedido recebido", h1: `Recebemos seu pedido, ${name} ✅`, intro: `${business} já está com seu pedido e vai confirmar os detalhes em instantes.`, label: "Seu pedido" },
    quote: { eyebrow: "Orçamento solicitado", h1: `Orçamento a caminho, ${name}`, intro: `${business} recebeu seu pedido de orçamento e vai te enviar em breve.`, label: "O que você pediu" },
    callback: { eyebrow: "Retorno agendado", h1: `Combinado, ${name} — a gente te liga`, intro: `${business} vai te retornar${when ? ` ${when}` : " em breve"}.`, label: "Sobre" },
    invoice: { eyebrow: "Pagamento", h1: `Seu link de pagamento, ${name}`, intro: `${business} preparou um link seguro pra você pagar${amt ? ` (${amt})` : ""}.`, label: "Detalhes" },
    sale: { eyebrow: "Confirmado", h1: `Tudo certo, ${name}! 🎉`, intro: `${business} confirmou${amt ? ` ${amt}` : ""}. Obrigado!`, label: "Detalhes" },
  };
  const EN = {
    order: { eyebrow: "Order received", h1: `We got your order, ${name} ✅`, intro: `${business} has your order and will confirm the details shortly.`, label: "Your order" },
    quote: { eyebrow: "Quote requested", h1: `Your quote is on the way, ${name}`, intro: `${business} received your quote request and will send it shortly.`, label: "What you asked for" },
    callback: { eyebrow: "Callback set", h1: `All set, ${name} — we'll call you`, intro: `${business} will call you back${when ? ` ${when}` : " soon"}.`, label: "About" },
    invoice: { eyebrow: "Payment", h1: `Your payment link, ${name}`, intro: `${business} set up a secure link for you to pay${amt ? ` (${amt})` : ""}.`, label: "Details" },
    sale: { eyebrow: "Confirmed", h1: `You're all set, ${name}! 🎉`, intro: `${business} confirmed${amt ? ` ${amt}` : ""}. Thank you!`, label: "Details" },
  };
  const set = lang === "pt" ? PT : EN; // es uses EN copy to avoid PT/ES mixing in one email
  const t = set[kind] || set.order;
  const subj = `${t.eyebrow} — ${business}`;
  const body = `
  <h1 style="font-size:23px;font-weight:800;color:${B.ink};margin:0 0 6px;">${t.h1}</h1>
  <div style="font-size:16px;color:${B.ink2};line-height:1.7;margin-top:8px;">${t.intro}</div>
  ${details ? `<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>${panel(`<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${B.muted};font-weight:700;">${t.label}</div><div style="font-size:14px;color:${B.ink2};line-height:1.6;margin-top:6px;">${details}</div>`)}` : ""}
  ${payLink ? `<div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div><div align="center">${cta(lang === "pt" ? "Pagar agora →" : "Pay now →", payLink)}</div>` : ""}
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:18px;">${lang === "pt" ? "Recebeu por engano? É só ignorar." : "Got this by mistake? Just ignore it."}</div>`;
  return { subject: subj, html: shell({ preheader: t.intro, eyebrow: t.eyebrow, body, lang }) };
}

// 5b) OWNER ALERT — a real-time "you just got a [order/booking/lead]" ping to the BUSINESS OWNER
//     (our client) the instant Gui closes something, so they never have to watch the cockpit.
export function ownerAlertEmail({ kind = "order", customer = "", business = "", details = "", amount = "", when = "", lang = "en" } = {}) {
  const cust = esc(customer); const biz = esc(business || ""); const det = esc(details); const wh = esc(when);
  const amt = amount ? esc(String(amount).replace(/[^0-9.,$]/g, "")) : "";
  const K = {
    order: { icon: "🛒", pt: "pedido", en: "order", es: "pedido" },
    booking: { icon: "📅", pt: "agendamento", en: "booking", es: "reserva" },
    book: { icon: "📅", pt: "agendamento", en: "booking", es: "reserva" },
    lead: { icon: "🎯", pt: "contato", en: "lead", es: "contacto" },
    quote: { icon: "📝", pt: "orçamento", en: "quote", es: "presupuesto" },
    sale: { icon: "💳", pt: "venda", en: "sale", es: "venta" },
    invoice: { icon: "💳", pt: "cobrança", en: "payment", es: "cobro" },
    deposit: { icon: "💳", pt: "depósito", en: "deposit", es: "depósito" },
    callback: { icon: "📞", pt: "retorno", en: "callback", es: "devolución" },
    escalate: { icon: "🙋", pt: "pedido de atendente", en: "human request", es: "pedido de humano" },
    billing: { icon: "⚠️", pt: "alerta de cobrança", en: "billing alert", es: "alerta de cobro" },
    referral: { icon: "🎁", pt: "cliente indicado", en: "referral", es: "referido" }, // masc. noun — the shared "Novo ${word}" must agree
  }[kind] || { icon: "🔔", pt: "evento", en: "event", es: "evento" };
  const L = lang === "pt" ? "pt" : lang === "es" ? "es" : "en";
  const word = K[L];
  const C = {
    pt: { eyebrow: "Aviso da Gui", h1: `${K.icon} Novo ${word}`, intro: `A Gui acabou de fechar isso${biz ? ` em ${biz}` : ""} — chegou agora.`, who: "Cliente", val: "Valor", whenL: "Quando", what: "Detalhes", cta: "Ver no painel", foot: "A Gui registra tudo no seu painel automaticamente." },
    en: { eyebrow: "Gui alert", h1: `${K.icon} New ${word}`, intro: `Gui just closed this${biz ? ` at ${biz}` : ""} — it came in now.`, who: "Customer", val: "Amount", whenL: "When", what: "Details", cta: "Open dashboard", foot: "Gui logs everything in your dashboard automatically." },
    es: { eyebrow: "Aviso de Gui", h1: `${K.icon} Nuevo ${word}`, intro: `Gui acaba de cerrar esto${biz ? ` en ${biz}` : ""} — llegó ahora.`, who: "Cliente", val: "Monto", whenL: "Cuándo", what: "Detalles", cta: "Abrir panel", foot: "Gui registra todo en tu panel automáticamente." },
  }[L];
  // Kinds that are NOT a sale Gui closed get their own honest intro — a payment failure must
  // never read as "Gui just closed this". Falls back to the generic intro for all other kinds.
  const INTRO = {
    billing: {
      pt: `Um evento de cobrança${biz ? ` em ${biz}` : ""} precisa da sua atenção — chegou agora.`,
      en: `A billing event${biz ? ` at ${biz}` : ""} needs your attention — it came in now.`,
      es: `Un evento de cobro${biz ? ` en ${biz}` : ""} necesita su atención — llegó ahora.`,
    },
    referral: {
      pt: `Boa notícia: uma indicação${biz ? ` (${biz})` : ""} acabou de converter — chegou agora.`,
      en: `Good news: a referral${biz ? ` (${biz})` : ""} just converted — it came in now.`,
      es: `Buena noticia: un referido${biz ? ` (${biz})` : ""} acaba de convertir — llegó ahora.`,
    },
  };
  if (INTRO[kind]) C.intro = INTRO[kind][L];
  const row = (k, v) => v ? `<tr><td style="padding:3px 14px 3px 0;color:${B.muted};white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:3px 0;color:${B.ink2};font-weight:700;">${v}</td></tr>` : "";
  const rows = row(C.who, cust) + row(C.val, amt ? `$${amt}` : "") + row(C.whenL, wh) + row(C.what, det);
  const body = `
  <h1 style="font-size:23px;font-weight:800;color:${B.ink};margin:0 0 6px;">${C.h1}</h1>
  <div style="font-size:16px;color:${B.ink2};line-height:1.7;margin-top:8px;">${C.intro}</div>
  ${rows ? `<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>${panel(`<table style="font-size:15px;border-collapse:collapse;">${rows}</table>`)}` : ""}
  <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div><div align="center">${cta(C.cta, "https://guileoai.com/portal")}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:18px;">${C.foot}</div>`;
  return { subject: `${K.icon} ${L === "pt" ? "Novo" : L === "es" ? "Nuevo" : "New"} ${word}${biz ? ` · ${biz}` : ""}`, html: shell({ preheader: C.intro, eyebrow: C.eyebrow, body, lang: L }) };
}

// 5b) NEW-LEAD ALERT — the branded owner notification when a lead/quote/signup comes in via
// guileoai.com (replaces the ad-hoc HTML that used to live in /api/lead.js). Full field table +
// "Open /admin" CTA. Bilingual pt/en; the OWNER reads it, so default to pt.
export function leadAlertEmail({ kind = "lead", name = "", contact = "", business = "", industry = "", source = "", ref = "", details = "", lang = "pt" } = {}) {
  const L = lang === "en" ? "en" : "pt";
  const K = {
    lead: { icon: "🎯", pt: "contato", en: "lead" },
    "quote request": { icon: "📝", pt: "orçamento", en: "quote request" },
    "new client signup": { icon: "🚀", pt: "cadastro de cliente", en: "new client signup" },
  }[kind] || { icon: "🎯", pt: "contato", en: "lead" };
  const T = L === "pt"
    ? { eyebrow: "Aviso da Gui", h1: `${K.icon} Novo ${K.pt}`, intro: "Chegou agora pela guileoai.com — a Gui já registrou. Aqui estão os detalhes:", cta: "Abrir no /admin →", foot: "A Gui capturou e já está cuidando. Você só precisa fechar.",
        f: { name: "Nome", contact: "Contato", business: "Negócio", industry: "Setor", source: "Origem", ref: "Parceiro (ref)", details: "Detalhes" } }
    : { eyebrow: "Gui alert", h1: `${K.icon} New ${K.en}`, intro: "Just came in via guileoai.com — Gui already logged it. Here are the details:", cta: "Open in /admin →", foot: "Gui captured it and is already on it. All that's left is to close.",
        f: { name: "Name", contact: "Contact", business: "Business", industry: "Industry", source: "Source", ref: "Partner (ref)", details: "Details" } };
  const row = (k, v) => v ? `<tr><td style="padding:4px 14px 4px 0;color:${B.muted};white-space:nowrap;vertical-align:top;font-size:13px;">${k}</td><td style="padding:4px 0;color:${B.ink2};font-weight:700;font-size:14px;">${esc(v)}</td></tr>` : "";
  const rows = row(T.f.name, name) + row(T.f.contact, contact) + row(T.f.business, business) + row(T.f.industry, industry) + row(T.f.source, source) + row(T.f.ref, ref) + row(T.f.details, details);
  const body = `
  <h1 style="font-size:23px;font-weight:800;color:${B.ink};margin:0 0 6px;">${T.h1}</h1>
  <div style="font-size:16px;color:${B.ink2};line-height:1.7;margin-top:8px;">${T.intro}</div>
  <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
  ${panel(`<table style="font-size:14px;border-collapse:collapse;width:100%;">${rows}</table>`)}
  <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div><div align="center">${cta(T.cta, "https://guileoai.com/admin")}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:18px;">${T.foot}</div>`;
  return { subject: `${K.icon} ${L === "pt" ? "Novo" : "New"} ${L === "pt" ? K.pt : K.en}${business ? ` · ${esc(business)}` : name ? ` · ${esc(name)}` : ""}`, html: shell({ preheader: T.intro, eyebrow: T.eyebrow, body, lang: L }) };
}

// 5c) CONNECT-STRIPE NUDGE — the branded push that gets a CLIENT to connect their own Stripe so
// the money Gui collects lands in THEIR account. CTA → /receber. Reusable for every client.
export function stripeConnectEmail({ name = "there", business = "seu negócio", lang = "pt" } = {}) {
  const L = lang === "en" ? "en" : lang === "es" ? "es" : "pt";
  const nm = esc((name || "").split(" ")[0] || (L === "en" ? "there" : ""));
  const biz = esc(business || "");
  const T = {
    pt: { eyebrow: "Um passo pra receber", h1: "Conecte seu Stripe — o dinheiro é seu 💳", subj: `${nm ? nm + ", f" : "F"}alta 1 passo pra a Gui cobrar na sua conta`,
          pre: "Conecte uma vez e a Gui cobra na ligação — o dinheiro cai direto na sua conta.",
          intro: `A Gui já atende, agenda e fecha${biz ? ` na ${biz}` : ""}. Falta <b style="color:${B.ink}">um passo</b> pra ela também <b style="color:${B.ink}">cobrar</b>: conectar seu Stripe. Sem isso, ela fecha a venda mas o dinheiro não chega até você.`,
          bullets: [["💳", "O dinheiro cai na SUA conta", "não passa pela Guileo — cai direto no seu Stripe."], ["⏱️", "Leva 2 minutos", "o cadastro é hospedado pela Stripe (seguro, sem burocracia)."], ["🤖", "A Gui cobra na hora", "manda link de pagamento na própria ligação e fecha na hora."]],
          cta: "💳 Conectar meu Stripe agora", foot: "Depois de conectar, a Gui já começa a cobrar automaticamente. Qualquer dúvida, é só responder este e-mail." },
    en: { eyebrow: "One step to get paid", h1: "Connect your Stripe — the money is yours 💳", subj: `${nm ? nm + ", o" : "O"}ne step left for Gui to charge into your account`,
          pre: "Connect once and Gui charges on the call — the money lands straight in your account.",
          intro: `Gui already answers, books and closes${biz ? ` at ${biz}` : ""}. One <b style="color:${B.ink}">step</b> is left for it to also <b style="color:${B.ink}">charge</b>: connect your Stripe. Without it, it closes the sale but the money won't reach you.`,
          bullets: [["💳", "The money lands in YOUR account", "it never passes through Guileo — straight to your Stripe."], ["⏱️", "Takes 2 minutes", "onboarding is hosted by Stripe (secure, no red tape)."], ["🤖", "Gui charges on the spot", "sends a payment link right on the call and closes."]],
          cta: "💳 Connect my Stripe now", foot: "Once connected, Gui starts charging automatically. Any questions, just reply to this email." },
    es: { eyebrow: "Un paso para cobrar", h1: "Conecta tu Stripe — el dinero es tuyo 💳", subj: `${nm ? nm + ", f" : "F"}alta 1 paso para que Gui cobre en tu cuenta`,
          pre: "Conéctalo una vez y Gui cobra en la llamada — el dinero cae directo en tu cuenta.",
          intro: `Gui ya atiende, agenda y cierra${biz ? ` en ${biz}` : ""}. Falta <b style="color:${B.ink}">un paso</b> para que también <b style="color:${B.ink}">cobre</b>: conectar tu Stripe. Sin esto, cierra la venta pero el dinero no llega a ti.`,
          bullets: [["💳", "El dinero cae en TU cuenta", "no pasa por Guileo — directo a tu Stripe."], ["⏱️", "Toma 2 minutos", "el registro lo aloja Stripe (seguro, sin trámites)."], ["🤖", "Gui cobra al instante", "manda un link de pago en la llamada y cierra."]],
          cta: "💳 Conectar mi Stripe ahora", foot: "Una vez conectado, Gui empieza a cobrar automáticamente. Cualquier duda, responde este correo." },
  }[L];
  const bl = (ic, ttl, sub) => `
    <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;font-weight:800;color:${B.ink};">${ic}&nbsp; ${ttl}</span><br/>
      <span style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12.5px;color:${B.muted};">${sub}</span>
    </td></tr>`;
  const body = `
  <h1 style="font-size:23px;font-weight:800;color:${B.ink};margin:0 0 6px;">${T.h1}</h1>
  ${nm ? `<div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:800;color:${B.gold};margin-top:2px;">${nm} 🌱</div>` : ""}
  <div class="g-intro" style="font-size:16px;color:${B.ink2};line-height:1.72;margin-top:14px;">${T.intro}</div>
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${T.bullets.map((b) => bl(b[0], b[1], b[2])).join("")}</table>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(T.cta, `${B.site}/receber`)}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:18px;">${T.foot}</div>`;
  return { subject: T.subj, html: shell({ preheader: T.pre, eyebrow: T.eyebrow, body, lang: L }) };
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
    <p class="g-intro" style="margin:0 0 18px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${B.ink2};">${pt ? "Tudo reunido em <b style='color:" + B.ink + "'>guileoai.com</b> — guarde este e-mail por perto." : "Everything gathered at <b style='color:" + B.ink + "'>guileoai.com</b> — keep this email close at hand."}</p>
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
    html: shell({ preheader: pt ? "Todos os seus acessos Guileo, reunidos num só lugar." : "All your Guileo links, gathered in one place.", body, lang }),
  };
}

// 7) PARTNER ONBOARDING — the complete starter package for a new collaborator.
// Everything to start & understand: the sentence, the 3 tools, earnings, first 7 days.
export function partnerOnboardEmail({ name = "parceiro(a)", lang = "pt" } = {}) {
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
  <div class="g-intro" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink2};line-height:1.72;margin-top:14px;">
    É um prazer recebê-lo: você agora é um <b style="color:${B.ink}">Growth Partner da Guileo</b>. Este e-mail reúne tudo o que você precisa para começar — guarde-o por perto.
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
  return { subject: `🌱 Seja bem-vindo ao time, ${name} — seu pacote completo de Growth Partner`, html: shell({ preheader: "Tudo para você começar com tranquilidade: Academy, ferramentas, ganhos e o plano dos 7 dias.", body, lang }) };
}

// 8b) SELLER WELCOME / ACCESS — hands a rostered seller their /vendedor hub login (email + personal
// code) + the three tools to start learning. Sent by /api/seller-admin action:"invite" (admin-gated),
// which looks the code up server-side so it never leaves the Function. Bilingual pt/en.
export function sellerWelcomeEmail({ name = "vendedor(a)", email = "", code = "", ref = "", lang = "pt" } = {}) {
  const pt = lang !== "en";
  const nm = esc((name || "").split(" ")[0] || "vendedor");
  const T = pt ? {
    h1: "Seu acesso está pronto 🌱", subj: `🔑 ${nm}, seu acesso ao Hub do Vendedor Guileo`,
    pre: "Entre no Hub, aprenda com a Biblioteca e treine com a Gui — tudo pronto pra você começar.",
    intro: `É um prazer te receber no time. Abaixo está seu acesso ao <b style="color:${B.ink}">Hub do Vendedor</b> — o lugar onde você aprende, treina e fecha. Guarde este e-mail.`,
    accessLbl: "Seu acesso", emailLbl: "E-mail", codeLbl: "Seu código pessoal", refLbl: "Seu link de indicação",
    toolsLbl: "🧰 Comece por aqui", explore: "Entre, olhe tudo com calma e mexa à vontade — nada quebra, é seu espaço de treino.",
    t1: ["📚 Biblioteca", "os pitch cards — dor → solução → ganho, prontos pra usar na reunião"],
    t2: ["🎤 Treino com a Gui", "pratique o pitch conversando com a IA até ficar afiado"],
    t3: ["🧮 Gerador de orçamento", "monte uma proposta premium em segundos pro cliente"],
    cta: "🔑 Entrar no Hub agora →", cta2: "💬 Falar com o Luis",
    wa: "Oi Luis! Recebi meu acesso ao Hub do Vendedor e tô começando.",
  } : {
    h1: "Your access is ready 🌱", subj: `🔑 ${nm}, your access to the Guileo Seller Hub`,
    pre: "Log into the Hub, learn from the Library and practice with Gui — all set for you to start.",
    intro: `Glad to have you on the team. Below is your access to the <b style="color:${B.ink}">Seller Hub</b> — where you learn, practice and close. Keep this email.`,
    accessLbl: "Your access", emailLbl: "Email", codeLbl: "Your personal code", refLbl: "Your referral link",
    toolsLbl: "🧰 Start here", explore: "Log in, look around and play with everything — nothing breaks, it's your practice space.",
    t1: ["📚 Library", "the pitch cards — pain → solution → gain, ready to use in the meeting"],
    t2: ["🎤 Practice with Gui", "rehearse your pitch talking to the AI until it's sharp"],
    t3: ["🧮 Quote generator", "build a premium proposal for the client in seconds"],
    cta: "🔑 Enter the Hub now →", cta2: "💬 Message Luis",
    wa: "Hi Luis! I got my Seller Hub access and I'm getting started.",
  };
  const line = (lbl, val, mono) => `
    <tr><td style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <span style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:${B.muted};">${lbl}</span><br/>
      <span style="font-family:${mono ? "'SF Mono',ui-monospace,Menlo,Consolas,monospace" : "'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif"};font-size:15px;font-weight:800;color:${mono ? B.gold : B.ink};">${val}</span>
    </td></tr>`;
  const row = (ic_ttl, sub) => `
    <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;font-weight:800;color:${B.ink};">${ic_ttl}</span><br/>
      <span style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};">${sub}</span>
    </td></tr>`;
  const refUrl = ref ? `${B.site}/?ref=${encodeURIComponent(ref)}` : "";
  const body = `
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:900;letter-spacing:-.3px;color:${B.ink};">${T.h1}</div>
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:800;color:${B.gold};margin-top:6px;">${nm} 🌱</div>
  <div class="g-intro" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink2};line-height:1.72;margin-top:14px;">${T.intro}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:${B.gold};padding-bottom:6px;">${T.accessLbl}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${email ? line(T.emailLbl, esc(email), false) : ""}
      ${line(T.codeLbl, esc(code || "—"), true)}
      ${refUrl ? line(T.refLbl, esc(refUrl), false) : ""}
    </table>`)}
  <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:${B.gold};padding-bottom:8px;">${T.toolsLbl}</div>
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:${B.ink2};line-height:1.6;padding-bottom:6px;">${T.explore}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row(T.t1[0], T.t1[1])}
      ${row(T.t2[0], T.t2[1])}
      ${row(T.t3[0], T.t3[1])}
    </table>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  ${cta(T.cta, `${B.site}/vendedor`)}
  <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
  ${cta2(T.cta2, "https://wa.me/19295350191?text=" + encodeURIComponent(T.wa))}`;
  return { subject: T.subj, html: shell({ preheader: T.pre, body, lang: pt ? "pt" : "en" }) };
}

// 9) WEEKLY CLIENT REPORT — owner-facing "Your Gui this week": the week's numbers + highlights.
export function weeklyReportEmail({ name = "there", business = "your business", lang = "en", weekLabel = "", stats = {}, highlights = [], sentiment = null } = {}) {
  name = esc(name); business = esc(business); weekLabel = esc(weekLabel);
  const s = {
    conversations: Number(stats.conversations || 0),
    bookings: Number(stats.bookings || 0),
    leads: Number(stats.leads || 0),
    messages: Number(stats.messages || 0),
    revenue: Number(stats.revenue || 0),
  };
  const rev = `$${s.revenue.toLocaleString("en-US")}`;
  highlights = (Array.isArray(highlights) ? highlights : []).slice(0, 6).map((h) => esc(h));
  const t = lang === "pt" ? {
    subject: `🌱 Seu Gui esta semana: ${s.bookings} agendamentos · ${rev} movimentados`,
    pre: `${business} — ${s.bookings} agendamentos e ${rev} movimentados esta semana. Está tudo certo, pode descansar.`,
    eyebrow: "Seu Gui esta semana",
    h1: "Seu Gui esta semana",
    intro: `Olá, ${name} — aqui está o que o Gui cuidou por <span style="color:${B.ink};font-weight:600;">${business}</span>${weekLabel ? ` <span style="color:${B.muted};">(${weekLabel})</span>` : ""}, enquanto você cuidava do que importa.`,
    labels: { conversations: "Conversas", bookings: "Agendamentos", leads: "Leads", messages: "Mensagens", revenue: "Movimentado" },
    highlightsTitle: "Destaques",
    sentTitle: "Como seus clientes se sentiram",
    sentHappy: "saíram felizes",
    sentPos: "Felizes", sentNeu: "Neutros", sentNeg: "Insatisfeitos",
    sentAvg: "Duração média",
    autopilot: "Está tudo certo, pode descansar — seu Gui não dorme.",
    cta: "Ver meu painel →",
    foot: "Qualquer coisa, é só chamar — alguém de verdade lê cada mensagem.",
  } : lang === "es" ? {
    subject: `🌱 Su Gui esta semana: ${s.bookings} citas · ${rev} generados`,
    pre: `${business} — ${s.bookings} citas y ${rev} generados esta semana. Todo está en orden, descanse tranquilo.`,
    eyebrow: "Su Gui esta semana",
    h1: "Su Gui esta semana",
    intro: `Hola, ${name} — esto es lo que Gui atendió por <span style="color:${B.ink};font-weight:600;">${business}</span>${weekLabel ? ` <span style="color:${B.muted};">(${weekLabel})</span>` : ""}, mientras usted se ocupaba de lo importante.`,
    labels: { conversations: "Conversaciones", bookings: "Citas", leads: "Leads", messages: "Mensajes", revenue: "Generado" },
    highlightsTitle: "Destacados",
    sentTitle: "Cómo se sintieron sus clientes",
    sentHappy: "salieron contentos",
    sentPos: "Contentos", sentNeu: "Neutros", sentNeg: "Insatisfechos",
    sentAvg: "Duración media",
    autopilot: "Todo está en orden, descanse tranquilo — su Gui no duerme.",
    cta: "Ver mi panel →",
    foot: "Para lo que necesite, solo responda — una persona de verdad lee cada mensaje.",
  } : {
    subject: `🌱 Your Gui this week: ${s.bookings} bookings · ${rev} driven`,
    pre: `${business} — ${s.bookings} bookings and ${rev} driven this week. It's all taken care of — rest easy.`,
    eyebrow: "Your Gui this week",
    h1: "Your Gui this week",
    intro: `Hello, ${name} — here's what Gui tended to for <span style="color:${B.ink};font-weight:600;">${business}</span>${weekLabel ? ` <span style="color:${B.muted};">(${weekLabel})</span>` : ""}, while you tended to what matters.`,
    labels: { conversations: "Conversations", bookings: "Bookings", leads: "Leads", messages: "Messages", revenue: "Driven" },
    highlightsTitle: "Highlights",
    sentTitle: "How your callers felt",
    sentHappy: "left happy",
    sentPos: "Happy", sentNeu: "Neutral", sentNeg: "Unhappy",
    sentAvg: "Avg call time",
    autopilot: "It's all taken care of, rest easy — your Gui never sleeps.",
    cta: "See my dashboard →",
    foot: "Whenever you need anything, just reply — a real person reads every message.",
  };
  const num = (n, label, color, grow = "") => `<td align="center" width="20%" class="g-stat" style="padding:14px 4px;">
    <div class="g-statnum" style="font-size:28px;font-weight:800;color:${color};font-family:'Segoe UI',Arial,sans-serif;letter-spacing:-.5px;text-shadow:0 1px 0 rgba(0,0,0,0.4);${grow}">${n}</div>
    <div style="font-size:9.5px;color:${B.muted};text-transform:uppercase;letter-spacing:1.2px;font-family:'Segoe UI',Arial,sans-serif;margin-top:3px;">${label}</div></td>`;
  const hl = (x) => `<tr><td style="padding:5px 0;font-family:'Segoe UI',Arial,sans-serif;font-size:13.5px;color:${B.ink2};line-height:1.55;">
    <span style="color:${B.green};font-weight:800;">✓</span> ${x}</td></tr>`;
  const body = `
  <h1 style="margin:4px 0 2px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:25px;line-height:1.15;font-weight:900;color:${B.ink};letter-spacing:-0.5px;">${t.h1}${weekLabel ? ` <span style="color:${B.gold};font-weight:700;">— ${weekLabel}</span>` : ""}</h1>
  <div class="g-intro" style="font-size:16px;color:${B.ink2};line-height:1.72;margin-top:12px;">${t.intro}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${B.panel};background-image:linear-gradient(180deg,#1f1d18 0%,${B.panel} 60%);border:1px solid ${B.line};border-radius:16px;box-shadow:inset 0 1px 0 ${B.edge},0 18px 40px -30px rgba(0,0,0,0.8);"><tr>
    ${num(s.conversations, t.labels.conversations, B.ink)}
    ${num(s.bookings, t.labels.bookings, B.ink)}
    ${num(s.leads, t.labels.leads, B.ink)}
    ${num(s.messages, t.labels.messages, B.ink)}
    ${num(rev, t.labels.revenue, B.green, "font-weight:800;")}
  </tr></table>
  ${highlights.length ? `<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};font-family:'Segoe UI',Arial,sans-serif;margin-bottom:6px;">${t.highlightsTitle}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${highlights.map(hl).join("")}</table>`)}` : ""}
  ${sentiment && sentiment.total ? `<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};font-family:'Segoe UI',Arial,sans-serif;margin-bottom:10px;">${t.sentTitle}</div>
    <div style="font-size:30px;font-weight:800;color:${B.green};font-family:'Segoe UI',Arial,sans-serif;letter-spacing:-.5px;line-height:1;">${Number(sentiment.happyPct) || 0}% <span style="font-size:14px;font-weight:600;color:${B.ink2};">${t.sentHappy}</span></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>
      <td align="center" width="33%"><div style="font-size:20px;font-weight:800;color:${B.ink};font-family:'Segoe UI',Arial,sans-serif;">😊 ${Number(sentiment.positive) || 0}</div><div style="font-size:9.5px;color:${B.muted};text-transform:uppercase;letter-spacing:1px;font-family:'Segoe UI',Arial,sans-serif;margin-top:2px;">${t.sentPos}</div></td>
      <td align="center" width="33%"><div style="font-size:20px;font-weight:800;color:${B.ink};font-family:'Segoe UI',Arial,sans-serif;">😐 ${Number(sentiment.neutral) || 0}</div><div style="font-size:9.5px;color:${B.muted};text-transform:uppercase;letter-spacing:1px;font-family:'Segoe UI',Arial,sans-serif;margin-top:2px;">${t.sentNeu}</div></td>
      <td align="center" width="33%"><div style="font-size:20px;font-weight:800;color:${B.ink};font-family:'Segoe UI',Arial,sans-serif;">😞 ${Number(sentiment.negative) || 0}</div><div style="font-size:9.5px;color:${B.muted};text-transform:uppercase;letter-spacing:1px;font-family:'Segoe UI',Arial,sans-serif;margin-top:2px;">${t.sentNeg}</div></td>
    </tr></table>
    ${sentiment.avgSecs ? `<div style="font-size:12px;color:${B.muted};text-align:center;font-family:'Segoe UI',Arial,sans-serif;margin-top:10px;">${t.sentAvg}: <span style="color:${B.ink2};font-weight:600;">${sentiment.avgSecs >= 60 ? `${Math.floor(sentiment.avgSecs / 60)}m ${sentiment.avgSecs % 60}s` : `${sentiment.avgSecs}s`}</span></div>` : ""}`)}` : ""}
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  <div style="font-size:13.5px;color:${B.gold};text-align:center;font-family:'Segoe UI',Arial,sans-serif;font-weight:600;"><span style="color:${B.green};">●</span> ${t.autopilot}</div>
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.portal)}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// 8) CLIENT INTRO — the first-touch email a partner (or Luis) sends a prospect.
export function clientIntroEmail({ name = "tudo bem?", business = "seu negócio", from = "Luis", lang = "pt" } = {}) {
  const body = `
  <img src="${B.site}/email/h1-client-pt.png" width="552" alt="Isso muda o seu mês" style="display:block;max-width:100%;height:auto;border:0;" />
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:800;letter-spacing:.2px;color:${B.gold};margin-top:10px;">${esc(name)} 👋</div>
  <div class="g-intro" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink2};line-height:1.72;margin-top:14px;">
    A Guileo instala um time de IA + marketing que <b style="color:${B.ink}">atende, vende e faz crescer ${esc(business)} com discrição, 24/7</b>. Você escolhe o resultado — deixa o resto com a gente.
  </div>
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:${B.gold};padding-bottom:8px;">Na prática, a Gui (nossa IA):</div>
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:2;color:${B.ink2};">
      📞 Acolhe <b style="color:${B.ink}">toda</b> ligação e mensagem — qualquer idioma, qualquer hora<br/>
      📅 Agenda, qualifica e <b style="color:${B.ink}">fecha vendas</b><br/>
      🔁 Cuida do follow-up de quem sumiu<br/>
      📣 E ainda conduz o seu marketing
    </div>`)}
  <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.8;color:${B.ink2};text-align:center;">
      🌱 No ar em <b style="color:${B.green}">7 dias</b> &nbsp;·&nbsp; 🛡️ Garantia de <b style="color:${B.gold}">30 dias</b> &nbsp;·&nbsp; 🤝 Sempre com um humano por perto
    </div>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:${B.ink};text-align:center;">Quer ver funcionando? <span style="color:${B.gold};">A Gui pode te ligar agora mesmo.</span></div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  ${cta("📞 Quero ouvir a Gui — agendar demo →", "https://cal.com/guileo")}
  <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
  ${cta2("🌐 Conhecer a Guileo", B.site)}
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;">Com um abraço, ${esc(from)} · Guileo</div>`;
  return { subject: `${name}, isso aqui pode transformar o seu mês 🌱`, html: shell({ preheader: "A IA que atende, vende e faz crescer o seu negócio 24/7 — no ar em 7 dias.", body, lang }) };
}

// APPOINTMENT CONFIRMATION — sent to the CUSTOMER when the Gui books/reschedules/cancels.
// kind = book | reschedule | cancel. Includes the reference number so they can quote it.
export function appointmentEmail({ kind = "book", name = "there", business = "", service = "", whenLabel = "", pro = "", location = "", ref = "", lang = "en" } = {}) {
  const rawName = String(name == null ? "" : name).slice(0, 120);
  name = esc(rawName); business = esc(business); service = esc(service); pro = esc(pro); location = esc(location); ref = esc(ref); whenLabel = esc(whenLabel);
  const L = ({
    pt: {
      subj: { book: `Confirmado${business ? " · " + business : ""}: ${whenLabel}`, reschedule: `Remarcado: ${whenLabel}`, cancel: `Cancelado${business ? " · " + business : ""}` },
      pre: { book: "Está tudo certo — seu agendamento está confirmado.", reschedule: "Pronto — seu agendamento foi remarcado.", cancel: "Seu agendamento foi cancelado." },
      eyebrow: business || "Guileo", h: { book: `Está confirmado, ${name} ✅`, reschedule: `Remarcado, ${name} 🔁`, cancel: `Cancelado, ${name}` },
      lead: { book: "Cuidei de tudo — seu horário está reservado:", reschedule: "Pronto — aqui está seu novo horário:", cancel: "Cancelamos este agendamento. Quando quiser, é só chamar a Gui de novo." },
      rows: ["Serviço", "Quando", "Profissional", "Unidade", "Referência"], foot: "Precisa ajustar algo? Responda este email ou ligue — a Gui cuida na hora.",
    },
    es: {
      subj: { book: `Confirmado${business ? " · " + business : ""}: ${whenLabel}`, reschedule: `Reprogramado: ${whenLabel}`, cancel: `Cancelado${business ? " · " + business : ""}` },
      pre: { book: "Todo listo — su cita está confirmada.", reschedule: "Listo — su cita fue reprogramada.", cancel: "Su cita fue cancelada." },
      eyebrow: business || "Guileo", h: { book: `Está confirmado, ${name} ✅`, reschedule: `Reprogramado, ${name} 🔁`, cancel: `Cancelado, ${name}` },
      lead: { book: "Quedó todo listo — su horario está reservado:", reschedule: "Listo — aquí está su nuevo horario:", cancel: "Cancelamos esta cita. Cuando guste, basta llamar a Gui de nuevo." },
      rows: ["Servicio", "Cuándo", "Profesional", "Sede", "Referencia"], foot: "¿Necesita ajustar algo? Responda este correo o llame — Gui lo atiende al instante.",
    },
    en: {
      subj: { book: `Confirmed${business ? " · " + business : ""}: ${whenLabel}`, reschedule: `Rescheduled: ${whenLabel}`, cancel: `Cancelled${business ? " · " + business : ""}` },
      pre: { book: "It's all taken care of — your appointment is confirmed.", reschedule: "Done — your appointment was rescheduled.", cancel: "Your appointment was cancelled." },
      eyebrow: business || "Guileo", h: { book: `You're all set, ${name} ✅`, reschedule: `Rescheduled, ${name} 🔁`, cancel: `Cancelled, ${name}` },
      lead: { book: "It's all taken care of — your spot is reserved:", reschedule: "Done — here is your new time:", cancel: "We've cancelled this appointment. Whenever you're ready, just ask Gui again." },
      rows: ["Service", "When", "With", "Location", "Reference"], foot: "Need to adjust anything? Reply to this email or call — Gui handles it right away.",
    },
  })[lang] || null || {};
  const t = (L && L.subj) ? L : ({ subj: { book: "Confirmed" }, pre: { book: "" }, eyebrow: "Guileo", h: { book: name }, lead: { book: "" }, rows: ["Service", "When", "With", "Location", "Reference"], foot: "" });
  const k = ["book", "reschedule", "cancel"].includes(kind) ? kind : "book";
  const row = (lbl, val) => val ? `<tr><td style="padding:4px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;color:${B.muted};width:34%;">${lbl}</td><td style="padding:4px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:${B.ink};">${val}</td></tr>` : "";
  const details = k === "cancel" ? "" : panel(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row(t.rows[0], service)}${row(t.rows[1], whenLabel)}${row(t.rows[2], pro)}${row(t.rows[3], location)}${row(t.rows[4], ref ? `<span style="color:${B.gold};">${ref}</span>` : "")}
    </table>`);
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:900;color:${B.ink};text-align:center;">${t.h[k]}</div>
    <div style="height:8px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink};text-align:center;line-height:1.6;">${t.lead[k]}</div>
    <div style="height:14px;font-size:0;">&nbsp;</div>
    ${details}
    <div style="height:16px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;">${t.foot}</div>`;
  return { subject: t.subj[k], html: shell({ preheader: t.pre[k], eyebrow: t.eyebrow, body, lang }) };
}

// APPOINTMENT REMINDER — a gentle concierge nudge before an upcoming appointment (EMAIL channel).
// Sent to the CUSTOMER when their contact is an email; this makes reminders actually fire today,
// without waiting for SMS/A2P. Same branded shell + concierge voice as the confirmation.
export function appointmentReminderEmail({ name = "there", business = "", service = "", whenLabel = "", ref = "", lang = "en", bizEmail = "" } = {}) {
  name = esc(name); business = esc(business); service = esc(service); whenLabel = esc(whenLabel); ref = esc(ref);
  const L = ({
    pt: { subj: `Um lembrete gentil${business ? " · " + business : ""}: ${whenLabel}`, pre: "Seu horário está chegando — estamos à sua espera.", eyebrow: business || "Guileo", h: `Até já, ${name} 🌱`, lead: "Passando só para lembrar, com carinho, do seu horário:", rows: ["Serviço", "Quando", "Referência"], foot: "Precisa remarcar? É só responder este email — cuido disso na hora." },
    es: { subj: `Un recordatorio${business ? " · " + business : ""}: ${whenLabel}`, pre: "Su cita se acerca — le esperamos.", eyebrow: business || "Guileo", h: `Hasta pronto, ${name} 🌱`, lead: "Solo un recordatorio, con cariño, de su cita:", rows: ["Servicio", "Cuándo", "Referencia"], foot: "¿Necesita reprogramar? Responda este correo — me encargo al instante." },
    en: { subj: `A gentle reminder${business ? " · " + business : ""}: ${whenLabel}`, pre: "Your appointment is coming up — we're looking forward to it.", eyebrow: business || "Guileo", h: `See you soon, ${name} 🌱`, lead: "Just a warm reminder of your upcoming appointment:", rows: ["Service", "When", "Reference"], foot: "Need to reschedule? Simply reply — I'll take care of it right away." },
  })[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const reLabel = { pt: "Confirmar ou remarcar →", es: "Confirmar o reprogramar →", en: "Confirm or reschedule →" }[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const row = (lbl, val) => val ? `<tr><td style="padding:4px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;color:${B.muted};width:34%;">${lbl}</td><td style="padding:4px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:${B.ink};">${val}</td></tr>` : "";
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:900;color:${B.ink};text-align:center;">${L.h}</div>
    <div style="height:8px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink};text-align:center;line-height:1.6;">${L.lead}</div>
    <div style="height:14px;font-size:0;">&nbsp;</div>
    ${panel(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${row(L.rows[0], service)}${row(L.rows[1], whenLabel)}${row(L.rows[2], ref ? `<span style="color:${B.gold};">${ref}</span>` : "")}</table>`)}
    <div style="height:18px;font-size:0;">&nbsp;</div>
    <div align="center">${cta(reLabel, bizMailto(bizEmail, L.subj, MB.remind[lang] || MB.remind.en))}</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${L.foot}</div>`;
  return { subject: L.subj, html: shell({ preheader: L.pre, eyebrow: L.eyebrow, body, lang }) };
}

// BIRTHDAY — a warm concierge note on the customer's birthday, with a gentle invitation back.
// The retention magic: the business never forgets, automatically. Sent to the CUSTOMER (email).
export function birthdayEmail({ name = "there", business = "", lang = "en" } = {}) {
  name = esc(name); business = esc(business);
  const L = ({
    pt: { subj: `Feliz aniversário, ${name}! 🎉`, pre: "Um carinho da nossa parte no seu dia.", eyebrow: business || "Guileo", h: `Feliz aniversário, ${name}! 🎂`, lead: `Hoje é o seu dia — e a gente${business ? ` da ${business}` : ""} faz questão de comemorar com você. Que seja um ano lindo, cheio de coisas boas. 🌱`, gift: "Tem um mimo te esperando: passa pra comemorar com a gente esse mês. É só responder este email que eu cuido de tudo.", foot: "Com carinho — o Gui, sempre por aqui." },
    es: { subj: `¡Feliz cumpleaños, ${name}! 🎉`, pre: "Un cariño de nuestra parte en tu día.", eyebrow: business || "Guileo", h: `¡Feliz cumpleaños, ${name}! 🎂`, lead: `Hoy es tu día — y${business ? ` en ${business}` : ""} queremos celebrarlo contigo. Que sea un año hermoso. 🌱`, gift: "Tienes un detalle esperándote: ven a celebrar con nosotros este mes. Responde este correo y me encargo de todo.", foot: "Con cariño — Gui, siempre aquí." },
    en: { subj: `Happy birthday, ${name}! 🎉`, pre: "A little warmth from us on your day.", eyebrow: business || "Guileo", h: `Happy birthday, ${name}! 🎂`, lead: `Today is your day — and${business ? ` all of us at ${business}` : " we"} wanted to celebrate it with you. Here's to a beautiful year ahead. 🌱`, gift: "There's a little treat waiting for you: come celebrate with us this month. Just reply and I'll take care of everything.", foot: "Warmly — Gui, always here." },
  })[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:24px;font-weight:900;color:${B.ink};text-align:center;">${L.h}</div>
    <div style="height:10px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink};text-align:center;line-height:1.7;">${L.lead}</div>
    <div style="height:14px;font-size:0;">&nbsp;</div>
    ${panel(`<div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;color:${B.ink2};line-height:1.6;text-align:center;">🎁 ${L.gift}</div>`)}
    <div style="height:16px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;">${L.foot}</div>`;
  return { subject: L.subj, html: shell({ preheader: L.pre, eyebrow: L.eyebrow, body, lang }) };
}

// CLIENT ANNIVERSARY — "X years since your first visit, thank you." A milestone the business never
// tracks by hand; Gui does. Sent to the CUSTOMER (email).
export function anniversaryEmail({ name = "there", business = "", years = 1, lang = "en" } = {}) {
  name = esc(name); business = esc(business); const y = Math.max(1, parseInt(years, 10) || 1);
  const L = ({
    pt: { subj: `${y} ${y === 1 ? "ano" : "anos"} juntos, ${name} 💚`, pre: "Obrigado por fazer parte da nossa história.", eyebrow: business || "Guileo", h: `${y} ${y === 1 ? "ano" : "anos"} com você, ${name} 💚`, lead: `Faz ${y} ${y === 1 ? "ano" : "anos"} que você é parte${business ? ` da ${business}` : " da nossa casa"} — e a gente tem muito a agradecer. Clientes como você são o motivo de tudo isso existir.`, gift: "Pra comemorar, preparei um agrado especial pra sua próxima visita. Quando quiser vir, é só me chamar.", foot: "Com gratidão — o Gui." },
    es: { subj: `${y} ${y === 1 ? "año" : "años"} juntos, ${name} 💚`, pre: "Gracias por ser parte de nuestra historia.", eyebrow: business || "Guileo", h: `${y} ${y === 1 ? "año" : "años"} contigo, ${name} 💚`, lead: `Hace ${y} ${y === 1 ? "año" : "años"} que eres parte${business ? ` de ${business}` : " de nuestra casa"} — y tenemos mucho que agradecer.`, gift: "Para celebrar, preparé un detalle especial para tu próxima visita. Cuando quieras venir, avísame.", foot: "Con gratitud — Gui." },
    en: { subj: `${y} ${y === 1 ? "year" : "years"} together, ${name} 💚`, pre: "Thank you for being part of our story.", eyebrow: business || "Guileo", h: `${y} ${y === 1 ? "year" : "years"} with you, ${name} 💚`, lead: `It's been ${y} ${y === 1 ? "year" : "years"} since you became part${business ? ` of ${business}` : " of our family"} — and we're truly grateful. Customers like you are the reason we do this.`, gift: "To celebrate, I've set aside a little something for your next visit. Whenever you'd like to come in, just let me know.", foot: "With gratitude — Gui." },
  })[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:23px;font-weight:900;color:${B.ink};text-align:center;">${L.h}</div>
    <div style="height:10px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink};text-align:center;line-height:1.7;">${L.lead}</div>
    <div style="height:14px;font-size:0;">&nbsp;</div>
    ${panel(`<div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;color:${B.ink2};line-height:1.6;text-align:center;">💚 ${L.gift}</div>`)}
    <div style="height:16px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;">${L.foot}</div>`;
  return { subject: L.subj, html: shell({ preheader: L.pre, eyebrow: L.eyebrow, body, lang }) };
}

// RECALL — gentle return-by-cadence nudge (e.g. dental cleaning every ~6 months). Pure profit for
// the business; the owner never tracks it by hand. Sent to the CUSTOMER (email).
export function recallEmail({ name = "there", business = "", lang = "en", bizEmail = "" } = {}) {
  name = esc(name); business = esc(business);
  const L = ({
    pt: { subj: `Tá na hora do seu retorno${business ? " · " + business : ""} 🌱`, pre: "Cuidar de você no tempo certo faz toda a diferença.", eyebrow: business || "Guileo", h: `${name}, já faz um tempinho 🌱`, lead: `Reparei que faz um tempo desde sua última visita${business ? ` à ${business}` : ""} — e cuidar disso na hora certa faz toda a diferença. Que tal agendar seu retorno essa semana?`, cta: "Quero agendar meu retorno →", foot: "É só responder este email que eu já cuido do horário pra você." },
    es: { subj: `Es momento de tu regreso${business ? " · " + business : ""} 🌱`, pre: "Cuidarte en el momento justo lo cambia todo.", eyebrow: business || "Guileo", h: `${name}, ya pasó un tiempo 🌱`, lead: `Noté que pasó un tiempo desde tu última visita${business ? ` a ${business}` : ""} — y atenderlo a tiempo importa. ¿Agendamos tu regreso esta semana?`, cta: "Quiero agendar mi regreso →", foot: "Responde este correo y me encargo del horario." },
    en: { subj: `Time for your visit${business ? " · " + business : ""} 🌱`, pre: "Looking after you at the right time makes all the difference.", eyebrow: business || "Guileo", h: `${name}, it's been a little while 🌱`, lead: `I noticed it's been a while since your last visit${business ? ` to ${business}` : ""} — and timing matters. Shall we book your return this week?`, cta: "Book my visit →", foot: "Just reply and I'll arrange the time for you." },
  })[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:900;color:${B.ink};text-align:center;">${L.h}</div>
    <div style="height:10px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink};text-align:center;line-height:1.7;">${L.lead}</div>
    <div style="height:18px;font-size:0;">&nbsp;</div>
    <div align="center">${cta(L.cta, bizMailto(bizEmail, L.subj, MB.recall[lang] || MB.recall.en))}</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${L.foot}</div>`;
  return { subject: L.subj, html: shell({ preheader: L.pre, eyebrow: L.eyebrow, body, lang }) };
}

// LOYALTY MILESTONE — celebrate a visit milestone with a reward. Turns frequency into love + repeat
// revenue. Sent to the CUSTOMER (email).
export function loyaltyMilestoneEmail({ name = "there", business = "", milestone = 10, lang = "en" } = {}) {
  name = esc(name); business = esc(business); const m = Math.max(1, parseInt(milestone, 10) || 10);
  const L = ({
    pt: { subj: `${name}, você chegou a ${m} visitas! 🏆`, pre: "Um agrado pela sua fidelidade.", eyebrow: business || "Guileo", h: `${m} visitas, ${name}! 🏆`, lead: `Que honra ter você de volta tantas vezes${business ? ` na ${business}` : ""}. Clientes fiéis como você merecem um carinho especial — e preparei um pra você.`, gift: "Seu mimo de fidelidade está reservado pra próxima visita. Quando vier, é só me lembrar. 💚", foot: "Obrigado por confiar na gente — o Gui." },
    es: { subj: `¡${name}, llegaste a ${m} visitas! 🏆`, pre: "Un detalle por tu fidelidad.", eyebrow: business || "Guileo", h: `¡${m} visitas, ${name}! 🏆`, lead: `Qué honor tenerte de vuelta tantas veces${business ? ` en ${business}` : ""}. Los clientes fieles como tú merecen un cariño especial.`, gift: "Tu detalle de fidelidad está reservado para tu próxima visita. 💚", foot: "Gracias por confiar en nosotros — Gui." },
    en: { subj: `${name}, you've reached ${m} visits! 🏆`, pre: "A little something for your loyalty.", eyebrow: business || "Guileo", h: `${m} visits, ${name}! 🏆`, lead: `What an honor to have you back so many times${business ? ` at ${business}` : ""}. Loyal customers like you deserve something special — and I've set one aside for you.`, gift: "Your loyalty treat is reserved for your next visit. Just remind me when you come in. 💚", foot: "Thank you for trusting us — Gui." },
  })[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:23px;font-weight:900;color:${B.ink};text-align:center;">${L.h}</div>
    <div style="height:10px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink};text-align:center;line-height:1.7;">${L.lead}</div>
    <div style="height:14px;font-size:0;">&nbsp;</div>
    ${panel(`<div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;color:${B.ink2};line-height:1.6;text-align:center;">🎁 ${L.gift}</div>`)}
    <div style="height:16px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;">${L.foot}</div>`;
  return { subject: L.subj, html: shell({ preheader: L.pre, eyebrow: L.eyebrow, body, lang }) };
}

// FIRST-VISIT WELCOME — a warm welcome after a customer's first visit (email). Opens the relationship.
export function welcomeFirstVisitEmail({ name = "there", business = "", lang = "en" } = {}) {
  name = esc(name); business = esc(business);
  const L = ({
    pt: { subj: `Que bom te receber${business ? " na " + business : ""}, ${name} 🌱`, pre: "Seja muito bem-vindo(a) — é o começo de algo bom.", eyebrow: business || "Guileo", h: `Bem-vindo(a), ${name} 🌱`, lead: `Foi um prazer te receber${business ? ` na ${business}` : ""} pela primeira vez. Espero que tenha se sentido em casa — e quero cuidar de você sempre que precisar.`, gift: "Qualquer coisa, é só me chamar por aqui — agendar, tirar dúvida, o que for. Estou de prontidão. 💚", foot: "Até breve — o Gui." },
    es: { subj: `Qué bueno recibirte${business ? " en " + business : ""}, ${name} 🌱`, pre: "Bienvenido(a) — es el comienzo de algo bueno.", eyebrow: business || "Guileo", h: `Bienvenido(a), ${name} 🌱`, lead: `Fue un placer recibirte${business ? ` en ${business}` : ""} por primera vez. Espero que te hayas sentido en casa.`, gift: "Para lo que necesites, solo escríbeme — agendar, dudas, lo que sea. Estoy aquí. 💚", foot: "Hasta pronto — Gui." },
    en: { subj: `So glad to welcome you${business ? " to " + business : ""}, ${name} 🌱`, pre: "Welcome — it's the start of something good.", eyebrow: business || "Guileo", h: `Welcome, ${name} 🌱`, lead: `It was a pleasure to welcome you${business ? ` to ${business}` : ""} for the first time. I hope you felt at home — and I'm here to look after you whenever you need.`, gift: "For anything at all, just reach out — booking, questions, anything. I'm always here. 💚", foot: "See you soon — Gui." },
  })[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:23px;font-weight:900;color:${B.ink};text-align:center;">${L.h}</div>
    <div style="height:10px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink};text-align:center;line-height:1.7;">${L.lead}</div>
    <div style="height:14px;font-size:0;">&nbsp;</div>
    ${panel(`<div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;color:${B.ink2};line-height:1.6;text-align:center;">🌱 ${L.gift}</div>`)}
    <div style="height:16px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;">${L.foot}</div>`;
  return { subject: L.subj, html: shell({ preheader: L.pre, eyebrow: L.eyebrow, body, lang }) };
}

// REBOOK — follow up with a customer who asked to reschedule, to actually lock a new time (email).
export function rebookEmail({ name = "there", business = "", service = "", lang = "en", bizEmail = "" } = {}) {
  name = esc(name); business = esc(business); service = esc(service);
  const L = ({
    pt: { subj: `Vamos achar um novo horário, ${name}? 🌱`, pre: "Deixa que eu remarco pra você, sem complicação.", eyebrow: business || "Guileo", h: `${name}, vamos remarcar 🌱`, lead: `Você pediu pra remarcar${service ? ` ${service}` : " seu horário"} — e tá tudo certo, deixa comigo. Me diz um dia bom que eu já encaixo o melhor horário pra você.`, cta: "Escolher novo horário →", foot: "É só responder este email — eu cuido do resto." },
    es: { subj: `¿Buscamos un nuevo horario, ${name}? 🌱`, pre: "Yo te reprogramo, sin complicaciones.", eyebrow: business || "Guileo", h: `${name}, reprogramemos 🌱`, lead: `Pediste reprogramar${service ? ` ${service}` : " tu cita"} — y está perfecto, déjamelo a mí. Dime un buen día y te encuentro el mejor horario.`, cta: "Elegir nuevo horario →", foot: "Solo responde este correo — yo me encargo." },
    en: { subj: `Let's find a new time, ${name}? 🌱`, pre: "I'll reschedule it for you, simply.", eyebrow: business || "Guileo", h: `${name}, let's rebook 🌱`, lead: `You asked to reschedule${service ? ` ${service}` : " your appointment"} — and that's no trouble at all, leave it with me. Tell me a good day and I'll find the best time for you.`, cta: "Pick a new time →", foot: "Just reply to this email — I'll handle the rest." },
  })[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:900;color:${B.ink};text-align:center;">${L.h}</div>
    <div style="height:10px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink};text-align:center;line-height:1.7;">${L.lead}</div>
    <div style="height:18px;font-size:0;">&nbsp;</div>
    <div align="center">${cta(L.cta, bizMailto(bizEmail, L.subj, MB.rebook[lang] || MB.rebook.en))}</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${L.foot}</div>`;
  return { subject: L.subj, html: shell({ preheader: L.pre, eyebrow: L.eyebrow, body, lang }) };
}

// MARKETING DATE / FLASH PROMO — a per-business commemorative-date or slow-day nudge to the CUSTOMER
// (email). Copy is business-authored (headline/message/offer come from biz_marketing_dates or the
// slow-day sweep); falls back to a warm generic invite when a field is blank. One-tap CTA to the biz.
export function promoEmail({ name = "there", business = "", headline = "", message = "", offer = "", lang = "en", bizEmail = "" } = {}) {
  name = esc(name); business = esc(business); headline = esc(headline); message = esc(message); offer = esc(offer);
  const L = ({
    pt: { subj: headline || `Uma novidade pra você${business ? " · " + business : ""} 🌱`, pre: "Um convite especial, feito com carinho pra você.", eyebrow: business || "Guileo", h: headline || `${name}, tenho algo pra você 🌱`, lead: message || `Passei aqui só pra te fazer um convite${business ? ` da ${business}` : ""} — adoraríamos te receber. Que tal marcar um horário essa semana?`, gift: "Seu presente:", cta: "Quero aproveitar →", foot: "É só responder este email que eu já cuido do seu horário." },
    es: { subj: headline || `Una novedad para ti${business ? " · " + business : ""} 🌱`, pre: "Una invitación especial, hecha con cariño para ti.", eyebrow: business || "Guileo", h: headline || `${name}, tengo algo para ti 🌱`, lead: message || `Pasé solo para invitarte${business ? ` de ${business}` : ""} — nos encantaría recibirte. ¿Agendamos un horario esta semana?`, gift: "Tu regalo:", cta: "Quiero aprovechar →", foot: "Responde este correo y me encargo de tu horario." },
    en: { subj: headline || `Something for you${business ? " · " + business : ""} 🌱`, pre: "A special invitation, made warmly for you.", eyebrow: business || "Guileo", h: headline || `${name}, I've got something for you 🌱`, lead: message || `Just reaching out with an invitation${business ? ` from ${business}` : ""} — we'd love to have you in. Shall we book a time this week?`, gift: "Your treat:", cta: "Count me in →", foot: "Just reply to this email and I'll arrange your time." },
  })[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:23px;font-weight:900;color:${B.ink};text-align:center;">${L.h}</div>
    <div style="height:10px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink};text-align:center;line-height:1.7;">${L.lead}</div>
    ${offer ? `<div style="height:14px;font-size:0;">&nbsp;</div>${panel(`<div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;color:${B.ink2};line-height:1.6;text-align:center;">🎁 <b>${L.gift}</b> ${offer}</div>`)}` : ""}
    <div style="height:18px;font-size:0;">&nbsp;</div>
    <div align="center">${cta(L.cta, bizMailto(bizEmail, L.subj, MB.rebook[lang] || MB.rebook.en))}</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${L.foot}</div>`;
  return { subject: L.subj, html: shell({ preheader: L.pre, eyebrow: L.eyebrow, body, lang }) };
}

// WAITLIST OPENING — a slot the customer was waiting for just freed up. Sent to the CUSTOMER (email)
// the instant an appointment is cancelled, so the freed time gets filled. One-tap reply to grab it.
export function waitlistOfferEmail({ name = "there", business = "", service = "", lang = "en", bizEmail = "" } = {}) {
  name = esc(name); business = esc(business); service = esc(service);
  const L = ({
    pt: { subj: `Abriu uma vaga${service ? " pra " + service : ""}! 🌱`, pre: "Aquele horário que você queria acabou de abrir.", eyebrow: business || "Guileo", h: `${name}, abriu uma vaga! 🌱`, lead: `Boa notícia — acabou de abrir um horário${service ? ` pra ${service}` : ""}${business ? ` na ${business}` : ""}. Você estava na lista de espera, então quis te avisar primeiro. Quer que eu reserve pra você?`, cta: "Quero essa vaga →", foot: "É só responder este email — quem responder primeiro garante o horário." },
    es: { subj: `¡Se liberó un lugar${service ? " para " + service : ""}! 🌱`, pre: "Ese horario que querías acaba de liberarse.", eyebrow: business || "Guileo", h: `¡${name}, se liberó un lugar! 🌱`, lead: `Buena noticia — acaba de liberarse un horario${service ? ` para ${service}` : ""}${business ? ` en ${business}` : ""}. Estabas en la lista de espera, así que quise avisarte primero. ¿Lo reservo para ti?`, cta: "Quiero ese lugar →", foot: "Responde este correo — el primero en responder se queda con el horario." },
    en: { subj: `A spot just opened${service ? " for " + service : ""}! 🌱`, pre: "The time you were waiting for just opened up.", eyebrow: business || "Guileo", h: `${name}, a spot just opened! 🌱`, lead: `Good news — a time just opened up${service ? ` for ${service}` : ""}${business ? ` at ${business}` : ""}. You were on the waitlist, so I wanted to let you know first. Want me to hold it for you?`, cta: "I'll take it →", foot: "Just reply to this email — first to reply gets the spot." },
  })[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:900;color:${B.ink};text-align:center;">${L.h}</div>
    <div style="height:10px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink};text-align:center;line-height:1.7;">${L.lead}</div>
    <div style="height:18px;font-size:0;">&nbsp;</div>
    <div align="center">${cta(L.cta, bizMailto(bizEmail, L.subj, MB.rebook[lang] || MB.rebook.en))}</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${L.foot}</div>`;
  return { subject: L.subj, html: shell({ preheader: L.pre, eyebrow: L.eyebrow, body, lang }) };
}

// UNHAPPY-CALL ALERT — owner-facing. Fires the moment a call is classified negative so the
// owner can win the customer back before it becomes a 1-star review. Includes the AI's read
// + a short transcript excerpt. Recipient is the business owner (their own call data).
export function callAlertEmail({ name = "there", business = "", lang = "en", intent = "", note = "", whenLabel = "", durationLabel = "", transcript = [], portalUrl = "https://guileoai.com/portal" } = {}) {
  name = esc(name); business = esc(business); intent = esc(intent); note = esc(note); whenLabel = esc(whenLabel); durationLabel = esc(durationLabel);
  const turns = (Array.isArray(transcript) ? transcript : []).slice(-6);
  const L = ({
    pt: { subj: `⚠️ Um cliente saiu insatisfeito numa ligação${business ? " · " + business : ""}`, pre: "Um retorno breve seu costuma reverter — antes de virar uma avaliação ruim.", eyebrow: business || "Guileo", h: "Um cliente não saiu feliz 😞", lead: `Olá, ${name} — o Gui percebeu uma ligação com clima delicado e achou melhor lhe avisar. Um retorno breve seu costuma reverter isso com facilidade, antes de virar um review de 1 estrela.`, rIntent: "Assunto", rWhen: "Quando", rDur: "Duração", rNote: "Leitura do Gui", txTitle: "Trecho da conversa", cta: "Ver a ligação completa →", foot: "Uma sugestão: um telefonema ou WhatsApp em até 1h — é quando a reconquista funciona melhor." },
    es: { subj: `⚠️ Un cliente quedó insatisfecho en una llamada${business ? " · " + business : ""}`, pre: "Un retorno breve suele revertirlo — antes de que sea una mala reseña.", eyebrow: business || "Guileo", h: "Un cliente no quedó feliz 😞", lead: `Hola, ${name} — Gui percibió una llamada con un tono delicado y prefirió avisarle. Un retorno breve suele revertirlo con facilidad, antes de una reseña de 1 estrella.`, rIntent: "Asunto", rWhen: "Cuándo", rDur: "Duración", rNote: "Lectura de Gui", txTitle: "Fragmento de la conversación", cta: "Ver la llamada completa →", foot: "Una sugerencia: una llamada o WhatsApp en menos de 1h — es cuando la reconquista funciona mejor." },
    en: { subj: `⚠️ A customer left unhappy on a call${business ? " · " + business : ""}`, pre: "A brief callback usually turns it around — before it becomes a poor review.", eyebrow: business || "Guileo", h: "A customer wasn't happy 😞", lead: `Hello, ${name} — Gui sensed a call with a delicate tone and thought it best to let you know. A brief callback from you usually turns it around with ease, before it becomes a 1-star review.`, rIntent: "About", rWhen: "When", rDur: "Duration", rNote: "Gui's read", txTitle: "Conversation excerpt", cta: "See the full call →", foot: "A suggestion: a call or WhatsApp within the hour — that's when recovery works best." },
  })[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const row = (lbl, val) => val ? `<tr><td style="padding:4px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;color:${B.muted};width:34%;">${lbl}</td><td style="padding:4px 0;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:${B.ink};">${val}</td></tr>` : "";
  const tx = turns.length ? panel(`<div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};font-family:'Segoe UI',Arial,sans-serif;margin-bottom:8px;">${L.txTitle}</div>
    ${turns.map((t) => `<div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:${B.ink2};margin:3px 0;"><b style="color:${t.r === "gui" ? B.green : B.ink};">${t.r === "gui" ? "Gui" : (lang === "pt" ? "Cliente" : lang === "es" ? "Cliente" : "Customer")}:</b> ${esc((t.t || "").slice(0, 160))}</div>`).join("")}`) : "";
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:900;color:${B.ink};text-align:center;">${L.h}</div>
    <div style="height:8px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink};text-align:center;line-height:1.6;">${L.lead}</div>
    <div style="height:14px;font-size:0;">&nbsp;</div>
    ${panel(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${row(L.rIntent, intent)}${row(L.rWhen, whenLabel)}${row(L.rDur, durationLabel)}${row(L.rNote, note ? `<span style="color:${B.gold};">${note}</span>` : "")}</table>`)}
    ${tx ? `<div style="height:12px;font-size:0;">&nbsp;</div>${tx}` : ""}
    <div style="height:20px;font-size:0;">&nbsp;</div>
    <div align="center">${cta(L.cta, portalUrl)}</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${L.foot}</div>`;
  return { subject: L.subj, html: shell({ preheader: L.pre, eyebrow: L.eyebrow, body, lang }) };
}

// SELLER QUOTE — a logged-in seller emails the quote they just built TO THEMSELVES (forward model:
// recipient is always the seller's OWN inbox, never an arbitrary client — anti-phishing). The body
// presents the plain-text `summary` block (rendered with preserved line breaks) for `clientName`,
// with a friendly nudge telling the seller to forward it on to their client.
export function sellerQuoteEmail({ sellerName = "", clientName = "", summary = "", lang = "en" } = {}) {
  sellerName = esc(sellerName); clientName = esc(clientName);
  const L = ({
    pt: {
      subject: `📄 Orçamento${clientName ? ` — ${clientName}` : ""}`,
      pre: `Seu orçamento está pronto. Encaminhe pro seu cliente.`,
      eyebrow: "Orçamento Guileo",
      h: `Orçamento pronto${clientName ? ` para ${clientName}` : ""}`,
      lead: sellerName ? `Olá, ${sellerName} — aqui está o orçamento que você acabou de montar.` : "Aqui está o orçamento que você acabou de montar.",
      label: "Resumo do orçamento",
      fwd: "💡 É só encaminhar este e-mail direto pro seu cliente.",
    },
    es: {
      subject: `📄 Presupuesto${clientName ? ` — ${clientName}` : ""}`,
      pre: `Tu presupuesto está listo. Reenvíalo a tu cliente.`,
      eyebrow: "Presupuesto Guileo",
      h: `Presupuesto listo${clientName ? ` para ${clientName}` : ""}`,
      lead: sellerName ? `Hola, ${sellerName} — aquí está el presupuesto que acabas de crear.` : "Aquí está el presupuesto que acabas de crear.",
      label: "Resumen del presupuesto",
      fwd: "💡 Solo reenvía este correo directo a tu cliente.",
    },
    en: {
      subject: `📄 Quote${clientName ? ` — ${clientName}` : ""}`,
      pre: `Your quote is ready. Forward it to your client.`,
      eyebrow: "Guileo quote",
      h: `Quote ready${clientName ? ` for ${clientName}` : ""}`,
      lead: sellerName ? `Hi ${sellerName} — here's the quote you just built.` : "Here's the quote you just built.",
      label: "Quote summary",
      fwd: "💡 Just forward this email straight to your client.",
    },
  })[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const summaryHtml = esc(summary).replace(/\r?\n/g, "<br/>");
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:900;color:${B.ink};">${L.h}</div>
    <div style="height:8px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:16px;color:${B.ink2};line-height:1.6;">${L.lead}</div>
    <div style="height:16px;font-size:0;">&nbsp;</div>
    ${panel(`<div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};font-family:'Inter','Segoe UI',Arial,sans-serif;margin-bottom:10px;">${L.label}</div>
      <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:${B.ink};">${summaryHtml}</div>`)}
    <div style="height:18px;font-size:0;">&nbsp;</div>
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:13px;color:${B.muted};line-height:1.6;">${L.fwd}</div>`;
  return { subject: L.subject, html: shell({ preheader: L.pre, eyebrow: L.eyebrow, body, lang }) };
}

// ── SELLER COLD OUTREACH — the first email a Growth Partner sends a prospect. ──
// Dor-first (missed calls = money out the door), THE master sentence, ONE CTA to
// the live demo (guileoai.com → prospect drops their number, Gui calls them).
// The sentence mirrors src/data/salesKit.js MASTER_SENTENCE — keep in sync by hand
// (functions can't import from src/ at build time).
export function sellerOutreachEmail({ prospectName = "", business = "", vertical = "", lang = "en" } = {}) {
  prospectName = esc(String(prospectName).slice(0, 120));
  business = esc(String(business).slice(0, 160));
  vertical = esc(String(vertical).slice(0, 80));
  const SENTENCE = {
    pt: "A Guileo instala um funcionário que nunca dorme: atende, agenda, vende e COBRA por você — e custa menos que um dia de garçom.",
    es: "Guileo instala un empleado que nunca duerme: contesta, agenda, vende y COBRA por ti — y cuesta menos que un día de sueldo de un mesero.",
    en: "Guileo installs an employee that never sleeps: answers, books, sells and COLLECTS for you — for less than a day of one waiter's pay.",
  };
  const L = ({
    pt: {
      subject: business ? `${business}: quantas ligações vocês perderam essa semana?` : "Quantas ligações você perdeu essa semana?",
      pre: "Cada ligação perdida vale $50–100. Deixa a Gui te ligar e provar em 2 minutos.",
      eyebrow: "Guileo · uma pergunta rápida",
      hi: prospectName ? `Oi, ${prospectName}` : "Oi, tudo bem?",
      pain: `Toda vez que o telefone ${business ? `de <b style="color:${B.ink};">${business}</b>` : "do seu negócio"} toca e ninguém atende — no almoço, à noite, no domingo — um cliente que já ia comprar liga pro concorrente. ${vertical ? `Em ${vertical}, cada` : "Cada"} ligação perdida vale uns <b style="color:${B.gold};">$50–100</b>. Some isso no mês.`,
      label: "A frase que resume tudo",
      why: "Não precisa acreditar em mim: em guileoai.com você coloca seu número e a <b>Gui te liga em segundos</b>, ao vivo. Ouve a voz, faz perguntas, julga você mesmo.",
      cta: "⚡ Deixa a Gui te ligar agora →",
      ps: "P.S. Garantia de 30 dias — não valeu, devolvemos. O risco é nosso.",
      sign: "Quem lê e responde aqui é gente de verdade.",
    },
    es: {
      subject: business ? `${business}: ¿cuántas llamadas perdieron esta semana?` : "¿Cuántas llamadas perdiste esta semana?",
      pre: "Cada llamada perdida vale $50–100. Deja que Gui te llame y lo pruebe en 2 minutos.",
      eyebrow: "Guileo · una pregunta rápida",
      hi: prospectName ? `Hola, ${prospectName}` : "Hola, ¿qué tal?",
      pain: `Cada vez que el teléfono ${business ? `de <b style="color:${B.ink};">${business}</b>` : "de tu negocio"} suena y nadie contesta — en el almuerzo, de noche, el domingo — un cliente que ya iba a comprar llama al competidor. ${vertical ? `En ${vertical}, cada` : "Cada"} llamada perdida vale unos <b style="color:${B.gold};">$50–100</b>. Súmalo al mes.`,
      label: "La frase que lo resume todo",
      why: "No tienes que creerme: en guileoai.com pones tu número y <b>Gui te llama en segundos</b>, en vivo. Escucha la voz, haz preguntas, júzgalo tú mismo.",
      cta: "⚡ Deja que Gui te llame ahora →",
      ps: "P.D. Garantía de 30 días — si no vale la pena, devolvemos. El riesgo es nuestro.",
      sign: "Quien lee y responde aquí es una persona de verdad.",
    },
    en: {
      subject: business ? `${business}: how many calls did you miss this week?` : "How many calls did you miss this week?",
      pre: "Every missed call is worth $50–100. Let Gui call you and prove it in 2 minutes.",
      eyebrow: "Guileo · one quick question",
      hi: prospectName ? `Hi ${prospectName}` : "Hi there",
      pain: `Every time the phone ${business ? `at <b style="color:${B.ink};">${business}</b>` : "at your business"} rings and no one picks up — at lunch, at night, on Sunday — a customer who was ready to buy calls your competitor. ${vertical ? `In ${vertical}, every` : "Every"} missed call is worth <b style="color:${B.gold};">$50–100</b>. Add that up over a month.`,
      label: "The one sentence that says it all",
      why: "You don't have to take my word for it: at guileoai.com you drop your number and <b>Gui calls you in seconds</b>, live. Hear the voice, ask it questions, judge for yourself.",
      cta: "⚡ Let Gui call you now →",
      ps: "P.S. 30-day money-back guarantee — not worth it, we refund. The risk is ours.",
      sign: "A real person reads and answers every reply here.",
    },
  })[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const sentence = SENTENCE[lang === "pt" ? "pt" : lang === "es" ? "es" : "en"];
  const body = `
    <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:900;color:${B.ink};letter-spacing:-.3px;">${L.hi} 👋</div>
    <div style="height:10px;font-size:0;">&nbsp;</div>
    <p style="margin:0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.7;color:${B.ink2};">${L.pain}</p>
    <div style="height:18px;font-size:0;">&nbsp;</div>
    ${panel(`<div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};font-family:'Inter','Segoe UI',Arial,sans-serif;margin-bottom:8px;">${L.label}</div>
      <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;font-weight:700;font-style:italic;color:${B.ink};">“${sentence}”</div>`)}
    <div style="height:18px;font-size:0;">&nbsp;</div>
    <p style="margin:0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.7;color:${B.ink2};">${L.why}</p>
    <div style="height:18px;font-size:0;">&nbsp;</div>
    <div align="center">${cta(L.cta, B.site)}</div>
    <div style="height:16px;font-size:0;">&nbsp;</div>
    <p style="margin:0 0 8px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:${B.ink2};">${L.ps}</p>
    <p style="margin:0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${B.muted};">${L.sign}</p>`;
  return { subject: L.subject, html: shell({ preheader: L.pre, eyebrow: L.eyebrow, body, lang }) };
}

// ROI REPORT — post-demo "your free analysis": an HONEST industry-average estimate of monthly
// revenue at risk from missed calls, sent right after the prospect tries the live call.
// Numbers mirror the site's per-vertical `lose` figures (ResultsV2 / seoVerticals) and the
// copy explicitly labels them as an estimate — never presented as measured data.
export function roiReportEmail({ name = "there", business = "", vertical = "", loseMonthly = 4500, lang = "en" } = {}) {
  const rawName = String(name == null ? "" : name).slice(0, 120);
  name = esc(rawName); business = esc(business); vertical = esc(vertical);
  const n = Math.max(0, Math.round(Number(loseMonthly) || 0));
  const money = `$${n.toLocaleString("en-US")}`;
  const yearly = `$${(n * 12).toLocaleString("en-US")}`;
  const biz = business ? ` <span style="color:${B.ink};font-weight:600;">${business}</span>` : "";
  const T = {
    pt: {
      subject: `${rawName}, sua análise grátis: ~${money}/mês em risco 📊`,
      pre: "Estimativa honesta do que ligações perdidas custam por mês — e como recuperar.",
      eyebrow: "Guileo · sua análise grátis",
      h1: `Sua análise, ${name} 📊`,
      intro: `Como prometido — uma estimativa honesta do que ligações não atendidas podem custar${biz} todo mês.`,
      bigLabel: "Receita estimada em risco / mês",
      how: `Como calculamos: <b>estimativa</b> baseada em médias do setor${vertical ? ` (${vertical})` : ""} — ~30% das ligações para negócios locais não são atendidas, e cada uma é um pedido, agendamento ou orçamento que vai pro concorrente. Não é uma medição do seu negócio; é o tamanho típico do vazamento.`,
      year: `Em 12 meses, isso chega a <b style="color:${B.gold};">~${yearly}</b>.`,
      fix: "A Gui atende 100% das ligações, 24/7, agenda e vende — a partir de $149/mês. A conta se paga na primeira semana.",
      cta: "Ver planos e recuperar isso →",
      foot: "Responda este email com qualquer dúvida — quem lê é gente de verdade.",
    },
    es: {
      subject: `${rawName}, su análisis gratis: ~${money}/mes en riesgo 📊`,
      pre: "Estimación honesta de lo que cuestan las llamadas perdidas al mes — y cómo recuperarlo.",
      eyebrow: "Guileo · su análisis gratis",
      h1: `Su análisis, ${name} 📊`,
      intro: `Como prometido — una estimación honesta de lo que las llamadas no contestadas pueden costar${biz} cada mes.`,
      bigLabel: "Ingresos estimados en riesgo / mes",
      how: `Cómo lo calculamos: <b>estimación</b> basada en promedios del sector${vertical ? ` (${vertical})` : ""} — ~30% de las llamadas a negocios locales no se contestan, y cada una es un pedido, cita o cotización que se va a la competencia. No es una medición de su negocio; es el tamaño típico de la fuga.`,
      year: `En 12 meses, eso llega a <b style="color:${B.gold};">~${yearly}</b>.`,
      fix: "Gui contesta el 100% de las llamadas, 24/7, agenda y vende — desde $149/mes. Se paga sola en la primera semana.",
      cta: "Ver planes y recuperarlo →",
      foot: "Responda este correo con cualquier duda — lo lee una persona de verdad.",
    },
    en: {
      subject: `${rawName}, your free analysis: ~${money}/mo at risk 📊`,
      pre: "An honest estimate of what missed calls cost per month — and how to recover it.",
      eyebrow: "Guileo · your free analysis",
      h1: `Your analysis, ${name} 📊`,
      intro: `As promised — an honest estimate of what unanswered calls may be costing${biz} every month.`,
      bigLabel: "Estimated revenue at risk / month",
      how: `How we got this: an <b>estimate</b> from industry averages${vertical ? ` (${vertical})` : ""} — ~30% of calls to local businesses go unanswered, and each one is an order, booking or quote that walks to a competitor. It's not a measurement of your business; it's the typical size of the leak.`,
      year: `Over 12 months, that adds up to <b style="color:${B.gold};">~${yearly}</b>.`,
      fix: "Gui answers 100% of calls, 24/7, books and sells — from $149/mo. It pays for itself in the first week.",
      cta: "See plans & recover it →",
      foot: "Reply to this email with any question — a real person reads it.",
    },
  };
  const t = T[lang] || T.en;
  const body = `
    <h1 style="margin:6px 0 12px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;line-height:1.15;font-weight:900;color:${B.ink};letter-spacing:-0.5px;">${t.h1}</h1>
    <p style="margin:0 0 16px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:${B.ink};">${t.intro}</p>
    ${panel(`
      <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${B.muted};">${t.bigLabel}</div>
      <div style="margin-top:6px;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:40px;line-height:1.05;font-weight:900;letter-spacing:-1px;color:#ff8a33;">~${money}</div>
      <p style="margin:12px 0 0 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.65;color:${B.muted};">${t.how}</p>
    `, "20px 22px")}
    <div style="height:14px;font-size:0;line-height:0;">&nbsp;</div>
    <p style="margin:0 0 10px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.7;color:${B.ink2};">${t.year}</p>
    <p style="margin:0 0 4px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.7;color:${B.ink};">${t.fix}</p>
    <div style="height:14px;font-size:0;line-height:0;">&nbsp;</div>
    ${cta(t.cta, `${B.site}/planos`)}
    <div style="height:16px;font-size:0;line-height:0;">&nbsp;</div>
    <p style="margin:0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${B.muted};">${t.foot}</p>
  `;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// MONTH-TO-DATE VALUE BLOCK — "💰 A Gui te gerou $X este mês" panel, spliced into the weekly
// client report (client-report.js). Renders ONLY when totalMonth > 0; the cost comparison line
// ("ela custa $Y") renders ONLY when guiCost > 0 (never guess the client's price). Includes the
// honest caveat that these are amounts recorded on the calls — not audited books.
export function valueBlock({ totalMonth = 0, guiCost = 0, lang = "en" } = {}) {
  const total = Number(totalMonth) || 0;
  if (total <= 0) return "";
  const cost = Number(guiCost) || 0;
  const money = (n) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const t = lang === "pt" ? {
    title: "Valor gerado este mês",
    line: `💰 A Gui te gerou <span style="color:${B.green};font-weight:800;">${money(total)}</span> este mês`,
    cost: ` — ela custa <span style="color:${B.ink2};font-weight:700;">${money(cost)}</span>.`,
    caveat: "valores registrados nas ligações",
  } : lang === "es" ? {
    title: "Valor generado este mes",
    line: `💰 Gui te generó <span style="color:${B.green};font-weight:800;">${money(total)}</span> este mes`,
    cost: ` — cuesta <span style="color:${B.ink2};font-weight:700;">${money(cost)}</span>.`,
    caveat: "montos registrados en las llamadas",
  } : {
    title: "Value generated this month",
    line: `💰 Gui generated <span style="color:${B.green};font-weight:800;">${money(total)}</span> for you this month`,
    cost: ` — she costs <span style="color:${B.ink2};font-weight:700;">${money(cost)}</span>.`,
    caveat: "amounts recorded on the calls",
  };
  return `<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};font-family:'Segoe UI',Arial,sans-serif;margin-bottom:8px;">${t.title}</div>
    <div style="font-size:17px;font-weight:700;color:${B.ink};font-family:'Segoe UI',Arial,sans-serif;line-height:1.5;">${t.line}${cost > 0 ? t.cost : "."}</div>
    <div style="font-size:11px;color:${B.muted};font-family:'Segoe UI',Arial,sans-serif;margin-top:6px;">(${t.caveat})</div>`)}`;
}

// 24) CREDIT DEPLETED + DIRECT UPGRADE — the low-credit alert that CONVERTS: same caring
// copy as creditDepletedEmail, plus the NEXT plan up with its live Stripe payment link as
// the primary CTA (paying it auto-provisions via the webhook — credits are ADDED on top of
// the current balance, never replaced). Used by /api/credit-alerts; upgradeUrl falls back
// to /planos when the current plan can't be inferred.
export function creditDepletedUpgradeEmail({ name = "there", business = "your business", lang = "en", upgradeName = "", upgradePrice = 0, upgradeCredits = 0, upgradeUrl = "" } = {}) {
  name = esc(name); business = esc(business); upgradeName = esc(upgradeName);
  const url = upgradeUrl || `${B.site}/planos`;
  const hasPlan = !!(upgradeName && upgradePrice > 0);
  const t = lang === "es" ? {
    subject: "⚡ Tus créditos de Gui se agotaron — súbelo en un clic y vuelve a atender",
    pre: `Gui pausó las tareas de ${business}. Un clic y vuelve a atender 24/7.`,
    eyebrow: "Un momento · créditos",
    h1: `${name}, tus créditos se agotaron`,
    intro: `Gui usó todos los créditos de ${business} y <b style="color:${B.ink};">pausó con cuidado las tareas que consumen crédito</b> — llamadas, mensajes y follow-ups. Reactívalo en un clic y no pierde ni un cliente más.`,
    planTitle: "El siguiente plan, en un clic",
    planLine: (n, p, c) => `<b style="color:${B.ink};">${n}</b> — $${p}/mes · ${c.toLocaleString("en-US")} créditos de Gui al mes`,
    note: "El upgrade se activa al instante — los créditos del nuevo plan se SUMAN a tu saldo actual en cuanto entra el pago. No pierdes nada.",
    cta: hasPlan ? "Subir de plan ahora →" : "Ver los planes →",
    cta2: "Ver mi panel",
  } : lang === "pt" ? {
    subject: "⚡ Os créditos do Gui se esgotaram — suba de plano em 1 clique e ele volta a atender",
    pre: `O Gui pausou as tarefas de ${business}. Um clique e ele volta a atender 24/7.`,
    eyebrow: "Um instante · créditos",
    h1: `${name}, seus créditos se esgotaram`,
    intro: `O Gui utilizou todos os créditos de ${business} e <b style="color:${B.ink};">pausou, com cuidado, as tarefas que consomem crédito</b> — ligações, mensagens e follow-ups. Reative em um clique e ele não deixa mais nenhum cliente escapar.`,
    planTitle: "O próximo plano, em um clique",
    planLine: (n, p, c) => `<b style="color:${B.ink};">${n}</b> — $${p}/mês · ${c.toLocaleString("en-US")} créditos do Gui por mês`,
    note: "O upgrade ativa na hora — os créditos do novo plano são SOMADOS ao seu saldo atual assim que o pagamento cai. Você não perde nada.",
    cta: hasPlan ? "Subir de plano agora →" : "Ver os planos →",
    cta2: "Ver meu painel",
  } : {
    subject: "⚡ Your Gui credits have run out — upgrade in one click and it's back",
    pre: `Gui has paused tasks for ${business}. One click and it's answering 24/7 again.`,
    eyebrow: "A moment · credits",
    h1: `${name}, your credits have run out`,
    intro: `Gui has used all of ${business}'s credits and <b style="color:${B.ink};">gently paused the tasks that draw on them</b> — calls, messages and follow-ups. Reactivate in one click and it won't miss another customer.`,
    planTitle: "The next plan up, one click away",
    planLine: (n, p, c) => `<b style="color:${B.ink};">${n}</b> — $${p}/mo · ${c.toLocaleString("en-US")} Gui credits per month`,
    note: "Your upgrade activates instantly — the new plan's credits are ADDED on top of your current balance as soon as the payment lands. You lose nothing.",
    cta: hasPlan ? "Upgrade now →" : "See the plans →",
    cta2: "Open my dashboard",
  };
  const body = `
  <h1 style="font-size:24px;font-weight:800;color:${B.ink};margin:0 0 6px;">${t.h1}</h1>
  <div style="font-size:16px;color:${B.ink2};line-height:1.7;margin-top:8px;">${t.intro}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  ${hasPlan ? panel(`
    <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};margin-bottom:8px;">${t.planTitle}</div>
    <div style="font-size:15px;color:${B.ink2};line-height:1.6;">${t.planLine(upgradeName, upgradePrice, Number(upgradeCredits) || 0)}</div>
    <div style="font-size:12px;color:${B.muted};margin-top:8px;">${t.note}</div>`) : panel(`<div style="font-size:13px;color:${B.muted};">${t.note}</div>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, url)}</div>
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <div align="center">${cta2(t.cta2, B.site + "/portal?tab=billing")}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// 25) CHURN ALERT (internal, to Luis) — a client tapped "cancel" in the cockpit. Loud, with
// the reason, their note, and a concrete win-back suggestion so the save call happens TODAY.
// Used by /api/offboard (action:"survey"). Always PT — it's an internal ops email.
export function churnAlertEmail({ email = "", business = "", reason = "", note = "" } = {}) {
  email = esc(email); business = esc(business || "cliente"); reason = esc(reason); note = esc(note);
  const SUGGEST = {
    expensive: "Liga hoje e oferece o plano menor (ou 1 mês com desconto) — preço se resolve conversando.",
    unused: "Oferece uma sessão de setup de 15 min com a gente configurando junto — quem ativa, fica.",
    technical: "Resolve o problema técnico PRIMEIRO (suporte prioritário), depois pergunta o que faltou.",
    closed: "Agradece com carinho e guarda o contato — negócios reabrem, e ele volta pra quem tratou bem.",
  };
  const LABEL = { expensive: "caro", unused: "não usei", technical: "problemas técnicos", closed: "fechei o negócio", unspecified: "sem motivo informado" };
  const suggest = SUGGEST[reason] || "Liga hoje, escuta o motivo real e oferece o caminho mais barato de ficar.";
  const label = LABEL[reason] || reason || "sem motivo informado";
  const subject = `😢 ${business} (${email}) pediu cancelamento — ${label}`;
  const body = `
  <h1 style="font-size:23px;font-weight:800;color:${B.ink};margin:0 0 6px;">😢 Pedido de cancelamento</h1>
  <div style="font-size:15px;color:${B.ink2};line-height:1.7;margin-top:8px;"><b style="color:${B.ink};">${business}</b> (${email}) abriu o fluxo de cancelamento no cockpit agora. A assinatura ainda está ATIVA — o cancelamento real só acontece no portal da Stripe. Essa é a janela de resgate.</div>
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};margin-bottom:8px;">Motivo</div>
    <div style="font-size:15px;font-weight:700;color:${B.ink};">${label}</div>
    ${note ? `<div style="font-size:13px;color:${B.ink2};margin-top:8px;line-height:1.6;">“${note}”</div>` : ""}`)}
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  ${panel(`
    <div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.green};margin-bottom:8px;">Jogada de resgate</div>
    <div style="font-size:14px;color:${B.ink2};line-height:1.6;">${suggest}</div>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta("Abrir o admin →", B.site + "/admin")}</div>`;
  return { subject, html: shell({ preheader: `${business} pediu cancelamento (${label}) — janela de resgate aberta.`, eyebrow: "Interno · churn", body, lang: "pt" }) };
}

// 26) DUNNING — the client's card FAILED for their Guileo subscription (invoice.payment_failed).
// Concierge voice: warm, dignified, ZERO shame and ZERO fake urgency — a declined/expired card is
// normal and Stripe keeps retrying. Their Gui keeps working for now (grace period is Luis's call,
// never this email's). ONE action: the Billing tab (which reaches Stripe's customer portal) to
// update the card. P.S. offers the human WhatsApp fallback. hi → en (no Hindi copy yet).
// NOTE: the WhatsApp number mirrors src/data/contact.js CONTACT.whatsapp — hardcoded here because
// importing that module would drag the browser analytics bundle into the webhook worker.
export function dunningEmail({ name = "there", business = "your business", amountLabel = "", lang = "en" } = {}) {
  name = esc(name); business = esc(business); amountLabel = esc(amountLabel);
  const billing = `${B.site}/portal?tab=billing`;
  const WA = "https://wa.me/19295350191";
  const t = lang === "pt" ? {
    subject: "Ops — seu pagamento não passou (a Gui continua no ar)",
    pre: `Nada grave: o cartão não passou desta vez. A Gui de ${business} continua atendendo.`,
    eyebrow: "Um aviso gentil · pagamento",
    h1: `${name}, o pagamento não passou desta vez`,
    intro: `A cobrança da sua assinatura Guileo${amountLabel ? ` (${amountLabel})` : ""} não foi aprovada — quase sempre é cartão recusado ou vencido. Acontece com todo mundo, de verdade. <b style="color:${B.ink};">Nada foi desligado</b>: a Gui de ${business} continua atendendo normalmente.`,
    fix: `Só precisamos de um cartão que passe. Na aba <b style="color:${B.ink};">Cobrança</b> do seu painel você atualiza em menos de um minuto — a Stripe tenta de novo sozinha.`,
    cta: "Atualizar pagamento →",
    reassure: "sua Gui continua atendendo enquanto isso — só não deixa ela preocupada 🌱",
    ps: `P.S. Prefere resolver com uma pessoa? <a href="${WA}" style="color:${B.gold};text-decoration:none;font-weight:600;">Chama a gente no WhatsApp</a> — a gente ajusta junto.`,
  } : lang === "es" ? {
    subject: "Ups — tu pago no pasó (Gui sigue en línea)",
    pre: `Nada grave: la tarjeta no pasó esta vez. La Gui de ${business} sigue atendiendo.`,
    eyebrow: "Un aviso amable · pago",
    h1: `${name}, el pago no pasó esta vez`,
    intro: `El cobro de tu suscripción Guileo${amountLabel ? ` (${amountLabel})` : ""} no fue aprobado — casi siempre es una tarjeta rechazada o vencida. Le pasa a todo el mundo, de verdad. <b style="color:${B.ink};">Nada se apagó</b>: la Gui de ${business} sigue atendiendo con normalidad.`,
    fix: `Solo necesitamos una tarjeta que funcione. En la pestaña <b style="color:${B.ink};">Facturación</b> de tu panel la actualizas en menos de un minuto — Stripe reintenta sola.`,
    cta: "Actualizar pago →",
    reassure: "tu Gui sigue atendiendo mientras tanto — no la dejes preocupada 🌱",
    ps: `P.D. ¿Prefieres resolverlo con una persona? <a href="${WA}" style="color:${B.gold};text-decoration:none;font-weight:600;">Escríbenos por WhatsApp</a> — lo arreglamos juntos.`,
  } : {
    subject: "Oops — your payment didn't go through (Gui is still on the line)",
    pre: `Nothing serious: the card didn't go through this time. ${business}'s Gui is still answering.`,
    eyebrow: "A gentle note · payment",
    h1: `${name}, the payment didn't go through this time`,
    intro: `The charge for your Guileo subscription${amountLabel ? ` (${amountLabel})` : ""} wasn't approved — almost always a declined or expired card. It happens to everyone, truly. <b style="color:${B.ink};">Nothing was switched off</b>: ${business}'s Gui is still answering as usual.`,
    fix: `We just need a card that goes through. On the <b style="color:${B.ink};">Billing</b> tab of your dashboard you can update it in under a minute — Stripe retries on its own.`,
    cta: "Update payment →",
    reassure: "your Gui keeps answering in the meantime — just don't leave her worrying 🌱",
    ps: `P.S. Rather sort it out with a person? <a href="${WA}" style="color:${B.gold};text-decoration:none;font-weight:600;">Message us on WhatsApp</a> — we'll fix it together.`,
  };
  const body = `
  <h1 style="font-size:24px;font-weight:800;color:${B.ink};margin:0 0 6px;">${t.h1}</h1>
  <div style="font-size:16px;color:${B.ink2};line-height:1.7;margin-top:8px;">${t.intro}</div>
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  ${panel(`<div style="font-size:14px;color:${B.ink2};line-height:1.7;">${t.fix}</div>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, billing)}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  <div align="center" style="font-size:13px;color:${B.muted};line-height:1.7;">${t.reassure}</div>
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  <div style="font-size:12.5px;color:${B.muted};line-height:1.7;">${t.ps}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang: lang === "es" ? "es" : lang === "pt" ? "pt" : "en" }) };
}

// QUARTERLY NPS — one question, eleven 1-tap buttons (0–10). Each button is a signed link back to
// /api/nps (voteUrlBase already carries e=<b64url email>&s=<hmac>; we only append &vote=N), so the
// score lands with zero forms, zero login. Warm concierge tone — Gui asking how she's doing, not a
// survey robot. Sent by /api/nps at most once per client per 90 days (nps_claim, db/nps.sql).
export function npsEmail({ name = "there", business = "", voteUrlBase = "https://guileoai.com/api/nps", lang = "en" } = {}) {
  name = esc(name); business = esc(business);
  const biz = business ? ` <span style="color:${B.ink};font-weight:600;">${business}</span>` : "";
  const t = lang === "pt" ? {
    subject: "Uma pergunta só — 5 segundos, prometo",
    pre: "De 0 a 10, quanto você recomendaria a Gui? Um toque e pronto.",
    eyebrow: "Sua opinião · 5 segundos",
    h1: `${name}, uma pergunta rápida`,
    intro: `A Gui atende${biz ? ` ${biz}` : " seu negócio"} todos os dias — e a gente quer saber, na real, como ela está se saindo. Uma pergunta, um toque, e você volta pro seu dia.`,
    question: "De 0 a 10, quanto você recomendaria a Gui?",
    low: "0 · nem pensar", high: "10 · com certeza",
    foot: "Um toque em qualquer número registra sua resposta na hora. Sem formulário, sem login.",
    ps: "P.S. Sua resposta vai direto pra quem constrói a Gui — cada nota muda o que a gente faz na semana seguinte.",
  } : lang === "es" ? {
    subject: "Una sola pregunta — 5 segundos, lo prometo",
    pre: "Del 0 al 10, ¿cuánto recomendaría a Gui? Un toque y listo.",
    eyebrow: "Su opinión · 5 segundos",
    h1: `${name}, una pregunta rápida`,
    intro: `Gui atiende${biz ? ` ${biz}` : " su negocio"} todos los días — y queremos saber, de verdad, cómo lo está haciendo. Una pregunta, un toque, y vuelve a su día.`,
    question: "Del 0 al 10, ¿cuánto recomendaría a Gui?",
    low: "0 · para nada", high: "10 · sin duda",
    foot: "Un toque en cualquier número registra su respuesta al instante. Sin formularios, sin login.",
    ps: "P.D. Su respuesta llega directo a quienes construyen a Gui — cada nota cambia lo que hacemos la semana siguiente.",
  } : {
    subject: "One question — 5 seconds, promise",
    pre: "From 0 to 10, how likely are you to recommend Gui? One tap and done.",
    eyebrow: "Your take · 5 seconds",
    h1: `${name}, one quick question`,
    intro: `Gui answers for${biz ? ` ${biz}` : " your business"} every day — and we'd love to know, honestly, how she's doing. One question, one tap, and you're back to your day.`,
    question: "From 0 to 10, how likely are you to recommend Gui?",
    low: "0 · not a chance", high: "10 · absolutely",
    foot: "One tap on any number records your answer instantly. No forms, no login.",
    ps: "P.S. Your answer goes straight to the people building Gui — every score changes what we do the following week.",
  };
  // 11 tappable score pills in one email-safe table row (0–6 graphite, 7–8 champagne, 9–10 green).
  const sep = voteUrlBase.includes("?") ? "&" : "?";
  const btn = (n) => {
    const tone = n >= 9 ? { bg: "rgba(62,148,104,0.18)", bd: "rgba(62,148,104,0.55)", fg: "#5fbe8d" }
      : n >= 7 ? { bg: "rgba(214,194,154,0.14)", bd: "rgba(214,194,154,0.45)", fg: B.gold }
      : { bg: B.panel2, bd: B.line, fg: B.ink2 };
    return `<td align="center" style="padding:2px;"><a href="${voteUrlBase}${sep}vote=${n}" style="display:block;width:34px;padding:11px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:800;color:${tone.fg};background:${tone.bg};border:1px solid ${tone.bd};border-radius:10px;text-decoration:none;">${n}</a></td>`;
  };
  const scale = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>${Array.from({ length: 11 }, (_, n) => btn(n)).join("")}</tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>
    <td align="left" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;color:${B.muted};">${t.low}</td>
    <td align="right" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;color:#5fbe8d;">${t.high}</td>
  </tr></table>`;
  const body = `
  <h1 style="font-size:24px;font-weight:800;color:${B.ink};margin:0 0 6px;">${t.h1}</h1>
  <div style="font-size:16px;color:${B.ink2};line-height:1.7;margin-top:8px;">${t.intro}</div>
  <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>
  ${panel(`<div align="center" style="font-size:16px;font-weight:700;color:${B.ink};line-height:1.5;margin-bottom:14px;">${t.question}</div>${scale}`, "22px 16px")}
  <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
  <div align="center" style="font-size:12.5px;color:${B.muted};line-height:1.7;">${t.foot}</div>
  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
  <div style="font-size:12.5px;color:${B.muted};line-height:1.7;">${t.ps}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang: lang === "es" ? "es" : lang === "pt" ? "pt" : "en" }) };
}

// ═════════════════════════════════════════════════════════════════════════════
// PER-CLIENT BRANDED EMAIL ENGINE — "motor de crescimento PERSONALIZADO".
// The same premium, warm-cement, email-safe shell as above, but themed to the CLIENT: THEIR logo,
// THEIR accent color (buttons / hairline / headings), THEIR business name in header + footer, and a
// small "powered by Guileo" in the footer. Natura Spa's coupons carry Natura's identity, not ours.
// Callers pass `brand` from functions/lib/clientBrand.js → brandFor(env, clientEmail).
// ═════════════════════════════════════════════════════════════════════════════

// Normalize #rgb / #rrggbb → {r,g,b}; falls back to Gui orange on anything unparseable.
function _rgb(hex) {
  let h = String(hex || "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) h = "ff8a33";
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
const _hex2 = ({ r, g, b }) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
// Shift a hex toward white (pct>0) or black (pct<0) — the button's glassy top/bottom shades.
function _shade(hex, pct) {
  const { r, g, b } = _rgb(hex);
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct);
  return _hex2({ r: r + (t - r) * p, g: g + (t - g) * p, b: b + (t - b) * p });
}
// Readable text color ON the accent (white for dark/saturated accents, dark ink for pale ones).
function _textOn(hex) {
  const { r, g, b } = _rgb(hex);
  return ((0.299 * r + 0.587 * g + 0.114 * b) / 255) > 0.62 ? "#161512" : "#ffffff";
}
const _isHex = (s) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s || "").trim());

// Accent CTA pill (client's color). Mirrors cta() but themed; safe text color auto-chosen.
function ctaBrand(label, href, accent) {
  const top = _shade(accent, 0.18), bot = _shade(accent, -0.16), fg = _textOn(accent);
  const { r, g, b } = _rgb(accent);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="g-btn-wrap" style="margin:6px auto 0 auto;"><tr>
  <td align="center" style="border-radius:999px;background:linear-gradient(180deg,${top} 0%,${accent} 52%,${bot} 100%);box-shadow:0 16px 40px -12px rgba(${r},${g},${b},0.55),inset 0 1px 0 rgba(255,255,255,0.34),inset 0 -1px 0 rgba(0,0,0,0.18),0 0 0 1px rgba(${r},${g},${b},0.45);">
    <a href="${href}" class="g-btn" style="display:inline-block;padding:15px 34px;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14.5px;font-weight:800;letter-spacing:.2px;color:${fg};text-decoration:none;border-radius:999px;">${esc(label)}</a>
  </td></tr></table>`;
}

// The branded shell. brand = { business, logo_url, accent, agent_name, lang }.
// bodyHtml is trusted, pre-assembled markup from the builders below (they escape their own inputs).
export function clientEmailShell({ brand = {}, title = "", preheader = "", eyebrow = "", bodyHtml = "", ctaText = "", ctaUrl = "", footerNote = "", lang } = {}) {
  const accent = _isHex(brand.accent) ? String(brand.accent).trim() : "#FF8A33";
  const business = esc(brand.business || "Guileo");
  const logo = /^https?:\/\//i.test(String(brand.logo_url || "")) ? String(brand.logo_url) : "";
  const lg = lang || brand.lang || "en";
  const htmlLang = lg === "pt" ? "pt-BR" : lg === "es" ? "es" : "en";
  const powered = lg === "pt" ? "com tecnologia Guileo" : lg === "es" ? "con tecnología de Guileo" : "powered by Guileo";
  const recv = lg === "pt" ? `Você recebe este email de ${business}.` : lg === "es" ? `Recibe este correo de ${business}.` : `You're receiving this from ${business}.`;
  const header = logo
    ? `<a href="${B.site}" style="text-decoration:none;display:inline-block;"><img src="${esc(logo)}" height="42" alt="${business}" style="display:inline-block;max-height:48px;max-width:220px;height:auto;width:auto;border:0;outline:none;" /></a>`
    : `<span style="display:inline-block;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;letter-spacing:-.3px;color:${B.ink2};">${business}</span>`;
  return `<!doctype html><html lang="${htmlLang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">${HEAD_STYLE}</head>
<body style="margin:0;padding:0;background:${B.bg};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${B.bg};font-size:1px;line-height:1px;">${esc(preheader)}&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="g-shell" style="background:${B.bg};padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="g-card" style="max-width:600px;width:100%;background:${B.card};border:1px solid ${B.line};border-radius:22px;overflow:hidden;box-shadow:0 40px 100px -45px rgba(0,0,0,0.92),0 2px 0 rgba(255,255,255,0.02);">
<tr><td style="height:1px;background:${B.edge};font-size:0;line-height:0;">&nbsp;</td></tr>
<!-- accent hairline (client's color) -->
<tr><td style="height:2px;background:linear-gradient(90deg,transparent,${accent} 34%,${_shade(accent, 0.25)} 50%,${accent} 66%,transparent);font-size:0;line-height:0;">&nbsp;</td></tr>
<!-- HEADER — client logo (fallback: business name text) -->
<tr><td style="padding:26px 40px 4px 40px;background:${B.card};" align="center">${header}</td></tr>
${eyebrow ? `<tr><td class="g-pad-head" style="padding:18px 40px 0 40px;background:${B.card};" align="center">
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:10.5px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${accent};">${esc(eyebrow)}</div>
</td></tr>` : ""}
${title ? `<tr><td class="g-pad" style="padding:12px 40px 0 40px;background:${B.card};" align="center">
  <h1 class="g-h1" style="margin:0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;line-height:1.18;font-weight:900;color:${B.ink};letter-spacing:-0.5px;">${esc(title)}</h1>
</td></tr>` : ""}
<tr><td class="g-pad" style="padding:16px 40px 34px 40px;background:${B.card};font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;">
  ${bodyHtml}
  ${ctaText && ctaUrl ? `<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div><div align="center">${ctaBrand(ctaText, ctaUrl, accent)}</div>` : ""}
  ${footerNote ? `<div style="font-size:12.5px;color:${B.muted};text-align:center;line-height:1.7;margin-top:18px;">${esc(footerNote)}</div>` : ""}
</td></tr>
<!-- footer — client identity + small "powered by Guileo" -->
<tr><td class="g-pad" style="padding:22px 40px 30px 40px;border-top:1px solid ${B.line};background:${B.card};" align="center">
  <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:${B.muted};line-height:1.85;">
    <span style="color:${accent};font-size:9px;vertical-align:middle;">●</span>&nbsp; <span style="color:${B.ink2};font-weight:600;">${business}</span><br/>
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.faint};margin-top:6px;">
      <a href="${B.site}" style="color:${B.faint};text-decoration:none;">${powered}</a>
    </div>
  </div>
</td></tr>
</table>
<div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;color:${B.faint};margin-top:18px;">${recv}</div>
</td></tr>
</table>
</body></html>`;
}

// ── XM ACTIVE SURVEY — sent FROM the business to its OWN customer after a visit. ──────────────────
// Branded as the business (their logo/accent, "powered by Guileo" in the footer). One-tap NPS (0–10)
// + CSAT (⭐1–5): each pill is an <a> to /api/cx-vote (HMAC-signed voteBaseUrl already carries e/c/s/l;
// we append &m=<metric>&v=<n>). No data is collected in the email itself — the tap lands on the signed
// endpoint. voteBaseUrl MUST be the signed base from functions/api/cx-survey.js.
export function cxSurveyEmail({ name = "", business = "", brand = {}, lang = "en", voteBaseUrl = "" } = {}) {
  const lg = lang === "pt" ? "pt" : lang === "es" ? "es" : "en";
  const biz = business || brand.business || "";
  const accent = _isHex(brand.accent) ? String(brand.accent).trim() : "#FF8A33";
  const T = {
    pt: { subject: `Como foi sua experiência${biz ? ` na ${biz}` : ""}?`, eyebrow: "Sua opinião", title: name ? `${esc(name)}, como foi?` : "Como foi sua experiência?",
      lead: `Adoraríamos saber como foi seu atendimento${biz ? ` na ${biz}` : ""}. Leva 5 segundos — é só tocar.`,
      npsQ: "De 0 a 10, o quanto você nos recomendaria?", csatQ: "E no geral, sua satisfação:", lo: "Nada provável", hi: "Muito provável", foot: "Se preferir não receber, é só ignorar este email — não enviaremos de novo tão cedo." },
    es: { subject: `¿Cómo fue tu experiencia${biz ? ` en ${biz}` : ""}?`, eyebrow: "Tu opinión", title: name ? `${esc(name)}, ¿cómo fue?` : "¿Cómo fue tu experiencia?",
      lead: `Nos encantaría saber cómo fue tu atención${biz ? ` en ${biz}` : ""}. Toma 5 segundos — solo toca.`,
      npsQ: "Del 0 al 10, ¿cuánto nos recomendarías?", csatQ: "Y en general, tu satisfacción:", lo: "Nada probable", hi: "Muy probable", foot: "Si prefieres no recibir, ignora este correo — no lo enviaremos de nuevo pronto." },
    en: { subject: `How was your visit${biz ? ` at ${biz}` : ""}?`, eyebrow: "Your feedback", title: name ? `${esc(name)}, how did we do?` : "How was your visit?",
      lead: `We'd love to know how your visit${biz ? ` at ${biz}` : ""} went. Takes 5 seconds — just tap.`,
      npsQ: "From 0 to 10, how likely are you to recommend us?", csatQ: "And overall, your satisfaction:", lo: "Not likely", hi: "Very likely", foot: "Prefer not to get these? Just ignore this email — we won't send again soon." },
  };
  const t = T[lg];
  const pill = (metric, n, label, big) => {
    const href = `${voteBaseUrl}&m=${metric}&v=${n}`;
    const size = big ? "36px" : "40px";
    return `<a href="${href}" style="display:inline-block;min-width:${size};text-align:center;margin:3px;padding:9px 0;border-radius:10px;background:${B.card2 || "#211f1b"};border:1px solid ${_shade(accent, -0.1)};color:${B.ink};font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:800;text-decoration:none;">${label}</a>`;
  };
  let npsRow = "";
  for (let n = 0; n <= 10; n++) npsRow += pill("nps", n, String(n), true);
  let csatRow = "";
  for (let n = 1; n <= 5; n++) csatRow += pill("csat", n, "★".repeat(n) || "★", false);
  const bodyHtml = `
    <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:${B.ink2};text-align:center;">${t.lead}</p>
    <div style="text-align:center;font-size:12.5px;font-weight:700;color:${B.muted};margin:8px 0 6px;">${t.npsQ}</div>
    <div align="center" style="line-height:1;">${npsRow}</div>
    <div style="display:flex;justify-content:space-between;max-width:340px;margin:4px auto 20px;font-size:10px;color:${B.faint};"><span>${t.lo}</span><span>${t.hi}</span></div>
    <div style="text-align:center;font-size:12.5px;font-weight:700;color:${B.muted};margin:10px 0 6px;">${t.csatQ}</div>
    <div align="center" style="line-height:1;">${csatRow}</div>`;
  const html = clientEmailShell({
    brand: { business: biz, logo_url: brand.logo_url, accent, lang: lg },
    preheader: t.lead, eyebrow: t.eyebrow, title: t.title, bodyHtml, footerNote: t.foot, lang: lg,
  });
  return { subject: t.subject, html };
}

// Render a coupon prominently: the offer line (BOGO / 1+1 / % / $ handled) + the code in a dashed
// ticket + an expiry note. coupon = { label, code, kind, value, expires }.
function couponBlock(coupon = {}, accent = "#FF8A33", lang = "en") {
  const label = esc(coupon.label || "");
  const code = esc(coupon.code || "");
  const kind = String(coupon.kind || "").toLowerCase();
  const val = coupon.value;
  const L = lang === "pt"
    ? { code: "Seu código", exp: "Válido até", bogo: "Compre 1, leve 2", free: "Grátis" }
    : lang === "es"
    ? { code: "Su código", exp: "Válido hasta", bogo: "Compre 1, lleve 2", free: "Gratis" }
    : { code: "Your code", exp: "Valid until", bogo: "Buy 1, get 1 free", free: "Free" };
  // Big offer headline derived from kind+value when a label isn't given.
  let offer = label;
  if (!offer) {
    if (kind === "percent") offer = `${esc(val)}% OFF`;
    else if (kind === "amount") offer = `$${esc(val)} OFF`;
    else if (kind === "bogo" || kind === "1+1" || kind === "bxgy") offer = L.bogo;
    else if (kind === "free") offer = L.free;
    else if (val != null && val !== "") offer = esc(val);
  }
  const inner = `
    ${offer ? `<div align="center" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:30px;line-height:1.1;font-weight:900;color:${accent};letter-spacing:-.5px;">${offer}</div>` : ""}
    ${code ? `<div align="center" style="margin-top:14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
        <td style="border:1.5px dashed ${accent};border-radius:12px;padding:12px 26px;background:rgba(255,255,255,0.02);">
          <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${B.muted};">${L.code}</div>
          <div style="font-family:'Inter','SF Mono','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;letter-spacing:3px;color:${B.ink};margin-top:3px;">${code}</div>
        </td>
      </tr></table>
    </div>` : ""}
    ${coupon.expires ? `<div align="center" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:11.5px;color:${B.muted};margin-top:12px;">${L.exp} <span style="color:${B.ink2};font-weight:600;">${esc(coupon.expires)}</span></div>` : ""}`;
  return panel(inner, "24px 20px");
}

const _bp = (html, size = 16, color = B.ink2) => `<p style="margin:0 0 14px 0;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:${size}px;line-height:1.72;color:${color};">${html}</p>`;

// A) COUPON EMAIL — a coupon/code delivered in the client's brand.
// couponEmail({ brand, coupon:{label,code,kind,value,expires}, message, ctaText?, ctaUrl?, lang? })
export function couponEmail({ brand = {}, coupon = {}, message = "", ctaText = "", ctaUrl = "", lang } = {}) {
  const lg = lang || brand.lang || "en";
  const accent = brand.accent || "#FF8A33";
  const business = esc(brand.business || "Guileo");
  const T = lg === "pt"
    ? { subject: `${brand.business || "Guileo"}: um presente para você 🎁`, pre: "Seu cupom chegou — aproveite.", eyebrow: "Presente para você", title: "Um mimo para você 🎁", cta: "Aproveitar agora", foot: `Com carinho, ${business}.` }
    : lg === "es"
    ? { subject: `${brand.business || "Guileo"}: un regalo para usted 🎁`, pre: "Su cupón llegó — disfrútelo.", eyebrow: "Regalo para usted", title: "Un detalle para usted 🎁", cta: "Aprovechar ahora", foot: `Con cariño, ${business}.` }
    : { subject: `${brand.business || "Guileo"}: a gift for you 🎁`, pre: "Your coupon is here — enjoy.", eyebrow: "A gift for you", title: "A little something for you 🎁", cta: "Redeem now", foot: `With love, ${business}.` };
  const bodyHtml = `${message ? _bp(esc(message)) : ""}${couponBlock(coupon, accent, lg)}`;
  return {
    subject: T.subject,
    html: clientEmailShell({ brand, title: T.title, preheader: T.pre, eyebrow: T.eyebrow, bodyHtml, ctaText: ctaText || T.cta, ctaUrl: ctaUrl || B.site, footerNote: T.foot, lang: lg }),
  };
}

// B) PROMO / CAMPAIGN BLAST — headline + body, optional coupon, in the CLIENT's brand (logo/accent).
// NOTE: named brandPromoEmail (not promoEmail) — a separate customer-facing promoEmail already exists.
// brandPromoEmail({ brand, headline, body, coupon?, ctaText, ctaUrl, lang? })
export function brandPromoEmail({ brand = {}, headline = "", body = "", coupon = null, ctaText = "", ctaUrl = "", lang } = {}) {
  const lg = lang || brand.lang || "en";
  const accent = brand.accent || "#FF8A33";
  const business = esc(brand.business || "Guileo");
  const T = lg === "pt"
    ? { eyebrow: "Novidade", cta: "Saiba mais", pre: "Uma novidade que você vai gostar.", foot: `— ${business}` }
    : lg === "es"
    ? { eyebrow: "Novedad", cta: "Saber más", pre: "Una novedad que le va a gustar.", foot: `— ${business}` }
    : { eyebrow: "What's new", cta: "Learn more", pre: "Something you'll love.", foot: `— ${business}` };
  const bodyHtml = `${body ? _bp(esc(body)) : ""}${coupon ? couponBlock(coupon, accent, lg) : ""}`;
  return {
    subject: headline ? String(headline) : (brand.business || "Guileo"),
    html: clientEmailShell({ brand, title: headline, preheader: T.pre, eyebrow: T.eyebrow, bodyHtml, ctaText: ctaText || T.cta, ctaUrl: ctaUrl || B.site, footerNote: T.foot, lang: lg }),
  };
}

// C) BIRTHDAY COUPON — "Feliz aniversário, {name}! 🎉 seu presente:" + coupon, in the client's brand.
// birthdayCouponEmail({ brand, name, coupon, ctaText?, ctaUrl?, lang? })
export function birthdayCouponEmail({ brand = {}, name = "", coupon = {}, ctaText = "", ctaUrl = "", lang } = {}) {
  const lg = lang || brand.lang || "en";
  const accent = brand.accent || "#FF8A33";
  const business = esc(brand.business || "Guileo");
  const T = lg === "pt"
    ? { subject: `Feliz aniversário, ${name || ""}! 🎉`, pre: "Um presente de aniversário para você.", eyebrow: "Feliz aniversário", title: `Feliz aniversário, ${name || ""}! 🎉`, intro: "Seu presente de aniversário:", cta: "Resgatar meu presente", foot: `Com carinho, ${business}.` }
    : lg === "es"
    ? { subject: `¡Feliz cumpleaños, ${name || ""}! 🎉`, pre: "Un regalo de cumpleaños para usted.", eyebrow: "Feliz cumpleaños", title: `¡Feliz cumpleaños, ${name || ""}! 🎉`, intro: "Su regalo de cumpleaños:", cta: "Canjear mi regalo", foot: `Con cariño, ${business}.` }
    : { subject: `Happy birthday, ${name || ""}! 🎉`, pre: "A birthday gift for you.", eyebrow: "Happy birthday", title: `Happy birthday, ${name || ""}! 🎉`, intro: "Your birthday gift:", cta: "Redeem my gift", foot: `With love, ${business}.` };
  const bodyHtml = `${_bp(`<b style="color:${B.ink};">${esc(T.intro)}</b>`)}${couponBlock(coupon, accent, lg)}`;
  return {
    subject: T.subject,
    html: clientEmailShell({ brand, title: T.title, preheader: T.pre, eyebrow: T.eyebrow, bodyHtml, ctaText: ctaText || T.cta, ctaUrl: ctaUrl || B.site, footerNote: T.foot, lang: lg }),
  };
}

// D) NEWS / NOTIFICATION BLAST — informational message in the client's identity (no coupon).
// newsEmail({ brand, title, body, ctaText?, ctaUrl?, lang? })
export function newsEmail({ brand = {}, title = "", body = "", ctaText = "", ctaUrl = "", lang } = {}) {
  const lg = lang || brand.lang || "en";
  const business = esc(brand.business || "Guileo");
  const T = lg === "pt"
    ? { eyebrow: "Comunicado", pre: "Um recado importante para você.", foot: `— ${business}` }
    : lg === "es"
    ? { eyebrow: "Comunicado", pre: "Un aviso importante para usted.", foot: `— ${business}` }
    : { eyebrow: "Announcement", pre: "An important note for you.", foot: `— ${business}` };
  const bodyHtml = body ? _bp(esc(body)) : "";
  return {
    subject: title ? String(title) : (brand.business || "Guileo"),
    html: clientEmailShell({ brand, title, preheader: T.pre, eyebrow: T.eyebrow, bodyHtml, ctaText, ctaUrl, footerNote: T.foot, lang: lg }),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// RECEITA RECORRENTE (recurring revenue) — three branded builders. Same house rule:
// rendered in the CLIENT's identity (logo/accent/business) via clientEmailShell, footer
// "powered by Guileo". Callers pass `brand` from functions/lib/clientBrand.js → brandFor().
// ═════════════════════════════════════════════════════════════════════════════

// Format a money value for display: numbers become "$1,250.00"; strings pass through as given.
const _money = (v) => (typeof v === "number" && isFinite(v)) ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(v == null ? "" : v);

// A gift-card "ticket" block — big value + the code in a dashed ticket (mirrors couponBlock).
function giftBlock(amount, code, accent = "#FF8A33", lang = "en") {
  const L = lang === "pt" ? { code: "Seu código" } : lang === "es" ? { code: "Su código" } : { code: "Your code" };
  const amt = esc(_money(amount));
  const cd = esc(String(code || ""));
  const inner = `
    ${amt ? `<div align="center" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:34px;line-height:1.1;font-weight:900;color:${accent};letter-spacing:-.5px;">${amt}</div>` : ""}
    ${cd ? `<div align="center" style="margin-top:14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
        <td style="border:1.5px dashed ${accent};border-radius:12px;padding:12px 26px;background:rgba(255,255,255,0.02);">
          <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${B.muted};">${L.code}</div>
          <div style="font-family:'Inter','SF Mono','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;letter-spacing:3px;color:${B.ink};margin-top:3px;">${cd}</div>
        </td>
      </tr></table>
    </div>` : ""}`;
  return panel(inner, "24px 20px");
}

// E) GIFT CARD — a purchased gift card delivered in the client's brand, with its code + balance.
// giftCardEmail({ brand, code, amount, recipient, message })
export function giftCardEmail({ brand = {}, code = "", amount = "", recipient = "", message = "" } = {}) {
  const lg = brand.lang || "en";
  const accent = brand.accent || "#FF8A33";
  const business = esc(brand.business || "Guileo");
  const who = esc(String(recipient || "").slice(0, 120));
  const T = lg === "pt"
    ? { subject: `${brand.business || "Guileo"}: seu vale-presente 🎁`, pre: "Seu vale-presente chegou — aproveite.", eyebrow: "Vale-presente", title: who ? `Um presente para você, ${who} 🎁` : "Um vale-presente para você 🎁", cta: "Usar meu vale", foot: `Com carinho, ${business}.` }
    : lg === "es"
    ? { subject: `${brand.business || "Guileo"}: su tarjeta de regalo 🎁`, pre: "Su tarjeta de regalo llegó — disfrútela.", eyebrow: "Tarjeta de regalo", title: who ? `Un regalo para usted, ${who} 🎁` : "Una tarjeta de regalo para usted 🎁", cta: "Usar mi tarjeta", foot: `Con cariño, ${business}.` }
    : { subject: `${brand.business || "Guileo"}: your gift card 🎁`, pre: "Your gift card is here — enjoy.", eyebrow: "Gift card", title: who ? `A gift for you, ${who} 🎁` : "A gift card for you 🎁", cta: "Use my card", foot: `With love, ${business}.` };
  const bodyHtml = `${message ? _bp(esc(message)) : ""}${giftBlock(amount, code, accent, lg)}`;
  return {
    subject: T.subject,
    html: clientEmailShell({ brand, title: T.title, preheader: T.pre, eyebrow: T.eyebrow, bodyHtml, ctaText: T.cta, ctaUrl: B.site, footerNote: T.foot, lang: lg }),
  };
}

// F) MEMBERSHIP WELCOME — welcome a new subscriber to a club/membership, in the client's brand.
// membershipWelcomeEmail({ brand, name, membership:{ name, price_cents, interval, perks } })
export function membershipWelcomeEmail({ brand = {}, name = "", membership = {} } = {}) {
  const lg = brand.lang || "en";
  const accent = brand.accent || "#FF8A33";
  const business = esc(brand.business || "Guileo");
  const who = esc(String(name || "").slice(0, 120));
  const planName = esc(String(membership.name || "").slice(0, 120));
  const price = (typeof membership.price_cents === "number" && isFinite(membership.price_cents)) ? _money(membership.price_cents / 100) : "";
  const interval = String(membership.interval || "month").toLowerCase() === "year" ? "year" : "month";
  const perks = String(membership.perks || "").slice(0, 800);
  const T = lg === "pt"
    ? { subject: `Bem-vindo(a) ao ${membership.name || "clube"} 🌟`, pre: "Sua assinatura está ativa — aproveite os benefícios.", eyebrow: "Assinatura ativa", title: who ? `Bem-vindo(a), ${who} 🌟` : "Assinatura ativa 🌟", intro: `Sua assinatura${planName ? ` <b style="color:${B.ink};">${planName}</b>` : ""} está ativa. A partir de agora você aproveita tudo o que ela oferece.`, per: interval === "year" ? "/ano" : "/mês", perksTitle: "Seus benefícios", cta: "Ver minha conta", foot: `Obrigado por fazer parte, ${business}.` }
    : lg === "es"
    ? { subject: `Bienvenido(a) a ${membership.name || "el club"} 🌟`, pre: "Su suscripción está activa — disfrute los beneficios.", eyebrow: "Suscripción activa", title: who ? `Bienvenido(a), ${who} 🌟` : "Suscripción activa 🌟", intro: `Su suscripción${planName ? ` <b style="color:${B.ink};">${planName}</b>` : ""} está activa. Desde ahora disfruta todo lo que incluye.`, per: interval === "year" ? "/año" : "/mes", perksTitle: "Sus beneficios", cta: "Ver mi cuenta", foot: `Gracias por ser parte, ${business}.` }
    : { subject: `Welcome to ${membership.name || "the club"} 🌟`, pre: "Your membership is active — enjoy the perks.", eyebrow: "Membership active", title: who ? `Welcome, ${who} 🌟` : "Membership active 🌟", intro: `Your${planName ? ` <b style="color:${B.ink};">${planName}</b>` : ""} membership is active. From now on you enjoy everything it includes.`, per: interval === "year" ? "/yr" : "/mo", perksTitle: "Your perks", cta: "View my account", foot: `Thank you for joining, ${business}.` };
  const priceLine = price ? `<div align="center" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:30px;line-height:1.1;font-weight:900;color:${accent};letter-spacing:-.5px;">${esc(price)}<span style="font-size:14px;color:${B.muted};font-weight:700;"> ${T.per}</span></div>` : "";
  const perksBlock = perks
    ? panel(`<div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${accent};font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;margin-bottom:8px;">${esc(T.perksTitle)}</div>
        <div style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:${B.ink2};white-space:pre-line;">${esc(perks)}</div>`)
    : "";
  const bodyHtml = `${_bp(T.intro)}${priceLine ? `<div style="height:8px;font-size:0;line-height:0;">&nbsp;</div>${priceLine}<div style="height:16px;font-size:0;line-height:0;">&nbsp;</div>` : ""}${perksBlock}`;
  return {
    subject: T.subject,
    html: clientEmailShell({ brand, title: T.title, preheader: T.pre, eyebrow: T.eyebrow, bodyHtml, ctaText: T.cta, ctaUrl: B.site, footerNote: T.foot, lang: lg }),
  };
}

// G) PACKAGE PURCHASE — confirm a package (N sessions) purchase, with sessions remaining, in the client's brand.
// packagePurchaseEmail({ brand, name, package:{ name, sessions, service }, sessionsLeft })
export function packagePurchaseEmail({ brand = {}, name = "", package: pkg = {}, sessionsLeft } = {}) {
  const lg = brand.lang || "en";
  const accent = brand.accent || "#FF8A33";
  const business = esc(brand.business || "Guileo");
  const who = esc(String(name || "").slice(0, 120));
  const packName = esc(String(pkg.name || "").slice(0, 120));
  const service = esc(String(pkg.service || "").slice(0, 120));
  const total = Number(pkg.sessions);
  const left = (typeof sessionsLeft === "number" && isFinite(sessionsLeft)) ? sessionsLeft : (isFinite(total) ? total : 0);
  const T = lg === "pt"
    ? { subject: `Seu pacote${pkg.name ? ` ${pkg.name}` : ""} está pronto 🎟️`, pre: "Compra confirmada — suas sessões estão prontas.", eyebrow: "Compra confirmada", title: who ? `Obrigado, ${who}! 🎟️` : "Compra confirmada 🎟️", intro: `Seu pacote${packName ? ` <b style="color:${B.ink};">${packName}</b>` : ""} está confirmado${service ? ` (${service})` : ""}. É só chegar — cuidamos do resto.`, sess: "sessões restantes", cta: "Agendar minha sessão", foot: `Até breve, ${business}.` }
    : lg === "es"
    ? { subject: `Su paquete${pkg.name ? ` ${pkg.name}` : ""} está listo 🎟️`, pre: "Compra confirmada — sus sesiones están listas.", eyebrow: "Compra confirmada", title: who ? `¡Gracias, ${who}! 🎟️` : "Compra confirmada 🎟️", intro: `Su paquete${packName ? ` <b style="color:${B.ink};">${packName}</b>` : ""} está confirmado${service ? ` (${service})` : ""}. Solo venga — nosotros nos encargamos del resto.`, sess: "sesiones restantes", cta: "Agendar mi sesión", foot: `Hasta pronto, ${business}.` }
    : { subject: `Your${pkg.name ? ` ${pkg.name}` : ""} package is ready 🎟️`, pre: "Purchase confirmed — your sessions are ready.", eyebrow: "Purchase confirmed", title: who ? `Thank you, ${who}! 🎟️` : "Purchase confirmed 🎟️", intro: `Your${packName ? ` <b style="color:${B.ink};">${packName}</b>` : ""} package is confirmed${service ? ` (${service})` : ""}. Just come in — we'll take care of the rest.`, sess: "sessions remaining", cta: "Book my session", foot: `See you soon, ${business}.` };
  const counter = panel(`<div align="center" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:44px;line-height:1;font-weight:900;color:${accent};letter-spacing:-1px;">${esc(String(left))}</div>
    <div align="center" style="font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.muted};margin-top:6px;">${esc(T.sess)}</div>`, "24px 20px");
  const bodyHtml = `${_bp(T.intro)}${counter}`;
  return {
    subject: T.subject,
    html: clientEmailShell({ brand, title: T.title, preheader: T.pre, eyebrow: T.eyebrow, bodyHtml, ctaText: T.cta, ctaUrl: B.site, footerNote: T.foot, lang: lg }),
  };
}

// ── SELLER NOTIFICATIONS ─────────────────────────────────────────────────────
// The seller's two golden moments, delivered to their inbox the second they happen:
// (1) their client's agent went LIVE; (2) an attributed payment landed (commission earned).
// Recipient is always the SELLER's own registered email — never an arbitrary address.

export function sellerClientLiveEmail({ sellerName = "", business = "", clientEmail = "", lang = "pt" } = {}) {
  sellerName = esc(sellerName); business = esc(business); clientEmail = esc(clientEmail);
  const pt = lang !== "en";
  const t = pt ? {
    subject: `🟢 ${business} está NO AR — cliente da sua carteira ativado`,
    pre: `O agente de ${business} nasceu e já atende. Ele é seu — pra sempre.`,
    eyebrow: "Sua carteira · cliente ativado",
    h1: `${sellerName ? sellerName + ", s" : "S"}eu cliente está no ar 🟢`,
    intro: `O agente de <b style="color:${B.ink};">${business}</b> acabou de nascer e já está atendendo, agendando e vendendo 24/7. Esse cliente está <b style="color:${B.ink};">assinado na sua carteira</b> — a mensalidade dele conta pra sua comissão todo mês.`,
    note: `Próximo passo de ouro: liga pro dono hoje, confirma que o número está encaminhado e mostra o cockpit (${clientEmail ? "acesso: " + clientEmail : "portal"}). Cliente que vê o Gui trabalhando no dia 1 não cancela.`,
    cta: "Abrir minha carteira →",
  } : {
    subject: `🟢 ${business} is LIVE — a client from your wallet just activated`,
    pre: `${business}'s agent was born and is already answering. It's yours — permanently.`,
    eyebrow: "Your wallet · client activated",
    h1: `${sellerName ? sellerName + ", y" : "Y"}our client is live 🟢`,
    intro: `<b style="color:${B.ink};">${business}</b>'s agent was just born and is already answering, booking and selling 24/7. This client is <b style="color:${B.ink};">signed to your wallet</b> — their subscription counts toward your commission every month.`,
    note: `Golden next step: call the owner today, confirm the number is forwarded, and show them the cockpit${clientEmail ? " (login: " + clientEmail + ")" : ""}. A client who sees Gui working on day 1 doesn't cancel.`,
    cta: "Open my wallet →",
  };
  const body = `
  <h1 style="font-size:24px;font-weight:800;color:${B.ink};margin:0 0 6px;">${t.h1}</h1>
  <div style="font-size:16px;color:${B.ink2};line-height:1.7;margin-top:8px;">${t.intro}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  ${panel(`<div style="font-size:13px;color:${B.muted};">${t.note}</div>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.site + "/vendedor")}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang: pt ? "pt" : "en" }) };
}

export function sellerCommissionEmail({ sellerName = "", business = "", amount = "", plan = "", lang = "pt" } = {}) {
  sellerName = esc(sellerName); business = esc(business); amount = esc(amount); plan = esc(plan);
  const pt = lang !== "en";
  const t = pt ? {
    subject: `💰 Pagamento na sua carteira — ${business || "um cliente seu"} pagou${amount ? " " + amount : ""}`,
    pre: "Comissão gerada. O extrato completo está no seu hub.",
    eyebrow: "Sua carteira · comissão",
    h1: `${sellerName ? sellerName + ", c" : "C"}aiu pagamento na sua carteira 💰`,
    intro: `<b style="color:${B.ink};">${business || "Um cliente da sua carteira"}</b> pagou${amount ? ` <b style="color:${B.green};">${amount}</b>` : ""}${plan ? ` (${plan})` : ""}. Sua comissão sobre esse pagamento já entrou no seu extrato — refund-net, transparente, linha por linha.`,
    note: "O saldo devido e o histórico de repasses ficam na aba 💸 Financeiro do seu hub.",
    cta: "Ver meu extrato →",
  } : {
    subject: `💰 Payment in your wallet — ${business || "one of your clients"} paid${amount ? " " + amount : ""}`,
    pre: "Commission earned. The full statement is in your hub.",
    eyebrow: "Your wallet · commission",
    h1: `${sellerName ? sellerName + ", a" : "A"} payment just landed in your wallet 💰`,
    intro: `<b style="color:${B.ink};">${business || "A client from your wallet"}</b> paid${amount ? ` <b style="color:${B.green};">${amount}</b>` : ""}${plan ? ` (${plan})` : ""}. Your commission on this payment is already on your statement — refund-net, transparent, line by line.`,
    note: "Your balance due and payout history live in the 💸 Finance tab of your hub.",
    cta: "See my statement →",
  };
  const body = `
  <h1 style="font-size:24px;font-weight:800;color:${B.ink};margin:0 0 6px;">${t.h1}</h1>
  <div style="font-size:16px;color:${B.ink2};line-height:1.7;margin-top:8px;">${t.intro}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  ${panel(`<div style="font-size:13px;color:${B.muted};">${t.note}</div>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.site + "/vendedor")}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang: pt ? "pt" : "en" }) };
}

// SELLER WEEKLY REPORT — Monday morning mirror of the client report, for the SELLER:
// their wallet, who paid, this month's commission, balance due, one suggested play.
export function sellerWeeklyEmail({ sellerName = "", stats = {}, topClients = [], play = "", lang = "pt" } = {}) {
  sellerName = esc(sellerName);
  const pt = lang !== "en";
  const money = (c) => `$${((Number(c) || 0) / 100).toFixed(2)}`;
  const s = {
    wallet: Number(stats.wallet || 0), paying: Number(stats.paying || 0),
    commission_cents: Number(stats.commission_cents || 0), due_cents: Number(stats.due_cents || 0),
    converted_month: Number(stats.converted_month || 0),
  };
  const t = pt ? {
    subject: `📊 Sua semana Guileo — ${s.paying} pagante${s.paying === 1 ? "" : "s"} · comissão ${money(s.commission_cents)}`,
    pre: "Sua carteira, seus números e a jogada da semana.",
    eyebrow: "Relatório semanal · sua carteira",
    h1: `${sellerName ? sellerName + ", s" : "S"}ua semana em números`,
    rows: [["👛 Clientes na carteira", String(s.wallet)], ["💳 Pagantes", String(s.paying)], ["✍️ Fechados este mês", String(s.converted_month)], ["💰 Comissão acumulada", money(s.commission_cents)], ["💸 Saldo a receber", money(s.due_cents)]],
    topT: "Quem mais rendeu", playT: "🎯 Jogada da semana",
    cta: "Abrir meu hub →",
  } : {
    subject: `📊 Your Guileo week — ${s.paying} paying client${s.paying === 1 ? "" : "s"} · ${money(s.commission_cents)} commission`,
    pre: "Your wallet, your numbers and this week's play.",
    eyebrow: "Weekly report · your wallet",
    h1: `${sellerName ? sellerName + ", y" : "Y"}our week in numbers`,
    rows: [["👛 Clients in wallet", String(s.wallet)], ["💳 Paying", String(s.paying)], ["✍️ Closed this month", String(s.converted_month)], ["💰 Commission to date", money(s.commission_cents)], ["💸 Balance due to you", money(s.due_cents)]],
    topT: "Top earners", playT: "🎯 Play of the week",
    cta: "Open my hub →",
  };
  const statRows = t.rows.map(([k, v]) => `
    <tr><td style="padding:9px 0;font-size:13.5px;color:${B.muted};border-bottom:1px solid ${B.line};">${k}</td>
        <td align="right" style="padding:9px 0;font-size:14.5px;font-weight:800;color:${B.ink};border-bottom:1px solid ${B.line};">${v}</td></tr>`).join("");
  const tops = (topClients || []).slice(0, 3).map((c) =>
    `<div style="font-size:13px;color:${B.ink2};padding:4px 0;">🏪 ${esc(c.business || c.client_email || "")} — <b style="color:${B.green};">${esc(c.commission != null ? "$" + Number(c.commission).toFixed(2) : "")}</b></div>`).join("");
  const body = `
  <h1 style="font-size:24px;font-weight:800;color:${B.ink};margin:0 0 6px;">${t.h1}</h1>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">${statRows}</table>
  ${tops ? `<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>${panel(`<div style="font-size:12px;font-weight:800;color:${B.gold};margin-bottom:6px;">${t.topT}</div>${tops}`)}` : ""}
  ${play ? `<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>${panel(`<div style="font-size:12px;font-weight:800;color:${B.gold};margin-bottom:6px;">${t.playT}</div><div style="font-size:13px;color:${B.ink2};line-height:1.6;">${esc(play)}</div>`)}` : ""}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, B.site + "/vendedor")}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang: pt ? "pt" : "en" }) };
}

// ── ONBOARDING MACHINE (7-step chain) ───────────────────────────────────────
// The three emails the go-live machine sends. Branded via the shared shell so they read
// as the same world as the platform. "Automate the sending, never the deciding."

// STEP 2 — WELCOME PACKET. Contract signed → sent within ~1 min. Sets expectations: the 7 steps.
export function welcomePacketEmail({ name = "there", business = "your business", lang = "en", portalUrl = "https://guileoai.com/portal", kickoffUrl = "" } = {}) {
  name = esc(name); business = esc(business);
  const t = lang === "pt" ? {
    subject: `Bem-vindo a bordo — vamos ativar ${business} 🌱`,
    pre: "Seu kit de boas-vindas: exatamente o que acontece a seguir, passo a passo.",
    eyebrow: "Kit de boas-vindas", h1: `Bem-vindo a bordo, ${name}`,
    intro: `Contrato assinado — que alegria ter <b style="color:${B.ink};">${business}</b> conosco. A partir daqui, cuidamos de tudo para deixar seu Gui no ar. Veja exatamente o que vem a seguir:`,
    stepsTitle: "O caminho até o kickoff",
    steps: [
      ["Fatura", "Enviamos sua primeira fatura — um clique para pagar com segurança."],
      ["Acesso liberado", "Pagou, seu Gui nasce automaticamente e o painel abre."],
      ["Kickoff + briefing", "Agendamos a reunião e preparamos um briefing de uma página do seu negócio."],
      ["Acompanhamento", "Todo mês, um relatório de resultados. E um toque no dia 30, 60 e 90."],
    ],
    cta: "Abrir meu painel 🚀", cta2: "Agendar o kickoff 📅",
    foot: "Qualquer dúvida, é só responder — uma pessoa de verdade lê cada mensagem.",
  } : lang === "es" ? {
    subject: `Bienvenido a bordo — activemos ${business} 🌱`,
    pre: "Su kit de bienvenida: exactamente qué pasa a continuación, paso a paso.",
    eyebrow: "Kit de bienvenida", h1: `Bienvenido a bordo, ${name}`,
    intro: `Contrato firmado — qué alegría tener a <b style="color:${B.ink};">${business}</b> con nosotros. Desde aquí nos ocupamos de todo para dejar su Gui en marcha. Esto es lo que sigue:`,
    stepsTitle: "El camino hasta el kickoff",
    steps: [
      ["Factura", "Le enviamos su primera factura — un clic para pagar con seguridad."],
      ["Acceso activado", "Al pagar, su Gui nace automáticamente y el panel se abre."],
      ["Kickoff + briefing", "Agendamos la reunión y preparamos un briefing de una página de su negocio."],
      ["Seguimiento", "Cada mes, un informe de resultados. Y un saludo al día 30, 60 y 90."],
    ],
    cta: "Abrir mi panel 🚀", cta2: "Agendar el kickoff 📅",
    foot: "Cualquier duda, solo responda — una persona real lee cada mensaje.",
  } : {
    subject: `Welcome aboard — let's bring ${business} live 🌱`,
    pre: "Your welcome packet: exactly what happens next, step by step.",
    eyebrow: "Welcome packet", h1: `Welcome aboard, ${name}`,
    intro: `Contract signed — we're delighted to have <b style="color:${B.ink};">${business}</b> with us. From here we handle everything to get your Gui live. Here's exactly what comes next:`,
    stepsTitle: "The path to kickoff",
    steps: [
      ["Invoice", "We send your first invoice — one click to pay securely."],
      ["Access on", "Once paid, your Gui is born automatically and your dashboard opens."],
      ["Kickoff + brief", "We book the meeting and prepare a one-page brief of your business."],
      ["Follow-through", "Every month, a results report. And a hello on day 30, 60 and 90."],
    ],
    cta: "Open my dashboard 🚀", cta2: "Book the kickoff 📅",
    foot: "Any questions, just reply — a real person reads every message.",
  };
  const step = (n, ti, de) => `<tr><td style="padding:8px 0;"><table role="presentation" width="100%"><tr>
    <td width="40" valign="top"><div style="width:30px;height:30px;border-radius:9px;background:${B.panel2};border:1px solid ${B.line};color:${B.gold};font-weight:800;font-size:13px;text-align:center;line-height:30px;">${n}</div></td>
    <td valign="top" style="padding-left:6px;"><div style="font-size:14.5px;font-weight:700;color:${B.ink};">${ti}</div><div style="font-size:13px;color:${B.muted};line-height:1.6;margin-top:2px;">${de}</div></td></tr></table></td></tr>`;
  const body = `
  <h1 style="font-size:25px;font-weight:900;color:${B.ink};margin:0 0 4px;letter-spacing:-.5px;">${t.h1} 🌱</h1>
  <div class="g-intro" style="font-size:16px;color:${B.ink2};line-height:1.72;margin-top:10px;">${t.intro}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  ${panel(`<div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};margin-bottom:6px;">${t.stepsTitle}</div>
    <table role="presentation" width="100%">${t.steps.map((s, i) => step(i + 1, s[0], s[1])).join("")}</table>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  <div align="center">${cta(t.cta, portalUrl)}</div>
  ${kickoffUrl ? `<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div><div align="center">${cta2(t.cta2, kickoffUrl)}</div>` : ""}
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// STEP 5 — KICKOFF BRIEF. Access on → a one-page AI-written brief (from intake + site facts) plus
// the kickoff booking link. `brief` is plain text (paragraphs/lines) generated upstream by /api/onboarding.
export function kickoffBriefEmail({ name = "there", business = "your business", lang = "en", brief = "", bookingUrl = "", portalUrl = "https://guileoai.com/portal" } = {}) {
  name = esc(name); business = esc(business);
  const briefHtml = esc(brief).replace(/\n{2,}/g, "</p><p style='margin:10px 0 0;'>").replace(/\n/g, "<br/>");
  const t = lang === "pt" ? {
    subject: `Seu briefing de kickoff — ${business} 📋`,
    pre: "Uma página com o essencial do seu negócio, pronta para nossa reunião.",
    eyebrow: "Briefing de kickoff", h1: `Prontos para começar, ${name}`,
    intro: `Preparamos um briefing de uma página sobre <b style="color:${B.ink};">${business}</b> — para chegarmos ao kickoff já entendendo o seu mundo.`,
    briefT: "Briefing", cta: "Agendar o kickoff 📅", cta2: "Abrir meu painel 🚀",
    foot: "Se algo no briefing não bater, responda este email — ajustamos antes da reunião.",
  } : lang === "es" ? {
    subject: `Su briefing de kickoff — ${business} 📋`,
    pre: "Una página con lo esencial de su negocio, lista para nuestra reunión.",
    eyebrow: "Briefing de kickoff", h1: `Listos para empezar, ${name}`,
    intro: `Preparamos un briefing de una página sobre <b style="color:${B.ink};">${business}</b> — para llegar al kickoff ya entendiendo su mundo.`,
    briefT: "Briefing", cta: "Agendar el kickoff 📅", cta2: "Abrir mi panel 🚀",
    foot: "Si algo del briefing no encaja, responda este correo — lo ajustamos antes de la reunión.",
  } : {
    subject: `Your kickoff brief — ${business} 📋`,
    pre: "A one-pager on your business, ready for our kickoff call.",
    eyebrow: "Kickoff brief", h1: `Ready to begin, ${name}`,
    intro: `We've prepared a one-page brief on <b style="color:${B.ink};">${business}</b> — so we walk into kickoff already understanding your world.`,
    briefT: "The brief", cta: "Book the kickoff 📅", cta2: "Open my dashboard 🚀",
    foot: "If anything in the brief looks off, just reply — we'll fix it before the call.",
  };
  const body = `
  <h1 style="font-size:25px;font-weight:900;color:${B.ink};margin:0 0 4px;letter-spacing:-.5px;">${t.h1}</h1>
  <div class="g-intro" style="font-size:16px;color:${B.ink2};line-height:1.72;margin-top:10px;">${t.intro}</div>
  <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
  ${panel(`<div style="font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${B.gold};margin-bottom:8px;">${t.briefT}</div>
    <div style="font-size:14px;color:${B.ink2};line-height:1.7;"><p style="margin:0;">${briefHtml || "&mdash;"}</p></div>`)}
  <div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
  ${bookingUrl ? `<div align="center">${cta(t.cta, bookingUrl)}</div><div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>` : ""}
  <div align="center">${cta2(t.cta2, portalUrl)}</div>
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:16px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}

// STEP 7 — ONE-QUESTION CHECK-IN (day 30/60/90). One question, three 1-tap answers whose links carry
// the sentiment back to GET /api/onboarding (vote) → onboard_sentiment flags lukewarm/cold. The caller
// substitutes the client email into the __EMAIL__ token before sending.
export function onboardingCheckinEmail({ name = "there", business = "your business", lang = "en", day = 30, voteBase = "https://guileoai.com/api/onboarding" } = {}) {
  name = esc(name); business = esc(business);
  const d = [30, 60, 90].includes(Number(day)) ? Number(day) : 30;
  const t = lang === "pt" ? {
    subject: `${name}, como estão os primeiros ${d} dias? 🌱`,
    pre: "Uma pergunta, um toque — queremos que esteja indo bem.",
    eyebrow: `Check-in · dia ${d}`, h1: `Como vai, ${name}?`,
    q: `Estamos há ${d} dias juntos em <b style="color:${B.ink};">${business}</b>. Numa palavra: como está sendo?`,
    warm: "😊 Ótimo", luke: "😐 Mais ou menos", cold: "😕 Podia melhorar",
    foot: "Seja qual for o toque, alguém de verdade lê e cuida.",
  } : lang === "es" ? {
    subject: `${name}, ¿cómo van los primeros ${d} días? 🌱`,
    pre: "Una pregunta, un toque — queremos que le vaya bien.",
    eyebrow: `Check-in · día ${d}`, h1: `¿Cómo va, ${name}?`,
    q: `Llevamos ${d} días juntos en <b style="color:${B.ink};">${business}</b>. En una palabra: ¿cómo va?`,
    warm: "😊 Genial", luke: "😐 Más o menos", cold: "😕 Podría mejorar",
    foot: "Sea cual sea el toque, una persona real lo lee y se ocupa.",
  } : {
    subject: `${name}, how are the first ${d} days? 🌱`,
    pre: "One question, one tap — we want this going well for you.",
    eyebrow: `Check-in · day ${d}`, h1: `How's it going, ${name}?`,
    q: `We're ${d} days in with <b style="color:${B.ink};">${business}</b>. In one word: how's it going?`,
    warm: "😊 Great", luke: "😐 So-so", cold: "😕 Could be better",
    foot: "Whichever you tap, a real person reads it and follows up.",
  };
  const pill = (label, href, accent) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px auto;"><tr><td align="center" style="border-radius:999px;background:${B.panel};border:1px solid ${accent};"><a href="${href}" style="display:inline-block;padding:13px 30px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14.5px;font-weight:700;color:${B.ink};text-decoration:none;border-radius:999px;">${label}</a></td></tr></table>`;
  const u = (v) => `${voteBase}?vote=${v}&email=__EMAIL__&day=${d}`;
  const body = `
  <h1 style="font-size:25px;font-weight:900;color:${B.ink};margin:0 0 4px;letter-spacing:-.5px;">${t.h1}</h1>
  <div class="g-intro" style="font-size:16px;color:${B.ink2};line-height:1.72;margin-top:10px;">${t.q}</div>
  <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>
  ${pill(t.warm, u("warm"), B.green)}
  ${pill(t.luke, u("lukewarm"), B.gold)}
  ${pill(t.cold, u("cold"), "#c2603a")}
  <div style="font-size:12px;color:${B.muted};text-align:center;margin-top:18px;">${t.foot}</div>`;
  return { subject: t.subject, html: shell({ preheader: t.pre, eyebrow: t.eyebrow, body, lang }) };
}
