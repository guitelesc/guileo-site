// serviceContracts.js
// Guileo / Tribeca Global Inc. — Super-protective SERVICE contract data for the recurring
// AI-receptionist SaaS (voice agent 24/7 that answers, books, sells & collects; credit-based;
// ~7-day activation; human supervision; 30-day money-back). Trilingual PT/EN/ES with parity
// (same 17 clauses in all three languages).
//
// Unlike src/data/contractTemplates.js (agency/dev deliverables), this file models a RECURRING
// AI-SUBSCRIPTION relationship: monthly billing, credits, auto-renewal, no result guarantee,
// telephony compliance (TCPA/A2P), data-processing (LGPD/GDPR/CCPA), provider force majeure.
//
// NOT legal advice — this is a TEMPLATE, not a legal opinion. See the localized disclaimer
// emitted by buildServiceContract(); parties must have a licensed attorney review before signing.
//
// Tokens used inside clause bodies (filled by buildServiceContract):
//   [CLIENTE]/[CLIENT]  → client/business name
//   [VALOR]/[AMOUNT]    → recurring price string (e.g. "US$ 149/mês")
//   [DATA]/[DATE]       → start / activation reference date
//   [PRAZO]/[TERM]      → activation term (e.g. "7 dias")
//   [FORO]/[VENUE]      → governing-law & venue text (market-conditioned)

