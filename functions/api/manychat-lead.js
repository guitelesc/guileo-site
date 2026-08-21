// Cloudflare Pages Function — POST /api/manychat-lead  ·  A PONTE MANYCHAT → NOSSO FUNIL
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O ManyChat responde as DMs do Instagram/Messenger da Guileo hoje, porque não depende de crédito
// Anthropic (o `meta-webhook.js` faz a mesma coisa com o cérebro da Gui e volta a ser o caminho
// quando o crédito voltar — este arquivo não o substitui, só cobre a janela).
//
// O QUE ESTA ROTA É: uma PONTE, não um CRM. Ela recebe o lead do ManyChat (External Request) e o
// REENCAMINHA para /api/lead — a porta única que já dá, de graça: gui_actions (feed do /admin),
// CRM da Guileo, atribuição de anúncio, registro de consentimento, nurture por idioma e
// speed-to-lead. Reimplementar qualquer uma dessas coisas aqui criaria o 12º funil órfão.
// É exatamente o desenho do /api/raio-x, pelo mesmo motivo.
//
// ── COMO O LUIS LIGA ISTO (passo a passo em IMPLEMENTACAO.md → ROTA-MANYCHAT) ─────────────────
//   URL:       POST https://guileoai.com/api/manychat-lead
//   Cabeçalho: x-guileo-manychat: <valor do segredo MANYCHAT_SECRET no Cloudflare>
//   Corpo:     JSON com nome/telefone/e-mail/mensagem (formato tolerante — ver LEITURA abaixo)
//
// ── SEGURANÇA (rota PÚBLICA: qualquer um na internet consegue bater nela) ─────────────────────
//   1. SEGREDO PRÓPRIO (`MANYCHAT_SECRET`), comparado em tempo constante. NÃO reusa o INGEST:
//      o INGEST abre as RPCs de dados/CRM do banco inteiro; entregá-lo a uma ferramenta de
//      terceiro (onde ele fica salvo num campo de texto de uma automação) seria trocar o
//      chaveiro da casa pela chave da porta da frente. Segredo vazado aqui = esta rota, só.
//   2. FECHA SEM CONFIGURAÇÃO: sem `MANYCHAT_SECRET` no ambiente a rota responde 503 e NÃO
//      aceita nada. Uma ponte pública sem segredo definido seria um formulário aberto de spam.
//   3. Limite por IP (60/min) — folgado para o ManyChat, fatal para um script.
//   4. Campos mínimos: sem NENHUMA forma de contato o pedido é recusado (400). Um lead que a
//      gente não consegue responder não é lead, é linha suja no feed do Luis.
//   ⚠️ Sem `sameOrigin`: quem posta aqui é o servidor do ManyChat, não um navegador nosso. O
//   segredo faz esse papel — e é por isso que ele precisa existir de verdade.
//
// ── LEITURA TOLERANTE (e o que ela NUNCA faz) ────────────────────────────────────────────────
// O formato do ManyChat depende de como o Luis montar o External Request, e eu não vi o dele.
// Então aceito as variações comuns de nome de campo (`name`/`nome`/`full_name`/`first_name`+
// `last_name`, `phone`/`telefone`/`whatsapp`, `email`/`e-mail`, `message`/`mensagem`/`text`…) e
// documento exatamente o que espero. O que NÃO acontece: inventar. Campo que não veio entra
// vazio; o lead entra com o que veio.
//
// ── CONSENTIMENTO: POR QUE ESTE LEAD NÃO GANHA LIGAÇÃO AUTOMÁTICA ────────────────────────────
// O /api/lead dispara o speed-to-lead (a Gui liga em ~60s) quando há telefone e o consentimento
// não é negado. Quem manda DM no Instagram NÃO consentiu em receber ligação — isso é TCPA, e a
// multa é por ligação. Então o padrão daqui é `consent:false` + `noCall:true`: o lead entra
// inteiro no funil e o Luis liga quando quiser. Para a Gui ligar sozinha, o fluxo do ManyChat
// precisa PERGUNTAR ("posso te ligar?") e mandar `consent:true` — aí o opt-in é real e fica
// registrado no log de consentimento, com origem `manychat`.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { json, rateLimited, safeEq } from "../lib/guard.js";
import { emitFailure } from "../lib/failure.js";

