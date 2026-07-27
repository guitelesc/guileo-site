import { useEffect, useState } from "react";
import { useLang } from "../i18n.jsx";
import ContractDoc from "../components/ContractDoc.jsx";
import logo from "../assets/guileo-mark.png";

const T = {
  loading: { pt: "Carregando documento…", en: "Loading document…", es: "Cargando documento…", hi: "दस्तावेज़ लोड हो रहा है…" },
  notfound: { pt: "Documento não encontrado ou link inválido.", en: "Document not found or invalid link.", es: "Documento no encontrado o enlace inválido.", hi: "दस्तावेज़ नहीं मिला या लिंक अमान्य है।" },
  review: { pt: "Revise o documento e assine abaixo.", en: "Review the document and sign below.", es: "Revisa el documento y firma abajo.", hi: "दस्तावेज़ पढ़ें और नीचे हस्ताक्षर करें।" },
  yourname: { pt: "Seu nome completo", en: "Your full name", es: "Tu nombre completo", hi: "आपका पूरा नाम" },
  consent: { pt: "Li e concordo com este documento. Minha assinatura eletrônica tem validade legal (MP 2.200-2 / ESIGN).", en: "I have read and agree to this document. My electronic signature is legally binding (ESIGN/UETA).", es: "Leí y acepto este documento. Mi firma electrónica tiene validez legal.", hi: "मैंने यह दस्तावेज़ पढ़ा है और सहमत हूँ। मेरा इलेक्ट्रॉनिक हस्ताक्षर कानूनी रूप से मान्य है (ESIGN/UETA)।" },
  sign: { pt: "Assinar agora", en: "Sign now", es: "Firmar ahora", hi: "अभी हस्ताक्षर करें" },
  signing: { pt: "Assinando…", en: "Signing…", es: "Firmando…", hi: "हस्ताक्षर हो रहा है…" },
  signed: { pt: "Assinado com sucesso", en: "Signed successfully", es: "Firmado con éxito", hi: "सफलतापूर्वक हस्ताक्षरित" },
  already: { pt: "Este documento já foi assinado.", en: "This document has already been signed.", es: "Este documento ya fue firmado.", hi: "इस दस्तावेज़ पर पहले ही हस्ताक्षर हो चुके हैं।" },
  print: { pt: "📄 Imprimir / Salvar PDF", en: "📄 Print / Save PDF", es: "📄 Imprimir / Guardar PDF", hi: "📄 प्रिंट / PDF सहेजें" },
  physical: { pt: "Prefere assinar fisicamente? Imprima, assine e devolva — também vale.", en: "Prefer to sign physically? Print, sign and return — that works too.", es: "¿Prefieres firmar en físico? Imprime, firma y devuelve — también vale.", hi: "काग़ज़ पर हस्ताक्षर करना चाहते हैं? प्रिंट करें, हस्ताक्षर करके लौटाएँ — वह भी मान्य है।" },
  err: { pt: "Adicione seu nome e aceite o termo.", en: "Add your name and accept the terms.", es: "Agrega tu nombre y acepta los términos.", hi: "अपना नाम लिखें और शर्तें स्वीकारें।" },
};

export default function Sign() {
  const { lang } = useLang();
  const t = (k) => (T[k] && (T[k][lang] || T[k].en)) || "";
  const token = (() => { try { return new URLSearchParams(window.location.search).get("t") || ""; } catch { return ""; } })();
  const [doc, setDoc] = useState(undefined); // undefined=loading · null=not found
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState("idle"); // idle | signing | signed
  const [err, setErr] = useState(false);
  const [sig, setSig] = useState(null);

  useEffect(() => {
    document.title = "Guileo · Sign";
    if (!token) { setDoc(null); return; }
    fetch("/api/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "by_token", sign_token: token }) })
      .then((r) => r.json())
      .then((d) => { setDoc(d?.doc || null); if (d?.doc?.status === "signed") setSig({ name: d.doc.signer_name, at: d.doc.signed_at ? new Date(d.doc.signed_at).toLocaleString() : "" }); })
      .catch(() => setDoc(null));
  }, [token]);

  const submit = async () => {
    if (!name.trim() || !consent) { setErr(true); return; }
    setErr(false); setState("signing");
    try {
      const r = await fetch("/api/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sign", sign_token: token, signer_name: name.trim() }) });
      const d = await r.json();
      if (d?.signed) { setSig({ name: name.trim(), at: new Date().toLocaleString() }); setState("signed"); }
      else setState("idle");
    } catch { setState("idle"); }
  };

  const isSigned = doc?.status === "signed" || state === "signed";

  return (
    <div className="min-h-screen bg-g-deep px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 mb-6"><img src={logo} alt="" className="h-8 w-8 object-contain" /><span className="text-lg font-extrabold text-white">Guileo</span></div>

        {doc === undefined && <div className="text-white/70 text-sm py-20 text-center">{t("loading")}</div>}
        {doc === null && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center text-white/70">{t("notfound")}</div>}

        {doc && (
          <>
            <ContractDoc body={doc.body} signature={sig} />

            <div className="mt-5 print:hidden">
              {isSigned ? (
                <div className="rounded-2xl border border-g-green/40 bg-g-green/10 p-5 text-center">
                  <div className="text-g-light font-bold text-lg">✓ {t("signed")}</div>
                  <button onClick={() => window.print()} className="btn-gold text-sm mt-3">{t("print")}</button>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-sm font-semibold text-white mb-3">{t("review")}</div>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("yourname")} className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-g-green/50" />
                  <label className="flex items-start gap-2 mt-3 text-[12.5px] text-white/75 cursor-pointer">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-g-green" />
                    <span>{t("consent")}</span>
                  </label>
                  {err && <div className="text-red-300 text-[12px] mt-2">{t("err")}</div>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={submit} disabled={state === "signing"} className="btn-bright text-sm">{state === "signing" ? t("signing") : `✍️ ${t("sign")}`}</button>
                    <button onClick={() => window.print()} className="btn-ghost text-sm">{t("print")}</button>
                  </div>
                  <div className="text-[11px] text-white/45 mt-3">{t("physical")}</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
