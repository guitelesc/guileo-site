/* ─────────────────────────────────────────────────────────────────────────────────────────────
   HOJE — a primeira tela do Guileo App.

   POR QUE ELA EXISTE: o cockpit tem 61 telas. Sessenta e uma telas é o oposto de "tudo num lugar
   só" — um dono de salão que abre 61 telas não entende nada, ele fecha. Esta tela responde TRÊS
   perguntas em cinco segundos, sem rolar:
       1. o que a minha IA fez por mim hoje?
       2. quanto isso valeu?  (só o que foi MEDIDO)
       3. tem alguma coisa pedindo por mim?
   Embaixo disso, os atalhos para a profundidade. Quem quer mais, desce; quem quer só saber se o
   dia está de pé, já soube.

   ── AS LEIS DESTA TELA (uma auditoria achou 21 defeitos no portal; nenhum deles nasce aqui) ──
   • null NUNCA vira 0. Um "$0" com selo verde de LIVE faz o dono concluir "a minha IA não me deu
     nada" quando na verdade a leitura falhou. Zero medido é zero; ausência é "—" em cinza, e as
     duas coisas nunca se parecem.
   • Erro nunca vira vazio. Falha de leitura diz "não consegui ler" com o motivo e um botão de
     tentar de novo — nunca "você não teve ligações hoje".
   • Nada de dado de amostra numa tela de cliente real. Sem `real`, esta tela não cai para V.*:
     ou diz que não está conectada, ou diz que não conseguiu ler.
   • Nenhum botão que finge. Se a ação não tem endpoint, o botão não existe.
   • Nenhum contador animado. Número que nasce em zero e sobe imprime valor falso numa aba de
     fundo (o rAF congela) — já aconteceu neste repo. Aqui o número nasce no valor.
   • Dado guardado só aparece com CARIMBO de quando foi lido. Dado velho sem carimbo é mentira.
   ───────────────────────────────────────────────────────────────────────────────────────────── */
import { useState, useEffect, useCallback, useRef } from "react";
import { FaCalendarDays, FaPhone, FaUsers, FaHeartPulse, FaGlobe, FaSackDollar, FaRotateRight, FaArrowRight } from "react-icons/fa6";
import { tr, UI_LANG, Card } from "../pages/Portal.jsx";
import { fetchNoshowRadar } from "../lib/portalApi.js";

// ── idioma ──────────────────────────────────────────────────────────────────────────────────────
// fmt() com "en-US" cravado já fez a agente falar metade em inglês numa ligação em português.
// Mesma armadilha aqui: todo Intl desta tela sai do idioma da sessão, nunca de um literal.
const LOCALE = { pt: "pt-BR", es: "es-ES", hi: "hi-IN", en: "en-US" };
const loc = () => LOCALE[UI_LANG] || LOCALE.en;
const hhmm = (ts) => { try { return new Date(ts).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
// Moeda SEMPRE com a unidade explícita. Plano em R$ e valor em $ na mesma página já custou caro:
// o cliente leu um número 5× mais caro do que era. A receita vem em centavos de USD do ledger.
const usd = (n) => { try { return new Intl.NumberFormat(loc(), { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n); } catch { return `$${Math.round(n)}`; } };
const num = (n) => { try { return new Intl.NumberFormat(loc()).format(n); } catch { return String(n); } };

// ── guarda-dia offline (leitura carimbada) ──────────────────────────────────────────────────────
// IndexedDB, não localStorage: localStorage é síncrono e nem existe dentro de um service worker.
// Guardamos só o RESUMO já calculado + o instante da leitura. Ele nunca é mostrado como se fosse
// de agora: sempre com "lido às HH:MM" à vista.
const DB = "guileo-app", LOJA = "hoje";
function abrir() {
  return new Promise((ok, nao) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(LOJA)) r.result.createObjectStore(LOJA); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => nao(r.error);
    } catch (e) { nao(e); }
  });
}
async function guardar(chave, valor) {
  try {
    const db = await abrir();
    await new Promise((ok, nao) => { const t = db.transaction(LOJA, "readwrite"); t.objectStore(LOJA).put(valor, chave); t.oncomplete = ok; t.onerror = () => nao(t.error); });
  } catch { /* modo privado / sem IndexedDB → o app segue, só sem memória offline */ }
}
async function ler(chave) {
  try {
    const db = await abrir();
    return await new Promise((ok, nao) => { const t = db.transaction(LOJA, "readonly"); const q = t.objectStore(LOJA).get(chave); q.onsuccess = () => ok(q.result || null); q.onerror = () => nao(q.error); });
  } catch { return null; }
}

