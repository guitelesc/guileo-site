// ── TRAVA DE E-MAIL NA SAÍDA (2026-10-12) ─────────────────────────────────────────────────────────
// Luis: «pare com os e-mails da Guileo, por favor, não preciso agora». Mais de 20 rotas mandam e-mail
// direto para a Resend (alarme, backup, digest, contrato, chamado, e as campanhas de cliente-final que
// chegavam porque o Gmail dele está cadastrado como cliente de TESTE em contas demo e na Natura).
// Desligar uma por uma deixaria escapar a 21ª. Aqui é UMA porta: todo POST para api.resend.com passa
// por `filtrarEnvio`, que tira os endereços bloqueados de to/cc/bcc. Sobrou destinatário → envia aos
// outros. Não sobrou → não envia e devolve um recibo marcado `bloqueado:true` (com id, para o chamador
// não registrar "falha de envio" por um e-mail que foi barrado de propósito).
//
// Bloqueados: env EMAILS_BLOQUEADOS (lista separada por vírgula) — padrão o Gmail do Luis.
// Religar: env EMAILS_LUIS=1 no Cloudflare (desliga a trava inteira) — sem mudar código.
// NADA é apagado: os eventos, o feed do /admin e o backup continuam sendo gravados.

const PADRAO = "luistelesc@gmail.com";

export function listaBloqueada(env) {
  if (env && String(env.EMAILS_LUIS || "") === "1") return [];
  return String((env && env.EMAILS_BLOQUEADOS) || PADRAO)
    .split(",").map((x) => x.trim().toLowerCase()).filter((x) => x.includes("@"));
}

// "Nome <a@b.com>" ou "a@b.com" → "a@b.com"
const enderecoDe = (v) => {
  const s = String(v || "");
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
};

// ALARME PASSA (2026-10-14). A trava nasceu para parar e-mail de produto, campanha e digest. Alarme de
// operação (cota de voz, saldo Twilio, cron caído) NÃO é esse e-mail: é o único que precisa chegar — e
// em 13/10 ficou um dia inteiro barrado com a cota de voz em 96%. O alarme da casa sai sempre por
// opsAlertEmail com o assunto "⚠️ [Guileo Ops] …" (lib/avisarDono.js); é esse assunto que libera.
// Desligar só isto: env ALARMES_LUIS=0 (a trava geral continua como está).
export function ehAlarme(email) {
  return !!(email && typeof email === "object" && /^⚠️ \[Guileo Ops\]/.test(String(email.subject || "")));
}
export function alarmesLiberados(env) {
  return String((env && env.ALARMES_LUIS) || "") !== "0";
}

// Recebe UM e-mail no formato da Resend e devolve { email, removidos, vazio }.
export function filtrarEnvio(email, bloqueados) {
  if (!email || typeof email !== "object" || !bloqueados.length) return { email, removidos: [], vazio: false };
  const removidos = [];
  const limpa = (campo) => {
    if (email[campo] == null) return;
    const lista = Array.isArray(email[campo]) ? email[campo] : [email[campo]];
    const fica = lista.filter((d) => {
      const barra = bloqueados.includes(enderecoDe(d));
      if (barra) removidos.push(enderecoDe(d));
      return !barra;
    });
    if (fica.length) email[campo] = Array.isArray(email[campo]) ? fica : fica[0];
    else delete email[campo];
  };
  limpa("to"); limpa("cc"); limpa("bcc");
  const vazio = !email.to || (Array.isArray(email.to) && !email.to.length);
  return { email, removidos, vazio };
}

// Instala a trava em globalThis.fetch UMA vez por isolate. Lê a lista a cada chamada (env pode mudar).
export function instalarTrava(env) {
  if (!globalThis.fetch || globalThis.__travaEmail) { if (globalThis.__travaEmail) globalThis.__travaEmail.env = env; return; }
  const original = globalThis.fetch.bind(globalThis);
  const estado = { env };
  globalThis.__travaEmail = estado;
  globalThis.fetch = async (entrada, init = {}) => {
    try {
      const url = typeof entrada === "string" ? entrada : (entrada && entrada.url) || "";
      if (!/^https:\/\/api\.resend\.com\/emails/.test(url) || !init || typeof init.body !== "string") return original(entrada, init);
      const bloqueados = listaBloqueada(estado.env);
      if (!bloqueados.length) return original(entrada, init);
      let corpo;
      try { corpo = JSON.parse(init.body); } catch { return original(entrada, init); }
      const lote = Array.isArray(corpo);
      const itens = lote ? corpo : [corpo];
      const restantes = [];
      let barrados = 0;
      for (const it of itens) {
        if (ehAlarme(it) && alarmesLiberados(estado.env)) { restantes.push(it); continue; }   // alarme de operação passa
        const r = filtrarEnvio(it, bloqueados);
        if (r.removidos.length) barrados += r.removidos.length;
        if (!r.vazio) restantes.push(r.email);
      }
      if (!barrados) return original(entrada, init);
      try { console.log(JSON.stringify({ trava_email: true, barrados, restantes: restantes.length, url })); } catch { /* */ }
      if (!restantes.length) {
        const recibo = lote
          ? { data: itens.map(() => ({ id: `bloqueado-${Date.now()}` })), bloqueado: true }
          : { id: `bloqueado-${Date.now()}`, bloqueado: true };
        return new Response(JSON.stringify(recibo), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return original(entrada, { ...init, body: JSON.stringify(lote ? restantes : restantes[0]) });
    } catch {
      return original(entrada, init);
    }
  };
}
