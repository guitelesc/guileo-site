import { useState, useEffect } from "react";
import mark from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";

// Hero copy that lives in the component (richer than the shared dict) — translated inline.
const HERO_COPY = {
  en: { eyebrow:"AI · ads · creative — the agency that grows local businesses", sub:["We run the ads that fill your calendar — and "," answers every call 24/7 in 16 languages, books, quotes and collects. You buy the "," result, not the tools","."], method:["⚡ Performance","Sales","Growth"], cta:"Hear Gui work", sub2:"Real AI · real calls · real bookings." },
  pt: { eyebrow:"AI · anúncios · criativo — a agência que faz o negócio local crescer", sub:["A gente roda os anúncios que enchem sua agenda — e a "," atende 24/7 em 16 idiomas, agenda, orça e cobra. Você compra o "," resultado, não a ferramenta","."], method:["⚡ Performance","Vendas","Crescimento"], cta:"Ouça a Gui trabalhar", sub2:"IA de verdade · ligações reais · agendamentos reais." },
  es: { eyebrow:"IA · anuncios · creativo — la agencia que hace crecer al negocio local", sub:["Nosotros manejamos los anuncios que llenan tu agenda — y "," contesta 24/7 en 16 idiomas, agenda, cotiza y cobra. Compras el "," resultado, no la herramienta","."], method:["⚡ Rendimiento","Ventas","Crecimiento"], cta:"Escucha a Gui trabajar", sub2:"IA real · llamadas reales · reservas reales." },
  hi: { eyebrow:"AI · विज्ञापन · क्रिएटिव — स्थानीय व्यवसाय बढ़ाने वाली एजेंसी", sub:["हम वो विज्ञापन चलाते हैं जो आपका कैलेंडर भरते हैं — और "," 16 भाषाओं में 24/7 जवाब देती, बुकिंग, कोटेशन और वसूली करती है। आप "," नतीजा खरीदते हैं, टूल नहीं","।"], method:["⚡ Performance","Sales","Growth"], cta:"Gui को काम करते सुनें", sub2:"असली AI · असली कॉल · असली बुकिंग।" },
};

// HeroV2 — TEST (/v2). Realistic, LIVING iPhone-2026 mockup of Gui working nonstop.
// SMOOTH motion: the action feed is a continuous gliding marquee (no janky remounts),
// the header business/line crossfades gently, the call timer ticks, the floating proof
// cards (services + profit + numbers) rotate with soft crossfades. Plant is back behind.
// All motion = CSS transforms + eased crossfades (framer `animate` is unreliable here).

