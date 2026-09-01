/* ══════════════════════════════════════════════════════════════════════════════════════════════
   O COMPORTAMENTO DA VITRINE — os hooks que estavam copiados em 15 arquivos.
   ══════════════════════════════════════════════════════════════════════════════════════════════
   Medido antes de escrever: IntersectionObserver em 15 arquivos, prefers-reduced-motion em 21,
   o failsafe do reveal em 6. Cada cópia era uma chance de alguém esquecer uma guarda — e as
   guardas AQUI nasceram todas de incidente real, não de teoria:

     • reveal escondia incondicionalmente → página EM BRANCO em aba oculta (o IO nunca dispara
       em document.hidden). Agora o esconder só liga DEPOIS do observer armar, com failsafe.
     • cortina de abertura sem segundo timer → risco de ficar presa na frente do site inteiro.
     • captura de lead lendo r.ok → recusa do servidor passava por sucesso. O CORPO decide.

   Nada aqui inventa padrão: é o que o Luis já aprovou no ThreeDegrees e no NY Medical,
   com as lições que custaram build quebrada e página branca.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback } from "react";

/** Movimento é permitido? (reduced-motion, sem IO, ou aba oculta = não anima, mostra tudo) */
function podeAnimar() {
  if (typeof window === "undefined") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    && "IntersectionObserver" in window
    && document.visibilityState !== "hidden";
}

/**
 * REVEAL FAIL-OPEN.
 * Devolve a ref da raiz. O CSS só esconde sob a classe `${prefixo}-anima`, e essa classe só
 * entra aqui, com JS vivo. Sem JS / IO quebrado / aba oculta: a página nasce INTEIRA.
 * Failsafe: se em 1.8s nenhum elemento revelou, o IO está morto neste ambiente — mostra tudo.
 */
export function useReveal(prefixo, seletor = null) {
  const raizRef = useRef(null);
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const alvo = seletor || `.${prefixo}-rev, .${prefixo}-filete-liga`;
    const els = raiz.querySelectorAll(alvo);
    if (!podeAnimar()) return; // nem liga a classe — página estática, inteira
    raiz.classList.add(`${prefixo}-anima`);
    let algum = false;
    const io = new IntersectionObserver((es) => es.forEach((x) => {
      if (x.isIntersecting) { algum = true; x.target.classList.add("is-in"); io.unobserve(x.target); }
    }), { threshold: 0.15 });
    els.forEach((e) => io.observe(e));
    const failsafe = setTimeout(() => {
      if (!algum) els.forEach((e) => e.classList.add("is-in"));
    }, 1800);
    return () => { clearTimeout(failsafe); io.disconnect(); };
  }, [prefixo, seletor]);
  return raizRef;
}

/**
 * A ABERTURA (cortina) + a entrada orquestrada do hero.
 * `cortina` nasce em "nunca" — o estado SEM abertura. Só o efeito, com JS vivo, a fecha.
 * Dois timers INDEPENDENTES: um sobe, o outro remove aconteça o que acontecer. Cortina presa
 * é o site inteiro perdido, então o caminho de falha tem que terminar aberto.
 * `abriu` liga a classe que dispara o stagger do hero (ent-1 … ent-7).
 */