// ── 17 super-protective clauses, adapted to a recurring AI-voice SaaS. PT/EN/ES parity. ──
export const SERVICE_CLAUSES = {
  pt: [
    ["1", "OBJETO",
      "O presente Contrato tem por objeto a prestação, pela CONTRATADA (Guileo), a [CLIENTE] (\"CONTRATANTE\"), de um serviço de software como serviço (SaaS) de inteligência artificial: um agente de voz e/ou chat que atende chamadas e mensagens 24 horas por dia, 7 dias por semana, podendo agendar, informar, captar contatos, vender e, quando habilitado, cobrar em nome da CONTRATANTE. O serviço é uma ASSINATURA recorrente e não uma entrega de software sob encomenda; a titularidade da plataforma permanece da CONTRATADA. O escopo específico é o do plano contratado, descrito no Anexo I (Escopo)."],
    ["2", "ESCOPO, CRÉDITOS E LIMITES",
      "O uso do serviço é medido em créditos, conforme o plano contratado. Um crédito corresponde à unidade de consumo do serviço (por exemplo, tempo de conversação de voz, mensagem processada ou ação executada pelo agente), na forma detalhada no painel e no Anexo I. Os créditos incluídos renovam-se a cada ciclo mensal e, salvo indicação em contrário no plano, não são cumulativos nem reembolsáveis ao fim do ciclo. Consumo acima do incluído poderá ser cobrado como excedente ou exigir upgrade de plano. A CONTRATADA poderá aplicar limites técnicos razoáveis (concorrência de chamadas, anti-abuso, uso aceitável) para preservar a estabilidade do serviço a todos os clientes."],
    ["3", "ATIVAÇÃO E PRAZO DE IMPLANTAÇÃO",
      "A CONTRATADA envidará esforços para ativar o serviço em aproximadamente [PRAZO] contados da assinatura deste Contrato, do pagamento inicial e da entrega, por [CLIENTE], de todos os acessos, números, conteúdos, catálogo/preços e informações necessários. O prazo de [PRAZO] é ESTIMADO e depende da colaboração da CONTRATANTE; pendências de acessos, dados ou aprovações suspendem automaticamente a contagem. A ativação pode depender de terceiros (operadoras, provedores de telefonia e de IA), não constituindo obrigação de resultado quanto a datas exatas."],
    ["4", "VALORES, COBRANÇA RECORRENTE E INADIMPLÊNCIA",
      "Pela assinatura, [CLIENTE] pagará à CONTRATADA o valor de [VALOR], cobrado de forma recorrente e antecipada a cada ciclo, a partir de [DATA], pelo meio de pagamento cadastrado, que a CONTRATANTE autoriza a ser debitado automaticamente a cada renovação. O atraso ou a falha no pagamento acarretará multa de 2% (dois por cento) sobre o valor em aberto, juros de mora de 1% (um por cento) ao mês e correção monetária, sem prejuízo da SUSPENSÃO do serviço até a regularização. Tributos e taxas de meios de pagamento incidentes serão suportados na forma da lei aplicável. Reajustes seguem a cláusula de Renovação."],
    ["5", "RENOVAÇÃO AUTOMÁTICA E REAJUSTE",
      "Este Contrato renova-se AUTOMATICAMENTE por períodos iguais ao ciclo de cobrança, salvo cancelamento por qualquer das Partes na forma da cláusula de Cancelamento. A CONTRATADA poderá reajustar os valores a cada 12 (doze) meses, ou mediante aviso prévio de 30 (trinta) dias em caso de alteração relevante de custos de provedores (telefonia, modelos de IA, meios de pagamento). Persistindo a CONTRATANTE no uso após o reajuste comunicado, considera-se aceito o novo valor; discordando, poderá cancelar sem multa antes da próxima renovação."],
    ["6", "CANCELAMENTO E GARANTIA DE 30 DIAS",
      "Qualquer das Partes poderá cancelar a assinatura a qualquer tempo mediante aviso, produzindo efeito ao fim do ciclo já pago, sem reembolso proporcional dos dias restantes, salvo a garantia a seguir. GARANTIA DE 30 DIAS: se [CLIENTE] solicitar cancelamento em até 30 (trinta) dias contados de [DATA] da primeira ativação, terá direito à devolução integral do valor pago no primeiro ciclo, encerrando-se o serviço. A garantia aplica-se uma única vez, ao primeiro contrato da CONTRATANTE, e não a renovações. Após o cancelamento, cessam os débitos recorrentes futuros."],
    ["7", "AUSÊNCIA DE GARANTIA DE RESULTADO",
      "O serviço é uma FERRAMENTA de assistência por inteligência artificial. A CONTRATADA NÃO garante qualquer resultado comercial específico — como volume de vendas, receita, número de agendamentos, taxa de conversão, redução de faltas ou retorno sobre investimento —, os quais dependem de fatores alheios ao seu controle (mercado, preços, operação e atendimento da própria CONTRATANTE). A IA pode cometer erros, produzir respostas imprecisas ou indisponibilidades pontuais; [CLIENTE] reconhece isso, mantém supervisão humana e deve revisar saídas críticas (agendamentos, cobranças, compromissos) antes de agir sobre elas."],
    ["8", "LIMITAÇÃO DE RESPONSABILIDADE",
      "Na máxima extensão permitida em lei, a responsabilidade total e agregada da CONTRATADA, por qualquer causa relacionada a este Contrato, limita-se ao MENOR entre o valor efetivamente pago por [CLIENTE] nos 3 (três) meses anteriores ao evento e o valor de [VALOR] correspondente a três ciclos. Ficam excluídos danos indiretos, incidentais, lucros cessantes, perda de dados, de receita ou de oportunidade, ainda que a CONTRATADA tenha sido avisada da possibilidade. Como a IA pode errar, a CONTRATANTE assume o risco de revisar saídas críticas; o serviço é fornecido \"no estado em que se encontra\" e \"conforme disponível\", ressalvado o dolo ou a culpa grave."],
    ["9", "PROPRIEDADE INTELECTUAL",
      "A plataforma, o software, os modelos, os prompts, as configurações, os fluxos e todo o know-how da CONTRATADA são e permanecem de sua exclusiva titularidade, sendo licenciados a [CLIENTE] de forma NÃO exclusiva, intransferível e limitada à vigência da assinatura. Os DADOS da CONTRATANTE (contatos, catálogo, gravações e conteúdos por ela fornecidos) permanecem de titularidade da CONTRATANTE, que concede à CONTRATADA licença para tratá-los apenas na medida necessária à prestação do serviço. Nenhuma cessão de propriedade da plataforma ocorre por força deste Contrato. A CONTRATADA poderá citar a CONTRATANTE como cliente, salvo vedação por escrito."],
    ["10", "PROTEÇÃO DE DADOS (LGPD / GDPR / CCPA)",
      "No tratamento de dados pessoais, a CONTRATANTE atua como CONTROLADORA e a CONTRATADA como OPERADORA (processor/service provider), tratando os dados apenas conforme instruções documentadas de [CLIENTE] e para as finalidades da prestação, observando a LGPD (Lei nº 13.709/2018) e, quando aplicável, o GDPR (titulares da UE/Reino Unido) e o CCPA/CPRA (residentes da Califórnia). [CLIENTE] declara possuir base legal e consentimento válidos para o contato dos titulares por ela cadastrados e é responsável por atender pedidos de não-perturbe (DNC) e opt-out. A CONTRATADA adota medidas técnicas e organizacionais adequadas, notifica incidentes sem demora injustificada e ampara transferências internacionais em mecanismo válido (p. ex., Cláusulas Contratuais Padrão)."],
    ["11", "CONFORMIDADE TELEFÔNICA (TCPA / A2P 10DLC)",
      "[CLIENTE] é o único responsável por assegurar que todo contato telefônico, SMS ou mensagem originado ou solicitado por meio do serviço observe as leis de telecomunicações e marketing aplicáveis, incluindo o TCPA (EUA), as regras de registro A2P 10DLC das operadoras, listas de não-perturbe (DNC/Do-Not-Call) e as normas locais de consentimento (opt-in). A CONTRATANTE garante que possui o consentimento prévio dos titulares que cadastra para receber ligações/mensagens e isenta a CONTRATADA de reclamações, multas ou sanções decorrentes de contatos não autorizados por ela solicitados. A CONTRATADA poderá suspender recursos até a devida habilitação regulatória do remetente."],
    ["12", "CONFIDENCIALIDADE",
      "As Partes obrigam-se a manter sigilo sobre toda informação confidencial a que tiverem acesso em razão deste Contrato, não a divulgando nem a utilizando para fins diversos do objeto. A obrigação vigora durante o Contrato e por 5 (cinco) anos após seu término. Excetuam-se informações de domínio público ou cuja divulgação seja exigida por autoridade competente, mediante prévia comunicação à Parte afetada quando legalmente possível. Gravações e transcrições de chamadas são informação confidencial de [CLIENTE], tratadas pela CONTRATADA apenas para operar o serviço."],
    ["13", "INDENIZAÇÃO",
      "[CLIENTE] indenizará e manterá a CONTRATADA indene de quaisquer perdas, danos, multas, custos e honorários advocatícios decorrentes de: (i) contatos, mensagens ou campanhas que a CONTRATANTE solicite em violação a leis de telecomunicações, marketing ou proteção de dados; (ii) conteúdo, preços, ofertas ou informações fornecidos pela CONTRATANTE; (iii) uso do serviço em desacordo com este Contrato ou com a legislação; e (iv) reclamações de titulares de dados ou terceiros relativas à operação da própria CONTRATANTE. A CONTRATADA responderá, nos limites da cláusula de Limitação de Responsabilidade, por violações a ela diretamente imputáveis."],
    ["14", "FORÇA MAIOR",
      "Nenhuma Parte responderá por falhas ou atrasos decorrentes de eventos fora de seu controle razoável, incluindo caso fortuito, força maior, atos de autoridade, falhas de energia ou internet e, EXPRESSAMENTE, a indisponibilidade, degradação, alteração de políticas ou de preços de PROVEDORES essenciais dos quais o serviço depende — tais como ElevenLabs (voz/IA), Twilio (telefonia/SMS) e Stripe (pagamentos). Durante o evento, as obrigações afetadas ficam suspensas; persistindo por mais de 30 (trinta) dias, qualquer Parte poderá rescindir sem penalidade quanto ao período impactado."],
    ["15", "RESCISÃO",
      "Além do cancelamento ordinário, qualquer Parte poderá rescindir este Contrato em caso de descumprimento relevante não sanado em 10 (dez) dias após notificação escrita. A CONTRATADA poderá suspender ou rescindir imediatamente em caso de inadimplência, uso abusivo, fraude, ou uso que exponha a plataforma ou terceiros a risco legal (inclusive violações de TCPA/A2P/DNC). Na rescisão cessam as licenças de uso; a CONTRATANTE poderá solicitar exportação de seus dados por até 30 (trinta) dias, após o que a CONTRATADA poderá eliminá-los conforme sua política e a lei."],
    ["16", "FORO, ARBITRAGEM E LEI APLICÁVEL",
      "[FORO] As Partes reconhecem a validade jurídica da assinatura eletrônica, tendo este instrumento força vinculante quando assinado eletronicamente por ambas."],
    ["17", "DISPOSIÇÕES GERAIS",
      "Este Contrato, com o Anexo I (Escopo do plano), constitui o acordo integral entre as Partes quanto ao seu objeto, substituindo entendimentos anteriores. Alterações somente por aditivo escrito; a tolerância quanto a qualquer descumprimento não implica novação. A CONTRATANTE não poderá ceder este Contrato sem anuência da CONTRATADA; a CONTRATADA poderá cedê-lo a afiliadas ou sucessoras, ou em reorganização societária. A eventual nulidade de uma cláusula não afeta as demais. As comunicações serão feitas por escrito, inclusive por e-mail, aos endereços cadastrados das Partes."],
  ],
  en: [
    ["1", "PURPOSE",
      "This Agreement governs the provision by the CONTRACTOR (Guileo) to [CLIENT] (the \"CLIENT\") of an artificial-intelligence Software-as-a-Service (SaaS): a voice and/or chat agent that answers calls and messages 24 hours a day, 7 days a week, and may book, inform, capture leads, sell and, where enabled, collect payment on the CLIENT's behalf. The service is a recurring SUBSCRIPTION and not a bespoke software deliverable; ownership of the platform remains with the CONTRACTOR. The specific scope is that of the subscribed plan, described in Exhibit I (Scope)."],
    ["2", "SCOPE, CREDITS & LIMITS",
      "Use of the service is metered in credits, per the subscribed plan. One credit is the service's unit of consumption (for example, voice-conversation time, a processed message, or an action performed by the agent), as detailed in the dashboard and Exhibit I. Included credits renew each monthly cycle and, unless the plan states otherwise, do not roll over and are not refundable at cycle end. Usage beyond the included allowance may be billed as overage or require a plan upgrade. The CONTRACTOR may apply reasonable technical limits (call concurrency, anti-abuse, acceptable use) to preserve service stability for all clients."],
    ["3", "ACTIVATION & IMPLEMENTATION TERM",
      "The CONTRACTOR will use commercially reasonable efforts to activate the service in approximately [TERM] from execution of this Agreement, the initial payment, and [CLIENT]'s delivery of all required access, numbers, content, catalog/pricing and information. The [TERM] period is an ESTIMATE and depends on the CLIENT's cooperation; missing access, data, or approvals automatically pause the count. Activation may depend on third parties (carriers, telephony and AI providers) and does not constitute a guarantee of exact dates."],
    ["4", "FEES, RECURRING BILLING & DEFAULT",
      "For the subscription, [CLIENT] shall pay the CONTRACTOR [AMOUNT], billed on a recurring, advance basis each cycle, starting [DATE], via the payment method on file, which the CLIENT authorizes to be charged automatically upon each renewal. Late or failed payment shall incur a 2% (two percent) penalty on the outstanding amount, default interest of 1% (one percent) per month, plus applicable inflation adjustment, without prejudice to SUSPENSION of the service until cured. Applicable taxes and payment-processing fees shall be borne as required by law. Price adjustments follow the Renewal clause."],
    ["5", "AUTOMATIC RENEWAL & PRICE ADJUSTMENT",
      "This Agreement renews AUTOMATICALLY for periods equal to the billing cycle, unless cancelled by either Party under the Cancellation clause. The CONTRACTOR may adjust fees every 12 (twelve) months, or upon 30 (thirty) days' prior notice in the event of a material change in provider costs (telephony, AI models, payment processors). If the CLIENT continues using the service after a communicated adjustment, the new price is deemed accepted; if the CLIENT disagrees, it may cancel without penalty before the next renewal."],
    ["6", "CANCELLATION & 30-DAY GUARANTEE",
      "Either Party may cancel the subscription at any time upon notice, effective at the end of the already-paid cycle, with no pro-rata refund of remaining days, except for the guarantee below. 30-DAY GUARANTEE: if [CLIENT] requests cancellation within 30 (thirty) days of [DATE] of first activation, it is entitled to a full refund of the amount paid for the first cycle, and the service ends. The guarantee applies once, to the CLIENT's first contract, and not to renewals. After cancellation, future recurring charges cease."],
    ["7", "NO GUARANTEE OF OUTCOME",
      "The service is an artificial-intelligence assistance TOOL. The CONTRACTOR does NOT guarantee any specific commercial result — such as sales volume, revenue, number of bookings, conversion rate, no-show reduction, or return on investment — all of which depend on factors beyond its control (market, pricing, and the CLIENT's own operations and service). The AI may make mistakes, produce inaccurate responses, or experience occasional downtime; [CLIENT] acknowledges this, maintains human supervision, and must review critical outputs (bookings, charges, commitments) before acting on them."],
    ["8", "LIMITATION OF LIABILITY",
      "To the maximum extent permitted by law, the CONTRACTOR's total aggregate liability, on any theory relating to this Agreement, is limited to the LESSER of the amount actually paid by [CLIENT] in the 3 (three) months preceding the event and an amount equal to three cycles of [AMOUNT]. Excluded are indirect, incidental, or consequential damages, lost profits, and loss of data, revenue, or opportunity, even if the CONTRACTOR was advised of the possibility. Because the AI can err, the CLIENT assumes the risk of reviewing critical outputs; the service is provided \"as is\" and \"as available,\" except in cases of willful misconduct or gross negligence."],
    ["9", "INTELLECTUAL PROPERTY",
      "The platform, software, models, prompts, configurations, flows, and all of the CONTRACTOR's know-how are and remain its exclusive property, licensed to [CLIENT] on a NON-exclusive, non-transferable basis limited to the subscription term. The CLIENT's DATA (contacts, catalog, recordings, and content it supplies) remains the CLIENT's property, which grants the CONTRACTOR a license to process it only as necessary to deliver the service. No transfer of platform ownership occurs under this Agreement. The CONTRACTOR may name the CLIENT as a customer unless prohibited in writing."],
    ["10", "DATA PROTECTION (LGPD / GDPR / CCPA)",
      "In processing personal data, the CLIENT acts as CONTROLLER and the CONTRACTOR as PROCESSOR (service provider), processing data only on [CLIENT]'s documented instructions and for the purposes of the service, in compliance with Brazil's LGPD (Law No. 13.709/2018) and, where applicable, the GDPR (EU/UK data subjects) and the CCPA/CPRA (California residents). [CLIENT] represents that it has a valid legal basis and consent to contact the data subjects it uploads and is responsible for honoring do-not-call (DNC) and opt-out requests. The CONTRACTOR implements appropriate technical and organizational measures, notifies breaches without undue delay, and supports cross-border transfers on a valid mechanism (e.g., Standard Contractual Clauses)."],
    ["11", "TELEPHONY COMPLIANCE (TCPA / A2P 10DLC)",
      "[CLIENT] is solely responsible for ensuring that every phone call, SMS, or message originated or requested through the service complies with applicable telecommunications and marketing laws, including the TCPA (US), carrier A2P 10DLC registration rules, do-not-call (DNC) lists, and local consent (opt-in) requirements. The CLIENT warrants that it has prior consent from the data subjects it uploads to receive calls/messages and holds the CONTRACTOR harmless from claims, fines, or sanctions arising from unauthorized contacts it requested. The CONTRACTOR may suspend features until the sender is properly registered with regulators."],
    ["12", "CONFIDENTIALITY",
      "The Parties shall keep confidential all confidential information accessed in connection with this Agreement and shall not disclose or use it for purposes other than its subject matter. The obligation remains in force during the term and for 5 (five) years thereafter. Excluded is information in the public domain or required to be disclosed by a competent authority, subject to prior notice to the affected Party where legally permitted. Call recordings and transcripts are [CLIENT]'s confidential information, processed by the CONTRACTOR only to operate the service."],
    ["13", "INDEMNIFICATION",
      "[CLIENT] shall indemnify and hold the CONTRACTOR harmless from any losses, damages, fines, costs, and attorneys' fees arising from: (i) contacts, messages, or campaigns the CLIENT requests in violation of telecommunications, marketing, or data-protection laws; (ii) content, prices, offers, or information supplied by the CLIENT; (iii) use of the service inconsistent with this Agreement or applicable law; and (iv) claims by data subjects or third parties relating to the CLIENT's own operations. The CONTRACTOR shall be liable, subject to the Limitation of Liability clause, for breaches directly attributable to it."],
    ["14", "FORCE MAJEURE",
      "Neither Party shall be liable for failures or delays caused by events beyond its reasonable control, including acts of God, force majeure, acts of authority, power or internet outages and, EXPRESSLY, the unavailability, degradation, or change in policy or pricing of essential PROVIDERS on which the service depends — such as ElevenLabs (voice/AI), Twilio (telephony/SMS), and Stripe (payments). During the event, the affected obligations are suspended; if it persists beyond 30 (thirty) days, either Party may terminate without penalty as to the impacted period."],
    ["15", "TERMINATION",
      "In addition to ordinary cancellation, either Party may terminate this Agreement for a material breach not cured within 10 (ten) days of written notice. The CONTRACTOR may suspend or terminate immediately for non-payment, abuse, fraud, or use that exposes the platform or third parties to legal risk (including TCPA/A2P/DNC violations). Upon termination, use licenses cease; the CLIENT may request an export of its data for up to 30 (thirty) days, after which the CONTRACTOR may delete it in accordance with its policy and applicable law."],
    ["16", "VENUE, ARBITRATION & GOVERNING LAW",
      "[VENUE] The Parties acknowledge the legal validity of electronic signatures, and this instrument is binding when signed electronically by both Parties."],
    ["17", "GENERAL PROVISIONS",
      "This Agreement, together with Exhibit I (plan Scope), constitutes the entire agreement between the Parties as to its subject matter, superseding prior understandings. Amendments must be in a written addendum; forbearance as to any breach does not waive future rights. The CLIENT may not assign this Agreement without the CONTRACTOR's consent; the CONTRACTOR may assign it to affiliates or successors, or in a corporate reorganization. The invalidity of any clause does not affect the others. Notices shall be in writing, including by email, to the Parties' addresses on file."],
  ],
  es: [
    ["1", "OBJETO",
      "El presente Contrato tiene por objeto la prestación, por parte de la CONTRATISTA (Guileo), a [CLIENT] (el \"CLIENTE\"), de un servicio de software como servicio (SaaS) de inteligencia artificial: un agente de voz y/o chat que atiende llamadas y mensajes las 24 horas, los 7 días de la semana, y puede agendar, informar, captar contactos, vender y, cuando esté habilitado, cobrar en nombre del CLIENTE. El servicio es una SUSCRIPCIÓN recurrente y no una entrega de software a medida; la titularidad de la plataforma permanece de la CONTRATISTA. El alcance específico es el del plan contratado, descrito en el Anexo I (Alcance)."],
    ["2", "ALCANCE, CRÉDITOS Y LÍMITES",
      "El uso del servicio se mide en créditos, según el plan contratado. Un crédito es la unidad de consumo del servicio (por ejemplo, tiempo de conversación de voz, un mensaje procesado o una acción ejecutada por el agente), según se detalla en el panel y en el Anexo I. Los créditos incluidos se renuevan cada ciclo mensual y, salvo indicación distinta del plan, no son acumulables ni reembolsables al fin del ciclo. El consumo por encima de lo incluido podrá cobrarse como excedente o exigir una mejora de plan. La CONTRATISTA podrá aplicar límites técnicos razonables (concurrencia de llamadas, antiabuso, uso aceptable) para preservar la estabilidad del servicio para todos los clientes."],
    ["3", "ACTIVACIÓN Y PLAZO DE IMPLANTACIÓN",
      "La CONTRATISTA hará esfuerzos comercialmente razonables para activar el servicio en aproximadamente [TERM] contados desde la firma de este Contrato, el pago inicial y la entrega, por parte de [CLIENT], de todos los accesos, números, contenidos, catálogo/precios e información necesarios. El plazo de [TERM] es ESTIMADO y depende de la colaboración del CLIENTE; los pendientes de accesos, datos o aprobaciones suspenden automáticamente el cómputo. La activación puede depender de terceros (operadoras, proveedores de telefonía y de IA) y no constituye una obligación de resultado en cuanto a fechas exactas."],
    ["4", "IMPORTES, COBRO RECURRENTE E INCUMPLIMIENTO",
      "Por la suscripción, [CLIENT] pagará a la CONTRATISTA el importe de [AMOUNT], cobrado de forma recurrente y anticipada cada ciclo, a partir de [DATE], mediante el medio de pago registrado, que el CLIENTE autoriza a debitar automáticamente en cada renovación. El atraso o fallo en el pago generará una multa del 2% (dos por ciento) sobre el importe pendiente, intereses moratorios del 1% (uno por ciento) mensual y el ajuste por inflación aplicable, sin perjuicio de la SUSPENSIÓN del servicio hasta su regularización. Los tributos y comisiones de los medios de pago se soportarán conforme a la ley aplicable. Los ajustes siguen la cláusula de Renovación."],
    ["5", "RENOVACIÓN AUTOMÁTICA Y AJUSTE DE PRECIO",
      "Este Contrato se renueva AUTOMÁTICAMENTE por períodos iguales al ciclo de cobro, salvo cancelación por cualquiera de las Partes conforme a la cláusula de Cancelación. La CONTRATISTA podrá ajustar los importes cada 12 (doce) meses, o mediante aviso previo de 30 (treinta) días en caso de cambio relevante en los costos de proveedores (telefonía, modelos de IA, medios de pago). Si el CLIENTE continúa usando el servicio tras un ajuste comunicado, se considera aceptado el nuevo precio; si no está de acuerdo, podrá cancelar sin penalización antes de la siguiente renovación."],
    ["6", "CANCELACIÓN Y GARANTÍA DE 30 DÍAS",
      "Cualquiera de las Partes podrá cancelar la suscripción en cualquier momento mediante aviso, con efecto al fin del ciclo ya pagado, sin reembolso proporcional de los días restantes, salvo la garantía siguiente. GARANTÍA DE 30 DÍAS: si [CLIENT] solicita la cancelación dentro de los 30 (treinta) días contados desde [DATE] de la primera activación, tendrá derecho a la devolución íntegra del importe pagado en el primer ciclo, finalizando el servicio. La garantía se aplica una sola vez, al primer contrato del CLIENTE, y no a las renovaciones. Tras la cancelación, cesan los cargos recurrentes futuros."],
    ["7", "AUSENCIA DE GARANTÍA DE RESULTADO",
      "El servicio es una HERRAMIENTA de asistencia por inteligencia artificial. La CONTRATISTA NO garantiza ningún resultado comercial específico —como volumen de ventas, ingresos, número de reservas, tasa de conversión, reducción de ausencias o retorno de la inversión—, los cuales dependen de factores ajenos a su control (mercado, precios y la propia operación y atención del CLIENTE). La IA puede cometer errores, producir respuestas imprecisas o presentar indisponibilidades puntuales; [CLIENT] lo reconoce, mantiene supervisión humana y debe revisar las salidas críticas (reservas, cobros, compromisos) antes de actuar sobre ellas."],
    ["8", "LIMITACIÓN DE RESPONSABILIDAD",
      "En la máxima medida permitida por la ley, la responsabilidad total y agregada de la CONTRATISTA, por cualquier causa relacionada con este Contrato, se limita al MENOR entre el importe efectivamente pagado por [CLIENT] en los 3 (tres) meses anteriores al hecho y un importe equivalente a tres ciclos de [AMOUNT]. Quedan excluidos los daños indirectos, incidentales o consecuentes, el lucro cesante y la pérdida de datos, ingresos u oportunidad, aun cuando se hubiera advertido de tal posibilidad. Dado que la IA puede errar, el CLIENTE asume el riesgo de revisar las salidas críticas; el servicio se presta \"tal cual\" y \"según disponibilidad\", salvo dolo o culpa grave."],
    ["9", "PROPIEDAD INTELECTUAL",
      "La plataforma, el software, los modelos, los prompts, las configuraciones, los flujos y todo el know-how de la CONTRATISTA son y permanecen de su exclusiva titularidad, licenciados a [CLIENT] de forma NO exclusiva, intransferible y limitada a la vigencia de la suscripción. Los DATOS del CLIENTE (contactos, catálogo, grabaciones y contenidos que aporte) permanecen de su titularidad, y este otorga a la CONTRATISTA una licencia para tratarlos solo en la medida necesaria para prestar el servicio. Ninguna cesión de la propiedad de la plataforma ocurre en virtud de este Contrato. La CONTRATISTA podrá mencionar al CLIENTE como cliente, salvo prohibición por escrito."],
    ["10", "PROTECCIÓN DE DATOS (LGPD / GDPR / CCPA)",
      "En el tratamiento de datos personales, el CLIENTE actúa como RESPONSABLE (controlador) y la CONTRATISTA como ENCARGADA (procesadora/proveedora de servicio), tratando los datos solo conforme a las instrucciones documentadas de [CLIENT] y para las finalidades del servicio, observando la LGPD brasileña (Ley nº 13.709/2018) y, cuando corresponda, el GDPR (titulares de la UE/Reino Unido) y la CCPA/CPRA (residentes de California). [CLIENT] declara contar con base legal y consentimiento válidos para contactar a los titulares que cargue y es responsable de atender solicitudes de no-llamar (DNC) y de exclusión (opt-out). La CONTRATISTA adopta medidas técnicas y organizativas adecuadas, notifica incidentes sin dilación indebida y ampara las transferencias internacionales en un mecanismo válido (p. ej., Cláusulas Contractuales Tipo)."],
    ["11", "CONFORMIDAD TELEFÓNICA (TCPA / A2P 10DLC)",
      "[CLIENT] es el único responsable de asegurar que toda llamada telefónica, SMS o mensaje originado o solicitado a través del servicio cumpla con las leyes de telecomunicaciones y marketing aplicables, incluyendo el TCPA (EE. UU.), las reglas de registro A2P 10DLC de las operadoras, las listas de no-llamar (DNC) y los requisitos locales de consentimiento (opt-in). El CLIENTE garantiza que cuenta con el consentimiento previo de los titulares que carga para recibir llamadas/mensajes y mantiene indemne a la CONTRATISTA frente a reclamaciones, multas o sanciones derivadas de contactos no autorizados que aquel solicite. La CONTRATISTA podrá suspender funciones hasta que el remitente esté debidamente registrado ante los reguladores."],
    ["12", "CONFIDENCIALIDAD",
      "Las Partes se obligan a mantener en reserva toda información confidencial a la que tengan acceso con motivo de este Contrato, no divulgándola ni utilizándola para fines distintos de su objeto. La obligación rige durante la vigencia del Contrato y por 5 (cinco) años posteriores. Se exceptúa la información de dominio público o cuya divulgación sea exigida por autoridad competente, previa comunicación a la Parte afectada cuando sea legalmente posible. Las grabaciones y transcripciones de llamadas son información confidencial de [CLIENT], tratadas por la CONTRATISTA solo para operar el servicio."],
    ["13", "INDEMNIZACIÓN",
      "[CLIENT] indemnizará y mantendrá indemne a la CONTRATISTA de cualesquiera pérdidas, daños, multas, costos y honorarios de abogados derivados de: (i) contactos, mensajes o campañas que el CLIENTE solicite en violación de leyes de telecomunicaciones, marketing o protección de datos; (ii) contenido, precios, ofertas o información aportados por el CLIENTE; (iii) uso del servicio en desacuerdo con este Contrato o con la ley; y (iv) reclamaciones de titulares de datos o terceros relativas a la propia operación del CLIENTE. La CONTRATISTA responderá, dentro de los límites de la cláusula de Limitación de Responsabilidad, por incumplimientos directamente imputables a ella."],
    ["14", "FUERZA MAYOR",
      "Ninguna Parte responderá por fallas o retrasos causados por eventos fuera de su control razonable, incluidos caso fortuito, fuerza mayor, actos de autoridad, cortes de energía o de internet y, EXPRESAMENTE, la indisponibilidad, degradación o cambio de políticas o de precios de PROVEEDORES esenciales de los que depende el servicio —tales como ElevenLabs (voz/IA), Twilio (telefonía/SMS) y Stripe (pagos)—. Durante el evento, las obligaciones afectadas quedan suspendidas; si persiste por más de 30 (treinta) días, cualquier Parte podrá resolver sin penalización respecto del período impactado."],
    ["15", "RESOLUCIÓN",
      "Además de la cancelación ordinaria, cualquier Parte podrá resolver este Contrato en caso de incumplimiento relevante no subsanado dentro de los 10 (diez) días posteriores a la notificación escrita. La CONTRATISTA podrá suspender o resolver de inmediato en caso de impago, abuso, fraude, o uso que exponga la plataforma o a terceros a riesgo legal (incluidas violaciones de TCPA/A2P/DNC). Con la resolución cesan las licencias de uso; el CLIENTE podrá solicitar la exportación de sus datos por hasta 30 (treinta) días, tras lo cual la CONTRATISTA podrá eliminarlos conforme a su política y a la ley."],
    ["16", "JURISDICCIÓN, ARBITRAJE Y LEY APLICABLE",
      "[VENUE] Las Partes reconocen la validez jurídica de la firma electrónica, teniendo este instrumento carácter vinculante cuando sea firmado electrónicamente por ambas."],
    ["17", "DISPOSICIONES GENERALES",
      "Este Contrato, junto con el Anexo I (Alcance del plan), constituye el acuerdo íntegro entre las Partes en cuanto a su objeto, sustituyendo entendimientos anteriores. Las modificaciones solo por adenda escrita; la tolerancia ante cualquier incumplimiento no implica renuncia a derechos futuros. El CLIENTE no podrá ceder este Contrato sin el consentimiento de la CONTRATISTA; la CONTRATISTA podrá cederlo a filiales o sucesoras, o en una reorganización societaria. La nulidad de una cláusula no afecta a las demás. Las comunicaciones se harán por escrito, incluso por correo electrónico, a las direcciones registradas de las Partes."],
  ],
};

