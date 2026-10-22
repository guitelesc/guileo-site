/* Split out of Portal.jsx (performance): DocsArea tab view — code moved verbatim. */
import { useState, useCallback, useEffect } from "react";
import { fetchContracts } from "../lib/portalApi.js";
import { SectionSkeleton, RetryState, Card, tr, Empty } from "../pages/Portal.jsx";

function DocsArea({ V, onNav, email = "", dataKey = "" }) {
  const demo = !dataKey;
  const [docs, setDocs] = useState([]);
  const [state, setState] = useState(demo ? "ok" : "loading");
  const load = useCallback(() => {
    setState("loading");
    fetchContracts(dataKey, email).then((d) => { setDocs(d || []); setState("ok"); }).catch(() => setState("err"));
  }, [dataKey, email]);
  useEffect(() => {
    if (demo) {
      setDocs([
        { id: "d1", doc_kind: "contract", title: "Website / Web Application Development", counterparty_name: "Padaria do João", status: "signed", signer_name: "João Silva", sign_token: "demo" },
        { id: "d2", doc_kind: "quote", title: "AI Agents & Automation", counterparty_name: "Clínica Sorriso", status: "sent", sign_token: "demo" },
      ]); setState("ok"); return;
    }
    load();
  }, [demo, dataKey, email, load]);
  if (state === "loading") return <SectionSkeleton />;
  if (state === "err") return <RetryState onRetry={load} />;
  const stColor = (s) => s === "signed" ? "#3E9468" : s === "sent" ? "#D6C29A" : s === "void" ? "#B66" : "#9AA0A6";
  return (
    <div className="space-y-4 stagger">
      {demo && <div className="rounded-xl border border-g-gold/25 bg-g-gold/[0.06] px-4 py-2.5 text-[11px] font-bold text-g-muted">{tr("Demo — sample data. Connect your account in Settings to see your real documents here.")}</div>}
      <Card className="border-g-gold/25 bg-g-gold/[0.05]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word">📄 {tr("Your documents")}</div><div className="text-xs text-g-muted mt-0.5">{tr("Every contract and quote, signed or pending — all in one place.")}</div></div>
          {/* 🚨 O botão mandava o CLIENTE para /admin/contratos (2026-09-28) — tela interna da Guileo,
              atrás do token de administrador: a dona do spa clicava em "I'll draft one for you" e caía
              numa página de login que não é dela. Quem redige contrato é a nossa equipe; o caminho
              do cliente para pedir um é o suporte. */}
          {onNav && <button onClick={() => onNav("support")} className="btn-ghost text-sm">{tr("Ask us for a contract or quote →")}</button>}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Documents")}</span></div>
        <div className="divide-y divide-white/[0.06]">
          {docs.length ? docs.map((d, i) => (
            <div key={d.id || i} className="flex items-center gap-3 px-5 py-3">
              <span className="text-lg shrink-0">{d.doc_kind === "quote" ? "🧾" : "📑"}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{d.title || "—"}</div><div className="text-[11px] text-g-muted truncate">{d.counterparty_name || ""}{d.signer_name ? ` · ${tr("signed by")} ${d.signer_name}` : ""}</div></div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: stColor(d.status) + "22", color: stColor(d.status) }}>{tr(d.status || "draft")}</span>
              {d.sign_token && d.sign_token !== "demo" && <a href={`/sign?t=${d.sign_token}`} target="_blank" rel="noopener" className="btn-ghost text-[12px] shrink-0">{d.status === "signed" ? tr("View") : tr("Open")}</a>}
            </div>
          )) : <Empty icon="📄" text={demo ? tr("Signed contracts and quotes show up here, ready to download as PDF.") : tr("No documents yet. When we send you a contract or quote, it shows up here.")} />}
        </div>
      </Card>
    </div>
  );
}

export default DocsArea;
