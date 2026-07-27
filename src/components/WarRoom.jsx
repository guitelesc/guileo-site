import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MASTER_SENTENCE } from "../data/salesKit.js";

// WAR ROOM — os primeiros 10 clientes. O único painel que importa até o 10º "FECHADO".
// Vive no /admin (senha-gateado). Persistência: localStorage deste aparelho + export/import
// JSON (honesto: sem SQL novo — quando os 10 virarem 100, promovemos pro banco).
// Cada prospect ganha ações de 1 clique: link de demo personalizado (/demo/:slug) e
// abertura no WhatsApp com a mensagem de abordagem já preenchida.

const LS_KEY = "guileo_warroom_v1";

const STAGES = [
  ["hunt", "🎯 A abordar"],
  ["contacted", "📞 Abordado"],
  ["demo", "🤙 Demo feita"],
  ["proposal", "💰 Proposta"],
  ["won", "✅ FECHADO"],
  ["lost", "❌ Perdido"],
];

// Os 10 melhores primeiros alvos (condensado do /prospects) — vertical key casa com /demo/:slug.
const TARGETS = [
  { e: "🦷", v: "dental", n: "Clínica odontológica", where: "Google Maps “dentist near me” · IG local · nichos PT/ES", pain: "Cadeira vazia por no-show; $200+ por falta." },
  { e: "🍽️", v: "restaurant", n: "Restaurante movimentado", where: "Maps · Yelp · passar na frente no rush", pain: "No rush ninguém atende — pedido vai pro concorrente." },
  { e: "💈", v: "salon", n: "Salão / barbearia", where: "IG (booking no link) · Maps · indicação", pain: "Cortando cabelo não dá pra atender o telefone." },
  { e: "💆", v: "spa", n: "Med spa / estética", where: "IG (muito DM) · Maps", pain: "Lead caro de anúncio morre sem resposta no DM." },
  { e: "🔧", v: "plumbing", n: "HVAC / encanador", where: "Maps “24h emergency” · Nextdoor", pain: "Emergência liga em 3 lugares — o 1º que atende fecha." },
  { e: "🏠", v: "realestate", n: "Corretor de imóveis", where: "Zillow · IG · placas “for sale”", pain: "Lead esfria em minutos; em visita ninguém atende." },
  { e: "⚖️", v: "law", n: "Advocacia", where: "Maps · Avvo · grupos de imigração PT/ES", pain: "Caso de milhares cai na secretária eletrônica." },
  { e: "🏋️", v: "gym", n: "Academia / estúdio", where: "IG · Maps · ClassPass", pain: "Interessado some; cancelado nunca recebe ligação de volta." },
  { e: "🚗", v: "auto", n: "Oficina mecânica", where: "Maps “auto repair” · Yelp", pain: "Telefone toca com ele embaixo do carro — orçamento perdido." },
  { e: "🌎", v: "services", n: "Serviços bilíngues / imigração", where: "IG/FB em PT-ES · igrejas · comunidade", pain: "Cliente liga no idioma dele e ninguém atende — vai embora." },
];

// Coaching / método tips que passam no carrossel do topo (junto da frase-mãe + o placar).
const COACH = [
  { t: "Regra dos 10", d: "Nada abaixo disso importa até o 10º FECHADO — foco total no funil." },
  { t: "Demo na hora", d: "Respondeu? Manda o 🔗 link de demo NA HORA — a Gui liga em 60s e fecha por você." },
  { t: "3 por dia", d: "3 abordagens novas todo dia. Consistência ganha do talento." },
];

const slugify = (s) => (s || "negocio").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "negocio";

const approachMsg = (p) =>
  `Oi ${p.owner || "tudo bem"}! Vi ${p.business ? `a ${p.business}` : "seu negócio"} e fiquei impressionado. Pergunta rápida: quando vocês estão ocupados ou fora do horário, quem atende as ligações? ` +
  `Trabalho com uma IA que atende 24/7, agenda e vende — em PT/EN/ES. Em vez de eu explicar: ela te LIGA agora, de graça, 60 segundos, já sabendo do seu negócio. Posso mandar o link?`;

const demoUrl = (p) => {
  const q = new URLSearchParams();
  if (p.owner) q.set("n", p.owner);
  if (p.business) q.set("b", p.business);
  q.set("v", p.vertical || "restaurant");
  q.set("s", "Luis");
  q.set("lang", "pt");
  return `https://guileoai.com/demo/${slugify(p.business)}?${q.toString()}`;
};

