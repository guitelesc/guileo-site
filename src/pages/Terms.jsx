import LegalDoc from "../components/LegalDoc.jsx";

// Terms of Service — TEMPLATE. Covers the service model (AI + done-for-you),
// credits/billing, the 30-day guarantee advertised on the site, an AI-output
// disclaimer (Gui can err), and governing law (US/Brazil). Lawyer review required.

export default function Terms() {
  return (
    <LegalDoc
      title="Termos de Serviço"
      updated="9 de junho de 2026"
      intro={<>Estes Termos regem o uso do site guileoai.com e dos serviços da Guileo (Tribeca Global Inc.). Ao contratar ou usar o serviço, você concorda com eles.</>}
      sections={[
        { h: "O serviço", body: <p>A Guileo fornece um time de IA + marketing "feito-para-você": agentes de voz e chat, sites/apps/software, anúncios e automações. O escopo de cada cliente é definido na proposta aceita.</p> },
        { h: "Conta", body: <p>Você é responsável por manter suas credenciais seguras e pela atividade na sua conta. Avise-nos imediatamente sobre uso não autorizado.</p> },
        { h: "Créditos e cobrança", body: <ul className="space-y-1"><li>Os planos são mensais, com <strong>créditos</strong> que medem o que a Gui executa (chamadas, mensagens, ações).</li><li>A cobrança é recorrente até o cancelamento.</li><li>Créditos adicionais podem ser adquiridos conforme o uso.</li></ul> },
        { h: "Garantia de 30 dias", body: <p>Oferecemos <strong>garantia de devolução em 30 dias</strong> a partir do início, conforme as condições descritas na sua proposta. Após esse período, aplicam-se as regras de cancelamento abaixo.</p> },
        { h: "Cancelamento", body: <p>Você pode cancelar a qualquer momento; o serviço permanece ativo até o fim do ciclo já pago. Não há multa por permanência, salvo condições específicas acordadas por escrito.</p> },
        { h: "Uso aceitável", body: <p>Você concorda em não usar o serviço para spam, fraude, conteúdo ilegal ou para violar direitos de terceiros. Você é responsável por obter os consentimentos necessários dos seus próprios clientes (ex.: gravação de chamadas).</p> },
        { h: "Aviso sobre a IA", body: <p>A Gui é uma inteligência artificial e, embora supervisionada por humanos, <strong>pode cometer erros</strong>. Você é responsável por revisar resultados críticos (ex.: compromissos legais ou de saúde). A Guileo não se responsabiliza por decisões tomadas exclusivamente com base em respostas da IA.</p> },
        { h: "Propriedade intelectual", body: <p>Os ativos que criamos para você (sites, conteúdo) tornam-se seus conforme a proposta; a plataforma, o software e a marca Guileo permanecem nossos. Seus dados continuam <strong>seus</strong>.</p> },
        { h: "Serviços de terceiros", body: <p>O serviço integra provedores externos (telefonia, pagamento, redes sociais). O uso deles pode estar sujeito aos termos desses provedores.</p> },
        { h: "Limitação de responsabilidade", body: <p>Na máxima extensão permitida por lei, a responsabilidade total da Guileo limita-se ao valor pago por você nos 3 meses anteriores ao evento. Não respondemos por lucros cessantes ou danos indiretos.</p> },
        { h: "Lei aplicável", body: <p>Estes Termos são regidos pelas leis aplicáveis nas jurisdições onde operamos (EUA e Brasil), conforme especificado no contrato do cliente.</p> },
        { h: "Alterações", body: <p>Podemos atualizar estes Termos; mudanças relevantes serão sinalizadas nesta página com nova data.</p> },
        { h: "Contato", body: <p>Dúvidas: <a href="mailto:hello@guileoai.com">hello@guileoai.com</a>.</p> },
      ]}
    />
  );
}
