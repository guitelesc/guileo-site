import { useState, useEffect } from "react";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import logo from "../assets/guileo-mark.png";
import { loadDataKey } from "../lib/portalApi.js";
import { normalizePhone, phonePlaceholder } from "../lib/intl.js";

// /receber — a logged-in client connects THEIR OWN Stripe account so the Gui's charges land in their
// bank (not Guileo's). Self-contained (no Portal dependency): enter email + connection code →
// /api/stripe-connect mints the Stripe onboarding link → they finish on Stripe → money is theirs.

const T = {
  pt: {
    title: "Receber pagamentos", sub: "Conecte seu Stripe pra a Gui cobrar na ligação e o dinheiro cair direto na SUA conta.",
    email: "Seu email (o do pagamento)", code: "Código de conexão (do email de boas-vindas)",
    connect: "Conectar meu Stripe →", connecting: "Abrindo o Stripe…", need: "Preencha email e código.",
    err: "Não consegui agora. Confira o email/código e tente de novo.",
    checking: "Verificando sua conexão…", connected: "Conectado ✓ — a Gui já cobra na sua conta.", pending: "Quase lá — termine o cadastro no Stripe (pode levar uns minutos pra liberar).",
    why: "Por quê: sem isso, a Gui consegue agendar e atender, mas a cobrança não vai pra você. Com o Stripe conectado, ela fecha e o dinheiro é seu.",
    back: "← Voltar ao painel",
    notifyTitle: "📱 Avisos por SMS", notifySub: "Você já recebe um EMAIL na hora a cada pedido/agendamento. Deixe seu celular aqui e, assim que o SMS for liberado pela operadora, também avisamos por mensagem.", notifyPh: "Seu celular (ex: +1 929…)", notifySave: "Salvar celular", notifySaved: "Salvo ✓",
  },
  en: {
    title: "Get paid", sub: "Connect your Stripe so the Gui charges on the call and the money lands straight in YOUR account.",
    email: "Your email (the one you paid with)", code: "Connection code (from the welcome email)",
    connect: "Connect my Stripe →", connecting: "Opening Stripe…", need: "Enter email and code.",
    err: "Couldn't right now. Check the email/code and try again.",
    checking: "Checking your connection…", connected: "Connected ✓ — Gui now charges into your account.", pending: "Almost there — finish the Stripe setup (can take a few minutes to enable).",
    why: "Why: without this, Gui can book and answer, but the payment won't reach you. With Stripe connected, she closes and the money is yours.",
    back: "← Back to dashboard",
    notifyTitle: "📱 SMS alerts", notifySub: "You already get an EMAIL the instant Gui closes an order/booking. Leave your mobile here and, once SMS is cleared by the carrier, we'll text you too.", notifyPh: "Your mobile (e.g. +1 929…)", notifySave: "Save number", notifySaved: "Saved ✓",
  },
  es: {
    title: "Cobrar pagos", sub: "Conecta tu Stripe para que la Gui cobre en la llamada y el dinero caiga directo en TU cuenta.",
    email: "Tu correo (con el que pagaste)", code: "Código de conexión (del correo de bienvenida)",
    connect: "Conectar mi Stripe →", connecting: "Abriendo Stripe…", need: "Completa correo y código.",
    err: "No pude ahora. Revisa el correo/código e intenta de nuevo.",
    checking: "Verificando tu conexión…", connected: "Conectado ✓ — Gui ya cobra en tu cuenta.", pending: "Casi listo — termina el registro en Stripe (puede tardar unos minutos).",
    why: "Por qué: sin esto, Gui agenda y atiende, pero el cobro no llega a ti. Con Stripe conectado, cierra y el dinero es tuyo.",
    back: "← Volver al panel",
    notifyTitle: "📱 Alertas por SMS", notifySub: "Ya recibes un EMAIL al instante en cada pedido/reserva. Deja tu celular aquí y, en cuanto la operadora habilite el SMS, también te avisamos por mensaje.", notifyPh: "Tu celular (ej: +1 929…)", notifySave: "Guardar celular", notifySaved: "Guardado ✓",
  },
  hi: {
    title: "भुगतान पाएँ", sub: "अपना Stripe जोड़ें ताकि Gui कॉल पर ही वसूले और पैसा सीधे आपके खाते में जाए।",
    email: "आपका ईमेल (जिससे भुगतान किया)", code: "कनेक्शन कोड (स्वागत ईमेल से)",
    connect: "मेरा Stripe जोड़ें →", connecting: "Stripe खुल रहा है…", need: "ईमेल और कोड भरें।",
    err: "अभी नहीं हो पाया। ईमेल/कोड जाँचें और फिर कोशिश करें।",
    checking: "आपका कनेक्शन जाँच रहे हैं…", connected: "जुड़ गया ✓ — Gui अब आपके खाते में वसूलती है।", pending: "लगभग हो गया — Stripe पर पंजीकरण पूरा करें (चालू होने में कुछ मिनट लग सकते हैं)।",
    why: "क्यों: इसके बिना Gui बुकिंग और जवाब तो देती है, पर भुगतान आप तक नहीं पहुँचता। Stripe जुड़ने पर वह डील बंद करती है और पैसा आपका होता है।",
    back: "← डैशबोर्ड पर वापस",
    notifyTitle: "📱 SMS सूचनाएँ", notifySub: "हर ऑर्डर/बुकिंग पर आपको तुरंत EMAIL मिलता ही है। अपना मोबाइल यहाँ छोड़ें — कैरियर से SMS चालू होते ही हम मैसेज से भी बताएँगे।", notifyPh: "आपका मोबाइल (जैसे +1 929…)", notifySave: "नंबर सहेजें", notifySaved: "सहेजा ✓",
  },
};

