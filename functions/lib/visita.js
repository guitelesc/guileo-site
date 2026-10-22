// functions/lib/visita.js — o link assinado do FEEDBACK PRIVADO de uma visita (2026-09-30).
// O e-mail de avaliação leva, para TODO cliente, o link do Google e este segundo link: "algo não foi
// bem? fale direto com a gente". O token prende o link a UM negócio e UMA visita — sem ele qualquer
// um poderia forjar reclamação em nome de outro cliente, ou varrer ids. Mesma chave e mesmo desenho
// do unsub.js: HMAC-SHA256 com o segredo do servidor, sem segredo não há token (fail-closed).
const enc = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// `proposito` separa os links: o do aniversário (2026-09-30) é assinado com outro prefixo, então um
// link não abre a página do outro — cada token vale para UMA coisa.
export async function visitaToken(env, tenant, id, proposito = "visita") {
  const key = (env && env.INGEST_SECRET) || "";
  const t = String(tenant || "").trim().toLowerCase();
  const a = String(id || "").trim().toLowerCase();
  if (!key || !t.includes("@") || !UUID.test(a) || !/^[a-z]{3,20}$/.test(proposito)) return "";
  return (await hmacHex(key, `${proposito}:${t}:${a}`)).slice(0, 24);
}

export async function visitaConfere(env, tenant, id, token, proposito = "visita") {
  const want = await visitaToken(env, tenant, id, proposito);
  const got = String(token || "").trim().toLowerCase();
  if (!want || want.length !== got.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

// "" quando não dá para assinar — e sem link o e-mail sai só com o botão de avaliação, como antes.
export async function visitaUrl(env, tenant, id, base = "https://guileoai.com") {
  const s = await visitaToken(env, tenant, id);
  if (!s) return "";
  return `${base.replace(/\/$/, "")}/api/visita?t=${encodeURIComponent(String(tenant).toLowerCase())}&a=${encodeURIComponent(String(id).toLowerCase())}&s=${s}`;
}

// O link "quando é o seu aniversário?" do e-mail de confirmação → /api/aniversario.
export async function aniversarioUrl(env, tenant, id, base = "https://guileoai.com") {
  const s = await visitaToken(env, tenant, id, "aniversario");
  if (!s) return "";
  return `${base.replace(/\/$/, "")}/api/aniversario?t=${encodeURIComponent(String(tenant).toLowerCase())}&a=${encodeURIComponent(String(id).toLowerCase())}&s=${s}`;
}

// "Remarcar ou cancelar" do e-mail de confirmação (2026-10-05) → página /minha-reserva.
// Proposito próprio: este link não abre a página de feedback nem a de aniversário, e vice-versa.
export async function reservaUrl(env, tenant, id, base = "https://guileoai.com") {
  const s = await visitaToken(env, tenant, id, "reserva");
  if (!s) return "";
  return `${base.replace(/\/$/, "")}/minha-reserva?t=${encodeURIComponent(String(tenant).toLowerCase())}&a=${encodeURIComponent(String(id).toLowerCase())}&s=${s}`;
}

// ── "MINHA CONTA" (2026-10-05) — o link mágico da área da cliente (/minha-conta) ─────────────────
// Diferente dos links acima, este não prende um agendamento: prende UM negócio, UM e-mail de cliente
// e um PRAZO (padrão 7 dias). Propósito próprio ("conta"), então nenhum link de visita/aniversário/
// reserva abre a conta, e vice-versa. O token carrega negócio + e-mail + prazo em base64url (não em
// texto puro na URL) e a assinatura cobre os três: mudar qualquer um derruba o link.
const CONTA_DIAS = 7;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const b64u = (s) => { const bytes = enc.encode(s); let bin = ""; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const deB64u = (s) => { try { const bin = atob(String(s).replace(/-/g, "+").replace(/_/g, "/")); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); } catch { return ""; } };

async function contaAssinatura(env, tenant, email, exp) {
  const key = (env && env.INGEST_SECRET) || "";
  if (!key) return "";
  return (await hmacHex(key, `conta:${tenant}:${email}:${exp}`)).slice(0, 32);
}

// "" quando não dá para assinar (sem segredo, negócio ou e-mail inválido) — fail-closed.
export async function contaToken(env, tenant, email, { dias = CONTA_DIAS, agora = Date.now() } = {}) {
  const t = String(tenant || "").trim().toLowerCase();
  const e = String(email || "").trim().toLowerCase();
  if (!EMAIL.test(t) || !EMAIL.test(e) || t.length > 200 || e.length > 200) return "";
  const exp = Math.floor(agora / 1000) + Math.round(Math.min(Math.max(Number(dias) || CONTA_DIAS, 0.0001), CONTA_DIAS) * 86400);
  const s = await contaAssinatura(env, t, e, exp);
  if (!s) return "";
  return `${b64u(`${t}\n${e}\n${exp}`)}.${s}`;
}

// { ok:true, tenant, email, exp } · { ok:false, motivo:"invalid" } · { ok:false, motivo:"expired", tenant }
// "expired" só sai com assinatura VÁLIDA — assim a página pode oferecer "mandar outro link" para o
// mesmo negócio sem confiar em nada que não foi assinado por nós.
export async function contaConfere(env, token, { agora = Date.now() } = {}) {
  const ruim = { ok: false, motivo: "invalid" };
  const [corpo, sig] = String(token || "").trim().split(".");
  if (!corpo || !sig || corpo.length > 600 || !/^[0-9a-f]{32}$/.test(sig)) return ruim;
  const partes = deB64u(corpo).split("\n");
  if (partes.length !== 3) return ruim;
  const [t, e, x] = partes;
  if (!EMAIL.test(t) || !EMAIL.test(e) || !/^\d{9,11}$/.test(x)) return ruim;
  const want = await contaAssinatura(env, t, e, x);
  if (!want || want.length !== sig.length) return ruim;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return ruim;
  const exp = Number(x);
  // prazo maior que o máximo nunca foi emitido por nós — trata como inválido
  if (exp - Math.floor(agora / 1000) > CONTA_DIAS * 86400 + 60) return ruim;
  if (exp * 1000 <= agora) return { ok: false, motivo: "expired", tenant: t };
  return { ok: true, tenant: t, email: e, exp };
}

export async function contaUrl(env, tenant, email, base = "https://guileoai.com", lang = "") {
  const k = await contaToken(env, tenant, email);
  if (!k) return "";
  const l = ["pt", "en", "es"].includes(lang) ? `&lang=${lang}` : "";
  return `${base.replace(/\/$/, "")}/minha-conta?k=${encodeURIComponent(k)}${l}`;
}

// "Como você prefere?" (2026-10-05) do e-mail de confirmação e do lembrete → /api/preferencias.
// Proposito próprio: não abre feedback, aniversário nem remarcação — e vice-versa.
export async function preferenciasUrl(env, tenant, id, base = "https://guileoai.com") {
  const s = await visitaToken(env, tenant, id, "preferencias");
  if (!s) return "";
  return `${base.replace(/\/$/, "")}/api/preferencias?t=${encodeURIComponent(String(tenant).toLowerCase())}&a=${encodeURIComponent(String(id).toLowerCase())}&s=${s}`;
}
