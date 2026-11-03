/* A ASSISTENTE DA CENTRAL (2026-10-05) — o Gui do canto direito, refeito.
   1ª versão (manhã): agente da ElevenLabs com ferramentas na tela, mas a cara era um chat vazio.
   Luis: «a estética do chat tá ruim, precisa ser super indicativo e intuitivo com cliques de ações…
   precisa ser um assistente já com as coisas, relatório» e «a foto meio que 3D de uma assistente,
   no caso dela, Lilian». Agora:
   · o rosto é uma PERSONAGEM 3D ilustrada (public/assistente/assistente-3d.webp), nunca a foto de uma
     pessoa real — a Lilian de verdade é a dona do Natura, e a IA não pode se passar por ela;
   · o nome e a VOZ vêm do agente de telefone do negócio (/api/gui-voz → "Lilian" no Natura);
   · abre JÁ com o dia montado (sem gastar IA): números, a próxima cliente com botões, o que pede atenção;
   · ações grandes para tocar; e o que as ferramentas devolvem vira cartão com botão (horários clicáveis,
     agenda com Confirmar/Chegou/Faltou, ficha da cliente, números do relatório).
   Cérebro: agente "Gui · Central" (agent_8901m4524v51ewmv4q8yejtn6bst), sem Anthropic. As ferramentas rodam
   AQUI, com a chave da dona, sobre /api/desk. Marcar e cancelar esperam o toque em Confirmar. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Conversation } from "@elevenlabs/client";
import { chamarDesk, dinheiro, lang, paraUtc, diaDe, minutoDe, somaDias, hhmm, tx, assinarDesk, nomePlano } from "./deskApi.js";
import { amostra } from "./Desk.jsx";

const AVATAR = "/assistente/assistente-3d.webp";
const AVATAR_P = "/assistente/assistente-3d-160.webp";
const T = {
  role: { en: "AI assistant", pt: "Assistente de IA", es: "Asistente de IA", hi: "AI सहायक" },
  ph: { en: "Type or tap an action…", pt: "Escreva ou toque numa ação…", es: "Escribe o toca una acción…", hi: "लिखें या टैप करें…" },
  talk: { en: "Talk", pt: "Falar", es: "Hablar", hi: "बोलें" },
  stop: { en: "End call", pt: "Encerrar", es: "Terminar", hi: "बंद करें" },
  connecting: { en: "Connecting…", pt: "Conectando…", es: "Conectando…", hi: "कनेक्ट…" },
  listening: { en: "Listening", pt: "Ouvindo", es: "Escuchando", hi: "सुन रही है" },
  speaking: { en: "Speaking", pt: "Falando", es: "Hablando", hi: "बोल रही है" },
  ready: { en: "Online", pt: "Online", es: "En línea", hi: "ऑनलाइन" },
  thinking: { en: "Working on it…", pt: "Fazendo…", es: "Trabajando…", hi: "काम कर रही है…" },
  off: { en: "I couldn't connect. Try again in a moment.", pt: "Não consegui conectar. Tente de novo em instantes.", es: "No pude conectar. Intenta de nuevo.", hi: "कनेक्ट नहीं हो सका।" },
  limit: { en: "The demo hit its hourly limit. Sign in to keep going.", pt: "A demonstração chegou ao limite da hora. Entre na sua conta para continuar.", es: "La demo llegó a su límite por hora.", hi: "डेमो की सीमा पूरी हुई।" },
  mic: { en: "I need the microphone to talk. Allow it in the browser, or type below.", pt: "Preciso do microfone para falar. Libere no navegador, ou escreva abaixo.", es: "Necesito el micrófono. Permítelo o escribe abajo.", hi: "माइक की अनुमति चाहिए।" },
  confirm: { en: "Confirm", pt: "Confirmar", es: "Confirmar", hi: "पुष्टि करें" },
  cancel: { en: "Cancel", pt: "Cancelar", es: "Cancelar", hi: "रद्द करें" },
  demo: { en: "Demo · sample data, nothing is saved", pt: "Demonstração · dados de exemplo, nada é gravado", es: "Demo · datos de ejemplo", hi: "डेमो · नमूना डेटा" },
  demoDid: { en: "Demo: nothing was saved.", pt: "Demonstração: nada foi gravado.", es: "Demo: no se guardó nada.", hi: "डेमो: कुछ सेव नहीं हुआ।" },
  today: { en: "Today", pt: "Hoje", es: "Hoy", hi: "आज" },
  appts: { en: "Bookings", pt: "Atendimentos", es: "Citas", hi: "बुकिंग" },
  conf: { en: "Confirmed", pt: "Confirmados", es: "Confirmadas", hi: "पुष्ट" },
  arrived: { en: "Arrived", pt: "Chegaram", es: "Llegaron", hi: "आए" },
  rev: { en: "Expected", pt: "Previsto", es: "Previsto", hi: "अनुमानित" },
  next: { en: "Next up", pt: "Próxima", es: "Siguiente", hi: "अगला" },
  noNext: { en: "No one else today.", pt: "Ninguém mais hoje.", es: "Nadie más hoy.", hi: "आज और कोई नहीं।" },
  needs: { en: "Needs you", pt: "Precisa de você", es: "Te necesita", hi: "आपकी ज़रूरत" },
  allGood: { en: "Nothing needs you right now ✓", pt: "Nada pendente agora ✓", es: "Nada pendiente ✓", hi: "अभी कुछ नहीं ✓" },
  actions: { en: "What should I do?", pt: "O que eu faço?", es: "¿Qué hago?", hi: "मैं क्या करूँ?" },
  a_book: { en: "Book someone", pt: "Marcar horário", es: "Agendar", hi: "बुक करें" },
  a_tomorrow: { en: "Tomorrow", pt: "Agenda de amanhã", es: "Mañana", hi: "कल" },
  a_find: { en: "Find a client", pt: "Procurar cliente", es: "Buscar clienta", hi: "ग्राहक खोजें" },
  a_checkout: { en: "Open checkout", pt: "Abrir caixa", es: "Abrir caja", hi: "चेकआउट" },
  a_report: { en: "Month report", pt: "Relatório do mês", es: "Informe del mes", hi: "मासिक रिपोर्ट" },
  a_out: { en: "Someone's out", pt: "Alguém faltou", es: "Alguien faltó", hi: "कोई अनुपस्थित" },
  q_book: { en: "I want to book an appointment", pt: "Quero marcar um horário", es: "Quiero agendar una cita", hi: "I want to book" },
  q_tomorrow: { en: "Show me tomorrow's schedule", pt: "Me mostra a agenda de amanhã", es: "Muéstrame la agenda de mañana", hi: "Tomorrow's schedule" },
  q_find: { en: "Find a client", pt: "Procura uma cliente pra mim", es: "Busca una clienta", hi: "Find a client" },
  q_report: { en: "How did the last 30 days go?", pt: "Como foram os últimos 30 dias?", es: "¿Cómo fueron los últimos 30 días?", hi: "Last 30 days?" },
  q_out: { en: "Someone called in sick today", pt: "Uma profissional faltou hoje", es: "Una profesional faltó hoy", hi: "Someone is out today" },
  doArrive: { en: "Arrived", pt: "Chegou", es: "Llegó", hi: "आया" },
  doConfirm: { en: "Confirm", pt: "Confirmar", es: "Confirmar", hi: "पुष्टि" },
  doNoShow: { en: "No-show", pt: "Faltou", es: "Faltó", hi: "नहीं आया" },
  doCharge: { en: "Charge", pt: "Cobrar", es: "Cobrar", hi: "चार्ज" },
  doBook: { en: "Book", pt: "Marcar", es: "Agendar", hi: "बुक" },
  doCard: { en: "Open card", pt: "Abrir ficha", es: "Abrir ficha", hi: "कार्ड खोलें" },
  alertOf: { en: "Alert", pt: "Alerta", es: "Alerta", hi: "अलर्ट" },
  unpaid: { en: "finished, not charged yet", pt: "concluído e ainda não cobrado", es: "terminada, sin cobrar", hi: "पूरा, चार्ज नहीं" },
  unconfirmed: { en: "not confirmed yet", pt: "ainda sem confirmar", es: "sin confirmar", hi: "पुष्टि नहीं" },
  done: { en: "Done ✓", pt: "Feito ✓", es: "Hecho ✓", hi: "हो गया ✓" },
  human: { en: "Need a person? Talk to the Guileo team", pt: "Precisa de uma pessoa? Fale com a equipe Guileo", es: "¿Necesitas a una persona? Habla con el equipo", hi: "टीम से बात करें" },
};
const t = (k) => tx(T[k]) || k;
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const acha = (lista, nome) => {
  const n = norm(nome); if (!n) return null;
  return lista.find((x) => norm(x.name) === n) || lista.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name))) || lista.find((x) => norm(x.name).split(/\s+/)[0] === n.split(/\s+/)[0]) || null;
};
const ST = { booked: "agendado", confirmed: "confirmado", in_progress: "chegou", completed: "concluído", no_show: "faltou", cancelled: "cancelado", blocked: "bloqueado" };
const COR = { booked: "#3FB4FF", confirmed: "#2FE39A", in_progress: "#FFC23D", completed: "#8E8A80", no_show: "#FF5A5A" };
const TELAS = new Set(["hoje", "overview", "desk", "customers", "leads", "inbox", "followups", "waitlist", "reputation", "payments", "team", "locations", "analytics", "command", "brain", "settings", "billing", "leadstoday", "crm", "insights", "schedule"]);
const ABAS = new Set(["agenda", "caixa", "clientes", "equipe", "fechamento", "relatorios", "importar"]);
const MAPA_ST = { arrived: "in_progress" };

// Pedido para o Balcão (que pode ainda não estar montado quando a assistente pede): window + evento.
export function pedirAoBalcao(pedido) {
  try { window.__deskPedido = { ...pedido, em: Date.now() }; } catch { /* */ }
  setTimeout(() => window.dispatchEvent(new CustomEvent("desk:pedido", { detail: pedido })), 450);
}

