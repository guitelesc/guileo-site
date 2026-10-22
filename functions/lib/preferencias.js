// PREFERÊNCIAS ANTES DA VISITA — as partes PURAS (sem rede, sem banco). (2026-10-05)
// O e-mail de confirmação e o lembrete levam "como você prefere?"; a cliente escolhe conversa ou
// silêncio, pressão, temperatura, aroma, onde focar, alergias — e a equipe recebe antes de ela chegar.
// Quem usa: functions/api/preferencias.js (página e gravação), agent-schedule.js e proactive.js (o link).
//
// Por quê: os clientes que voltam citam "os detalhes": ser recebido como alguém esperado. E o que a
// pessoa escolhe antes de chegar a deixa mais comprometida com o horário (menos falta).
//
//   node --test functions/lib/preferencias.test.mjs

/* Só serviço de CUIDADO pessoal recebe o link. A plataforma atende restaurante e encanador também:
   "qual pressão você prefere?" num conserto de pia é absurdo. Na dúvida, sem link. */
const CUIDADO = /\b(massag\w*|masaje\w*|massage|spa|facial\w*|face|peel\w*|microderm\w*|dermaplan\w*|hydrafacial|cleansing|limpeza|skin|pele|wax\w*|depila\w*|lash\w*|c[ií]lio\w*|brow\w*|sobrancelha\w*|threading|hair|cabelo\w*|cut|corte|haircut|color\w*|colou?r|balayage|highlights?|mechas?|blowout|escova|keratin\w*|queratina|treatment|tratamento|manicure|pedicure|nail\w*|unha\w*|makeup|maquiagem|acupunct\w*|acupuntura|reflexolog\w*|drenagem|drainage|lymphatic|deep tissue|swedish|hot stone|aromather\w*|body wrap|scrub|esfolia\w*)\b/i;
const MASSAGEM = /\b(massag\w*|masaje\w*|deep tissue|swedish|hot stone|drenagem|drainage|lymphatic|reflexolog\w*|shiatsu|thai)\b/i;

export const servicoDeCuidado = (servico) => CUIDADO.test(String(servico || ""));
export const ehMassagem = (servico) => MASSAGEM.test(String(servico || ""));

/* As escolhas fechadas: valor gravado → nada além disso entra no banco. */
export const ESCOLHAS = {
  conversation: ["chat", "quiet"],
  pressure: ["light", "medium", "firm"],
  temperature: ["cold", "warm"],
  scent: ["light", "none"],
};
export const TEXTOS = { focus: 200, allergies: 300, notes: 500 };

// tira caracteres de controle (o texto vai para um e-mail e para a ficha da cliente)
const semControle = (t) => [...t].filter((c) => { const n = c.charCodeAt(0); return n >= 32 && n !== 127; }).join("");
const limpaTexto = (v, max) => semControle(String(v == null ? "" : v).replace(/\s+/g, " ")).trim().slice(0, max);

/* O que a página mandou → o que pode ser gravado. Chave desconhecida some; valor fora da lista some;
   texto é aparado. Nada escolhido nem escrito = { ok:false } (não grava um formulário vazio). */
export function limparPrefs(cru) {
  const p = {};
  const src = cru && typeof cru === "object" && !Array.isArray(cru) ? cru : {};
  for (const [k, ok] of Object.entries(ESCOLHAS)) if (ok.includes(src[k])) p[k] = src[k];
  for (const [k, max] of Object.entries(TEXTOS)) { const t = limpaTexto(src[k], max); if (t) p[k] = t; }
  return Object.keys(p).length ? { ok: true, prefs: p } : { ok: false, code: "vazio" };
}

const L = (lang) => (lang === "pt" || lang === "es" ? lang : "en");

