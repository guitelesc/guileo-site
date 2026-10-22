/* 👩‍🏫 Treinadora — the AI that TEACHES the owner to use Guileo. An interactive mission track
   (connect code → import prices → test a call → turn on reminders → send the first campaign →
   teach the business), each mission with a one-line PROFIT reason, step-by-step, a "take me there"
   button (navigates via onNav/setView), plus a "ask the trainer" chat that answers through
   /api/support with context:'trainer'. Progress lives in localStorage; a % ring sits at the top. */
import { useState, useEffect, useRef } from "react";
import { FaGraduationCap, FaCircleCheck, FaArrowRight, FaPaperPlane } from "react-icons/fa6";
import { tr, Card, GuiMark, UI_LANG } from "../pages/Portal.jsx";
import { toast, chamarApi } from "../lib/portalApi.js";
import { fraseDaFalha } from "./FalhaDeLeitura.jsx";
import { NOME_DO_PAINEL } from "./nome.js";

const LS_KEY = "guileo_trainer_progress";
const loadProgress = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; } catch { return {}; } };
const saveProgress = (p) => { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* private mode */ } };

// The mission track. `go` = the cockpit tab the "take me there" button jumps to (all real tabs).
// `why` is a single sentence of PROFIT — never a feature description. Steps are short + literal.
// 🌐 (2026-09-28) Tudo aqui era PORTUGUÊS FIXO passado por tr(): título, motivo e passos. Como a
// chave de tr() é o texto em inglês, uma chave em português "funcionava" só na tela em português
// — a cliente com a Central em inglês lia a trilha inteira em outro idioma, na aba que existe
// para ENSINAR. Agora é função (roda na hora de desenhar, com o dicionário já carregado) e cada
// frase é literal dentro de tr(), que é o que o teste de i18n enxerga.
// 💲 O exemplo de preço dizia "R$120" para qualquer cliente. Moeda é do NEGÓCIO, não do idioma
// da tela — e esta tela não sabe a moeda do negócio. O exemplo ficou sem valor nenhum.
const MISSION_IDS = ["connect", "prices", "teach", "testcall", "reminders", "campaign"];
const missions = () => [
  {
    id: "connect", icon: "🔌", go: "settings",
    title: tr("Connect your code"),
    // o nome do painel entra ENTRE duas chaves simples: chave com `${NOME_DO_PAINEL}` dentro exige
    // duas entradas por idioma no dicionário (a calculada e a crua, para o teste de i18n)
    why: `${tr("Without the code, your")} ${NOME_DO_PAINEL} ${tr("shows sample data — connected, everything becomes REAL and you stop guessing.")}`,
    steps: [tr("Open Settings"), tr("Paste the connection code you received in your welcome email"), tr("The badge changes to “LIVE — real data” 🟢")],
  },
  {
    id: "prices", icon: "💲", go: "schedule",
    title: tr("Add your prices and services"),
    why: tr("With the right prices, Gui CLOSES on the call — she quotes your exact price — instead of leaving the customer waiting for your team."),
    steps: [tr("Open Schedule / Services"), tr("Add each service with its price and duration"), tr("Gui starts quoting those exact amounts by voice and in chat")],
  },
  {
    id: "teach", icon: "🧠", go: "kb",
    title: tr("Teach Gui your business"),
    why: tr("The questions only your business gets (parking? walk-ins?) answered on the spot = fewer customers lost."),
    steps: [tr("Open “Business brain”"), tr("Use one of the question templates to fill it in fast"), tr("Write the answer — Gui uses it word for word on calls and in chat")],
  },
  {
    id: "testcall", icon: "📞", go: "dialer",
    title: tr("Test a call"),
    why: tr("Hearing Gui answer your way is what gives you the confidence to let her handle EVERY customer who calls."),
    steps: [tr("Open the Call Dialer"), tr("Place a test call to your own phone"), tr("Talk like a customer and listen to Gui sell and book")],
  },
  {
    id: "reminders", icon: "🔔", go: "riskradar",
    title: tr("Turn on reminders"),
    why: tr("A reminder plus an extra confirmation on risky bookings = fewer no-shows and more chairs filled."),
    steps: [tr("Open Risk Radar"), tr("See your bookings ranked by no-show risk"), tr("Ask Gui to send an extra confirmation to the riskiest ones")],
  },
  {
    id: "campaign", icon: "📣", go: "marketing",
    title: tr("Send your first campaign"),
    why: tr("A campaign to your past customers brings back people who already know you — the cheapest revenue there is."),
    steps: [tr("Open Marketing"), tr("Pick a campaign (win-back, slow-day offer, birthday)"), tr("Gui sends it through your active channels and brings the replies into your CRM")],
  },
];

