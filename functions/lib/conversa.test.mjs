// O FIO DA CONVERSA nos canais de mensagem — lembra, esquece depois, e não vaza entre negócios.
import { chaveDaConversa, aparar, lerConversa, gravarTroca } from "./conversa.js";

let falhas = 0, total = 0;
const confere = (nome, cond) => { total++; if (!cond) { falhas++; console.log(`❌ ${nome}`); } };
const kvFalso = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v, o) => { m.set(k, v); m.ttl = o && o.expirationTtl; } }; };

const A = "spa@exemplo.com", B = "clinica@exemplo.com", F = "+19295350191";
confere("a mesma pessoa no mesmo canal tem a mesma chave", chaveDaConversa(A, "whatsapp", F) === chaveDaConversa("SPA@exemplo.com", "WhatsApp", "whatsapp:+19295350191"));
confere("outro negócio, outra conversa", chaveDaConversa(A, "whatsapp", F) !== chaveDaConversa(B, "whatsapp", F));
confere("outro canal, outra conversa", chaveDaConversa(A, "whatsapp", F) !== chaveDaConversa(A, "sms", F));
confere("outra pessoa, outra conversa", chaveDaConversa(A, "sms", F) !== chaveDaConversa(A, "sms", "+19295350192"));
confere("a chave não carrega o telefone em claro", !chaveDaConversa(A, "sms", F).includes("9295350191"));
confere("sem negócio, sem canal ou sem pessoa não há chave", chaveDaConversa("", "sms", F) === "" && chaveDaConversa(A, "", F) === "" && chaveDaConversa(A, "sms", "") === "");

confere("turno sem texto ou de papel estranho sai", aparar([{ role: "user", text: " " }, { role: "system", text: "x" }, { role: "gui", text: "ok" }, null]).length === 1);
confere("no máximo 8 turnos, os mais recentes", (() => { const t = aparar(Array.from({ length: 20 }, (_, i) => ({ role: "user", text: `m${i}` }))); return t.length === 8 && t[7].text === "m19" && t[0].text === "m12"; })());
confere("texto longo é cortado", aparar([{ role: "user", text: "a".repeat(2000) }])[0].text.length === 500);

const env = { RATE_LIMIT: kvFalso() };
confere("conversa nova começa vazia", (await lerConversa(env, A, "whatsapp", F)).length === 0);
confere("grava a pergunta e a resposta", await gravarTroca(env, A, "whatsapp", F, { pergunta: "quero um facial", resposta: "Para que dia?" }));
const h1 = await lerConversa(env, A, "whatsapp", F);
confere("a próxima mensagem lê as duas", h1.length === 2 && h1[0].role === "user" && h1[0].text === "quero um facial" && h1[1].role === "gui");
await gravarTroca(env, A, "whatsapp", F, { anteriores: h1, pergunta: "quinta", resposta: "Quinta às 14h serve?" });
confere("a conversa acumula na ordem", (await lerConversa(env, A, "whatsapp", F)).map((t) => t.text).join("|") === "quero um facial|Para que dia?|quinta|Quinta às 14h serve?");
confere("guarda por 24 horas", env.RATE_LIMIT.m.ttl === 86400);
confere("o outro negócio não enxerga esta conversa", (await lerConversa(env, B, "whatsapp", F)).length === 0);
await gravarTroca(env, A, "sms", F, { pergunta: "oi", resposta: "" });
confere("resposta vazia não vira turno", (await lerConversa(env, A, "sms", F)).length === 1);

confere("sem KV: lê vazio e não grava, sem erro", (await lerConversa({}, A, "sms", F)).length === 0 && (await gravarTroca({}, A, "sms", F, { pergunta: "a", resposta: "b" })) === false);
const quebrado = { RATE_LIMIT: { get: async () => { throw new Error("kv"); }, put: async () => { throw new Error("kv"); } } };
confere("KV fora do ar não derruba a conversa", (await lerConversa(quebrado, A, "sms", F)).length === 0 && (await gravarTroca(quebrado, A, "sms", F, { pergunta: "a", resposta: "b" })) === false);
const lixo = { RATE_LIMIT: { get: async () => "{nao é json", put: async () => {} } };
confere("valor corrompido vira conversa vazia", (await lerConversa(lixo, A, "sms", F)).length === 0);

if (falhas) { console.log(`\n${falhas} errados.`); process.exit(1); }
console.log(`✅ ${total}/${total} — WhatsApp, SMS e redes lembram da conversa, por 24h, sem misturar negócios`);
