import { useEffect, useState, useCallback } from "react";

// OnboardApprovals — /admin panel that lists CADASTRO COMPLETO drafts submitted by sellers via
// OnboardWizard (POST /api/onboard-draft {action:'save'}). Luis reviews the captured data and, with
// one click, approves → the server calls the existing provisioner (functions/api/onboard-client.js)
// to give birth to the client's own dedicated agent (name, voice, brain, schedule, number, widget).
// Auth = the same admin token the rest of /admin uses (passed in as a prop). Warm-cement styling.

const money = (c) => (typeof c === "number" ? `$${(c / 100).toFixed(2)}` : "—");

export default function OnboardApprovals({ token }) {
  const [drafts, setDrafts] = useState([]);
  const [state, setState] = useState("loading"); // loading | ok | err
  const [open, setOpen] = useState(null); // draft id whose detail is expanded
  const [detail, setDetail] = useState(null); // { id, draft }
  const [detailState, setDetailState] = useState("idle"); // idle | busy | err
  const [busyId, setBusyId] = useState(null); // id being approved
  const [results, setResults] = useState({}); // id -> approve result
  const [copied, setCopied] = useState("");
  const [numIn, setNumIn] = useState({});      // draft id -> number typed
  const [bindingId, setBindingId] = useState(null);
  const [provId, setProvId] = useState(null);
  const [bindMsg, setBindMsg] = useState({});  // draft id -> bind result message
  const [twNums, setTwNums] = useState(null);  // Twilio numbers on the account
  const [loadingNums, setLoadingNums] = useState(false);

  const call = useCallback(async (action, extra = {}) => {
    const r = await fetch("/api/onboard-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, token, ...extra }) });
    return r.json().catch(() => ({}));
  }, [token]);

  const load = useCallback(async () => {
    try {
      const d = await call("list");
      const rows = d.rows || d.drafts;
      if (Array.isArray(rows)) { setDrafts(rows); setState("ok"); }
      else setState("err");
    } catch { setState("err"); }
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const view = async (id) => {
    if (open === id) { setOpen(null); setDetail(null); return; }
    setOpen(id); setDetail(null); setDetailState("busy");
    try {
      const d = await call("get", { id });
      // draft_get returns the DB row; the canonical payload lives under row.payload.
      if (d.draft) { setDetail({ id, draft: d.draft.payload || d.draft }); setDetailState("idle"); }
      else setDetailState("err");
    } catch { setDetailState("err"); }
  };

  const approve = async (id) => {
    // SHARED-NUMBER GUARD — a client going live on the platform's SHARED line (number_mode absent/"shared")
    // has no dedicated caller-ID: outbound is silenced by US carriers until A2P, and inbound shares the
    // demo line. Make Luis confirm that's intended before birthing the agent. Reuse the loaded detail if
    // this draft is already open; otherwise do one lightweight fetch just to read number_mode.
    //
    // ⚠️ O PRÉ-CHECK NÃO É O PORTÃO (2026-08-25). Ele roda no NAVEGADOR, e o `catch` abaixo dizia
    // "se falhar, não bloqueia — segue". Ou seja: leitura quebrada = aprovação sem aviso nenhum, e
    // qualquer chamada direta ao endpoint passava por cima do confirm. A regra de arquitetura é a
    // do número: cada cliente = 1 número PRÓPRIO, o compartilhado é da plataforma.
    // Agora o front só manda `confirm:true` quando o humano REALMENTE confirmou o conflito, e
    // manda `precheck:"falhou"` quando não conseguiu nem verificar — o servidor decide com isso.
    // (O portão do lado servidor vive em functions/api/onboard-draft.js, que não é meu arquivo:
    //  o patch exato está no relatório desta onda, para o orquestrador aplicar.)
    let confirmado = false, precheck = "ok";
    try {
      let mode = (detail && detail.id === id) ? (detail.draft?.number_mode) : undefined;
      if (mode === undefined) { const g = await call("get", { id }); mode = (g?.draft?.payload || g?.draft || {})?.number_mode; }
      if ((mode || "shared") === "shared") {
        const ok = window.confirm("⚠️ Este cliente vai ao ar no NÚMERO COMPARTILHADO da plataforma (sem número dedicado).\n\nSem número próprio: as ligações de saída podem ser silenciadas pelas operadoras dos EUA até o A2P, e a linha é a mesma do demo.\n\nMapeie um número dedicado depois em \"Mapear número\". Aprovar mesmo assim?");
        if (!ok) return;
        confirmado = true;
      }
    } catch {
      // Não dá para saber se há conflito → tratamos como conflito e pedimos confirmação humana.
      // "Não consegui verificar" nunca pode ser mais permissivo que "verifiquei e há problema".
      precheck = "falhou";
      const ok = window.confirm("⚠️ Não consegui verificar o modo de número deste cadastro.\n\nPode ser que ele vá ao ar no número COMPARTILHADO da plataforma (sem linha própria).\n\nAprovar mesmo sem essa verificação?");
      if (!ok) return;
      confirmado = true;
    }
    setBusyId(id);
    try {
      const d = await call("approve", { id, confirm: confirmado, precheck });
      setResults((m) => ({ ...m, [id]: d }));
      if (d.ok) setDrafts((a) => a.map((x) => (x.id === id ? { ...x, status: "live" } : x)));
    } catch { setResults((m) => ({ ...m, [id]: { error: "Erro de rede." } })); }
    setBusyId(null);
  };

  const copy = (txt, tag) => { try { navigator.clipboard.writeText(txt); setCopied(tag); setTimeout(() => setCopied(""), 1500); } catch { /* */ } };

  // ROTA-NUMERO — map an existing Twilio number to this client's already-born agent (voice).
  const bindNumber = async (id, email) => {
    const number = (numIn[id] || "").trim();
    if (!number) return;
    setBindingId(id);
    try {
      const r = await fetch("/api/bind-number", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, email, number }) });
      const d = await r.json().catch(() => ({}));
      setBindMsg((m) => ({ ...m, [id]: d.ok ? `✅ Número ${d.number} mapeado — o agente já atende nele.` : (d.error || d.note || "Não consegui mapear.") }));
    } catch { setBindMsg((m) => ({ ...m, [id]: "Erro de rede." })); }
    setBindingId(null);
  };

  // ROTA-PROVISION — conseguir um número quando NÃO tem nenhum livre óbvio.
  // Dois passos de propósito: o 1º clique só SIMULA (o back devolve dry_run) e o 2º confirma.
  // É a única tela do /admin que pode gastar dinheiro, então o valor exato aparece ANTES —
  // nunca "clicou e comprou". Se o back devolve reuso, o custo é zero e o texto diz isso.
  const provision = async (id, email) => {
    setProvId(id);
    try {
      const ask = (body) => fetch("/api/provision-number", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, email, ...body }) }).then((r) => r.json().catch(() => ({})));

      const sim = await ask({});
      if (sim.already) { setNumIn((m) => ({ ...m, [id]: sim.number })); setBindMsg((m) => ({ ...m, [id]: `✅ Este cliente já tem o número ${sim.number} — nada comprado.` })); return; }
      if (!sim.ok) { setBindMsg((m) => ({ ...m, [id]: `⛔ ${sim.note || sim.blocked || sim.error || "não consegui"}` })); return; }

      const reuse = sim.source === "reuse";
      const alvo = reuse ? sim.would_reuse : sim.would_buy;
      const pergunta = reuse
        ? `Reservar o número ${alvo} pra ${email}?\n\nCUSTO: $0 — já é da conta, está ocioso.`
        : `COMPRAR o número ${alvo} pra ${email}?\n\n💵 CUSTO: $${Number(sim.cost_usd).toFixed(2)} agora + mensalidade da Twilio.\nSaldo: $${Number(sim.balance).toFixed(2)} · comprados hoje: ${sim.bought_today ?? "?"}/${sim.max_per_day}\n\nIsso gasta dinheiro de verdade.`;
      if (!window.confirm(pergunta)) { setBindMsg((m) => ({ ...m, [id]: "Cancelado — nada foi feito." })); return; }

      const done = await ask({ confirm: true });
      if (!done.ok) { setBindMsg((m) => ({ ...m, [id]: `⛔ ${done.note || done.blocked || done.error || "não consegui"}` })); return; }
      setNumIn((m) => ({ ...m, [id]: done.number }));
      setBindMsg((m) => ({ ...m, [id]: `${done.source === "reuse" ? "✅ Reservado" : "💵 Comprado"} ${done.number} (custo $${Number(done.cost_usd || 0).toFixed(2)})${done.recorded === false ? " ⚠️ mas NÃO registrado — confira o console da Twilio" : ""}. Agora clique “Mapear número”.` }));
    } catch { setBindMsg((m) => ({ ...m, [id]: "Erro de rede — nada foi comprado." })); }
    finally { setProvId(null); }
  };

  // list the Twilio numbers on the account so you can pick the spare one (ROTA-NUMERO helper)
  const loadNums = async () => {
    setLoadingNums(true);
    try {
      const r = await fetch("/api/twilio-numbers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const d = await r.json().catch(() => ({}));
      setTwNums(d.ok ? (d.numbers || []) : []);
    } catch { setTwNums([]); }
    setLoadingNums(false);
  };

  const pending = drafts.filter((d) => (d.status || "draft") !== "live");

  return (
    <div className="mt-6 rounded-2xl border border-g-gold/30 bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">🌱 Cadastros pendentes</div>
        <button type="button" onClick={load} className="rounded-full border border-g-line px-3 py-1 text-[11.5px] font-bold text-g-muted hover:text-g-word">↻ Atualizar</button>
      </div>
      <p className="mt-1 text-[12.5px] text-g-muted">Cadastros completos enviados pelos vendedores. Revise os dados e aprove — a Gui dedicada do cliente nasce na hora (agente, voz, cérebro, número, widget).</p>

      {state === "loading" && <div className="mt-4 text-center text-[13px] text-g-muted">Carregando…</div>}
      {state === "err" && <div className="mt-4 rounded-xl border border-g-line bg-white/[0.03] p-4 text-[13px] text-g-muted">Não consegui listar os rascunhos — confere se <span className="font-mono text-g-word">/api/onboard-draft</span> está no ar e o token está certo.</div>}
      {state === "ok" && drafts.length === 0 && <div className="mt-4 rounded-xl border border-g-line bg-white/[0.03] p-6 text-center text-[13px] text-g-muted">Nenhum cadastro ainda — quando um vendedor enviar um cadastro completo, ele aparece aqui.</div>}

      {state === "ok" && drafts.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {drafts.map((d) => {
            const live = (d.status || "draft") === "live";
            const res = results[d.id];
            return (
              <div key={d.id} className="rounded-xl border border-g-line bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[14px] font-black text-g-word">{d.business || "—"}</span>
                  {live
                    ? <span className="rounded-full bg-g-green/15 px-2 py-0.5 text-[10px] font-black text-g-green ring-1 ring-g-green/30">live</span>
                    : <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: "rgba(217,164,65,0.14)", color: "#D9A441", boxShadow: "inset 0 0 0 1px rgba(217,164,65,0.35)" }}>rascunho</span>}
                  {d.client_email && <span className="text-[11.5px] text-g-muted">{d.client_email}</span>}
                  {(d.seller_email || d.seller_name) && <span className="text-[11.5px] text-g-muted">· por {d.seller_email || d.seller_name}</span>}
                  <span className="ml-auto flex gap-2">
                    <button type="button" onClick={() => view(d.id)} className="rounded-full border border-g-line px-3 py-1 text-[11.5px] font-bold text-g-ink hover:text-g-word">{open === d.id ? "Ocultar" : "Ver dados"}</button>
                    {!live && (
                      <button type="button" disabled={busyId === d.id} onClick={() => approve(d.id)} className="rounded-full bg-gradient-to-r from-g-green to-g-dark px-4 py-1 text-[11.5px] font-black text-white disabled:opacity-60">
                        {busyId === d.id ? "Nascendo…" : "✅ Aprovar & ir ao vivo"}
                      </button>
                    )}
                  </span>
                </div>

                {open === d.id && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-[#0d0c0a]/40 p-3 text-[12px] text-g-ink">
                    {detailState === "busy" && <div className="text-g-muted">Carregando dados…</div>}
                    {detailState === "err" && <div className="text-[#e0855f]">Não consegui buscar os dados desse cadastro.</div>}
                    {detail && detail.id === d.id && <DraftView draft={detail.draft} />}
                  </div>
                )}

                {res && res.error && <div className="mt-2 text-[12px] text-[#e0855f]">{res.error}</div>}
                {res && res.ok && (
                  <div className="mt-3 rounded-lg border border-g-green/30 bg-g-green/[0.07] p-3 text-[12.5px]">
                    <div className="font-bold text-g-green">✅ {d.business} está no ar!</div>
                    <div className="mt-1.5 grid gap-1 text-g-ink">
                      {res.connection_code && <div>🔑 Código: <code className="font-bold text-g-green">{res.connection_code}</code> <button type="button" onClick={() => copy(res.connection_code, `code-${d.id}`)} className="ml-1 text-g-gold underline">{copied === `code-${d.id}` ? "copiado ✓" : "copiar"}</button></div>}
                      {res.agent_id && <div>🎙️ Agente: <code className="text-g-word">{res.agent_id}</code></div>}
                      {res.number && <div>📞 Número: <code className="text-g-word">{res.number}</code></div>}
                      {res.widget_snippet && (
                        <div className="mt-1">
                          <div className="text-[11px] font-black uppercase tracking-wide text-g-gold">🌐 Widget (cole no site do cliente)</div>
                          <pre className="mt-1 whitespace-pre-wrap break-all rounded border border-white/10 bg-[#0d0c0a]/60 p-2 font-mono text-[11px] leading-relaxed text-g-ink">{res.widget_snippet}</pre>
                          <button type="button" onClick={() => copy(res.widget_snippet, `snip-${d.id}`)} className="mt-1 text-g-gold underline">{copied === `snip-${d.id}` ? "copiado ✓" : "copiar snippet"}</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {live && (
                  <div className="mt-3 rounded-lg border border-g-line bg-white/[0.03] p-3 text-[12.5px]">
                    <div className="text-[11px] font-black uppercase tracking-wide text-g-gold">🔢 Dar voz — mapear número Twilio (ROTA-NUMERO)</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <input value={numIn[d.id] || ""} onChange={(e) => setNumIn((m) => ({ ...m, [d.id]: e.target.value }))} placeholder="+13055551234" className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-[13px] text-g-word placeholder:text-g-muted/50 outline-none focus:border-g-green/50" />
                      <button type="button" disabled={bindingId === d.id} onClick={() => bindNumber(d.id, d.client_email)} className="rounded-full bg-gradient-to-r from-g-green to-g-dark px-3.5 py-1.5 text-[11.5px] font-black text-white disabled:opacity-60">{bindingId === d.id ? "mapeando…" : "🔢 Mapear número"}</button>
                      <button type="button" disabled={loadingNums} onClick={loadNums} className="rounded-full border border-white/15 px-3 py-1.5 text-[11.5px] font-bold text-g-muted hover:text-g-word disabled:opacity-60">{loadingNums ? "buscando…" : "📋 Meus números Twilio"}</button>
                      <button type="button" disabled={provId === d.id} onClick={() => provision(d.id, d.client_email)} title="Reusa um número ocioso da conta; só compra se não houver nenhum — e sempre pergunta antes" className="rounded-full border border-g-gold/40 bg-g-gold/10 px-3 py-1.5 text-[11.5px] font-bold text-g-gold hover:bg-g-gold/20 disabled:opacity-60">{provId === d.id ? "procurando…" : "🎯 Conseguir número"}</button>
                    </div>
                    {Array.isArray(twNums) && (
                      twNums.length === 0
                        ? <div className="mt-1.5 text-[12px] text-g-muted">Nenhum número encontrado (ou Twilio não configurado).</div>
                        : <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {twNums.map((n) => (
                              <button key={n.number} type="button" disabled={n.reserved || n.bound}
                                onClick={() => { if (!n.reserved && !n.bound) setNumIn((m) => ({ ...m, [d.id]: n.number })); }}
                                title={n.where || (n.bound ? "já ligado a um agente" : "livre")}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${n.reserved ? "cursor-not-allowed bg-[#e0855f]/10 text-[#e0855f] ring-[#e0855f]/30" : n.bound ? "cursor-not-allowed bg-white/[0.03] text-g-muted ring-white/10" : "bg-g-green/10 text-g-word ring-g-green/30 hover:ring-g-green/60"}`}>
                                {n.reserved ? "🚫" : n.bound ? "🔒" : "🟢"} {n.number}{n.where ? ` · ${n.where}` : n.friendly ? ` · ${n.friendly}` : ""}
                              </button>
                            ))}
                          </div>
                    )}
                    {bindMsg[d.id] && <div className="mt-1.5 text-[12px] text-g-ink">{bindMsg[d.id]}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {state === "ok" && pending.length > 0 && <div className="mt-3 text-[11.5px] text-g-muted">{pending.length} aguardando aprovação.</div>}
    </div>
  );
}

// Compact read-only view of the captured payload.
function DraftView({ draft }) {
  if (!draft) return null;
  const Row = ({ k, children }) => <div className="flex gap-2"><span className="shrink-0 font-bold text-g-muted">{k}:</span><span className="min-w-0 break-words">{children}</span></div>;
  const ch = draft.channels || {};
  const chBits = Object.entries(ch).map(([name, v]) => {
    if (!v || typeof v !== "object") return null;
    if ("enabled" in v) return v.enabled ? name : null;
    const val = v.number || v.handle || v.url || v.link || v.mode;
    return val ? `${name}: ${val}` : null;
  }).filter(Boolean);
  return (
    <div className="space-y-1.5">
      {draft.description && <Row k="Descrição">{draft.description}</Row>}
      {Array.isArray(draft.verticals) && draft.verticals.length > 0 && <Row k="Segmentos">{draft.verticals.join(", ")}</Row>}
      {Array.isArray(draft.languages) && <Row k="Idiomas">{draft.languages.join(", ")} (principal: {draft.lang})</Row>}
      {draft.agent && <Row k="Agente">{draft.agent.name || "—"} · voz {draft.agent.voice_key || "—"}</Row>}
      {draft.brand && <Row k="Marca">{draft.brand.logo_url ? "logo ✓" : "sem logo"} · {draft.brand.accent}</Row>}
      {Array.isArray(draft.locations) && draft.locations.length > 0 && (
        <Row k="Unidades">{draft.locations.map((l, i) => <span key={i} className="block">{l.name || "—"} · {l.address} · {l.tz} · {(l.hours || []).length} dias</span>)}</Row>
      )}
      {Array.isArray(draft.services) && draft.services.length > 0 && (
        <Row k="Serviços">{draft.services.map((s, i) => <span key={i} className="block">{s.name} · {s.vertical} · {s.duration_min}min · {money(s.price_cents)}{s.deposit_cents != null ? ` · depósito ${money(s.deposit_cents)}` : ""}</span>)}</Row>
      )}
      {Array.isArray(draft.team) && draft.team.length > 0 && (
        <Row k="Equipe">{draft.team.map((m, i) => <span key={i} className="block">{m.name} · {m.title}</span>)}</Row>
      )}
      {chBits.length > 0 && <Row k="Canais">{chBits.join(" · ")}</Row>}
      {draft.support_link && <Row k="Suporte">{draft.support_link}</Row>}
      {draft.review_link && <Row k="Avaliações">{draft.review_link}</Row>}
      <Row k="Plano">{draft.plan} · {draft.credits} créditos</Row>
    </div>
  );
}
