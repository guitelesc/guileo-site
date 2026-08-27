/* Split out of Portal.jsx (performance): Followups tab view.
   ── OS FOLLOW-UPS DE VERDADE (2026-08-25) ──────────────────────────────────────────────────────
   Esta tela mostrava `genFollowups(V)` — nomes, canais e valores inventados — e ADMITIA isso num
   aviso âmbar ("ainda é um layout de amostra"). Admitir a mentira é melhor que escondê-la, e ainda
   assim é uma tela de mentira dentro do cockpit de quem paga.

   O dado real já existia e já estava gated por tenant, em duas listas do /api/growth-intel:
     • action:"abandoned" → `booking_intents_abandoned` = quem QUASE agendou e sumiu no meio.
     • action:"churn"     → `churn_risk_scan`           = cliente com padrão real (≥3 visitas)
                                                          que passou da própria cadência.
   As duas juntas são exatamente "quem está esperando um follow-up". Cada linha tem ação REAL:
   recover (a Gui chama de volta) e reengage (a Gui reativa — e-mail agora, SMS/ligação na fila).

   🚨 MENOS E VERDADEIRO. A amostra mostrava valor de pipeline ($), estágio "2 de 3" e canal por
   linha. Nada disso existe no dado real: sequência de 3 toques não é medida em lugar nenhum, e o
   `ltv` do churn é histórico gasto, não pipeline futuro. Então em modo real esses campos não
   desenham. Inventar número dentro do ROI de um cliente pagante é o erro mais caro deste repo.
   🚨 SUCESSO SÓ COM COMPROVANTE: a linha só vira "✓" quando a resposta traz ok+claimed/queued.
   🚨 SEM CONTATO NÃO HÁ ENVIO: linha de churn sem telefone/e-mail some (nunca um envio fingido).
   Modo demo continua idêntico — o vendedor usa a amostra para vender. */
import { useState, useEffect, useCallback } from "react";
import { portalApi, toast } from "../lib/portalApi.js";
import { waLink } from "../data/contact.js";
import { genFollowups, logImpact, MiniStats, vnum, Card, tr, Drawer, SectionSkeleton } from "../pages/Portal.jsx";

/* ═══════════════════════════ MODO REAL ═══════════════════════════ */

