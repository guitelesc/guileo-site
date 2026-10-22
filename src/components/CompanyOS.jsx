import { useEffect, useState } from "react";
import { useLang } from "../i18n.jsx";
import { Reveal } from "../lib/ui.jsx";

/* ── CompanyOS — os 8 departamentos (2026-09-10) ──────────────────────────────────────────────
   O eyebrow do hero promete "AI Company Operating System™" e a página não mostrava o sistema.
   São os MESMOS 8 departamentos do cockpit do cliente (src/portal/MyCompanyOS.jsx: Finanças ·
   Clientes · Vendas · Marketing · Operações · Crescimento · Suporte · Inteligência). Cada placa
   diz o que a Gui faz ali — o que existe na plataforma, nada prometido a mais. */
// VIDA (Luis, 2026-09-10: "dar mais movimento e vida"): cada departamento mostra a Gui TRABALHANDO —
// um evento por vez, trocando a cada ~4s com crossfade. São exemplos ilustrativos (mesmo padrão do
// telefone do hero), nunca dados de cliente real. `T(en,pt,es,hi)` — lei do idioma.
const T = (en, pt, es, hi) => ({ en, pt, es, hi });
const EVENTOS = {
  clientes:     [T("Answered Maria · booked Sat 3 PM","Atendeu a Maria · marcou sáb 15h","Atendió a María · reservó sáb 3 PM","Maria को जवाब · शनि 3 PM बुक"), T("Replied on WhatsApp in 2s","Respondeu no WhatsApp em 2s","Respondió en WhatsApp en 2s","WhatsApp पर 2s में जवाब"), T("Remembered João's last visit","Lembrou a última visita do João","Recordó la última visita de João","João की पिछली विज़िट याद")],
  vendas:       [T("Quoted $280 · booked tomorrow","Orçou $280 · marcou amanhã","Cotizó $280 · reservó mañana","$280 कोट · कल बुक"), T("Collected $85 on the call","Cobrou $85 na ligação","Cobró $85 en la llamada","कॉल पर $85 वसूले"), T("Won back Diego · $79/mo","Trouxe o Diego de volta · $79/mês","Recuperó a Diego · $79/mes","Diego वापस · $79/माह")],
  marketing:    [T("Post written in your voice","Post escrito na sua voz","Post escrito en tu voz","आपकी आवाज़ में पोस्ट"), T("Ad audience: people who called","Público do anúncio: quem já ligou","Audiencia del anuncio: quienes llamaron","विज्ञापन ऑडियंस: जिन्होंने कॉल किया"), T("14 clicks → 3 bookings","14 cliques → 3 agendamentos","14 clics → 3 reservas","14 क्लिक → 3 बुकिंग")],
  financas:     [T("Payment link paid · $120","Link de pagamento pago · $120","Link de pago pagado · $120","पेमेंट लिंक भुगतान · $120"), T("Deposit held · no-show covered","Sinal retido · falta coberta","Depósito retenido · ausencia cubierta","डिपॉज़िट रखा · नो-शो कवर"), T("Credits: 412 left this month","Créditos: faltam 412 este mês","Créditos: quedan 412 este mes","क्रेडिट: इस महीने 412 बचे")],
  operacoes:    [T("Reminder sent 24h before","Lembrete enviado 24h antes","Recordatorio enviado 24h antes","24 घंटे पहले रिमाइंडर"), T("Holiday detected · slots closed","Feriado detectado · horários fechados","Feriado detectado · turnos cerrados","छुट्टी पकड़ी · स्लॉट बंद"), T("Calendar updated · Fri 4 PM","Agenda atualizada · sex 16h","Agenda actualizada · vie 4 PM","कैलेंडर अपडेट · शुक्र 4 PM")],
  crescimento:  [T("5★ review requested · Sofia","Avaliação 5★ pedida · Sofia","Reseña 5★ solicitada · Sofía","5★ रिव्यू माँगा · Sofia"), T("Package offered · 3 sessions","Pacote oferecido · 3 sessões","Paquete ofrecido · 3 sesiones","पैकेज ऑफ़र · 3 सेशन"), T("Referral link sent","Link de indicação enviado","Link de referido enviado","रेफ़रल लिंक भेजा")],
  suporte:      [T("Refunded $20 · texted receipt","Estornou $20 · recibo por SMS","Devolvió $20 · recibo por SMS","$20 रिफ़ंड · SMS रसीद"), T("Order tracking · 6 min away","Rastreio do pedido · 6 min","Seguimiento del pedido · 6 min","ऑर्डर ट्रैकिंग · 6 मिनट"), T("Escalated to a human · 1 min","Passou pra uma pessoa · 1 min","Derivó a una persona · 1 min","इंसान को भेजा · 1 मिनट")],
  inteligencia: [T("Pulse: 4.6 this week ↑","Pulse: 4,6 esta semana ↑","Pulse: 4,6 esta semana ↑","पल्स: इस हफ़्ते 4.6 ↑"), T("Risk radar: 2 clients cooling","Radar de risco: 2 clientes esfriando","Radar de riesgo: 2 clientes enfriándose","रिस्क रडार: 2 ग्राहक ठंडे"), T("Transcript flagged for review","Transcrição marcada pra revisão","Transcripción marcada para revisión","ट्रांसक्रिप्ट रिव्यू के लिए")],
};
const DEPTS = [
  { icon: "📞", k: "clientes",     c: "#FF8A33", n: { en: "Customers", pt: "Clientes", es: "Clientes", hi: "ग्राहक" },          d: { en: "Every call & message answered, remembered, followed up.", pt: "Toda ligação e mensagem atendida, lembrada, acompanhada.", es: "Cada llamada y mensaje atendido, recordado, seguido.", hi: "हर कॉल-मैसेज का जवाब, याद और फ़ॉलो-अप।" } },
  { icon: "💰", k: "vendas",       c: "#3E9468", n: { en: "Sales", pt: "Vendas", es: "Ventas", hi: "सेल्स" },                  d: { en: "Quotes, closes, collects on the call. Wins back the lapsed.", pt: "Orça, fecha e cobra na ligação. Traz de volta quem sumiu.", es: "Cotiza, cierra y cobra en la llamada. Recupera a los que se fueron.", hi: "कॉल पर कोट, क्लोज़ और वसूली। गए हुए ग्राहक वापस।" } },
  { icon: "📣", k: "marketing",    c: "#D6C29A", n: { en: "Marketing", pt: "Marketing", es: "Marketing", hi: "मार्केटिंग" },   d: { en: "Ads, content and social — fed by your own customer data.", pt: "Anúncios, conteúdo e redes — alimentados pelos seus próprios dados.", es: "Anuncios, contenido y redes — alimentados por tus propios datos.", hi: "विज्ञापन, कॉन्टेंट, सोशल — आपके अपने डेटा से।" } },
  { icon: "🧾", k: "financas",     c: "#FFC23D", n: { en: "Finance", pt: "Finanças", es: "Finanzas", hi: "फ़ाइनेंस" },         d: { en: "Payments, links, credit ledger — what each dollar brought back.", pt: "Pagamentos, links, livro-caixa — o que cada real trouxe de volta.", es: "Pagos, links, libro mayor — lo que cada dólar devolvió.", hi: "पेमेंट, लिंक, लेजर — हर रुपये की वापसी।" } },
  { icon: "📅", k: "operacoes",    c: "#3FB4FF", n: { en: "Operations", pt: "Operações", es: "Operaciones", hi: "ऑपरेशंस" },  d: { en: "Real calendar, reminders, no-show shield, holidays handled.", pt: "Agenda real, lembretes, escudo anti-falta, feriados resolvidos.", es: "Agenda real, recordatorios, escudo anti-ausencia, feriados resueltos.", hi: "असली कैलेंडर, रिमाइंडर, नो-शो शील्ड, छुट्टियाँ।" } },
  { icon: "🌱", k: "crescimento",  c: "#6FB892", n: { en: "Growth", pt: "Crescimento", es: "Crecimiento", hi: "ग्रोथ" },      d: { en: "Reviews, referrals, packages and win-backs — on autopilot.", pt: "Avaliações, indicações, pacotes e reativação — no automático.", es: "Reseñas, referidos, paquetes y reactivación — en automático.", hi: "रिव्यू, रेफ़रल, पैकेज और वापसी — ऑटोपायलट।" } },
  { icon: "🛟", k: "suporte",      c: "#FF3D8B", n: { en: "Support", pt: "Suporte", es: "Soporte", hi: "सपोर्ट" },             d: { en: "Refunds, tracking, questions — solved in the customer's language.", pt: "Estornos, rastreio, dúvidas — resolvidos no idioma do cliente.", es: "Reembolsos, seguimiento, dudas — resueltos en el idioma del cliente.", hi: "रिफ़ंड, ट्रैकिंग, सवाल — ग्राहक की भाषा में।" } },
  { icon: "🧠", k: "inteligencia", c: "#C2A878", n: { en: "Intelligence", pt: "Inteligência", es: "Inteligencia", hi: "इंटेलिजेंस" }, d: { en: "Pulse, transcripts, risk radar — you see what's coming.", pt: "Pulse, transcrições, radar de risco — você vê o que vem.", es: "Pulse, transcripciones, radar de riesgo — ves lo que viene.", hi: "पल्स, ट्रांसक्रिप्ट, रिस्क रडार — आगे क्या है, दिखता है।" } },
];
const COPY = {
  en: { eyebrow: "AI Company Operating System™", h2a: "Eight departments. ", h2b: "One Gui. One screen.", sub: "The same eight departments a real company runs — staffed by Gui, supervised by a human, visible in your cockpit every day." },
  pt: { eyebrow: "Sistema Operacional de IA da empresa™", h2a: "Oito departamentos. ", h2b: "Uma Gui. Uma tela.", sub: "Os mesmos oito departamentos de uma empresa de verdade — operados pela Gui, supervisionados por gente, visíveis no seu cockpit todo dia." },
  es: { eyebrow: "Sistema Operativo de IA de la empresa™", h2a: "Ocho departamentos. ", h2b: "Una Gui. Una pantalla.", sub: "Los mismos ocho departamentos de una empresa real — operados por Gui, supervisados por personas, visibles en tu cockpit cada día." },
  hi: { eyebrow: "कंपनी का AI ऑपरेटिंग सिस्टम™", h2a: "आठ विभाग। ", h2b: "एक Gui। एक स्क्रीन।", sub: "वही आठ विभाग जो असली कंपनी चलाती है — Gui चलाती है, इंसान देखरेख करता है, आपके कॉकपिट में रोज़ दिखता है।" },
};
export default function CompanyOS() {
  const { lang } = useLang();
  const L = lang in COPY ? lang : "en"; const C = COPY[L];
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 4200); return () => clearInterval(id); }, []);
  return (
    <section id="company-os" className="relative overflow-hidden px-5 py-20">
      <style>{`@keyframes gswap{from{opacity:.15}to{opacity:1}}`}</style>
      <Reveal className="mx-auto max-w-3xl text-center">
        <div className="text-[12px] font-black uppercase tracking-[0.24em] text-g-gold">{C.eyebrow}</div>
        <h2 className="mt-4 font-black leading-[1.02] tracking-tight text-g-word" style={{ fontSize: "clamp(2rem,4.6vw,3.2rem)" }}>{C.h2a}<span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent">{C.h2b}</span></h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-g-ink">{C.sub}</p>
      </Reveal>
      <div className="mx-auto mt-10 grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DEPTS.map((d, i) => (
          <Reveal key={d.k} delay={i * 60}>
            <div className="relative h-full overflow-hidden rounded-3xl border border-g-line bg-g-creamd/70 p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.05] text-[18px] ring-1 ring-white/10" style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 0 18px -6px ${d.c}` }}>{d.icon}</span>
                <span className="text-[15px] font-black text-g-word">{d.n[L]}</span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-g-ink">{d.d[L]}</p>
              {/* a linha VIVA: o que a Gui acabou de fazer neste departamento */}
              {(() => { const ev = EVENTOS[d.k] || []; const e = ev[(tick + i) % ev.length]; return e ? (
                <div key={tick} className="mt-3 flex items-center gap-2 text-[11.5px] font-semibold text-g-word" style={{ animation: "gswap .5s ease-in-out both" }}>
                  <span className="relative grid h-2 w-2 place-items-center"><span className="absolute inset-0 rounded-full" style={{ background: d.c, opacity: .9 }} /><span className="absolute inset-0 rounded-full animate-ping" style={{ background: d.c, opacity: .5 }} /></span>
                  <span className="truncate">{e[L] || e.en}</span>
                </div>) : null; })()}
              <span className="absolute bottom-0 left-5 right-5 h-px" style={{ background: `linear-gradient(90deg, transparent, ${d.c}88, transparent)` }} />
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
