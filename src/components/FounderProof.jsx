// FounderProof — social proof: an honest first-person note from Luis (why Guileo exists),
// plus a testimonials row that ONLY renders once real client quotes exist. No fake reviews,
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
    note: "I grew up around businesses like yours. For years I watched restaurants, clinics and salons — many run by immigrant families — lose customers every single day, simply because nobody could pick up the phone. Big companies had front desks and call centers; the little guy had a voicemail. I built Guileo so every small business gets the same 24/7 team — one that answers in your customer's language, and never lets a call go unanswered.",
    role: "Founder, Guileo (ORIGEM LTDA)",
    quotesHead: "What clients say",
  },
  pt: {
    eyebrow: "Uma carta do fundador",
    note: "Cresci cercado de negócios como o seu. Por anos vi restaurantes, clínicas e salões — muitos de famílias imigrantes — perderem clientes todos os dias, simplesmente porque ninguém conseguia atender o telefone. As grandes empresas tinham recepção e call center; o pequeno tinha caixa postal. Criei a Guileo para que todo pequeno negócio tenha a mesma equipe 24/7 — que atende no idioma do seu cliente e nunca deixa uma ligação sem resposta.",
    role: "Fundador, Guileo (ORIGEM LTDA)",
    quotesHead: "O que os clientes dizem",
  },
  es: {
    eyebrow: "Una nota del fundador",
    note: "Crecí rodeado de negocios como el tuyo. Durante años vi restaurantes, clínicas y salones — muchos de familias inmigrantes — perder clientes todos los días, simplemente porque nadie podía contestar el teléfono. Las grandes empresas tenían recepción y call centers; el pequeño tenía un buzón de voz. Creé Guileo para que cada pequeño negocio tenga el mismo equipo 24/7 — uno que contesta en el idioma de tu cliente y nunca deja una llamada sin respuesta.",
    role: "Fundador, Guileo (ORIGEM LTDA)",
    quotesHead: "Lo que dicen los clientes",
  },
  hi: {
    eyebrow: "संस्थापक की ओर से",
    note: "मैं आपके जैसे व्यवसायों के बीच बड़ा हुआ। सालों तक मैंने रेस्टोरेंट, क्लीनिक और सैलून — जिनमें कई अप्रवासी परिवारों के थे — को हर दिन ग्राहक खोते देखा, सिर्फ इसलिए कि फोन उठाने वाला कोई नहीं था। बड़ी कंपनियों के पास रिसेप्शन और कॉल सेंटर थे; छोटे व्यवसाय के पास सिर्फ वॉइसमेल। मैंने Guileo इसलिए बनाया ताकि हर छोटे व्यवसाय को वही 24/7 टीम मिले — जो आपके ग्राहक की भाषा में जवाब देती है और कोई कॉल अनुत्तरित नहीं छोड़ती।",
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
        <div className="relative overflow-hidden rounded-xl3 border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl shadow-lift sm:p-10">
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
