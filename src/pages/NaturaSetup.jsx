// NATURA SETUP — /natura-setup (2026-10-18)
//
// O checklist que a NATURA preenche para a implantação (Go-Live 29/10), plataforma por plataforma:
// redes sociais, presença online, comunicação, agenda, pagamentos e aprovações. Tema do deck
// Natura × Guileo (capa escura com fio dourado), em inglês.
//
// Regras que valem aqui:
//   • Nunca pede SENHA: cada conta é dada como acesso de parceiro/gerente; a Natura continua dona.
//   • Grava pelo /api/intake {action:"submit"} no formulário da PLATAFORMA (tenant smart@guileoai.com)
//     — o intake.js avisa o Luis na hora. O telefone vai nas RESPOSTAS, nunca em contact.phone:
//     contact.phone dispara o speed-to-lead (a Gui ligaria para a Lilian).
//   • "Thank you" SÓ com ok && stored do servidor. Rascunho no localStorage (try/catch) até enviar.
//   • Cada item vira UMA chave em answers ("Status — detalhe"): o intake corta em 60 chaves e
//     1.000 caracteres por valor.
import { useEffect, useMemo, useState } from "react";
import guileoMark from "../assets/guileo-mark.png";
import naturaLogo from "../assets/natura-logo.png";

const FORM_ID = "655b255e-3e2e-4327-a79a-12ac501bcd92";
const DRAFT = "natura-setup-draft";
const GUILEO_EMAIL = "smart@guileoai.com";

const STATUS = [
  { k: "done", t: "✅ Done" },
  { k: "send", t: "📤 I'll send it" },
  { k: "help", t: "🙋 Need help" },
  { k: "na", t: "➖ We don't use it" },
];

