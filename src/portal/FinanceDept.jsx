/* Split out of Portal.jsx (performance): FinanceDept tab view — code moved verbatim. */
import { useState, useCallback, useEffect } from "react";
import { fetchCrmInvoicesDetalhado, chamarApi } from "../lib/portalApi.js";
import { genCustomers, SectionSkeleton, DeptTabs, Card, tr, Empty, UI_LANG, Toggle } from "../pages/Portal.jsx";
import NoSeuPlano from "./NoSeuPlano.jsx";
import FalhaDeLeitura, { fraseDaFalha } from "./FalhaDeLeitura.jsx";

// Frase única para "o recurso existe mas ainda não foi ligado para esta conta".
// 🚨 (2026-09-28) A tela mandava a CLIENTE "paste db/collections_optin.sql in Supabase". Ela não
// tem Supabase, não sabe o que é SQL e não deveria saber: instrução de engenharia na tela de quem
// paga é um pedido de socorro disfarçado de texto. Quem liga o recurso somos nós.
const naoLigadoAinda = () => tr("This feature isn't switched on for your account yet. Message our team and we'll turn it on.");

// Which invoice statuses are open/collectible. crm_invoices_list flags 'overdue' at read
// time (sent + past due); the /api/collections nudge engine (finance_overdue_list) can only
// text a reminder for PAST-DUE invoices, so "Collect now" only appears on overdue rows.
const isOverdue = (iv) => (iv && iv.status === "overdue");

