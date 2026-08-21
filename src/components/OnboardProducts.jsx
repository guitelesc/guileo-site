import { PRODUCTS, PRODUCT_DETAIL, productDetail, PILARES } from "../data/productSystem.js";
import { PILLAR_COPY } from "./PillarsProducts.jsx";
import { GANHO } from "../lib/reportScale.js";

// OnboardProducts — A TELA DOS 18 PRODUTOS do quiz de cadastro (/vendedor → Cadastrar cliente).
//
// POR QUE ESTA TELA EXISTE (Luis, 2026-08-20): «o hub tem que ter LISTA dos nossos produtos,
// principalmente no quiz: site, app, software, automação, ads, conteúdo, criação, AI text, social
// media management, TUDO. E combine os produtos de acordo com os serviços, com a OBVIEDADE do uso
// de tudo.» O cadastro capturava canais e horário e não mencionava UMA VEZ o que a Guileo vende.
//
// ⚠️ NADA AQUI É REDIGITADO. Nome, ícone e perna vêm de `PRODUCTS`; nome/cor/ícone da perna vêm de
// `PILLAR_COPY`; o prazo vem de `PRODUCT_DETAIL`. É a mesma lei que já pegou a landing anunciando
// seis produtos que não existiam: lista escrita à mão diverge da fonte no dia em que alguém mexe
// num lado só — e aqui o lado que diverge é o que o VENDEDOR fala na frente do cliente.
//
// ── A OBVIEDADE (o pedido literal) ────────────────────────────────────────────────────────────
// Listar não basta: 18 nomes em fila é inventário, não entendimento. A linha do topo diz como as
// três pernas se encaixam — sem cérebro ninguém atende, sem coração nada entra, sem corpo nada se
// sustenta — e é ela que faz o cliente ver por que a lista inteira faz sentido junta.
//
// ── DOIS TIPOS DE PRAZO QUE NÃO PODEM PARECER IGUAIS ──────────────────────────────────────────
// "no ar em ~7 dias" é COMPROMISSO NOSSO (verde, GANHO). "precisa do Stripe conectado" é INSUMO
// DE TERCEIRO (âmbar, rotulado "depende de:"). Pintar os dois da mesma cor ensina o vendedor a
// tratar a pendência do cliente como atraso nosso — e é assim que "precisa dos preços" vira
// desculpa em vez de cobrança. A heurística lê o texto EN da fonte: começa com "live in" → tempo.
// Produto sem prazo na fonte não ganha chip nenhum. Inventar prazo para emparelhar a lista é
// exatamente a mentira que este repositório já pagou caro (preço-âncora, catálogo colapsado).
const AMBAR = "#D9A441";

// ❤️ no contexto de VENDA — o mesmo override do Growth Report. O ícone do AD na landing é 📈, mas
// quem explica as três pernas na frente do cliente fala em cérebro/coração/corpo; o vendedor
// apontando para um gráfico enquanto diz "coração" é o documento contradizendo a boca dele.
const ICON_VENDA = { brain: "🧠", ad: "❤️", build: "🏗️" };

const OBVIEDADE = {
  en: "🧠 the brain answers and closes · ❤️ the heart brings the demand · 🏗️ the body holds it all up. Without the brain nobody answers, without the heart nothing comes in, without the body none of it stands.",
  pt: "🧠 o cérebro atende e fecha · ❤️ o coração traz a demanda · 🏗️ o corpo sustenta e cobra. Sem cérebro ninguém atende, sem coração nada entra, sem corpo nada disso se sustenta.",
  es: "🧠 el cerebro atiende y cierra · ❤️ el corazón trae la demanda · 🏗️ el cuerpo lo sostiene todo. Sin cerebro nadie atiende, sin corazón no entra nada, sin cuerpo nada de esto se sostiene.",
  hi: "🧠 दिमाग़ जवाब देता है और सौदा बंद करता है · ❤️ दिल माँग लाता है · 🏗️ शरीर सब कुछ थामे रखता है। दिमाग़ के बिना कोई जवाब नहीं देता, दिल के बिना कुछ नहीं आता, शरीर के बिना कुछ भी नहीं टिकता।",
};

const TXT = {
  en: { picked: "picked", suggest: "suggested", pickSuggested: "Select the suggested ones", clear: "Clear", dependsOn: "depends on", whenLabel: "What each pick delivers", none: "Nothing picked yet — tap the cards above." },
  pt: { picked: "escolhidos", suggest: "sugerido", pickSuggested: "Marcar os sugeridos", clear: "Limpar", dependsOn: "depende de", whenLabel: "O que cada escolha entrega", none: "Nada escolhido ainda — toque nas fichas acima." },
  es: { picked: "elegidos", suggest: "sugerido", pickSuggested: "Marcar los sugeridos", clear: "Limpiar", dependsOn: "depende de", whenLabel: "Qué entrega cada elección", none: "Nada elegido aún — toca las fichas de arriba." },
  hi: { picked: "चुने गए", suggest: "सुझाया", pickSuggested: "सुझाए गए चुनें", clear: "साफ़ करें", dependsOn: "इस पर निर्भर", whenLabel: "हर चुनाव क्या देता है", none: "अभी कुछ नहीं चुना — ऊपर की फ़िश दबाएँ।" },
};

