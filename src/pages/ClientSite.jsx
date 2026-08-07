// O SITE DO CLIENTE — /site/:slug
//
// "Site · Apps · Loja" é vendido no plano Scale e não tinha máquina de entrega nenhuma.
// Esta página é essa máquina: um site real, público e indexável, montado com os dados que a
// plataforma JÁ tem (marca, serviços com preço, unidades, FAQ) — a MESMA verdade que a Gui
// usa ao telefone. Mudou o preço no cockpit, mudou no site e na boca da Gui juntos.
//
// Regras que valem aqui:
//   • Nada é inventado. Seção sem dado simplesmente não aparece — nunca um "lorem" ou um
//     depoimento fabricado. Um site local mentiroso destrói a confiança que ele deveria criar.
//   • O formulário manda o SLUG, nunca o e-mail do cliente (que ficaria visível no HTML).
//   • Este arquivo é do CLIENTE, não do cockpit: cor vem da marca dele, e o cimento quente
//     #161512 (travado no app) não se aplica aqui de propósito.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const money = (cents) => {
  const c = Number(cents);
  if (!Number.isFinite(c) || c <= 0) return "";
  const d = c / 100;
  return "$" + (Number.isInteger(d) ? d : d.toFixed(2));
};

const T = {
  pt: { services: "Serviços", book: "Quero atendimento", phone: "Seu WhatsApp ou telefone", name: "Seu nome",
        cta: "A gente te liga em 1 minuto", sending: "Enviando…", done: "Pronto! Já vamos te ligar. 📞",
        err: "Não consegui enviar — tenta de novo?", where: "Onde estamos", faq: "Perguntas frequentes",
        call: "Ligar agora", min: "min", loading: "Carregando…", notfound: "Site não encontrado." },
  en: { services: "Services", book: "Get in touch", phone: "Your phone or WhatsApp", name: "Your name",
        cta: "We'll call you in 1 minute", sending: "Sending…", done: "Done! We'll call you shortly. 📞",
        err: "Couldn't send — try again?", where: "Where we are", faq: "FAQ",
        call: "Call now", min: "min", loading: "Loading…", notfound: "Site not found." },
  es: { services: "Servicios", book: "Quiero atención", phone: "Tu teléfono o WhatsApp", name: "Tu nombre",
        cta: "Te llamamos en 1 minuto", sending: "Enviando…", done: "¡Listo! Te llamamos enseguida. 📞",
        err: "No pude enviar — ¿intentas de nuevo?", where: "Dónde estamos", faq: "Preguntas frecuentes",
        call: "Llamar ahora", min: "min", loading: "Cargando…", notfound: "Sitio no encontrado." },
};

