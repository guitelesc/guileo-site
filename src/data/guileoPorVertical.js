// ═══ QUAL GUILEO FAZ O QUÊ PARA CADA TIPO DE NEGÓCIO ═════════════════════════════════════════
// Pedido do Luis: "e o que cada Guileo faz para cada business".
//
// 🚨 ZERO TEXTO NOVO, DE PROPÓSITO. Este arquivo é SÓ o mapa: para cada vertical, quais produtos
// de cada perna importam mais, na ordem em que se fala. O nome e o resultado de cada produto vêm
// de `productSystem.js`, que já está nos 4 idiomas e é a mesma fonte da landing e do cockpit.
// Se eu escrevesse a frase aqui, ela desencontraria da entrega no dia em que o produto mudasse —
// e o vendedor prometeria uma coisa enquanto a plataforma faz outra. Mapa não traduz; mapa aponta.
//
// A ORDEM É A DA CONVERSA, não a do catálogo: o primeiro item de cada perna é o que resolve a dor
// que aquele dono sente ANTES de qualquer outra — é com ele que a frase começa.
//
// ⚠️ VERTICAL SEM ENTRADA CAI NO `universal`. Nunca em uma lista vazia: bloco vazio faria o
// vendedor concluir que a Guileo não serve para aquele negócio, quando a verdade é que ninguém
// mapeou ainda. Ausência de mapeamento não é ausência de produto.

export const GUILEO_POR_VERTICAL = {
  universal:    { brain: ["answering", "speedlead", "close_collect"],           ad: ["reputation", "marketing_ads", "crm_email"],        build: ["websites", "apps"] },

  // Volume alto, ticket baixo, telefone tocando na hora do almoço: atender e cobrar vem primeiro.
  restaurant:   { brain: ["answering", "close_collect", "multilingual"],        ad: ["reputation", "social_manage", "content"],          build: ["websites", "ecommerce", "apps"] },
  cafe:         { brain: ["answering", "close_collect", "reactivation"],        ad: ["social_manage", "reputation", "content"],          build: ["apps", "ecommerce"] },

  // Agenda cara: uma cadeira vazia é prejuízo do dia. Falta e retorno mandam.
  dental:       { brain: ["noshow", "answering", "reactivation"],               ad: ["reputation", "crm_email", "marketing_ads"],        build: ["websites", "automation"] },
  clinic:       { brain: ["noshow", "answering", "multilingual"],               ad: ["reputation", "crm_email", "seo_aeo"],              build: ["websites", "automation"] },
  vet:          { brain: ["noshow", "answering", "reactivation"],               ad: ["reputation", "crm_email", "social_manage"],        build: ["websites", "apps"] },
  spa:          { brain: ["noshow", "close_collect", "reactivation"],           ad: ["reputation", "social_manage", "content"],          build: ["apps", "ecommerce"] },
  salon:        { brain: ["noshow", "answering", "close_collect"],              ad: ["reputation", "social_manage", "content"],          build: ["apps", "websites"] },
  fitness:      { brain: ["reactivation", "close_collect", "noshow"],           ad: ["social_manage", "reputation", "crm_email"],        build: ["apps", "ecommerce"] },

  // Corrida contra o relógio: quem responde primeiro leva o serviço. Velocidade acima de tudo.
  homeservices: { brain: ["speedlead", "answering", "close_collect"],           ad: ["reputation", "marketing_ads", "seo_aeo"],          build: ["websites", "automation"] },
  cleaning:     { brain: ["speedlead", "answering", "reactivation"],            ad: ["reputation", "marketing_ads", "crm_email"],        build: ["websites", "automation"] },
  autorepair:   { brain: ["answering", "speedlead", "reactivation"],            ad: ["reputation", "seo_aeo", "crm_email"],              build: ["websites", "automation"] },

  // Ticket alto, ciclo longo: o lead não pode esfriar e o acompanhamento vale mais que o anúncio.
  realestate:   { brain: ["speedlead", "answering", "reactivation"],            ad: ["crm_email", "marketing_ads", "video_design"],      build: ["websites", "automation"] },
  law:          { brain: ["answering", "speedlead", "multilingual"],            ad: ["seo_aeo", "reputation", "crm_email"],              build: ["websites", "automation"] },

  retail:       { brain: ["answering", "close_collect", "reactivation"],        ad: ["social_manage", "marketing_ads", "reputation"],    build: ["ecommerce", "apps", "websites"] },
};

/** O mapa de um nicho, com reserva declarada no universal — nunca lista vazia. */
export const guileoDoNicho = (id) => GUILEO_POR_VERTICAL[id] || GUILEO_POR_VERTICAL.universal;
/** true quando o nicho ainda não foi mapeado — a tela DIZ isso em vez de fingir que é sob medida. */
export const nichoMapeado = (id) => Object.prototype.hasOwnProperty.call(GUILEO_POR_VERTICAL, id);