const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } };
const save = (list) => { try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* private mode */ } };

export default function WarRoom() {
  const [list, setList] = useState(load);
  const [form, setForm] = useState({ business: "", owner: "", phone: "", vertical: "restaurant" });
  const [openTargets, setOpenTargets] = useState(false);
  const [copied, setCopied] = useState("");

  const set = (next) => { setList(next); save(next); };
  const won = list.filter((p) => p.stage === "won").length;
  const byStage = useMemo(() => Object.fromEntries(STAGES.map(([k]) => [k, list.filter((p) => p.stage === k)])), [list]);

  // Carrossel do topo: renova/passa os slides (frase-mãe → dicas de método → placar ao vivo).
  const pct = Math.min(100, won * 10);
  // barra ganha cor por progresso: baixo = âmbar (atenção), meio = Gui laranja, quase lá = verde (done).
  const barHex = won >= 8 ? "#3E9468" : won >= 4 ? "#FF8A33" : "#f2b23e";
  const SLIDES = useMemo(() => ([
    { k: "sentence" },
    ...COACH.map((c, i) => ({ k: "coach", i })),
    { k: "score" },
  ]), []);
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, [SLIDES.length]);
  const cur = SLIDES[slide] || SLIDES[0];

  const add = () => {
    if (!form.business.trim()) return;
    set([{ id: Date.now().toString(36), stage: "hunt", at: Date.now(), ...form }, ...list]);
    setForm({ business: "", owner: "", phone: "", vertical: form.vertical });
  };
  const move = (id, stage) => set(list.map((p) => (p.id === id ? { ...p, stage } : p)));
  const remove = (id) => set(list.filter((p) => p.id !== id));
  const copy = async (txt, tag) => { try { await navigator.clipboard.writeText(txt); setCopied(tag); setTimeout(() => setCopied(""), 1500); } catch { /* */ } };
  const exportJson = () => copy(JSON.stringify(list, null, 2), "export");

  const next = (stage) => STAGES[Math.min(STAGES.findIndex(([k]) => k === stage) + 1, STAGES.length - 2)][0]; // never auto-advance into "lost"

  const field = "rounded-lg border border-g-line bg-white/[0.05] px-2.5 py-2 text-[12.5px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50";

  return (
    <div className="flex h-full flex-col rounded-2xl border border-g-gold/40 bg-gradient-to-b from-g-gold/[0.07] to-white/[0.03] p-5">
      {/* header — carrossel que renova e passa os slides (frase-mãe · método · placar ao vivo) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-g-gold">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#FF8A33", boxShadow: "0 0 8px #FF8A33" }} />
          🔥 War Room — os primeiros 10
        </div>
        {/* pontinhos do carrossel */}
        <div className="flex items-center gap-1">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setSlide(i)} aria-label={`slide ${i + 1}`}
              className="h-1.5 rounded-full transition-all" style={{ width: i === slide ? 16 : 6, background: i === slide ? "#D6C29A" : "rgba(214,194,154,0.30)" }} />
          ))}
        </div>
      </div>
      <div className="relative mt-2 min-h-[76px] overflow-hidden rounded-xl border border-g-gold/20 bg-white/[0.03] px-4 py-3">
        <AnimatePresence mode="wait">
          <motion.div key={slide} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5, ease: "easeOut" }}>
            {cur.k === "sentence" && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-g-gold/70">Frase-mãe</div>
                <p className="mt-1 text-[13px] italic leading-snug text-g-light/90">“{MASTER_SENTENCE.pt}”</p>
              </div>
            )}
            {cur.k === "coach" && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>💡 {COACH[cur.i].t}</div>
                <p className="mt-1 text-[13px] leading-snug text-g-word">{COACH[cur.i].d}</p>
              </div>
            )}
            {cur.k === "score" && (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-g-green">Placar ao vivo</div>
                  <p className="mt-1 text-[12.5px] text-g-muted">Rumo ao 10º FECHADO — cada um vale ouro.</p>
                </div>
                <div className="text-right leading-none">
                  <div className="text-4xl font-black"><span style={{ color: barHex }}>{won}</span><span className="text-g-muted">/10</span></div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-g-muted">fechados</div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {/* barra dinâmica — anima a largura + cor de sinal por progresso + brilho suave */}
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-[600ms] ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${barHex}, ${barHex}bb)`, boxShadow: `0 0 14px ${barHex}88` }} />
      </div>

      {/* adicionar prospect */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} placeholder="Negócio (ex: Pizzaria do Tony)" className={`${field} w-44 flex-1 min-w-[10rem]`} />
        <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Dono (ex: Tony)" className={`${field} w-28 min-w-0 flex-1 sm:flex-none`} />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 917…" className={`${field} w-28 min-w-0 flex-1 sm:flex-none`} />
        <select value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })} className={`${field} w-full min-w-0 sm:w-auto`} aria-label="Vertical">
          {TARGETS.map((t) => <option key={t.v} value={t.v}>{t.e} {t.n}</option>)}
        </select>
        <button onClick={add} className="w-full rounded-full bg-gradient-to-br from-g-green to-g-dark px-4 py-2 text-[12.5px] font-bold text-white hover:scale-[1.03] transition sm:w-auto">+ Adicionar</button>
      </div>

      {/* funil */}
      <div className="mt-4 space-y-3">
        {STAGES.map(([key, label]) => (
          <div key={key}>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-muted">
              {label} <span className="rounded-full bg-white/10 px-1.5 text-[10px]">{byStage[key].length}</span>
            </div>
            {byStage[key].length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-1.5 text-[11.5px] text-g-muted/50">—</div>
            ) : byStage[key].map((p) => (
              <div key={p.id} className={`mb-1.5 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${key === "won" ? "border-g-green/40 bg-g-green/[0.07]" : key === "lost" ? "border-white/10 bg-white/[0.02] opacity-60" : "border-white/15 bg-white/[0.04]"}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-g-word">{TARGETS.find((t) => t.v === p.vertical)?.e || "🏪"} {p.business}</div>
                  <div className="truncate text-[11px] text-g-muted">{p.owner}{p.phone ? ` · ${p.phone}` : ""}</div>
                </div>
                {/* ações de 1 clique */}
                <button onClick={() => copy(demoUrl(p), p.id + "demo")} title="Copiar link de demo personalizado" className="shrink-0 whitespace-nowrap rounded-full border border-g-gold/35 bg-g-gold/10 px-2.5 py-1 text-[11px] font-bold text-g-gold hover:bg-g-gold/20 transition">{copied === p.id + "demo" ? "✓ copiado" : "🔗 demo"}</button>
                {p.phone && (
                  <a href={`https://wa.me/${p.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(approachMsg(p))}`} target="_blank" rel="noopener noreferrer" className="shrink-0 whitespace-nowrap rounded-full border border-g-green/35 bg-g-green/10 px-2.5 py-1 text-[11px] font-bold text-g-green hover:bg-g-green/20 transition">💬 abordar</a>
                )}
                {key !== "won" && key !== "lost" && (
                  <>
                    <button onClick={() => move(p.id, next(p.stage))} title="Avançar etapa" className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-bold text-g-word hover:border-g-green/50 transition">→</button>
                    <button onClick={() => move(p.id, "lost")} title="Marcar perdido" className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-g-muted hover:text-[#e0855f] transition">✕</button>
                  </>
                )}
                {(key === "won" || key === "lost") && (
                  <button onClick={() => remove(p.id)} title="Remover" className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-g-muted hover:text-g-word transition">🗑</button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* os 10 alvos + rodapé */}
      <button onClick={() => setOpenTargets(!openTargets)} className="mt-4 text-[12px] font-bold text-g-gold hover:underline">
        {openTargets ? "▾" : "▸"} 🎯 Os 10 melhores tipos de alvo (onde achar + a dor)
      </button>
      {openTargets && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {TARGETS.map((t) => (
            <div key={t.v} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <div className="text-[12.5px] font-bold text-g-word">{t.e} {t.n}</div>
              <div className="mt-0.5 text-[11px] text-g-muted"><b className="text-g-light/80">Onde:</b> {t.where}</div>
              <div className="text-[11px] text-g-muted"><b className="text-[#e0855f]">Dor:</b> {t.pain}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10.5px] text-g-muted/70">
        <span>Salvo neste aparelho · <button onClick={exportJson} className="underline hover:text-g-word">{copied === "export" ? "✓ copiado" : "exportar JSON"}</button></span>
        <a href="/prospects" className="underline hover:text-g-word">kit completo →</a>
      </div>
    </div>
  );
}
