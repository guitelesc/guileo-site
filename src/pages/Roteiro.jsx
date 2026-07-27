import { useEffect, useState } from "react";
import logo from "../assets/guileo-mark.png";
import { waLink } from "../data/contact.js";
import { MASTER_SENTENCE, OBJECTION_KILLERS } from "../data/salesKit.js";

// Objections shown on the field script: the 5 most likely in a live 2-min demo,
// pulled from the ONE sales kit (same words in /deck, /pitch and /cola — no drift).
const OBJ_IDS = ["too_expensive", "have_staff", "ai_annoy", "wrong_order", "later"];
const objsFor = (lang) => OBJ_IDS.map((id) => {
  const o = OBJECTION_KILLERS.find((k) => k.id === id);
  return [o.q[lang], o.a[lang]];
});

// /roteiro — the 2-MINUTE LIVE-DEMO SCRIPT. A founder/partner opens this right
// before (or during) a meeting and reads it top-to-bottom. It mirrors the ACTUAL
// product flow tested live on guileoai.com: hook → landing + Gui answering → "deixa
// seu telefone, o Gui te liga agora" (speed-to-lead wow) → portal → offer + 30-day
// guarantee + price → top-5 objections → close + proposal link.
// Self-contained PT/EN/ES toggle (local state), same pocket-card pattern as /cola.

