/* Reputação — o que os clientes DO CLIENTE dizem sobre ele.
   ─────────────────────────────────────────────────────────────────────────────
   O QUE ESTA TELA ERA ATÉ 2026-08-11 (e por que precisava mudar):
   ela recebia apenas `{V, onNav}` — nunca sessão, nunca chave de conexão — e por
   isso mostrava a MESMA tela para um cliente pagante e para um visitante da demo:
   nota média, "87 avaliações este mês", "312 pedidos enviados", "31% de conversão"
   e uma distribuição 78/15/4/2/1 — todos gerados por `vnum(V.label, …)`, ou seja,
   derivados do NOME do negócio. Números plausíveis, estáveis entre recargas (o que
   os faz parecer reais) e sem um único byte de lastro.

   Pior que os números eram os botões. Quatro deles diziam ter feito algo:
     · "Request reviews now"  → gravava no localStorage e dizia "os pedidos estão a
                                caminho dos seus clientes recentes". Nada saiu.
     · "Reply / thank"        → "uma resposta calorosa foi publicada". Não foi.
     · "Share"                → "compartilhei nas suas redes". Não compartilhou.
     · "Boost as ad"          → criava uma campanha FALSA no localStorage, que
                                reaparecia na aba Campanhas como se existisse.
   Um dono de salão que abrisse esta aba concluiria que a reputação dele está sendo
   cuidada. É a categoria de defeito mais cara que existe num produto vendido como
   agência: não quebra o build, não aparece em log nenhum, e destrói a confiança no
   dia em que o cliente confere no Google e não acha nada.

   A REGRA AGORA: em modo real, nenhum número sem lastro. A única fonte de verdade
   de avaliação que a plataforma tem hoje é o Perfil do Google (`/api/google-business`),
   e ele só responde quando a API do Google estiver aprovada para este projeto. Então
   a tela tem TRÊS estados, não dois: ligada (lê e mostra), conectada-mas-aguardando
   (diz isso), e NÃO DEU PARA VERIFICAR (falha de rede/permissão — que nunca pode ser
   apresentada como "você não tem avaliações").
   O showcase antigo continua vivo para a demonstração — com selo, em cada número.

   2026-09-30 — VÁRIAS FICHAS + FILA DE APROVAÇÃO. O servidor normaliza a avaliação do Google
   (estrela é enum; nome vem de reviewer.displayName) e lê TODAS as fichas confirmadas do
   negócio. Esta tela ganhou: filtro e média por unidade, e a fila de rascunhos com Aprovar /
   Editar / Rejeitar. NADA é publicado sem o dono apertar o botão aqui — saiu toda frase que
   dizia que a resposta era automática. Texto novo desta tela passa por tr() (chave em inglês;
   pt/es em src/portal/_pending_dict_google.json até o orquestrador juntar nos dicionários). */
import { useState, useEffect, useCallback } from "react";
import NoSeuPlano from "./NoSeuPlano.jsx";
import { portalApi, loadDataKey, toast } from "../lib/portalApi.js";
import { genReviews, loadCreated, genCustomers, pushCreated, MiniStats, vnum, Card, tr, Drawer, Empty, SectionSkeleton, UI_LANG } from "../pages/Portal.jsx";

// i18n local — os dicionários globais são de outro dono; a aba não deve depender de
// um patch alheio para falar a língua do cliente (mesmo padrão de GoogleHub/SocialHub).
const t = (o) => o[UI_LANG] || o.en;
// A demonstração nunca diz "enviado ✓" — diz que é demonstração.
const toastDemo = (m) => toast(m);

