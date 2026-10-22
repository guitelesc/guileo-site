// FORMULÁRIO PÚBLICO — /f/:id
//
// A ficha que a CLIENTE do negócio preenche pelo link (anamnese antes da massagem, termo,
// cadastro). Fundo claro e calmo — não é a Central do dono.
//
// Regras que valem aqui:
//   • Os campos vêm de /api/intake {action:"get_form"}; o tenant nunca sai do navegador — só o id.
//   • "Obrigado" SÓ quando o servidor confirma que gravou (ok && stored). ok:true com
//     ready:false NÃO gravou nada, e a tela não finge que gravou.
//   • Assinatura: canvas (mouse e toque) → PNG reduzido para no máximo 600×200, conferido contra
//     o teto de 90.000 caracteres ANTES de enviar. Com assinatura, a declaração é obrigatória.
//   • Campos de nome/telefone/e-mail que o dono colocou no formulário viram o bloco de contato
//     (não aparecem duas vezes).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

const T = {
  en: {
    loading: "Loading…", notFound: "This form isn't available.", notFoundBody: "The link may be incomplete or the form may have been closed. Please contact the business directly.",
    closed: "This form is no longer accepting responses.", loadErr: "We couldn't load this form. Please try again in a moment.", retry: "Try again",
    contact: "Your contact details", name: "Full name", phone: "Mobile phone", email: "Email", required: "required",
    yes: "Yes", select: "Select…", signature: "Signature", signHere: "Sign here with your finger or mouse", clear: "Clear",
    consent: "I confirm the information is true and I agree to the terms above.", submit: "Submit", sending: "Sending…",
    thanks: "Thank you", thanksBody: "Your form was received.", errRequired: "Please fill in the required fields.",
    errContact: "Please enter a phone number or email.", errSigReq: "Please sign the form.", errConsent: "Please confirm the statement to submit your signature.",
    errSigBig: "The signature is too large to send. Please clear it and sign again.", errSend: "We couldn't send your form. Please try again.",
    errEmail: "Please enter a valid email.",
  },
  pt: {
    loading: "Carregando…", notFound: "Este formulário não está disponível.", notFoundBody: "O link pode estar incompleto ou o formulário foi encerrado. Fale diretamente com o estabelecimento.",
    closed: "Este formulário não está mais recebendo respostas.", loadErr: "Não conseguimos carregar o formulário. Tente de novo em instantes.", retry: "Tentar de novo",
    contact: "Seus dados de contato", name: "Nome completo", phone: "Celular", email: "E-mail", required: "obrigatório",
    yes: "Sim", select: "Selecione…", signature: "Assinatura", signHere: "Assine aqui com o dedo ou o mouse", clear: "Limpar",
    consent: "Confirmo que as informações são verdadeiras e concordo com os termos acima.", submit: "Enviar", sending: "Enviando…",
    thanks: "Obrigado", thanksBody: "Recebemos o seu formulário.", errRequired: "Preencha os campos obrigatórios.",
    errContact: "Informe um telefone ou e-mail.", errSigReq: "Assine o formulário, por favor.", errConsent: "Confirme a declaração para enviar sua assinatura.",
    errSigBig: "A assinatura ficou grande demais para enviar. Limpe e assine de novo.", errSend: "Não conseguimos enviar o formulário. Tente de novo.",
    errEmail: "Informe um e-mail válido.",
  },
  es: {
    loading: "Cargando…", notFound: "Este formulario no está disponible.", notFoundBody: "Puede que el enlace esté incompleto o que el formulario se haya cerrado. Contacta directamente con el negocio.",
    closed: "Este formulario ya no acepta respuestas.", loadErr: "No pudimos cargar el formulario. Inténtalo de nuevo en un momento.", retry: "Reintentar",
    contact: "Tus datos de contacto", name: "Nombre completo", phone: "Celular", email: "Correo electrónico", required: "obligatorio",
    yes: "Sí", select: "Selecciona…", signature: "Firma", signHere: "Firma aquí con el dedo o el ratón", clear: "Borrar",
    consent: "Confirmo que la información es verdadera y acepto los términos anteriores.", submit: "Enviar", sending: "Enviando…",
    thanks: "Gracias", thanksBody: "Recibimos tu formulario.", errRequired: "Completa los campos obligatorios.",
    errContact: "Escribe un teléfono o correo.", errSigReq: "Firma el formulario, por favor.", errConsent: "Confirma la declaración para enviar tu firma.",
    errSigBig: "La firma es demasiado grande para enviarla. Bórrala y firma de nuevo.", errSend: "No pudimos enviar el formulario. Inténtalo de nuevo.",
    errEmail: "Escribe un correo válido.",
  },
};
const detectLang = () => {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q && T[q]) return q;
    const l = (navigator.language || "en").slice(0, 2).toLowerCase();
    return T[l] ? l : "en";
  } catch { return "en"; }
};

