import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useLang } from "../i18n.jsx";
import logo from "../assets/guileo-mark.png";

// ════════════════════════════════════════════════════════════════════════════════════════════════
// /orcamento/:token — A PÁGINA QUE O CLIENTE ABRE (2026-08-25)
//
// Era o elo que faltava no funil: o vendedor montava o orçamento e o documento morria na tela dele.
// Agora existe um endereço para MANDAR, e um botão para o cliente APERTAR. Sem login: o token do
// link É a capacidade, mesmo desenho da página de assinatura (/sign).
//
// AS DECISÕES QUE IMPORTAM (as mesmas que a página de assinatura pagou pra aprender):
//   • O ERRO FALA. Link inválido, banco fora do ar e "já aceito" são TRÊS coisas diferentes e cada
//     uma tem a sua frase. Voltar o botão ao normal sem dizer nada, no instante em que o cliente
//     diz sim, faz ele concluir que o sistema não funciona e ir embora.
//   • O ACEITE EXIGE NOME DIGITADO. Um clique sozinho não é intenção inequívoca.
//   • Nada de dado do vendedor ou de outro orçamento vaza: a RPC devolve só ESTE documento.
// ════════════════════════════════════════════════════════════════════════════════════════════════

const T = {
  eyebrow: { pt: "Orçamento", en: "Quote", es: "Presupuesto", hi: "कोटेशन" },
  loading: { pt: "Abrindo o orçamento…", en: "Opening the quote…", es: "Abriendo el presupuesto…", hi: "कोटेशन खुल रहा है…" },
  notfound: { pt: "Não encontramos este orçamento. O link pode ter expirado.", en: "We couldn't find this quote. The link may have expired.", es: "No encontramos este presupuesto. El enlace puede haber expirado.", hi: "यह कोटेशन नहीं मिला। लिंक समाप्त हो सकता है।" },
  offline: { pt: "Não consegui carregar agora — pode ser a conexão. Tente de novo.", en: "Couldn't load right now — it may be the connection. Try again.", es: "No pude cargar ahora — puede ser la conexión. Inténtalo de nuevo.", hi: "अभी लोड नहीं हो सका — शायद कनेक्शन। दोबारा कोशिश करें।" },
  retry: { pt: "↻ Tentar de novo", en: "↻ Try again", es: "↻ Intentar de nuevo", hi: "↻ फिर कोशिश करें" },
  forWhom: { pt: "Preparado para", en: "Prepared for", es: "Preparado para", hi: "इनके लिए तैयार" },
  includes: { pt: "O que está incluído", en: "What's included", es: "Qué incluye", hi: "इसमें क्या है" },
  total: { pt: "Total", en: "Total", es: "Total", hi: "कुल" },
  yourname: { pt: "Seu nome completo", en: "Your full name", es: "Tu nombre completo", hi: "आपका पूरा नाम" },
  accept: { pt: "Aceitar orçamento", en: "Accept quote", es: "Aceptar presupuesto", hi: "कोटेशन स्वीकारें" },
  accepting: { pt: "Registrando…", en: "Recording…", es: "Registrando…", hi: "दर्ज हो रहा है…" },
  needName: { pt: "Escreva o seu nome completo para aceitar.", en: "Type your full name to accept.", es: "Escribe tu nombre completo para aceptar.", hi: "स्वीकार करने के लिए अपना पूरा नाम लिखें।" },
  okT: { pt: "Aceito ✓", en: "Accepted ✓", es: "Aceptado ✓", hi: "स्वीकृत ✓" },
  okP: { pt: "Recebemos o seu aceite. O seu contato da Guileo já foi avisado e fala com você para o próximo passo.", en: "We recorded your acceptance. Your Guileo contact was notified and will reach out with the next step.", es: "Registramos tu aceptación. Tu contacto de Guileo fue avisado y te escribirá con el siguiente paso.", hi: "आपकी स्वीकृति दर्ज हो गई। आपके Guileo संपर्क को सूचित कर दिया गया है।" },
  already: { pt: "Este orçamento já tinha sido aceito.", en: "This quote had already been accepted.", es: "Este presupuesto ya había sido aceptado.", hi: "यह कोटेशन पहले ही स्वीकृत हो चुका था।" },
  failT: { pt: "Não consegui registrar o aceite", en: "I couldn't record the acceptance", es: "No pude registrar la aceptación", hi: "स्वीकृति दर्ज नहीं हो सकी" },
  mIndisp: { pt: "o serviço não respondeu agora. Nada foi perdido — tente de novo em instantes.", en: "the service didn't respond. Nothing was lost — try again in a moment.", es: "el servicio no respondió. No se perdió nada — inténtalo en un momento.", hi: "सेवा ने उत्तर नहीं दिया। कुछ खोया नहीं — दोबारा कोशिश करें।" },
  mLink: { pt: "este link já foi usado ou não é mais válido. Fale com quem enviou.", en: "this link was already used or is no longer valid. Talk to whoever sent it.", es: "este enlace ya fue usado o no es válido. Habla con quien te lo envió.", hi: "यह लिंक पहले उपयोग हो चुका है या अमान्य है। भेजने वाले से बात करें।" },
};