const D = {
  pt: {
    title: "Roteiro · demo de 2 min",
    sub: "Leia 2 min antes. Siga de cima pra baixo. Deixa o produto fazer o trabalho.",
    metaLabel: "ABRA AO VIVO",
    site: "guileoai.com",
    steps: [
      { n: "0:00", t: "Abertura · o gancho", c: "g-gold",
        say: "“Quanto vale uma ligação perdida pra você? Você perde umas 20–30 por mês. A $80 cada, são ~$2.000/mês saindo pela porta. Deixa eu te mostrar quem atende isso por você — em 2 minutos.”",
        do: "Olha no olho. Faz a conta com o número DELE. Não venda ainda — só abra o problema." },
      { n: "0:20", t: "Mostra o site + o Gui atendendo", c: "g-green",
        say: "“Esse é o Gui. Atende ligação, WhatsApp e SMS, agenda, orça e faz follow-up — 24/7, em português, inglês e espanhol.”",
        do: "Abra guileoai.com no celular dele. Role o hero. Mostra os canais. Tudo já é real e funciona." },
      { n: "0:45", t: "⚡ “Deixa seu telefone — o Gui te liga AGORA”", c: "g-gold",
        say: "“Não acredita? Põe seu número aqui. O Gui te liga em segundos, ao vivo.”",
        do: "Digita o número DELE no campo do hero → toca em ligar → ENTREGA o celular pra ele. AGORA FICA EM SILÊNCIO. Deixa o Gui atender. Esse é o momento que fecha." ,
        warn: "⚠️ Precisa de crédito ElevenLabs ativo. Confirme ANTES da reunião." },
      { n: "1:15", t: "Mostra o portal / dashboard", c: "g-green",
        say: "“Tudo o que o Gui faz, você vê aqui: cada ligação, transcrição, sentimento, agendamento e lead — em tempo real.”",
        do: "Abra /portal. Mostra ligações + transcrições + agenda. ‘Isso é o que VOCÊ recebe no dia 1.’" },
      { n: "1:35", t: "A oferta + garantia + preço", c: "g-gold",
        say: "“Dois caminhos. Self-service a partir de $149/mês — você paga e a Gui nasce em minutos, sozinha. Ou a gente monta tudo pra você: $990 de setup + $1.497/mês, no ar em 7 dias. Os dois com garantia de 30 dias — não gostou, devolvemos.”",
        do: "Ancore no done-for-you, ofereça o self-service como ‘entrada’. A garantia tira o risco da mesa." },
      { n: "1:55", t: "O fechamento", c: "g-green",
        say: "“Te mando a proposta agora, com seu número e o valor que você está perdendo. Fechamos hoje e o Gui está no ar essa semana. Topa?”",
        do: "Abra a proposta na frente dele (botão abaixo). Preencha to + price + recover com os números DELE. Peça o sim." },
    ],
    objH: "🛡️ As 5 objeções (resposta de concierge)",
    objs: objsFor("pt"),
    never: "🚫 Nunca: prometer que a IA nunca erra · garantir resultado exato em $ · prometer menos de 7 dias",
    toolsH: "🧰 Abrir agora",
    tProp: "📄 Proposta", tPortal: "📊 Portal", tCola: "📌 Cola", tHelp: "🆘 Luis",
    propLabel: "Proposta (preenche e manda)",
  },
  en: {
    title: "Script · 2-min demo",
    sub: "Read 2 min before. Run it top to bottom. Let the product do the work.",
    metaLabel: "OPEN LIVE",
    site: "guileoai.com",
    steps: [
      { n: "0:00", t: "Open · the hook", c: "g-gold",
        say: "“What's a missed call worth to you? You miss ~20–30 a month. At $80 each, that's ~$2,000/mo walking out the door. Let me show you who answers that for you — in 2 minutes.”",
        do: "Eye contact. Do the math with THEIR number. Don't sell yet — just open the problem." },
      { n: "0:20", t: "Show the site + Gui answering", c: "g-green",
        say: "“This is Gui. It answers calls, WhatsApp and SMS, books, quotes and follows up — 24/7, in English, Portuguese and Spanish.”",
        do: "Open guileoai.com on their phone. Scroll the hero. Show the channels. It's all real and working." },
      { n: "0:45", t: "⚡ “Drop your number — Gui calls you NOW”", c: "g-gold",
        say: "“Don't believe me? Put your number in. Gui calls you in seconds, live.”",
        do: "Type THEIR number into the hero field → tap call → HAND them the phone. NOW GO SILENT. Let Gui answer. This is the moment that closes.",
        warn: "⚠️ Needs active ElevenLabs credit. Confirm BEFORE the meeting." },
      { n: "1:15", t: "Show the portal / dashboard", c: "g-green",
        say: "“Everything Gui does, you see here: every call, transcript, sentiment, booking and lead — in real time.”",
        do: "Open /portal. Show calls + transcripts + calendar. ‘This is what YOU get on day 1.’" },
      { n: "1:35", t: "The offer + guarantee + price", c: "g-gold",
        say: "“Two ways. Self-serve from $149/mo — you pay and Gui is born in minutes, on its own. Or we build it all for you: $990 setup + $1,497/mo, live in 7 days. Both with a 30-day money-back guarantee — don't love it, we refund.”",
        do: "Anchor on done-for-you, offer self-serve as the ‘entry’. The guarantee takes risk off the table." },
      { n: "1:55", t: "The close", c: "g-green",
        say: "“I'll send the proposal right now, with your number and what you're losing. We close today and Gui is live this week. Deal?”",
        do: "Open the proposal in front of them (button below). Fill to + price + recover with THEIR numbers. Ask for the yes." },
    ],
    objH: "🛡️ The 5 objections (concierge answers)",
    objs: objsFor("en"),
    never: "🚫 Never: promise the AI never errs · guarantee exact $ results · promise under 7 days",
    toolsH: "🧰 Open now",
    tProp: "📄 Proposal", tPortal: "📊 Portal", tCola: "📌 Card", tHelp: "🆘 Luis",
    propLabel: "Proposal (fill & send)",
  },
  es: {
    title: "Guion · demo de 2 min",
    sub: "Lee 2 min antes. Síguelo de arriba a abajo. Deja que el producto trabaje.",
    metaLabel: "ABRE EN VIVO",
    site: "guileoai.com",
    steps: [
      { n: "0:00", t: "Apertura · el gancho", c: "g-gold",
        say: "“¿Cuánto vale una llamada perdida para ti? Pierdes unas 20–30 al mes. A $80 cada una, son ~$2.000/mes saliendo por la puerta. Déjame mostrarte quién responde eso por ti — en 2 minutos.”",
        do: "Mira a los ojos. Haz la cuenta con SU número. No vendas aún — solo abre el problema." },
      { n: "0:20", t: "Muestra el sitio + Gui contestando", c: "g-green",
        say: "“Este es Gui. Contesta llamadas, WhatsApp y SMS, agenda, cotiza y hace seguimiento — 24/7, en español, inglés y portugués.”",
        do: "Abre guileoai.com en su teléfono. Desliza el hero. Muestra los canales. Todo es real y funciona." },
      { n: "0:45", t: "⚡ “Pon tu número — Gui te llama AHORA”", c: "g-gold",
        say: "“¿No me crees? Pon tu número. Gui te llama en segundos, en vivo.”",
        do: "Escribe SU número en el campo del hero → toca llamar → ENTRÉGALE el teléfono. AHORA GUARDA SILENCIO. Deja que Gui conteste. Este es el momento que cierra.",
        warn: "⚠️ Requiere crédito ElevenLabs activo. Confírmalo ANTES de la reunión." },
      { n: "1:15", t: "Muestra el portal / dashboard", c: "g-green",
        say: "“Todo lo que Gui hace, lo ves aquí: cada llamada, transcripción, sentimiento, reserva y lead — en tiempo real.”",
        do: "Abre /portal. Muestra llamadas + transcripciones + agenda. ‘Esto es lo que TÚ recibes el día 1.’" },
      { n: "1:35", t: "La oferta + garantía + precio", c: "g-gold",
        say: "“Dos caminos. Self-service desde $149/mes — pagas y Gui nace en minutos, sola. O lo montamos todo por ti: $990 de setup + $1.497/mes, en vivo en 7 días. Ambos con garantía de 30 días — si no te gusta, devolvemos.”",
        do: "Ancla en el done-for-you, ofrece el self-service como ‘entrada’. La garantía quita el riesgo de la mesa." },
      { n: "1:55", t: "El cierre", c: "g-green",
        say: "“Te envío la propuesta ahora, con tu número y lo que estás perdiendo. Cerramos hoy y Gui está en vivo esta semana. ¿Trato?”",
        do: "Abre la propuesta frente a él (botón abajo). Llena to + price + recover con SUS números. Pide el sí." },
    ],
    objH: "🛡️ Las 5 objeciones (respuesta de concierge)",
    objs: objsFor("es"),
    never: "🚫 Nunca: prometer que la IA nunca se equivoca · garantizar resultado exacto en $ · prometer menos de 7 días",
    toolsH: "🧰 Abrir ahora",
    tProp: "📄 Propuesta", tPortal: "📊 Portal", tCola: "📌 Tarjeta", tHelp: "🆘 Luis",
    propLabel: "Propuesta (llena y envía)",
  },
};

