// FounderProof — social proof: an honest first-person note from Luis (why Guileo exists),
// plus a testimonials row that ONLY renders once real client quotes exist. No fake reviews,
// ✂️ TEXTO ENCURTADO E CORRIGIDO (Luis, 2026-08-25): saiu "cresci cercado de negócios como o
// seu" e saiu "famílias imigrantes". A biografia real é outra e é MAIS forte para vender:
// médico, desenvolvedor e empresário de tecnologia. Médico dá autoridade em clínica (a vertical
// de maior ticket), desenvolvedor explica por que o produto existe, e empresário diz que ele
// vive a mesma dor do leitor. "Imigrante" restringia o público sem necessidade — o problema do
// telefone que ninguém atende não tem nacionalidade.
// no invented metrics — the founder's word is the proof until clients speak. Sits right
// above the live "Let Gui call you" demo: read why it exists, then watch it work.

import { useState, useEffect } from "react";
import { useLang } from "../i18n.jsx";
import { Reveal } from "../lib/ui.jsx";

// PROVA SOCIAL REAL — os depoimentos vêm do banco, e SÓ os que o Luis aprovou
// (/api/testimonial → testimonials_public, que filtra approved=true). Antes isto era
// um array vazio no código: honesto, mas sem jeito de nunca encher. Agora o cliente
// escreve no cockpit, o Luis aprova, e aparece aqui — sem nada fabricado no meio.
// Falha de rede → lista vazia → a seção some. Nunca inventa depoimento.

const COPY = {
  en: {
    eyebrow: "A note from the founder",
    note: "I'm a physician, a developer and a technology entrepreneur. For years I watched clinics, restaurants and salons lose customers for one reason — nobody picked up the phone. Big companies have call centers; everyone else has voicemail. I built Guileo so any business gets that same 24/7 team.",
    role: "Founder, Guileo (ORIGEM LTDA)",
    quotesHead: "What clients say",
  },
  pt: {
    eyebrow: "Uma carta do fundador",
    note: "Sou médico, desenvolvedor e empresário de tecnologia. Por anos vi clínicas, restaurantes e salões perderem cliente por um motivo só — ninguém atendia o telefone. Empresa grande tem call center; o resto tem caixa postal. Construí a Guileo pra qualquer negócio ter esse mesmo time 24/7.",
    role: "Fundador, Guileo (ORIGEM LTDA)",
    quotesHead: "O que os clientes dizem",
  },
  es: {
    eyebrow: "Una nota del fundador",
    note: "Soy médico, desarrollador y empresario de tecnología. Por años vi clínicas, restaurantes y salones perder clientes por una sola razón — nadie contestaba el teléfono. Las grandes empresas tienen call center; el resto tiene buzón de voz. Construí Guileo para que cualquier negocio tenga ese mismo equipo 24/7.",
    role: "Fundador, Guileo (ORIGEM LTDA)",
    quotesHead: "Lo que dicen los clientes",
  },
  hi: {
    eyebrow: "संस्थापक की ओर से",
    note: "मैं एक चिकित्सक, डेवलपर और टेक्नोलॉजी उद्यमी हूँ। सालों तक मैंने क्लिनिक, रेस्तराँ और सैलून को सिर्फ़ एक वजह से ग्राहक खोते देखा — कोई फ़ोन नहीं उठाता था। बड़ी कंपनियों के पास कॉल सेंटर है; बाक़ी सबके पास वॉइसमेल। मैंने Guileo इसलिए बनाया कि हर व्यवसाय को वही 24/7 टीम मिले।",
    role: "संस्थापक, Guileo (ORIGEM LTDA)",
    quotesHead: "ग्राहक क्या कहते हैं",
  },
};

export default function FounderProof() {
  const { lang } = useLang();
  const C = COPY[lang] || COPY.en;
  // Depoimentos APROVADOS, no idioma da página. Sem `lang` na chamada a landing
  // mostraria uma citação em português pra um visitante em inglês.
  const [quotes, setQuotes] = useState([]);
  useEffect(() => {
    let alive = true;
    fetch(`/api/testimonial?lang=${encodeURIComponent(lang || "en")}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (alive && Array.isArray(d)) setQuotes(d); })
      .catch(() => { /* rede ruim → seção some, nunca inventa */ });
    return () => { alive = false; };
  }, [lang]);

  return (
    <section className="relative overflow-hidden px-5 py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(560px_280px_at_50%_30%,rgba(255,138,51,0.05),transparent)]" />

      {/* Founder note — one quiet card, hotel-stationery energy */}
      <Reveal className="mx-auto max-w-2xl">
        <div className="relative overflow-hidden rounded-xl3 border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl sm:p-10">
          <div className="pointer-events-none absolute -top-20 -right-14 h-56 w-56 rounded-full bg-g-gold/10 blur-3xl" />
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{C.eyebrow}</div>
          <p className="mt-5 text-[16px] leading-relaxed text-g-word sm:text-[17px]">{C.note}</p>
          <div className="mt-7 flex items-center gap-3">
            <div className="h-px w-10 bg-gradient-to-r from-g-gold/60 to-transparent" />
            <span className="text-base" style={{ filter: "drop-shadow(0 2px 6px rgba(62,148,104,0.5))" }}>🌱</span>
            <div>
              <div className="text-[14px] font-bold text-g-light">Luis Teles</div>
              <div className="text-[12px] text-g-muted">{C.role}</div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Depoimentos — só renderiza quando existe quote REAL e aprovada */}
      {quotes.length > 0 && (
        <div className="mx-auto mt-12 max-w-5xl">
          <Reveal className="mb-7 text-center">
            <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{C.quotesHead}</div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quotes.map((q, i) => (
              <Reveal key={`${q.author}-${i}`} delay={i * 0.08}>
                <figure className="h-full rounded-xl3 border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-g-green/40">
                  <blockquote className="text-[14px] leading-relaxed text-g-word">“{q.quote}”</blockquote>
                  <figcaption className="mt-4 text-[12px] text-g-muted">
                    <span className="font-bold text-g-light">{q.author}</span>{q.role ? ` · ${q.role}` : ""}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
