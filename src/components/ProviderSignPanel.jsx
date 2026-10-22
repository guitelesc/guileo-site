import { useState } from "react";
import { useLang } from "../i18n.jsx";

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ASSINAR PELA ORIGEM (2026-10-04) — o botão que faltava para o prestador assinar PRIMEIRO.
// Contratos com body.provider_signs_first = true (ex.: Natura, MSA-NATURA-01) só liberam a assinatura
// do cliente depois que a ORIGEM LTDA assina. Até aqui isso só existia na API (action
// "provider_sign"); não havia tela. Este painel:
//   1) lista os contratos do tenant (action "list", token de admin da sessão do /admin);
//   2) para cada um em aberto, lê o documento pelo link (action "by_token") para saber se ele exige
//      o prestador e se o prestador já assinou;
//   3) abre a confirmação: título, link para ler o documento inteiro, NOME DIGITADO, cargo e a caixa
//      de consentimento — nunca um clique só;
//   4) chama "provider_sign" e mostra o RECIBO (SHA-256 + hora) e o link do cliente com "copiar".
// 🚨 NADA DE FALHA MUDA: toda recusa do servidor aparece com o motivo (e o detalhe técnico).
// O servidor é quem calcula o hash (functions/api/contract.js → docHash) — a tela só exibe o que ele
// gravou, e confere que veio um hash de 64 hex antes de dizer "assinado".
// ════════════════════════════════════════════════════════════════════════════════════════════════