// "💳 A receber" — the overdue book + Gui's polite collection engine (/api/collections).
// Flow: list overdue → "Prever cobrança" (dryRun, sends NOTHING) → honest confirm → real run.
function Receivables({ demo, email, dataKey, V, fmtMoney }) {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading"); // loading | ok | off | err
  const [falha, setFalha] = useState(null);      // motivo da falha de leitura (state === "err")
  const [tentativa, setTentativa] = useState(0);
  const [avisoPrevia, setAvisoPrevia] = useState(null); // frase quando a prévia não veio
  const [preview, setPreview] = useState(null);  // dryRun result awaiting confirm
  const [result, setResult] = useState(null);    // real-run result
  const [busy, setBusy] = useState(false);
  // "✓ Marcar paga" — inline 2-click confirm (which row is armed) + honest toast/error.
  const [confirmId, setConfirmId] = useState(null); // invoice id awaiting 2nd click
  const [payBusy, setPayBusy] = useState(null);     // invoice id currently being marked
  const [toast, setToast] = useState(null);         // { kind:"ok"|"err", text }
  // AUTO-COLLECTIONS opt-in — mirrors the flag the weekly cron sweep reads (auto_get/auto_set).
  // state: loading | ready | pending (ainda não ligado para a conta) | erro (não consegui ler) | demo
  const [auto, setAuto] = useState({ state: demo ? "demo" : "loading", on: false });
  // Devolve {data, motivo} e NUNCA levanta. A versão antiga fazia `.then(r => r.json())` sem olhar
  // `r.ok`: um 401/500 com corpo JSON passava por resposta boa.
  const api = useCallback((body) => chamarApi("/api/collections", { token: dataKey, email: email || "", lang: UI_LANG, ...body }), [dataKey, email]);

  useEffect(() => {
    let alive = true;
    if (demo) {
      const sc = V.customers || genCustomers(V);
      setRows(sc.slice(0, 3).map((c, i) => ({ id: `ov${i}`, contact_name: c.name, number: `INV-${2000 + i}`, amount_cents: Math.round((c.spent || 80) * 100), days_late: [4, 11, 23][i % 3], nudged_at: null })));
      setState("ok");
      return () => { alive = false; };
    }
    // 🚨 (2026-09-28) O `.catch(() => setState("ok"))` daqui transformava QUALQUER falha em
    // "Nothing overdue — every invoice is on time". Dizer a uma dona de negócio que ninguém está
    // devendo, quando a verdade é "não consegui ler", é o erro mais caro desta tela.
    setState("loading"); setFalha(null);
    api({ action: "list" }).then((r) => {
      if (!alive) return;
      if (r.motivo) { setFalha(r.motivo); setState("err"); return; }
      const d = r.data;
      if (d.ready === false) { setRows([]); setState("off"); return; }
      if (!Array.isArray(d.invoices)) { setFalha("resposta_estranha"); setState("err"); return; }
      setRows(d.invoices.filter(Boolean)); setState("ok");
    });
    // Estado do opt-in: "pending" só quando o SERVIDOR disse que não está ligado. Falha de leitura
    // é "erro" — outro estado, outra frase.
    api({ action: "auto_get" }).then((r) => {
      if (!alive) return;
      if (r.motivo) { setAuto({ state: "erro", on: false, motivo: r.motivo }); return; }
      const d = r.data;
      setAuto(d.ok && d.ready === true ? { state: "ready", on: d.enabled === true } : { state: "pending", on: false });
    });
    return () => { alive = false; };
  }, [demo, api, V, tentativa]); // eslint-disable-line react-hooks/exhaustive-deps

  // Optimistic flip with revert on failure; a ready:false answer drops to honest "pending".
  const flipAuto = async () => {
    if (demo || auto.state !== "ready") return;
    const want = !auto.on;
    setAuto({ state: "ready", on: want });
    const r = await api({ action: "auto_set", enabled: want });
    const d = r.data;
    if (!r.motivo && d?.ok && d.ready === true) setAuto({ state: "ready", on: d.enabled === true });
    else if (!r.motivo && d?.ok && d.ready === false) setAuto({ state: "pending", on: false });
    else {
      // Reverte E AVISA: o botão voltar sozinho, calado, parece defeito do dedo de quem clicou.
      setAuto({ state: "ready", on: !want });
      setToast({ kind: "err", text: `${tr("Couldn't change this setting.")} ${r.motivo ? fraseDaFalha(r.motivo) : ""}`.trim() });
    }
  };

  const doPreview = async () => {
    setBusy(true); setResult(null); setAvisoPrevia(null);
    const r = await api({ action: "nudge", dryRun: true });
    if (!r.motivo && r.data?.ok) setPreview(r.data);
    else {
      // Antes: prévia que falhava não mostrava NADA — o botão piscava e a pessoa ficava sem saber
      // se tinha clicado. Agora diz que não veio, e que nada foi enviado.
      setPreview(null);
      setAvisoPrevia(`${tr("I couldn't prepare the preview. Nothing was sent.")} ${r.motivo ? fraseDaFalha(r.motivo) : ""}`.trim());
    }
    setBusy(false);
  };
  const doSend = async () => {
    setBusy(true);
    const r = await api({ action: "nudge" });
    setResult(!r.motivo && r.data?.ok ? r.data : { ok: false, motivo: r.motivo });
    setPreview(null);
    const l = await api({ action: "list" });
    if (!l.motivo && Array.isArray(l.data?.invoices)) setRows(l.data.invoices.filter(Boolean));
    setBusy(false);
  };

  // Mark ONE overdue invoice as paid. Only fires on the 2nd click (confirm). Removes the row
  // on success + toasts; a false/error stays visible (never silent). Disabled in demo.
  const markPaid = async (iv) => {
    if (demo || payBusy) return;
    setPayBusy(iv.id); setToast(null);
    const r = await api({ action: "mark_paid", id: iv.id });
    if (!r.motivo && r.data?.ok && r.data.paid === true) {
      setRows((rs) => rs.filter((x) => x.id !== iv.id));
      setToast({ kind: "ok", text: `${tr("Marked paid")}: ${iv.number || iv.contact_name || tr("invoice")}` });
    } else {
      // honest: not found / already paid / other tenant / rede — no fake success
      setToast({ kind: "err", text: tr("Couldn't mark it paid — refresh and try again.") });
    }
    setPayBusy(null); setConfirmId(null);
  };

  if (state === "loading" && !demo) return null;
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-g-gold">💳 {tr("Receivables")}</span>
        <button
          onClick={doPreview}
          disabled={demo || busy || state !== "ok" || !rows.length}
          title={demo ? tr("Demo") : undefined}
          className={`rounded-full px-3 py-1 text-[11.5px] font-bold border transition ${demo || busy || state !== "ok" || !rows.length ? "border-white/10 text-g-muted/50 cursor-not-allowed" : "border-g-green/40 bg-g-green/10 text-g-green hover:bg-g-green/20"}`}
        >{busy && !preview ? "…" : tr("Preview collection")}</button>
      </div>
      {/* 🤖 AUTO-COLLECTIONS opt-in — ON puts this business in Gui's weekly sweep; OFF (default) keeps collections manual-only. */}
      <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12.5px] font-bold text-g-word">🤖 {tr("Weekly auto-collection")}</div>
          <div className="text-[11px] text-g-muted">
            {demo ? tr("Demo — connect your business to switch this on.")
              : auto.state === "pending" ? naoLigadoAinda()
              : auto.state === "erro" ? fraseDaFalha(auto.motivo)
              : auto.on ? tr("On — Gui includes this business in the weekly sweep: max 10 reminders a week, never the same customer twice in 72h.")
              : tr("Off — reminders only go out when you press the button.")}
          </div>
        </div>
        <div
          className={`shrink-0 ${demo || auto.state !== "ready" ? "opacity-40" : ""}`}
          title={demo ? tr("Demo — connect your business to switch this on.") : auto.state === "pending" ? naoLigadoAinda() : undefined}
        >
          {/* pointer-events off on the switch itself so the disabled wrapper still shows its tooltip */}
          <span className={demo || auto.state !== "ready" ? "pointer-events-none inline-block" : "inline-block"}>
            <Toggle on={auto.on} onClick={flipAuto} />
          </span>
        </div>
      </div>
      {state === "off" ? (
        <div className="px-5 py-6 text-center text-xs text-g-muted">{naoLigadoAinda()}</div>
      ) : state === "err" ? (
        <div className="px-5 py-4"><FalhaDeLeitura compacto motivo={falha} onRetry={() => setTentativa((n) => n + 1)} titulo={tr("I couldn't read your overdue invoices just now.")} /></div>
      ) : (
      <div className="divide-y divide-white/[0.06]">
        {rows.length ? rows.slice(0, 25).map((iv, i) => (
          <div key={iv.id || i} className="flex items-center gap-3 px-5 py-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-g-word truncate">{iv.contact_name || tr("Unknown")}</div>
              <div className="text-[11px] text-g-muted truncate">{iv.number || ""}{iv.nudged_at ? ` · 💬 ${new Date(iv.nudged_at).toLocaleDateString()}` : ""}</div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-red-500/15 text-red-300">{iv.days_late || 0}d {tr("overdue")}</span>
            <span className="text-sm font-extrabold text-g-green shrink-0">{fmtMoney(iv.amount_cents)}</span>
            {/* ✓ Marcar paga — discreto; 1º clique arma o confirm, 2º dá baixa. Demo = desabilitado. */}
            {confirmId === iv.id ? (
              <span className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => markPaid(iv)}
                  disabled={payBusy === iv.id}
                  className="rounded-full px-2.5 py-0.5 text-[10.5px] font-black border border-g-green/50 bg-g-green/15 text-g-green hover:bg-g-green/25 transition disabled:opacity-50 min-h-[44px] inline-flex items-center"
                  title={`${tr("Confirm: mark")} ${iv.number || iv.contact_name || ""} ${tr("of")} ${fmtMoney(iv.amount_cents)} ${tr("as paid?")}`}
                >{payBusy === iv.id ? "…" : `✓ ${tr("Confirm")}`}</button>
                <button
                  onClick={() => setConfirmId(null)}
                  disabled={payBusy === iv.id}
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-bold border border-white/10 text-g-muted hover:text-g-word transition disabled:opacity-50 min-h-[44px] inline-flex items-center"
                >{tr("Cancel")}</button>
              </span>
            ) : (
              <button
                onClick={() => { setToast(null); setConfirmId(iv.id); }}
                disabled={demo}
                title={demo ? tr("Demo") : `${tr("Mark")} ${iv.number || ""} ${tr("as paid")}`}
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold border shrink-0 transition ${demo ? "border-white/10 text-g-muted/50 cursor-not-allowed" : "border-white/12 text-g-muted hover:border-g-green/40 hover:text-g-green"}`}
              >✓ {tr("Paid")}</button>
            )}
          </div>
        )) : <Empty icon="✅" text={demo ? tr("When an invoice runs past due it lands here — and Gui reminds the customer politely, with the pay link.") : tr("Nothing overdue — every invoice is on time. Gui keeps it that way with gentle reminders.")} />}
      </div>
      )}
      {toast && (
        <div className={`border-t px-5 py-2.5 text-[12px] font-bold ${toast.kind === "ok" ? "border-g-green/25 bg-g-green/[0.06] text-g-green" : "border-red-400/25 bg-red-500/[0.06] text-red-300"}`}>
          {toast.kind === "ok" ? "✅ " : "✗ "}{toast.text}
        </div>
      )}
      {avisoPrevia && !preview && (
        <div role="alert" className="border-t border-red-400/25 bg-red-500/[0.06] px-5 py-2.5 text-[12px] font-bold text-red-300">✗ {avisoPrevia}</div>
      )}
      {preview && (
        <div className="border-t border-g-gold/25 bg-g-gold/[0.05] px-5 py-4 space-y-3">
          <div className="text-xs font-bold text-g-word">{tr("Preview — nothing sent yet:")}</div>
          <div className="space-y-2">
            {(preview.results || []).slice(0, 8).map((p, i) => (
              <div key={i} className="text-[11.5px]">
                <span className="font-bold text-g-word">{p.to}</span>
                {p.skip ? <span className="text-g-muted"> — ⏭ {p.skip}</span> : <span className="text-g-muted"> — “{p.msg}”</span>}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={doSend} disabled={busy || !preview.sent} className="rounded-full px-4 py-1.5 text-[12px] font-black border border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition disabled:opacity-50">
              {busy ? "…" : `${tr("Send REAL reminders to")} ${preview.sent} ${tr(preview.sent === 1 ? "customer" : "customers")}`}
            </button>
            <button onClick={() => setPreview(null)} className="rounded-full px-4 py-1.5 text-[12px] font-bold border border-white/10 text-g-muted hover:text-g-word transition">{tr("Cancel")}</button>
          </div>
        </div>
      )}
      {result && (
        <div className="border-t border-white/10 px-5 py-3 text-[12px]">
          {result.ok
            ? <span className="text-g-green font-bold">✅ {result.sent} {tr("sent")} · {result.skipped} {tr("skipped")}</span>
            : <span className="text-red-300 font-bold">✗ {tr("Something went wrong — try again.")} {result.motivo ? fraseDaFalha(result.motivo) : ""}</span>}
        </div>
      )}
    </Card>
  );
}

// `real` chega null enquanto o shell (Portal.jsx, view "finance") não a passar: NoSeuPlano
// devolve null sem plano conhecido, então o convite simplesmente não aparece — nunca acusa errado.
function FinanceDept({ V, onNav, email = "", dataKey = "", real = null }) {
  const demo = !dataKey;
  const [invoices, setInvoices] = useState([]);
  const [state, setState] = useState(demo ? "ok" : "loading");
  const [falha, setFalha] = useState(null);
  // "Collect now" state (declared with the other hooks — must be above the early returns below).
  const [collectId, setCollectId] = useState(null);     // invoice id awaiting 2nd click
  const [collectBusy, setCollectBusy] = useState(null);  // invoice id currently sending
  const [collectToast, setCollectToast] = useState(null); // { kind:"ok"|"err", text }
  const load = useCallback(() => {
    setState("loading");
    // 🚨 (2026-09-28) O `.catch` daqui era código morto: o leitor antigo engole toda falha e
    // devolve []. A tela ia para "ok" com Paid $0 · Outstanding $0 · Overdue $0 — três afirmações
    // falsas sobre dinheiro. Agora o motivo chega e o estado "err" é alcançável de verdade.
    setFalha(null);
    fetchCrmInvoicesDetalhado(dataKey, email).then((r) => {
      if (r.motivo) { setFalha(r.motivo); setState("err"); return; }
      setInvoices((r.data || []).filter(Boolean)); setState("ok");
    });
  }, [dataKey, email]);
  useEffect(() => {
    if (demo) {
      const sc = V.customers || genCustomers(V);
      const sts = ["paid", "sent", "overdue", "paid", "sent"];
      setInvoices(sc.map((c, i) => ({ id: `inv${i}`, contact_name: c.name, number: `INV-${1000 + i}`, amount_cents: Math.round((c.spent || 50) * 100), status: sts[i % 5], due_at: null }))); setState("ok"); return;
    }
    load();
  }, [demo, dataKey, email, load]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === "loading") return <SectionSkeleton />;
  if (state === "err") return <FalhaDeLeitura motivo={falha} onRetry={load} titulo={tr("I couldn't load your invoices just now.")} />;
  const fmtMoney = (c) => `$${Math.round((c || 0) / 100).toLocaleString()}`;
  const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.amount_cents || 0), 0);
  const outstanding = invoices.filter((i) => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + (i.amount_cents || 0), 0);
  const overdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + (i.amount_cents || 0), 0);
  const stColor = (s) => s === "paid" ? "#3E9468" : s === "overdue" ? "#B66" : s === "sent" ? "#D6C29A" : "#9AA0A6";

  // ── "Collect now" — fire the REAL polite reminder (WhatsApp/SMS + pay link) for ONE overdue
  // invoice through the same per-tenant gated engine Receivables uses (/api/collections nudge,
  // ids:[id]). Atomic 72h SQL dedup means a double-tap (or Receivables running too) can't double-send.
  // 1st click arms confirm, 2nd sends. Honest result only: success needs a real sent>=1. Demo = off.
  const collectNow = async (iv) => {
    if (demo || collectBusy) return;
    setCollectBusy(iv.id); setCollectToast(null);
    {
      const r = await chamarApi("/api/collections", { token: dataKey, email: email || "", lang: UI_LANG, action: "nudge", ids: [iv.id] });
      const d = r.data;
      if (r.motivo) {
        // Falha NOSSA (rede/servidor/chave) não pode virar "o cliente talvez não tenha telefone".
        setCollectToast({ kind: "err", text: `${tr("Couldn't send a reminder — try again.")} ${fraseDaFalha(r.motivo)}` });
      } else if (d?.ok && d.sent >= 1) {
        setCollectToast({ kind: "ok", text: `${tr("Payment reminder sent to")} ${iv.contact_name || tr("customer")}` });
      } else if (d?.ok && d.claimed_dupe >= 1) {
        setCollectToast({ kind: "ok", text: tr("Already reminded in the last 72h — staying polite.") });
      } else {
        // honest: no phone / no consent / not collectible — never a fake "sent ✓"
        setCollectToast({ kind: "err", text: tr("Couldn't send a reminder — the customer may have no phone or texting consent on file.") });
      }
    }
    setCollectBusy(null); setCollectId(null);
  };

  return (
    <div className="space-y-4 stagger">
      {/* convite, nunca cadeado: diz que este recurso mora no degrau de cima (ver NoSeuPlano.jsx) */}
      <NoSeuPlano real={real} produto="close_collect" />
      <DeptTabs cur="finance" onNav={onNav} items={[["finance", "Finance"], ["payments", "Payments"]]} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card tone="green"><div className="text-[11px] uppercase tracking-wide text-g-muted">{tr("Paid")}</div><div className="text-2xl font-extrabold text-g-green money-glow mt-1">{fmtMoney(paid)}</div></Card>
        <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">{tr("Outstanding")}</div><div className="text-2xl font-extrabold text-g-word mt-1">{fmtMoney(outstanding)}</div></Card>
        <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">{tr("Overdue")}</div><div className={`text-2xl font-extrabold mt-1 ${overdue ? "text-red-300" : "text-g-light"}`}>{fmtMoney(overdue)}</div></Card>
      </div>
      <Receivables demo={demo} email={email} dataKey={dataKey} V={V} fmtMoney={fmtMoney} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">🧾 {tr("Invoices")}</span></div>
        <div className="divide-y divide-white/[0.06]">
          {invoices.length ? invoices.slice(0, 40).map((iv, i) => (
            <div key={iv.id || i} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{iv.contact_name || tr("Unknown")}</div><div className="text-[11px] text-g-muted truncate">{iv.number || ""}{iv.due_at ? ` · ${tr("due")} ${new Date(iv.due_at).toLocaleDateString()}` : ""}</div></div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: stColor(iv.status) + "22", color: stColor(iv.status) }}>{tr(iv.status || "draft")}</span>
              <span className="text-sm font-extrabold text-g-green shrink-0">{fmtMoney(iv.amount_cents)}</span>
              {/* 💳 Collect now — real WhatsApp/SMS reminder + pay link, overdue invoices only, 2-click confirm. Demo = off. */}
              {!demo && isOverdue(iv) && (
                collectId === iv.id ? (
                  <span className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => collectNow(iv)}
                      disabled={collectBusy === iv.id}
                      className="rounded-full px-2.5 py-0.5 text-[10.5px] font-black border border-g-green/50 bg-g-green/15 text-g-green hover:bg-g-green/25 transition disabled:opacity-50 min-h-[44px] inline-flex items-center"
                      title={`${tr("Send a polite payment reminder to")} ${iv.contact_name || tr("this customer")}?`}
                    >{collectBusy === iv.id ? "…" : `✓ ${tr("Send reminder")}`}</button>
                    <button
                      onClick={() => setCollectId(null)}
                      disabled={collectBusy === iv.id}
                      className="rounded-full px-2 py-0.5 text-[10.5px] font-bold border border-white/10 text-g-muted hover:text-g-word transition disabled:opacity-50 min-h-[44px] inline-flex items-center"
                    >{tr("Cancel")}</button>
                  </span>
                ) : (
                  <button
                    onClick={() => { setCollectToast(null); setCollectId(iv.id); }}
                    title={`${tr("Collect")} ${iv.number || ""}`}
                    className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold border shrink-0 border-white/12 text-g-muted hover:border-g-green/40 hover:text-g-green transition min-h-[44px] inline-flex items-center"
                  >💳 {tr("Collect now")}</button>
                )
              )}
            </div>
          )) : <Empty icon="🧾" text={demo ? tr("When Gui closes & collects on a call, the invoice lands here — paid, sent or overdue, always reconciled.") : tr("No invoices yet — Gui opens one when it closes a sale and marks it paid on collection.")} />}
        </div>
        {collectToast && (
          <div className={`border-t px-5 py-2.5 text-[12px] font-bold ${collectToast.kind === "ok" ? "border-g-green/25 bg-g-green/[0.06] text-g-green" : "border-red-400/25 bg-red-500/[0.06] text-red-300"}`}>
            {collectToast.kind === "ok" ? "✅ " : "✗ "}{collectToast.text}
          </div>
        )}
      </Card>
    </div>
  );
}

export default FinanceDept;
