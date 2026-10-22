import { useState } from "react";
import { useLang } from "../i18n.jsx";
import { Reveal } from "../lib/ui.jsx";
import { evento } from "../lib/evento.js";

/* ── XRaySection — a PORTA da venda por telefone ──────────────────────────────────────────────
   2026-09-10: voltou à landing como oferta ("manda seu site — a gente mede").
   2026-09-18: ⚠️ ELA NÃO GERAVA RAIO-X NENHUM. Postava no /api/lead como um formulário qualquer:
   a pessoa pedia o relatório, virava lead, e o relatório nunca existia — a promessa da seção era
   entregue por ninguém. O motor inteiro já estava pronto em /api/raio-x (acao "gerar": lê o site,
   grava a avaliação, devolve /apresentacao/<uuid> E reencaminha o lead pro /api/lead, com CRM,
   atribuição e o retorno da Gui). Agora a seção chama ESSE motor e mostra o link na hora.

   Travas que já moram no motor (não duplicar aqui): 5 pedidos/h por IP, 3 varreduras/dia por
   domínio, e reaproveitamento se o mesmo site foi medido nos últimos 7 dias. Custo por relatório ≈
   zero: o motor é determinístico, NÃO chama IA — nunca pôr chamada de modelo neste caminho.

   O campo é SITE, não "@instagram": o motor lê o domínio que recebe — um @ viraria varredura do
   instagram.com, que não diz nada sobre o negócio. Consentimento: desmarcado e obrigatório (TCPA),
   igual ao LeadForm — a Gui só liga pra quem disse sim. */
