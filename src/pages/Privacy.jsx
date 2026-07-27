import LegalDoc from "../components/LegalDoc.jsx";
import { useSeo } from "../lib/seo.js";
import { useLang } from "../i18n.jsx";

// Privacy Policy — TEMPLATE. Covers the data realities of an AI voice + marketing
// platform (call recording/transcription, leads, cross-channel messaging) and the
// rights frameworks the site advertises (GDPR / LGPD / CCPA). Lawyer review required.
//
// i18n: full legal body in EN and PT. For ES/HI we translate the page chrome (title,
// headings, "last updated") and show the body in English with an explicit note —
// honest, standard practice; no machine-mangled legal text.

// ---- English (full legal body) ----
const EN_SECTIONS = [
  { h: "Who we are", body: <p>Guileo is a service of <strong>Tribeca Global Inc.</strong>, with operations in New York (USA) and Cuiabá, MT (Brazil). For data-protection purposes, we act as the <strong>controller</strong> of website data and as the <strong>processor</strong> of the data we handle on behalf of our clients.</p> },
  { h: "Data we collect", body: <ul className="space-y-1"><li><strong>Contact:</strong> name, phone, email, company and the channel you choose (WhatsApp, Instagram, etc.).</li><li><strong>Website usage:</strong> anonymous visit counts (page viewed, referring site, language and country) — <strong>no cookies, no IP address and no personal identifiers</strong>; it is not possible to track a person from this data.</li><li><strong>Interactions with the AI (Gui):</strong> call recordings, transcripts and messages, when you or one of our clients uses the voice/chat service.</li><li><strong>Account:</strong> credentials and dashboard settings (Growth Cockpit).</li></ul> },
  { h: "How we use data", body: <ul className="space-y-1"><li>To answer, book, qualify and sell on the client's behalf.</li><li>To operate, improve and personalize the service.</li><li>To contact you about demos and proposals you requested.</li><li>To comply with legal and security obligations.</li></ul> },
  { h: "Voice & AI processing", body: <p>When Gui answers or places calls, the audio may be <strong>recorded and transcribed</strong> to perform the task (book, take an order, qualify a lead) and improve quality. We notify call participants where required by law and offer non-recording options where applicable. We do not sell recordings.</p> },
  { h: "SMS, Calls & Messaging Consent (TCPA / A2P)", body: <div className="space-y-2">
      <p>By providing your phone number (for example, in a website form), you agree to receive communications from Guileo at that number, which may include: <strong>reminders</strong> (booking and confirmation), <strong>follow-ups</strong> and replies, <strong>automated calls placed by our AI (Gui)</strong> and SMS/WhatsApp messages related to the service you requested. As stated in our forms: <em>"I agree to receive an automated call from Guileo at this number. Consent is not a condition of purchase; message/data rates may apply."</em></p>
      <p><strong>Consent is not a condition of any purchase.</strong> Message <strong>frequency</strong> varies with your interaction. <strong>Message and data rates</strong> from your carrier may apply.</p>
      <p><strong>How to opt out:</strong> reply <strong>STOP</strong> to any text message to stop receiving messages; reply <strong>HELP</strong> for help. You may also ask to end calls at any time or write to <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>. Opt-out requests are honored promptly.</p>
      <p className="text-[12.5px] text-g-muted"><strong>For customers in the United States (TCPA / A2P):</strong> By giving us your phone number, you consent to receive calls and text messages from Guileo at that number — including appointment reminders, follow-ups, AI-placed calls, and SMS — sent using automated technology. <strong>Consent is not a condition of any purchase.</strong> Message frequency varies and message and data rates may apply. Reply <strong>STOP</strong> to opt out at any time and <strong>HELP</strong> for help; opt-out requests are honored promptly.</p>
    </div> },
  { h: "Legal basis (GDPR / LGPD)", body: <p>We process data based on: <strong>performance of a contract</strong> (providing the service), <strong>consent</strong> (when you reach out to us), <strong>legitimate interest</strong> (improving and protecting the service) and <strong>legal obligation</strong>.</p> },
  { h: "Sharing", body: <p>We share data only with providers that make the service possible (telephony, hosting, payment processing) under contract, and when required by law. <strong>We do not sell your data.</strong></p> },
  { h: "Retention", body: <p>We keep data for as long as needed to provide the service and comply with the law. You can request deletion at any time (see Your rights).</p> },
  { h: "Security", body: <p>We adopt practices aligned with standards such as <strong>HIPAA, GDPR, LGPD, CCPA and PCI DSS</strong> depending on the client's context: encryption in transit, access control and data governance. No system is 100% immune, but we treat security as a priority.</p> },
  { h: "Your rights (GDPR / LGPD / CCPA)", body: <p>You may access, correct, export, restrict or <strong>delete</strong> your data, and withdraw consent. California residents (CCPA) may opt out of having data "sold" — and we do not sell. To exercise any right, write to <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>.</p> },
  { h: "Cookies", body: <p>We use essential cookies and, with your consent, measurement cookies. You can decline non-essential cookies without losing basic functionality.</p> },
  { h: "Health / HIPAA", body: <p>For healthcare clients, we act as a <strong>Business Associate</strong> and sign a BAA (Business Associate Agreement) whenever protected health information (PHI) is processed. Talk to us before entering PHI into the system.</p> },
  { h: "International transfers", body: <p>We operate between the USA and Brazil; data may be processed in both countries, always with adequate safeguards.</p> },
  { h: "Children", body: <p>The service is not intended for people under 18 and we do not knowingly collect children's data.</p> },
  { h: "Changes", body: <p>We may update this policy. Material changes will be flagged on this page with a new update date.</p> },
  { h: "Contact", body: <p>Data protection / privacy officer: <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>.</p> },
];

// ---- Portuguese (full legal body — original copy, unchanged) ----
const PT_SECTIONS = [
  { h: "Quem somos", body: <p>Guileo é um serviço da <strong>Tribeca Global Inc.</strong>, com operações em New York (EUA) e Cuiabá, MT (Brasil). Para fins de proteção de dados, atuamos como <strong>controlador</strong> dos dados do site e como <strong>operador/processador</strong> dos dados que tratamos em nome dos nossos clientes.</p> },
  { h: "Dados que coletamos", body: <ul className="space-y-1"><li><strong>Contato:</strong> nome, telefone, e-mail, empresa e o canal que você escolhe (WhatsApp, Instagram, etc.).</li><li><strong>Uso do site:</strong> contagem anônima de visitas (página vista, site de origem, idioma e país) — <strong>sem cookies, sem endereço IP e sem identificadores pessoais</strong>; não é possível rastrear uma pessoa por esses dados.</li><li><strong>Interações com a IA (Gui):</strong> gravações de chamadas, transcrições e mensagens, quando você ou um cliente nosso utiliza o serviço de voz/chat.</li><li><strong>Conta:</strong> credenciais e configurações do painel (Growth Cockpit).</li></ul> },
  { h: "Como usamos os dados", body: <ul className="space-y-1"><li>Para responder, agendar, qualificar e vender em nome do cliente.</li><li>Para operar, melhorar e personalizar o serviço.</li><li>Para entrar em contato sobre demonstrações e propostas que você solicitou.</li><li>Para cumprir obrigações legais e de segurança.</li></ul> },
  { h: "Processamento de voz e IA", body: <p>Quando a Gui atende ou faz chamadas, o áudio pode ser <strong>gravado e transcrito</strong> para executar a tarefa (agendar, registrar pedido, qualificar lead) e melhorar a qualidade. Avisamos os interlocutores quando exigido por lei e oferecemos opções de não-gravação onde aplicável. Não vendemos gravações.</p> },
  { h: "Consentimento de SMS, Chamadas e Mensagens (TCPA / A2P)", body: <div className="space-y-2">
      <p>Ao fornecer seu número de telefone (por exemplo, em um formulário do site), você concorda em receber comunicações da Guileo nesse número, que podem incluir: <strong>lembretes</strong> (de agendamento e confirmação), <strong>follow-ups</strong> e respostas, <strong>chamadas automáticas feitas pela nossa IA (Gui)</strong> e mensagens de SMS/WhatsApp relacionadas ao serviço que você solicitou. Conforme nossos formulários: <em>"Concordo em receber uma ligação automática da Guileo neste número. O consentimento não é condição de compra; podem aplicar tarifas de mensagem/dados."</em></p>
      <p>O <strong>consentimento não é condição para qualquer compra</strong>. A <strong>frequência</strong> das mensagens varia conforme sua interação. <strong>Podem aplicar-se tarifas de mensagem e dados</strong> da sua operadora.</p>
      <p><strong>Como sair (opt-out):</strong> responda <strong>STOP</strong> (ou PARAR) a qualquer mensagem de texto para deixar de receber mensagens; responda <strong>HELP</strong> (ou AJUDA) para obter ajuda. Você também pode pedir para encerrar chamadas a qualquer momento ou escrever para <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>. Solicitações de opt-out são honradas prontamente.</p>
      <p className="text-[12.5px] text-g-muted"><strong>For customers in the United States (TCPA / A2P):</strong> By giving us your phone number, you consent to receive calls and text messages from Guileo at that number — including appointment reminders, follow-ups, AI-placed calls, and SMS — sent using automated technology. <strong>Consent is not a condition of any purchase.</strong> Message frequency varies and message and data rates may apply. Reply <strong>STOP</strong> to opt out at any time and <strong>HELP</strong> for help; opt-out requests are honored promptly.</p>
    </div> },
  { h: "Base legal (GDPR / LGPD)", body: <p>Tratamos dados com base em: <strong>execução de contrato</strong> (prestar o serviço), <strong>consentimento</strong> (quando você nos procura), <strong>legítimo interesse</strong> (melhorar e proteger o serviço) e <strong>obrigação legal</strong>.</p> },
  { h: "Compartilhamento", body: <p>Compartilhamos dados apenas com provedores que viabilizam o serviço (telefonia, hospedagem, processamento de pagamento) sob contrato, e quando exigido por lei. <strong>Não vendemos seus dados.</strong></p> },
  { h: "Retenção", body: <p>Guardamos os dados pelo tempo necessário para prestar o serviço e cumprir a lei. Você pode pedir a exclusão a qualquer momento (ver Direitos).</p> },
  { h: "Segurança", body: <p>Adotamos práticas alinhadas a padrões como <strong>HIPAA, GDPR, LGPD, CCPA e PCI DSS</strong> conforme o contexto do cliente: criptografia em trânsito, controle de acesso e governança de dados. Nenhum sistema é 100% imune, mas tratamos a segurança como prioridade.</p> },
  { h: "Seus direitos (GDPR / LGPD / CCPA)", body: <p>Você pode acessar, corrigir, exportar, restringir ou <strong>excluir</strong> seus dados, e revogar consentimento. Residentes da Califórnia (CCPA) podem optar por não ter dados "vendidos" — e nós não vendemos. Para exercer qualquer direito, escreva para <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>.</p> },
  { h: "Cookies", body: <p>Usamos cookies essenciais e, com seu consentimento, cookies de medição. Você pode recusar os não-essenciais sem perder funcionalidade básica.</p> },
  { h: "Saúde / HIPAA", body: <p>Para clientes da área de saúde, atuamos como <strong>Business Associate</strong> e firmamos um BAA (Business Associate Agreement) quando há tratamento de dados protegidos de saúde (PHI). Fale conosco antes de inserir PHI no sistema.</p> },
  { h: "Transferências internacionais", body: <p>Operamos entre EUA e Brasil; dados podem ser tratados em ambos os países, sempre com salvaguardas adequadas.</p> },
  { h: "Crianças", body: <p>O serviço não é destinado a menores de 18 anos e não coletamos dados de crianças intencionalmente.</p> },
  { h: "Alterações", body: <p>Podemos atualizar esta política. Mudanças relevantes serão sinalizadas nesta página com nova data de atualização.</p> },
  { h: "Contato", body: <p>Encarregado de dados / privacidade: <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>.</p> },
];

// ---- ES / HI: translated headings over the official English body ----
const ES_HEADINGS = ["Quiénes somos", "Datos que recopilamos", "Cómo usamos los datos", "Procesamiento de voz e IA", "Consentimiento de SMS, Llamadas y Mensajes (TCPA / A2P)", "Base legal (GDPR / LGPD)", "Con quién compartimos", "Retención", "Seguridad", "Tus derechos (GDPR / LGPD / CCPA)", "Cookies", "Salud / HIPAA", "Transferencias internacionales", "Menores", "Cambios", "Contacto"];
const HI_HEADINGS = ["हम कौन हैं", "हम कौन-सा डेटा एकत्र करते हैं", "हम डेटा का उपयोग कैसे करते हैं", "वॉइस & AI प्रोसेसिंग", "SMS, कॉल & संदेश सहमति (TCPA / A2P)", "कानूनी आधार (GDPR / LGPD)", "साझाकरण", "डेटा प्रतिधारण", "सुरक्षा", "आपके अधिकार (GDPR / LGPD / CCPA)", "कुकीज़", "स्वास्थ्य / HIPAA", "अंतरराष्ट्रीय स्थानांतरण", "बच्चे", "परिवर्तन", "संपर्क"];

const D = {
  en: {
    title: "Privacy Policy",
    updated: "June 9, 2026",
    note: <>ℹ️ A summary of how we handle data, in line with <span className="font-bold text-g-word">LGPD, GDPR and CCPA</span>. For clients, the signed agreement and any DPA/BAA supplement this notice.</>,
    intro: <>Guileo (operated by Tribeca Global Inc., "Guileo", "we") respects your privacy. This policy explains what data we collect, how we use it, and what your rights are when you use the guileoai.com website and our AI, voice and marketing services.</>,
    sections: EN_SECTIONS,
  },
  pt: {
    title: "Política de Privacidade",
    updated: "9 de junho de 2026",
    note: <>ℹ️ Resumo de como tratamos dados, conforme <span className="font-bold text-g-word">LGPD, GDPR e CCPA</span>. Para clientes, o contrato assinado e eventual DPA/BAA complementam este aviso.</>,
    intro: <>A Guileo (operada pela Tribeca Global Inc., "Guileo", "nós") respeita a sua privacidade. Esta política explica quais dados coletamos, como usamos e quais são os seus direitos ao usar o site guileoai.com e os nossos serviços de IA, voz e marketing.</>,
    sections: PT_SECTIONS,
  },
  es: {
    title: "Política de Privacidad",
    updated: "9 de junio de 2026",
    note: <>ℹ️ Resumen de cómo tratamos los datos, conforme a <span className="font-bold text-g-word">LGPD, GDPR y CCPA</span>. <span className="block mt-1 font-bold">Versión legal oficial en inglés — el texto de las secciones se muestra en inglés.</span></>,
    intro: <>Guileo (operada por Tribeca Global Inc., "Guileo", "nosotros") respeta tu privacidad. Esta política explica qué datos recopilamos, cómo los usamos y cuáles son tus derechos al usar guileoai.com y nuestros servicios de IA, voz y marketing.</>,
    sections: EN_SECTIONS.map((s, i) => ({ h: ES_HEADINGS[i] || s.h, body: s.body })),
  },
  hi: {
    title: "गोपनीयता नीति",
    updated: "9 जून 2026",
    note: <>ℹ️ हम डेटा कैसे संभालते हैं इसका सारांश — <span className="font-bold text-g-word">LGPD, GDPR और CCPA</span> के अनुरूप। <span className="block mt-1 font-bold">आधिकारिक कानूनी संस्करण अंग्रेज़ी में है — अनुभागों का पाठ अंग्रेज़ी में दिखाया गया है।</span></>,
    intro: <>Guileo (Tribeca Global Inc. द्वारा संचालित, "Guileo", "हम") आपकी गोपनीयता का सम्मान करता है। यह नीति बताती है कि guileoai.com और हमारी AI, वॉइस & मार्केटिंग सेवाओं के उपयोग में हम कौन-सा डेटा एकत्र करते हैं, कैसे उपयोग करते हैं और आपके अधिकार क्या हैं।</>,
    sections: EN_SECTIONS.map((s, i) => ({ h: HI_HEADINGS[i] || s.h, body: s.body })),
  },
};

export default function Privacy() {
  const { lang } = useLang();
  const c = D[lang] || D.en;
  useSeo({ title: "Privacy Policy | Guileo", description: "How Guileo (Tribeca Global Inc.) collects, uses and protects your data — LGPD, GDPR and CCPA aligned.", path: "/privacy" });
  return (
    <LegalDoc
      title={c.title}
      updated={c.updated}
      note={c.note}
      intro={c.intro}
      sections={c.sections}
    />
  );
}