/* Os textos da página e do aviso, nos três idiomas da casa. */
export const ROTULOS = {
  en: {
    conversation: ["Conversation", { chat: "I'd love to chat", quiet: "Quiet time, please" }],
    pressure: ["Pressure", { light: "Light", medium: "Medium", firm: "Firm" }],
    temperature: ["Temperature", { cold: "I get cold easily", warm: "I get warm easily" }],
    scent: ["Scent", { light: "A light scent is nice", none: "No scents, please" }],
    focus: ["Focus on", "Neck and shoulders, lower back…"],
    allergies: ["Allergies or sensitivities", "Nuts, latex, fragrance, sensitive skin…"],
    notes: ["Anything else we should know?", "A special occasion, an injury, anything that helps us take care of you."],
  },
  pt: {
    conversation: ["Conversa", { chat: "Adoro conversar", quiet: "Prefiro silêncio" }],
    pressure: ["Pressão", { light: "Leve", medium: "Média", firm: "Firme" }],
    temperature: ["Temperatura", { cold: "Sinto frio fácil", warm: "Sinto calor fácil" }],
    scent: ["Aroma", { light: "Um aroma leve é bom", none: "Sem aroma, por favor" }],
    focus: ["Foco em", "Pescoço e ombros, lombar…"],
    allergies: ["Alergias ou sensibilidades", "Castanhas, látex, fragrância, pele sensível…"],
    notes: ["Algo mais que devemos saber?", "Uma ocasião especial, uma lesão, o que ajudar a cuidar de você."],
  },
  es: {
    conversation: ["Conversación", { chat: "Me encanta conversar", quiet: "Prefiero silencio" }],
    pressure: ["Presión", { light: "Suave", medium: "Media", firm: "Firme" }],
    temperature: ["Temperatura", { cold: "Siento frío fácilmente", warm: "Siento calor fácilmente" }],
    scent: ["Aroma", { light: "Un aroma suave está bien", none: "Sin aromas, por favor" }],
    focus: ["Enfocar en", "Cuello y hombros, espalda baja…"],
    allergies: ["Alergias o sensibilidades", "Nueces, látex, fragancia, piel sensible…"],
    notes: ["¿Algo más que debamos saber?", "Una ocasión especial, una lesión, lo que nos ayude a cuidarle."],
  },
};

/* As preferências em linhas legíveis, alergia PRIMEIRO (é a que pode machucar alguém). */
export function resumoPrefs(prefs, lang = "en") {
  const R = ROTULOS[L(lang)];
  const p = prefs && typeof prefs === "object" ? prefs : {};
  const ordem = ["allergies", "conversation", "pressure", "focus", "temperature", "scent", "notes"];
  const out = [];
  for (const k of ordem) {
    if (!p[k]) continue;
    const [rotulo, valores] = R[k];
    out.push([rotulo, typeof valores === "object" ? (valores[p[k]] || "") : String(p[k])]);
  }
  return out.filter(([, v]) => v);
}

/* A linha do evento no painel: curta, sem o texto livre inteiro. */
export function resumoCurto(prefs, nome = "", servico = "") {
  const tem = prefs && prefs.allergies ? " · ⚠️ alergia informada" : "";
  return `📝 Preferências antes da visita · ${nome || "cliente"}${servico ? ` · ${servico}` : ""}${tem}`.slice(0, 200);
}

/* A cor do botão da página (texto BRANCO sobre ela). O carregador de marca entrega a cor ajustada para
   o e-mail ESCURO (clareada); na página clara o botão precisa do contrário: escurece até o branco
   passar de 4,5:1. Sem cor válida → o rosa de texto da casa. */
const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luz = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255); };
export const contrasteComBranco = (hex) => 1.05 / (luz(hex) + 0.05);
export function corDoBotao(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(String(hex || ""))) return "#98505F";
  let n = parseInt(hex.slice(1), 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  for (let i = 0; i < 20; i++) {
    const h = "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
    if (contrasteComBranco(h) >= 4.5) return h;
    r *= 0.9; g *= 0.9; b *= 0.9;
  }
  return "#1C1C1C";
}