const COPY = {
  en: {
    eyebrow: "Free X-Ray", h2a: "See what your business is leaking — ", h2b: "measured, not guessed.",
    sub: "Leave your website and your number. We measure missed calls, slow replies and lost bookings on YOUR business — the report opens right here, and Gui calls to walk you through it.",
    pts: ["Measured on your real site", "Dollar figure per leak, by service", "What Gui fixes first — and what it costs"],
    site: "Your website", sitePh: "yourbusiness.com", nome: "Your name", contato: "Phone (with country code) or email", contatoPh: "+1 555 123 4567",
    consent: "I agree to be contacted by Gui (call or text) about my report. Reply STOP anytime.",
    cta: "Get my free X-Ray →", gerando: "Measuring your site… (up to 20s)",
    pronto: "Your X-Ray is ready", abrir: "Open my X-Ray →", reap: "This site was measured in the last 7 days — here's that report.", liga: "Gui will call you to walk through it.",
    errCampos: "Fill in your website, a way to reach you, and the consent box.", errSite: "That doesn't look like a website address — try yourbusiness.com.",
    errNaoLeu: "We couldn't read that site (it may block robots or be offline). Leave your number with Gui and we'll do it by hand.",
    errRate: "Too many X-Rays from here today — try again in an hour.", errGeral: "Something failed on our side. Try again in a minute.",
  },
  pt: {
    eyebrow: "Raio-X grátis", h2a: "Veja o que o seu negócio está vazando — ", h2b: "medido, não chutado.",
    sub: "Deixe seu site e seu número. A gente mede ligações perdidas, respostas lentas e agendamentos que escapam no SEU negócio — o relatório abre aqui mesmo, e a Gui liga pra te explicar.",
    pts: ["Medido no seu site de verdade", "Valor em dinheiro por vazamento, por serviço", "O que a Gui conserta primeiro — e quanto custa"],
    site: "Seu site", sitePh: "seunegocio.com", nome: "Seu nome", contato: "Telefone (com DDI) ou e-mail", contatoPh: "+55 11 91234 5678",
    consent: "Aceito ser contatado pela Gui (ligação ou mensagem) sobre o meu relatório. Responda PARE quando quiser.",
    cta: "Quero meu Raio-X grátis →", gerando: "Medindo o seu site… (até 20s)",
    pronto: "Seu Raio-X está pronto", abrir: "Abrir meu Raio-X →", reap: "Esse site foi medido nos últimos 7 dias — este é o relatório dele.", liga: "A Gui vai te ligar pra explicar.",
    errCampos: "Preencha o site, um contato e marque a caixa de consentimento.", errSite: "Isso não parece um endereço de site — tente seunegocio.com.",
    errNaoLeu: "Não conseguimos ler esse site (pode bloquear robôs ou estar fora do ar). Deixe seu número com a Gui que a gente faz na mão.",
    errRate: "Muitos Raio-X daqui hoje — tente de novo em uma hora.", errGeral: "Algo falhou do nosso lado. Tente de novo em um minuto.",
  },
  es: {
    eyebrow: "Radiografía gratis", h2a: "Mira lo que tu negocio está perdiendo — ", h2b: "medido, no adivinado.",
    sub: "Deja tu sitio y tu número. Medimos llamadas perdidas, respuestas lentas y reservas que se escapan en TU negocio — el informe se abre aquí mismo, y Gui te llama para explicarlo.",
    pts: ["Medido en tu sitio real", "Cifra en dinero por fuga, por servicio", "Qué arregla Gui primero — y cuánto cuesta"],
    site: "Tu sitio web", sitePh: "tunegocio.com", nome: "Tu nombre", contato: "Teléfono (con código de país) o correo", contatoPh: "+1 555 123 4567",
    consent: "Acepto que Gui me contacte (llamada o mensaje) sobre mi informe. Responde STOP cuando quieras.",
    cta: "Quiero mi radiografía gratis →", gerando: "Midiendo tu sitio… (hasta 20s)",
    pronto: "Tu radiografía está lista", abrir: "Abrir mi radiografía →", reap: "Este sitio se midió en los últimos 7 días — este es su informe.", liga: "Gui te llamará para explicarlo.",
    errCampos: "Completa el sitio, un contacto y marca la casilla de consentimiento.", errSite: "Eso no parece una dirección web — prueba tunegocio.com.",
    errNaoLeu: "No pudimos leer ese sitio (puede bloquear robots o estar caído). Deja tu número con Gui y lo hacemos a mano.",
    errRate: "Demasiadas radiografías desde aquí hoy — intenta en una hora.", errGeral: "Algo falló de nuestro lado. Intenta en un minuto.",
  },
  hi: {
    eyebrow: "मुफ़्त X-Ray", h2a: "देखें आपका बिज़नेस कहाँ लीक कर रहा है — ", h2b: "मापा हुआ, अंदाज़ा नहीं।",
    sub: "अपनी वेबसाइट और नंबर छोड़ें। हम आपके बिज़नेस की छूटी कॉल, धीमे जवाब और खोई बुकिंग मापते हैं — रिपोर्ट यहीं खुलती है, और Gui समझाने के लिए कॉल करती है।",
    pts: ["आपकी असली साइट पर मापा", "हर लीक की रक़म, सेवा के हिसाब से", "Gui पहले क्या ठीक करती है — और क़ीमत"],
    site: "आपकी वेबसाइट", sitePh: "yourbusiness.com", nome: "आपका नाम", contato: "फ़ोन (देश कोड के साथ) या ईमेल", contatoPh: "+1 555 123 4567",
    consent: "मैं अपनी रिपोर्ट के बारे में Gui से संपर्क (कॉल या मैसेज) के लिए सहमत हूँ। कभी भी STOP भेजें।",
    cta: "मेरा मुफ़्त X-Ray चाहिए →", gerando: "आपकी साइट माप रहे हैं… (20 सेकंड तक)",
    pronto: "आपका X-Ray तैयार है", abrir: "मेरा X-Ray खोलें →", reap: "यह साइट पिछले 7 दिनों में मापी गई थी — यह उसकी रिपोर्ट है।", liga: "Gui समझाने के लिए कॉल करेगी।",
    errCampos: "वेबसाइट, संपर्क भरें और सहमति बॉक्स चुनें।", errSite: "यह वेबसाइट पता नहीं लगता — yourbusiness.com आज़माएँ।",
    errNaoLeu: "हम यह साइट नहीं पढ़ पाए। Gui के पास अपना नंबर छोड़ें, हम हाथ से करेंगे।",
    errRate: "आज यहाँ से बहुत सारे X-Ray — एक घंटे बाद आज़माएँ।", errGeral: "हमारी तरफ़ कुछ गड़बड़ हुई। एक मिनट बाद आज़माएँ।",
  },
};

const campo = "w-full rounded-xl border border-g-line bg-white/[0.03] px-3.5 py-3 text-[15px] text-g-word placeholder:text-g-muted/60 focus:border-g-green/60 focus:outline-none";