const C = { bg: "#F7F4EF", card: "#FFFFFF", ink: "#2B2A27", soft: "#6E6A62", line: "#E7E1D7", accent: "#5E7A64", accentSoft: "#EEF2EC", warn: "#8A6D3B", warnSoft: "#F6EFE2" };
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const SIG_MAX = 90000;

const fold = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// qual campo do dono é, na verdade, o bloco de contato
const contactRole = (f) => {
  const k = `${fold(f.key)} ${fold(f.label)}`;
  const ty = fold(f.type);
  if (ty === "email" || /\b(e-?mail|correo)\b/.test(k)) return "email";
  if (ty === "tel" || /\b(phone|telefone|telefono|celular|whatsapp|mobile)\b/.test(k)) return "phone";
  if (/^(name|nome|nombre|full name|nome completo|nombre completo|your name|seu nome|tu nombre)$/.test(fold(f.label).trim()) || /^(name|nome|nombre)$/.test(fold(f.key))) return "name";
  return "";
};
const optionsOf = (f) => {
  const o = f.options ?? f.choices;
  if (Array.isArray(o)) return o.map((x) => (typeof x === "object" && x ? (x.label ?? x.value ?? "") : x)).map(String).filter(Boolean);
  if (typeof o === "string") return o.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  return [];
};

