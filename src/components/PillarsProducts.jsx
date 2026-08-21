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
//
// ── UMA PALETA SÓ PARA OS TRÊS PILARES (2026-08-17, Luis) ──────────────────────────────────────
// O site tinha DUAS paletas para os MESMOS três pilares: aqui era laranja/azul/violeta, e o LegsV2
// — a seção logo acima, com o cérebro, o gráfico e o foguete — usava verde/champanhe/cobre.
// Duas cores para a mesma coisa é o mesmo defeito do "Performance→Sales→Growth" vs "Brain·AD·Build"
// que arrumei hoje, só que na camada visual: a pessoa rola de uma seção para a outra e não sabe
// que está vendo o mesmo Brain. Cor é nome sem palavra — trocar a cor troca o nome.
// Venceu a paleta do LegsV2 (a que o Luis apontou): ela é a família quente do resto da marca,
// enquanto o azul/violeta vinha de outro lugar e brigava com o cimento.
//   Brain #3E9468 (rgb 62,148,104) · AD #D6C29A (214,194,154) · Build #BE7F35 (190,127,53)
//
// ⚠️ O BUILD FOI ESCURECIDO (2026-08-17, 2ª passada). Copiar a paleta do LegsV2 ao pé da letra
// dava Build #C2A878 (194,168,120) — a DISTÂNCIA 47 do champanhe do AD no espaço RGB, ou seja,
// perceptualmente a mesma cor. No LegsV2 isso não incomoda porque os três ficam longe um do outro,
// com ilustração grande separando; aqui os três cards são LADO A LADO e o do meio e o da direita
// liam como um só — o Luis olhou e perguntou "cadê as cores".
// O cobre novo foi escolhido por MEDIÇÃO, não por gosto: distância 124 do AD (era 47), 139 do
// verde do Brain, e contraste 5.46 contra o cimento #161512 — acima do mínimo de 4.5 da WCAG AA,
// que importa porque este é o NOME do pilar, a coisa que a página inteira quer que grude.


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
// ⚠️ HISTÓRICO: o Brain exibia "+$2k–11k /mês recuperado" (e "+R$10k–55k" no pt). REMOVIDO em
// 2026-08-20: era a ÚNICA perna com cifra, e sem premissa nenhuma. Os irmãos vendem sem número —
// AD diz "mais leads", Build diz "1× build" — e a pesquisa de vendas confirmou que enquadramento
// de valor sem lastro tem efeito quase nulo (r=.03); o que convence é o FATO MEDIDO. O número
// medido de verdade vive no relatório X-Ray de CADA cliente, com a premissa escrita ao lado.
// Se alguém quiser cifra aqui de novo, ela precisa de premissa na mesma linha.
// (histórico: +$2k–11k /mês recuperado · 21× mais conversões · −10–20% faltas). A landing mostrava só o nome
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

