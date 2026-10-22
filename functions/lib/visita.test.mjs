// O LINK DO FEEDBACK PRIVADO — um token vale para UM negócio e UMA visita, e nada mais.
import { visitaToken, visitaConfere, visitaUrl, aniversarioUrl } from "./visita.js";

let falhas = 0;
const confere = (nome, cond) => { if (!cond) { falhas++; console.log(`❌ ${nome}`); } };
const env = { INGEST_SECRET: "segredo-de-teste" };
const T = "spa@exemplo.com", A = "48181fbf-1143-47ca-9cca-730fb84f2b57", B = "11111111-2222-3333-4444-555555555555";

const tok = await visitaToken(env, T, A);
confere("token tem 24 caracteres", tok.length === 24);
confere("o mesmo link sempre dá o mesmo token", tok === await visitaToken(env, T.toUpperCase(), A.toUpperCase()));
confere("token certo confere", await visitaConfere(env, T, A, tok));
confere("token de outra visita não serve", !(await visitaConfere(env, T, B, tok)));
confere("token de outro negócio não serve", !(await visitaConfere(env, "outro@exemplo.com", A, tok)));
confere("token adulterado não serve", !(await visitaConfere(env, T, A, tok.slice(0, 23) + (tok[23] === "0" ? "1" : "0"))));
confere("token vazio não serve", !(await visitaConfere(env, T, A, "")));
confere("sem segredo não existe token", (await visitaToken({}, T, A)) === "" && !(await visitaConfere({}, T, A, tok)));
confere("id que não é uuid não assina", (await visitaToken(env, T, "1 or 1=1")) === "");
confere("sem link quando não dá para assinar", (await visitaUrl({}, T, A)) === "");
const u = await visitaUrl(env, T, A);
confere("o link aponta para /api/visita com os três campos", u.startsWith("https://guileoai.com/api/visita?t=spa%40exemplo.com&a=") && u.endsWith(`&s=${tok}`));

// o link do aniversário é outro token: um não abre a página do outro
const tokB = await visitaToken(env, T, A, "aniversario");
confere("token do aniversário é diferente do de feedback", tokB.length === 24 && tokB !== tok);
confere("token de feedback não abre o aniversário", !(await visitaConfere(env, T, A, tok, "aniversario")));
confere("token do aniversário não abre o feedback", !(await visitaConfere(env, T, A, tokB)));
confere("token do aniversário confere no próprio propósito", await visitaConfere(env, T, A, tokB, "aniversario"));
confere("propósito com caractere estranho não assina", (await visitaToken(env, T, A, "a:b")) === "");
const ub = await aniversarioUrl(env, T, A);
confere("o link do aniversário aponta para /api/aniversario", ub.startsWith("https://guileoai.com/api/aniversario?t=spa%40exemplo.com&a=") && ub.endsWith(`&s=${tokB}`));

if (falhas) { console.log(`\n${falhas} errados.`); process.exit(1); }
console.log("✅ 17/17 — cada link assinado só abre a visita, e a página, para a qual foi assinado");
