/* Orçamentos — o MOTOR DE ORÇAMENTO no cockpit (o módulo de $1.800/mês).
   A Gui monta o orçamento na ligação; o BANCO decide o destino (db/quote_engine.sql): abaixo do
   teto do negócio sai sozinho, acima dele espera esta tela. Aqui o dono aprova e o e-mail sai na
   marca DELE, ou recusa e nada sai.

   ⚠️ NÃO é o "Orçamento por foto" da aba Captura (lá o cliente manda foto e o dono põe o preço).

   Backend: POST /api/orcamento (actions fila · lista · decidir · config). Nenhuma chamada joga
   exceção na UI: sem conexão mostra exemplo, sem SQL colado mostra o aviso REAL (nunca uma lista
   vazia fingindo que está tudo calmo). Registrada pelo Portal na chave 'orcamentos'. */
import { useState, useEffect, useCallback } from "react";
import { FaFileInvoiceDollar, FaCheck, FaXmark, FaGear } from "react-icons/fa6";
import { toast } from "../lib/portalApi.js";
import { tr, Card, Empty, UI_LANG } from "../pages/Portal.jsx";

async function api(path, body) {
  try {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await r.json();           // 4xx também traz JSON útil ({error}) — não descartar
  } catch { return null; }
}

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

// Exemplo (conta não conectada) — determinístico e crível, como nas abas vizinhas.
const DEMO_FILA = [
  { id: "demo-1", customer_name: "Marcos R.", customer_email: "marcos@email.com", resumo: "Troca de aquecedor de 40L + mão de obra",
    total_cents: 182000, moeda: "usd", motivo: "acima do teto de 800.00", created_at: new Date(Date.now() - 5.4e6).toISOString(),
    itens: [{ nome: "Aquecedor 40L", valor_cents: 122000 }, { nome: "Mão de obra", qtd: 2, valor_cents: 60000 }] },
  { id: "demo-2", customer_name: "Paula S.", customer_email: "paula@email.com", resumo: "Reforma elétrica de 2 quartos",
    total_cents: 96500, moeda: "usd", motivo: "o negócio pediu aprovação em todo orçamento", created_at: new Date(Date.now() - 7.8e7).toISOString(),
    itens: [{ nome: "Material", valor_cents: 41500 }, { nome: "Instalação", valor_cents: 55000 }] },
];

