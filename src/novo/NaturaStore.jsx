/* NATURA STORE — a vitrine (Luis, 2026-10-02: «um modelo de uma possível loja Natura, com sacola, brand e tudo»;
   2026-10-04: «eles amaram, deixar pronto»). Catálogo, frete e regras ficam em naturaStoreCatalogo.js;
   aqui é só a tela. Os produtos vêm do banco (/api/loja-catalogo, o que o salão cadastrou); com a loja
   desligada e o banco vazio ou fora, fica a lista de EXEMPLO com o aviso "Concept preview". Ligada, a
   lista de exemplo nunca aparece. As embalagens são desenhadas em SVG; a flor só vai em produto da casa. */
import { useState, useEffect, useRef } from "react";
import { FLOR } from "./naturaArco.js";
import {
  LOJA, ENTREGAS, PRODUTOS, usd, esgotado, vendivel, qtdMaxDe, daLoja, catsDe, marcaDe, daCasa, rotuloDe,
  limparSacola, linhasDe, subtotalDe, freteDe, faltaFreteGratis, sugerir,
} from "./naturaStoreCatalogo.js";

const AZUL = "#015577";

function Marca({ x, y, s = 1, cor = AZUL }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} fill={cor} fillRule="evenodd" d={FLOR} />;
}
function Rotulo({ x, y, w, h, nome, marca, casa }) {
  const m = marca.toUpperCase();
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill="#fff" stroke="rgba(28,28,28,.08)" />
      {casa && <Marca x={x + w / 2 - 9} y={y + 8} s={0.56} />}
      <text x={x + w / 2} y={y + (casa ? 38 : 30)} textAnchor="middle" fontSize="9.5" fontWeight="600" letterSpacing={m.length > 8 ? ".4" : "1.6"} fill={AZUL} {...(m.length > 9 ? { textLength: w - 8, lengthAdjust: "spacingAndGlyphs" } : {})}>{m}</text>
      <text x={x + w / 2} y={y + 50} textAnchor="middle" fontSize="6.2" letterSpacing={nome.length > 11 ? ".2" : ".9"} fill="#5A5A5A" {...(nome.length > 11 ? { textLength: w - 8, lengthAdjust: "spacingAndGlyphs" } : {})}>{nome}</text>
    </g>
  );
}