export function useAbertura(msSobe = 1400, msRemove = 2500) {
  const [cortina, setCortina] = useState("nunca"); // nunca | fechada | subindo
  const [abriu, setAbriu] = useState(true);        // fail-open: hero visível por padrão
  useEffect(() => {
    if (!podeAnimar()) return;
    /* FAIL-OPEN DE PROPÓSITO: o estado inicial é "sem abertura / hero visível". Só o efeito,
       que exige JS vivo e movimento permitido, FECHA a cortina. Inverter isso (nascer fechada)
       já deixou a página inteira atrás de uma cortina presa. O render extra é o preço de não
       perder o site — por isso a regra fica desligada NESTA linha, e só nela. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCortina("fechada"); setAbriu(false);
    const t0 = setTimeout(() => setAbriu(true), 260);
    const t1 = setTimeout(() => setCortina("subindo"), msSobe);
    const t2 = setTimeout(() => setCortina("nunca"), msRemove);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
  }, [msSobe, msRemove]);
  return { cortina, abriu };
}

/**
 * O SELO VIVO — relógio real do negócio. UM por página, e ele INFORMA.
 * Passe abre/fecha SÓ se o horário for conhecido de verdade. Sem fonte, deixe `horario` nulo:
 * devolve só a hora, e a página diz outra coisa verdadeira ("by appointment", "text us").
 * Inventar horário é o mesmo defeito do preço-âncora, aplicado à porta.
 */
export function useRelogio(horario = null, tz = "America/New_York") {
  const [rel, setRel] = useState({ hora: "", aberto: null });
  useEffect(() => {
    const tick = () => {
      const f = (o) => new Intl.DateTimeFormat("en-US", { timeZone: tz, ...o }).format(new Date());
      const h = Number(f({ hour: "numeric", hour12: false }));
      const aberto = horario ? (h >= horario.abre && h < horario.fecha) : null;
      setRel({ hora: f({ hour: "numeric", minute: "2-digit", hour12: true }), aberto });
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [horario, tz]);
  return rel;
}

/**
 * SEO por vitrine: title + meta + JSON-LD, com limpeza ao desmontar.
 * ⚠️ O JSON-LD global da Guileo vaza em toda rota do SPA — quem monta o /novo desativa os blocos
 * marcados com data-guileo-global. Filtrar por type derruba o schema do cliente (o efeito do
 * filho roda antes do pai) e filtrar por "guileoai.com" também (as imagens dele estão no nosso
 * domínio). Marcador explícito é o único jeito seguro.
 */
export function useSeo({ titulo, meta = [], ld = null }) {
  useEffect(() => {
    const antes = document.title;
    if (titulo) document.title = titulo;
    const criados = [], repor = [];
    meta.forEach(([k, v, c]) => {
      const achou = document.head.querySelector(`meta[${k}="${v}"]`);
      if (achou) { repor.push([achou, achou.getAttribute("content")]); achou.setAttribute("content", c); return; }
      const el = document.createElement("meta");
      el.setAttribute(k, v); el.setAttribute("content", c);
      document.head.appendChild(el); criados.push(el);
    });
    if (ld) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.textContent = JSON.stringify(typeof ld === "function" ? ld() : ld);
      document.head.appendChild(s); criados.push(s);
    }
    return () => {
      document.title = antes;
      criados.forEach((el) => el.remove());
      repor.forEach(([el, v]) => (v == null ? el.removeAttribute("content") : el.setAttribute("content", v)));
    };
  }, [titulo, meta, ld]);
}

/**
 * CAPTURA DE LEAD — o motor de ativação (Luis: «uma das partes mais importantes»).
 * O visitante preenche, o lead entra no CRM, e se o slug tiver ligar_de_volta a IA do negócio
 * LIGA DE VOLTA na hora.
 * 🚨 O CORPO decide, nunca `r.ok`: status HTTP 200 já carregou recusa do servidor e a tela
 * comemorou em cima de um banco que não recebeu nada.
 */
export function useCaptura(slug, negocio) {
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const enviar = useCallback(async ({ nome, telefone, mensagem, fallbackTel }) => {
    setErro("");
    let ok;
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, negocio, nome, telefone, mensagem }),
      });
      const d = await r.json().catch(() => null);
      ok = !!(d && d.ok === true);
    } catch { ok = false; }
    if (ok) setEnviado(true);
    else setErro(`That didn't send — call ${fallbackTel}, someone picks up.`);
    return ok;
  }, [slug, negocio]);
  return { enviado, erro, enviar };
}

/** Rua curta: "302 E 19th St, New York, NY 10003" → "302 E 19th St". Sem endereço, string vazia. */
export const ruaCurta = (end) => (end ? String(end).split(",")[0].trim() : "");

/** Faixa de preço honesta. Sem teto conhecido, diz "from" — nunca finge um número fechado. */
export const faixa = (base, teto, aberto = true) => {
  if (!aberto) return `$${base}`;
  return teto ? `$${base}–$${teto}` : `from $${base}`;
};
