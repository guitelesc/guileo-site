/* Orçamentos — o MOTOR DE ORÇAMENTO no cockpit (o módulo de $1.800/mês).
   A Gui monta o orçamento na ligação; o BANCO decide o destino (db/quote_engine.sql): abaixo do
   teto do negócio sai sozinho, acima dele espera esta tela. Aqui o dono aprova e o e-mail sai na
   marca DELE, ou recusa e nada sai.

   ⚠️ NÃO é o "Orçamento por foto" da aba Captura (lá o cliente manda foto e o dono põe o preço).

   Backend: POST /api/orcamentos — PLURAL (actions fila · lista · decidir · config · reenviar),
   portão do TENANT (e-mail + chave de conexão).
   🚨 (2026-09-28) Esta tela chamava /api/orcamento, SINGULAR: é o endpoint do /admin (teto de
   tokens do agente), gated por senha de admin. Todo cliente levava 401 e via uma faixa de erro
   permanente — o módulo mais caro do catálogo nunca leu uma linha real. Não volte ao singular.

   Nenhuma chamada joga exceção na UI: sem conexão mostra exemplo; falha de leitura mostra FALHA
   com "tentar de novo" (nunca uma lista vazia fingindo que está tudo calmo).
   Registrada pelo Portal na chave 'orcamentos'. */
import { useState, useEffect, useCallback } from "react";
import { FaFileInvoiceDollar, FaCheck, FaXmark, FaGear } from "react-icons/fa6";
import { toast, chamarApi } from "../lib/portalApi.js";
import { tr, Card, Empty, UI_LANG } from "../pages/Portal.jsx";
import FalhaDeLeitura, { fraseDaFalha } from "./FalhaDeLeitura.jsx";

const ENDPOINT = "/api/orcamentos";
// `lang` vai em TODA chamada: as frases de negócio do servidor (orçamento já decidido, valor
// inválido, motivo de o e-mail não ter saído) voltam no idioma da tela, não no do banco.
const api = (body) => chamarApi(ENDPOINT, { ...body, lang: UI_LANG });

// Frase para uma resposta que NÃO deu certo. 400/409 são recusas de negócio: o servidor manda a
// frase pronta, já no idioma pedido. Rede, 401 e 5xx usam as NOSSAS frases — o texto cru do
// servidor nesses casos é diagnóstico, não conversa com cliente.
const fraseDoErro = (r, padrao) => {
  if (!r) return padrao;
  if (r.http === 400 || r.http === 409) return (r.data && (r.data.note || r.data.error || r.data.erro)) || padrao;
  if (r.motivo) return fraseDaFalha(r.motivo);
  return padrao;
};