function QuoteEngine({ V, real = null, email = "", dataKey = "" }) {
  const live = !!(real && email && dataKey);

  const [fila, setFila] = useState(null);        // null = carregando
  const [nota, setNota] = useState("");          // aviso honesto (SQL não colado / erro real)
  const [cfg, setCfg] = useState(null);          // { teto_cents, auto_enviar }
  const [tetoTxt, setTetoTxt] = useState("");
  const [busy, setBusy] = useState("");          // id em decisão
  const [aberto, setAberto] = useState(null);    // id com itens expandidos

  const carregar = useCallback(async () => {
    if (!live) { setFila(DEMO_FILA); setCfg({ teto_cents: 80000, auto_enviar: true }); setTetoTxt("800"); return; }
    const [f, c] = await Promise.all([
      api("/api/orcamento", { action: "fila", email, token: dataKey }),
      api("/api/orcamento", { action: "config", email, token: dataKey }),
    ]);
    // `d?.fila || []` transformaria "SQL não colado" em "nenhum orçamento" — o diagnóstico falso
    // que já custou caro aqui. Só zeramos a lista quando a resposta veio pronta (ready).
    if (f && f.ready) { setFila(Array.isArray(f.fila) ? f.fila : []); setNota(""); }
    else { setFila([]); setNota((f && f.note) || tr("Não consegui falar com o motor de orçamento agora.")); }
    if (c && c.ready && c.config) { setCfg(c.config); setTetoTxt(String((Number(c.config.teto_cents) || 0) / 100)); }
    else setCfg(null);
  }, [live, email, dataKey]);

  useEffect(() => { carregar(); }, [carregar]);

  const decidir = async (q, aprovar) => {
    if (!live) { toast(tr("Conecte sua conta para aprovar orçamentos reais.")); return; }
    setBusy(q.id);
    const d = await api("/api/orcamento", { action: "decidir", email, token: dataKey, id: q.id, aprovar, quem: email });
    setBusy("");
    if (!d || !d.decidido) { toast((d && (d.note || d.error)) || tr("Não consegui registrar a decisão.")); return; }
    if (!aprovar) toast(tr("Orçamento recusado — nada foi enviado ao cliente."));
    else if (d.enviado) toast(tr("Aprovado e enviado ✓") + (d.marcado ? "" : ` · ${tr("registro pendente")}`));
    // Aprovado mas SEM canal: dizer "enviado" aqui seria a mentira mais cara da tela.
    else toast(`${tr("Aprovado — mas o e-mail não saiu:")} ${(d.bloqueios || []).map((b) => b.motivo).join(" · ") || tr("sem canal disponível")}`);
    setFila((l) => (l || []).filter((x) => x.id !== q.id));
  };

  const salvarConfig = async (patch) => {
    if (!live) { toast(tr("Conecte sua conta para mudar o teto.")); return; }
    const d = await api("/api/orcamento", { action: "config", email, token: dataKey, ...patch });
    if (d && d.ready && d.config) { setCfg(d.config); setTetoTxt(String((Number(d.config.teto_cents) || 0) / 100)); toast(tr("Salvo ✓")); }
    else toast((d && d.note) || tr("Não consegui salvar."));
  };

  const salvarTeto = () => {
    const cents = Math.round(parseFloat((tetoTxt || "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) { toast(tr("Informe um valor válido.")); return; }
    salvarConfig({ teto_cents: cents });
  };

  const lista = fila || [];
  const teto = cfg ? money(cfg.teto_cents) : "—";

  return (
    <div className="space-y-5 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          <FaFileInvoiceDollar size={11} /> {tr("Orçamentos")}
          {live
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("A IA orça; acima do teto, você decide")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">
          {tr("Orçamento abaixo do teto sai sozinho na sua marca. Acima do teto entra nesta fila e só sai depois do seu 1 clique.")}
        </p>
      </div>

      {!live && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Dados de exemplo — conecte sua conta para ver a fila real.")}
        </div>
      )}

      {/* Estado honesto: o motor existe mas o banco ainda não foi ligado (ou caiu). */}
      {live && nota && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">{nota}</div>
      )}

      {/* ── AJUSTES: teto + auto-envio ── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaGear size={11} /> {tr("Regra de aprovação")}</span>
          <span className="text-[11px] text-g-muted hidden sm:inline">{tr("teto atual")}: {teto}</span>
        </div>
        <div className="px-5 py-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-g-muted">{tr("Enviar sozinho até")}</span>
            <span className="text-g-muted text-xs">$</span>
            <input value={tetoTxt} onChange={(e) => setTetoTxt(e.target.value)} inputMode="decimal" placeholder="800"
              className="w-24 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12px] text-g-word focus:border-g-gold/50 focus:outline-none" />
            <button onClick={salvarTeto} className="rounded-full border border-g-gold/35 bg-g-gold/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-gold/20 transition">{tr("Salvar")}</button>
          </div>
          <button
            onClick={() => salvarConfig({ auto: !(cfg && cfg.auto_enviar) })}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${cfg && cfg.auto_enviar ? "border-g-green/40 bg-g-green/10 text-g-word" : "border-white/15 bg-white/[0.04] text-g-muted hover:text-g-word"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg && cfg.auto_enviar ? "bg-g-green" : "bg-white/25"}`} />
            {cfg && cfg.auto_enviar ? tr("Envio automático ligado") : tr("Tudo passa pela fila")}
          </button>
          <span className="text-[11px] text-g-muted">{tr("Hoje o orçamento sai por e-mail (SMS e WhatsApp entram quando as operadoras/Meta aprovarem).")}</span>
        </div>
      </Card>

      {/* ── A FILA ── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaFileInvoiceDollar size={11} /> {tr("Esperando sua aprovação")}</span>
          <span className="text-[11px] text-g-muted">{lista.length}</span>
        </div>
        {fila === null ? (
          <div className="px-5 py-6 text-[11px] text-g-muted">{tr("Carregando…")}</div>
        ) : lista.length === 0 ? (
          <Empty icon="🧾" text={nota ? nota : tr("Nada esperando — os orçamentos abaixo do teto já saíram sozinhos.")} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {lista.map((q, i) => (
              <div key={q.id || i} style={{ animationDelay: `${i * 40}ms` }} className="row-in px-5 py-3">
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <span className="grid place-items-center h-11 w-11 rounded-lg bg-white/[0.06] text-base shrink-0">🧾</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">
                      {q.customer_name || tr("Cliente")} <span className="text-g-muted font-normal">· {q.customer_email || q.customer_phone || tr("sem contato")}</span>
                    </div>
                    <div className="text-[11px] text-g-muted truncate">{q.resumo || ""}{q.created_at ? ` · ${fmtWhen(q.created_at)}` : ""}</div>
                    {/* POR QUE está na fila — sem isto o dono aprova no escuro. */}
                    {q.motivo ? <div className="text-[10px] font-bold text-g-gold mt-0.5 truncate">⚠ {q.motivo}</div> : null}
                  </div>
                  <button onClick={() => setAberto(aberto === q.id ? null : q.id)}
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black whitespace-nowrap"
                    style={{ color: "#d6c29a", background: "#d6c29a1e", boxShadow: "inset 0 0 0 1px #d6c29a40" }}>
                    {money(q.total_cents, q.moeda)}
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => decidir(q, true)} disabled={busy === q.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-g-gold/90 px-3 py-1.5 text-[11px] font-black text-black hover:bg-g-gold transition disabled:opacity-50 whitespace-nowrap">
                      <FaCheck size={9} /> {busy === q.id ? tr("Enviando…") : tr("Aprovar e enviar")}
                    </button>
                    <button onClick={() => decidir(q, false)} disabled={busy === q.id}
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition disabled:opacity-50">
                      <FaXmark size={9} /> {tr("Recusar")}
                    </button>
                  </div>
                </div>
                {aberto === q.id && (
                  <div className="mt-2.5 ml-14 rounded-xl2 border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
                    {(Array.isArray(q.itens) ? q.itens : []).length === 0 ? (
                      <div className="text-[11px] text-g-muted">{tr("Sem itens detalhados — só o total.")}</div>
                    ) : q.itens.map((it, j) => (
                      <div key={j} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.05] last:border-0">
                        <span className="text-xs text-g-word truncate">{nomeItem(it) || "—"}</span>
                        <span className="text-xs font-bold text-g-muted whitespace-nowrap">
                          {centsItem(it) == null ? tr("sem preço") : money(centsItem(it), q.moeda)}
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
