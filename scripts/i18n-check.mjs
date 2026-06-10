// i18n key-parity check: compares pt/es/hi against en (deep keys) in src/i18n.jsx
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const src = readFileSync(new URL("../src/i18n.jsx", import.meta.url), "utf8");
// keep only the data part (cut at LangContext) and drop the react import
const cut = src.slice(0, src.indexOf("const LangContext"));
const code = cut.replace(/^import .*react.*$/m, "") + "\nexport default T;\n";
const dir = mkdtempSync(join(tmpdir(), "i18n-"));
const f = join(dir, "t.mjs");
writeFileSync(f, code);
const T = (await import(f)).default;

const keysOf = (o, p = "") =>
  o && typeof o === "object" && !Array.isArray(o)
    ? Object.entries(o).flatMap(([k, v]) => keysOf(v, p ? `${p}.${k}` : k))
    : [p + (Array.isArray(o) ? `[len:${o.length}]` : "")];

const en = new Set(keysOf(T.en).map(k => k.replace(/\[len:\d+\]/, "")));
let fail = false;
for (const l of ["pt", "es", "hi"]) {
  const have = new Set(keysOf(T[l]).map(k => k.replace(/\[len:\d+\]/, "")));
  const missing = [...en].filter(k => !have.has(k));
  const extra = [...have].filter(k => !en.has(k));
  console.log(`== ${l}: ${missing.length} missing, ${extra.length} extra`);
  missing.slice(0, 40).forEach(k => console.log(`   MISSING ${k}`));
  extra.slice(0, 10).forEach(k => console.log(`   extra   ${k}`));
  if (missing.length) fail = true;
}
process.exit(fail ? 1 : 0);