export default function ClientSite() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");        // loading | ok | 404
  const [form, setForm] = useState({ name: "", phone: "" });
  const [sendState, setSendState] = useState("");        // "" | sending | done | err

  useEffect(() => {
    let alive = true;
    fetch(`/api/client-site?slug=${encodeURIComponent(slug || "")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!alive) return; if (d && d.found) { setData(d); setState("ok"); } else setState("404"); })
      .catch(() => { if (alive) setState("404"); });
    return () => { alive = false; };
  }, [slug]);

  const t = T[(data?.lang || "pt").slice(0, 2)] || T.pt;
  const cfg = data?.config || {};
  const brand = cfg.color || "#2F6F4E";
  const name = data?.business_name || "";
  const phone = useMemo(() => (data?.locations || []).map((l) => l.phone).find(Boolean) || "", [data]);

  // Título da aba + SEO client-side. O meta server-side vive em functions/site/[slug].js,
  // porque crawler social não roda JS.
  useEffect(() => {
    if (state === "ok" && name) document.title = `${name}${data?.locations?.[0]?.city ? " · " + data.locations[0].city : ""}`;
  }, [state, name, data]);

  async function submit(e) {
    e.preventDefault();
    if (!form.phone.trim() || sendState === "sending") return;
    setSendState("sending");
    try {
      const r = await fetch("/api/marketplace-leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_slug: slug, source: "website", name: form.name, phone: form.phone }),
      });
      // Checar o retorno: um "obrigado!" sobre um envio que falhou é a mesma falha
      // silenciosa que a plataforma acabou de varrer — aqui custaria um cliente real.
      if (!r.ok) throw new Error("send failed");
      setSendState("done"); setForm({ name: "", phone: "" });
    } catch { setSendState("err"); }
  }

  if (state === "loading") return <div style={{ padding: 80, textAlign: "center", color: "#777" }}>{T.pt.loading}</div>;
  if (state === "404") return <div style={{ padding: 80, textAlign: "center", color: "#777" }}>{T.pt.notfound}</div>;

  const S = {
    page: { background: "#fff", color: "#1a1a1a", fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif", minHeight: "100vh" },
    wrap: { maxWidth: 940, margin: "0 auto", padding: "0 20px" },
    hero: { background: `linear-gradient(160deg, ${brand} 0%, ${brand}dd 100%)`, color: "#fff", padding: "72px 0 64px" },
    h1: { fontSize: "clamp(2rem, 5vw, 3.2rem)", lineHeight: 1.08, margin: 0, fontWeight: 700, textWrap: "balance" },
    sub: { fontSize: "1.05rem", opacity: 0.92, marginTop: 16, maxWidth: "42ch", lineHeight: 1.55 },
    sec: { padding: "56px 0", borderTop: "1px solid #eee" },
    h2: { fontSize: "1.5rem", margin: "0 0 24px", fontWeight: 650 },
    grid: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" },
    card: { border: "1px solid #e8e8e8", borderRadius: 12, padding: "16px 18px", background: "#fcfcfc" },
    price: { color: brand, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
    input: { width: "100%", padding: "13px 14px", borderRadius: 10, border: "1px solid #ddd", fontSize: "1rem", marginBottom: 10, boxSizing: "border-box" },
    btn: { width: "100%", padding: "14px", borderRadius: 10, border: 0, background: brand, color: "#fff", fontSize: "1rem", fontWeight: 650, cursor: "pointer" },
    callBtn: { display: "inline-block", marginTop: 24, padding: "13px 24px", borderRadius: 999, background: "#fff", color: brand, fontWeight: 650, textDecoration: "none" },
    foot: { padding: "32px 0 48px", textAlign: "center", color: "#999", fontSize: ".85rem", borderTop: "1px solid #eee" },
  };

  return (
    <div style={S.page}>
      <header style={S.hero}>
        <div style={S.wrap}>
          {cfg.logo_url ? <img src={cfg.logo_url} alt={name} style={{ height: 48, marginBottom: 20 }} /> : null}
          <h1 style={S.h1}>{cfg.headline || name}</h1>
          {cfg.headline && name !== cfg.headline ? <div style={{ ...S.sub, fontWeight: 600, opacity: 1 }}>{name}</div> : null}
          {cfg.about ? <p style={S.sub}>{cfg.about}</p> : null}
          {phone ? <a href={`tel:${phone}`} style={S.callBtn}>📞 {t.call}</a> : null}
        </div>
      </header>

      {data.services?.length ? (
        <section style={S.sec}><div style={S.wrap}>
          <h2 style={S.h2}>{t.services}</h2>
          <div style={S.grid}>
            {data.services.map((s, i) => (
              <div key={i} style={S.card}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{s.name}</div>
                <div style={{ color: "#777", fontSize: ".9rem" }}>
                  {money(s.price_cents) ? <span style={S.price}>{money(s.price_cents)}</span> : null}
                  {money(s.price_cents) && s.duration_min ? " · " : ""}
                  {s.duration_min ? `${s.duration_min} ${t.min}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div></section>
      ) : null}

      <section style={{ ...S.sec, background: "#fafafa" }}><div style={{ ...S.wrap, maxWidth: 460 }}>
        <h2 style={{ ...S.h2, textAlign: "center" }}>{t.book}</h2>
        <p style={{ textAlign: "center", color: "#777", marginTop: -12, marginBottom: 24 }}>{t.cta}</p>
        <form onSubmit={submit}>
          <input style={S.input} placeholder={t.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input style={S.input} placeholder={t.phone} required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <button style={S.btn} type="submit" disabled={sendState === "sending"}>
            {sendState === "sending" ? t.sending : t.cta}
          </button>
        </form>
        {sendState === "done" ? <p style={{ textAlign: "center", color: brand, marginTop: 14, fontWeight: 600 }}>{t.done}</p> : null}
        {sendState === "err" ? <p style={{ textAlign: "center", color: "#b91c1c", marginTop: 14 }}>{t.err}</p> : null}
      </div></section>

      {data.locations?.length ? (
        <section style={S.sec}><div style={S.wrap}>
          <h2 style={S.h2}>{t.where}</h2>
          <div style={S.grid}>
            {data.locations.map((l, i) => (
              <div key={i} style={S.card}>
                <div style={{ fontWeight: 600 }}>{l.name}</div>
                {l.address ? <div style={{ color: "#777", fontSize: ".9rem", marginTop: 4 }}>{l.address}</div> : null}
                {l.phone ? <a href={`tel:${l.phone}`} style={{ color: brand, fontSize: ".9rem", textDecoration: "none" }}>{l.phone}</a> : null}
              </div>
            ))}
          </div>
        </div></section>
      ) : null}

      {data.faq?.length ? (
        <section style={S.sec}><div style={{ ...S.wrap, maxWidth: 680 }}>
          <h2 style={S.h2}>{t.faq}</h2>
          {data.faq.map((f, i) => (
            <details key={i} style={{ borderBottom: "1px solid #eee", padding: "14px 0" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>{f.q}</summary>
              <p style={{ color: "#555", marginTop: 10, lineHeight: 1.6 }}>{f.a}</p>
            </details>
          ))}
        </div></section>
      ) : null}

      <footer style={S.foot}>
        <div>{name}</div>
        <div style={{ marginTop: 8 }}>
          <a href="https://guileoai.com" style={{ color: "#999" }}>powered by Guileo</a>
        </div>
      </footer>
    </div>
  );
}