const s = (v, n = 200) => (v == null ? "" : v.toString().trim().slice(0, n));

// Primeiro valor não-vazio entre vários nomes de campo possíveis.
const pega = (b, nomes, n = 200) => {
  for (const k of nomes) {
    const v = s(b[k], n);
    if (v) return v;
  }
  return "";
};

// Canais que o ManyChat opera. Vira etiqueta na mensagem do lead (o gui_actions não tem coluna
// de canal) — assim o /admin mostra "veio da DM do Instagram", não só "veio do manychat".
const CANAIS = { instagram: "Instagram", ig: "Instagram", messenger: "Messenger", facebook: "Messenger",
                 fb: "Messenger", whatsapp: "WhatsApp", wa: "WhatsApp", telegram: "Telegram", sms: "SMS" };

// Telefone só é telefone se tiver cara de telefone. O ManyChat manda o campo mesmo vazio ou com
// lixo do perfil; deixar isso virar `phone` faria o funil tentar ligar para um não-número.
function telefone(bruto) {
  const limpo = s(bruto, 40).replace(/[^0-9+]/g, "");
  const digitos = limpo.replace(/\D/g, "");
  return digitos.length >= 8 && digitos.length <= 15 ? limpo : "";
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = new URL(request.url).origin;
  try {
    // TRAVA 2 — sem segredo configurado, a ponte não existe (nunca "abre por padrão").
    const segredo = (env.MANYCHAT_SECRET || "").toString();
    if (!segredo) {
      return json({ ok: false, erro: "nao_configurado", mensagem: "MANYCHAT_SECRET não está no ambiente" }, 503);
    }

    // TRAVA 1 — o segredo. Aceito no cabeçalho próprio ou como Bearer, porque nem toda tela de
    // ferramenta no-code deixa criar cabeçalho com nome livre. Nunca na URL: query string entra
    // em log de servidor e em histórico, e isto é uma credencial.
    const auth = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const enviado = (request.headers.get("x-guileo-manychat") || auth || "").toString().trim();
    if (!safeEq(enviado, segredo)) return json({ ok: false, erro: "forbidden" }, 403);

    // TRAVA 3 — por IP.
    if (await rateLimited(request, env, "manychat", 60, 60)) return json({ ok: false, erro: "rate" }, 429);

    const b = await request.json().catch(() => null);
    if (!b || typeof b !== "object") return json({ ok: false, erro: "json_invalido" }, 400);

    // ── LEITURA TOLERANTE ────────────────────────────────────────────────────────────────────
    let nome = pega(b, ["name", "nome", "full_name", "fullName", "nome_completo"], 120);
    if (!nome) {
      const pri = pega(b, ["first_name", "firstName", "primeiro_nome"], 60);
      const ult = pega(b, ["last_name", "lastName", "sobrenome"], 60);
      nome = [pri, ult].filter(Boolean).join(" ").slice(0, 120);
    }
    const fone = telefone(pega(b, ["phone", "telefone", "whatsapp", "phone_number", "phoneNumber", "celular", "tel"], 40));
    const emailBruto = pega(b, ["email", "e-mail", "mail", "email_address", "emailAddress"], 160);
    const email = EMAIL_RE.test(emailBruto) ? emailBruto : "";
    const mensagem = pega(b, ["message", "mensagem", "text", "texto", "last_input_text", "lastInputText", "pergunta", "question"], 800);
    const negocio = pega(b, ["business", "negocio", "negócio", "company", "empresa"], 160);
    const usuario = pega(b, ["username", "ig_username", "instagram", "user_name", "handle", "subscriber_id", "subscriberId", "id"], 80);
    const canalBruto = pega(b, ["channel", "canal", "platform", "plataforma", "source_channel"], 40).toLowerCase();
    const canal = CANAIS[canalBruto] || "";
    const lang = pega(b, ["lang", "language", "idioma", "locale"], 5).toLowerCase().slice(0, 2);

    // TRAVA 4 — campos mínimos. Telefone, e-mail OU o identificador do perfil (numa DM do
    // Instagram é comum não haver nem telefone nem e-mail, e o @ ainda é uma forma de responder).
    if (!fone && !email && !usuario) {
      return json({ ok: false, erro: "sem_contato", mensagem: "envie ao menos phone, email ou username" }, 400);
    }
    // O `@` explícito é o que impede o /admin de confundir um identificador de perfil com um
    // telefone truncado — e diz ao Luis por onde responder.
    // o ManyChat manda o handle às vezes COM "@" e às vezes sem — normaliza pra não virar "@@fulano".
    // Handle errado no CRM não é cosmético: é você não achar a pessoa no Instagram depois.
    const arroba = (u) => `@${String(u).replace(/^@+/, "")}`;
    const contato = fone || email || arroba(usuario);

    // ── A MENSAGEM QUE O LUIS VAI LER NO FEED ────────────────────────────────────────────────
    const detalhes = [
      canal ? `DM do ${canal}` : "ManyChat",
      usuario && contato !== arroba(usuario) ? `perfil ${arroba(usuario)}` : "",
      mensagem,
    ].filter(Boolean).join(" · ").slice(0, 800);

    // ── CONSENTIMENTO EXPLÍCITO OU NADA (ver cabeçalho) ──────────────────────────────────────
    const consentiu = b.consent === true || b.consent === "true" || b.consentimento === true || b.consentimento === "true";

    // ── REENCAMINHA PARA O FUNIL QUE JÁ EXISTE ───────────────────────────────────────────────
    let leadOk = false, detalheFalha = "";
    try {
      const r = await fetch(`${origin}/api/lead`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://guileoai.com", // chamada interna: satisfaz o sameOrigin do irmão
        },
        body: JSON.stringify({
          name: nome, phone: fone, email, contact: contato,
          business: negocio, message: detalhes,
          source: "manychat",                 // é assim que o /admin sabe de onde veio
          channel: canal || "manychat",
          lang,
          consent: consentiu,                 // false → o /api/lead grava NO_CONSENT e não liga
          noCall: !consentiu,                 // e não dispara o speed-to-lead sem opt-in
        }),
      });
      const j = await r.json().catch(() => ({}));
      // `stored:false` significa que o /api/lead respondeu 200 mas NÃO gravou no feed — é o caso
      // exato de "sucesso sem lastro" que já custou lead aqui. Só conta como entrou se gravou.
      leadOk = r.ok && j.ok === true && j.stored !== false;
      if (!leadOk) detalheFalha = `HTTP ${r.status} ${JSON.stringify(j).slice(0, 160)}`;
    } catch (e) { detalheFalha = String(e).slice(0, 160); }

    // "ok" sem conferir já custou lead nesta casa: se o funil não confirmou, o Luis vê o evento
    // no /admin com o contato em mãos, em vez de descobrir pelo silêncio.
    if (!leadOk) {
      await emitFailure(env, "manychat_lead_nao_entrou", "",
        `lead do ManyChat NÃO confirmou no funil (${contato})`, { detalhe: detalheFalha, canal: canal || "", nome });
    }

    // O ManyChat mostra esta resposta no teste do External Request — por isso ela diz a verdade
    // sobre o que aconteceu, e não só "200 OK".
    return json({ ok: leadOk, lead_no_funil: leadOk, contato, canal: canal || null, ligacao_automatica: consentiu },
      leadOk ? 200 : 502);
  } catch (e) {
    return json({ ok: false, erro: "falha", detalhe: String(e).slice(0, 160) }, 500);
  }
}
