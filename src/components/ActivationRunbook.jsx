import { useState } from "react";

// The Client #1 activation runbook — the 7 steps from "hi" to first money, shown inside BOTH the
// /admin (ops) and the /vendedor hub (Ativação tab). Token-based (g-*) so it adapts to the light
// admin and the dark hub. Progress is remembered per-browser. Keep in sync with the artifact + ROTA-ATIVAR.
const STEPS = [
  { id: "cadastro", ic: "🚀", who: "op",
    name: { pt: "Cadastrar o cliente → a Gui dedicada nasce", en: "Register the client → the dedicated Gui is born", es: "Registrar al cliente → nace la Gui dedicada" },
    lights: { pt: "O negócio vira um agente Gui próprio (nome, voz, logo, canais dele)", en: "The business becomes its own Gui agent (its name, voice, logo, channels)", es: "El negocio se vuelve su propio agente Gui (nombre, voz, logo, canales)" },
    where: { pt: "No /admin → 🚀 Ativar cliente, ou o vendedor preenche o Cadastro Completo em /vendedor e o Luis aprova em 1 clique.", en: "In /admin → 🚀 Activate client, or the seller fills the full intake in /vendedor and Luis approves in 1 click.", es: "En /admin → 🚀 Activar cliente, o el vendedor llena el alta en /vendedor y Luis aprueba en 1 clic." },
    proof: { pt: "Aparece na carteira do /admin + vira linha em client_agents.", en: "Shows in the /admin wallet + becomes a client_agents row.", es: "Aparece en la cartera de /admin + fila en client_agents." } },
  { id: "numero", ic: "📞", who: "op",
    name: { pt: "Dar voz — mapear o número", en: "Give it a voice — map the number", es: "Darle voz — mapear el número" },
    lights: { pt: "A Gui ganha um número (Twilio) que toca pra atender ligações", en: "Gui gets a number (Twilio) that rings to answer calls", es: "Gui obtiene un número (Twilio) que suena para atender" },
    where: { pt: "No /admin → 'Mapear número' — escolhe um número livre do estoque e vincula ao cliente.", en: "In /admin → 'Map number' — pick a free number from stock and bind it to the client.", es: "En /admin → 'Mapear número' — elige un número libre y vincúlalo al cliente." },
    proof: { pt: "Número entra em client_integrations; uma ligação de teste é atendida pela voz da Gui.", en: "Number lands in client_integrations; a test call is answered by Gui's voice.", es: "El número entra en client_integrations; una llamada de prueba la atiende Gui." } },
  { id: "cockpit", ic: "🔑", who: "cli",
    name: { pt: "Cliente entra no cockpit", en: "Client logs into the cockpit", es: "El cliente entra al cockpit" },
    lights: { pt: "O dono vê tudo que a Gui faz, em tempo real", en: "The owner sees everything Gui does, in real time", es: "El dueño ve todo lo que hace Gui, en tiempo real" },
    where: { pt: "Ele entra em guileoai.com/portal com o e-mail + código de conexão (já vem pronto pra mandar no WhatsApp).", en: "They log into guileoai.com/portal with their email + connection code (ready to send on WhatsApp).", es: "Entra en guileoai.com/portal con su email + código de conexión (listo para enviar por WhatsApp)." },
    proof: { pt: "Login abre o cockpit em modo dados-reais (não demo).", en: "Login opens the cockpit in real-data mode (not demo).", es: "El login abre el cockpit en modo datos-reales (no demo)." } },
  { id: "linha", ic: "↪️", who: "cli",
    name: { pt: "Redirecionar a linha do negócio", en: "Forward the business line", es: "Desviar la línea del negocio" },
    lights: { pt: "As ligações que iam pro telefone dele agora caem na Gui 24/7", en: "Calls that went to their phone now land on Gui 24/7", es: "Las llamadas que iban a su teléfono ahora caen en Gui 24/7" },
    where: { pt: "O dono ativa o desvio: *72 + número Guileo (o Copiloto de Ativação explica passo-a-passo).", en: "The owner sets call forwarding: *72 + Guileo number (the Activation Copilot walks them through it).", es: "El dueño activa el desvío: *72 + número Guileo (el Copiloto de Activación lo guía)." },
    proof: { pt: "Uma ligação REAL pro número do negócio é atendida pela Gui.", en: "A REAL call to the business number is answered by Gui.", es: "Una llamada REAL al número del negocio la atiende Gui." } },
  { id: "cardapio", ic: "📋", who: "cli",
    name: { pt: "Carregar cardápio / serviços + preços", en: "Load menu / services + prices", es: "Cargar menú / servicios + precios" },
    lights: { pt: "A Gui passa a citar os preços e serviços EXATOS do negócio", en: "Gui starts quoting the business's EXACT prices and services", es: "Gui cita los precios y servicios EXACTOS del negocio" },
    where: { pt: "No cockpit, aba Treinar a IA / Serviços — o dono confirma cardápio e preços.", en: "In the cockpit, Train your AI / Services — the owner confirms menu and prices.", es: "En el cockpit, Entrena tu IA / Servicios — el dueño confirma menú y precios." },
    proof: { pt: "Numa ligação de teste, a Gui cita o preço certo — sem inventar.", en: "On a test call, Gui quotes the right price — no making it up.", es: "En una llamada de prueba, Gui cita el precio correcto." } },
  { id: "stripe", ic: "💳", who: "cli",
    name: { pt: "Conectar o Stripe → a Gui COBRA na conta dele", en: "Connect Stripe → Gui CHARGES into their account", es: "Conectar Stripe → Gui COBRA en su cuenta" },
    lights: { pt: "O passo que fecha o ciclo: o dinheiro cai na conta bancária DO CLIENTE", en: "The step that closes the loop: money lands in the CLIENT's bank account", es: "El paso que cierra el ciclo: el dinero cae en la cuenta DEL CLIENTE" },
    where: { pt: "O cockpit mostra o banner 'Conecte seu Stripe' → leva pra /receber → onboarding Stripe (2 min).", en: "The cockpit shows the 'Connect your Stripe' banner → to /receber → Stripe onboarding (2 min).", es: "El cockpit muestra el banner 'Conecta tu Stripe' → a /receber → onboarding Stripe (2 min)." },
    proof: { pt: "client_integrations (stripe) vai de 0→1 com uma conta acct_…; a Gui gera link de cobrança real.", en: "client_integrations (stripe) goes 0→1 with an acct_…; Gui generates a real charge link.", es: "client_integrations (stripe) va de 0→1 con acct_…; Gui genera un link de cobro real." } },
  { id: "golive", ic: "🎬", who: "op",
    name: { pt: "Go live — a primeira ligação de verdade", en: "Go live — the first real call", es: "Salir en vivo — la primera llamada real" },
    lights: { pt: "Ativação completa: uma jornada real ponta-a-ponta prova tudo", en: "Full activation: one real end-to-end journey proves it all", es: "Activación completa: un recorrido real prueba todo" },
    where: { pt: "Ligue pro número do negócio como um cliente final. Peça algo que a Gui deva fechar (agendar/cobrar).", en: "Call the business number as an end customer. Ask for something Gui should close (book/charge).", es: "Llama al número del negocio como cliente final. Pide algo que Gui deba cerrar (agendar/cobrar)." },
    proof: { pt: "Atende → qualifica → agenda/cobra → aparece no cockpit → dinheiro entra. Cliente #1 no ar.", en: "Answers → qualifies → books/charges → shows in cockpit → money in. Client #1 live.", es: "Atiende → califica → agenda/cobra → aparece en el cockpit → entra dinero. Cliente #1 en vivo." } },
];