async function gbp(body) {
  try {
    const r = await fetch("/api/google-business", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    // O veredito viaja com a resposta: um 401/500 JAMAIS pode parecer "zero avaliações".
    return { ...(d && typeof d === "object" ? d : {}), _ok: r.ok && d?.ok !== false, _http: r.status };
  } catch { return { _ok: false, _http: 0 }; }
}

// ── MODO REAL ────────────────────────────────────────────────────────────────
// (2026-09-30) A tela lia r.stars / r.name / r.text / r.replied e a API do Google devolve
// starRating ("ONE".."FIVE"), reviewer.displayName, comment e reviewReply. Agora o SERVIDOR
// normaliza (functions/lib/googleReviews.js) e esta tela só mostra: { id, location, stars (1–5 ou
// null), reviewer, text, createdAt, replied, replyText }. Nota desconhecida é "—", nunca 0.
// E nenhuma resposta é publicada sem o dono apertar "Approve and publish" aqui.
const estrelas = (n) => (n == null ? "—" : "★".repeat(n));
const dataCurta = (iso) => { try { return iso ? new Date(iso).toLocaleDateString(UI_LANG) : ""; } catch { return ""; } };

// A frase de cada estado da conexão. "Não conectado", "o Google ainda não liberou" e "precisa
// reautorizar" são três situações diferentes, com três providências diferentes.
function fraseDoEstado(state) {
  switch (state) {
    case "not_connected": return tr("Your Google account isn't connected yet. Connect it on the Google tab and your reviews show up here.");
    case "api_pending": return tr("Your Google account is connected. Google hasn't approved review access for this platform yet, so nothing is being read. We show nothing rather than guess.");
    case "needs_reconsent": return tr("Google access was revoked or has expired. Reconnect your Google account on the Google tab to read and answer reviews again.");
    case "needs_scope": return tr("Your Google account is connected without the reviews permission. Reconnect on the Google tab and leave the Business Profile box ticked.");
    case "needs_discovery":
    case "discovery_failed": return tr("Connected, but we couldn't fetch your Google listings yet. Open the Google tab and tap Check again.");
    case "no_locations": return tr("This Google account has no Business Profile listing. Connect the Google account that manages your listings.");
    case "needs_mapping": return tr("Confirm which Google listings are yours on the Google tab. Until you do, no reviews are read.");
    default: return "";
  }
}
const fraseDoBloqueio = (code) => (code === "review_link"
  ? tr("A public reply can't include the review link. Remove it and try again.")
  : code === "too_long" ? tr("This reply is longer than Google allows. Shorten it and try again.")
  : code === "empty" ? tr("Write the reply first.")
  : tr("This reply can't be saved as written."));

function RealReputation({ email, dataKey, onNav }) {
  const [S, setS] = useState(null);          // null = carregando
  const [filtro, setFiltro] = useState("");  // "" = todas as fichas
  const [textos, setTextos] = useState({});  // id da linha da fila → texto em edição
  const [novo, setNovo] = useState(null);    // { review, text } — resposta escrita do zero
  const [ocupado, setOcupado] = useState("");
  const [volta, setVolta] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const st = await gbp({ action: "status", email, token: dataKey });
      if (!alive) return;
      if (!st._ok) { setS({ err: true }); return; }
      let rv = null, fila = null;
      if (st.state === "ready") {
        [rv, fila] = await Promise.all([
          gbp({ action: "list_reviews", email, token: dataKey }),
          gbp({ action: "queue_list", email, token: dataKey }),
        ]);
        if (!alive) return;
      }
      setS({ st, rv, fila });
    })();
    return () => { alive = false; };
  }, [email, dataKey, volta]);
  const recarregar = useCallback(() => setVolta((n) => n + 1), []);

  if (S === null) return <SectionSkeleton rows={5} />;

  const state = S.err ? "unknown" : ((S.rv && S.rv._ok && S.rv.state) || S.st.state);
  const pronto = state === "ready";
  const leuAvaliacoes = !!(S.rv && S.rv._ok);
  const todas = leuAvaliacoes && Array.isArray(S.rv.reviews) ? S.rv.reviews : [];
  const porFicha = leuAvaliacoes && Array.isArray(S.rv.per_location) ? S.rv.per_location : [];
  const fichasComFalha = porFicha.filter((p) => !p.ok);
  const leuFila = !!(S.fila && S.fila._ok);
  const filaToda = leuFila && Array.isArray(S.fila.rows) ? S.fila.rows : [];
  const naFila = new Map(filaToda.map((q) => [q.review_id, q]));

  const list = filtro ? todas.filter((r) => r.location === filtro) : todas;
  const pendentes = filaToda.filter((q) => ["draft", "approved", "failed"].includes(q.status) && (!filtro || q.location_id === filtro));
  const comNota = list.filter((r) => r.stars != null);
  const semResposta = list.filter((r) => !r.replied).length;
  // Distribuição só do que foi LIDO (as mais recentes) — e dita assim na tela.
  const dist = [5, 4, 3, 2, 1].map((n) => [n, comNota.length ? Math.round((comNota.filter((r) => r.stars === n).length / comNota.length) * 100) : null]);
  // Nota média e total: os números do PRÓPRIO Google (todas as avaliações da ficha).
  const fichaSel = filtro ? porFicha.find((p) => p.location_id === filtro) : null;
  const media = filtro ? (fichaSel && fichaSel.ok && fichaSel.averageRating != null ? Number(fichaSel.averageRating) : null) : (leuAvaliacoes && S.rv.google ? S.rv.google.average : null);
  const total = filtro ? (fichaSel && fichaSel.ok ? fichaSel.totalReviewCount : null) : (leuAvaliacoes && S.rv.google ? S.rv.google.total : null);

  const falha = (r) => {
    const bloqueio = Array.isArray(r.blocks) && r.blocks[0] ? r.blocks[0].code : "";
    if (bloqueio) { toast(fraseDoBloqueio(bloqueio)); return; }
    if (r.error === "needs_reconsent" || r.state === "needs_reconsent") { toast(tr("Google access was revoked or has expired. Reconnect your Google account on the Google tab to read and answer reviews again.")); return; }
    toast(tr("That didn't go through. Nothing was published."));
  };
  const textoDe = (q) => (textos[q.id] != null ? textos[q.id] : q.draft_text || "");
  const mudou = (q) => textoDe(q).trim() !== String(q.draft_text || "").trim();

  const salvar = async (q) => {
    setOcupado(q.id);
    const r = await gbp({ action: "queue_edit", email, token: dataKey, id: q.id, text: textoDe(q) });
    setOcupado("");
    if (!r._ok) { falha(r); return false; }
    toast(Array.isArray(r.warnings) && r.warnings.length ? tr("Saved. Heads-up: this reply mentions an offer, a link or a contact. Read it once more before approving.") : tr("Draft saved. Nothing was published."));
    setTextos((t) => { const c = { ...t }; delete c[q.id]; return c; });
    recarregar();
    return true;
  };
  // A ação EXPLÍCITA do dono: salva a edição (se houver), aprova e publica. Cada passo é
  // conferido; se o Google recusar, a linha fica "failed" com o motivo — nunca "publicado".
  const aprovarEPublicar = async (q) => {
    setOcupado(q.id);
    if (mudou(q)) {
      const e = await gbp({ action: "queue_edit", email, token: dataKey, id: q.id, text: textoDe(q) });
      if (!e._ok) { setOcupado(""); falha(e); return; }
    }
    if (q.status !== "approved" || mudou(q)) {
      const a = await gbp({ action: "queue_approve", email, token: dataKey, id: q.id });
      if (!a._ok) { setOcupado(""); falha(a); recarregar(); return; }
    }
    const p = await gbp({ action: "queue_publish", email, token: dataKey, id: q.id });
    setOcupado("");
    if (p._ok && p.published) toast(p.google_state === "PENDING" ? tr("Sent to Google. Google is reviewing the reply before it shows publicly.") : tr("Published on Google."));
    else if (p.error === "blocked") toast(fraseDoBloqueio(p.code));
    else toast(tr("Google didn't accept the reply. Nothing was published. The reason is shown on the draft."));
    setTextos((t) => { const c = { ...t }; delete c[q.id]; return c; });
    recarregar();
  };
  const rejeitar = async (q) => {
    setOcupado(q.id);
    const r = await gbp({ action: "queue_reject", email, token: dataKey, id: q.id });
    setOcupado("");
    if (!r._ok) { falha(r); return; }
    toast(tr("Draft rejected. Nothing was published."));
    recarregar();
  };
  const escrever = async () => {
    if (!novo || !novo.text.trim()) { toast(tr("Write the reply first.")); return; }
    setOcupado("novo");
    const r = await gbp({ action: "queue_write", email, token: dataKey, location_id: novo.review.location, review_id: novo.review.id, text: novo.text });
    setOcupado("");
    if (!r._ok) { falha(r); return; }
    toast(tr("Saved as a draft. Approve it above to publish."));
    setNovo(null); recarregar();
  };

  const aviso = S.err
    ? ["#E2533F", tr("Couldn't check your Google profile just now. This is a connection problem on our side, not a statement about your reviews.")]
    : !pronto ? [state === "needs_reconsent" ? "#E2533F" : "#C8A24A", fraseDoEstado(state)]
    : !leuAvaliacoes ? ["#E2533F", tr("Couldn't load your reviews just now. This is a connection problem, not an empty profile.")]
    : null;
  const rotuloStatus = { draft: tr("Draft"), approved: tr("Approved, not published yet"), failed: tr("Not published") };

  return (
    <div className="space-y-4 stagger">
      <div className="rounded-2xl border border-[#FFC23D]/25 bg-gradient-to-br from-[#FFC23D]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FFC23D" }}>
          ⭐ {tr("Reputation")}
          <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]">
            <span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />
            {tr("LIVE · your account")}
          </span>
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("What your customers say about you.")}</div>
        <div className="mt-1 text-[11.5px] text-g-muted">{tr("Nothing is published on Google until you approve it here.")}</div>
      </div>

      {aviso && (
        <div className="rounded-xl2 px-4 py-3 text-[11.5px] leading-snug"
          style={{ color: aviso[0], background: aviso[0] + "12", border: `1px solid ${aviso[0]}40` }}>
          {aviso[1]}
          <button onClick={() => onNav?.("googlehub")} className="ml-1 font-black underline">{tr("Open Google →")}</button>
        </div>
      )}
      {fichasComFalha.map((p) => (
        <div key={p.location_id} className="rounded-xl2 px-4 py-3 text-[11.5px] leading-snug" style={{ color: "#E2533F", background: "#E2533F12", border: "1px solid #E2533F40" }}>
          {tr("Couldn't read this location just now. Its reviews are missing from this page, not zero:")} <b>{p.label || p.location_id}</b>
          <button onClick={recarregar} className="ml-2 font-black underline">{tr("Try again")}</button>
        </div>
      ))}

      {/* FILTRO POR UNIDADE */}
      {pronto && porFicha.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {[["", tr("All locations")], ...porFicha.map((p) => [p.location_id, p.label || p.location_id])].map(([id, nome]) => (
            <button key={id || "todas"} onClick={() => setFiltro(id)}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold border ${filtro === id ? "border-g-gold/60 bg-g-gold/15 text-g-gold" : "border-white/10 bg-white/[0.04] text-g-muted"}`}>
              {nome}
            </button>
          ))}
        </div>
      )}

      {/* Números com lastro OU traço. Nunca zero por falta de leitura. */}
      <MiniStats items={[
        [tr("Avg rating on Google"), media != null ? `${Number(media).toFixed(1)} ★` : "—", media != null && Number(media) >= 4 ? "good" : undefined],
        [tr("Reviews on Google"), total != null ? `${total}` : "—"],
        [tr("Awaiting a reply"), leuAvaliacoes ? `${semResposta}` : "—"],
        [tr("Drafts for you to approve"), leuFila ? `${pendentes.length}` : "—"],
      ]} />

      {/* MÉDIA POR UNIDADE */}
      {pronto && porFicha.length > 1 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("By location")}</div>
          <div className="divide-y divide-white/[0.06]">
            {porFicha.map((p) => {
              const lidas = todas.filter((r) => r.location === p.location_id);
              return (
                <div key={p.location_id} className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <span className="font-bold text-g-word">{p.label || p.location_id}</span>
                  {p.ok
                    ? <span className="text-g-muted">
                        <b className="text-g-gold">{p.averageRating != null ? `${Number(p.averageRating).toFixed(1)} ★` : "—"}</b>
                        {" · "}{p.totalReviewCount != null ? p.totalReviewCount : "—"} {tr("reviews")}
                        {" · "}{lidas.filter((r) => !r.replied).length} {tr("awaiting a reply")}
                      </span>
                    : <span style={{ color: "#E2533F" }}>{tr("couldn't read")}</span>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* A FILA — rascunhos esperando o dono */}
      {pronto && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Replies waiting for your approval")}</div>
          {!leuFila ? (
            <Empty icon="⚠️" text={tr("Couldn't load the drafts just now. Nothing was published.")} />
          ) : pendentes.length === 0 ? (
            <Empty icon="✍️" text={tr("No drafts waiting. When a new review arrives, a draft reply shows up here for you to approve, edit or reject.")} />
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {pendentes.map((q) => (
                <div key={q.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-g-word">{q.reviewer || tr("Google user")}{q.location_label ? <span className="text-g-muted font-normal"> · {q.location_label}</span> : null}</span>
                    <span className="text-xs text-g-gold">{estrelas(q.stars)}</span>
                  </div>
                  {q.review_text && <div className="text-[12px] text-g-muted mt-0.5 leading-snug">"{q.review_text}"</div>}
                  <div className="mt-2 text-[10px] font-black uppercase tracking-wide" style={{ color: q.status === "failed" ? "#E2533F" : "#C8A24A" }}>
                    {rotuloStatus[q.status]} · {q.origin === "owner" ? tr("written by you") : q.edited ? tr("drafted by Gui, edited by you") : tr("drafted by Gui")}
                  </div>
                  {q.status === "failed" && q.google_error && (
                    <div className="mt-1 text-[11px] leading-snug" style={{ color: "#E2533F" }}>{tr("Google's answer:")} {q.google_error}</div>
                  )}
                  <textarea value={textoDe(q)} onChange={(e) => setTextos((t) => ({ ...t, [q.id]: e.target.value }))} rows={3} maxLength={4000}
                    className="mt-2 w-full rounded-lg bg-white/[0.04] border border-white/10 px-2.5 py-2 text-[13px] text-g-word" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button disabled={ocupado === q.id} onClick={() => aprovarEPublicar(q)} className="btn-bright text-sm disabled:opacity-50">
                      {q.status === "failed" ? tr("Approve and try again") : tr("Approve and publish")}
                    </button>
                    {mudou(q) && <button disabled={ocupado === q.id} onClick={() => salvar(q)} className="btn-ghost text-sm disabled:opacity-50">{tr("Save edit")}</button>}
                    <button disabled={ocupado === q.id} onClick={() => rejeitar(q)} className="btn-ghost text-sm disabled:opacity-50">{tr("Reject")}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Rating breakdown")}</div>
          {dist.map(([n, v]) => (
            <div key={n} className="mb-2 last:mb-0 flex items-center gap-2">
              <span className="text-xs text-g-muted w-8">{n}★</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-g-gold to-g-green" style={{ width: `${v || 0}%` }} />
              </div>
              <span className="text-[11px] text-g-muted w-8 text-right">{v == null ? "—" : `${v}%`}</span>
            </div>
          ))}
          {comNota.length > 0 && <div className="mt-3 text-[10.5px] text-g-muted leading-snug">{tr("Breakdown of the most recent reviews read:")} {comNota.length}</div>}
          {/* O pedido de avaliação É real — mas roda sozinho no servidor, depois da visita
              (SERVER_AUTOMATIONS). Isto é sobre PEDIR avaliação, não sobre responder. */}
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2.5 text-[11px] text-g-muted leading-snug">
            {t({
              en: "Gui asks for a review automatically after each visit — once per visit, with your review link. There's nothing to fire by hand here.",
              pt: "A Gui pede a avaliação automaticamente depois de cada visita — uma vez por visita, com o seu link. Não há nada para disparar à mão aqui.",
              es: "Gui pide la reseña automáticamente después de cada visita — una vez por visita, con tu enlace. No hay nada que disparar a mano.",
              hi: "हर विज़िट के बाद Gui अपने-आप समीक्षा माँगती है — प्रति विज़िट एक बार, आपके लिंक के साथ। यहाँ हाथ से कुछ भेजना नहीं है।" })}
          </div>
        </Card>

        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Your reviews")}</div>
          {list.length === 0 ? (
            <Empty icon={S.err || (pronto && !leuAvaliacoes) || fichasComFalha.length ? "⚠️" : "⭐"} text={
              S.err || (pronto && !leuAvaliacoes) || fichasComFalha.length
                ? tr("Couldn't read your reviews. This is a connection problem, not an empty profile.")
                : pronto ? tr("No reviews yet on the connected Google listings.")
                : tr("Reviews show up here once your Google listings are connected and being read.")} />
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {list.map((r) => {
                const q = naFila.get(r.id);
                const temRascunho = q && ["draft", "approved", "failed"].includes(q.status);
                return (
                  <div key={`${r.location}:${r.id}`} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-g-word truncate">
                        {r.reviewer || tr("Google user")}
                        <span className="text-g-muted font-normal text-[11px]">{porFicha.length > 1 && r.locationLabel ? ` · ${r.locationLabel}` : ""}{r.createdAt ? ` · ${dataCurta(r.createdAt)}` : ""}</span>
                      </span>
                      <span className="text-xs text-g-gold shrink-0">{r.stars == null ? "—" : <>{"★".repeat(r.stars)}<span className="text-g-muted">{"★".repeat(5 - r.stars)}</span></>}</span>
                    </div>
                    {r.text && <div className="text-[12px] text-g-muted mt-0.5 leading-snug">"{r.text}"</div>}
                    {r.replied ? (
                      <div className="mt-1.5 rounded-lg border border-white/[0.07] bg-black/15 px-3 py-2">
                        <div className="text-[10px] font-bold" style={{ color: "#3E9468" }}>
                          ✓ {r.replyState === "PENDING" ? tr("Replied · Google is still reviewing the reply") : r.replyState === "REJECTED" ? tr("Replied · Google rejected the reply") : tr("Replied")}
                        </div>
                        <div className="text-[12px] text-g-light mt-0.5 leading-snug">{r.replyText}</div>
                      </div>
                    ) : temRascunho ? (
                      <div className="mt-1 text-[10px] font-bold" style={{ color: "#C8A24A" }}>· {tr("draft waiting for your approval above")}</div>
                    ) : novo && novo.review.id === r.id ? (
                      <div className="mt-2">
                        <textarea value={novo.text} onChange={(e) => setNovo({ ...novo, text: e.target.value })} rows={3} maxLength={4000} autoFocus
                          className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-2.5 py-2 text-[13px] text-g-word" />
                        <div className="mt-2 flex gap-2">
                          <button disabled={ocupado === "novo"} onClick={escrever} className="btn-bright text-sm disabled:opacity-50">{tr("Save as draft")}</button>
                          <button onClick={() => setNovo(null)} className="btn-ghost text-sm">{tr("Cancel")}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-3 text-[10px] font-bold" style={{ color: "#9A8F82" }}>
                        · {tr("no reply yet")}
                        <button onClick={() => setNovo({ review: r, text: "" })} className="underline text-g-gold">{tr("Write a reply")}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── MODO DEMONSTRAÇÃO ────────────────────────────────────────────────────────
// O showcase antigo, intacto — mas com selo em cima e a palavra EXEMPLO ao lado de
// cada número. A régua: dado inventado só é aceitável quando é IMPOSSÍVEL confundir
// com real. As ações continuam sendo o roteiro da demonstração e dizem isso.
function DemoReputation({ V, onNav }) {
  const reviews = genReviews(V);
  const dist = [["5★", 78], ["4★", 15], ["3★", 4], ["2★", 2], ["1★", 1]];
  const [sel, setSel] = useState(null);
  const [reqs, setReqs] = useState(() => loadCreated(V.label, "reviewreq"));
  useEffect(() => { setReqs(loadCreated(V.label, "reviewreq")); }, [V.label]);
  const ex = t({ en: "EXAMPLE", pt: "EXEMPLO", es: "EJEMPLO", hi: "उदाहरण" });
  const blast = () => {
    (V.customers || genCustomers(V)).slice(0, 3).forEach((c) => pushCreated(V.label, "reviewreq", { name: c.name, ch: c.channel }));
    setReqs(loadCreated(V.label, "reviewreq"));
    // Demonstração NÃO diz que enviou. Diz que é demonstração.
    toastDemo(t({ en: "Sample tour — nothing was actually sent. Connect your account to run this for real.", pt: "Roteiro de exemplo — nada foi enviado de verdade. Conecte sua conta para valer.", es: "Recorrido de ejemplo — no se envió nada. Conecta tu cuenta para hacerlo real.", hi: "नमूना — कुछ भी वास्तव में नहीं भेजा गया। असली के लिए खाता कनेक्ट करें।" }));
  };
  const boost = (r) => {
    pushCreated(V.label, "campaigns", { name: `⭐ ${r.name}'s ${r.stars}★ review → ad`, channel: r.ch || "Meta", sent: 0, opened: 0, revenue: 0, status: "Active" });
    setSel(null);
    toastDemo(t({ en: "Sample tour — this ad exists only in the demo.", pt: "Roteiro de exemplo — este anúncio só existe na demonstração.", es: "Recorrido de ejemplo — este anuncio solo existe en la demo.", hi: "नमूना — यह विज्ञापन केवल डेमो में है।" }));
    onNav?.("campaigns");
  };
  return (
    <div className="space-y-4 stagger">
      <div className="rounded-xl2 border border-g-gold/40 bg-g-gold/10 px-4 py-3">
        <div className="text-[11px] font-black uppercase tracking-widest text-g-gold">
          {t({ en: "Example · not your data", pt: "Exemplo · não são seus dados", es: "Ejemplo · no son tus datos", hi: "उदाहरण · यह आपका डेटा नहीं" })}
        </div>
        <div className="mt-0.5 text-sm text-g-word">
          {t({ en: "These numbers show how the screen looks once your Google profile is connected. Nothing here is a real review of your business.", pt: "Estes números ilustram como a tela fica quando seu Perfil do Google estiver conectado. Nada aqui é avaliação real do seu negócio.", es: "Estos números ilustran cómo se ve la pantalla con tu Perfil de Google conectado. Nada aquí es una reseña real.", hi: "ये आंकड़े दिखाते हैं कि Google प्रोफ़ाइल जुड़ने पर स्क्रीन कैसी दिखेगी। यहाँ कुछ भी असली समीक्षा नहीं है।" })}
        </div>
      </div>
      <MiniStats items={[
        [`${t({ en: "Avg rating", pt: "Nota média", es: "Nota media", hi: "औसत रेटिंग" })} · ${ex}`, `${((46 + vnum(V.label, "rate", 0, 3)) / 10).toFixed(1)} ★`, "good"],
        [`${t({ en: "Reviews this month", pt: "Avaliações no mês", es: "Reseñas del mes", hi: "इस माह समीक्षाएँ" })} · ${ex}`, `${vnum(V.label, "revc", 40, 140)}`, "good"],
        [`${t({ en: "Requests sent", pt: "Pedidos enviados", es: "Solicitudes enviadas", hi: "भेजे गए अनुरोध" })} · ${ex}`, `${vnum(V.label, "reqs", 200, 420) + reqs.length}`],
        [`${t({ en: "Request → review", pt: "Pedido → avaliação", es: "Solicitud → reseña", hi: "अनुरोध → समीक्षा" })} · ${ex}`, `${vnum(V.label, "conv", 24, 38)}%`, "good"],
      ]} />
      {reqs.length > 0 && (
        <Card className="border-g-gold/25 bg-g-gold/[0.05]">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-2">{tr("⭐ Review requests in flight")} · {ex}</div>
          <div className="flex flex-wrap gap-2">{reqs.map((r, i) => (<span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "#3FB4FF", boxShadow: "0 0 7px rgba(63,180,255,.55)" }} />{r.name} <span className="text-g-muted">· {r.ch || "WhatsApp"} · awaiting</span></span>))}</div>
        </Card>
      )}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Rating breakdown")} · {ex}</div>
          {dist.map(([l, v]) => (<div key={l} className="mb-2 last:mb-0 flex items-center gap-2"><span className="text-xs text-g-muted w-8">{l}</span><div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-gold to-g-green" style={{ width: `${v}%` }} /></div><span className="text-[11px] text-g-muted w-8 text-right">{v}%</span></div>))}
          <button onClick={blast} className="btn-bright text-sm w-full mt-4 justify-center">{tr("Request reviews now")}</button>
        </Card>
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recent reviews · collected by AI")} · {ex}</div>
          <div className="divide-y divide-white/[0.06]">{reviews.map((r, i) => (<button key={i} onClick={() => setSel(r)} className="w-full text-left px-5 py-3 hover:bg-white/[0.04] transition"><div className="flex items-center justify-between"><span className="text-sm font-bold text-g-word">{r.name}</span><span className="text-xs text-g-gold">{"★".repeat(r.stars)}<span className="text-g-muted">{"★".repeat(5 - r.stars)}</span></span></div><div className="text-[12px] text-g-muted mt-0.5">"{r.text}" <span className="text-g-light">· {r.ch}</span></div></button>))}</div>
        </Card>
      </div>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={`${sel.ch} review · ${ex}`}
          badge={<span className="text-xs text-g-gold">{"★".repeat(sel.stars)}</span>}
          fields={[["Rating", `${sel.stars} / 5`], ["Channel", sel.ch], ["Status", ex]]}
          note={<>"{sel.text}"<div className="mt-2 text-g-muted">{tr("The AI requested this review automatically after a great experience.")}</div></>}
          actions={<>{sel.stars >= 4 && <button onClick={() => boost(sel)} className="btn-ghost text-sm">🚀 {tr("Boost as ad")}</button>}</>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

function Reputation({ V, onNav, real: realProp = null, email: emailProp = "", dataKey: dataKeyProp = "" }) {
  // Portal.jsx passa só {V, onNav} para esta aba — então ela resolve a sessão sozinha,
  // exatamente como Campaigns.jsx e SocialInbox.jsx fazem. Sem isso, um cliente pagante
  // via a tela de demonstração como se fosse a reputação dele.
  const [sess, setSess] = useState(realProp != null ? null : undefined);
  useEffect(() => {
    if (realProp != null) return;
    let alive = true;
    portalApi.session().then((s) => { if (alive) setSess(s || null); }).catch(() => { if (alive) setSess(null); });
    return () => { alive = false; };
  }, [realProp]);

  const email = (emailProp || sess?.email || "").toString().trim().toLowerCase();
  const dataKey = dataKeyProp || loadDataKey();
  if (realProp == null && sess === undefined) return <SectionSkeleton rows={5} />;
  const live = !!(email && dataKey && (realProp != null || sess?.demo !== true));
  // O convite de plano entra SÓ no ramo real — em demonstração o cockpit inteiro é vitrine, e
  // dizer "não está no seu plano" para quem não tem plano nenhum é ruído sem sentido.
  return live
    ? (<>
        <NoSeuPlano real={realProp} produto="reputation" />
        <RealReputation email={email} dataKey={dataKey} onNav={onNav} />
      </>)
    : <DemoReputation V={V} onNav={onNav} />;
}

export default Reputation;
