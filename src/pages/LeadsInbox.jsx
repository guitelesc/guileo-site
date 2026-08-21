import { useState } from "react";
import logo from "../assets/guileo-mark.png";

// /leads — the CLIENT-facing lead inbox (the lead system adapted per business owner).
// Daily digest → qualified + categorized leads → one-tap actions (Reply / Gui calls back /
// Gui handles it) that spend Gui credits. Demo data; same engine as /api/lead + agent-action.

const SEED = [
  { id: 1, tier: "hot", name: "Maria Souza", cat: "Reservation", src: "📞 Call", t: "2m", note: "Wants a table for 8 tonight, 8 PM." },
  { id: 2, tier: "hot", name: "Dr. Alves", cat: "New patient", src: "💬 WhatsApp", t: "9m", note: "New patient, has insurance — wants this week." },
  { id: 3, tier: "warm", name: "João P.", cat: "Quote", src: "🌐 Website", t: "1h", note: "Asked about pricing for a kitchen remodel." },
  { id: 4, tier: "warm", name: "Lucia R.", cat: "Follow-up", src: "💬 WhatsApp", t: "2h", note: "Compared 2 options, went quiet." },
  { id: 5, tier: "cold", name: "Pedro M.", cat: "Win-back", src: "📞 Call", t: "3d", note: "Old lead — never booked. Worth a nudge." },
];
const TIERS = { hot: { label: "🔥 Hot", c: "text-[#e0855f] border-[#d8916e]/40 bg-[#d8916e]/[0.07]" }, warm: { label: "🌤 Warm", c: "text-g-gold border-g-gold/40 bg-g-gold/[0.06]" }, cold: { label: "❄️ Cold", c: "text-g-muted border-g-line bg-white/[0.03]" } };

export default function LeadsInbox() {
  const [leads, setLeads] = useState(SEED);
  const [credits, setCredits] = useState(120);
  const [busy, setBusy] = useState(null); // id being handled

  function act(id, kind, cost) {
    if (busy) return;
    setBusy(id); setCredits((c) => Math.max(0, c - cost));
    setTimeout(() => {
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, done: kind } : l)));
      setBusy(null);
    }, 1400);
  }

  const hot = leads.filter((l) => l.tier === "hot").length;
  const warm = leads.filter((l) => l.tier === "warm").length;

  return (
    <div className="min-h-screen text-g-word">
      <style>{`@keyframes lifade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes lipulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
      <div className="flex items-center justify-between border-b border-g-line px-5 py-4">
        <a href="/" className="flex items-center gap-2"><img src={logo} alt="" className="h-7 w-7 object-contain" /><span className="font-black">Guileo</span><span className="ml-1 text-[12px] font-semibold text-g-muted">· Leads</span></a>
        <span className="rounded-full border border-g-green/30 bg-g-green/10 px-3 py-1 text-[12px] font-bold text-g-green">⚡ {credits} Gui credits</span>
      </div>

      {/* 🚨 SELO DE DEMONSTRAÇÃO — obrigatório e visível (2026-08-20).
          Esta rota é PÚBLICA (App.jsx) e os leads são inventados ("Maria Souza", "Dr. Alves").
          O único aviso de que era demo estava num COMENTÁRIO no código — e ninguém lê comentário.
          Um prospect que abrisse este link via números falsos com a nossa marca em cima, que é
          exatamente o oposto da promessa que sustenta o X-Ray: aqui nada se afirma sem medida.
          O selo fica ANTES do conteúdo, não em rodapé: aviso que aparece depois já chegou tarde. */}
      <div className="mx-auto mt-6 max-w-2xl px-5">
        <div className="rounded-xl border border-dashed border-g-gold/50 bg-g-gold/[0.07] px-4 py-3 text-center">
          <div className="text-[12.5px] font-black uppercase tracking-wider text-g-gold">▶ Exemplo · Example · Ejemplo</div>
          <p className="mt-1 text-[12px] leading-relaxed text-g-muted">
            Os leads desta tela são fictícios, para mostrar como a caixa de entrada funciona.
            Nenhum número aqui foi medido. · The leads on this screen are fictional, to show how the
            inbox works. Nothing here was measured.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-10">
        {/* daily digest */}
        <div className="rounded-2xl border border-g-gold/30 bg-gradient-to-b from-g-gold/[0.08] to-white/[0.02] p-5" style={{ animation: "lifade .5s ease both" }}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">Good morning · today's digest</div>
          <div className="mt-1 text-[18px] font-bold text-g-word">{leads.length} new qualified leads — <span className="text-[#e0855f]">{hot} hot</span>, <span className="text-g-gold">{warm} warm</span>.</div>
          <div className="mt-1 text-[13px] text-g-muted">Sorted & categorized by Gui. Reply yourself, or let Gui handle it — your call.</div>
        </div>

        {/* leads */}
        <div className="mt-6 space-y-3">
          {leads.map((l) => {
            const tier = TIERS[l.tier];
            return (
              <div key={l.id} className="rounded-2xl border border-g-line bg-white/[0.04] p-4" style={{ animation: "lifade .4s ease both" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold text-g-word">{l.name}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tier.c}`}>{tier.label}</span>
                      <span className="rounded-full border border-g-line bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-g-muted">{l.cat}</span>
                    </div>
                    <div className="mt-1 text-[13px] text-g-ink">{l.note}</div>
                    <div className="mt-1 text-[11px] text-g-muted">{l.src} · {l.t} ago</div>
                  </div>
                </div>

                {l.done ? (
                  <div className="mt-3 rounded-xl border border-g-green/30 bg-g-green/[0.08] px-3 py-2 text-[12.5px] font-semibold text-g-green">
                    ✓ {l.done === "call" ? `Gui called ${l.name.split(" ")[0]} — handled & logged.` : l.done === "handle" ? `Gui replied, qualified & booked ${l.name.split(" ")[0]}.` : `Marked for you to reply.`}
                  </div>
                ) : busy === l.id ? (
                  <div className="mt-3 flex items-center gap-2 text-[12.5px] font-semibold text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green" style={{ animation: "lipulse 1.2s infinite" }} /> Gui is on it…</div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => act(l.id, "reply", 0)} className="rounded-full border border-g-line bg-white/[0.04] px-3.5 py-1.5 text-[12.5px] font-bold text-g-ink transition hover:bg-white/[0.07]">✍️ I'll reply</button>
                    <button onClick={() => act(l.id, "call", 1)} className="rounded-full border border-g-green/40 bg-g-green/10 px-3.5 py-1.5 text-[12.5px] font-bold text-g-green transition hover:bg-g-green/20">📞 Gui call back <span className="opacity-70">· 1</span></button>
                    <button onClick={() => act(l.id, "handle", 2)} className="rounded-full bg-gradient-to-r from-g-green to-g-dark px-3.5 py-1.5 text-[12.5px] font-bold text-white transition hover:brightness-110">🤖 Gui handle it <span className="opacity-80">· 2</span></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-md text-center text-[12.5px] text-g-muted">
          Every action you hand to <span className="font-semibold text-g-green">Gui</span> spends credits — and feeds your marketing (each lead becomes data for your next campaign). 🔁
        </p>
      </div>
    </div>
  );
}