// ── peças ───────────────────────────────────────────────────────────────────────────────────────
/** Um número. `v == null` desenha "—": ausência de medida, jamais um zero disfarçado. */
function Metric({ icon, label, v, money = false }) {
  const ausente = v == null;
  return (
    <div className="rounded-xl2 border border-white/10 bg-white/[0.04] px-3.5 py-3 min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-g-muted">
        <span aria-hidden className="text-[13px]">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${ausente ? "text-g-muted/60" : "text-g-word"}`}
        title={ausente ? tr("Not measured yet") : undefined}>
        {ausente ? "—" : money ? usd(v) : num(v)}
      </div>
    </div>
  );
}

/** Falha de leitura de UM bloco. Nunca "você não teve nada" — sempre o motivo e o botão. */
function Falhou({ motivo, onRetry }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl2 border border-amber-400/30 bg-amber-400/[0.07] px-3.5 py-3">
      <span aria-hidden>⚠️</span>
      <span className="flex-1 min-w-[10rem] text-[12.5px] leading-snug text-g-light">
        {tr("I couldn't read this one")}{motivo ? <span className="text-g-muted"> · {motivo}</span> : null}
      </span>
      <button type="button" onClick={onRetry}
        className="min-h-[44px] rounded-full border border-white/15 bg-white/[0.06] px-4 text-[12px] font-bold text-g-word transition hover:border-g-gold/50">
        {tr("Try again")}
      </button>
    </div>
  );
}

function Bloco({ title, right, children }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-black uppercase tracking-wide text-g-gold">{title}</h2>
        {right}
      </div>
      {children}
    </Card>
  );
}

const ATALHOS = [
  ["schedule", FaCalendarDays, "My schedule"],
  ["calllogs", FaPhone, "Calls"],
  ["crm", FaUsers, "Customers"],
  ["experience", FaHeartPulse, "Pulse"],
  ["meusite", FaGlobe, "My site"],
  ["finance", FaSackDollar, "Money"],
];

// ── a tela ──────────────────────────────────────────────────────────────────────────────────────
export default function Hoje({ V, onNav, real = null, email = "", dataKey = "", onRefresh, refreshing = false }) {
  const conectado = !!(email && email.includes("@") && dataKey);
  const [dinheiro, setDinheiro] = useState({ st: "loading" });   // st: loading|ok|notready|fail
  const [atencao, setAtencao] = useState({ px: "loading", ns: "loading", detratores: 0, risco: 0 });
  const [guardado, setGuardado] = useState(null);                // último resumo lido (IndexedDB)
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [graca, setGraca] = useState(true);                      // 1.2s antes de acusar falha no boot
  const chave = `hoje:${(email || "anon").toLowerCase()}`;
  const montado = useRef(true);

  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  useEffect(() => { const t = setTimeout(() => setGraca(false), 1200); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => { let vivo = true; ler(chave).then((v) => { if (vivo) setGuardado(v); }); return () => { vivo = false; }; }, [chave]);

  // ── dinheiro: o MESMO ledger que o e-mail semanal (/api/revenue → revenue_month, em centavos).
  // `series` é o dia-a-dia do mês corrente; o último elemento é hoje. Ela é opcional no backend
  // (depende de revenue_series.sql estar colado) — sem ela, "recebido hoje" fica "—", nunca 0.
  const lerDinheiro = useCallback(() => {
    if (!conectado || !real) return;
    setDinheiro({ st: "loading" });
    fetch("/api/revenue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: dataKey, email }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (!montado.current) return;
        if (!j || j.ok !== true) { setDinheiro({ st: "fail", motivo: tr("the server refused the read") }); return; }
        if (!j.ready) { setDinheiro({ st: "notready", hoje: null, mes: null }); return; }
        const s = Array.isArray(j.series) ? j.series : [];
        setDinheiro({
          st: "ok",
          hoje: s.length ? Math.max(0, Number(s[s.length - 1]) || 0) : null,   // sem série → não medido
          mes: Number.isFinite(j.month_cents) ? Math.max(0, j.month_cents / 100) : null,
        });
      })
      .catch((e) => { if (montado.current) setDinheiro({ st: "fail", motivo: String(e.message || e).slice(0, 60) }); });
  }, [conectado, real, dataKey, email]);

  // ── pedindo você: só fontes com bandeira `ready` própria. Um leitor que devolve [] tanto para
  // "nada" quanto para "falhei" não entra aqui — é exatamente ele que produz o falso "tudo certo".
  const lerAtencao = useCallback(() => {
    if (!conectado || !real) return;
    setAtencao((a) => ({ ...a, px: "loading", ns: "loading" }));
    fetch("/api/experience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, dataKey }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!montado.current) return;
        if (!j) { setAtencao((a) => ({ ...a, px: "fail" })); return; }
        if (!j.ready) { setAtencao((a) => ({ ...a, px: "notready", detratores: 0 })); return; }
        setAtencao((a) => ({ ...a, px: "ok", detratores: Array.isArray(j.detractors) ? j.detractors.length : 0 }));
      })
      .catch(() => { if (montado.current) setAtencao((a) => ({ ...a, px: "fail" })); });
    fetchNoshowRadar(dataKey, email, 2)
      .then((d) => { if (montado.current) setAtencao((a) => ({ ...a, ns: d && d.ready ? "ok" : "notready", risco: (d && Number(d.highRisk)) || 0 })); })
      .catch(() => { if (montado.current) setAtencao((a) => ({ ...a, ns: "fail" })); });
  }, [conectado, real, dataKey, email]);

  useEffect(() => { lerDinheiro(); }, [lerDinheiro]);
  useEffect(() => { lerAtencao(); }, [lerAtencao]);

  // ── o que a IA fez hoje: contado dos eventos reais do próprio tenant, janela do dia LOCAL.
  const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
  const doDia = real && Array.isArray(real.events)
    ? real.events.filter((e) => { const t = new Date(e.created_at).getTime(); return Number.isFinite(t) && t >= hoje0.getTime(); })
    : null;
  const conta = (tipo) => (doDia ? doDia.filter((e) => e.type === tipo).length : null);
  const feito = doDia
    ? { calls: conta("call"), booked: conta("booking"), msgs: conta("message"), leads: conta("lead") }
    : null;

  // Guarda o resumo do dia assim que ele fecha — é ele que aparece (carimbado) quando a leitura
  // seguinte falha ou o celular está sem sinal entre uma cliente e outra.
  useEffect(() => {
    if (!feito || !conectado) return;
    const snap = { at: Date.now(), feito, dinheiro: dinheiro.st === "ok" ? { hoje: dinheiro.hoje, mes: dinheiro.mes } : null };
    guardar(chave, snap); setGuardado(snap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [real, dinheiro.st, dinheiro.hoje, dinheiro.mes, conectado, chave]);

  const recarregar = () => { onRefresh?.(); lerDinheiro(); lerAtencao(); };

  // ── ESTADO 1: não conectado. Nunca cai para o cockpit de amostra. ─────────────────────────────
  if (!conectado) {
    return (
      <div className="space-y-4">
        <Cabecalho V={V} />
        <Card className="p-5">
          <div className="text-base font-extrabold text-g-word">{tr("Connect your account")}</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-g-muted">{tr("Add your connection code in Settings and today's real numbers show up here.")}</p>
          <button type="button" onClick={() => onNav?.("settings")}
            className="mt-4 inline-flex min-h-[48px] items-center rounded-full bg-g-gold px-5 text-[13px] font-black text-g-deep transition hover:brightness-110">
            {tr("Open Settings →")}
          </button>
        </Card>
        <Atalhos onNav={onNav} />
      </div>
    );
  }

  // ── ESTADO 2: conectado, ainda carregando. Esqueleto, nunca um número provisório. ─────────────
  if (!real && (refreshing || graca)) {
    return (
      <div className="space-y-4">
        <Cabecalho V={V} />
        <Card className="p-4"><div className="grid grid-cols-2 gap-2.5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[74px] animate-pulse rounded-xl2 bg-white/[0.05]" />)}</div></Card>
        <Atalhos onNav={onNav} />
      </div>
    );
  }

  // ── ESTADO 3: conectado e a leitura falhou. O guardado aparece — carimbado. ───────────────────
  if (!real) {
    return (
      <div className="space-y-4">
        <Cabecalho V={V} />
        <Card className="p-5 border-amber-400/30">
          <div className="text-base font-extrabold text-g-word">{tr("I couldn't load your day")}</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-g-muted">
            {tr("The read failed, so I'm not going to show you numbers I don't have.")}
            {!online ? <span className="ml-1 rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-bold text-g-muted">{tr("offline")}</span> : null}
          </p>
          <button type="button" onClick={recarregar}
            className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-g-gold px-5 text-[13px] font-black text-g-deep transition hover:brightness-110">
            <FaRotateRight aria-hidden /> {tr("Try again")}
          </button>
        </Card>
        {guardado?.feito && (
          <Bloco title={tr("What your AI did for you today")}
            right={<Carimbo at={guardado.at} online={online} />}>
            <Grade f={guardado.feito} />
          </Bloco>
        )}
        <Atalhos onNav={onNav} />
      </div>
    );
  }

  // ── ESTADO 4: tudo lido. ─────────────────────────────────────────────────────────────────────
  const pedidos = [];
  if (atencao.px === "ok" && atencao.detratores > 0) pedidos.push({ k: "px", n: atencao.detratores, txt: atencao.detratores === 1 ? tr("unhappy customer waiting") : tr("unhappy customers waiting"), view: "experience" });
  if (atencao.ns === "ok" && atencao.risco > 0) pedidos.push({ k: "ns", n: atencao.risco, txt: atencao.risco === 1 ? tr("booking at risk of a no-show") : tr("bookings at risk of a no-show"), view: "riskradar" });

  return (
    <div className="space-y-4">
      <Cabecalho V={V} onRefresh={recarregar} refreshing={refreshing} />

      {/* 1 — o que a IA fez hoje */}
      <Bloco title={tr("What your AI did for you today")} right={guardado?.at ? <Carimbo at={guardado.at} online={online} vivo /> : null}>
        <Grade f={feito} />
      </Bloco>

      {/* 2 — quanto isso valeu (só o que foi medido) */}
      <Bloco title={tr("What it was worth")}>
        {dinheiro.st === "fail" ? (
          <Falhou motivo={dinheiro.motivo} onRetry={lerDinheiro} />
        ) : dinheiro.st === "loading" ? (
          <div className="grid grid-cols-2 gap-2.5">{[0, 1].map((i) => <div key={i} className="h-[74px] animate-pulse rounded-xl2 bg-white/[0.05]" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Metric icon="💵" label={tr("Collected today")} v={dinheiro.hoje ?? null} money />
              <Metric icon="📆" label={tr("Collected this month")} v={dinheiro.mes ?? null} money />
            </div>
            <p className="mt-2.5 text-[11.5px] leading-snug text-g-muted">{tr("Only money actually collected is counted here.")}</p>
          </>
        )}
      </Bloco>

      {/* 3 — tem algo pedindo você? */}
      <Bloco title={tr("Needs you")}>
        <div className="space-y-2">
          {pedidos.map((p) => (
            <button key={p.k} type="button" onClick={() => onNav?.(p.view)}
              className="flex w-full min-h-[52px] items-center gap-3 rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-3.5 py-2.5 text-left transition hover:border-g-gold/60">
              <span className="text-xl font-black tabular-nums text-g-gold">{num(p.n)}</span>
              <span className="flex-1 min-w-0 text-[13px] font-semibold leading-snug text-g-word">{p.txt}</span>
              <FaArrowRight aria-hidden className="shrink-0 text-g-muted" />
            </button>
          ))}
          {(atencao.px === "fail" || atencao.ns === "fail") && <Falhou onRetry={lerAtencao} />}
          {pedidos.length === 0 && atencao.px !== "fail" && atencao.ns !== "fail" && atencao.px !== "loading" && atencao.ns !== "loading" && (
            <p className="py-2 text-[13px] text-g-muted">{tr("Nothing is waiting on you right now.")}</p>
          )}
          {(atencao.px === "loading" || atencao.ns === "loading") && <div className="h-[52px] animate-pulse rounded-xl2 bg-white/[0.05]" />}
        </div>
      </Bloco>

      <Atalhos onNav={onNav} />
    </div>
  );
}

function Cabecalho({ V, onRefresh, refreshing }) {
  const hoje = (() => { try { return new Date().toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" }); } catch { return ""; } })();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-black text-g-word">{tr("Today")}</h1>
        <p className="mt-0.5 truncate text-[12px] capitalize text-g-muted">{hoje}{V?.business?.name ? ` · ${V.business.name}` : ""}</p>
      </div>
      {onRefresh && (
        <button type="button" onClick={onRefresh} aria-label={tr("Refresh")}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/12 bg-white/[0.05] text-g-muted transition hover:text-g-word">
          <FaRotateRight aria-hidden className={refreshing ? "animate-spin" : ""} />
        </button>
      )}
    </div>
  );
}

function Grade({ f }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Metric icon="📞" label={tr("Calls answered")} v={f?.calls ?? null} />
      <Metric icon="📅" label={tr("Bookings made")} v={f?.booked ?? null} />
      <Metric icon="💬" label={tr("Messages answered")} v={f?.msgs ?? null} />
      <Metric icon="🎯" label={tr("New contacts")} v={f?.leads ?? null} />
    </div>
  );
}

/** O carimbo. Dado guardado sem hora é mentira; com hora, é informação. */
function Carimbo({ at, online, vivo = false }) {
  if (vivo && online) return <span className="shrink-0 text-[10.5px] font-bold text-g-muted">{tr("Read at")} {hhmm(at)}</span>;
  return (
    <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[10.5px] font-bold text-g-muted">
      {!online ? `${tr("offline")} · ` : ""}{tr("Showing what I last read at")} {hhmm(at)}
    </span>
  );
}

function Atalhos({ onNav }) {
  return (
    <div>
      <h2 className="mb-2 px-1 text-[11px] font-black uppercase tracking-wide text-g-muted">{tr("Go deeper")}</h2>
      <div className="grid grid-cols-3 gap-2.5">
        {ATALHOS.map(([view, Icon, label]) => (
          <button key={view} type="button" onClick={() => onNav?.(view)}
            className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl2 border border-white/10 bg-white/[0.04] px-2 py-3 transition hover:border-g-gold/40 hover:bg-white/[0.07]">
            <Icon aria-hidden className="text-[17px] text-g-gold" />
            <span className="w-full truncate text-center text-[11.5px] font-bold text-g-word">{tr(label)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