const S = {
  h:        { pt: "Assinatura do prestador (ORIGEM LTDA)", en: "Provider signature (ORIGEM LTDA)", es: "Firma del proveedor (ORIGEM LTDA)", hi: "प्रदाता हस्ताक्षर (ORIGEM LTDA)" },
  sub:      { pt: "Contratos em que a ORIGEM assina primeiro. O cliente só consegue assinar depois.", en: "Agreements where ORIGEM signs first. The client can only sign after.", es: "Contratos en los que ORIGEM firma primero. El cliente solo puede firmar después.", hi: "अनुबंध जिनमें ORIGEM पहले हस्ताक्षर करता है। ग्राहक उसके बाद ही हस्ताक्षर कर सकता है।" },
  owner:    { pt: "E-mail do dono dos contratos", en: "Contracts owner email", es: "Email del dueño de los contratos", hi: "अनुबंधों के स्वामी का ईमेल" },
  tok:      { pt: "Senha de admin (a mesma do /admin)", en: "Admin password (same as /admin)", es: "Contraseña de admin (la misma de /admin)", hi: "एडमिन पासवर्ड (/admin वाला)" },
  load:     { pt: "Carregar contratos", en: "Load contracts", es: "Cargar contratos", hi: "अनुबंध लोड करें" },
  loading:  { pt: "Carregando…", en: "Loading…", es: "Cargando…", hi: "लोड हो रहा है…" },
  none:     { pt: "Nenhum contrato aguardando a assinatura da ORIGEM.", en: "No agreement is waiting for ORIGEM's signature.", es: "Ningún contrato espera la firma de ORIGEM.", hi: "कोई अनुबंध ORIGEM के हस्ताक्षर की प्रतीक्षा में नहीं है।" },
  waiting:  { pt: "Aguardando a ORIGEM", en: "Waiting for ORIGEM", es: "Esperando a ORIGEM", hi: "ORIGEM की प्रतीक्षा" },
  signedP:  { pt: "ORIGEM já assinou", en: "ORIGEM already signed", es: "ORIGEM ya firmó", hi: "ORIGEM हस्ताक्षर कर चुका" },
  btn:      { pt: "Assinar pela ORIGEM", en: "Sign for ORIGEM", es: "Firmar por ORIGEM", hi: "ORIGEM की ओर से हस्ताक्षर करें" },
  preview:  { pt: "Ler o documento inteiro antes (abre em outra aba) ↗", en: "Read the whole document first (opens a new tab) ↗", es: "Leer el documento completo antes (abre otra pestaña) ↗", hi: "पहले पूरा दस्तावेज़ पढ़ें (नई टैब) ↗" },
  name:     { pt: "Nome completo de quem assina", en: "Full name of the signer", es: "Nombre completo de quien firma", hi: "हस्ताक्षरकर्ता का पूरा नाम" },
  title:    { pt: "Cargo", en: "Title", es: "Cargo", hi: "पद" },
  consent:  { pt: "Li o documento inteiro e assino pela ORIGEM LTDA, com validade legal (ESIGN / MP 2.200-2)", en: "I have read the whole document and sign for ORIGEM LTDA, legally binding (ESIGN / MP 2.200-2)", es: "Leí todo el documento y firmo por ORIGEM LTDA, con validez legal (ESIGN / MP 2.200-2)", hi: "मैंने पूरा दस्तावेज़ पढ़ा है और ORIGEM LTDA की ओर से कानूनी रूप से मान्य हस्ताक्षर करता हूँ (ESIGN / MP 2.200-2)" },
  go:       { pt: "Assinar agora", en: "Sign now", es: "Firmar ahora", hi: "अभी हस्ताक्षर करें" },
  going:    { pt: "Registrando…", en: "Recording…", es: "Registrando…", hi: "दर्ज हो रहा है…" },
  cancel:   { pt: "Cancelar", en: "Cancel", es: "Cancelar", hi: "रद्द करें" },
  need:     { pt: "Digite o nome completo e marque a caixa.", en: "Type the full name and tick the box.", es: "Escribe el nombre completo y marca la casilla.", hi: "पूरा नाम लिखें और बॉक्स चुनें।" },
  ok:       { pt: "Assinado pela ORIGEM", en: "Signed for ORIGEM", es: "Firmado por ORIGEM", hi: "ORIGEM की ओर से हस्ताक्षरित" },
  hash:     { pt: "Impressão digital assinada (SHA-256)", en: "Signed fingerprint (SHA-256)", es: "Huella firmada (SHA-256)", hi: "हस्ताक्षरित फ़िंगरप्रिंट (SHA-256)" },
  when:     { pt: "Quando", en: "When", es: "Cuándo", hi: "कब" },
  link:     { pt: "Link do cliente — agora ele já pode assinar", en: "Client link — they can sign now", es: "Enlace del cliente — ya puede firmar", hi: "ग्राहक लिंक — अब वे हस्ताक्षर कर सकते हैं" },
  copy:     { pt: "Copiar", en: "Copy", es: "Copiar", hi: "कॉपी" },
  copied:   { pt: "Copiado ✓", en: "Copied ✓", es: "Copiado ✓", hi: "कॉपी हुआ ✓" },
  fail:     { pt: "Não assinou", en: "Not signed", es: "No se firmó", hi: "हस्ताक्षर नहीं हुआ" },
  loadFail: { pt: "Não consegui carregar a lista", en: "Couldn't load the list", es: "No pude cargar la lista", hi: "सूची लोड नहीं हो सकी" },
  docFail:  { pt: "não consegui ler este documento", en: "couldn't read this document", es: "no pude leer este documento", hi: "यह दस्तावेज़ पढ़ा नहीं जा सका" },
};
// motivos do servidor (contract.js / contract_provider_sign) → frase humana
const MOT = {
  prestador_ja_assinou: { pt: "a ORIGEM já tinha assinado este documento.", en: "ORIGEM had already signed this document.", es: "ORIGEM ya había firmado este documento.", hi: "ORIGEM पहले ही हस्ताक्षर कर चुका था।" },
  documento_mudou:      { pt: "o documento mudou depois da leitura — recarregue a lista e leia de novo.", en: "the document changed after it was read — reload the list and read it again.", es: "el documento cambió después de leerlo — recarga la lista.", hi: "पढ़ने के बाद दस्तावेज़ बदल गया — सूची फिर लोड करें।" },
  nao_encontrado:       { pt: "contrato não encontrado para este e-mail de dono.", en: "agreement not found for this owner email.", es: "contrato no encontrado para este email.", hi: "इस ईमेल के लिए अनुबंध नहीं मिला।" },
  nome_vazio:           { pt: "o nome está vazio.", en: "the name is empty.", es: "el nombre está vacío.", hi: "नाम खाली है।" },
  so_admin:             { pt: "só o administrador assina pela ORIGEM.", en: "only the administrator signs for ORIGEM.", es: "solo el administrador firma por ORIGEM.", hi: "केवल एडमिन ORIGEM की ओर से हस्ताक्षर करता है।" },
  sql_v2_ausente:       { pt: "a assinatura do prestador não está ativa no banco (SQL v2).", en: "provider signing is not active in the database (SQL v2).", es: "la firma del proveedor no está activa (SQL v2).", hi: "प्रदाता हस्ताक्षर डेटाबेस में सक्रिय नहीं है (SQL v2)।" },
  recibo_divergente:    { pt: "o banco não devolveu o recibo esperado.", en: "the database did not return the expected receipt.", es: "la base no devolvió el recibo esperado.", hi: "डेटाबेस ने अपेक्षित रसीद नहीं लौटाई।" },
  unauthorized:         { pt: "senha de admin recusada (ou e-mail do dono vazio).", en: "admin password refused (or owner email empty).", es: "contraseña de admin rechazada.", hi: "एडमिन पासवर्ड अस्वीकृत।" },
  indisponivel:         { pt: "o serviço não respondeu. Nada foi assinado — tente de novo.", en: "the service didn't respond. Nothing was signed — try again.", es: "el servicio no respondió. No se firmó nada.", hi: "सेवा ने उत्तर नहीं दिया। कुछ हस्ताक्षरित नहीं हुआ।" },
};

