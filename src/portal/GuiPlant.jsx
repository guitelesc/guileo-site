/* GuiPlant — the living identity. A plant that literally blooms with the REAL value Gui
   generated THIS month. Five stages tied to hard dollar thresholds, so the owner reads
   "how am I doing?" at a glance without a single number if they want. Demo mode shows a
   healthy mid-stage. Pure presentational — takes the month value the Overview already
   computes from the real event ledger; no data fetching of its own. */
import { tr, UI_LANG } from "../pages/Portal.jsx";

// 🌰 seed → 🌱 sprout → 🌿 seedling → 🪴 plant → 🌸 flower — gated on real monthly value ($).
const STAGES = ["🌰", "🌱", "🌿", "🪴", "🌸"];
const THRESHOLDS = [0, 100, 500, 2000, 5000]; // dollars: index i reached when value >= THRESHOLDS[i]

function stageFor(value) {
  let s = 0;
  for (let i = 0; i < THRESHOLDS.length; i++) if (value >= THRESHOLDS[i]) s = i;
  return s;
}

// Per-stage caption in the portal language (en default; pt/es/hi native).
const CAPTIONS = {
  en: ["planting the first seed", "sprouting", "growing strong", "firm and healthy", "in full bloom"],
  pt: ["plantando a primeira semente", "brotando", "crescendo forte", "firme e saudável", "florescendo"],
  es: ["plantando la primera semilla", "brotando", "creciendo fuerte", "firme y sana", "floreciendo"],
  hi: ["पहला बीज बो रही है", "अंकुरित हो रही है", "मज़बूती से बढ़ रही है", "मज़बूत और स्वस्थ", "पूरी तरह खिली हुई"],
};
const L = () => (["en", "pt", "es", "hi"].includes(UI_LANG) ? UI_LANG : "en");
// "Your Gui generated $X this month" — the money sentence, localized.
const genLine = (money) => {
  const amt = `$${Number(money || 0).toLocaleString()}`;
  const l = L();
  return l === "pt" ? `Sua Gui gerou ${amt} esse mês`
    : l === "es" ? `Tu Gui generó ${amt} este mes`
    : l === "hi" ? `आपकी Gui ने इस महीने ${amt} कमाया`
    : `Your Gui generated ${amt} this month`;
};
const title = () => { const l = L(); return l === "pt" ? "Sua planta Gui" : l === "es" ? "Tu planta Gui" : l === "hi" ? "आपका Gui पौधा" : "Your Gui plant"; };
const demoHint = () => { const l = L(); return l === "pt" ? "Cresce com o valor que a Gui gera pra você" : l === "es" ? "Crece con el valor que Gui genera para ti" : l === "hi" ? "जो मूल्य Gui बनाती है उसके साथ बढ़ता है" : "It grows with the value Gui generates for you"; };

// Progress toward the NEXT stage (for the thin growth bar). At full bloom the bar reads 100%.
function nextStageProgress(value, stage) {
  if (stage >= STAGES.length - 1) return 1;
  const lo = THRESHOLDS[stage], hi = THRESHOLDS[stage + 1];
  return Math.max(0, Math.min(1, (value - lo) / (hi - lo || 1)));
}

function GuiPlant({ monthValue = null, demo = false }) {
  const value = Math.max(0, Number(monthValue) || 0);
  const stage = demo ? 2 : stageFor(value);       // demo → 3rd stage (🌿), a healthy example
  const bloom = stage >= STAGES.length - 1;
  const cap = CAPTIONS[L()][stage];
  const prog = demo ? 0.5 : nextStageProgress(value, stage);
  return (
    <div className="rounded-xl2 border border-g-green/25 bg-gradient-to-br from-g-green/[0.08] to-transparent p-4 flex items-center gap-4">
      {/* key={stage} remounts the emoji so the grow-in animation replays on every stage-up.
          gui-plant-sway = a slow, subtle breathing sway (prefers-reduced-motion safe below). */}
      <span key={stage} aria-hidden
        className="plant-stage gui-plant-sway grid place-items-center h-14 w-14 rounded-full bg-g-green/10 text-3xl shrink-0"
        style={{ boxShadow: bloom ? "0 0 22px rgba(62,148,104,.45)" : "inset 0 0 0 1px rgba(62,148,104,.25)" }}>
        {STAGES[stage]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold uppercase tracking-wide text-g-green flex items-center gap-2">
          🌱 {title()}
          {bloom && <span className="text-[10px] font-black text-g-green normal-case">🎉 {tr("in full bloom") || "in full bloom"}</span>}
        </div>
        <div className="text-sm font-extrabold text-g-word mt-0.5 truncate">
          {demo ? demoHint() : genLine(value)}{!demo && <span className="text-g-muted font-semibold"> — {cap}.</span>}
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(4, Math.round(prog * 100))}%`, background: bloom ? "linear-gradient(90deg,#FF3D8B,#FF85B4)" : "linear-gradient(90deg,#3E9468,#6fce9d)", boxShadow: bloom ? "0 0 12px rgba(255,61,139,.5)" : "0 0 10px rgba(62,148,104,.4)" }} />
        </div>
      </div>
      {/* Self-contained sway keyframe — no global CSS dependency, reduced-motion aware. */}
      <style>{`
        @keyframes guiPlantSway { 0%,100%{ transform:rotate(-2.5deg) translateY(0); } 50%{ transform:rotate(2.5deg) translateY(-1px); } }
        .gui-plant-sway{ animation:guiPlantSway 4.5s ease-in-out infinite; transform-origin:50% 85%; }
        @media (prefers-reduced-motion: reduce){ .gui-plant-sway{ animation:none !important; } }
      `}</style>
    </div>
  );
}

export default GuiPlant;