// ── O FEED DO TELEFONE, NOS 4 IDIOMAS (2026-08-11) ──────────────────────────────────────────────
// Estas 17 linhas eram STRINGS FIXAS EM INGLÊS. A página inteira já trocava de idioma; só o
// telefone — a peça mais olhada do herói — continuava dizendo "Booked", "Sale logged", "Quote
// sent" para um visitante lendo português. É a mesma classe do bug da voz que falava metade em
// inglês numa ligação brasileira: não quebra nada, não dá erro, e denuncia na hora que quem está
// do outro lado é uma máquina montada para outro público.
// Nomes próprios ficam (Maria, João, Carlos); o que localiza é HORA, MOEDA e verbo — que é
// exatamente onde a tradução automática costuma errar e onde o olho do dono bate primeiro.
const POOL = [
  { icon: "📅", label: { en: "Booked", pt: "Agendado", es: "Agendado", hi: "बुक हुआ" }, detail: { en: "Maria · Sat 3:00 PM", pt: "Maria · sáb 15:00", es: "María · sáb 15:00", hi: "मारिया · शनि 3:00 PM" } },
  { icon: "💳", label: { en: "Sale logged", pt: "Venda registrada", es: "Venta registrada", hi: "बिक्री दर्ज" }, detail: { en: "$85 · card on file", pt: "US$ 85 · cartão salvo", es: "$85 · tarjeta guardada", hi: "$85 · कार्ड सेव" } },
  { icon: "🧾", label: { en: "Quote sent", pt: "Orçamento enviado", es: "Cotización enviada", hi: "कोटेशन भेजा" }, detail: { en: "Kitchen remodel · $4,200", pt: "Reforma de cozinha · US$ 4.200", es: "Reforma de cocina · $4,200", hi: "किचन रीमॉडल · $4,200" } },
  { icon: "⭐", label: { en: "Review requested", pt: "Avaliação pedida", es: "Reseña solicitada", hi: "समीक्षा माँगी" }, detail: { en: "Carlos · 5-star link", pt: "Carlos · link 5 estrelas", es: "Carlos · enlace 5 estrellas", hi: "कार्लोस · 5-स्टार लिंक" } },
  { icon: "🎯", label: { en: "Lead captured", pt: "Lead capturado", es: "Lead capturado", hi: "लीड कैप्चर" }, detail: { en: "New patient · insurance ✓", pt: "Paciente novo · convênio ✓", es: "Paciente nuevo · seguro ✓", hi: "नया मरीज़ · बीमा ✓" } },
  { icon: "↩️", label: { en: "Follow-up sent", pt: "Retorno enviado", es: "Seguimiento enviado", hi: "फ़ॉलो-अप भेजा" }, detail: { en: "No-show → rebooked", pt: "Faltou → remarcado", es: "Faltó → reagendado", hi: "नो-शो → फिर बुक" } },
  { icon: "💬", label: { en: "Replied on WhatsApp", pt: "Respondeu no WhatsApp", es: "Respondió en WhatsApp", hi: "WhatsApp पर जवाब" }, detail: { en: "Spanish · instant", pt: "Espanhol · na hora", es: "Español · al instante", hi: "स्पेनिश · तुरंत" } },
  { icon: "🛒", label: { en: "Order placed", pt: "Pedido feito", es: "Pedido hecho", hi: "ऑर्डर हुआ" }, detail: { en: "2× Large · pickup 7:15", pt: "2× grande · retirada 19:15", es: "2× grande · recoger 19:15", hi: "2× लार्ज · पिकअप 7:15" } },
  { icon: "🔗", label: { en: "Payment link · paid", pt: "Link de pagamento · pago", es: "Enlace de pago · pagado", hi: "पेमेंट लिंक · भुगतान" }, detail: { en: "$120 · cleared", pt: "US$ 120 · compensado", es: "$120 · acreditado", hi: "$120 · क्लियर" } },
  { icon: "📞", label: { en: "Callback set", pt: "Retorno agendado", es: "Devolución agendada", hi: "कॉलबैक तय" }, detail: { en: "Tomorrow 10:00 AM", pt: "Amanhã às 10:00", es: "Mañana 10:00", hi: "कल 10:00 AM" } },
  { icon: "🔁", label: { en: "Rescheduled", pt: "Remarcado", es: "Reagendado", hi: "फिर से तय" }, detail: { en: "João · Fri 2:00 PM", pt: "João · sex 14:00", es: "João · vie 14:00", hi: "जोआओ · शुक्र 2:00 PM" } },
  { icon: "📋", label: { en: "Intake completed", pt: "Cadastro concluído", es: "Registro completado", hi: "इनटेक पूरा" }, detail: { en: "New client form", pt: "Ficha de cliente novo", es: "Ficha de cliente nuevo", hi: "नए क्लाइंट का फ़ॉर्म" } },
  { icon: "📣", label: { en: "Ad campaign live", pt: "Campanha no ar", es: "Campaña en marcha", hi: "कैंपेन लाइव" }, detail: { en: "Google · 14 clicks today", pt: "Google · 14 cliques hoje", es: "Google · 14 clics hoy", hi: "Google · आज 14 क्लिक" } },
  { icon: "⚡", label: { en: "Ad lead → called", pt: "Lead do anúncio → ligou", es: "Lead del anuncio → llamó", hi: "विज्ञापन लीड → कॉल" }, detail: { en: "54 seconds after the click", pt: "54 segundos após o clique", es: "54 segundos tras el clic", hi: "क्लिक के 54 सेकंड बाद" } },
  { icon: "🎬", label: { en: "Post published", pt: "Post publicado", es: "Post publicado", hi: "पोस्ट प्रकाशित" }, detail: { en: "4 this week · your voice", pt: "4 esta semana · sua voz", es: "4 esta semana · tu voz", hi: "इस हफ़्ते 4 · आपकी आवाज़" } },
  { icon: "🖥️", label: { en: "Website shipped", pt: "Site entregue", es: "Web entregada", hi: "वेबसाइट डिलीवर" }, detail: { en: "Gui lives inside it", pt: "com a Gui morando dentro", es: "con Gui viviendo dentro", hi: "गुई उसी में रहती है" } },
  { icon: "📱", label: { en: "App on the stores", pt: "App nas lojas", es: "App en las tiendas", hi: "ऐप स्टोर पर" }, detail: { en: "iOS + Android · live", pt: "iOS + Android · no ar", es: "iOS + Android · en vivo", hi: "iOS + Android · लाइव" } },
];