// grupo → itens. `preset` = já resolvido (aparece marcado e trancado).
const GROUPS = [
  {
    id: "social", emoji: "📱", title: "Social media",
    note: "Lilian answers DMs and turns comments into bookings. Give access as a partner — never send a password.",
    items: [
      { id: "instagram", emoji: "📸", name: "Instagram", ask: "Instagram must be a Business account linked to your Facebook Page. In Meta Business Suite → Settings → Partners, add Guileo AI with access to the Instagram account.", ph: "@handle · anything we should know" },
      { id: "facebook", emoji: "📘", name: "Facebook Page", ask: "In Meta Business Suite → Settings → Partners, add Guileo AI with access to the Natura Facebook Page (Messenger included).", ph: "Page link" },
      { id: "tiktok", emoji: "🎵", name: "TikTok", ask: "Your TikTok Business account. TikTok messages are a planned channel; for now we only need the handle.", ph: "@handle" },
      { id: "brand", emoji: "🎨", name: "Logo, photos & brand colors", ask: "Your logo files, a few photos of each location and team, and your brand colors, for the WhatsApp and social profiles. A shared folder link is perfect.", ph: "Folder link" },
      { id: "youtube", emoji: "▶️", name: "YouTube", ask: "If you have a channel, share the link. Video content is a separate service, on request.", ph: "Channel link" },
    ],
  },
  {
    id: "presence", emoji: "🌐", title: "Online presence",
    note: "Where clients find you and leave reviews. Every client gets a review request with the right location's link.",
    items: [
      { id: "google", emoji: "⭐", name: "Google Business Profile (3 locations)", ask: `Add ${GUILEO_EMAIL} as Manager on each profile: Astoria, Upper East Side and Med Spa (Google Business Profile → Business profile settings → People and access).`, ph: "Which locations are done" },
      { id: "yelp", emoji: "🔴", name: "Yelp", ask: "Your Yelp for Business page link for each location. If you can, add us as a user so we can reply to messages and requests.", ph: "Yelp links" },
      { id: "website", emoji: "💻", name: "Website & domain (naturaspanyc.com)", ask: "Domain access received. Nothing else needed here.", preset: "done" },
    ],
  },
  {
    id: "comms", emoji: "💬", title: "Communication",
    note: "The same Lilian answers on every channel. Calls and texts follow your rules and consent.",
    items: [
      { id: "phones", emoji: "📞", name: "Phone lines", ask: "The current number of each location and its carrier, one direct number per location for when a client asks for a person, and a 10-minute slot per line to set up call forwarding.", ph: "Astoria: … · UES: … · Med Spa: … · carrier · best time" },
      { id: "whatsapp", emoji: "🟢", name: "WhatsApp", ask: "The number you want on WhatsApp (it can't be in use in the regular WhatsApp app), and Guileo AI added as a partner on your WhatsApp account in Meta Business Suite.", ph: "Number for WhatsApp" },
      { id: "sms", emoji: "💬", name: "Text messages (SMS)", ask: "Natura's legal name and EIN (Tax ID) to register Natura's own texting brand with the carriers.", ph: "Legal name · EIN (or 'I'll send it')" },
      { id: "contacts", emoji: "🚨", name: "Urgent & hand-off contacts", ask: "Who Lilian calls or texts for something urgent (an upset client, an emergency), and who takes a transferred call at each location when the direct line doesn't answer.", ph: "Name · role · cell, per location" },
      { id: "email", emoji: "✉️", name: "Email", ask: "The physical address for email footers (required by law) and the email that should receive booking and sale alerts.", ph: "Address · alert email" },
    ],
  },
  {
    id: "booking", emoji: "📅", title: "Booking & services",
    note: "What Lilian books and quotes. Long lists can be sent by email; just tell us here.",
    items: [
      { id: "services", emoji: "💆", name: "Services & prices", ask: "For each location: service, price, duration, deposit, and which staff and room do it.", ph: "Sending by email / paste here" },
      { id: "staff", emoji: "👩‍⚕️", name: "Staff & hours", ask: "Staff names, schedules, days off, opening hours and holidays per location.", ph: "Sending by email / paste here" },
      { id: "rules", emoji: "📏", name: "Booking rules", ask: "Booking, cancellation, late arrival and no-show rules.", ph: "e.g. 24h cancellation, 15 min late = reschedule" },
      { id: "medspa", emoji: "💉", name: "Med Spa cycles", ask: "How often each treatment should be repeated, for the return reminders.", ph: "e.g. Botox every 3–4 months" },
      { id: "never", emoji: "🚫", name: "What Lilian must never do", ask: "Anything she must never say or do (for example, medical advice or quoting a price that isn't on the list).", ph: "Your list" },
      { id: "team", emoji: "🧑‍💼", name: "Front-desk team", ask: "Name and email of each person who will use the Guileo front desk, and a 45-minute training slot per location (we record it in English and Portuguese).", ph: "Names · emails · best day for training" },
      { id: "mindbody", emoji: "📂", name: "MindBody export", ask: "A CSV export of clients and future appointments for both sites (5734109 and 767008).", ph: "Sent on … / need help exporting" },
    ],
  },
  {
    id: "money", emoji: "💳", title: "Payments",
    note: "Deposits, gift cards, packages and memberships. The money goes straight to Natura.",
    items: [
      { id: "stripe", emoji: "💳", name: "Stripe", ask: "A Stripe account in Natura's name. We'll send you a short guide to create a restricted key and paste it at guileoai.com/receber.", ph: "Account created? Need help?" },
      { id: "fees", emoji: "🧾", name: "Deposits & fees", ask: "Which services need a deposit and how much, and your no-show and late-cancellation fees. A card can be kept on file to charge them, only if you want.", ph: "e.g. 25% deposit over $75 · no-show $40" },
      { id: "giftcards", emoji: "🎟️", name: "Gift cards, packages & membership", ask: "The amounts you sell, what each package or membership includes, price, how long it lasts and the rules (expiry, sharing, cancellation).", ph: "e.g. gift cards $50/$100/$200 · 5-massage package $…" },
      { id: "products", emoji: "🧴", name: "Shop products", ask: "The products you want to sell online (up to 50): name, price and a photo. A spreadsheet or a link to your product list is fine.", ph: "Sending by email / link" },
    ],
  },
  {
    id: "lilian", emoji: "🤖", title: "Lilian & automations",
    note: "Your choices for what Lilian does on her own. Each one can be changed later.",
    items: [
      { id: "greeting", emoji: "🗣️", name: "Greeting & languages", ask: "Lilian opens every call saying she is Natura's virtual assistant and that the call may be recorded, then speaks English, Portuguese or Spanish. Approve the greeting, or tell us what to change.", choices: ["✅ Approved", "✏️ Changes below", "🙋 Let's talk"], ph: "Changes to the greeting, name or tone" },
      { id: "callback", emoji: "↩️", name: "Missed-call callback", ask: "When a client's call isn't answered, Lilian calls her back and books. Starts once your lines are forwarded.", choices: ["✅ Yes, turn it on", "⏸️ Not now", "🙋 Let's talk"], ph: "Hours when callbacks are OK" },
      { id: "addon", emoji: "➕", name: "Add a service to a booking", ask: "Lilian offers to add a service to an existing booking (for example a facial with a massage) when the staff and room are free.", choices: ["✅ Yes, turn it on", "⏸️ Not now", "🙋 Let's talk"], ph: "Which add-ons to offer" },
      { id: "waitlist", emoji: "⏳", name: "Waitlist", ask: "When a time opens up (a cancellation), Lilian offers it to the clients on the waitlist for that service.", choices: ["✅ Yes, turn it on", "⏸️ Not now", "🙋 Let's talk"], ph: "" },
      { id: "sick", emoji: "🤒", name: "Someone called in sick", ask: "One tap at the front desk and Lilian tells that person's clients of the day and offers a new time or another professional.", choices: ["✅ Yes, turn it on", "⏸️ Not now", "🙋 Let's talk"], ph: "" },
      { id: "consult", emoji: "💉", name: "Med Spa consult follow-up", ask: "A client did the consult and didn't book: Lilian sends one friendly follow-up after a few days.", choices: ["✅ After 3 days", "📅 Another number of days", "⏸️ Not now"], ph: "Number of days, if different" },
      { id: "reports", emoji: "📊", name: "Reports", ask: "Weekly report every Monday, monthly value report, and an optional morning summary of the day. Who receives them, and at what time for the morning one?", ph: "Names · emails · morning time (e.g. 7am)" },
    ],
  },
  {
    id: "campaigns", emoji: "📣", title: "Campaigns & calendar",
    note: "Nothing goes out without your OK. Every marketing message has an unsubscribe link.",
    items: [
      { id: "season", emoji: "🎄", name: "Gift season", ask: "Gift cards sold by Lilian for Black Friday, the holidays, Valentine's Day and Mother's Day. Your offer for each date.", ph: "e.g. Black Friday: buy $100 get $20" },
      { id: "baseinvite", emoji: "💌", name: "Invite your client base back", ask: "Once your MindBody list is imported, one email to your past clients inviting them back, with an offer you choose.", choices: ["✅ Yes, with an offer", "⏸️ Not now", "🙋 Let's talk"], ph: "The offer" },
      { id: "medspaintro", emoji: "✨", name: "Introduce the Med Spa to Astoria clients", ask: "A message to your Astoria clients presenting the Med Spa, with your approved text and offer.", choices: ["✅ Yes", "⏸️ Not now", "🙋 Let's talk"], ph: "Offer or message idea" },
    ],
  },
  {
    id: "ok", emoji: "✍️", title: "Approvals",
    note: "Nothing goes to your clients without your OK.",
    items: [
      { id: "consent", emoji: "✅", name: "Permission for offers", ask: "Which clients already agreed to receive offers by text, WhatsApp or phone (for example, a checkbox in MindBody). By law, promotions by text or phone only go to clients who said yes; email offers always carry an unsubscribe link.", ph: "Where this is recorded today" },
      { id: "offers", emoji: "🎁", name: "Offers", ask: "Your birthday offer, your \"we miss you\" offer and any promotions you want us to use.", ph: "e.g. 15% off on your birthday month" },
      { id: "templates", emoji: "📝", name: "WhatsApp templates", ask: "Your OK on the confirmation, reminder, follow-up and seasonal-offer templates we sent by email.", ph: "Approved / changes" },
      { id: "hipaa", emoji: "🔒", name: "Health information (HIPAA)", ask: "A short written answer about patient health information (clause 12.2 of our agreement).", ph: "Your answer" },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);
// Decisão (choices) troca os 4 status por escolhas rápidas; a chave é estável pela posição.
const optsOf = (it) => (it.choices ? it.choices.map((t, i) => ({ k: `c${i}`, t })) : STATUS);

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT) || "{}") || {}; } catch { return {}; }
}

