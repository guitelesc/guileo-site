import Navbar from "../components/Navbar";
import { useSeo } from "../lib/seo.js";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import { useLang } from "../i18n.jsx";

// HealthCompliance — HONEST HIPAA posture page for health-adjacent businesses
// (med spas, dental, clinics). Guileo handles SCHEDULING + contact info only:
// we are NOT an EHR, we minimize PHI by design (name/phone/service — no
// diagnoses, no clinical notes). Encrypted in transit/at rest (Cloudflare +
// Supabase), tenant isolation, deletion on request, TCPA consent.
// Includes an explicit "what we are NOT yet" section: not HIPAA-certified
// today; BAA is on the roadmap. Honesty is the pitch — never overclaim.
//
// i18n: follows the Privacy.jsx convention — full copy in EN/PT/ES/HI for the
// marketing chrome; the legal fine-print paragraph stays in ENGLISH for ES/HI
// (official legal version), exactly like Privacy.jsx does.

const LEGAL_NOTE_EN = (
  <>
    <strong>Legal note (official English version):</strong> Guileo is a scheduling and
    customer-communication platform. It is not an Electronic Health Record (EHR) and is not
    intended to store, process or transmit clinical information. Guileo (ORIGEM LTDA)
    is <strong>not HIPAA-certified</strong> and does not currently sign Business Associate
    Agreements (BAA). Healthcare organizations that require a formal BAA should not enter
    Protected Health Information (PHI) into the system; the platform may still be used for
    non-clinical scheduling (name, phone, requested service, date/time). Data is encrypted in
    transit and at rest, isolated per tenant, and deleted on request. Phone/SMS consent
    follows TCPA / A2P 10DLC rules. Contact <a href="mailto:smart@guileoai.com" className="underline">smart@guileoai.com</a> for
    our current compliance posture and BAA roadmap.
  </>
);

