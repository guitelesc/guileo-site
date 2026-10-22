import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { waLink } from "../data/contact.js";

const VoiceWeb = lazy(() => import("../components/VoiceWeb.jsx"));
const LiveCallBar = lazy(() => import("../components/LiveCallBar.jsx"));
const GuiChat = lazy(() => import("../components/GuiChat.jsx"));
const TenantChat = lazy(() => import("../components/TenantChat.jsx"));

// ─────────────────────────────────────────────────────────────────────────────
// A CAMADA DE IA DO MOTOR — montada pelo Novo.jsx em TODO site do /novo.
//
// Decisões do Luis:
//  · UM botão só, na MARCA E COM O MASCOTE DO CLIENTE ("tirar esse botão estilo
//    AI"). O convite genérico da Guileo (VoiceAgent) NÃO entra em site de cliente:
//    ele traz a cara da nossa marca pra dentro da marca dele. Aqui a gente compõe
//    o mesmo motor (VoiceWeb + LiveCallBar) dentro de um painel na cor dele.
//  · Chat de texto só no horário comercial de NY (/api/gui-chat gasta Anthropic
//    por visitante curioso). Voz + ligação: sempre.
//  · Nada flutuante em cima do CTA: coluna única à direita, só depois da hero.
// ─────────────────────────────────────────────────────────────────────────────

function isBusinessHours() {
  try {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false, weekday: "short" }).formatToParts(new Date());
    const h = Number(p.find((x) => x.type === "hour")?.value);
    const d = p.find((x) => x.type === "weekday")?.value;
    return !["Sat", "Sun"].includes(d) && h >= 9 && h < 18;
  } catch { return false; }
}

const FEATURES = [
  ["AI answers every call", "24/7, in your name — books, quotes, sells."],
  ["AI calls new leads in 60s", "Form or missed call → it dials back before they cool."],
  ["Missed-call text-back", "Instant SMS the second a call is missed."],
  ["AI booking on this site", "Every form here feeds the AI — it confirms and reminds."],
  ["Review machine", "Asks, collects and answers 5★ reviews automatically."],
  ["Collects on the call", "Closed on the phone? Payment link by SMS right there."],
];

