/* A PLANTA E A COLHEITA — o objeto central do herói.
   ═════════════════════════════════════════════════════════════════════════════════════════
   No centro, a LOGO REAL (public/guileo-mark.png). Intocada: nada é desenhado por cima dela,
   nenhum filtro, nenhuma recriação. Marca na primeira dobra é para ser RECONHECIDA em meio
   segundo — uma reinterpretação, por melhor que seja, obriga o olho a perguntar "isso é a
   Guileo?", e essa pergunta custa a dobra inteira.

   EM VOLTA, a colheita. Estes são exatamente os itens que viviam presos dentro do telefone
   ilustrado — agendou, vendeu, orçou, avaliações. Tirando a moldura falsa de aplicativo e
   deixando-os ORBITAR a marca, a informação muda de significado: deixa de ser "print de um
   app" e vira FRUTO — resultado do que as raízes de circuito fizeram embaixo da terra.

   A ORDEM É O ARGUMENTO (semear → cuidar → colher):
     🌱 semeia   a ligação atendida — o lead que existiria e se perderia
     💧 cuida    o retorno, o lembrete, a memória do cliente
     📅 marca    o compromisso no calendário
     💰 colhe    o dinheiro que entrou
   Cada item aparece na sua vez, gira devagar e nunca cobre a planta — o raio da órbita é
   sempre maior que a largura dela.

   POR QUE ÓRBITA E NÃO LISTA: lista mostra o que o produto FAZ. Órbita mostra o que ele
   PRODUZ, e produz sem parar — que é a diferença entre uma ferramenta e uma colheita. */
import { useEffect, useState } from "react";

/* Os frutos. Texto curto de propósito: quem lê um herói lê em movimento, e chip que precisa
   de duas linhas vira parágrafo girando — ilegível e cansativo. */
export const FRUTOS = [
  { emoji: "🌱", titulo: "Ligação atendida", nota: "24/7, no idioma dela" },
  { emoji: "💧", titulo: "Retorno enviado",  nota: "ninguém fica sem resposta" },
  { emoji: "📅", titulo: "Agendado",         nota: "sábado, 15:00" },
  { emoji: "💰", titulo: "Venda registrada", nota: "$85 · pago no link" },
  { emoji: "📄", titulo: "Orçamento enviado", nota: "reforma · $4.200" },
  { emoji: "⭐", titulo: "Avaliação 5 estrelas", nota: "pedida na hora certa" },
];

export default function PlantaColheita({ tema = "escuro", altura = 560, logo = "/guileo-mark-2k.png" }) {
  const escuro = tema === "escuro";
  // `nascidos` cresce com o tempo: os frutos entram UM DE CADA VEZ, na ordem da lavoura.
  // Se todos entrassem juntos seria um enfeite; entrando em sequência, vira colheita.
  const [nascidos, setNascidos] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setNascidos(FRUTOS.length); return; }
    const t = FRUTOS.map((_, i) => setTimeout(() => setNascidos((n) => Math.max(n, i + 1)), 1500 + i * 520));
    return () => t.forEach(clearTimeout);
  }, []);

  const R = 44;                        // raio da órbita em % — SEMPRE maior que a planta (36%)
  const cor = escuro
    ? { chip: "rgba(28,26,22,.82)", borda: "rgba(214,194,154,.26)", titulo: "#EDE7DC", nota: "#948C7B", sombra: "0 14px 34px rgba(0,0,0,.45)" }
    : { chip: "rgba(255,255,255,.92)", borda: "rgba(140,125,95,.20)", titulo: "#211F1A", nota: "#7A7263", sombra: "0 14px 30px rgba(90,76,48,.16)" };

  return (
    <div style={{ position: "relative", width: "100%", height: altura, display: "grid", placeItems: "center" }}>
      <style>{CSS}</style>

      {/* o canteiro: as raízes da marca são douradas e sumiriam sobre o creme */}
      <div aria-hidden className="pc-canteiro" style={{
        background: escuro
          ? "radial-gradient(ellipse at 50% 62%, rgba(214,194,154,.14) 0%, transparent 66%)"
          : "radial-gradient(ellipse at 50% 62%, rgba(38,34,26,.15) 0%, transparent 68%)" }} />

      {/* ── A MARCA, intocada ──
          O 1200px veio de uma ampliação por IA do arquivo original. Antes de aceitar, medi:
          4,4% de diferença média no desenho, e a transparência foi REPOSTA a partir do alfa
          do original — o ampliador tinha devolvido fundo sólido, que viraria um quadrado
          branco sobre o palco escuro. A forma é a do arquivo verdadeiro; a IA só refinou o
          interior. WEBP (184KB) com PNG de reserva: numa dobra, 500KB de logo é imposto que
          o visitante paga antes de ler a primeira palavra. */}
      <picture>
        <source srcSet="/guileo-mark-2k.webp" type="image/webp" />
        <img className="pc-logo" src={logo} width="1200" height="1200" alt="Guileo"
             style={{ width: "min(72%," + Math.round(altura * 0.72) + "px)", height: "auto" }} />
      </picture>

      {/* ── A COLHEITA, em volta ── */}
      <div className="pc-orbita" aria-hidden>
        {FRUTOS.map((f, i) => {
          // distribuídos no arco de cima (−140° a +140°), pulando a base onde ficam as raízes:
          // fruto sobre a raiz contradiz a própria ideia — colheita é acima da terra.
          const ang = (-140 + (280 / (FRUTOS.length - 1)) * i) * (Math.PI / 180);
          const x = 50 + Math.sin(ang) * R;
          const y = 50 - Math.cos(ang) * (R * 0.86);
          return (
            <div key={f.titulo} className={"pc-fruto" + (i < nascidos ? " pc-on" : "")}
                 style={{ left: x + "%", top: y + "%", animationDelay: (i * 0.9) + "s",
                          background: cor.chip, borderColor: cor.borda, boxShadow: cor.sombra }}>
              <span className="pc-emoji">{f.emoji}</span>
              <span className="pc-txt">
                <b style={{ color: cor.titulo }}>{f.titulo}</b>
                <i style={{ color: cor.nota }}>{f.nota}</i>
              </span>
            </div>
          );
        })}
      </div>

      {/* nomeia o que está embaixo da terra — sem isto a planta é bonita e muda */}
      <p className="pc-raiz" style={{ color: escuro ? "#6F6757" : "#9A9081" }}>
        raízes · CRM · agenda · cobrança · memória · anúncios
      </p>
    </div>
  );
}

