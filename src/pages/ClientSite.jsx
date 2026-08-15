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
//
// ── E É TAMBÉM O APP ────────────────────────────────────────────────────────────────────────────
// "Websites · Apps · Loja online" era vendido com o app existindo só no contrato. Esta página é
// o app: um PWA instalável na marca do negócio — ícone e nome dele na tela inicial, abre em tela
// cheia, funciona sem rede no básico, sem passar por loja nenhuma. As peças por tenant vivem em
// functions/site/{manifest,sw,icon}/[slug].js; aqui fica o convite de instalação (só quando o
// navegador de fato instala) e o comportamento de quando já está instalado.
import { useEffect, useMemo, useState } from "react";
import VoiceWeb from "../components/VoiceWeb.jsx";
import { useParams } from "react-router-dom";
import { cabecaDoApp, registrarSw, ehIos, jaInstalado, temPrompt, instalarAgora, aoMudarInstalacao } from "../lib/pwa";

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
        call: "Ligar agora", min: "min", loading: "Carregando…", notfound: "Site não encontrado.",
        install: "Instalar app", installIos: "Adicionar à tela inicial",
        installWhy: "na tela inicial do seu celular", iosTitle: "Adicionar à Tela de Início",
        iosStep1: "Toque no botão Compartilhar do navegador", iosStep2: "Role e toque em “Adicionar à Tela de Início”",
        iosStep3: "Toque em “Adicionar” — pronto, o app fica no seu celular", close: "Fechar",
        offline: "Você está sem conexão", offlineBody: "Assim que a internet voltar, tudo aparece de novo. Preços e horários só carregam online — não mostramos informação velha.",
        retry: "Tentar de novo", talk: "Falar com a gente" },
  en: { services: "Services", book: "Get in touch", phone: "Your phone or WhatsApp", name: "Your name",
        cta: "We'll call you in 1 minute", sending: "Sending…", done: "Done! We'll call you shortly. 📞",
        err: "Couldn't send — try again?", where: "Where we are", faq: "FAQ",
        call: "Call now", min: "min", loading: "Loading…", notfound: "Site not found.",
        install: "Install app", installIos: "Add to home screen",
        installWhy: "on your phone's home screen", iosTitle: "Add to Home Screen",
        iosStep1: "Tap the browser's Share button", iosStep2: "Scroll and tap “Add to Home Screen”",
        iosStep3: "Tap “Add” — the app is now on your phone", close: "Close",
        offline: "You're offline", offlineBody: "Everything comes back as soon as you're connected. Prices and hours only load online — we don't show stale information.",
        retry: "Try again", talk: "Get in touch" },
  es: { services: "Servicios", book: "Quiero atención", phone: "Tu teléfono o WhatsApp", name: "Tu nombre",
        cta: "Te llamamos en 1 minuto", sending: "Enviando…", done: "¡Listo! Te llamamos enseguida. 📞",
        err: "No pude enviar — ¿intentas de nuevo?", where: "Dónde estamos", faq: "Preguntas frecuentes",
        call: "Llamar ahora", min: "min", loading: "Cargando…", notfound: "Sitio no encontrado.",
        install: "Instalar app", installIos: "Añadir a la pantalla de inicio",
        installWhy: "en la pantalla de inicio de tu móvil", iosTitle: "Añadir a Pantalla de Inicio",
        iosStep1: "Toca el botón Compartir del navegador", iosStep2: "Desliza y toca “Añadir a pantalla de inicio”",
        iosStep3: "Toca “Añadir” — listo, el app queda en tu móvil", close: "Cerrar",
        offline: "Estás sin conexión", offlineBody: "Todo vuelve en cuanto tengas internet. Precios y horarios solo cargan en línea — no mostramos información vieja.",
        retry: "Reintentar", talk: "Hablar con nosotros" },
};

