// functions/lib/adicionarServico.js
// ═════════════════════════════════════════════════════════════════════════════
// "ADICIONAR UM SERVIÇO A UM AGENDAMENTO QUE JÁ EXISTE" — a decisão pura (sem rede, sem banco).
//
// O caso do contrato do Natura (2026-10): a cliente tem uma massagem marcada e, na ligação, pede
// "dá pra fazer um facial junto?". O certo é encaixar o facial COLADO na massagem (logo antes ou
// logo depois), de preferência com a mesma profissional, senão com outra que faz facial — e só
// dizer "pronto" com o id da nova reserva na mão.
//
// Quem chama (functions/api/agent-schedule.js, op="add_service") busca os dados; este arquivo só
// DECIDE, para que a decisão inteira seja testável sem rede (adicionarServico.test.mjs).
//
// REGRAS QUE ESTE ARQUIVO GUARDA:
//  · o horário oferecido é SEMPRE um slot que o motor devolveu (biz_availability ou MindBody). O
//    motor já aplicou expediente, intervalos (buffers), capacidade e sala. Aqui só filtramos e
//    ordenamos — nunca inventamos um início fora da grade, que pularia essas travas;
//  · a pessoa não pode estar em dois lugares: o slot novo não pode cruzar o agendamento-pai nem
//    nenhum outro agendamento dela;
//  · "colado" = folga de 0 até `folgaMaxMin` (padrão 30). A grade do motor anda de duração em
//    duração a partir do começo do expediente, então o início exato no fim da massagem pode não
//    existir; uma folga pequena é o que a recepção faria na mão.
// ═════════════════════════════════════════════════════════════════════════════

export const FOLGA_PADRAO_MIN = 30;
export const FOLGA_TETO_MIN = 90;

const norm = (s) => (s || "").toString().trim().toLowerCase();
const ms = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : NaN; };

// ── 1) QUAL É O AGENDAMENTO-PAI ──────────────────────────────────────────────
// appts: o que biz_find_appointments devolve ({ id, ref, service, pro, location, start, status }).
// Devolve { ok:true, pai } | { ok:false, motivo: "nenhum" | "id_nao_achado" | "ambiguo", opcoes }.
// Nunca escolhe calado entre dois: quem tem massagem na terça E na sexta precisa dizer qual.
// `servicoNovo`: o serviço que vai ENTRAR. Um agendamento DESSE serviço não é candidato a pai quando
// há outro — sem isto, a retentativa da ElevenLabs (o facial já entrou) via "massagem + facial" e
// perguntava "em qual?" em vez de devolver a reserva que já existe (achado pelo teste B).
export function escolherAgendamentoPai(appts, { appointmentId = "", servicoExistente = "", ref = "", servicoNovo = "" } = {}) {
  const todos = (Array.isArray(appts) ? appts : []).filter((a) => a && a.id && a.status !== "cancelled" && Number.isFinite(ms(a.start)));
  if (!todos.length) return { ok: false, motivo: "nenhum", opcoes: [] };
  const nn = norm(servicoNovo);
  const ehNovo = (a) => !!nn && !!norm(a.service) && (norm(a.service) === nn || norm(a.service).includes(nn) || nn.includes(norm(a.service)));
  const semNovo = todos.filter((a) => !ehNovo(a));
  const lista = semNovo.length ? semNovo : todos;
  if (appointmentId) {
    const a = todos.find((x) => String(x.id) === String(appointmentId));
    return a ? { ok: true, pai: a } : { ok: false, motivo: "id_nao_achado", opcoes: lista };
  }
  if (ref) {
    const r = norm(ref).replace(/\s+/g, "");
    const a = todos.find((x) => norm(x.ref).replace(/\s+/g, "") === r);
    if (a) return { ok: true, pai: a };
  }
  if (servicoExistente) {
    const n = norm(servicoExistente);
    const casam = lista.filter((x) => norm(x.service) === n || (norm(x.service) && (norm(x.service).includes(n) || n.includes(norm(x.service)))));
    if (casam.length === 1) return { ok: true, pai: casam[0] };
    if (casam.length > 1) return { ok: false, motivo: "ambiguo", opcoes: casam };
  }
  if (lista.length === 1) return { ok: true, pai: lista[0] };
  return { ok: false, motivo: "ambiguo", opcoes: lista };
}

