import { useCallback, useEffect, useState } from "react";

/* ═══ 💰 ASSINATURAS & COBRANÇA — o /admin passa a ver o dinheiro recorrente ═══════════════════
   O que faltava e por quê:
   • MRR e CHURN não existiam em lugar nenhum do painel. O "Receita" somava eventos do feed; o
     razão da companhia é digitado à mão. Nenhum dos dois responde "quanto entra todo mês?".
   • Os VENCIDOS só existiam dentro do cron (dunning-sweep), em JSON, para quem soubesse dar curl.
   • Pausar um inadimplente exigia Stripe + Twilio na mão, sem rastro nenhum.

   🚨 DUAS LISTAS DE VENCIDOS, DE PROPÓSITO — e cada uma diz DE ONDE VEM. Elas medem coisas
   diferentes e vão divergir: o Stripe sabe da assinatura (`past_due` no provedor); o nosso banco
   sabe da COBRANÇA que falhou e nunca foi paga depois (dunning_candidates, já passada a carência).
   Um cliente pode estar numa e não na outra. Juntar as duas num número só seria inventar um total
   que nenhuma das duas fontes afirma.

   🚨 SEM CHAVE DO STRIPE O CARTÃO PEDE A CHAVE. Nunca "$0 de MRR" por falta de chave — esse é o
   mesmo engano do canal verde com token vencido. */

