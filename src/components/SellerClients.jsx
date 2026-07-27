import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { VERTICALS } from "../data/verticals.js";

// 💼 SellerClients — the seller's WALLET ("Meus clientes"). One card per client the seller signed:
// business + industry badge, a 4-stage pipeline (draft → approved → agent born → live), the agent
// name/number once born, and the portal CONNECTION KEY with copy + "send to client" (wa.me) actions.
// Attribution is PERMANENT — the "🤝 Cliente seu" seal makes that explicit.
// Data: POST /api/onboard-draft { action:"wallet" } (falls back to action:"list" until the wallet
// action ships server-side — same rows, key fields just arrive empty). Read everything defensively.

const W = {
  pt: {
    title: "💼 Meus clientes", sub: "Sua carteira. Cada cliente que você cadastrou fica seu pra sempre — acompanhe o nascimento da Gui dele aqui.",
    refresh: "↻ Atualizar", loading: "Carregando sua carteira…",
    empty: "Nenhum cliente ainda.", emptyHint: "Cadastre o primeiro na aba ➕ Cadastrar cliente — ele entra aqui na hora e a atribuição é sua pra sempre.",
    stages: ["🌱 Rascunho", "✅ Aprovado", "🤖 Agente nascido", "🟢 No ar"],
    yours: "🤝 Cliente seu", yoursHint: "Atribuição permanente — este cliente conta pra você pra sempre.",
    agent: "Agente", number: "Número",
    keyLabel: "🔑 Chave de conexão", keyNone: "A chave de conexão aparece aqui assim que o Luis aprovar o cadastro.",
    copy: "Copiar", copied: "Copiado ✓", send: "📲 Mandar pro cliente",
    waHi: "Oi! A Gui de {biz} já está pronta 🎉", waPortal: "1) Entre no portal: https://guileoai.com/portal — com o email {email}",
    waKey: "2) Cole a chave de conexão: {code}", waFwd: "3) No telefone do negócio, disque *72 + {number} pra encaminhar as ligações (ou *71 só as perdidas)",
    waFwdNone: "3) O código de encaminhamento (*72) chega no email de boas-vindas", waBye: "Qualquer dúvida me chama!",
    err: "Não consegui carregar agora — tenta atualizar.",
  },
  en: {
    title: "💼 My clients", sub: "Your wallet. Every client you signed stays yours forever — watch their Gui being born right here.",
    refresh: "↻ Refresh", loading: "Loading your wallet…",
    empty: "No clients yet.", emptyHint: "Add the first one in the ➕ Add client tab — it lands here instantly and the attribution is yours forever.",
    stages: ["🌱 Draft", "✅ Approved", "🤖 Agent born", "🟢 Live"],
    yours: "🤝 Your client", yoursHint: "Permanent attribution — this client counts as yours forever.",
    agent: "Agent", number: "Number",
    keyLabel: "🔑 Connection key", keyNone: "The connection key shows up here as soon as Luis approves the intake.",
    copy: "Copy", copied: "Copied ✓", send: "📲 Send to client",
    waHi: "Hi! The Gui for {biz} is ready 🎉", waPortal: "1) Sign in at https://guileoai.com/portal — with the email {email}",
    waKey: "2) Paste the connection key: {code}", waFwd: "3) On the business phone, dial *72 + {number} to forward calls (or *71 for missed only)",
    waFwdNone: "3) The forwarding code (*72) arrives in the welcome email", waBye: "Ping me with any questions!",
    err: "Couldn't load right now — try refreshing.",
  },
  es: {
    title: "💼 Mis clientes", sub: "Tu cartera. Cada cliente que registraste es tuyo para siempre — sigue el nacimiento de su Gui aquí.",
    refresh: "↻ Actualizar", loading: "Cargando tu cartera…",
    empty: "Sin clientes aún.", emptyHint: "Registra el primero en la pestaña ➕ Alta cliente — entra aquí al instante y la atribución es tuya para siempre.",
    stages: ["🌱 Borrador", "✅ Aprobado", "🤖 Agente nacido", "🟢 En vivo"],
    yours: "🤝 Cliente tuyo", yoursHint: "Atribución permanente — este cliente cuenta para ti para siempre.",
    agent: "Agente", number: "Número",
    keyLabel: "🔑 Clave de conexión", keyNone: "La clave de conexión aparece aquí en cuanto Luis apruebe el alta.",
    copy: "Copiar", copied: "Copiado ✓", send: "📲 Enviar al cliente",
    waHi: "¡Hola! La Gui de {biz} ya está lista 🎉", waPortal: "1) Entra al portal: https://guileoai.com/portal — con el correo {email}",
    waKey: "2) Pega la clave de conexión: {code}", waFwd: "3) En el teléfono del negocio, marca *72 + {number} para desviar las llamadas (o *71 solo perdidas)",
    waFwdNone: "3) El código de desvío (*72) llega en el correo de bienvenida", waBye: "¡Cualquier duda me escribes!",
    err: "No pude cargar ahora — intenta actualizar.",
  },
  hi: {
    title: "💼 मेरे क्लाइंट", sub: "आपका वॉलेट। आपने जो क्लाइंट जोड़ा वह हमेशा आपका रहता है — उसकी Gui का जन्म यहीं देखें।",
    refresh: "↻ रिफ्रेश", loading: "वॉलेट लोड हो रहा है…",
    empty: "अभी कोई क्लाइंट नहीं।", emptyHint: "➕ Add client टैब में पहला क्लाइंट जोड़ें — वह तुरंत यहाँ दिखेगा और एट्रिब्यूशन हमेशा आपका रहेगा।",
    stages: ["🌱 ड्राफ्ट", "✅ स्वीकृत", "🤖 एजेंट बना", "🟢 लाइव"],
    yours: "🤝 आपका क्लाइंट", yoursHint: "स्थायी एट्रिब्यूशन — यह क्लाइंट हमेशा आपका गिना जाएगा।",
    agent: "एजेंट", number: "नंबर",
    keyLabel: "🔑 कनेक्शन कुंजी", keyNone: "Luis के अप्रूव करते ही कनेक्शन कुंजी यहाँ दिखेगी।",
    copy: "कॉपी", copied: "कॉपी हो गया ✓", send: "📲 क्लाइंट को भेजें",
    waHi: "Hi! The Gui for {biz} is ready 🎉", waPortal: "1) Sign in at https://guileoai.com/portal — with the email {email}",
    waKey: "2) Paste the connection key: {code}", waFwd: "3) On the business phone, dial *72 + {number} to forward calls (or *71 for missed only)",
    waFwdNone: "3) The forwarding code (*72) arrives in the welcome email", waBye: "Ping me with any questions!",
    err: "अभी लोड नहीं कर सका — रिफ्रेश करें।",
  },
};

