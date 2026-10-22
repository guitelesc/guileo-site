/* ─────────────────────────────────────────────────────────────────────────────────────────────
   RELACIONAMENTO — o cliente, o consultor dele, e a prova de que alguém respondeu.

   POR QUE ELA EXISTE (pedido do Luis, 2026-08-20): "de serviços a suporte e ocorrência do cliente,
   tem que ter aba RELACIONAMENTO. É onde o cliente também AVALIA o vendedor e tem ali um chat que
   acessa ele direto." E: "a nota SEM o nome."

   O BURACO QUE ELA FECHA (auditoria da área do cliente, confirmada no código):
     • o cliente abria chamado, a tela imprimia "✓ Escalado para um humano" e NINGUÉM era avisado;
     • quando o consultor (support-hub.js:150) ou o técnico (:192) respondia, a resposta ia para o
       campo `thread` — que a tela NUNCA lia. A resposta humana era invisível. Ele pedia socorro,
       via um ✓, e o silêncio. É o gatilho clássico de cancelamento.
   Aqui a thread inteira aparece, com quem falou e quando, e uma caixa para ele responder.

   ── AS LEIS DESTA TELA (a mesma auditoria achou 21 defeitos no portal; nenhum nasce aqui) ──
   • ERRO NUNCA VIRA VAZIO. `{ok:false}` ou `ready:false` dizem "não consegui carregar · <motivo>"
     com botão de tentar de novo. "Você não tem chamados" só com `ok:true` e lista realmente vazia.
   • SUCESSO NUNCA SEM COMPROVANTE. "Enviado ✓" só depois de ler `id` (create/avaliar) ou
     `replied === true` (reply). `r.ok` do fetch não prova nada: a RPC de reply devolve BOOLEANO,
     e o endpoint responde `{ok:true, ready:false}` em HTTP 200 quando o SQL não está colado.
   • null NUNCA vira 0 — sempre "—" em cinza.
   • Nenhum botão sem endpoint. Nenhum contador animado (rAF congela em aba de fundo e imprime
     número falso — já aconteceu três vezes neste repo).
   ───────────────────────────────────────────────────────────────────────────────────────────── */
import { useState, useEffect, useCallback, useRef } from "react";
import { FaRotateRight, FaArrowLeft, FaStar, FaUserTie, FaComments, FaInbox } from "react-icons/fa6";
import { tr, UI_LANG, Card } from "../pages/Portal.jsx";
import { GuiChat } from "./Support.jsx";
import { PERDA, GANHO, NOT_MEASURED } from "../lib/reportScale.js";
import { chamarApi } from "../lib/portalApi.js";
import { fraseDaFalha } from "./FalhaDeLeitura.jsx";

/* ── A FRASE DE UMA FALHA (2026-09-28) ─────────────────────────────────────────────────────────
   O bloco do consultor mostrava "unreadable answer (HTTP 502)" com um "Tentar de novo" que nunca
   funcionava: a Cloudflare troca o corpo de todo 502 por texto puro, o JSON com o motivo morria no
   caminho e a tela imprimia o código HTTP. O backend passou a responder 503/409 (o corpo
   sobrevive) com `{error|erro|motivo}` já no idioma pedido — por isso `lang` vai em toda chamada.
   Regra da tela: NUNCA imprimir código HTTP, nome de RPC ou texto cru. A frase do servidor só
   entra se for frase de gente (tem espaço, não tem jargão) e estiver no idioma da tela; senão,
   vale a nossa. */
