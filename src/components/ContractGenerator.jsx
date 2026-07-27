import { useMemo, useState } from "react";
import { useLang } from "../i18n.jsx";
import { buildBody, TEMPLATES, L } from "../lib/contracts.js";
import { loadDataKey } from "../lib/portalApi.js";
import ContractDoc from "./ContractDoc.jsx";

// Admin contract/quote GENERATOR: pick scope → template → language → fill the counterparty → live
// preview (frozen-snapshot body) → "Generate" persists via /api/contract and returns the /sign link.
const U = {
  title: { pt: "Gerar contrato ou orçamento", en: "Generate a contract or quote", es: "Generar contrato o presupuesto" },
  scope: { pt: "Para quem", en: "For whom", es: "Para quién" },
  scopeGC: { pt: "Guileo → cliente", en: "Guileo → client", es: "Guileo → cliente" },
  scopeCC: { pt: "Cliente → clientes dele", en: "Client → their customers", es: "Cliente → sus clientes" },
  kind: { pt: "Tipo", en: "Type", es: "Tipo" },
  contract: { pt: "Contrato", en: "Contract", es: "Contrato" },
  quote: { pt: "Orçamento", en: "Quote", es: "Presupuesto" },
  template: { pt: "Modelo", en: "Template", es: "Modelo" },
  docLang: { pt: "Idioma do documento", en: "Document language", es: "Idioma del documento" },
  cpName: { pt: "Nome da contraparte", en: "Counterparty name", es: "Nombre de la contraparte" },
  cpEmail: { pt: "Email (opcional)", en: "Email (optional)", es: "Correo (opcional)" },
  amount: { pt: "Valor (ex: R$5.000 ou $1,500)", en: "Amount (e.g. $1,500)", es: "Monto (ej: $1,500)" },
  gen: { pt: "Gerar & criar link de assinatura", en: "Generate & create sign link", es: "Generar y crear enlace de firma" },
  generating: { pt: "Gerando…", en: "Generating…", es: "Generando…" },
  link: { pt: "Link de assinatura (envie pra contraparte):", en: "Sign link (send to the counterparty):", es: "Enlace de firma (envíalo a la contraparte):" },
  copy: { pt: "Copiar", en: "Copy", es: "Copiar" },
  copied: { pt: "Copiado ✓", en: "Copied ✓", es: "Copiado ✓" },
  preview: { pt: "Pré-visualização", en: "Preview", es: "Vista previa" },
  needName: { pt: "Adicione o nome da contraparte.", en: "Add the counterparty name.", es: "Agrega el nombre de la contraparte." },
  needConn: { pt: "Conecte sua conta (código de acesso) para gerar links reais.", en: "Connect your account (access code) to generate real links.", es: "Conecta tu cuenta (código de acceso) para generar enlaces reales." },
};

export default function ContractGenerator({ tenantEmail = "" }) {
  const { lang } = useLang();
  const u = (k) => (U[k] && (U[k][lang] || U[k].en)) || "";
  const [scope, setScope] = useState("guileo_client");
  const [kind, setKind] = useState("contract");
  const [code, setCode] = useState("GD-WEB");
  const [docLang, setDocLang] = useState(lang);
  const [cpName, setCpName] = useState("");
  const [cpEmail, setCpEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [state, setState] = useState("idle"); // idle | gen | done
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  const list = TEMPLATES[scope] || [];
  const body = useMemo(() => buildBody({ scope, code, lang: docLang, kind, counterparty: { name: cpName, email: cpEmail }, amount }), [scope, code, docLang, kind, cpName, cpEmail, amount]);

  const onScope = (s) => { setScope(s); setCode((TEMPLATES[s] || [])[0]?.code || ""); };

  const generate = async () => {
    if (!cpName.trim()) { setErr(u("needName")); return; }
    setErr("");
    const token = loadDataKey();
    if (!token) { setErr(u("needConn")); return; }
    setState("gen");
    try {
      const r = await fetch("/api/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "upsert", token, email: tenantEmail, scope, kind, template: code, lang: docLang,
        title: body.title, counterparty_name: cpName.trim(), counterparty_email: cpEmail.trim(), amount_cents: 0, body, status: "sent",
      }) });
      const d = await r.json();
      // fetch the row's sign_token to build the link
      const lr = await fetch("/api/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", token, email: tenantEmail, limit: 5 }) });
      const ld = await lr.json();
      const row = (ld?.docs || []).find((x) => x.id === d?.id) || (ld?.docs || [])[0];
      if (row?.sign_token) { setLink(`${window.location.origin}/sign?t=${row.sign_token}`); setState("done"); }
      else { setErr(d?.note || "—"); setState("idle"); }
    } catch (e) { setErr(String(e).slice(0, 80)); setState("idle"); }
  };

  const field = "w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="text-sm font-extrabold text-g-word mb-4">📝 {u("title")}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] text-g-muted">{u("scope")}
            <select value={scope} onChange={(e) => onScope(e.target.value)} className={field}><option value="guileo_client">{u("scopeGC")}</option><option value="client_customer">{u("scopeCC")}</option></select>
          </label>
          <label className="text-[11px] text-g-muted">{u("kind")}
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}><option value="contract">{u("contract")}</option><option value="quote">{u("quote")}</option></select>
          </label>
          <label className="text-[11px] text-g-muted col-span-2">{u("template")}
            <select value={code} onChange={(e) => setCode(e.target.value)} className={field}>{list.map((t) => <option key={t.code} value={t.code}>{t.icon} {L(t.name, docLang)}</option>)}</select>
          </label>
          <label className="text-[11px] text-g-muted">{u("docLang")}
            <select value={docLang} onChange={(e) => setDocLang(e.target.value)} className={field}><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select>
          </label>
          <label className="text-[11px] text-g-muted">{u("amount")}
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$1,500" className={field} />
          </label>
          <label className="text-[11px] text-g-muted">{u("cpName")}
            <input value={cpName} onChange={(e) => setCpName(e.target.value)} className={field} />
          </label>
          <label className="text-[11px] text-g-muted">{u("cpEmail")}
            <input value={cpEmail} onChange={(e) => setCpEmail(e.target.value)} className={field} />
          </label>
        </div>
        <button onClick={generate} disabled={state === "gen"} className="btn-bright text-sm mt-4 w-full">{state === "gen" ? u("generating") : u("gen")}</button>
        {err && <div className="text-[12px] text-g-gold mt-2">{err}</div>}
        {state === "done" && link && (
          <div className="mt-4 rounded-xl border border-g-green/30 bg-g-green/10 p-3">
            <div className="text-[11px] font-bold text-g-light mb-1">{u("link")}</div>
            <div className="flex gap-2">
              <input readOnly value={link} className={field + " flex-1"} onClick={(e) => e.target.select()} />
              <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-ghost text-[12px] shrink-0">{copied ? u("copied") : u("copy")}</button>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] font-black uppercase tracking-wide text-g-gold mb-2">{u("preview")}</div>
        <div className="max-h-[70vh] overflow-auto rounded-2xl"><ContractDoc body={body} /></div>
      </div>
    </div>
  );
}