// Every kind of work Gui does — inbound & outbound, confirmations, sales, support, tracking…
const SCENARIOS = [
  { biz: "Tony's Pizza", dir: "in", type: "Order", line: "“Two larges, extra cheese — pickup at 7:15. Want drinks with that?”" },
  { biz: "Bright Smiles Dental", dir: "out", type: "Confirmation", line: "“Hi! Confirming your cleaning tomorrow at 9 AM — reply 1 to keep, 2 to move.”" },
  { biz: "Glow Spa", dir: "in", type: "Booking", line: "“Friday at 4 works — I sent your deposit link. You're all set ✨”" },
  { biz: "Vértice Imóveis", dir: "in", type: "Lead qualify", line: "“3-bed downtown under R$2k? I'll text you 4 matches tonight.”" },
  { biz: "Apex Plumbing", dir: "out", type: "Sales", line: "“Your water heater's due for service — I've got Thursday 10 AM. Book it?”" },
  { biz: "Luna Café", dir: "in", type: "Support", line: "“I see the charge — refunding $20 now. You'll get a text confirmation.”" },
  { biz: "FitZone Gym", dir: "out", type: "Win-back", line: "“We miss you! 1 month free if you're back this week — want me to set it up?”" },
  { biz: "QuickShip Store", dir: "in", type: "Tracking", line: "“Your order's 6 minutes away — driver is Marco. I'll text live updates 🚗”" },
  { biz: "Sterling Law", dir: "in", type: "Intake", line: "“Got your case details — a paralegal will call you within the hour.”" },
  { biz: "Drive Auto", dir: "in", type: "Quote", line: "“Brake job is $280 out the door — I can fit you in tomorrow at 8. Sound good?”" },
  { biz: "Bella Hair", dir: "out", type: "Reminder", line: "“Reminder: your color appointment is in 1 hour. See you soon!”" },
  { biz: "Pulse Clinic", dir: "out", type: "Follow-up", line: "“Checking in after your visit — feeling better? I can rebook if you need.”" },
];

