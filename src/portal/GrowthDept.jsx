/* Split out of Portal.jsx (performance): GrowthDept tab view. */
import { useState, useCallback, useEffect } from "react";
import { fetchCRM, toast } from "../lib/portalApi.js";
import { genCustomers, SectionSkeleton, RetryState, tr, DeptTabs, MiniStats, Card, Empty, UI_LANG } from "../pages/Portal.jsx";

const t = (o) => o[UI_LANG] || o.en;

// POST que devolve {http, d} e nunca lança. `d` é o corpo (ou null quando não veio JSON).
async function post(url, corpo) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    return { http: r.status, d: await r.json().catch(() => null) };
  } catch { return { http: 0, d: null }; }
}
// O servidor manda o motivo em `erro` (e, por compatibilidade, em `error`). A tela lia só
// `d.error` — quando vinha só `erro`, caía no genérico "couldn't reach the engine".
const motivoDe = (d) => (d && (d.erro || d.error) ? String(d.erro || d.error) : "");
// Motor de reativação indisponível → frase da TELA, no idioma da sessão. O `codigo` é do servidor
// (functions/api/reactivate.js); código desconhecido usa a frase que o servidor mandou.
const FRASE_FORA = {
  sem_canal: "Reactivation by text or call isn't available on your account yet — text messaging is still waiting for carrier approval. Nothing was sent.",
  fonte_fora: "The reactivation engine isn't available right now. This does NOT mean there is nobody to win back. Nothing was sent.",
};
const fraseFora = (d) => (FRASE_FORA[d?.codigo] ? tr(FRASE_FORA[d.codigo]) : (motivoDe(d) || tr("Reactivation isn't available yet. Nothing was sent.")));

