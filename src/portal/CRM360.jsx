/* Split out of Portal.jsx (performance): CRM360 tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { fetchCrmDeals, fetchCrmTimeline, fetchCRM } from "../lib/portalApi.js";
import { waTo } from "../data/contact.js";
import { Card, genCustomers, tr, MiniStats, Empty, Drawer, SectionSkeleton } from "../pages/Portal.jsx";
import NoSeuPlano from "./NoSeuPlano.jsx";

// Pipeline board — crm_deals grouped by stage (the sales motor: inquiry → quoted → booked → won).
// Kanban columns scroll horizontally on mobile.
//
// DUAS MANEIRAS DE MOVER, de propósito:
//  · ARRASTAR o cartão para qualquer coluna — é o que o dono espera de um kanban, e é a única
//    forma de marcar "Lost" ou VOLTAR um estágio. O backend (`deal_move`) já aceitava os 5
//    estágios desde sempre: a limitação era só desta tela.
//  · O botão "→" continua. Não é redundância: arrastar do HTML5 **não funciona em toque**, e
//    metade dos donos abre o cockpit no celular. Tirar o botão trocaria um ganho no desktop por
//    uma perda no telefone.
const PIPE_ORDER = ["inquiry", "quoted", "booked", "won"];
function PipelineBoard({ deals = [], fmtMoney, tr, demo, onAdvance, movingId }) {
  // `arrastando` = o negócio na mão; `sobre` = a coluna sob o cursor (só para o destaque).
  const [arrastando, setArrastando] = useState(null);
  const [sobre, setSobre] = useState(null);
  const STAGES = [
    ["inquiry", tr("Inquiry"), "#9AA0A6"],
    ["quoted", tr("Quoted"), "#D6C29A"],
    ["booked", tr("Booked"), "#3E9468"],
    ["won", tr("Won"), "#C08A3E"],
    ["lost", tr("Lost"), "#B66"],
  ];
  const ageDays = (d) => { const t = new Date(d.updated_at || d.created_at || Date.now()).getTime(); return Math.max(0, Math.floor((Date.now() - t) / 86400000)); };
  if (!deals.length) {
    return <Card className="p-8 text-center"><div className="text-3xl mb-2">📊</div><div className="text-sm text-g-muted">{demo ? tr("When Gui quotes and closes on a call, the deal lands here and moves across the pipeline automatically.") : tr("No deals yet — Gui opens one the moment it quotes a job, and advances it as the customer books and pays.")}</div></Card>;
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
      {STAGES.map(([key, label, color]) => {
        const col = deals.filter((d) => (d.stage || "inquiry") === key);
        const sum = col.reduce((s, d) => s + (d.value_cents || 0), 0);
          // Destino válido = tem negócio na mão E a coluna não é a de onde ele saiu.
          const alvo = !!arrastando && (arrastando.stage || "inquiry") !== key;
          const aceso = alvo && sobre === key;
          return (
          <div key={key}
            onDragOver={(e) => { if (alvo) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
            onDragEnter={() => alvo && setSobre(key)}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setSobre((v) => (v === key ? null : v)); }}
            onDrop={(e) => {
              e.preventDefault();
              const d = arrastando; setArrastando(null); setSobre(null);
              // Só move o que É um destino: soltar na própria coluna não pode gastar uma chamada
              // nem piscar "movido" sem nada ter mudado.
              if (d && !demo && onAdvance && (d.stage || "inquiry") !== key) onAdvance(d, key);
            }}
            className={`rounded-xl2 border p-3 min-w-[200px] w-[200px] sm:w-auto sm:min-w-[180px] sm:flex-1 shrink-0 transition ${aceso ? "border-g-green/60 bg-g-green/[0.07]" : alvo ? "border-white/20 bg-white/[0.04] border-dashed" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wide" style={{ color }}>{label}</span>
              <span className="text-[10px] text-g-muted">{col.length} · {fmtMoney(sum)}</span>
            </div>
            <div className="space-y-2">
              {col.map((d, i) => {
                const next = PIPE_ORDER[PIPE_ORDER.indexOf(key) + 1];
                const canMove = !!next && key !== "won" && key !== "lost" && (d.status || "open") === "open";
                const age = ageDays(d);
                return (
                  <div key={d.id || i}
                    draggable={!demo && (d.status || "open") === "open" && movingId !== d.id}
                    onDragStart={(e) => { setArrastando(d); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", d.id || ""); } catch { /* Safari antigo */ } }}
                    onDragEnd={() => { setArrastando(null); setSobre(null); }}
                    className={`rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 ${!demo && (d.status || "open") === "open" ? "cursor-grab active:cursor-grabbing" : ""} ${arrastando?.id === d.id ? "opacity-40" : ""}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-bold text-g-word truncate">{d.contact_name || d.title || tr("Unknown")}</div>
                        <div className="flex items-center justify-between mt-0.5 gap-2">
                          <span className="text-[10.5px] text-g-muted truncate">{d.title || ""}</span>
                          <span className="text-[10px] text-g-muted/70 shrink-0">{age}d</span>
                        </div>
                        <div className="text-[12px] font-extrabold text-g-green mt-0.5">{fmtMoney(d.value_cents)}</div>
                      </div>
                      {canMove && (
                        <button
                          onClick={() => !demo && onAdvance && onAdvance(d, next)}
                          disabled={demo || movingId === d.id}
                          title={demo ? tr("Demo") + " — " + (STAGES.find((s) => s[0] === next)?.[1] || next) : `${label} → ${STAGES.find((s) => s[0] === next)?.[1] || next}`}
                          className={`grid place-items-center h-7 w-7 rounded-full border shrink-0 text-[13px] font-black transition ${demo || movingId === d.id ? "border-white/10 text-g-muted/50 cursor-not-allowed" : "border-g-green/40 bg-g-green/10 text-g-green hover:bg-g-green/20"}`}
                        >{movingId === d.id ? "…" : "→"}</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {col.length === 0 && <div className="text-[11px] text-g-muted/60 py-2 text-center">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// CRM 360 — the unified contact spine (crm_contacts) every department reads. Reads /api/crm, which
// gracefully reports ready:false until db/crm_spine.sql is pasted. In demo mode we render a
// representative book (from the sector's sample customers) so the tour stays alive.
function CRM360({ V, onNav, real = null, email = "", dataKey = "" }) {
  const demo = !dataKey;
  const [data, setData] = useState({ ready: demo, count: 0, contacts: [] });
  const [loading, setLoading] = useState(!demo);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  // ── CAMPOS CUSTOMIZÁVEIS (2026-08-22) ───────────────────────────────────────────────────────
  // `campos` = null nunca significa "nenhum campo". null = ainda não perguntei; false = perguntei
  // e NÃO DEU (RPC ausente / erro). Lista vazia é a única coisa que significa "nenhum campo".
  const [campos, setCampos] = useState(null);
  const [novoCampo, setNovoCampo] = useState({ label: "", kind: "text" });
  const [gerindo, setGerindo] = useState(false);
  const [salvandoCampo, setSalvandoCampo] = useState(null);
  const crmCall = async (payload) => {
    try {
      const r = await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, token: dataKey, ...payload }) });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  };
  const carregaCampos = async () => {
    const d = await crmCall({ action: "fields_list" });
    setCampos(d && Array.isArray(d.fields) ? d.fields : false);
  };
  // DEMO mostra amostra e desabilita a edição — o padrão da casa. Sem este ramo o gerenciador
  // ficava "Loading…" PARA SEMPRE no cockpit de demonstração, porque a carga só roda em modo
  // real. Girador eterno é pior que vazio: parece que quebrou.
  useEffect(() => {
    if (demo) { setCampos([{ key: "alergia", label: tr("Allergy"), kind: "text", options: [] }, { key: "sessoes", label: tr("Sessions left"), kind: "number", options: [] }]); return; }
    if (email && dataKey) carregaCampos();
  }, [demo, email, dataKey]); // eslint-disable-line
  const criaCampo = async () => {
    if (!novoCampo.label.trim()) return;
    setSalvandoCampo("novo");
    const d = await crmCall({ action: "field_set", key: novoCampo.label, label: novoCampo.label, kind: novoCampo.kind });
    setSalvandoCampo(null);
    // O CORPO decide, não o status. `ok:false` traz o motivo (limite_30_campos, label_vazio…).
    if (d?.ok) { setNovoCampo({ label: "", kind: "text" }); carregaCampos(); }
    else alert(d?.motivo === "limite_30_campos" ? tr("Limit of 30 custom fields reached.") : tr("Couldn't save — try again."));
  };
  const apagaCampo = async (k) => {
    setSalvandoCampo(k);
    const d = await crmCall({ action: "field_set", key: k, label: "x", remove: true });
    setSalvandoCampo(null);
    if (d?.ok) carregaCampos();
  };
  // Grava o valor e usa o `custom` QUE VOLTOU do banco — não o que eu digitei. Se o banco
  // recusou (número inválido, contato de outro tenant), a tela não pode mostrar o valor novo.
  const gravaValor = async (contatoId, k, valor) => {
    setSalvandoCampo(k);
    const d = await crmCall({ action: "contact_custom_set", contact_id: contatoId, key: k, value: valor });
    setSalvandoCampo(null);
    if (d?.ok && d.custom) setSel((c) => (c && c.id === contatoId ? { ...c, custom: d.custom } : c));
    else if (d?.motivo === "numero_invalido") alert(tr("That field only takes numbers."));
    else if (d?.motivo) alert(tr("Couldn't save — try again."));
  };
  const [timeline, setTimeline] = useState([]);
  const [tlLoading, setTlLoading] = useState(false);
  const [tab, setTab] = useState("contacts"); // contacts | pipeline
  const [deals, setDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [movingId, setMovingId] = useState(null);

  // Pipeline board — fetch deals when the tab opens (demo synthesizes a board from the sample contacts).
  useEffect(() => {
    let alive = true;
    if (tab !== "pipeline") return;
    if (demo) {
      const stages = ["inquiry", "quoted", "booked", "won"];
      const day = 86400000;
      setDeals((data.contacts || []).map((c, i) => ({ id: `d${i}`, contact_name: c.full_name, title: `${c.full_name} · ${V.label || "service"}`, value_cents: c.ltv_cents || 0, stage: stages[i % 4], status: i % 4 === 3 ? "won" : "open", updated_at: new Date(Date.now() - ((i % 5) + 1) * day).toISOString() })));
      return () => { alive = false; };
    }
    if (dataKey) { setDealsLoading(true); fetchCrmDeals(dataKey, email).then((d) => { if (alive) { setDeals(d); setDealsLoading(false); } }); }
    return () => { alive = false; };
  }, [tab, demo, dataKey, email]); // eslint-disable-line react-hooks/exhaustive-deps

  // "→" on a card — advance a deal one stage through /api/crm (crm_deal_move, tenant-scoped in SQL).
  const advanceDeal = async (deal, next) => {
    if (demo || !dataKey || !deal?.id) return;
    setMovingId(deal.id);
    try {
      const r = await fetch("/api/crm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deal_move", token: dataKey, email: email || "", deal_id: deal.id, stage: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok && d?.deal) setDeals((cur) => cur.map((x) => (x.id === deal.id ? { ...x, stage: d.deal.stage, status: d.deal.status, updated_at: new Date().toISOString() } : x)));
    } catch { /* board stays as-is; next fetch reconciles */ }
    setMovingId(null);
  };

  // When a contact is opened, pull its 360° timeline (real contacts only; demo rows have no live history).
  useEffect(() => {
    let alive = true;
    setTimeline([]);
    const realId = sel && /^[0-9a-f-]{36}$/i.test(sel.id || "");
    if (sel && !demo && realId && dataKey) {
      setTlLoading(true);
      fetchCrmTimeline(dataKey, email, sel.id).then((ev) => { if (alive) { setTimeline(ev); setTlLoading(false); } });
    }
    return () => { alive = false; };
  }, [sel, demo, dataKey, email]);

  useEffect(() => {
    let alive = true;
    if (demo) {
      const rows = (V.customers || genCustomers(V)).map((c, i) => ({
        id: `demo-${i}`, full_name: c.name, phone: c.phone || "", email: c.email || "",
        lifecycle: i === 0 ? "vip" : (c.orders || 1) > 1 ? "customer" : "lead",
        ltv_cents: Math.round((c.spent || 0) * 100), visit_count: c.orders || 1,
        last: c.last, churn_risk: i % 4 === 3 ? 64 : 11, tags: [],
      }));
      setData({ ready: true, count: rows.length, contacts: rows });
      return () => { alive = false; };
    }
    setLoading(true);
    fetchCRM(dataKey, email).then((d) => { if (alive) { setData(d); setLoading(false); } });
    return () => { alive = false; };
  }, [demo, dataKey, email]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtMoney = (cents) => `$${Math.round((cents || 0) / 100).toLocaleString()}`;
  const lifeColor = (l) => l === "vip" ? "#C08A3E" : l === "customer" ? "#3E9468" : l === "lost" ? "#9A9A9A" : "#D6C29A";
  const all = data.contacts || [];
  const rows = all.filter((c) => { const s = q.trim().toLowerCase(); return !s || (c.full_name || "").toLowerCase().includes(s) || (c.phone || "").includes(s) || (c.email || "").toLowerCase().includes(s); });
  const leads = all.filter((c) => (c.lifecycle || "lead") === "lead").length;
  const ltv = all.reduce((s, c) => s + (c.ltv_cents || 0), 0);
  const risk = all.filter((c) => (c.churn_risk || 0) >= 50).length;

  // Real fetch still in flight → cement shimmer instead of a flash of zero-stats.
  if (!demo && loading) return <SectionSkeleton />;

  // Connected, but the spine isn't live yet → guide to activate (no fake data).
  if (!demo && !loading && !data.ready) {
    return (
      <div className="space-y-4 stagger">
        <Card className="p-8 text-center border-g-gold/25 bg-g-gold/[0.05]">
          <div className="text-4xl mb-3">🗂️</div>
          <div className="text-lg font-extrabold text-g-word">{tr("Activate the CRM")}</div>
          <div className="text-sm text-g-muted mt-1.5 max-w-md mx-auto leading-relaxed">{tr("Your contact spine isn't live yet. Paste db/crm_spine.sql in Supabase to switch it on.")}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 stagger">
      {/* convite, nunca cadeado: diz que este recurso mora no degrau de cima (ver NoSeuPlano.jsx) */}
      <NoSeuPlano real={real} produto="crm_email" />
      <MiniStats items={[
        [tr("Total contacts"), `${data.count || all.length}`],
        [tr("Active leads"), `${leads}`, "good"],
        [tr("Lifetime value"), fmtMoney(ltv), "good"],
        [tr("At churn risk"), `${risk}`, risk ? "bad" : undefined],
      ]} />
      <div className="flex gap-2 flex-wrap items-center">
        {[["contacts", tr("Contacts")], ["pipeline", tr("Pipeline")]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold transition ${tab === k ? "bg-g-green/15 text-g-light border border-g-green/40" : "border border-white/10 bg-white/[0.04] text-g-muted hover:text-g-word"}`}>{label}</button>
        ))}
        {/* Gerenciador de campos: fora das abas, porque não é uma VISÃO — é configuração. */}
        <button onClick={() => setGerindo((v) => !v)}
          className="ml-auto rounded-full px-3 py-1.5 text-[12px] font-bold border border-white/10 bg-white/[0.04] text-g-muted hover:text-g-word transition">
          {gerindo ? tr("Done") : tr("⚙︎ Your fields")}
        </button>
      </div>

      {/* CRIAR / APAGAR CAMPO. Aparece só quando pedido — configuração não pode competir com o
          trabalho do dia na mesma tela. */}
      {gerindo && (
        <Card className="p-5">
          <div className="text-[13px] font-bold text-g-word">{tr("Your own fields")}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-g-muted">
            {tr("Anything you want to remember about a customer that Guileo doesn't ask for — allergy, preferred room, sessions left, referral source.")}
          </p>

          {campos === null && <div className="mt-3 text-[12px] text-g-muted">{tr("Loading…")}</div>}
          {/* NÃO DEU PRA SABER nunca vira "nenhum campo". */}
          {campos === false && <div className="mt-3 text-[12px] text-g-amber">{tr("Couldn't load your fields right now — this is not \"you have none\".")}</div>}
          {Array.isArray(campos) && campos.length === 0 && <div className="mt-3 text-[12px] text-g-muted">{tr("No fields yet.")}</div>}

          {Array.isArray(campos) && campos.length > 0 && (
            <div className="mt-3 grid gap-1.5">
              {campos.map((f) => (
                <div key={f.key} className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2">
                  <span className="text-[13px] text-g-word flex-1 truncate">{f.label}</span>
                  <span className="text-[10.5px] uppercase tracking-wide text-g-muted shrink-0">{f.kind}</span>
                  <button onClick={() => apagaCampo(f.key)} disabled={demo || salvandoCampo === f.key}
                    className="text-[11px] text-g-muted hover:text-g-red shrink-0 disabled:opacity-40">
                    {salvandoCampo === f.key ? "…" : tr("Remove")}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex gap-2 flex-wrap">
            <input value={novoCampo.label} maxLength={60} onChange={(e) => setNovoCampo((f) => ({ ...f, label: e.target.value }))}
              placeholder={tr("Field name (e.g. Allergy)")}
              className="flex-1 min-w-[150px] bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-g-word outline-none placeholder:text-g-muted" />
            <select value={novoCampo.kind} onChange={(e) => setNovoCampo((f) => ({ ...f, kind: e.target.value }))}
              className="bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-g-word outline-none">
              <option value="text">{tr("Text")}</option>
              <option value="number">{tr("Number")}</option>
              <option value="date">{tr("Date")}</option>
              <option value="bool">{tr("Yes / no")}</option>
            </select>
            <button onClick={criaCampo} disabled={demo || salvandoCampo === "novo" || !novoCampo.label.trim()}
              className="btn-bright text-[13px] disabled:opacity-40">{salvandoCampo === "novo" ? "…" : tr("Add field")}</button>
          </div>
          {demo && <div className="mt-2 text-[11px] text-g-muted">{tr("Demo — connect your account to edit")}</div>}
        </Card>
      )}
      {tab === "pipeline" ? (
        dealsLoading ? <SectionSkeleton /> : <PipelineBoard deals={deals} fmtMoney={fmtMoney} tr={tr} demo={demo} onAdvance={advanceDeal} movingId={movingId} />
      ) : (
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("CRM 360")}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search contacts…")} className="bg-white/[0.04] border border-white/10 rounded-full px-3 py-1 text-[12px] text-g-word placeholder:text-g-muted/70 focus:outline-none focus:border-g-green/40 w-36 sm:w-56" />
        </div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
            <button key={c.id || i} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word shrink-0">{(c.full_name || "?").trim()[0]?.toUpperCase() || "?"}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{c.full_name || "—"}
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: lifeColor(c.lifecycle) + "22", color: lifeColor(c.lifecycle) }}>{(c.lifecycle || "lead").toUpperCase()}</span>
                  {(c.churn_risk || 0) >= 50 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 shrink-0">⚠</span>}
                </div>
                <div className="text-[11px] text-g-muted truncate">{c.phone || c.email || "—"} · {c.visit_count || 0} {tr("visits")}</div>
              </div>
              <span className="text-sm font-extrabold text-g-green shrink-0">{fmtMoney(c.ltv_cents)}</span>
            </button>
          ))}
          {rows.length === 0 && <Empty icon="👥" text={tr("No contacts yet — Gui fills this book automatically from every call, message and booking.")} />}
        </div>
      </Card>
      )}
      {sel && (
        <Drawer
          title={sel.full_name || "—"}
          subtitle={sel.phone || sel.email || ""}
          badge={<span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: lifeColor(sel.lifecycle) + "22", color: lifeColor(sel.lifecycle) }}>{(sel.lifecycle || "lead").toUpperCase()}</span>}
          fields={[[tr("Lifetime value"), fmtMoney(sel.ltv_cents)], [tr("visits"), sel.visit_count || 0], [tr("Phone"), sel.phone || "—"], [tr("Email"), sel.email || "—"], [tr("At churn risk"), `${sel.churn_risk || 0}%`], [tr("Last seen"), sel.last || (sel.last_seen_at ? new Date(sel.last_seen_at).toLocaleDateString() : "—")]]}
          actions={(sel.phone || sel.email) ? <a href={waTo(sel.phone, `Hi ${sel.full_name || ""}! `)} target="_blank" rel="noopener" className="btn-bright text-sm">{tr("💬 Message")}</a> : null}
          onClose={() => setSel(null)}
        >
          {/* CAMPOS DO NEGÓCIO — o que este cliente decidiu guardar sobre a pessoa. */}
          {Array.isArray(campos) && campos.length > 0 && (
            <div className="mt-1 mb-5">
              <div className="text-[10px] font-black uppercase tracking-wide text-g-muted mb-2">{tr("Your fields")}</div>
              <div className="space-y-2">
                {campos.map((f) => {
                  const v = (sel.custom || {})[f.key];
                  return (
                    <div key={f.key} className="flex items-center gap-2">
                      <span className="text-[11px] text-g-muted w-[110px] shrink-0 truncate" title={f.label}>{f.label}</span>
                      {f.kind === "bool" ? (
                        <input type="checkbox" checked={v === true} disabled={demo || salvandoCampo === f.key}
                          onChange={(e) => gravaValor(sel.id, f.key, e.target.checked ? "true" : "")}
                          className="h-4 w-4 accent-g-green" />
                      ) : f.kind === "select" ? (
                        <select value={v == null ? "" : String(v)} disabled={demo || salvandoCampo === f.key}
                          onChange={(e) => gravaValor(sel.id, f.key, e.target.value)}
                          className="flex-1 bg-white/[0.05] border border-white/15 rounded-lg px-2 py-1 text-[12px] text-g-word outline-none">
                          <option value="">—</option>
                          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={f.kind === "date" ? "date" : f.kind === "number" ? "text" : "text"}
                          defaultValue={v == null ? "" : String(v)} disabled={demo || salvandoCampo === f.key}
                          inputMode={f.kind === "number" ? "decimal" : undefined}
                          onBlur={(e) => { const novo = e.target.value; const atual = v == null ? "" : String(v); if (novo !== atual) gravaValor(sel.id, f.key, novo); }}
                          placeholder="—"
                          className="flex-1 bg-white/[0.05] border border-white/15 rounded-lg px-2 py-1 text-[12px] text-g-word outline-none placeholder:text-g-muted" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-1">
            <div className="text-[10px] font-black uppercase tracking-wide text-g-muted mb-2">{tr("360° timeline")}</div>
            {tlLoading ? (
              <div className="text-xs text-g-muted">{tr("Loading…")}</div>
            ) : timeline.length ? (
              <div className="space-y-2.5">
                {timeline.map((e, k) => {
                  const ic = { call: "📞", sms: "💬", email: "✉️", booking: "📅", payment: "💳", quote: "🧾", note: "📝", automation: "⚡", stage_change: "🔁" }[e.event_type] || "•";
                  return (
                    <div key={k} className="flex items-start gap-2.5 text-xs">
                      <span className="text-sm leading-none mt-0.5">{ic}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-g-word font-semibold truncate">{e.summary || e.event_type}{e.amount_cents ? <span className="text-g-green"> · {fmtMoney(e.amount_cents)}</span> : null}</div>
                        <div className="text-[10px] text-g-muted">{e.channel ? e.channel + " · " : ""}{e.occurred_at ? new Date(e.occurred_at).toLocaleString() : ""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-g-muted">{demo ? tr("Connect your line and Gui logs every call, message, booking and payment here automatically.") : tr("No activity logged yet — Gui adds every call, message, booking and payment here as it happens.")}</div>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}

export default CRM360;