async function giPost(body) {
  try {
    const r = await fetch("/api/growth-intel", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// o contato pode chegar em três nomes conforme a RPC; um lugar só decide qual é.
const contatoDe = (r) => (r.contact || r.phone || r.contact_email || r.email || "").toString().trim();

function FollowupsReal({ email, dataKey }) {
  const [dados, setDados] = useState(null);        // null = carregando (nunca "vazio" falso)
  const [feito, setFeito] = useState({});          // chave da linha → "enviando"|"ok"|"fila"|"erro"

  const carrega = useCallback(async () => {
    const [ab, ch] = await Promise.all([
      giPost({ action: "abandoned", token: dataKey, email }),
      giPost({ action: "churn", token: dataKey, email }),
    ]);
    setDados({
      // `ready:false` = SQL não aplicado. Isso é diferente de "zero follow-ups" e a tela precisa
      // distinguir os dois: null ≠ 0. Guardo os dois flags separados.
      prontoAb: !!ab?.ready, prontoCh: !!ch?.ready,
      abandonados: Array.isArray(ab?.intents) ? ab.intents : [],
      emRisco: Array.isArray(ch?.atRisk) ? ch.atRisk : [],
    });
  }, [email, dataKey]);
  useEffect(() => { carrega(); }, [carrega]);

  if (dados === null) return <SectionSkeleton rows={5} />;

  const naoMedido = !dados.prontoAb && !dados.prontoCh;

  // Uma lista só, das duas fontes. `kind` guarda de onde veio porque a AÇÃO é diferente.
  const linhas = [
    ...dados.abandonados.map((r) => ({
      chave: `ab:${r.id}`, kind: "abandoned", id: r.id,
      nome: (r.name || "").toString().trim() || contatoDe(r) || tr("Contact"),
      contato: contatoDe(r),
      detalhe: [r.service || null, Number.isFinite(Number(r.minutes_ago)) ? `${Math.round(Number(r.minutes_ago))} min` : null, r.source || null].filter(Boolean).join(" · "),
      motivo: tr("Almost booked — dropped off mid-way"),
      cor: "#FFC23D",
      jaFeito: r.claimed === true,
    })),
    ...dados.emRisco.map((r, i) => ({
      chave: `ch:${r.id || r.phone || i}`, kind: "churn",
      nome: (r.name || r.full_name || "").toString().trim() || tr("Contact"),
      contato: contatoDe(r),
      detalhe: [
        Number.isFinite(Number(r.risk)) ? `${Math.round(Number(r.risk))}% ${tr("risk")}` : null,
        Number.isFinite(Number(r.days_since_visit)) ? `${Math.round(Number(r.days_since_visit))}d` : null,
        Number.isFinite(Number(r.visits)) ? `${Math.round(Number(r.visits))} ${tr("visits")}` : null,
      ].filter(Boolean).join(" · "),
      motivo: tr("Loyal customer past their usual return window"),
      cor: "#FF8A33",
      sugerido: r.suggested_action || "sms",
      risco: r.risk,
      // sem contato não há como reativar → a linha não entra (nunca um envio fingido)
      inviavel: !contatoDe(r),
    })),
  ].filter((l) => !l.inviavel);

  const abertas = linhas.filter((l) => !l.jaFeito && !["ok", "fila"].includes(feito[l.chave]));

  const agir = async (l) => {
    if (feito[l.chave]) return;
    setFeito((s) => ({ ...s, [l.chave]: "enviando" }));
    const res = l.kind === "abandoned"
      ? await giPost({ action: "recover", token: dataKey, email, intent_id: l.id, name: l.nome, contact: l.contato })
      : await giPost({ action: "reengage", token: dataKey, email, name: l.nome, contact: l.contato, suggested: l.sugerido, risk: l.risco });
    // comprovante ou nada: `ok` sozinho não basta — precisa do claimed/queued do backend.
    const ok = l.kind === "abandoned" ? !!(res && res.ok && res.claimed) : !!(res && res.ok && res.queued);
    if (!ok) {
      setFeito((s) => { const n = { ...s }; delete n[l.chave]; return n; });
      toast(tr("Couldn't send that follow-up — try again."));
      return;
    }
    const agora = l.kind !== "abandoned" && res.sent === true;   // e-mail branded saiu AGORA
    setFeito((s) => ({ ...s, [l.chave]: agora ? "ok" : "fila" }));
    toast(agora ? `${tr("Gui reached")} ${l.nome} ✓` : `${tr("Gui will follow up with")} ${l.nome} — ${tr("queued ✓")}`);
  };

  return (
    <div className="space-y-4 stagger">
      {/* null ≠ 0: motor não aplicado é "não sei", não "não tem ninguém". */}
      {naoMedido && (
        <div className="rounded-xl2 border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] leading-snug text-g-muted">
          {tr("The follow-up engine isn't switched on for your account yet — so this isn't a zero, it's a blank. Ask your team to turn it on.")}
        </div>
      )}
      <MiniStats items={[
        [tr("Waiting on a follow-up"), `${abertas.length}`],
        [tr("Almost booked"), `${dados.abandonados.length}`],
        [tr("At risk of leaving"), `${dados.emRisco.length}`, dados.emRisco.length ? "bad" : undefined],
      ]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">
          {tr("Who's waiting on a follow-up — from your own contacts")}
        </div>
        <div className="divide-y divide-white/[0.06]">
          {abertas.map((l) => {
            const st = feito[l.chave];
            return (
              <div key={l.chave} className="flex items-center gap-3 px-5 py-3.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: l.cor, boxShadow: `0 0 8px ${l.cor}88` }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-g-word">{l.nome}</div>
                  <div className="truncate text-[11px] text-g-muted">{l.motivo}{l.detalhe ? ` · ${l.detalhe}` : ""}</div>
                </div>
                <button onClick={() => agir(l)} disabled={st === "enviando"}
                  className="shrink-0 rounded-full border border-g-green/40 bg-g-green/[0.1] px-3 py-1.5 text-[11px] font-bold text-g-green transition hover:bg-g-green/20 disabled:opacity-50">
                  {st === "enviando" ? "…" : tr("Gui follows up →")}
                </button>
              </div>
            );
          })}
          {abertas.length === 0 && !naoMedido && (
            <div className="px-5 py-10 text-center text-xs text-g-muted">{tr("No follow-up pending 🎉")}</div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════ MODO DEMO (amostra declarada) ═══════════════════════════ */

function FollowupsDemo({ V }) {
  const rows = genFollowups(V);
  const [done, setDone] = useState(() => portalApi.loadState(`${V.label}:fups`, []));
  const [sel, setSel] = useState(null);
  useEffect(() => { setDone(portalApi.loadState(`${V.label}:fups`, [])); }, [V.label]);
  const open = rows.map((r, i) => ({ r, i })).filter(({ i }) => !done.includes(i));
  const pipeline = open.reduce((s, { r }) => s + r.value, 0);
  const markWon = (i, name, value) => {
    setDone((d) => { const n = [...d, i]; portalApi.saveState(`${V.label}:fups`, n); return n; });
    logImpact(V.label, `Won back ${name}`, value || 120);
    toast(`Wonderful — ${name} is won. 🎉 $${value || 120} added to your Guileo Impact.`);
    setSel(null);
  };
  const doNudge = (r, after) => { toast(`Done — I've nudged ${r.name} for you.`); after && after(); };
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Active sequences", `${open.length}`], ["Pipeline value", `$${pipeline.toLocaleString()}`], ["Won this week", `${vnum(V.label, "won", 4, 14)}`, "good"], ["Auto-nudged", `${vnum(V.label, "nudge", 18, 44)}`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("The AI is chasing these — so you never lose them")}</div>
        <div className="divide-y divide-white/[0.06]">
          {open.map(({ r, i }) => (
            <button key={i} onClick={() => setSel({ r, i })} className="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name} <span className="text-g-muted font-normal">· {r.type}</span></div><div className="text-[11px] text-g-muted">via {r.ch} · next: {r.next} · step {r.stage}/3</div></div>
              <span className="text-sm font-extrabold text-g-green">${r.value}</span>
              <div className="flex gap-1.5 shrink-0">
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); doNudge(r); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); doNudge(r); } }} className="text-[10px] font-bold rounded-full border border-white/15 px-2.5 py-1 text-g-word hover:border-g-gold/40 transition cursor-pointer">Nudge</span>
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); markWon(i, r.name, r.value); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); markWon(i, r.name, r.value); } }} className="text-[10px] font-bold rounded-full bg-g-green/15 border border-g-green/40 px-2.5 py-1 text-g-green cursor-pointer">{tr("Won")}</span>
              </div>
            </button>
          ))}
          {open.length === 0 && <div className="px-5 py-8 text-center text-xs text-g-muted">{tr("✅ All caught up — every lead followed up.")}</div>}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.r.name}
          subtitle={sel.r.type}
          badge={<span className="text-sm font-extrabold text-g-green">${sel.r.value}</span>}
          fields={[["Type", sel.r.type], ["Channel", sel.r.ch], ["Next touch", sel.r.next], ["Sequence stage", `${sel.r.stage} of 3`], ["Pipeline value", `$${sel.r.value}`]]}
          note={`The AI is running a ${sel.r.stage}-of-3 follow-up sequence via ${sel.r.ch}. It stops automatically the moment they convert or reply.`}
          actions={<><button onClick={() => doNudge(sel.r, () => setSel(null))} className="btn-bright text-sm">{tr("Send nudge now")}</button><button onClick={() => markWon(sel.i, sel.r.name, sel.r.value)} className="btn-ghost text-sm">{tr("🎉 Mark won")}</button><a href={waLink(`Hi ${sel.r.name}, following up…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">{tr("💬 Message")}</a></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

function Followups({ V, real = null, email = "", dataKey = "" }) {
  const live = !!(real && email && dataKey);
  return live ? <FollowupsReal email={email} dataKey={dataKey} /> : <FollowupsDemo V={V} />;
}

export default Followups;