// O dia, sem IA: números, próxima cliente e o que pede atenção. Também é o que resumo_de_hoje devolve.
function montarDia(a) {
  if (!a) return null;
  const tz = a.locations?.[0]?.tz || "America/New_York"; const ag = Date.now();
  const sv = (id) => (a.services || []).find((s) => s.id === id);
  const pro = (id) => (a.pros || []).find((p) => p.id === id);
  const cli = (a.appointments || []).filter((x) => !["blocked", "cancelled"].includes(x.status)).sort((x, y) => new Date(x.start) - new Date(y.start));
  const n = (st) => cli.filter((x) => x.status === st).length;
  const prox = cli.find((x) => new Date(x.end || x.start).getTime() > ag && !["completed", "no_show"].includes(x.status)) || null;
  const receita = cli.filter((x) => x.status !== "no_show").reduce((s, x) => s + (Number(sv(x.service_id)?.price_cents) || 0), 0);
  const atencao = [
    ...cli.filter((x) => x.status === "completed" && !x.sale_id).map((x) => ({ tipo: "unpaid", a: x })),
    ...cli.filter((x) => x.alert && !["completed", "no_show"].includes(x.status)).map((x) => ({ tipo: "alert", a: x })),
    ...cli.filter((x) => x.status === "booked" && new Date(x.start).getTime() > ag).slice(0, 3).map((x) => ({ tipo: "unconfirmed", a: x })),
  ].slice(0, 4);
  return { tz, total: cli.length, conf: n("confirmed"), chegou: n("in_progress"), concl: n("completed"), faltas: n("no_show"), receita, prox, atencao, sv, pro };
}

