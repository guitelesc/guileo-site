import LegalDoc from "../components/LegalDoc.jsx";
import { useSeo } from "../lib/seo.js";
import { useLang } from "../i18n.jsx";
import { NOME_DO_PAINEL } from "../portal/nome.js";

// Contact / company info page — satisfies the EU/UK "Impressum" expectation and the LGPD/GDPR/CCPA
// requirement to give data subjects a clear way to reach the controller (DSAR, opt-out, questions).
// Info is grounded in the Privacy Policy (ORIGEM LTDA; New York, USA + Cuiabá, MT, Brazil).

const EN_SECTIONS = [
  { h: "Company", body: <p>Guileo is a service of <strong>ORIGEM LTDA</strong>, operating from <strong>New York, USA</strong> and <strong>Cuiabá, MT, Brazil</strong>.</p> },
  { h: "Talk to us", body: <ul className="space-y-1"><li><strong>Sales & general:</strong> <a href="mailto:smart@guileoai.com">smart@guileoai.com</a></li><li><strong>Support (existing clients):</strong> the <a href="/portal">{NOME_DO_PAINEL}</a> → Support, or <a href="mailto:smart@guileoai.com">smart@guileoai.com</a></li><li><strong>WhatsApp / phone:</strong> use the "let Gui call you" button on the <a href="/">home page</a> — a real human follows up.</li></ul> },
  { h: "Privacy & data requests (LGPD / GDPR / CCPA)", body: <p>To access, correct, export or delete your data, opt out, or ask a privacy question, write to our data-protection contact at <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>. See our <a href="/privacy">Privacy Policy</a> for your full rights.</p> },
  { h: "Response time", body: <p>We usually reply within a few business hours. For urgent account or billing issues, put "URGENT" in the subject line.</p> },
];

const PT_SECTIONS = [
  { h: "Empresa", body: <p>Guileo é um serviço da <strong>ORIGEM LTDA</strong>, com operação em <strong>New York, EUA</strong> e <strong>Cuiabá, MT, Brasil</strong>.</p> },
  { h: "Fale com a gente", body: <ul className="space-y-1"><li><strong>Vendas & geral:</strong> <a href="mailto:smart@guileoai.com">smart@guileoai.com</a></li><li><strong>Suporte (clientes):</strong> no <a href="/portal">{NOME_DO_PAINEL}</a> → Suporte, ou <a href="mailto:smart@guileoai.com">smart@guileoai.com</a></li><li><strong>WhatsApp / telefone:</strong> use o botão "deixe a Gui te ligar" na <a href="/">página inicial</a> — um humano de verdade retorna.</li></ul> },
  { h: "Privacidade & dados (LGPD / GDPR / CCPA)", body: <p>Para acessar, corrigir, exportar ou excluir seus dados, sair (opt-out) ou tirar uma dúvida de privacidade, escreva ao nosso contato de proteção de dados: <a href="mailto:smart@guileoai.com">smart@guileoai.com</a>. Veja a <a href="/privacy">Política de Privacidade</a> para todos os seus direitos.</p> },
  { h: "Tempo de resposta", body: <p>Normalmente respondemos em poucas horas úteis. Para conta ou cobrança urgente, coloque "URGENTE" no assunto.</p> },
];

const ES_HEADINGS = ["Empresa", "Habla con nosotros", "Privacidad y datos (LGPD / GDPR / CCPA)", "Tiempo de respuesta"];
const HI_HEADINGS = ["कंपनी", "हमसे बात करें", "गोपनीयता व डेटा (LGPD / GDPR / CCPA)", "जवाब का समय"];

const D = {
  en: { title: "Contact Guileo", updated: "July 21, 2026", note: <>ℹ️ How to reach a real human — sales, support, and privacy requests.</>, intro: <>We're a small team that answers fast. Here's every way to reach us.</>, sections: EN_SECTIONS },
  pt: { title: "Contato", updated: "21 de julho de 2026", note: <>ℹ️ Como falar com um humano de verdade — vendas, suporte e pedidos de privacidade.</>, intro: <>Somos um time enxuto que responde rápido. Aqui estão todos os canais pra falar com a gente.</>, sections: PT_SECTIONS },
  es: { title: "Contacto", updated: "21 de julio de 2026", note: <>ℹ️ Cómo llegar a un humano real — ventas, soporte y solicitudes de privacidad.</>, intro: <>Somos un equipo pequeño que responde rápido. Aquí tienes todas las formas de contactarnos.</>, sections: EN_SECTIONS.map((s, i) => ({ h: ES_HEADINGS[i] || s.h, body: s.body })) },
  hi: { title: "संपर्क करें", updated: "21 जुलाई 2026", note: <>ℹ️ असली इंसान तक कैसे पहुँचें — बिक्री, सहायता और गोपनीयता अनुरोध।</>, intro: <>हम एक छोटी टीम हैं जो तेज़ी से जवाब देती है। हम तक पहुँचने के सभी तरीके यहाँ हैं।</>, sections: EN_SECTIONS.map((s, i) => ({ h: HI_HEADINGS[i] || s.h, body: s.body })) },
};

export default function Contact() {
  const { lang } = useLang();
  const c = D[lang] || D.en;
  useSeo({ title: "Contact | Guileo", description: "Reach Guileo (ORIGEM LTDA) — sales, client support, and LGPD/GDPR/CCPA privacy requests.", path: "/contact" });
  return <LegalDoc title={c.title} updated={c.updated} note={c.note} intro={c.intro} sections={c.sections} />;
}