const LANGS = [["pt", "🇧🇷"], ["en", "🇺🇸"], ["es", "🇪🇸"]];

export default function Roteiro() {
  const [lang, setLang] = useState("pt");
  const t = D[lang];
  useEffect(() => { document.title = "Guileo · Roteiro de demo"; }, []);
  return (
    <div className="surface-real min-h-screen px-4 py-6 text-g-ink">
      <div className="relative z-10 mx-auto max-w-md space-y-4">
        <header className="flex items-center justify-between">
          <a href="/cola" className="flex items-center gap-2"><img src={logo} alt="" className="h-7 w-7 object-contain" /><span className="text-[13px] font-extrabold text-g-word">{t.title}</span></a>
          <div className="flex gap-1">{LANGS.map(([c, f]) => <button key={c} onClick={() => setLang(c)} className={`h-7 w-7 rounded-full text-sm ${lang === c ? "bg-g-green/15 ring-1 ring-g-green/30" : "opacity-50"}`}>{f}</button>)}</div>
        </header>
        <p className="text-[11.5px] italic text-g-muted">{t.sub}</p>

        {/* THE sentence — same source as /deck, /pitch, /cola (salesKit.js) */}
        <blockquote className="rounded-2xl border border-g-green/30 bg-g-green/[0.06] p-4 text-[13px] font-bold leading-relaxed text-g-word">“{MASTER_SENTENCE[lang]}”</blockquote>

        <div className="flex items-center justify-between rounded-xl border border-g-gold/30 bg-g-gold/[0.06] px-3.5 py-2.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-g-gold">{t.metaLabel}</span>
          <a href="https://guileoai.com" target="_blank" rel="noopener" className="text-[13px] font-black text-g-word">{t.site} →</a>
        </div>

        <ol className="space-y-3">
          {t.steps.map((s) => (
            <li key={s.n} className={`rounded-2xl border bg-white/[0.03] p-4 ${s.c === "g-gold" ? "border-g-gold/30" : "border-g-line"}`}>
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums ${s.c === "g-gold" ? "bg-g-gold/15 text-g-gold" : "bg-g-green/15 text-g-green"}`}>{s.n}</span>
                <span className="text-[12.5px] font-black text-g-word">{s.t}</span>
              </div>
              <p className="mt-2 text-[13px] font-semibold leading-relaxed text-g-word">{s.say}</p>
              <p className="mt-1.5 text-[11.5px] leading-snug text-g-muted"><span className="font-black text-g-ink">▸ </span>{s.do}</p>
              {s.warn && <p className="mt-2 rounded-lg border border-[#d8916e]/30 bg-[#d8916e]/[0.07] px-2.5 py-1.5 text-[11px] font-bold leading-snug text-g-ink">{s.warn}</p>}
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-g-line bg-white/[0.03] p-4">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{t.objH}</div>
          <div className="mt-2 space-y-2.5">{t.objs.map(([o, a]) => <div key={o} className="text-[12px] leading-snug"><div className="font-black text-g-word">{o}</div><div className="text-g-ink">{a}</div></div>)}</div>
        </div>

        <p className="rounded-xl border border-[#d8916e]/25 bg-[#d8916e]/[0.05] px-3.5 py-2.5 text-[11.5px] leading-snug text-g-ink">{t.never}</p>

        <div>
          <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-g-muted">{t.toolsH}</div>
          <a href="/proposta?to=Cliente&price=1497&recover=2000" className="mb-2 block rounded-xl border border-g-green/30 bg-g-green/[0.08] px-3 py-3 text-center text-[13px] font-black text-g-green">{t.tProp} · {t.propLabel}</a>
          <div className="grid grid-cols-3 gap-2">
            <a href="/portal" className="rounded-xl border border-g-line bg-white/[0.04] px-3 py-2.5 text-center text-[12px] font-bold text-g-word">{t.tPortal}</a>
            <a href="/cola" className="rounded-xl border border-g-line bg-white/[0.04] px-3 py-2.5 text-center text-[12px] font-bold text-g-word">{t.tCola}</a>
            <a href={waLink("Luis, socorro rápido numa reunião:")} target="_blank" rel="noopener" className="rounded-xl border border-g-green/30 bg-g-green/[0.08] px-3 py-2.5 text-center text-[12px] font-black text-g-green">{t.tHelp}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
