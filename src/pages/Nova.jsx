import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Intro from "../components/Intro.jsx";
import LeadForm from "../components/LeadForm.jsx";
import ResultsV2 from "../components/ResultsV2";
import TrustStrip from "../components/TrustStrip.jsx";
import EngineV2 from "../components/EngineV2.jsx";
import CompanyOS from "../components/CompanyOS.jsx"; // 2026-09-10: os 8 departamentos que o eyebrow promete
import CockpitShots from "../components/CockpitShots.jsx"; // 2026-09-10: telas reais do cockpit
import XRaySection from "../components/XRaySection.jsx"; // 2026-09-10: o Raio-X de volta — a porta da venda
import ChannelsStrip from "../components/ChannelsStrip.jsx";
import MethodV2 from "../components/MethodV2";
import ProofV2 from "../components/ProofV2";
import PillarsProducts from "../components/PillarsProducts.jsx";
import FounderProof from "../components/FounderProof";
import PulseSection from "../components/PulseSection";
import HeroOS, { copyTelefone } from "../components/HeroOS.jsx";
import { Reveal, Accordion } from "../lib/ui.jsx";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import * as planos from "../data/guileoPlans.js";

/* ── /nova — O MODELO DA LANDING NOVA (2026-09-09) ────────────────────────────────────────────
   Rota PARALELA de propósito: o Luis pediu "me dê um modelo antes de mudar tudo". A landing
   atual (/) não muda em nada até ele aprovar; esta página existe para ser olhada e comparada.

   POR QUE ELA EXISTE — o que a medição da landing atual mostrou (2026-09-09):
     19 seções, e SEIS delas fazem a mesma promessa com palavras diferentes ("We bring the
     customers" · "You buy results" · "We grow your business" · "Every conversation compounds" ·
     "The whole team you'd hire" · "We answer, advertise, publish"). Não é excesso de conteúdo —
     é o MESMO conteúdo seis vezes. Daí a sensação de "extenso e sem sentido".
     E a 2ª maior seção da página era Pricing self-service, enquanto a venda real virou
     high-ticket por telefone. A página puxava em duas direções.

   AS 5 DECISÕES DO LUIS (e o que cada uma vira aqui):
     1. Um trabalho só: fazer o visitante FALAR COM A GUI agora. → o widget é o CTA do hero;
        preço vira uma linha, não uma seção.
     2. Voz E texto. → widget <convai> da ElevenLabs: é a MESMA Gui que atende o telefone
        (mesmo cérebro, mesma voz, mesma constituição), já com texto ligado e já na nossa
        paleta do lado de lá. E não gasta Anthropic — o LLM é o da ElevenLabs.
     3. Modelo antes de trocar. → esta rota.
     4. Movimento: VIVO no hero (o objeto Phone rotaciona cenários, o título brilha), EDITORIAL
        no resto (cada seção entra uma vez com `Reveal`, nada pisca).
     5. O hero abre com "Stop running your business. Start leading it." — a Guileo como
        sistema operacional da empresa, não como agência.

   O QUE FOI REAPROVEITADO (uma verdade só, dois lugares): Phone, ResultsV2, PillarsProducts,
   FounderProof, PulseSection, LeadForm, Accordion, Navbar, Footer, Intro. Só o hero e a linha
   de preço são novos. Sistema visual (paleta cimento quente, tipografia) intocado.

   ⚠️ O widget é um <script> de terceiro. Ele é injetado UMA vez, só nesta página, e só depois
   do primeiro paint — quem nunca abre a conversa não paga o download. A CSP dos dois arquivos
   (index.html e public/_headers) já libera unpkg.com e *.elevenlabs.io em script/connect/
   media/worker/frame — conferido antes de escrever esta linha. */

// O preço vem da FONTE ÚNICA (guileoPlans.js). Se o módulo mudar de forma, cai numa string
// honesta em vez de num número inventado — preço chutado é o erro mais caro deste projeto.
function precoDeEntrada() {
  try {
    const lista = planos.GUILEO_PLANS || planos.default || [];
    const menor = [...lista].sort((a, b) => Number(a.amount) - Number(b.amount))[0];
    return menor?.price || "$149/mo";
  } catch { return "$149/mo"; }
}

function Head({ eyebrow, h2, sub }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <div className="text-[11px] font-black uppercase tracking-[0.18em] text-g-gold/80">{eyebrow}</div>}
      <h2 className="mt-3 text-balance font-black leading-tight tracking-tight text-g-word" style={{ fontSize: "clamp(1.7rem,4.2vw,2.6rem)" }}>{h2}</h2>
      {sub && <p className="mt-3 text-[15px] leading-relaxed text-g-muted">{sub}</p>}
    </div>
  );
}