export default function ClientSite() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");        // loading | ok | 404 | offline
  const [form, setForm] = useState({ name: "", phone: "" });
  const [sendState, setSendState] = useState("");        // "" | sending | done | err
  const [instalavel, setInstalavel] = useState(false);   // o navegador ACEITA instalar (evento real)
  const [passoIos, setPassoIos] = useState(false);       // folha com a instrução real do iPhone
  // Quem já disse "não" não é perguntado de novo. Um convite que reaparece a cada visita não é
  // convite, é insistência — e mancha a marca do NEGÓCIO, não a nossa.
  const [dispensado, setDispensado] = useState(() => {
    try { return localStorage.getItem(`gui_app_nao_${slug}`) === "1"; } catch { return false; }
  });
  const dispensar = () => {
    setDispensado(true);
    try { localStorage.setItem(`gui_app_nao_${slug}`, "1"); } catch { /* modo privado: só nesta sessão */ }
  };
  const emApp = jaInstalado();

  useEffect(() => {
    let alive = true;
    fetch(`/api/client-site?slug=${encodeURIComponent(slug || "")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!alive) return; if (d && d.found) { setData(d); setState("ok"); } else setState("404"); })
      // Rede caída não é "site não encontrado". Dizer que o negócio não existe porque o wi-fi
      // sumiu seria mentir sobre o cliente — e é a diferença entre "volto depois" e "fecharam".
      .catch(() => { if (alive) setState(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "404"); });
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

  // ── O APP ─────────────────────────────────────────────────────────────────────────────────────
  // Só depois de confirmar que o site EXISTE e está publicado. Um manifesto pendurado numa página
  // "não encontrado" faria o navegador oferecer instalar um app de um negócio que não está no ar.
  useEffect(() => {
    if (state !== "ok" || !slug) return undefined;
    const desfaz = cabecaDoApp({ slug, nome: name, cor: brand });
    registrarSw(slug);
    return desfaz;
  }, [state, slug, name, brand]);

  // O convite de instalação obedece ao navegador, não ao nosso desejo: `instalavel` só vira true
  // quando o `beforeinstallprompt` chegou de verdade.
  useEffect(() => {
    const sync = () => setInstalavel(temPrompt());
    sync();
    return aoMudarInstalacao(sync);
  }, []);

  // Atalho "Ligar agora" do ícone do app (manifest shortcuts) → /site/slug?acao=ligar.
  // Quem tocou nesse atalho pediu para ligar; abrir o discador é cumprir o pedido, não surpreender.
  useEffect(() => {
    if (state !== "ok" || !phone) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("acao") !== "ligar") return;
    params.delete("acao");
    const q = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
    window.location.href = `tel:${phone}`;
  }, [state, phone]);

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
  if (state === "offline") return (
    <div style={{ padding: 80, textAlign: "center", color: "#555", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <p style={{ fontWeight: 650, marginBottom: 8 }}>{t.offline}</p>
      <p style={{ color: "#888", maxWidth: "34ch", margin: "0 auto 20px", lineHeight: 1.55 }}>{t.offlineBody}</p>
      <button onClick={() => window.location.reload()} style={{ padding: "12px 22px", borderRadius: 999, border: "1px solid #ddd", background: "#fff", cursor: "pointer", font: "inherit" }}>{t.retry}</button>
    </div>
  );

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
    // Convite de instalação: uma pílula discreta acima da dobra inferior, nunca um pop-up que
    // cobre o conteúdo. Só aparece quando instalar é possível de verdade.
    pill: { position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: emApp ? 84 : 18, zIndex: 40,
            display: "flex", alignItems: "center", gap: 10, padding: "11px 14px 11px 18px", borderRadius: 999,
            background: brand, color: "#fff", boxShadow: "0 8px 28px rgba(0,0,0,.22)", maxWidth: "calc(100vw - 32px)" },
    pillX: { border: 0, background: "rgba(255,255,255,.18)", color: "#fff", width: 26, height: 26, borderRadius: "50%",
             cursor: "pointer", fontSize: 15, lineHeight: 1, flexShrink: 0 },
    veu: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex",
           alignItems: "flex-end", justifyContent: "center" },
    folha: { background: "#fff", borderRadius: "18px 18px 0 0", padding: "26px 22px 32px", width: "100%", maxWidth: 460 },
    passo: { display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", color: "#333", lineHeight: 1.5 },
    numero: { flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: brand, color: "#fff",
              display: "grid", placeItems: "center", fontSize: ".8rem", fontWeight: 700 },
    // Barra do app instalado: as duas ações do cliente final sempre à mão, sem rolar.
    barra: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, display: "flex", gap: 10,
             padding: "10px 14px calc(10px + env(safe-area-inset-bottom))", background: "rgba(255,255,255,.96)",
             borderTop: "1px solid #eee", backdropFilter: "blur(8px)" },
    barraBtn: { flex: 1, padding: "13px", borderRadius: 12, border: 0, background: brand, color: "#fff",
                fontWeight: 650, fontSize: ".95rem", textDecoration: "none", textAlign: "center", cursor: "pointer" },
  };

  // Quem instalou o app vê as ações numa barra fixa — o rodapé não pode ficar embaixo dela.
  if (emApp) S.foot = { ...S.foot, paddingBottom: 110 };

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

      <section id="gui-contato" style={{ ...S.sec, background: "#fafafa" }}><div style={{ ...S.wrap, maxWidth: 460 }}>
        {/* FALAR COM A GUI, POR VOZ, NO NAVEGADOR. Vem ANTES do formulário porque é o caminho
            mais curto entre a dúvida e a venda — e não passa por operadora nenhuma: sem A2P,
            sem saldo de telefonia, sem número registrado. O formulário continua intacto abaixo
            para quem não quer (ou não pode) falar. */}
        <div style={{ marginBottom: 28 }}>
          <VoiceWeb slug={slug} brand={brand} business={name} lang={(data?.lang || "pt").slice(0, 2)} phone={phone} />
        </div>
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

      {/* ── INSTALAR ────────────────────────────────────────────────────────────────────────────
          Três estados possíveis e só três — nunca um botão que não faz nada:
            • já instalado           → nada (mostramos a barra de ações em vez disso)
            • navegador aceita       → botão que abre o diálogo NATIVO de instalação
            • iPhone/iPad            → botão que abre a instrução REAL (o Safari não tem API)
          Em qualquer outro caso (desktop sem suporte, navegador que não instala): nada. */}
      {!emApp && !dispensado && (instalavel || ehIos()) ? (
        <div style={S.pill}>
          <button
            onClick={async () => {
              if (instalavel) { await instalarAgora(); setInstalavel(temPrompt()); return; }
              setPassoIos(true);
            }}
            style={{ border: 0, background: "transparent", color: "#fff", font: "inherit", fontWeight: 650, cursor: "pointer", padding: 0, textAlign: "left" }}
          >
            ⬇︎ {instalavel ? t.install : t.installIos}
            <span style={{ display: "block", fontWeight: 400, fontSize: ".78rem", opacity: 0.85 }}>{name} · {t.installWhy}</span>
          </button>
          <button aria-label={t.close} onClick={dispensar} style={S.pillX}>×</button>
        </div>
      ) : null}

      {passoIos ? (
        <div style={S.veu} onClick={() => setPassoIos(false)}>
          <div style={S.folha} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px", fontSize: "1.15rem" }}>{t.iosTitle}</h3>
            <p style={{ color: "#888", margin: "0 0 14px", fontSize: ".9rem" }}>{name}</p>
            {[t.iosStep1, t.iosStep2, t.iosStep3].map((p, i) => (
              <div key={i} style={S.passo}><span style={S.numero}>{i + 1}</span><span>{p}</span></div>
            ))}
            <button onClick={() => setPassoIos(false)} style={{ ...S.btn, marginTop: 18 }}>{t.close}</button>
          </div>
        </div>
      ) : null}

      {/* Barra do app instalado: ligar e falar sempre a um toque, sem rolar a página. */}
      {emApp ? (
        <div style={S.barra}>
          {phone ? <a href={`tel:${phone}`} style={S.barraBtn}>📞 {t.call}</a> : null}
          <button
            onClick={() => document.getElementById("gui-contato")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            style={{ ...S.barraBtn, background: "#fff", color: brand, border: `1px solid ${brand}` }}
          >
            ✍️ {t.talk}
          </button>
        </div>
      ) : null}
    </div>
  );
}