const pareceEngenharia = (t) => /HTTP\s*\d{3}|\b[a-z]+_[a-z_]+\b|\.sql\b|supabase|cloudflare|\brpc\b|_KEY\b|_SECRET\b|undefined|TypeError|fetch failed/i.test(t);
const pareceOutroIdioma = (t) => UI_LANG === "en" && /[ãõçáéíóúâêôà]/i.test(t);
const fraseDoServidor = (d) => {
  // Só `motivo`/`erro`: são os campos que o servidor preenche com frase PARA A TELA, no idioma
  // pedido. `error` e `note` carregam texto de máquina ("unauthorized", exceção crua, "paste
  // db/…sql") e nunca são impressos.
  const t = String((d && (d.motivo || d.erro)) || "").trim();
  if (!t || !/\s/.test(t) || pareceEngenharia(t) || pareceOutroIdioma(t)) return "";
  return t.slice(0, 200);
};
/** r = {http, d, motivo} (ver `post`). `padrao` = frase nossa para quando nada melhor existe. */
const fraseDe = (r, padrao) => {
  if (r?.motivo === "rede" || r?.motivo === "resposta_estranha" || r?.motivo === "chave_invalida" || r?.motivo === "sem_credencial") return fraseDaFalha(r.motivo);
  return fraseDoServidor(r?.d) || (r?.motivo ? fraseDaFalha(r.motivo) : padrao);
};

