/* Guileo Direct — o funil medido, dentro da aba de comentários.
   Fonte: db/direct_metricas.sql → /api/meta-comentarios (o mesmo portão de tenant do resto).

   A ORDEM DA TELA É A ORDEM DA PERGUNTA DO DONO:
     1. "está funcionando?"        → o funil, porta a porta, com a conversão de uma para a outra
     2. "o que eu mexo?"           → os conselhos (src/portal/directConselhos.js, puro e testado)
     3. "qual campanha vende?"     → a tabela por campanha, com leads quando o link existe
     4. "e a conversa, e as contas?" → idiomas, quem respondeu, saúde de cada conta

   ⚠️ ERRO NÃO VIRA ZERO: sem métrica a tela diz "não consegui ler", nunca mostra um funil de zeros.
   ⚠️ O denominador "comentários" só existe desde a medição ao vivo — antes disso a tela diz isso,
   em vez de mostrar "0 comentários → 3 casaram", que é matemática impossível. */
import { useState } from "react";
import { tr, Card, UI_LANG } from "../pages/Portal.jsx";
import { rotuloIdioma } from "../data/langs.js";
import { conselhosDoDirect } from "./directConselhos.js";

const PERIODOS = [7, 30, 90];
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
const fmt = (v) => n(v).toLocaleString(UI_LANG === "hi" ? "en-IN" : UI_LANG);

function dataCurta(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  try { return new Date(t).toLocaleDateString(UI_LANG, { day: "2-digit", month: "short" }); } catch { return new Date(t).toISOString().slice(0, 10); }
}
function haQuanto(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.round((t - Date.now()) / 1000);
  const rtf = (() => { try { return new Intl.RelativeTimeFormat(UI_LANG, { numeric: "auto" }); } catch { return null; } })();
  if (!rtf) return dataCurta(iso);
  const a = Math.abs(s);
  // TRUNCA (não arredonda): o conselho diz "há 31 dias" contando dias inteiros; arredondar aqui
  // escrevia "32" na mesma tela, para a mesma data. Dois números para um fato é um defeito.
  if (a < 3600) return rtf.format(Math.trunc(s / 60) || -1, "minute");
  if (a < 86400) return rtf.format(Math.trunc(s / 3600), "hour");
  return rtf.format(Math.trunc(s / 86400), "day");
}
function tempo(ms) {
  if (!Number.isFinite(Number(ms))) return "—";
  const v = Number(ms);
  if (v < 1000) return "<1 s";
  if (v < 60000) return `${Math.round(v / 1000)} s`;
  return `${Math.round(v / 60000)} min`;
}

// O texto de cada conselho mora AQUI, como tr("…") literal — é o que o teste de i18n do portal
// enxerga. A regra que decide QUANDO aparecer mora em directConselhos.js.
function textoDoConselho(c) {
  const v = c.vars || {};
  const sub = (s) => s.replace("{n}", fmt(v.n)).replace("{pct}", `${n(v.pct)}%`).replace("{conta}", v.conta || "");
  switch (c.id) {
    case "falha_envio": return {
      t: sub(tr("{n} DM(s) did not go out")),
      d: tr("Instagram refused the send. The reason Instagram gave is below — if it mentions permission or capability, the account needs to be reconnected."),
      detalhe: v.motivo };
    case "nao_entregues": return {
      t: sub(tr("{n} answer(s) from Gui did not reach the customer")),
      d: tr("Instagram refused the reply — usually an expired page connection or a conversation older than 24 hours. Reconnect the account in Social accounts.") };
    case "frase_segura": return {
      t: sub(tr("Gui fell back to \"the team will confirm\" in {pct} of replies")),
      d: tr("That line means the AI could not answer. Usually her knowledge is missing something people ask — open Business Brain and add the answers.") };
    case "conta_muda": return {
      t: sub(tr("{conta} has not received a DM in {n} days")),
      d: tr("If people have messaged you since, Instagram may be holding the messages: open Meta Business Suite and look for \"Confirm access to Instagram messages\" — one click brings them back.") };
    case "conta_sem_dm": return {
      t: sub(tr("{conta} has never received a DM through Guileo")),
      d: tr("Send a DM to this account from a personal profile. If it does not show up here within a minute, the account needs to be reconnected.") };
    case "sem_link": return {
      t: sub(tr("{n} campaign(s) send a DM without a link")),
      d: tr("Without a link, the leads they bring cannot be counted. Add a link to your page and every lead shows up below, under its campaign.") };
    case "idioma_padrao": return {
      t: sub(tr("{pct} of DMs went out in the fallback language")),
      d: tr("People wrote in a language your campaign has no text for. Add the translation in the campaign and they get the answer in their own language.") };
    case "poucos_casam": return {
      t: sub(tr("Only {pct} of comments use your keywords")),
      d: tr("People are commenting, but not with your words. Look at what they actually write and add those words to the campaign.") };
    case "poucas_conversas": return {
      t: sub(tr("Only {pct} of people reply to the DM")),
      d: tr("End the DM with a simple question (\"Want me to check a date for you?\") — a question gets an answer, a statement gets read and closed.") };
    case "standby": return {
      t: sub(tr("{n} DM(s) went to another app")),
      d: tr("Another tool (ManyChat, Blotato or a manual reply in the inbox) owns those conversations, so Gui stayed quiet instead of talking over it.") };
    case "freio": return {
      t: sub(tr("The safety brake held {n} DM(s)")),
      d: tr("When the same person comments again within minutes, Gui waits instead of sending another DM. That keeps your account from looking like spam to Instagram.") };
    case "tudo_certo": return {
      t: sub(tr("Everything is flowing: {n} DM(s) sent, nothing stuck")),
      d: tr("No failures, no silent accounts, no missing translations in this period.") };
    case "sem_dados": return {
      t: tr("No comments with your keywords in this period yet"),
      d: tr("As soon as someone comments, each step shows up here — from the comment to the lead.") };
    default: return null;
  }
}

