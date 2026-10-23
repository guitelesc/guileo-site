// AGENDAR — /agendar/:slug
//
// A página que a CLIENTE do negócio abre pelo link (ex.: a cliente da Natura Spa marcando a
// massagem dela). Não é a Central do dono: fundo claro, calmo, sem nada da Guileo no caminho.
//
// Regras que valem aqui:
//   • A agenda é a do motor da casa, via /api/vitrine-agenda (menu → horarios → marcar).
//     O tenant nunca sai daqui: só o slug, que já está na URL.
//   • "Agendado" SÓ com o id que o servidor devolveu. Sem id, não há comprovante — e a tela
//     não finge que há.
//   • call_to_book (a recepção tirou desta cliente o agendamento online) não é erro: é um
//     convite calmo para ligar.
//   • Nada de outros negócios, nada de concorrente, nada de "powered by".
//   • Preço e duração vêm do site público do negócio (/api/client-site), quando ele existe.
//     Sem esse dado, a tela simplesmente não mostra preço — nunca inventa um.
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

const T = {
  en: {
    book: "Book an appointment", chooseService: "Choose a service", chooseTime: "Choose a day and time",
    yourDetails: "Your details", review: "Review and confirm", min: "min", onRequest: "Price on request",
    loading: "Loading…", noServices: "Online booking isn't available right now. Please call us to book.",
    loadErr: "We couldn't load the schedule. Please try again in a moment.", retry: "Try again",
    notFound: "This booking page isn't available.", noSlots: "No open times for this service right now. Please call us or try another service.",
    nextAvail: "Showing the next available times.", noSlotsDay: "No open times on this day.",
    name: "Full name", phone: "Mobile phone", email: "Email (optional)", consent: "We'll text or email you about this appointment (confirmation and reminders).", offers: "Yes, you may text or call me about offers (optional).",
    continue: "Continue", back: "Back", confirm: "Confirm booking", booking: "Booking…",
    taken: "That time was just taken. Please pick another one.", bookErr: "We couldn't complete the booking. Please try again.",
    callTitle: "Please call us to book", callBody: "For this appointment, our front desk will book it with you personally.",
    callNow: "Call", doneTitle: "You're booked", ref: "Confirmation", addCal: "Add to calendar",
    another: "Book another appointment", service: "Service", when: "When", with: "with",
    needName: "Please enter your name.", needPhone: "Please enter a valid phone number.", step: "Step",
    depTitle: "Your time is reserved", depBody: (v) => `To secure it, pay the ${v} deposit.`, depBtn: (v) => `Pay ${v} deposit`,
    depPolicy: "The deposit is deducted from the price of the service.",
    depWindow: (h) => `Need to change or cancel? Please let us know at least ${h} hours before.`,
    withWhom: "With whom?", anyone: "No preference", anyoneSub: "first available", pro: "With",
    anyoneReview: "No preference — the first professional free at this time",
    bookingWith: (n) => `Booking with ${n}`, seeAll: "See everyone", onlyWith: (n) => `With ${n}`,
    proGone: "This professional isn't available for online booking. Choose someone else or “No preference”.",
  },
  pt: {
    book: "Agende seu horário", chooseService: "Escolha o serviço", chooseTime: "Escolha o dia e o horário",
    yourDetails: "Seus dados", review: "Revise e confirme", min: "min", onRequest: "Preço sob consulta",
    loading: "Carregando…", noServices: "O agendamento online não está disponível agora. Ligue para nós para agendar.",
    loadErr: "Não conseguimos carregar a agenda. Tente de novo em instantes.", retry: "Tentar de novo",
    notFound: "Esta página de agendamento não está disponível.", noSlots: "Sem horários livres para este serviço agora. Ligue para nós ou escolha outro serviço.",
    nextAvail: "Mostrando os próximos horários livres.", noSlotsDay: "Sem horários livres neste dia.",
    name: "Nome completo", phone: "Celular", email: "E-mail (opcional)", consent: "Vamos te mandar mensagem ou e-mail sobre este horário (confirmação e lembretes).", offers: "Sim, podem me mandar ofertas por SMS ou ligação (opcional).",
    continue: "Continuar", back: "Voltar", confirm: "Confirmar agendamento", booking: "Agendando…",
    taken: "Esse horário acabou de ser ocupado. Escolha outro, por favor.", bookErr: "Não conseguimos concluir o agendamento. Tente de novo.",
    callTitle: "Ligue para nós para agendar", callBody: "Para este atendimento, a nossa recepção agenda com você pessoalmente.",
    callNow: "Ligar", doneTitle: "Horário confirmado", ref: "Comprovante", addCal: "Adicionar ao calendário",
    another: "Agendar outro horário", service: "Serviço", when: "Quando", with: "com",
    needName: "Digite seu nome.", needPhone: "Digite um telefone válido.", step: "Etapa",
    depTitle: "Seu horário está reservado", depBody: (v) => `Para garantir, pague o sinal de ${v}.`, depBtn: (v) => `Pagar sinal de ${v}`,
    depPolicy: "O sinal é descontado do valor do serviço.",
    depWindow: (h) => `Precisa remarcar ou cancelar? Avise com pelo menos ${h} horas de antecedência.`,
    withWhom: "Com quem?", anyone: "Sem preferência", anyoneSub: "a primeira livre", pro: "Com",
    anyoneReview: "Sem preferência — a primeira profissional livre nesse horário",
    bookingWith: (n) => `Agendando com ${n}`, seeAll: "Ver toda a equipe", onlyWith: (n) => `Com ${n}`,
    proGone: "Esta profissional não está disponível para agendamento online. Escolha outra pessoa ou “Sem preferência”.",
  },
  es: {
    book: "Reserva tu cita", chooseService: "Elige el servicio", chooseTime: "Elige el día y la hora",
    yourDetails: "Tus datos", review: "Revisa y confirma", min: "min", onRequest: "Precio a consultar",
    loading: "Cargando…", noServices: "La reserva en línea no está disponible ahora. Llámanos para reservar.",
    loadErr: "No pudimos cargar la agenda. Inténtalo de nuevo en un momento.", retry: "Reintentar",
    notFound: "Esta página de reservas no está disponible.", noSlots: "No hay horarios libres para este servicio ahora. Llámanos o elige otro servicio.",
    nextAvail: "Mostrando los próximos horarios libres.", noSlotsDay: "No hay horarios libres este día.",
    name: "Nombre completo", phone: "Celular", email: "Correo (opcional)", consent: "Te enviaremos mensajes o correos sobre esta cita (confirmación y recordatorios).", offers: "Sí, pueden enviarme ofertas por SMS o llamada (opcional).",
    continue: "Continuar", back: "Atrás", confirm: "Confirmar reserva", booking: "Reservando…",
    taken: "Ese horario se acaba de ocupar. Elige otro, por favor.", bookErr: "No pudimos completar la reserva. Inténtalo de nuevo.",
    callTitle: "Llámanos para reservar", callBody: "Para esta cita, nuestra recepción la reserva contigo personalmente.",
    callNow: "Llamar", doneTitle: "Cita confirmada", ref: "Comprobante", addCal: "Añadir al calendario",
    another: "Reservar otra cita", service: "Servicio", when: "Cuándo", with: "con",
    needName: "Escribe tu nombre.", needPhone: "Escribe un teléfono válido.", step: "Paso",
    depTitle: "Tu horario está reservado", depBody: (v) => `Para asegurarlo, paga el depósito de ${v}.`, depBtn: (v) => `Pagar depósito de ${v}`,
    depPolicy: "El depósito se descuenta del precio del servicio.",
    depWindow: (h) => `¿Necesitas cambiar o cancelar? Avísanos con al menos ${h} horas de anticipación.`,
    withWhom: "¿Con quién?", anyone: "Sin preferencia", anyoneSub: "la primera disponible", pro: "Con",
    anyoneReview: "Sin preferencia — la primera profesional libre a esa hora",
    bookingWith: (n) => `Reservando con ${n}`, seeAll: "Ver todo el equipo", onlyWith: (n) => `Con ${n}`,
    proGone: "Esta profesional no está disponible para reservas en línea. Elige a otra persona o “Sin preferencia”.",
  },
};
const LOCALE = { en: "en-US", pt: "pt-BR", es: "es-ES" };
const detectLang = () => {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q && T[q]) return q;
    const l = (navigator.language || "en").slice(0, 2).toLowerCase();
    return T[l] ? l : "en";
  } catch { return "en"; }
};

