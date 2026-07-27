import { useState, useEffect } from "react";

// 🔌 Estado dos canais — hub HONESTO no /admin: lê /api/broto (action:activations), que reporta
// ready por PRESENÇA REAL das env vars no Cloudflare (não um checkbox manual). Cada canal mostra
// 🟢 ligado / 🟡 aguardando <chaves> / ⚪ registro do lado do provedor. Nunca finge estar ligado.
// Fonte única de verdade → mudar uma env var no Cloudflare muda o card sozinho no próximo load.

const CHANNELS = [
  { id: "stripe",    icon: "💳", name: "Stripe Connect",   does: "cobrança cai na conta do cliente" },
  { id: "gbp",       icon: "🔵", name: "Google Business",   does: "responde reviews + SEO local" },
  { id: "whats",     icon: "🟢", name: "WhatsApp (Meta)",   does: "Gui atende no WhatsApp" },
  { id: "mp",        icon: "💚", name: "Mercado Pago (BR)",  does: "PIX/cartão no Brasil" },
  { id: "mindbody",  icon: "📅", name: "MindBody",           does: "agenda real da conta" },
  { id: "a2p",       icon: "📱", name: "SMS A2P 10DLC",      does: "SMS US liberado", providerSide: true },
  { id: "voicecost", icon: "🎙️", name: "Custo de voz",       does: "margem real por cliente" },
  { id: "dunning",   icon: "⏸️", name: "Dunning (pausar)",   does: "pausa inadimplente de verdade" },
];

export default function ChannelStatus({ token }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/broto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "activations", token }) })
      .then((r) => r.json())
      .then((d) => { if (alive) { if (d && d.ok) setData(d); else setErr(true); } })
      .catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [token]);

  const byId = Object.fromEntries(((data && data.engines) || []).map((e) => [e.id, e]));

  const badge = (e) => {
    if (!e || e.ready === null) return { t: "⚪ Registro do provedor", cls: "text-g-muted border-g-line" };
    if (e.ready === true) return { t: "🟢 Ligado", cls: "text-g-green border-g-green/40 bg-g-green/[0.08]" };
    return { t: "🟡 Aguardando chave", cls: "text-[#C98A00] border-[#E7B008]/40 bg-[#E7B008]/[0.08]" };
  };

  return (
    <div className="mt-6 rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">🔌 Estado dos canais (ao vivo)</div>
      <p className="text-[12px] text-g-muted">Cada canal acende sozinho quando a chave dele entra no Cloudflare. Fonte: presença real das env vars — nunca um checkbox.</p>

      {err && <div className="mt-3 text-[12px] text-red-600">Não consegui ler o estado (token do /admin inválido?).</div>}
      {!data && !err && <div className="mt-3 text-[12px] text-g-muted">Carregando…</div>}

      {data && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {CHANNELS.map((c) => {
            const e = byId[c.id];
            const b = badge(e);
            return (
              <div key={c.id} className="flex items-start gap-2.5 rounded-xl border border-g-line bg-white/[0.03] px-3 py-2.5">
                <span className="text-base leading-none mt-0.5">{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-g-word">{c.name}</div>
                  <div className="text-[10.5px] text-g-muted leading-snug">{c.does}</div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${b.cls}`}>{b.t}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[10.5px] text-g-muted">O runbook de cada chave (onde clicar + nome exato da env var) está em <b>ATIVACOES.md</b>.</p>
    </div>
  );
}
