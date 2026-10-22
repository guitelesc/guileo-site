// functions/lib/mindbodyTempo.js — O RELÓGIO DO MINDBODY. Funções PURAS (sem rede, sem banco).
//
// O QUE A DOCUMENTAÇÃO DIZ (developers.mindbodyonline.com → "Handling Dates and Times"):
//   · toda data/hora sai no formato YYYY-MM-DDTHH:mm:ss;
//   · "the data is always passed in the business owner's local time";
//   · a boa prática é mandar SEM designador de UTC.
// E no OpenAPI (Availability): StartDateTime/EndDateTime "in the site local time zone" e
// BookableEndDateTime = "the time of day that the last appointment can start".
//
// O DEFEITO QUE ISTO CONSERTA: "2026-10-01T09:00:00" é 9h NA PAREDE DO SPA. `new Date()` num
// Worker lê isso como UTC → 5h da manhã em Nova York (4h no inverno). A agente falava o horário
// 4–5 horas errado e o espelho gravava o instante errado. Aqui a hora de parede só vira instante
// junto com um fuso IANA — e a conversão respeita o horário de verão nos dois sentidos.
//
// E A SEGUNDA METADE: bookableitems devolve JANELAS (profissional X está livre das 9h às 17h para
// a sessão Y), não horários. `expandirJanelas` transforma janela em inícios reserváveis.

const p2 = (n) => String(n).padStart(2, "0");

export function zonaValida(tz) {
  if (!tz || typeof tz !== "string") return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

// "YYYY-MM-DDTHH:mm[:ss[.fff]]" (com ou sem designador) → partes de PAREDE. O designador, se vier,
// é ignorado de propósito: a documentação diz que o valor é sempre a hora local do negócio.
export function partesLocais(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(s || "").trim());
  if (!m) return null;
  const p = { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
  if (p.mo < 1 || p.mo > 12 || p.d < 1 || p.d > 31 || p.h > 23 || p.mi > 59 || p.s > 59) return null;
  // 31 de fevereiro não existe: Date.UTC "arruma" em silêncio, então conferimos a volta.
  const chk = new Date(Date.UTC(p.y, p.mo - 1, p.d));
  if (chk.getUTCMonth() !== p.mo - 1 || chk.getUTCDate() !== p.d) return null;
  return p;
}

// Hora de parede tratada como se fosse UTC — só serve para ARITMÉTICA de parede (somar minutos,
// comparar dois horários do mesmo site). Nunca é um instante real.
export function paredeMs(s) {
  const p = typeof s === "string" ? partesLocais(s) : s;
  return p ? Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) : NaN;
}
export function paredeTexto(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
}

const _fmt = new Map();
function fmtDe(tz) {
  let f = _fmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    _fmt.set(tz, f);
  }
  return f;
}

// Instante real → hora de parede no fuso ("YYYY-MM-DDTHH:mm:ss"), o formato que o MindBody aceita.
export function instanteParaLocal(instante, tz) {
  const ms = typeof instante === "number" ? instante : Date.parse(instante);
  if (!Number.isFinite(ms) || !zonaValida(tz)) return null;
  const o = {};
  for (const part of fmtDe(tz).formatToParts(new Date(ms))) o[part.type] = part.value;
  return `${o.year}-${o.month}-${o.day}T${p2(Number(o.hour) % 24)}:${o.minute}:${o.second}`;
}

// Hora de parede + fuso → instante real.
//   { ok:true, ms, iso }                      caso normal
//   { ok:true, ms, iso, ambiguo:true }        a hora existe DUAS vezes (volta do horário de verão);
//                                              fica a primeira ocorrência, e quem chama sabe
//   { ok:false, motivo:"hora_inexistente" }   a hora NÃO existe (o relógio pulou: 02:30 em março)
//   { ok:false, motivo:"formato" | "fuso" }
export function localParaInstante(s, tz) {
  const p = partesLocais(s);
  if (!p) return { ok: false, motivo: "formato" };
  if (!zonaValida(tz)) return { ok: false, motivo: "fuso" };
  const alvo = paredeMs(p);
  const texto = paredeTexto(alvo);
  const vistos = new Set();
  // Os dois deslocamentos possíveis em volta da data (um dia antes e um depois cobrem a virada).
  for (const sonda of [alvo - 864e5, alvo + 864e5]) {
    const desloc = paredeMs(instanteParaLocal(sonda, tz)) - sonda;   // parede − real, em ms
    const cand = alvo - desloc;
    if (instanteParaLocal(cand, tz) === texto) vistos.add(cand);
  }
  if (!vistos.size) return { ok: false, motivo: "hora_inexistente" };
  const ms = Math.min(...vistos);
  return { ok: true, ms, iso: new Date(ms).toISOString(), ...(vistos.size > 1 ? { ambiguo: true } : {}) };
}

