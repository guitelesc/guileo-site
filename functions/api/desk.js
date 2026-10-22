// POST /api/desk — GUILEO DESK, o substituto do MindBody. 2026-10-04 (agenda) · 2026-10-05 (tudo).
//
// PORTA: e-mail + chave de conexão, a mesma da Central. Toda ação começa provando a chave
// (desk_agenda num intervalo de 1 minuto); chave errada → 401 antes de qualquer escrita. As funções
// desk_* (db/desk_v1.sql, db/desk_v2.sql) conferem a chave DE NOVO no banco.
// MARCAR, CANCELAR e FALTA usam o motor da Lilian (biz_book / biz_cancel / biz_mark_noshow), para
// que balcão e IA sigam a MESMA regra de horário.
//
// AÇÕES
//   agenda{from,to} · availability{service_id,location_id?,pro_id?,days?} · book{pro_id,location_id,service_id,name,contact,start,note?}
//   book_group{location_id, items[{pro_id,service_id,start,name,contact?,note?}] 2–6} — casal/grupo, tudo ou nada · export{what,offset?}
//   staff_save{pro{…, service_rules?[{service_id, duration_min?, prep_min?, finish_min?, pay_type?('pct'|'flat'|'none'), pay_amount?}]}} — desk_v10
//   book{…, addons?[ids]} · book_group items[{…, addons?[ids]}] · addons_set{id, addons[ids]} · service_save{service{…, addon?}} — desk_v11
//   noshow_undo{id} · regras_get · regras_set{auto_noshow_min} — desk_v12 (agenda devolve status 'late_cancelled' e noshow_auto/noshow_auto_at)
//   move{id,start,pro_id?} · status{id,status} · note{id,note} · block{pro_id,location_id,start,end,reason}
//   catalog · checkout{sale,lang?} · void{id,reason} · sale{id} · receipt{id,to,lang?}
//   client_search{q} · client_card{contact} · client_save{contact,data}
//   staff_save{pro} · hours_set{pro_id,location_id,hours} · service_save{service} · product_save{product}
//   day_close{from,to,location_id?} · import_clients{rows} · import_appointments{rows,dry_run}
//   deposit_link{id}   → link do Stripe DO NEGÓCIO para o sinal (valor do cadastro do serviço)
//   package_edit{id, expires_at|null} → só a dona: estende/encurta a validade de UMA compra de pacote (desk_v13)
//   PACOTES (desk_v13): pagamento `package` aceita service_id → debita config.pkg_sessions daquele serviço (padrão 1);
//   motivos package_expired (detail = data) e package_short (detail = restam/precisa). Ativação na compra ou na 1ª visita.
//   quem → {papel:"dono"|"recepcao"|"profissional", nome, pro_id} · acessos_list · acessos_criar{nome, papel?, pro_id?} → {codigo} (uma vez) · acessos_revogar{id}
// ACESSO DA RECEPÇÃO (2026-10-05): key = "bal_…" (código da recepcionista) só faz o que lib/deskAcesso.js deixa.
// SALAS E EQUIPAMENTOS (desk_v5_1, db/desk_v5_salas.sql): sem ação nova. Sala = staff_save{pro:{kind:'room',…}};
//   o serviço diz qual precisa em service_save{service:{recursos:[ids]}}. O motor reserva a sala no book/move/remarcar;
//   sem sala livre a resposta é {ok:false, reason:'resource_unavailable'} (passa direto, como slot_taken).
//   A agenda traz resource/resource_id em cada agendamento com sala e recursos em cada serviço que exige.
import { json } from "../lib/guard.js";
import { SB_URL } from "../lib/sb.js";
import { deskReceiptEmail } from "../lib/emailTemplates.js";
import { criarLinkDoSinal, mandarLinkDoSinal } from "../lib/sinal.js";
import { sendApptEmail, emailDoCliente } from "./agent-schedule.js";
import { proAbsenceEmail } from "../lib/emailTemplates.js";
import { reservaUrl } from "../lib/visita.js";
import { brandFor } from "../lib/clientBrand.js";
import { svcJson } from "../lib/sb.js";
import { oferecerVaga } from "../lib/filaDeEspera.js";
import { podeNoDesk } from "../lib/deskTrava.js";
import { ehCodigoDoBalcao, abrirComCodigo, novoCodigo, hashCodigo, filtrarAgendaDela, STATUS_DA_PROFISSIONAL } from "../lib/deskAcesso.js";

const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = (s) => typeof s === "string" && !Number.isNaN(Date.parse(s));
// Início de agendamento cai em minuto cheio — "11:00:27" viraria um cartão fora da grade e um choque fantasma.
const MINUTO = (s) => ISO(s) && Date.parse(s) % 60000 === 0;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BR_TZ = /Sao_Paulo|Cuiaba|Fortaleza|Recife|Bahia|Manaus|Belem|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Araguaina|Maceio|Noronha/;