const HC_COPY = {
  en: {
    eyebrow: "🩺 HEALTH COMPLIANCE, THE HONEST VERSION",
    h1a: "Built for clinics. ", h1b: "Honest about the limits.",
    sub: "Guileo answers, books and reminds for med spas, dental offices and clinics — scheduling and contact info only. We are not an EHR, and we tell you exactly what we are (and aren't) certified for. No overclaiming, ever.",
    cardsLabel: "✅ What we do for health-adjacent businesses",
    cards: [
      { emoji: "🗓️", title: "Scheduling, not medical records", desc: "Gui books, confirms, reschedules and reminds. The agent captures name, phone and requested service — no diagnoses, no clinical notes, no health history. PHI is minimized by design." },
      { emoji: "🔐", title: "Encrypted & isolated", desc: "Data encrypted in transit and at rest (Cloudflare + Supabase). Every clinic is a separate tenant — your patients' contact data never crosses into another business, ever." },
      { emoji: "🧹", title: "Deletion & consent built in", desc: "Any contact can be deleted on request. Phone and SMS outreach follows TCPA consent rules with automatic opt-out — the same compliance engine that protects all Guileo clients." },
    ],
    honestLabel: "🟠 What we are NOT yet — read this before you buy",
    honest: [
      { title: "We are not HIPAA-certified today", desc: "Guileo has not completed a HIPAA certification or audit. We say this out loud because your compliance officer will ask — and because vendors who dodge the question are the ones to worry about." },
      { title: "BAA is on the roadmap, not on the table yet", desc: "We do not currently sign a Business Associate Agreement. If your clinic requires a formal BAA, either wait for our BAA program or use Gui strictly for non-clinical scheduling (name, phone, service, time — nothing medical)." },
      { title: "The safe way to use Gui in a clinic", desc: "Treat Gui as your front desk, not your chart. Booking a cleaning, a consultation or a Botox slot needs zero PHI. Keep diagnoses, treatment notes and health history inside your EHR — where they belong." },
    ],
    detailLabel: "🔎 Our data posture, point by point",
    details: [
      ["Data captured by the agent", "Name, phone, requested service, preferred date/time. That's it. Gui is prompted to never ask for or record diagnoses, symptoms or clinical details."],
      ["Encryption", "TLS in transit (Cloudflare edge), encryption at rest (Supabase/Postgres managed encryption)."],
      ["Tenant isolation", "Every business is scoped by its own account — every query and mutation is bound to the tenant. No cross-tenant access paths."],
      ["Deletion", "Contact data deleted on request — email smart@guileoai.com or ask through your cockpit."],
      ["Call/SMS consent", "TCPA-aligned: recorded opt-in, automatic STOP handling, A2P 10DLC registration handled by Guileo."],
    ],
    legalNote: LEGAL_NOTE_EN,
    ctaTitle: "Want the straight answer for your clinic?",
    ctaSub: "Tell us what your compliance team requires and we'll tell you honestly if Guileo fits today, fits partially, or should wait for the BAA program.",
    cta: "Talk to us →",
  },
  pt: {
    eyebrow: "🩺 CONFORMIDADE EM SAÚDE, A VERSÃO HONESTA",
    h1a: "Feito para clínicas. ", h1b: "Honesto sobre os limites.",
    sub: "O Gui atende, agenda e lembra para med spas, dentistas e clínicas — só agendamento e dados de contato. Não somos um prontuário eletrônico (EHR), e dizemos exatamente o que somos (e o que ainda não somos). Sem exagero, nunca.",
    cardsLabel: "✅ O que fazemos para negócios de saúde",
    cards: [
      { emoji: "🗓️", title: "Agendamento, não prontuário", desc: "O Gui agenda, confirma, remarca e lembra. O agente captura nome, telefone e serviço desejado — sem diagnósticos, sem notas clínicas, sem histórico de saúde. PHI minimizado por design." },
      { emoji: "🔐", title: "Criptografado e isolado", desc: "Dados criptografados em trânsito e em repouso (Cloudflare + Supabase). Cada clínica é um tenant separado — os contatos dos seus pacientes nunca cruzam para outro negócio, nunca." },
      { emoji: "🧹", title: "Exclusão e consentimento nativos", desc: "Qualquer contato pode ser excluído sob solicitação. Ligações e SMS seguem as regras de consentimento TCPA com opt-out automático — o mesmo motor de conformidade que protege todos os clientes Guileo." },
    ],
    honestLabel: "🟠 O que ainda NÃO somos — leia antes de comprar",
    honest: [
      { title: "Não somos certificados HIPAA hoje", desc: "A Guileo não concluiu certificação ou auditoria HIPAA. Falamos isso em voz alta porque seu responsável de conformidade vai perguntar — e porque fornecedor que desvia dessa pergunta é o que merece desconfiança." },
      { title: "BAA está no roadmap, ainda não na mesa", desc: "Hoje não assinamos Business Associate Agreement. Se a sua clínica exige um BAA formal, aguarde nosso programa de BAA ou use o Gui estritamente para agendamento não-clínico (nome, telefone, serviço, horário — nada médico)." },
      { title: "O jeito seguro de usar o Gui na clínica", desc: "Trate o Gui como sua recepção, não como seu prontuário. Marcar uma limpeza, uma consulta ou um horário de Botox não precisa de nenhum PHI. Diagnósticos, notas de tratamento e histórico de saúde ficam no seu EHR — onde devem estar." },
    ],
    detailLabel: "🔎 Nossa postura de dados, ponto a ponto",
    details: [
      ["Dados capturados pelo agente", "Nome, telefone, serviço desejado, data/horário preferido. Só isso. O Gui é instruído a nunca perguntar nem registrar diagnósticos, sintomas ou detalhes clínicos."],
      ["Criptografia", "TLS em trânsito (edge da Cloudflare), criptografia em repouso (criptografia gerenciada do Supabase/Postgres)."],
      ["Isolamento de tenant", "Cada negócio é escopado pela própria conta — toda consulta e mutação é vinculada ao tenant. Sem caminhos de acesso entre tenants."],
      ["Exclusão", "Dados de contato excluídos sob solicitação — escreva para smart@guileoai.com ou peça pelo seu cockpit."],
      ["Consentimento de ligação/SMS", "Alinhado ao TCPA: opt-in registrado, STOP automático, registro A2P 10DLC feito pela Guileo."],
    ],
    legalNote: (
      <>
        <strong>Nota legal:</strong> A Guileo é uma plataforma de agendamento e comunicação com
        clientes. Não é um prontuário eletrônico (EHR) e não se destina a armazenar, processar ou
        transmitir informações clínicas. A Guileo (ORIGEM LTDA) <strong>não é certificada
        HIPAA</strong> e atualmente não assina Business Associate Agreements (BAA). Organizações de
        saúde que exigem BAA formal não devem inserir Protected Health Information (PHI) no sistema;
        a plataforma ainda pode ser usada para agendamento não-clínico (nome, telefone, serviço,
        data/horário). Dados são criptografados em trânsito e em repouso, isolados por tenant e
        excluídos sob solicitação. Consentimento de telefone/SMS segue as regras TCPA / A2P 10DLC.
        Fale com <a href="mailto:smart@guileoai.com" className="underline">smart@guileoai.com</a> sobre
        nossa postura atual de conformidade e o roadmap de BAA.
      </>
    ),
    ctaTitle: "Quer a resposta direta para a sua clínica?",
    ctaSub: "Conte o que o seu time de conformidade exige e a gente responde com honestidade: se o Guileo serve hoje, serve parcialmente, ou se vale esperar o programa de BAA.",
    cta: "Falar com a gente →",
  },
  es: {
    eyebrow: "🩺 CUMPLIMIENTO EN SALUD, LA VERSIÓN HONESTA",
    h1a: "Hecho para clínicas. ", h1b: "Honesto sobre los límites.",
    sub: "Gui contesta, agenda y recuerda para med spas, dentistas y clínicas — solo agendamiento y datos de contacto. No somos un expediente clínico electrónico (EHR), y decimos exactamente qué somos (y qué aún no somos). Sin exagerar, nunca.",
    cardsLabel: "✅ Lo que hacemos para negocios de salud",
    cards: [
      { emoji: "🗓️", title: "Agendamiento, no expediente", desc: "Gui agenda, confirma, reprograma y recuerda. El agente captura nombre, teléfono y servicio deseado — sin diagnósticos, sin notas clínicas, sin historial de salud. PHI minimizado por diseño." },
      { emoji: "🔐", title: "Cifrado y aislado", desc: "Datos cifrados en tránsito y en reposo (Cloudflare + Supabase). Cada clínica es un tenant separado — los contactos de tus pacientes nunca cruzan a otro negocio, nunca." },
      { emoji: "🧹", title: "Eliminación y consentimiento integrados", desc: "Cualquier contacto puede eliminarse a solicitud. Llamadas y SMS siguen las reglas de consentimiento TCPA con opt-out automático — el mismo motor de cumplimiento que protege a todos los clientes de Guileo." },
    ],
    honestLabel: "🟠 Lo que aún NO somos — lee esto antes de comprar",
    honest: [
      { title: "No estamos certificados HIPAA hoy", desc: "Guileo no ha completado una certificación o auditoría HIPAA. Lo decimos en voz alta porque tu responsable de cumplimiento lo va a preguntar — y porque el proveedor que esquiva esa pregunta es del que hay que desconfiar." },
      { title: "El BAA está en el roadmap, aún no sobre la mesa", desc: "Hoy no firmamos Business Associate Agreement. Si tu clínica exige un BAA formal, espera nuestro programa de BAA o usa a Gui estrictamente para agendamiento no clínico (nombre, teléfono, servicio, hora — nada médico)." },
      { title: "La forma segura de usar a Gui en la clínica", desc: "Trata a Gui como tu recepción, no como tu expediente. Reservar una limpieza, una consulta o un turno de Botox no necesita ningún PHI. Diagnósticos, notas de tratamiento e historial de salud quedan en tu EHR — donde deben estar." },
    ],
    detailLabel: "🔎 Nuestra postura de datos, punto por punto",
    details: [
      ["Datos capturados por el agente", "Nombre, teléfono, servicio deseado, fecha/hora preferida. Nada más. Gui está instruido para nunca preguntar ni registrar diagnósticos, síntomas o detalles clínicos."],
      ["Cifrado", "TLS en tránsito (edge de Cloudflare), cifrado en reposo (cifrado gestionado de Supabase/Postgres)."],
      ["Aislamiento de tenant", "Cada negocio está delimitado por su propia cuenta — toda consulta y mutación está ligada al tenant. Sin rutas de acceso entre tenants."],
      ["Eliminación", "Datos de contacto eliminados a solicitud — escribe a smart@guileoai.com o pídelo desde tu cockpit."],
      ["Consentimiento de llamadas/SMS", "Alineado con TCPA: opt-in registrado, STOP automático, registro A2P 10DLC gestionado por Guileo."],
    ],
    legalNote: LEGAL_NOTE_EN,
    ctaTitle: "¿Quieres la respuesta directa para tu clínica?",
    ctaSub: "Cuéntanos qué exige tu equipo de cumplimiento y te diremos con honestidad si Guileo encaja hoy, encaja parcialmente, o conviene esperar el programa de BAA.",
    cta: "Habla con nosotros →",
  },
  hi: {
    eyebrow: "🩺 हेल्थ कंप्लायंस — ईमानदार संस्करण",
    h1a: "क्लीनिकों के लिए बना। ", h1b: "सीमाओं के बारे में ईमानदार।",
    sub: "Gui मेड स्पा, डेंटल और क्लीनिकों के लिए कॉल उठाता है, बुक करता है और रिमाइंडर भेजता है — केवल शेड्यूलिंग और संपर्क जानकारी। हम EHR नहीं हैं, और हम साफ़ बताते हैं कि हम क्या हैं (और अभी क्या नहीं हैं)। कभी बढ़ा-चढ़ाकर नहीं।",
    cardsLabel: "✅ हेल्थ-से-जुड़े व्यवसायों के लिए हम क्या करते हैं",
    cards: [
      { emoji: "🗓️", title: "शेड्यूलिंग, मेडिकल रिकॉर्ड नहीं", desc: "Gui बुक, कन्फ़र्म, रीशेड्यूल और रिमाइंड करता है। एजेंट केवल नाम, फ़ोन और सेवा दर्ज करता है — कोई निदान नहीं, कोई क्लिनिकल नोट नहीं, कोई स्वास्थ्य इतिहास नहीं। PHI डिज़ाइन से न्यूनतम।" },
      { emoji: "🔐", title: "एन्क्रिप्टेड और अलग-थलग", desc: "डेटा ट्रांज़िट और स्टोरेज दोनों में एन्क्रिप्टेड (Cloudflare + Supabase)। हर क्लीनिक एक अलग tenant है — आपके मरीज़ों की संपर्क जानकारी कभी दूसरे व्यवसाय में नहीं जाती।" },
      { emoji: "🧹", title: "डिलीशन और सहमति बिल्ट-इन", desc: "किसी भी संपर्क को अनुरोध पर हटाया जा सकता है। फ़ोन और SMS आउटरीच TCPA सहमति नियमों का पालन करते हैं, ऑटोमैटिक ऑप्ट-आउट के साथ — वही कंप्लायंस इंजन जो सभी Guileo क्लाइंट्स की रक्षा करता है।" },
    ],
    honestLabel: "🟠 हम अभी क्या नहीं हैं — खरीदने से पहले पढ़ें",
    honest: [
      { title: "हम आज HIPAA-प्रमाणित नहीं हैं", desc: "Guileo ने HIPAA प्रमाणन या ऑडिट पूरा नहीं किया है। हम यह खुलकर कहते हैं क्योंकि आपका कंप्लायंस अधिकारी यह पूछेगा — और क्योंकि जो वेंडर इस सवाल से बचता है, उसी से सावधान रहना चाहिए।" },
      { title: "BAA रोडमैप पर है, अभी टेबल पर नहीं", desc: "हम फ़िलहाल Business Associate Agreement साइन नहीं करते। अगर आपकी क्लीनिक को औपचारिक BAA चाहिए, तो हमारे BAA प्रोग्राम का इंतज़ार करें या Gui का उपयोग केवल गैर-क्लिनिकल शेड्यूलिंग के लिए करें (नाम, फ़ोन, सेवा, समय — कुछ भी मेडिकल नहीं)।" },
      { title: "क्लीनिक में Gui इस्तेमाल करने का सुरक्षित तरीक़ा", desc: "Gui को अपना फ्रंट डेस्क समझें, अपना चार्ट नहीं। क्लीनिंग, कंसल्टेशन या Botox स्लॉट बुक करने में कोई PHI नहीं लगता। निदान, उपचार नोट और स्वास्थ्य इतिहास आपके EHR में रहें — जहाँ उनकी जगह है।" },
    ],
    detailLabel: "🔎 हमारी डेटा-नीति, बिंदु-दर-बिंदु",
    details: [
      ["एजेंट द्वारा दर्ज डेटा", "नाम, फ़ोन, वांछित सेवा, पसंदीदा तारीख़/समय। बस इतना। Gui को निर्देश है कि कभी निदान, लक्षण या क्लिनिकल विवरण न पूछे और न दर्ज करे।"],
      ["एन्क्रिप्शन", "ट्रांज़िट में TLS (Cloudflare edge), स्टोरेज में एन्क्रिप्शन (Supabase/Postgres मैनेज्ड एन्क्रिप्शन)।"],
      ["Tenant अलगाव", "हर व्यवसाय अपने खाते तक सीमित है — हर क्वेरी और म्यूटेशन tenant से बंधा है। tenants के बीच कोई पहुँच नहीं।"],
      ["डिलीशन", "अनुरोध पर संपर्क डेटा हटाया जाता है — smart@guileoai.com पर लिखें या अपने cockpit से माँगें।"],
      ["कॉल/SMS सहमति", "TCPA के अनुरूप: दर्ज ऑप्ट-इन, ऑटोमैटिक STOP, A2P 10DLC पंजीकरण Guileo द्वारा।"],
    ],
    legalNote: LEGAL_NOTE_EN,
    ctaTitle: "अपनी क्लीनिक के लिए सीधा जवाब चाहिए?",
    ctaSub: "बताइए आपकी कंप्लायंस टीम को क्या चाहिए — हम ईमानदारी से बताएँगे कि Guileo आज फ़िट है, आंशिक रूप से फ़िट है, या BAA प्रोग्राम का इंतज़ार बेहतर है।",
    cta: "हमसे बात करें →",
  },
};

