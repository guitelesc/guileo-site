import { useMemo, useState } from "react";
import { PRODUCTS, PILARES } from "../data/productSystem.js";
import { GUILEO_PLANS } from "../data/guileoPlans.js";

/* ═══ CATÁLOGO — TUDO que a Guileo vende, numa tela ══════════════════════════════════════════
   Pedido do Luis: "o hub tem que ter lista por lista dos nossos produtos — site, app, software,
   automação, ads, conteúdo, IA de texto, gestão de redes, TUDO".

   🚨 FONTE ÚNICA. Nada aqui é redigitado: tudo sai de `productSystem.js`, o mesmo atlas que a
   landing, o cockpit do cliente e o motor de processo leem. Catálogo redigitado é catálogo que
   desencontra — o vendedor promete uma coisa e a entrega faz outra. Se um produto nasce lá, ele
   aparece aqui sozinho; se muda de nome lá, muda aqui.

   🚨 O QUE É PROJETO À PARTE FICA DITO. Vários produtos têm a versão do plano E a versão sob
   medida (app instalável × app nativo de loja; catálogo com link de pagamento × loja completa).
   O texto de `result` já carrega essa fronteira entre parênteses — e é por isso que ele aparece
   inteiro, sem corte: cortar a frase é onde a promessa quebrada nasce. */

const PILAR_META = {
  brain: { ico: "🧠", cor: "#FF8A33", rot: { pt: "Brain · atende, agenda e cobra", en: "Brain · answers, books and collects", es: "Brain · atiende, agenda y cobra", hi: "Brain · जवाब, बुकिंग, वसूली" } },
  ad:    { ico: "📣", cor: "#4C9AFF", rot: { pt: "AD · traz gente e faz voltar", en: "AD · brings people and brings them back", es: "AD · trae gente y la hace volver", hi: "AD · लोग लाता और लौटाता है" } },
  build: { ico: "🏗️", cor: "#9AA0FF", rot: { pt: "Build · a base construída uma vez", en: "Build · the foundation built once", es: "Build · la base construida una vez", hi: "Build · एक बार बनी नींव" } },
};

const U = {
  pt: { h: "Tudo que a gente vende", sub: "Os 18 produtos, agrupados nos 3 Guileos. É o mesmo catálogo que o cliente vê no painel dele — nada aqui é promessa solta.", busca: "Filtrar (ex: site, app, anúncio…)", nenhum: "Nada com esse filtro.", planos: "Entra em", partePlano: "Já roda sozinho", precisaChave: "Liga quando você conectar a conta", total: "produtos", copiar: "📋 Copiar a lista", copiado: "Copiado ✓" },
  en: { h: "Everything we sell", sub: "All 18 products, grouped into the 3 Guileos. Same catalog the client sees in their dashboard — nothing here is a loose promise.", busca: "Filter (e.g. site, app, ads…)", nenhum: "Nothing matches that filter.", planos: "Included in", partePlano: "Runs on its own", precisaChave: "Switches on when you connect the account", total: "products", copiar: "📋 Copy the list", copiado: "Copied ✓" },
  es: { h: "Todo lo que vendemos", sub: "Los 18 productos, agrupados en los 3 Guileos. Es el mismo catálogo que el cliente ve en su panel — nada aquí es una promesa suelta.", busca: "Filtrar (ej: sitio, app, anuncios…)", nenhum: "Nada con ese filtro.", planos: "Incluido en", partePlano: "Ya funciona solo", precisaChave: "Se activa al conectar la cuenta", total: "productos", copiar: "📋 Copiar la lista", copiado: "Copiado ✓" },
  hi: { h: "हम जो कुछ बेचते हैं", sub: "सभी 18 प्रोडक्ट, 3 Guileo में बँटे। वही कैटलॉग जो क्लाइंट अपने डैशबोर्ड में देखता है।", busca: "फ़िल्टर (जैसे साइट, ऐप, विज्ञापन…)", nenhum: "इस फ़िल्टर से कुछ नहीं मिला।", planos: "शामिल है", partePlano: "अपने आप चलता है", precisaChave: "खाता जोड़ते ही चालू", total: "प्रोडक्ट", copiar: "📋 सूची कॉपी करें", copiado: "कॉपी ✓" },
};