// The trainer chat. Talks to /api/support (action:"ai", context:"trainer"). Needs the tenant gate
// (email + connection key) — without a live connection we answer with a warm nudge to connect first.
function TrainerChat({ email, dataKey, lang }) {
  const [msgs, setMsgs] = useState([{ role: "gui", text: tr("Hi! I'm your trainer. Ask me anything: “how do I connect my code?”, “how does Gui charge on the call?”, “how do I send a campaign?”") }]);
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
      setMsgs((m) => [...m, { role: "gui", text: tr("For me to answer with YOUR data, connect your code in Settings first — then I'll teach you everything step by step. 🌱") }]);
      return;
    }
    setBusy(true);
    // `lang || "pt"` mandava a treinadora responder em PORTUGUÊS sempre que a aba não recebia o
    // idioma por prop. O idioma de reserva é o da TELA, não o de quem escreveu o código.
    const r = await chamarApi("/api/support", { action: "ai", context: "trainer", question: q, lang: lang || UI_LANG, email, token: dataKey });
    const d = r.data;
    if (!r.motivo && d && d.answer) setMsgs((m) => [...m, { role: "gui", text: String(d.answer), escalate: d.escalate === true }]);
    else setMsgs((m) => [...m, { role: "gui", text: r.motivo ? `${tr("I couldn't answer right now.")} ${fraseDaFalha(r.motivo)}` : tr("I hit a snag just now — try again in a moment.") }]);
    setBusy(false);
  };

  return (
    <Card className="flex flex-col" tone="ai">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
        <GuiMark size={20} /> {tr("Ask your trainer")}
      </div>
      <div ref={scRef} className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "owner" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${m.role === "owner" ? "bg-white/[0.08] text-g-word" : "bg-[#FF8A33]/[0.10] text-g-word border border-[#FF8A33]/25"}`}>
              {m.text}
              {/* honest: the trainer chat doesn't open tickets — Gui Suporte (Help tab) does */}
              {m.escalate && <div className="mt-1.5 text-[11px] font-bold text-g-gold">{tr("That's for the human team — open the Help tab (Gui Support) and your request gets logged for real there. 🙌")}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="text-[12px] text-g-muted pl-1">{tr("typing…")}</div>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder={tr("Type your question…")} className="flex-1 rounded-xl2 border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted focus:border-[#FF8A33]/50 outline-none" />
        <button onClick={send} disabled={busy || !input.trim()} className="rounded-xl2 bg-[#FF8A33] text-black font-black px-3.5 py-2.5 disabled:opacity-40 clicky" aria-label={tr("Send")}>
          <FaPaperPlane size={13} />
        </button>
      </div>
    </Card>
  );
}

export default function Trainer({ V, onNav, email = "", dataKey = "", lang = "" }) {
  const [progress, setProgress] = useState(loadProgress);
  const MISSIONS = missions();
  const done = MISSION_IDS.filter((id) => progress[id]).length;
  const pct = Math.round((done / MISSION_IDS.length) * 100);

  const toggle = (id) => {
    setProgress((p) => {
      const n = { ...p, [id]: !p[id] };
      saveProgress(n);
      if (!p[id]) toast(tr("Mission completed ✓"));
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
            <FaGraduationCap size={12} /> {tr("Your trainer")}
          </div>
          <div className="mt-1 text-xl font-black text-g-word">{done}/{MISSIONS.length} {tr("missions completed")}</div>
          <p className="mt-1 text-xs text-g-muted max-w-xl">
            {pct >= 100 ? tr("You've mastered the essentials — Gui is ready to grow with you. 🌱") : tr("In a few steps your Gui becomes a growth machine. Start with the first mission.")}
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
                <button onClick={() => toggle(m.id)} className="shrink-0 mt-0.5" aria-label={tr("Mark as done")}>
                  {ok ? <FaCircleCheck size={22} style={{ color: "#3E9468" }} /> : <span className="grid place-items-center rounded-full border-2 border-white/20 text-lg" style={{ width: 22, height: 22 }}>{m.icon}</span>}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-black text-g-word ${ok ? "line-through decoration-g-green/60" : ""}`}>{m.title}</div>
                  <div className="mt-1 flex items-start gap-1.5 text-[12px] text-g-gold font-semibold">
                    <span className="shrink-0">💡</span><span>{m.why}</span>
                  </div>
                  <ol className="mt-2 space-y-1 text-[12.5px] text-g-muted list-decimal list-inside">
                    {m.steps.map((st, i) => <li key={i}>{st}</li>)}
                  </ol>
                  <button onClick={() => goTo(m)} className="mt-3 inline-flex items-center gap-1.5 rounded-xl2 border border-[#FF8A33]/40 bg-[#FF8A33]/[0.10] px-3 py-1.5 text-[12px] font-black text-g-word hover:bg-[#FF8A33]/20 transition clicky">
                    {tr("Take me there")} <FaArrowRight size={11} />
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
