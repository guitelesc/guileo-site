/* FalhaDeLeitura — o terceiro estado que faltava: CARREGANDO · FALHOU · VAZIO.

   POR QUE EXISTE (2026-09-28): trinta telas da Central tratavam "não consegui ler" como "não há
   nada". Um wifi caído virava "No invoices yet", "0 emergencies · 0 awaiting callback", "Nothing
   overdue — every invoice is on time". A primeira cliente pagante ia ler uma falha nossa como um
   fato do negócio dela. Aqui a falha tem cara própria, frase no idioma da tela e botão de tentar
   de novo — e a frase muda com o MOTIVO: chave errada é uma conversa, rede caída é outra.

   As frases ficam aqui (e não no portalApi.js) porque `tr()` mora no Portal.jsx e porque o teste
   de i18n só enxerga chave escrita como literal dentro de tr("…"). */
import { tr, Card } from "../pages/Portal.jsx";

/** Frase JÁ TRADUZIDA para um motivo de falha (rede | servidor | chave_invalida | sem_credencial |
 *  resposta_estranha). Motivo desconhecido cai na frase de servidor — nunca em texto cru. */
export function fraseDaFalha(motivo) {
  switch (motivo) {
    case "rede": return tr("I couldn't reach the server. Check your connection and try again.");
    case "chave_invalida": return tr("Your connection code didn't match. Check it in Settings, then try again.");
    case "sem_credencial": return tr("Connect your account in Settings to see this.");
    case "resposta_estranha": return tr("The server sent an answer I couldn't read. Try again in a moment.");
    default: return tr("Something failed on our side while reading this. Nothing was lost — try again in a moment.");
  }
}

/** Bloco de falha. `compacto` = uma linha dentro de um cartão que já existe. */
export default function FalhaDeLeitura({ motivo, onRetry, compacto = false, titulo }) {
  const botao = onRetry
    ? <button onClick={onRetry} className={compacto ? "rounded-full border border-g-gold/40 px-3 py-1 text-[11px] font-black text-g-gold hover:bg-g-gold/10 transition min-h-[36px]" : "btn-bright text-sm mt-4"}>{tr("↻ Try again")}</button>
    : null;
  if (compacto) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] px-3.5 py-2.5 text-[12px] text-g-word">
        <span className="min-w-0 flex-1"><b>{titulo || tr("I couldn't load this just now.")}</b> <span className="text-g-muted">{fraseDaFalha(motivo)}</span></span>
        {botao}
      </div>
    );
  }
  return (
    <Card className="text-center py-10">
      <div role="alert">
        <div className="text-2xl">📡</div>
        <div className="mt-2 text-sm font-bold text-g-word">{titulo || tr("I couldn't load this just now.")}</div>
        <div className="text-xs text-g-muted mt-0.5 max-w-md mx-auto">{fraseDaFalha(motivo)}</div>
        {botao}
      </div>
    </Card>
  );
}
