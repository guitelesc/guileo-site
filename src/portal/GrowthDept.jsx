/* Split out of Portal.jsx (performance): GrowthDept tab view — code moved verbatim. */
import { useState, useCallback, useEffect } from "react";
import { fetchCRM, toast } from "../lib/portalApi.js";
import { genCustomers, SectionSkeleton, RetryState, tr, DeptTabs, MiniStats, Card, Empty, UI_LANG } from "../pages/Portal.jsx";

const t = (o) => o[UI_LANG] || o.en;

function GrowthDept({ V, onNav, email = "", dataKey = "" }) {
  const demo = !dataKey;
  const [contacts, setContacts] = useState([]);
  const [state, setState] = useState(demo ? "ok" : "loading");
  const [wonback, setWonback] = useState({}); // contact id → true (optimistic, dedupe)
  // Trava de duplo clique do disparo em massa. Declarada AQUI, junto dos outros hooks:
  // `reactivateAll` mora depois dos `return` de loading/erro, e um useState lá dentro
  // seria um hook condicional (quebra as regras de hooks do React).
  const [blasting, setBlasting] = useState(false);
  // `ready:false` (a espinha de CRM ainda não respondeu / não foi ativada) NÃO é "nenhum
  // cliente em risco". Sem essa distinção a tela dava um "está tudo bem" que ninguém apurou —
  // o pior tipo de tranquilidade num painel de retenção.
  const [crmReady, setCrmReady] = useState(true);
  const load = useCallback(() => {
    setState("loading");
    fetchCRM(dataKey, email)
      .then((d) => { setCrmReady(d?.ready !== false); setContacts(d.contacts || []); setState("ok"); })
      .catch(() => setState("err"));
  }, [dataKey, email]);
  useEffect(() => {
    if (demo) {
      const sc = V.customers || genCustomers(V);
      setContacts(sc.map((c, i) => ({ full_name: c.name, ltv_cents: Math.round((c.spent || 0) * 100), lifecycle: i % 3 === 2 ? "lapsed" : i === 0 ? "vip" : "customer", churn_risk: i % 4 === 3 ? 72 : i % 3 === 2 ? 58 : 14 }))); setState("ok"); return;
    }
    load();
  }, [demo, dataKey, email, load]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === "loading") return <SectionSkeleton />;
  if (state === "err") return <RetryState onRetry={load} />;
  const fmtMoney = (c) => `$${Math.round((c || 0) / 100).toLocaleString()}`;
  const atRisk = contacts.filter((c) => (c.churn_risk || 0) >= 50 || ["lapsed", "churned"].includes(c.lifecycle));
  const recoverable = atRisk.reduce((s, c) => s + (c.ltv_cents || 0), 0);
  const riskCls = (r) => r >= 60 ? "bg-red-500/15 text-red-300" : r >= 35 ? "bg-g-gold/15 text-g-gold" : "bg-g-green/15 text-g-green";
  /* ── REATIVAR TODOS ─────────────────────────────────────────────────────────
     DEFEITO CORRIGIDO 2026-08-11: o botão não tinha NENHUMA trava de duplo clique
     (sem `disabled`, sem estado de envio) e dispara /api/reactivate, que manda SMS e
     LIGAÇÕES reais para toda a lista de clientes inativos. Dois cliques — ou um clique
     impaciente enquanto a rede demora — mandavam a mesma leva duas vezes: o cliente do
     cliente recebe a mesma mensagem em duplicidade e a conta paga por ela duas vezes.
     Em cima disso, o toast anunciava "a Gui está reativando N contatos" ANTES de saber
     se o motor tinha respondido. */
  const reactivateAll = async () => {
    if (!dataKey) { toast(tr("Connect your account to reactivate for real.")); return; }
    if (blasting) return;
    setBlasting(true);
    try {
      const r = await fetch("/api/reactivate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: dataKey, email }) });
      const d = await r.json().catch(() => ({}));
      // Só é sucesso com NÚMERO. `ok:true` com 0 alcançados não é "reativado ✓".
      if (r.ok && d?.ok) {
        const n = (Number(d.sms) || 0) + (Number(d.calls) || 0);
        toast(n > 0 ? `${tr("Gui reached")} ${n} ${tr("customers")} ✓` : tr("Nobody was reachable right now — nothing was sent."));
      } else toast(d?.error || tr("Couldn't reach the reactivation engine — try again."));
    } catch { toast(tr("Couldn't reach the reactivation engine — try again.")); }
    setBlasting(false);
  };
  // Per-customer "Win back" — REAL reengage (Gui emails now, or queues an SMS/call). Only ever
  // toasts success on a real ok+queued response; dedupes via `wonback`. In real mode a contact with
  // no phone/email can't be reached → the button is HIDDEN (never a fake success).
  const winBack = async (c) => {
    const contact = (c.phone || c.email || "").toString();
    const id = c.id || contact || c.full_name;
    if (!contact || wonback[id]) return;
    setWonback((s) => ({ ...s, [id]: true }));                        // optimistic + dedupe
    try {
      const r = await fetch("/api/growth-intel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reengage", token: dataKey, email, name: c.full_name || "", contact, suggested: "sms", risk: c.churn_risk }) });
      const d = await r.json().catch(() => ({}));
      if (!(r.ok && d?.ok && d?.queued)) { setWonback((s) => { const n = { ...s }; delete n[id]; return n; }); toast(tr("Couldn't reach the reactivation engine — try again.")); return; }
      const who = c.full_name || tr("this customer");
      toast(d.sent ? `${tr("Gui reactivated")} ${who} ${tr("by email ✓")}` : `${tr("Gui is reaching out to")} ${who} ✓`);
    } catch { setWonback((s) => { const n = { ...s }; delete n[id]; return n; }); toast(tr("Couldn't reach the reactivation engine — try again.")); }
  };
  return (
    <div className="space-y-4 stagger">
      <DeptTabs cur="retention" onNav={onNav} items={[["retention", "Growth & Retention"], ["followups", "Follow-ups"], ["recurring", "Recurring"], ["loyalty", "Loyalty"], ["reputation", "Reputation"], ["waitlist", "Waitlist"]]} />
      {/* SELO: sem conta conectada, os contatos e o "valor recuperável" abaixo são exemplo.
          Sem ele, um número de dinheiro inventado ficava indistinguível de um real. */}
      {demo && (
        <div className="rounded-xl2 border border-g-gold/40 bg-g-gold/10 px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {t({ en: "Example · not your data — connect your account to see your real at-risk customers.", pt: "Exemplo · não são seus dados — conecte sua conta para ver seus clientes em risco reais.", es: "Ejemplo · no son tus datos — conecta tu cuenta para ver tus clientes en riesgo reales.", hi: "उदाहरण · यह आपका डेटा नहीं — असली जोखिम वाले ग्राहक देखने के लिए खाता कनेक्ट करें।" })}
        </div>
      )}
      <MiniStats items={[[`${tr("At risk")}${demo ? ` · ${t({ en: "EXAMPLE", pt: "EXEMPLO", es: "EJEMPLO", hi: "उदाहरण" })}` : ""}`, `${atRisk.length}`, atRisk.length ? "bad" : undefined], [`${tr("Recoverable value")}${demo ? ` · ${t({ en: "EXAMPLE", pt: "EXEMPLO", es: "EJEMPLO", hi: "उदाहरण" })}` : ""}`, fmtMoney(recoverable), "good"], [tr("Total contacts"), `${contacts.length}`]]} />
      <Card className="border-g-gold/25 bg-g-gold/[0.05]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word">🔄 {tr("Win back who's slipping away")}</div><div className="text-xs text-g-muted mt-0.5">{tr("Gui reaches every lapsing customer with a personal nudge — one tap.")}</div></div>
          {atRisk.length > 0 && (
            <button onClick={reactivateAll} disabled={blasting} className="btn-bright text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
              {blasting ? tr("Sending…") : `${tr("Reactivate all")} (${atRisk.length})`}
            </button>
          )}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Slipping away")}</span></div>
        <div className="divide-y divide-white/[0.06]">
          {atRisk.length ? atRisk.slice(0, 40).map((c, i) => {
            const contact = (c.phone || c.email || "").toString();
            const id = c.id || contact || c.full_name;
            return (
            <div key={id || i} className="flex items-center gap-3 px-5 py-3">
              <span className={`grid place-items-center h-9 w-9 rounded-full text-[12px] font-black shrink-0 ${riskCls(c.churn_risk || 0)}`}>{c.churn_risk || 0}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.full_name || tr("Unknown")}</div><div className="text-[11px] text-g-muted truncate">{["lapsed", "churned"].includes(c.lifecycle) ? tr("lapsed") : tr("at churn risk")} · {fmtMoney(c.ltv_cents)} LTV</div></div>
              {demo ? (
                <button onClick={() => toast(`${tr("Gui is reaching out to")} ${c.full_name || ""} ✓`)} className="btn-ghost text-[12px] shrink-0">{tr("Win back")}</button>
              ) : wonback[id] ? (
                <span className="text-[12px] font-bold text-g-green shrink-0 px-2 py-1">{tr("Reaching out ✓")}</span>
              ) : contact ? (
                <button onClick={() => winBack(c)} className="btn-ghost text-[12px] shrink-0">{tr("Win back")}</button>
              ) : null /* real mode, no phone/email → hide rather than fake a send */}
            </div>
          ); }) : <Empty icon={!demo && !crmReady ? "⚠️" : "🎉"} text={
            demo ? tr("When a loyal customer starts slipping, Gui flags them here and wins them back automatically.")
              : !crmReady ? t({ en: "I couldn't read your customer book just now — so this is NOT an all-clear. Reload in a moment.", pt: "Não consegui ler sua base de clientes agora — então isto NÃO é um \"está tudo bem\". Recarregue em instantes.", es: "No pude leer tu base de clientes ahora — esto NO es un \"todo bien\". Recarga en un momento.", hi: "अभी आपकी ग्राहक सूची नहीं पढ़ सका — इसलिए यह \"सब ठीक है\" नहीं है। थोड़ी देर में फिर लोड करें।" })
              : tr("Nobody's slipping right now — Gui keeps watching and flags at-risk customers here.")} />}
        </div>
      </Card>
    </div>
  );
}

export default GrowthDept;