const CHECK = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

export default function ActivationRunbook({ lang = "pt" }) {
  const L = lang === "en" ? "en" : lang === "es" ? "es" : "pt";
  const [state, setState] = useState(() => { try { return JSON.parse(localStorage.getItem("guileo_cli1") || "{}"); } catch { return {}; } });
  const [open, setOpen] = useState("");
  const save = (s) => { setState(s); try { localStorage.setItem("guileo_cli1", JSON.stringify(s)); } catch { /* */ } };
  const toggle = (id) => save({ ...state, [id]: !state[id] });
  const done = STEPS.filter((s) => state[s.id]).length;
  const pct = Math.round((done / STEPS.length) * 100);
  const WHO = {
    op: { pt: "você faz", en: "you do", es: "tú haces", tone: "border-g-gold/45 bg-g-gold/10 text-g-gold" },
    cli: { pt: "o cliente faz", en: "client does", es: "el cliente", tone: "border-sky-400/45 bg-sky-400/10 text-sky-600" },
  };
  const T = { pt: { title: "Runbook do Cliente #1", sub: "Do “oi” ao primeiro dinheiro — 7 passos. O passo 6 (Stripe) é o que faz o dinheiro fluir.", where: "Onde / como", proof: "Prova" },
              en: { title: "Client #1 Runbook", sub: "From “hi” to first money — 7 steps. Step 6 (Stripe) is what makes money flow.", where: "Where / how", proof: "Proof" },
              es: { title: "Runbook del Cliente #1", sub: "Del “hola” al primer dinero — 7 pasos. El paso 6 (Stripe) hace fluir el dinero.", where: "Dónde / cómo", proof: "Prueba" } }[L];

  return (
    <div className="rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">🚀 {T.title}</div>
          <p className="text-[12px] text-g-muted max-w-md">{T.sub}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="text-[20px] font-black tabular-nums text-g-word">{done}<span className="text-[12px] text-g-muted font-bold">/{STEPS.length}</span></div>
          <div className="h-2 w-24 rounded-full bg-g-line/60 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-gold to-g-green transition-all" style={{ width: pct + "%" }} /></div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {STEPS.map((s, i) => {
          const isDone = !!state[s.id];
          const isOpen = open === s.id;
          const w = WHO[s.who];
          return (
            <div key={s.id} className={`rounded-xl border bg-white/[0.03] overflow-hidden transition ${isDone ? "border-g-green/40" : "border-g-line"}`}>
              <div className="flex items-start gap-3 px-3.5 py-3">
                <button onClick={() => toggle(s.id)} aria-label="feito" className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${isDone ? "border-g-green bg-g-green text-g-deep" : "border-g-line text-transparent hover:border-g-green"}`}>{CHECK}</button>
                <button onClick={() => setOpen(isOpen ? "" : s.id)} className="flex flex-1 items-start gap-3 text-left min-w-0">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[12px] font-black ${isDone ? "border-g-green/40 bg-g-green/10 text-g-green" : "border-g-gold/30 bg-g-gold/10 text-g-gold"}`}>{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-bold text-g-word">{s.ic} {s.name[L]}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide ${w.tone}`}>{w[L]}</span>
                    </span>
                    <span className="block text-[11.5px] text-g-muted mt-0.5">{s.lights[L]}</span>
                  </span>
                  <span className={`shrink-0 pt-1 text-[12px] text-g-muted transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                </button>
              </div>
              {isOpen && (
                <div className="px-3.5 pb-3.5 pl-[52px] space-y-2.5">
                  <div><div className="text-[10px] font-black uppercase tracking-wide text-g-muted/70 mb-0.5">{T.where}</div><div className="text-[12.5px] text-g-word">{s.where[L]}</div></div>
                  <div className="rounded-lg border border-sky-400/25 bg-sky-400/[0.06] px-3 py-2 text-[12px] text-g-muted"><b className="text-sky-600 font-bold">{T.proof}:</b> {s.proof[L]}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
