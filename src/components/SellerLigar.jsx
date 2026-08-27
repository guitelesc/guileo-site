import { useState, useEffect, useCallback } from "react";

/* ── POR ONDE COMEÇAR A LIGAR ─────────────────────────────────────────────────
   POR QUE EXISTE: em 2026-08-22 o banco mostrou 311 prospects com telefone e
   ZERO abordados. O motor estava pronto havia semanas e o funil nunca tinha
   sido entrado. O que faltava não era gente na lista — era saber por onde
   começar e com que frase abrir.

   A ORDEM NÃO É ALFABÉTICA NEM POR DATA: é por DOR MEDIDA. Cada cartão traz o
   achado mais grave que o X-Ray já encontrou naquele negócio ("144 hours a week
   with nobody on the phone"), para a ligação abrir com um fato DELE em vez de
   "somos uma empresa de IA".

   ⚠️ `lista === null` é "não deu para ler", NUNCA "ninguém para ligar". Mandar o
   vendedor dormir achando que a carteira acabou por causa de uma falha de rede
   é o erro mais caro que esta tela poderia cometer. */
export default function SellerLigar({ lang = "pt", sid = "" }) {
  const [lista, setLista] = useState(undefined);   // undefined=carregando · null=falhou · []=vazio
  const [motivo, setMotivo] = useState("");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);

  const T = {
    pt: { tit: "Por onde começar", sub: "Ordenado pela dor que já medimos no negócio dele — não por ordem alfabética.",
          carregando: "Carregando…", falhou: "Não consegui ler a lista agora — isto NÃO quer dizer que acabou a carteira.",
          vazio: "Nenhum prospect com telefone esperando.", ligar: "Ligar", relatorio: "Ver o relatório", roteiro: "Roteiro",
          semDor: "Sem dor medida ainda — ligue perguntando, não afirmando.", dorLabel: "A dor medida", respLabel: "O que a Gui faz",
          jaFalamos: "e-mail entregue", frio: "ainda não falamos", siteNovo: "Site novo dele", presente: "O presente",
          quentesT: "Já receberam nosso e-mail", friosT: "Ainda não falamos com eles",
          quenteNota: "O dono já tem o nosso e-mail na caixa. A ligação não é fria — abra por ele.",
          prontosT: "Preview PRONTO — é só mandar", prontosNota: "O site (e o agente) já estão no ar. Ligue, mande o link, e ele vê funcionando na hora.",
          faltaT: "Faltam dados", faltaNota: "Estes não somem mais da lista — só precisam do que falta.",
          verPreview: "Ver o preview", faltaFone: "sem telefone", faltaEmail: "sem e-mail",
          buscaPh: "Buscar — nome, e-mail, telefone, qualquer coisa", buscaN: (n, m) => `${n} de ${m}`,
          buscaVazia: (q) => `Nada casa com "${q}". Tente parte do nome, o DDD, ou o domínio.`, buscaLimpa: "limpar",
          abertura: "Como abrir", copiar: "📋 Copiar", copiado: "copiado", feridasL: "O que medimos nele",
          oiQuente: (n) => `Oi, é do ${n}? Meu nome é Luis — eu te mandei um e-mail estes dias.`,
          oiFrio: (n) => `Oi, é do ${n}? Meu nome é Luis. Não é uma venda — eu olhei o negócio de vocês e achei uma coisa que achei que iam querer saber.`,
          fim: "Posso te mostrar em cinco minutos?",
          precisaL: "Precisa de", filtroT: "Do que ele precisa", todos: "Todos",
          pernaNome: { brain: "🧠 Brain — atende e fecha", ad: "🎯 AD — traz e reputação", build: "🏗️ Build — site e sistema" },
          pernaCurto: { brain: "🧠 Brain", ad: "🎯 AD", build: "🏗️ Build" },
          semMedida: "sem medição", vazioFiltro: "Ninguém nesta perna com o filtro atual." },
    en: { tit: "Where to start", sub: "Ordered by the pain we already measured in their business — not alphabetically.",
          carregando: "Loading…", falhou: "Couldn't read the list right now — this does NOT mean the list is empty.",
          vazio: "No prospect with a phone waiting.", ligar: "Call", relatorio: "Open the report", roteiro: "Script",
          semDor: "No measured pain yet — open by asking, not by claiming.", dorLabel: "The measured pain", respLabel: "What Gui does",
          jaFalamos: "email delivered", frio: "not contacted yet", siteNovo: "Their new site", presente: "The gift",
          quentesT: "Already got our email", friosT: "Not contacted yet",
          quenteNota: "The owner already has our email in their inbox. This call is not cold — open with that.",
          prontosT: "Preview READY — just send it", prontosNota: "The site (and the agent) are live. Call, send the link, and they see it working.",
          faltaT: "Missing data", faltaNota: "These no longer disappear from the list — they just need what's missing.",
          verPreview: "Open the preview", faltaFone: "no phone", faltaEmail: "no email",
          buscaPh: "Search — name, email, phone, anything", buscaN: (n, m) => `${n} of ${m}`,
          buscaVazia: (q) => `Nothing matches "${q}". Try part of the name, the area code, or the domain.`, buscaLimpa: "clear",
          abertura: "How to open", copiar: "📋 Copy", copiado: "copied", feridasL: "What we measured",
          oiQuente: (n) => `Hi, is this ${n}? My name is Luis — I sent you an email the other day.`,
          oiFrio: (n) => `Hi, is this ${n}? My name is Luis. This isn't a sale — I looked at your business and found something I thought you'd want to know.`,
          fim: "Can I show you in five minutes?",
          precisaL: "Needs", filtroT: "What they need", todos: "All",
          pernaNome: { brain: "🧠 Brain — answers and closes", ad: "🎯 AD — brings them in", build: "🏗️ Build — site and system" },
          pernaCurto: { brain: "🧠 Brain", ad: "🎯 AD", build: "🏗️ Build" },
          semMedida: "not measured", vazioFiltro: "Nobody in this leg with the current filter." },
  };
  const c = T[lang] || T.pt;

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/lista-ligacao?sid=${encodeURIComponent(sid)}&limite=40`);
      const d = await r.json().catch(() => null);
      // O CORPO decide, não o status. `r.ok` sozinho já deixou passar recusa como sucesso aqui.
      if (!d || d.ok !== true || !Array.isArray(d.lista)) { setLista(null); setMotivo(d?.motivo || ""); return; }
      setLista(d.lista);
    } catch (e) { setLista(null); setMotivo(String(e).slice(0, 120)); }
  }, [sid]);
  useEffect(() => { carregar(); }, [carregar]);

  const [copiado, setCopiado] = useState(null);
  const [perna, setPerna] = useState(null);   // null = todas

  /* ── A FRASE DE ABERTURA, DITA ─────────────────────────────────────────────────────────────
     Luis (25/08): «o pitch personalizado do lado de todos os leads».
     A Fila de ataque já montava isso na busca, mas a frase de lá é ESCRITA (vira e-mail). Esta é
     FALADA: começa perguntando se é o negócio, diz o nome, e entrega no máximo DUAS feridas —
     três seguidas viram sermão e o dono desliga. Nada aqui é inventado: cada ferida é um título
     que o X-Ray mediu. Sem ferida medida, não existe frase — a tela diz isso em vez de fabricar. */
  /* 🚨 A FRASE SAÍA BILÍNGUE (achado 25/08, na tela, antes de qualquer ligação).
     O X-Ray grava o achado no idioma em que o relatório foi gerado, e a mesma carteira tem
     relatórios em pt e em en. O resultado era uma abertura em inglês terminando em
     «Só 16 avaliação(ões) no Google» — o vendedor lendo em voz alta trava no meio da ligação.
     Regra: uma ferida só entra na frase se ela é do idioma da tela. Se nenhuma sobrar, a frase
     não existe — melhor cartão sem frase que frase que faz o vendedor gaguejar. */
  /* ⚠️ A primeira versão exigia uma palavra INGLESA conhecida, e derrubou a melhor ferida do
     Palms — "You can't book without talking to someone" — que não tinha nenhuma delas. Lista
     branca de idioma é sempre estreita demais. Inverti: em EN basta NÃO ser português. O risco
     que sobra (uma ferida pt sem acento passar) é pequeno e barato; perder a ferida certa não é. */
  const PT = /[ãõçáàâéêíóôú]|\b(só|não|você|avaliaç|semana|ninguém|nota)\b/i;
  const noIdioma = (txt) => {
    const t = String(txt || "").trim();
    if (!t) return false;
    return lang === "pt" ? PT.test(t) : !PT.test(t);
  };

  const abrirCom = (p) => {
    const quem = (p.business || "").replace(/[:,].*$/, "").trim();
    const fs = (p.feridas || []).map((f) => f && f.titulo).filter(noIdioma).slice(0, 2);
    if (!quem || fs.length === 0) return "";
    const oi = p.contatado ? c.oiQuente(quem) : c.oiFrio(quem);
    return `${oi} ${fs.join("; ")}. ${c.fim}`;
  };

  const copiar = async (txt, chave) => {
    /* navigator.clipboard exige contexto seguro E permissão; num webview ele falha calado e o
       botão mentiria dizendo "copiado". O caminho antigo é o que garante o retorno honesto. */
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); ok = true; }
    } catch { ok = false; }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = txt; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.top = "-1000px";
        document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); document.body.removeChild(ta);
      } catch { ok = false; }
    }
    if (ok) { setCopiado(chave); setTimeout(() => setCopiado(null), 2000); }
  };

  /* ── OS 3 GUILEOS COMO FILTRO (Luis 25/08) ────────────────────────────────────────────────
     «tem que ter um filtro: business precisa do quê — website, IA, ads».
     A perna vem da PIOR nota dos aspectos dela no X-Ray (mesmo mapa de SellerLeads.jsx).
     Abaixo de 50 = furo que dá pra vender. E `null` NUNCA vira 0: aspecto não medido é
     "não sei", não "precisa muito" — senão o filtro promete conversa que a medição não sustenta. */
  const CORTE = 50;
  const precisaDe = (p) => {
    const n = p && p.pernas;
    if (!n) return [];
    return ["brain", "ad", "build"].filter((k) => n[k] !== null && n[k] !== undefined && Number(n[k]) < CORTE);
  };

  const tel = (p) => String(p || "").replace(/\D/g, "");
  const bonito = (p) => { const d = tel(p); return d.length === 11 && d[0] === "1" ? `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : p; };

  const cartao = (p, i) => (
    <div key={(p.phone || "") + i} className="rounded-2xl border border-g-line bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-6 shrink-0 text-center text-[12px] font-black text-g-muted tabular-nums">{i + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-g-word">{p.business || "—"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-g-muted">
            <span className="tabular-nums">{bonito(p.phone)}</span>
            {p.nota_google && <span>⭐ {p.nota_google}{p.avaliacoes ? ` · ${p.avaliacoes}` : ""}</span>}
            {p.categoria && <span className="truncate">{p.categoria}</span>}
            {/* O selo só aparece quando o carimbo do envio EXISTE na ficha. Nunca "provavelmente". */}
            {p.contatado && (
              <span className="rounded-full border border-g-green/40 bg-g-green/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-g-green">
                ✉️ {c.jaFalamos}{p.contatado_em ? ` · ${p.contatado_em}` : ""}
              </span>
            )}
            {p.preview_pronto && (
              <span className="rounded-full border border-g-gold/50 bg-g-gold/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-g-gold">
                ★ preview no ar
              </span>
            )}
            {p.falta_fone && <span className="rounded-full border border-g-amber/40 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-g-amber">{c.faltaFone}</span>}
            {p.falta_email && <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-g-muted">{c.faltaEmail}</span>}
            {precisaDe(p).map((k) => (
              <span key={k} className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-bold">
                {c.pernaCurto[k]}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[13.5px] font-semibold leading-snug text-g-ink">
            {p.dor_titulo || <span className="font-normal text-g-muted">{c.semDor}</span>}
          </div>
          {abrirCom(p) && (
            <div className="mt-2.5 rounded-xl border-l-2 border-g-green/60 bg-black/20 py-2 pl-3 pr-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-g-muted">{c.abertura}</div>
              <div className="mt-1 text-[13px] leading-relaxed text-g-ink">{abrirCom(p)}</div>
              <button type="button" onClick={() => copiar(abrirCom(p), i)}
                className="mt-1.5 text-[11px] font-bold text-g-green hover:underline">
                {copiado === i ? `✓ ${c.copiado}` : c.copiar}
              </button>
            </div>
          )}
        </div>
        <a href={`tel:+1${tel(p.phone)}`} className="btn-bright shrink-0 text-[12px]">{c.ligar}</a>
      </div>

      {(p.dor_evidencia || p.resposta_gui || p.relatorio || p.site_novo || p.presente) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(p.dor_evidencia || p.resposta_gui) && (
            <button onClick={() => setAberto(aberto === i ? null : i)} className="btn-ghost text-[11.5px]">{c.roteiro}</button>
          )}
          {/* O que ele MANDA por SMS durante a ligação. Estava no banco e não aparecia na tela. */}
          {p.preview_site && (
            <a href={p.preview_site} target="_blank" rel="noopener" className="btn-bright text-[11.5px]">{c.verPreview}</a>
          )}
          {p.site_novo && !p.preview_site && (
            <a href={p.site_novo} target="_blank" rel="noopener" className="btn-ghost text-[11.5px]">{c.siteNovo}</a>
          )}
          {p.presente && (
            <a href={p.presente} target="_blank" rel="noopener" className="btn-ghost text-[11.5px]">{c.presente}</a>
          )}
          {p.relatorio && (
            <a href={`/apresentacao/${p.relatorio}`} target="_blank" rel="noopener" className="btn-ghost text-[11.5px]">{c.relatorio}</a>
          )}
        </div>
      )}

      {aberto === i && (
        <div className="mt-3 space-y-2 rounded-xl bg-black/20 p-3">
          {Array.isArray(p.feridas) && p.feridas.length > 0 && (
            <div>
              <div className="text-[10.5px] font-black uppercase tracking-wider text-g-muted">{c.feridasL}</div>
              <ul className="mt-1 space-y-1">
                {p.feridas.map((f, k) => (
                  <li key={k} className="text-[12.5px] leading-relaxed text-g-ink">
                    <span className={f.gravidade === "alta" ? "text-g-amber" : "text-g-muted"}>•</span> {f.titulo}
                    {f.gui && <span className="block pl-3 text-[11.5px] text-g-muted">→ {f.gui}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.dor_evidencia && (
            <div><div className="text-[10.5px] font-black uppercase tracking-wider text-g-muted">{c.dorLabel}</div>
              <div className="mt-0.5 text-[12.5px] leading-relaxed text-g-ink">{p.dor_evidencia}</div></div>
          )}
          {p.resposta_gui && (
            <div><div className="text-[10.5px] font-black uppercase tracking-wider text-g-muted">{c.respLabel}</div>
              <div className="mt-0.5 text-[12.5px] leading-relaxed text-g-ink">{p.resposta_gui}</div></div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-3 pb-10">
      <h1 className="text-2xl font-black text-g-word">📞 {c.tit}</h1>
      <p className="mt-1 text-[13px] leading-relaxed text-g-muted">{c.sub}</p>

      {lista === undefined && <div className="mt-6 text-sm text-g-muted">{c.carregando}</div>}
      {lista === null && (
        <div className="mt-6 rounded-xl border border-g-amber/30 bg-g-amber/10 p-4 text-[13px] text-g-amber">
          {c.falhou}{motivo ? <span className="block mt-1 text-[11.5px] opacity-80">{motivo}</span> : null}
        </div>
      )}
      {Array.isArray(lista) && lista.length === 0 && <div className="mt-6 text-sm text-g-muted">{c.vazio}</div>}

      {/* ⚠️ SEPARAÇÃO POR ESTADO REAL, NÃO POR PONTUAÇÃO (Luis 25/08: "falta a parte dos
          enviados"). A lista vinha ordenada só por dor medida e o vendedor não conseguia ver
          quem já tinha o e-mail dele na caixa — que é o sinal de compra mais forte que existe
          aqui. Duas seções nomeadas: quem já foi tocado, e quem ainda é frio. */}
      {Array.isArray(lista) && lista.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-muted">{c.filtroT}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[null, "brain", "ad", "build"].map((k) => {
              const n = k === null ? lista.length : lista.filter((x) => precisaDe(x).includes(k)).length;
              const on = perna === k;
              return (
                <button key={k || "todos"} type="button" onClick={() => setPerna(k)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${on ? "border-g-green/60 bg-g-green/15 text-g-green" : "border-g-line bg-white/[0.04] text-g-muted hover:text-g-ink"}`}>
                  {k === null ? c.todos : c.pernaNome[k]} <span className="tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {Array.isArray(lista) && lista.length > 0 && (() => {
        const q = busca.trim().toLowerCase();
        const dig = q.replace(/\D/g, "");
        // Telefone casa por DÍGITO: o lead está "+1212…" e o vendedor digita "(212) 254-8174".
        const casa = (x) => {
          if (!q) return true;
          const txt = `${x.business} ${x.email || ""} ${x.phone || ""} ${x.preview_site || ""} ${x.categoria || ""}`.toLowerCase();
          if (txt.includes(q)) return true;
          return dig.length >= 3 && `${x.phone || ""}`.replace(/\D/g, "").includes(dig);
        };
        const porBusca = lista.filter(casa);
        const visivel = perna ? porBusca.filter((x) => precisaDe(x).includes(perna)) : porBusca;
        /* ORDEM POR PRONTIDÃO (Luis 26/08: «os leads atendem e querem receber o preview»).
           1º quem já TEM preview no ar — basta ligar e mandar o link.
           2º quem já recebeu e-mail. 3º frios. 4º os incompletos, que antes SUMIAM da tela:
           o `stage='new'` escondia todo lead já abordado — inclusive os dois prontos. */
        const prontos = visivel.filter((x) => x.preview_pronto);
        const quentes = visivel.filter((x) => !x.preview_pronto && x.contatado && !x.falta_fone);
        const frios = visivel.filter((x) => !x.preview_pronto && !x.contatado && !x.falta_fone);
        const faltando = visivel.filter((x) => !x.preview_pronto && x.falta_fone);
        if (visivel.length === 0) return <div className="mt-6 text-sm text-g-muted">{c.vazioFiltro}</div>;
        const secao = (titulo, itens, base, nota) => itens.length === 0 ? null : (
          <div className="mt-6">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[12px] font-black uppercase tracking-wider text-g-muted">{titulo}</h2>
              <span className="text-[12px] tabular-nums text-g-muted/70">{itens.length}</span>
            </div>
            {nota && <p className="mt-1 text-[12px] leading-relaxed text-g-muted">{nota}</p>}
            <div className="mt-3 space-y-2.5">{itens.map((p, k) => cartao(p, base + k))}</div>
          </div>
        );
        return (<>
          {/* A BARRA (Luis 26/08). Fila de 40 sem busca = rolar procurando com o olho enquanto o
              cliente espera no telefone. Sempre visível: some só quando não há lista nenhuma. */}
          <div className="relative mb-3">
            <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] opacity-60">🔎</span>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder={c.buscaPh} aria-label={c.buscaPh}
              className="min-h-[48px] w-full rounded-full border border-white/12 bg-white/[0.04] pl-11 pr-24 text-[14px] text-g-word placeholder:text-g-muted/60 focus:border-g-green/50 focus:outline-none" />
            {busca.trim() && (
              <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                <span className="text-[11.5px] font-bold tabular-nums text-g-muted">{c.buscaN(visivel.length, lista.length)}</span>
                <button type="button" onClick={() => setBusca("")} aria-label={c.buscaLimpa}
                  className="rounded-full px-2 py-1 text-[13px] text-g-muted hover:text-g-word">✕</button>
              </span>
            )}
          </div>
          {/* vazio DE BUSCA ≠ fila vazia — sem isto a tela some e parece que acabaram os leads */}
          {visivel.length === 0 && busca.trim() && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
              <div className="text-3xl">🔎</div>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-g-muted">{c.buscaVazia(busca.trim())}</p>
              <button type="button" onClick={() => setBusca("")}
                className="mt-3 inline-flex min-h-[44px] items-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-[13px] font-bold text-g-word hover:border-g-green/40">✕ {c.buscaLimpa}</button>
            </div>
          )}
          {secao(c.prontosT, prontos, 0, c.prontosNota)}
          {secao(c.quentesT, quentes, prontos.length, c.quenteNota)}
          {secao(c.friosT, frios, prontos.length + quentes.length, null)}
          {secao(c.faltaT, faltando, prontos.length + quentes.length + frios.length, c.faltaNota)}
        </>);
      })()}

    </div>
  );
}
