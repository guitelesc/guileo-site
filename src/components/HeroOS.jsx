import { useEffect, useRef } from "react";
import { Phone, HeroKeyframes } from "./HeroV2";
import { ELEVEN_AGENT_ID } from "./VoiceAgent.jsx";
import { useLang } from "../i18n.jsx";
import { evento, ouvirGui } from "../lib/evento.js";

/* ── HeroOS — O HERÓI DA "/" (2026-09-09, aprovado pelo Luis: "a hero volta esse texto") ─────────
   Nasceu na /nova como HeroNova e subiu pra landing principal. A tese: a Guileo como sistema
   operacional da empresa ("Stop running your business. Start leading it."), um CTA só — falar
   com a Gui AGORA — e o agente da ElevenLabs (voz E texto) no canto, que é a MESMA Gui que atende
   o telefone do cliente. O balão antigo (VoiceAgent) saiu: dois balões no canto é erro.
   Realismo (lei 4K): softbox no topo, brasa da Gui respirando, telefone que POUSA (sombra de
   contato + reflexo curto), grão do body por baixo — nunca um bg-* na raiz que tape o cimento. */

/* ── O INTERRUPTOR DO TELEFONE (2026-09-27) ───────────────────────────────────────────────────
   A conta Twilio está SUSPENSA: hoje a Gui NÃO consegue ligar pra ninguém. A página prometia
   "a Gui te liga em cerca de um minuto" — promessa que não se cumpre é pior que promessa
   nenhuma: o visitante deixa o número, espera o telefone tocar e conclui que o produto não
   funciona. O que FUNCIONA hoje é o widget (voz e texto no navegador) e o retorno humano.
   Por isso a promessa não foi apagada, foi posta atrás de UMA chave: com `false` a página
   diz a verdade ("fale com a Gui aqui mesmo, ou deixe seu número e a gente te procura hoje").
   👉 Só vire para `true` quando a Twilio estiver RECARREGADA **e** uma ligação de teste real
      tiver tocado num telefone de verdade (saldo na conta não é prova; telefone tocando é).
   Quem lê a chave: copyTelefone() abaixo → Home.jsx (botão da FAQ) e Nova.jsx (seção contato). */
export const TELEFONE_NO_AR = false;

