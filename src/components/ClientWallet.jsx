import { useEffect, useState } from "react";

// ── CLIENT WALLET (admin) — every client as an Apple-Wallet-style pass, stacked like the
//    iOS Wallet app: cards overlap showing just their top strip; tap one to pull it out and
//    see the full pass (agent, number, key, seller, actions). Data = seller_wallet admin
//    scope via POST /api/onboard-draft {action:'wallet', token} — one row per client with
//    permanent seller attribution. Signal semaphore (Luis, 2026-07-16):
//    🟢 no ar · 🟡 atenção (meio-nascido) · 🔵 pendência (aguardando aprovar) · 🔴 desativado.
const TONE = {
  green: { c: "#3E9468", label: "No ar" },
  amber: { c: "#f2b23e", label: "Atenção" },
  blue: { c: "#5B9BD5", label: "Pendente" },
  red: { c: "#e0855f", label: "Desativado" },
};
const statusOf = (d) => {
  const s = (d.status || "").toLowerCase();
  if (s === "draft") return "blue";
  if (["disabled", "paused", "cancelled", "off", "churned"].includes(s)) return "red";
  if (s === "live" && d.agent_id && d.number) return "green";
  return "amber"; // live but missing agent or number — half-born, needs a look
};
const IND = { restaurant: "🍽️", clinic: "🩺", salon: "💇", barbershop: "💈", spa: "💆", dental: "🦷", realestate: "🏠", law: "⚖️", hvac: "🔧", plumbing: "🚿", auto: "🚗", petcare: "🐾", fitness: "💪" };
const indEmoji = (v) => IND[(v || "").toLowerCase()] || "🏪";

