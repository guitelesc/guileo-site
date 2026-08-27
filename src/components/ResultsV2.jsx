import { useState, useEffect } from "react";
import { useLang } from "../i18n.jsx";

const RV_COPY = {
  en: { eyebrow:"We know your business · results, not tools", h1a:"You don't buy AI.", h1b:"You buy results.", intro:["A patient calls at 9 PM. A client needs a quote on Sunday. A diner wants a table now. ","Pick your business"," — see what it's ","leaking"," and what Gui turns it into."], chips:"Everything you can't keep up with — ", chipsB:"Gui handles it", without:"Without Gui, every month", walks:"walks out — ", catches:"Gui catches it", withg:"With Gui", disc:"Illustrative averages — results depend on your business.", footer:["💡 ","Priced to the problem we solve"," — never the tech under the hood."] },
  pt: { eyebrow:"Conhecemos seu negócio · resultado, não ferramenta", h1a:"Você não compra IA.", h1b:"Você compra resultado.", intro:["Um paciente liga às 21h. Um cliente quer orçamento no domingo. Alguém quer mesa agora. ","Escolha seu negócio"," — veja o que está ","vazando"," e no que a Gui transforma."], chips:"Tudo o que você não dá conta — ", chipsB:"a Gui resolve", without:"Sem a Gui, todo mês", walks:"vai embora — ", catches:"A Gui pega", withg:"Com a Gui", disc:"Médias ilustrativas — resultados variam conforme seu negócio.", footer:["💡 ","Preço pelo problema que resolvemos"," — nunca pela tecnologia por trás."] },
  es: { eyebrow:"Conocemos tu negocio · resultados, no herramientas", h1a:"No compras IA.", h1b:"Compras resultados.", intro:["Un paciente llama a las 21h. Un cliente quiere cotización el domingo. Alguien quiere mesa ahora. ","Elige tu negocio"," — mira lo que está ","perdiendo"," y en qué lo convierte Gui."], chips:"Todo lo que no alcanzas a atender — ", chipsB:"Gui lo resuelve", without:"Sin Gui, cada mes", walks:"se va — ", catches:"Gui lo atrapa", withg:"Con Gui", disc:"Promedios ilustrativos — los resultados dependen de tu negocio.", footer:["💡 ","Precio por el problema que resolvemos"," — nunca por la tecnología detrás."] },
  hi: { eyebrow:"हम आपका व्यवसाय जानते हैं · परिणाम, टूल नहीं", h1a:"आप AI नहीं खरीदते।", h1b:"आप परिणाम खरीदते हैं।", intro:["रात 9 बजे मरीज़ कॉल करता है। रविवार को ग्राहक कोटेशन चाहता है। कोई अभी टेबल चाहता है। ","अपना व्यवसाय चुनें"," — देखें क्या ","रिस रहा है"," और Gui उसे किसमें बदलती है।"], chips:"जो कुछ आप संभाल नहीं पाते — ", chipsB:"Gui संभालती है", without:"Gui के बिना, हर महीने", walks:"चला जाता है — ", catches:"Gui उसे पकड़ती है", withg:"Gui के साथ", disc:"उदाहरणात्मक औसत — परिणाम आपके व्यवसाय पर निर्भर करते हैं।", footer:["💡 ","हम जो समस्या हल करते हैं उसकी कीमत"," — कभी पीछे की तकनीक की नहीं।"] },
};

// ResultsV2 — TEST (/v2): "You don't buy AI / You buy results" merged with all 9 industries.
// Industries scroll as a marquee (real-site movement) + are clickable (pause on hover).
// Per business: what Gui DOES (action chips incl. bookings, call-backs…) + money leaking +
// the result. Guileo design system + smooth CSS motion.

