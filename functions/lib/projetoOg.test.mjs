// PRÉVIA DO /projeto — o <head> certo no HTML cru, sem banco.
//   node functions/lib/projetoOg.test.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { projetoOg, CARTAO_PROJETO_NATURA, CARTAO_PROJETO } from "./projetoOg.js";

const casca = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const TOK = "b".repeat(48);
const ctx = (url) => ({
  request: new Request(url), env: {},
  next: async () => new Response(casca, { status: 200, headers: { "content-type": "text/html; charset=utf-8", etag: "\"x\"" } }),
});
const meta = (html, k) => (html.match(new RegExp(`<meta\\s+(?:name|property)="${k.replace(/[:.]/g, "\\$&")}"\\s+content="([^"]*)"`, "i")) || [])[1];
const title = (html) => (html.match(/<title>([^<]*)<\/title>/) || [])[1];
let falhas = 0;
const caso = async (nome, fn) => { try { await fn(); console.log("ok  ", nome); } catch (e) { falhas++; console.log("FAIL", nome, "\n    ", e.message); } };

await caso("tema natura-deck → capa Build to Go-Live", async () => {
  let pediu = null;
  const r = await projetoOg(ctx(`https://guileoai.com/projeto?t=${TOK}`), async (_e, t) => { pediu = t; return "natura-deck"; });
  const h = await r.text();
  assert.equal(pediu, TOK);
  assert.equal(title(h), CARTAO_PROJETO_NATURA.title);
  assert.equal(meta(h, "og:image"), CARTAO_PROJETO_NATURA.image);
  assert.equal(meta(h, "og:url"), `https://guileoai.com/projeto?t=${TOK}`);
  assert.equal(meta(h, "robots"), "noindex, nofollow");
  assert.ok(!r.headers.get("etag"));
});
await caso("token inválido → neutro, sem consultar o banco", async () => {
  let consultou = false;
  const r = await projetoOg(ctx("https://guileoai.com/projeto?t=curto"), async () => { consultou = true; return "natura-deck"; });
  const h = await r.text();
  assert.equal(consultou, false);
  assert.equal(title(h), CARTAO_PROJETO.title);
  assert.equal(meta(h, "og:url"), "https://guileoai.com/projeto");
});
await caso("banco fora (null) → neutro", async () => {
  const h = await (await projetoOg(ctx(`https://guileoai.com/projeto?t=${TOK}`), async () => null)).text();
  assert.equal(title(h), CARTAO_PROJETO.title);
});
await caso("CONTROLE: outro tema não recebe a capa da Natura", async () => {
  const h = await (await projetoOg(ctx(`https://guileoai.com/projeto?t=${TOK}`), async () => "outro")).text();
  assert.notEqual(title(h), CARTAO_PROJETO_NATURA.title);
});
await caso("exceção na consulta → casca original intacta", async () => {
  const r = await projetoOg(ctx(`https://guileoai.com/projeto?t=${TOK}`), async () => { throw new Error("x"); });
  assert.equal(r.status, 200);
});
console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo ok");
process.exit(falhas ? 1 : 0);
