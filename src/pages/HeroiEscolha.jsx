/* PÁGINA DE ESCOLHA DO HERÓI — /heroi
   ─────────────────────────────────────────────────────────────────────────────
   Existe para o Luis DECIDIR olhando, não imaginando. Duas direções de tema para a
   primeira dobra, cada uma resolvendo os mesmos seis defeitos por caminhos opostos.

   POR QUE É ROTA NOVA E NÃO EDIÇÃO DO HERÓI: rota que não existia não pode quebrar
   nada que está no ar. A landing continua intacta enquanto a decisão é tomada.

   O OBJETO CENTRAL é a LOGO REAL — `public/guileo-mark.png`, o mesmo arquivo do menu.
   Folhas orgânicas em cima, RAÍZES DE CIRCUITO embaixo: a marca já dizia "raiz = a
   máquina, folha = o resultado" antes de qualquer um de nós argumentar isso. O telefone
   ilustrado que está no ar hoje mostra um MOMENTO; a planta mostra ACÚMULO — que é o
   que a Guileo vende.

   DUAS TENTATIVAS ERRADAS ANTES DESTA, registradas para ninguém repetir:
     1. desenhei uma planta em SVG — genérica, jogava fora a ideia das raízes-circuito
        que a marca JÁ tinha;
     2. usei o `GuileoLogo3D` (309 linhas de three.js, existe e ninguém usa) — bonito,
        mas é uma RECRIAÇÃO da marca, não a marca. Fica guardado para quando fizer
        sentido um herói interativo; para reconhecimento, o arquivo real ganha sempre.
   Marca não se reinterpreta na primeira dobra. Na primeira dobra ela se reconhece.

   Depois de escolhida a direção, esta página vira o herói e a rota some. */

import PlantaColheita from "../components/PlantaColheita.jsx";