// Free-text industry → vertical key (drafts may carry a description instead of a key).
const IND_HINTS = [
  ["restaurant", ["restaurant", "restaurante", "pizz", "food", "comida", "lanch", "burger", "cafe", "café", "bakery", "padaria"]],
  ["clinic", ["clinic", "clínica", "dental", "dentist", "odont", "spa", "estética", "estetica"]],
  ["salon", ["salon", "salão", "salao", "barber", "barbearia", "hair", "beleza", "nail"]],
  ["medical", ["medic", "médic", "doctor", "health", "saúde", "saude"]],
  ["gym", ["gym", "academia", "fitness", "crossfit", "pilates", "yoga"]],
  ["law", ["law", "advoga", "abogad", "legal", "attorney"]],
  ["realestate", ["real estate", "imobili", "inmobili", "realtor", "properties"]],
  ["auto", ["auto", "car ", "mec", "oficina", "detail", "tire", "pneu"]],
  ["homeservices", ["plumb", "hvac", "clean", "limpeza", "eletric", "electric", "pest", "landscap", "jardin"]],
  ["education", ["school", "escola", "course", "curso", "tutor", "educa"]],
  ["construction", ["constru", "roof", "reforma", "remodel", "paint", "pintura"]],
  ["ecommerce", ["ecommerce", "e-commerce", "loja", "store", "shop", "varejo"]],
];
function industryOf(d) {
  const raw = (
    d.industry || (Array.isArray(d.verticals) && d.verticals[0]) ||
    (d.payload && Array.isArray(d.payload.verticals) && d.payload.verticals[0]) || ""
  ).toString();
  if (VERTICALS[raw]) return { icon: VERTICALS[raw].icon, label: VERTICALS[raw].label };
  const low = raw.toLowerCase();
  for (const [key, hints] of IND_HINTS) if (hints.some((h) => low.includes(h))) return { icon: VERTICALS[key]?.icon || "🏪", label: raw || VERTICALS[key]?.label || "" };
  return { icon: "🏪", label: raw };
}

