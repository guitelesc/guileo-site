// "Powered by Guileo" referral badge — the viral loop, as projection. Goes on a client's own
// site/footer/widget; every visitor it sends to guileoai.com carries ?ref=<partner>, which lead.js
// already records (body.ref → Growth-Partner attribution). Activates the moment we have clients.
export default function PoweredByGuileo({ partner = "client" }) {
  const href = `https://guileoai.com/?ref=${encodeURIComponent(partner)}`;
  return (
    <a href={href} target="_blank" rel="noopener"
      className="inline-flex items-center gap-1.5 rounded-full border border-g-green/30 bg-g-deep/60 px-3 py-1.5 text-[11px] font-bold text-g-light backdrop-blur transition hover:border-g-gold/40 hover:text-g-word">
      <span className="text-g-green">⚡</span> Powered by <span className="font-black text-g-gold">Guileo</span>
    </a>
  );
}

// The raw HTML snippet a client pastes on their OWN (non-React) site. The portal can render this
// in a copy box per client. Self-contained, no dependencies, matches the badge above.
export function poweredBySnippet(partner = "client") {
  const href = `https://guileoai.com/?ref=${encodeURIComponent(partner)}`;
  return `<a href="${href}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;font:700 11px system-ui,sans-serif;color:#cfd8d2;text-decoration:none;border:1px solid rgba(62,148,104,.3);background:#161512;border-radius:999px;padding:6px 12px">⚡ Powered by <b style="color:#D6C29A">Guileo</b></a>`;
}
