import { useState } from "react";

// COMPRAR NÚMERO AVULSO — /admin.
//
// POR QUE EXISTE: `/api/provision-number` já existia, mas só era chamado dentro do fluxo de
// aprovar cliente novo. Para qualquer outro caso — um número de PROVA para registrar no
// WhatsApp Cloud, por exemplo — não havia caminho, e a saída natural seria comprar direto no
// painel da Twilio.
//
// ⚠️ E COMPRAR FORA DAQUI É O BUG. Em 2026-08-04 o `+14068000052` já tocava no agente da Natura
// e NÃO existia em `client_agents`, nem em `client_integrations`, nem em `provision_log`: o
// banco o considerava livre e a rota de provisionamento o entregaria a outro cliente como
// "ocioso". Número comprado fora do registro é número invisível.
//
// Este painel não afrouxa nada: mesma senha do /admin, mesmas 6 travas da rota (inclusive a
// confirmação explícita antes de gastar e a reserva atômica). Ele só dá o caminho de dentro.

export default function ComprarNumero({ token }) {
  const [email, setEmail] = useState("");
  const [ddd, setDdd] = useState("");
  const [estado, setEstado] = useState("idle"); // idle | olhando | confirmar | comprando | pronto
  const [previa, setPrevia] = useState(null);
  const [erro, setErro] = useState("");

  const chamar = async (confirm) => {
    setErro("");
    const r = await fetch("/api/provision-number", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email: email.trim().toLowerCase(), area_code: ddd, confirm }),
    });
    // A resposta CRUA decide. `r.ok` sozinho já deixou passar erro como sucesso antes
    // (o status HTTP não é a resposta — o corpo é).
    const d = await r.json().catch(() => null);
    if (!d) { setErro("resposta ilegível do servidor"); return null; }
    if (d.error) { setErro(String(d.error)); return null; }
    // `ok:false, blocked:...` é uma RECUSA das travas (não consigo verificar, teto do dia,
    // sem número na área). Sem este ramo ela cairia no caminho de sucesso e a tela diria
    // "comprado" sobre uma compra que não aconteceu.
    if (d.ok === false) { setErro(d.blocked ? `recusado: ${d.blocked}${d.note ? ` — ${d.note}` : ""}` : (d.note || "recusado")); return null; }
    return d;
  };

  const olhar = async () => {
    if (!email.trim()) { setErro("informe o e-mail que vai ficar dono do número"); return; }
    setEstado("olhando");
    const d = await chamar(false);
    if (!d) { setEstado("idle"); return; }
    if (d.already) { setPrevia(d); setEstado("pronto"); return; }
    setPrevia(d); setEstado("confirmar");
  };

  const comprar = async () => {
    setEstado("comprando");
    const d = await chamar(true);
    if (!d) { setEstado("confirmar"); return; }
    setPrevia(d); setEstado("pronto");
  };

  return (
    <div className="mt-8 rounded-2xl border border-g-line bg-white/[0.04] p-6">
      <div className="text-[15px] font-bold text-g-word">Comprar número</div>
      <p className="mt-1 text-[13px] leading-relaxed text-g-muted">
        Passa pelo registro da plataforma — número comprado direto na Twilio fica invisível para
        o sistema e pode ser entregue a outro cliente como se estivesse livre.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e-mail dono do número"
          className="rounded-xl border border-g-line bg-black/20 px-3 py-2 text-[14px] text-g-ink" />
        <input value={ddd} onChange={(e) => setDdd(e.target.value)} placeholder="DDD (ex: 929)" inputMode="numeric"
          className="rounded-xl border border-g-line bg-black/20 px-3 py-2 text-[14px] text-g-ink" />
      </div>

      {estado === "idle" || estado === "olhando" ? (
        <button onClick={olhar} disabled={estado === "olhando"}
          className="btn mt-4 inline-flex text-sm disabled:opacity-50">
          {estado === "olhando" ? "Procurando…" : "Ver o que dá"}
        </button>
      ) : null}

      {/* NADA É COMPRADO SEM ESTE PASSO. A trava 5 da rota exige confirm:true — a tela repete a
          exigência em vez de escondê-la, porque quem clica precisa ver o que vai gastar. */}
      {estado === "confirmar" && previa ? (
        <div className="mt-4 rounded-xl border border-g-line bg-black/20 p-4">
          <div className="text-[13.5px] text-g-ink">
            {previa.would_reuse
              ? <>Dá para <b>reusar</b> um número que a conta já tem: <b>{previa.would_reuse}</b> — custo zero.</>
              : <>Vai <b>comprar</b> um número novo{previa.would_buy ? <> (<b>{previa.would_buy}</b>)</> : null}
                  {typeof previa.cost_usd === "number" ? <> por <b>${previa.cost_usd}</b></> : null}. Isso gasta.</>}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={comprar} className="btn text-sm">Confirmar</button>
            <button onClick={() => setEstado("idle")} className="text-sm text-g-muted hover:underline">Cancelar</button>
          </div>
        </div>
      ) : null}

      {estado === "comprando" ? <div className="mt-4 text-[13.5px] text-g-muted">Comprando…</div> : null}

      {/* "ok" sem o número não é comprovante. Mostra o que existe agora, não "deu certo". */}
      {estado === "pronto" && previa ? (
        <div className="mt-4 rounded-xl border border-g-green/40 bg-g-green/10 p-4 text-[13.5px] text-g-ink">
          {previa.already
            ? <>Este e-mail <b>já tem</b> número: <b>{previa.number}</b>. Nada foi comprado.</>
            : <>Número: <b>{previa.number || "—"}</b>{previa.source === "reuse" ? " (reusado, custo zero)" : ""}.</>}
        </div>
      ) : null}

      {erro ? <div className="mt-4 text-[13px] text-g-red">{erro}</div> : null}
    </div>
  );
}