// draft → pipeline stage: 0 draft · 1 approved · 2 agent born · 3 live (number attached)
const stageOf = (d) => {
  if ((d.status || "draft") !== "live") return 0;
  if (d.agent_id && d.number) return 3;
  if (d.agent_id) return 2;
  return 1;
};

function waMessage(w, d) {
  const sub = (s, k, v) => s.split(k).join(v);
  const lines = [sub(w.waHi, "{biz}", d.business || ""), "", sub(w.waPortal, "{email}", d.client_email || "")];
  // masked codes (••••1234, team-code sellers) are useless in a message — the client already has
  // the full key in their birth email, so fall back to the "check your email" line instead.
  const cc = d.connection_code || d.code || "";
  if (cc && !cc.includes("•")) lines.push(sub(w.waKey, "{code}", cc));
  lines.push(d.number ? sub(w.waFwd, "{number}", d.number) : w.waFwdNone);
  lines.push("", w.waBye);
  return lines.join("\n");
}

function Pipeline({ w, stage }) {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto pb-0.5" aria-label={w.stages[stage]}>
      {w.stages.map((label, i) => (
        <div key={i} className="flex items-center">
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-black ring-1 transition ${
              i === stage
                ? "bg-g-green/20 text-g-green ring-g-green/50"
                : i < stage
                  ? "bg-g-green/[0.07] text-g-green/70 ring-g-green/20"
                  : "bg-white/[0.03] text-g-muted/50 ring-white/10"
            }`}
            style={i === stage ? { boxShadow: "0 0 14px rgba(62,148,104,0.35)" } : undefined}
          >
            {label}
          </span>
          {i < w.stages.length - 1 && <span className={`px-0.5 text-[10px] ${i < stage ? "text-g-green/60" : "text-g-muted/30"}`}>─</span>}
        </div>
      ))}
    </div>
  );
}

function ClientCard({ w, d, i }) {
  const [copied, setCopied] = useState(false);
  const stage = stageOf(d);
  const ind = industryOf(d);
  const code = d.connection_code || d.code || "";
  const copyCode = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14.5px] font-extrabold text-g-word">{d.business || "—"}</span>
        {(ind.icon || ind.label) && (
          <span className="rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-bold text-g-ink ring-1 ring-white/10">{ind.icon} {ind.label}</span>
        )}
        <span title={w.yoursHint} className="ml-auto rounded-full bg-g-gold/[0.12] px-2.5 py-0.5 text-[10.5px] font-black text-g-gold ring-1 ring-g-gold/35">{w.yours}</span>
      </div>
      {d.client_email && <div className="mt-1 text-[11.5px] text-g-muted">{d.client_email}</div>}

      <div className="mt-3"><Pipeline w={w} stage={stage} /></div>

      {(d.agent_id || d.number || (d.agent_name)) && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-g-ink">
          {(d.agent_name || d.agent_id) && <span>🤖 <span className="text-g-muted">{w.agent}:</span> <b className="text-g-word">{d.agent_name || d.agent_id}</b></span>}
          {d.number && <span>📞 <span className="text-g-muted">{w.number}:</span> <b className="text-g-word">{d.number}</b></span>}
        </div>
      )}

      {/* connection key — copy + hand it to the client on WhatsApp with the full activation message */}
      <div className="mt-3 rounded-xl border border-white/10 bg-[#0d0c0a]/40 p-3">
        <div className="text-[10.5px] font-black uppercase tracking-wider text-g-muted">{w.keyLabel}</div>
        {code ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-white/[0.05] px-2.5 py-1 font-mono text-[12.5px] font-bold text-g-green ring-1 ring-g-green/25">{code}</code>
            <button type="button" onClick={copyCode} className="rounded-full border border-white/15 px-3 py-1 text-[11.5px] font-bold text-g-muted hover:text-g-word">{copied ? w.copied : `📋 ${w.copy}`}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(waMessage(w, d))}`} target="_blank" rel="noopener"
              className="rounded-full bg-g-green/15 px-3 py-1 text-[11.5px] font-bold text-g-green ring-1 ring-g-green/30 hover:bg-g-green/25">{w.send}</a>
          </div>
        ) : (
          <p className="mt-1 text-[12px] leading-relaxed text-g-muted">{w.keyNone}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function SellerClients({ lang = "pt", seller }) {
  const w = W[lang] || W.pt;
  const [rows, setRows] = useState(null);      // null = loading · [] = empty · array = data
  const [err, setErr] = useState(false);

  const load = async () => {
    setErr(false);
    try {
      const call = async (action) => {
        const r = await fetch("/api/onboard-draft", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, seller_email: seller.email, seller_code: seller.code || "", seller: { name: seller.name, email: seller.email, ref: seller.ref } }),
        });
        return r.json().catch(() => ({}));
      };
      let d = await call("wallet");
      let list = d.rows || d.clients;
      if (!Array.isArray(list)) { d = await call("list"); list = d.rows || d.drafts; } // graceful until action:"wallet" ships
      if (Array.isArray(list)) setRows(list.filter((x) => (x.status || "draft") !== "deleted"));
      else { setRows([]); setErr(true); }
    } catch { setRows([]); setErr(true); }
  };
  // LIVE — refreshes itself every 30s + on tab focus, so the seller watches the Gui being born
  // (🌱→✅→🤖→🟢) with zero clicks, on the phone or anywhere.
  useEffect(() => {
    if (!seller?.email) return;
    load();
    const iv = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(iv); window.removeEventListener("focus", onFocus); };
  }, [seller?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-2xl border border-g-gold/25 bg-g-gold/[0.04] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-extrabold text-g-gold">{w.title}</div>
        <button type="button" onClick={load} className="rounded-full border border-white/15 px-3 py-1 text-[11.5px] font-bold text-g-muted hover:text-g-word">{w.refresh}</button>
      </div>
      <p className="mt-1 text-[12.5px] text-g-muted max-w-2xl">{w.sub}</p>

      {rows === null && (
        <div className="mt-3 space-y-2">
          {[0, 1].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />)}
        </div>
      )}
      {rows !== null && err && <div className="mt-3 text-[12.5px] text-g-gold">{w.err}</div>}
      {rows !== null && !err && rows.length === 0 && (
        <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
          <div className="text-3xl">🌱</div>
          <div className="mt-1.5 text-[13.5px] font-extrabold text-g-word">{w.empty}</div>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-g-muted">{w.emptyHint}</p>
        </div>
      )}
      {rows !== null && rows.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {rows.map((d, i) => <ClientCard key={d.id || i} w={w} d={d} i={i} />)}
        </div>
      )}
    </div>
  );
}
