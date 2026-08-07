// Números da PLATAFORMA que nunca podem virar número de cliente.
//
// POR QUE VIVE AQUI: o bind-number já protegia a linha do demo, mas o provision-number
// (escrito depois) não — e o revisor achou o buraco: a linha do demo do site não está em
// client_agents, então ela era SEMPRE candidata a "número ocioso, custo zero". Entregar ela
// a um cliente derruba o demo da landing.
//
// Duas listas separadas divergem no dia em que alguém acrescenta um número numa e esquece a
// outra. Uma lista, dois portões.
const RESERVED = new Set([
  "19864443334", // linha de demo/saída da própria Guileo
]);

const digits = (s) => String(s || "").replace(/[^0-9]/g, "");

export const isReserved = (number) => RESERVED.has(digits(number));
export { RESERVED };
