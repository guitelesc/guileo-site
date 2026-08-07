// Sessão assinada do vendedor — prova, do lado do servidor, que quem chama JÁ passou pelo login.
//
// POR QUE EXISTE: o /api/pitch-ai (as ferramentas de IA do vendedor) era protegido só por
// `sameOrigin` + limite por IP. Isso não é autenticação: qualquer visitante da guileoai.com
// abria o console e chamava o endpoint. Duas consequências reais — (1) gasto de modelo pago
// pela Guileo por quem não é vendedor, e (2) o material de venda (dores, objeções, cunha
// competitiva) vira self-service pra qualquer um, inclusive concorrente.
//
// COMO: HMAC-SHA256 sobre "email|expira", com a chave que só o servidor tem (INGEST_SECRET,
// nunca vai pro bundle). Sem estado: não precisa consultar o banco a cada chamada, e não dá
// pra forjar sem a chave. É um crachá, não uma senha — só diz "este e-mail passou pelo login
// até tal data". Quem for revogar um vendedor, revoga no roster (o crachá expira em 30 dias).
const TTL_DAYS = 30;

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(env, msg) {
  const secret = (env && env.INGEST_SECRET) || "";
  if (!secret) return null; // sem chave não dá pra assinar NEM verificar — quem chama trata.
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}

// Crachá pra este e-mail. Devolve null se não há chave (o login segue funcionando sem ele).
export async function signSession(env, email) {
  const em = String(email || "").trim().toLowerCase();
  if (!em) return null;
  const exp = Date.now() + TTL_DAYS * 86400000;
  const body = `${em}|${exp}`;
  const sig = await hmac(env, body);
  return sig ? `${b64u(new TextEncoder().encode(body))}.${sig}` : null;
}

// Devolve o e-mail do vendedor, ou null. Compara em tempo constante-ish e confere a validade.
export async function verifySession(env, token) {
  try {
    const [b, sig] = String(token || "").split(".");
    if (!b || !sig) return null;
    const body = new TextDecoder().decode(Uint8Array.from(atob(b.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
    const expect = await hmac(env, body);
    if (!expect || expect.length !== sig.length) return null;
    let diff = 0;
    for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff !== 0) return null;
    const [em, exp] = body.split("|");
    if (!em || !(Number(exp) > Date.now())) return null;
    return em;
  } catch { return null; }
}