// floating stat cards — short, high-visibility copy → localized per visitor language ({en,pt,es,hi})
const FLOAT_L = [
  { icon: "🌙", a: { en: "Captured at 2:14 AM", pt: "Capturado às 2h14", es: "Capturado a las 2:14 AM", hi: "रात 2:14 पर कैप्चर" }, b: { en: "while you slept", pt: "enquanto você dormia", es: "mientras dormías", hi: "जब आप सो रहे थे" } },
  { icon: "🌐", a: { en: "Replied in Español", pt: "Respondeu em Español", es: "Respondió en Español", hi: "Español में जवाब दिया" }, b: { en: "in 2 seconds", pt: "em 2 segundos", es: "en 2 segundos", hi: "2 सेकंड में" } },
  { icon: "📞", a: { en: "17 calls answered", pt: "17 ligações atendidas", es: "17 llamadas contestadas", hi: "17 कॉल के जवाब" }, b: { en: "0 missed today", pt: "0 perdidas hoje", es: "0 perdidas hoy", hi: "आज 0 छूटीं" } },
  { icon: "⚡", a: { en: "Quote sent", pt: "Orçamento enviado", es: "Cotización enviada", hi: "कोटेशन भेजा" }, b: { en: "in 11 seconds", pt: "em 11 segundos", es: "en 11 segundos", hi: "11 सेकंड में" } },
  { icon: "🗓️", a: { en: "Booked solid", pt: "Agenda lotada", es: "Agenda llena", hi: "बुकिंग फुल" }, b: { en: "next 3 days", pt: "próximos 3 dias", es: "próximos 3 días", hi: "अगले 3 दिन" } },
];
const FLOAT_R = [
  { icon: "📈", a: { en: "+37% bookings", pt: "+37% agendamentos", es: "+37% reservas", hi: "+37% बुकिंग" }, b: { en: "this month, on autopilot", pt: "este mês, no automático", es: "este mes, en automático", hi: "इस महीने, ऑटोपायलट पर" } },
  { icon: "💰", a: { en: "$1,840 collected", pt: "$1.840 recebidos", es: "$1,840 cobrados", hi: "$1,840 वसूले" }, b: { en: "today · hands-off", pt: "hoje · sem esforço", es: "hoy · sin esfuerzo", hi: "आज · बिना मेहनत" } },
  { icon: "🎯", a: { en: "28 leads captured", pt: "28 leads capturados", es: "28 leads capturados", hi: "28 लीड कैप्चर" }, b: { en: "this week", pt: "esta semana", es: "esta semana", hi: "इस हफ़्ते" } },
  { icon: "⏱️", a: { en: "9 hours saved", pt: "9 horas economizadas", es: "9 horas ahorradas", hi: "9 घंटे बचाए" }, b: { en: "every week", pt: "toda semana", es: "cada semana", hi: "हर हफ़्ते" } },
  { icon: "🧾", a: { en: "$4,200 quoted", pt: "$4.200 orçados", es: "$4,200 cotizados", hi: "$4,200 के कोट" }, b: { en: "today", pt: "hoje", es: "hoy", hi: "आज" } },
  { icon: "⭐", a: { en: "23 reviews", pt: "23 avaliações", es: "23 reseñas", hi: "23 समीक्षाएँ" }, b: { en: "5-star links sent", pt: "links 5 estrelas enviados", es: "enlaces 5 estrellas enviados", hi: "5-स्टार लिंक भेजे" } },
];

function Waveform() {
  const bars = Array.from({ length: 26 });
  return (
    <div className="flex items-end gap-[3px] h-10">
      {bars.map((_, i) => (
        <span key={i} className="w-[3px] rounded-full bg-gradient-to-t from-g-green to-g-gold origin-bottom"
          style={{ height: `${28 + ((i * 41) % 64)}%`, animation: `gwave 1.4s ease-in-out ${(i % 8) * 0.1}s infinite` }} />
      ))}
    </div>
  );
}

const txt = (v, lang) => (typeof v === "string" ? v : (v && (v[lang] || v.en)) || "");

function FeedRow({ a, lang }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.05] px-3 py-2.5 ring-1 ring-white/10">
      <span className="text-base">{a.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold text-white">{txt(a.label, lang)}</div>
        <div className="truncate text-[11px] text-white/70">{txt(a.detail, lang)}</div>
      </div>
      <span className="text-[11px] text-g-green">✓</span>
    </div>
  );
}

