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
import { LANGS_ORDENADOS, rotuloIdioma } from "../data/langs.js";
// AMBIGUAS vem do MESMO módulo que o webhook usa pra decidir. Se a tela tivesse a própria lista,
// ela avisaria sobre uma palavra e o servidor decidiria por outra — aviso que mente é pior que
// aviso nenhum.
import { AMBIGUAS, normalizar } from "../../functions/lib/comentarios.js";

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
  // Um mapa por idioma. Campanha nova nasce só com inglês; o dono adiciona os que quiser.
  dm_i18n: { en: "" }, public_reply_i18n: {}, lang_padrao: "en",
};

/** Os idiomas que ESTA campanha tem, na ordem das telas. Sempre inclui o padrão. */
function idiomasDa(form) {
  const tem = new Set([...Object.keys(form.dm_i18n || {}), form.lang_padrao || "en"]);
  return LANGS_ORDENADOS.filter((l) => tem.has(l.code)).map((l) => l.code);
}

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
  const [aba, setAba] = useState("en");         // qual idioma está sendo editado

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
    // O texto do idioma PADRÃO é obrigatório: é ele que responde quando a detecção não decide.
    // Sem essa trava dava pra salvar uma campanha que casa a palavra e manda um DM vazio.
    const padrao = form.lang_padrao || "en";
    const dmPadrao = ((form.dm_i18n || {})[padrao] || "").trim();
    if (!dmPadrao) { toast(tr("Write the DM in the fallback language.")); return; }
    // Idioma adicionado e deixado em branco não vai pro banco — ele responderia vazio.
    const dm = {}; const pr = {};
    for (const [c, t] of Object.entries(form.dm_i18n || {})) if (String(t).trim()) dm[c] = String(t).trim();
    for (const [c, t] of Object.entries(form.public_reply_i18n || {})) if (String(t).trim()) pr[c] = String(t).trim();
    setSalvando(true);
    const d = await api({
      email, token: dataKey, action: "salvar",
      campanha: {
        ...form, id: form.id || undefined,
        keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        dm_i18n: dm, public_reply_i18n: pr, lang_padrao: padrao,
        // dm_text/public_reply seguem espelhando o idioma padrão: eles são a QUEDA que mantém
        // o webhook respondendo se o mapa vier vazio por qualquer motivo. Espelhar aqui é o que
        // impede os dois de divergirem — dois campos com a mesma verdade sempre divergem sozinhos.
        dm_text: dmPadrao, public_reply: pr[padrao] || "",
      },
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

  // Derivados da campanha aberta. Fora de hook de propósito: são cálculo puro do form atual,
  // e memorizar isso esconderia mais do que economiza.
  const langs = form ? idiomasDa(form) : [];
  const ambiguas = form
    ? form.keywords.split(",").map((k) => k.trim()).filter((k) => k && AMBIGUAS.has(normalizar(k)))
    : [];

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
              onClick={() => { setForm({ ...VAZIA }); setAba("en"); }}
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
                      <button type="button" aria-label={tr("Edit")} onClick={() => {
                        // Campanha ANTIGA (sem dm_i18n) abre com o texto único no idioma padrão —
                        // ela não pode aparecer vazia na tela só porque o campo é novo.
                        const padrao = c.lang_padrao || "en";
                        const dm = (c.dm_i18n && Object.keys(c.dm_i18n).length) ? c.dm_i18n : { [padrao]: c.dm_text || "" };
                        const pr = (c.public_reply_i18n && Object.keys(c.public_reply_i18n).length)
                          ? c.public_reply_i18n : (c.public_reply ? { [padrao]: c.public_reply } : {});
                        setForm({
                          ...VAZIA, ...c, media_id: c.media_id || "",
                          public_reply: c.public_reply || "", link_url: c.link_url || "",
                          keywords: (c.keywords || []).join(", "),
                          dm_i18n: dm, public_reply_i18n: pr, lang_padrao: padrao,
                        });
                        setAba(padrao);
                      }} className="rounded-lg border border-white/10 p-2 text-xs"><FaPen /></button>
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
              {/* ── FAIXA DE IDIOMAS ────────────────────────────────────────────────────────
                  Gui atende em 16 idiomas; o comentário responde nos que tiverem texto AQUI.
                  Só entra idioma escrito e revisado: melhor responder em inglês do que mandar
                  uma tradução capenga em coreano — a primeira frase decide se a pessoa confia. */}
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {langs.map((c) => (
                  <button key={c} type="button" onClick={() => setAba(c)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition ${
                      c === aba ? "border-[#FF8A33]/60 bg-[#FF8A33]/10 text-g-ink" : "border-white/10 text-g-muted hover:border-white/20"}`}>
                    {rotuloIdioma(c)}
                    {c === form.lang_padrao && <span title={tr("Fallback language")} className="text-[#FF8A33]">★</span>}
                    {!((form.dm_i18n || {})[c] || "").trim() && <span title={tr("Empty")} className="text-g-muted">○</span>}
                  </button>
                ))}
                <select value="" className="rounded-lg border border-white/10 bg-transparent px-2 py-1 text-[11px] text-g-muted"
                  onChange={(e) => {
                    const c = e.target.value; if (!c) return;
                    setForm({ ...form, dm_i18n: { ...(form.dm_i18n || {}), [c]: "" } }); setAba(c);
                  }}>
                  <option value="">{tr("+ language")}</option>
                  {LANGS_ORDENADOS.filter((l) => !langs.includes(l.code)).map((l) => (
                    <option key={l.code} value={l.code} className="bg-[#161512]">{l.flag} {l.native}</option>
                  ))}
                </select>
                {langs.length > 1 && aba !== form.lang_padrao && (
                  <button type="button" title={tr("Remove this language")}
                    onClick={() => {
                      const dm = { ...(form.dm_i18n || {}) }; const pr = { ...(form.public_reply_i18n || {}) };
                      delete dm[aba]; delete pr[aba];
                      setForm({ ...form, dm_i18n: dm, public_reply_i18n: pr }); setAba(form.lang_padrao || "en");
                    }}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-g-muted hover:border-red-500/40 hover:text-red-300">
                    <FaTrash className="text-[9px]" />
                  </button>
                )}
              </div>

              <Campo rot={`${tr("The DM")} · ${rotuloIdioma(aba)}`} hint={tr("Use {nome} to greet them by their @.")}>
                <textarea rows={5} value={(form.dm_i18n || {})[aba] || ""} className={INPUT}
                  onChange={(e) => setForm({ ...form, dm_i18n: { ...(form.dm_i18n || {}), [aba]: e.target.value } })}
                  placeholder={tr("Hi {nome}! Here's everything you asked about 👇")} />
              </Campo>
              <div className="mt-3">
                <Campo rot={`${tr("Public reply (optional)")} · ${rotuloIdioma(aba)}`}
                       hint={tr("Everyone reading the comments sees it — so it answers in their language too.")}>
                  <input value={(form.public_reply_i18n || {})[aba] || ""} className={INPUT}
                    onChange={(e) => setForm({ ...form, public_reply_i18n: { ...(form.public_reply_i18n || {}), [aba]: e.target.value } })}
                    placeholder={tr("sent you a DM 💛")} />
                </Campo>
              </div>
            </div>

            <Campo rot={tr("Fallback language")} hint={tr("Used when the comment doesn't say which language it is.")}>
              <select value={form.lang_padrao || "en"} className={INPUT}
                onChange={(e) => setForm({ ...form, lang_padrao: e.target.value, dm_i18n: { ...(form.dm_i18n || {}), [e.target.value]: (form.dm_i18n || {})[e.target.value] || "" } })}>
                {langs.map((c) => <option key={c} value={c} className="bg-[#161512]">{rotuloIdioma(c)}</option>)}
              </select>
            </Campo>

            {/* AVISO DAS AMBÍGUAS. "valor" existe em PT e ES; "info" em vários. Elas não decidem
                idioma — caem no padrão. Dizer isso AQUI evita o dono descobrir por um DM errado. */}
            {ambiguas.length > 0 && (
              <div className="sm:col-span-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/90">
                {tr("These words exist in more than one language, so they answer in the fallback:")}{" "}
                <b>{ambiguas.join(", ")}</b>
              </div>
            )}
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