// tempo (compromisso nosso) × condição (insumo de terceiro) — decidido pelo texto EN da FONTE.
export const prazoKind = (id) => {
  const en = PRODUCT_DETAIL[id]?.prazo?.en;
  if (!en) return null;
  return /^live in/i.test(en) ? "tempo" : "condicao";
};

export default function OnboardProducts({ lang = "pt", selected = [], onToggle, onSet, suggested = [] }) {
  const t = TXT[lang] || TXT.en;
  const pc = PILLAR_COPY[lang] || PILLAR_COPY.en;
  const pilarInfo = (k) => (pc.pillars || []).find((p) => p.pilar === k) || { badge: k, accent: "#948C7B" };
  const sel = new Set(selected);
  const sug = new Set(suggested);

  return (
    <div className="space-y-4">
      {/* a obviedade — uma linha, acima da lista, nos 4 idiomas */}
      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[14px] leading-relaxed text-g-ink">
        {OBVIEDADE[lang] || OBVIEDADE.en}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold text-g-muted">{selected.length} {t.picked}</span>
        {suggested.length > 0 && (
          <button type="button" onClick={() => onSet && onSet([...new Set([...selected, ...suggested])])}
            className="min-h-[44px] rounded-full border border-g-green/35 bg-g-green/[0.10] px-3.5 text-[13px] font-bold text-g-green">
            ✨ {t.pickSuggested}
          </button>
        )}
        {selected.length > 0 && (
          <button type="button" onClick={() => onSet && onSet([])}
            className="min-h-[44px] rounded-full border border-white/15 px-3.5 text-[13px] font-bold text-g-muted hover:text-g-word">{t.clear}</button>
        )}
      </div>

      {PILARES.map((k) => {
        const info = pilarInfo(k);
        const itens = PRODUCTS.filter((p) => p.pilar === k);
        if (!itens.length) return null; // pilar sem produto na fonte renderiza VAZIO — nunca reserva à mão
        return (
          <div key={k} className="rounded-xl border p-3.5" style={{ borderColor: `${info.accent}44`, background: `${info.accent}0d` }}>
            <div className="flex items-baseline gap-2">
              <span className="text-[17px]">{ICON_VENDA[k]}</span>
              <span className="text-[14px] font-black" style={{ color: info.accent }}>{info.badge}</span>
              {info.owns && <span className="text-[12.5px] text-g-muted">· {info.owns}</span>}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {itens.map((p) => {
                const on = sel.has(p.id);
                const nome = (p.name && (p.name[lang] || p.name.en)) || p.id;
                return (
                  <button key={p.id} type="button" onClick={() => onToggle && onToggle(p.id)} aria-pressed={on}
                    className={`flex min-h-[56px] w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${on ? "" : "border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
                    style={on ? { background: `${info.accent}22`, boxShadow: `inset 0 0 0 2px ${info.accent}` } : undefined}>
                    <span className="text-[18px] leading-none">{p.icon}</span>
                    <span className={`flex-1 text-[14px] font-bold leading-snug ${on ? "text-g-word" : "text-g-ink"}`}>{nome}</span>
                    {!on && sug.has(p.id) && <span className="shrink-0 rounded-full bg-g-green/15 px-2 py-0.5 text-[10.5px] font-black uppercase text-g-green">{t.suggest}</span>}
                    {on && <span className="shrink-0 text-[15px]" style={{ color: info.accent }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* PRAZOS dos escolhidos — verde = compromisso nosso · âmbar = insumo que o CLIENTE precisa dar */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="text-[11px] font-black uppercase tracking-wider text-g-muted">{t.whenLabel}</div>
        {selected.length === 0 ? (
          <p className="mt-2 text-[13px] text-g-muted">{t.none}</p>
        ) : (
          <div className="mt-2.5 space-y-1.5">
            {selected.map((id) => {
              const p = PRODUCTS.find((x) => x.id === id);
              if (!p) return null;
              const kind = prazoKind(id);
              const d = kind ? productDetail(id, lang) : null;
              const nome = (p.name && (p.name[lang] || p.name.en)) || id;
              return (
                <div key={id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
                  <span className="text-g-ink">{p.icon} {nome}</span>
                  {kind === "tempo" && (
                    <span className="rounded-full px-2 py-0.5 text-[12px] font-bold" style={{ background: `${GANHO}1f`, color: GANHO }}>✓ {d.prazo}</span>
                  )}
                  {kind === "condicao" && (
                    <span className="rounded-full px-2 py-0.5 text-[12px] font-bold" style={{ background: `${AMBAR}22`, color: AMBAR }}>
                      ⏳ {t.dependsOn}: {d.prazo}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