function Phone() {
  const { lang } = useLang();
  const loc = (v) => v[lang] ?? v.en; // {en,pt,es,hi} → visitor language
  const [secs, setSecs] = useState(134);
  const [biz, setBiz] = useState(0);
  const [stat, setStat] = useState(0);

  useEffect(() => {
    const a = setInterval(() => setSecs((s) => s + 1), 1000);
    const b = setInterval(() => setBiz((s) => s + 1), 4200); // gentle header rotation
    const c = setInterval(() => setStat((s) => s + 1), 3200); // floating cards rotation
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); };
  }, []);

  const B = SCENARIOS[biz % SCENARIOS.length];
  const dirLabel = B.dir === "in" ? "Inbound" : "Outbound";
  const dirIcon = B.dir === "in" ? "↘" : "↗";
  const L = FLOAT_L[stat % FLOAT_L.length];
  const R = FLOAT_R[(stat + 2) % FLOAT_R.length];
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="relative mx-auto w-[360px] max-w-full">
      <div className="pointer-events-none absolute -inset-12 bg-[radial-gradient(closest-side,rgba(62,148,104,0.22),transparent)] blur-2xl" />
      {/* Gui's warm signature glow hugging the live device */}
      <div className="pointer-events-none absolute -inset-10 bg-[radial-gradient(closest-side,rgba(255,138,51,0.16),transparent)] blur-2xl" style={{ animation: "gembers 6s ease-in-out infinite" }} />

      {/* A MARCA no lugar do aparelho. Saíram as três coisas que faziam disto um telefone —
          a moldura de alumínio, o entalhe e a barra "9:41 ▮▮▮ 100%" — e ficou TUDO o que ele
          fazia: a ligação ao vivo, a fala da Gui, o mural do que ela está resolvendo e os
          cartões flutuantes. Mesma função, outra identidade.
          POR QUÊ: um telefone desenhado diz "isto é um aplicativo", e a Guileo não vende
          aplicativo — vende resultado que se acumula. A marca diz isso sozinha: folhas em
          cima, raízes de CIRCUITO embaixo. E é a única imagem deste mercado que ninguém
          copia sem virar cópia declarada. */}
      <div className="relative rounded-[2.4rem] border border-white/[0.07] bg-[#0b0b0b]/80 shadow-[0_60px_150px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <div className="relative overflow-hidden rounded-[2.4rem]">

          {/* a logo real, grande, respirando — o objeto central da dobra */}
          <div className="flex justify-center pt-7 pb-1">
            <img src={mark} alt="Guileo" width="1200" height="1200"
                 className="h-[132px] w-[132px] object-contain drop-shadow-[0_18px_38px_rgba(0,0,0,0.5)]"
                 style={{ animation: "gplant 8s ease-in-out infinite" }} />
          </div>

          <div className="px-6 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-g-green">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" />
                </span>
                On a call · {mm}:{ss}
              </div>
              <span key={"t" + biz} className="rounded-full bg-white/[0.06] px-2 py-[2px] text-[9px] font-bold uppercase tracking-wider text-white/70 ring-1 ring-white/10" style={{ animation: "gsoft .8s ease-in-out both" }}>
                {dirIcon} {dirLabel} · {B.type}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              {/* O avatar redondo saiu: a logo GRANDE já está acima, e repetir a mesma marca
                  a 14px logo abaixo dela só rouba atenção dela mesma. Fica o microfone —
                  ele não é enfeite, é a informação de que isto é VOZ ao vivo, não chat. */}
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-g-green/25 to-g-gold/15 text-g-green ring-1 ring-g-green/40">
                <span className="absolute inset-0 rounded-full ring-2 ring-g-green/35" style={{ animation: "gpulse 2s ease-out infinite" }} />
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </span>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-[16px] font-bold text-white">Gui</span>
                  <span className="rounded-full px-1.5 py-[1px] text-[8px] font-black uppercase tracking-wider" style={{ color: "#FF8A33", border: "1px solid rgba(255,138,51,0.45)", background: "rgba(255,138,51,0.12)" }}>AI Voice</span>
                </div>
                <div key={B.biz} className="text-[11px] text-white/55" style={{ animation: "gsoft .8s ease-in-out both" }}>answering for {B.biz}</div>
              </div>
            </div>
          </div>

          <div className="mx-6 mt-4 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10">
            <Waveform />
            <p key={B.line} className="mt-2.5 min-h-[34px] text-[12.5px] leading-snug text-white/80" style={{ animation: "gsoft .8s ease-in-out both" }}>{B.line}</p>
          </div>

          {/* SMOOTH continuous feed — glides up forever, soft fade at edges */}
          <div className="px-6 pb-5 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Gui is handling it · live</span>
              <span className="text-[9px] text-g-green">● real-time</span>
            </div>
            <div className="relative h-[232px] overflow-hidden" style={{ maskImage: "linear-gradient(to bottom,transparent,#000 14%,#000 86%,transparent)", WebkitMaskImage: "linear-gradient(to bottom,transparent,#000 14%,#000 86%,transparent)" }}>
              <div className="space-y-2" style={{ animation: "gscroll 30s linear infinite" }}>
                {[...POOL, ...POOL].map((a, i) => <FeedRow key={i} a={a} lang={lang} />)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* floating proof cards — rotate (services + profit + numbers), soft crossfade + float
          ENQUADRAMENTO: a posição negativa move a ORIGEM, não empurra pra fora — quem decide
          se o cartão sai do card é a LARGURA. Em -left-20 (−80px) com 170px de largura, a borda
          direita caía em +90px e o cartão cobria "ON A CALL · 10:34". Agora: 156px de largura em
          -left-[136px] → sobra só 20px de encaixe na quina arredondada, que é proposital (dá a
          sensação de camada), e o cabeçalho fica livre. As alturas também mudaram para os VÃOS:
          o da esquerda ao lado da onda sonora, o da direita no meio do mural. */}
      <div className="absolute -left-[136px] top-[208px] hidden w-[156px] rounded-2xl border border-white/10 bg-[#14130F]/90 px-3 py-2 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] backdrop-blur-xl lg:block" style={{ animation: "gfloat 6s ease-in-out infinite" }}>
        <div key={"l" + stat} style={{ animation: "gswap .45s ease-out both" }}>
          <div className="text-[11px] font-bold text-g-word">{L.icon} {loc(L.a)}</div>
          <div className="text-[10px] text-g-ink">{loc(L.b)}</div>
        </div>
      </div>
      <div className="absolute -right-[136px] bottom-[168px] hidden w-[156px] rounded-2xl border border-white/10 bg-[#14130F]/90 px-3 py-2 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] backdrop-blur-xl lg:block" style={{ animation: "gfloat 7s ease-in-out 1s infinite" }}>
        <div key={"r" + stat} style={{ animation: "gswap .45s ease-out both" }}>
          <div className="text-[11px] font-bold text-g-word">{R.icon} {loc(R.a)}</div>
          <div className="text-[10px] text-g-ink">{loc(R.b)}</div>
        </div>
      </div>
    </div>
  );
}