const post = async (payload) => {
  const r = await fetch("/api/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const d = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok, d };
};
const tokSessao = () => { try { return sessionStorage.getItem("guileo_admin_tok") || ""; } catch { return ""; } };

// `lang` fixa o idioma quando a TELA em volta é de uma língua só (o /admin/contratos é PT).
export default function ProviderSignPanel({ defaultOwner = "luistelesc@gmail.com", lang: forcado = null }) {
  const { lang: siteLang } = useLang();
  const lang = forcado || siteLang;
  const t = (k) => (S[k] && (S[k][lang] || S[k].en)) || "";
  const mot = (m) => (MOT[m] && (MOT[m][lang] || MOT[m].en)) || m || "—";

  const [owner, setOwner] = useState(defaultOwner);
  const [token, setToken] = useState(tokSessao);
  const [rows, setRows] = useState(null);       // null = não carregado · [] = nada pendente
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [open, setOpen] = useState(null);       // id do contrato com o painel de confirmação aberto
  const [nome, setNome] = useState("Luis Teles");
  const [cargo, setCargo] = useState("Managing Partner");
  const [ok, setOk] = useState(false);
  const [state, setState] = useState("idle");   // idle | signing
  const [err, setErr] = useState("");
  const [recibo, setRecibo] = useState({});     // id → { hash, quando, link }
  const [copiado, setCopiado] = useState("");

  const carregar = async () => {
    setLoadErr(""); setBusy(true); setRows(null);
    try {
      const em = owner.trim().toLowerCase();
      if (token) { try { sessionStorage.setItem("guileo_admin_tok", token); } catch { /* */ } }
      const l = await post({ action: "list", token, email: em, limit: 200 });
      if (!l.ok || !l.d || l.d.ready === false || !Array.isArray(l.d.docs)) {
        setLoadErr(`${t("loadFail")}: ${mot(l.d?.error || l.d?.motivo || (l.status === 401 ? "unauthorized" : "indisponivel"))} (HTTP ${l.status}${l.d?.note ? ` · ${l.d.note}` : ""})`);
        return;
      }
      const abertos = l.d.docs.filter((x) => (x.status === "sent" || x.status === "draft") && x.sign_token);
      // o list não traz o corpo: lê cada documento pelo link para saber se ele exige o prestador
      const lidos = await Promise.all(abertos.map(async (x) => {
        const r = await post({ action: "by_token", sign_token: x.sign_token });
        if (!r.ok || !r.d?.ok) return { ...x, erroLeitura: r.d?.motivo || `HTTP ${r.status}` };
        const doc = r.d.doc;
        if (!doc) return { ...x, erroLeitura: "nao_encontrado" };
        return { ...x, exige: doc.body?.provider_signs_first === true, provSignedAt: doc.provider_signed_at || null, provHash: doc.provider_body_sha256 || null, avancado: !!r.d.avancado };
      }));
      setRows(lidos.filter((x) => x.erroLeitura || x.exige));
    } catch (e) {
      setLoadErr(`${t("loadFail")}: ${String(e).slice(0, 120)}`);
    } finally { setBusy(false); }
  };

  const abrir = (id) => { setOpen(id); setOk(false); setErr(""); setNome("Luis Teles"); setCargo("Managing Partner"); };

  const assinar = async (row) => {
    if (!nome.trim() || !ok) { setErr(t("need")); return; }
    setErr(""); setState("signing");
    try {
      const r = await post({ action: "provider_sign", token, email: owner.trim().toLowerCase(), id: row.id, entity: "ORIGEM LTDA", signer_name: nome.trim(), signer_title: cargo.trim() });
      const d = r.d || {};
      // 🚨 "assinado" só com recibo de verdade: ok + hash de 64 hex + hora + link
      if (r.ok && d.ok === true && /^[0-9a-f]{64}$/.test(d.hash || "") && d.quando && d.link) {
        setRecibo((m) => ({ ...m, [row.id]: { hash: d.hash, quando: d.quando, link: d.link } }));
        setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, provSignedAt: d.quando, provHash: d.hash } : x)));
        setOpen(null);
      } else {
        const motivo = d.motivo || d.error || (r.status === 401 ? "unauthorized" : "indisponivel");
        setErr(`${t("fail")}: ${mot(motivo)}${d.erro ? ` — ${d.erro}` : ""}${d.detalhe_tecnico ? ` (${d.detalhe_tecnico})` : ""} [HTTP ${r.status}]`);
      }
    } catch (e) {
      setErr(`${t("fail")}: ${mot("indisponivel")} (${String(e).slice(0, 80)})`);
    } finally { setState("idle"); }
  };

  const copiar = (txt, id) => { try { navigator.clipboard?.writeText(txt); setCopiado(id); setTimeout(() => setCopiado(""), 1500); } catch { /* */ } };

  const box = { background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(20,60,40,.08)", marginBottom: 20, color: "#13211B" };
  const inp = { width: "100%", border: "1px solid #cfd8d2", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#13211B", background: "#fff" };
  const lbl = { fontSize: 11, fontWeight: 700, color: "#5E6E63", display: "block", marginBottom: 4 };
  const btn = { fontSize: 12.5, fontWeight: 800, color: "#fff", background: "#13211B", border: "none", borderRadius: 8, padding: "9px 14px", cursor: "pointer", minHeight: 40 };
  const ghost = { ...btn, background: "transparent", color: "#13211B", border: "1px solid #cfd8d2" };
  const mono = { fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, wordBreak: "break-all" };
  const errBox = { marginTop: 10, background: "#FDECEA", border: "1px solid #E5A29A", color: "#8A2A1E", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600 };

  return (
    <div style={box}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>✍️ {t("h")}</div>
      <div style={{ fontSize: 12, color: "#5E6E63", marginTop: 2 }}>{t("sub")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 12 }}>
        <label><span style={lbl}>{t("owner")}</span><input value={owner} onChange={(e) => setOwner(e.target.value)} type="email" style={inp} /></label>
        <label><span style={lbl}>{t("tok")}</span><input value={token} onChange={(e) => setToken(e.target.value)} type="password" autoComplete="current-password" style={inp} /></label>
      </div>
      <button onClick={carregar} disabled={busy || !token || !owner.includes("@")} style={{ ...btn, marginTop: 10, opacity: busy || !token || !owner.includes("@") ? 0.6 : 1 }}>{busy ? t("loading") : t("load")}</button>
      {loadErr && <div style={errBox} role="alert">{loadErr}</div>}

      {Array.isArray(rows) && rows.length === 0 && <div style={{ marginTop: 12, fontSize: 12.5, color: "#5E6E63" }}>{t("none")}</div>}
      {Array.isArray(rows) && rows.map((row) => {
        const link = `${window.location.origin}/sign?t=${row.sign_token}`;
        const rec = recibo[row.id];
        return (
          <div key={row.id} style={{ marginTop: 12, border: "1px solid #e3e9e5", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{row.title || "—"}</div>
                <div style={{ fontSize: 11.5, color: "#5E6E63" }}>{row.counterparty_name || "—"} · {row.template_code || ""} · <span style={mono}>{row.id}</span></div>
              </div>
              {row.erroLeitura ? <span style={{ fontSize: 11.5, fontWeight: 700, color: "#8A2A1E" }}>⚠ {t("docFail")}: {mot(row.erroLeitura)}</span>
                : row.provSignedAt ? <span style={{ fontSize: 11.5, fontWeight: 800, color: "#1F6B49" }}>✓ {t("signedP")}</span>
                : <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#8E6D2C" }}>⏳ {t("waiting")}</span>
                    {open !== row.id && <button onClick={() => abrir(row.id)} style={btn}>{t("btn")}</button>}
                  </span>}
            </div>

            {open === row.id && !row.provSignedAt && (
              <div style={{ marginTop: 12, background: "#F7F5EE", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{row.title}</div>
                <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 4, fontSize: 12.5, fontWeight: 700, color: "#1F6B49" }}>{t("preview")}</a>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginTop: 10 }}>
                  <label><span style={lbl}>{t("name")}</span><input value={nome} onChange={(e) => { setNome(e.target.value); setErr(""); }} autoComplete="name" style={inp} /></label>
                  <label><span style={lbl}>{t("title")}</span><input value={cargo} onChange={(e) => setCargo(e.target.value)} style={inp} /></label>
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, fontSize: 12.5, lineHeight: 1.4, cursor: "pointer" }}>
                  <input type="checkbox" checked={ok} onChange={(e) => { setOk(e.target.checked); setErr(""); }} style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0 }} />
                  <span>{t("consent")}</span>
                </label>
                {err && <div style={errBox} role="alert">{err}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={() => assinar(row)} disabled={state === "signing"} style={{ ...btn, opacity: state === "signing" ? 0.6 : 1 }}>{state === "signing" ? t("going") : `✍️ ${t("go")}`}</button>
                  <button onClick={() => setOpen(null)} style={ghost}>{t("cancel")}</button>
                </div>
              </div>
            )}

            {rec && (
              <div style={{ marginTop: 12, background: "#E5F1E9", border: "1px solid #B7D8C4", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1F6B49" }}>✓ {t("ok")}</div>
                <div style={{ ...lbl, marginTop: 8 }}>{t("hash")}</div>
                <div style={mono}>{rec.hash}</div>
                <div style={{ ...lbl, marginTop: 8 }}>{t("when")}</div>
                <div style={mono}>{rec.quando}</div>
                <div style={{ ...lbl, marginTop: 8 }}>{t("link")}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input readOnly value={rec.link} onClick={(e) => e.target.select()} style={{ ...inp, ...mono }} />
                  <button onClick={() => copiar(rec.link, row.id)} style={{ ...ghost, flexShrink: 0 }}>{copiado === row.id ? t("copied") : t("copy")}</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