// Governing-law / venue text, filled into clause 16 by market. PT/EN/ES parity.
const VENUE = {
  us: {
    pt: "Este Contrato rege-se pelas leis do Estado de Delaware, EUA (excluídas suas regras de conflito de leis). As controvérsias não resolvidas amigavelmente serão submetidas a arbitragem vinculante perante a American Arbitration Association (AAA), conforme suas Regras de Arbitragem Comercial, em inglês; a sentença arbitral poderá ser homologada em qualquer foro competente. As Partes renunciam a ações coletivas.",
    en: "This Agreement is governed by the laws of the State of Delaware, USA (excluding its conflict-of-laws rules). Disputes not resolved amicably shall be submitted to binding arbitration before the American Arbitration Association (AAA) under its Commercial Arbitration Rules, in English; the award may be entered in any court of competent jurisdiction. The Parties waive class actions.",
    es: "Este Contrato se rige por las leyes del Estado de Delaware, EE. UU. (excluidas sus normas de conflicto de leyes). Las controversias no resueltas amistosamente se someterán a arbitraje vinculante ante la American Arbitration Association (AAA), conforme a sus Reglas de Arbitraje Comercial, en inglés; el laudo podrá ejecutarse ante cualquier foro competente. Las Partes renuncian a las acciones colectivas.",
  },
  br: {
    pt: "Este Contrato rege-se pelas leis da República Federativa do Brasil, em especial o Código Civil (Lei nº 10.406/2002) e a LGPD (Lei nº 13.709/2018). As Partes elegem o foro da Comarca de Cuiabá, Estado de Mato Grosso, Brasil, para dirimir questões não resolvidas amigavelmente, sem prejuízo de submissão a arbitragem conforme regulamento de câmara arbitral brasileira quando as Partes assim convencionarem.",
    en: "This Agreement is governed by the laws of the Federative Republic of Brazil, in particular the Civil Code (Law No. 10.406/2002) and the LGPD (Law No. 13.709/2018). The Parties elect the courts of the District (Comarca) of Cuiabá, State of Mato Grosso, Brazil, for disputes not resolved amicably, without prejudice to arbitration under the rules of a Brazilian arbitration chamber where the Parties so agree.",
    es: "Este Contrato se rige por las leyes de la República Federativa de Brasil, en particular el Código Civil (Ley nº 10.406/2002) y la LGPD (Ley nº 13.709/2018). Las Partes eligen el foro de la Comarca de Cuiabá, Estado de Mato Grosso, Brasil, para dirimir las cuestiones no resueltas amistosamente, sin perjuicio del sometimiento a arbitraje conforme al reglamento de una cámara arbitral brasileña cuando así lo convengan.",
  },
};