// Copy fields are {en,pt,es,hi} — resolved per visitor language (EN fallback).
const BIZ = [
  { icon: "⚖️", loseN: 8200,
    name: { en: "Law Firms", pt: "Advocacia", es: "Despachos jurídicos", hi: "लॉ फ़र्म" },
    why: { en: "missed intake calls & slow follow-up", pt: "ligações de captação perdidas e follow-up lento", es: "llamadas de captación perdidas y seguimiento lento", hi: "छूटी इनटेक कॉल और धीमा फ़ॉलो-अप" },
    does: { en: "Intakes cases, books consults, never misses a lead.", pt: "Faz a triagem de casos, agenda consultas e não perde nenhum lead.", es: "Recibe casos, agenda consultas y no pierde ningún lead.", hi: "केस इनटेक करती है, परामर्श बुक करती है, कोई लीड नहीं छूटती।" },
    result: { en: "Every caller captured & qualified — day or night.", pt: "Cada ligação capturada e qualificada — dia e noite.", es: "Cada llamada capturada y calificada — de día o de noche.", hi: "हर कॉलर कैप्चर और क्वालिफाई — दिन हो या रात।" },
    gain: { en: "+ qualified cases", pt: "+ casos qualificados", es: "+ casos calificados", hi: "+ क्वालिफाइड केस" },
    acts: { en: ["📅 Consults booked", "📞 Calls leads back", "📋 Case intake", "⏰ 24/7"], pt: ["📅 Consultas agendadas", "📞 Retorna pro lead", "📋 Triagem de casos", "⏰ 24/7"], es: ["📅 Consultas agendadas", "📞 Devuelve la llamada", "📋 Admisión de casos", "⏰ 24/7"], hi: ["📅 परामर्श बुक", "📞 लीड को कॉल-बैक", "📋 केस इनटेक", "⏰ 24/7"] } },
  { icon: "🏥", loseN: 5400,
    name: { en: "Medical Clinics", pt: "Clínicas Médicas", es: "Clínicas Médicas", hi: "मेडिकल क्लिनिक" },
    why: { en: "no-shows & unanswered calls", pt: "faltas e ligações sem resposta", es: "ausencias y llamadas sin contestar", hi: "नो-शो और अनुत्तरित कॉल" },
    does: { en: "Answers 24/7, books patients, sends reminders.", pt: "Atende 24/7, agenda pacientes e envia lembretes.", es: "Contesta 24/7, agenda pacientes y envía recordatorios.", hi: "24/7 जवाब देती है, मरीज़ बुक करती है, रिमाइंडर भेजती है।" },
    result: { en: "Full schedule — fewer no-shows.", pt: "Agenda cheia — menos faltas.", es: "Agenda llena — menos ausencias.", hi: "भरा शेड्यूल — कम नो-शो।" },
    gain: { en: "− no-shows", pt: "− faltas", es: "− ausencias", hi: "− नो-शो" },
    acts: { en: ["📅 Bookings", "🔔 Reminders", "📞 Calls back", "🌐 Any language"], pt: ["📅 Agendamentos", "🔔 Lembretes", "📞 Retorna ligações", "🌐 Qualquer idioma"], es: ["📅 Reservas", "🔔 Recordatorios", "📞 Devuelve llamadas", "🌐 Cualquier idioma"], hi: ["📅 बुकिंग", "🔔 रिमाइंडर", "📞 कॉल-बैक", "🌐 कोई भी भाषा"] } },
  { icon: "🦷", loseN: 4800,
    name: { en: "Dental Clinics", pt: "Odontologia", es: "Clínicas Dentales", hi: "डेंटल क्लिनिक" },
    why: { en: "empty chairs & missed bookings", pt: "cadeira vazia e agendamentos perdidos", es: "sillones vacíos y reservas perdidas", hi: "खाली चेयर और छूटी बुकिंग" },
    does: { en: "Books cleanings & follows up on treatment.", pt: "Agenda limpezas e acompanha o tratamento.", es: "Agenda limpiezas y da seguimiento al tratamiento.", hi: "क्लीनिंग बुक करती है और ट्रीटमेंट का फ़ॉलो-अप करती है।" },
    result: { en: "The chair stays full.", pt: "A cadeira não fica vazia.", es: "El sillón se mantiene lleno.", hi: "चेयर कभी खाली नहीं रहती।" },
    gain: { en: "+ chair time", pt: "+ cadeira ocupada", es: "+ sillón ocupado", hi: "+ चेयर टाइम" },
    acts: { en: ["📅 Cleanings booked", "🔁 Recalls", "📞 Calls back", "💳 Deposits"], pt: ["📅 Limpezas agendadas", "🔁 Retornos", "📞 Retorna ligações", "💳 Sinal"], es: ["📅 Limpiezas agendadas", "🔁 Recitas", "📞 Devuelve llamadas", "💳 Depósitos"], hi: ["📅 क्लीनिंग बुक", "🔁 रीकॉल", "📞 कॉल-बैक", "💳 डिपॉज़िट"] } },
  { icon: "🔧", loseN: 7600,
    name: { en: "Plumbing & HVAC", pt: "Encanador e HVAC", es: "Fontanería & HVAC", hi: "प्लंबिंग & HVAC" },
    why: { en: "emergency calls hitting voicemail", pt: "emergências caindo na caixa postal", es: "llamadas de emergencia que van al buzón", hi: "इमरजेंसी कॉल वॉइसमेल में जातीं" },
    does: { en: "Catches emergency calls, quotes & dispatches.", pt: "Pega a emergência na hora, orça e despacha a equipe.", es: "Atiende la emergencia, cotiza y despacha.", hi: "इमरजेंसी कॉल पकड़ती है, कोट देती है और टीम भेजती है।" },
    result: { en: "You win the job before the competitor calls back.", pt: "Você fecha o serviço antes do concorrente retornar.", es: "Ganas el trabajo antes de que el competidor devuelva la llamada.", hi: "प्रतिस्पर्धी के कॉल-बैक से पहले काम आपका।" },
    gain: { en: "+ booked jobs", pt: "+ serviços fechados", es: "+ trabajos agendados", hi: "+ बुक्ड जॉब" },
    acts: { en: ["🚨 Emergency triage", "🧾 Quotes", "📅 Dispatch", "📞 Calls back"], pt: ["🚨 Triagem de emergência", "🧾 Orçamentos", "📅 Despacho", "📞 Retorna ligações"], es: ["🚨 Triaje de emergencias", "🧾 Cotizaciones", "📅 Despacho", "📞 Devuelve llamadas"], hi: ["🚨 इमरजेंसी ट्रायेज", "🧾 कोटेशन", "📅 डिस्पैच", "📞 कॉल-बैक"] } },
  { icon: "🛒", loseN: 6100,
    name: { en: "E-Commerce", pt: "E-Commerce", es: "E-Commerce", hi: "ई-कॉमर्स" },
    why: { en: "support & cart questions ignored", pt: "suporte e dúvidas de carrinho sem resposta", es: "soporte y dudas de carrito ignoradas", hi: "सपोर्ट और कार्ट के सवाल अनदेखे" },
    does: { en: "Answers support, recovers carts, wins back buyers.", pt: "Responde o suporte, recupera carrinhos e traz o cliente de volta.", es: "Responde soporte, recupera carritos y recupera compradores.", hi: "सपोर्ट का जवाब देती है, कार्ट रिकवर करती है, ग्राहक वापस लाती है।" },
    result: { en: "Instant replies. Carts recovered.", pt: "Resposta na hora. Carrinhos recuperados.", es: "Respuestas al instante. Carritos recuperados.", hi: "तुरंत जवाब। कार्ट रिकवर।" },
    gain: { en: "+30% LTV", pt: "+30% LTV", es: "+30% LTV", hi: "+30% LTV" },
    acts: { en: ["🎧 Support", "🛒 Cart recovery", "🔄 Win-back", "📦 Order tracking"], pt: ["🎧 Suporte", "🛒 Recupera carrinho", "🔄 Reativação", "📦 Rastreio de pedido"], es: ["🎧 Soporte", "🛒 Recupera carritos", "🔄 Reactivación", "📦 Rastreo de pedidos"], hi: ["🎧 सपोर्ट", "🛒 कार्ट रिकवरी", "🔄 विन-बैक", "📦 ऑर्डर ट्रैकिंग"] } },
  { icon: "🍽️", loseN: 3500,
    name: { en: "Restaurants", pt: "Restaurantes", es: "Restaurantes", hi: "रेस्टोरेंट" },
    why: { en: "abandoned orders on a busy line", pt: "pedidos abandonados na linha ocupada", es: "pedidos abandonados en una línea ocupada", hi: "व्यस्त लाइन पर छूटे ऑर्डर" },
    does: { en: "Takes orders & reservations, upsells, tracks delivery.", pt: "Anota pedidos e reservas, faz upsell e acompanha a entrega.", es: "Toma pedidos y reservas, hace upsell y rastrea la entrega.", hi: "ऑर्डर और रिज़र्वेशन लेती है, अपसेल करती है, डिलीवरी ट्रैक करती है।" },
    result: { en: "Orders taken, upsold & delivered.", pt: "Pedido anotado, com upsell e entregue.", es: "Pedidos tomados, con upsell y entregados.", hi: "ऑर्डर लिया, अपसेल किया, डिलीवर हुआ।" },
    gain: { en: "+22% orders", pt: "+22% pedidos", es: "+22% pedidos", hi: "+22% ऑर्डर" },
    acts: { en: ["🍽️ Reservations", "🛒 Orders", "➕ Upsells", "🚚 Delivery track"], pt: ["🍽️ Reservas", "🛒 Pedidos", "➕ Upsell", "🚚 Rastreio de entrega"], es: ["🍽️ Reservas", "🛒 Pedidos", "➕ Upsell", "🚚 Rastreo de entrega"], hi: ["🍽️ रिज़र्वेशन", "🛒 ऑर्डर", "➕ अपसेल", "🚚 डिलीवरी ट्रैक"] } },
  { icon: "🏠", loseN: 9200,
    name: { en: "Real Estate", pt: "Imobiliárias", es: "Inmobiliarias", hi: "रियल एस्टेट" },
    why: { en: "leads going cold in minutes", pt: "leads esfriando em minutos", es: "leads que se enfrían en minutos", hi: "मिनटों में ठंडे पड़ते लीड" },
    does: { en: "Calls leads back in seconds, qualifies, books showings.", pt: "Retorna pro lead em segundos, qualifica e agenda visitas.", es: "Devuelve la llamada en segundos, califica y agenda visitas.", hi: "सेकंडों में लीड को कॉल-बैक, क्वालिफाई और विज़िट बुक करती है।" },
    result: { en: "Every lead called back & qualified.", pt: "Todo lead recebe retorno e sai qualificado.", es: "Cada lead recibe llamada y queda calificado.", hi: "हर लीड को कॉल-बैक और क्वालिफिकेशन।" },
    gain: { en: "+5 deals / mo", pt: "+5 negócios/mês", es: "+5 cierres/mes", hi: "+5 डील/माह" },
    acts: { en: ["📞 Instant call-back", "🎯 Qualify", "📅 Showings", "🔁 Follow-up"], pt: ["📞 Retorno imediato", "🎯 Qualificação", "📅 Visitas", "🔁 Follow-up"], es: ["📞 Llamada inmediata", "🎯 Calificación", "📅 Visitas", "🔁 Seguimiento"], hi: ["📞 तुरंत कॉल-बैक", "🎯 क्वालिफाई", "📅 विज़िट", "🔁 फ़ॉलो-अप"] } },
  { icon: "💪", loseN: 4200,
    name: { en: "Gyms & Fitness", pt: "Academias", es: "Gimnasios", hi: "जिम & फ़िटनेस" },
    why: { en: "trial leads never followed up", pt: "leads de aula experimental sem follow-up", es: "leads de prueba sin seguimiento", hi: "ट्रायल लीड बिना फ़ॉलो-अप" },
    does: { en: "Signs up members, books tours, wins back lapsed.", pt: "Matricula alunos, agenda visitas e traz de volta quem sumiu.", es: "Inscribe miembros, agenda visitas y recupera a los inactivos.", hi: "मेंबर साइन-अप करती है, टूर बुक करती है, पुराने मेंबर वापस लाती है।" },
    result: { en: "More members, fewer cancellations.", pt: "Mais alunos, menos cancelamentos.", es: "Más miembros, menos cancelaciones.", hi: "ज़्यादा मेंबर, कम कैंसलेशन।" },
    gain: { en: "+ members", pt: "+ alunos", es: "+ miembros", hi: "+ मेंबर" },
    acts: { en: ["🏷️ Sign-ups", "🗓️ Tours", "🔄 Win-back", "📞 Calls back"], pt: ["🏷️ Matrículas", "🗓️ Visitas", "🔄 Reativação", "📞 Retorna ligações"], es: ["🏷️ Inscripciones", "🗓️ Visitas", "🔄 Reactivación", "📞 Devuelve llamadas"], hi: ["🏷️ साइन-अप", "🗓️ टूर", "🔄 विन-बैक", "📞 कॉल-बैक"] } },
  { icon: "🚗", loseN: 11000,
    name: { en: "Auto Dealerships", pt: "Concessionárias", es: "Concesionarias", hi: "ऑटो डीलरशिप" },
    why: { en: "buyers waiting & quotes not chased", pt: "compradores esperando e orçamentos sem follow-up", es: "compradores esperando y cotizaciones sin seguimiento", hi: "इंतज़ार करते खरीदार और बिना पीछा किए कोटेशन" },
    does: { en: "Books test drives, qualifies buyers, follows up.", pt: "Agenda test drives, qualifica compradores e faz follow-up.", es: "Agenda pruebas de manejo, califica compradores y da seguimiento.", hi: "टेस्ट ड्राइव बुक करती है, खरीदार क्वालिफाई करती है, फ़ॉलो-अप करती है।" },
    result: { en: "More test drives, faster closes.", pt: "Mais test drives, fechamentos mais rápidos.", es: "Más pruebas de manejo, cierres más rápidos.", hi: "ज़्यादा टेस्ट ड्राइव, तेज़ क्लोज़िंग।" },
    gain: { en: "+ test drives", pt: "+ test drives", es: "+ pruebas de manejo", hi: "+ टेस्ट ड्राइव" },
    acts: { en: ["🚗 Test drives", "🎯 Qualify", "🧾 Quotes", "📞 Follow-up"], pt: ["🚗 Test drives", "🎯 Qualificação", "🧾 Orçamentos", "📞 Follow-up"], es: ["🚗 Pruebas de manejo", "🎯 Calificación", "🧾 Cotizaciones", "📞 Seguimiento"], hi: ["🚗 टेस्ट ड्राइव", "🎯 क्वालिफाई", "🧾 कोटेशन", "📞 फ़ॉलो-अप"] } },
];