// ⚠️ EXPORTADO (2026-08-18): o Growth Report (/apresentacao/:id) espelha os TRÊS PILARES com as
// MESMAS palavras — Luis: "padrão no nível da landing, com o mesmo design". Reescrever badge,
// "owns" e a linha de cada pilar num segundo arquivo é a armadilha que este arquivo inteiro
// documenta (a lista à mão que divergiu da fonte e passou a prometer serviço inexistente).
// A landing continua sendo a fonte da PALAVRA; o relatório só troca a cor pelo accent do cliente
// e acrescenta os números MEDIDOS daquele negócio embaixo de cada pilar.
export const PILLAR_COPY = {
  en: {
    eyebrow: "Three pillars · one system",
    h1a: "Your conversations became ",
    h1b: "your most valuable asset.",
    sub: "Not features — pillars. Each owns a job, delivers a result, and pays for itself.",
    hybrid: "AI every day · a real human team on the craft",
    ai: "AI-run · a human supervises",
    dfy: "Done-for-you by the Guileo team",
    resultLabel: "The result",
    wins: {"brain": ["Every call & message answered", "More bookings, fewer no-shows", "Lapsed clients won back"], "ad": ["More leads, every channel", "More 5-star reviews", "Birthday & win-back reminders"], "build": ["A site that books & sells", "Your own app & online store", "Everything on autopilot"]},
    pillars: [
      { pilar: "brain", badge: "Guileo Brain", icon: "🧠", accent: "#3E9468", owns: "Your performance", line: "The AI employee that runs the front desk — answers every call & message, books, quotes, closes and collects. 24/7, 16 languages.", result: "Every call answered", unit: "· 24/7, no busy signal", tone: "ai" },
      { pilar: "ad", badge: "Guileo AD", icon: "📈", accent: "#D6C29A", owns: "Your growth", line: "Marketing that runs every day so you reach more people, close more deals and waste less ad money.", result: "More leads", unit: "· less wasted ad spend", tone: "hybrid" },
      { pilar: "build", badge: "Guileo Build", icon: "🏗️", accent: "#BE7F35", owns: "Your foundation", line: "The websites, apps, store and software your whole operation runs on — built once, runs forever.", result: "1× build", unit: "· runs forever", tone: "dfy" },
    ],
  },
  pt: {
    eyebrow: "Três pilares · um sistema",
    h1a: "Suas conversas viraram ",
    h1b: "seu ativo mais valioso.",
    sub: "Não são recursos — são pilares. Cada um tem um trabalho, entrega um resultado e se paga.",
    hybrid: "IA todo dia · um time humano na arte",
    ai: "IA opera · um humano supervisiona",
    dfy: "Feito pra você pelo time Guileo",
    resultLabel: "O resultado",
    wins: {"brain": ["Toda ligação e mensagem atendida", "Mais agendamentos, menos faltas", "Clientes sumidos de volta"], "ad": ["Mais leads, em todo canal", "Mais avaliações 5 estrelas", "Lembrete de aniversário e retorno"], "build": ["Um site que agenda e vende", "Seu app e loja online", "Tudo no piloto automático"]},
    pillars: [
      { pilar: "brain", badge: "Guileo Brain", icon: "🧠", accent: "#3E9468", owns: "Sua performance", line: "O funcionário-IA que cuida da recepção — atende toda ligação e mensagem, agenda, orça, fecha e cobra. 24/7, 16 idiomas.", result: "Toda ligação atendida", unit: "· 24/7, sem dar ocupado", tone: "ai" },
      { pilar: "ad", badge: "Guileo AD", icon: "📈", accent: "#D6C29A", owns: "Seu crescimento", line: "Marketing rodando todo dia pra você alcançar mais gente, fechar mais e desperdiçar menos em anúncio.", result: "Mais leads", unit: "· menos verba desperdiçada", tone: "hybrid" },
      { pilar: "build", badge: "Guileo Build", icon: "🏗️", accent: "#BE7F35", owns: "Sua fundação", line: "Os sites, apps, loja e software onde toda a operação roda — construído uma vez, roda pra sempre.", result: "1× build", unit: "· roda pra sempre", tone: "dfy" },
    ],
  },
  es: {
    eyebrow: "Tres pilares · un sistema",
    h1a: "Tus conversaciones se volvieron ",
    h1b: "tu activo más valioso.",
    sub: "No son funciones — son pilares. Cada uno tiene un trabajo, entrega un resultado y se paga solo.",
    hybrid: "IA cada día · un equipo humano en el arte",
    ai: "IA opera · un humano supervisa",
    dfy: "Hecho para ti por el equipo Guileo",
    resultLabel: "El resultado",
    wins: {"brain": ["Cada llamada y mensaje atendido", "Más reservas, menos ausencias", "Clientes perdidos recuperados"], "ad": ["Más leads, en todo canal", "Más reseñas 5 estrellas", "Recordatorio de cumpleaños y retorno"], "build": ["Un sitio que agenda y vende", "Tu app y tienda online", "Todo en piloto automático"]},
    pillars: [
      { pilar: "brain", badge: "Guileo Brain", icon: "🧠", accent: "#3E9468", owns: "Tu performance", line: "El empleado-IA que atiende la recepción — contesta cada llamada y mensaje, agenda, cotiza, cierra y cobra. 24/7, 16 idiomas.", result: "Cada llamada atendida", unit: "· 24/7, sin dar ocupado", tone: "ai" },
      { pilar: "ad", badge: "Guileo AD", icon: "📈", accent: "#D6C29A", owns: "Tu crecimiento", line: "Marketing corriendo cada día para llegar a más gente, cerrar más y desperdiciar menos en anuncios.", result: "Más leads", unit: "· menos gasto perdido", tone: "hybrid" },
      { pilar: "build", badge: "Guileo Build", icon: "🏗️", accent: "#BE7F35", owns: "Tu base", line: "Las webs, apps, tienda y software donde corre toda tu operación — construido una vez, corre siempre.", result: "1× build", unit: "· corre siempre", tone: "dfy" },
    ],
  },
  hi: {
    eyebrow: "तीन स्तंभ · एक सिस्टम",
    h1a: "आपकी बातचीत बन गई ",
    h1b: "आपकी सबसे मूल्यवान संपत्ति।",
    sub: "फ़ीचर नहीं — स्तंभ। हर एक का एक काम, एक नतीजा, और खुद की कीमत निकालता है।",
    hybrid: "रोज़ AI · कारीगरी पर असली मानव टीम",
    ai: "AI चलाता है · मानव निगरानी करता है",
    dfy: "Guileo टीम आपके लिए बनाती है",
    resultLabel: "नतीजा",
    wins: {"brain": ["हर कॉल और मैसेज का जवाब", "ज़्यादा बुकिंग, कम ग़ैरहाज़िरी", "खोए ग्राहक वापस"], "ad": ["हर चैनल पर ज़्यादा लीड", "ज़्यादा 5-स्टार रिव्यू", "जन्मदिन और वापसी रिमाइंडर"], "build": ["साइट जो बुक और बिक्री करे", "आपका ऐप और ऑनलाइन स्टोर", "सब कुछ ऑटोपायलट पर"]},
    pillars: [
      { pilar: "brain", badge: "Guileo Brain", icon: "🧠", accent: "#3E9468", owns: "आपकी परफ़ॉर्मेंस", line: "AI कर्मचारी जो रिसेप्शन संभालता है — हर कॉल और मैसेज का जवाब, बुकिंग, कोटेशन, डील बंद और वसूली। 24/7, 16 भाषाएँ।", result: "हर कॉल का जवाब", unit: "· 24/7, कभी बिज़ी नहीं", tone: "ai" },
      { pilar: "ad", badge: "Guileo AD", icon: "📈", accent: "#D6C29A", owns: "आपकी ग्रोथ", line: "मार्केटिंग जो हर दिन चलती है — ज़्यादा लोगों तक पहुँच, ज़्यादा डील, कम विज्ञापन बर्बादी।", result: "ज़्यादा लीड", unit: "· कम बर्बादी", tone: "hybrid" },
      { pilar: "build", badge: "Guileo Build", icon: "🏗️", accent: "#BE7F35", owns: "आपकी नींव", line: "वेबसाइट, ऐप, स्टोर और सॉफ़्टवेयर जिन पर पूरा ऑपरेशन चलता है — एक बार बनता है, हमेशा चलता है।", result: "1× बिल्ड", unit: "· हमेशा चलता है", tone: "dfy" },
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
  const t = PILLAR_COPY[lang] || PILLAR_COPY.en;
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

        <style>{`@keyframes prshine{to{background-position:220% center}}@keyframes pwin{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}`}</style>

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

                  {/* ⛔ A DESCRIÇÃO SAIU (Luis, 2026-08-20): «só os ícones com os nomes e os
                      resultados, sem muitos textos». O cartão tinha 3 níveis de leitura (linha
                      + selo de modo + resultado) competindo pelo mesmo olhar; agora tem UM.
                      O que cada pilar faz já foi dito duas seções acima, no anel do motor. */}

                  {/* ⛔ OS CHIPS DE PRODUTO SAÍRAM (Luis, 2026-08-20): «deixar só as coisas
                      simples — mais leads, mais vendas, tudo que for de RESULTADO».
                      O argumento, para poder voltar com consciência: a AMPLITUDE do catálogo já
                      aparece na ServicesMarquee, na PRIMEIRA tela da página. Aqui os chips
                      repetiam o que a pessoa acabou de ver e roubavam o espaço do único número que
                      esta seção existe para entregar.
                      ↩️ Para voltar: backup em /tmp/Pillars.bak.jsx. O helper `produtosDoPilar` e o
                      estado `aberto` continuam no arquivo, intactos. */}


                  {/* ⚠️ O SELO DE ENTREGA DESCEU (2026-08-17). Ele ficava colado nos chips, e com
                      isso todo o vazio do card sobrava no fim — que é exatamente o que fazia o card
                      do Build (2 serviços no catálogo, contra 7 do Brain) parecer um card pela
                      metade. Colado no resultado, o respiro passa a cair ENTRE dois blocos de
                      leitura ("o que é" … "como entrega + quanto vale"), e vazio entre blocos lê
                      como composição, não como falta.
                      ⚠️ ISSO É REMENDO DE LAYOUT PARA UM BURACO DE CATÁLOGO: o Build entrega site,
                      app, loja, software e automação, e o productSystem só tem DOIS itens dele.
                      Enquanto isso não for resolvido na FONTE, o pilar mais caro será sempre o que
                      parece o mais magro. */}
                  {/* ✨ OS GANHOS — o vazio do card virou os RESULTADOS que o Luis pediu
                      («mais leads, mais relacionamento, mais reviews, aniversário»). Vêm do
                      dicionário `wins` por pilar (dados reais, não produtos), com uma revelação
                      discreta em cascata — movimento com intenção, não decoração. */}
                  {(t.wins?.[p.pilar] || []).length > 0 && (
                    <ul className="mt-5 space-y-2.5">
                      {t.wins[p.pilar].map((w, wi) => (
                        <li key={wi} className="flex items-center gap-2.5 text-[13.5px] text-g-ink"
                          style={{ animation: `pwin .6s cubic-bezier(.2,.7,.2,1) ${0.15 + wi * 0.12}s both` }}>
                          <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-black"
                            style={{ color: p.accent, background: `rgba(${rgb},0.14)`, boxShadow: `inset 0 0 0 1px rgba(${rgb},0.4)` }}>✓</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* o resultado — ancorado no pé; agora é o ÚNICO nível de leitura do cartão */}
                  <div className="mt-auto pt-5">
                    {/* o modo de entrega virou uma linha fina acima do rótulo: continua sendo dito
                        (é promessa de que tem humano no circuito, não enfeite), mas sem caixa e sem
                        bloco próprio, então não disputa o olhar com o número. */}
                    <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-g-muted">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent, boxShadow: `0 0 7px ${p.accent}` }} />{toneLabel(p.tone)}
                    </div>
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