export default function GuiLayer({
  business = "this business",
  mascot = null,
  accent = "#3E9468",
  surface = "#0c1a2e",
  phone = "",
  label = "Ask us",
  /* `slug` liga o painel ao MOTOR DE ATIVAÇÃO: o pedido feito aqui entra no mesmo
     /api/lead-vitrine do formulário da página — e, se a ligação de volta estiver ligada
     para este slug, a IA do negócio disca pro visitante em segundos. Sem slug a aba Book
     não aparece: melhor não ter o botão do que ter um que não entrega. */
  slug = "",
  /* SITE DE CLIENTE PAGANTE (2026-09-30, Natura). Num site de prospect o painel também VENDE a
     Guileo: a aba Chat é o concierge da Guileo, "Get a call" é a nossa agente ligando e "What is
     this" é o nosso pitch. No site de quem já paga isso é a nossa marca falando por cima da dele —
     e o cliente do spa conversando com a vendedora da Guileo achando que é a Lilian. Com `cliente`
     ficam só as abas em que quem atende é a agente DELE: Book, Talk now e Chat (TenantChat, a
     qualquer hora — o chat de cliente não depende do horário do concierge da Guileo). */
  cliente = false,
  /* `vozSlug` = o slug do site PUBLICADO do cliente (client_sites), que é por onde /api/voice-web
     acha a agente dele. Existe porque a mesma marca pode ter mais de uma página aqui (ex.:
     "natura-spa" e "natura-spa-porta") e só uma é o site registrado. */
  vozSlug = "",
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("voice");   // voice | call | chat | what
  const [past, setPast] = useState(false);
  const [sel, setSel] = useState(() => new Set([0, 1]));
  const [ped, setPed] = useState({ nome: "", tel: "", servico: "", quando: "" });
  const [envio, setEnvio] = useState(null);   // null | "indo" | {ok, ligacao} | {erro}
  const hours = useMemo(isBusinessHours, []);
  const panelRef = useRef(null);

  /* Handoff da página → painel: qualquer seção pode disparar `gui-abrir` (ex.: o quote vivo
     entregando a conversa pra voz). Evento DOM, não prop: o GuiLayer é montado pelo Novo.jsx,
     longe de quem pede a abertura. */
  useEffect(() => {
    /* O evento pode trazer o que a página já sabe (serviço/estilista escolhidos no quote vivo):
       o painel abre com o pedido meio preenchido, e a pessoa só põe nome e telefone. */
    const abrir = (e) => {
      const d = (e && e.detail) || null;
      if (d && (d.servico || d.estilista)) {
        setPed((p) => ({ ...p, servico: [d.servico, d.estilista && `with ${d.estilista}`].filter(Boolean).join(" ") }));
        setTab("book");
      }
      setOpen(true); setMini(false);
    };
    window.addEventListener("gui-abrir", abrir);
    return () => window.removeEventListener("gui-abrir", abrir);
  }, []);

  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > 560);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Luis 2026-08-21: "esse botão flutuante fica cobrindo parte da tela".
  // Duas correções: (a) some quando a seção de contato/rodapé está à vista — lá o
  // CTA de verdade já está na tela e o widget só atrapalha; (b) encolhe pro mascote
  // sozinho depois de 5s parado, e volta ao tamanho normal no hover/foco.
  const [tapado, setTapado] = useState(false);
  const [mini, setMini] = useState(false);
  useEffect(() => {
    const alvo = document.querySelector("#contact") || document.querySelector("footer");
    if (!alvo) return;
    const io = new IntersectionObserver(([e]) => setTapado(e.isIntersecting), { threshold: 0.12 });
    io.observe(alvo);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (open) { setMini(false); return; }
    const t = setTimeout(() => setMini(true), 5000);
    return () => clearTimeout(t);
  }, [open, past]);

  // fecha no ESC e ao clicar fora — comportamento de painel de verdade
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onDown = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  const toggle = (i) => setSel((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const wa = waLink(`Hi Guileo! On the ${business} site I want: ${FEATURES.filter((_, i) => sel.has(i)).map((f) => f[0]).join(", ")}`);
  const TABS = cliente
    ? [...(slug ? [["book", "Book"]] : []), ["voice", "Talk now"], ...(vozSlug || slug ? [["chat", "Chat"]] : [])]
    : [...(slug ? [["book", "Book"]] : []), ["voice", "Talk now"], ["call", "Get a call"], ...(hours ? [["chat", "Chat"]] : []), ["what", "What is this"]];

  /* O PEDIDO PELO PAINEL — mesma porta do formulário da página. A resposta é lida do CORPO,
     nunca do status, e as duas verdades ficam separadas: recebido ✓ e ligação (disparada ou
     não). Dizer "marcado" seria mentira: quem confirma é o balcão. */
  const enviarPedido = async (e) => {
    e.preventDefault();
    setEnvio("indo");
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, negocio: business, nome: ped.nome, telefone: ped.tel,
          mensagem: `[${ped.servico || "service?"}] ${ped.quando || "any time"}` }),
      });
      const d = await r.json().catch(() => null);
      setEnvio(d && d.ok ? { ok: true, ligacao: d.ligacao } : { erro: (d && d.error) || `HTTP ${r.status}` });
    } catch (err) { setEnvio({ erro: String(err).slice(0, 90) }); }
  };

  return (
    <div ref={panelRef}
      className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2.5 font-sans sm:bottom-6 sm:right-6"
      style={{
        opacity: past ? 1 : 0,
        transform: past ? "none" : "translateY(14px)",
        pointerEvents: past ? "auto" : "none",
        transition: "opacity .35s cubic-bezier(.22,1,.36,1), transform .35s cubic-bezier(.22,1,.36,1)",
      }}>

      {open && (
        <div className="w-[min(92vw,24rem)] max-h-[78vh] overflow-y-auto overscroll-contain rounded-[28px] shadow-2xl"
          style={{ background: surface, border: `1px solid ${accent}33`, boxShadow: `0 30px 70px -28px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.10)` }}>

          <div className="flex items-center justify-between gap-3 px-4 pt-4">
            <span className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: `${accent}1f`, border: `1px solid ${accent}55` }}>{mascot}</span>
              <span className="text-[13px] font-black text-white">{label}</span>
            </span>
            <button onClick={() => setOpen(false)} aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white">✕</button>
          </div>

          <div className="flex gap-1.5 px-4 pt-3">
            {TABS.map(([k, t]) => (
              <button key={k} onClick={() => setTab(k)}
                className="rounded-full px-3 py-1.5 text-[11px] font-bold transition"
                style={tab === k
                  ? { background: accent, color: "#fff" }
                  : { background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.65)" }}>
                {t}
              </button>
            ))}
          </div>

          <div className="px-3 pb-4 pt-3">
            <Suspense fallback={<div className="py-8 text-center text-[12.5px] text-white/45">…</div>}>
              {tab === "book" && (
                envio && envio.ok ? (
                  <div className="px-1 py-2">
                    <div className="text-[14px] font-black text-white">Got it.</div>
                    <p className="mt-1 text-[12px] leading-snug text-white/65">
                      {envio.ligacao === "disparada"
                        ? "Your phone is about to ring — that's the salon's own assistant calling you back."
                        : "The front desk will confirm your exact time."}
                    </p>
                    <button onClick={() => { setEnvio(null); setPed({ nome: "", tel: "", servico: "", quando: "" }); }}
                      className="mt-3 text-[11.5px] font-bold" style={{ color: accent }}>Send another</button>
                  </div>
                ) : (
                  <form onSubmit={enviarPedido} className="space-y-2 px-1">
                    <p className="text-[11.5px] leading-snug text-white/60">
                      Tell {business} what you want. {phone ? "The front desk confirms the exact time." : ""}
                    </p>
                    {[["nome", "Your name", "text", true], ["tel", "Phone", "tel", true],
                      ["servico", "What do you want?", "text", false], ["quando", "When? (e.g. this week, mornings)", "text", false]].map(([k, ph, tp, req]) => (
                      <input key={k} required={req} type={tp} value={ped[k]} placeholder={ph}
                        onChange={(ev) => setPed((p) => ({ ...p, [k]: ev.target.value }))}
                        className="w-full rounded-xl px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35"
                        style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.14)" }} />
                    ))}
                    {envio && envio.erro && <p className="text-[11.5px] font-bold" style={{ color: "#F08A6B" }}>Didn't send: {envio.erro}</p>}
                    <button type="submit" disabled={envio === "indo"}
                      className="w-full rounded-full py-2.5 text-[13px] font-black transition disabled:opacity-60"
                      style={{ background: accent, color: "#1a1206" }}>
                      {envio === "indo" ? "Sending…" : "Send to the front desk"}
                    </button>
                  </form>
                )
              )}
              {tab === "voice" && <VoiceWeb slug={vozSlug || slug} brand={accent} business={business} lang="en" phone={phone} tema="escuro" />}
              {tab === "call" && <LiveCallBar source={`novo:${business}`} compacto />}
              {tab === "chat" && !cliente && hours && <GuiChat />}
              {tab === "chat" && cliente && <TenantChat slug={vozSlug || slug} business={business} accent={accent} phone={phone} lang="en" />}
              {tab === "what" && (
                <div className="px-1">
                  <p className="text-[11.5px] leading-snug text-white/60">
                    This site answers on its own. Tap what {business} should have — each one already runs in production.
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {FEATURES.map((f, i) => (
                      <button key={i} onClick={() => toggle(i)}
                        className="flex w-full items-start gap-2 rounded-2xl border px-3 py-2 text-left transition"
                        style={sel.has(i)
                          ? { borderColor: `${accent}88`, background: `${accent}1a` }
                          : { borderColor: "rgba(255,255,255,.10)", background: "rgba(255,255,255,.03)" }}>
                        <span className="min-w-0">
                          <span className="block text-[12px] font-bold leading-tight text-white">{f[0]}</span>
                          <span className="block text-[10.5px] leading-snug text-white/50">{f[1]}</span>
                        </span>
                        <span className="ml-auto mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] text-white"
                          style={sel.has(i) ? { background: accent, borderColor: accent } : { borderColor: "rgba(255,255,255,.25)", color: "transparent" }}>✓</span>
                      </button>
                    ))}
                  </div>
                  <a href={wa} target="_blank" rel="noreferrer"
                    className="mt-3 block rounded-full px-3 py-2.5 text-center text-[12.5px] font-black text-white transition hover:brightness-110"
                    style={{ background: accent }}>I want these on my site →</a>
                </div>
              )}
            </Suspense>
          </div>
        </div>
      )}

      {/* UM botão só, com a cara DELE */}
      <button onClick={() => setOpen((v) => !v)}
        className="group relative flex items-center gap-2.5 overflow-hidden rounded-full py-2 pl-2 pr-4 transition active:scale-[.98]"
        style={{
          background: surface,
          border: `1px solid ${accent}44`,
          boxShadow: `0 18px 40px -18px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.12), 0 0 0 0 ${accent}00`,
        }}>
        <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-12deg] bg-gradient-to-r from-transparent via-white/12 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <span className="relative grid h-9 w-9 place-items-center rounded-full" style={{ background: `${accent}1f`, border: `1px solid ${accent}66` }}>
          {mascot}
        </span>
        <span className={`relative text-left leading-tight transition-all duration-300 ${mini ? "max-w-0 overflow-hidden opacity-0" : "max-w-[200px] opacity-100"}`}>
          <span className="block whitespace-nowrap text-[12.5px] font-black text-white">{label}</span>
          <span className="block whitespace-nowrap text-[10px] text-white/55">{hours ? "chat · voice · call" : "voice · call · 24/7"}</span>
        </span>
      </button>
    </div>
  );
}
