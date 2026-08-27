/* Comment → DM tab — the Instagram comment automation, inside the cockpit.
   Someone comments a keyword on the owner's reel and gets the answer in their DM a second later.

   WHY IT LIVES HERE AND NOT IN A SEPARATE TOOL: a Meta app has exactly ONE Instagram callback
   URL. Pointing it at another service would take Gui off the air in the DMs, and subscribing two
   apps to `messages` delivers the same DM twice — the customer gets answered twice. Sharing the
   webhook (functions/api/meta-webhook.js) makes that impossible by construction, and the DM the
   comment opens is already a live Gui conversation.

   Backend: POST /api/meta-comentarios (per-tenant gated, same get_client_data gate as the rest).
   Needs db/meta_comment_dm.sql pasted; until then the tab says so out loud instead of showing an
   empty list that pretends everything is fine.
   Registered by the Portal orchestrator (tab key 'comentarios'). */
import { useState, useEffect, useCallback } from "react";
import { FaComments, FaPlus, FaTrash, FaPen, FaCheck, FaXmark } from "react-icons/fa6";
import { toast } from "../lib/portalApi.js";
import { tr, Card, Empty, SectionSkeleton } from "../pages/Portal.jsx";

async function api(body) {
  try {
    const r = await fetch("/api/meta-comentarios", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const VAZIA = {
  id: "", nome: "", ig_id: "", media_id: "", keywords: "", match_mode: "palavra",
  dm_text: "", public_reply: "", link_url: "", active: true,
};

export default function Comentarios({ email, dataKey }) {
  // O estado inicial JÁ nasce certo em vez de ser corrigido dentro de um efeito: sem conta
  // conectada não há o que carregar, e ligar/desligar "carregando" dentro do efeito provoca
  // renderização em cascata (é o que a regra react-hooks/set-state-in-effect protege).
  const [carregando, setCarregando] = useState(!!(email && dataKey));
  const [pronto, setPronto] = useState(true);
  const [nota, setNota] = useState("");
  const [campanhas, setCampanhas] = useState([]);
  const [stats, setStats] = useState({});
  const [form, setForm] = useState(null);       // null = nenhum formulário aberto
  const [salvando, setSalvando] = useState(false);

  const live = !!(email && dataKey);

  // Aplica a resposta na tela. Separado do fetch para o efeito abaixo poder DESCARTAR uma
  // resposta que chegou tarde demais (troca de conta / desmontagem) em vez de escrever estado
  // de um pedido que já não interessa — a corrida clássica que faz a tela mostrar dado de outro.
  const aplicar = useCallback((d) => {
    // ⚠️ resposta nula NÃO vira lista vazia silenciosa: "zero campanhas" e "a chamada falhou"
    // parecem idênticos na tela, e esse disfarce já produziu diagnóstico falso neste projeto.
    if (!d) { setPronto(false); setNota(tr("Could not reach the server. Nothing was changed.")); }
    else {
      setPronto(d.ready !== false);
      setNota(d.nota || "");
      setCampanhas(Array.isArray(d.campanhas) ? d.campanhas : []);
      setStats(d.stats || {});
    }
    setCarregando(false);
  }, []);

  const carregar = useCallback(async (aindaVale = () => true) => {
    if (!live) return;
    const d = await api({ email, token: dataKey });
    if (aindaVale()) aplicar(d);
  }, [email, dataKey, live, aplicar]);

  useEffect(() => {
    let ativo = true;
    carregar(() => ativo);
    return () => { ativo = false; };
  }, [carregar]);

  const salvar = async () => {
    if (!form) return;
    if (!form.ig_id.trim()) { toast(tr("Enter the Instagram account ID.")); return; }
    if (!form.keywords.trim()) { toast(tr("Add at least one keyword.")); return; }
    if (!form.dm_text.trim()) { toast(tr("Write the DM the person will receive.")); return; }
    setSalvando(true);
    const d = await api({
      email, token: dataKey, action: "salvar",
      campanha: { ...form, id: form.id || undefined, keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean) },
    });
    setSalvando(false);
    // Sem o id de volta não houve gravação — "ok" sem comprovante é promessa sem lastro.
    if (d && d.ok && d.id) { toast(tr("Campaign saved ✓")); setForm(null); carregar(); }
    else toast(`${tr("Could not save")}${d && d.motivo ? ` (${d.motivo})` : ""}`);
  };

  const apagar = async (id) => {
    const d = await api({ email, token: dataKey, action: "apagar", id });
    if (d && d.ok) { toast(tr("Campaign deleted")); carregar(); }
    else toast(tr("Could not delete"));
  };

  if (carregando) return <SectionSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      {/* ── o que esta tela faz, em uma frase ───────────────────────────────── */}
      <Card tone="gui">
        <div className="flex items-start gap-3">
          <FaComments className="mt-1 shrink-0 text-[#FF8A33]" />
          <div>
            <h3 className="text-sm font-semibold">{tr("Comment → DM")}</h3>
            <p className="mt-1 text-xs text-g-muted">
              {tr("Someone comments your keyword on a post or reel and gets the answer in their DM a second later. The DM opens a real conversation — Gui takes it from there.")}
            </p>
          </div>
        </div>
      </Card>

      {!live && (
        <Card><p className="text-xs text-g-muted">{tr("Connect your account to create real campaigns.")}</p></Card>
      )}

      {/* ── estado honesto: por que não está pronto ─────────────────────────── */}
      {live && !pronto && (
        <Card tone="attention">
          <p className="text-xs">
            <strong>{tr("Not active yet.")}</strong>{" "}
            {nota || tr("The database step is missing.")}
          </p>
        </Card>
      )}

      {/* ── números ─────────────────────────────────────────────────────────── */}
      {live && pronto && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [tr("DMs sent · 30d"), stats.enviados ?? 0],
            [tr("People reached"), stats.pessoas ?? 0],
            [tr("Active campaigns"), campanhas.filter((c) => c.active).length],
          ].map(([rot, val]) => (
            <Card key={rot}>
              <div className="text-[11px] uppercase tracking-wide text-g-muted">{rot}</div>
              <div className="mt-2 text-2xl font-semibold">{val}</div>
            </Card>
          ))}
        </div>
      )}

      {/* ── lista ───────────────────────────────────────────────────────────── */}
      {live && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <h4 className="text-sm font-semibold">{tr("Campaigns")}</h4>
            <button
              type="button"
              onClick={() => setForm({ ...VAZIA })}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A33] px-3 py-1.5 text-xs font-semibold text-black"
            >
              <FaPlus className="text-[10px]" /> {tr("New campaign")}
            </button>
          </div>

          {!campanhas.length
            ? <Empty icon="💬" text="No campaigns yet. Create one and every comment starts working for you." />
            : (
              <ul className="divide-y divide-white/5">
                {campanhas.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.nome}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={c.active
                            ? { background: "rgba(62,148,104,.18)", color: "#3E9468" }
                            : { background: "rgba(138,133,122,.18)", color: "#8A857C" }}
                        >
                          {c.active ? tr("On") : tr("Off")}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(c.keywords || []).map((k) => (
                          <span key={k} className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">{k}</span>
                        ))}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs text-g-muted">{c.dm_text}</p>
                      <p className="mt-1 text-[11px] text-g-muted">
                        {c.media_id ? tr("One specific post") : tr("Every post on the account")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" aria-label={tr("Edit")} onClick={() => setForm({
                        ...VAZIA, ...c, media_id: c.media_id || "",
                        public_reply: c.public_reply || "", link_url: c.link_url || "",
                        keywords: (c.keywords || []).join(", "),
                      })} className="rounded-lg border border-white/10 p-2 text-xs"><FaPen /></button>
                      <button type="button" aria-label={tr("Delete")} onClick={() => apagar(c.id)}
                        className="rounded-lg border border-white/10 p-2 text-xs text-[#E5484D]"><FaTrash /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      )}

      {/* ── formulário ──────────────────────────────────────────────────────── */}
      {form && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-semibold">{form.id ? tr("Edit campaign") : tr("New campaign")}</h4>
            <button type="button" aria-label={tr("Close")} onClick={() => setForm(null)} className="text-g-muted"><FaXmark /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rot={tr("Name")} hint={tr("Just so you find it later.")}>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={INPUT} placeholder={tr("Reel pricing")} />
            </Campo>
            <Campo rot={tr("Instagram account ID")} hint={tr("The professional account that receives the comments.")}>
              <input value={form.ig_id} onChange={(e) => setForm({ ...form, ig_id: e.target.value })} className={INPUT} placeholder="17841…" />
            </Campo>
            <Campo rot={tr("Post ID")} hint={tr("Leave it empty to answer on every post.")}>
              <input value={form.media_id} onChange={(e) => setForm({ ...form, media_id: e.target.value })} className={INPUT} placeholder={tr("all posts")} />
            </Campo>
            <Campo rot={tr("Keywords")} hint={tr("Comma separated. Accents and punctuation are handled for you.")}>
              <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} className={INPUT} placeholder="preço, valor, quanto" />
            </Campo>
            <Campo rot={tr("Matching")} hint={tr("Whole word is safer: it never fires inside a longer word.")}>
              <select value={form.match_mode} onChange={(e) => setForm({ ...form, match_mode: e.target.value })} className={INPUT}>
                <option value="palavra">{tr("Whole word (recommended)")}</option>
                <option value="contem">{tr("Contains")}</option>
              </select>
            </Campo>
            <Campo rot={tr("Link in the DM")} hint={tr("Send them to the form that makes Gui call in 60 seconds.")}>
              <input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} className={INPUT} placeholder="https://…" />
            </Campo>
            <div className="sm:col-span-2">
              <Campo rot={tr("The DM")} hint={tr("Use {nome} to greet them by their @.")}>
                <textarea rows={3} value={form.dm_text} onChange={(e) => setForm({ ...form, dm_text: e.target.value })} className={INPUT}
                  placeholder={tr("Hi {nome}! Here's everything you asked about 👇")} />
              </Campo>
            </div>
            <div className="sm:col-span-2">
              <Campo rot={tr("Public reply (optional)")} hint={tr("Everyone reading the comments sees that this account answers.")}>
                <input value={form.public_reply} onChange={(e) => setForm({ ...form, public_reply: e.target.value })} className={INPUT}
                  placeholder={tr("sent you a DM 💛")} />
              </Campo>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              {tr("Active")}
            </label>
            <button type="button" disabled={salvando} onClick={salvar}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A33] px-4 py-2 text-xs font-semibold text-black disabled:opacity-50">
              <FaCheck className="text-[10px]" /> {salvando ? tr("Saving…") : tr("Save campaign")}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#FF8A33]/60";

function Campo({ rot, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-g-muted">{rot}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-g-muted">{hint}</span>}
    </label>
  );
}