// Chama uma RPC e devolve { ok, status, data } — nunca confunde "HTTP 200" com "deu certo".
async function rpc(fn, body) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const texto = await r.text();
    let data = null; try { data = texto ? JSON.parse(texto) : null; } catch { data = null; }
    return { ok: r.ok, status: r.status, data, texto: texto.slice(0, 200) };
  } catch (e) { return { ok: false, status: 0, data: null, texto: String(e).slice(0, 120) }; }
}
// O banco recusa a chave com SQLSTATE 28000, que o PostgREST entrega como 401/403 (às vezes 400).
const recusada = (r) => [400, 401, 403].includes(r.status) && /unauthorized|28000/.test(r.texto || "");
// Resposta padrão de uma função desk_*: o JSON dela, ou 503 com o motivo.
const devolve = (r, erro) => (r.ok ? json(r.data ?? { ok: false }) : json({ ok: false, erro, detalhe: r.texto }, 503));

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch { return json({ ok: false, erro: "corpo inválido" }, 400); }
  const email = String(b.email || "").trim().toLowerCase();
  let key = String(b.key || b.dataKey || "").trim();
  const action = String(b.action || "agenda");
  if (!email.includes("@") || !key) return json({ ok: false, erro: "unauthorized" }, 401);

  // ── ACESSO DA RECEPÇÃO (2026-10-05, lib/deskAcesso.js) ─────────────────────────────────────
  // Código "bal_…" → confere no banco + confere a ação na lista do papel → só então a chave da dona,
  // AQUI no servidor. Ação fora da lista volta 403 role_forbidden antes de qualquer leitura.
  let acesso = null;
  if (ehCodigoDoBalcao(key)) {
    const acaoPedida = action === "book" && b.repeat ? "book_repeat" : action;
    const p = await abrirComCodigo(env, svcJson, { email, codigo: key, acao: acaoPedida });
    if (!p.ok) return json(p.corpo, p.http);
    key = p.chave; acesso = p.acesso;
    // PROFISSIONAL: nota / chegou / terminou só no agendamento DELA (o banco diz de quem é) e só esses status.
    if (acesso.papel === "profissional" && (action === "note" || action === "status")) {
      if (action === "status" && !STATUS_DA_PROFISSIONAL.has(String(b.status || ""))) return json({ ok: false, reason: "role_forbidden", papel: acesso.papel }, 403);
      const dono = await svcJson(env, "desk_appt_pro_svc", { p_email: email, p_id: UUID.test(String(b.id || "")) ? b.id : null });
      if (dono !== acesso.pro_id) return json({ ok: false, reason: "role_forbidden", papel: acesso.papel }, 403);
    }
  }

  // ── PORTA ──────────────────────────────────────────────────────────────────────────────────
  const agora = new Date();
  const porta = await rpc("desk_agenda", { p_email: email, p_key: key, p_from: agora.toISOString(), p_to: new Date(agora.getTime() + 60000).toISOString() });
  if (!porta.ok) return recusada(porta) ? json({ ok: false, erro: "unauthorized" }, 401) : json({ ok: false, erro: "Desk indisponível", detalhe: porta.texto }, 503);

  // ── TRAVA POR PLANO (2026-10-05, lib/deskTrava.js). Legado (sem assinatura do Desk) passa direto.
  // `plan` sempre volta, para a tela saber o que mostrar; a recusa diz QUAL plano libera a ação.
  if (action === "plano") return devolve(await rpc("desk_plano", { p_email: email, p_key: key }), "não consegui ler o plano");
  // Quem está no balcão: a dona (chave dela) ou uma recepcionista (código próprio). A tela esconde o resto.
  if (action === "quem") {
    // Nome e logo DO NEGÓCIO para o cabeçalho do /balcao (brandFor; teto de 2,5 s — sem marca, a tela usa só a Guileo).
    const marca = await Promise.race([brandFor(env, email).catch(() => null), new Promise((r) => setTimeout(() => r(null), 2500))]);
    return json({ ok: true, papel: acesso ? acesso.papel : "dono", nome: acesso ? acesso.nome : null, pro_id: acesso ? acesso.pro_id : null,
      negocio: marca && marca.business && marca.business !== "Guileo" ? marca.business : null, logo: (marca && marca.logo_url) || null,
      assistente: (marca && marca.agent_name) || null });
  }
  const plano = await svcJson(env, "desk_plano_svc", { p_email: email }).then((r) => (typeof r === "string" ? r : null)).catch(() => null);
  const acaoDaTrava = action === "book" && b.repeat ? "book_repeat" : action;
  const trava = podeNoDesk(plano, acaoDaTrava);
  if (!trava.ok) return json({ ok: false, erro: "plano", reason: "plan_required", precisa: trava.precisa, plano }, 402);

  const sched = env.SCHED_SECRET || "";
  const K = { p_email: email, p_key: key };
  const id = String(b.id || "");

  switch (action) {
    // ── AGENDA ─────────────────────────────────────────────────────────────────────────────
    case "agenda": {
      if (!ISO(b.from) || !ISO(b.to)) return json({ ok: false, erro: "intervalo inválido" }, 400);
      // FALTA AUTOMÁTICA (desk_v12): a leitura da agenda é a varredura viva (balcão aberto); o cron-tick é o pano de fundo.
      // Falhar aqui nunca segura a agenda.
      if (sched) await rpc("desk_auto_noshow_sweep", { p_secret: sched, p_email: email }).catch(() => null);
      const [r, g, pr, ad, fl] = await Promise.all([rpc("desk_agenda", { ...K, p_from: b.from, p_to: b.to }), rpc("desk_grupos", { ...K, p_from: b.from, p_to: b.to }), rpc("desk_pro_rules", K), rpc("desk_addons", { ...K, p_from: b.from, p_to: b.to }), rpc("desk_flags", { ...K, p_from: b.from, p_to: b.to })]);
      if (!r.ok || !r.data?.ok) return json({ ok: false, erro: "não consegui ler a agenda", detalhe: r.texto }, 503);
      // CANCELOU EM CIMA DA HORA vira estado próprio; falta automática ganha noshow_auto/noshow_auto_at (desk_v12).
      if (fl.ok && Array.isArray(fl.data) && fl.data.length) {
        const flags = new Map(fl.data.map((x) => [x.id, x]));
        r.data.appointments = (r.data.appointments || []).map((a) => { const f = flags.get(a.id); if (!f) return a;
          return { ...a, ...(a.status === "cancelled" && f.late_cancelled ? { status: "late_cancelled" } : {}), ...(f.noshow_auto ? { noshow_auto: true, noshow_auto_at: f.noshow_auto_at } : {}) }; });
      }
      // ADICIONAIS (desk_v11): serviço marcado como adicional ganha `addon:true`; agendamento com adicionais ganha `addons[]`.
      if (ad.ok && ad.data?.ok) {
        const ids = new Set(ad.data.addon_ids || []); const porAppt = new Map((ad.data.appointments || []).map((x) => [x.id, x.addons]));
        r.data.services = (r.data.services || []).map((s) => (ids.has(s.id) ? { ...s, addon: true } : s));
        r.data.appointments = (r.data.appointments || []).map((a) => (porAppt.has(a.id) ? { ...a, addons: porAppt.get(a.id) } : a));
      }
      // PROFISSIONAL × SERVIÇO (desk_v10): `pro_rules` = duração/preparo/limpeza/pagamento próprios. A tela desenha a
      // faixa de preparo/limpeza no cartão e a Equipe edita. Se só esta leitura falhar, a agenda sai sem as regras.
      r.data.pro_rules = pr.ok && Array.isArray(pr.data) ? pr.data : [];
      // CASAL / GRUPO (desk_v9): cada agendamento do grupo ganha { grupo, grupo_n, grupo_total, grupo_rotulo }.
      // Se só esta leitura falhar, a agenda sai igual (sem o selo 👥) — nunca some agendamento por causa dela.
      if (g.ok && Array.isArray(g.data) && g.data.length) {
        const mapa = new Map(g.data.map((x) => [x.id, x]));
        r.data.appointments = (r.data.appointments || []).map((a) => { const x = mapa.get(a.id); return x ? { ...a, grupo: x.grupo, grupo_n: x.n, grupo_total: x.total, grupo_rotulo: x.rotulo } : a; });
      }
      return json(acesso && acesso.papel === "profissional" ? filtrarAgendaDela(r.data, acesso.pro_id) : r.data);
    }
    case "move": {
      if (!UUID.test(id) || !MINUTO(b.start)) return json({ ok: false, erro: "dados inválidos" }, 400);
      if (b.pro_id && !UUID.test(String(b.pro_id))) return json({ ok: false, erro: "profissional inválida" }, 400);
      return devolve(await rpc("desk_move", { ...K, p_id: id, p_start: b.start, p_pro_id: b.pro_id || null }), "não consegui mover");
    }
    case "note": {
      if (!UUID.test(id)) return json({ ok: false, erro: "dados inválidos" }, 400);
      return devolve(await rpc("desk_note", { ...K, p_id: id, p_note: String(b.note || "").slice(0, 1000) }), "não consegui salvar a nota");
    }
    case "status": {
      const st = String(b.status || "");
      if (!UUID.test(id)) return json({ ok: false, erro: "dados inválidos" }, 400);
      // Cancelar e falta passam pelo motor: é ele que libera o horário e conta a falta.
      if ((st === "cancelled" || st === "no_show") && sched) {
        const fn = st === "cancelled" ? "biz_cancel" : "biz_mark_noshow";
        const r = await rpc(fn, { p_secret: sched, p_email: email, p_appointment_id: id });
        if (r.data?.error === "unauthorized") return json({ ok: false, erro: "motor de agenda recusou a chave do servidor" }, 503);
        const ok = r.ok && (r.data === true || r.data?.ok === true);
        if (ok) {
          await rpc("desk_set_status", { ...K, p_id: id, p_status: st });
          // Cancelou no balcão = vaga livre → a próxima da fila recebe a oferta (com comprovante; se não
          // chegar, o dono vê "ligue pra oferecer" no feed). Falta não abre vaga: o horário já passou.
          let fila = null;
          if (st === "cancelled") fila = await oferecerVaga(env, { tenant: email, appointmentId: id, lang: b.lang || "en" }, { motor: async (f, body) => (await rpc(f, { p_secret: sched, ...body })).data });
          return json({ ok: true, id, status: st, ...(fila ? { fila: fila.offered ? { oferecida: true, via: fila.via, para: fila.to } : { oferecida: false, motivo: fila.reason } } : {}) });
        }
      }
      return devolve(await rpc("desk_set_status", { ...K, p_id: id, p_status: st }), "não consegui mudar o estado");
    }
    case "availability": {
      if (!sched) return json({ ok: false, erro: "motor de agenda sem chave do servidor" }, 503);
      if (!UUID.test(String(b.service_id || ""))) return json({ ok: false, erro: "serviço inválido" }, 400);
      const r = await rpc("biz_availability", {
        p_secret: sched, p_email: email, p_service_id: b.service_id,
        p_location_id: UUID.test(String(b.location_id || "")) ? b.location_id : null,
        p_pro_id: UUID.test(String(b.pro_id || "")) ? b.pro_id : null,
        p_days: Math.min(Math.max(parseInt(b.days, 10) || 7, 1), 30), p_limit: 40,
      });
      if (!r.ok || r.data?.error) return json({ ok: false, erro: "não consegui ler os horários livres", detalhe: r.texto }, 503);
      return json({ ok: true, ...(r.data || {}) });
    }
    case "book": {
      if (!sched) return json({ ok: false, erro: "motor de agenda sem chave do servidor" }, 503);
      const nome = String(b.name || "").trim().slice(0, 120);
      const contato = String(b.contact || "").trim().slice(0, 120);
      if (!UUID.test(String(b.pro_id || "")) || !UUID.test(String(b.location_id || "")) || !UUID.test(String(b.service_id || "")) || !MINUTO(b.start)) {
        return json({ ok: false, erro: "dados inválidos" }, 400);
      }
      if (!nome) return json({ ok: false, erro: "falta o nome da cliente" }, 400);
      const pedido = String(b.request_id || "").slice(0, 80) || `desk:${crypto.randomUUID()}`;
      // RECORRENTE (2026-10-05): "toda terça às 10h". repeat = { every_weeks 1–8, count 2–26 }.
      // Cada data passa pelo motor (choque, dia fechado); as que não cabem voltam em `falhas` com o
      // motivo — nunca somem caladas. Mesmo request_id + índice: repetir o pedido não duplica.
      const rep = b.repeat && typeof b.repeat === "object" ? b.repeat : null;
      if (rep) {
        const cada = Math.min(Math.max(parseInt(rep.every_weeks, 10) || 1, 1), 8);
        const vezes = Math.min(Math.max(parseInt(rep.count, 10) || 2, 2), 26);
        const serie = `serie:${crypto.randomUUID()}`;
        const marcados = [], falhas = [];
        for (let i = 0; i < vezes; i++) {
          const ini = new Date(Date.parse(b.start) + i * cada * 7 * 86400000).toISOString();
          const rr = await rpc("biz_book", {
            p_secret: sched, p_email: email, p_pro_id: b.pro_id, p_location_id: b.location_id, p_service_id: b.service_id,
            p_name: nome, p_contact: contato, p_start: ini,
            p_attributes: { source: "desk", serie, serie_n: i + 1, serie_total: vezes, ...(b.note ? { desk_note: String(b.note).slice(0, 1000) } : {}) },
            p_hold_min: null, p_request_id: `${pedido}:${i}`,
          });
          if (rr.ok && rr.data?.ok && rr.data.appointment_id) marcados.push({ start: ini, appointment_id: rr.data.appointment_id, ref: rr.data.ref });
          else falhas.push({ start: ini, reason: rr.data?.reason || "failed" });
        }
        return json({ ok: marcados.length > 0, serie, marcados, falhas });
      }
      // ADICIONAIS (desk_v11): ids dos serviços-adicionais; o motor valida, soma os minutos e grava o retrato.
      const addons = Array.isArray(b.addons) ? b.addons.filter((x) => UUID.test(String(x))).slice(0, 10) : [];
      const r = await rpc("biz_book", {
        p_secret: sched, p_email: email, p_pro_id: b.pro_id, p_location_id: b.location_id, p_service_id: b.service_id,
        p_name: nome, p_contact: contato, p_start: b.start,
        p_attributes: { source: "desk", ...(b.note ? { desk_note: String(b.note).slice(0, 1000) } : {}), ...(addons.length ? { addons } : {}) },
        p_hold_min: null, p_request_id: pedido,
      });
      if (!r.ok) return json({ ok: false, erro: "não consegui marcar", detalhe: r.texto }, 503);
      if (r.data?.error === "unauthorized") return json({ ok: false, erro: "motor de agenda recusou a chave do servidor" }, 503);
      const reserva = r.data || { ok: false };
      // CONFIRMAÇÃO À CLIENTE (2026-10-05): o balcão marcava e a cliente não recebia NADA (o MindBody
      // manda). Mesmo envio da agente (sendApptEmail: marca do negócio + link "remarcar ou cancelar").
      // Só com e-mail (o contato ou o cadastro dela); sem e-mail não sai e a resposta diz isso.
      if (reserva.ok && reserva.appointment_id && !reserva.idempotent && b.confirm !== false) {
        reserva.confirmacao = await confirmarReserva(env, email, { id: reserva.appointment_id, ref: reserva.ref, contato, nome, clientEmail: b.client_email, lang: b.lang });
      }
      return json(reserva);
    }
    // CASAL / GRUPO (2026-10-21, db/desk_v9_grupo.sql): 2 a 6 pessoas num pedido, TUDO OU NADA no banco.
    // items[{ pro_id, service_id, start, name, contact?, note? }] — cada uma com serviço, profissional e hora
    // próprios (casal lado a lado = mesma hora). Falhou uma → nada fica marcado e volta { reason, index, name }.
    case "book_group": {
      if (!sched) return json({ ok: false, erro: "motor de agenda sem chave do servidor" }, 503);
      const itens = Array.isArray(b.items) ? b.items : [];
      if (itens.length < 2 || itens.length > 6) return json({ ok: false, reason: "group_size" }, 400);
      if (!UUID.test(String(b.location_id || ""))) return json({ ok: false, erro: "unidade inválida" }, 400);
      const limpos = [];
      for (let i = 0; i < itens.length; i++) {
        const x = itens[i] || {};
        const nome = String(x.name || "").trim().slice(0, 120);
        if (!UUID.test(String(x.pro_id || "")) || !UUID.test(String(x.service_id || "")) || !MINUTO(x.start)) return json({ ok: false, reason: "invalid_item", index: i + 1 }, 400);
        if (!nome) return json({ ok: false, reason: "name_required", index: i + 1 }, 400);
        const addons = Array.isArray(x.addons) ? x.addons.filter((y) => UUID.test(String(y))).slice(0, 10) : [];
        limpos.push({ pro_id: x.pro_id, service_id: x.service_id, start: x.start, name: nome, contact: String(x.contact || "").trim().slice(0, 120), ...(x.note ? { note: String(x.note).slice(0, 1000) } : {}), ...(addons.length ? { addons } : {}) });
      }
      const pedido = String(b.request_id || "").slice(0, 80) || `desk-grupo:${crypto.randomUUID()}`;
      const r = await rpc("biz_book_group", { p_secret: sched, p_email: email, p_location_id: b.location_id, p_items: limpos, p_attributes: { source: "desk" }, p_request_id: pedido });
      if (!r.ok) return json({ ok: false, erro: "não consegui marcar", detalhe: r.texto }, 503);
      if (r.data?.error === "unauthorized") return json({ ok: false, erro: "motor de agenda recusou a chave do servidor" }, 503);
      const grupo = r.data || { ok: false };
      // Uma confirmação por CONTATO (o casal que deixou o mesmo telefone recebe uma, não duas).
      if (grupo.ok && !grupo.idempotent && b.confirm !== false) {
        const vistos = new Set(); grupo.confirmacoes = [];
        for (const ap of grupo.appointments || []) {
          const it = limpos[ap.index - 1]; const chave = it.contact.toLowerCase().replace(/\D/g, "") || it.contact.toLowerCase();
          if (!it.contact || vistos.has(chave)) continue; vistos.add(chave);
          grupo.confirmacoes.push({ index: ap.index, ...(await confirmarReserva(env, email, { id: ap.appointment_id, ref: ap.ref, contato: it.contact, nome: it.name, lang: b.lang })) });
        }
      }
      return json(grupo);
    }
    // "CHEGOU AFINAL" (desk_v12): desfaz a falta (automática ou da recepção) e volta a ocupar o horário.
    case "noshow_undo": {
      if (!UUID.test(id)) return json({ ok: false, erro: "dados inválidos" }, 400);
      return devolve(await rpc("desk_noshow_undo", { ...K, p_id: id }), "não consegui desfazer a falta");
    }
    // REGRAS DO BALCÃO (desk_v12): hoje só a falta automática (minutos depois do horário; 0 = desligado). Só a dona.
    case "regras_get": return devolve(await rpc("desk_regras_get", K), "não consegui ler as regras");
    case "regras_set": {
      const m = parseInt(b.auto_noshow_min, 10);
      if (!Number.isInteger(m) || m < 0 || m > 240) return json({ ok: false, reason: "invalid_minutes" }, 400);
      return devolve(await rpc("desk_regras_set", { ...K, p: { auto_noshow_min: m } }), "não consegui salvar as regras");
    }
    // VALIDADE DE UMA COMPRA DE PACOTE (desk_v13): null/"" = sem vencimento; data ISO = novo vencimento.
    case "package_edit": {
      if (!UUID.test(id)) return json({ ok: false, erro: "dados inválidos" }, 400);
      const vazio = b.expires_at == null || b.expires_at === "";
      if (!vazio && !ISO(b.expires_at)) return json({ ok: false, reason: "invalid_date" }, 400);
      return devolve(await rpc("desk_package_edit", { ...K, p_id: id, p_patch: { expires_at: vazio ? null : new Date(b.expires_at).toISOString() } }), "não consegui mudar a validade");
    }
    // ADICIONAIS de um agendamento aberto (desk_v11): troca a lista e refaz o fim do horário; o gatilho julga o choque.
    case "addons_set": {
      if (!UUID.test(id) || !Array.isArray(b.addons)) return json({ ok: false, erro: "dados inválidos" }, 400);
      return devolve(await rpc("desk_addons_set", { ...K, p_id: id, p_addons: b.addons.filter((x) => UUID.test(String(x))).slice(0, 10) }), "não consegui mudar os adicionais");
    }
    case "block": {
      if (!UUID.test(String(b.pro_id || "")) || !ISO(b.start) || !ISO(b.end)) return json({ ok: false, erro: "dados inválidos" }, 400);
      return devolve(await rpc("desk_block", { ...K, p_pro_id: b.pro_id, p_location_id: UUID.test(String(b.location_id || "")) ? b.location_id : null, p_start: b.start, p_end: b.end, p_reason: String(b.reason || "").slice(0, 120) }), "não consegui bloquear");
    }

    // ── CAIXA ──────────────────────────────────────────────────────────────────────────────
    case "catalog": return devolve(await rpc("desk_catalog", K), "não consegui ler o catálogo");
    case "checkout": {
      const sale = b.sale && typeof b.sale === "object" ? b.sale : null;
      if (!sale || !Array.isArray(sale.lines) || !sale.lines.length) return json({ ok: false, erro: "venda vazia" }, 400);
      if (sale.lines.length > 60 || (sale.payments || []).length > 10) return json({ ok: false, erro: "venda grande demais" }, 400);
      const r = await rpc("desk_checkout", { ...K, p_sale: sale });
      if (!r.ok) return json({ ok: false, erro: "não consegui fechar a venda", detalhe: r.texto }, 503);
      const venda = r.data || { ok: false };
      // Recibo: só depois que a venda GRAVOU, e o envio é conferido (id da Resend).
      if (venda.ok && venda.sale_id && !venda.idempotent && EMAIL.test(String(sale.receipt_to || ""))) {
        venda.recibo = await enviarRecibo(env, K, venda.sale_id, String(sale.receipt_to), b.lang);
      }
      return json(venda);
    }
    // CUPOM NO CAIXA (desk_v14): a prévia do desconto. A venda refaz a conta com a mesma régua (_desk_cupom_valor).
    case "coupon_check": {
      const code = String(b.code || "").trim().slice(0, 60);
      const base = Number(b.subtotal_cents);
      if (!code || !Number.isFinite(base) || base < 0) return json({ ok: false, erro: "dados inválidos" }, 400);
      return devolve(await rpc("desk_coupon_check", { ...K, p_code: code, p_base_cents: Math.round(base) }), "não consegui conferir o cupom");
    }
    case "void": {
      if (!UUID.test(id)) return json({ ok: false, erro: "dados inválidos" }, 400);
      return devolve(await rpc("desk_void_sale", { ...K, p_id: id, p_reason: String(b.reason || "").slice(0, 300) }), "não consegui estornar");
    }
    case "sale": {
      if (!UUID.test(id)) return json({ ok: false, erro: "dados inválidos" }, 400);
      return devolve(await rpc("desk_sale_get", { ...K, p_id: id }), "não consegui ler a venda");
    }
    case "receipt": {
      if (!UUID.test(id) || !EMAIL.test(String(b.to || ""))) return json({ ok: false, erro: "dados inválidos" }, 400);
      return json(await enviarRecibo(env, K, id, String(b.to), b.lang));
    }

    // ── FICHA DA CLIENTE ───────────────────────────────────────────────────────────────────
    case "client_search": return devolve(await rpc("desk_client_search", { ...K, p_q: String(b.q || "").slice(0, 80) }), "não consegui procurar");
    case "client_card": return devolve(await rpc("desk_client_card", { ...K, p_contact: String(b.contact || "").slice(0, 160) }), "não consegui ler a ficha");
    case "client_save": {
      if (!b.data || typeof b.data !== "object") return json({ ok: false, erro: "dados inválidos" }, 400);
      return devolve(await rpc("desk_client_save", { ...K, p_contact: String(b.contact || "").slice(0, 160), p_data: b.data }), "não consegui salvar a ficha");
    }

    // ── JUNTAR FICHAS DUPLICADAS (desk_v15): só a dona — recepção e profissional ficam fora pela lista do papel ──
    // Juntar é um registro (apelido) e não move dado: venda, pacote e vale seguem no contato original.
    case "merge_suggest": return devolve(await rpc("desk_merge_suggest", K), "não consegui procurar duplicados");
    case "merge_preview":
    case "merge": {
      const keep = String(b.keep || "").trim().slice(0, 160), drop = String(b.drop || "").trim().slice(0, 160);
      if (!keep || !drop) return json({ ok: false, reason: "invalid_contact" }, 400);
      return devolve(await rpc(action === "merge" ? "desk_merge" : "desk_merge_preview", { ...K, p_keep: keep, p_drop: drop }), "não consegui juntar as fichas");
    }
    case "merge_undo": {
      if (!UUID.test(id)) return json({ ok: false, erro: "dados inválidos" }, 400);
      return devolve(await rpc("desk_merge_undo", { ...K, p_id: id }), "não consegui desfazer");
    }
    case "merge_dismiss": {
      const keys = Array.isArray(b.keys) ? b.keys.map((x) => String(x || "").slice(0, 160)).filter(Boolean).slice(0, 10) : [];
      if (keys.length < 2) return json({ ok: false, reason: "invalid_contact" }, 400);
      return devolve(await rpc("desk_merge_dismiss", { ...K, p_keys: keys }), "não consegui guardar");
    }

    // ── CONSENTIMENTO REGISTRADO (CR-11, 2026-10-13, db/consentimento.sql): o que a cliente DISSE, com prova. ──
    case "consent_get": return devolve(await rpc("desk_consent_get", { ...K, p_contact: String(b.contact || "").slice(0, 160) }), "não consegui ler o consentimento");
    case "consent_set": {
      const canal = ["sms", "call", "whatsapp", "email"].includes(b.channel) ? b.channel : null;
      if (!canal || typeof b.granted !== "boolean") return json({ ok: false, erro: "canal ou valor inválido" }, 400);
      return devolve(await rpc("desk_consent_set", { ...K, p_contact: String(b.contact || "").slice(0, 160), p_channel: canal, p_granted: b.granted, p_evidence: String(b.evidence || "").slice(0, 300) }), "não consegui registrar o consentimento");
    }

    // ── EQUIPE, SERVIÇOS, PRODUTOS ─────────────────────────────────────────────────────────
    case "staff_save": return devolve(await rpc("desk_staff_save", { ...K, p_pro: b.pro || {} }), "não consegui salvar a profissional");
    case "hours_set": {
      if (!UUID.test(String(b.pro_id || "")) || !UUID.test(String(b.location_id || "")) || !Array.isArray(b.hours)) return json({ ok: false, erro: "dados inválidos" }, 400);
      return devolve(await rpc("desk_hours_set", { ...K, p_pro_id: b.pro_id, p_location_id: b.location_id, p_hours: b.hours.slice(0, 50) }), "não consegui salvar o horário");
    }
    case "inactive": return devolve(await rpc("desk_inactive", K), "não consegui ler os desativados");
    case "take_over_reminders": return devolve(await rpc("desk_take_over_reminders", K), "não consegui passar os lembretes");
    case "service_save": return devolve(await rpc("desk_service_save", { ...K, p_svc: b.service || {} }), "não consegui salvar o serviço");
    case "product_save": return devolve(await rpc("desk_product_save", { ...K, p_prod: b.product || {} }), "não consegui salvar o produto");

    // ── FECHAMENTO E IMPORTAÇÃO ────────────────────────────────────────────────────────────
    case "day_close": {
      if (!ISO(b.from) || !ISO(b.to)) return json({ ok: false, erro: "intervalo inválido" }, 400);
      return devolve(await rpc("desk_day_close", { ...K, p_from: b.from, p_to: b.to, p_location_id: UUID.test(String(b.location_id || "")) ? b.location_id : null }), "não consegui fechar o dia");
    }
    case "reports": {
      if (!ISO(b.from) || !ISO(b.to)) return json({ ok: false, erro: "intervalo inválido" }, 400);
      const args = { ...K, p_from: b.from, p_to: b.to, p_location_id: UUID.test(String(b.location_id || "")) ? b.location_id : null };
      // desk_reports_extra (slide 25): horários mais cheios, tratamento que subiu/caiu, quem vende mais, canal × unidade.
      // Se só o extra falhar, o principal ainda sai — e a tela diz que essa parte não carregou (extra_ok:false).
      // + desk_reports_unidades (2026-10-05): as unidades lado a lado, sempre do período inteiro (sem filtro de unidade).
      // + desk_opinioes (slide 25): o que as clientes escreveram, por profissional.
      const [r, x, u, o] = await Promise.all([rpc("desk_reports", args), rpc("desk_reports_extra", args), rpc("desk_reports_unidades", { ...K, p_from: b.from, p_to: b.to }), rpc("desk_opinioes", { ...K, p_from: b.from, p_to: b.to })]);
      if (r.ok && r.data?.ok) return json({ ...r.data, ...(x.ok && x.data?.ok ? { ...x.data, extra_ok: true } : { extra_ok: false }),
        unidades: u.ok && u.data?.ok ? u.data.unidades : [], opinioes: o.ok && o.data?.ok ? o.data.por_profissional : null, ok: true });
      return devolve(r, "não consegui ler os relatórios");
    }
    // Slide 19: quantas clientes da unidade DE nunca foram à PARA (o rascunho da campanha usa o mesmo público).
    case "publico_cruzado": {
      if (!UUID.test(String(b.de || "")) || !UUID.test(String(b.para || ""))) return json({ ok: false, erro: "unidades inválidas" }, 400);
      return devolve(await rpc("desk_publico_cruzado_conta", { ...K, p_de: b.de, p_para: b.para }), "não consegui contar as clientes");
    }
    case "import_clients": {
      if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 5000) return json({ ok: false, erro: "planilha vazia ou grande demais (máx. 5000 linhas por vez)" }, 400);
      return devolve(await rpc("desk_import_clients", { ...K, p_rows: b.rows }), "não consegui importar as clientes");
    }
    case "import_appointments": {
      if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 5000) return json({ ok: false, erro: "planilha vazia ou grande demais (máx. 5000 linhas por vez)" }, 400);
      return devolve(await rpc("desk_import_appointments", { ...K, p_rows: b.rows, p_dry_run: b.dry_run !== false }), "não consegui importar a agenda");
    }
    // EXPORTAR TUDO (2026-10-21, db/desk_v8_exportar.sql): a base é da dona, de graça, a qualquer hora —
    // até com a assinatura cancelada (deskTrava deixa passar). Só a dona: não está na lista da recepção.
    // Página de até 5000 linhas; a tela repete com offset até chegar no `total`.
    case "export": {
      const what = ["clients", "appointments", "sales", "balances"].includes(b.what) ? b.what : null;
      if (!what) return json({ ok: false, reason: "invalid_export" }, 400);
      return devolve(await rpc("desk_export", { ...K, p_what: what, p_offset: Math.max(parseInt(b.offset, 10) || 0, 0), p_limit: 5000 }), "não consegui exportar");
    }

    // ── SINAL (depósito) ───────────────────────────────────────────────────────────────────
    // Link do Stripe DO NEGÓCIO. Valor sai do cadastro do serviço, nunca do navegador. Sem conta
    // Stripe ligada, a resposta diz isso — não existe "link fingido".
    // ── FALTA DA PROFISSIONAL (slide 24) ───────────────────────────────────────────────────
    // absence_plan: as clientes dela no intervalo e quem cobre cada horário. A recepção decide por cliente:
    // passar para outra profissional (action "move" com pro_id, mesmo horário) e/ou avisar a cliente.
    case "absence_plan": {
      if (!UUID.test(String(b.pro_id || "")) || !ISO(b.from) || !ISO(b.to)) return json({ ok: false, erro: "dados inválidos" }, 400);
      return devolve(await rpc("desk_absence_plan", { ...K, p_pro_id: b.pro_id, p_from: b.from, p_to: b.to }), "não consegui montar o plano");
    }
    // absence_notify: e-mail com a marca do negócio — "continua com Fulana" (covered) ou "escolha outro
    // horário" (reschedule), sempre com o link assinado de remarcar/cancelar. Só diz "avisada" com o id da Resend.
    case "absence_notify": {
      if (!UUID.test(id)) return json({ ok: false, erro: "dados inválidos" }, 400);
      const mode = b.mode === "covered" ? "covered" : "reschedule";
      const a = await svcJson(env, "desk_self_get_svc", { p_tenant: email, p_id: id });
      if (!a || a.ok !== true) return json({ ok: false, erro: "agendamento não encontrado" }, 404);
      if (!env.RESEND_API_KEY) return json({ ok: false, motivo: "email_off", telefone: a.customer_contact || null });
      const contato = String(a.customer_contact || "");
      const para = /@/.test(contato) ? contato : await emailDoCliente(env, email, contato);
      if (!para || !/@/.test(para)) return json({ ok: false, motivo: "sem_email", telefone: contato || null });
      const L = ["pt", "es"].includes(b.lang) ? b.lang : "en";
      const whenLabel = new Date(a.start).toLocaleString({ pt: "pt-BR", es: "es-ES", en: "en-US" }[L], { timeZone: a.tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      const marca = await brandFor(env, email).catch(() => null);
      const { subject, html } = proAbsenceEmail({ name: a.customer_name || "", business: a.business || "", service: a.service || "", whenLabel,
        pro: String(b.absent_name || ""), cover: mode === "covered" ? (a.pro || "") : "", manageUrl: await reservaUrl(env, email, id), mode, lang: L, brand: marca, address: a.address || "" });
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: para, reply_to: email, subject, html }) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.id) return json({ ok: false, motivo: "envio_recusado", telefone: contato || null });
      // No feed (não na nota: a nota é da recepção e seria sobrescrita).
      await svcJson(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "booking", p_channel: "desk",
        p_summary: `📧 ${a.customer_name || "Cliente"} avisada da falta da profissional (${mode === "covered" ? "com " + (a.pro || "outra profissional") : "pedido para remarcar"})`.slice(0, 300),
        p_amount: 0, p_payload: { kind: "pro_absence", appointment_id: id, mode, envio_id: j.id } }).catch(() => null);
      return json({ ok: true, envio_id: j.id, para });
    }
    // ── ACESSOS DA EQUIPE (só a dona: o código da recepção não está na lista) ───────────────
    case "acessos_list": return devolve(await rpc("desk_acessos_list", K), "não consegui ler os acessos");
    case "acessos_criar": {
      const nome = String(b.nome || "").trim().slice(0, 60);
      if (!nome) return json({ ok: false, reason: "name_required" }, 400);
      const papel = b.papel === "profissional" ? "profissional" : "recepcao";
      if (papel === "profissional" && !UUID.test(String(b.pro_id || ""))) return json({ ok: false, reason: "pro_not_found" }, 400);
      const codigo = novoCodigo();
      const r = await rpc("desk_acesso_criar_v2", { ...K, p_nome: nome, p_hash: await hashCodigo(codigo), p_papel: papel, p_pro_id: papel === "profissional" ? b.pro_id : null });
      if (!r.ok || !r.data?.ok) return json(r.data && r.data.reason ? r.data : { ok: false, erro: "não consegui criar o acesso", detalhe: r.texto }, r.ok ? 200 : 503);
      // O código cru aparece UMA vez, aqui. O banco só tem o hash.
      return json({ ok: true, id: r.data.id, nome: r.data.nome, papel: r.data.papel, codigo });
    }
    case "acessos_revogar": {
      if (!UUID.test(id)) return json({ ok: false, erro: "dados inválidos" }, 400);
      return devolve(await rpc("desk_acesso_revogar", { ...K, p_id: id }), "não consegui revogar");
    }
    case "deposit_link": {
      // Mesmo módulo que a agente usa (lib/sinal.js). `send:true` gera E entrega à cliente (texto e/ou
      // e-mail, com comprovante); sem `send`, só devolve o link para a recepção copiar.
      if (!UUID.test(id)) return json({ ok: false, erro: "dados inválidos" }, 400);
      if (b.send === true) {
        const r = await mandarLinkDoSinal(env, { tenant: email, appointmentId: id, contact: String(b.contact || ""), email: String(b.to || ""), name: String(b.name || ""),
          service: String(b.service || ""), whenLabel: String(b.when_label || ""), lang: b.lang || "en", tz: String(b.tz || "America/New_York"), reenviar: true });
        return json(r.ok ? { ok: true, cents: r.cents, url: r.url, enviado: r.enviado } : { ok: false, reason: r.reason, enviado: r.enviado || null });
      }
      const r = await criarLinkDoSinal(env, { tenant: email, appointmentId: id, reenviar: true });
      return json(r.ok ? { ok: true, url: r.url, cents: r.cents } : { ok: false, reason: r.reason });
    }
  }
  return json({ ok: false, erro: "ação desconhecida" }, 400);
}