export default function HeroiEscolha() {
  return (
    <div style={{ background: "#FBFAF7", minHeight: "100vh", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      {/* ── explicação ── */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "56px 24px 30px" }}>
        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: ".14em",
          textTransform: "uppercase", color: "#6E675C", border: "1px solid #E3DDD1", borderRadius: 999,
          padding: "5px 12px", marginBottom: 18 }}>Guileo · decisão do herói</span>
        <h1 style={{ fontFamily: '"Didot","Bodoni 72",Georgia,serif', fontWeight: 400, color: "#2A2722",
          fontSize: "clamp(28px,4.4vw,44px)", lineHeight: 1.09, margin: "0 0 14px", maxWidth: 760 }}>
          A marca já tinha a imagem certa. Ela só nunca esteve na primeira dobra.
        </h1>
        <p style={{ color: "#6E675C", fontSize: 16, margin: "0 0 8px", maxWidth: 720 }}>
          Esta é a <b style={{ color: "#2A2722" }}>logo real</b> — o mesmo arquivo do menu, intocada: nada desenhado por cima.
          Folhas orgânicas em cima, <b style={{ color: "#2A2722" }}>raízes de circuito</b> embaixo. A marca já dizia
          “raiz é a máquina, folha é o resultado”.
        </p>
        <p style={{ color: "#6E675C", fontSize: 15, margin: 0, maxWidth: 720 }}>
          Em volta dela, <b style={{ color: "#2A2722" }}>o que estava preso dentro do telefone</b> — agendou, vendeu, orçou —
          agora orbitando na ordem da lavoura: 🌱 semeia · 💧 cuida · 📅 marca · 💰 colhe. Deixa de ser print de aplicativo
          e vira <b style={{ color: "#2A2722" }}>fruto</b> do que as raízes fizeram embaixo da terra.
        </p>
      </div>

      {/* ═══════════ A · PALCO ═══════════ */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "34px 24px 14px", borderTop: "1px solid #E3DDD1" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ fontFamily: '"Didot",Georgia,serif', fontSize: 38, color: "#9A9081" }}>A</span>
          <div>
            <h2 style={{ fontFamily: '"Didot",Georgia,serif', fontWeight: 400, fontSize: 29, margin: 0, color: "#2A2722" }}>Palco</h2>
            <p style={{ color: "#6E675C", fontSize: 15, margin: "2px 0 0", maxWidth: 660 }}>
              Continua escuro — mas para de ser escuro <i>por igual</i>. Um foco de luz cai sobre a manchete e a planta;
              o resto recua para a penumbra. É o registro Faena que você definiu.
            </p>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1180, margin: "0 auto 6px", padding: "0 24px" }}>
        <div style={{ border: "1px solid #E3DDD1", borderRadius: 18, overflow: "hidden" }}>
          <section style={{ background: "#100F0C", position: "relative", padding: "64px 0 70px", overflow: "hidden" }}>
            {/* UM foco de luz. É a ideia inteira: escuro por igual é chapado; escuro com um poço de luz é palco. */}
            <div aria-hidden style={{ position: "absolute", inset: "-30% -10% auto -10%", height: "120%", pointerEvents: "none",
              background: "radial-gradient(56% 46% at 33% 30%, rgba(214,194,154,.20) 0%, rgba(214,194,154,.06) 44%, transparent 72%)" }} />
            <div style={{ position: "relative", maxWidth: 1120, margin: "0 auto", padding: "0 46px",
              display: "grid", gridTemplateColumns: "1.12fr .88fr", gap: 44, alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase",
                  color: "#C2A878", margin: "0 0 22px" }}>Restaurantes · clínicas · salões · serviços — 16 idiomas, 24/7</p>
                {/* A manchete vira CRESCENDO: três frases em escala, só a última brilha.
                    Antes eram três iguais em três cores — quando tudo é destaque, nada é. */}
                <h3 style={{ fontFamily: '"Didot","Bodoni 72",Georgia,serif', fontWeight: 400, color: "#EDE7DC",
                  letterSpacing: "-.015em", fontSize: "clamp(35px,4.8vw,62px)", lineHeight: 1.05, margin: "0 0 22px" }}>
                  Every call answered.<br />Every lead worked.
                  <span style={{ display: "block", color: "#D6C29A" }}>Every month bigger.</span>
                </h3>
                <p style={{ color: "#C5BEB0", fontSize: 17, lineHeight: 1.62, maxWidth: 470, margin: "0 0 30px" }}>
                  A Gui atende, agenda, orça e cobra — e a gente traz o movimento que faz o telefone tocar.{" "}
                  <b style={{ color: "#EDE7DC", fontWeight: 600 }}>A AI é a prova. O que entregamos é crescimento.</b>
                </p>
                {/* ⚠️ ESTE BOTÃO ERA `href="#"` + preventDefault() — ou seja, NÃO FAZIA NADA, nas duas
                    variantes, bem no CTA principal. Botão morto é pior que botão ausente: a pessoa
                    clica, nada acontece, e conclui que o site está quebrado.
                    Agora aponta para `/#try` — a MESMA demo de voz ao vivo que a Home usa
                    (Home.jsx `<section id="try">` → `<LiveCall />`, o caminho provado com
                    consentimento TCPA + /api/lead + /api/call com portão de DNC). Nenhum segundo
                    caminho de lead foi criado: esta é uma página de DECISÃO de tema, o que ela
                    compara é o desenho do botão, não um formulário próprio. */}
                <a href="/#try" style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 48,
                  background: "#FF8A33", color: "#160E05", fontWeight: 800, fontSize: 15, padding: "15px 26px",
                  borderRadius: 999, textDecoration: "none", boxShadow: "0 10px 34px rgba(255,138,51,.30)" }}>
                  Ouça a Gui atender — agora
                </a>
                <p style={{ margin: "16px 0 0", color: "#948C7B", fontSize: 12.5 }}>Ligação real no seu telefone. Sem cadastro.</p>
              </div>
              <div style={{ position: "relative" }}>
                <PlantaColheita tema="escuro" altura={560} />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ═══════════ B · CREME ═══════════ */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 14px", borderTop: "1px solid #E3DDD1" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ fontFamily: '"Didot",Georgia,serif', fontSize: 38, color: "#9A9081" }}>B</span>
          <div>
            <h2 style={{ fontFamily: '"Didot",Georgia,serif', fontWeight: 400, fontSize: 29, margin: 0, color: "#2A2722" }}>Creme corajoso</h2>
            <p style={{ color: "#6E675C", fontSize: 15, margin: "2px 0 0", maxWidth: 660 }}>
              Todo site de AI do mundo é escuro com gradiente. Este vira claro, e o azeitona profundo passa a ser a cor
              do texto. Escopo de landing: não encosta no cimento do cockpit.
            </p>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ border: "1px solid #E3DDD1", borderRadius: 18, overflow: "hidden" }}>
          <section style={{ background: "#F4EFE5", position: "relative", padding: "64px 0 70px", overflow: "hidden" }}>
            <div aria-hidden style={{ position: "absolute", right: "-14%", top: "-34%", width: "60%", height: "150%",
              borderRadius: "50%", pointerEvents: "none",
              background: "radial-gradient(circle at 42% 42%, rgba(62,148,104,.16), transparent 66%)" }} />
            <div style={{ position: "relative", maxWidth: 1120, margin: "0 auto", padding: "0 46px",
              display: "grid", gridTemplateColumns: "1.18fr .82fr", gap: 40, alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".2em", textTransform: "uppercase",
                  color: "#6E6350", margin: "0 0 20px" }}>A agência de AI, mídia e criativo</p>
                {/* Aqui os TRÊS PILARES viram a manchete. Deixam de ser enfeite no rodapé do texto. */}
                <h3 style={{ fontWeight: 850, color: "#100F0C", fontSize: "clamp(37px,5.6vw,74px)",
                  lineHeight: .94, letterSpacing: "-.035em", margin: "0 0 20px" }}>
                  <span style={{ display: "block" }}>Performance.</span>
                  <span style={{ display: "block", color: "#FF8A33" }}>Vendas.</span>
                  <span style={{ display: "block", color: "#3E9468" }}>Crescimento.</span>
                </h3>
                <p style={{ color: "#4A4437", fontSize: 17.5, lineHeight: 1.6, maxWidth: 490, margin: "0 0 30px" }}>
                  A Gui atende 24/7, agenda e cobra. Os anúncios enchem a agenda. O criativo faz a marca aparecer.{" "}
                  <b style={{ color: "#100F0C", fontWeight: 700 }}>Um time inteiro, sem folha de pagamento.</b>
                </p>
                <a href="/#try" style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 48,
                  background: "#100F0C", color: "#F4EFE5", fontWeight: 800, fontSize: 15, padding: "15px 27px",
                  borderRadius: 12, textDecoration: "none", boxShadow: "0 12px 30px rgba(16,15,12,.22)" }}>
                  Ouça a Gui atender — agora
                </a>
                <p style={{ margin: "16px 0 0", color: "#7A7263", fontSize: 12.5 }}>Ligação real no seu telefone. Sem cadastro.</p>
              </div>
              <div style={{ position: "relative" }}>
                <PlantaColheita tema="claro" altura={560} />
              </div>
            </div>
          </section>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "34px 24px 70px", color: "#6E675C", fontSize: 14 }}>
        <p style={{ borderLeft: "2px solid #FF8A33", paddingLeft: 16, maxWidth: 720, margin: "0 0 18px" }}>
          <b style={{ color: "#2A2722" }}>Sem número inventado em nenhuma das duas.</b> A planta conta a história por
          forma, não por métrica de mentira — a mesma regra que tirou o “sucesso” falso do cockpit.
          Quando o volume justificar, as folhas passam a reagir ao evento <b style={{ color: "#2A2722" }}>real</b> de{" "}
          <code>client_events</code>: a dobra vira a única do mercado que cresce com trabalho de verdade.
        </p>
        <p style={{ maxWidth: 760, margin: 0 }}>
          <b style={{ color: "#2A2722" }}>Como escolher:</b> A vende <i>sensação</i> — chega como marca antes de chegar
          como serviço. B vende <i>clareza</i> — diz o que você faz em três palavras e destaca na categoria inteira.
        </p>
      </div>
    </div>
  );
}
