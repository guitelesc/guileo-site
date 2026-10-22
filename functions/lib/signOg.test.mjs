// PRÉVIA DO /sign — o <head> certo no HTML cru, sem banco.
//   node functions/lib/signOg.test.mjs
// Casca = o index.html real do repositório; a consulta ao contrato é injetada (mock).
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { signOg, NATURA_IMAGE } from "./signOg.js";

const casca = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const TOK = "a".repeat(64);
const ctx = (url) => ({
  request: new Request(url),
  env: {},
  next: async () => new Response(casca, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate", etag: "\"x\"" } }),
});
const meta = (html, k) => (html.match(new RegExp(`<meta\\s+(?:name|property)="${k.replace(/[:.]/g, "\\$&")}"\\s+content="([^"]*)"`, "i")) || [])[1];
const title = (html) => (html.match(/<title>([^<]*)<\/title>/) || [])[1];
let falhas = 0;
const caso = async (nome, fn) => { try { await fn(); console.log("ok  ", nome); } catch (e) { falhas++; console.log("FAIL", nome, "\n    ", e.message); } };

await caso("Natura (theme natura-deck) → capa da parceria", async () => {
  const r = await signOg(ctx(`https://guileoai.com/sign?t=${TOK}`), async () => ({ body: { theme: "natura-deck" }, counterparty_name: "x", amount_cents: 300000 }));
  const h = await r.text();
  assert.equal(title(h), "Natura Spa × Guileo AI — Partnership Agreement");
  assert.equal(meta(h, "og:image"), NATURA_IMAGE);
  assert.equal(meta(h, "twitter:image"), NATURA_IMAGE);
  assert.equal(meta(h, "og:url"), `https://guileoai.com/sign?t=${TOK}`);
  assert.equal(meta(h, "twitter:card"), "summary_large_image");
  assert.equal(meta(h, "robots"), "noindex, nofollow");
  assert.match(meta(h, "og:description"), /Requested by Natura Spa/);
  assert.ok(!/3[.,]?000|\$/.test(meta(h, "og:description") + meta(h, "og:title")), "preço no meta");
  assert.equal(r.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal(r.headers.get("etag"), null);
  assert.ok(h.includes('<div id="root">'), "corpo do SPA intacto");
});
await caso("Natura (pela parte) → capa da parceria", async () => {
  const r = await signOg(ctx(`https://guileoai.com/sign?t=${TOK}`), async () => ({ body: {}, counterparty_name: "Natura Spa NYC Inc." }));
  assert.equal(meta(await r.text(), "og:image"), NATURA_IMAGE);
});
await caso("outro contrato → cartão neutro, imagem padrão", async () => {
  const r = await signOg(ctx(`https://guileoai.com/sign?t=${TOK}`), async () => ({ body: {}, counterparty_name: "Joe's Pizza" }));
  const h = await r.text();
  assert.equal(title(h), "Document for signature · Guileo AI");
  assert.equal(meta(h, "og:image"), "https://guileoai.com/og.jpg");
  assert.ok(!h.includes("Joe"), "nome da parte vazou");
});
await caso("consulta falhou (null) → neutro", async () => {
  const r = await signOg(ctx(`https://guileoai.com/sign?t=${TOK}`), async () => null);
  assert.equal(title(await r.text()), "Document for signature · Guileo AI");
});
await caso("consulta LANÇA → neutro, página sai", async () => {
  const r = await signOg(ctx(`https://guileoai.com/sign?t=${TOK}`), async () => { throw new Error("db fora"); });
  assert.equal(r.status, 200);
  assert.ok((await r.text()).includes('<div id="root">'));
});
await caso("token malformado → nem consulta, neutro, og:url sem token", async () => {
  let chamou = false;
  const r = await signOg(ctx(`https://guileoai.com/sign?t=<script>`), async () => { chamou = true; return null; });
  const h = await r.text();
  assert.equal(chamou, false);
  assert.equal(meta(h, "og:url"), "https://guileoai.com/sign");
});
console.log(falhas ? `\n${falhas} falha(s)` : "\ntodos ok");
process.exit(falhas ? 1 : 0);
