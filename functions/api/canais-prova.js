// Cloudflare Pages Function — GET/POST /api/canais-prova?token=DIGEST_TOKEN|senha do /admin
//
// A JANELA DOS CANAIS DE MENSAGEM (SMS + WhatsApp).
//
// POR QUE EXISTE: em 2026-08-22 o dono perguntou "e agora WhatsApp e SMS?" e a plataforma inteira
// não tinha resposta. O semáforo media voz, dinheiro, agenda e agentes — nada media os dois canais
// de TEXTO. A única pista era memória e palpite, e a memória estava ERRADA nos dois:
//   · WhatsApp: eu lembrava "app da Meta não publicado". O banco mostrou outra coisa — a entrada
//     funciona, e TODA saída falha com `code 190` (token expirado). O que está guardado é um
//     `token_kind: temp_24h`, do painel da Meta, que morreu no dia seguinte ao ser colado.
//   · SMS: eu lembrava "erro 30034". Nenhum evento de SMS existe no banco — nunca houve um envio
//     registrado para confrontar. Sem janela, "não chegou" e "nunca foi tentado" têm a mesma cara.
//
// A regra do dia: construa a janela ANTES da correção. Um canal sem medição não está "ok", está
// sem observação — e isso NUNCA sai verde aqui.
//
// GATE: portão duplo, igual ao de /api/agente-prova — DIGEST_TOKEN (o cron) OU a senha do /admin,
// lendo o CORPO de `_admin_ok`, nunca o status HTTP.
//
// NUNCA DEVOLVE CREDENCIAL. Token da Meta, SID e auth da Twilio ficam no worker. O que sai daqui é
// estado: aprovado/reprovado, expirado/válido, e o MOTIVO — que é o que transforma "falhou" em
// "conserte isto".

import { json, safeEq } from "../lib/guard.js";
import { svcJson, svcRpc } from "../lib/sb.js";

// Leitura que distingue "provedor disse não" de "não consegui perguntar". `lido:false` jamais
// vira verde — é o mesmo engano que já fez o painel jurar que tudo estava bem com a linha morta.
async function ler(url, headers) {
  try {
    const r = await fetch(url, { headers });
    const txt = await r.text().catch(() => "");
    let d = null;
    try { d = txt ? JSON.parse(txt) : null; } catch { /* provedor devolveu não-JSON */ }
    return { lido: r.ok, status: r.status, d, erro: r.ok ? null : (d?.error?.message || txt || "").slice(0, 180) };
  } catch (e) { return { lido: false, status: 0, d: null, erro: String(e).slice(0, 140) }; }
}

// ── SMS: A2P 10DLC ────────────────────────────────────────────────────────────────────────────
// MARCA APROVADA NÃO É SMS LIBERADO. Falta a CAMPANHA verificada E o número dentro do Messaging
// Service. Parar na marca é o erro clássico de A2P — e foi o que já deu "pronto" com a campanha
// reprovada.
async function provarSms(env) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    return { estado: "cinza", motivo: "sem credenciais Twilio neste ambiente — isto NÃO é um ok" };
  }
  const auth = "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const marca = await ler("https://messaging.twilio.com/v1/a2p/BrandRegistrations", { Authorization: auth });
  if (!marca.lido) return { estado: "cinza", motivo: `não deu para ler a marca A2P: ${marca.erro}` };

  const brands = (marca.d?.data || marca.d?.brand_registrations || []);
  const svcs = await ler("https://messaging.twilio.com/v1/Services", { Authorization: auth });
  if (!svcs.lido) return { estado: "cinza", motivo: `não deu para ler os Messaging Services: ${svcs.erro}` };

  const servicos = [];
  for (const sv of (svcs.d?.services || []).slice(0, 5)) {
    const nums = await ler(`https://messaging.twilio.com/v1/Services/${sv.sid}/PhoneNumbers`, { Authorization: auth });
    const camp = await ler(`https://messaging.twilio.com/v1/Services/${sv.sid}/Compliance/Usa2p`, { Authorization: auth });
    const itens = camp.d?.compliance || camp.d?.us_app_to_person || [];
    const lista = Array.isArray(itens) ? itens : [];
    servicos.push({
      nome: sv.friendly_name,
      numeros_dentro: (nums.d?.phone_numbers || []).length,
      campanha: lista.map((c) => c.campaign_status),
      // O MOTIVO é o que evita reenviar a MESMA campanha e ela falhar de novo.
      motivo_falha: lista.flatMap((c) => c.errors || c.rejection_reason || []).slice(0, 3),
    });
  }

  const marcaOk = brands.some((x) => String(x.status).toUpperCase() === "APPROVED");
  const campanhaOk = servicos.some((s) =>
    (s.campanha || []).some((c) => String(c).toUpperCase() === "VERIFIED") && s.numeros_dentro > 0);

  return {
    estado: marcaOk && campanhaOk ? "verde" : "vermelho",
    marca: brands.map((x) => ({ status: x.status, falha: x.failure_reason || null })),
    servicos,
    // A dica segue o DADO — texto fixo mandaria "termine o registro" com a marca já aprovada.
    falta: marcaOk && campanhaOk ? null
      : !marcaOk ? "a MARCA A2P ainda não está aprovada na Twilio"
      : "a marca está aprovada, mas falta CAMPANHA verificada com o número dentro do Messaging Service",
  };
}