const OK = "#3E9468", ALERTA = "#f2b23e", RUIM = "#c8623c", MUDO = "#8A8578";
const dinheiro = (c) => "$" + (Number(c || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Cartao({ rot, valor, sub, cor }) {
  return (
    <div className="rounded-xl border border-g-line bg-white/[0.03] px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-g-muted">{rot}</div>
      <div className="mt-0.5 text-[19px] font-black tabular-nums" style={{ color: cor || "#EDE7DC" }}>{valor}</div>
      {sub && <div className="text-[10px] text-g-muted/80">{sub}</div>}
    </div>
  );
}

export default function AdminCobranca({ token }) {
  const [assin, setAssin] = useState(null);      // resposta da action "subscriptions"
  const [venc, setVenc] = useState(null);        // resposta da action "dunning_list"
  const [cfg, setCfg] = useState(null);          // resposta da action "settings"
  const [estado, setEstado] = useState("carregando");
  const [erro, setErro] = useState("");
  const [pausando, setPausando] = useState("");  // e-mail em curso
  const [msg, setMsg] = useState(null);          // { ok, texto }
  const [salvando, setSalvando] = useState("");

  const chamar = useCallback(async (body) => {
    const r = await fetch("/api/admin-comando", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...body }),
    });
    const j = await r.json().catch(() => null);
    return { http: r.status, ok: r.ok, j };
  }, [token]);

  const ler = useCallback(async () => {
    if (!token) return;
    setEstado("carregando"); setErro("");
    try {
      const [a, v, c] = await Promise.all([
        chamar({ action: "subscriptions" }), chamar({ action: "dunning_list" }), chamar({ action: "settings" }),
      ]);
      // ⚠️ CADA LEITURA TEM O SEU PRÓPRIO ESTADO. Um `&&` aqui faria uma falha sozinha virar
      // "está tudo zerado" — foi exatamente esse o defeito corrigido no CompanyFinance.
      if (!a.ok && !v.ok && !c.ok) { setEstado("err"); setErro((a.j && (a.j.motivo || a.j.error)) || `HTTP ${a.http}`); return; }
      setAssin(a.ok ? a.j : { ok: false, motivo: (a.j && (a.j.motivo || a.j.error)) || `HTTP ${a.http}` });
      setVenc(v.ok ? v.j : { ok: false, motivo: (v.j && (v.j.motivo || v.j.error)) || `HTTP ${v.http}` });
      setCfg(c.ok ? c.j : { ok: false, motivo: (c.j && (c.j.motivo || c.j.error)) || `HTTP ${c.http}` });
      setEstado("ok");
    } catch (e) { setEstado("err"); setErro(String(e).slice(0, 140)); }
  }, [token, chamar]);

  useEffect(() => { ler(); }, [ler]);

  // ⏸️ PAUSAR — a única tela do /admin que corta o faturamento de um cliente. Por isso:
  // motivo obrigatório, escolha explícita entre "fim do ciclo" e "agora", e o resultado volta
  // PASSO A PASSO (Stripe · tenant · rastro) — "pausado" sem dizer o que aconteceu no Stripe
  // seria exatamente o "ok sem comprovante" que já custou caro aqui.
  const pausar = async (email, rotulo) => {
    const motivo = window.prompt(`⏸️ Pausar ${rotulo || email} por inadimplência.\n\nEscreva o MOTIVO (fica no feed do cliente):`, "inadimplência");
    if (motivo === null || !motivo.trim()) return;
    const agora = window.confirm(
      `Cancelar a assinatura no Stripe AGORA?\n\nOK = cancela agora (para de faturar já; o cliente perde o acesso pago imediatamente).\nCancelar = cancela no FIM DO CICLO (ele usa o que já pagou).\n\nNos dois casos a Gui deixa de agir por ${email} e volta sozinha no próximo pagamento.`
    );
    setPausando(email); setMsg(null);
    try {
      const { ok, j } = await chamar({ action: "pause_client", email, motivo: motivo.trim(), modo: agora ? "agora" : "fim_do_ciclo" });
      if (!ok || !j) { setMsg({ ok: false, texto: (j && (j.motivo || j.error)) || "não consegui pausar" }); return; }
      const p = j.passos || {};
      setMsg({ ok: j.ok === true, texto: `${email} — Stripe: ${p.stripe} · Cliente: ${p.tenant} · Rastro: ${p.auditoria}` });
      await ler();
    } catch (e) { setMsg({ ok: false, texto: String(e).slice(0, 140) }); }
    finally { setPausando(""); }
  };

  const salvarRegra = async (key, value) => {
    setSalvando(key); setMsg(null);
    try {
      const { ok, j } = await chamar({ action: "settings_set", key, value });
      if (!ok || !j || j.ok !== true) { setMsg({ ok: false, texto: (j && (j.motivo || j.error)) || "o banco recusou" }); return; }
      setCfg(j);
      setMsg({ ok: true, texto: `regra ${key} = ${value} salva — vale no próximo ciclo do cron (a cada 15 min)` });
    } catch (e) { setMsg({ ok: false, texto: String(e).slice(0, 140) }); }
    finally { setSalvando(""); }
  };

  const LinhaVencido = ({ email, titulo, detalhe, cor }) => (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-g-line bg-white/[0.03] px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-g-word">{titulo}</div>
        <div className="text-[11px]" style={{ color: cor || MUDO }}>{detalhe}</div>
      </div>
      <button type="button" disabled={pausando === email} onClick={() => pausar(email, titulo)}
        className="min-h-[44px] shrink-0 rounded-full border px-3.5 text-[11.5px] font-bold disabled:opacity-50"
        style={{ borderColor: `${RUIM}66`, color: RUIM }}>
        {pausando === email ? "Pausando…" : "⏸️ Pausar por inadimplência"}
      </button>
    </div>
  );

  const campo = "min-h-[44px] w-24 rounded-lg border border-g-line bg-white/[0.05] px-2.5 text-[12.5px] text-g-word focus:outline-none";

  return (
    <div className="rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">💰 Assinaturas & cobrança</div>
          <p className="text-[12px] text-g-muted">MRR real, vencidos e churn — lidos da API do Stripe e do nosso banco, cada número com a fonte ao lado.</p>
        </div>
        <button type="button" onClick={ler} className="min-h-[44px] rounded-full border border-g-line px-4 text-[12px] font-bold text-g-muted hover:text-g-word">
          {estado === "carregando" ? "Lendo…" : "↻ Atualizar"}
        </button>
      </div>

      {estado === "err" && <div className="mt-3 rounded-xl border px-3 py-2 text-[12.5px]" style={{ borderColor: `${RUIM}55`, color: RUIM }}>Não consegui ler: {erro}</div>}

      {msg && (
        <div className="mt-3 rounded-xl border px-3 py-2 text-[12.5px]" style={{ borderColor: `${msg.ok ? OK : RUIM}55`, color: msg.ok ? OK : RUIM }}>
          {msg.ok ? "✅ " : "⛔ "}{msg.texto}
        </div>
      )}

      {/* ── MRR · VENCIDOS · CHURN ────────────────────────────────────────────────── */}
      {assin && assin.chave === false && (
        <div className="mt-4 rounded-xl border border-g-gold/40 bg-g-gold/[0.08] px-4 py-3 text-[12.5px] font-semibold text-g-gold">
          🔌 {assin.motivo}
        </div>
      )}
      {assin && assin.chave && assin.lido === false && (
        <div className="mt-4 rounded-xl border px-4 py-3 text-[12.5px]" style={{ borderColor: `${ALERTA}66`, color: ALERTA }}>
          ⚠️ A chave existe mas o Stripe não respondeu: {assin.motivo}. Isto <b>não</b> quer dizer MRR zero — quer dizer sem leitura.
        </div>
      )}
      {assin && assin.lido && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cartao rot="MRR real" valor={dinheiro(assin.mrr_cents)} sub="assinaturas ativas, normalizadas p/ mês" cor={OK} />
            <Cartao rot="Assinaturas ativas" valor={assin.ativas} sub="status=active no Stripe" cor="#5B9BD5" />
            <Cartao rot="Vencidos (Stripe)" valor={assin.past_due_lido ? (assin.past_due || []).length : "—"}
              sub={assin.past_due_lido ? "status=past_due" : "não consegui ler"} cor={(assin.past_due || []).length ? RUIM : MUDO} />
            <Cartao rot="Churn 30d" valor={assin.churn_30d == null ? "—" : assin.churn_30d}
              sub={assin.churn_lido ? "canceladas nos últimos 30 dias" : "não consegui ler"} cor={assin.churn_30d ? ALERTA : MUDO} />
          </div>
          {assin.motivo_parcial && <div className="mt-2 text-[11.5px]" style={{ color: ALERTA }}>⚠️ leitura parcial — {assin.motivo_parcial}</div>}

          {assin.past_due_lido && (assin.past_due || []).length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] font-black uppercase tracking-wide text-g-muted">Vencidos segundo o STRIPE (assinatura past_due)</div>
              <div className="mt-2 space-y-1.5">
                {assin.past_due.map((s) => (
                  <LinhaVencido key={s.id} email={s.email} titulo={s.nome || s.email || s.id}
                    cor={RUIM}
                    detalhe={`${s.email || "sem e-mail no Stripe"} · ${dinheiro(s.valor_cents)}/mês · ${s.dias == null ? "dias não medidos" : `${s.dias} dia(s) vencido`}`} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── VENCIDOS SEGUNDO O NOSSO BANCO (a MESMA lista que o cron dunning-sweep usa) ── */}
      <div className="mt-5">
        <div className="text-[11px] font-black uppercase tracking-wide text-g-muted">
          Vencidos segundo o NOSSO banco (dunning_candidates{venc && venc.grace ? ` · carência ${venc.grace}d` : ""})
        </div>
        {venc && venc.pronto === false && (
          <div className="mt-2 rounded-xl border px-3 py-2 text-[12px]" style={{ borderColor: `${ALERTA}55`, color: ALERTA }}>
            ⚠️ {venc.motivo || "lista indisponível"} — isto <b>não</b> é "nenhum inadimplente", é "não consegui ler".
          </div>
        )}
        {venc && venc.pronto && (venc.vencidos || []).length === 0 && (
          <p className="mt-2 text-[12.5px]" style={{ color: OK }}>Ninguém passou a carência. Nenhuma cobrança falhada em aberto.</p>
        )}
        {venc && venc.pronto && (venc.vencidos || []).length > 0 && (
          <div className="mt-2 space-y-1.5">
            {venc.vencidos.map((c) => (
              <LinhaVencido key={c.client_email} email={c.client_email} titulo={c.business_name || c.client_email}
                cor={RUIM}
                detalhe={`${c.client_email} · ${c.days_overdue} dia(s) sem pagar${c.last_amount ? ` · última cobrança ${c.last_amount}` : ""} · ${c.attempts} tentativa(s)`} />
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px]" style={{ color: MUDO }}>
          As duas listas medem coisas diferentes e podem divergir: o Stripe fala da ASSINATURA, o nosso banco fala da COBRANÇA que falhou e nunca foi paga depois. Por isso não há um total só.
        </p>
      </div>

      {/* ── ⚙️ REGRAS DE COBRANÇA ───────────────────────────────────────────────── */}
      <div className="mt-5 rounded-xl border border-g-line bg-white/[0.03] p-3.5">
        <div className="text-[11px] font-black uppercase tracking-wide text-g-muted">⚙️ Regras de cobrança</div>
        <p className="mt-1 text-[11.5px] text-g-muted">
          Editar aqui vale no próximo ciclo do cron. A variável do Cloudflare continua valendo como reserva — enquanto a linha estiver marcada <i>env</i>, é ela que manda.
        </p>
        {cfg && cfg.pronto === false && (
          <div className="mt-2 rounded-lg border px-3 py-2 text-[11.5px]" style={{ borderColor: `${ALERTA}55`, color: ALERTA }}>
            ⚠️ Tabela ainda não existe (aplique <span className="font-mono">db/platform_settings.sql</span>) — o que está abaixo é o valor da env, e salvar vai falhar até a paste.
          </div>
        )}
        {cfg && cfg.efetivo && (
          <div className="mt-3 space-y-2">
            {[
              ["dunning_enforce", "Cobrança automática ligada", "0 = só relatório (nada é enviado nem pausado) · 1 = o cron envia o aviso e pausa"],
              ["grace_days", "Dias de carência", "avisa a partir daqui; pausa no dobro"],
              // ✔️ RESOLVIDO 2026-08-25: o health-monitor agora lê platform_settings primeiro
              // Guardar aqui já vale como decisão registrada, mas só passa a mandar quando o
              // health-monitor ler o platform_settings (arquivo de outro dono nesta onda).
              ["silent_days", "Dias de silêncio", "cliente sem nenhum evento por N dias vira alerta (o health-monitor lê daqui; env é reserva)"],
              // 🤖 Nasceu no BANCO, sem env de reserva: ausente = 0 = desligada. Por isso a origem
              // aqui é "padrão", não "env" — dizer "env" sobre uma regra que não tem env seria
              // apontar o dono para uma variável do Cloudflare que não existe.
              ["auto_approve_paid", "Aprovação automática de cadastro pago", "cliente pagou e tem cadastro completo → a Gui nasce sozinha · número compartilhado ainda pede teu clique"],
            ].map(([k, rot, dica]) => {
              const noBanco = cfg.valores && cfg.valores[k] != null;
              const at = cfg.efetivo[k] || (noBanco
                ? { valor: String(cfg.valores[k]), origem: "banco" }
                : { valor: "0", origem: "padrão (desligado)" });
              return (
                <form key={k} className="flex flex-wrap items-center gap-2"
                  onSubmit={(e) => { e.preventDefault(); salvarRegra(k, new FormData(e.currentTarget).get("v")); }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-bold text-g-word">{rot}</div>
                    <div className="text-[11px] text-g-muted">{dica}</div>
                  </div>
                  <span className="rounded-full border border-g-line px-2 py-0.5 text-[10px] font-bold"
                    style={{ color: at.origem === "banco" ? OK : MUDO }}>{at.origem === "banco" ? "banco" : at.origem.startsWith("env") ? "env" : "padrão"}</span>
                  {(k === "dunning_enforce" || k === "auto_approve_paid") ? (
                    <select name="v" defaultValue={at.valor} className={campo}><option value="0">0 · só relatório</option><option value="1">1 · agindo</option></select>
                  ) : (
                    <input name="v" type="number" min="1" defaultValue={at.valor} className={campo} />
                  )}
                  <button className="min-h-[44px] rounded-full border px-3.5 text-[11.5px] font-bold disabled:opacity-50"
                    disabled={salvando === k} style={{ borderColor: `${OK}66`, color: OK }}>
                    {salvando === k ? "Salvando…" : "Salvar"}
                  </button>
                </form>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