export default function GuiCentral({ onNav, real = null, conectada = false, email = "", dataKey = "", dono = "", negocio = "", nomeInicial = "", GuiMark }) {
  const conectado = !!((real || conectada) && email && dataKey);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("off");        // off | connecting | ready | thinking | listening | speaking | error
  const [voz, setVoz] = useState(false);
  const [pend, setPend] = useState(null);              // { texto, resolver }
  // nomeInicial: o /balcao já sabe o nome do agente do negócio (desk "quem") — a bolinha nasce "Lilian", não "Assistente".
  const [nome, setNome] = useState(conectado ? nomeInicial : "Lilian");
  const [dia, setDia] = useState(null);
  const [feito, setFeito] = useState({});              // id → rótulo da ação direta já feita
  const sessao = useRef(null);
  const base = useRef(null);
  const fim = useRef(null);
  const campo = useRef(null);
  const add = (m) => setMsgs((xs) => [...xs, m]);
  const L = ["pt", "es", "en"].includes(lang()) ? lang() : "en";
  const loc0 = L === "pt" ? "pt-BR" : L === "es" ? "es-ES" : "en-US";

  // Só rola para baixo depois que a pessoa agiu — a saudação não pode empurrar o resumo do dia para fora da tela.
  useEffect(() => { if (pend || msgs.some((m) => m.from === "you" || (m.from === "card" && m.kind !== "plano"))) fim.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [msgs, pend]);
  useEffect(() => () => { try { sessao.current?.endSession(); } catch { /* */ } }, []);

  // ── dados ───────────────────────────────────────────────────────────────────────────────
  const tzDe = (d) => d?.locations?.[0]?.tz || "America/New_York";
  const carregar = async (d0in) => {
    const tz0 = tzDe(base.current);
    const d0 = d0in || diaDe(new Date(), tz0);
    if (!conectado) { const a = amostra(d0); if (!d0in) base.current = a; return a; }
    const { d } = await chamarDesk(email, dataKey, { action: "agenda", from: paraUtc(d0, 0, tz0).toISOString(), to: paraUtc(somaDias(d0, 1), 0, tz0).toISOString() });
    if (d?.ok && !d0in) base.current = d;
    return d?.ok ? d : null;
  };
  const desk = async (corpo) => { if (!conectado) return { ok: false, demo: true }; const { d } = await chamarDesk(email, dataKey, corpo); return d || { ok: false }; };
  const confirmar = (texto) => new Promise((resolver) => setPend({ texto, resolver }));
  const fechaPend = (ok) => { setPend((p) => { p?.resolver(ok); return null; }); };
  const recarregarDia = async () => { const a = await carregar(); setDia(montarDia(a)); window.dispatchEvent(new Event("desk:recarregar")); };
  const quando = (iso, tz) => new Date(iso).toLocaleString(loc0, { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  // AÇÃO DIRETA (botão num cartão): vai direto ao /api/desk, sem passar pela IA.
  const acaoDireta = async (id, st, rot) => {
    if (!conectado) { setFeito((f) => ({ ...f, [id + st]: t("demoDid") })); return; }
    const r = await desk({ action: "status", id, status: MAPA_ST[st] === "in_progress" ? "arrived" : st });
    setFeito((f) => ({ ...f, [id + st]: r.ok ? `${rot} ✓` : (r.erro || t("off")) }));
    if (r.ok) recarregarDia();
  };
  const cobrar = (ap) => { onNav?.("desk"); pedirAoBalcao({ aba: "caixa", cobrar: ap?.id || null }); };

  // ── as ferramentas do agente (nomes e parâmetros batem com a configuração na ElevenLabs) ─────
  const ferramentas = useMemo(() => ({
    abrir_tela: async ({ tela, aba }) => {
      const v = String(tela || "").trim();
      if (!TELAS.has(v)) return `erro: tela desconhecida "${v}"`;
      onNav?.(v);
      if (v === "desk" && ABAS.has(String(aba || ""))) pedirAoBalcao({ aba });
      return `ok: abri ${v}${aba ? ` (${aba})` : ""}`;
    },
    resumo_de_hoje: async () => {
      const a = await carregar(); const d = montarDia(a); if (!d) return "erro: não consegui ler a agenda";
      setDia(d);
      return `hoje: ${d.total} atendimentos; confirmados ${d.conf}; chegaram ${d.chegou}; concluídos ${d.concl}; faltas ${d.faltas}; previsto ${dinheiro(d.receita, d.tz, { casas: 0 })}` +
        (d.prox ? `; próxima: ${hhmm(minutoDe(d.prox.start, d.tz))} ${d.prox.customer_name || ""} (${d.sv(d.prox.service_id)?.name || ""})` : "; ninguém mais hoje") +
        `. O resumo já está no topo do painel.` + (conectado ? "" : " [dados de exemplo]");
    },
    agenda_do_dia: async ({ dia: diaP, profissional }) => {
      const d0 = /^\d{4}-\d{2}-\d{2}$/.test(diaP || "") ? diaP : null;
      const a = await carregar(d0); if (!a) return "erro: não consegui ler a agenda";
      const tz = tzDe(a); const pro = profissional ? acha(a.pros || [], profissional) : null;
      if (profissional && !pro) return `erro: não achei a profissional "${profissional}". Profissionais: ${(a.pros || []).map((p) => p.name).join(", ")}`;
      const itens = (a.appointments || []).filter((x) => !["cancelled", "blocked"].includes(x.status) && (!pro || x.pro_id === pro.id)).sort((x, y) => new Date(x.start) - new Date(y.start)).slice(0, 30)
        .map((x) => ({ id: x.id, hora: hhmm(minutoDe(x.start, tz)), nome: x.customer_name || "—", servico: (a.services || []).find((s) => s.id === x.service_id)?.name || "", pro: (a.pros || []).find((p) => p.id === x.pro_id)?.name || "", st: x.status, alerta: x.alert || null, pago: !!x.sale_id }));
      add({ from: "card", kind: "agenda", titulo: d0 ? new Date(`${d0}T12:00:00Z`).toLocaleDateString(loc0, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : t("today"), itens });
      return itens.length ? `${itens.length} agendamentos; a lista com botões está na tela. ` + itens.map((i) => `${i.hora} ${i.nome} · ${i.servico} · ${i.pro} · ${ST[i.st] || i.st} · id ${i.id}`).join("\n") : "nenhum agendamento nesse dia";
    },
    horarios_livres: async ({ servico, profissional, dia: diaP }) => {
      const a = base.current || (await carregar()); if (!a) return "erro: não consegui ler a agenda";
      const sv = acha(a.services || [], servico); if (!sv) return `erro: não achei o serviço "${servico}". Serviços: ${(a.services || []).map((s) => s.name).join(", ")}`;
      const pro = profissional ? acha(a.pros || [], profissional) : null;
      const tz = tzDe(a); const d0 = /^\d{4}-\d{2}-\d{2}$/.test(diaP || "") ? diaP : null;
      let vagas;
      if (!conectado) {
        const dd = d0 || somaDias(diaDe(new Date(), tz), 1);
        vagas = [[660, "Bianca"], [780, "Ana"], [990, "Carla"], [1050, "Ana"]].map(([m, p]) => ({ start: paraUtc(dd, m, tz).toISOString(), pro: pro?.name || p }));
      } else {
        const dias = d0 ? Math.max(1, Math.round((paraUtc(d0, 0, tz) - Date.now()) / 86400000) + 2) : 7;
        const r = await desk({ action: "availability", service_id: sv.id, pro_id: pro?.id || null, location_id: a.locations?.[0]?.id || null, days: Math.min(dias, 30) });
        if (!r.ok) return "erro: não consegui ler os horários livres";
        vagas = (r.slots || []).filter((s) => !d0 || diaDe(new Date(s.start), tz) === d0).slice(0, 8);
      }
      add({ from: "card", kind: "slots", servico: sv.name, tz, vagas });
      return vagas.length ? `${vagas.length} horários livres para ${sv.name}; os botões estão na tela. ` + vagas.map((s) => `${quando(s.start, tz)} com ${s.pro} (inicio ${s.start})`).join("\n") : "nenhuma vaga nesse período";
    },
    marcar_horario: async ({ cliente_nome, cliente_contato, servico, profissional, inicio }) => {
      const a = base.current || (await carregar()); if (!a) return "erro: não consegui ler a agenda";
      const sv = acha(a.services || [], servico); if (!sv) return `erro: não achei o serviço "${servico}"`;
      const ini = new Date(inicio); if (Number.isNaN(ini.getTime())) return "erro: horário inválido, use ISO com fuso";
      const tz = tzDe(a);
      let pro = profissional ? acha(a.pros || [], profissional) : null;
      if (profissional && !pro) return `erro: não achei a profissional "${profissional}"`;
      if (!pro && conectado) {
        const r = await desk({ action: "availability", service_id: sv.id, location_id: a.locations?.[0]?.id || null, days: 30 });
        const s = (r.slots || []).find((x) => new Date(x.start).getTime() === ini.getTime());
        if (!s) return "erro: esse horário não está livre; use horarios_livres para ver as vagas";
        pro = (a.pros || []).find((p) => p.id === s.pro_id) || { id: s.pro_id, name: s.pro };
      }
      pro = pro || (a.pros || [])[0];
      const ok = await confirmar({ icone: "📅", linha1: `${cliente_nome}`, linha2: `${sv.name} · ${pro?.name || ""}`, linha3: `${quando(ini.toISOString(), tz)}${cliente_contato ? ` · ${cliente_contato}` : ""}` });
      if (!ok) return "a pessoa cancelou na tela; nada foi marcado";
      if (!conectado) return "confirmado na demonstração (nada foi gravado)";
      const r = await desk({ action: "book", pro_id: pro.id, location_id: a.locations?.[0]?.id || null, service_id: sv.id, name: cliente_nome, contact: cliente_contato || "", start: ini.toISOString() });
      if (!r.ok) return `erro: o sistema recusou (${r.erro || r.reason || "sem motivo"})`;
      recarregarDia();
      return `confirmado: marcado (ref ${r.ref || r.appointment_id})${r.confirmacao?.ok ? "; a cliente recebeu e-mail de confirmação" : ""}`;
    },
    mudar_situacao: async ({ agendamento_id, situacao }) => {
      const st = String(situacao || ""); const id = String(agendamento_id || "");
      if (!["confirmed", "arrived", "completed", "no_show", "cancelled"].includes(st)) return "erro: situação inválida";
      const ap = (base.current?.appointments || []).find((x) => x.id === id);
      if (st === "cancelled") {
        const ok = await confirmar({ icone: "✖", linha1: `${tx({ en: "Cancel", pt: "Cancelar", es: "Cancelar", hi: "रद्द" })}: ${ap?.customer_name || ""}`, linha2: ap ? quando(ap.start, tzDe(base.current)) : id, linha3: "" });
        if (!ok) return "a pessoa não confirmou; nada mudou";
      }
      if (!conectado) return `confirmado na demonstração: ${ST[st] || st} (nada foi gravado)`;
      const r = await desk({ action: "status", id, status: st });
      if (!r.ok) return `erro: o sistema recusou (${r.erro || "sem motivo"})`;
      recarregarDia();
      return `confirmado: ${ST[st] || st}${r.fila?.oferecida ? `; a vaga foi oferecida a quem estava na fila (${r.fila.para})` : ""}`;
    },
    procurar_cliente: async ({ busca }) => {
      let ficha = null;
      if (!conectado) {
        const a = base.current || (await carregar());
        const x = (a.appointments || []).find((y) => norm(y.customer_name).includes(norm(busca)));
        if (x) ficha = { nome: x.customer_name, contato: "", visitas: 6, gasto: 78000, faltas: 0, alerta: x.alert || null, tz: tzDe(a) };
      } else {
        const r = await desk({ action: "client_search", q: String(busca || "") });
        const lista = Array.isArray(r) ? r : r.results || r.clients || [];
        if (!lista.length) return "não achei ninguém com esse nome ou telefone";
        if (lista.length > 1) return `achei ${lista.length}: ${lista.slice(0, 6).map((c) => `${c.name || "—"} (${c.contact || ""})`).join("; ")}. Pergunte qual.`;
        const c = await desk({ action: "client_card", contact: lista[0].contact });
        const f = c.card || c;
        ficha = { nome: f.name || lista[0].name, contato: lista[0].contact, visitas: f.visits ?? f.visit_count ?? null, gasto: f.spend_cents ?? f.spent_cents ?? null, faltas: f.no_shows ?? null, alerta: f.alerts || f.alert || null, tz: tzDe(base.current) };
      }
      if (!ficha) return "não achei ninguém com esse nome";
      add({ from: "card", kind: "cliente", ficha });
      return `ficha na tela: ${JSON.stringify(ficha).slice(0, 500)}${conectado ? "" : " [dados de exemplo]"}`;
    },
    relatorio: async ({ dias }) => {
      const n = [7, 30, 90].includes(Number(dias)) ? Number(dias) : 30;
      let r;
      if (!conectado) r = { visits: 142, new_clients: 31, returning_clients: 87, rebook: { visits: 142, rebooked: 61 }, no_show: 6, cancelled: 11, by_pro: [{ name: "Ana", utilization_pct: 85.7 }, { name: "Bianca", utilization_pct: 70 }, { name: "Carla", utilization_pct: 50 }], top_services: [{ name: "Deep Tissue 60min" }, { name: "Signature Facial" }] };
      else {
        const ate = new Date(); const de = new Date(ate.getTime() - n * 86400000);
        r = await desk({ action: "reports", from: de.toISOString(), to: ate.toISOString() });
        if (!r.ok) return "erro: não consegui ler os relatórios";
      }
      add({ from: "card", kind: "relatorio", dias: n, r });
      const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "—");
      return `${n} dias (os números estão no cartão): ${r.visits} visitas, ${r.new_clients} novas, ${r.returning_clients} recorrentes, ${pct(r.rebook?.rebooked || 0, r.rebook?.visits || 0)} saíram com o próximo horário, ${r.no_show} faltas. Ocupação: ${(r.by_pro || []).map((p) => `${p.name} ${p.utilization_pct ?? "—"}%`).join(", ")}${conectado ? "" : " [dados de exemplo]"}`;
    },
    alguem_faltou: async ({ profissional, dia: diaP }) => {
      const a = base.current || (await carregar()); if (!a) return "erro: não consegui ler a agenda";
      const pro = acha(a.pros || [], profissional); if (!pro) return `erro: não achei "${profissional}". Profissionais: ${(a.pros || []).map((p) => p.name).join(", ")}`;
      const tz = tzDe(a); const d0 = /^\d{4}-\d{2}-\d{2}$/.test(diaP || "") ? diaP : diaDe(new Date(), tz);
      onNav?.("desk"); pedirAoBalcao({ aba: "agenda", falta: { pro_id: pro.id, dia: d0 } });
      if (!conectado) return `abri o painel "Alguém faltou" para ${pro.name} no Balcão [dados de exemplo]`;
      const r = await desk({ action: "absence_plan", pro_id: pro.id, from: paraUtc(d0, 0, tz).toISOString(), to: paraUtc(somaDias(d0, 1), 0, tz).toISOString() });
      if (!r.ok) return "abri o painel, mas não consegui montar o plano";
      const sem = (r.items || []).filter((i) => !i.cover.length).length;
      return `abri o painel para ${pro.name}: ${(r.items || []).length} clientes; ${(r.items || []).length - sem} têm quem cubra no mesmo horário, ${sem} precisam remarcar. A pessoa escolhe em cada cliente na tela.`;
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [conectado, email, dataKey, onNav, L]);

  // ── sessão ──────────────────────────────────────────────────────────────────────────────
  const variaveis = (a, nomeA) => {
    const tz = tzDe(a);
    const hoje = new Date().toLocaleDateString(loc0, { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return {
      assistente: nomeA || "Gui",
      dono: (dono || "").split(/\s+/)[0] || (L === "pt" ? "tudo bem" : L === "es" ? "qué tal" : "there"),
      negocio: negocio || (conectado ? email : "Natura Spa + Salon (demonstração)"),
      hoje: `${hoje} (${diaDe(new Date(), tz)})`, fuso: tz,
      unidades: (a?.locations || []).map((l) => l.name).join(", ") || "—",
      profissionais: (a?.pros || []).filter((p) => (p.kind || "staff") !== "room").map((p) => p.name).join(", ") || "—",
      servicos: (a?.services || []).slice(0, 40).map((s) => `${s.name} (${s.duration_min} min, ${dinheiro(s.price_cents, tz, { casas: 0 })})`).join("; ") || "—",
    };
  };
  const iniciar = async (comVoz) => {
    try { await sessao.current?.endSession(); } catch { /* */ }
    sessao.current = null; setEstado("connecting");
    const r = await fetch("/api/gui-voz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(conectado ? { email, key: dataKey } : {}) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (j?.error === "plan_required") { setEstado("off"); setMsgs((xs) => (xs.some((m) => m.kind === "plano") ? xs : [...xs, { from: "card", kind: "plano", precisa: j.precisa || "pro" }])); return false; }
    if (!j?.ok) { setEstado("error"); add({ from: "sys", text: j?.error === "too_many" ? t("limit") : t("off") }); return false; }
    const nomeA = conectado ? (j.nome || "Gui") : "Lilian";
    setNome(nomeA);
    if (comVoz) {
      try { await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch { setEstado("ready"); add({ from: "card", kind: "mic" }); setVoz(false); return false; }
    }
    try {
      sessao.current = await Conversation.startSession({
        signedUrl: j.signed_url, textOnly: !comVoz,
        overrides: { agent: { language: L }, ...(j.voz ? { tts: { voiceId: j.voz } } : {}), ...(comVoz ? {} : { conversation: { textOnly: true } }) },
        dynamicVariables: variaveis(base.current || (await carregar()), nomeA),
        clientTools: ferramentas,
        onMessage: (m) => {
          const quem = m?.source === "user" || m?.role === "user" ? "you" : "gui";
          const texto = String(m?.message ?? "").trim(); if (!texto) return;
          if (quem === "you" && !comVoz) return;          // no texto, a mensagem dela já está na tela
          add({ from: quem, text: texto });
          if (quem === "gui" && !comVoz) setEstado("ready");
        },
        onModeChange: (m) => comVoz && setEstado(m?.mode === "speaking" ? "speaking" : "listening"),
        onConnect: () => setEstado(comVoz ? "listening" : "ready"),
        onDisconnect: () => { setEstado("off"); setVoz(false); sessao.current = null; },
        onError: () => setEstado("error"),
      });
      setVoz(comVoz);
      return true;
    } catch { setEstado("error"); add({ from: "sys", text: t("off") }); return false; }
  };
  const abrir = async () => {
    setOpen(true);
    if (!dia) carregar().then((a) => setDia(montarDia(a)));
    if (!sessao.current && estado !== "connecting") iniciar(false);
  };
  const enviar = async (texto) => {
    const s = String(texto || "").trim(); if (!s) return;
    add({ from: "you", text: s }); setQ(""); setEstado("thinking");
    if (!sessao.current) { const ok = await iniciar(false); if (!ok) return; }
    try { sessao.current.sendUserMessage(s); } catch { add({ from: "sys", text: t("off") }); setEstado("error"); }
  };
  const alternarVoz = async () => { if (voz) { await iniciar(false); setVoz(false); } else await iniciar(true); };

  // ── tela ────────────────────────────────────────────────────────────────────────────────
  const rotulo = { connecting: t("connecting"), listening: t("listening"), speaking: t("speaking"), ready: t("ready"), thinking: t("thinking"), off: "", error: t("off") }[estado];
  const vivo = ["ready", "thinking", "listening", "speaking"].includes(estado);
  const btnP = "rounded-full px-3 py-1.5 min-h-[34px] text-[11px] font-bold border transition active:scale-95";
  const Avatar = ({ size = 56 }) => (
    <span className="relative shrink-0 rounded-full p-[2px]" style={{ width: size + 4, height: size + 4, background: estado === "speaking" ? "conic-gradient(from 0deg,#2FE39A,#D6C29A,#2FE39A)" : vivo ? "linear-gradient(135deg,#2FE39A,#D6C29A)" : "rgba(255,255,255,.18)" }}>
      <img src={size > 60 ? AVATAR : AVATAR_P} alt="" width={size} height={size} className={`block rounded-full object-cover ${estado === "speaking" ? "animate-pulse" : ""}`} style={{ width: size, height: size }} />
      <span className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-[#0c100d] ${estado === "error" ? "bg-red-400" : vivo ? "bg-g-green" : "bg-white/40"}`} />
    </span>
  );
  const Acao = ({ ic, rot, onClick }) => (
    <button type="button" onClick={onClick} className="group flex flex-col items-start gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-g-green/40 hover:bg-g-green/[0.06] active:scale-[0.98]">
      <span className="text-lg leading-none">{ic}</span>
      <span className="text-[12px] font-bold leading-tight text-g-word">{rot}</span>
    </button>
  );
  const Mark = GuiMark; void Mark;

  return (
    <>
      {/* gui-bolha: some enquanto um painel lateral (Drawer) está aberto — ela cobria o canto do painel (CSS em Portal.jsx). */}
      {!open && (
        <button onClick={abrir} aria-label={nome || "Assistente"} className="gui-bolha fixed bottom-20 right-5 md:bottom-5 z-[55] flex items-center gap-2 rounded-full border border-white/15 bg-[#14130f]/95 backdrop-blur-xl pl-1 pr-4 py-1 shadow-2xl transition hover:border-g-green/40">
          <span className="relative">
            <img src={AVATAR_P} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover ring-2 ring-g-green/60" />
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#14130f] bg-g-green" />
          </span>
          <span className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-sm font-extrabold text-g-word">{nome || tx({ en: "Assistant", pt: "Assistente", es: "Asistente", hi: "सहायक" })}</span>
            <span className="text-[10px] text-g-muted">{t("role")}</span>
          </span>
        </button>
      )}
      {open && (
        <div className="fixed bottom-20 right-3 md:bottom-5 md:right-5 z-[55] w-[calc(100vw-1.5rem)] max-w-[420px] h-[min(82dvh,740px)] rounded-[22px] border border-white/15 bg-[#0d0f0c]/98 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
          {/* cabeçalho: o rosto, o nome, a voz */}
          <div className="relative px-4 pt-4 pb-3 shrink-0 border-b border-white/10" style={{ background: "radial-gradient(120% 90% at 0% 0%, rgba(47,227,154,.10), transparent 60%)" }}>
            <div className="flex items-center gap-3">
              <Avatar size={56} />
              <div className="flex-1 min-w-0">
                <div className="text-base font-extrabold text-g-word truncate">{nome || "…"}</div>
                <div className="text-[11px] text-g-muted truncate">{t("role")}{negocio ? ` · ${negocio}` : ""}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold" style={{ color: estado === "error" ? "#FF7A6B" : vivo ? "#2FE39A" : "#9a958c" }}>
                  {(estado === "listening" || estado === "speaking" || estado === "thinking") && (
                    <span className="flex items-end gap-[2px] h-3" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className="w-[3px] rounded-full bg-current animate-pulse" style={{ height: `${[6, 11, 8, 12][i]}px`, animationDelay: `${i * 120}ms` }} />)}</span>
                  )}
                  {rotulo}
                </div>
              </div>
              <button type="button" onClick={alternarVoz} aria-pressed={voz} aria-label={voz ? t("stop") : t("talk")}
                className={`flex h-11 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold transition active:scale-95 ${voz ? "bg-red-500/90 text-white" : "bg-g-green text-[#0d1a14]"}`}>
                {voz ? "■" : "🎙"} {voz ? t("stop") : t("talk")}
              </button>
              <button onClick={() => { setOpen(false); if (voz) iniciar(false); }} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-g-muted hover:bg-white/10 hover:text-g-word">✕</button>
            </div>
            {!conectado && <div className="mt-2 text-[10px] font-bold text-g-gold">{t("demo")}</div>}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" role="log" aria-live="polite">
            {/* O DIA, PRONTO (sem IA) */}
            {dia && (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-g-muted">{t("today")}</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[[t("appts"), dia.total, "#3FB4FF"], [t("conf"), dia.conf, "#2FE39A"], [t("arrived"), dia.chegou, "#FFC23D"], [t("rev"), dinheiro(dia.receita, dia.tz, { casas: 0, zeroTraco: true }), "#D6C29A"]].map(([k, v, c]) => (
                    <div key={k} className="rounded-xl bg-black/25 px-2 py-2">
                      <div className="text-[9px] uppercase tracking-wide text-g-muted truncate">{k}</div>
                      <div className="text-sm font-extrabold num" style={{ color: c }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 rounded-xl border border-white/10 bg-black/20 p-2.5">
                  <div className="text-[9px] font-black uppercase tracking-wider text-g-muted">{t("next")}</div>
                  {dia.prox ? (
                    <>
                      <div className="mt-0.5 flex items-baseline justify-between gap-2">
                        <span className="text-sm font-extrabold text-g-word truncate">{hhmm(minutoDe(dia.prox.start, dia.tz))} · {dia.prox.customer_name || "—"}</span>
                        <span className="text-[10px] text-g-muted truncate">{dia.sv(dia.prox.service_id)?.name || ""} · {dia.pro(dia.prox.pro_id)?.name || ""}</span>
                      </div>
                      {dia.prox.alert && <div className="mt-1 text-[11px] font-bold text-amber-200">⚠ {dia.prox.alert}</div>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {feito[dia.prox.id + "arrived"] ? <span className="text-[11px] font-bold text-g-green">{feito[dia.prox.id + "arrived"]}</span> : (
                          <>
                            {dia.prox.status !== "in_progress" && <button onClick={() => acaoDireta(dia.prox.id, "arrived", t("doArrive"))} className={`${btnP} border-yellow-300/40 text-yellow-200`}>✓ {t("doArrive")}</button>}
                            {dia.prox.status === "booked" && <button onClick={() => acaoDireta(dia.prox.id, "confirmed", t("doConfirm"))} className={`${btnP} border-g-green/40 text-g-green`}>{t("doConfirm")}</button>}
                            <button onClick={() => cobrar(dia.prox)} className={`${btnP} border-white/15 text-g-word`}>💳 {t("doCharge")}</button>
                          </>
                        )}
                      </div>
                    </>
                  ) : <div className="mt-0.5 text-xs text-g-muted">{t("noNext")}</div>}
                </div>
                <div className="mt-2.5">
                  <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-g-muted">{t("needs")}</div>
                  {dia.atencao.length === 0 ? <div className="text-[11px] text-g-green">{t("allGood")}</div> : (
                    <div className="space-y-1.5">
                      {dia.atencao.map((x) => (
                        <div key={x.tipo + x.a.id} className="flex items-center justify-between gap-2 rounded-xl bg-black/20 px-2.5 py-1.5">
                          <span className="min-w-0 text-[11px] text-g-light truncate">
                            {x.tipo === "unpaid" ? "💳" : x.tipo === "alert" ? "⚠" : "🕒"} <b className="text-g-word">{x.a.customer_name}</b> {x.tipo === "alert" ? `· ${x.a.alert}` : `· ${t(x.tipo)}`}
                          </span>
                          {x.tipo === "unpaid" && <button onClick={() => cobrar(x.a)} className={`${btnP} border-white/15 text-g-word shrink-0`}>{t("doCharge")}</button>}
                          {x.tipo === "unconfirmed" && (feito[x.a.id + "confirmed"] ? <span className="text-[10px] font-bold text-g-green shrink-0">{feito[x.a.id + "confirmed"]}</span> : <button onClick={() => acaoDireta(x.a.id, "confirmed", t("doConfirm"))} className={`${btnP} border-g-green/40 text-g-green shrink-0`}>{t("doConfirm")}</button>)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* AÇÕES GRANDES */}
            <section>
              <div className="mb-1.5 px-1 text-[10px] font-black uppercase tracking-wider text-g-muted">{t("actions")}</div>
              <div className="grid grid-cols-3 gap-1.5">
                <Acao ic="📅" rot={t("a_book")} onClick={() => enviar(t("q_book"))} />
                <Acao ic="🗓️" rot={t("a_tomorrow")} onClick={() => enviar(t("q_tomorrow"))} />
                <Acao ic="🔍" rot={t("a_find")} onClick={() => { setQ(""); campo.current?.focus(); enviar(t("q_find")); }} />
                <Acao ic="💳" rot={t("a_checkout")} onClick={() => { ferramentas.abrir_tela({ tela: "desk", aba: "caixa" }); add({ from: "sys", text: `💳 ${t("a_checkout")} ✓` }); }} />
                <Acao ic="📊" rot={t("a_report")} onClick={() => enviar(t("q_report"))} />
                <Acao ic="🤒" rot={t("a_out")} onClick={() => enviar(t("q_out"))} />
              </div>
            </section>

            {/* CONVERSA + CARTÕES */}
            {msgs.map((m, i) => {
              if (m.from === "card" && m.kind === "plano") return (
                <div key={i} className="rounded-2xl border border-g-gold/40 bg-g-gold/[0.07] p-3 text-[12px] text-g-light">
                  <div className="font-extrabold text-g-gold">✨ {tx({ en: `The AI assistant is part of the ${nomePlano(m.precisa)} plan`, pt: `A assistente de IA faz parte do plano ${nomePlano(m.precisa)}`, es: `La asistente de IA es parte del plan ${nomePlano(m.precisa)}`, hi: `AI सहायक ${nomePlano(m.precisa)} प्लान में है` })}</div>
                  <div className="mt-1">{tx({ en: "Today's summary above keeps working. Upgrade to talk, book and charge by voice or text.", pt: "O resumo do dia aí em cima continua. Assine para conversar, marcar e cobrar por voz ou texto.", es: "El resumen de arriba sigue funcionando. Suscríbete para hablar, agendar y cobrar por voz o texto.", hi: "अपग्रेड करें।" })}</div>
                  <button onClick={() => assinarDesk(email, dataKey, m.precisa)} className={`${btnP} mt-2 border-g-gold/50 text-g-gold`}>{tx({ en: `Subscribe to ${nomePlano(m.precisa)}`, pt: `Assinar o ${nomePlano(m.precisa)}`, es: `Suscribirme al ${nomePlano(m.precisa)}`, hi: "अपग्रेड" })}</button>
                </div>
              );
              if (m.from === "card" && m.kind === "mic") return (
                <div key={i} className="rounded-2xl border border-amber-300/40 bg-amber-300/[0.07] p-3 text-[12px] text-g-light">
                  <div className="font-extrabold text-amber-200">🎙 {tx({ en: "The microphone is blocked", pt: "O microfone está bloqueado", es: "El micrófono está bloqueado", hi: "माइक्रोफ़ोन ब्लॉक है" })}</div>
                  <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
                    <li>{tx({ en: "Tap the lock 🔒 next to the address (guileoai.com).", pt: "Toque no cadeado 🔒 ao lado do endereço (guileoai.com).", es: "Toca el candado 🔒 junto a la dirección.", hi: "पते के पास 🔒 दबाएँ।" })}</li>
                    <li>{tx({ en: "Microphone → Allow.", pt: "Microfone → Permitir.", es: "Micrófono → Permitir.", hi: "माइक्रोफ़ोन → अनुमति दें।" })}</li>
                    <li>{tx({ en: "Tap Try again below.", pt: "Toque em Tentar de novo aqui embaixo.", es: "Toca Intentar de nuevo.", hi: "फिर से कोशिश करें दबाएँ।" })}</li>
                  </ol>
                  <div className="mt-1.5 text-[11px] text-g-muted">{tx({ en: "Inside apps that embed a browser, voice may not be available. Open guileoai.com/portal in Chrome or Safari. Typing works everywhere.", pt: "Dentro de aplicativos que abrem um navegador embutido, a voz pode não funcionar. Abra guileoai.com/portal no Chrome ou no Safari. Escrever funciona em qualquer lugar.", es: "Dentro de apps con navegador integrado la voz puede no funcionar. Abre guileoai.com/portal en Chrome o Safari.", hi: "Chrome या Safari में खोलें।" })}</div>
                  <button onClick={() => iniciar(true)} className={`${btnP} mt-2 border-amber-300/50 text-amber-100`}>🎙 {tx({ en: "Try again", pt: "Tentar de novo", es: "Intentar de nuevo", hi: "फिर से कोशिश करें" })}</button>
                </div>
              );
              if (m.from === "sys") return <div key={i} className="text-center text-[11px] text-g-muted px-4">{m.text}</div>;
              if (m.from === "card" && m.kind === "slots") return (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-g-muted">🕒 {m.servico}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.vagas.length === 0 ? <span className="text-[11px] text-g-muted">—</span> : m.vagas.map((s) => (
                      <button key={s.start + s.pro} onClick={() => enviar(`${tx({ en: "Book", pt: "Marca", es: "Agenda", hi: "Book" })} ${m.servico} ${quando(s.start, m.tz)} ${tx({ en: "with", pt: "com", es: "con", hi: "with" })} ${s.pro}`)}
                        className="rounded-xl border border-g-green/30 bg-g-green/[0.08] px-2.5 py-1.5 text-left transition hover:bg-g-green/15 active:scale-95">
                        <div className="text-[11px] font-extrabold text-g-word">{quando(s.start, m.tz)}</div>
                        <div className="text-[10px] text-g-muted">{s.pro}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
              if (m.from === "card" && m.kind === "agenda") return (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-g-muted capitalize">🗓️ {m.titulo} · {m.itens.length}</div>
                  <div className="mt-2 space-y-1.5">
                    {m.itens.map((x) => {
                      const f = ["confirmed", "arrived", "no_show"].map((s) => feito[x.id + s]).find(Boolean);
                      return (
                        <div key={x.id} className="rounded-xl bg-black/20 px-2.5 py-2" style={{ borderLeft: `3px solid ${COR[x.st] || "#3FB4FF"}` }}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[12px] font-extrabold text-g-word truncate">{x.hora} · {x.nome}{x.alerta ? " ⚠" : ""}</span>
                            <span className="text-[10px] font-bold shrink-0" style={{ color: COR[x.st] }}>{ST[x.st] || x.st}</span>
                          </div>
                          <div className="text-[10px] text-g-muted truncate">{x.servico} · {x.pro}</div>
                          {!["completed", "no_show"].includes(x.st) && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {f ? <span className="text-[10px] font-bold text-g-green">{f}</span> : (
                                <>
                                  {x.st === "booked" && <button onClick={() => acaoDireta(x.id, "confirmed", t("doConfirm"))} className={`${btnP} border-g-green/40 text-g-green`}>{t("doConfirm")}</button>}
                                  {x.st !== "in_progress" && <button onClick={() => acaoDireta(x.id, "arrived", t("doArrive"))} className={`${btnP} border-yellow-300/40 text-yellow-200`}>{t("doArrive")}</button>}
                                  <button onClick={() => acaoDireta(x.id, "no_show", t("doNoShow"))} className={`${btnP} border-red-400/30 text-red-300`}>{t("doNoShow")}</button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
              if (m.from === "card" && m.kind === "cliente") return (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-g-gold/20 text-sm font-black text-g-gold">{(m.ficha.nome || "?").slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0"><div className="text-sm font-extrabold text-g-word truncate">{m.ficha.nome}</div><div className="text-[10px] text-g-muted truncate">{m.ficha.contato}</div></div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {[[tx({ en: "Visits", pt: "Visitas", es: "Visitas", hi: "विज़िट" }), m.ficha.visitas ?? "—"], [tx({ en: "Spent", pt: "Gasto", es: "Gasto", hi: "खर्च" }), m.ficha.gasto == null ? "—" : dinheiro(m.ficha.gasto, m.ficha.tz, { casas: 0 })], [tx({ en: "No-shows", pt: "Faltas", es: "Ausencias", hi: "अनुपस्थित" }), m.ficha.faltas ?? "—"]].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-black/25 px-2 py-1.5"><div className="text-[9px] uppercase text-g-muted">{k}</div><div className="text-sm font-extrabold num text-g-word">{v}</div></div>
                    ))}
                  </div>
                  {m.ficha.alerta && <div className="mt-2 text-[11px] font-bold text-amber-200">⚠ {String(m.ficha.alerta)}</div>}
                  <div className="mt-2 flex gap-1.5">
                    <button onClick={() => enviar(`${t("q_book")} ${tx({ en: "for", pt: "para", es: "para", hi: "for" })} ${m.ficha.nome}`)} className={`${btnP} border-g-green/40 text-g-green`}>📅 {t("doBook")}</button>
                    <button onClick={() => { onNav?.("desk"); pedirAoBalcao({ aba: "clientes" }); }} className={`${btnP} border-white/15 text-g-word`}>{t("doCard")}</button>
                  </div>
                </div>
              );
              if (m.from === "card" && m.kind === "relatorio") {
                const r = m.r; const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "—");
                return (
                  <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] font-black uppercase tracking-wider text-g-muted">📊 {m.dias} {tx({ en: "days", pt: "dias", es: "días", hi: "दिन" })}</div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {[[tx({ en: "Visits", pt: "Visitas", es: "Visitas", hi: "विज़िट" }), r.visits, "#3FB4FF"], [tx({ en: "New", pt: "Novas", es: "Nuevas", hi: "नए" }), r.new_clients, "#D6C29A"], [tx({ en: "Rebooked", pt: "Remarcaram", es: "Reagendaron", hi: "दोबारा" }), pct(r.rebook?.rebooked || 0, r.rebook?.visits || 0), "#2FE39A"]].map(([k, v, c]) => (
                        <div key={k} className="rounded-xl bg-black/25 px-2 py-1.5"><div className="text-[9px] uppercase text-g-muted truncate">{k}</div><div className="text-sm font-extrabold num" style={{ color: c }}>{v}</div></div>
                      ))}
                    </div>
                    <div className="mt-2 space-y-1">
                      {(r.by_pro || []).slice(0, 4).map((p) => (
                        <div key={p.name} className="flex items-center gap-2 text-[11px]">
                          <span className="w-16 truncate text-g-word">{p.name}</span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-g-green" style={{ width: `${Math.min(100, p.utilization_pct || 0)}%` }} /></span>
                          <span className="w-10 text-right num text-g-muted">{p.utilization_pct == null ? "—" : `${Math.round(p.utilization_pct)}%`}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { onNav?.("desk"); pedirAoBalcao({ aba: "relatorios" }); }} className={`${btnP} mt-2 border-white/15 text-g-word`}>{tx({ en: "Full report →", pt: "Relatório completo →", es: "Informe completo →", hi: "पूरी रिपोर्ट →" })}</button>
                  </div>
                );
              }
              return (
                <div key={i} className={`flex items-end gap-2 ${m.from === "you" ? "justify-end" : "justify-start"}`}>
                  {m.from === "gui" && <img src={AVATAR_P} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />}
                  <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${m.from === "you" ? "rounded-br-md bg-g-gold/15 text-g-word border border-g-gold/30" : "rounded-bl-md bg-white/[0.06] text-g-light border border-white/10"}`}>{m.text}</div>
                </div>
              );
            })}
            {estado === "thinking" && <div className="flex items-center gap-2 pl-8 text-[11px] text-g-muted"><span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-g-muted animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />)}</span></div>}
            {pend && (
              <div className="rounded-2xl border-2 border-g-green/50 bg-g-green/[0.08] p-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-xl leading-none">{pend.texto.icone}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-g-word">{pend.texto.linha1}</div>
                    {pend.texto.linha2 && <div className="text-[12px] text-g-light">{pend.texto.linha2}</div>}
                    {pend.texto.linha3 && <div className="text-[12px] text-g-muted">{pend.texto.linha3}</div>}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => fechaPend(true)} className="rounded-full bg-g-green py-2.5 text-sm font-black text-[#0d1a14] active:scale-95">✓ {t("confirm")}</button>
                  <button onClick={() => fechaPend(false)} className="rounded-full border border-white/15 py-2.5 text-sm font-bold text-g-muted active:scale-95">{t("cancel")}</button>
                </div>
              </div>
            )}
            <div ref={fim} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); enviar(q); }} className="p-3 border-t border-white/10 flex gap-2 shrink-0 bg-black/20">
            <input ref={campo} id="gui-central-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={voz ? t("listening") : t("ph")} className="flex-1 min-w-0 rounded-full border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <button disabled={!q.trim()} aria-label="Send" className="grid h-11 w-11 place-items-center rounded-full bg-g-green text-[#0d1a14] text-lg font-black disabled:opacity-30">↑</button>
          </form>
        </div>
      )}
    </>
  );
}