// ── WhatsApp Cloud ────────────────────────────────────────────────────────────────────────────
// Prova de verdade: pergunta ao Graph com a credencial guardada. Token expirado responde 190, e é
// exatamente esse número que estava escondido atrás de "não chegou".
async function provarWhats(env) {
  if (!env.INGEST_SECRET) return { estado: "cinza", motivo: "sem INGEST_SECRET — não dá para listar as linhas" };
  const linhas = await svcJson(env, "whatsapp_cloud_saude", { p_secret: env.INGEST_SECRET }).catch(() => null);
  // Lista ausente NÃO é "nenhuma linha". Sem esta distinção um 401 do banco viraria "tudo certo".
  if (!Array.isArray(linhas)) return { estado: "cinza", motivo: "não deu para ler as linhas de WhatsApp" };
  if (!linhas.length) return { estado: "cinza", motivo: "nenhuma linha de WhatsApp conectada ainda" };

  const out = [];
  for (const l of linhas) {
    const pnid = l.phone_number_id;
    let saida = { estado: "cinza", motivo: "sem phone_number_id guardado" };
    if (pnid) {
      // O token sai do banco direto para o Graph, dentro do worker. Nunca entra na resposta.
      const r = await svcRpc(env, "whatsapp_cloud_tenant_by_pnid", { p_secret: env.INGEST_SECRET, p_phone_number_id: String(pnid) });
      const t = r.ok ? await r.json().catch(() => null) : null;
      const tk = t?.tokens?.access_token;
      if (!tk) saida = { estado: "cinza", motivo: "credencial não encontrada para esta linha" };
      else {
        const g = await ler(`https://graph.facebook.com/v21.0/${encodeURIComponent(pnid)}?fields=display_phone_number,verified_name`, { Authorization: `Bearer ${tk}` });
        saida = g.lido
          ? { estado: "verde", nome_verificado: g.d?.verified_name || null }
          : { estado: "vermelho", codigo: g.d?.error?.code ?? g.status, motivo: g.erro };
      }
    }
    out.push({
      cliente: l.client_email,
      rotulo: l.label || null,
      numero: l.display_number || null,
      // `temp_24h` é uma bomba-relógio: funciona no dia em que se cola e morre no seguinte.
      tipo_de_token: l.token_kind || null,
      ambiente: l.env || null,
      envio: saida,
    });
  }

  const algumVerde = out.some((x) => x.envio.estado === "verde");
  const algumVermelho = out.some((x) => x.envio.estado === "vermelho");
  return {
    estado: algumVermelho ? "vermelho" : algumVerde ? "verde" : "cinza",
    linhas: out,
    // A entrada funcionar e a saída falhar é o pior caso: o cliente escreve, a Gui responde, e
    // ninguém recebe. Por isso o veredito segue a SAÍDA, não o webhook.
    falta: algumVermelho
      ? "a resposta não sai. Token temporário (temp_24h) expira em 1 dia — precisa de token permanente de System User"
      : algumVerde ? null : "nenhuma linha provada",
  };
}

async function provar(request, env) {
  const url = new URL(request.url);
  const tok = url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  let autorizado = !!env.DIGEST_TOKEN && safeEq(tok, env.DIGEST_TOKEN);
  if (!autorizado && tok) {
    const a = await svcJson(env, "_admin_ok", { p_token: tok }).catch(() => null);
    autorizado = a === true || a?.ok === true;   // o CORPO, não o status
  }
  if (!autorizado) return json({ error: "unauthorized", dica: "use o token do cron OU a senha do /admin" }, 401);

  const [sms, whats] = await Promise.all([provarSms(env), provarWhats(env)]);
  return json({
    ok: sms.estado === "verde" && whats.estado === "verde",
    sms,
    whatsapp: whats,
    // Resumo em cor para quem lê no celular sem comparar campo por campo.
    resumo: { sms: sms.estado, whatsapp: whats.estado },
  });
}

export const onRequestGet = (c) => provar(c.request, c.env);
export const onRequestPost = (c) => provar(c.request, c.env);