// Confirmação de agendamento feito no balcão (marcação simples e cada pessoa de um grupo): mesmo envio da
// agente (sendApptEmail). Devolve { ok, envio_id, para } ou { ok:false, motivo } — nunca "enviado" sem id.
async function confirmarReserva(env, email, { id, ref, contato, nome, clientEmail, lang }) {
  try {
    const info = await svcJson(env, "desk_self_get_svc", { p_tenant: email, p_id: id });
    if (!info?.ok) return { ok: false, motivo: "agendamento não encontrado" };
    const L = ["pt", "es"].includes(lang) ? lang : "en";
    const whenLabel = new Date(info.start).toLocaleString({ pt: "pt-BR", es: "es-ES", en: "en-US" }[L], { timeZone: info.tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const p = { tenant: email, contact: contato, email: /@/.test(contato) ? contato : String(clientEmail || ""), name: nome, service: info.service || "", whenLabel,
      pro: info.pro || "", location: info.location || "", address: info.address || "", locPhone: info.phone || "", ref: ref || "", lang: L, apptId: id };
    const enviado = await sendApptEmail(env, "book", p);
    return enviado ? { ok: true, envio_id: p.recibo?.id || null, para: p.recibo?.para || null } : { ok: false, motivo: "sem e-mail da cliente" };
  } catch { return { ok: false, motivo: "envio falhou" }; }
}

// Recibo: lê a venda gravada, monta pelo emailTemplates, envia pela Resend e marca com o id.
async function enviarRecibo(env, K, saleId, to, lang) {
  if (!env.RESEND_API_KEY) return { ok: false, motivo: "e-mail não configurado" };
  const r = await rpc("desk_sale_get", { ...K, p_id: saleId });
  const d = r.data;
  if (!r.ok || !d?.ok) return { ok: false, motivo: "venda não encontrada" };
  const s = d.sale || {};
  const tz = d.location?.tz || "America/New_York";
  const L = ["pt", "es"].includes(lang) ? lang : "en";
  const m = deskReceiptEmail({
    business: d.business || "", location: d.location || null, number: s.number, at: s.created_at, lines: d.lines || [], payments: d.payments || [],
    subtotal: s.subtotal_cents, discount: s.discount_cents, tax: s.tax_cents, tip: s.tip_cents, total: s.total_cents,
    coupon: s.coupon_code ? { code: s.coupon_code, cents: Number(s.coupon_discount_cents) || 0 } : null,
    customer: s.customer_name || "", lang: L, currency: BR_TZ.test(tz) ? "BRL" : "USD", tz,
  });
  try {
    const er = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject: m.subject, html: m.html, reply_to: K.p_email }),
    });
    const ej = await er.json().catch(() => ({}));
    if (!er.ok || !ej.id) return { ok: false, motivo: "envio recusado" };
    await rpc("desk_receipt_mark", { ...K, p_id: saleId, p_to: to, p_receipt_id: ej.id });
    return { ok: true, para: to, envio_id: ej.id };
  } catch { return { ok: false, motivo: "envio falhou" }; }
}
