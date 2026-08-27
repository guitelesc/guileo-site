/* Split out of Portal.jsx (performance): Team tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { FaUsers, FaUserPlus } from "react-icons/fa6";
import { toast, fetchEquipe } from "../lib/portalApi.js";
import { waLink } from "../data/contact.js";
import { loadCreated, genTeam, pushCreated, TEAM_ROLE, Card, tr, MiniStats, Drawer , FaixaAmostra} from "../pages/Portal.jsx";

// Team & staff — manage the people, see who the AI is feeding work to.
function Team({ V, real, email, dataKey }) {
  // ── A EQUIPE DE VERDADE (2026-08-20) ──────────────────────────────────────────────────────
  // Esta tela desenhava gente gerada enquanto `biz_professionals` já guardava os profissionais
  // REAIS do negócio (a Natura tem 3 cadastrados). Cliente pagante vendo nome inventado no lugar
  // da própria equipe é o tipo de erro que ele descobre sozinho — e aí duvida de todo o resto.
  // 🚨 `null` = NÃO CONSEGUI LER; `[]` = a equipe está vazia mesmo. São coisas diferentes, e a
  // tela diz qual das duas. Só caio na amostra quando NÃO estou em modo real.
  const [equipe, setEquipe] = useState({ estado: "carregando", dados: null, motivo: null });
  useEffect(() => {
    let vivo = true;
    if (!real || !email || !dataKey) { setEquipe({ estado: "amostra", dados: null, motivo: null }); return () => { vivo = false; }; }
    fetchEquipe(email, dataKey).then((r) => { if (vivo) setEquipe({ estado: r.dados ? "ok" : "err", dados: r.dados, motivo: r.motivo }); });
    return () => { vivo = false; };
  }, [real, email, dataKey]);

  const reais = equipe.estado === "ok" && Array.isArray(equipe.dados)
    ? equipe.dados.map((p) => ({ name: p.nome, role: p.cargo || (p.tipo === "resource" ? tr("Resource") : tr("Team member")), status: p.ativo ? "Active" : "Inactive", handled: 0, revenue: 0, rating: 0, real: true }))
    : null;
  const rows = reais || [...loadCreated(V.label, "team"), ...genTeam(V)];
  const active = rows.filter((r) => r.status === "Active");
  const totalRev = active.reduce((s, r) => s + (r.revenue || 0), 0);
  const avgRating = active.length ? (active.reduce((s, r) => s + (r.rating || 0), 0) / active.length).toFixed(1) : "—";
  const [sel, setSel] = useState(null);
  // 🚨 "Invite link sent ✓" SEM ENVIAR NADA (2026-08-25). invite() só empurrava uma linha para o
  // localStorage e dizia que o convite saiu: não existe rota de convite, nem e-mail, nem link.
  // O dono ficava esperando alguém que nunca foi chamado. Em conta REAL o botão sai da tela e no
  // lugar entra a verdade; em demonstração ele continua, dizendo que é demonstração.
  const invite = () => { pushCreated(V.label, "team", { name: "New teammate", role: TEAM_ROLE[V.label] || "Team member", status: "Invited", handled: 0, revenue: 0, rating: 0 }); toast(tr("Demo — added to this sample list. No invite was sent.")); };
  return (
    <>
      {/* a faixa só aparece quando a tela ainda está na amostra: com equipe real ela some sozinha */}
      <FaixaAmostra real={real && !reais} />
      {equipe.estado === "err" && (
        <div className="mb-3 rounded-xl border border-[#e0855f]/40 bg-[#e0855f]/[0.08] px-3.5 py-2.5 text-[12px] text-[#e0855f]">
          {tr("Couldn't read your team")} — {equipe.motivo}
        </div>
      )}
      {reais && reais.length === 0 && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[12px] text-g-muted">
          {tr("No one on your team yet — add the first person and Gui starts routing work to them.")}
        </div>
      )}
      <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaUsers className="text-g-green" /> {tr("Team & staff")}</div><div className="text-xs text-g-muted mt-0.5">{tr("Your AI routes bookings, calls and chats to the right person — and tracks who's performing.")}</div></div>
          {real
            ? <span className="rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-2 text-[11.5px] font-bold text-g-muted">{tr("Invites aren't on yet — ask us and we add the person to your team.")}</span>
            : <button onClick={invite} className="btn-bright text-sm inline-flex items-center gap-2"><FaUserPlus size={11} /> {tr("Invite member")} <span className="rounded-full border border-black/20 bg-black/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide">{tr("Demo")}</span></button>}
        </div>
      </Card>
      <MiniStats items={[["Team size", `${rows.length}`], ["Bookings handled", `${active.reduce((s, r) => s + (r.handled || 0), 0)}`, "good"], ["Revenue (team)", `$${totalRev.toLocaleString()}`, "good"], ["Avg rating", `${avgRating} ★`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Your team")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap a member</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((m, i) => (
            <button key={i} onClick={() => setSel(m)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{m.name[0]}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{m.name}{m.status === "Invited" && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("invited")}</span>}</div><div className="text-[11px] text-g-muted">{m.role}{m.status === "Active" ? ` · ${m.handled} handled · ${m.rating}★` : " · awaiting join"}</div></div>
              {m.status === "Active" && <span className="text-sm font-extrabold text-g-green">${(m.revenue || 0).toLocaleString()}</span>}
            </button>
          ))}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={sel.role}
          badge={<span className={`text-[10px] font-black uppercase ${sel.status === "Active" ? "text-g-green" : "text-g-gold"}`}>{sel.status}</span>}
          fields={sel.status === "Active" ? [["Role", sel.role], ["Bookings handled", sel.handled], ["Revenue (mo.)", `$${(sel.revenue || 0).toLocaleString()}`], ["Rating", `${sel.rating} ★`], ["Status", "Active"]] : [["Role", sel.role], ["Status", "Invited · awaiting join"]]}
          note={sel.status === "Active" ? `The AI assigns work to ${sel.name} based on availability and skills — and flags it to you if they're overloaded.` : "Invite sent — they'll get access once they accept."}
          actions={<><a href={waLink(`Hi ${sel.name}! `)} target="_blank" rel="noopener" className="btn-bright text-sm">💬 Message</a><button onClick={() => { toast(`${sel.name} set as lead ✓`); setSel(null); }} className="btn-ghost text-sm">⭐ Make lead</button><button onClick={() => { toast(`Shift scheduled for ${sel.name} ✓`); setSel(null); }} className="btn-ghost text-sm">📅 Schedule shift</button></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
    </>
  );
}

export default Team;