export default function OrcamentoPublico() {
  const { token = "" } = useParams();
  const { lang: gLang } = useLang();
  const lang = ["pt", "en", "es", "hi"].includes(gLang) ? gLang : "pt";
  const w = (k) => T[k][lang] || T[k].pt;

  const [estado, setEstado] = useState("loading"); // loading | ok | vazio | offline
  const [doc, setDoc] = useState(null);
  const [nome, setNome] = useState("");
  const [aceite, setAceite] = useState("idle"); // idle | enviando | ok | erro
  const [motivo, setMotivo] = useState("");

  const carrega = async () => {
    setEstado("loading");
    try {
      const r = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "public", token }) });
      const j = await r.json().catch(() => null);
      // ⚠️ ERRO ≠ VAZIO. "não encontrei" e "não consegui ler" mandam o leitor fazer coisas
      // opostas: um desiste do link, o outro tenta de novo. Confundir os dois perde a venda.
      if (!j || j.ok !== true) { setEstado("offline"); return; }
      if (!j.doc) { setEstado("vazio"); return; }
      setDoc(j.doc);
      setEstado("ok");
      if (j.doc.status === "accepted") { setAceite("ok"); setMotivo("already"); }
    } catch { setEstado("offline"); }
  };
  useEffect(() => { carrega(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const aceitar = async () => {
    if (aceite === "enviando") return;
    if (!nome.trim()) { setAceite("erro"); setMotivo("nome"); return; }
    setAceite("enviando"); setMotivo("");
    try {
      const r = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept", token, nome }) });
      const j = await r.json().catch(() => null);
      if (!j || j.ok !== true) { setAceite("erro"); setMotivo("indisp"); return; }
      if (j.aceito !== true) { setAceite("erro"); setMotivo(j.motivo === "nome_obrigatorio" ? "nome" : "link"); return; }
      setAceite("ok"); setMotivo("");
    } catch { setAceite("erro"); setMotivo("indisp"); }
  };

  const itens = Array.isArray(doc?.itens) ? doc.itens : [];

  return (
    <div className="min-h-screen bg-[#161512] px-4 py-10 text-g-ink">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-center gap-2">
          <img src={logo} alt="" className="h-8 w-8 object-contain" />
          <span className="text-[10.5px] font-black uppercase tracking-[0.2em] text-g-gold">{w("eyebrow")}</span>
        </div>

        {estado === "loading" && <div className="text-[13px] text-g-muted">{w("loading")}</div>}

        {estado === "vazio" && <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-[13px] text-g-muted">{w("notfound")}</div>}

        {estado === "offline" && (
          <div className="rounded-2xl border border-g-gold/30 bg-g-gold/[0.06] p-5">
            <div className="text-[13px] text-g-muted">{w("offline")}</div>
            <button type="button" onClick={carrega} className="mt-3 inline-flex min-h-[44px] items-center rounded-full border border-white/15 px-4 text-[12.5px] font-bold text-g-word">{w("retry")}</button>
          </div>
        )}

        {estado === "ok" && doc && (
          <div className="rounded-2xl bg-white p-6 text-[#161512] shadow-2xl">
            {doc.client_name && (
              <>
                <div className="text-[10.5px] font-black uppercase tracking-[0.18em] text-[#8a8578]">{w("forWhom")}</div>
                <div className="mt-1 text-[22px] font-black">{doc.client_name}</div>
              </>
            )}

            {itens.length > 0 && (
              <div className="mt-5">
                <div className="text-[10.5px] font-black uppercase tracking-[0.18em] text-[#8a8578]">{w("includes")}</div>
                <ul className="mt-2 space-y-1.5">
                  {itens.map((it, i) => <li key={i} className="text-[14px] leading-relaxed text-[#2b2924]">• {it}</li>)}
                </ul>
              </div>
            )}

            {doc.total && (
              <div className="mt-5 rounded-xl bg-[#f4f1ea] px-4 py-3">
                <div className="text-[10.5px] font-black uppercase tracking-[0.18em] text-[#8a8578]">{w("total")}</div>
                <div className="text-[24px] font-black">{doc.total}</div>
              </div>
            )}

            {/* ── ACEITE ─────────────────────────────────────────────────────────────────────── */}
            <div className="mt-6 border-t border-black/10 pt-5">
              {aceite === "ok" ? (
                <div>
                  <div className="text-[16px] font-black text-[#1f7a4d]">{w("okT")}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-[#4a463d]">{motivo === "already" ? w("already") : w("okP")}</p>
                  {(doc.accepted_name || nome) && <p className="mt-1 text-[12px] text-[#8a8578]">{doc.accepted_name || nome}</p>}
                </div>
              ) : (
                <>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-[#8a8578]">{w("yourname")}
                    <input value={nome} onChange={(e) => setNome(e.target.value)}
                      className="mt-1 h-[48px] w-full rounded-lg border border-black/15 bg-white px-3 text-[15px] text-[#161512] focus:border-[#1f7a4d] focus:outline-none" />
                  </label>
                  <button type="button" onClick={aceitar} disabled={aceite === "enviando"}
                    className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#161512] px-5 text-[15px] font-black text-white disabled:opacity-60">
                    {aceite === "enviando" ? w("accepting") : w("accept")}
                  </button>
                  {aceite === "erro" && (
                    <div className="mt-2 text-[12.5px] font-bold text-[#b4322f]">
                      {motivo === "nome" ? w("needName") : `${w("failT")} — ${motivo === "link" ? w("mLink") : w("mIndisp")}`}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
