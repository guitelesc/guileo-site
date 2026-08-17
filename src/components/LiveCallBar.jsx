import { useState } from "react";
import { useLang } from "../i18n.jsx";
import mark from "../assets/guileo-mark.png";
import ConsentText from "./ConsentText.jsx";

// Compact "AI calls you" bar — drop it anywhere on the site.
// Captures the lead (/api/lead) and triggers the call (/api/call) if configured.
// `compacto` = a variante FLUTUANTE (barra fixa no rodapé do site).
// ⚠️ POR QUE PRECISOU DE VARIANTE, e não deu pra só embrulhar: (1) a raiz é `wrap py-8`, que é o
// container de PÁGINA — dentro de um elemento fixo ele briga com o envelope; (2) a frase longa
// vive num `flex-1 min-w-0`, que encolhe até ZERO, então ela empilhava uma palavra por linha e a
// faixa crescia até cobrir o herói. Alargar o envelope não resolveu porque o aperto é aqui dentro.
// No compacto a frase longa sai (numa barra fixa ela é ruído — o botão já diz o que acontece) e o
// bloco da esquerda para de poder encolher.
export default function LiveCallBar({ source = "callbar", compacto = false }) {
  const { t, lang } = useLang();
  const C = t.more.callbar;
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false); // TCPA — affirmative opt-in required before any automated call
  const [err, setErr] = useState(false);
  const [falha, setFalha] = useState("");  // motivo REAL da recusa, mostrado ao visitante
  const [st, setSt] = useState("idle"); // idle · calling · done

  const submit = async (e) => {
    e.preventDefault();
    if (!consent) { setErr(true); return; } // no automated call without prior express consent
    setErr(false);
    setSt("calling");
    // noCall:true → record the lead but don't double-dial; we trigger /api/call ourselves (which
    // enforces DNC + per-IP caps). consent is logged so it's never auto-called without opt-in.
    fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, source, consent, lang, noCall: true }) }).catch(() => {});
    // ⚠️ CONFERE A RESPOSTA. A 1ª versão fazia `await fetch(...)` sem ler nada e chamava
    // setSt("done") sempre — ou seja, dizia "a Gui vai te ligar" mesmo quando o portão RECUSOU
    // (DNC, teto diário, saldo baixo, agente sem número) ou quando a rede caiu. O visitante via
    // sucesso e o telefone nunca tocava. É a promessa sem lastro no pior lugar possível: o
    // primeiro contato de um cliente novo, que conclui que o produto não funciona.
    // Regra da casa: todo envio confere `ok` e mostra a falha real. (feedback_check_send_results)
    let ligou = false, motivo = "";
    try {
      const r = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }) });
      const d = await r.json().catch(() => ({}));
      ligou = r.ok && d.ok !== false;
      if (!ligou) motivo = (d.reason || d.error || `HTTP ${r.status}`).toString().slice(0, 80);
    } catch (e) { motivo = "rede"; }
    if (!ligou) { setSt("idle"); setErr(true); setFalha(motivo || "nao_deu"); return; }
    setSt("done");
  };

  return (
    <section className={compacto ? "" : "wrap py-8"}>
      <div className={`rounded-xl3 border border-white/25 bg-gradient-to-br from-white/[0.18] via-white/[0.10] to-g-green/[0.10] backdrop-blur-xl shadow-lift ${compacto ? "p-4" : "p-5 sm:p-6"} ${compacto ? "flex flex-col items-stretch gap-3" : "flex flex-col sm:flex-row items-center gap-4"}`}>
        <div className={`flex items-center gap-3 ${compacto ? "shrink-0" : "flex-1 min-w-0"}`}>
          <span className="grid place-items-center h-11 w-11 rounded-full bg-white/[0.06] border border-white/10 text-2xl shrink-0">🧑‍💼</span>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wide text-g-green inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-g-green/50 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" /></span>live
            </div>
            {!compacto && <div className="font-extrabold text-g-word leading-tight">{C.line}</div>}
          </div>
        </div>
        {st === "done" ? (
          <div className="rounded-full bg-g-green/15 border border-g-green/40 text-g-light px-5 py-3 text-sm font-semibold whitespace-nowrap">{C.done}</div>
        ) : (
          <form onSubmit={submit} className={`flex w-full flex-col gap-2 ${compacto ? "" : "sm:w-auto"}`}>
            {/* ⚠️ `min-w-0` NO INPUT E `shrink-0` NO BOTÃO — a armadilha clássica do flexbox, achada
                em 2026-08-17 no iPhone: dentro da barra flutuante (min(92vw,26rem) ≈ 345px) o BOTÃO
                PRINCIPAL saía CORTADO, lendo "Have G…". Item de flex nasce com `min-width:auto`, ou
                seja, nenhum dos dois aceita ficar menor que o próprio conteúdo: o placeholder
                "Your phone / WhatsApp" segura o input, o `whitespace-nowrap` segura o botão, a soma
                passa da largura e o excedente é cortado. `min-w-0` autoriza o input a ceder;
                `shrink-0` garante que quem cede é ele, nunca o botão.
                Vale dinheiro: é o botão que dispara a ligação — o único ato que a landing pede. */}
            <div className="flex w-full gap-2">
              <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={C.placeholder}
                className={`min-w-0 flex-1 ${compacto ? "" : "sm:w-52"} rounded-full border border-white/20 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition`} />
              <button disabled={st === "calling" || !consent} aria-label={C.cta}
                className="group relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-full border border-white/50 px-5 py-3 text-sm font-extrabold text-g-deep shadow-[0_3px_14px_rgba(0,0,0,0.4)] transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                style={{ background: "linear-gradient(180deg,#fbfbfd 0%,#dfe3e8 42%,#b7bfc8 52%,#dde1e6 70%,#f5f7f9 100%)" }}>
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-[900ms] group-hover:translate-x-full" />
                <img src={mark} alt="" className="relative h-4 w-4 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
                <span className="relative">{st === "calling" ? C.calling : C.cta}</span>
              </button>
            </div>
            {/* ⚠️ O CONSENTIMENTO NÃO PODE SUMIR ATRÁS DE UM LINK. A campanha A2P já foi REPROVADA
                por "opt-in information" (2026-08-03) e o revisor ABRE o site pra conferir o texto.
                O que muda no compacto é QUANDO ele aparece, não SE aparece: some enquanto a barra
                está em repouso e nasce assim que a pessoa começa a digitar o telefone — ou seja,
                sempre visível no instante da decisão, e sempre antes de qualquer ligação (o botão
                segue travado sem o check). Em 390px o parágrafo vira 4 linhas e engordava a faixa
                fixa sem que ninguém estivesse lendo ainda. */}
            {/* A RECUSA APARECE. Sem isto o conserto seria só interno: o visitante continuaria
                sem saber por que nada aconteceu. Mostra o caminho alternativo (ligar direto),
                porque um "não deu" sem saída é igual a um sucesso falso — os dois perdem o lead. */}
            {falha && (
              <div className="rounded-xl border border-g-gold/40 bg-g-gold/10 px-3 py-2 text-[11.5px] leading-snug text-g-gold">
                Não consegui disparar a ligação agora{falha && falha !== "nao_deu" ? ` (${falha})` : ""}.
                Tenta de novo em instantes — ou fala com a gente por{" "}
                <a href="https://wa.me/19298288170" className="underline font-bold">WhatsApp</a>.
              </div>
            )}
            <label className={`${compacto && !phone ? "hidden" : "flex"} items-start gap-2 text-[10px] leading-snug ${err && !consent ? "text-g-gold" : "text-g-muted"}`}>
              <input type="checkbox" required checked={consent} onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setErr(false); }} className="mt-0.5 shrink-0" />
              <span><ConsentText lang={lang} /></span>
            </label>
          </form>
        )}
      </div>
    </section>
  );
}