// "YYYY-MM-DD" de um instante, no fuso do site — é o que vai em request.startDate/endDate.
export function diaLocal(instante, tz) {
  const t = instanteParaLocal(instante, tz);
  return t ? t.slice(0, 10) : null;
}

// Soma minutos NA PAREDE ("09:00" + 60 = "10:00" do mesmo relógio). É o que o MindBody espera em
// EndDateTime: hora local, não instante.
export function somarMinutosLocais(s, min) {
  const ms = paredeMs(s);
  return Number.isFinite(ms) ? paredeTexto(ms + Math.round(Number(min) || 0) * 60000) : null;
}

// ActiveSessionTimes vem como lista de strings de hora-do-dia. Aceita "09:00:00", "9:00",
// "0001-01-01T09:00:00" → conjunto de minutos-do-dia. Entrada ilegível é ignorada (e contada).
export function horariosAtivos(lista) {
  const set = new Set(); let ilegiveis = 0;
  for (const bruto of Array.isArray(lista) ? lista : []) {
    const m = /(?:^|T|\s)(\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?\s*(am|pm)?\s*$/i.exec(String(bruto || "").trim());
    if (!m) { ilegiveis++; continue; }
    let h = +m[1]; const mi = +m[2];
    if (m[3]) { const pm = /pm/i.test(m[3]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    if (h > 23 || mi > 59) { ilegiveis++; continue; }
    set.add(h * 60 + mi);
  }
  return { minutos: set, ilegiveis };
}

/**
 * JANELAS → INÍCIOS RESERVÁVEIS.
 *
 * janelas: o array `Availabilities` de GET /appointment/bookableitems, como veio:
 *   { Staff:{Id,FirstName,LastName,DisplayName,Name}, SessionType:{Id,Name,DefaultTimeLength,StaffTimeLength},
 *     Location:{Id,Name}, StartDateTime, EndDateTime, BookableEndDateTime }
 *
 * opts:
 *   tz            fuso IANA do site (OBRIGATÓRIO — sem ele não existe instante)
 *   duracaoMin    reserva: a duração vem da janela (StaffTimeLength → DefaultTimeLength); este
 *                 valor só é usado quando a janela não trouxe nenhuma
 *   passoMin      de quanto em quanto tempo um início é oferecido (padrão 30) — usado quando o
 *                 site não informou os horários ativos
 *   minutosAtivos Set de minutos-do-dia (de horariosAtivos) — quando presente, só esses inícios
 *   agoraMs       descarta o que já passou (+ antecedenciaMin)
 *   limite        teto de itens (protege a resposta da ferramenta de voz)
 *
 * Regras do último início, nesta ordem:
 *   1) BookableEndDateTime, quando veio — "the last appointment can start" → INCLUSIVO;
 *   2) senão EndDateTime − duração.
 * Em qualquer caso o início tem que ser < EndDateTime.
 *
 * Devolve { ok:true, slots, descartadas } ou { ok:false, motivo }. `descartadas` conta janelas
 * ilegíveis — janela que não dá para ler NUNCA vira horário inventado.
 */
export function expandirJanelas(janelas, opts = {}) {
  const tz = opts.tz;
  if (!zonaValida(tz)) return { ok: false, motivo: "fuso" };
  if (!Array.isArray(janelas)) return { ok: false, motivo: "formato" };
  const passo = Math.max(5, Math.round(Number(opts.passoMin) || 30));
  const ativos = opts.minutosAtivos instanceof Set && opts.minutosAtivos.size ? opts.minutosAtivos : null;
  const corte = Number.isFinite(opts.agoraMs) ? opts.agoraMs + Math.max(0, Number(opts.antecedenciaMin) || 0) * 60000 : -Infinity;
  const limite = Math.max(1, Number(opts.limite) || 5000);
  const vistos = new Set(); const slots = []; let descartadas = 0;

  for (const j of janelas) {
    const ini = paredeMs(j && j.StartDateTime), fim = paredeMs(j && j.EndDateTime);
    const st = (j && j.SessionType) || {}, staff = (j && j.Staff) || {}, loc = (j && j.Location) || {};
    // a duração que vale é a do PRÓPRIO MindBody (por profissional, depois a padrão da sessão);
    // opts.duracaoMin só entra quando a janela não trouxe nenhuma das duas
    const dur = Math.round(Number(st.StaffTimeLength) || Number(st.DefaultTimeLength) || Number(opts.duracaoMin) || 0);
    if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim <= ini || dur <= 0 || staff.Id == null) { descartadas++; continue; }
    const ultimoPorFim = fim - dur * 60000;
    let bookEnd = paredeMs(j.BookableEndDateTime);
    // A doc chama BookableEndDateTime de "time of day". Se a DATA dele não cair dentro da janela
    // (ex.: veio com data-base 0001-01-01), vale só a hora-do-dia, aplicada ao dia em que a janela
    // termina. Continuando fora da janela, é ignorado e vale a regra 2.
    if (Number.isFinite(bookEnd) && (bookEnd < ini || bookEnd > fim)) {
      const doDia = ((bookEnd % 864e5) + 864e5) % 864e5;
      bookEnd = Math.floor(fim / 864e5) * 864e5 + doDia;
      if (bookEnd > fim) bookEnd -= 864e5;
      if (bookEnd < ini || bookEnd > fim) bookEnd = NaN;
    }
    const ultimo = Number.isFinite(bookEnd) ? Math.min(bookEnd, fim - 60000) : ultimoPorFim;
    if (ultimo < ini) continue;                       // janela menor que a sessão: legítimo, não é erro

    const candidatos = [];
    if (ativos) {
      // percorre os dias cobertos pela janela e pega cada horário ativo que cai dentro dela
      for (let dia = Math.floor(ini / 864e5) * 864e5; dia <= ultimo; dia += 864e5) {
        for (const min of ativos) { const t = dia + min * 60000; if (t >= ini && t <= ultimo) candidatos.push(t); }
      }
      candidatos.sort((a, b) => a - b);
    } else {
      for (let t = ini; t <= ultimo; t += passo * 60000) candidatos.push(t);
    }

    const nome = String(staff.DisplayName || staff.Name || [staff.FirstName, staff.LastName].filter(Boolean).join(" ") || "").trim();
    for (const t of candidatos) {
      const local = paredeTexto(t);
      const inst = localParaInstante(local, tz);
      if (!inst.ok) continue;                          // hora que não existe no relógio daquele dia
      if (inst.ms < corte) continue;
      const chave = `${inst.ms}|${staff.Id}|${loc.Id ?? ""}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      slots.push({
        start: inst.iso, local, duration_min: dur,
        pro: nome, staff_id: staff.Id,
        location: String(loc.Name || ""), mb_location_id: loc.Id ?? null,
        session_type_id: st.Id ?? null,
      });
    }
  }
  slots.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : String(a.staff_id).localeCompare(String(b.staff_id))));
  return { ok: true, slots: slots.slice(0, limite), total: slots.length, descartadas };
}

// Casa um INSTANTE pedido (ISO com offset/Z, ou ms) com um início disponível. Tolerância de 60s,
// igual à do resolveSlot. Sem casamento → null: nunca "o mais perto".
// ⚠️ Não aceita hora de parede sem fuso ("2026-10-01T09:00:00"): isso não é um instante, e
// Date.parse leria como UTC num Worker — o defeito que este arquivo existe para matar.
export function casarInstante(pedido, slots, toleranciaMs = 60000) {
  let ms;
  if (typeof pedido === "number") ms = pedido;
  else {
    const s = String(pedido || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return null;
    ms = Date.parse(s);
  }
  if (!Number.isFinite(ms)) return null;
  for (const s of Array.isArray(slots) ? slots : []) {
    const t = Date.parse(s && s.start);
    if (Number.isFinite(t) && Math.abs(t - ms) < toleranciaMs) return s;
  }
  return null;
}

// Dois horários de parede são o mesmo minuto? (comparação usada na idempotência do agendamento)
export function mesmoMinutoLocal(a, b) {
  const x = paredeMs(a), y = paredeMs(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.floor(x / 60000) === Math.floor(y / 60000);
}