// ── DINHEIRO PRECISA SABER O IDIOMA (2026-08-11) ────────────────────────────────────────────────
// Esta função tinha "$" e "en-US" FIXOS — o mesmo defeito, com o mesmo nome, que já me pegou na
// VOZ da agente (o fmt() com "en-US" que fazia ela falar metade da ligação em inglês com um
// cliente brasileiro). Aqui ele fixava duas coisas de uma vez:
//   • o CIFRÃO: o brasileiro lê "$647" e entende 647 reais; são US$ 647 ≈ R$ 3.500;
//   • o SEPARADOR: "en-US" escreve 1,240 — e em português a vírgula é DECIMAL, então o mesmo
//     número lê como "um e vinte e quatro". Milhar e decimal trocados é erro de fator 1000.
// Um fmt() que não recebe idioma é sempre a mesma bomba, e ela renasce em cada arquivo novo que
// precisa mostrar dinheiro. Por isso este recebe `lang` como parâmetro obrigatório na chamada.
const LOC = { en: "en-US", pt: "pt-BR", es: "es-ES", hi: "en-IN" };
const fmt = (n, lang = "en") =>
  (lang === "en" ? "$" : "US$ ") + Math.round(n).toLocaleString(LOC[lang] || "en-US");


export default function ResultsV2() {
  const { lang } = useLang();
  const C = RV_COPY[lang] || RV_COPY.en;
  const L = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v[lang] ?? v.en : v); // {en,pt,es,hi} → visitor language
  const [idx, setIdx] = useState(6);
  const [paused, setPaused] = useState(false);
  const [count, setCount] = useState(0);
  const b = BIZ[idx];

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % BIZ.length), 4200);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    setCount(0);
    const steps = 34; let s = 0;
    const t = setInterval(() => { s += 1; setCount(Math.min(b.loseN, Math.round((b.loseN / steps) * s))); if (s >= steps) clearInterval(t); }, 30);
    return () => clearInterval(t);
  }, [idx]);

  return (
    <section id="industries" className="relative overflow-hidden scroll-mt-20 px-5 py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_50%_-10%,rgba(62,148,104,0.08),transparent)]" />
      <style>{`
        @keyframes rvreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rvshine{to{background-position:220% center}}
        @keyframes rvsoft{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rvfall{0%{transform:translateY(-12px);opacity:0}20%{opacity:1}100%{transform:translateY(60px);opacity:0}}
        @keyframes rvmarq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>


      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "rvreveal .7s ease both" }}>{C.eyebrow}</div>
        <h2 className="mx-auto mt-4 max-w-3xl font-black leading-[0.95] tracking-tight" style={{ fontSize: "clamp(2.1rem,4.8vw,3.5rem)" }}>
          <span className="block text-g-word" style={{ animation: "rvreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{C.h1a}</span>
          <span className="block bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "rvreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, rvshine 7s linear infinite" }}>{C.h1b}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "rvreveal .8s ease .3s both" }}>
          {C.intro[0]}<span className="font-semibold text-g-word">{C.intro[1]}</span>{C.intro[2]}<span className="font-semibold text-[#d8916e]">{C.intro[3]}</span>{C.intro[4]}
        </p>

      </div>

      {/* industries marquee — moving + clickable (pauses on hover) */}
      <div className="relative mt-8 [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div className="flex w-max gap-2" style={{ animation: "rvmarq 34s linear infinite", animationPlayState: paused ? "paused" : "running" }}>
          {[...BIZ, ...BIZ].map((x, i) => {
            const real = i % BIZ.length;
            const on = real === idx;
            return (
              <button key={i} onClick={() => { setIdx(real); }}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-bold transition ${on ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-g-line bg-white/[0.03] text-g-muted hover:text-g-word"}`}>
                <span className="mr-1.5">{x.icon}</span>{L(x.name)}
              </button>
            );
          })}
        </div>
      </div>

      {/* combined panel: what Gui does (+ action chips) → leak → result */}
      <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-xl3 border border-g-line bg-white/[0.04] p-7 backdrop-blur-sm sm:p-8">
        <div key={idx} style={{ animation: "rvsoft .5s ease both" }}>
          <div className="mb-3 flex items-center justify-center gap-2 text-center text-[14px] text-g-ink">
            <span className="text-xl">{b.icon}</span>
            <span><span className="font-bold text-g-word">{L(b.name)}</span> — <span className="font-semibold text-g-green">Gui →</span> {L(b.does)}</span>
          </div>
          <div className="mb-6">
            <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-g-muted">{C.chips}<span className="text-g-green">{C.chipsB}</span></div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {(b.acts[lang] || b.acts.en).map((a) => (
                <span key={a} className="rounded-full border border-g-green/25 bg-g-green/[0.07] px-2.5 py-0.5 text-[11.5px] font-semibold text-g-green">{a}</span>
              ))}
            </div>
          </div>

          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div className="text-center md:text-left">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#d8916e]">{C.without}</div>
              <div className="relative mt-1 inline-block">
                <div className="text-[42px] font-black leading-none text-[#e0855f] sm:text-[50px]">{fmt(count, lang)}</div>
                <span className="pointer-events-none absolute -right-5 top-0 text-sm" style={{ animation: "rvfall 1.6s ease-in-out infinite" }}>💸</span>
                <span className="pointer-events-none absolute -right-2 top-0 text-sm" style={{ animation: "rvfall 1.6s ease-in-out .8s infinite" }}>💸</span>
              </div>
              <div className="mt-1 text-[13px] text-g-muted">{C.walks}{L(b.why)}.</div>
            </div>

            <div className="flex flex-col items-center">
              <div className="relative h-16 w-16">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-g-green/30 to-g-gold/15 text-2xl ring-1 ring-white/15">🌱</div>
                <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[#0c0c0c] text-g-green ring-2 ring-g-green/60 text-[11px]">🎙️</span>
              </div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-g-green">{C.catches}</div>
            </div>

            <div className="text-center md:text-right">
              <div className="text-[11px] font-bold uppercase tracking-wider text-g-green">{C.withg}</div>
              <div className="mt-1 text-[17px] font-bold leading-snug text-g-word">{L(b.result)}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-g-green/30 bg-g-green/10 px-3 py-1 text-[13px] font-black text-g-green">▲ {L(b.gain)}</div>
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-3 max-w-2xl text-center text-[11.5px] italic text-g-muted">{C.disc}</p>

      <div className="mx-auto mt-7 max-w-2xl text-center" style={{ animation: "rvreveal .8s ease .6s both" }}>
        <p className="text-[14px] text-g-muted">{C.footer[0]}<span className="font-semibold text-g-word">{C.footer[1]}</span>{C.footer[2]}</p>
      </div>
    </section>
  );
}
