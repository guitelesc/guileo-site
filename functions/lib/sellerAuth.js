// functions/lib/sellerAuth.js — O CRACHÁ DO VENDEDOR, em UM lugar só.
//
// POR QUE EXISTE: a validação "este e-mail + este código são de um vendedor de verdade" nasceu
// inline dentro de `functions/api/onboard-draft.js` (função `sellerAuthFull`). Enquanto era UM
// endpoint, tudo bem. No momento em que um SEGUNDO endpoint precisa do mesmo portão — o
// /api/pay-link-br, que deixa o vendedor mintar link de pagamento em real sem passar pelo
// admin — copiar a lógica seria criar duas verdades sobre quem é vendedor. Duas verdades sobre
// autenticação é como se abre buraco: alguém conserta uma e esquece a outra.
//
// ⚠️ TODO (dono do onboard-draft.js): `sellerAuthFull` lá dentro é HOJE uma cópia idêntica do que
// está aqui. A deduplicação (trocar as ~35 linhas locais por `import { sellerAuthFull } from
// "../lib/sellerAuth.js"`) fica para quem é dono daquele arquivo — este lib foi criado numa onda
// paralela e mexer no arquivo alheio quebraria a regra de dono único (ARQUITETURA.md §Ondas).
//
// AS DUAS PORTAS (a mais simples primeiro):
//   • `sellerFromSid(env, sid)`  — o crachá HMAC assinado no /api/seller-login (lib/sellerSession.js).
//     É o que os endpoints seller-* já usam (avaliacao.js, pitch-ai, lista-ligacao). Devolve só o
//     E-MAIL: o crachá não carrega `ref`, então quem precisa de `ref` fiel usa a porta de baixo.
//   • `sellerAuthFull(env, email, code)` — roster no banco (seller_auth_check) e, se não houver,
//     roster de env/bootstrap ou o código de time compartilhado. Devolve { email, name, ref, roster }.
//
// `authSeller` junta as duas e é o que os endpoints novos devem chamar.
import { safeEq } from "./guard.js";
import { verifySession } from "./sellerSession.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// Bootstrap roster — os dois donos. Igual ao de onboard-draft.js/seller-login.js.
const BOOTSTRAP = [
  { email: "luistelesc@gmail.com", code: "GUILEO-DONO", name: "Luis Teles", ref: "luis" },
  { email: "smart@guileoai.com", code: "GUILEO-DONO", name: "Guileo", ref: "guileo" },
];
const TEAM_CODE_DEFAULT = "GUILEO-TIME-2026";
export const sellerSlug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function roster(env) {
  try { if (env && env.SELLER_ROSTER) { const arr = JSON.parse(env.SELLER_ROSTER); if (Array.isArray(arr) && arr.length) return arr; } } catch { /* cai no bootstrap */ }
  return BOOTSTRAP;
}

// Roster de env / código de time (sem banco). Cópia fiel do `sellerAuth` de onboard-draft.js.
export function sellerAuthEnv(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  if (!e || !c) return null;
  const match = roster(env).find((s) => (s.email || "").trim().toLowerCase() === e && safeEq(String(s.code || ""), c));
  if (match) return { email: e, name: match.name || e.split("@")[0], ref: (match.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  const teamCode = (env && env.TEAM_INVITE_CODE) || TEAM_CODE_DEFAULT;
  // vendedor de código de time é real mas NÃO verificado (qualquer um com o código compartilhado
  // pode reivindicar qualquer e-mail) — por isso vem roster:false e quem consome decide o que
  // libera para ele. Aqui, no pay-link BR, ele PODE gerar link: o valor não vem dele, vem do plano.
  if (safeEq(c, teamCode)) return { email: e, name: e.split("@")[0], ref: sellerSlug(e.split("@")[0]) || "team", roster: false };
  return null;
}

// Roster no BANCO (db/seller_roster.sql) — a fonte da verdade quando existe, gerida no /admin.
// Tentada ANTES do env: um 404/erro da RPC apenas cai fora, NUNCA quebra o login que já funciona.
export async function sellerAuthDB(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  const ING = env && env.INGEST_SECRET;
  if (!e || !c || !ING) return null;
  try {
    const r = await rpc("seller_auth_check", { p_secret: ING, p_email: e, p_code: c });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    // ⚠️ lê a RESPOSTA da RPC, não o status HTTP (lição status-não-é-autenticação, 2026-08-15).
    if (!d || !d.ok) return null;
    return { email: e, name: d.name || e.split("@")[0], ref: (d.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  } catch { return null; }
}

// Auth unificada por e-mail+código: banco primeiro (best-effort), depois env/código de time.
export async function sellerAuthFull(env, email, code) {
  return (await sellerAuthDB(env, email, code)) || sellerAuthEnv(env, email, code);
}

// Crachá assinado (o caminho mais simples, que os endpoints seller-* já usam). Só devolve e-mail:
// o HMAC assina "email|expira" e não carrega `ref`. O `ref` volta derivado do e-mail — é o MESMO
// derivador do caminho de código de time, então a atribuição não muda de forma entre as portas.
export async function sellerFromSid(env, sid) {
  const em = await verifySession(env, (sid || "").toString());
  if (!em) return null;
  return { email: em, name: em.split("@")[0], ref: sellerSlug(em.split("@")[0]) || "time", roster: false, via: "sid" };
}

// O portão que os endpoints novos chamam: crachá OU e-mail+código.
// Prefere e-mail+código quando vier, porque só ele devolve o `ref` REAL do roster (comissão certa).
export async function authSeller(env, { sid, email, code } = {}) {
  if (email && code) { const s = await sellerAuthFull(env, email, code); if (s) return { ...s, via: s.roster ? "code" : "team" }; }
  return await sellerFromSid(env, sid);
}