export default function XRaySection() {
  const { lang } = useLang();
  const C = COPY[lang] || COPY.en;
  const [site, setSite] = useState("");
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [consent, setConsent] = useState(false);
  const [estado, setEstado] = useState("idle"); // idle | gerando | pronto
  const [erro, setErro] = useState("");
  const [res, setRes] = useState(null);

  async function gerar(e) {
    e.preventDefault();
    if (!site.trim() || !contato.trim() || !consent) { setErro(C.errCampos); return; }
    setErro(""); setEstado("gerando");
    let j = null;
    try {
      const r = await fetch("/api/raio-x", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "gerar", site, nome, contato, lang, consent, quiz: {} }),
      });
      j = await r.json().catch(() => null);
    } catch { j = null; }
    // Só vira "pronto" com LINK na mão — "ok" sem o endereço do relatório é promessa sem lastro.
    if (j && j.ok && j.link) {
      setRes(j); setEstado("pronto");
      evento("xray_enviado", { source: "home", reaproveitado: !!j.reaproveitado });
      return;
    }
    setEstado("idle");
    const cod = j && j.erro;
    setErro(cod === "site_invalido" ? C.errSite : cod === "nao_deu_pra_ler" ? C.errNaoLeu
      : (cod === "rate" || cod === "rate_dominio") ? C.errRate : C.errGeral);
  }

  return (
    <section id="xray" className="relative overflow-hidden px-5 py-20">
      <style>{`@keyframes xscan{0%{top:-12%}100%{top:112%}}@media (prefers-reduced-motion: reduce){.xscan{animation:none !important;display:none}}`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_50%_0%,rgba(255,138,51,0.07),transparent)]" />
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <div className="text-[12px] font-black uppercase tracking-[0.24em] text-g-gold">🩻 {C.eyebrow}</div>
          <h2 className="mt-4 font-black leading-[1.02] tracking-tight text-g-word" style={{ fontSize: "clamp(1.9rem,4.2vw,2.9rem)" }}>
            {C.h2a}<span className="bg-gradient-to-r from-g-green via-g-light to-g-green bg-clip-text text-transparent">{C.h2b}</span>
          </h2>
          <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-g-ink">{C.sub}</p>
          <ul className="mt-5 space-y-2">
            {C.pts.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[14px] text-g-word"><span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-g-green/15 text-[10px] text-g-light ring-1 ring-g-green/30">✓</span>{t}</li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={120}>
          <div className="relative overflow-hidden rounded-3xl border border-g-line bg-g-creamd/70 p-6 backdrop-blur sm:p-8">
            {/* a VARREDURA: uma linha de luz verde percorre o painel de cima a baixo — é um raio-x.
                Durante a geração ela acelera: o movimento diz que algo está sendo medido agora. */}
            <span aria-hidden="true" className="xscan pointer-events-none absolute left-0 right-0 z-0 h-16" style={{ background: "linear-gradient(180deg, transparent, rgba(62,148,104,0.16), rgba(111,184,146,0.35), rgba(62,148,104,0.16), transparent)", animation: `xscan ${estado === "gerando" ? "1.4s" : "5.5s"} cubic-bezier(.4,0,.6,1) infinite` }} />
            <div className="relative z-10">
              {estado === "pronto" && res ? (
                <div className="py-4 text-center" role="status">
                  <div className="text-[34px]">🩻</div>
                  <div className="mt-2 text-[20px] font-black text-g-word">{C.pronto}</div>
                  {res.reaproveitado && <p className="mx-auto mt-2 max-w-sm text-[12.5px] text-g-muted">{C.reap}</p>}
                  <a href={res.link} className="btn-bright mt-5 inline-flex">{C.abrir}</a>
                  <p className="mt-3 text-[12.5px] text-g-muted">{C.liga}</p>
                </div>
              ) : (
                <form onSubmit={gerar} className="grid gap-3" noValidate>
                  <label className="grid gap-1.5 text-[12.5px] font-bold text-g-ink">{C.site}
                    <input className={campo} value={site} onChange={(e) => setSite(e.target.value)} placeholder={C.sitePh} inputMode="url" autoComplete="url" required />
                  </label>
                  <label className="grid gap-1.5 text-[12.5px] font-bold text-g-ink">{C.nome}
                    <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
                  </label>
                  <label className="grid gap-1.5 text-[12.5px] font-bold text-g-ink">{C.contato}
                    <input className={campo} value={contato} onChange={(e) => setContato(e.target.value)} placeholder={C.contatoPh} autoComplete="tel" required />
                  </label>
                  <label className="mt-1 flex items-start gap-2.5 text-[12px] leading-snug text-g-muted">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#3E9468]" />
                    <span>{C.consent}</span>
                  </label>
                  {erro && <p role="alert" className="rounded-lg border border-[#c8623c]/40 bg-[#c8623c]/10 px-3 py-2 text-[13px] text-[#e8a488]">{erro}</p>}
                  <button type="submit" disabled={estado === "gerando"} className="btn-bright mt-1 justify-center disabled:opacity-70">
                    {estado === "gerando" ? C.gerando : C.cta}
                  </button>
                </form>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
