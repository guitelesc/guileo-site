import LegalDoc from "../components/LegalDoc.jsx";

// Privacy Policy — TEMPLATE. Covers the data realities of an AI voice + marketing
// platform (call recording/transcription, leads, cross-channel messaging) and the
// rights frameworks the site advertises (GDPR / LGPD / CCPA). Lawyer review required.

export default function Privacy() {
  return (
    <LegalDoc
      title="Política de Privacidade"
      updated="9 de junho de 2026"
      intro={<>A Guileo (operada pela Tribeca Global Inc., "Guileo", "nós") respeita a sua privacidade. Esta política explica quais dados coletamos, como usamos e quais são os seus direitos ao usar o site guileoai.com e os nossos serviços de IA, voz e marketing.</>}
      sections={[
        { h: "Quem somos", body: <p>Guileo é um serviço da <strong>Tribeca Global Inc.</strong>, com operações em New York (EUA) e Cuiabá, MT (Brasil). Para fins de proteção de dados, atuamos como <strong>controlador</strong> dos dados do site e como <strong>operador/processador</strong> dos dados que tratamos em nome dos nossos clientes.</p> },
        { h: "Dados que coletamos", body: <ul className="space-y-1"><li><strong>Contato:</strong> nome, telefone, e-mail, empresa e o canal que você escolhe (WhatsApp, Instagram, etc.).</li><li><strong>Uso do site:</strong> páginas vistas, origem do tráfego e dados técnicos básicos.</li><li><strong>Interações com a IA (Gui):</strong> gravações de chamadas, transcrições e mensagens, quando você ou um cliente nosso utiliza o serviço de voz/chat.</li><li><strong>Conta:</strong> credenciais e configurações do painel (Growth Cockpit).</li></ul> },
        { h: "Como usamos os dados", body: <ul className="space-y-1"><li>Para responder, agendar, qualificar e vender em nome do cliente.</li><li>Para operar, melhorar e personalizar o serviço.</li><li>Para entrar em contato sobre demonstrações e propostas que você solicitou.</li><li>Para cumprir obrigações legais e de segurança.</li></ul> },
        { h: "Processamento de voz e IA", body: <p>Quando a Gui atende ou faz chamadas, o áudio pode ser <strong>gravado e transcrito</strong> para executar a tarefa (agendar, registrar pedido, qualificar lead) e melhorar a qualidade. Avisamos os interlocutores quando exigido por lei e oferecemos opções de não-gravação onde aplicável. Não vendemos gravações.</p> },
        { h: "Base legal (GDPR / LGPD)", body: <p>Tratamos dados com base em: <strong>execução de contrato</strong> (prestar o serviço), <strong>consentimento</strong> (quando você nos procura), <strong>legítimo interesse</strong> (melhorar e proteger o serviço) e <strong>obrigação legal</strong>.</p> },
        { h: "Compartilhamento", body: <p>Compartilhamos dados apenas com provedores que viabilizam o serviço (telefonia, hospedagem, processamento de pagamento) sob contrato, e quando exigido por lei. <strong>Não vendemos seus dados.</strong></p> },
        { h: "Retenção", body: <p>Guardamos os dados pelo tempo necessário para prestar o serviço e cumprir a lei. Você pode pedir a exclusão a qualquer momento (ver Direitos).</p> },
        { h: "Segurança", body: <p>Adotamos práticas alinhadas a padrões como <strong>HIPAA, GDPR, LGPD, CCPA e PCI DSS</strong> conforme o contexto do cliente: criptografia em trânsito, controle de acesso e governança de dados. Nenhum sistema é 100% imune, mas tratamos a segurança como prioridade.</p> },
        { h: "Seus direitos (GDPR / LGPD / CCPA)", body: <p>Você pode acessar, corrigir, exportar, restringir ou <strong>excluir</strong> seus dados, e revogar consentimento. Residentes da Califórnia (CCPA) podem optar por não ter dados "vendidos" — e nós não vendemos. Para exercer qualquer direito, escreva para <a href="mailto:hello@guileoai.com">hello@guileoai.com</a>.</p> },
        { h: "Cookies", body: <p>Usamos cookies essenciais e, com seu consentimento, cookies de medição. Você pode recusar os não-essenciais sem perder funcionalidade básica.</p> },
        { h: "Saúde / HIPAA", body: <p>Para clientes da área de saúde, atuamos como <strong>Business Associate</strong> e firmamos um BAA (Business Associate Agreement) quando há tratamento de dados protegidos de saúde (PHI). Fale conosco antes de inserir PHI no sistema.</p> },
        { h: "Transferências internacionais", body: <p>Operamos entre EUA e Brasil; dados podem ser tratados em ambos os países, sempre com salvaguardas adequadas.</p> },
        { h: "Crianças", body: <p>O serviço não é destinado a menores de 18 anos e não coletamos dados de crianças intencionalmente.</p> },
        { h: "Alterações", body: <p>Podemos atualizar esta política. Mudanças relevantes serão sinalizadas nesta página com nova data de atualização.</p> },
        { h: "Contato", body: <p>Encarregado de dados / privacidade: <a href="mailto:hello@guileoai.com">hello@guileoai.com</a>.</p> },
      ]}
    />
  );
}