// O motivo de estar na fila é gravado pelo BANCO em português (db/quote_engine.sql). Os dois
// textos são fixos, então dá para reconhecer e dizer no idioma da tela; texto livre (motivo
// digitado numa recusa) passa como veio.
const motivoDaFila = (m, moeda) => {
  const t = String(m || "").trim();
  if (!t) return "";
  const teto = t.match(/^acima do teto de\s+([\d.,\s]+)$/i);
  if (teto) {
    const n = Number(teto[1].replace(/[^\d.,]/g, "").replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."));
    return `${tr("above your auto-send limit of")} ${Number.isFinite(n) ? money(Math.round(n * 100), moeda) : teto[1].trim()}`;
  }
  if (/pediu aprova[cç][aã]o em todo or[cç]amento/i.test(t)) return tr("you asked to approve every quote");
  return t;
};

// Moeda pelo IDIOMA da interface: "en-US" fixo dentro de uma tela em português já mostrou preço
// 5× errado nesta base. A moeda da linha manda no símbolo; o locale manda no formato.
const money = (cents, moeda = "usd") => {
  const v = Math.max(0, Number(cents) || 0) / 100;
  const loc = UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US";
  try { return new Intl.NumberFormat(loc, { style: "currency", currency: String(moeda || "usd").toUpperCase().slice(0, 3) }).format(v); }
  catch { return `$${v.toFixed(2)}`; }
};
const fmtWhen = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const loc = UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US";
  return d.toLocaleString(loc, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
const nomeItem = (it) => (it && (it.nome || it.name || it.descricao || it.description)) || "";
const centsItem = (it) => {
  const c = it && (it.valor_cents ?? it.preco_cents ?? it.total_cents ?? it.cents);
  return Number.isFinite(Number(c)) ? Number(c) : null;   // null = item SEM preço; nunca vira 0
};

// Exemplo (conta não conectada) — determinístico e crível, como nas abas vizinhas. Função, para
// sair no idioma da tela (era português fixo, com selo de exemplo em inglês por cima).
const demoFila = () => [
  { id: "demo-1", customer_name: "Marcus R.", customer_email: "marcus@email.com", resumo: tr("40-gallon water heater replacement + labor"),
    total_cents: 182000, moeda: "usd", motivo: "acima do teto de 800.00", created_at: new Date(Date.now() - 5.4e6).toISOString(),
    itens: [{ nome: tr("40-gallon water heater"), valor_cents: 122000 }, { nome: tr("Labor"), qtd: 2, valor_cents: 60000 }] },
  { id: "demo-2", customer_name: "Paula S.", customer_email: "paula@email.com", resumo: tr("Electrical rework for 2 bedrooms"),
    total_cents: 96500, moeda: "usd", motivo: "o negócio pediu aprovação em todo orçamento", created_at: new Date(Date.now() - 7.8e7).toISOString(),
    itens: [{ nome: tr("Materials"), valor_cents: 41500 }, { nome: tr("Installation"), valor_cents: 55000 }] },
];

function QuoteEngine({ V, real = null, email = "", dataKey = "" }) {
  const live = !!(real && email && dataKey);

  const [fila, setFila] = useState(null);        // null = carregando
  const [falha, setFalha] = useState(null);      // motivo da falha de LEITURA da fila (ou null)
  const [cfg, setCfg] = useState(null);          // { teto_cents, auto_enviar }
  const [tetoTxt, setTetoTxt] = useState("");
  const [busy, setBusy] = useState("");          // id em decisão
  const [aberto, setAberto] = useState(null);    // id com itens expandidos

  const carregar = useCallback(async () => {
    if (!live) { setFila(demoFila()); setCfg({ teto_cents: 80000, auto_enviar: true }); setTetoTxt("800"); setFalha(null); return; }
    setFila(null); setFalha(null);
    const [f, c] = await Promise.all([
      api({ action: "fila", email, token: dataKey }),
      api({ action: "config", email, token: dataKey }),
    ]);
    // `d?.fila || []` transformaria "não consegui ler" em "nenhum orçamento" — o diagnóstico falso
    // que já custou caro aqui. A lista só existe quando a resposta veio pronta E com a lista.
    if (!f.motivo && f.data && f.data.ready && Array.isArray(f.data.fila)) setFila(f.data.fila.filter(Boolean));
    else { setFila([]); setFalha(f.motivo || "resposta_estranha"); }
    const cd = c.data;
    if (!c.motivo && cd && cd.ready && cd.config) { setCfg(cd.config); setTetoTxt(String((Number(cd.config.teto_cents) || 0) / 100)); }
    else setCfg(null);
  }, [live, email, dataKey]);

  useEffect(() => { carregar(); }, [carregar]);

  const decidir = async (q, aprovar) => {
    if (!live) { toast(tr("Connect your account to approve real quotes.")); return; }
    setBusy(q.id);
    const r = await api({ action: "decidir", email, token: dataKey, id: q.id, aprovar });
    setBusy("");
    const d = r.data;
    if (r.motivo || !d || !d.decidido) {
      toast(fraseDoErro(r, tr("I couldn't record your decision. Nothing was sent.")));
      // 409 = já não está na fila (decidido em outra aba/aparelho): a linha some daqui também.
      if (r.http === 409) setFila((l) => (l || []).filter((x) => x.id !== q.id));
      return;
    }
    if (!aprovar) toast(tr("Quote declined — nothing was sent to the customer."));
    else if (d.enviado) toast(tr("Approved and sent ✓") + (d.marcado ? "" : ` · ${tr("record pending")}`));
    // Aprovado mas SEM canal: dizer "enviado" aqui seria a mentira mais cara da tela.
    else toast(`${tr("Approved — but the email did not go out:")} ${(d.bloqueios || []).map((b) => b && b.motivo).filter(Boolean).join(" · ") || tr("no channel available")}`);
    setFila((l) => (l || []).filter((x) => x.id !== q.id));
  };

  const salvarConfig = async (patch) => {
    if (!live) { toast(tr("Connect your account to change the limit.")); return; }
    const r = await api({ action: "config", email, token: dataKey, ...patch });
    const d = r.data;
    if (!r.motivo && d && d.ready && d.config) { setCfg(d.config); setTetoTxt(String((Number(d.config.teto_cents) || 0) / 100)); toast(tr("Saved ✓")); }
    else toast(fraseDoErro(r, tr("I couldn't save that. Nothing changed.")));
  };

  const salvarTeto = () => {
    const cents = Math.round(parseFloat((tetoTxt || "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) { toast(tr("Enter a valid amount.")); return; }
    salvarConfig({ teto_cents: cents });
  };

  const lista = fila || [];
  const teto = cfg ? money(cfg.teto_cents) : "—";

  return (
    <div className="space-y-5 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          <FaFileInvoiceDollar size={11} /> {tr("Quotes")}
          {live
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("The AI quotes; above your limit, you decide")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">
          {tr("A quote below your limit goes out on its own, under your brand. Above the limit it waits in this queue and only goes out after your one click.")}
        </p>
      </div>

      {!live && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Sample data — connect your account to see your real queue.")}
        </div>
      )}

      {/* Estado honesto: não consegui LER a fila. Não é "nada esperando" — é "não sei". */}
      {live && falha && <FalhaDeLeitura compacto motivo={falha} onRetry={carregar} titulo={tr("I couldn't read your quote queue just now.")} />}

      {/* ── AJUSTES: teto + auto-envio ── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaGear size={11} /> {tr("Approval rule")}</span>
          <span className="text-[11px] text-g-muted hidden sm:inline">{tr("current limit")}: {teto}</span>
        </div>
        <div className="px-5 py-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-g-muted">{tr("Send on its own up to")}</span>
            <span className="text-g-muted text-xs">$</span>
            <input value={tetoTxt} onChange={(e) => setTetoTxt(e.target.value)} inputMode="decimal" placeholder="800"
              className="w-24 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12px] text-g-word focus:border-g-gold/50 focus:outline-none" />
            <button onClick={salvarTeto} className="rounded-full border border-g-gold/35 bg-g-gold/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-gold/20 transition">{tr("Save")}</button>
          </div>
          <button
            onClick={() => salvarConfig({ auto: !(cfg && cfg.auto_enviar) })}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${cfg && cfg.auto_enviar ? "border-g-green/40 bg-g-green/10 text-g-word" : "border-white/15 bg-white/[0.04] text-g-muted hover:text-g-word"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg && cfg.auto_enviar ? "bg-g-green" : "bg-white/25"}`} />
            {cfg && cfg.auto_enviar ? tr("Auto-send is on") : tr("Everything goes through the queue")}
          </button>
          <span className="text-[11px] text-g-muted">{tr("Today quotes go out by email (SMS and WhatsApp join once the carriers and Meta approve).")}</span>
        </div>
      </Card>

      {/* ── A FILA ── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaFileInvoiceDollar size={11} /> {tr("Waiting for your approval")}</span>
          <span className="text-[11px] text-g-muted">{falha ? "—" : lista.length}</span>
        </div>
        {fila === null ? (
          <div className="px-5 py-6 text-[11px] text-g-muted">{tr("Loading…")}</div>
        ) : falha ? (
          <div className="px-5 py-6 text-[11px] text-g-muted">{fraseDaFalha(falha)}</div>
        ) : lista.length === 0 ? (
          <Empty icon="🧾" text={tr("Nothing waiting — quotes below your limit already went out on their own.")} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {lista.map((q, i) => (
              <div key={q.id || i} style={{ animationDelay: `${i * 40}ms` }} className="row-in px-5 py-3">
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <span className="grid place-items-center h-11 w-11 rounded-lg bg-white/[0.06] text-base shrink-0">🧾</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">
                      {q.customer_name || tr("Customer")} <span className="text-g-muted font-normal">· {q.customer_email || q.customer_phone || tr("no contact on file")}</span>
                    </div>
                    <div className="text-[11px] text-g-muted truncate">{q.resumo || ""}{q.created_at ? ` · ${fmtWhen(q.created_at)}` : ""}</div>
                    {/* POR QUE está na fila — sem isto o dono aprova no escuro. */}
                    {q.motivo ? <div className="text-[10px] font-bold text-g-gold mt-0.5 truncate">⚠ {motivoDaFila(q.motivo, q.moeda)}</div> : null}
                  </div>
                  <button onClick={() => setAberto(aberto === q.id ? null : q.id)}
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black whitespace-nowrap"
                    style={{ color: "#d6c29a", background: "#d6c29a1e", boxShadow: "inset 0 0 0 1px #d6c29a40" }}>
                    {money(q.total_cents, q.moeda)}
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => decidir(q, true)} disabled={busy === q.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-g-gold/90 px-3 py-1.5 text-[11px] font-black text-black hover:bg-g-gold transition disabled:opacity-50 whitespace-nowrap">
                      <FaCheck size={9} /> {busy === q.id ? tr("Sending…") : tr("Approve and send")}
                    </button>
                    <button onClick={() => decidir(q, false)} disabled={busy === q.id}
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition disabled:opacity-50">
                      <FaXmark size={9} /> {tr("Decline")}
                    </button>
                  </div>
                </div>
                {aberto === q.id && (
                  <div className="mt-2.5 ml-14 rounded-xl2 border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
                    {(Array.isArray(q.itens) ? q.itens : []).length === 0 ? (
                      <div className="text-[11px] text-g-muted">{tr("No itemized lines — just the total.")}</div>
                    ) : q.itens.filter(Boolean).map((it, j) => (
                      <div key={j} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.05] last:border-0">
                        <span className="text-xs text-g-word truncate">{nomeItem(it) || "—"}</span>
                        <span className="text-xs font-bold text-g-muted whitespace-nowrap">
                          {centsItem(it) == null ? tr("no price") : money(centsItem(it), q.moeda)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default QuoteEngine;
