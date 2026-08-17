import { useState } from "react";
import { useLang } from "../i18n.jsx";
import { Reveal, Stagger, Item } from "../lib/ui.jsx";
import { productsForPilar } from "../data/productSystem.js";

// PillarsProducts — the aligned product spine (Luis, 2026-07-24): the landing must MIRROR the real
// platform's three pillars, and the products must CORRESPOND to what the client actually buys, each
// tied to a RESULT and a VALUE. Replaces the old redundant WholePicture + flat ProductResults grid.
//   🧠 Guileo Brain — the AI employee (answers/books/sells/collects)         → recovers $/mo
//   📈 Guileo AD    — marketing that runs daily (hybrid: AI every day + a real team on the craft)
//   🏗️ Guileo Build — the foundation, built once (done-for-you by the team)
// Honesty (CLAUDE.md law): AD is explicitly HYBRID (AI + human team) — never "fully automated".
// Locked cement + neon-realista signal system; landing-scoped; Faena restraint (no loud motion).


// ── A LANDING VOLTOU A LER O SISTEMA (2026-08-11) ───────────────────────────────────────────────
// Antes, cada pilar trazia um `products: [...]` escrito à mão — e repetido nos QUATRO idiomas.
// Doze listas mantidas a dedo, contra dez produtos que já vivem traduzidos em productSystem.js.
// Elas já haviam divergido: o AD anunciava "Marketing · Ads · Content creation · Media management ·
// SEO · Email / CRM", seis nomes que não existem como produto em lugar nenhum da plataforma.
// Pior: `ProductResultsV2` — o componente que LÊ a fonte e faz do RESULTADO o herói — nem estava
// mais na Home. O sistema estava certo e o cliente via outra coisa.
// Agora o nome do produto vem de `productsForPilar(pilar)`; mudar um produto muda a landing
// sozinha, nos quatro idiomas, sem ninguém traduzir nada.
//
// ── E A RESERVA FOI EMBORA (mesma sessão, 2026-08-11) ──────────────────────────────────────────
// Numa primeira versão eu mantive as listas à mão como RESERVA, argumentando que "o pior caso é a
// lista antiga, não um vazio". Estava errado, e uma varredura no site inteiro mostrou por quê: a
// reserva guardava justamente "Gestão de mídia", "SEO" e "E-mail/CRM" — os três nomes que NÃO
// existem em produto nenhum. Ou seja, o pior caso não era "a lista antiga": era **a mentira
// voltando sozinha** no dia em que a fonte falhasse, sem ninguém notar.
// Reserva plausível é a mesma armadilha do coalesce que transforma erro em zero: some com o
// sintoma e preserva a causa. Agora um pilar sem produto na fonte renderiza VAZIO — alto e óbvio,
// como o preço que quebra o build em vez de publicar um valor fantasma.
// ── A ETIQUETA TEM QUE DIZER O QUE ELE FAZ, NÃO COMO SE CHAMA (2026-08-12) ─────────────────────
// Luis: «os produtos e serviços precisam ficar melhor na landing, está um pouco confuso».
// Estava — e a causa era concreta: sete etiquetas em fila com NOMES INTERNOS e zero significado.
// "Escudo Anti-falta" é um nome que existe para NÓS; o dono de salão não sabe o que é. Sete deles
// viram uma parede: acrescentam comprimento sem acrescentar entendimento, que é a definição de
// confuso. E os três cards ficavam 7 · 4 · 2, fazendo parecer que um pilar importa e dois sobram.
//
// A informação que faltava JÁ ESTAVA na fonte: todo produto carrega um `resultMetric`
// (+$2k–11k /mês recuperado · 21× mais conversões · −10–20% faltas). A landing mostrava só o nome
// e escondia o número — mostrando a parte que não vende e escondendo a que vende.
//
// TETO DE 4: acima disso o olho para de ler item e passa a ver "lista". O "+N" mantém a promessa
// honesta (o resto existe) sem transformar o card num inventário — e equilibra os três visualmente,
// que era metade da confusão.
const MAX_CHIPS = 4;
// Rótulo do estado aberto. Fora do dicionário grande de propósito: é a única string que nasceu
// com o botão, e mantê-la colada nele evita que a próxima pessoa mexa num sem lembrar do outro.
const MENOS = { en: "− less", pt: "− menos", es: "− menos", hi: "− कम" };
const produtosDoPilar = (pilar, lang, tudo = false) => {
  const todos = productsForPilar(pilar);
  const itens = (tudo ? todos : todos.slice(0, MAX_CHIPS)).map((p) => {
    const rm = p.resultMetric || {};
    const unidade = (rm.unit && (rm.unit[lang] || rm.unit.en)) || "";
    return {
      nome: (p.name && (p.name[lang] || p.name.en)) || "",
      valor: rm.value || "",
      // a unidade completa vira `title` — quem quiser o detalhe passa o mouse; quem só passa o
      // olho leva o número. Informação em camadas, não tudo gritando junto.
      detalhe: [rm.value, unidade].filter(Boolean).join(" "),
    };
  }).filter((x) => x.nome);
  return { itens, resto: Math.max(0, todos.length - itens.length) };
};