const DISCLAIMER = {
  pt: "Este contrato é um MODELO fornecido a título informativo e como ponto de partida; não constitui parecer nem aconselhamento jurídico. Antes de assiná-lo, as partes devem revisá-lo e adaptá-lo à sua realidade e submetê-lo à análise de um advogado habilitado, considerando a legislação aplicável e as particularidades do caso.",
  en: "This contract is a TEMPLATE provided for informational purposes as a starting point; it is not a legal opinion or legal advice. Before signing, the parties should review and adapt it to their situation and have it reviewed by a licensed attorney, taking into account applicable law and the specifics of the case.",
  es: "Este contrato es un MODELO proporcionado a título informativo y como punto de partida; no constituye dictamen ni asesoramiento jurídico. Antes de firmarlo, las partes deben revisarlo y adaptarlo a su realidad y someterlo al análisis de un abogado habilitado, considerando la legislación aplicable y las particularidades del caso.",
};

// UI labels used to build the plan summary/payment lines. PT/EN/ES.
const L = {
  pt: { creditsMo: "créditos/mês", perMo: "/mês", guarantee: "Garantia de 30 dias — devolução integral no primeiro ciclo.", live: "No ar em até 7 dias.", recurring: "Cobrança recorrente mensal", scopePlan: "Escopo do plano" },
  en: { creditsMo: "credits/mo", perMo: "/mo", guarantee: "30-day money-back guarantee on the first cycle.", live: "Live in up to 7 days.", recurring: "Recurring monthly billing", scopePlan: "Plan scope" },
  es: { creditsMo: "créditos/mes", perMo: "/mes", guarantee: "Garantía de 30 días — devolución total del primer ciclo.", live: "En vivo en hasta 7 días.", recurring: "Cobro recurrente mensual", scopePlan: "Alcance del plan" },
};

