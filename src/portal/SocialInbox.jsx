/* Split out of Portal.jsx (performance): SocialInbox tab view — code moved verbatim. */
import { useState } from "react";
import { FaInstagram, FaFacebook, FaTiktok } from "react-icons/fa6";
import { toast } from "../lib/portalApi.js";
import { Card, tr, Empty, Drawer } from "../pages/Portal.jsx";

function SocialInbox({ V }) {
  const nets = [[FaInstagram, "#E4405F", "Instagram"], [FaFacebook, "#1877F2", "Facebook"], [FaTiktok, "#e7e7e7", "TikTok"], [FaInstagram, "#E4405F", "Instagram"]];
  const rows = (V.activity || []).slice(0, 4).map((a, i) => ({ name: (V.ops?.schedule?.[i]?.name) || "New DM", last: a[2], t: a[3], unread: i % 2, ...{ net: nets[i % 4][2], color: nets[i % 4][1] } }));
  const [sel, setSel] = useState(null);
  return (
    <div className="space-y-4 stagger">
      <div className="flex flex-wrap gap-2">
        {[["Instagram", "#E4405F", 18], ["Facebook", "#1877F2", 9], ["TikTok", "#e7e7e7", 6]].map(([n, c, v]) => (
          <span key={n} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-word"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{n} <span className="text-g-muted">{v} replies today</span></span>
        ))}
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Social inbox · AI replies on Instagram, Facebook & TikTok")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap to open</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => {
            const [Icon, color, net] = nets[i % 4];
            return (
              <button key={i} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06]" style={{ color }}><Icon size={16} /></span>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name} <span className="text-g-muted font-normal">· {net}</span></div><div className="text-[11px] text-g-muted truncate">{c.last}</div></div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1"><span className="text-[10px] text-g-muted">{c.t}</span>{c.unread > 0 && <span className="inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-g-green text-[10px] font-bold text-black">{c.unread}</span>}</div>
              </button>
            );
          })}
          {rows.length === 0 && <Empty icon="💬" text={tr("No social DMs yet — I'm on Instagram, Facebook & TikTok, replying the moment one arrives.")} />}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={`${sel.net} · direct message`}
          badge={<span className="text-[10px] font-black uppercase text-g-green inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("AI replied")}</span>}
          fields={[["Channel", sel.net], ["When", sel.t], ["Status", "Auto-replied by AI"]]}
          note={<>"{sel.last}"<div className="mt-2 text-g-muted">Your AI already replied on {sel.net} and offered to book — it only pings you if a human is needed.</div></>}
          actions={<><button onClick={() => { toast(`Done — your reply is on its way via ${sel.net}.`); setSel(null); }} className="btn-bright text-sm">💬 Reply</button><button onClick={() => { toast("All set — I've marked it handled for you."); setSel(null); }} className="btn-ghost text-sm">✓ Mark handled</button></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

export default SocialInbox;