export default function HeroV2() {
  const { t, lang } = useLang();
  const H = t.hero || {};
  const C = HERO_COPY[lang] || HERO_COPY.en;
  return (
    <section className="relative overflow-hidden px-5 pt-10 pb-20 sm:pt-16">
      <style>{`
        @keyframes gwave{0%,100%{transform:scaleY(0.42)}50%{transform:scaleY(1)}}
        @keyframes gscroll{from{transform:translateY(0)}to{transform:translateY(-50%)}}
        @keyframes gsoft{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        /* faster, translate-free crossfade for the floating proof cards so the pill never reads empty mid-swap */
        @keyframes gswap{from{opacity:.15}to{opacity:1}}
        @keyframes gfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        @keyframes gplant{0%,100%{transform:translateY(0) rotate(-.8deg)}50%{transform:translateY(-7px) rotate(.8deg)}}
        @keyframes gpulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.45);opacity:0}}
        @keyframes greveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gshine{to{background-position:220% center}}
        @keyframes gembers{0%,100%{opacity:.55}50%{opacity:.95}}
        @media (prefers-reduced-motion: reduce){
          *{animation-duration:0.001ms !important;animation-iteration-count:1 !important}
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_500px_at_70%_-10%,rgba(62,148,104,0.10),transparent),radial-gradient(800px_400px_at_10%_20%,rgba(214,194,154,0.06),transparent)]" />
      {/* Gui signature ember — the AI's warm orange presence breathing behind the scene (Faena drama) */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(620px_420px_at_62%_42%,rgba(255,138,51,0.09),transparent)]" style={{ animation: "gembers 7s ease-in-out infinite" }} />

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-g-gold">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#FF8A33", boxShadow: "0 0 10px 1px rgba(255,138,51,0.85)" }} /> {C.eyebrow}
          </div>

          <h1 className="mt-5 font-black leading-[0.92] tracking-tight" style={{ fontSize: "clamp(2.3rem,8.5vw,4.5rem)" }}>
            <span className="block text-g-word" style={{ animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{H.h1a || "Work Smart."}</span>
            <span className="block bg-gradient-to-r from-g-green via-g-light to-g-green bg-clip-text pl-[0.12em] text-transparent" style={{ backgroundSize: "220% auto", animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .2s both, gshine 7s linear infinite" }}>{H.h1b || "Grow Faster."}</span>
            <span className="block bg-gradient-to-r from-g-gold via-g-copper to-g-gold bg-clip-text pl-[0.24em] text-transparent" style={{ backgroundSize: "220% auto", animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .35s both, gshine 7s linear .6s infinite" }}>{H.h1c || "Sleep Better."}</span>
          </h1>

          <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-g-ink">
            <span className="font-bold text-g-word">{C.sub[0]}</span> Gui{C.sub[1]}<span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text font-bold text-transparent">{C.sub[2]}</span>{C.sub[3]}
          </p>

          <div className="mt-6 flex items-center gap-2 text-[13px] font-black uppercase tracking-wider">
            <span className="text-g-green">{C.method[0]}</span>
            <span className="text-g-muted">→</span>
            <span className="text-g-gold">{C.method[1]}</span>
            <span className="text-g-muted">→</span>
            <span className="text-g-copper">{C.method[2]}</span>
          </div>

          {/* Faena moment — restrained & editorial: a thin champagne hairline + a quiet orange accent.
              Luxury is refinement, not size. */}
          <div className="mt-8 flex items-center gap-3.5">
            <span className="h-9 w-px shrink-0" style={{ background: "linear-gradient(180deg,transparent,rgba(214,194,154,0.6),transparent)" }} />
            <span className="font-semibold leading-none tracking-tight shrink-0" style={{ fontSize: "clamp(1.3rem,2.3vw,1.65rem)", color: "#FF8A33", textShadow: "0 0 16px rgba(255,138,51,0.3)" }}>24/7</span>
            <span className="max-w-[18rem] text-[12.5px] leading-snug text-g-muted">
              {lang === "pt" ? "A Gui nunca dorme, nunca falta, nunca perde uma venda." : lang === "es" ? "Gui nunca duerme, nunca falta, nunca pierde una venta." : lang === "hi" ? "Gui कभी नहीं सोती, कभी नहीं चूकती, कोई बिक्री नहीं खोती।" : "Gui never sleeps, never calls in sick, never misses a sale."}
            </span>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#try" className="group inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-bold text-g-word ring-1 transition" style={{ background: "linear-gradient(180deg,#3a3a3a,#181818)", "--tw-ring-color": "rgba(255,138,51,0.32)", boxShadow: "0 14px 40px -14px rgba(0,0,0,0.8), 0 0 26px -6px rgba(255,138,51,0.30)" }}>
              <span className="grid h-6 w-6 place-items-center rounded-full text-xs" style={{ background: "linear-gradient(135deg,rgba(255,138,51,0.55),rgba(214,194,154,0.35))" }}>🌱</span>
              {C.cta}
              <span style={{ color: "#FF8A33" }}>· 24/7</span>
            </a>
            <span className="text-[12px] text-g-muted">{C.sub2}</span>
          </div>
        </div>

        <div className="relative min-w-0">
          <Phone />
          {/* Honesty caption — the live panel + floating stat cards are a DEMO of what Gui does, not
              client-sourced results; keeps the claims clean (FTC-safe) without killing the vibe. */}
          <p className="mt-3 text-center text-[10.5px] text-g-muted/60">
            {lang === "pt" ? "Demonstração ilustrativa do que a Gui faz no dia a dia."
              : lang === "es" ? "Demostración ilustrativa de lo que Gui hace en el día a día."
              : lang === "hi" ? "Gui रोज़ क्या करती है इसका उदाहरण।"
              : "Illustrative demo of what Gui does day-to-day."}
          </p>
        </div>
      </div>
    </section>
  );
}