// Per-plan contractual scope: plan feats rephrased as a service-agreement scope of subscription.
// key mirrors guileoPlans.js (starter/growth/scale). name/summary/deliverables are localized (3 langs).
export const SERVICE_CONTRACTS = {
  starter: {
    key: "starter",
    name: {
      pt: "Guileo Essential — Assinatura de Recepcionista IA 24/7",
      en: "Guileo Essential — 24/7 AI Receptionist Subscription",
      es: "Guileo Essential — Suscripción de Recepcionista IA 24/7",
    },
    summary: {
      pt: "Assinatura recorrente de um agente de voz de IA que atende sua linha 24/7, agenda clientes e envia lembretes, com 500 créditos/mês e ativação em até 7 dias.",
      en: "Recurring subscription to an AI voice agent that answers your line 24/7, books clients and sends reminders, with 500 credits/mo and activation in up to 7 days.",
      es: "Suscripción recurrente a un agente de voz IA que atiende tu línea 24/7, agenda clientes y envía recordatorios, con 500 créditos/mes y activación en hasta 7 días.",
    },
    deliverables: {
      pt: ["Recepcionista de IA de voz 24/7 (1 agente com nome e voz do seu negócio)", "Agendamento em tempo real + lembretes automáticos", "Número dedicado e/ou encaminhamento da sua linha", "Painel ao vivo com todas as ligações e reservas", "500 créditos/mês inclusos (renováveis por ciclo)", "Suporte por canais padrão"],
      en: ["24/7 AI voice receptionist (1 agent with your business name & voice)", "Real-time booking + automatic reminders", "Dedicated number and/or forwarding of your line", "Live dashboard with every call and booking", "500 credits/mo included (renewed each cycle)", "Standard-channel support"],
      es: ["Recepcionista IA de voz 24/7 (1 agente con nombre y voz de tu negocio)", "Agenda en tiempo real + recordatorios automáticos", "Número dedicado y/o desvío de tu línea", "Panel en vivo con cada llamada y reserva", "500 créditos/mes incluidos (renovables por ciclo)", "Soporte por canales estándar"],
    },
  },
  growth: {
    key: "growth",
    name: {
      pt: "Guileo Personalized — Assinatura IA de voz + canais + vendas",
      en: "Guileo Personalized — Voice AI + channels + sales Subscription",
      es: "Guileo Personalized — Suscripción IA de voz + canales + ventas",
    },
    summary: {
      pt: "Assinatura recorrente com a IA em todos os canais (voz, chat do site, WhatsApp, redes) vendendo, cobrando e reativando clientes, com 2.000 créditos/mês e suporte prioritário.",
      en: "Recurring subscription with the AI on every channel (voice, site chat, WhatsApp, social) selling, collecting and winning back clients, with 2,000 credits/mo and priority support.",
      es: "Suscripción recurrente con la IA en todos los canales (voz, chat del sitio, WhatsApp, redes) vendiendo, cobrando y reactivando clientes, con 2.000 créditos/mes y soporte prioritario.",
    },
    deliverables: {
      pt: ["Tudo do Essential", "IA de voz + chat no site + WhatsApp + redes sociais", "Fecha e cobra na ligação (link de pagamento), quando habilitado", "Campanhas automáticas: aniversário, reativação, datas", "Radar de faltas + confirmações inteligentes", "2.000 créditos/mês + suporte prioritário"],
      en: ["Everything in Essential", "Voice AI + site chat + WhatsApp + social", "Closes and collects on the call (pay link), where enabled", "Auto campaigns: birthdays, win-back, key dates", "No-show radar + smart confirmations", "2,000 credits/mo + priority support"],
      es: ["Todo lo de Essential", "IA de voz + chat del sitio + WhatsApp + redes", "Cierra y cobra en la llamada (link de pago), cuando esté habilitado", "Campañas automáticas: cumpleaños, reactivación, fechas", "Radar de ausencias + confirmaciones inteligentes", "2.000 créditos/mes + soporte prioritario"],
    },
  },
  scale: {
    key: "scale",
    name: {
      pt: "Guileo Full Operation — Assinatura da operação inteira com IA",
      en: "Guileo Full Operation — Whole-operation AI Subscription",
      es: "Guileo Full Operation — Suscripción de toda la operación con IA",
    },
    summary: {
      pt: "Assinatura recorrente em que a Guileo roda a frente do seu negócio: todos os canais, campanhas e cupons com a sua marca, relatórios de valor gerado, 6.000 créditos/mês e time dedicado.",
      en: "Recurring subscription where Guileo runs your front office: every channel, campaigns and coupons in your brand, generated-value reports, 6,000 credits/mo and a dedicated team.",
      es: "Suscripción recurrente en la que Guileo maneja el frente de tu negocio: todos los canales, campañas y cupones con tu marca, reportes de valor generado, 6.000 créditos/mes y equipo dedicado.",
    },
    deliverables: {
      pt: ["Tudo do Personalized", "Campanhas e cupons com a SUA marca", "Pacotes, assinaturas e gift cards prontos pra vender", "Relatório periódico de valor gerado (ROI)", "Implantação profunda multi-unidades", "6.000 créditos/mês + time dedicado"],
      en: ["Everything in Personalized", "Campaigns and coupons in YOUR brand", "Packages, memberships and gift cards ready to sell", "Periodic generated-value report (ROI)", "Deep multi-location implementation", "6,000 credits/mo + dedicated team"],
      es: ["Todo lo de Personalized", "Campañas y cupones con TU marca", "Paquetes, membresías y gift cards listos para vender", "Reporte periódico de valor generado (ROI)", "Implementación profunda multi-sucursal", "6.000 créditos/mes + equipo dedicado"],
    },
  },
};