function GrowthDept({ V, onNav, email = "", dataKey = "" }) {
  const demo = !dataKey;
  // 🚨 UMA FONTE SÓ PARA "EM RISCO" (2026-09-28). Esta tela recontava no navegador
  // (`churn_risk >= 50 || lifecycle lapsed/churned` sobre a lista do CRM) enquanto o servidor
  // (churn_risk_scan, que exige ≥3 visitas e ≥14 dias de histórico) respondia ZERO para a mesma
  // conta: o dono via "1 at risk" aqui e "ninguém em risco" na tela de Inteligência. A lista
  // agora É a do servidor — a mesma de /api/growth-intel action:"churn".
  const [risco, setRisco] = useState([]);
  const [total, setTotal] = useState(null);           // nº de contatos; null = não lido
  const [state, setState] = useState(demo ? "ok" : "loading");
  const [wonback, setWonback] = useState({});          // id → "enviado" | "registrado" | "indo"
  const [blasting, setBlasting] = useState(false);
  // Prévia da reativação em massa: null (fechada) | {estado:"lendo"} | {estado:"pronta", d}
  // | {estado:"fora", frase, pulled} | {estado:"falhou"} | {estado:"enviada", n, pulados}
  const [previa, setPrevia] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    const [ch, crm] = await Promise.all([
      post("/api/growth-intel", { action: "churn", token: dataKey, email }),
      fetchCRM(dataKey, email).catch(() => null),
    ]);
    const d = ch.d;
    // lista ausente ≠ lista vazia: sem `atRisk` lido, a tela diz "não consegui ler", nunca "ninguém em risco"
    if (ch.http < 200 || ch.http >= 300 || !d || d.ok !== true || !Array.isArray(d.atRisk)) { setState("err"); return; }
    setRisco(d.atRisk.map((c) => ({
      id: c.phone || c.contact_email || c.name, name: (c.name || "").toString().trim(), contact: (c.phone || c.contact_email || "").toString(),
      risk: Number(c.risk) || 0, ltv_cents: Math.round((Number(c.ltv) || 0) * 100), dias: c.days_since_visit, visitas: c.visits, sugerido: c.suggested_action || "sms",
    })));
    setTotal(crm && !crm.falha && crm.ready !== false ? (Number(crm.count) || (crm.contacts || []).length) : null);
    setState("ok");
  }, [dataKey, email]);
  useEffect(() => {
    if (demo) {
      const sc = V.customers || genCustomers(V);
      setRisco(sc.map((c, i) => ({ id: c.name, name: c.name, contact: "", ltv_cents: Math.round((c.spent || 0) * 100), risk: i % 4 === 3 ? 72 : i % 3 === 2 ? 58 : 14 })).filter((c) => c.risk >= 50));
      setTotal(sc.length); setState("ok"); return;
    }
    load();
  }, [demo, dataKey, email, load]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === "loading") return <SectionSkeleton />;
  if (state === "err") return <RetryState onRetry={load} />;
  const fmtMoney = (c) => `$${Math.round((c || 0) / 100).toLocaleString()}`;
  const recoverable = risco.reduce((s, c) => s + (c.ltv_cents || 0), 0);
  const riskCls = (r) => r >= 60 ? "bg-red-500/15 text-red-300" : r >= 35 ? "bg-g-gold/15 text-g-gold" : "bg-g-green/15 text-g-green";

  /* ── REATIVAÇÃO EM MASSA: PRÉVIA → CONFIRMAÇÃO → ENVIO ──────────────────────────────────────
     🚨 (2026-09-28) "Reactivate all (N)" disparava SMS/ligação REAL para a base inteira com UM
     clique, sem dizer para quantas pessoas nem por qual canal — e o N do botão vinha da conta do
     navegador, não da lista que o servidor de fato usaria. Um toque errado no celular era uma
     leva de mensagens para clientes de verdade.
     Agora são dois passos: o primeiro clique pede a PRÉVIA (`dryRun:true` — não envia nem gasta
     nada) e mostra quantas pessoas, por qual canal, quantas ficam de fora e a mensagem exata; só
     o segundo clique envia. Quando o motor não está disponível, a tela diz isso — sem sucesso
     falso e sem culpar a conexão do cliente.
     A trava de duplo clique (2026-08-11) continua: `blasting`. */
  const pedirPrevia = async () => {
    if (demo) { toast(tr("Demo — connect your account to reactivate for real.")); return; }
    if (previa?.estado === "lendo" || blasting) return;
    setPrevia({ estado: "lendo" });
    const { http, d } = await post("/api/reactivate", { token: dataKey, email, channel: "sms", dryRun: true });
    if (d?.motor_indisponivel) { setPrevia({ estado: "fora", frase: fraseFora(d), pulled: Number.isFinite(Number(d.pulled)) ? Number(d.pulled) : null }); return; }
    if (http < 200 || http >= 300 || !d || d.ok !== true) { setPrevia({ estado: "falhou", frase: motivoDe(d) }); return; }
    setPrevia({ estado: "pronta", d });
  };
  const enviar = async () => {
    if (blasting || previa?.estado !== "pronta") return;
    setBlasting(true);
    const { http, d } = await post("/api/reactivate", { token: dataKey, email, channel: "sms" });
    setBlasting(false);
    if (d?.motor_indisponivel) { setPrevia({ estado: "fora", frase: fraseFora(d), pulled: null }); return; }
    if (http < 200 || http >= 300 || !d || d.ok !== true) { setPrevia({ estado: "falhou", frase: motivoDe(d) }); return; }
    // Só é sucesso com NÚMERO. `ok:true` com 0 alcançados não é "reativado ✓".
    const n = (Number(d.sms) || 0) + (Number(d.calls) || 0);
    setPrevia({ estado: "enviada", n, pulados: Number(d.skipped) || 0 });
    toast(n > 0 ? `${tr("Gui reached")} ${n} ${tr("customers")} ✓` : tr("Nobody was reachable right now — nothing was sent."));
  };

  // Per-customer "Win back" — REAL reengage. O servidor devolve `sent:true` só quando o E-MAIL
  // saiu de fato; com telefone ele apenas REGISTRA o pedido (SMS ainda aguarda aprovação). A tela
  // dizia "Gui is reaching out ✓" nos dois casos — agora cada um tem a sua frase.
  const winBack = async (c) => {
    if (!c.contact || wonback[c.id]) return;
    setWonback((s) => ({ ...s, [c.id]: "indo" }));                    // trava de duplo clique
    const desfaz = () => setWonback((s) => { const n = { ...s }; delete n[c.id]; return n; });
    const { http, d } = await post("/api/growth-intel", { action: "reengage", token: dataKey, email, name: c.name || "", contact: c.contact, suggested: c.sugerido === "call" ? "call" : "sms", risk: c.risk });
    if (http < 200 || http >= 300 || !d || d.ok !== true || !d.queued) { desfaz(); toast(motivoDe(d) ? `${tr("Couldn't do it")}: ${motivoDe(d)}` : tr("Couldn't reach the reactivation engine — try again.")); return; }
    const who = c.name || tr("this customer");
    setWonback((s) => ({ ...s, [c.id]: d.sent ? "enviado" : "registrado" }));
    toast(d.sent ? `${tr("Gui emailed")} ${who} ✓` : `${tr("Request logged for")} ${who} — ${tr("no message was sent yet.")}`);
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
      <MiniStats items={[[`${tr("At risk")}${demo ? ` · ${t({ en: "EXAMPLE", pt: "EXEMPLO", es: "EJEMPLO", hi: "उदाहरण" })}` : ""}`, `${risco.length}`, risco.length ? "bad" : undefined], [`${tr("Recoverable value")}${demo ? ` · ${t({ en: "EXAMPLE", pt: "EXEMPLO", es: "EJEMPLO", hi: "उदाहरण" })}` : ""}`, fmtMoney(recoverable), "good"], [tr("Total contacts"), total == null ? "—" : `${total}`]]} />
      <Card className="border-g-gold/25 bg-g-gold/[0.05]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word">🔄 {tr("Win back inactive customers")}</div><div className="text-xs text-g-muted mt-0.5">{tr("Reaches customers with no visit in 60+ days with a personal text. You see who and what before anything is sent.")}</div></div>
          {!demo && (!previa || previa.estado === "enviada" || previa.estado === "falhou") && (
            <button onClick={pedirPrevia} className="btn-bright text-sm whitespace-nowrap">{tr("Preview reactivation")}</button>
          )}
          {demo && <button onClick={pedirPrevia} className="btn-ghost text-sm whitespace-nowrap">{tr("Preview reactivation")} <span className="text-[8px] font-black uppercase opacity-70">{tr("Demo")}</span></button>}
        </div>
        {previa?.estado === "lendo" && <div className="mt-3 text-[12px] text-g-muted">{tr("Checking who would be reached — nothing is being sent…")}</div>}
        {previa?.estado === "fora" && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
            <div className="text-[12px] font-bold text-g-word">{tr("Not available yet")}</div>
            <div className="text-[12px] text-g-muted mt-0.5">{previa.frase}</div>
            {previa.pulled != null && <div className="text-[11px] text-g-muted mt-1">{previa.pulled} {tr(previa.pulled === 1 ? "person is on your inactive list." : "people are on your inactive list.")}</div>}
            <button onClick={() => setPrevia(null)} className="mt-2 text-[11px] font-bold text-g-light hover:text-g-word transition">{tr("Close")}</button>
          </div>
        )}
        {previa?.estado === "falhou" && (
          <div className="mt-3 text-[12px] text-[#e0855f]">{tr("I couldn't get an answer from the reactivation engine. Nothing was sent.")}{previa.frase ? ` (${previa.frase})` : ""}</div>
        )}
        {previa?.estado === "enviada" && (
          <div className="mt-3 text-[12px] text-g-muted">{previa.n > 0 ? `${tr("Sent")}: ${previa.n} · ${tr("Skipped")}: ${previa.pulados}` : tr("Nobody was reachable right now — nothing was sent.")}</div>
        )}
        {previa?.estado === "pronta" && (() => {
          const d = previa.d; const n = Number(d.sms) || 0; const am = Array.isArray(d.sample) ? d.sample[0] : null;
          return (
            <div className="mt-3 rounded-xl border border-g-gold/30 bg-black/20 px-3.5 py-3 space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wide text-g-gold">{tr("Before anything is sent")}</div>
              <ul className="text-[12.5px] text-g-word space-y-1">
                <li><b>{n}</b> {tr(n === 1 ? "person would receive a text message (SMS)" : "people would receive a text message (SMS)")}</li>
                <li className="text-g-muted"><b>{Number(d.skipped) || 0}</b> {tr("would be skipped (no valid phone, or asked not to be contacted)")}</li>
                <li className="text-g-muted"><b>{Number(d.pulled) || 0}</b> {tr("on your inactive list (no visit in 60+ days)")}</li>
              </ul>
              {am && <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] text-g-muted"><div className="text-[10px] font-black uppercase text-g-muted mb-0.5">{tr("The message they receive")}</div>{am.msg}</div>}
              <div className="flex flex-wrap gap-2 pt-1">
                {n > 0
                  ? <button onClick={enviar} disabled={blasting} className="btn-bright text-sm disabled:opacity-50 disabled:cursor-not-allowed">{blasting ? tr("Sending…") : `${tr("Send SMS to")} ${n} ${tr(n === 1 ? "person" : "people")}`}</button>
                  : <span className="text-[12px] text-g-muted">{tr("Nobody can be reached by text right now, so there is nothing to send.")}</span>}
                <button onClick={() => setPrevia(null)} disabled={blasting} className="btn-ghost text-sm">{tr("Cancel")}</button>
              </div>
            </div>
          );
        })()}
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Slipping away")}</span></div>
        <div className="divide-y divide-white/[0.06]">
          {risco.length ? risco.slice(0, 40).map((c, i) => (
            <div key={c.id || i} className="flex items-center gap-3 px-5 py-3">
              <span className={`grid place-items-center h-9 w-9 rounded-full text-[12px] font-black shrink-0 ${riskCls(c.risk || 0)}`}>{c.risk || 0}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name || c.contact || tr("Unnamed contact")}</div><div className="text-[11px] text-g-muted truncate">{[c.dias != null ? `${tr("gone for")} ${c.dias}${tr("d")}` : tr("at churn risk"), c.visitas != null ? `${c.visitas} ${tr("visits")}` : "", `${fmtMoney(c.ltv_cents)} LTV`].filter(Boolean).join(" · ")}</div></div>
              {demo ? (
                <button onClick={() => toast(`${tr("Demo — nothing was sent to")} ${c.name || ""}.`)} className="btn-ghost text-[12px] shrink-0">{tr("Win back")}</button>
              ) : wonback[c.id] === "enviado" ? (
                <span className="text-[12px] font-bold text-g-green shrink-0 px-2 py-1">{tr("Emailed ✓")}</span>
              ) : wonback[c.id] === "registrado" ? (
                <span className="text-[12px] font-bold text-g-muted shrink-0 px-2 py-1">{tr("Logged — not sent yet")}</span>
              ) : wonback[c.id] === "indo" ? (
                <span className="text-[12px] font-bold text-g-muted shrink-0 px-2 py-1">…</span>
              ) : c.contact ? (
                <button onClick={() => winBack(c)} className="btn-ghost text-[12px] shrink-0">{tr("Win back")}</button>
              ) : null /* real mode, no phone/email → hide rather than fake a send */}
            </div>
          )) : <Empty icon="🎉" text={
            demo ? tr("When a loyal customer starts slipping, Gui flags them here and wins them back automatically.")
              : tr("Nobody's slipping right now. Gui only flags customers with 3 or more visits who are gone longer than their usual pace.")} />}
        </div>
      </Card>
    </div>
  );
}

export default GrowthDept;