// `frio`: a paleta elétrica da v1 (ciano/verde elétrico sobre azul-preto), escopada por classe —
// tokens globais intocados. /nova mostra o modelo; a "/" só recebe quando o Luis aprovar.
export default function Nova({ frio = false }) {
  const { lang, t } = useLang();
  const c = { priceLine: (p)=>({en:`Plans from ${p}. Tailored programs are quoted by phone.`,pt:`Planos a partir de ${p}. Programas sob medida são cotados por telefone.`,es:`Planes desde ${p}. Los programas a medida se cotizan por teléfono.`,hi:`प्लान ${p} से। कस्टम प्रोग्राम फ़ोन पर कोट होते हैं।`})[lang]||`Plans from ${p}.`, priceCta:({en:"Ask Gui for a quote",pt:"Peça um orçamento à Gui",es:"Pídele un presupuesto a Gui",hi:"Gui से कोटेशन माँगें"})[lang], faqEyebrow:({en:"Questions",pt:"Dúvidas",es:"Dudas",hi:"सवाल"})[lang], faqH2:({en:"Straight answers",pt:"Respostas diretas",es:"Respuestas directas",hi:"सीधे जवाब"})[lang] };
  // O título da seção de contato prometia "a Gui te liga em cerca de um minuto" numa cópia
  // própria, solta aqui dentro. Com a Twilio suspensa essa ligação não acontece. O texto agora
  // vem de copyTelefone() (HeroOS.jsx), que obedece à chave TELEFONE_NO_AR — uma chave, um lugar.
  const tel = copyTelefone(lang);
  const preco = precoDeEntrada();
  // SEO da porta da frente (mesmo texto que a landing anterior levava na "/" — a palavra que não está
  // no título não existe na busca; a tese nova mora no H1, não na tag).
  useSeo({
    title: lang === "pt" ? "Guileo — IA, anúncios e criação para o seu negócio · atende 24/7, e ainda faz seu site" : lang === "es" ? "Guileo — IA, anuncios y creación para tu negocio · atiende 24/7, y hace tu sitio" : lang === "hi" ? "Guileo — आपके बिज़नेस के लिए AI, विज्ञापन और क्रिएटिव · 24/7 जवाब, और आपकी वेबसाइट भी" : "Guileo — AI, ads & creative for your business · answers 24/7, and builds your site",
    description: lang === "hi" ? "Gui कॉल और मैसेज का जवाब देती है, बुकिंग, कोटेशन और पेमेंट संभालती है — 24/7, 16 भाषाओं में — और टीम आपके विज्ञापन, मार्केटिंग और कंटेंट चलाती है, और वेबसाइट, ऐप और कस्टम सॉफ़्टवेयर बनाती है। 7 दिनों में लाइव। $149/माह से, 30-दिन मनी-बैक।" : lang === "pt" ? "A Gui atende ligações e mensagens, agenda, orça e cobra 24/7 em 16 idiomas — e o time conduz seus anúncios, marketing e conteúdo, e constrói site, app e software sob medida. No ar em até 7 dias. A partir de $149/mês, 30 dias de garantia." : lang === "es" ? "Gui atiende llamadas y mensajes, agenda, cotiza y cobra 24/7 en 16 idiomas — y el equipo conduce tus anuncios, marketing y contenido, y construye sitio, app y software a medida. En marcha en 7 días. Desde $149/mes, 30 días de garantía." : "Gui answers calls and messages, books, quotes and collects 24/7 in 16 languages — and the team runs your ads, marketing and content, and builds your site, app and custom software. Live in 7 days. From $149/mo, 30-day money-back.",
    // canonical = "/" e não "/nova": esta rota é APELIDO da landing (mesmas seções, mesmo texto).
    // Com canonical próprio o Google via duas páginas iguais disputando a mesma busca.
    path: "/",
  });

  // SEM fundo próprio: o `body` já pinta o cimento queimado (grão em soft-light + luzes de estúdio,
  // index.css). Um `bg-*` aqui TAPA tudo isso e a página vira chapada — foi o que aconteceu na 1ª versão.
  return (
    <div className={`tex-vivo min-h-screen text-g-ink${frio ? " frio" : ""}`}>
      {frio && <div className="frio-bg" aria-hidden="true" />}
      <Intro />
      <Navbar />

      <HeroOS />

      {/* EDITORIAL daqui para baixo: cada seção entra UMA vez, ao chegar à vista. `Reveal` é o
          padrão da casa (framer-motion, respeita prefers-reduced-motion). */}
      <TrustStrip />
      <ResultsV2 />
      <EngineV2 />
      {/* ServicesGrid SAIU (2026-09-10): os 18 serviços moram dentro dos 3 pilares (PillarsProducts) */}
      <PillarsProducts />
      <CompanyOS />
      <CockpitShots />
      <ChannelsStrip />
      <MethodV2 />
      <XRaySection />
      <FounderProof />
      <PulseSection />

      {/* PREÇO É UMA LINHA, NÃO UMA SEÇÃO. Era a 2ª maior da página e vendia sozinha um plano de
          $149 enquanto a venda real virou high-ticket por telefone. O número vem da fonte única. */}
      <Reveal variant="scale" amount={0.06}>
        <section className="wrap py-12">
          <div className="mx-auto max-w-3xl relative overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.035] px-6 py-6 text-center backdrop-blur-xl">
            <p className="text-[15px] leading-relaxed text-g-word">{c.priceLine(preco)}</p>
            <a href="#gui" onClick={(e) => { e.preventDefault(); document.querySelector("elevenlabs-convai")?.scrollIntoView({ behavior: "smooth", block: "end" }); }}
               className="btn-ghost mt-4 inline-flex text-[13px]">{c.priceCta}</a>
          </div>
        </section>
      </Reveal>

      <Reveal variant="up" amount={0.06}>
        <section id="contact" className="wrap py-14">
          <Head eyebrow={tel.contactEyebrow} h2={tel.contactH2} />
          <div className="mx-auto mt-7 max-w-xl"><LeadForm source="nova" /></div>
        </section>
      </Reveal>

      <Reveal variant="up" amount={0.06}>
        <section id="faq" className="wrap pb-20">
          <Head eyebrow={c.faqEyebrow} h2={c.faqH2} />
          <div className="mt-8"><Accordion items={t.faq.items} /></div>
        </section>
      </Reveal>

      <Footer />

    </div>
  );
}
