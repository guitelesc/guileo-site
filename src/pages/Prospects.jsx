import { useEffect, useState } from "react";
import logo from "../assets/guileo-mark.png";
import { waLink } from "../data/contact.js";

// /prospects — the FIRST-SALES kit. A founder/partner opens this to land the FIRST
// clients fast: the 10 best prospect types (local businesses bleeding money on
// missed calls / no-shows), WHERE to find each + the ONE pain to hit, a warm
// cold-approach message for DM / WhatsApp / call, and the 3-step path
// (contact → live demo → close). Same phone-skimmable pocket-card pattern as /cola.
// Self-contained PT/EN/ES toggle (local state), g-* tokens, surface-real layout.

const D = {
  pt: {
    title: "Primeiros clientes",
    sub: "Quem caçar primeiro, onde achar e a ÚNICA dor pra tocar. Skim no celular.",
    listH: "🎯 Os 10 melhores primeiros alvos",
    listSub: "Negócios locais que sangram dinheiro em ligação perdida e no-show. Os mesmos 10 valem nos EUA (NY) e no Brasil — só muda ONDE achar.",
    where: "Onde achar",
    pain: "A dor pra tocar",
    prospects: [
      { e: "🦷", n: "Clínicas odontológicas", us: "Google Maps NYC “dentist near me” · Instagram local · Yelp · nichos imigrantes (PT/ES)", br: "Google Maps BR · Instagram BR · indicação · grupos de WhatsApp do bairro", p: "Cadeira vazia por no-show e ligação que ninguém atende = $200+ perdidos por falta." },
      { e: "🍽️", n: "Restaurantes movimentados", us: "Google Maps NYC · Yelp · Instagram · passar na frente no rush", br: "Google Maps BR · iFood/Instagram BR · indicação · grupos de bairro", p: "No rush ninguém atende o telefone — reserva e pedido grande vão pro concorrente." },
      { e: "💈", n: "Salões e barbearias", us: "Instagram NYC (booking no link) · Google Maps · Yelp · indicação", br: "Instagram BR · Google Maps BR · indicação de cliente · grupos de WhatsApp", p: "Cortando cabelo não dá pra atender — agendamento perdido e cadeira ociosa." },
      { e: "💆", n: "Med spas / estética", us: "Instagram NYC (alto volume de DM) · Google Maps · nichos imigrantes", br: "Instagram BR (muito DM) · Google Maps BR · grupos locais", p: "Lead caro de anúncio chega no DM/telefone e ninguém responde a tempo." },
      { e: "🔧", n: "HVAC / encanador", us: "Google Maps NYC “24h emergency” · Yelp · Nextdoor · indicação", br: "Google Maps BR “emergência 24h” · indicação · grupos de bairro no WhatsApp", p: "Emergência liga 3 lugares — quem atende primeiro fecha. Fora do horário, vaza tudo." },
      { e: "🏠", n: "Corretores de imóveis", us: "Zillow/Instagram NYC · placas “for sale” · grupos de corretor", br: "Instagram BR · OLX/portais · placas “à venda” · grupos de imóveis no WhatsApp", p: "Lead esfria em minutos. Em visita não atende — comprador liga no próximo anúncio." },
      { e: "⚖️", n: "Escritórios de advocacia", us: "Google Maps NYC · Avvo · indicação · grupos de imigração (PT/ES)", br: "Google Maps BR · Instagram BR · indicação · grupos de WhatsApp", p: "Caso novo vale milhares. Liga, cai na secretária eletrônica, procura outro advogado." },
      { e: "🏋️", n: "Academias / estúdios", us: "Instagram NYC · Google Maps · ClassPass local", br: "Instagram BR · Google Maps BR · indicação · grupos do bairro", p: "Interessado some sem resposta — e ninguém liga de volta quem cancelou matrícula." },
      { e: "🚗", n: "Oficinas mecânicas", us: "Google Maps NYC “auto repair” · Yelp · indicação", br: "Google Maps BR “oficina” · indicação · grupos de WhatsApp do bairro", p: "Telefone toca enquanto está embaixo do carro — orçamento perdido o dia todo." },
      { e: "🌎", n: "Serviços bilíngues / imigração", us: "Instagram/Facebook NYC em PT-ES · igrejas · grupos de comunidade imigrante", br: "Instagram/Facebook BR · indicação · grupos de WhatsApp da comunidade", p: "Cliente liga em espanhol/português e ninguém atende no idioma dele — vai embora." },
    ],
    chTitle: "Canal certo por mercado",
    chUS: "🇺🇸 EUA/NY: pode ligar, mandar SMS ou DM — começa por onde o lead vive (Maps/IG).",
    chBR: "🇧🇷 Brasil: abra SEMPRE no WhatsApp (DM). É onde o dono responde.",
    msgH: "💬 Mensagem de abordagem (calorosa)",
    msgSub: "EUA: ligação · SMS · DM. Brasil: WhatsApp. Curta. Termina sempre no convite da demo ao vivo.",
    msgDM: ["DM / WhatsApp", "Oi [nome]! Vi o [negócio] aqui no [Instagram/Maps] — fechado. Pergunta rápida: quando vocês estão ocupados ou fora do horário, quem atende as ligações e mensagens? Eu trabalho com um recepcionista de IA que atende 24/7, agenda e faz follow-up sozinho, em PT/EN/ES. Posso te mostrar? A IA te liga ao vivo, de graça, em 60 segundos — você ouve e decide."],
    msgCall: ["Ligação (abertura)", "Oi [nome], aqui é o [você] da Guileo — vou ser rápido. Vi que o [negócio] recebe bastante ligação. Quando vocês não conseguem atender, esse cliente normalmente some, né? Tenho uma IA que atende isso 24/7. Em vez de eu explicar — deixa ela te ligar agora, ao vivo, 60 segundos. Qual o melhor número?"],
    pathH: "🪜 O caminho de 3 passos",
    steps: [
      { n: "1", t: "Contato", c: "g-green", d: "Mande a mensagem acima por DM, WhatsApp ou ligue. Uma dor, um convite. Objetivo único: o sim pra demo ao vivo." },
      { n: "2", t: "Demo ao vivo · o Gui liga", c: "g-gold", d: "Pega o número dele, o Gui liga ao vivo em 60s. MESMA demo nos dois mercados — o Gui liga o lead. Siga o roteiro de 2 min passo a passo.", link: "/roteiro", linkT: "🎬 Abrir roteiro de demo" },
      { n: "3", t: "Fechar", c: "g-green", d: "Logo após o ‘uau’, abra a proposta na frente dele com os números DELE — preço e quanto está perdendo. Preço em USD nos dois mercados.", link: "/proposta?to=Cliente&price=1497&recover=2000", linkT: "📄 Abrir proposta" },
    ],
    tip: "💡 Regra de ouro: nunca venda no chat. Venda o ‘posso te mostrar? a IA te liga em 60s’. A demo fecha, não o texto.",
    toolsH: "🧰 Abrir agora",
  },
  en: {
    title: "First clients",
    sub: "Who to hunt first, where to find them and the ONE pain to hit. Phone-skim.",
    listH: "🎯 The 10 best first targets",
    listSub: "Local businesses bleeding money on missed calls and no-shows. The same 10 work in the US (NYC) and Brazil — only WHERE to find them changes.",
    where: "Where to find",
    pain: "Pain to hit",
    prospects: [
      { e: "🦷", n: "Dental clinics", us: "Google Maps NYC “dentist near me” · local Instagram · Yelp · immigrant niches (PT/ES)", br: "Google Maps BR · Instagram BR · referral · neighborhood WhatsApp groups", p: "Empty chair from no-shows + calls no one answers = $200+ lost per gap." },
      { e: "🍽️", n: "Busy restaurants", us: "Google Maps NYC · Yelp · Instagram · walk by at the dinner rush", br: "Google Maps BR · iFood/Instagram BR · referral · neighborhood groups", p: "At the rush nobody picks up — reservations and big orders go to the competitor." },
      { e: "💈", n: "Salons & barbershops", us: "Instagram NYC (booking in bio) · Google Maps · Yelp · client referral", br: "Instagram BR · Google Maps BR · client referral · WhatsApp groups", p: "Mid-haircut they can't answer — lost bookings and an idle chair." },
      { e: "💆", n: "Med spas / aesthetics", us: "Instagram NYC (high DM volume) · Google Maps · immigrant niches", br: "Instagram BR (heavy DM) · Google Maps BR · local groups", p: "Expensive ad leads hit the DM/phone and nobody replies in time." },
      { e: "🔧", n: "HVAC / plumbing", us: "Google Maps NYC “24h emergency” · Yelp · Nextdoor · referral", br: "Google Maps BR “emergência 24h” · referral · neighborhood WhatsApp groups", p: "Emergencies call 3 places — first to answer wins. After hours, it all leaks." },
      { e: "🏠", n: "Real-estate agents", us: "Zillow/Instagram NYC · “for sale” signs · realtor groups", br: "Instagram BR · OLX/portals · “à venda” signs · WhatsApp real-estate groups", p: "Leads go cold in minutes. In a showing they can't answer — buyer calls the next listing." },
      { e: "⚖️", n: "Law firms", us: "Google Maps NYC · Avvo · referral · immigration groups (PT/ES)", br: "Google Maps BR · Instagram BR · referral · WhatsApp groups", p: "A new case is worth thousands. They call, hit voicemail, find another lawyer." },
      { e: "🏋️", n: "Gyms / studios", us: "Instagram NYC · Google Maps · local ClassPass", br: "Instagram BR · Google Maps BR · referral · neighborhood groups", p: "Interested lead ghosts with no reply — and nobody calls back the ones who canceled." },
      { e: "🚗", n: "Auto repair", us: "Google Maps NYC “auto repair” · Yelp · referral", br: "Google Maps BR “oficina” · referral · neighborhood WhatsApp groups", p: "Phone rings while they're under a car — quotes lost all day long." },
      { e: "🌎", n: "Bilingual / immigration services", us: "PT-ES Instagram/Facebook NYC · churches · immigrant community groups", br: "Instagram/Facebook BR · referral · community WhatsApp groups", p: "A client calls in Spanish/Portuguese and nobody answers in their language — gone." },
    ],
    chTitle: "Right channel per market",
    chUS: "🇺🇸 US/NYC: call, text (SMS) or DM — start where the lead lives (Maps/IG).",
    chBR: "🇧🇷 Brazil: ALWAYS open on WhatsApp (DM). That's where the owner replies.",
    msgH: "💬 Cold-approach message (warm)",
    msgSub: "US: call · SMS · DM. Brazil: WhatsApp. Short. Always ends on the live-demo invite.",
    msgDM: ["DM / WhatsApp", "Hi [name]! Saw [business] on [Instagram/Maps] — love it. Quick question: when you're slammed or after hours, who answers the calls and messages? I work with an AI receptionist that answers 24/7, books and follows up on its own, in EN/PT/ES. Can I show you? The AI calls you live, free, in 60 seconds — you hear it and decide."],
    msgCall: ["Call (opener)", "Hi [name], this is [you] from Guileo — I'll be quick. I noticed [business] gets a lot of calls. When you can't pick up, that customer usually just disappears, right? I've got an AI that answers that 24/7. Instead of me explaining — let it call you right now, live, 60 seconds. What's the best number?"],
    pathH: "🪜 The 3-step path",
    steps: [
      { n: "1", t: "Contact", c: "g-green", d: "Send the message above by DM, WhatsApp or call. One pain, one invite. Single goal: the yes to the live demo." },
      { n: "2", t: "Live demo · Gui calls", c: "g-gold", d: "Grab their number, Gui calls them live in 60s. SAME demo in both markets — Gui calls the lead. Run the 2-min script step by step.", link: "/roteiro", linkT: "🎬 Open demo script" },
      { n: "3", t: "Close", c: "g-green", d: "Right after the ‘wow’, open the proposal in front of them with THEIR numbers — price and what they're losing. Pricing is USD in both markets.", link: "/proposta?to=Client&price=1497&recover=2000", linkT: "📄 Open proposal" },
    ],
    tip: "💡 Golden rule: never sell in the chat. Sell the ‘can I show you? the AI calls you in 60s’. The demo closes, not the text.",
    toolsH: "🧰 Open now",
  },
  es: {
    title: "Primeros clientes",
    sub: "A quién cazar primero, dónde encontrarlo y la ÚNICA dolencia a tocar. Skim en el móvil.",
    listH: "🎯 Los 10 mejores primeros objetivos",
    listSub: "Negocios locales que sangran dinero en llamadas perdidas y no-shows. Los mismos 10 sirven en EE.UU. (NY) y Brasil — solo cambia DÓNDE encontrarlos.",
    where: "Dónde encontrar",
    pain: "Dolor a tocar",
    prospects: [
      { e: "🦷", n: "Clínicas dentales", us: "Google Maps NYC “dentist near me” · Instagram local · Yelp · nichos inmigrantes (PT/ES)", br: "Google Maps BR · Instagram BR · referido · grupos de WhatsApp del barrio", p: "Silla vacía por no-show + llamadas que nadie contesta = $200+ perdidos por hueco." },
      { e: "🍽️", n: "Restaurantes concurridos", us: "Google Maps NYC · Yelp · Instagram · pasa por enfrente en la hora pico", br: "Google Maps BR · iFood/Instagram BR · referido · grupos del barrio", p: "En el rush nadie contesta — reservas y pedidos grandes van a la competencia." },
      { e: "💈", n: "Salones y barberías", us: "Instagram NYC (reserva en bio) · Google Maps · Yelp · referido de cliente", br: "Instagram BR · Google Maps BR · referido de cliente · grupos de WhatsApp", p: "Cortando el cabello no pueden contestar — reservas perdidas y silla ociosa." },
      { e: "💆", n: "Med spas / estética", us: "Instagram NYC (mucho DM) · Google Maps · nichos inmigrantes", br: "Instagram BR (mucho DM) · Google Maps BR · grupos locales", p: "Leads caros de anuncio llegan al DM/teléfono y nadie responde a tiempo." },
      { e: "🔧", n: "HVAC / plomería", us: "Google Maps NYC “24h emergency” · Yelp · Nextdoor · referido", br: "Google Maps BR “emergencia 24h” · referido · grupos de WhatsApp del barrio", p: "Las emergencias llaman a 3 lugares — gana quien contesta primero. Fuera de horario, todo se fuga." },
      { e: "🏠", n: "Agentes inmobiliarios", us: "Zillow/Instagram NYC · letreros “for sale” · grupos de agentes", br: "Instagram BR · OLX/portales · letreros “à venda” · grupos de inmuebles en WhatsApp", p: "El lead se enfría en minutos. En una visita no contestan — el comprador llama al siguiente anuncio." },
      { e: "⚖️", n: "Bufetes de abogados", us: "Google Maps NYC · Avvo · referido · grupos de inmigración (PT/ES)", br: "Google Maps BR · Instagram BR · referido · grupos de WhatsApp", p: "Un caso nuevo vale miles. Llaman, cae al buzón, buscan otro abogado." },
      { e: "🏋️", n: "Gimnasios / estudios", us: "Instagram NYC · Google Maps · ClassPass local", br: "Instagram BR · Google Maps BR · referido · grupos del barrio", p: "El interesado desaparece sin respuesta — y nadie llama a quien canceló su membresía." },
      { e: "🚗", n: "Talleres mecánicos", us: "Google Maps NYC “auto repair” · Yelp · referido", br: "Google Maps BR “oficina” · referido · grupos de WhatsApp del barrio", p: "El teléfono suena mientras están bajo un auto — cotizaciones perdidas todo el día." },
      { e: "🌎", n: "Servicios bilingües / inmigración", us: "Instagram/Facebook NYC en PT-ES · iglesias · grupos de comunidad inmigrante", br: "Instagram/Facebook BR · referido · grupos de WhatsApp de la comunidad", p: "Un cliente llama en español/portugués y nadie contesta en su idioma — se va." },
    ],
    chTitle: "Canal correcto por mercado",
    chUS: "🇺🇸 EE.UU./NY: puedes llamar, mandar SMS o DM — empieza donde vive el lead (Maps/IG).",
    chBR: "🇧🇷 Brasil: abre SIEMPRE en WhatsApp (DM). Ahí responde el dueño.",
    msgH: "💬 Mensaje de abordaje (cálido)",
    msgSub: "EE.UU.: llamada · SMS · DM. Brasil: WhatsApp. Corto. Siempre termina en la invitación a la demo en vivo.",
    msgDM: ["DM / WhatsApp", "¡Hola [nombre]! Vi [negocio] en [Instagram/Maps] — me encantó. Pregunta rápida: cuando están ocupados o fuera de horario, ¿quién contesta las llamadas y mensajes? Trabajo con un recepcionista de IA que contesta 24/7, agenda y hace seguimiento solo, en ES/PT/EN. ¿Te lo muestro? La IA te llama en vivo, gratis, en 60 segundos — la escuchas y decides."],
    msgCall: ["Llamada (apertura)", "Hola [nombre], soy [tú] de Guileo — seré rápido. Vi que [negocio] recibe muchas llamadas. Cuando no pueden contestar, ese cliente normalmente desaparece, ¿verdad? Tengo una IA que contesta eso 24/7. En vez de explicártelo — deja que te llame ahora, en vivo, 60 segundos. ¿Cuál es el mejor número?"],
    pathH: "🪜 El camino de 3 pasos",
    steps: [
      { n: "1", t: "Contacto", c: "g-green", d: "Envía el mensaje de arriba por DM, WhatsApp o llama. Un dolor, una invitación. Meta única: el sí a la demo en vivo." },
      { n: "2", t: "Demo en vivo · Gui llama", c: "g-gold", d: "Toma su número, Gui le llama en vivo en 60s. MISMA demo en ambos mercados — Gui llama al lead. Sigue el guion de 2 min paso a paso.", link: "/roteiro", linkT: "🎬 Abrir guion de demo" },
      { n: "3", t: "Cerrar", c: "g-green", d: "Justo después del ‘guau’, abre la propuesta frente a él con SUS números — precio y lo que está perdiendo. El precio es en USD en ambos mercados.", link: "/proposta?to=Cliente&price=1497&recover=2000", linkT: "📄 Abrir propuesta" },
    ],
    tip: "💡 Regla de oro: nunca vendas en el chat. Vende el ‘¿te lo muestro? la IA te llama en 60s’. La demo cierra, no el texto.",
    toolsH: "🧰 Abrir ahora",
  },
};