const CSS = `
.pc-canteiro{position:absolute;left:50%;top:56%;width:88%;height:46%;transform:translateX(-50%);
  border-radius:50%;pointer-events:none}
/* a marca cresce DE BAIXO PARA CIMA: raiz primeiro, folha por último — a ordem verdadeira,
   porque a plataforma existe antes do resultado. Depois só respira. */
.pc-logo{position:relative;z-index:2;display:block;
  animation:pcCresce 2.1s .2s cubic-bezier(.4,0,.2,1) both, pcRespira 8s 2.4s ease-in-out infinite;
  filter:drop-shadow(0 20px 44px rgba(0,0,0,.32))}
@keyframes pcCresce{from{clip-path:inset(100% 0 0 0);opacity:.15}to{clip-path:inset(0 0 0 0);opacity:1}}
@keyframes pcRespira{0%,100%{transform:rotate(-.7deg) translateY(0)}50%{transform:rotate(.7deg) translateY(-6px)}}

.pc-orbita{position:absolute;inset:0;z-index:3;pointer-events:none}
.pc-fruto{position:absolute;transform:translate(-50%,-50%) scale(.82);opacity:0;
  display:flex;align-items:center;gap:9px;white-space:nowrap;
  border:1px solid;border-radius:999px;padding:8px 14px 8px 11px;
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  transition:opacity .7s cubic-bezier(.4,0,.2,1), transform .7s cubic-bezier(.34,1.4,.5,1)}
.pc-fruto.pc-on{opacity:1;transform:translate(-50%,-50%) scale(1);
  animation:pcFlutua 6.5s ease-in-out infinite}
@keyframes pcFlutua{0%,100%{margin-top:0}50%{margin-top:-9px}}
.pc-emoji{font-size:17px;line-height:1}
.pc-txt{display:flex;flex-direction:column;line-height:1.25}
.pc-txt b{font-size:12.5px;font-weight:700;letter-spacing:-.01em}
.pc-txt i{font-size:10.5px;font-style:normal;font-weight:600}
.pc-raiz{position:absolute;bottom:2px;left:0;right:0;text-align:center;margin:0;
  font-size:10.5px;letter-spacing:.15em;text-transform:uppercase}

/* Em tela estreita os chips se atropelariam em cima da planta. Aqui eles saem da órbita e
   viram uma coluna embaixo — a mesma informação, sem virar sopa. */
@media(max-width:900px){
  .pc-orbita{position:static;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:14px}
  .pc-fruto{position:static!important;left:auto!important;top:auto!important;transform:scale(1)!important}
  .pc-fruto.pc-on{animation:none;transform:scale(1)!important}
}
@media (prefers-reduced-motion:reduce){
  .pc-logo{animation:none;clip-path:none}
  .pc-fruto,.pc-fruto.pc-on{animation:none;transition:none;opacity:1;transform:translate(-50%,-50%)}
}
`;
