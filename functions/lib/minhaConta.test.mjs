// O LINK MÁGICO DA "MINHA CONTA" — vale para UM negócio, UM e-mail e por no máximo 7 dias.
//   node functions/lib/minhaConta.test.mjs
import { contaToken, contaConfere, contaUrl, visitaToken } from "./visita.js";

let falhas = 0, total = 0;
const confere = (nome, cond) => { total++; if (!cond) { falhas++; console.log(`❌ ${nome}`); } };
const env = { INGEST_SECRET: "segredo-de-teste" };
const T = "spa@exemplo.com", E = "cliente@exemplo.com";
const agora = Date.parse("2026-10-05T12:00:00Z");
const DIA = 86400000;

const k = await contaToken(env, T, E, { agora });
const [corpo, sig] = k.split(".");
confere("token tem corpo e assinatura de 32", !!corpo && /^[0-9a-f]{32}$/.test(sig));
confere("o e-mail não vai em texto puro no token", !k.includes(E) && !k.includes("@"));
const ok = await contaConfere(env, k, { agora });
confere("token certo confere e devolve negócio + e-mail", ok.ok === true && ok.tenant === T && ok.email === E);
confere("prazo é 7 dias", ok.exp === Math.floor(agora / 1000) + 7 * 86400);
confere("maiúscula vira minúscula", (await contaConfere(env, await contaToken(env, T.toUpperCase(), ` ${E.toUpperCase()} `, { agora }), { agora })).email === E);
confere("vale até o último segundo do 7º dia", (await contaConfere(env, k, { agora: agora + 7 * DIA - 1000 })).ok === true);

// expirado: assinatura boa, prazo vencido → "expired" com o negócio (para pedir outro link)
const venc = await contaConfere(env, k, { agora: agora + 7 * DIA + 1000 });
confere("depois de 7 dias o link vence", venc.ok === false && venc.motivo === "expired" && venc.tenant === T && !venc.email);

// adulteração
const virar = (s, i) => s.slice(0, i) + (s[i] === "0" ? "1" : "0") + s.slice(i + 1);
confere("assinatura adulterada não serve", (await contaConfere(env, `${corpo}.${virar(sig, 31)}`, { agora })).motivo === "invalid");
const forja = (t, e, x) => btoa(`${t}\n${e}\n${x}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const x = ok.exp;
confere("trocar o e-mail derruba o link", (await contaConfere(env, `${forja(T, "outra@exemplo.com", x)}.${sig}`, { agora })).motivo === "invalid");
confere("trocar o negócio derruba o link", (await contaConfere(env, `${forja("outro@exemplo.com", E, x)}.${sig}`, { agora })).motivo === "invalid");
confere("esticar o prazo derruba o link", (await contaConfere(env, `${forja(T, E, x + 86400)}.${sig}`, { agora: agora + 7 * DIA + 1000 })).motivo === "invalid");
confere("expirado forjado não vaza 'expired'", (await contaConfere(env, `${forja(T, E, x - 30 * 86400)}.${sig}`, { agora })).motivo === "invalid");
confere("lixo não serve", (await contaConfere(env, "abc.def", { agora })).motivo === "invalid" && (await contaConfere(env, "", { agora })).motivo === "invalid" && (await contaConfere(env, null, { agora })).motivo === "invalid");
confere("outro segredo não confere", (await contaConfere({ INGEST_SECRET: "outro" }, k, { agora })).motivo === "invalid");

// fail-closed e separação de propósito
confere("sem segredo não existe token", (await contaToken({}, T, E, { agora })) === "" && (await contaConfere({}, k, { agora })).ok === false);
confere("e-mail inválido não assina", (await contaToken(env, T, "nao-e-email", { agora })) === "" && (await contaToken(env, "slug-sem-arroba", E, { agora })) === "");
confere("assinatura da conta ≠ token de visita do mesmo negócio", !(await visitaToken(env, T, "48181fbf-1143-47ca-9cca-730fb84f2b57", "conta")).startsWith(sig.slice(0, 24)));
confere("prazo pedido acima de 7 dias é cortado em 7", (await contaConfere(env, await contaToken(env, T, E, { agora, dias: 90 }), { agora })).exp === x);

// URL
const u = await contaUrl(env, T, E, "https://guileoai.com/", "es");
confere("a URL aponta para /minha-conta?k=…&lang=es", u.startsWith("https://guileoai.com/minha-conta?k=") && u.endsWith("&lang=es") && !u.includes("%40") && !u.includes("@"));
confere("sem segredo, sem URL", (await contaUrl({}, T, E)) === "");
const kDaUrl = decodeURIComponent(new URL(u).searchParams.get("k"));
confere("o k da URL confere de volta", (await contaConfere(env, kDaUrl)).ok === true);

if (falhas) { console.log(`\n${falhas} de ${total} errados.`); process.exit(1); }
console.log(`✅ ${total}/${total} — o link da conta só abre UM negócio, UM e-mail, por até 7 dias`);
