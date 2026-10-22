// NOME DO PAINEL — a única fonte do nome que o cliente vê.
//
// Por que existe: até 2026-09-09 o painel se chamava "Growth Cockpit" em ~60 lugares
// (login, sidebar, nav pública, dicionários PT/ES/HI, deck, academia, e-mails). Renomear
// exigia caçar string por string em 4 idiomas — e cada onda deixava um "cockpit" órfão
// em uma tela (o dict ES até traduzia como "Centro de crecimiento" enquanto o PT dizia
// "Growth Cockpit"). Decisão do dono: o painel chama "Central" — palavra igual em PT, ES
// e EN, então não precisa de tradução. Toda ocorrência visível passa por esta constante;
// mudar o nome de novo é trocar UMA linha.
//
// ⚠️ functions/lib/emailTemplates.js ainda diz "Growth Cockpit" (arquivo de outro dono —
// ver relatório da onda). Quando alinhar, importe daqui, não redigite.
export const NOME_DO_PAINEL = "Central";
