import { useState } from "react";
import { waLink } from "../data/contact";
import logo from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";

// /calculator — "Missed-Revenue Calculator" ad lead-magnet. Move 2 sliders → see $/month
// you're losing to missed calls/leads → capture lead. Posts to /api/lead (→ /admin + /live).

const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

export default function Calculator() {
  const { lang } = useLang();
  useSeo({
    title: lang === "pt" ? "Calculadora de Receita Perdida — quanto chamadas perdidas custam" : lang === "es" ? "Calculadora de Ingresos Perdidos — qué cuestan las llamadas perdidas" : lang === "hi" ? "खोई कमाई कैलकुलेटर — मिस्ड कॉल की कीमत जानें" : "Missed-Revenue Calculator — What Lost Calls Cost You",
    description: lang === "pt" ? "Veja em 20 segundos quanto você perde por mês em chamadas e mensagens não atendidas — e como a IA da Guileo atende e converte cada contato 24/7. Grátis." : lang === "es" ? "Descubre en 20 segundos cuánto pierdes al mes en llamadas y mensajes sin atender — y cómo la IA de Guileo atiende y convierte cada contacto 24/7. Gratis." : lang === "hi" ? "20 सेकंड में जानें कि मिस्ड कॉल और मैसेज से आप हर महीने कितना खोते हैं — और Guileo की AI कैसे हर संपर्क का 24/7 जवाब देकर उसे ग्राहक बनाती है। मुफ़्त।" : "See in 20 seconds how much revenue you lose each month to missed calls and messages — and how Guileo's AI answers and converts every contact 24/7. Free.",
    path: "/calculator",
  });
  const [missed, setMissed] = useState(10);   // calls/messages missed per week
  const [value, setValue] = useState(300);     // avg value of a customer/job
  const [lead, setLead] = useState({ name: "", contact: "" });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(false); // a11y: true when submit fails validation
  const errText = lang === "es" ? "Completa tu nombre y contacto." : lang === "pt" ? "Preencha seu nome e contato." : lang === "hi" ? "अपना नाम और संपर्क भरें।" : "Please fill in your name and contact.";
  const C = {
    badge: { en: "Missed-Revenue Calculator", pt: "Calculadora de Receita Perdida", es: "Calculadora de Ingresos Perdidos", hi: "खोई कमाई कैलकुलेटर" },
    free: { en: "Free · 20 seconds", pt: "Grátis · 20 segundos", es: "Gratis · 20 segundos", hi: "मुफ़्त · 20 सेकंड" },
    h1a: { en: "How much are missed calls ", pt: "Quanto as ligações perdidas ", es: "¿Cuánto te cuestan las ", hi: "मिस्ड कॉल आपको " },
    h1b: { en: "costing you?", pt: "estão te custando?", es: "llamadas perdidas?", hi: "कितनी महँगी पड़ रही हैं?" },
    missedLbl: { en: "Calls & messages missed / week", pt: "Ligações & mensagens perdidas / semana", es: "Llamadas y mensajes perdidos / semana", hi: "मिस्ड कॉल & मैसेज / सप्ताह" },
    valueLbl: { en: "Avg. value of a customer / job", pt: "Valor médio de um cliente / serviço", es: "Valor promedio de un cliente / trabajo", hi: "एक ग्राहक / काम का औसत मूल्य" },
    losing: { en: "You're losing about", pt: "Você está perdendo cerca de", es: "Estás perdiendo cerca de", hi: "आप लगभग खो रहे हैं" },
    walking: { en: "walking out the door.", pt: "saindo pela porta.", es: "saliendo por la puerta.", hi: "दरवाज़े से बाहर जा रहा है।" },
    thats: { en: "that's", pt: "isso é", es: "eso es", hi: "यानी" },
    perYear: { en: "/year", pt: "/ano", es: "/año", hi: "/वर्ष" },
    moShort: { en: "mo", pt: "mês", es: "mes", hi: "माह" },
    onit: { en: "On it", pt: "Pode deixar", es: "En camino", hi: "हो गया" },
    onitD: { en: "A real human will show you exactly how Gui recovers this — usually within hours.", pt: "Uma pessoa de verdade vai te mostrar exatamente como a Gui recupera isso — normalmente em horas.", es: "Una persona real te mostrará exactamente cómo Gui recupera esto — normalmente en horas.", hi: "एक असली इंसान आपको दिखाएगा कि Gui इसे कैसे वापस लाती है — आम तौर पर कुछ घंटों में।" },
    waMsg: { en: "Message us now on WhatsApp →", pt: "Fale com a gente no WhatsApp →", es: "Escríbenos por WhatsApp →", hi: "अभी WhatsApp पर मैसेज करें →" },
    recover: { en: "Recover this with Gui — get your free plan", pt: "Recupere isso com a Gui — receba seu plano grátis", es: "Recupera esto con Gui — recibe tu plan gratis", hi: "Gui से इसे वापस पाएँ — अपना मुफ़्त प्लान लें" },
    namePh: { en: "Your name", pt: "Seu nome", es: "Tu nombre", hi: "आपका नाम" },
    contactPh: { en: "WhatsApp, phone or email", pt: "WhatsApp, telefone ou email", es: "WhatsApp, teléfono o correo", hi: "WhatsApp, फ़ोन या ईमेल" },
    stop: { en: "Stop the leak →", pt: "Estancar o vazamento →", es: "Detén la fuga →", hi: "रिसाव रोकें →" },
    nospam: { en: "No spam · Live in under 7 days · 30-day money-back.", pt: "Sem spam · No ar em 7 dias · 30 dias de garantia.", es: "Sin spam · En marcha en 7 días · 30 días de garantía.", hi: "कोई स्पैम नहीं · 7 दिनों से कम में लाइव · 30-दिन मनी-बैक।" },
  };
  const c = (k) => C[k][lang] || C[k].en;

  const CONVERT = 0.35; // a third of missed contacts would've converted
  const monthly = missed * 4.3 * CONVERT * value;
  const yearly = monthly * 12;

  async function submit(e) {
    e.preventDefault();
    if (!lead.name || !lead.contact) { setErr(true); return; }
    setErr(false);
    try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...lead, lang, leak: money(monthly), message: `Missed-revenue calc: ${missed}/wk × ${money(value)} → ${money(monthly)}/mo`, source: "calc-missed-revenue" }) }); } catch { /* graceful */ }
    setSent(true);
  }

  return (
    <div className="min-h-screen text-g-word">
      <style>{`@keyframes cfade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes cshine{to{background-position:220% center}}
        input[type=range]{-webkit-appearance:none;height:6px;border-radius:99px;background:#2B2720;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;height:22px;width:22px;border-radius:99px;background:#3E9468;cursor:pointer;box-shadow:0 0 0 4px rgba(62,148,104,.2)}`}</style>
      <div className="flex items-center justify-between px-5 py-4">
        <a href="/" className="flex items-center gap-2"><img src={logo} alt="" className="h-7 w-7 object-contain" /><span className="font-black">Guileo</span></a>
        <span className="text-[11px] font-bold uppercase tracking-wider text-g-muted">{c("badge")}</span>
      </div>

      <div className="mx-auto max-w-xl px-5 py-12" style={{ animation: "cfade .5s ease both" }}>
        <div className="text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{c("free")}</div>
          <h1 className="mt-3 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,5.5vw,3rem)" }}>
            <span className="text-g-word">{c("h1a")}</span>
            <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "cshine 7s linear infinite" }}>{c("h1b")}</span>
          </h1>
        </div>

        <div className="mt-8 space-y-7 rounded-2xl border border-g-line bg-white/[0.04] p-6 sm:p-8">
          <div>
            <div className="flex items-baseline justify-between"><label className="text-[14px] font-semibold text-g-ink">{c("missedLbl")}</label><span className="text-[20px] font-black text-g-word">{missed}</span></div>
            <input type="range" min="1" max="80" value={missed} onChange={(e) => setMissed(+e.target.value)} className="mt-3 w-full" />
          </div>
          <div>
            <div className="flex items-baseline justify-between"><label className="text-[14px] font-semibold text-g-ink">{c("valueLbl")}</label><span className="text-[20px] font-black text-g-word">{money(value)}</span></div>
            <input type="range" min="50" max="5000" step="50" value={value} onChange={(e) => setValue(+e.target.value)} className="mt-3 w-full" />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[#d8916e]/30 bg-[#d8916e]/[0.06] p-6 text-center">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#d8916e]">{c("losing")}</div>
          <div className="mt-1 text-[46px] font-black leading-none text-[#e0855f] sm:text-[56px]">{money(monthly)}<span className="text-[20px]">/{c("moShort")}</span></div>
          <div className="mt-1 text-[13px] text-g-muted">{c("thats")} <span className="font-semibold text-g-word">{money(yearly)}{c("perYear")}</span> {c("walking")}</div>
        </div>

        {sent ? (
          <div className="mt-6 rounded-2xl border border-g-green/30 bg-g-green/[0.07] p-6 text-center">
            <div className="text-3xl">🌱</div>
            <div className="mt-2 text-[17px] font-bold text-g-word">{c("onit")}, {lead.name.split(" ")[0]}!</div>
            <p className="mt-1 text-[13.5px] text-g-ink">{c("onitD")}</p>
            <a href={waLink("Hi Guileo! I used the missed-revenue calculator.")} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[13px] font-bold text-g-green">{c("waMsg")}</a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-g-line bg-white/[0.04] p-6">
            <div className="text-center text-[15px] font-bold text-g-word">{c("recover")}</div>
            <input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} required placeholder={c("namePh")} aria-label={c("namePh")} aria-invalid={err && !lead.name} aria-describedby={err && !lead.name ? "calc-err" : undefined} className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <input value={lead.contact} onChange={(e) => setLead({ ...lead, contact: e.target.value })} required placeholder={c("contactPh")} aria-label={c("contactPh")} aria-invalid={err && !lead.contact} aria-describedby={err && !lead.contact ? "calc-err" : undefined} className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            {err && <p id="calc-err" role="alert" className="text-center text-[12.5px] font-semibold text-g-gold">{errText}</p>}
            <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110">{c("stop")}</button>
            <p className="text-center text-[11px] text-g-muted">{c("nospam")}</p>
          </form>
        )}
      </div>
    </div>
  );
}