const P = {
  en: {
    eyebrow: "Three pillars · one system",
    h1a: "One AI + marketing team, ",
    h1b: "run as three pillars.",
    sub: "Not features — pillars. Each owns a job, delivers a result, and pays for itself.",
    hybrid: "AI every day · a real human team on the craft",
    ai: "AI-run · a human supervises",
    dfy: "Done-for-you by the Guileo team",
    resultLabel: "The result",
    pillars: [
      { pilar: "brain", badge: "Guileo Brain", icon: "🧠", accent: "#FF8A33", owns: "Your performance", line: "The AI employee that runs the front desk — answers every call & message, books, quotes, closes and collects. 24/7, 16 languages.", result: "+$2k–11k", unit: "/mo recovered", tone: "ai" },
      { pilar: "ad", badge: "Guileo AD", icon: "📈", accent: "#4C9AFF", owns: "Your growth", line: "Marketing that runs every day so you reach more people, close more deals and waste less ad money.", result: "More leads", unit: "· less wasted ad spend", tone: "hybrid" },
      { pilar: "build", badge: "Guileo Build", icon: "🏗️", accent: "#9AA0FF", owns: "Your foundation", line: "The websites, apps, store and software your whole operation runs on — built once, runs forever.", result: "1× build", unit: "· runs forever", tone: "dfy" },
    ],
  },
  pt: {
    eyebrow: "Três pilares · um sistema",
    h1a: "Um time de IA + marketing, ",
    h1b: "em três pilares.",
    sub: "Não são recursos — são pilares. Cada um tem um trabalho, entrega um resultado e se paga.",
    hybrid: "IA todo dia · um time humano na arte",
    ai: "IA opera · um humano supervisiona",
    dfy: "Feito pra você pelo time Guileo",
    resultLabel: "O resultado",
    pillars: [
      { pilar: "brain", badge: "Guileo Brain", icon: "🧠", accent: "#FF8A33", owns: "Sua performance", line: "O funcionário-IA que cuida da recepção — atende toda ligação e mensagem, agenda, orça, fecha e cobra. 24/7, 16 idiomas.", result: "+R$10k–55k", unit: "/mês recuperado", tone: "ai" },
      { pilar: "ad", badge: "Guileo AD", icon: "📈", accent: "#4C9AFF", owns: "Seu crescimento", line: "Marketing rodando todo dia pra você alcançar mais gente, fechar mais e desperdiçar menos em anúncio.", result: "Mais leads", unit: "· menos verba desperdiçada", tone: "hybrid" },
      { pilar: "build", badge: "Guileo Build", icon: "🏗️", accent: "#9AA0FF", owns: "Sua fundação", line: "Os sites, apps, loja e software onde toda a operação roda — construído uma vez, roda pra sempre.", result: "1× build", unit: "· roda pra sempre", tone: "dfy" },
    ],
  },
  es: {
    eyebrow: "Tres pilares · un sistema",
    h1a: "Un equipo de IA + marketing, ",
    h1b: "en tres pilares.",
    sub: "No son funciones — son pilares. Cada uno tiene un trabajo, entrega un resultado y se paga solo.",
    hybrid: "IA cada día · un equipo humano en el arte",
    ai: "IA opera · un humano supervisa",
    dfy: "Hecho para ti por el equipo Guileo",
    resultLabel: "El resultado",
    pillars: [
      { pilar: "brain", badge: "Guileo Brain", icon: "🧠", accent: "#FF8A33", owns: "Tu performance", line: "El empleado-IA que atiende la recepción — contesta cada llamada y mensaje, agenda, cotiza, cierra y cobra. 24/7, 16 idiomas.", result: "+$2k–11k", unit: "/mes recuperado", tone: "ai" },
      { pilar: "ad", badge: "Guileo AD", icon: "📈", accent: "#4C9AFF", owns: "Tu crecimiento", line: "Marketing corriendo cada día para llegar a más gente, cerrar más y desperdiciar menos en anuncios.", result: "Más leads", unit: "· menos gasto perdido", tone: "hybrid" },
      { pilar: "build", badge: "Guileo Build", icon: "🏗️", accent: "#9AA0FF", owns: "Tu base", line: "Las webs, apps, tienda y software donde corre toda tu operación — construido una vez, corre siempre.", result: "1× build", unit: "· corre siempre", tone: "dfy" },
    ],
  },
  hi: {
    eyebrow: "तीन स्तंभ · एक सिस्टम",
    h1a: "एक AI + मार्केटिंग टीम, ",
    h1b: "तीन स्तंभों में।",
    sub: "फ़ीचर नहीं — स्तंभ। हर एक का एक काम, एक नतीजा, और खुद की कीमत निकालता है।",
    hybrid: "रोज़ AI · कारीगरी पर असली मानव टीम",
    ai: "AI चलाता है · मानव निगरानी करता है",
    dfy: "Guileo टीम आपके लिए बनाती है",
    resultLabel: "नतीजा",
    pillars: [
      { pilar: "brain", badge: "Guileo Brain", icon: "🧠", accent: "#FF8A33", owns: "आपकी परफ़ॉर्मेंस", line: "AI कर्मचारी जो रिसेप्शन संभालता है — हर कॉल और मैसेज का जवाब, बुकिंग, कोटेशन, डील बंद और वसूली। 24/7, 16 भाषाएँ।", result: "+$2k–11k", unit: "/माह वापस", tone: "ai" },
      { pilar: "ad", badge: "Guileo AD", icon: "📈", accent: "#4C9AFF", owns: "आपकी ग्रोथ", line: "मार्केटिंग जो हर दिन चलती है — ज़्यादा लोगों तक पहुँच, ज़्यादा डील, कम विज्ञापन बर्बादी।", result: "ज़्यादा लीड", unit: "· कम बर्बादी", tone: "hybrid" },
      { pilar: "build", badge: "Guileo Build", icon: "🏗️", accent: "#9AA0FF", owns: "आपकी नींव", line: "वेबसाइट, ऐप, स्टोर और सॉफ़्टवेयर जिन पर पूरा ऑपरेशन चलता है — एक बार बनता है, हमेशा चलता है।", result: "1× बिल्ड", unit: "· हमेशा चलता है", tone: "dfy" },
    ],
  },
};