/* Embalagens em SVG: luz vinda de cima à esquerda, sombra de contato embaixo. */
function Embalagem({ p }) {
  const curto = rotuloDe(p);
  const marca = marcaDe(p);
  const casa = daCasa(p);
  const g = `ns-g-${p.id}`;
  return (
    <svg viewBox="0 0 200 220" role="img" aria-label={`${p.name}, packaging`}>
      <defs>
        <linearGradient id={g} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".28" stopColor="#fff" stopOpacity="0" />
          <stop offset=".8" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".1" />
        </linearGradient>
        <linearGradient id={`${g}-o`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#F6E3A1" /><stop offset=".45" stopColor="#D2A84B" /><stop offset=".7" stopColor="#B88A2E" /><stop offset="1" stopColor="#EBCB72" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="200" rx={p.forma === "sacola" || p.forma === "toalha" || p.forma === "fronha" ? 64 : 46} ry="7" fill="rgba(28,28,28,.16)" />
      {p.forma === "vela" && (
        <g>
          <path className="ns-chama" d="M100 34c5 7 8 11 8 16a8 8 0 0 1-16 0c0-5 3-9 8-16z" fill="#E9A23B" />
          <rect x="99" y="56" width="2" height="12" fill="#3a3a3a" />
          <rect x="56" y="66" width="88" height="134" rx="10" fill={p.cor} stroke="rgba(28,28,28,.1)" />
          <rect x="56" y="66" width="88" height="14" rx="7" fill="#fff" opacity=".6" />
          <rect x="56" y="66" width="88" height="134" rx="10" fill={`url(#${g})`} />
          <Rotulo x={70} y={104} w={60} h={60} nome={curto} marca={marca} casa={casa} />
        </g>
      )}
      {p.forma === "pote" && (
        <g>
          <rect x="46" y="112" width="108" height="88" rx="12" fill={p.cor} stroke="rgba(28,28,28,.1)" />
          <rect x="42" y="88" width="116" height="30" rx="8" fill={AZUL} />
          <rect x="42" y="88" width="116" height="30" rx="8" fill={`url(#${g})`} />
          <rect x="46" y="112" width="108" height="88" rx="12" fill={`url(#${g})`} />
          <Rotulo x={70} y={128} w={60} h={60} nome={curto} marca={marca} casa={casa} />
        </g>
      )}
      {p.forma === "frasco" && (
        <g>
          <path d="M92 20h22v8h-8v10h-10V28h-4z" fill={AZUL} />
          <rect x="88" y="38" width="24" height="16" rx="3" fill={AZUL} />
          <rect x="62" y="54" width="76" height="146" rx="14" fill={p.cor} stroke="rgba(28,28,28,.1)" />
          <rect x="62" y="54" width="76" height="146" rx="14" fill={`url(#${g})`} />
          <Rotulo x={70} y={96} w={60} h={60} nome={curto} marca={marca} casa={casa} />
        </g>
      )}
      {p.forma === "tubo" && (
        <g>
          <path d="M70 26h60l-8 150H78z" fill={p.cor} stroke="rgba(28,28,28,.1)" />
          <rect x="68" y="20" width="64" height="8" rx="2" fill="#E9D3D7" />
          <path d="M70 26h60l-8 150H78z" fill={`url(#${g})`} />
          <rect x="80" y="176" width="40" height="24" rx="4" fill={AZUL} />
          <Rotulo x={72} y={70} w={56} h={60} nome={curto} marca={marca} casa={casa} />
        </g>
      )}
      {p.forma === "sacola" && (
        <g>
          <path d="M76 78c0-34 48-34 48 0" fill="none" stroke={AZUL} strokeWidth="4" strokeLinecap="round" />
          <path d="M44 76h112l8 124H36z" fill={p.cor} stroke="rgba(28,28,28,.12)" />
          <path d="M44 76h112l8 124H36z" fill={`url(#${g})`} />
          {casa && <Marca x={78} y={104} s={1.4} />}
          <text x="100" y={casa ? 172 : 150} textAnchor="middle" fontSize="13" fontWeight="600" letterSpacing={marca.length > 8 ? "1" : "3"} fill={AZUL} {...(marca.length > 10 ? { textLength: 104, lengthAdjust: "spacingAndGlyphs" } : {})}>{marca.toUpperCase()}</text>
          <text x="100" y={casa ? 186 : 166} textAnchor="middle" fontSize="6.5" letterSpacing="1.6" fill="#5A5A5A">{casa ? "SPA + SALON · NEW YORK" : curto}</text>
        </g>
      )}
      {p.forma === "brinco" && (
        <g>
          <rect x="58" y="26" width="84" height="172" rx="10" fill={p.cor} stroke="rgba(28,28,28,.1)" />
          <rect x="58" y="26" width="84" height="172" rx="10" fill={`url(#${g})`} />
          <rect x="88" y="36" width="24" height="5" rx="2.5" fill={p.fundo} stroke="rgba(28,28,28,.08)" />
          {[80, 120].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy={p.fina ? 92 : 98} r={p.fina ? 11 : 17} fill="none" stroke={`url(#${g}-o)`} strokeWidth={p.fina ? 6 : 4.5} />
              <circle cx={cx} cy={p.fina ? 80 : 80} r="2" fill="#B88A2E" />
            </g>
          ))}
          {casa && <Marca x={91} y={142} s={0.56} />}
          <text x="100" y="176" textAnchor="middle" fontSize="8" fontWeight="600" letterSpacing="2" fill={AZUL}>{marca.toUpperCase()}</text>
          <text x="100" y="187" textAnchor="middle" fontSize="5.6" letterSpacing="1.2" fill="#5A5A5A">{p.fina ? "14K SOLID GOLD" : "18K GOLD-PLATED"}</text>
        </g>
      )}
      {p.forma === "colar" && (
        <g>
          <path d="M60 196V66c0-28 18-44 40-44s40 16 40 44v130z" fill={p.cor} stroke="rgba(28,28,28,.1)" />
          <path d="M60 196V66c0-28 18-44 40-44s40 16 40 44v130z" fill={`url(#${g})`} />
          <path d="M72 58Q100 150 128 58" fill="none" stroke={`url(#${g}-o)`} strokeWidth="1.8" />
          {!p.fina && <path d="M66 62Q100 180 134 62" fill="none" stroke={`url(#${g}-o)`} strokeWidth="1.4" />}
          {p.fina ? (
            <g>
              <circle cx="100" cy="107" r="6" fill={`url(#${g}-o)`} />
              <path d="M100 102.5l3.6 4.5-3.6 4.5-3.6-4.5z" fill="#FFFFFF" stroke="rgba(28,28,28,.25)" strokeWidth=".5" />
            </g>
          ) : <circle cx="100" cy="106" r="3.2" fill={`url(#${g}-o)`} />}
          {casa && <Marca x={91} y={150} s={0.56} />}
          <text x="100" y="186" textAnchor="middle" fontSize="5.6" letterSpacing="1.2" fill="#5A5A5A">{p.fina ? "14K SOLID GOLD" : "18K GOLD-PLATED"}</text>
        </g>
      )}
      {p.forma === "anel" && (
        <g>
          <path d="M54 112L64 50h72l10 62z" fill="#014a66" />
          <path d="M60 106l7-48h66l7 48z" fill="#F6F0E8" opacity=".14" />
          <rect x="50" y="110" width="100" height="88" rx="10" fill={p.cor} />
          <rect x="50" y="110" width="100" height="88" rx="10" fill={`url(#${g})`} />
          <rect x="62" y="118" width="76" height="30" rx="15" fill="#01668f" />
          <rect x="99" y="118" width="2" height="30" fill="#014a66" />
          {(/trio|stack/i.test(p.name) ? [-7, 0, 7] : [0]).map((d) => (
            <ellipse key={d} cx="100" cy={118 + d} rx="17" ry="15" fill="none" stroke={`url(#${g}-o)`} strokeWidth={/trio|stack/i.test(p.name) ? 2.4 : 4} />
          ))}
          {casa && <Marca x={91} y={164} s={0.56} />}
        </g>
      )}
      {p.forma === "toalha" && (
        <g>
          {[[150, 128], [112, 120], [74, 112]].map(([y, w], k) => (
            <g key={y}>
              <rect x={100 - w / 2} y={y} width={w} height="42" rx="16" fill={k === 1 ? "#F1E6DA" : p.cor} stroke="rgba(28,28,28,.1)" />
              <rect x={100 - w / 2} y={y} width={w} height="42" rx="16" fill={`url(#${g})`} />
              <rect x={100 - w / 2 + 8} y={y + 29} width={w - 16} height="3" rx="1.5" fill={AZUL} opacity=".55" />
            </g>
          ))}
          {casa && <Marca x={91} y={84} s={0.56} />}
        </g>
      )}
      {p.forma === "roupao" && (
        <g>
          <path d="M100 30a7 7 0 1 1 7-7" fill="none" stroke="#9C8C78" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M64 50L100 32l36 18" fill="none" stroke="#9C8C78" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M70 46h60l26 24-8 40-10-6 6 94H56l6-94-10 6-8-40z" fill={p.cor} stroke="rgba(28,28,28,.12)" />
          <path d="M70 46h60l26 24-8 40-10-6 6 94H56l6-94-10 6-8-40z" fill={`url(#${g})`} />
          <path d="M84 46l16 70 16-70" fill="none" stroke="rgba(28,28,28,.14)" strokeWidth="1.4" />
          <path d="M84 46l16 70-24 92" fill="none" stroke="rgba(28,28,28,.08)" strokeWidth="1.2" />
          <rect x="58" y="124" width="84" height="7" rx="3.5" fill="#EFE7DC" stroke="rgba(28,28,28,.1)" />
          <path d="M96 131l-6 26M104 131l5 22" stroke="#EFE7DC" strokeWidth="5" strokeLinecap="round" />
          {casa && <Marca x={110} y={70} s={0.5} />}
        </g>
      )}
      {p.forma === "fronha" && (
        <g>
          <path d="M40 104c20-8 100-8 120 0 6 24 6 56 0 80-20 8-100 8-120 0-6-24-6-56 0-80z" fill={p.cor} stroke="rgba(28,28,28,.1)" />
          <path d="M40 104c20-8 100-8 120 0 6 24 6 56 0 80-20 8-100 8-120 0-6-24-6-56 0-80z" fill={`url(#${g})`} />
          <path d="M58 122c30-10 60 18 92 4" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round" />
          <path d="M60 162c26 8 54-12 84 0" fill="none" stroke="rgba(28,28,28,.07)" strokeWidth="3" strokeLinecap="round" />
          {casa && <Marca x={133} y={160} s={0.5} />}
        </g>
      )}
    </svg>
  );
}