// ── idioma ──────────────────────────────────────────────────────────────────────────────────────
// "en-US" cravado num Intl já fez a agente falar metade em inglês numa ligação em português.
// Toda data desta tela sai do idioma da sessão.
const LOCALE = { pt: "pt-BR", es: "es-ES", hi: "hi-IN", en: "en-US" };
const loc = () => LOCALE[UI_LANG] || LOCALE.en;
const quando = (ts) => { try { return new Date(ts).toLocaleString(loc(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

/** Duração humana, sem contador animado: o número nasce no valor. */
function duracao(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

/** Quem falou. O consultor e o técnico gravam com papel "human" (support-hub.js); o técnico
 *  prefixa o texto com "[téc]". Papel desconhecido nunca vira "você" — vira "Guileo". */
function autor(role, text) {
  if (role === "client") return tr("You");
  if (role === "gui") return "Gui";
  if (role === "human") return String(text || "").startsWith("[téc]") ? tr("Technical team") : tr("Your consultant");
  return tr("Guileo team");
}

/** A conta de "sem resposta": o relógio anda desde a ÚLTIMA mensagem que NÃO é dele (ou, se
 *  ninguém nunca respondeu, desde a abertura). Só conta enquanto ele está de fato esperando —
 *  ou seja, quando a última mensagem da thread é dele e o chamado não está fechado. */
function semResposta(t) {
  const fio = Array.isArray(t?.thread) ? t.thread : [];
  const fechado = t?.status === "resolved" || t?.status === "closed";
  const ultima = fio.length ? fio[fio.length - 1] : null;
  const esperando = !fechado && (!ultima || ultima.role === "client");
  if (!esperando) return null;
  let base = t?.created_at;
  for (let i = fio.length - 1; i >= 0; i--) { if (fio[i]?.role && fio[i].role !== "client") { base = fio[i].at; break; } }
  const ms = Date.now() - new Date(base).getTime();
  return Number.isFinite(ms) ? ms : null;
}

const ABANDONO = 24 * 3600 * 1000;   // 24h sem ninguém responder = destaque, não decoração

// ── peças ───────────────────────────────────────────────────────────────────────────────────────
/** Falha de leitura de UM bloco. Nunca "você não tem nada" — sempre o motivo e o botão. */
function Falhou({ motivo, onRetry }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl2 border border-amber-400/30 bg-amber-400/[0.07] px-3.5 py-3">
      <span aria-hidden>⚠️</span>
      <span className="flex-1 min-w-[10rem] text-[12.5px] leading-snug text-g-light">
        {tr("I couldn't load this")}{motivo ? <span className="text-g-muted"> · {motivo}</span> : null}
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-[44px] rounded-full border border-white/15 bg-white/[0.06] px-4 text-[12px] font-bold text-g-word transition hover:border-g-gold/50">{tr("Try again")}</button>
      )}
    </div>
  );
}

function Bloco({ title, icon, right, children }) {
  return (
    <Card className="p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-g-gold">
          {icon ? <span aria-hidden className="text-[13px]">{icon}</span> : null}{title}
        </h2>
        {right}
      </div>
      {children}
    </Card>
  );
}

const TOM = {
  escalated: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  open: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  resolving: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  resolved: "text-g-light border-g-green/30 bg-g-green/10",
};
const Chip = ({ status }) => (
  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TOM[status] || TOM.open}`}>{tr(status || "open")}</span>
);

// ── a tela ──────────────────────────────────────────────────────────────────────────────────────
export default function Relacionamento({ onNav, email = "", dataKey = "" }) {
  const conectado = !!(email && email.includes("@") && dataKey);
  const [aba, setAba] = useState("gui");                    // gui | chamados
  const [ch, setCh] = useState({ st: "loading" });          // st: loading|ok|notready|fail
  const [abertoId, setAbertoId] = useState(null);
  const [consultor, setConsultor] = useState({ st: "loading" });
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  // Mesmo formato de antes ({http, d}) + `motivo` de transporte. NUNCA levanta (os `catch` dos
  // chamadores ficaram só como cinto de segurança).
  const post = useCallback(async (body) => {
    const r = await chamarApi("/api/support", { token: dataKey, email, lang: UI_LANG, ...body });
    return { http: r.http, d: r.data, motivo: r.motivo };
  }, [dataKey, email]);

  // ── chamados. `ready:false` é "não consegui ler", NÃO "vazio" — o servidor manda a bandeira de
  //    propósito e a tela antiga a ignorava, convergindo rede caída, 401 e SQL ausente em "nada".
  const lerChamados = useCallback(async () => {
    if (!conectado) return;
    // Mantém a lista anterior durante o recarregamento: sem isso, responder um chamado
    // desmontava o detalhe no meio do "✓ resposta registrada" e jogava o cliente de volta
    // para a lista — ou seja, o comprovante sumia da tela de quem acabou de escrever.
    setCh((c) => ({ ...c, st: "loading" }));
    try {
      const r = await post({ action: "list", limit: 100 });
      const { d } = r;
      if (!vivo.current) return;
      if (r.motivo || !d || d.error || d.ok !== true) { setCh({ st: "fail", motivo: fraseDe(r, fraseDaFalha("servidor")) }); return; }
      // a nota do servidor aqui é de engenharia ("paste db/…sql") — a tela diz a versão da cliente
      if (d.ready !== true) { setCh({ st: "notready", motivo: tr("support isn't activated yet") }); return; }
      if (!Array.isArray(d.tickets)) { setCh({ st: "fail", motivo: fraseDaFalha("resposta_estranha") }); return; }
      setCh({ st: "ok", lista: d.tickets.filter(Boolean) });
    } catch { if (vivo.current) setCh({ st: "fail", motivo: fraseDaFalha("rede") }); }
  }, [conectado, post]);

  const lerConsultor = useCallback(async () => {
    if (!conectado) return;
    setConsultor({ st: "loading" });
    try {
      const r = await post({ action: "consultor" });
      const { d } = r;
      if (!vivo.current) return;
      // "Sem consultor atribuído" é ESTADO DA CONTA, não pane: o servidor marca `sem_consultor`
      // (e responde 409 nas ações). Cai no bloco calmo, sem botão de tentar de novo.
      if (d && d.sem_consultor === true) { setConsultor({ st: "sem" }); return; }
      if (r.motivo || !d || d.ok !== true) { setConsultor({ st: "fail", motivo: fraseDe(r, tr("I couldn't load your consultant. Please try again.")) }); return; }
      if (!d.consultor || !d.consultor.nome) { setConsultor({ st: "sem" }); return; }
      setConsultor({ st: "ok", nome: d.consultor.nome, idioma: d.consultor.idioma || "" });
    } catch { if (vivo.current) setConsultor({ st: "fail", motivo: fraseDaFalha("rede") }); }
  }, [conectado, post]);

  useEffect(() => { lerChamados(); }, [lerChamados]);
  useEffect(() => { lerConsultor(); }, [lerConsultor]);

  // ── ainda não conectado: nunca cai para dado de amostra. ──────────────────────────────────────
  if (!conectado) {
    return (
      <div className="space-y-4">
        <Cabecalho />
        <Card className="p-5 backdrop-blur-md">
          <div className="text-base font-extrabold text-g-word">{tr("Connect your account")}</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-g-muted">{tr("Add your connection code in Settings and your tickets, your consultant and your rating show up here.")}</p>
          <button type="button" onClick={() => onNav?.("settings")} className="mt-4 inline-flex min-h-[48px] items-center rounded-full bg-g-gold px-5 text-[13px] font-black text-g-deep transition hover:brightness-110">{tr("Open Settings →")}</button>
        </Card>
      </div>
    );
  }

  const lista = Array.isArray(ch.lista) ? ch.lista : [];
  const aberto = lista.find((t) => String(t.id) === String(abertoId)) || null;
  const emAberto = lista.filter((t) => t.status !== "resolved" && t.status !== "closed").length;

  return (
    <div className="space-y-4">
      <Cabecalho onRefresh={() => { lerChamados(); lerConsultor(); }} />

      {/* ── 1 · CONVERSA ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <TabBtn on={aba === "gui"} onClick={() => setAba("gui")} icon={<FaComments aria-hidden />} label={tr("Talk to Gui")} />
        <TabBtn on={aba === "chamados"} onClick={() => { setAba("chamados"); }} icon={<FaInbox aria-hidden />} label={tr("My tickets")} n={ch.st === "ok" ? emAberto : null} />
      </div>

      {aba === "gui" ? (
        <GuiChat onNav={onNav} email={email} dataKey={dataKey} onTicket={() => lerChamados()} />
      ) : aberto ? (
        <Detalhe t={aberto} post={post} onBack={() => setAbertoId(null)} onReplied={lerChamados} />
      ) : (
        <Bloco title={tr("My tickets")} icon="📬" right={ch.st === "ok" || lista.length ? <span className="text-[10.5px] font-bold text-g-muted">{lista.length}</span> : null}>
          {ch.st === "loading" && !lista.length ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-[64px] animate-pulse rounded-xl2 bg-white/[0.05]" />)}</div>
          ) : ch.st === "fail" ? (
            <Falhou motivo={ch.motivo} onRetry={lerChamados} />
          ) : ch.st === "notready" ? (
            <Falhou motivo={ch.motivo} onRetry={lerChamados} />
          ) : lista.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-g-muted">{tr("You have no tickets — anything you ask Gui shows up here.")}</p>
          ) : (
            <div className="space-y-2">{lista.map((t) => <LinhaChamado key={t.id} t={t} onOpen={() => setAbertoId(t.id)} />)}</div>
          )}
        </Bloco>
      )}

      {/* ── 2 · MEU CONSULTOR ────────────────────────────────────────────────────────────────── */}
      <MeuConsultor c={consultor} post={post} onRetry={lerConsultor} onSent={() => { lerChamados(); setAba("chamados"); }} />

      {/* ── 3 · COMO ESTAMOS INDO ────────────────────────────────────────────────────────────── */}
      {/* CHAT DIRETO COM QUEM VENDEU (2026-08-20) — suporte é sobre o PRODUTO; isto é sobre a
          RELAÇÃO. O cliente não escolhe pra qual vendedor escreve: o banco resolve o par por
          `seller_of_client`. Só aparece quando existe consultor — canal sem ninguém do outro lado
          é pior que canal nenhum: o cliente escreve e o silêncio vira abandono. */}
      {consultor.st === "ok" && <ChatDoConsultor post={post} nome={consultor.nome || ""} />}

      <ComoEstamos post={post} temConsultor={consultor.st === "ok"} />
    </div>
  );
}

function Cabecalho({ onRefresh }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-black text-g-word">{tr("Relationship")}</h1>
        <p className="mt-0.5 text-[12px] leading-snug text-g-muted">{tr("Your support, your tickets and the person behind your account.")}</p>
      </div>
      {onRefresh && (
        <button type="button" onClick={onRefresh} aria-label={tr("Refresh")}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/12 bg-white/[0.05] text-g-muted transition hover:text-g-word">
          <FaRotateRight aria-hidden />
        </button>
      )}
    </div>
  );
}

function TabBtn({ on, onClick, icon, label, n }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full border px-3 text-[12.5px] font-bold transition ${on ? "border-g-gold/50 bg-g-gold/[0.12] text-g-word" : "border-white/12 bg-white/[0.04] text-g-muted hover:text-g-word"}`}>
      <span aria-hidden className="text-[13px]">{icon}</span>
      <span className="truncate">{label}</span>
      {n != null && n > 0 ? <span className="rounded-full bg-g-gold/20 px-1.5 text-[11px] font-black tabular-nums text-g-gold">{n}</span> : null}
    </button>
  );
}