export default function ClientWallet({ token }) {
  const [rows, setRows] = useState(null); // null=loading, []=empty
  // ⚠️ TERCEIRO ESTADO, QUE FALTAVA: erro de leitura. Antes só existiam "carregando" e
  // "lista" — então 401/500/rede caíam no [] e a tela dizia "nenhum cliente na carteira
  // ainda" para um dono que tem clientes PAGANDO. Vazio e falha são fatos diferentes.
  const [erro, setErro] = useState(false);
  const [open, setOpen] = useState(null); // draft id pulled out of the stack
  const [profiles, setProfiles] = useState({}); // client_email → live profile (admin_client_profile)
  const [sellers, setSellers] = useState([]); // roster of active sellers (for the transfer dropdown)
  const [xfer, setXfer] = useState(null); // client_email currently in "trocar vendedor" mode
  const [xferTo, setXferTo] = useState(""); // chosen destination seller email
  const [xferReason, setXferReason] = useState(""); // MOTIVO obrigatório
  const [xferBusy, setXferBusy] = useState(false);
  const [xferMsg, setXferMsg] = useState(null); // { ok, text }
  const [history, setHistory] = useState({}); // client_email → array of transfers (or 'loading')

  // active sellers for the dropdown — same admin gate (/api/seller-admin action:list)
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await fetch("/api/seller-admin", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", token }),
        });
        const d = await r.json().catch(() => ({}));
        setSellers(Array.isArray(d.rows) ? d.rows.filter((s) => s.active !== false && s.email) : []);
      } catch { setSellers([]); }
    })();
  }, [token]);

  // load a client's transfer trail (lazy, when the pass opens)
  const loadHistory = async (email) => {
    if (!email || history[email]) return;
    setHistory((h) => ({ ...h, [email]: "loading" }));
    try {
      const r = await fetch("/api/seller-transfer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "history", client_email: email, token }),
      });
      const d = await r.json().catch(() => ({}));
      setHistory((h) => ({ ...h, [email]: Array.isArray(d.rows) ? d.rows : [] }));
    } catch { setHistory((h) => ({ ...h, [email]: [] })); }
  };

  const openXfer = (email, currentSeller) => {
    setXfer(email); setXferTo(""); setXferReason(""); setXferMsg(null);
    loadHistory(email);
  };
  const doTransfer = async (email, from) => {
    if (!xferTo || !xferReason.trim()) return; // motivo obrigatório — botão fica travado até preencher
    setXferBusy(true); setXferMsg(null);
    try {
      const r = await fetch("/api/seller-transfer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transfer", client_email: email, to_seller: xferTo, reason: xferReason.trim(), token }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) { setXferMsg({ ok: false, text: d.error || "falhou" }); setXferBusy(false); return; }
      setXferMsg({ ok: true, text: d.noop ? "Já era desse vendedor — nada mudou." : `Transferido de ${from ? String(from).split("@")[0] : "—"} → ${String(xferTo).split("@")[0]}.` });
      setXfer(null);
      // refresh trail + wallet so the new owner shows everywhere
      setHistory((h) => { const c = { ...h }; delete c[email]; return c; });
      loadHistory(email);
      load();
    } catch (e) { setXferMsg({ ok: false, text: "erro de rede" }); }
    setXferBusy(false);
  };
  // opening a pass lazily pulls the FULL live profile (units, services, credits, pulse, upsell)
  const loadProfile = async (email) => {
    if (!email || profiles[email]) return;
    setProfiles((p) => ({ ...p, [email]: { loading: true } }));
    try {
      const r = await fetch("/api/client-profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email }),
      });
      const d = await r.json().catch(() => ({}));
      setProfiles((p) => ({ ...p, [email]: d.profile || { err: true } }));
    } catch { setProfiles((p) => ({ ...p, [email]: { err: true } })); }
  };
  const load = async () => {
    try {
      const r = await fetch("/api/onboard-draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "wallet", token }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !Array.isArray(d.rows)) { setErro(true); return; }
      setErro(false); setRows(d.rows);
    } catch { setErro(true); }
  };
  // LIVE — reloads itself every 30s (and on tab focus) so a client flips 🔵→🟢 with zero clicks
  useEffect(() => {
    if (!token) return;
    load();
    const iv = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(iv); window.removeEventListener("focus", onFocus); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fmt = (iso) => { try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }); } catch { return ""; } };

  return (
    <div className="rounded-2xl border border-g-line bg-white/[0.04] p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-g-word">
          👛 Carteira de clientes
          {Array.isArray(rows) && <span className="rounded-full border border-g-line bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-g-word">{rows.length}</span>}
        </div>
        <button onClick={() => { setRows(null); load(); }} className="rounded-full border border-g-line bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-g-ink hover:border-g-green/40 hover:text-g-word">↻</button>
      </div>
      {/* the semaphore legend — always visible so the colors read instantly */}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-g-muted">
        {Object.entries(TONE).map(([k, t]) => (
          <span key={k} className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: t.c, boxShadow: `0 0 6px ${t.c}` }} />{t.label}</span>
        ))}
      </div>

      {rows === null && <div className="mt-3 h-24 animate-pulse rounded-2xl border border-g-line bg-white/[0.03]" />}
      {erro && (
        <div className="mt-3 grid min-h-[90px] place-items-center rounded-2xl border border-[#e0855f]/45 bg-[#e0855f]/10 px-4 text-center text-[12.5px] font-semibold leading-snug text-[#e0855f]">
          ⚠️ Não consegui LER a carteira agora (sessão ou banco).<br />Isto NÃO quer dizer que está vazia — ela recarrega em 30s.
        </div>
      )}
      {!erro && Array.isArray(rows) && rows.length === 0 && (
        <div className="mt-3 grid min-h-[90px] place-items-center rounded-2xl border border-dashed border-g-line px-4 text-center text-[12.5px] text-g-muted">
          🌱 Nenhum cliente na carteira ainda — nasce aqui no 1º cadastro aprovado.
        </div>
      )}

      {/* the wallet stack — like iOS Wallet, each pass peeks ~54px under the previous one */}
      {Array.isArray(rows) && rows.length > 0 && (
        <div className="mt-3">
          {rows.map((d, i) => {
            const tone = TONE[statusOf(d)];
            const isOpen = open === d.id;
            return (
              <div key={d.id || i}
                onClick={() => { setOpen(isOpen ? null : d.id); if (!isOpen) loadProfile(d.client_email); }}
                className={`relative cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 ${i > 0 ? (isOpen || open === rows[i - 1]?.id ? "mt-2.5" : "-mt-9") : ""}`}
                style={{
                  borderColor: `${tone.c}45`,
                  background: `linear-gradient(135deg, ${tone.c}1f 0%, rgba(255,255,255,0.045) 45%, ${tone.c}0d 100%)`,
                  boxShadow: isOpen ? `0 14px 34px rgba(0,0,0,0.45), 0 0 0 1px ${tone.c}30` : "0 -6px 18px rgba(0,0,0,0.35)",
                  zIndex: isOpen ? 50 : i + 1,
                }}>
                {/* pass top strip — always visible even when tucked in the stack */}
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[15px]" style={{ borderColor: `${tone.c}50`, background: `${tone.c}18` }}>{indEmoji(d.industry)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-black text-g-word">{d.business || d.client_email}</div>
                    <div className="truncate text-[10.5px] text-g-muted">{[d.industry, d.seller_email && `🤝 ${String(d.seller_email).split("@")[0]}`].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
                    style={{ borderColor: `${tone.c}55`, color: tone.c, background: `${tone.c}14` }}>
                    <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: `${tone.c}66` }} /><span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: tone.c }} /></span>
                    {tone.label}
                  </span>
                </div>
                {/* the full pass — only when pulled out */}
                {isOpen && (
                  <div className="border-t px-4 py-3" style={{ borderColor: `${tone.c}25` }} onClick={(e) => e.stopPropagation()}>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-3">
                      <div><div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">Cliente</div><div className="truncate font-semibold text-g-word">{d.client_email || "—"}</div></div>
                      <div><div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">Agente</div><div className="truncate font-semibold text-g-word">{d.agent_id ? `🤖 ${String(d.agent_id).slice(0, 14)}…` : "—"}</div></div>
                      <div><div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">Número</div><div className="font-semibold text-g-word">{d.number || "—"}</div></div>
                      <div><div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">Chave</div><div className="font-mono font-semibold text-g-word">{d.connection_code || "—"}</div></div>
                      <div><div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">Vendedor 🤝</div><div className="truncate font-semibold text-g-word">{d.seller_email || "—"}</div></div>
                      <div><div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">Desde</div><div className="font-semibold text-g-word">{fmt(d.approved_at || d.created_at)}</div></div>
                    </div>
                    {/* ── PERFIL VIVO — the pass doubles as the client's real-time profile ── */}
                    {(() => {
                      const p = profiles[d.client_email] || {};
                      if (p.loading) return <div className="mt-3 h-14 animate-pulse rounded-xl border border-g-line bg-white/[0.03]" />;
                      const svcs = Array.isArray(p.services) ? p.services : [];
                      const units = Array.isArray(p.units) ? p.units : [];
                      const chans = p.channels && typeof p.channels === "object" ? Object.entries(p.channels).filter(([, v]) => v) : [];
                      // what they DON'T have yet = the sell priorities, computed live
                      const upsell = [
                        !d.number && ["☎️ Número dedicado", true],
                        !p.has_packages && ["📦 Pacotes", true],
                        !p.has_memberships && ["🔁 Assinaturas", true],
                        !p.has_coupons && ["🎟️ Cupons/campanhas", true],
                        !units.length && ["🏢 Cadastrar unidades", true],
                        !svcs.length && ["💇 Importar serviços/preços", true],
                      ].filter(Boolean);
                      return (
                        <>
                          {(p.owner || p.phone || p.site) && (
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-g-ink">
                              {p.owner && <span>👤 <b className="text-g-word">{p.owner}</b></span>}
                              {p.phone && <span>📱 <b className="text-g-word">{p.phone}</b></span>}
                              {p.site && <a href={/^https?:/.test(p.site) ? p.site : `https://${p.site}`} target="_blank" rel="noopener" className="underline decoration-dotted" style={{ color: tone.c }}>🌐 {String(p.site).replace(/^https?:\/\//, "")}</a>}
                            </div>
                          )}
                          {chans.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {chans.slice(0, 8).map(([k]) => <span key={k} className="rounded-full border border-g-line bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-g-muted">{k}</span>)}
                            </div>
                          )}
                          {units.length > 0 && (
                            <div className="mt-3">
                              <div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">🏢 Unidades ({units.length})</div>
                              <div className="mt-1 space-y-0.5 text-[11.5px] text-g-ink">
                                {units.slice(0, 4).map((u, k) => <div key={k} className="truncate">• <b className="text-g-word">{u.name}</b>{u.address ? ` — ${u.address}` : ""}{u.city ? `, ${u.city}` : ""}</div>)}
                              </div>
                            </div>
                          )}
                          {svcs.length > 0 && (
                            <div className="mt-2.5">
                              <div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">💼 Serviços contratados ({svcs.length})</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {svcs.slice(0, 6).map((s, k) => (
                                  <span key={k} className="rounded-full border border-g-line bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-g-ink">
                                    {s.name}{Number(s.price_cents) > 0 && <b className="text-g-green"> ${(s.price_cents / 100).toFixed(0)}</b>}
                                  </span>
                                ))}
                                {svcs.length > 6 && <span className="px-1 text-[10.5px] text-g-muted">+{svcs.length - 6}</span>}
                              </div>
                            </div>
                          )}
                          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-g-ink">
                            {p.credits != null && <span>🪙 <b className="text-g-word">{p.credits}</b> créditos</span>}
                            {p.events_30d != null && <span>📊 <b className="text-g-word">{p.events_30d}</b> eventos/30d</span>}
                            {Number(p.open_intents) > 0 && <span style={{ color: "#FF8A33" }}>🎯 <b>{p.open_intents}</b> leads quentes abertos</span>}
                          </div>
                          {upsell.length > 0 && (
                            <div className="mt-3 rounded-xl border border-[#FF8A33]/30 bg-[#FF8A33]/[0.06] p-2.5">
                              <div className="text-[9.5px] font-black uppercase tracking-wide" style={{ color: "#FF8A33" }}>🚀 Pode contratar — prioridades de venda</div>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {upsell.map(([label], k) => <span key={k} className="rounded-full border border-[#FF8A33]/35 bg-[#FF8A33]/[0.08] px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: "#FF8A33" }}>{label}</span>)}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {/* ── VENDEDOR + TROCA (admin) — cliente é do vendedor PRA SEMPRE; troca só se o
                         cliente pedir, com MOTIVO obrigatório e trilha permanente ── */}
                    {d.client_email && (() => {
                      const cur = d.seller_email || "";
                      const isX = xfer === d.client_email;
                      const trail = history[d.client_email];
                      const canConfirm = xferTo && xferReason.trim() && !xferBusy;
                      return (
                        <div className="mt-3 rounded-xl border p-2.5" style={{ borderColor: `${tone.c}22`, background: "rgba(255,255,255,0.02)" }}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[11.5px] text-g-ink">🤝 Vendedor: <b className="text-g-word">{cur ? String(cur).split("@")[0] : "—"}</b></div>
                            {!isX && (
                              <button onClick={() => openXfer(d.client_email, cur)} className="rounded-full border border-g-line bg-white/[0.04] px-2.5 py-0.5 text-[10.5px] font-semibold text-g-muted hover:text-g-word hover:border-g-line/80">↔ trocar</button>
                            )}
                          </div>

                          {isX && (
                            <div className="mt-2.5 space-y-2">
                              <select value={xferTo} onChange={(e) => setXferTo(e.target.value)}
                                className="w-full rounded-lg border border-g-line bg-black/20 px-2.5 py-1.5 text-[12px] text-g-word outline-none focus:border-g-green/40">
                                <option value="">Escolha o novo vendedor…</option>
                                {sellers.filter((s) => String(s.email).toLowerCase() !== String(cur).toLowerCase()).map((s) => (
                                  <option key={s.email} value={s.email}>{s.name || String(s.email).split("@")[0]} · {s.email}</option>
                                ))}
                              </select>
                              <input value={xferReason} onChange={(e) => setXferReason(e.target.value)}
                                placeholder="ex.: cliente pediu troca"
                                className="w-full rounded-lg border border-g-line bg-black/20 px-2.5 py-1.5 text-[12px] text-g-word outline-none placeholder:text-g-muted focus:border-g-green/40" />
                              {xferTo && xferReason.trim() && (
                                <div className="text-[11px] text-g-muted">Confirmar: <b className="text-g-word">{cur ? String(cur).split("@")[0] : "—"}</b> → <b className="text-g-word">{String(xferTo).split("@")[0]}</b></div>
                              )}
                              <div className="flex items-center gap-1.5">
                                <button disabled={!canConfirm} onClick={() => doTransfer(d.client_email, cur)}
                                  className="rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-40"
                                  style={{ background: canConfirm ? "#3E9468" : "rgba(255,255,255,0.06)", color: canConfirm ? "#fff" : "#8a8a82" }}>
                                  {xferBusy ? "Transferindo…" : "Confirmar troca"}
                                </button>
                                <button onClick={() => { setXfer(null); setXferMsg(null); }} className="rounded-full border border-g-line bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-g-muted hover:text-g-word">cancelar</button>
                              </div>
                              <div className="text-[10px] text-g-muted">O motivo fica gravado numa trilha permanente. Só o admin transfere.</div>
                            </div>
                          )}

                          {xferMsg && xfer !== d.client_email && (
                            <div className="mt-2 text-[11px]" style={{ color: xferMsg.ok ? "#3E9468" : "#e0855f" }}>{xferMsg.ok ? "✓ " : "✕ "}{xferMsg.text}</div>
                          )}

                          {/* histórico de trocas (se houver) */}
                          {Array.isArray(trail) && trail.length > 0 && (
                            <div className="mt-2.5 border-t pt-2" style={{ borderColor: `${tone.c}18` }}>
                              <div className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">🧾 Histórico de trocas ({trail.length})</div>
                              <div className="mt-1 space-y-1 text-[10.5px] text-g-ink">
                                {trail.slice(0, 6).map((t, k) => (
                                  <div key={k} className="truncate">
                                    <span className="text-g-muted">{fmt(t.at)}</span> · <b className="text-g-word">{t.from ? String(t.from).split("@")[0] : "—"}</b> → <b className="text-g-word">{String(t.to).split("@")[0]}</b>
                                    {t.reason && <span className="text-g-muted"> — “{t.reason}”</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {d.connection_code && (
                        <button onClick={() => navigator.clipboard?.writeText(d.connection_code)} className="rounded-full border border-g-line bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-g-ink hover:text-g-word">📋 Copiar chave</button>
                      )}
                      {d.client_email && (
                        <a href={`mailto:${d.client_email}`} className="rounded-full border border-g-line bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-g-ink hover:text-g-word">✉️ Email</a>
                      )}
                      {d.number && (
                        <a href={`tel:${d.number}`} className="rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ borderColor: `${tone.c}45`, color: tone.c, background: `${tone.c}10` }}>📞 Ligar pra Gui</a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
