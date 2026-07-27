/* 👩‍🏫 Treinadora — the AI that TEACHES the owner to use Guileo. An interactive mission track
   (connect code → import prices → test a call → turn on reminders → send the first campaign →
   teach the business), each mission with a one-line PROFIT reason, step-by-step, a "take me there"
   button (navigates via onNav/setView), plus a "ask the trainer" chat that answers through
   /api/support with context:'trainer'. Progress lives in localStorage; a % ring sits at the top. */
import { useState, useEffect, useRef } from "react";
import { FaGraduationCap, FaCircleCheck, FaArrowRight, FaPaperPlane } from "react-icons/fa6";
import { tr, Card, GuiMark } from "../pages/Portal.jsx";
import { toast } from "../lib/portalApi.js";

const LS_KEY = "guileo_trainer_progress";
const loadProgress = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; } catch { return {}; } };
const saveProgress = (p) => { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* private mode */ } };

// The mission track. `go` = the cockpit tab the "take me there" button jumps to (all real tabs).
// `why` is a single sentence of PROFIT — never a feature description. Steps are short + literal.
const MISSIONS = [
  {
    id: "connect", icon: "🔌", go: "settings",
    title: "Conecte seu código",
    why: "Sem o código, seu cockpit mostra dados de exemplo — conectado, tudo vira REAL e você para de adivinhar.",
    steps: ["Abra Configurações (Settings)", "Cole o código de conexão que você recebeu no e-mail de boas-vindas", "O selo muda para “LIVE — dados reais” 🟢"],
  },
  {
    id: "prices", icon: "💲", go: "schedule",
    title: "Importe seus preços e serviços",
    why: "Com preços certos, a Gui FECHA na ligação (“a limpeza custa R$120”) em vez de deixar o cliente esperando o time.",
    steps: ["Abra a Agenda / Serviços", "Adicione cada serviço com preço e duração", "A Gui passa a cotar esses valores exatos na voz e no chat"],
  },
  {
    id: "teach", icon: "🧠", go: "kb",
    title: "Ensine seu negócio à Gui",
    why: "As perguntas específicas do seu negócio (estacionamento? aceita walk-in?) respondidas na hora = menos cliente perdido.",
    steps: ["Abra o “Cérebro do negócio”", "Use um dos modelos de pergunta pra preencher rápido", "Escreva a resposta — a Gui usa ela igualzinho na ligação e no chat"],
  },
  {
    id: "testcall", icon: "📞", go: "dialer",
    title: "Teste uma ligação",
    why: "Ouvir a Gui atender do seu jeito é o que dá confiança pra deixar ela cuidar de TODO cliente que liga.",
    steps: ["Abra o Discador (Call Dialer)", "Faça uma ligação de teste pro seu próprio celular", "Fale como um cliente e ouça a Gui vender e agendar"],
  },
  {
    id: "reminders", icon: "🔔", go: "riskradar",
    title: "Ative os lembretes",
    why: "Lembrete + confirmação extra nos agendamentos de risco = menos “furo” (no-show) e mais cadeira ocupada.",
    steps: ["Abra o Risk Radar", "Veja os agendamentos ranqueados por risco de falta", "Peça pra Gui mandar uma confirmação extra nos mais arriscados"],
  },
  {
    id: "campaign", icon: "📣", go: "marketing",
    title: "Mande sua 1ª campanha",
    why: "Uma campanha pra base antiga traz cliente que já te conhece de volta — a receita mais barata que existe.",
    steps: ["Abra Marketing", "Escolha uma campanha (reativação, promoção do dia parado, aniversário)", "A Gui dispara pelos canais ativos e traz os retornos pro CRM"],
  },
];