// ── 2) AS VAGAS COLADAS ──────────────────────────────────────────────────────
// slots: [{ start(ISO), pro, pro_id?, staff_id?, location?, location_id?, duration_min? }]
// pai:   { start(ISO), end(ISO) }
// opts:  { duracaoMin, posicao: "after"|"before"|"any", folgaMaxMin, mesmoPro: (slot)=>bool,
//          ocupados: [{start,end}] (outros agendamentos da pessoa) }
// Devolve { coladas: [...ordenadas], mesmoDia: [...não coladas, mesmo dia, sem choque, pela distância] }
// Ordem das coladas: mesma profissional antes de outra; dentro disso, a posição pedida (ou "depois"
// antes de "antes" quando a pessoa não disse — é o que spa faz: o add-on vem em seguida), e a
// menor folga primeiro.
export function vagasColadas(slots, pai, { duracaoMin, posicao = "any", folgaMaxMin = FOLGA_PADRAO_MIN, mesmoPro = () => false, ocupados = [], diaDe = null } = {}) {
  const ini = ms(pai && pai.start), fim = ms(pai && pai.end);
  const dur = Number(duracaoMin);
  if (!Number.isFinite(ini) || !Number.isFinite(fim) || !(dur > 0)) return { coladas: [], mesmoDia: [] };
  const folga = Math.min(Math.max(Number(folgaMaxMin) || FOLGA_PADRAO_MIN, 0), FOLGA_TETO_MIN) * 60000;
  const pos = ["after", "before"].includes(posicao) ? posicao : "any";
  const bloqueios = [{ s: ini, e: fim }, ...(Array.isArray(ocupados) ? ocupados : []).map((o) => ({ s: ms(o.start), e: ms(o.end) })).filter((o) => Number.isFinite(o.s) && Number.isFinite(o.e))];
  const cruza = (s, e) => bloqueios.some((b) => s < b.e && e > b.s);
  const mesmoDiaDoPai = (t) => (typeof diaDe === "function" ? diaDe(t) === diaDe(ini) : Math.abs(t - ini) < 18 * 3600000);

  const coladas = [], mesmoDia = [], vistos = new Set();
  for (const s of Array.isArray(slots) ? slots : []) {
    const st = ms(s && s.start);
    if (!Number.isFinite(st)) continue;
    const d = Number(s.duration_min) > 0 ? Number(s.duration_min) : dur;
    const en = st + d * 60000;
    if (cruza(st, en)) continue;                                   // a pessoa não está em dois lugares
    const chave = `${st}|${s.pro_id || s.staff_id || s.pro || ""}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const igual = !!mesmoPro(s);
    const depois = st >= fim && st - fim <= folga;
    const antes = en <= ini && ini - en <= folga;
    if ((depois && pos !== "before") || (antes && pos !== "after")) {
      const p = depois ? "after" : "before";
      coladas.push({ ...s, start: s.start, end: new Date(en).toISOString(), posicao: p, folga_min: Math.round((depois ? st - fim : ini - en) / 60000), mesmo_profissional: igual });
    } else if (mesmoDiaDoPai(st)) {
      const dist = st >= fim ? st - fim : ini - en;
      mesmoDia.push({ ...s, end: new Date(en).toISOString(), posicao: st >= fim ? "after" : "before", distancia_min: Math.round(dist / 60000), mesmo_profissional: igual });
    }
  }
  const pesoPos = (p) => (pos === "any" ? (p === "after" ? 0 : 1) : 0);
  coladas.sort((a, b) => (Number(b.mesmo_profissional) - Number(a.mesmo_profissional)) || (pesoPos(a.posicao) - pesoPos(b.posicao)) || (a.folga_min - b.folga_min) || (ms(a.start) - ms(b.start)));
  mesmoDia.sort((a, b) => (a.distancia_min - b.distancia_min) || (Number(b.mesmo_profissional) - Number(a.mesmo_profissional)));
  return { coladas, mesmoDia };
}

// Quantos dias de agenda pedir ao motor para enxergar o dia do agendamento-pai (biz_availability
// conta a partir de hoje). +1 de folga; teto para não pedir o ano inteiro.
export function diasAte(paiStartIso, agoraMs = Date.now(), teto = 60) {
  const t = ms(paiStartIso);
  if (!Number.isFinite(t)) return 14;
  return Math.min(Math.max(Math.ceil((t - agoraMs) / 864e5) + 1, 1), teto);
}

// ── 3) O QUE A AGENTE FALA ───────────────────────────────────────────────────
const L2 = (lang) => { const l = (lang || "en").toString().slice(0, 2); return ["pt", "es", "hi"].includes(l) ? l : "en"; };

// "Massagem + Facial" na ordem do relógio — é o rótulo do serviço no comprovante.
export function rotuloServicos(itens) {
  return (Array.isArray(itens) ? itens : []).slice().sort((a, b) => ms(a.start) - ms(b.start)).map((i) => i.service).filter(Boolean).join(" + ");
}
// "qui., 9 de out., 14:00 (Massagem) · 15:00 (Facial)" — o "quando" do comprovante cobre os dois.
// fmt(iso) = data+hora; hora(iso) = só a hora (no mesmo fuso/idioma).
export function rotuloQuando(itens, fmt, hora) {
  const o = (Array.isArray(itens) ? itens : []).slice().sort((a, b) => ms(a.start) - ms(b.start));
  if (!o.length) return "";
  return o.map((i, k) => `${k === 0 ? fmt(i.start) : hora(i.start)} (${i.service})`).join(" · ");
}

export function addonFeitoMsg(lang, { addon, pai, posicao, quando, pro, refTxt }) {
  const L = L2(lang);
  const com = pro ? ({ pt: ` com ${pro}`, es: ` con ${pro}`, hi: ` ${pro} के साथ` }[L] || ` with ${pro}`) : "";
  const r = refTxt || "";
  if (L === "pt") return `Pronto — ${addon} adicionado ${posicao === "before" ? "logo antes" : "logo depois"} da sua ${pai}, ${quando}${com}.${r} Você vai receber a confirmação com os dois. Mais alguma coisa?`;
  if (L === "es") return `Listo — agregué ${addon} ${posicao === "before" ? "justo antes" : "justo después"} de su ${pai}, ${quando}${com}.${r} Le llegará la confirmación con los dos. ¿Algo más?`;
  if (L === "hi") return `हो गया — ${addon} आपकी ${pai} के ${posicao === "before" ? "ठीक पहले" : "ठीक बाद"} जोड़ दिया, ${quando}${com}।${r} आपको दोनों की पुष्टि मिल जाएगी। और कुछ?`;
  return `Done — I added ${addon} right ${posicao === "before" ? "before" : "after"} your ${pai}, ${quando}${com}.${r} You'll get one confirmation with both. Anything else?`;
}

export function addonSemColadoMsg(lang, { addon, pai, dia, alts }) {
  const L = L2(lang);
  if (L === "pt") return alts ? `Não tenho ${addon} colado na sua ${pai} em ${dia}. O mais perto nesse dia é ${alts}. Quer um desses, ou prefere outro dia?` : `Não tenho horário de ${addon} em ${dia}, nem perto da sua ${pai}. Quer que eu veja outro dia?`;
  if (L === "es") return alts ? `No tengo ${addon} pegado a su ${pai} el ${dia}. Lo más cercano ese día es ${alts}. ¿Le sirve alguno, o prefiere otro día?` : `No tengo horario de ${addon} el ${dia}, ni cerca de su ${pai}. ¿Reviso otro día?`;
  if (L === "hi") return alts ? `${dia} को आपकी ${pai} के ठीक पहले या बाद ${addon} की जगह नहीं है। उस दिन सबसे नज़दीकी: ${alts}। इनमें से कोई, या कोई और दिन?` : `${dia} को ${addon} के लिए कोई जगह नहीं है। क्या कोई और दिन देखूँ?`;
  return alts ? `There's no opening for ${addon} right before or after your ${pai} on ${dia}. The closest that day: ${alts}. Want one of those, or another day?` : `I don't see any opening for ${addon} on ${dia}, even near your ${pai}. Want me to check another day?`;
}

export function addonQualAgendamentoMsg(lang, { addon, lista }) {
  const L = L2(lang);
  if (L === "pt") return `Vejo mais de um agendamento: ${lista}. Em qual deles eu adiciono ${addon}?`;
  if (L === "es") return `Veo más de una cita: ${lista}. ¿A cuál le agrego ${addon}?`;
  if (L === "hi") return `मुझे एक से ज़्यादा अपॉइंटमेंट दिख रहे हैं: ${lista}। ${addon} किसमें जोड़ूँ?`;
  return `I see more than one appointment: ${lista}. Which one should I add ${addon} to?`;
}

export function addonSemAgendamentoMsg(lang, addon) {
  const L = L2(lang);
  if (L === "pt") return `Não encontrei nenhum agendamento futuro nesse contato. Quer que eu marque ${addon} como um horário novo?`;
  if (L === "es") return `No encontré ninguna cita próxima con ese contacto. ¿Le agendo ${addon} como una cita nueva?`;
  if (L === "hi") return `इस संपर्क पर कोई आने वाला अपॉइंटमेंट नहीं मिला। क्या ${addon} को नए अपॉइंटमेंट के रूप में बुक करूँ?`;
  return `I don't see an upcoming appointment under that contact. Want me to book ${addon} as a new appointment?`;
}