/** Uma linha da lista. O número que importa é "sem resposta há X": é ele que diz se foi abandonado. */
function LinhaChamado({ t, onOpen }) {
  const ms = semResposta(t);
  const abandonado = ms != null && ms >= ABANDONO;
  const fio = Array.isArray(t.thread) ? t.thread : [];
  const respostas = fio.filter((m) => m.role && m.role !== "client").length;
  return (
    <button type="button" onClick={onOpen}
      className={`flex w-full min-h-[64px] items-center gap-3 rounded-xl2 border px-3.5 py-2.5 text-left transition ${abandonado ? "border-amber-400/40 bg-amber-400/[0.07] hover:border-amber-400/70" : "border-white/10 bg-white/[0.04] hover:border-g-gold/40"}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold text-g-word">{t.subject || tr("Support request")}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-g-muted">
          <span className="truncate">{t.category || "—"}</span>
          <span aria-hidden>·</span>
          {ms != null ? (
            <span className="font-bold" style={{ color: abandonado ? PERDA : undefined }}>{duracao(ms)} {tr("without a reply")}</span>
          ) : respostas > 0 ? (
            <span className="font-bold" style={{ color: GANHO }}>{tr("answered")}</span>
          ) : (
            <span style={{ color: NOT_MEASURED }}>—</span>
          )}
          <span aria-hidden>·</span>
          <span>{quando(t.updated_at || t.created_at)}</span>
        </div>
      </div>
      <Chip status={t.status} />
    </button>
  );
}

/** O detalhe: a THREAD INTEIRA (era ela que nunca chegava aos olhos do cliente) + caixa de resposta. */
function Detalhe({ t, post, onBack, onReplied }) {
  const [txt, setTxt] = useState("");
  const [env, setEnv] = useState({ st: "idle" });   // idle | wait | ok | erro
  const fio = Array.isArray(t.thread) ? t.thread : [];
  const ms = semResposta(t);

  const enviar = async (e) => {
    e.preventDefault();
    const texto = txt.trim();
    if (!texto || env.st === "wait") return;
    setEnv({ st: "wait" });
    try {
      const r = await post({ action: "reply", id: t.id, text: texto });
      const { d } = r;
      // 🚨 a RPC devolve BOOLEANO: `r.ok` do fetch não prova nada. Só `replied === true` é sucesso.
      if (!r.motivo && d && d.replied === true) { setEnv({ st: "ok" }); setTxt(""); onReplied?.(); return; }
      setEnv({ st: "erro", motivo: fraseDe(r, tr("it wasn't recorded")) });
    } catch { setEnv({ st: "erro", motivo: fraseDaFalha("rede") }); }
  };

  return (
    <Card className="p-4 backdrop-blur-md">
      <div className="mb-3 flex items-start gap-2">
        <button type="button" onClick={onBack} aria-label={tr("Back")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/12 bg-white/[0.05] text-g-muted transition hover:text-g-word"><FaArrowLeft aria-hidden /></button>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold leading-snug text-g-word break-words">{t.subject || tr("Support request")}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-g-muted">
            <span>{t.category || "—"}</span><span aria-hidden>·</span><span>{quando(t.created_at)}</span>
            {ms != null && <><span aria-hidden>·</span><span className="font-bold" style={{ color: ms >= ABANDONO ? PERDA : undefined }}>{duracao(ms)} {tr("without a reply")}</span></>}
          </div>
        </div>
        <Chip status={t.status} />
      </div>

      <div className="space-y-2.5">
        {fio.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-g-muted">{tr("This ticket has no messages yet.")}</p>
        ) : fio.map((m, i) => (
          <div key={i} className={`flex ${m.role === "client" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-xl2 border px-3.5 py-2.5 text-[14px] ${m.role === "client" ? "border-g-gold/25 bg-g-gold/[0.12] text-g-word" : "border-white/10 bg-white/[0.04] text-g-word"}`}>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-g-gold/80">
                <span>{autor(m.role, m.text)}</span>
                <span className="font-normal normal-case tracking-normal text-g-muted">{m.at ? quando(m.at) : ""}</span>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed break-words">{m.text}</div>
            </div>
          </div>
        ))}
      </div>

      {t.resolution ? (
        <div className="mt-3 rounded-xl2 border border-g-green/30 bg-g-green/[0.08] px-3.5 py-2.5 text-[12.5px] text-g-light">
          <span className="font-bold">{tr("Resolution")}: </span>{t.resolution}
        </div>
      ) : null}

      <form onSubmit={enviar} className="mt-3 border-t border-white/10 pt-3">
        <textarea value={txt} onChange={(e) => { setTxt(e.target.value); if (env.st !== "idle") setEnv({ st: "idle" }); }} rows={3}
          aria-label={tr("Write a reply")} placeholder={tr("Write a reply…")}
          className="w-full rounded-xl2 border border-white/15 bg-black/20 px-3.5 py-2.5 text-[16px] text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button disabled={env.st === "wait" || !txt.trim()} className="btn-bright min-h-[48px] px-5 text-sm disabled:opacity-50">
            {env.st === "wait" ? tr("Sending…") : tr("Send reply")}
          </button>
          {env.st === "ok" && <span className="text-[12px] font-bold text-g-light">✓ {tr("Reply recorded")}</span>}
          {env.st === "erro" && <span className="text-[12px] font-bold text-amber-300">⚠️ {tr("I couldn't record your reply")}<span className="font-normal text-g-muted"> · {env.motivo}</span></span>}
        </div>
      </form>
    </Card>
  );
}

/** 2 · MEU CONSULTOR — quem é, e o caminho direto até ele. Sem consultor, o botão não existe. */
function MeuConsultor({ c, post, onRetry, onSent }) {
  const [abrir, setAbrir] = useState(false);
  const [txt, setTxt] = useState("");
  const [env, setEnv] = useState({ st: "idle" });   // idle | wait | ok | erro

  const enviar = async (e) => {
    e.preventDefault();
    const texto = txt.trim();
    if (!texto || env.st === "wait") return;
    setEnv({ st: "wait" });
    try {
      const r = await post({
        action: "create", subject: `${tr("Message for my consultant")}: ${texto.slice(0, 80)}`,
        category: "consultor", body: texto, ai_handled: false, status: "escalated", priority: "high",
      });
      const { d } = r;
      // Comprovante ou nada: `{ok:true, ready:false}` chega em HTTP 200 e NÃO é sucesso.
      if (!r.motivo && d && d.ok === true && d.ready === true && d.id) { setEnv({ st: "ok", id: d.id }); setTxt(""); setAbrir(false); onSent?.(); return; }
      setEnv({ st: "erro", motivo: d && d.ready === false ? tr("support isn't activated yet") : fraseDe(r, tr("it wasn't recorded")) });
    } catch { setEnv({ st: "erro", motivo: fraseDaFalha("rede") }); }
  };

  return (
    <Bloco title={tr("My consultant")} icon={<FaUserTie aria-hidden />}>
      {c.st === "loading" ? (
        <div className="h-[64px] animate-pulse rounded-xl2 bg-white/[0.05]" />
      ) : c.st === "fail" ? (
        <Falhou motivo={c.motivo} onRetry={onRetry} />
      ) : c.st === "sem" ? (
        <p className="text-[13px] leading-relaxed text-g-muted">{tr("You don't have a consultant assigned yet — Gui Support answers you 24/7 in the meantime.")}</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-g-gold/30 bg-g-gold/[0.12] text-[16px] font-black text-g-gold">
              {String(c.nome).trim().slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-extrabold text-g-word">{c.nome}</div>
              <div className="text-[11.5px] text-g-muted">{tr("Your Guileo consultant")}</div>
            </div>
          </div>
          {!abrir ? (
            <button type="button" onClick={() => { setAbrir(true); setEnv({ st: "idle" }); }}
              className="mt-3 inline-flex min-h-[48px] items-center rounded-full bg-g-gold px-5 text-[13px] font-black text-g-deep transition hover:brightness-110">
              {tr("Message my consultant")}
            </button>
          ) : (
            <form onSubmit={enviar} className="mt-3">
              <textarea value={txt} onChange={(e) => { setTxt(e.target.value); if (env.st !== "idle") setEnv({ st: "idle" }); }} rows={3} autoFocus
                aria-label={tr("Message my consultant")} placeholder={tr("What do you need? It goes straight to your consultant.")}
                className="w-full rounded-xl2 border border-white/15 bg-black/20 px-3.5 py-2.5 text-[16px] text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button disabled={env.st === "wait" || !txt.trim()} className="btn-bright min-h-[48px] px-5 text-sm disabled:opacity-50">{env.st === "wait" ? tr("Sending…") : tr("Send")}</button>
                <button type="button" onClick={() => { setAbrir(false); setTxt(""); }} className="min-h-[48px] rounded-full border border-white/15 px-4 text-[12.5px] font-bold text-g-muted">{tr("Cancel")}</button>
              </div>
              {env.st === "erro" && <p className="mt-2 text-[12px] font-bold text-amber-300">⚠️ {tr("I couldn't send it")}<span className="font-normal text-g-muted"> · {env.motivo}</span></p>}
            </form>
          )}
          {env.st === "ok" && (
            <p className="mt-2 text-[12px] font-bold text-g-light">✓ {tr("Sent to your consultant")} <span className="font-mono font-normal text-g-muted">#{String(env.id).slice(0, 8)}</span></p>
          )}
          <p className="mt-2 text-[11.5px] leading-snug text-g-muted">{tr("It opens a high-priority ticket, so it wakes someone up — and the whole conversation stays in My tickets.")}</p>
        </>
      )}
    </Bloco>
  );
}

/** 3 · COMO ESTAMOS INDO — a nota SEM o nome (decisão do Luis). O consultor vê média, não autoria. */
function ComoEstamos({ post, temConsultor }) {
  const [nota, setNota] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [env, setEnv] = useState({ st: "idle" });   // idle | wait | ok | erro

  const enviar = async (n) => {
    if (!n || env.st === "wait") return;
    setEnv({ st: "wait" });
    try {
      const r = await post({ action: "avaliar", nota: n, comentario: comentario.trim() || undefined });
      const { d } = r;
      // "ok" sem id é promessa sem lastro.
      if (!r.motivo && d && d.ok === true && d.id) { setEnv({ st: "ok", id: d.id, nota: n }); return; }
      setEnv({ st: "erro", motivo: fraseDe(r, tr("it wasn't recorded")) });
    } catch { setEnv({ st: "erro", motivo: fraseDaFalha("rede") }); }
  };

  const dada = env.st === "ok" ? env.nota : null;
  const mostra = hover || nota || dada || 0;

  return (
    <Bloco title={tr("How are we doing?")} icon="⭐">
      <p className="text-[12.5px] leading-relaxed text-g-muted">
        {temConsultor ? tr("Rate the service you're getting from your consultant.") : tr("Rate the service you're getting from Guileo.")}
      </p>

      <div className="mt-3 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n}`} aria-pressed={mostra >= n}
            onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)}
            onClick={() => { setNota(n); setEnv({ st: "idle" }); enviar(n); }}
            className="grid h-12 w-12 place-items-center rounded-full transition hover:bg-white/[0.06]">
            <FaStar aria-hidden className="text-[20px]" style={{ color: mostra >= n ? GANHO : NOT_MEASURED }} />
          </button>
        ))}
        <span className="ml-1 text-[13px] font-black tabular-nums" style={{ color: mostra ? GANHO : NOT_MEASURED }}>{mostra || "—"}</span>
      </div>

      <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} maxLength={800}
        aria-label={tr("Anything you'd like to add? (optional)")} placeholder={tr("Anything you'd like to add? (optional)")}
        className="mt-3 w-full rounded-xl2 border border-white/15 bg-black/20 px-3.5 py-2.5 text-[16px] text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!nota || env.st === "wait"} onClick={() => enviar(nota)}
          className="btn-bright min-h-[48px] px-5 text-sm disabled:opacity-50">{env.st === "wait" ? tr("Sending…") : tr("Send rating")}</button>
        {env.st === "ok" && (
          <span className="text-[12px] font-bold text-g-light">
            ✓ {tr("Your rating was recorded")} <span className="font-mono font-normal text-g-muted">#{String(env.id).slice(0, 8)}</span> · <span className="font-normal text-g-muted">{tr("you can change it any time")}</span>
          </span>
        )}
        {env.st === "erro" && <span className="text-[12px] font-bold text-amber-300">⚠️ {tr("I couldn't record your rating")}<span className="font-normal text-g-muted"> · {env.motivo}</span></span>}
      </div>

      <p className="mt-3 rounded-xl2 border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[11.5px] leading-snug text-g-muted">
        🔒 {tr("Anonymous: your consultant sees the average, never who rated. Comments are only shown once enough people have rated.")}
      </p>
    </Bloco>
  );
}