const LANGS = [["pt", "🇧🇷"], ["en", "🇺🇸"], ["es", "🇪🇸"]];

export default function Prospects() {
  const [lang, setLang] = useState("pt");
  const t = D[lang];
  useEffect(() => { document.title = "Guileo · Primeiros clientes"; }, []);
  return (
    <div className="surface-real min-h-screen px-4 py-6 text-g-ink">
      <div className="relative z-10 mx-auto max-w-md space-y-4">
        <header className="flex items-center justify-between">
          <a href="/cola" className="flex items-center gap-2"><img src={logo} alt="" className="h-7 w-7 object-contain" /><span className="text-[13px] font-extrabold text-g-word">{t.title}</span></a>
          <div className="flex gap-1">{LANGS.map(([c, f]) => <button key={c} onClick={() => setLang(c)} className={`h-7 w-7 rounded-full text-sm ${lang === c ? "bg-g-green/15 ring-1 ring-g-green/30" : "opacity-50"}`}>{f}</button>)}</div>
        </header>
        <p className="text-[11.5px] italic text-g-muted">{t.sub}</p>

        {/* The 10 prospect types */}
        <div className="rounded-2xl border border-g-line bg-white/[0.03] p-4">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-green">{t.listH}</div>
          <p className="mt-1 text-[11px] leading-snug text-g-muted">{t.listSub}</p>
          <ol className="mt-3 space-y-3">
            {t.prospects.map((p, i) => (
              <li key={p.n} className="rounded-xl border border-g-line bg-white/[0.02] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{p.e}</span>
                  <span className="text-[12.5px] font-black text-g-word"><span className="text-g-green">{i + 1}. </span>{p.n}</span>
                </div>
                <div className="mt-1.5 text-[11px] font-black uppercase tracking-wider text-g-muted">{t.where}</div>
                <div className="mt-0.5 text-[11.5px] leading-snug"><span className="font-black">🇺🇸 </span><span className="text-g-ink">{p.us}</span></div>
                <div className="mt-0.5 text-[11.5px] leading-snug"><span className="font-black">🇧🇷 </span><span className="text-g-ink">{p.br}</span></div>
                <div className="mt-1.5 text-[11.5px] leading-snug"><span className="font-black text-g-gold">{t.pain}: </span><span className="text-g-word">{p.p}</span></div>
              </li>
            ))}
          </ol>
        </div>

        {/* Channel per market */}
        <div className="rounded-2xl border border-g-line bg-white/[0.03] p-4">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-muted">{t.chTitle}</div>
          <p className="mt-2 text-[12px] leading-snug text-g-word">{t.chUS}</p>
          <p className="mt-1.5 text-[12px] leading-snug text-g-word">{t.chBR}</p>
        </div>

        {/* Cold-approach message */}
        <div className="rounded-2xl border border-g-green/30 bg-g-green/[0.06] p-4">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-green">{t.msgH}</div>
          <p className="mt-1 text-[11px] leading-snug text-g-muted">{t.msgSub}</p>
          {[t.msgDM, t.msgCall].map(([label, body]) => (
            <div key={label} className="mt-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-g-gold">{label}</div>
              <p className="mt-1 rounded-xl border border-g-line bg-white/[0.03] p-3 text-[12.5px] font-semibold leading-relaxed text-g-word">{body}</p>
            </div>
          ))}
        </div>

        {/* The 3-step path */}
        <div>
          <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-g-muted">{t.pathH}</div>
          <ol className="space-y-2.5">
            {t.steps.map((s) => (
              <li key={s.n} className={`rounded-2xl border bg-white/[0.03] p-4 ${s.c === "g-gold" ? "border-g-gold/30" : "border-g-line"}`}>
                <div className="flex items-center gap-2">
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-[12px] font-black ${s.c === "g-gold" ? "bg-g-gold/15 text-g-gold" : "bg-g-green/15 text-g-green"}`}>{s.n}</span>
                  <span className="text-[12.5px] font-black text-g-word">{s.t}</span>
                </div>
                <p className="mt-2 text-[12px] leading-snug text-g-ink">{s.d}</p>
                {s.link && <a href={s.link} className={`mt-2.5 block rounded-xl border px-3 py-2.5 text-center text-[12.5px] font-black ${s.c === "g-gold" ? "border-g-gold/30 bg-g-gold/[0.08] text-g-gold" : "border-g-green/30 bg-g-green/[0.08] text-g-green"}`}>{s.linkT}</a>}
              </li>
            ))}
          </ol>
        </div>

        <p className="rounded-xl border border-g-gold/30 bg-g-gold/[0.05] px-3.5 py-2.5 text-[11.5px] leading-snug text-g-ink">{t.tip}</p>

        {/* Tools */}
        <div>
          <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-g-muted">{t.toolsH}</div>
          <div className="grid grid-cols-3 gap-2">
            <a href="/roteiro" className="rounded-xl border border-g-gold/30 bg-g-gold/[0.08] px-3 py-2.5 text-center text-[12px] font-black text-g-gold">🎬 Roteiro</a>
            <a href="/cola" className="rounded-xl border border-g-line bg-white/[0.04] px-3 py-2.5 text-center text-[12px] font-bold text-g-word">📌 Cola</a>
            <a href={waLink("Luis, dúvida rápida sobre prospecção:")} target="_blank" rel="noopener" className="rounded-xl border border-g-green/30 bg-g-green/[0.08] px-3 py-2.5 text-center text-[12px] font-black text-g-green">🆘 Luis</a>
          </div>
        </div>
      </div>
    </div>
  );
}