/* A sacola sobrevive a recarregar a página. Armazenamento pode falhar (aba anônima, bloqueio): aí só não guarda. */
/* Aqui só a FORMA é conferida (os produtos ainda não chegaram do banco); quem descarta id que não existe
   mais é o limparSacola, quando a lista do banco chega. */
function lerSacola() {
  try {
    const cru = JSON.parse(localStorage.getItem(LOJA.guardar) || "{}");
    const s = {};
    if (cru && typeof cru === "object" && !Array.isArray(cru)) {
      for (const [id, q] of Object.entries(cru)) {
        const n = Math.floor(Number(q));
        if (id.length <= 64 && Number.isFinite(n) && n >= 1) s[id] = Math.min(n, LOJA.qtdMax);
      }
    }
    return s;
  } catch { return {}; }
}
function gravarSacola(s) {
  try { localStorage.setItem(LOJA.guardar, JSON.stringify(s)); } catch { /* sem armazenamento: segue sem guardar */ }
}

/* Volta do Stripe: ?loja=ok (pagou e o pedido foi registrado), ?loja=confirmando (pagou no Stripe do
   próprio salão e a confirmação ainda não chegou — /api/venda-paga) ou ?loja=cancelado (desistiu).
   Lido uma vez e tirado da URL. */
function lerRetorno() {
  try {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("loja");
    if (r !== "ok" && r !== "cancelado" && r !== "confirmando") return "";
    q.delete("loja");
    const resto = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${resto ? `?${resto}` : ""}${window.location.hash}`);
    return r;
  } catch { return ""; }
}

function Qtd({ p, q, por }) {
  return (
    <span className="ns-qt">
      <button type="button" aria-label={`Remove one ${p.name}`} onClick={() => por(p, -1)}>−</button>
      <span className="nt-num">{q}</span>
      <button type="button" aria-label={`Add one ${p.name}`} onClick={() => por(p, 1)} disabled={q >= qtdMaxDe(p)}>+</button>
    </span>
  );
}

export default function NaturaStore({ hidden }) {
  const [cat, setCat] = useState("All");
  const [retorno] = useState(lerRetorno);              // "ok" | "confirmando" | "cancelado" | ""
  const [sacola, setSacola] = useState(() => (retorno === "ok" || retorno === "confirmando" ? {} : lerSacola()));   // id → quantidade (pagou = sacola zerada)
  const [entrega, setEntrega] = useState("astoria");
  const [aberta, setAberta] = useState(false);
  const [aviso, setAviso] = useState("");            // o que o leitor de tela ouve ao mexer na sacola
  const [pulo, setPulo] = useState(0);               // reinicia a animação do contador
  const [pagando, setPagando] = useState(false);
  const [erro, setErro] = useState("");
  const [semPagamento, setSemPagamento] = useState("");      // o salão ainda não recebe online: a frase do servidor fica e o botão para
  /* de onde vêm os produtos: "banco" | "exemplo" (só com a loja desligada) | "carregando" | "vazia" | "erro" */
  const [fonte, setFonte] = useState(LOJA.aoVivo ? "carregando" : "exemplo");
  const [produtos, setProdutos] = useState(LOJA.aoVivo ? [] : PRODUTOS);
  const buscou = useRef(false);
  const gatilho = useRef(null);
  const gaveta = useRef(null);

  const cats = catsDe(produtos);
  const catAtiva = cats.includes(cat) ? cat : "All";
  const linhas = linhasDe(sacola, produtos);
  const qtd = linhas.reduce((n, l) => n + l.qtd, 0);
  const subtotal = subtotalDe(sacola, produtos);
  const frete = freteDe(subtotal, entrega);
  const falta = faltaFreteGratis(subtotal);
  const sugestoes = sugerir(sacola, produtos).filter((p) => vendivel(p) && !sacola[p.id]).slice(0, 2);
  const vende = LOJA.aoVivo && fonte === "banco";

  useEffect(() => { gravarSacola(sacola); }, [sacola]);

  /* Busca o catálogo na PRIMEIRA vez que a loja aparece — quem só visita a home não chama nada. */
  useEffect(() => {
    if (hidden || buscou.current) return;
    buscou.current = true;
    fetch(`/api/loja-catalogo?slug=${encodeURIComponent(LOJA.slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const lista = j && j.ok ? daLoja(j.produtos) : null;
        if (lista && lista.length) {
          setProdutos(lista);
          setFonte("banco");
          setSacola((s) => limparSacola(s, lista));
        } else if (LOJA.aoVivo) setFonte(lista ? "vazia" : "erro");
        // loja desligada e banco vazio ou fora: a lista de exemplo continua
      })
      .catch(() => { if (LOJA.aoVivo) setFonte("erro"); });
  }, [hidden]);

  const por = (p, d) => {
    setSacola((s) => {
      const n = Math.max(0, Math.min(qtdMaxDe(p), (s[p.id] || 0) + d));
      const novo = { ...s, [p.id]: n };
      if (!n) delete novo[p.id];
      return novo;
    });
    setAviso(d > 0 ? `${p.name} added to your bag.` : `${p.name} removed from your bag.`);
    if (d > 0) setPulo((x) => x + 1);
    setErro("");
  };

  /* Gaveta aberta: Esc fecha, Tab não sai dela, o foco entra no fechar e volta ao botão da sacola. */
  useEffect(() => {
    if (!aberta) return undefined;
    const caixa = gaveta.current;
    const volta = gatilho.current;
    caixa?.querySelector(".ns-x")?.focus();
    const tecla = (e) => {
      if (e.key === "Escape") { setAberta(false); return; }
      if (e.key !== "Tab" || !caixa) return;
      const focaveis = [...caixa.querySelectorAll("button:not([disabled]), input:not([disabled]), a[href]")];
      if (!focaveis.length) return;
      const [primeiro, ultimo] = [focaveis[0], focaveis[focaveis.length - 1]];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", tecla);
    /* o widget de voz é fixo no canto e cobriria o botão de checkout: some enquanto a sacola está aberta */
    const voz = document.querySelector("elevenlabs-convai");
    if (voz) voz.style.display = "none";
    return () => {
      document.removeEventListener("keydown", tecla);
      if (voz) voz.style.display = "";
      volta?.focus({ preventScroll: true });   // devolve o foco sem puxar a página (o link de políticas rola para outro lugar)
    };
  }, [aberta]);

  async function finalizar() {
    if (!vende || !linhas.length || pagando || semPagamento) return;
    setPagando(true); setErro("");
    try {
      const r = await fetch(LOJA.checkout, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: LOJA.slug, entrega, itens: linhas.map((l) => ({ id: l.p.id, qtd: l.qtd })) }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) { window.location.assign(j.url); return; }
      // sem forma de receber online (payments_not_connected / sem_conta): não é "tente de novo" — trava o botão
      if (j.code === "payments_not_connected" || j.code === "sem_conta") setSemPagamento(j.error || "Online checkout isn’t available yet. Nothing was charged — please call the salon to order.");
      setErro(j.error || "We couldn’t open checkout. Nothing was charged — please try again.");
    } catch {
      setErro("We couldn’t reach checkout. Nothing was charged — please try again.");
    }
    setPagando(false);
  }

  return (
    <section className="nt-sec ns" id="store" hidden={hidden}>
      <style>{`
        .ns-aviso{display:inline-flex;align-items:center;gap:10px;padding:8px 16px;border-radius:999px;background:var(--creme);font-size:13px;font-weight:500;color:var(--tinta);margin-bottom:26px}
        .ns-aviso b{font-weight:600;color:var(--rosa-p)}
        .ns-aviso.ns-volta{display:flex;width:fit-content;max-width:100%;background:#fff;box-shadow:inset 0 0 0 1px var(--rosa)}
        .ns-topo{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:34px}
        .ns-topo p{max-width:34em;margin-top:14px}
        .nt .ns-bolsa{display:inline-flex;align-items:center;gap:10px;min-height:49px;padding:0 22px;border-radius:999px;font-weight:600;font-size:14px;color:#fff;background:linear-gradient(180deg,#0A6A8F,#015577 60%,#014560);
          box-shadow:inset 0 1.5px 0 rgba(255,255,255,.3),inset 0 -3px 5px -2px rgba(0,0,0,.35),0 1px 2px rgba(1,59,82,.4),0 14px 22px -14px rgba(1,59,82,.8);transition:transform .3s cubic-bezier(.2,.7,.2,1)}
        .nt .ns-bolsa:hover{transform:translateY(-2px)}
        .ns-bolsa i{font-style:normal;min-width:22px;height:22px;padding:0 6px;border-radius:999px;display:inline-grid;place-items:center;background:#fff;color:#015577;font-size:12px}
        .ns-bolsa i.ns-pulo{animation:ns-pulo .45s cubic-bezier(.2,.7,.2,1)}
        @keyframes ns-pulo{40%{transform:scale(1.28)}}
        .ns-estado{padding:40px 0 60px;font-size:15px;color:var(--texto)}
        .ns-cats{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:30px}
        .nt .ns-cats button{padding:10px 20px;min-height:44px;border-radius:999px;font-size:13.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--texto);box-shadow:inset 0 0 0 1px var(--fio);transition:color .25s ease,box-shadow .25s ease,background .25s ease}
        .nt .ns-cats button[aria-pressed="true"]{color:var(--rosa-e);box-shadow:inset 0 0 0 1px var(--rosa);background:#fff}
        .ns-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:44px 26px}
        .ns-foto{border-radius:64px 16px 64px 16px;padding:22px 30px 10px;transition:transform .5s cubic-bezier(.2,.7,.2,1),box-shadow .5s ease;box-shadow:0 1px 2px rgba(28,28,28,.08),0 26px 40px -34px rgba(28,28,28,.5)}
        .ns-foto svg{display:block;width:100%;height:auto;font-family:'sofia-pro','Poppins',sans-serif}
        .ns-item:hover .ns-foto{transform:translateY(-5px);box-shadow:0 2px 3px rgba(28,28,28,.1),0 34px 46px -32px rgba(28,28,28,.55)}
        .ns-item.ns-off .ns-foto{filter:grayscale(.5);opacity:.7}
        .ns-chama{transform-origin:100px 58px;animation:ns-chama 2.6s ease-in-out infinite}
        @keyframes ns-chama{50%{transform:scale(1.06,.94) rotate(-2deg)}}
        .ns-item h3{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:400;font-size:24px;line-height:1.2;margin-top:18px}
        .ns-item p{font-size:13px;line-height:1.6;color:var(--texto);margin-top:4px}
        .ns-pe{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}
        .ns-pe strong{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:400;font-size:24px}
        .ns-esg{font-size:12.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--texto)}
        .nt .ns-add{min-height:42px;padding:0 18px;border-radius:999px;font-weight:600;font-size:13.5px;color:var(--rosa-e);background:linear-gradient(180deg,#fff,#FBF8F6);
          box-shadow:inset 0 0 0 1px var(--rosa),inset 0 1.5px 0 #fff,inset 0 -3px 5px -2px rgba(195,123,137,.26),0 1px 1.5px rgba(152,80,95,.3),0 10px 16px -12px var(--rosa-e);transition:transform .25s ease}
        .nt .ns-add:hover{transform:translateY(-1px)}
        .nt .ns-add:active{transform:translateY(1px)}
        .ns-qt{display:inline-flex;align-items:center;gap:4px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--fio);padding:3px}
        .nt .ns-qt button{width:36px;height:36px;border-radius:50%;font-size:18px;color:var(--tinta);display:grid;place-items:center}
        .nt .ns-qt button:hover{background:var(--nevoa)}
        .nt .ns-qt button[disabled]{opacity:.35;cursor:not-allowed;background:none}
        .ns-qt span{min-width:22px;text-align:center;font-weight:600;font-size:14px}
        .ns-veu{position:fixed;inset:0;z-index:80;background:rgba(28,28,28,.38);animation:ns-some .25s ease}
        @keyframes ns-some{from{opacity:0}}
        .ns-gaveta{position:fixed;top:0;right:0;bottom:0;z-index:81;width:min(430px,100%);background:#fff;display:flex;flex-direction:column;border-radius:48px 0 0 14px;box-shadow:-30px 0 60px -30px rgba(28,28,28,.5);animation:ns-entra .35s cubic-bezier(.2,.7,.2,1)}
        @keyframes ns-entra{from{transform:translateX(40px);opacity:0}}
        .ns-gav-c{display:flex;align-items:center;justify-content:space-between;padding:26px 26px 18px;border-bottom:1px solid var(--fio)}
        .nt .ns-gav-c h3{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:300;font-size:30px}
        .nt .ns-x{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;box-shadow:inset 0 0 0 1px var(--fio)}
        .ns-lista{flex:1;overflow:auto;padding:8px 26px 20px}
        .ns-linha{display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:center;padding:16px 0;border-bottom:1px solid var(--fio)}
        .ns-mini{border-radius:20px 6px 20px 6px;padding:6px}
        .ns-mini svg{display:block;width:100%;height:auto;font-family:'sofia-pro','Poppins',sans-serif}
        .ns-linha b{display:block;font-weight:600;font-size:14.5px;line-height:1.3}
        .ns-linha small{color:var(--texto);font-size:13px}
        .ns-vazia{padding:60px 0;text-align:center;color:var(--texto)}
        .ns-frete{margin:18px 0 4px;font-size:13px;color:var(--tinta)}
        .ns-frete b{font-weight:600}
        .ns-barra{height:4px;border-radius:999px;background:var(--nevoa);margin-top:8px;overflow:hidden}
        .ns-barra i{display:block;height:100%;border-radius:inherit;background:var(--rosa);transition:width .5s cubic-bezier(.2,.7,.2,1)}
        .ns-bloco{margin-top:26px}
        .ns-bloco h4{font-size:12.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--texto);margin-bottom:10px}
        .ns-ent-f{border:0;padding:0;margin:26px 0 0;min-width:0}
        .ns-ent-f legend{padding:0;margin-bottom:10px;font-size:12.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--texto)}
        .ns-ent{display:grid;gap:8px}
        .ns-ent label{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:12px 14px;border-radius:16px;box-shadow:inset 0 0 0 1px var(--fio);cursor:pointer;transition:box-shadow .25s ease,background .25s ease}
        .ns-ent label:has(input:checked){box-shadow:inset 0 0 0 1.5px var(--rosa);background:#FFFCFB}
        .ns-ent input{accent-color:var(--rosa-e);width:18px;height:18px;margin:0}
        .ns-ent b{display:block;font-weight:600;font-size:14px}
        .ns-ent small{font-size:12.5px;color:var(--texto)}
        .ns-ent em{font-style:normal;font-size:13px;font-weight:600;color:var(--tinta)}
        .ns-sug{display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:center;padding:10px 0}
        .ns-sug b{display:block;font-weight:600;font-size:14px;line-height:1.3}
        .ns-sug small{font-size:12.5px;color:var(--texto)}
        .nt .ns-sug .ns-add{min-height:38px;padding:0 14px;font-size:13px}
        .ns-fim{padding:18px 26px 26px;border-top:1px solid var(--fio)}
        .ns-soma{display:flex;justify-content:space-between;align-items:baseline;font-size:14px;color:var(--texto);margin-bottom:4px}
        .ns-soma.ns-tot{color:var(--tinta);margin:8px 0 4px}
        .ns-soma.ns-tot strong{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:400;font-size:30px}
        .ns-fim p{font-size:12.5px;color:var(--texto);margin-bottom:14px}
        .ns-fim p.ns-erro{color:var(--rosa-p);font-weight:500}
        .ns-fim p.ns-pol{margin:0 0 10px}
        .ns-fim p.ns-pol a{color:var(--rosa-e);text-decoration:underline;text-underline-offset:3px}
        .nt .ns-pagar{width:100%;min-height:52px;border-radius:999px;font-weight:600;font-size:14.5px;color:#fff;background:linear-gradient(180deg,#A8606F,var(--rosa-e) 55%,var(--rosa-p));
          box-shadow:inset 0 1.5px 0 rgba(255,255,255,.35),inset 0 -3px 5px -2px rgba(0,0,0,.25),0 1px 2px rgba(124,61,75,.5),0 16px 24px -16px var(--rosa-p)}
        .nt .ns-pagar[disabled]{opacity:.55;filter:saturate(.6);cursor:not-allowed}
        .ns-so-leitor{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
        @media(prefers-reduced-motion:reduce){.ns-chama,.ns-bolsa i.ns-pulo{animation:none}.ns-barra i{transition:none}}
      `}</style>
      <div className="nt-in">
        {!LOJA.aoVivo && fonte === "exemplo" && <p className="ns-aviso"><b>Concept preview</b> A look at what a Natura Store could be. Products and prices are examples.</p>}
        {!LOJA.aoVivo && fonte === "banco" && <p className="ns-aviso"><b>Preview</b> The salon’s own products. Online checkout opens soon.</p>}
        {retorno === "ok" && <p className="ns-aviso ns-volta" role="status"><b>Thank you</b> Your payment went through and your order is placed.</p>}
        {retorno === "confirmando" && <p className="ns-aviso ns-volta" role="status"><b>Thank you</b> We’re confirming your payment with the bank. The salon will contact you if anything is missing.</p>}
        {retorno === "cancelado" && <p className="ns-aviso ns-volta" role="status"><b>Checkout cancelled</b> Nothing was charged — your bag is still here.</p>}
        <div className="ns-topo">
          <header>
            <h2 className="nt-h2">Natura Store</h2>
            <p>The care of the salon, to take home. Keratin aftercare, skin and body creams, gold jewelry and the towels and robes from our rooms — shipped, or ready at the salon on your next visit.</p>
          </header>
          <button type="button" className="ns-bolsa" ref={gatilho} onClick={() => setAberta(true)} aria-haspopup="dialog">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h12l1 11H3zM7 7V5a3 3 0 0 1 6 0v2" /></svg>
            Your bag <i key={pulo} className={`nt-num${pulo ? " ns-pulo" : ""}`}>{qtd}</i>
          </button>
        </div>
        <p className="ns-so-leitor" role="status" aria-live="polite">{aviso}</p>
        <div className="ns-cats" role="group" aria-label="Product categories">
          {cats.map((c) => <button key={c} type="button" aria-pressed={catAtiva === c} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        {fonte === "carregando" && <p className="ns-estado" role="status">Loading the store…</p>}
        {fonte === "vazia" && <p className="ns-estado">New products are on their way. In the meantime, ask for them at the front desk.</p>}
        {fonte === "erro" && <p className="ns-estado" role="alert">The store couldn’t load right now. Please refresh in a moment.</p>}
        <div className="ns-grade">
          {produtos.filter((p) => p.active !== false && (catAtiva === "All" || p.cat === catAtiva)).map((p) => (
            <article className={`ns-item${esgotado(p) ? " ns-off" : ""}`} key={p.id}>
              <div className="ns-foto" style={{ background: p.fundo }}><Embalagem p={p} /></div>
              <h3>{p.name}</h3>
              <p>{p.description}{p.size ? <><br />{p.size}</> : null}</p>
              <div className="ns-pe">
                <strong className="nt-num">{usd(p.price_cents)}</strong>
                {esgotado(p) ? <span className="ns-esg">Sold out</span>
                  : sacola[p.id] > 0 ? <Qtd p={p} q={sacola[p.id]} por={por} />
                  : <button type="button" className="ns-add" onClick={() => por(p, 1)}>Add to bag</button>}
              </div>
            </article>
          ))}
        </div>
      </div>

      {aberta && (
        <>
          <div className="ns-veu" onClick={() => setAberta(false)} />
          <div className="ns-gaveta" ref={gaveta} role="dialog" aria-modal="true" aria-label="Your bag">
            <div className="ns-gav-c">
              <h3>Your bag</h3>
              <button type="button" className="ns-x" aria-label="Close bag" onClick={() => setAberta(false)}>
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
              </button>
            </div>
            <div className="ns-lista">
              {!linhas.length ? <p className="ns-vazia">Your bag is empty.</p> : (
                <>
                  {linhas.map(({ p, qtd: q }) => (
                    <div className="ns-linha" key={p.id}>
                      <div className="ns-mini" style={{ background: p.fundo }}><Embalagem p={p} /></div>
                      <div><b>{p.name}</b><small className="nt-num">{usd(p.price_cents)}{p.size ? ` · ${p.size}` : ""}</small></div>
                      <Qtd p={p} q={q} por={por} />
                    </div>
                  ))}

                  {entrega === "envio" && (
                    <div className="ns-frete" aria-live="polite">
                      {falta > 0 ? <>You’re <b className="nt-num">{usd(falta)}</b> away from free shipping.</> : <b>Free shipping on this order.</b>}
                      <div className="ns-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, (subtotal / LOJA.freteGratisCents) * 100)}%` }} /></div>
                    </div>
                  )}

                  <fieldset className="ns-ent-f">
                    <legend>How would you like it?</legend>
                    <div className="ns-ent">
                      {ENTREGAS.map((e) => (
                        <label key={e.id}>
                          <input type="radio" name="ns-entrega" value={e.id} checked={entrega === e.id} onChange={() => setEntrega(e.id)} />
                          <span><b>{e.nome}</b><small>{e.sub}</small></span>
                          <em className="nt-num">{e.cents === 0 ? "Free" : freteDe(subtotal, e.id) === 0 ? "Free" : usd(freteDe(subtotal, e.id))}</em>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {sugestoes.length > 0 && (
                    <div className="ns-bloco">
                      <h4>Pairs well with</h4>
                      {sugestoes.map((p) => (
                        <div className="ns-sug" key={p.id}>
                          <div className="ns-mini" style={{ background: p.fundo }}><Embalagem p={p} /></div>
                          <div><b>{p.name}</b><small className="nt-num">{usd(p.price_cents)}</small></div>
                          <button type="button" className="ns-add" onClick={() => por(p, 1)} aria-label={`Add ${p.name} to bag`}>Add</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="ns-fim">
              <div className="ns-soma"><span>Subtotal</span><span className="nt-num">{usd(subtotal)}</span></div>
              <div className="ns-soma"><span>{entrega === "envio" ? "Shipping" : "Pickup"}</span><span className="nt-num">{frete ? usd(frete) : "Free"}</span></div>
              <div className="ns-soma ns-tot"><span>Total</span><strong className="nt-num">{usd(subtotal + frete)}</strong></div>
              <p className="ns-pol"><a href="#store-policies" onClick={() => setAberta(false)}>Shipping, pickup &amp; returns</a></p>
              {erro || semPagamento ? <p className="ns-erro" role="alert">{erro || semPagamento}</p>
                : <p>{vende ? "You’ll pay securely on Stripe." : "Preview: checkout opens when the store goes live. Nothing is charged here."}</p>}
              <button type="button" className="ns-pagar" onClick={finalizar} disabled={!vende || !linhas.length || pagando || !!semPagamento}>
                {pagando ? "Opening secure checkout…" : "Checkout"}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