const COPY = {
  en: {
    mantra: "Work Smart. Grow Faster. Sleep Better.",
    eyebrow: "AI Company Operating System™",
    h1a: "Stop running your business.",
    h1b: "Start leading it.",
    sub: "Gui answers every call and message, books, quotes and collects — 24/7, in 16 languages. You keep the decisions only a CEO should make.",
    talk: "Talk to Gui right now",
    talkSub: "Voice or text — the green button in the corner. It's the same Gui that will answer your customers.",
    priceLine: (p) => `Plans from ${p}. Tailored programs are quoted by phone.`,
    priceCta: "Ask Gui for a quote",
    faqEyebrow: "Questions",
    faqH2: "Straight answers",
    contactEyebrow: "Or leave your number",
    contactH2: "Gui calls you in about a minute.",
    // variantes HONESTAS — usadas enquanto TELEFONE_NO_AR === false
    contactH2Sem: "Talk to Gui right here — or leave your number and we'll reach out today.",
    duvida: "Still have questions? Let Gui call you",
    duvidaSem: "Still have questions? Ask Gui right here",
  },
  pt: {
    mantra: "Trabalhe com inteligência. Cresça mais rápido. Durma melhor.",
    eyebrow: "Sistema Operacional de IA da sua empresa™",
    h1a: "Pare de tocar a sua empresa.",
    h1b: "Comece a liderar.",
    sub: "A Gui atende toda ligação e mensagem, agenda, orça e cobra — 24/7, em 16 idiomas. Você fica com as decisões que só um dono deve tomar.",
    talk: "Fale com a Gui agora",
    talkSub: "Por voz ou por texto — o botão verde no canto. É a mesma Gui que vai atender os seus clientes.",
    priceLine: (p) => `Planos a partir de ${p}. Programas sob medida são cotados por telefone.`,
    priceCta: "Peça um orçamento à Gui",
    faqEyebrow: "Dúvidas",
    faqH2: "Respostas diretas",
    contactEyebrow: "Ou deixe seu número",
    contactH2: "A Gui te liga em cerca de um minuto.",
    contactH2Sem: "Fale com a Gui aqui mesmo — ou deixe seu número e a gente te procura hoje.",
    duvida: "Ainda tem dúvidas? Deixe a Gui te ligar",
    duvidaSem: "Ainda tem dúvidas? Pergunte pra Gui aqui mesmo",
  },
  es: {
    mantra: "Trabaja con inteligencia. Crece más rápido. Duerme mejor.",
    eyebrow: "Sistema Operativo de IA de tu empresa™",
    h1a: "Deja de operar tu empresa.",
    h1b: "Empieza a liderarla.",
    sub: "Gui atiende cada llamada y mensaje, agenda, cotiza y cobra — 24/7, en 16 idiomas. Tú te quedas con las decisiones que solo un dueño debe tomar.",
    talk: "Habla con Gui ahora",
    talkSub: "Por voz o por texto — el botón verde de la esquina. Es la misma Gui que atenderá a tus clientes.",
    priceLine: (p) => `Planes desde ${p}. Los programas a medida se cotizan por teléfono.`,
    priceCta: "Pídele un presupuesto a Gui",
    faqEyebrow: "Dudas",
    faqH2: "Respuestas directas",
    contactEyebrow: "O deja tu número",
    contactH2: "Gui te llama en más o menos un minuto.",
    contactH2Sem: "Habla con Gui aquí mismo — o deja tu número y te contactamos hoy.",
    duvida: "¿Aún tienes dudas? Deja que Gui te llame",
    duvidaSem: "¿Aún tienes dudas? Pregúntale a Gui aquí mismo",
  },
  hi: {
    mantra: "स्मार्ट काम करें। तेज़ बढ़ें। बेहतर सोएँ।",
    eyebrow: "आपकी कंपनी का AI ऑपरेटिंग सिस्टम™",
    h1a: "अपना बिज़नेस चलाना बंद करें।",
    h1b: "उसे लीड करना शुरू करें।",
    sub: "Gui हर कॉल और मैसेज उठाती है, बुकिंग, कोटेशन और पेमेंट संभालती है — 24/7, 16 भाषाओं में। आपके पास बचते हैं वही फ़ैसले जो सिर्फ़ मालिक को लेने चाहिए।",
    talk: "अभी Gui से बात करें",
    talkSub: "आवाज़ या टेक्स्ट से — कोने का हरा बटन। यही Gui आपके ग्राहकों को जवाब देगी।",
    priceLine: (p) => `प्लान ${p} से। कस्टम प्रोग्राम फ़ोन पर कोट होते हैं।`,
    priceCta: "Gui से कोटेशन माँगें",
    faqEyebrow: "सवाल",
    faqH2: "सीधे जवाब",
    contactEyebrow: "या अपना नंबर छोड़ें",
    contactH2: "Gui लगभग एक मिनट में आपको कॉल करती है।",
    contactH2Sem: "यहीं Gui से बात करें — या अपना नंबर छोड़ें, हम आज ही आपसे संपर्क करेंगे।",
    duvida: "अब भी सवाल हैं? Gui से कॉल करवाएँ",
    duvidaSem: "अब भी सवाल हैं? यहीं Gui से पूछें",
  },
};

// A ÚNICA porta por onde a promessa de ligação chega à tela. Quem precisa do texto pede aqui e
// nunca lê COPY.contactH2 direto — senão a chave acima vira enfeite e a promessa volta sozinha.
// O ícone acompanha o texto: 📞 só quando o telefone toca de verdade; 💬 quando a conversa é aqui.
export function copyTelefone(lang) {
  const c = COPY[lang] || COPY.en;
  return TELEFONE_NO_AR
    ? { contactEyebrow: c.contactEyebrow, contactH2: c.contactH2, duvida: c.duvida, icone: "📞" }
    : { contactEyebrow: c.contactEyebrow, contactH2: c.contactH2Sem, duvida: c.duvidaSem, icone: "💬" };
}


