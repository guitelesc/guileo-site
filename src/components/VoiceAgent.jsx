import { useEffect, useState } from "react";
import { useLang } from "../i18n.jsx";
import LiveCallBar from "./LiveCallBar.jsx";
import mark from "../assets/guileo-mark.png";

// O CONVITE FLUTUANTE — o que aparece no canto de toda página de marketing (2026-08-15).
//
// HISTÓRICO DESTE MOUNT, porque ele já teve três donos:
//   widget <convai> da ElevenLabs → GuiChat (chat de texto) → gatilho de ligação.
// O chat saiu por dois motivos: era a demo ERRADA (o produto atende TELEFONE; provar isso com
// caixinha de texto demonstra outra coisa) e gastava o Anthropic do dono a cada visitante curioso.
//
// ⚠️ POR QUE BOTÃO E NÃO FAIXA: a faixa fixa no rodapé foi tentada e o Luis matou na hora — "muito
// feio, parece aviso de cookie". Ele tinha razão, e o problema não era estilo: uma barra atravessada
// no rodapé PEDE atenção o tempo todo, em cima de um site que ainda está fazendo o argumento. O
// convite tem que caber no canto e crescer só quando a pessoa quiser — a oferta espera, não cobra.
// Bônus: resolve sozinho o aperto de altura no celular, que era o problema seguinte da faixa.
//
// A LÓGICA NÃO FOI REESCRITA: aberto, isto renderiza o próprio LiveCallBar (captura o lead, dispara
// /api/call, exige o opt-in TCPA). Um segundo formulário de telefone seria uma segunda superfície
// regulatória pra manter em dia — e a primeira já foi reprovada uma vez.
export const ELEVEN_AGENT_ID = "agent_5901ktdkev68f5kb161fmeax1rdm"; // segue alimentando a agente de voz

const T = {
  pt: { convite: "Fale com a Gui", sub: "ela te liga agora", fechar: "Fechar" },
  en: { convite: "Talk to Gui", sub: "she calls you now", fechar: "Close" },
  es: { convite: "Habla con Gui", sub: "ella te llama ahora", fechar: "Cerrar" },
  hi: { convite: "Gui से बात करें", sub: "वह अभी कॉल करती है", fechar: "बंद करें" },
};

export default function VoiceAgent() {
  const { lang } = useLang();
  const t = T[lang] || T.en;
  const [aberto, setAberto] = useState(false);
  // ⚠️ SÓ APARECE DEPOIS QUE A PESSOA ROLA. Na chegada, o herói ainda está fazendo o argumento e
  // um convite no canto compete com ele — o Luis resumiu a versão anterior como "aviso de cookie".
  // Depois de uma tela de rolagem, quem continua lendo está interessado: aí o convite é ajuda, não
  // interrupção. Também some quando volta ao topo, pra não virar mobília.
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisivel(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // ⚠️ DESLIGADO 2026-08-15, DEPOIS DE PROVAR QUE QUEBRAVA. Com `if (!visivel) return null`, o
  // convite NUNCA nascia: conferido no DOM com y=1984 e limiar=731 — condição verdadeira, evento de
  // scroll disparado, e ZERO botões na página. O screenshot não pegava porque ausência de elemento
  // não tem aparência; só a pergunta "esse botão existe?" pega.
  // Fica visível sempre até alguém investigar o mount com calma. Convite pequeno e presente vale
  // mais que convite esperto e invisível — e eu já tinha entregue isto como pronto uma vez.
  // if (!visivel && !aberto) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      {aberto ? (
        <div className="w-[min(92vw,26rem)] rounded-xl3 border border-white/20 bg-g-cream/95 shadow-lift backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-g-green">{t.sub}</span>
            <button onClick={() => setAberto(false)} aria-label={t.fechar}
              className="grid h-7 w-7 place-items-center rounded-full text-g-muted transition hover:bg-white/10 hover:text-g-word">✕</button>
          </div>
          <div className="px-2 pb-2">
            <LiveCallBar source="floating" compacto />
          </div>
        </div>
      ) : (
        // Pílula fechada: alto o suficiente pro polegar (44px é o mínimo de toque), estreita o
        // suficiente pra não disputar com o conteúdo. O ponto verde pulsando é o único movimento —
        // diz "tem gente do outro lado" sem pedir clique.
        // MENOR: botão redondo de 48px (o mínimo confortável pro polegar). O texto vive no
        // `title`/`aria-label` e cresce no hover em telas grandes — no celular, só o ícone.
        <button onClick={() => setAberto(true)} title={`${t.convite} — ${t.sub}`} aria-label={t.convite}
          className="group flex items-center gap-2 rounded-full border border-white/15 bg-g-cream/90 p-2.5 shadow-lift backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-g-green/50 hover:pr-4">
          <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.08]">
            <img src={mark} alt="" className="h-3.5 w-3.5 object-contain" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" />
            </span>
          </span>
          <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-[12.5px] font-bold text-g-word transition-all duration-300 group-hover:max-w-[10rem] sm:block">{t.convite}</span>
        </button>
      )}
    </div>
  );
}