// The trainer chat. Talks to /api/support (action:"ai", context:"trainer"). Needs the tenant gate
// (email + connection key) — without a live connection we answer with a warm nudge to connect first.
function TrainerChat({ email, dataKey, lang }) {
  const [msgs, setMsgs] = useState([{ role: "gui", text: tr("Oi! Sou sua treinadora. Me pergunta qualquer coisa: “como conecto meu código?”, “como a Gui cobra na ligação?”, “como mando uma campanha?”") }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scRef = useRef(null);
  useEffect(() => { if (scRef.current) scRef.current.scrollTop = scRef.current.scrollHeight; }, [msgs, busy]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "owner", text: q }]);
    if (!email || !dataKey) {
      setMsgs((m) => [...m, { role: "gui", text: tr("Pra eu te responder com os SEUS dados, conecte seu código em Configurações primeiro — aí eu te ensino tudo passo a passo. 🌱") }]);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/support", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ai", context: "trainer", question: q, lang: lang || "pt", email, token: dataKey }),
      });
      const d = await r.json().catch(() => ({}));
      const answer = (d && d.answer) ? String(d.answer) : tr("Tive um probleminha agora — tenta de novo em instantes.");
      setMsgs((m) => [...m, { role: "gui", text: answer, escalate: d?.escalate === true }]);
    } catch {
      setMsgs((m) => [...m, { role: "gui", text: tr("Não consegui responder agora — confere sua conexão e tenta de novo.") }]);
    } finally { setBusy(false); }
  };

  return (
    <Card className="flex flex-col" tone="ai">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
        <GuiMark size={20} /> {tr("Pergunta pra treinadora")}
      </div>
      <div ref={scRef} className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "owner" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${m.role === "owner" ? "bg-white/[0.08] text-g-word" : "bg-[#FF8A33]/[0.10] text-g-word border border-[#FF8A33]/25"}`}>
              {m.text}
              {/* honest: the trainer chat doesn't open tickets — Gui Suporte (Help tab) does */}
              {m.escalate && <div className="mt-1.5 text-[11px] font-bold text-g-gold">{tr("Isso é com o time humano — abre a aba Ajuda (Gui Suporte) que lá o chamado é registrado de verdade. 🙌")}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="text-[12px] text-g-muted pl-1">{tr("digitando…")}</div>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder={tr("Escreva sua dúvida…")} className="flex-1 rounded-xl2 border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted focus:border-[#FF8A33]/50 outline-none" />
        <button onClick={send} disabled={busy || !input.trim()} className="rounded-xl2 bg-[#FF8A33] text-black font-black px-3.5 py-2.5 disabled:opacity-40 clicky" aria-label={tr("Enviar")}>
          <FaPaperPlane size={13} />
        </button>
      </div>
    </Card>
  );
}

export default function Trainer({ V, onNav, email = "", dataKey = "", lang = "" }) {
  const [progress, setProgress] = useState(loadProgress);
  const done = MISSIONS.filter((m) => progress[m.id]).length;
  const pct = Math.round((done / MISSIONS.length) * 100);

  const toggle = (id) => {
    setProgress((p) => {
      const n = { ...p, [id]: !p[id] };
      saveProgress(n);
      if (!p[id]) toast(tr("Missão concluída ✓"));
      return n;
    });
  };
  const goTo = (m) => { if (onNav) onNav(m.go); };

  return (
    <div className="space-y-4 stagger">
      {/* Header — the trainer + the progress ring */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.08] to-white/[0.02] p-5 flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: 62, height: 62 }}>
          <svg viewBox="0 0 62 62" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="31" cy="31" r="27" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="5" />
            <circle cx="31" cy="31" r="27" fill="none" stroke={pct >= 100 ? "#3E9468" : "#FF8A33"} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 169.6} 169.6`} style={{ transition: "stroke-dasharray .6s cubic-bezier(.22,.61,.36,1)" }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center"><span className="text-sm font-black num text-g-word">{pct}%</span></div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
            <FaGraduationCap size={12} /> {tr("Sua treinadora")}
          </div>
          <div className="mt-1 text-xl font-black text-g-word">{done}/{MISSIONS.length} {tr("missões concluídas")}</div>
          <p className="mt-1 text-xs text-g-muted max-w-xl">
            {pct >= 100 ? tr("Você dominou o essencial — a Gui está pronta pra crescer com você. 🌱") : tr("Em poucos passos sua Gui vira uma máquina de crescimento. Comece pela primeira missão.")}
          </p>
        </div>
      </div>

      {/* Mission cards */}
      <div className="grid gap-3 md:grid-cols-2">
        {MISSIONS.map((m) => {
          const ok = !!progress[m.id];
          return (
            <Card key={m.id} className={ok ? "opacity-80" : ""}>
              <div className="flex items-start gap-3">
                <button onClick={() => toggle(m.id)} className="shrink-0 mt-0.5" aria-label={tr("Marcar como feita")}>
                  {ok ? <FaCircleCheck size={22} style={{ color: "#3E9468" }} /> : <span className="grid place-items-center rounded-full border-2 border-white/20 text-lg" style={{ width: 22, height: 22 }}>{m.icon}</span>}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-black text-g-word ${ok ? "line-through decoration-g-green/60" : ""}`}>{tr(m.title)}</div>
                  <div className="mt-1 flex items-start gap-1.5 text-[12px] text-g-gold font-semibold">
                    <span className="shrink-0">💡</span><span>{tr(m.why)}</span>
                  </div>
                  <ol className="mt-2 space-y-1 text-[12.5px] text-g-muted list-decimal list-inside">
                    {m.steps.map((s, i) => <li key={i}>{tr(s)}</li>)}
                  </ol>
                  <button onClick={() => goTo(m)} className="mt-3 inline-flex items-center gap-1.5 rounded-xl2 border border-[#FF8A33]/40 bg-[#FF8A33]/[0.10] px-3 py-1.5 text-[12px] font-black text-g-word hover:bg-[#FF8A33]/20 transition clicky">
                    {tr("Me leva lá")} <FaArrowRight size={11} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Ask-the-trainer chat */}
      <TrainerChat email={email} dataKey={dataKey} lang={lang} />
    </div>
  );
}