/* ── CHAT DIRETO COM O CONSULTOR ─────────────────────────────────────────────────────────────
   Comprovante antes de limpar o campo: só apago o que a pessoa escreveu depois de ler o `id`
   gravado. Limpar sem confirmação já apagou mensagem que nunca saiu, neste mesmo repositório. */
function ChatDoConsultor({ post, nome }) {
  const [msgs, setMsgs] = useState([]);
  const [txt, setTxt] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [naoLeu, setNaoLeu] = useState("");   // frase da falha de LEITURA do histórico

  // 🚨 (2026-09-28) Falha ao ler o histórico era ignorada: o chat aparecia VAZIO, como se o
  // consultor nunca tivesse respondido. Quem espera resposta e vê vazio conclui que foi ignorado.
  const ler = useCallback(async () => {
    const r = await post({ action: "chat_ler" });
    if (!r.motivo && r.d?.ok && Array.isArray(r.d.mensagens)) { setMsgs(r.d.mensagens.filter(Boolean)); setNaoLeu(""); }
    else setNaoLeu(fraseDe(r, fraseDaFalha("servidor")));
  }, [post]);
  useEffect(() => { ler(); }, [ler]);

  const enviar = async () => {
    const t2 = txt.trim();
    if (!t2) return;
    setEnviando(true); setErro("");
    const r = await post({ action: "chat_enviar", texto: t2 });
    if (!r.motivo && r.d?.ok && r.d.id) { setTxt(""); await ler(); }
    else setErro(fraseDe(r, tr("it wasn't recorded")));
    setEnviando(false);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">
        {tr("Talk to")} {nome || tr("your consultant")}
      </div>
      <p className="mt-1 text-[12px] text-g-muted">
        {tr("Direct line to the person who sold you Guileo — not the support queue.")}
      </p>
      {naoLeu && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-amber-300">
          <span className="min-w-0 flex-1">⚠️ {tr("I couldn't load the conversation")} · <span className="text-g-muted">{naoLeu}</span></span>
          <button type="button" onClick={ler} className="min-h-[44px] rounded-full border border-white/15 px-3.5 text-[11px] font-bold text-g-word">{tr("Try again")}</button>
        </div>
      )}
      {msgs.length > 0 && (
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {msgs.map((m) => (
            <li key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${m.autor === "cliente" ? "ml-auto bg-g-green/15 text-g-word" : "bg-white/[0.05] text-g-ink"}`}>
              {m.texto}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={tr("Write to your consultant…")}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) enviar(); }}
          className="min-w-[200px] flex-1 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-[14px] text-g-word placeholder:text-g-muted/70 focus:border-g-green/50 focus:outline-none" />
        <button type="button" onClick={enviar} disabled={enviando || !txt.trim()}
          className="inline-flex min-h-[48px] items-center rounded-full bg-g-green/20 px-5 text-[13px] font-bold text-g-green ring-1 ring-g-green/40 hover:bg-g-green/30 disabled:opacity-50">
          {enviando ? "…" : tr("Send")}
        </button>
      </div>
      {erro && <div className="mt-2 text-[12px] text-[#e0855f]">{tr("Didn't send")}: {erro}</div>}
    </div>
  );
}