const txt = (o, lang) => (o && (o[lang] || o.en || o.pt)) || "";

export default function SellerProdutos({ lang = "pt" }) {
  const t = U[lang] || U.pt;
  const [q, setQ] = useState("");
  const [copiado, setCopiado] = useState(false);

  const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtrados = useMemo(() => {
    const alvo = norm(q).trim();
    if (!alvo) return PRODUCTS;
    return PRODUCTS.filter((p) =>
      norm(txt(p.name, lang)).includes(alvo) ||
      norm(txt(p.result, lang)).includes(alvo) ||
      norm(txt(p.category, lang)).includes(alvo) ||
      norm(p.id).includes(alvo));
  }, [q, lang]);

  const planoNome = (k) => (GUILEO_PLANS.find((p) => p.key === k)?.name) || k;

  const copiarLista = () => {
    const linhas = PILARES.flatMap((pil) => {
      const itens = filtrados.filter((p) => p.pilar === pil);
      if (!itens.length) return [];
      return [`${PILAR_META[pil].ico} ${txt(PILAR_META[pil].rot, lang)}`,
        ...itens.map((p) => `  • ${txt(p.name, lang)} — ${txt(p.result, lang)}`), ""];
    });
    navigator.clipboard?.writeText(linhas.join("\n"));
    setCopiado(true); setTimeout(() => setCopiado(false), 1600);
  };

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-extrabold text-g-word">🧰 {t.h}</div>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-g-muted">{t.sub}</p>
        </div>
        <button type="button" onClick={copiarLista}
          className="inline-flex min-h-[48px] shrink-0 items-center rounded-full border border-white/15 px-4 text-[12.5px] font-bold text-g-muted hover:text-g-word">
          {copiado ? t.copiado : t.copiar}
        </button>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.busca}
        className="mb-4 w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-[14px] text-g-word placeholder:text-g-muted/70 focus:border-g-gold/50 focus:outline-none" />

      <div className="mb-3 text-[11.5px] tabular-nums text-g-muted">{filtrados.length} {t.total}</div>

      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-[13px] text-g-muted backdrop-blur-xl">{t.nenhum}</div>
      ) : (
        <div className="space-y-6">
          {PILARES.map((pil) => {
            const itens = filtrados.filter((p) => p.pilar === pil);
            if (!itens.length) return null;
            const meta = PILAR_META[pil];
            return (
              <section key={pil}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[15px]">{meta.ico}</span>
                  <h3 className="text-[12px] font-black uppercase tracking-wider" style={{ color: meta.cor }}>{txt(meta.rot, lang)}</h3>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-g-muted">{itens.length}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {itens.map((p) => (
                    <article key={p.id} className="rounded-2xl border bg-white/[0.04] p-4 backdrop-blur-xl"
                      style={{ borderColor: `${p.accent || meta.cor}33` }}>
                      <div className="flex items-start gap-2.5">
                        <span className="text-[18px] leading-none">{p.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-extrabold leading-tight text-g-word">{txt(p.name, lang)}</div>
                          <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: p.accent || meta.cor }}>
                            {txt(p.category, lang)}
                          </div>
                        </div>
                      </div>
                      {/* a frase INTEIRA: é nela que mora a fronteira "isto é projeto à parte" */}
                      <p className="mt-2.5 text-[12.5px] leading-relaxed text-g-ink">{txt(p.result, lang)}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {(p.plans || []).map((k) => (
                          <span key={k} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10.5px] font-bold text-g-ink">{planoNome(k)}</span>
                        ))}
                        <span className="rounded-full px-2.5 py-1 text-[10.5px] font-bold"
                          style={p.activationKey
                            ? { background: "rgba(255,194,61,0.12)", color: "#FFC23D" }
                            : { background: "rgba(62,148,104,0.12)", color: "#3E9468" }}>
                          {p.activationKey ? t.precisaChave : t.partePlano}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