export default function Formulario() {
  const { id } = useParams();
  const [lang, setLang] = useState(detectLang);
  const t = T[lang];

  const [state, setState] = useState("loading"); // loading | ok | 404 | error | done
  const [form, setForm] = useState(null);
  const [reload, setReload] = useState(0);
  const [answers, setAnswers] = useState({});
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [hasSig, setHasSig] = useState(false);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [closedNote, setClosedNote] = useState("");

  useEffect(() => { try { document.documentElement.lang = lang; } catch { /* sem DOM */ } }, [lang]);

  useEffect(() => {
    let alive = true;
    fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_form", form_id: id || "" }) })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!alive) return;
        if (r.status === 404 || r.status === 400) { setState("404"); return; }
        if (!r.ok || !d || d.ok !== true) { setState("error"); return; }
        setForm(d); setState("ok");
      })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [id, reload]);

  const fields = useMemo(() => (form && Array.isArray(form.fields) ? form.fields : []).filter((f) => f && (f.key || f.label)), [form]);
  const roles = useMemo(() => {
    const r = { name: null, phone: null, email: null };
    fields.forEach((f) => { const role = contactRole(f); if (role && !r[role]) r[role] = f; });
    return r;
  }, [fields]);
  const sigField = useMemo(() => fields.find((f) => fold(f.type) === "signature"), [fields]);
  const bodyFields = useMemo(() => fields.filter((f) => f !== roles.name && f !== roles.phone && f !== roles.email && f !== sigField), [fields, roles, sigField]);
  const business = form && (typeof form.business === "string" ? form.business : form.business && (form.business.name || form.business.business_name)) || "";
  // a aba do navegador mostra o formulário e o negócio, não a Guileo
  useEffect(() => { try { if (form && form.name) document.title = business ? `${form.name} · ${business}` : form.name; } catch { /* sem DOM */ } }, [form, business]);

  // ── signature pad ─────────────────────────────────────────────────────────────────────────
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const setupCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2.4; ctx.strokeStyle = "#1F1E1B";
    setHasSig(false);
  }, []);
  useEffect(() => {
    if (state !== "ok") return undefined;
    setupCanvas();
    const c = canvasRef.current;
    if (!c) return undefined;
    // bloqueia o scroll da página enquanto o dedo assina (listener não-passivo)
    const stop = (e) => { if (drawing.current) e.preventDefault(); };
    c.addEventListener("touchmove", stop, { passive: false });
    return () => c.removeEventListener("touchmove", stop);
  }, [state, setupCanvas]);
  const pt = (e) => { const r = canvasRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e) => {
    e.preventDefault();
    try { canvasRef.current.setPointerCapture(e.pointerId); } catch { /* ok */ }
    drawing.current = true; last.current = pt(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath(); ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2); ctx.fillStyle = "#1F1E1B"; ctx.fill();
    setHasSig(true);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pt(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const up = () => { drawing.current = false; last.current = null; };
  const clearSig = () => { setupCanvas(); setConsent(false); };

  // PNG reduzido (máx. 600×200), conferido contra o teto do servidor
  const exportSig = () => {
    const c = canvasRef.current;
    if (!c || !hasSig) return "";
    for (const scale of [1, 0.75, 0.5]) {
      const ratio = Math.min(1, (600 * scale) / c.width, (200 * scale) / c.height);
      const w = Math.max(1, Math.round(c.width * ratio)), h = Math.max(1, Math.round(c.height * ratio));
      const o = document.createElement("canvas");
      o.width = w; o.height = h;
      o.getContext("2d").drawImage(c, 0, 0, w, h);
      const url = o.toDataURL("image/png");
      if (url.length <= SIG_MAX) return url;
    }
    return null; // grande demais
  };

  const setA = (k, v) => setAnswers((a) => ({ ...a, [k]: v }));
  const keyOf = (f) => (f.key || f.label).toString();

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setErr("");
    const isReq = (f) => !!(f && f.required);
    const missing = bodyFields.some((f) => {
      if (!isReq(f)) return false;
      const v = answers[keyOf(f)];
      return fold(f.type) === "checkbox" ? v !== true : !(v || "").toString().trim();
    });
    if (missing || (isReq(roles.name) && !contact.name.trim()) || (isReq(roles.phone) && !contact.phone.trim()) || (isReq(roles.email) && !contact.email.trim())) {
      setErr(t.errRequired); return;
    }
    if (!contact.name.trim()) { setErr(t.errRequired); return; }
    if (!contact.phone.trim() && !contact.email.trim()) { setErr(t.errContact); return; }
    if (contact.phone.trim() && contact.phone.replace(/\D/g, "").length < 7) { setErr(t.errContact); return; }
    if (contact.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) { setErr(t.errEmail); return; }
    if (sigField && sigField.required && !hasSig) { setErr(t.errSigReq); return; }
    if (hasSig && !consent) { setErr(t.errConsent); return; }

    const out = {};
    bodyFields.forEach((f) => {
      const k = keyOf(f);
      const v = answers[k];
      if (fold(f.type) === "checkbox") out[k] = v === true ? "yes" : "no";
      else if (v != null && v.toString().trim()) out[k] = v.toString().trim();
    });
    if (hasSig) {
      const sig = exportSig();
      if (!sig) { setErr(t.errSigBig); return; }
      out.signature = sig;
      out.consent = "yes";
    }

    setSending(true);
    try {
      const r = await fetch("/api/intake", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", form_id: id, contact: { name: contact.name.trim(), phone: contact.phone.trim(), email: contact.email.trim() }, answers: out, website: hp }),
      });
      const d = await r.json().catch(() => null);
      if (r.status === 404) { setState("404"); return; }
      if (r.status === 410) { setClosedNote(t.closed); setState("404"); return; }
      // ✅ só com comprovante de gravação
      if (r.ok && d && d.ok === true && d.stored === true) { setState("done"); window.scrollTo(0, 0); return; }
      setErr(t.errSend);
    } catch { setErr(t.errSend); }
    finally { setSending(false); }
  };

  // ── render ────────────────────────────────────────────────────────────────────────────────
  const S = {
    page: { minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: FONT, WebkitFontSmoothing: "antialiased" },
    wrap: { maxWidth: 600, margin: "0 auto", padding: "20px 16px 56px" },
    card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, boxShadow: "0 1px 2px rgba(43,42,39,.04)" },
    h1: { fontFamily: SERIF, fontWeight: 500, fontSize: 28, letterSpacing: "-0.01em", margin: "6px 0 2px", lineHeight: 1.2 },
    h2: { fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: C.soft, fontWeight: 600, margin: "0 0 14px" },
    btn: { width: "100%", background: C.accent, color: "#fff", border: 0, borderRadius: 14, padding: "15px 18px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: FONT },
    input: { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 12, padding: "13px 14px", fontSize: 16, background: "#FCFBF9", color: C.ink, fontFamily: FONT, outline: "none" },
    label: { display: "block", fontSize: 14, color: C.ink, margin: "0 0 6px", fontWeight: 500 },
    muted: { color: C.soft, fontSize: 14, lineHeight: 1.5 },
  };
  const req = <span style={{ color: C.warn, marginLeft: 3 }} aria-label={t.required}>*</span>;

  const LangSwitch = (
    <div style={{ display: "flex", gap: 2, background: "#EFEAE2", borderRadius: 999, padding: 3 }} role="group" aria-label="Language">
      {["en", "pt", "es"].map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
          style={{ border: 0, borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
            background: lang === l ? "#fff" : "transparent", color: lang === l ? C.ink : C.soft, boxShadow: lang === l ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );

  const renderField = (f) => {
    const k = keyOf(f);
    const ty = fold(f.type) || "text";
    const fid = `f-${k.replace(/[^a-z0-9_-]/gi, "_")}`;
    const label = (f.label || f.key).toString();
    const v = answers[k];
    if (ty === "checkbox") {
      return (
        <label key={k} htmlFor={fid} style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", fontSize: 15, lineHeight: 1.45 }}>
          <input id={fid} type="checkbox" checked={v === true} onChange={(e) => setA(k, e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: C.accent, flex: "0 0 auto" }} />
          <span>{label}{f.required ? req : null}</span>
        </label>
      );
    }
    const opts = optionsOf(f);
    let control;
    if (ty === "select" && opts.length) {
      control = (
        <select id={fid} value={v || ""} onChange={(e) => setA(k, e.target.value)} style={{ ...S.input, appearance: "auto" }}>
          <option value="">{t.select}</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    } else if (ty === "textarea") {
      control = <textarea id={fid} rows={4} value={v || ""} onChange={(e) => setA(k, e.target.value)} maxLength={1000} style={{ ...S.input, resize: "vertical", minHeight: 96 }} />;
    } else {
      const inputType = ["email", "tel", "date", "number"].includes(ty) ? ty : "text";
      control = <input id={fid} type={inputType} inputMode={inputType === "tel" ? "tel" : undefined} value={v || ""} onChange={(e) => setA(k, e.target.value)} maxLength={1000} style={S.input} />;
    }
    return (
      <div key={k}>
        <label htmlFor={fid} style={S.label}>{label}{f.required ? req : null}</label>
        {control}
      </div>
    );
  };

  let body;
  if (state === "loading") body = <div style={{ ...S.card, ...S.muted, textAlign: "center" }}>{t.loading}</div>;
  else if (state === "404") {
    body = (
      <div style={{ ...S.card, textAlign: "center", padding: "28px 20px" }}>
        <div style={{ fontFamily: SERIF, fontSize: 22, marginBottom: 8 }}>{closedNote || t.notFound}</div>
        <p style={{ ...S.muted, margin: 0 }}>{t.notFoundBody}</p>
      </div>
    );
  } else if (state === "error") {
    body = (
      <div style={{ ...S.card, textAlign: "center" }}>
        <p style={{ ...S.muted, marginTop: 0 }}>{t.loadErr}</p>
        <button type="button" onClick={() => { setState("loading"); setReload((n) => n + 1); }} style={{ ...S.btn, width: "auto", padding: "12px 22px" }}>{t.retry}</button>
      </div>
    );
  } else if (state === "done") {
    body = (
      <div style={{ ...S.card, padding: "30px 22px", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 999, background: C.accentSoft, color: C.accent, display: "grid", placeItems: "center", fontSize: 22, margin: "0 auto 14px" }} aria-hidden>✓</div>
        <div style={{ fontFamily: SERIF, fontSize: 26, marginBottom: 8 }}>{t.thanks}</div>
        <p style={{ ...S.muted, margin: 0 }}>{t.thanksBody}</p>
      </div>
    );
  } else {
    const nameReq = true;
    body = (
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: 16 }}>
        <div style={{ ...S.card, display: "grid", gap: 14 }}>
          <h2 style={{ ...S.h2, margin: 0 }}>{t.contact}</h2>
          <div>
            <label htmlFor="c-name" style={S.label}>{(roles.name && roles.name.label) || t.name}{nameReq ? req : null}</label>
            <input id="c-name" style={S.input} value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} autoComplete="name" maxLength={120} />
          </div>
          <div>
            <label htmlFor="c-phone" style={S.label}>{(roles.phone && roles.phone.label) || t.phone}{roles.phone && roles.phone.required ? req : null}</label>
            <input id="c-phone" type="tel" inputMode="tel" style={S.input} value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} autoComplete="tel" maxLength={40} />
          </div>
          <div>
            <label htmlFor="c-email" style={S.label}>{(roles.email && roles.email.label) || t.email}{roles.email && roles.email.required ? req : null}</label>
            <input id="c-email" type="email" inputMode="email" style={S.input} value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} autoComplete="email" maxLength={160} />
          </div>
        </div>

        {bodyFields.length ? <div style={{ ...S.card, display: "grid", gap: 18 }}>{bodyFields.map(renderField)}</div> : null}

        <div style={{ ...S.card, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...S.label, margin: 0 }}>{(sigField && sigField.label) || t.signature}{sigField && sigField.required ? req : null}</span>
            <button type="button" onClick={clearSig} style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 999, padding: "6px 14px", fontSize: 13, color: C.soft, cursor: "pointer", fontFamily: FONT }}>{t.clear}</button>
          </div>
          <div style={{ position: "relative" }}>
            <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
              aria-label={t.signHere} role="img"
              style={{ display: "block", width: "100%", height: 170, background: "#FCFBF9", border: `1px dashed ${C.line}`, borderRadius: 12, touchAction: "none", cursor: "crosshair" }} />
            {!hasSig ? <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", color: "#B9B3A8", fontSize: 14 }}>{t.signHere}</div> : null}
            <div style={{ position: "absolute", left: 16, right: 16, bottom: 34, borderBottom: `1px solid ${C.line}`, pointerEvents: "none" }} />
          </div>
          {hasSig ? (
            <label htmlFor="c-consent" style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", fontSize: 14, lineHeight: 1.45 }}>
              <input id="c-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: C.accent, flex: "0 0 auto" }} />
              <span>{t.consent}req</span>
            </label>
          ) : null}
        </div>

        {/* honeypot: humanos não veem, não preenchem — vai vazio */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
          <label htmlFor="c-website">Website</label>
          <input id="c-website" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
        </div>

        {err ? <div role="alert" style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 14px", fontSize: 14 }}>{err}</div> : null}
        <button type="submit" disabled={sending} style={{ ...S.btn, opacity: sending ? 0.7 : 1 }}>{sending ? t.sending : t.submit}</button>
      </form>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <header style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ ...S.muted, fontSize: 13, letterSpacing: ".04em" }}>{business}</span>
            {LangSwitch}
          </div>
          {form && form.name && state !== "404" ? <h1 style={S.h1}>{form.name}</h1> : null}
        </header>
        {body}
      </div>
    </div>
  );
}
