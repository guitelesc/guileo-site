import LegalDoc from "../components/LegalDoc.jsx";
import { useSeo } from "../lib/seo.js";
import { useLang } from "../i18n.jsx";

// Terms of Service — resumo dos termos PADRÃO da Guileo, alinhado às 12 cláusulas
// reais dos contratos (src/data/contratos.js). O contrato assinado prevalece.
//
// i18n: full legal body in EN and PT. For ES/HI we translate the page chrome (title,
// headings, "last updated") and show the body in English with an explicit note —
// honest, standard practice; no machine-mangled legal text.

// ---- English (full legal body) ----
const EN_SECTIONS = [
  { h: "Scope of services", body: <p>Guileo provides the services described in the scope of the proposal/agreement (AI & automation, websites, apps, software, marketing, media, consulting and the like). Services not listed constitute a <strong>change order</strong>, formalized in writing before execution.</p> },
  { h: "Account and eligibility", body: <p>By contracting, you confirm you are <strong>18 or older</strong> and authorized to bind the business you represent. You are responsible for safeguarding your credentials and for all activity under your account.</p> },
  { h: "Fees and payment", body: <p>Terms as per the proposal. Defaults: late payment accrues interest of <strong>1%/month</strong> pro rata die + a 2% penalty, IPCA adjustment from the 30th day, and annual IPCA adjustment on retainers. We accept PIX/TED/boleto and <strong>USD via Wise/Stripe</strong> at the BACEN exchange rate. Service invoices (NFS-e) within 5 business days.</p> },
  { h: "Plans, credits and billing", body: <ul className="space-y-1"><li>Recurring services (retainers/AI) are billed <strong>monthly in advance</strong>.</li><li>Credits meter what Gui executes (calls, messages, actions); extra credits can be purchased.</li><li>Billing recurs until cancellation.</li></ul> },
  { h: "Suspension and non-payment", body: <p>Non-payment beyond 5 business days authorizes suspension with 24h notice; beyond 15 days it may lead to termination. Reactivation upon settlement and any applicable fee.</p> },
  { h: "Revisions and change orders", body: <p>A revision is an adjustment within the approved concept. A change of concept is a paid change order. Feedback within 48h — <strong>silence constitutes tacit approval</strong>; formal approval freezes the deliverable.</p> },
  { h: "Commercial guarantee", body: <p>The commercial offer may include a <strong>30-day guarantee</strong>; refund and termination conditions follow the signed agreement (summarized under "Termination"). Defects reported within 15 days are fixed at no cost.</p> },
  { h: "Intellectual property", body: <p>Work remains Guileo's until full payment. Rights to creative materials transfer upon payment (Brazilian Law 9.610/98); delivered code carries a <strong>perpetual, exclusive license</strong>. Your data remains <strong>yours</strong>. Portfolio use is permitted unless confidentiality is agreed in writing.</p> },
  { h: "Confidentiality", body: <p><strong>Mutual confidentiality for 3 years</strong> covering data, strategies, code and pricing. Exceptions: public information, court order or written authorization.</p> },
  { h: "AI disclaimer", body: <p>Gui is a human-supervised artificial intelligence and <strong>can make mistakes</strong>. You are responsible for reviewing critical outputs (legal, health, financial). We are not liable for decisions made solely on the basis of the AI.</p> },
  { h: "Third-party services", body: <p>The platform relies on third-party services (e.g. Stripe, Twilio, ElevenLabs, Meta, Google, Supabase). Their availability, pricing or policy changes are outside our control and are not Guileo's responsibility.</p> },
  { h: "Data protection and privacy", body: <p>Data is handled per our <a href="/privacy">Privacy Policy</a> (multi-tenant isolation, encryption and consent model). A <strong>DPA/BAA is available on request</strong>. <strong>You are responsible</strong> for obtaining your customers' lawful consents — including <strong>TCPA/A2P</strong> for automated calls and SMS (see the consent section in the Privacy Policy).</p> },
  // SEÇÃO EXIGIDA PELA OPERADORA (A2P 10DLC). A Twilio pede que a URL de Terms informada na
  // campanha contenha: nome do programa, descrição, tarifas, FREQUÊNCIA, contato de suporte e
  // instruções de opt-out com HELP e STOP em NEGRITO. O revisor abre esta página pra conferir.
  // Sem isto a campanha reprova — foi o que aconteceu em 16/06/2026.
  { h: "SMS messaging program (US)", body: <div className="space-y-2">
    <p><strong>Program name:</strong> Guileo (operated by TRANSPOINT). <strong>Description:</strong> transactional and customer-care text messages — appointment reminders and confirmations, missed-call text-backs, lead follow-ups, review requests and re-engagement.</p>
    <p><strong>How to join:</strong> you opt in by checking the consent box on a form at guileoai.com, or by giving your number and agreeing during a phone call. Consent is <strong>never a condition of purchase</strong>. We do not buy, rent or upload third-party lists.</p>
    <p><strong>Message frequency varies</strong> by how you interact with us — typically a few messages per appointment or enquiry. <strong>Message and data rates may apply.</strong></p>
    <p>Reply <strong>STOP</strong> to any message to opt out at any time; you will receive one confirmation and no further messages. Reply <strong>HELP</strong> for help, or contact us at <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>. Carriers are not liable for delayed or undelivered messages. See our <a href="/privacy">Privacy Policy</a>.</p>
  </div> },
  { h: "Warranties, results and limitation of liability", body: <p>The service is provided <strong>AS-IS</strong>, without warranty of any specific outcome. Any metrics, gains or figures shown in our marketing are <strong>illustrative</strong> and do not constitute a promise of performance — <strong>results are not guaranteed</strong> and vary by your market, offer and execution. The actual guarantee we offer is the <strong>30-day money-back guarantee</strong> described under "Commercial guarantee." To the maximum extent permitted by law, liability is limited to the fees paid for the <strong>last 3 months</strong> of service. Excluded: business results, lost profits and third-party failures. Two-year limitation period for claims.</p> },
  { h: "Indemnification", body: <p>Each party will indemnify the other for damages arising from breach of these Terms, of law, or of third-party rights. You indemnify Guileo, in particular, for claims related to the content, data or consents you provided.</p> },
  { h: "Force majeure", body: <p>Neither party is liable for delays or failures caused by events beyond its reasonable control (disasters, provider outages, government action, internet failures).</p> },
  { h: "Termination", body: <p><strong>Projects:</strong> termination without cause by the client does not refund the deposit; if over 50% complete, the balance plus a 20% penalty is due. <strong>Retainers:</strong> 30 days' notice; a 1-month penalty applies if before 3 months. Files are delivered upon full payment.</p> },
  { h: "Acceptable use", body: <p>You agree not to use the service for spam, fraud or illegal content, and you are responsible for obtaining the necessary consents from your customers (e.g. call recording).</p> },
  { h: "Non-solicitation", body: <p>For 12 months, the client will not directly hire team members without written consent.</p> },
  { h: "Governing law and venue", body: <div className="space-y-2">
      {/* COUNSEL: region-split governing law for US + Brazil launch. Confirm NY choice-of-law/venue and CAMARB seat before go-live. */}
      <p><strong>For customers in the United States:</strong> these Terms are governed by the laws of the <strong>State of New York (USA)</strong>, without regard to conflict-of-laws rules, and any disputes will be resolved in the state or federal courts located in <strong>New York, NY</strong>.</p>
      <p><strong>For customers in Brazil:</strong> Brazilian law applies (CC/2002, Law 9.610/98, <strong>LGPD</strong>) and the international standards GDPR, CCPA and CISG where applicable. Arbitration at CAMARB, seated in Cuiabá-MT; disputes above USD 50k at the ICC São Paulo. Venue: <strong>Cuiabá, MT</strong>.</p>
    </div> },
  { h: "General provisions", body: <p>These Terms (together with the signed agreement) constitute the <strong>entire agreement</strong> between the parties. If any provision is held invalid, the rest remain in effect. Tolerance of a breach does not imply waiver. You may not assign this agreement without our consent; we may assign it to a successor. Notice by email is valid.</p> },
  { h: "Changes and contact", body: <p>We may update these Terms; material changes will carry a new date. Questions: <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>.</p> },
];

// ---- Portuguese (full legal body — original copy, unchanged) ----
const PT_SECTIONS = [
  { h: "Objeto", body: <p>A Guileo presta os serviços descritos no escopo da proposta/contrato (IA & automação, sites, apps, software, marketing, mídia, consultoria e afins). Serviços não listados constituem <strong>change order</strong>, formalizado por escrito antes da execução.</p> },
  { h: "Conta e elegibilidade", body: <p>Ao contratar, você declara ter <strong>18 anos ou mais</strong> e autoridade para vincular a empresa que representa. Você é responsável por manter a confidencialidade do seu acesso e por toda atividade na sua conta.</p> },
  { h: "Valor e pagamento", body: <p>Condições conforme a proposta. Padrões: atraso gera juros de <strong>1%/mês</strong> pro rata die + multa de 2%, correção pelo IPCA a partir do 30º dia, e reajuste anual pelo IPCA em retainers. Aceitamos PIX/TED/boleto e <strong>USD via Wise/Stripe</strong> ao câmbio BACEN. NFS-e em até 5 dias úteis.</p> },
  { h: "Planos, créditos e cobrança", body: <ul className="space-y-1"><li>Serviços recorrentes (retainers/IA) são <strong>mensais antecipados</strong>.</li><li>Créditos medem o que a Gui executa (chamadas, mensagens, ações); créditos extras podem ser adquiridos.</li><li>A cobrança é recorrente até o cancelamento.</li></ul> },
  { h: "Suspensão e inadimplência", body: <p>Inadimplência superior a 5 dias úteis autoriza suspensão com aviso de 24h; acima de 15 dias pode levar à rescisão. Reativação mediante quitação e taxa aplicável.</p> },
  { h: "Revisões e change orders", body: <p>Revisão é ajuste dentro do conceito aprovado. Mudança de conceito é change order pago. Retorno em até 48h — <strong>silêncio equivale a aprovação tácita</strong>; a aprovação formal congela o entregável.</p> },
  { h: "Garantia comercial", body: <p>A oferta comercial pode incluir <strong>garantia de 30 dias</strong>; as condições de reembolso e rescisão seguem o contrato assinado (resumidas em "Rescisão"). Defeitos reportados em até 15 dias são corrigidos sem custo.</p> },
  { h: "Propriedade intelectual", body: <p>O trabalho permanece da Guileo até a quitação. Materiais criativos têm direitos transferidos após o pagamento (Lei 9.610/98); código entregue com <strong>licença perpétua e exclusiva</strong>. Seus dados continuam <strong>seus</strong>. Uso em portfólio permitido salvo sigilo por escrito.</p> },
  { h: "Confidencialidade", body: <p>Sigilo <strong>bidirecional por 3 anos</strong> sobre dados, estratégias, código e valores. Exceções: informação pública, exigência judicial ou autorização escrita.</p> },
  { h: "Aviso sobre a IA", body: <p>A Gui é uma inteligência artificial supervisionada por humanos e <strong>pode cometer erros</strong>. Você é responsável por revisar resultados críticos (jurídicos, de saúde, financeiros). Não respondemos por decisões tomadas exclusivamente com base na IA.</p> },
  { h: "Serviços de terceiros", body: <p>A plataforma integra serviços de terceiros (ex.: Stripe, Twilio, ElevenLabs, Meta, Google, Supabase). A disponibilidade, alterações de preço ou de políticas desses provedores estão fora do nosso controle e não constituem responsabilidade da Guileo.</p> },
  { h: "Proteção de dados e privacidade", body: <p>O tratamento de dados segue nossa <a href="/privacy">Política de Privacidade</a> (isolamento multi-tenant, criptografia e modelo de consentimento). Um <strong>DPA/BAA está disponível mediante solicitação</strong>. <strong>Você é responsável</strong> por obter os consentimentos legais dos seus clientes — incluindo <strong>TCPA/A2P</strong> para chamadas e SMS automatizados (ver a seção de consentimento na Política de Privacidade).</p> },
  // Espelho PT da seção exigida pela operadora — o revisor lê a versão EN, mas a página é
  // trilíngue e a informação não pode existir só num idioma.
  { h: "Programa de mensagens SMS (EUA)", body: <div className="space-y-2">
    <p><strong>Nome do programa:</strong> Guileo (operado por TRANSPOINT). <strong>Descrição:</strong> mensagens transacionais e de atendimento — lembretes e confirmações de agendamento, retorno de chamada perdida, follow-up de lead, pedidos de avaliação e reativação.</p>
    <p><strong>Como entrar:</strong> você aceita marcando a caixa de consentimento num formulário do guileoai.com, ou informando seu número e concordando durante uma ligação. O consentimento <strong>nunca é condição de compra</strong>. Não compramos, alugamos nem importamos listas de terceiros.</p>
    <p><strong>A frequência de mensagens varia</strong> conforme sua interação — normalmente algumas mensagens por atendimento. <strong>Podem incidir tarifas de mensagem e dados.</strong></p>
    <p>Responda <strong>STOP</strong> em qualquer mensagem para sair a qualquer momento; você recebe uma confirmação e nenhuma mensagem depois disso. Responda <strong>HELP</strong> para ajuda, ou fale com a gente em <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>. As operadoras não se responsabilizam por mensagens atrasadas ou não entregues. Veja nossa <a href="/privacy">Política de Privacidade</a>.</p>
  </div> },
  { h: "Garantias, resultados e limitação de responsabilidade", body: <p>O serviço é fornecido <strong>"no estado em que se encontra" (AS-IS)</strong>, sem garantia de resultado específico. Quaisquer métricas, ganhos ou números mostrados em nosso marketing são <strong>ilustrativos</strong> e não constituem promessa de desempenho — <strong>resultados não são garantidos</strong> e variam conforme seu mercado, oferta e execução. A garantia efetiva que oferecemos é a <strong>garantia de reembolso de 30 dias</strong> descrita em "Garantia comercial". Responsabilidade limitada ao <strong>valor dos últimos 3 meses</strong> de serviço. Excluídos: resultados de negócio, lucros cessantes e falhas de terceiros. Prazo prescricional de 2 anos.</p> },
  { h: "Indenização", body: <p>Cada parte indenizará a outra por danos decorrentes de violação destes Termos, da lei ou de direitos de terceiros. Você nos indeniza, em especial, por reclamações ligadas ao conteúdo, dados ou consentimentos que você forneceu.</p> },
  { h: "Força maior", body: <p>Nenhuma parte responde por atrasos ou falhas causados por eventos fora de seu controle razoável (desastres, panes de provedores, ações governamentais, falhas de internet).</p> },
  { h: "Rescisão", body: <p><strong>Projetos:</strong> rescisão sem justa causa pelo contratante não reembolsa a entrada; acima de 50% concluído, devido o saldo + multa de 20%. <strong>Retainers:</strong> 30 dias de aviso; multa de 1 mês se antes de 3 meses. Arquivos entregues mediante quitação.</p> },
  { h: "Uso aceitável", body: <p>Você concorda em não usar o serviço para spam, fraude ou conteúdo ilegal, e é responsável por obter os consentimentos necessários dos seus clientes (ex.: gravação de chamadas).</p> },
  { h: "Não contratação", body: <p>Por 12 meses, o contratante não contratará diretamente membros da equipe sem consentimento escrito.</p> },
  { h: "Lei aplicável e foro", body: <div className="space-y-2">
      {/* COUNSEL: region-split governing law for US + Brazil launch. Confirm NY choice-of-law/venue and CAMARB seat before go-live. */}
      <p><strong>Para clientes nos Estados Unidos:</strong> estes Termos são regidos pelas leis do <strong>Estado de Nova York (EUA)</strong>, sem considerar regras de conflito de leis, e quaisquer disputas serão resolvidas nos tribunais estaduais ou federais localizados em <strong>Nova York, NY</strong>.</p>
      <p><strong>Para clientes no Brasil:</strong> aplica-se a lei brasileira (CC/2002, Lei 9.610/98, <strong>LGPD</strong>) e os padrões internacionais GDPR, CCPA e CISG quando aplicável. Arbitragem na CAMARB, sede em Cuiabá-MT; disputas acima de USD 50k na ICC São Paulo. Foro: <strong>Cuiabá, MT</strong>.</p>
    </div> },
  { h: "Disposições gerais", body: <p>Estes Termos (em conjunto com o contrato assinado) constituem o <strong>acordo integral</strong> entre as partes. Se alguma cláusula for considerada inválida, as demais permanecem em vigor. A tolerância no descumprimento não implica renúncia. Você não pode ceder este contrato sem nosso consentimento; podemos cedê-lo a um sucessor. Notificações por e-mail são válidas.</p> },
  { h: "Alterações e contato", body: <p>Podemos atualizar estes Termos; mudanças relevantes terão nova data. Dúvidas: <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>.</p> },
];

// ---- ES / HI: translated headings over the official English body ----
const ES_HEADINGS = ["Objeto", "Cuenta y elegibilidad", "Precio y pago", "Planes, créditos y facturación", "Suspensión e impago", "Revisiones y change orders", "Garantía comercial", "Propiedad intelectual", "Confidencialidad", "Aviso sobre la IA", "Servicios de terceros", "Protección de datos y privacidad", "Programa de mensajes SMS (EE. UU.)", "Garantías, resultados y limitación de responsabilidad", "Indemnización", "Fuerza mayor", "Terminación", "Uso aceptable", "No contratación", "Ley aplicable y jurisdicción", "Disposiciones generales", "Cambios y contacto"];
const HI_HEADINGS = ["सेवाओं का दायरा", "खाता और पात्रता", "शुल्क और भुगतान", "प्लान, क्रेडिट और बिलिंग", "निलंबन और भुगतान-चूक", "संशोधन और चेंज ऑर्डर", "व्यावसायिक गारंटी", "बौद्धिक संपदा", "गोपनीयता (Confidentiality)", "AI संबंधी सूचना", "थर्ड-पार्टी सेवाएँ", "डेटा संरक्षण और गोपनीयता", "SMS मैसेजिंग प्रोग्राम (US)", "वारंटी, परिणाम और दायित्व की सीमा", "क्षतिपूर्ति", "अप्रत्याशित घटना (Force majeure)", "समाप्ति", "स्वीकार्य उपयोग", "प्रत्यक्ष नियुक्ति निषेध", "लागू कानून और क्षेत्राधिकार", "सामान्य प्रावधान", "परिवर्तन और संपर्क"];

const D = {
  en: {
    title: "Terms of Service",
    updated: "June 9, 2026",
    note: <>ℹ️ This is a <span className="font-bold text-g-word">summary of Guileo's standard terms</span>. The signed services agreement between the parties prevails over this summary.</>,
    intro: <>These Terms summarize Guileo's (Tribeca Global Inc.) standard service conditions. The signed services agreement between the parties, with its scope and 12 clauses, prevails over this summary. <span className="block mt-2 text-g-muted">Guileo serves customers in the United States (US$ pricing) and in Brazil; the governing-law clause below is split by region.</span></>,
    sections: EN_SECTIONS,
  },
  pt: {
    title: "Termos de Serviço",
    updated: "9 de junho de 2026",
    note: <>ℹ️ Este é um <span className="font-bold text-g-word">resumo dos termos padrão da Guileo</span>. O contrato assinado entre as partes prevalece.</>,
    intro: <>Estes Termos resumem as condições padrão de prestação de serviços da Guileo (Tribeca Global Inc.). O contrato de prestação de serviços assinado entre as partes, com seu escopo e 12 cláusulas, prevalece sobre este resumo. <span className="block mt-2 text-g-muted">A Guileo atende clientes nos Estados Unidos (preços em US$) e no Brasil; a cláusula de lei aplicável abaixo é dividida por região.</span></>,
    sections: PT_SECTIONS,
  },
  es: {
    title: "Términos de Servicio",
    updated: "9 de junio de 2026",
    note: <>ℹ️ Este es un <span className="font-bold text-g-word">resumen de los términos estándar de Guileo</span>. El contrato firmado entre las partes prevalece. <span className="block mt-1 font-bold">Versión legal oficial en inglés — el texto de las secciones se muestra en inglés.</span></>,
    intro: <>Estos Términos resumen las condiciones estándar de servicio de Guileo (Tribeca Global Inc.). El contrato de servicios firmado entre las partes prevalece sobre este resumen. <span className="block mt-2 text-g-muted">Guileo atiende clientes en Estados Unidos (precios en US$) y en Brasil; la cláusula de ley aplicable está dividida por región.</span></>,
    sections: EN_SECTIONS.map((s, i) => ({ h: ES_HEADINGS[i] || s.h, body: s.body })),
  },
  hi: {
    title: "सेवा की शर्तें",
    updated: "9 जून 2026",
    note: <>ℹ️ यह Guileo की <span className="font-bold text-g-word">मानक शर्तों का सारांश</span> है। पक्षों के बीच हस्ताक्षरित अनुबंध प्रभावी रहेगा। <span className="block mt-1 font-bold">आधिकारिक कानूनी संस्करण अंग्रेज़ी में है — अनुभागों का पाठ अंग्रेज़ी में दिखाया गया है।</span></>,
    intro: <>ये शर्तें Guileo (Tribeca Global Inc.) की मानक सेवा शर्तों का सारांश हैं। पक्षों के बीच हस्ताक्षरित सेवा अनुबंध इस सारांश पर प्रभावी रहेगा। <span className="block mt-2 text-g-muted">Guileo संयुक्त राज्य अमेरिका (US$ मूल्य) और ब्राज़ील में ग्राहकों को सेवा देता है; नीचे लागू-कानून खंड क्षेत्र के अनुसार विभाजित है।</span></>,
    sections: EN_SECTIONS.map((s, i) => ({ h: HI_HEADINGS[i] || s.h, body: s.body })),
  },
};

export default function Terms() {
  const { lang } = useLang();
  const c = D[lang] || D.en;
  useSeo({ title: "Terms of Service | Guileo", description: "The standard terms that govern Guileo's products and services in the US and Brazil.", path: "/terms" });
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