// Injeta o embed do widget uma vez. Sem `await` de nada: se o script falhar, a página inteira
// continua de pé — o widget é o CTA, não a estrutura.
function useWidgetElevenLabs() {
  useEffect(() => {
    if (document.getElementById("el-convai-embed")) return;
    const s = document.createElement("script");
    s.id = "el-convai-embed";
    s.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    s.async = true;
    s.type = "text/javascript";
    document.body.appendChild(s);
  }, []);
}


function HeroNova({ c }) {
  const tiltRef = useRef(null);
  useEffect(() => {
    const el = tiltRef.current; if (!el) return;
    const fino = window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fino) return;
    const move = (e) => {
      const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / (window.innerWidth / 2), dy = (e.clientY - cy) / (window.innerHeight / 2);
      el.style.transform = `rotateY(${(dx * 3).toFixed(2)}deg) rotateX(${(-dy * 2.5).toFixed(2)}deg)`;
    };
    const leave = () => { el.style.transform = "rotateY(0deg) rotateX(0deg)"; };
    window.addEventListener("mousemove", move, { passive: true }); window.addEventListener("mouseleave", leave);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseleave", leave); };
  }, []);
  return (
    <section className="relative overflow-hidden px-5 pt-24 pb-16 sm:pt-16 lg:pt-24">{/* pt-24 no celular: o menu fixo cobria o eyebrow; lg:pt-24 pra o telefone não nascer colado no menu */}
      <HeroKeyframes />
      {/* O PALCO — as mesmas luzes do hero anterior: lavagem verde/champanhe no alto e a brasa laranja
          da Gui respirando atrás da cena (gembers). Luz, não cor na superfície. */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_500px_at_70%_-10%,rgba(62,148,104,0.10),transparent),radial-gradient(800px_400px_at_10%_20%,rgba(214,194,154,0.06),transparent)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(620px_420px_at_62%_42%,rgba(255,138,51,0.09),transparent)]" style={{ animation: "gembers 7s ease-in-out infinite" }} />
      {/* SOFTBOX — a luz vem de cima, sempre (lei 4K): uma linha de luz no topo do palco e a queda
          suave dela sobre a cena. Branco, nunca colorido — cor na luz vira plástico. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(255,255,255,0.06),transparent)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-g-gold/90">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#FF8A33", boxShadow: "0 0 10px 1px rgba(255,138,51,0.85)" }} />
            {c.eyebrow}
          </div>

          {/* VIVO: os mesmos keyframes do hero atual (greveal/gshine) — a energia da página mora
              aqui e só aqui. Duas linhas, não três: a frase é uma tese, não um slogan em partes. */}
          <h1 className="mt-5 font-black leading-[0.92] tracking-tight" style={{ fontSize: "clamp(2.4rem,8.5vw,4.6rem)" }}>
            <span className="block pb-[0.14em] -mb-[0.14em] text-g-word" style={{ animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{c.h1a}</span>
            <span className="block bg-gradient-to-r from-g-green via-g-light to-g-green bg-clip-text pb-[0.14em] -mb-[0.14em] text-transparent"
                  style={{ backgroundSize: "220% auto", animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .2s both, gshine 7s linear infinite" }}>{c.h1b}</span>
          </h1>

          <p className="mt-5 max-w-[34rem] text-[clamp(1.05rem,1.5vw,1.25rem)] leading-snug text-g-word/90">{c.sub}</p>
          {/* O MANTRA (Luis, 2026-09-10: "remember Work Smart. Grow Faster. Sleep Better.") — três verbos
              em champanhe, o brilho lento da casa. É a assinatura que o título do site já carrega. */}
          <p className="mt-4 bg-gradient-to-r from-g-gold via-g-word to-g-gold bg-clip-text text-[15px] font-black tracking-tight text-transparent" style={{ backgroundSize: "220% auto", animation: "gshine 9s linear infinite" }}>{c.mantra}</p>

          {/* O ÚNICO CTA DO HERO. Decisão nº 1 do Luis: a landing tem um trabalho — pôr o
              visitante falando com a Gui. O botão aponta para o widget (canto), que é a Gui de
              verdade; não existe um segundo caminho competindo na mesma dobra. */}
          <div className="mt-8">
            <a href="#gui" onClick={(e) => { e.preventDefault(); evento("cta_hero"); abrirGui("texto"); }}
               className="btn-bright inline-flex items-center gap-2 text-[15px]">
              <span className="grid h-6 w-6 place-items-center rounded-full text-xs" style={{ background: "linear-gradient(135deg,rgba(255,138,51,0.55),rgba(214,194,154,0.35))" }}>🌱</span>
              {c.talk}
            </a>
            <p className="mt-3 max-w-md text-[12.5px] text-g-muted">{c.talkSub}</p>
          </div>
        </div>

        <div className="relative min-w-0 lg:pr-16 xl:pr-8" style={{ perspective: "1400px" }}>
          {/* PARALAXE (2–3°): o aparelho inclina com o mouse — o truque mais barato que existe pra
              "isto é um objeto". REFLEXO: o próprio telefone espelhado (box-reflect, Chrome/Safari;
              Firefox ignora sem quebrar) morrendo em 28% — em vez de um gradiente fingindo. */}
          <div ref={tiltRef} className="relative transition-transform duration-150 ease-out will-change-transform"
               style={{ transformStyle: "preserve-3d", WebkitBoxReflect: "below 10px linear-gradient(transparent 72%, rgba(255,255,255,0.10))" }}>
            <Phone />
          </div>
          <div className="pointer-events-none absolute left-1/2 top-full hidden h-14 w-[72%] -translate-x-1/2 -translate-y-8 rounded-[100%] bg-black/80 blur-2xl lg:block" />
        </div>
      </div>
    </section>
  );
}


// ABRIR A CONVERSA NO CLIQUE (2026-09-09). O shadow root do widget é ABERTO e tem dois botões
// ("Start a call" / "Message"). O CTA abre o TEXTO: não dispara pedido de microfone sem aviso —
// quem quiser voz clica o telefone ali mesmo. Se a ElevenLabs fechar o shadow, cai no scroll.
export function abrirGui(modo = "texto") {
  evento("gui_aberta", { via: modo });
  const w = document.querySelector("elevenlabs-convai");
  const sr = w && w.shadowRoot;
  if (sr) {
    const alvo = [...sr.querySelectorAll("button")].find((b) => {
      const t = ((b.getAttribute("aria-label") || "") + " " + (b.textContent || "")).toLowerCase();
      return modo === "voz" ? /call|ligar|llamar/.test(t) : /message|mensagem|mensaje|chat|text/.test(t);
    });
    if (alvo) { alvo.click(); return true; }
  }
  w?.scrollIntoView({ behavior: "smooth", block: "end" });
  return false;
}

export default function HeroOS() {
  const { lang } = useLang();
  const c = COPY[lang] || COPY.en;
  useWidgetElevenLabs();
  useEffect(() => { evento("pageview"); ouvirGui(); }, []);
  return (
    <>
      <HeroNova c={c} />
      {/* A GUI DE VERDADE (widget convai): fixo no canto por conta própria; a posição no DOM não
          muda onde aparece. Cores/estilos moram do lado da ElevenLabs (widget.styles), aplicados
          por /api/agente-widget. */}
      {/* `override-language`: o widget abre no idioma da página (presets do agente + textos por idioma).
          Testado 2026-09-10: `language=` é ignorado; `override-language=` troca botões e primeira frase. */}
      {/* id="gui": todo CTA da casa aponta para href="#gui" (ou "/#gui" vindo de outra página) e a
          âncora não existia em lugar nenhum — sem JavaScript o link não levava a nada. */}
      <elevenlabs-convai id="gui" agent-id={ELEVEN_AGENT_ID} override-language={lang === "pt" ? "pt" : lang === "es" ? "es" : lang === "hi" ? "hi" : "en"}></elevenlabs-convai>
    </>
  );
}
