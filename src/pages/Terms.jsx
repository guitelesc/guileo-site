import LegalDoc from "../components/LegalDoc.jsx";

// Terms of Service — resumo dos termos PADRÃO da Guileo, alinhado às 12 cláusulas
// reais dos contratos (src/data/contratos.js). O contrato assinado prevalece.

export default function Terms() {
  return (
    <LegalDoc
      title="Termos de Serviço"
      updated="9 de junho de 2026"
      intro={<>Estes Termos resumem as condições padrão de prestação de serviços da Guileo (Tribeca Global Inc. / operação Brasil). O contrato de prestação de serviços assinado entre as partes, com seu escopo e 12 cláusulas, prevalece sobre este resumo.</>}
      sections={[
        { h: "Objeto", body: <p>A Guileo presta os serviços descritos no escopo da proposta/contrato (IA & automação, sites, apps, software, marketing, mídia, consultoria e afins). Serviços não listados constituem <strong>change order</strong>, formalizado por escrito antes da execução.</p> },
        { h: "Valor e pagamento", body: <p>Condições conforme a proposta. Padrões: atraso gera juros de <strong>1%/mês</strong> pro rata die + multa de 2%, correção pelo IPCA a partir do 30º dia, e reajuste anual pelo IPCA em retainers. Aceitamos PIX/TED/boleto e <strong>USD via Wise/Stripe</strong> ao câmbio BACEN. NFS-e em até 5 dias úteis.</p> },
        { h: "Planos, créditos e cobrança", body: <ul className="space-y-1"><li>Serviços recorrentes (retainers/IA) são <strong>mensais antecipados</strong>.</li><li>Créditos medem o que a Gui executa (chamadas, mensagens, ações); créditos extras podem ser adquiridos.</li><li>A cobrança é recorrente até o cancelamento.</li></ul> },
        { h: "Suspensão e inadimplência", body: <p>Inadimplência superior a 5 dias úteis autoriza suspensão com aviso de 24h; acima de 15 dias pode levar à rescisão. Reativação mediante quitação e taxa aplicável.</p> },
        { h: "Revisões e change orders", body: <p>Revisão é ajuste dentro do conceito aprovado. Mudança de conceito é change order pago. Retorno em até 48h — <strong>silêncio equivale a aprovação tácita</strong>; a aprovação formal congela o entregável.</p> },
        { h: "Garantia comercial", body: <p>A oferta comercial pode incluir <strong>garantia de 30 dias</strong>; as condições de reembolso e rescisão seguem o contrato assinado (resumidas em "Rescisão"). Defeitos reportados em até 15 dias são corrigidos sem custo.</p> },
        { h: "Propriedade intelectual", body: <p>O trabalho permanece da Guileo até a quitação. Materiais criativos têm direitos transferidos após o pagamento (Lei 9.610/98); código entregue com <strong>licença perpétua e exclusiva</strong>. Seus dados continuam <strong>seus</strong>. Uso em portfólio permitido salvo sigilo por escrito.</p> },
        { h: "Confidencialidade", body: <p>Sigilo <strong>bidirecional por 3 anos</strong> sobre dados, estratégias, código e valores. Exceções: informação pública, exigência judicial ou autorização escrita.</p> },
        { h: "Aviso sobre a IA", body: <p>A Gui é uma inteligência artificial supervisionada por humanos e <strong>pode cometer erros</strong>. Você é responsável por revisar resultados críticos (jurídicos, de saúde, financeiros). Não respondemos por decisões tomadas exclusivamente com base na IA.</p> },
        { h: "Garantias e limitação de responsabilidade", body: <p>Responsabilidade limitada ao <strong>valor dos últimos 3 meses</strong> de serviço. Excluídos: resultados de negócio, lucros cessantes e falhas de terceiros. Prazo prescricional de 2 anos.</p> },
        { h: "Rescisão", body: <p><strong>Projetos:</strong> rescisão sem justa causa pelo contratante não reembolsa a entrada; acima de 50% concluído, devido o saldo + multa de 20%. <strong>Retainers:</strong> 30 dias de aviso; multa de 1 mês se antes de 3 meses. Arquivos entregues mediante quitação.</p> },
        { h: "Uso aceitável", body: <p>Você concorda em não usar o serviço para spam, fraude ou conteúdo ilegal, e é responsável por obter os consentimentos necessários dos seus clientes (ex.: gravação de chamadas).</p> },
        { h: "Não contratação", body: <p>Por 12 meses, o contratante não contratará diretamente membros da equipe sem consentimento escrito.</p> },
        { h: "Lei aplicável e foro", body: <p>Lei brasileira (CC/2002, Lei 9.610/98, <strong>LGPD</strong>); padrões internacionais GDPR, CCPA e CISG quando aplicável. Arbitragem na CAMARB, sede em Cuiabá-MT; disputas acima de USD 50k na ICC São Paulo. Foro: <strong>Cuiabá, MT</strong>.</p> },
        { h: "Alterações e contato", body: <p>Podemos atualizar estes Termos; mudanças relevantes terão nova data. Dúvidas: <a href="mailto:hello@guileoai.com">hello@guileoai.com</a>.</p> },
      ]}
    />
  );
}