const CARD_RGB = ["62,148,104", "214,194,154", "194,168,120"];

export default function HealthCompliance() {
  useSeo({ title: "HIPAA Posture & Health Compliance | Guileo", description: "The honest answer for med spas, dental offices and clinics: Guileo handles scheduling and contact info only — PHI minimized by design, encrypted, tenant-isolated. Not HIPAA-certified today; BAA on the roadmap.", path: "/health-compliance" });
  const { lang } = useLang();
  const L = HC_COPY[lang] || HC_COPY.en;

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />

      <style>{`
        @keyframes hcreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes hcshine{to{background-position:220% center}}
        @keyframes hcfloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-7px) rotate(3deg)}}
        @keyframes hcheart{0%,100%{transform:translateY(0) scale(1);filter:drop-shadow(0 10px 24px rgba(62,148,104,0.45))}50%{transform:translateY(-6px) scale(1.04);filter:drop-shadow(0 14px 30px rgba(62,148,104,0.65))}}
        @keyframes hcpulse{0%,100%{opacity:.55}50%{opacity:1}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      {/* HERO */}
      <header className="relative overflow-hidden px-5 pt-32 pb-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.16),transparent),radial-gradient(680px_360px_at_82%_92%,rgba(214,194,154,0.10),transparent)]" />
        <div className="mx-auto max-w-3xl text-center">
          <div className="select-none text-[56px] leading-none" style={{ animation: "hcheart 4s ease-in-out infinite" }}>🩺</div>
          <div className="mt-5 text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "hcreveal .7s ease both" }}>{L.eyebrow}</div>
          <h1 className="mx-auto mt-4 max-w-2xl font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.8vw,3.4rem)" }}>
            <span className="text-g-word" style={{ animation: "hcreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{L.h1a}</span>
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "hcreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, hcshine 7s linear infinite" }}>{L.h1b}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "hcreveal .8s ease .3s both" }}>{L.sub}</p>
        </div>
      </header>

      {/* 3 CARDS — what we DO */}
      <section className="relative px-5 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-g-gold" style={{ animation: "hcreveal .8s ease both" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-g-green shadow-[0_0_8px_rgba(62,148,104,0.9)]" style={{ animation: "hcpulse 2.2s ease-in-out infinite" }} />
            {L.cardsLabel}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {L.cards.map((c, i) => {
              const rgb = CARD_RGB[i];
              return (
                <div key={i} className="group relative overflow-hidden rounded-2xl border border-g-line bg-white/[0.03] p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05]"
                  style={{ boxShadow: "0 18px 44px -30px rgba(0,0,0,0.85)", animation: `hcreveal .7s cubic-bezier(.2,.7,.2,1) ${0.1 + i * 0.12}s both` }}>
                  <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.85),transparent)` }} />
                  <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ background: `rgba(${rgb},0.12)` }} />
                  <div className="select-none text-[40px] leading-none" style={{ filter: `drop-shadow(0 8px 18px rgba(${rgb},0.5))`, animation: `hcfloat ${3 + i * 0.5}s ease-in-out ${i * 0.3}s infinite` }}>{c.emoji}</div>
                  <h3 className="mt-4 font-black tracking-tight text-g-word" style={{ fontSize: "clamp(1.1rem,2.2vw,1.35rem)" }}>{c.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-g-ink">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HONEST SECTION — what we are NOT yet */}
      <section className="relative px-5 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "#d4a24a", animation: "hcreveal .8s ease both" }}>
            <span className="h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgba(212,162,74,0.9)]" style={{ background: "#d4a24a", animation: "hcpulse 2.2s ease-in-out infinite" }} />
            {L.honestLabel}
          </div>
          <div className="space-y-4">
            {L.honest.map((h, i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl border p-6 backdrop-blur" style={{ borderColor: "rgba(212,162,74,0.35)", background: "rgba(212,162,74,0.05)", boxShadow: "0 18px 44px -30px rgba(0,0,0,0.85)", animation: `hcreveal .7s cubic-bezier(.2,.7,.2,1) ${0.1 + i * 0.12}s both` }}>
                <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: "linear-gradient(180deg,transparent,rgba(212,162,74,0.85),transparent)" }} />
                <h3 className="font-black tracking-tight text-g-word" style={{ fontSize: "clamp(1.05rem,2vw,1.25rem)" }}>{h.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-g-ink">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DATA POSTURE DETAILS */}
      <section className="relative overflow-hidden px-5 py-12">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(640px_300px_at_50%_50%,rgba(62,148,104,0.12),transparent)]" />
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-g-gold" style={{ animation: "hcreveal .8s ease both" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-g-green shadow-[0_0_8px_rgba(62,148,104,0.9)]" style={{ animation: "hcpulse 2.2s ease-in-out infinite" }} />
            {L.detailLabel}
          </div>
          <div className="overflow-hidden rounded-xl3 border border-g-line bg-white/[0.03] backdrop-blur" style={{ animation: "hcreveal .8s ease .1s both" }}>
            {L.details.map(([k, v], i) => (
              <div key={i} className={`grid grid-cols-1 gap-1 p-5 sm:grid-cols-[220px_1fr] sm:gap-6 ${i > 0 ? "border-t border-g-line" : ""}`}>
                <div className="text-[13px] font-black tracking-tight text-g-word">{k}</div>
                <div className="text-[14px] leading-relaxed text-g-ink">{v}</div>
              </div>
            ))}
          </div>
          <p className="mt-6 rounded-xl border border-g-line bg-white/[0.02] p-5 text-[12.5px] leading-relaxed text-g-muted" style={{ animation: "hcreveal .8s ease .2s both" }}>
            {L.legalNote}
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-5 pb-24 pt-6 text-center">
        <div className="mx-auto max-w-xl" style={{ animation: "hcreveal .8s ease both" }}>
          <h2 className="font-black tracking-tight text-g-word" style={{ fontSize: "clamp(1.4rem,3vw,1.9rem)" }}>{L.ctaTitle}</h2>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-g-ink">{L.ctaSub}</p>
          <a href="/#contact" className="group relative mt-7 inline-flex items-center gap-2 overflow-hidden rounded-full px-8 py-3.5 text-[15px] font-extrabold tracking-tight text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform duration-300 hover:scale-[1.03]"
            style={{ background: "linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%)" }}>
            <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" />
            <span className="relative">{L.cta}</span>
          </a>
        </div>
      </section>

      <Footer />
      <VoiceAgent />
    </div>
  );
}