export default function ConectarPagamento() {
  const { lang: gl } = useLang();
  const t = T[gl] || T.pt;
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(() => { try { return loadDataKey() || ""; } catch { return ""; } });
  const [state, setState] = useState("idle"); // idle | go | err
  const [status, setStatus] = useState(""); // "" | checking | connected | pending
  const [notifyPhone, setNotifyPhone] = useState("");
  const [notifySaved, setNotifySaved] = useState(false);

  // i18n: E.164 to the API (server strips to [0-9+] anyway, but the country code must be THERE)
  // + a live "assumed +55/+1" hint when the visitor omits it.
  const pnNotify = notifyPhone.trim() ? normalizePhone(notifyPhone, gl) : null;

  const saveNotify = async () => {
    if (!email.trim() || !code.trim() || !notifyPhone.trim()) return;
    const phoneOut = pnNotify?.ok && pnNotify.e164 ? pnNotify.e164 : notifyPhone;
    try {
      const r = await fetch("/api/notify-phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", email, token: code, phone: phoneOut }) });
      if (r.ok) { setNotifySaved(true); setTimeout(() => setNotifySaved(false), 1800); }
    } catch { /* ignore */ }
  };
  useSeo({ title: `${t.title} — Guileo`, description: t.sub, path: "/receber" });

  // Returning from Stripe onboarding → check status
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("stripe") === "connected") {
      const em = q.get("email") || email;
      if (em && code) { setStatus("checking"); check(em, code); }
    }
  }, []); // eslint-disable-line

  const check = async (em, cd) => {
    try {
      const r = await fetch("/api/stripe-connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", email: em, token: cd }) });
      const d = await r.json().catch(() => ({}));
      setStatus(d?.charges_enabled ? "connected" : "pending");
    } catch { setStatus("pending"); }
  };

  const connect = async () => {
    if (!email.trim() || !code.trim()) { setState("err"); return; }
    setState("go");
    try {
      const r = await fetch("/api/stripe-connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "link", email, token: code }) });
      const d = await r.json().catch(() => ({}));
      if (d?.ok && d.url) { window.location.href = d.url; return; }
      setState("err");
    } catch { setState("err"); }
  };

  const field = "w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-[14px] text-g-word placeholder:text-g-muted/50 focus:outline-none focus:border-g-green/50";

  return (
    <div className="surface-real min-h-screen grid place-items-center px-4 py-10 text-g-ink">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <img src={logo} alt="" className="h-10 w-10 object-contain" />
          <div className="text-[15px] font-extrabold text-g-word">💳 {t.title}</div>
        </div>

        {status === "connected" ? (
          <div className="rounded-2xl border border-g-green/30 bg-g-green/[0.08] p-5 text-[14px] font-bold text-g-word">{t.connected}</div>
        ) : status === "pending" ? (
          <div className="rounded-2xl border border-g-gold/30 bg-g-gold/[0.08] p-5 text-[14px] font-bold text-g-word">{t.pending}</div>
        ) : status === "checking" ? (
          <div className="text-[14px] text-g-muted">{t.checking}</div>
        ) : (
          <>
            <p className="text-[13px] text-g-muted leading-relaxed">{t.sub}</p>
            <div className="mt-5 space-y-3">
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} aria-label={t.email} className={field} />
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.code} aria-label={t.code} className={field} />
              {state === "err" && <div className="text-[12.5px] text-g-gold">{t.err}</div>}
              <button onClick={connect} disabled={state === "go"} className="btn-bright w-full text-[14px]">{state === "go" ? t.connecting : t.connect}</button>
            </div>
            <p className="mt-4 text-[11.5px] leading-relaxed text-g-muted">{t.why}</p>
          </>
        )}
        {/* SMS alerts — independent of Stripe; uses the same email + code entered above */}
        <div className="mt-5 rounded-2xl border border-g-green/20 bg-g-green/[0.04] p-4">
          <div className="text-[13px] font-extrabold text-g-word">{t.notifyTitle}</div>
          <p className="text-[12px] text-g-muted mt-0.5">{t.notifySub}</p>
          <div className="mt-2.5 flex gap-2">
            <input type="tel" value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} placeholder={phonePlaceholder(gl)} aria-label={t.notifyPh} className={field + " flex-1 !py-2.5"} />
            <button onClick={saveNotify} className="btn-ghost text-[12px] shrink-0">{notifySaved ? t.notifySaved : t.notifySave}</button>
          </div>
          {/* country-assumption hint — only when the code was omitted and we guessed */}
          {pnNotify?.hint && <p className="mt-1.5 text-[11px] text-g-muted" role="status">📞 {pnNotify.e164} · {pnNotify.hint}</p>}
        </div>

        <a href="/portal" className="mt-5 inline-block text-[12px] font-bold text-g-muted hover:text-g-word">{t.back}</a>
      </div>
    </div>
  );
}
