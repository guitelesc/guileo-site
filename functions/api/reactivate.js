// Cloudflare Pages Function — POST /api/reactivate  (SUPERPOWER #1: mass reactivation blitz)
// On demand, reactivate a tenant's ENTIRE lapsed-customer base at once — 1:1 personalized — by SMS and/or
// by a real Gui call. The thing no human front desk could do: reach hundreds of dormant customers in minutes.
// Tenant-gated; capped; every send logged.
//   POST { token, email, channel?: "sms"|"call"|"both", offer?, limit?, lang?, dryRun? }
//     -> motor pronto:      { ok:true, dryRun, channel, pulled, sms, calls, skipped, sample, canais }
//     -> motor indisponível:{ ok:false, motor_indisponivel:true, codigo, erro, error, pulled?, canais?, detalhe_tecnico }
//
// FONTE (2026-09-28): `biz_dormant_customers` (portão SCHED) — a MESMA lista que o win-back diário
// do proactive.js usa, então os dois motores se desduplicam pelo mesmo client_event `winback`
// (payload.contact, janela de 30 dias). Até hoje este arquivo lia `due_winback`, RPC da geração
// anterior do schema que NÃO existe neste banco: todo clique devolvia 503 motor_morto e a tela
// culpava o "código de conexão" do cliente.
import { json } from "../lib/guard.js";
import { sendText } from "../lib/twilio.js";
import { sbKey } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (env, fn, args = {}) => fetch(`${SB}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
}).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// `contact` no payload é o que a fonte usa para NÃO repetir a pessoa por 30 dias
// (biz_dormant_customers compara payload->>'contact'). Antes ia só `phone`: a trava nunca casava.
const ingest = (env, email, summary, phone, contact) => rpc(env, "ingest_client_event", {
  p_email: email, p_type: "winback", p_channel: "Phone", p_summary: summary.slice(0, 300), p_amount: 0, p_payload: { phone, contact: contact || phone, blitz: true },
});

const ligado = (v) => ["1", "true", "sim", "yes", "on"].includes(String(v == null ? "" : v).trim().toLowerCase());
const idiomaTela = (v) => { const l = String(v || "").toLowerCase().slice(0, 2); return ["en", "pt", "es", "hi"].includes(l) ? l : "en"; };

// Frases para a TELA DO DONO, nos 4 idiomas (padrão en). Sem instrução de engenharia: o nome da
// RPC / da env var vai em `detalhe_tecnico`.
const FRASES = {
  fonte_fora: {
    en: "The reactivation engine is not available right now. This does NOT mean there is nobody to win back — please try again later.",
    pt: "O motor de reativação não está disponível agora. Isto NÃO quer dizer que não há ninguém para reativar — tente de novo mais tarde.",
    es: "El motor de reactivación no está disponible ahora. Esto NO significa que no haya nadie por recuperar — inténtelo más tarde.",
    hi: "रीएक्टिवेशन इंजन अभी उपलब्ध नहीं है। इसका मतलब यह नहीं कि वापस लाने के लिए कोई ग्राहक नहीं है — कृपया बाद में फिर कोशिश करें।",
  },
  sem_canal: {
    en: "Reactivation by text or call is not available on your account yet — text messaging is still waiting for carrier approval. Nothing was sent.",
    pt: "A reativação por mensagem ou ligação ainda não está disponível na sua conta — o envio de SMS aguarda aprovação da operadora. Nada foi enviado.",
    es: "La reactivación por mensaje o llamada aún no está disponible en su cuenta — el envío de SMS espera la aprobación del operador. No se envió nada.",
    hi: "संदेश या कॉल से रीएक्टिवेशन अभी आपके खाते में उपलब्ध नहीं है — एसएमएस को कैरियर की मंज़ूरी का इंतज़ार है। कुछ भी नहीं भेजा गया।",
  },
  sms_pendente: { en: "text messaging is waiting for carrier approval", pt: "o SMS aguarda aprovação da operadora", es: "el SMS espera la aprobación del operador", hi: "एसएमएस को कैरियर की मंज़ूरी का इंतज़ार है" },
  ligacao_fora: { en: "bulk calling is not enabled yet", pt: "a ligação em massa ainda não está ligada", es: "las llamadas masivas aún no están activadas", hi: "बल्क कॉलिंग अभी चालू नहीं है" },
};
const frase = (k, lang) => (FRASES[k] && (FRASES[k][lang] || FRASES[k].en)) || "";

// O que DÁ para usar agora, de verdade — credencial E aprovação. Mesma chave que
// lib/comprovante.js lê (SMS_A2P_APROVADO): quando o A2P sair, ligar é setar a env, sem reescrita.
function canaisDe(env, lang) {
  const smsOk = ligado(env.SMS_A2P_APROVADO) && !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
  const callOk = !!(env.ELEVENLABS_API_KEY && env.ELEVENLABS_PHONE_NUMBER_ID && env.DIGEST_TOKEN);
  return {
    sms: smsOk ? { ok: true } : { ok: false, motivo: frase("sms_pendente", lang), detalhe_tecnico: "SMS_A2P_APROVADO≠1 ou credenciais Twilio ausentes" },
    // LIGAÇÃO (2026-10-13, CR-11): SÓ pelo portão blindado /api/call (DNC, trava de destino +1/+55, cooldown por
    // número), COMO O AGENTE DO PRÓPRIO NEGÓCIO (x-guileo-internal + client_email → client_agent_resolve), e SÓ
    // para quem tem consentimento REGISTRADO para ligação (db/consentimento.sql — nunca a coluna presumida).
    // Teto curto por rodada. De 28/09 a 13/10 ficou desligado aqui porque o desenho antigo discava direto na
    // ElevenLabs com o número da plataforma e sem trava de país (a fraude IRSF) — esse caminho não existe mais.
    call: callOk ? { ok: true } : { ok: false, motivo: frase("ligacao_fora", lang), detalhe_tecnico: "faltam ELEVENLABS_API_KEY / ELEVENLABS_PHONE_NUMBER_ID / DIGEST_TOKEN" },
  };
}



async function isDnc(env, phone) {
  if (!env.INGEST_SECRET) return false;
  try { const r = await fetch(`${SB}/rest/v1/rpc/is_dnc`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_phone: phone }) }); return r.ok && (await r.json()) === true; } catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // PER-TENANT GATE — bind the cockpit email to its connection key (get_client_data rejects a
    // mismatch). This endpoint fires REAL SMS, so a token must only ever reactivate ITS OWN
    // tenant's lapsed list — never an arbitrary email. No OWNER_EMAIL fallback.
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);
    const channel = ["sms", "call", "both"].includes(b.channel) ? b.channel : "sms";
    const offer = (b.offer || "").toString().slice(0, 160);
    const limit = Math.min(Math.max(parseInt(b.limit, 10) || 200, 1), 500); // hard ceiling 500/run
    const lang = (b.lang || "").toString().toLowerCase();
    // Idioma das frases da TELA: o do pedido → o do cadastro → en. (`lang` acima continua sendo o
    // idioma da MENSAGEM ao cliente final, como sempre foi.)
    const tela = idiomaTela(b.lang || (gdj.identity && gdj.identity.lang));
    const dryRun = b.dryRun === true || b.dryRun === "1"; // preview WHO + WHAT without sending a single message
    const note = (b.note || "").toString().slice(0, 160); // free-text label from the cockpit (echoed back + logged)

    // ── A FONTE ────────────────────────────────────────────────────────────────────────────
    // Lista ausente ≠ lista vazia: `|| []` aqui diria "ninguém para reativar" quando a verdade é
    // "não consegui perguntar". A tela lê `d.error` num lugar e `erro` em outro — vão as DUAS.
    const indisponivel = (codigo, fraseK, detalhe, extra = {}, status = 503) => json({
      ok: false, motor_indisponivel: true, codigo, erro: frase(fraseK, tela), error: frase(fraseK, tela), detalhe_tecnico: detalhe, ...extra,
    }, status);
    const cru = await rpc(env, "biz_dormant_customers", { p_secret: env.SCHED_SECRET || "", p_email: email, p_days: Math.min(Math.max(parseInt(b.days, 10) || 60, 14), 365), p_limit: limit });
    if (!cru || typeof cru !== "object" || !Array.isArray(cru.dormant)) {
      return indisponivel("fonte_fora", "fonte_fora", `biz_dormant_customers: ${cru && cru.error ? cru.error : "sem resposta"}`);
    }
    const rows = cru.dormant.slice(0, limit);
    const canais = canaisDe(env, tela);
    const querSms = channel === "sms" || channel === "both";
    const querCall = channel === "call" || channel === "both";
    // CR-11: quem AUTORIZOU ligação, do REGISTRO (consent_audience) — nunca da coluna presumida. Lista não lida → ninguém.
    let comConsent = null;
    if (querCall && canais.call.ok) {
      const aud = await rpc(env, "consent_audience", { p_email: email, p_channel: "call", p_limit: 2000 });
      comConsent = new Set(Array.isArray(aud) ? aud.map((x) => String(x.phone || x.contact_key || "").replace(/\D/g, "")).filter((x) => x.length >= 10) : []);
    }
    const MAX_LIGACOES = 20;   // por rodada: promoção por telefone é a mais cara e a mais sensível; ninguém "dispara 500"
    const origin = new URL(request.url).origin;
    const podeLigar = (e164) => querCall && canais.call.ok && comConsent instanceof Set && comConsent.has(e164.replace(/\D/g, "")) && out.calls < MAX_LIGACOES;

    // ── SEM CANAL LIGADO: diz a verdade ANTES de prometer alcance ─────────────────────────────
    // A prévia dizia "N clientes seriam alcançados" e o envio real alcançava zero. Se nenhum canal
    // pedido está de pé, a resposta é "ainda não disponível" — com o tamanho da lista, que é real.
    // Status 200: não é pane nossa, é estado conhecido da conta (e o corpo precisa chegar na tela).
    const algumCanal = (querSms && canais.sms.ok) || ((channel === "call" || channel === "both") && canais.call.ok);
    if (!algumCanal) {
      return indisponivel("sem_canal", "sem_canal", [canais.sms.detalhe_tecnico, canais.call.detalhe_tecnico].join(" · "),
        { dryRun, channel, pulled: rows.length, sms: 0, calls: 0, skipped: rows.length, sample: [], canais: { sms: { ok: canais.sms.ok, motivo: canais.sms.motivo || "" }, call: { ok: canais.call.ok, motivo: canais.call.motivo || "" } } }, 200);
    }

    const out = { ok: true, dryRun, channel, ...(note ? { note } : {}), pulled: rows.length, sms: 0, calls: 0, skipped: 0, sample: [],
      canais: { sms: { ok: canais.sms.ok, motivo: canais.sms.motivo || "" }, call: { ok: canais.call.ok, motivo: canais.call.motivo || "" } } };
    const biz = (gdj.identity && gdj.identity.business) || "";
    const pt = lang.startsWith("pt") || (!lang && String((gdj.identity && gdj.identity.lang) || "").startsWith("pt"));

    for (const c of rows) {
      const contato = (c.contact || "").toString();
      const e164 = contato.replace(/[^0-9+]/g, "");
      // Contato que é e-mail (ou telefone torto) não recebe SMS: conta como pulado, nunca como alcance.
      if (contato.includes("@") || !/^\+?[1-9]\d{7,14}$/.test(e164)) { out.skipped++; continue; }
      const nome = c.name || (pt ? "tudo bem" : "there");
      // 1:1 personalized message — name + business + the owner's offer.
      const msg = pt
        ? `Oi ${nome}! Sentimos sua falta${biz ? ` na ${biz}` : ""} 🌱 ${offer || "Tá com vontade de voltar essa semana? É só responder aqui!"}`.trim()
        : `Hi ${nome}! We've missed you${biz ? ` at ${biz}` : ""} 🌱 ${offer || "Want to come back this week? Just reply here!"}`.trim();

      if (await isDnc(env, e164)) { out.skipped++; continue; }

      // DRY RUN — show who'd be reached + a sample RENDERED message, send NOTHING, spend nothing.
      // Só conta o canal que está DE PÉ: a prévia tem que bater com o que o envio real faria.
      if (dryRun) {
        const liga = podeLigar(e164);
        if (querSms && canais.sms.ok) out.sms++;
        if (liga) out.calls++;
        if (!(querSms && canais.sms.ok) && !liga) out.skipped++;
        if (out.sample.length < 3) out.sample.push({ to: `${e164.slice(0, 4)}…${e164.slice(-2)}`, name: nome, msg });
        continue;
      }

      const feitos = [];
      if (querSms && canais.sms.ok) {
        const r = await sendText(env, e164, msg);
        if (r && r.sent) { out.sms++; feitos.push("sms"); }
      }
      // LIGAÇÃO (CR-11): com consentimento registrado, pelo portão /api/call, como o agente do próprio negócio.
      // `ok:true` do portão com `skipped` (recém-ligada, DNC) NÃO conta como ligação feita.
      if (podeLigar(e164)) {
        try {
          const cr = await fetch(`${origin}/api/call`, { method: "POST",
            headers: { "Content-Type": "application/json", Origin: origin, "x-guileo-internal": env.DIGEST_TOKEN },
            body: JSON.stringify({ phone: e164, name: nome, business: biz, client_email: email, lang: pt ? "pt" : "en",
              need: offer ? `promotion: ${offer}` : (pt ? "convidar a voltar esta semana" : "invite back this week") }) });
          const cj = await cr.json().catch(() => ({}));
          if (cr.ok && cj && cj.ok === true && !cj.skipped) { out.calls++; feitos.push("call"); }
        } catch { /* não discou: fica fora de `feitos` e conta como pulado */ }
      }
      if (feitos.length) await ingest(env, email, `♻️ Reactivation blitz → ${nome} (${feitos.join("+")})`, e164, contato);
      else out.skipped++;
    }
    return json(out);
  } catch (e) { return json({ ok: false, error: String(e).slice(0, 160), erro: String(e).slice(0, 160) }, 400); }
}