const hexToRgb = (hex) => {
  const h = (hex || "#FF8A33").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

export default function PillarsProducts() {
  const { lang } = useLang();
  const t = P[lang] || P.en;
  // Qual pilar está aberto (um por vez). Um-por-vez e não vários: com dois cards expandidos as
  // alturas divergem e a fileira perde o alinhamento do bloco 'O RESULTADO', que é o que ancora
  // a leitura horizontal dos três.
  const [aberto, setAberto] = useState(null);
  const toneLabel = (tone) => (tone === "hybrid" ? t.hybrid : tone === "dfy" ? t.dfy : t.ai);

  return (
    <section className="relative overflow-hidden px-5 py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(760px_380px_at_20%_-5%,rgba(255,138,51,0.07),transparent),radial-gradient(760px_380px_at_85%_105%,rgba(154,160,255,0.07),transparent)]" />
      <div className="mx-auto max-w-6xl">
        {/* header — champagne eyebrow → font-black h2 w/ ONE shimmer phrase → greige sub */}
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{t.eyebrow}</div>
          <h2 className="mt-4 font-black leading-[1.04] tracking-tight text-g-word" style={{ fontSize: "clamp(2rem,4.2vw,3rem)" }}>
            {t.h1a}
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "prshine 6s linear infinite" }}>{t.h1b}</span>
          </h2>
          {/* ── O SUBTÍTULO SAIU (Luis, 2026-08-12) ───────────────────────────────────────────
              Ele dizia "Não são recursos — são pilares. Cada um tem um trabalho, entrega um
              resultado e se paga." — uma frase que DISCUTE TAXONOMIA com quem só quer saber o que
              ganha. "Recurso × pilar" é uma distinção nossa, interna; o dono de salão não tem essa
              briga na cabeça, e ler sobre ela é trabalho sem recompensa bem no ponto em que ele
              deveria estar olhando os números.
              Somado às etiquetas que agora carregam o resultado (+$2k–11k, 21×, −10–20%), a seção
              passou a explicar-se sozinha: o título diz o quê, os cards dizem quanto. Uma frase que
              defende a estrutura em vez de mostrar o ganho é peso, não clareza.
              O texto continua em `t.sub` (os 4 idiomas) — se um dia fizer falta numa página onde
              explicar a estrutura SEJA o assunto, ele está aqui, não foi jogado fora. */}
        </Reveal>

        <style>{`@keyframes prshine{to{background-position:220% center}}`}</style>

        {/* three pillar columns */}
        <Stagger className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3" gap={0.1}>
          {t.pillars.map((p) => {
            const rgb = hexToRgb(p.accent);
            return (
              <Item key={p.badge} variant="up">
                <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur"
                  style={{ boxShadow: "0 22px 60px -34px rgba(0,0,0,0.9)" }}>
                  {/* accent top edge */}
                  <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.9),transparent)` }} />

                  {/* pillar identity */}
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[20px]" style={{ background: `rgba(${rgb},0.13)`, boxShadow: `inset 0 0 0 1px rgba(${rgb},0.4)`, filter: `drop-shadow(0 4px 12px rgba(${rgb},0.45))` }}>{p.icon}</span>
                    <div>
                      <div className="text-[15px] font-black tracking-tight" style={{ color: p.accent }}>{p.badge}</div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{p.owns}</div>
                    </div>
                  </div>

                  <p className="mt-4 text-[13px] leading-relaxed text-g-ink">{p.line}</p>

                  {/* the real products under this pillar */}
                  {/* ── O "+N" VIROU BOTÃO (2026-08-17) ────────────────────────────────────────
                      O Luis: «essa parte é a estrela do time, tem que estar perfeito» — e o pedido
                      maior do dia era que o cliente entendesse TODOS os serviços.
                      O "+3" trabalhava contra as duas coisas: dizia "existe mais" e não deixava ver,
                      um beco sem saída num card cuja função é justamente mostrar amplitude. Pior:
                      tem cara de botão (pílula, mesma família visual dos chips ao lado), então quem
                      clicava não recebia nada — e um clique sem resposta ensina a não clicar mais
                      nesta seção, inclusive nos chips que importam.
                      Agora abre no lugar, sem sair da página e sem navegação: um clique revela o
                      resto do pilar, outro recolhe. O teto de 4 continua sendo o estado de repouso
                      (acima disso o olho para de ler item e passa a ver "lista") — a diferença é que
                      agora é uma DOBRA, não um corte. */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(() => {
                      const { itens, resto } = produtosDoPilar(p.pilar, lang, aberto === p.pilar);
                      return (<>
                        {itens.map((it) => (
                          <span key={it.nome} title={it.detalhe} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold text-g-light" style={{ borderColor: `rgba(${rgb},0.3)`, background: `rgba(${rgb},0.07)` }}>
                            {it.nome}
                            {it.valor && <b className="font-black tabular-nums" style={{ color: `rgb(${rgb})` }}>{it.valor}</b>}
                          </span>
                        ))}
                        {(resto > 0 || aberto === p.pilar) && (
                          <button
                            type="button"
                            onClick={() => setAberto(aberto === p.pilar ? null : p.pilar)}
                            aria-expanded={aberto === p.pilar}
                            className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-g-muted transition hover:border-white/25 hover:text-g-word"
                          >
                            {aberto === p.pilar ? (MENOS[lang] || MENOS.en) : `+${resto}`}
                          </button>
                        )}
                      </>);
                    })()}
                  </div>

                  {/* honest delivery tag */}
                  <div className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10.5px] font-semibold text-g-muted ring-1 ring-white/10">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent, boxShadow: `0 0 7px ${p.accent}` }} />{toneLabel(p.tone)}
                  </div>

                  {/* the result — anchored at the foot */}
                  <div className="mt-auto pt-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-g-muted">{t.resultLabel}</div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="font-black leading-none tracking-tight tabular-nums" style={{ color: p.accent, fontSize: "clamp(1.6rem,3vw,2rem)", textShadow: `0 4px 22px rgba(${rgb},0.35)` }}>{p.result}</span>
                      <span className="text-[12px] font-semibold text-g-light/80">{p.unit}</span>
                    </div>
                  </div>
                </article>
              </Item>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