const PLAN_ICON = { starter: "🌱", growth: "🚀", scale: "🏆" };
const TEMPLATE_CODE = { starter: "GUI-SVC-ESSENTIAL", growth: "GUI-SVC-PERSONALIZED", scale: "GUI-SVC-FULL" };

// Import canonical plans for price/credits so we never hardcode money here.
import { GUILEO_PLANS, planByKey } from "./guileoPlans.js";

// Fill [CLIENTE]/[CLIENT], [VALOR]/[AMOUNT], [DATA]/[DATE], [PRAZO]/[TERM], [FORO]/[VENUE] in a body string.
function fillTokens(text, vals) {
  return String(text || "")
    .replace(/\[CLIENTE\]/g, vals.client).replace(/\[CLIENT\]/g, vals.client)
    .replace(/\[VALOR\]/g, vals.amount).replace(/\[AMOUNT\]/g, vals.amount)
    .replace(/\[DATA\]/g, vals.date).replace(/\[DATE\]/g, vals.date)
    .replace(/\[PRAZO\]/g, vals.term).replace(/\[TERM\]/g, vals.term)
    .replace(/\[FORO\]/g, vals.venue).replace(/\[VENUE\]/g, vals.venue);
}

// Pure builder → produces a ContractDoc-compatible body (see src/components/ContractDoc.jsx).
// No fetch, no side effects. { planKey, lang, provider, client, amount, startDate, market }.
export function buildServiceContract({ planKey, lang, provider, client, amount, startDate, market } = {}) {
  const L3 = (lang === "pt" || lang === "en" || lang === "es") ? lang : "en";
  const mkt = market === "br" ? "br" : "us";
  const key = SERVICE_CONTRACTS[planKey] ? planKey : "growth";
  const contract = SERVICE_CONTRACTS[key];
  const plan = planByKey(key) || GUILEO_PLANS[1];
  const labels = L[L3];

  // Money: default to the canonical plan price for the market unless an explicit amount is passed.
  const priceStr = mkt === "br" ? plan.priceBR : plan.price;
  const amountStr = amount != null && amount !== "" ? String(amount) : priceStr;

  const clientName = (client && (client.name || client.business)) || (L3 === "pt" ? "o CONTRATANTE" : L3 === "es" ? "el CLIENTE" : "the CLIENT");
  const clientEmail = (client && client.email) || "";
  const term = L3 === "pt" ? "7 dias" : L3 === "es" ? "7 días" : "7 days";
  const dateStr = (startDate && String(startDate)) || new Date().toISOString().slice(0, 10);
  const venue = VENUE[mkt][L3];

  const vals = { client: clientName, amount: amountStr, date: dateStr, term, venue };
  const clauses = SERVICE_CLAUSES[L3].map(([n, title, body]) => [n, title, fillTokens(body, vals)]);

  // Payment line: recurring price + credits + guarantee.
  const paymentStr = `${amountStr} — ${labels.recurring} · ${plan.credits.toLocaleString(L3 === "en" ? "en-US" : L3 === "pt" ? "pt-BR" : "es-ES")} ${labels.creditsMo}. ${labels.guarantee}`;

  return {
    title: contract.name[L3],
    kind: "contract",
    template_code: TEMPLATE_CODE[key],
    icon: PLAN_ICON[key],
    date: dateStr,
    provider: { name: (provider && provider.name) || "Tribeca Global Inc. (Guileo AI)" },
    counterparty: { name: clientName, email: clientEmail },
    summary: contract.summary[L3],
    deliverables: contract.deliverables[L3],
    timeline: labels.live,
    payment: paymentStr,
    clauses,
    disclaimer: DISCLAIMER[L3],
  };
}