const C = {
  bg: "#F7F4EF", card: "#FFFFFF", ink: "#2B2A27", soft: "#6E6A62", line: "#E7E1D7",
  accent: "#5E7A64", accentSoft: "#EEF2EC", warn: "#8A6D3B", warnSoft: "#F6EFE2",
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";

const prettySlug = (slug) => (slug || "").split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const money = (cents) => {
  const c = Number(cents);
  if (!Number.isFinite(c) || c <= 0) return "";
  const d = c / 100;
  return "$" + (Number.isInteger(d) ? d : d.toFixed(2));
};
const norm = (s) => (s || "").toString().trim().toLowerCase();
const dayKey = (date, tz) => {
  // YYYY-MM-DD do dia do horário, no fuso do negócio quando conhecido
  try {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz || undefined, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    return p;
  } catch { return date.toISOString().slice(0, 10); }
};

async function post(body) {
  const r = await fetch("/api/vitrine-agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => null);
  return { status: r.status, d };
}

// .ics gerado no navegador — sem servidor, sem dado saindo daqui.
function icsFile({ title, startIso, minutes, location, uid }) {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + (minutes || 60) * 60000);
  const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s) => (s || "").toString().replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Booking//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${esc(uid)}@booking`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${esc(title)}`, location ? `LOCATION:${esc(location)}` : "", "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export default function Agendar() {
  const { slug: rawSlug } = useParams();
  const slug = (rawSlug || "").toLowerCase();
  const [lang, setLang] = useState(detectLang);
  const t = T[lang];
  const loc = LOCALE[lang];

  const [site, setSite] = useState(null);          // enriquecimento opcional (nome, preço, duração, telefone)
  const [menuState, setMenuState] = useState("loading"); // loading | ok | empty | error | 404
  const [services, setServices] = useState([]);
  const [step, setStep] = useState(1);
  const [svc, setSvc] = useState(null);
  const [slotsState, setSlotsState] = useState("idle"); // idle | loading | ok | error
  const [slots, setSlots] = useState([]);
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState(null);
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [emailCli, setEmailCli] = useState("");
  const [ofertas, setOfertas] = useState(false);   // CR-11: permissão para ofertas — desmarcada por padrão, nunca presumida
  const [formErr, setFormErr] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState(null);       // { id, quando, deposito? } — só com id do servidor
  const [callToBook, setCallToBook] = useState(false);
  const [reload, setReload] = useState(0);
  // ESCOLHER A PROFISSIONAL (desk_v16): `equipe` = quem o site pode mostrar; pro = id escolhido ("" = sem preferência).
  // `escolha` vem dos horários: só existe quando o motor diz de quem é cada vaga (agenda da casa).
  const [equipe, setEquipe] = useState([]);
  const [pro, setPro] = useState("");
  const [escolha, setEscolha] = useState(false);
  const [proLink, setProLink] = useState("");      // ?pro= reconhecido → "Agendando com …" e só os serviços dela

  useEffect(() => { try { document.documentElement.lang = lang; } catch { /* sem DOM */ } }, [lang]);

  // site público do negócio (best-effort: só enriquece, nunca bloqueia)
  useEffect(() => {
    let alive = true;
    fetch(`/api/client-site?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && d.found) setSite(d); })
      .catch(() => { /* sem site publicado: segue só com a agenda */ });
    return () => { alive = false; };
  }, [slug]);

  // menu real do motor
  useEffect(() => {
    let alive = true;
    post({ slug, op: "menu" })
      .then(({ status, d }) => {
        if (!alive) return;
        if (status === 404 || status === 400) { setMenuState("404"); return; }
        if (!d || d.ok !== true || !Array.isArray(d.servicos)) { setMenuState("error"); return; }
        // `precos` (2026-10-05) traz nome + preço + duração + categoria; `servicos` (só nomes) fica de reserva.
        const base = Array.isArray(d.precos) && d.precos.length ? d.precos : d.servicos;
        const list = base.map((s) => (typeof s === "string" ? { name: s } : s)).filter((s) => s && s.name);
        setServices(list);
        const eq = Array.isArray(d.equipe) ? d.equipe.filter((p) => p && p.id && p.name) : [];
        setEquipe(eq);
        // ?pro=<id ou nome> — o link de UMA profissional que a dona manda. Não achou (ou ela não marca pelo site): segue normal, com aviso.
        try {
          const alvo = (new URLSearchParams(window.location.search).get("pro") || "").trim();
          if (alvo) {
            const slugN = (x) => norm(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const achada = eq.find((p) => String(p.id) === alvo) || eq.find((p) => slugN(p.name) === slugN(alvo));
            if (achada) { setPro(achada.id); setProLink(achada.id); } else setNotice("pro_gone");
          }
        } catch { /* sem parâmetro */ }
        setMenuState(list.length ? "ok" : "empty");
      })
      .catch(() => { if (alive) setMenuState("error"); });
    return () => { alive = false; };
  }, [slug, reload]);

  const bizName = (site && site.business_name) || prettySlug(slug);
  const tz = useMemo(() => ((site && site.locations) || []).map((l) => l && l.tz).find(Boolean) || undefined, [site]);
  const phone = useMemo(() => ((site && site.locations) || []).map((l) => l && l.phone).find(Boolean) || "", [site]);
  const address = useMemo(() => ((site && site.locations) || []).map((l) => l && (l.address || l.name)).find(Boolean) || "", [site]);
  const logo = site && site.config && site.config.logo_url;
  // a aba do navegador mostra o NEGÓCIO, não a Guileo
  useEffect(() => { try { document.title = `${bizName} · ${t.book}`; } catch { /* sem DOM */ } }, [bizName, t]);

  // junta o que o motor agenda com preço/duração/categoria do site público (por nome)
  const enriched = useMemo(() => {
    const extra = new Map(((site && site.services) || []).map((s) => [norm(s.name), s]));
    const known = extra.size > 0;
    return services.map((s) => {
      const e = extra.get(norm(s.name)) || {};
      const cents = s.price_cents ?? e.price_cents;
      return {
        name: s.name,
        minutes: Number(s.duration_min || e.duration_min) || 0,
        category: (s.category || e.category || e.categoria || "").toString().trim(),
        price: money(cents),
        priceKnown: known || s.price_cents !== undefined,
        description: (e.description || e.descricao || "").toString(),
      };
    });
  }, [services, site]);
  // ?local= vem do botão "Book at <unidade>" do site do negócio. Serviço com o nome da unidade depois
  // do "·" pertence àquela unidade; serviço sem unidade no nome aparece em todas.
  const local = useMemo(() => { try { return (new URLSearchParams(window.location.search).get("local") || "").toLowerCase(); } catch { return ""; } }, []);
  const daUnidade = (nome) => {
    if (!local) return true;
    const sufixo = (String(nome).split("·")[1] || "").toLowerCase();
    if (!sufixo.trim()) return true;
    if (local === "astoria") return /astoria/.test(sufixo);
    if (local === "med") return /med/.test(sufixo);
    if (local === "ues") return /ues/.test(sufixo) && !/med/.test(sufixo);
    return sufixo.includes(local);
  };
  const groups = useMemo(() => {
    const m = new Map();
    const dela = proLink ? equipe.find((p) => p.id === proLink) : null;
    enriched.filter((s) => daUnidade(s.name) && (!dela || (dela.services || []).some((x) => norm(x.name) === norm(s.name)))).forEach((s) => { const k = s.category || ""; if (!m.has(k)) m.set(k, []); m.get(k).push(s); });
    return [...m.entries()];
  }, [enriched, local, proLink, equipe]); // eslint-disable-line react-hooks/exhaustive-deps

  // O servidor devolve `dias` (dias com vaga, até 30) e, pedindo `dia`, TODAS as vagas daquele dia.
  const [diasComVaga, setDiasComVaga] = useState(() => new Set());
  const [diasLidos, setDiasLidos] = useState(() => new Set());
  const loadSlots = (service, quem = pro) => {
    setSlotsState("loading"); setSlots([]); setSlot(null); setDay(""); setDiasComVaga(new Set()); setDiasLidos(new Set());
    return post({ slug, op: "horarios", servico: service.name, ...(quem ? { pro_id: quem } : {}) })
      .then(({ d }) => {
        // a profissional saiu do site (ou o id não vale mais): volta para "sem preferência", com aviso
        if (d && d.error === "pro_not_found" && quem) { setPro(""); setNotice("pro_gone"); loadSlots(service, ""); return; }
        if (!d || d.ok !== true || !Array.isArray(d.slots)) { setSlotsState("error"); return; }
        setEscolha(d.escolha === true);
        const valid = d.slots.filter((s) => s && s.start && !Number.isNaN(new Date(s.start).getTime()));
        setSlots(valid);
        if (Array.isArray(d.dias)) setDiasComVaga(new Set(d.dias));
        setSlotsState("ok");
        if (valid.length) {
          // o 1º dia pode ter mais vagas que as 12 da primeira leitura: completa aquele dia inteiro
          const primeiro = dayKey(new Date(valid[0].start), tz);
          setDay(primeiro); setDiasLidos(new Set([primeiro]));
          post({ slug, op: "horarios", servico: service.name, dia: primeiro, ...(quem ? { pro_id: quem } : {}) }).then(({ d: d2 }) => {
            if (!d2 || d2.ok !== true || !Array.isArray(d2.slots)) return;
            setSlots((atual) => { const vistos = new Set(atual.map((x) => `${x.start}|${x.pro || ""}`)); return [...atual, ...d2.slots.filter((x) => x && x.start && !vistos.has(`${x.start}|${x.pro || ""}`))]; });
          }).catch(() => {});
        }
      })
      .catch(() => setSlotsState("error"));
  };
  const abrirDia = (key) => {
    setDay(key); setSlot(null);
    if (!svc || diasLidos.has(key)) return;
    setDiasLidos((x) => new Set(x).add(key));
    post({ slug, op: "horarios", servico: svc.name, dia: key, ...(pro ? { pro_id: pro } : {}) }).then(({ d }) => {
      if (!d || d.ok !== true || !Array.isArray(d.slots)) return;
      const novos = d.slots.filter((s) => s && s.start && !Number.isNaN(new Date(s.start).getTime()));
      setSlots((atual) => { const vistos = new Set(atual.map((s) => `${s.start}|${s.pro || ""}`)); return [...atual, ...novos.filter((s) => !vistos.has(`${s.start}|${s.pro || ""}`))]; });
    }).catch(() => {});
  };

  // quem faz o serviço escolhido (pelo nome do serviço, como o resto da página)
  const equipeDoSvc = (s) => (s ? equipe.filter((p) => (p.services || []).some((x) => norm(x.name) === norm(s.name))) : []);
  const pickService = (s) => {
    // a escolhida não faz este serviço (só acontece fora do link dela): volta para "sem preferência"
    const quem = pro && equipeDoSvc(s).some((p) => p.id === pro) ? pro : "";
    if (pro && !quem) setPro("");
    setSvc(s); setNotice((n) => (n === "pro_gone" ? n : "")); setStep(2); loadSlots(s, quem);
  };
  const escolherPro = (id) => { if (id === pro) return; setPro(id); setNotice(""); if (svc) loadSlots(svc, id); };
  const proAtual = equipe.find((p) => p.id === pro) || null;
  const minDela = (p, s) => { const x = p && s ? (p.services || []).find((y) => norm(y.name) === norm(s.name)) : null; return x ? Number(x.duration_min) || 0 : 0; };
  // "MARCAR DE NOVO" (2026-10-05): a área da cliente (/minha-conta) manda ?servico=<nome>. Achando o serviço
  // no menu real, a página já abre nos horários dele — uma vez só; sem achar, segue a lista normal.
  const preSelecionado = useRef(false);
  useEffect(() => {
    if (preSelecionado.current || menuState !== "ok") return;
    let alvo = "";
    try { alvo = (new URLSearchParams(window.location.search).get("servico") || "").trim().toLowerCase(); } catch { /* sem parâmetro */ }
    preSelecionado.current = true;
    if (!alvo) return;
    const achado = services.find((x) => String(x.name || "").trim().toLowerCase() === alvo);
    if (achado) pickService(achado);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuState, services]);

  const days = useMemo(() => {
    const out = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
      out.push({ key: dayKey(d, tz), date: d });
    }
    return out;
  }, [tz]);
  const slotsByDay = useMemo(() => {
    const m = new Map();
    slots.forEach((s) => { const k = dayKey(new Date(s.start), tz); if (!m.has(k)) m.set(k, []); m.get(k).push(s); });
    return m;
  }, [slots, tz]);

  const fmtTime = (iso) => new Date(iso).toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit", timeZone: tz });
  const fmtFull = (iso) => new Date(iso).toLocaleString(loc, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });

  const goDetails = () => {
    setFormErr("");
    if (nome.trim().length < 2) { setFormErr(t.needName); return; }
    if (tel.replace(/\D/g, "").length < 7) { setFormErr(t.needPhone); return; }
    setStep(4);
  };

  const confirm = async () => {
    if (sending || !svc || !slot) return;
    setSending(true); setNotice("");
    try {
      const { status, d } = await post({ slug, op: "marcar", consentimento: { sms: ofertas, call: ofertas }, servico: svc.name, quando: slot.start, ...(pro ? { pro_id: pro } : {}), nome: nome.trim(), telefone: tel.trim(), lang, ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCli.trim()) ? { email: emailCli.trim() } : {}) });
      if (d && d.error === "call_to_book") { setCallToBook(true); return; }
      // 🚨 comprovante ou nada
      // SINAL (2026-10-05): `deposito` só vem quando o servidor abriu o link no Stripe do negócio. Sem ele,
      // a confirmação é a de sempre — nenhuma etapa de pagamento inventada.
      const dep = d && d.ok === true && d.deposito && /^https:\/\//.test(String(d.deposito.url || "")) && Number(d.deposito.cents) > 0
        ? { url: String(d.deposito.url), cents: Number(d.deposito.cents), janelaH: Number(d.deposito.janela_h) > 0 ? Math.round(Number(d.deposito.janela_h)) : 0 } : null;
      if (d && d.error === "pro_not_found") { setPro(""); setNotice("pro_gone"); setStep(2); loadSlots(svc, ""); return; }
      if (d && d.ok === true && d.id) { setResult({ id: String(d.id), quando: d.quando || slot.start, deposito: dep, profissional: d.profissional || proAtual?.name || "" }); return; }
      if (d && Array.isArray(d.slots) && d.slots.length) {
        const valid = d.slots.filter((s) => s && s.start && !Number.isNaN(new Date(s.start).getTime()));
        setSlots(valid); setSlot(null);
        if (valid.length) setDay(dayKey(new Date(valid[0].start), tz));
        setNotice(t.taken); setStep(2); return;
      }
      // 409 sem lista nova = o horário saiu na hora (com a profissional escolhida, ninguém "cai" noutra): relê os dela
      if (status === 409) { setStep(2); loadSlots(svc, pro).then(() => setNotice(t.taken)); return; }
      setNotice(t.bookErr);
    } catch { setNotice(t.bookErr); }
    finally { setSending(false); }
  };

  const downloadIcs = () => {
    if (!result || !svc) return;
    const text = icsFile({ title: `${svc.name} — ${bizName}`, startIso: result.quando, minutes: minDela(proAtual, svc) || svc.minutes || 60, location: address, uid: result.id });
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "appointment.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const restart = () => { setResult(null); setCallToBook(false); setSvc(null); setSlot(null); setStep(1); setNotice(""); setPro(proLink || ""); };

  // ── render helpers ────────────────────────────────────────────────────────────────────────
  const S = {
    page: { minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: FONT, WebkitFontSmoothing: "antialiased" },
    wrap: { maxWidth: 560, margin: "0 auto", padding: "20px 16px 56px" },
    card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, boxShadow: "0 1px 2px rgba(43,42,39,.04)" },
    h1: { fontFamily: SERIF, fontWeight: 500, fontSize: 30, letterSpacing: "-0.01em", margin: "6px 0 2px", lineHeight: 1.15 },
    h2: { fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: C.soft, fontWeight: 600, margin: "0 0 14px" },
    btn: { width: "100%", background: C.accent, color: "#fff", border: 0, borderRadius: 14, padding: "15px 18px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: FONT },
    ghost: { background: "transparent", border: 0, color: C.soft, fontSize: 15, padding: "10px 4px", cursor: "pointer", fontFamily: FONT },
    input: { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 14px", fontSize: 16, background: "#FCFBF9", color: C.ink, fontFamily: FONT, outline: "none" },
    label: { display: "block", fontSize: 14, color: C.soft, margin: "0 0 6px" },
    muted: { color: C.soft, fontSize: 14, lineHeight: 1.5 },
  };

  const LangSwitch = (
    <div style={{ display: "flex", gap: 2, background: "#EFEAE2", borderRadius: 999, padding: 3 }} role="group" aria-label="Language">
      {["en", "pt", "es"].map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
          style={{ border: 0, borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
            background: lang === l ? "#fff" : "transparent", color: lang === l ? C.ink : C.soft, boxShadow: lang === l ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );

  const Header = (
    <header style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        {logo ? <img src={logo} alt={bizName} style={{ height: 36, maxWidth: 160, objectFit: "contain" }} /> : <span />}
        {LangSwitch}
      </div>
      <h1 style={S.h1}>{bizName}</h1>
      <div style={S.muted}>{t.book}</div>
    </header>
  );

  const Progress = (
    <div style={{ display: "flex", gap: 6, margin: "0 0 18px" }} aria-label={`${t.step} ${step}/4`}>
      {[1, 2, 3, 4].map((n) => (
        <div key={n} style={{ flex: 1, height: 3, borderRadius: 3, background: n <= step ? C.accent : C.line, transition: "background .2s" }} />
      ))}
    </div>
  );

  const callBox = (title, text) => (
    <div style={{ ...S.card, textAlign: "center", padding: "28px 20px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 22, marginBottom: 8 }}>{title}</div>
      <p style={{ ...S.muted, margin: "0 0 18px" }}>{text}</p>
      {phone ? <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} style={{ ...S.btn, display: "block", textDecoration: "none", boxSizing: "border-box" }}>{t.callNow} {phone}</a> : null}
    </div>
  );

  let body;
  if (result) {
    const dep = result.deposito;
    const valor = dep ? money(dep.cents) : "";
    body = (
      <div style={{ ...S.card, padding: "28px 22px" }}>
        <div style={{ width: 44, height: 44, borderRadius: 999, background: C.accentSoft, color: C.accent, display: "grid", placeItems: "center", fontSize: 22, marginBottom: 14 }} aria-hidden>✓</div>
        <div style={{ fontFamily: SERIF, fontSize: 26, marginBottom: 14 }}>{dep ? t.depTitle : t.doneTitle}</div>
        {dep ? (
          <div style={{ background: C.warnSoft, borderRadius: 14, padding: "16px 16px 14px", margin: "0 0 18px" }}>
            <p style={{ margin: "0 0 14px", fontSize: 16, lineHeight: 1.5, color: C.ink, fontWeight: 500 }}>{t.depBody(valor)}</p>
            {/* mesma aba: o Stripe devolve a cliente para /api/sinal-pago, que confere e tem "voltar para o agendamento" */}
            <a href={dep.url} rel="noopener noreferrer" style={{ ...S.btn, display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box", fontSize: 17, padding: "17px 18px" }}>{t.depBtn(valor)}</a>
            <p style={{ ...S.muted, fontSize: 13, margin: "12px 0 0" }}>{t.depPolicy}{dep.janelaH ? ` ${t.depWindow(dep.janelaH)}` : ""}</p>
          </div>
        ) : null}
        <Row k={t.service} v={svc && svc.name} />
        <Row k={t.when} v={fmtFull(result.quando)} />
        {result.profissional ? <Row k={t.pro} v={result.profissional} /> : null}
        <Row k={t.ref} v={<code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{result.id}</code>} />
        {address ? <Row k="" v={address} /> : null}
        <button type="button" onClick={downloadIcs} style={dep ? { ...S.btn, marginTop: 20, background: "transparent", color: C.accent, border: `1px solid ${C.accent}` } : { ...S.btn, marginTop: 20 }}>{t.addCal}</button>
        <button type="button" onClick={restart} style={{ ...S.ghost, width: "100%", marginTop: 6 }}>{t.another}</button>
      </div>
    );
  } else if (callToBook) {
    body = callBox(t.callTitle, t.callBody);
  } else if (menuState === "loading") {
    body = <div style={{ ...S.card, ...S.muted, textAlign: "center" }}>{t.loading}</div>;
  } else if (menuState === "404") {
    body = <div style={{ ...S.card, ...S.muted, textAlign: "center" }}>{t.notFound}</div>;
  } else if (menuState === "error") {
    body = (
      <div style={{ ...S.card, textAlign: "center" }}>
        <p style={{ ...S.muted, marginTop: 0 }}>{t.loadErr}</p>
        <button type="button" onClick={() => { setMenuState("loading"); setReload((n) => n + 1); }} style={{ ...S.btn, width: "auto", padding: "12px 22px" }}>{t.retry}</button>
      </div>
    );
  } else if (menuState === "empty") {
    body = callBox(t.callTitle, t.noServices);
  } else if (step === 1) {
    body = (
      <div>
        {Progress}
        {notice === "pro_gone" ? <div role="status" style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 14px", fontSize: 14, marginBottom: 14 }}>{t.proGone}</div> : null}
        {proLink && proAtual ? (
          <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 16 }}>
            <Avatar p={proAtual} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{t.bookingWith(proAtual.name)}</div>
              {proAtual.title ? <div style={{ ...S.muted, fontSize: 13 }}>{proAtual.title}</div> : null}
            </div>
            <button type="button" onClick={() => { setProLink(""); setPro(""); }} style={{ ...S.ghost, fontSize: 14, color: C.accent, whiteSpace: "nowrap" }}>{t.seeAll}</button>
          </div>
        ) : null}
        <h2 style={S.h2}>{t.chooseService}</h2>
        {groups.map(([cat, list]) => (
          <div key={cat || "_"} style={{ marginBottom: 18 }}>
            {cat ? <div style={{ fontFamily: SERIF, fontSize: 18, margin: "4px 2px 10px" }}>{cat}</div> : null}
            <div style={{ display: "grid", gap: 10 }}>
              {list.map((s) => (
                <button key={s.name} type="button" onClick={() => pickService(s)}
                  style={{ ...S.card, padding: "16px 18px", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, fontFamily: FONT, color: C.ink, width: "100%" }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{s.name}</span>
                    {s.description ? <span style={{ display: "block", ...S.muted, fontSize: 13, marginTop: 3 }}>{s.description}</span> : null}
                    <span style={{ display: "block", ...S.muted, fontSize: 13, marginTop: 4 }}>
                      {[s.minutes ? `${s.minutes} ${t.min}` : "", s.priceKnown ? (s.price || t.onRequest) : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span aria-hidden style={{ color: C.accent, fontSize: 20 }}>›</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  } else if (step === 2) {
    // sem preferência: um botão por horário (quem atende o servidor decide entre as visíveis); escolhida: só os dela
    const daySlots0 = slotsByDay.get(day) || [];
    const daySlots = escolha ? daySlots0.filter((s, i, a) => a.findIndex((x) => x.start === s.start) === i) : daySlots0;
    const quemFaz = equipeDoSvc(svc);
    const minSvc = svc ? svc.minutes : 0;
    body = (
      <div>
        {Progress}
        <button type="button" onClick={() => { setStep(1); setNotice(""); }} style={S.ghost}>‹ {t.back}</button>
        <h2 style={{ ...S.h2, marginTop: 6 }}>{t.chooseTime}</h2>
        <div style={{ ...S.muted, margin: "-6px 0 14px", color: C.ink, fontWeight: 600 }}>{svc && svc.name}{proAtual && minDela(proAtual, svc) ? <span style={{ fontWeight: 400, color: C.soft }}> · {minDela(proAtual, svc)} {t.min}</span> : null}</div>
        {escolha && quemFaz.length >= 2 ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...S.label, fontWeight: 600, color: C.ink }}>{t.withWhom}</div>
            <div role="radiogroup" aria-label={t.withWhom} style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 2px 6px", margin: "0 -2px", WebkitOverflowScrolling: "touch" }}>
              {[{ id: "", name: t.anyone, sub: t.anyoneSub }, ...quemFaz.map((p) => ({ ...p, sub: p.title || "", min: minDela(p, svc) }))].map((p) => {
                const on = pro === p.id;
                return (
                  <button key={p.id || "_qualquer"} type="button" role="radio" aria-checked={on} onClick={() => escolherPro(p.id)}
                    style={{ flex: "0 0 auto", minWidth: 112, maxWidth: 150, textAlign: "left", padding: "10px 12px", borderRadius: 14, cursor: "pointer", fontFamily: FONT,
                      border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accentSoft : C.card, color: C.ink }}>
                    {p.id ? <Avatar p={p} size={30} /> : <div aria-hidden style={{ width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", background: "#EFEAE2", color: C.soft, fontSize: 15 }}>✦</div>}
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: C.soft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.sub || "\u00a0"}</div>
                    {p.id && p.min && minSvc && p.min !== minSvc ? <div style={{ fontSize: 12, color: C.soft }}>{p.min} {t.min}</div> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {escolha && quemFaz.length === 1 ? <div style={{ ...S.muted, display: "flex", alignItems: "center", gap: 8, margin: "-4px 0 14px" }}><Avatar p={quemFaz[0]} size={24} />{t.onlyWith(quemFaz[0].name)}</div> : null}
        {notice ? <div role="status" style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 14px", fontSize: 14, marginBottom: 14 }}>{notice === "pro_gone" ? t.proGone : notice}</div> : null}
        {slotsState === "loading" ? <div style={{ ...S.card, ...S.muted, textAlign: "center" }}>{t.loading}</div> : null}
        {slotsState === "error" ? (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ ...S.muted, marginTop: 0 }}>{t.loadErr}</p>
            <button type="button" onClick={() => loadSlots(svc)} style={{ ...S.btn, width: "auto", padding: "12px 22px" }}>{t.retry}</button>
          </div>
        ) : null}
        {slotsState === "ok" && !slots.length ? callBox(t.callTitle, t.noSlots) : null}
        {slotsState === "ok" && slots.length ? (
          <>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 2px 10px", margin: "0 -2px", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
              {days.map(({ key }) => {
                const date = new Date(`${key}T12:00:00`);
                const has = slotsByDay.has(key) || diasComVaga.has(key);
                const on = key === day;
                return (
                  <button key={key} type="button" disabled={!has} onClick={() => abrirDia(key)}
                    style={{ flex: "0 0 auto", width: 58, padding: "10px 0", borderRadius: 14, scrollSnapAlign: "start", fontFamily: FONT, cursor: has ? "pointer" : "default",
                      border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accent : has ? C.card : "transparent", color: on ? "#fff" : has ? C.ink : "#B9B3A8" }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.85 }}>{date.toLocaleDateString(loc, { weekday: "short" }).replace(".", "")}</div>
                    <div style={{ fontSize: 19, fontWeight: 600, marginTop: 2 }}>{date.getDate()}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ ...S.muted, fontSize: 12, margin: "0 2px 12px" }}>{t.nextAvail}</div>
            {daySlots.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
                {daySlots.map((s) => {
                  const on = slot && slot.start === s.start && (escolha || slot.pro === s.pro);
                  return (
                    <button key={`${s.start}|${s.pro || ""}`} type="button" onClick={() => setSlot(s)}
                      style={{ padding: "12px 6px", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                        border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accentSoft : C.card, color: on ? C.accent : C.ink }}>
                      {fmtTime(s.start)}
                      {s.pro && !escolha ? <div style={{ fontSize: 11, fontWeight: 400, color: C.soft, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.pro}</div> : null}
                    </button>
                  );
                })}
              </div>
            ) : <div style={{ ...S.muted, padding: "8px 2px" }}>{t.noSlotsDay}</div>}
            <button type="button" disabled={!slot} onClick={() => { setNotice(""); setStep(3); }} style={{ ...S.btn, marginTop: 20, opacity: slot ? 1 : 0.45, cursor: slot ? "pointer" : "default" }}>{t.continue}</button>
          </>
        ) : null}
      </div>
    );
  } else if (step === 3) {
    body = (
      <div>
        {Progress}
        <button type="button" onClick={() => setStep(2)} style={S.ghost}>‹ {t.back}</button>
        <h2 style={{ ...S.h2, marginTop: 6 }}>{t.yourDetails}</h2>
        <form onSubmit={(e) => { e.preventDefault(); goDetails(); }} style={{ ...S.card, display: "grid", gap: 14 }}>
          <div>
            <label htmlFor="ag-nome" style={S.label}>{t.name}</label>
            <input id="ag-nome" style={S.input} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" maxLength={120} />
          </div>
          <div>
            <label htmlFor="ag-tel" style={S.label}>{t.phone}</label>
            <input id="ag-tel" style={S.input} value={tel} onChange={(e) => setTel(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" maxLength={40} />
            {/* e-mail opcional (2026-10-05): hoje o e-mail é o único canal de confirmação liberado (SMS espera A2P) */}
            <label htmlFor="ag-email" style={{ ...S.label, marginTop: 12 }}>{t.email}</label>
            <input id="ag-email" style={S.input} value={emailCli} onChange={(e) => setEmailCli(e.target.value)} type="email" inputMode="email" autoComplete="email" maxLength={160} />
          </div>
          <p style={{ ...S.muted, fontSize: 13, margin: 0 }}>{t.consent}</p>
          {/* CR-11 (2026-10-13): permissão para OFERTAS é separada da confirmação e nasce desmarcada; o servidor só registra se marcada. */}
          <label htmlFor="ag-ofertas" style={{ ...S.muted, fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
            <input id="ag-ofertas" type="checkbox" checked={ofertas} onChange={(e) => setOfertas(e.target.checked)} style={{ marginTop: 3 }} />
            <span>{t.offers}</span>
          </label>
          {formErr ? <div style={{ color: C.warn, fontSize: 14 }}>{formErr}</div> : null}
          <button type="submit" style={S.btn}>{t.continue}</button>
        </form>
      </div>
    );
  } else {
    body = (
      <div>
        {Progress}
        <button type="button" onClick={() => setStep(3)} style={S.ghost} disabled={sending}>‹ {t.back}</button>
        <h2 style={{ ...S.h2, marginTop: 6 }}>{t.review}</h2>
        <div style={S.card}>
          <Row k={t.service} v={svc && svc.name} />
          <Row k={t.when} v={slot ? `${fmtFull(slot.start)}${!escolha && slot.pro ? ` · ${t.with} ${slot.pro}` : ""}` : ""} />
          {escolha ? <Row k={t.pro} v={proAtual ? proAtual.name : t.anyoneReview} /> : null}
          <Row k={t.name} v={nome} />
          <Row k={t.phone} v={tel} />
          {notice ? <div role="status" style={{ background: C.warnSoft, color: C.warn, borderRadius: 12, padding: "12px 14px", fontSize: 14, marginTop: 12 }}>{notice === "pro_gone" ? t.proGone : notice}</div> : null}
          <button type="button" onClick={confirm} disabled={sending} style={{ ...S.btn, marginTop: 18, opacity: sending ? 0.7 : 1 }}>{sending ? t.booking : t.confirm}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {Header}
        {body}
      </div>
    </div>
  );
}

// inicial na cor da profissional (o cadastro não tem foto) — nunca contato
function Avatar({ p, size = 36 }) {
  const cor = /^#[0-9a-f]{3,8}$/i.test(String(p?.color || "")) ? p.color : "#8E8A80";
  return (
    <div aria-hidden style={{ width: size, height: size, borderRadius: 999, flex: "0 0 auto", display: "grid", placeItems: "center", background: cor, color: "#fff", fontWeight: 700, fontSize: Math.round(size * 0.42) }}>
      {String(p?.name || "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderTop: `1px solid ${C.line}`, fontSize: 15 }}>
      <span style={{ color: C.soft }}>{k}</span>
      <span style={{ textAlign: "right", fontWeight: 500, wordBreak: "break-word" }}>{v}</span>
    </div>
  );
}
