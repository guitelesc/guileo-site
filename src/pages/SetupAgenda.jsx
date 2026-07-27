import { useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useSeo } from "../lib/seo.js";
import { useLang } from "../i18n.jsx";

// Admin onboarding for the scheduling engine: build a business (locations, services, professionals
// + weekly hours) and save it in one call via /api/setup-business. No code, no SQL.
const WD_BY_LANG = {
  en: [["Sun", 0], ["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6]],
  pt: [["Dom", 0], ["Seg", 1], ["Ter", 2], ["Qua", 3], ["Qui", 4], ["Sex", 5], ["Sáb", 6]],
  es: [["Dom", 0], ["Lun", 1], ["Mar", 2], ["Mié", 3], ["Jue", 4], ["Vie", 5], ["Sáb", 6]],
  hi: [["रवि", 0], ["सोम", 1], ["मंगल", 2], ["बुध", 3], ["गुरु", 4], ["शुक्र", 5], ["शनि", 6]],
};
const toMin = (t) => { const [h, m] = (t || "09:00").split(":").map(Number); return h * 60 + (m || 0); };
const field = "w-full rounded-xl border border-g-line bg-white/[0.05] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted focus:border-g-gold/50 focus:outline-none";
const lbl = "text-[11px] font-bold uppercase tracking-wide text-g-muted";

// Per-page 4-lang dict — PT copy preserved exactly as before.
const UI = {
  seoTitle: { en: "Schedule Setup | Guileo", pt: "Setup da Agenda | Guileo", es: "Setup de la Agenda | Guileo", hi: "एजेंडा सेटअप | Guileo" },
  seoDesc: { en: "Onboarding for the scheduling engine.", pt: "Cadastro do motor de agenda.", es: "Alta del motor de agenda.", hi: "शेड्यूलिंग इंजन का सेटअप।" },
  h1: { en: "⚙️ Client Schedule Setup", pt: "⚙️ Setup da Agenda do cliente", es: "⚙️ Setup de la Agenda del cliente", hi: "⚙️ क्लाइंट एजेंडा सेटअप" },
  sub: { en: "Register locations, services and professionals. Gui starts booking for real for this business.", pt: "Cadastre unidades, serviços e profissionais. O Gui passa a marcar de verdade pra esse negócio.", es: "Registra sedes, servicios y profesionales. Gui empieza a agendar de verdad para ese negocio.", hi: "लोकेशन, सेवाएँ और प्रोफ़ेशनल दर्ज करें। गुई इस बिज़नेस के लिए असली बुकिंग शुरू कर देती है।" },
  tokenLbl: { en: "Admin token", pt: "Token admin", es: "Token admin", hi: "एडमिन टोकन" },
  tokenPh: { en: "your admin password", pt: "sua senha de admin", es: "tu contraseña de admin", hi: "आपका एडमिन पासवर्ड" },
  emailLbl: { en: "Business email (identifier)", pt: "Email do negócio (identificador)", es: "Email del negocio (identificador)", hi: "बिज़नेस ईमेल (पहचानकर्ता)" },
  emailPh: { en: "clinic@client.com", pt: "clinica@cliente.com", es: "clinica@cliente.com", hi: "clinic@client.com" },
  locations: { en: "📍 Locations", pt: "📍 Unidades", es: "📍 Sedes", hi: "📍 लोकेशन" },
  add: { en: "+ add", pt: "+ adicionar", es: "+ añadir", hi: "+ जोड़ें" },
  locNamePh: { en: "Downtown Location", pt: "Unidade Centro", es: "Sede Centro", hi: "मुख्य लोकेशन" },
  cityPh: { en: "City", pt: "Cidade", es: "Ciudad", hi: "शहर" },
  services: { en: "💈 Services", pt: "💈 Serviços", es: "💈 Servicios", hi: "💈 सेवाएँ" },
  svcNamePh: { en: "Cleaning / Haircut / Consultation", pt: "Limpeza / Corte / Consulta", es: "Limpieza / Corte / Consulta", hi: "क्लीनिंग / कटिंग / कंसल्टेशन" },
  min: { en: "min", pt: "min", es: "min", hi: "मिनट" },
  price: { en: "price $", pt: "preço $", es: "precio $", hi: "कीमत $" },
  buffer: { en: "buffer min", pt: "limpeza min", es: "limpieza min", hi: "बफ़र मिनट" },
  deposit: { en: "deposit $", pt: "sinal $", es: "seña $", hi: "डिपॉज़िट $" },
  capacity: { en: "slots", pt: "vagas", es: "cupos", hi: "स्लॉट" },
  pros: { en: "👤 Professionals / Resources", pt: "👤 Profissionais / Recursos", es: "👤 Profesionales / Recursos", hi: "👤 प्रोफ़ेशनल / संसाधन" },
  proNamePh: { en: "Dr. Ana / Table 1 / Bay 2", pt: "Dra. Ana / Mesa 1 / Baia 2", es: "Dra. Ana / Mesa 1 / Puesto 2", hi: "डॉ. आना / टेबल 1 / बे 2" },
  proTitlePh: { en: "Dentist (optional)", pt: "Dentista (opcional)", es: "Dentista (opcional)", hi: "डेंटिस्ट (वैकल्पिक)" },
  whichSvcs: { en: "which services they do", pt: "faz quais serviços", es: "qué servicios hace", hi: "कौन-सी सेवाएँ करता है" },
  addSvcsFirst: { en: "add services above", pt: "cadastre serviços acima", es: "registra servicios arriba", hi: "पहले ऊपर सेवाएँ जोड़ें" },
  whichLocs: { en: "which locations they serve", pt: "atende em quais unidades", es: "en qué sedes atiende", hi: "किन लोकेशन पर काम करता है" },
  addLocsFirst: { en: "add locations above", pt: "cadastre unidades acima", es: "registra sedes arriba", hi: "पहले ऊपर लोकेशन जोड़ें" },
  days: { en: "days", pt: "dias", es: "días", hi: "दिन" },
  from: { en: "from", pt: "das", es: "de", hi: "से" },
  to: { en: "to", pt: "às", es: "a", hi: "तक" },
  replace: { en: "Replace this business's previous setup (recommended)", pt: "Substituir cadastro anterior deste negócio (recomendado)", es: "Reemplazar el registro anterior de este negocio (recomendado)", hi: "इस बिज़नेस का पिछला सेटअप बदलें (अनुशंसित)" },
  saving: { en: "Saving…", pt: "Salvando…", es: "Guardando…", hi: "सहेजा जा रहा है…" },
  save: { en: "💾 Save business into Gui's schedule", pt: "💾 Salvar negócio na agenda do Gui", es: "💾 Guardar negocio en la agenda de Gui", hi: "💾 बिज़नेस को गुई के एजेंडा में सहेजें" },
  okA: { en: "✅ Saved!", pt: "✅ Cadastrado!", es: "✅ ¡Registrado!", hi: "✅ दर्ज हो गया!" },
  okB: { en: "location(s)", pt: "unidade(s)", es: "sede(s)", hi: "लोकेशन" },
  okC: { en: "service(s)", pt: "serviço(s)", es: "servicio(s)", hi: "सेवा(एँ)" },
  okD: { en: "professional(s)", pt: "profissional(is)", es: "profesional(es)", hi: "प्रोफ़ेशनल" },
  okE: { en: "Gui now books for", pt: "O Gui já marca pra", es: "Gui ya agenda para", hi: "गुई अब बुकिंग करती है:" },
};

export default function SetupAgenda() {
  const { lang } = useLang();
  const u = (k) => (UI[k] && (UI[k][lang] || UI[k].en)) || "";
  const WD = WD_BY_LANG[lang] || WD_BY_LANG.en;
  useSeo({ title: u("seoTitle"), description: u("seoDesc"), path: "/setup-agenda" });
  const [token, setToken] = useState(() => { try { return sessionStorage.getItem("guileo_admin_tok") || ""; } catch { return ""; } });
  const [email, setEmail] = useState("");
  const [locations, setLocations] = useState([{ name: "", city: "" }]);
  const [services, setServices] = useState([{ name: "", duration_min: 30, price_cents: "", buffer_after_min: 0, deposit_cents: "", capacity: 1 }]);
  const [pros, setPros] = useState([{ name: "", title: "", kind: "staff", services: [], locations: [], days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }]);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const up = (setter, i, patch) => setter((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const toggle = (setter, i, key, val) => setter((arr) => arr.map((x, j) => (j === i ? { ...x, [key]: x[key].includes(val) ? x[key].filter((v) => v !== val) : [...x[key], val] } : x)));

  const save = async () => {
    setBusy(true); setResult(null);
    try {
      sessionStorage.setItem("guileo_admin_tok", token);
      const payload = {
        replace,
        locations: locations.filter((l) => l.name.trim()).map((l) => ({ name: l.name.trim(), city: l.city })),
        services: services.filter((s) => s.name.trim()).map((s) => ({
          name: s.name.trim(), duration_min: Number(s.duration_min) || 30,
          price_cents: s.price_cents ? Math.round(Number(s.price_cents) * 100) : null,
          buffer_after_min: Number(s.buffer_after_min) || 0,
          deposit_cents: s.deposit_cents ? Math.round(Number(s.deposit_cents) * 100) : null,
          capacity: Number(s.capacity) || 1,
        })),
        professionals: pros.filter((p) => p.name.trim()).map((p) => ({
          name: p.name.trim(), title: p.title, kind: p.kind,
          services: p.services, locations: p.locations,
          schedule: p.locations.flatMap((loc) => p.days.map((d) => ({ location: loc, weekday: d, start_min: toMin(p.start), end_min: toMin(p.end) }))),
        })),
      };
      const r = await fetch("/api/setup-business", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, business_email: email.trim(), payload }) });
      setResult(await r.json());
    } catch (e) { setResult({ error: String(e) }); }
    setBusy(false);
  };

  const card = "rounded-xl3 border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl";
  const svcNames = services.map((s) => s.name.trim()).filter(Boolean);
  const locNames = locations.map((l) => l.name.trim()).filter(Boolean);

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />
      <section className="wrap pt-28 pb-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-black tracking-tight text-g-word">{u("h1")}</h1>
          <p className="mt-2 text-[14px] text-g-light/80">{u("sub")}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div><div className={lbl}>{u("tokenLbl")}</div><input type="password" value={token} onChange={(e) => setToken(e.target.value)} className={field} placeholder={u("tokenPh")} /></div>
            <div><div className={lbl}>{u("emailLbl")}</div><input value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder={u("emailPh")} /></div>
          </div>

          {/* LOCATIONS */}
          <div className={`${card} mt-6`}>
            <div className="flex items-center justify-between"><div className="font-extrabold text-g-word">{u("locations")}</div><button onClick={() => setLocations((a) => [...a, { name: "", city: "" }])} className="text-[12px] font-bold text-g-gold">{u("add")}</button></div>
            <div className="mt-3 space-y-2">
              {locations.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input value={l.name} onChange={(e) => up(setLocations, i, { name: e.target.value })} className={field} placeholder={u("locNamePh")} />
                  <input value={l.city} onChange={(e) => up(setLocations, i, { city: e.target.value })} className={field} placeholder={u("cityPh")} />
                  <button onClick={() => setLocations((a) => a.filter((_, j) => j !== i))} className="px-2 text-g-muted hover:text-red-400">✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* SERVICES */}
          <div className={`${card} mt-4`}>
            <div className="flex items-center justify-between"><div className="font-extrabold text-g-word">{u("services")}</div><button onClick={() => setServices((a) => [...a, { name: "", duration_min: 30, price_cents: "", buffer_after_min: 0, deposit_cents: "", capacity: 1 }])} className="text-[12px] font-bold text-g-gold">{u("add")}</button></div>
            <div className="mt-3 space-y-3">
              {services.map((s, i) => (
                <div key={i} className="rounded-xl border border-white/10 p-3">
                  <div className="flex gap-2">
                    <input value={s.name} onChange={(e) => up(setServices, i, { name: e.target.value })} className={field} placeholder={u("svcNamePh")} />
                    <button onClick={() => setServices((a) => a.filter((_, j) => j !== i))} className="px-2 text-g-muted hover:text-red-400">✕</button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <label className="block"><span className={lbl}>{u("min")}</span><input type="number" value={s.duration_min} onChange={(e) => up(setServices, i, { duration_min: e.target.value })} className={field} /></label>
                    <label className="block"><span className={lbl}>{u("price")}</span><input type="number" value={s.price_cents} onChange={(e) => up(setServices, i, { price_cents: e.target.value })} className={field} placeholder="150" /></label>
                    <label className="block"><span className={lbl}>{u("buffer")}</span><input type="number" value={s.buffer_after_min} onChange={(e) => up(setServices, i, { buffer_after_min: e.target.value })} className={field} /></label>
                    <label className="block"><span className={lbl}>{u("deposit")}</span><input type="number" value={s.deposit_cents} onChange={(e) => up(setServices, i, { deposit_cents: e.target.value })} className={field} placeholder="0" /></label>
                    <label className="block"><span className={lbl}>{u("capacity")}</span><input type="number" value={s.capacity} onChange={(e) => up(setServices, i, { capacity: e.target.value })} className={field} /></label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PROFESSIONALS */}
          <div className={`${card} mt-4`}>
            <div className="flex items-center justify-between"><div className="font-extrabold text-g-word">{u("pros")}</div><button onClick={() => setPros((a) => [...a, { name: "", title: "", kind: "staff", services: [], locations: [], days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }])} className="text-[12px] font-bold text-g-gold">{u("add")}</button></div>
            <div className="mt-3 space-y-3">
              {pros.map((p, i) => (
                <div key={i} className="rounded-xl border border-white/10 p-3">
                  <div className="flex gap-2">
                    <input value={p.name} onChange={(e) => up(setPros, i, { name: e.target.value })} className={field} placeholder={u("proNamePh")} />
                    <input value={p.title} onChange={(e) => up(setPros, i, { title: e.target.value })} className={field} placeholder={u("proTitlePh")} />
                    <button onClick={() => setPros((a) => a.filter((_, j) => j !== i))} className="px-2 text-g-muted hover:text-red-400">✕</button>
                  </div>
                  <div className="mt-2"><span className={lbl}>{u("whichSvcs")}</span><div className="mt-1 flex flex-wrap gap-1.5">{svcNames.length ? svcNames.map((n) => <button key={n} onClick={() => toggle(setPros, i, "services", n)} className={`rounded-full px-2.5 py-1 text-[12px] ${p.services.includes(n) ? "bg-g-green/20 text-g-light border border-g-green/40" : "bg-white/5 text-g-muted border border-white/10"}`}>{n}</button>) : <span className="text-[12px] text-g-muted">{u("addSvcsFirst")}</span>}</div></div>
                  <div className="mt-2"><span className={lbl}>{u("whichLocs")}</span><div className="mt-1 flex flex-wrap gap-1.5">{locNames.length ? locNames.map((n) => <button key={n} onClick={() => toggle(setPros, i, "locations", n)} className={`rounded-full px-2.5 py-1 text-[12px] ${p.locations.includes(n) ? "bg-g-green/20 text-g-light border border-g-green/40" : "bg-white/5 text-g-muted border border-white/10"}`}>{n}</button>) : <span className="text-[12px] text-g-muted">{u("addLocsFirst")}</span>}</div></div>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <div><span className={lbl}>{u("days")}</span><div className="mt-1 flex gap-1">{WD.map(([d, n]) => <button key={n} onClick={() => toggle(setPros, i, "days", n)} className={`h-7 w-9 rounded text-[11px] ${p.days.includes(n) ? "bg-g-gold/25 text-g-word" : "bg-white/5 text-g-muted"}`}>{d}</button>)}</div></div>
                    <label className="block"><span className={lbl}>{u("from")}</span><input type="time" value={p.start} onChange={(e) => up(setPros, i, { start: e.target.value })} className={field} /></label>
                    <label className="block"><span className={lbl}>{u("to")}</span><input type="time" value={p.end} onChange={(e) => up(setPros, i, { end: e.target.value })} className={field} /></label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 text-[13px] text-g-light"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> {u("replace")}</label>

          <button onClick={save} disabled={busy || !token || !email} className="btn-bright mt-5 disabled:opacity-50">{busy ? u("saving") : u("save")}</button>

          {result && (
            <div className={`mt-4 ${card} ${result.error ? "border-red-500/40" : "border-g-green/40"}`}>
              {result.error ? <div className="text-red-300">⚠️ {result.error}</div> : <div className="text-g-light">{u("okA")} {result.locations} {u("okB")}, {result.services} {u("okC")}, {result.professionals} {u("okD")}. {u("okE")} <b className="text-g-word">{result.business_email}</b>.</div>}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