const COR_NIVEL = {
  red: "border-red-400/30 bg-red-500/[0.06]",
  gold: "border-amber-400/30 bg-amber-400/[0.05]",
  info: "border-white/10 bg-white/[0.02]",
  green: "border-emerald-400/30 bg-emerald-400/[0.05]",
};
const PONTO_NIVEL = { red: "bg-red-400", gold: "bg-amber-400", info: "bg-white/40", green: "bg-emerald-400" };

function Passo({ rotulo, valor, base, rodape, vazio }) {
  const conv = vazio ? null : pct(n(valor), n(base));
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-g-muted">{rotulo}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{vazio ? "—" : fmt(valor)}</div>
      <div className="mt-0.5 min-h-[1rem] text-[11px] text-g-muted tabular-nums">
        {conv != null && base != null ? `${conv}% ${tr("of the previous step")}` : ""}
      </div>
      {rodape && <div className="mt-1 text-[11px] text-g-muted">{rodape}</div>}
    </div>
  );
}

export default function DirectMetricas({ api, email, dataKey, inicial, erroInicial, diasInicial = 30 }) {
  const [dias, setDias] = useState(diasInicial);
  const [m, setM] = useState(inicial || null);
  const [erro, setErro] = useState(erroInicial || "");
  const [lendo, setLendo] = useState(false);

  async function trocarPeriodo(d) {
    if (d === dias || lendo) return;
    setDias(d); setLendo(true);
    const r = await api({ email, token: dataKey, action: "metricas", dias: d });
    const dd = r && r.data;
    if (dd && dd.metricas) { setM(dd.metricas); setErro(""); }
    else { setM(null); setErro((dd && dd.metricas_erro) || r.motivo || "resposta_estranha"); }
    setLendo(false);
  }

  const cabecalho = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h4 className="text-sm font-semibold">{tr("Results")}</h4>
        {m && (
          <p className="text-[11px] text-g-muted">
            {m.medindo_desde
              ? tr("Measuring every step live since {d}.").replace("{d}", dataCurta(m.medindo_desde))
              : tr("Live measurement starts with the next comment.")}
            {m.historico_desde ? ` ${tr("History since {d}.").replace("{d}", dataCurta(m.historico_desde))}` : ""}
          </p>
        )}
      </div>
      <div className="flex gap-1" role="group" aria-label={tr("Period")}>
        {PERIODOS.map((p) => (
          <button key={p} type="button" onClick={() => trocarPeriodo(p)} aria-pressed={dias === p}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${dias === p ? "border-g-gold/60 bg-g-gold/15 text-g-gold" : "border-white/10 text-g-muted hover:border-white/25"}`}>
            {tr("{n} days").replace("{n}", p)}
          </button>
        ))}
      </div>
    </div>
  );

  if (!m) {
    return (
      <Card>
        {cabecalho}
        <p className="mt-3 text-xs text-red-300">
          <strong>{tr("I couldn't read the results just now.")}</strong>{" "}
          {tr("Your campaigns keep running — only the numbers failed to load.")}
          {erro ? <span className="mt-1 block font-mono text-[10px] text-g-muted">{String(erro).slice(0, 140)}</span> : null}
        </p>
      </Card>
    );
  }

  const f = m.funil || {};
  const c = m.conversa || {};
  const semDenominador = !m.medindo_desde && n(f.comentarios) === 0;
  // "NÃO SEI" NÃO É ZERO. Antes da medição ao vivo não se sabe QUEM respondeu (a DM antiga não
  // guardou a pessoa) — "0 responderam" seria uma afirmação falsa. E sem nenhuma campanha com link,
  // lead é impossível de medir, não "zero leads". Os dois viram "—" com o motivo embaixo.
  const conversaMedida = !!m.medindo_desde;
  const conselhos = conselhosDoDirect(m).map((x) => ({ ...x, ...textoDoConselho(x) })).filter((x) => x.t);
  const quem = c.quem_respondeu || {};
  const idiomas = Object.entries(m.por_idioma || {}).filter(([k]) => k && k !== "?").sort((a, b) => b[1] - a[1]);
  const semIdioma = n((m.por_idioma || {})["?"]);
  const campanhas = Array.isArray(m.por_campanha) ? m.por_campanha : [];
  const contas = Array.isArray(m.contas) ? m.contas : [];
  const ROTULO_QUEM = {
    elevenlabs: tr("Gui, with your business knowledge"),
    anthropic: tr("Gui, backup brain"),
    frase_segura: tr("\"The team will confirm\" line"),
    pediu_texto: tr("Asked for a text message"),
    atalho: tr("Emergency reply"),
  };

  return (
    <Card className={lendo ? "opacity-60 transition-opacity" : "transition-opacity"}>
      {cabecalho}

      {/* ── 1. o funil, porta a porta ─────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Passo rotulo={tr("Comments")} valor={f.comentarios} vazio={semDenominador}
          rodape={semDenominador ? tr("Counting from the next comment") : null} />
        <Passo rotulo={tr("Used a keyword")} valor={f.casou} base={semDenominador ? null : f.comentarios} />
        <Passo rotulo={tr("DMs sent")} valor={f.dm_enviado} base={f.casou}
          rodape={(n(f.segurado) || n(f.dm_falhou))
            ? `${tr("{n} held").replace("{n}", fmt(f.segurado))} · ${tr("{n} failed").replace("{n}", fmt(f.dm_falhou))}` : null} />
        <Passo rotulo={tr("Replied in the DM")} valor={f.conversas} base={f.dm_enviado} vazio={!conversaMedida}
          rodape={conversaMedida ? null : tr("Counted once live measurement starts")} />
        <Passo rotulo={tr("Leads")} valor={f.leads} base={f.dm_enviado} vazio={!campanhas.some((x) => x.ativa && x.tem_link)}
          rodape={campanhas.some((x) => x.ativa && !x.tem_link) ? tr("Only counted when the DM has a link") : null} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-g-muted tabular-nums">
        <span>{tr("People reached")}: <strong className="text-g-word">{fmt(f.pessoas)}</strong></span>
        {(n(f.publica_ok) + n(f.publica_falhou)) > 0 && (
          <span>{tr("Public replies posted")}: <strong className="text-g-word">{fmt(f.publica_ok)}</strong>
            {n(f.publica_falhou) ? ` · ${tr("{n} failed").replace("{n}", fmt(f.publica_falhou))}` : ""}</span>
        )}
        {m.tempo_ms_mediano != null && (
          <span>{tr("Comment to DM")}: <strong className="text-g-word">{tempo(m.tempo_ms_mediano)}</strong> {tr("(median)")}</span>
        )}
      </div>

      {/* ── 2. o que mexer ────────────────────────────────────────────────────── */}
      {conselhos.length > 0 && (
        <div className="mt-5">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-g-muted">{tr("What to improve")}</h5>
          <ul className="mt-2 space-y-2">
            {conselhos.map((x, i) => (
              <li key={`${x.id}-${i}`} className={`rounded-xl border p-3 ${COR_NIVEL[x.nivel] || COR_NIVEL.info}`}>
                <div className="flex items-start gap-2">
                  <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PONTO_NIVEL[x.nivel] || PONTO_NIVEL.info}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{x.t}</p>
                    <p className="mt-0.5 text-[11px] text-g-muted">{x.d}</p>
                    {x.detalhe ? <p className="mt-1 break-words font-mono text-[10px] text-g-muted/80">{x.detalhe}</p> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 3. qual campanha vende ────────────────────────────────────────────── */}
      {campanhas.length > 0 && (
        <div className="mt-5">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-g-muted">{tr("By campaign")}</h5>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs tabular-nums">
              <thead className="text-[10px] uppercase tracking-wider text-g-muted">
                <tr>
                  <th className="py-1.5 pr-3 font-semibold">{tr("Campaign")}</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">{tr("Used a keyword")}</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">{tr("DMs sent")}</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">{tr("Replied")}</th>
                  <th className="py-1.5 text-right font-semibold">{tr("Leads")}</th>
                </tr>
              </thead>
              <tbody>
                {campanhas.map((x) => (
                  <tr key={x.id} className="border-t border-white/[0.06]">
                    <td className="py-2 pr-3">
                      <span className={x.ativa ? "" : "text-g-muted"}>{x.nome || tr("Untitled campaign")}</span>
                      {!x.ativa && <span className="ml-2 text-[10px] text-g-muted">{tr("Off")}</span>}
                      {x.ativa && !x.tem_link && <span className="ml-2 rounded-full border border-amber-400/30 px-1.5 py-px text-[10px] text-amber-300">{tr("no link")}</span>}
                    </td>
                    <td className="py-2 pr-3 text-right">{fmt(x.casou)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(x.enviados)}{n(x.falhou) ? <span className="ml-1 text-red-300">−{fmt(x.falhou)}</span> : null}</td>
                    <td className="py-2 pr-3 text-right">{conversaMedida ? fmt(x.conversas) : <span className="text-g-muted">—</span>}</td>
                    <td className="py-2 text-right">{x.tem_link ? fmt(x.leads) : <span className="text-g-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. a conversa, os idiomas e as contas ─────────────────────────────── */}
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 p-3">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-g-muted">{tr("The conversation")}</h5>
          <dl className="mt-2 space-y-1 text-xs tabular-nums">
            <div className="flex justify-between gap-2"><dt className="text-g-muted">{tr("DMs received")}</dt><dd>{fmt(c.recebidas)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-g-muted">{tr("Answered by Gui")}</dt>
              <dd>{conversaMedida ? <>{fmt(c.respondidas)}{n(c.recebidas) && n(c.respondidas) ? <span className="ml-1 text-g-muted">({pct(n(c.respondidas), n(c.recebidas))}%)</span> : null}</> : <span className="text-g-muted">—</span>}</dd></div>
            {c.resposta_ms_mediana != null && (
              <div className="flex justify-between gap-2"><dt className="text-g-muted">{tr("Time to answer (median)")}</dt><dd>{tempo(c.resposta_ms_mediana)}</dd></div>
            )}
            {n(c.nao_entregues) > 0 && <div className="flex justify-between gap-2"><dt className="text-red-300">{tr("Not delivered")}</dt><dd className="text-red-300">{fmt(c.nao_entregues)}</dd></div>}
            {n(c.standby) > 0 && <div className="flex justify-between gap-2"><dt className="text-g-muted">{tr("Handled by another app")}</dt><dd>{fmt(c.standby)}</dd></div>}
          </dl>
          {Object.keys(quem).length > 0 && (
            <ul className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-2 text-[11px] text-g-muted tabular-nums">
              {Object.entries(quem).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2"><span>{ROTULO_QUEM[k] || k}</span><span>{fmt(v)}</span></li>
              ))}
            </ul>
          )}
          {!conversaMedida && n(c.recebidas) > 0 && (
            <p className="mt-2 text-[11px] text-g-muted">{tr("Answers are counted from the start of live measurement.")}</p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 p-3">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-g-muted">{tr("Languages of the DMs")}</h5>
          {idiomas.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {idiomas.map(([code, v]) => (
                <li key={code} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] tabular-nums">{rotuloIdioma(code)} · {fmt(v)}</li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[11px] text-g-muted">{tr("The language of each DM is recorded from the next one on.")}</p>}
          {semIdioma > 0 && idiomas.length > 0 && <p className="mt-2 text-[11px] text-g-muted">{tr("{n} older DM(s) without a recorded language.").replace("{n}", fmt(semIdioma))}</p>}
        </div>

        <div className="rounded-xl border border-white/10 p-3">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-g-muted">{tr("Accounts")}</h5>
          {contas.length ? (
            <ul className="mt-2 space-y-2 text-xs">
              {contas.map((x) => (
                <li key={x.ig_id}>
                  <div className="font-semibold">{x.usuario ? `@${x.usuario}` : (x.pagina || x.ig_id)}</div>
                  <div className="text-[11px] text-g-muted">
                    {x.ultima_dm_recebida ? tr("Last DM received {t}").replace("{t}", haQuanto(x.ultima_dm_recebida))
                      : n(c.sem_conta) ? tr("DMs not yet recorded per account") : tr("No DM received yet")}
                    {x.ultimo_dm_enviado ? ` · ${tr("last comment DM {t}").replace("{t}", haQuanto(x.ultimo_dm_enviado))}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[11px] text-g-muted">{tr("No Instagram account connected yet.")}</p>}
        </div>
      </div>
    </Card>
  );
}
