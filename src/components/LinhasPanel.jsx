import { useState } from "react";

// AS LINHAS ATENDEM AGORA? — o botão que tira o dono da minha dependência.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE PAINEL EXISTE
// Em 2026-08-16 três mudanças minhas derrubaram a linha de voz — inclusive a do único cliente
// PAGANTE — e o Luis descobriu do único jeito que existia: discando. Ele ligou, caiu, me avisou,
// eu revertí, ele ligou de novo. Três vezes.
// Enquanto a única prova for a ligação dele, todo conserto meu tem o dono como cobaia. Este painel
// é a resposta: uma pergunta que ele faz sozinho, quando quiser, sem gastar minuto de voz e sem
// depender de eu estar aqui. É o que transforma "confio que arrumaram" em "eu conferi".
//
// LÊ O PROVEDOR, NÃO O NOSSO BANCO. `brain_version = 8` no Supabase significa que NÓS gravamos 8 —
// não que a ElevenLabs tenha. Entre um e outro existe um PATCH que pode ter falhado. O motor
// (/api/agente-prova) pergunta a quem manda no toque do telefone.
//
// ⚠️ TRÊS ESTADOS, NUNCA DOIS. "não deu para provar" (cinza) é diferente de "está bom" (verde) e
// de "caiu" (vermelho). Confundir os dois primeiros foi o erro-mãe do dia: uma lista vazia lida
// como "não achei" quando era "não li". Um painel que fica verde por não ter conseguido ler é
// pior que painel nenhum, porque desliga a desconfiança.
export default function LinhasPanel({ token }) {
  const [d, setD] = useState(null);      // { resumo, agentes } | { err } | null
  const [lendo, setLendo] = useState(false);

  const conferir = async () => {
    setLendo(true);
    try {
      const r = await fetch(`/api/agente-prova?token=${encodeURIComponent(token || "")}`);
      const j = await r.json().catch(() => ({}));
      // 404 = filtro não casou; 401 = senha; 502 = não li a frota. Nenhum deles é "tudo bem".
      if (!r.ok || j.error) { setD({ err: j.motivo || j.error || `falha (${r.status})` }); return; }
      setD(j);
    } catch { setD({ err: "erro de rede — não deu para perguntar ao provedor" }); }
    finally { setLendo(false); }
  };

  const resumo = d && !d.err ? d.resumo : null;
  // Cor do bloco de topo: verde só quando `ok === true`. `null` é CINZA, nunca verde.
  const cor = !resumo ? "text-g-muted"
    : resumo.ok === true ? "text-emerald-400"
    : resumo.ok === false ? "text-red-400" : "text-amber-400";

  return (
    <section className="rounded-xl3 border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-g-word">As linhas atendem agora?</h3>
          <p className="mt-0.5 text-[12.5px] text-g-muted">
            Pergunta direto ao provedor de voz. Não gasta ligação nem minuto.
          </p>
        </div>
        <button
          onClick={conferir}
          disabled={lendo}
          className="rounded-full bg-g-gold px-4 py-2 text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {lendo ? "conferindo…" : d ? "conferir de novo" : "conferir agora"}
        </button>
      </div>

      {d?.err && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {d.err}
        </p>
      )}

      {resumo && (
        <>
          <div className={`mt-4 text-[15px] font-bold ${cor}`}>
            {resumo.ok === true && `✅ ${resumo.atenderiam} de ${resumo.linhas} linha(s) atendendo`}
            {resumo.ok === false && `🔴 ${resumo.nao_atenderiam} linha(s) NÃO atenderiam agora`}
            {resumo.ok === null && "⚠️ não deu para provar — leitura incompleta, isto NÃO é um ok"}
            {resumo.sem_linha > 0 && (
              <span className="ml-2 text-[12.5px] font-normal text-g-muted">
                · {resumo.sem_linha} agente(s) sem número (não são linhas)
              </span>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {(d.agentes || []).map((a) => {
              // O ícone segue os MESMOS três estados do motor — o painel não reinterpreta nada.
              const icone = a.sem_linha ? "—" : a.atende_agora === true ? "✅" : a.atende_agora === false ? "🔴" : "⚠️";
              return (
                <div key={a.agente || a.cliente} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span>{icone}</span>
                    <span className="text-[13.5px] font-semibold text-g-word">{a.cliente}</span>
                    <span className="text-[12px] text-g-muted">{a.veredito}</span>
                  </div>
                  {/* O QUE FOI LIDO vem junto do defeito. Um diagnóstico sem a leitura ao lado é
                      uma acusação — e hoje uma acusação inventada já saiu de uma lista vazia. */}
                  {(a.derruba_a_ligacao || []).map((p, i) => (
                    <div key={`d${i}`} className="mt-1.5 text-[12.5px] text-red-300">
                      🚨 {p.o_que}
                      {p.lido?.campo && (
                        <div className="mt-0.5 font-mono text-[11px] text-g-muted">
                          {p.lido.campo} = {JSON.stringify(p.lido.valor)}
                        </div>
                      )}
                    </div>
                  ))}
                  {(a.degrada || []).map((p, i) => (
                    <div key={`g${i}`} className="mt-1 text-[12px] text-amber-300/90">⚠️ {p.o_que}</div>
                  ))}
                  {(a.nao_deu_pra_provar || []).map((p, i) => (
                    <div key={`n${i}`} className="mt-1 text-[12px] text-g-muted">❓ {p.chave}: {p.motivo}</div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