// Resposta gravada ("✅ Done — detalhe") → { st, nt } da página, para o dono ver o que foi marcado.
function lerEnvio(answers) {
  const st = {}, nt = {};
  ALL.forEach((it) => {
    const v = String((answers || {})[it.id] || "");
    if (!v) return;
    const i = v.indexOf(" — ");
    const lab = i >= 0 ? v.slice(0, i) : v;
    const op = optsOf(it).find((x) => x.t === lab);
    if (op) st[it.id] = op.k;
    const det = i >= 0 ? v.slice(i + 3) : (op ? "" : (lab === "Not answered" ? "" : v));
    if (det) nt[it.id] = det;
  });
  return { st, nt };
}

export default function NaturaSetup() {
  // ?respostas=1 → modo do DONO: pede a senha do /admin e mostra o que o cliente enviou, travado.
  const verRespostas = useMemo(() => { try { return new URLSearchParams(window.location.search).has("respostas"); } catch { return false; } }, []);
  const d0 = useMemo(() => (verRespostas ? {} : loadDraft()), [verRespostas]);
  const [st, setSt] = useState(d0.st || {});
  const [nt, setNt] = useState(d0.nt || {});
  const [who, setWho] = useState(d0.who || { name: "", email: "", phone: "" });
  const [hp, setHp] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [err, setErr] = useState("");
  const [envios, setEnvios] = useState(null);   // modo dono: lista de envios (mais novo primeiro)
  const [qual, setQual] = useState(0);
  const [senha, setSenha] = useState("");
  const [verErr, setVerErr] = useState("");
  const travado = verRespostas;

  useEffect(() => { document.title = verRespostas ? "Natura Spa · Respostas enviadas" : "Natura Spa · Setup checklist"; }, [verRespostas]);
  useEffect(() => {
    if (verRespostas) return;   // o modo dono nunca sobrescreve o rascunho de quem preenche neste aparelho
    try { localStorage.setItem(DRAFT, JSON.stringify({ st, nt, who })); } catch { /* sem armazenamento: segue sem rascunho */ }
  }, [st, nt, who, verRespostas]);

  function mostrar(lista, i) {
    const e = lista[i];
    if (!e) return;
    const { st: s2, nt: n2 } = lerEnvio(e.answers);
    setSt(s2); setNt(n2);
    setWho({ name: e.contact?.name || "", email: e.contact?.email || "", phone: e.answers?._filled_by_phone || "" });
    setQual(i);
  }

  async function abrirRespostas(e) {
    e.preventDefault();
    setVerErr("");
    try {
      const r = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "admin_subs", form_id: FORM_ID, senha }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) { setVerErr("Senha errada."); return; }
      if (!r.ok || !d.ok) { setVerErr("Não consegui ler as respostas agora. Tente de novo."); return; }
      const lista = (d.submissions || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      setEnvios(lista);
      if (lista.length) mostrar(lista, 0);
    } catch { setVerErr("Sem conexão com o servidor."); }
  }

  const statusOf = (it) => it.preset || st[it.id] || "";
  const answered = ALL.filter((it) => statusOf(it)).length;
  const pct = Math.round((answered / ALL.length) * 100);

  async function enviar(e) {
    e.preventDefault();
    setErr("");
    if (!who.name.trim() || !/^\S+@\S+\.\S+$/.test(who.email.trim())) { setErr("Please add your name and a valid email at the top."); return; }
    if (answered < 3) { setErr("Please answer at least a few items before sending. You can send again later."); return; }
    const answers = { _filled_by_phone: who.phone.trim() };
    ALL.forEach((it) => {
      const s = statusOf(it);
      const lab = (optsOf(it).find((x) => x.k === s) || {}).t || "Not answered";
      answers[it.id] = `${lab}${(nt[it.id] || "").trim() ? " — " + nt[it.id].trim() : ""}`.slice(0, 1000);
    });
    setState("sending");
    try {
      const r = await fetch("/api/intake", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", form_id: FORM_ID, contact: { name: who.name.trim(), email: who.email.trim() }, answers, website: hp }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok && d.stored !== false && d.ready !== false) {
        setState("sent");
        try { localStorage.removeItem(DRAFT); } catch { /* ok */ }
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else { setState("error"); setErr(d.note || d.error || "We couldn't save your answers. Please try again."); }
    } catch { setState("error"); setErr("We couldn't reach the server. Please check your connection and try again."); }
  }

  return (
    <div className="ns">
      <style>{CSS}</style>
      <header className="ns-cover">
        <div className="ns-wrap">
          <div className="ns-brands">
            <div className="ns-brand"><img src={guileoMark} alt="" /><div><b>Guileo</b><span>AI systems for business</span></div></div>
            <img className="ns-nlogo" src={naturaLogo} alt="Natura Spa" />
          </div>
          <div className="ns-eye">Setup checklist · Go-Live October 29, 2026</div>
          <h1>What we need from <em>Natura Spa.</em></h1>
          <p className="ns-lede">One place for every account and decision, platform by platform. Pick a status for each item and add details. <b>Never type a password here</b>: for every account you add us as a partner and stay the owner. Your answers are saved on this device until you press Send.</p>
          <div className="ns-prog" aria-label={`${answered} of ${ALL.length} answered`}>
            <div className="ns-bar"><i style={{ width: `${pct}%` }} /></div>
            <span><b>{answered}</b> of {ALL.length} answered</span>
          </div>
        </div>
      </header>

      <main className="ns-wrap ns-main">
        {verRespostas && envios === null ? (
          <form className="ns-card ns-who" onSubmit={abrirRespostas}>
            <h2>🔒 Respostas enviadas pela Natura</h2>
            <p className="ns-gnote">Digite a senha do /admin para ver o que foi enviado.</p>
            <div className="ns-row3">
              <label>Senha do /admin<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" autoFocus /></label>
            </div>
            {verErr && <p className="ns-err" role="alert">{verErr}</p>}
            <button type="submit" className="ns-btn">Ver respostas</button>
          </form>
        ) : verRespostas && !envios.length ? (
          <section className="ns-done" role="status"><h2>Nenhuma resposta enviada ainda.</h2></section>
        ) : state === "sent" ? (
          <section className="ns-done" role="status">
            <div className="ns-big">🌿</div>
            <h2>Thank you, {who.name.split(" ")[0] || "Lilian"}.</h2>
            <p>We received your answers. Luis will follow up on anything marked "Need help". You can come back to this page and send an update at any time.</p>
            <button type="button" className="ns-btn ghost" onClick={() => setState("idle")}>Send an update</button>
          </section>
        ) : (
          <form onSubmit={enviar} noValidate>
            {travado && envios && (
              <section className="ns-card ns-who" role="status">
                <h2>📋 Enviado por {envios[qual]?.contact?.name || "—"}</h2>
                <p className="ns-gnote">
                  {envios[qual]?.contact?.email} · {new Date(envios[qual]?.created_at).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
                  {envios.length > 1 && <> · versão {envios.length - qual} de {envios.length}</>}
                </p>
                {envios.length > 1 && (
                  <div className="ns-chips">
                    {envios.map((e, i) => (
                      <button type="button" key={e.id} className={i === qual ? "on" : ""} onClick={() => mostrar(envios, i)}>
                        {new Date(e.created_at).toLocaleDateString("pt-BR")}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
            <fieldset disabled={travado} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <section className="ns-card ns-who">
              <h2>👋 Who is filling this in</h2>
              <div className="ns-row3">
                <label>Your name<input id="ns-name" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} autoComplete="name" required /></label>
                <label>Email<input id="ns-email" type="email" value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} autoComplete="email" required /></label>
                <label>Phone <small>(optional)</small><input id="ns-phone" value={who.phone} onChange={(e) => setWho({ ...who, phone: e.target.value })} autoComplete="tel" /></label>
              </div>
              <input className="ns-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={(e) => setHp(e.target.value)} />
            </section>

            <nav className="ns-jump" aria-label="Sections">
              {GROUPS.map((g) => {
                const n = g.items.filter((it) => statusOf(it)).length;
                return <a key={g.id} href={`#${g.id}`}><span aria-hidden="true">{g.emoji}</span>{g.title}<em>{n}/{g.items.length}</em></a>;
              })}
            </nav>

            {GROUPS.map((g) => (
              <section key={g.id} id={g.id} className="ns-group">
                <h2><span aria-hidden="true">{g.emoji}</span>{g.title}</h2>
                <p className="ns-gnote">{g.note}</p>
                <div className="ns-items">
                  {g.items.map((it) => {
                    const s = statusOf(it);
                    const opts = optsOf(it);
                    return (
                      <article key={it.id} className={`ns-item${s ? " is-" + (s === "c0" ? "done" : s.startsWith("c") ? "send" : s) : ""}`}>
                        <header><span className="ns-em" aria-hidden="true">{it.emoji}</span><h3>{it.name}</h3>{it.preset && <span className="ns-ok">✅ Received</span>}</header>
                        <p className="ns-ask">{it.ask}</p>
                        {!it.preset && (
                          <>
                            <div className="ns-chips" role="radiogroup" aria-label={`${it.name} status`}>
                              {opts.map((x) => (
                                <button type="button" key={x.k} role="radio" aria-checked={s === x.k} className={s === x.k ? "on" : ""}
                                  onClick={() => setSt({ ...st, [it.id]: s === x.k ? "" : x.k })}>{x.t}</button>
                              ))}
                            </div>
                            <textarea id={`ns-${it.id}`} rows={2} placeholder={it.ph || "Anything we should know (optional)"} value={nt[it.id] || ""} maxLength={900}
                              onChange={(e) => setNt({ ...nt, [it.id]: e.target.value })} aria-label={`${it.name} details`} />
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}

            </fieldset>

            {!travado && <div className="ns-send">
              {err && <p className="ns-err" role="alert">{err}</p>}
              <button type="submit" className="ns-btn" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send to Guileo"}</button>
              <p className="ns-fine">You can send more than once; we keep every version. Questions: Luis · luistelesc@gmail.com · 929-535-0191</p>
            </div>}
          </form>
        )}
      </main>
    </div>
  );
}

const CSS = `
.ns{--paper:#FAF7F0;--panel:#FFFFFF;--panel2:#F3EEE2;--ink:#161512;--ink2:#4A463E;--muted:#6F695D;--line:#E4DDCC;--gold:#8E6D2C;--gold-hi:#D9B26A;--green:#2F8A60;--cover:#161512;--cover2:#1F1D19;--cover-line:#34312B;--cover-fg:#F3EFE7;--cover-muted:#A39D92;--err:#B4442E;
  --sans:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;background:var(--paper);color:var(--ink);font:15px/1.55 var(--sans);min-height:100vh;-webkit-font-smoothing:antialiased;color-scheme:light}
.ns *{box-sizing:border-box}
.ns-wrap{max-width:980px;margin:0 auto;padding-inline:16px}
.ns-cover{background:radial-gradient(900px 380px at 92% -20%,rgba(217,178,106,.18),transparent 60%),var(--cover);color:var(--cover-fg);border-top:5px solid var(--gold-hi)}
.ns-cover .ns-wrap{padding-block:22px 28px}
.ns-brands{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:20px;border-bottom:1px solid var(--cover-line)}
.ns-brand{display:flex;align-items:center;gap:10px}
.ns-brand img{width:34px;height:34px;border-radius:50%;display:block}
.ns-brand b{display:block;font-size:15px;font-weight:800;line-height:1.1}
.ns-brand span{display:block;font-family:ui-monospace,Menlo,monospace;font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--cover-muted);margin-top:2px}
.ns-nlogo{height:24px;width:auto;max-width:40vw;display:block;filter:brightness(0) invert(1)}
.ns-eye{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-hi);margin-top:26px}
.ns h1{margin:10px 0 0;font-size:clamp(30px,5.4vw,52px);font-weight:900;letter-spacing:-.04em;line-height:1;text-wrap:balance}
.ns h1 em{font-style:normal;color:#4FAE80}
.ns-lede{margin:14px 0 0;max-width:68ch;color:var(--cover-muted);font-size:16px}
.ns-lede b{color:var(--cover-fg)}
.ns-prog{display:flex;align-items:center;gap:14px;margin-top:22px;font-size:13px;color:var(--cover-muted)}
.ns-prog b{color:var(--cover-fg)}
.ns-bar{flex:1;max-width:420px;height:8px;border-radius:999px;background:var(--cover2);border:1px solid var(--cover-line);overflow:hidden}
.ns-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold-hi),#4FAE80);transition:width .35s ease}
.ns-main{padding-block:22px 64px}
.ns h2{margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em;display:flex;gap:10px;align-items:center}
.ns-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px}
.ns-row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px}
.ns label{display:grid;gap:5px;font-size:13px;font-weight:600;color:var(--ink2)}
.ns label small{font-weight:400;color:var(--muted)}
.ns input,.ns textarea{font:inherit;font-size:14.5px;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px 12px;width:100%;min-width:0}
.ns textarea{resize:vertical;margin-top:10px}
.ns input:focus,.ns textarea:focus{outline:2px solid var(--gold-hi);outline-offset:1px;border-color:var(--gold)}
.ns-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.ns-jump{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:18px -16px 0;padding:10px 16px;background:color-mix(in srgb,var(--paper) 92%,transparent);backdrop-filter:blur(8px);border-block:1px solid var(--line)}
.ns-jump a{display:inline-flex;gap:7px;align-items:center;white-space:nowrap;text-decoration:none;color:var(--ink2);font-size:13px;padding:6px 11px;border:1px solid var(--line);border-radius:999px;background:var(--panel)}
.ns-jump em{font-style:normal;font-variant-numeric:tabular-nums;color:var(--gold);font-weight:600}
.ns-group{margin-top:30px;scroll-margin-top:64px}
.ns-gnote{margin:6px 0 0;color:var(--muted);font-size:14px;max-width:70ch}
.ns-items{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:14px}
.ns-item{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;transition:border-color .2s,box-shadow .2s}
.ns-item header{display:flex;align-items:center;gap:10px}
.ns-item h3{margin:0;font-size:16px;font-weight:700;flex:1}
.ns-em{font-size:22px;line-height:1}
.ns-ask{margin:8px 0 0;font-size:13.5px;color:var(--ink2)}
.ns-ok{font-size:12px;font-weight:600;color:var(--green)}
.ns-item.is-done{border-color:color-mix(in srgb,var(--green) 55%,var(--line));box-shadow:0 0 0 3px color-mix(in srgb,var(--green) 10%,transparent)}
.ns-item.is-send{border-color:color-mix(in srgb,var(--gold-hi) 70%,var(--line))}
.ns-item.is-help{border-color:color-mix(in srgb,var(--err) 50%,var(--line))}
.ns-item.is-na{opacity:.7}
.ns-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.ns-chips button{font:inherit;font-size:13px;cursor:pointer;color:var(--ink2);background:var(--panel2);border:1px solid var(--line);border-radius:999px;padding:6px 11px;transition:background .15s,border-color .15s}
.ns-chips button:hover{border-color:var(--gold)}
.ns-chips button.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.ns-chips button:focus-visible,.ns-btn:focus-visible,.ns-jump a:focus-visible{outline:2px solid var(--gold-hi);outline-offset:2px}
.ns-send{margin-top:34px;display:grid;gap:10px;justify-items:start}
.ns-btn{font:inherit;font-weight:700;font-size:16px;cursor:pointer;color:var(--cover-fg);background:var(--cover);border:1px solid var(--cover);border-top:3px solid var(--gold-hi);border-radius:12px;padding:13px 26px}
.ns-btn[disabled]{opacity:.6;cursor:wait}
.ns-btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.ns-err{margin:0;color:var(--err);font-weight:600}
.ns-fine{margin:0;font-size:12.5px;color:var(--muted)}
.ns-done{text-align:left;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:28px;display:grid;gap:10px;justify-items:start}
.ns-done p{margin:0;max-width:62ch;color:var(--ink2)}
.ns-big{font-size:40px}
@media (max-width:720px){.ns-row3{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.ns *{transition:none!important}}
`;
