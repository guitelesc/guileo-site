import { useState } from "react";
import { NOT_MEASURED, PERDA, GANHO } from "../lib/reportScale.js";
import SellerFunnelButton from "./SellerFunnelButton.jsx";

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// FILA DE ATAQUE — a vizinhança do prospect, medida, ordenada pelo BURACO.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE: o bloco de concorrentes do relatório e a prospecção são o MESMO motor virado
// para dois lados (ver o cabeçalho de functions/api/prospeccao.js). Para provar o buraco de UM
// negócio, o motor já mede 9 vizinhos reais — mesma categoria, mesma rua, com nome, nota e site.
// Essa lista é a lista de prospects mais quente que existe. Esta aba é só a porta dela.
//
// ⚠️ AS LEIS DESTA TELA (skill growth-report, seção 3 — valem aqui igual):
//   1. `buraco: null` mostra o MOTIVO em cinza, nunca 0. Zero medido é zero; ausência é ausência.
//   2. mediana `null` (amostra < 3) é dita na cara: "não dá mediana honesta com N vizinhos".
//   3. FERIDA (vermelho/PERDA) e FORÇA (verde/GANHO) são listas SEPARADAS e nunca se misturam.
//      Foi um bug real: o HoneyBliss tinha 450 avaliações contra mediana 195 e isso apareceu no
//      topo da lista de "sinais" — o vendedor abriria a conversa cutucando o ponto FORTE dele.
//   4. NOME e DOMÍNIO não são a mesma coisa. Sem confirmação do Google, o identificador é o
//      domínio (que é fato) e o nome raspado do site vai à parte, rotulado. Já saiu "Best Salon
//      in Manhattan, NYC" como se fosse nome de empresa — é texto de SEO.
//   5. A FRASE DE ABERTURA é montada SÓ com os textos que vieram em `buracos`. Nada de dinheiro:
//      o "$ em risco" do X-Ray sai de ligações/mês × ticket médio, dois dados INTERNOS que um
//      prospect frio não tem. Inventar cifra aqui derruba a credibilidade da página inteira.
//
// ⚖️ MEDE, NÃO CONTATA. Nenhuma linha desta tela manda mensagem, liga ou cria lead. Medir dado
// público é uma coisa; abordar é outra e passa pelo funil com consentimento.
//
// 📝 Os textos de `buracos`/`forcas` vêm do motor SEMPRE em português (são literais em
// prospeccao.js). A tela diz isso em vez de fingir que traduziu — por isso a nota `fraseNota`.

const U = {
  pt: {
    mBairro: "Por bairro", mSite: "Por site", catL: "Tipo de negócio", catPh: "dentist, plumber, restaurant…", locL: "Bairro / cidade", locPh: "Astoria, Queens, NY", buscarB: "Buscar no bairro", erroBairro: "Preciso do tipo de negócio E do bairro.", salvar: "➕ Minha fila", salvo: "Na fila ✓", salvoErr: "Não gravou", notaBuraco: "Buraco medido", notaRel: "Relatório",
    h: "Fila de ataque", sub: "Cole um site — o motor mede a vizinhança dele e devolve os vizinhos ordenados pelo buraco.",
    site: "Site do cliente ou de um concorrente", sitePh: "naturaspanyc.com",
    ver: "Ver a vizinhança", vendo: "Buscando a vizinhança no Google…",
    categoria: "Categoria detectada", mediana: "Mediana de avaliações", amostra: "Amostra",
    amostraN: (n) => `${n} vizinho${n === 1 ? "" : "s"}`,
    semMediana: (n) => `sem mediana honesta — a amostra tem ${n} vizinho${n === 1 ? "" : "s"} e o piso é 3`,
    vizinhos: "Vizinhos encontrados",
    semSite: "sem site publicado — o X-Ray lê o site, então este não dá pra medir",
    medir: (n) => `Medir os ${n} mensuráveis`, medindo: "Medindo…",
    prog: (f, t) => `${f} de ${t} medidos`,
    loteNota: "O motor mede 3 por chamada (teto de CPU do Worker). A tela chama quantas vezes precisar.",
    nadaMensuravel: "Nenhum vizinho tem site publicado — não há o que medir.",
    fila: "A fila, do maior buraco pro menor",
    buraco: "Buraco", feridas: "Feridas (a abertura da conversa)", forcas: "Forças (não cutuque)",
    naoMedido: "não medido", semFicha: "sem ficha do Google",
    nomeNaoConf: "nome no site, não confirmado",
    fonte: "Ficha via", reaproveitado: "medição recente reaproveitada",
    relatorio: "abrir relatório", copiarLink: "📋 Copiar link", copiado: "Copiado ✓",
    frase: "Frase de abertura", copiarFrase: "📋 Copiar frase",
    fraseNota: "Montada só com o que foi medido. Os textos saem do motor em português.",
    fraseOi: (n) => `Oi! Dei uma olhada rápida no ${n} e em quem está na mesma rua.`,
    fraseFim: "Posso te mostrar isso em 5 minutos?",
    falhou: "Não deu pra medir",
    aviso: "Esta tela MEDE dado público (Google + site). Ela não contata ninguém: abordagem passa pelo funil, com consentimento.",
    erroSite: "Informe um site.",
    erroAuth: "Sua sessão expirou — saia e entre de novo.",
    erroRede: "Erro de rede — não deu pra falar com o motor.",
  },
  en: {
    mBairro: "By neighborhood", mSite: "By website", catL: "Business type", catPh: "dentist, plumber, restaurant…", locL: "Neighborhood / city", locPh: "Astoria, Queens, NY", buscarB: "Search the neighborhood", erroBairro: "I need the business type AND the neighborhood.", salvar: "➕ My queue", salvo: "In queue ✓", salvoErr: "Not saved", notaBuraco: "Measured gap", notaRel: "Report",
    h: "Attack queue", sub: "Paste a website — the engine measures its neighborhood and returns the neighbors ranked by the hole.",
    site: "Client's or a competitor's website", sitePh: "naturaspanyc.com",
    ver: "See the neighborhood", vendo: "Looking up the neighborhood on Google…",
    categoria: "Detected category", mediana: "Median reviews", amostra: "Sample",
    amostraN: (n) => `${n} neighbor${n === 1 ? "" : "s"}`,
    semMediana: (n) => `no honest median — the sample has ${n} neighbor${n === 1 ? "" : "s"} and the floor is 3`,
    vizinhos: "Neighbors found",
    semSite: "no published website — the X-Ray reads the site, so this one can't be measured",
    medir: (n) => `Measure the ${n} measurable`, medindo: "Measuring…",
    prog: (f, t) => `${f} of ${t} measured`,
    loteNota: "The engine measures 3 per call (Worker CPU cap). The screen calls as many times as needed.",
    nadaMensuravel: "No neighbor has a published website — there is nothing to measure.",
    fila: "The queue, biggest hole first",
    buraco: "Hole", feridas: "Wounds (your opening)", forcas: "Strengths (don't poke)",
    naoMedido: "not measured", semFicha: "no Google listing",
    nomeNaoConf: "name on the site, unconfirmed",
    fonte: "Listing via", reaproveitado: "recent measurement reused",
    relatorio: "open report", copiarLink: "📋 Copy link", copiado: "Copied ✓",
    frase: "Opening line", copiarFrase: "📋 Copy line",
    fraseNota: "Built only from what was measured. The texts come from the engine in Portuguese.",
    fraseOi: (n) => `Hi! I took a quick look at ${n} and at who is on the same street.`,
    fraseFim: "Can I show you this in 5 minutes?",
    falhou: "Couldn't measure",
    aviso: "This screen MEASURES public data (Google + website). It contacts no one: outreach goes through the funnel, with consent.",
    erroSite: "Enter a website.",
    erroAuth: "Your session expired — log out and back in.",
    erroRede: "Network error — couldn't reach the engine.",
  },
  es: {
    mBairro: "Por barrio", mSite: "Por sitio", catL: "Tipo de negocio", catPh: "dentist, plumber, restaurant…", locL: "Barrio / ciudad", locPh: "Astoria, Queens, NY", buscarB: "Buscar en el barrio", erroBairro: "Necesito el tipo de negocio Y el barrio.", salvar: "➕ Mi fila", salvo: "En la fila ✓", salvoErr: "No se guardó", notaBuraco: "Hueco medido", notaRel: "Informe",
    h: "Fila de ataque", sub: "Pega un sitio — el motor mide su vecindario y devuelve los vecinos ordenados por el hueco.",
    site: "Sitio del cliente o de un competidor", sitePh: "naturaspanyc.com",
    ver: "Ver el vecindario", vendo: "Buscando el vecindario en Google…",
    categoria: "Categoría detectada", mediana: "Mediana de reseñas", amostra: "Muestra",
    amostraN: (n) => `${n} vecino${n === 1 ? "" : "s"}`,
    semMediana: (n) => `sin mediana honesta — la muestra tiene ${n} vecino${n === 1 ? "" : "s"} y el piso es 3`,
    vizinhos: "Vecinos encontrados",
    semSite: "sin sitio publicado — el X-Ray lee el sitio, así que este no se puede medir",
    medir: (n) => `Medir los ${n} medibles`, medindo: "Midiendo…",
    prog: (f, t) => `${f} de ${t} medidos`,
    loteNota: "El motor mide 3 por llamada (tope de CPU del Worker). La pantalla llama las veces que haga falta.",
    nadaMensuravel: "Ningún vecino tiene sitio publicado — no hay qué medir.",
    fila: "La fila, del hueco mayor al menor",
    buraco: "Hueco", feridas: "Heridas (tu apertura)", forcas: "Fortalezas (no toques)",
    naoMedido: "no medido", semFicha: "sin ficha de Google",
    nomeNaoConf: "nombre en el sitio, no confirmado",
    fonte: "Ficha vía", reaproveitado: "medición reciente reutilizada",
    relatorio: "abrir informe", copiarLink: "📋 Copiar enlace", copiado: "Copiado ✓",
    frase: "Frase de apertura", copiarFrase: "📋 Copiar frase",
    fraseNota: "Armada solo con lo medido. Los textos salen del motor en portugués.",
    fraseOi: (n) => `¡Hola! Le eché un vistazo a ${n} y a quienes están en la misma calle.`,
    fraseFim: "¿Te lo muestro en 5 minutos?",
    falhou: "No se pudo medir",
    aviso: "Esta pantalla MIDE dato público (Google + sitio). No contacta a nadie: el acercamiento pasa por el embudo, con consentimiento.",
    erroSite: "Ingresa un sitio.",
    erroAuth: "Tu sesión expiró — sal y entra de nuevo.",
    erroRede: "Error de red — no se pudo hablar con el motor.",
  },
  hi: {
    mBairro: "इलाक़े से", mSite: "साइट से", catL: "व्यवसाय का प्रकार", catPh: "dentist, plumber, restaurant…", locL: "इलाक़ा / शहर", locPh: "Astoria, Queens, NY", buscarB: "इलाक़े में खोजें", erroBairro: "मुझे व्यवसाय का प्रकार और इलाक़ा दोनों चाहिए।", salvar: "➕ मेरी सूची", salvo: "सूची में ✓", salvoErr: "सेव नहीं हुआ", notaBuraco: "मापा गया अंतर", notaRel: "रिपोर्ट",
    h: "अटैक क्यू", sub: "एक वेबसाइट डालें — इंजन उसके पड़ोस को मापता है और पड़ोसियों को छेद के हिसाब से क्रम में लौटाता है।",
    site: "क्लाइंट या प्रतिस्पर्धी की वेबसाइट", sitePh: "naturaspanyc.com",
    ver: "पड़ोस देखें", vendo: "Google पर पड़ोस खोजा जा रहा है…",
    categoria: "पहचानी गई श्रेणी", mediana: "समीक्षाओं का मध्यक", amostra: "नमूना",
    amostraN: (n) => `${n} पड़ोसी`,
    semMediana: (n) => `ईमानदार मध्यक नहीं — नमूने में ${n} पड़ोसी हैं और न्यूनतम 3 है`,
    vizinhos: "मिले पड़ोसी",
    semSite: "कोई प्रकाशित वेबसाइट नहीं — X-Ray साइट पढ़ता है, इसलिए इसे मापा नहीं जा सकता",
    medir: (n) => `${n} मापने-योग्य को मापें`, medindo: "मापा जा रहा है…",
    prog: (f, t) => `${t} में से ${f} मापे गए`,
    loteNota: "इंजन हर कॉल में 3 मापता है (Worker CPU सीमा)। स्क्रीन जितनी बार ज़रूरी हो कॉल करती है।",
    nadaMensuravel: "किसी पड़ोसी की वेबसाइट प्रकाशित नहीं है — मापने को कुछ नहीं है।",
    fila: "कतार, सबसे बड़ा छेद पहले",
    buraco: "छेद", feridas: "घाव (बातचीत की शुरुआत)", forcas: "ताकत (इन्हें न छेड़ें)",
    naoMedido: "मापा नहीं गया", semFicha: "कोई Google लिस्टिंग नहीं",
    nomeNaoConf: "साइट पर लिखा नाम, अपुष्ट",
    fonte: "लिस्टिंग स्रोत", reaproveitado: "हाल की माप दोबारा इस्तेमाल हुई",
    relatorio: "रिपोर्ट खोलें", copiarLink: "📋 लिंक कॉपी करें", copiado: "कॉपी ✓",
    frase: "शुरुआती वाक्य", copiarFrase: "📋 वाक्य कॉपी करें",
    fraseNota: "सिर्फ़ मापे गए डेटा से बना। ये टेक्स्ट इंजन से पुर्तगाली में आते हैं।",
    fraseOi: (n) => `नमस्ते! मैंने ${n} और उसी गली के बाकी कारोबारों पर एक नज़र डाली।`,
    fraseFim: "क्या मैं आपको 5 मिनट में यह दिखा सकता हूँ?",
    falhou: "मापा नहीं जा सका",
    aviso: "यह स्क्रीन सार्वजनिक डेटा (Google + वेबसाइट) मापती है। यह किसी से संपर्क नहीं करती: संपर्क सहमति के साथ फ़नल से होता है।",
    erroSite: "एक वेबसाइट डालें।",
    erroAuth: "आपका सेशन समाप्त हो गया — दोबारा लॉगिन करें।",
    erroRede: "नेटवर्क त्रुटि — इंजन से बात नहीं हो सकी।",
  },
};

// O MESMO teto do backend (POR_LOTE em prospeccao.js). Se lá mudar, muda aqui: mandar 5 não
// mede 5 — o backend corta em 3 com `.slice(POR_LOTE)` e os 2 extras somem SEM erro. Um lote
// maior aqui viraria "sumiço silencioso", que é exatamente o defeito que esta tela combate.
const LOTE = 3;

const origem = () => (typeof window !== "undefined" && window.location?.origin) || "https://guileoai.com";

export default function SellerProspeccao({ lang = "pt", sid = "", seller = null, market = "us" }) {
  const t = U[lang] || U.pt;

  const [site, setSite] = useState("");
  const [viz, setViz] = useState(null);          // resposta da ação 1
  const [buscando, setBuscando] = useState(false);
  const [medindo, setMedindo] = useState(false);
  const [prog, setProg] = useState({ feitos: 0, total: 0 });
  const [fila, setFila] = useState([]);          // acumula os itens da ação 2, lote a lote
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState("");    // chave do que foi copiado agora

  const copiar = (texto, chave) => {
    navigator.clipboard?.writeText(texto);
    setCopiado(chave); setTimeout(() => setCopiado(""), 1500);
  };

  // MODO BAIRRO (2026-08-20): abrir um bairro NOVO, sem depender de conhecer um negócio dele.
  // O território do vendedor é "NYC, todos os bairros" — partir sempre de um site semente obriga
  // ele a já ter um cliente na rua que quer atacar, que é exatamente o que ele ainda não tem.
  const [modo, setModo] = useState("bairro"); // "bairro" | "site"
  const [categoria, setCategoria] = useState("");
  const [local, setLocal] = useState("");
  const [salvos, setSalvos] = useState({});   // dominio → "ok" | "err" | "busy"

  const buscarBairro = async () => {
    const c = categoria.trim(), l = local.trim();
    if (!c || !l) { setErro(t.erroBairro); return; }
    setBuscando(true); setErro(""); setViz(null); setFila([]); setProg({ feitos: 0, total: 0 });
    try {
      const r = await fetch("/api/prospeccao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "busca", categoria: c, local: l, sid }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) { setErro(t.erroAuth); return; }
      if (!d.ok) { setErro(d.motivo || d.erro || `HTTP ${r.status}`); return; }
      setViz(d);
    } catch { setErro(t.erroRede); }
    finally { setBuscando(false); }
  };

  // ── A PONTA QUE FALTAVA: MEDIR E NÃO GRAVAR DEIXAVA A FILA VAZIA ──────────────────────────
  // O motor media, mostrava na tela, e acabava ali. O vendedor fechava a aba e perdia tudo — a
  // fila dele continuava zerada mesmo depois de pagar a medição ao Google. Agora o resultado vira
  // prospect DELE, com telefone (o botão de ligar) e o link do relatório na nota (o que dizer).
  const salvarNaFila = async (item) => {
    const chave = item.dominio || item.site;
    setSalvos((m) => ({ ...m, [chave]: "busy" }));
    try {
      const linhas = [];
      if (item.buraco != null) linhas.push(`${t.notaBuraco}: ${item.buraco}`);
      if (Array.isArray(item.buracos)) linhas.push(...item.buracos.filter((x) => typeof x === "string").slice(0, 3));
      if (item.nota != null || item.avaliacoes != null) linhas.push(`Google: ${item.nota ?? "—"}★ · ${item.avaliacoes ?? "—"}`);
      if (item.link) linhas.push(`${t.notaRel}: ${origem()}${item.link}`);
      if (item.endereco) linhas.push(item.endereco);
      const r = await fetch("/api/seller-prospects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert", sid,
          prospect: {
            business: item.business || item.dominio || "",
            phone: item.telefone || "",
            stage: "new",
            note: linhas.join("\n").slice(0, 1500),
            market,
          },
        }),
      });
      const d = await r.json().catch(() => ({}));
      // 🚨 comprovante: só declaro salvo com a linha que o banco devolveu.
      setSalvos((m) => ({ ...m, [chave]: (r.ok && d.ok && d.prospect) ? "ok" : "err" }));
    } catch { setSalvos((m) => ({ ...m, [chave]: "err" })); }
  };

  // ── AÇÃO 1 ────────────────────────────────────────────────────────────────────────────────
  const verVizinhanca = async () => {
    const s = site.trim();
    if (!s) { setErro(t.erroSite); return; }
    setBuscando(true); setErro(""); setViz(null); setFila([]); setProg({ feitos: 0, total: 0 });
    try {
      const r = await fetch("/api/prospeccao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "vizinhanca", site: s, sid }),
      });
      const d = await r.json().catch(() => ({}));
      // Ler a RESPOSTA, não só o status: o motor devolve 200 com `ok:false` + `motivo` quando não
      // achou ficha/vizinhos. Confiar no 200 aqui deixaria a tela vazia e muda.
      if (r.status === 401) { setErro(t.erroAuth); return; }
      if (!d.ok) { setErro(d.motivo || d.erro || `HTTP ${r.status}`); return; }
      setViz(d);
    } catch { setErro(t.erroRede); }
    finally { setBuscando(false); }
  };

  // ── AÇÃO 2, EM LOTES DE 3 ─────────────────────────────────────────────────────────────────
  // Progresso REAL: só sobe quando um lote VOLTA. Uma barra que anda sozinha enquanto o Worker
  // pensa é a mesma mentira de um "ok" sem comprovante — se um lote morrer, o número tem que
  // parar de andar, e o vendedor precisa ver onde parou.
  const medirTudo = async () => {
    if (!viz) return;
    const alvos = (viz.vizinhos || []).filter((v) => v.mensuravel && v.site);
    if (!alvos.length) return;
    setMedindo(true); setErro(""); setFila([]); setProg({ feitos: 0, total: alvos.length });
    try {
      for (let i = 0; i < alvos.length; i += LOTE) {
        const lote = alvos.slice(i, i + LOTE);
        const r = await fetch("/api/prospeccao", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acao: "medir",
            // ⚠️ os OBJETOS inteiros, não só as URLs: eles carregam nome/nota/avaliações que a
            // ação 1 já pagou ao Google. Mandar só a URL devolve prospect SEM número — e é o
            // número ("você tem 16, a sua rua tem 195") que abre a porta.
            vizinhos: lote,
            mediana_avaliacoes: viz.mediana_avaliacoes,
            lang, sid,
          }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 401) { setErro(t.erroAuth); break; }
        if (!d.ok) { setErro(d.motivo || d.erro || `HTTP ${r.status}`); break; }
        setFila((prev) => [...prev, ...(d.fila || [])]);
        setProg({ feitos: Math.min(i + lote.length, alvos.length), total: alvos.length });
      }
    } catch { setErro(t.erroRede); }
    finally { setMedindo(false); }
  };

  // A fila só é ordenada AQUI, com tudo na mão: o backend ordena dentro de cada lote, e três
  // lotes ordenados em sequência não formam uma lista ordenada.
  // `buraco: null` vai pro fim (-1), nunca vira 0 — ausência não compete com medição.
  const filaOrdenada = [...fila].sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    return (b.buraco ?? -1) - (a.buraco ?? -1);
  });

  const mensuraveis = (viz?.vizinhos || []).filter((v) => v.mensuravel && v.site).length;
  const field = "w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50";

  // A frase é montada SÓ com os textos que o motor devolveu em `buracos`. Nenhum número novo,
  // nenhum valor em dinheiro — o "$" do X-Ray depende de dados internos que prospect não tem.
  const fraseDe = (item) => {
    const quem = item.nome_confirmado ? item.business : item.dominio;
    const feridas = (item.buracos || []).slice(0, 2).map((b) => b.texto).filter(Boolean);
    if (!feridas.length) return "";
    return `${t.fraseOi(quem)} ${feridas.join("; ")}. ${t.fraseFim}`;
  };

  // ── O QUE VAI PRO FUNIL ───────────────────────────────────────────────────────────────────
  // business: o MESMO identificador que a tela mostra. Sem confirmação do Google vai o DOMÍNIO,
  // que é fato — nunca o nome raspado do site (já saiu "Best Salon in Manhattan, NYC" de lá).
  const nomeDoFunil = (item) => (item.nome_confirmado ? item.business : item.dominio) || item.dominio || item.site || "";
  // note: as FERIDAS medidas + o link do relatório. Zero cifra: o "$" depende de dados internos
  // que um prospect frio não tem, e inventá-lo derruba a página inteira.
  const notaDoFunil = (item, link) =>
    [...(item.buracos || []).map((b) => b.texto).filter(Boolean), link].filter(Boolean).join("\n");

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-extrabold text-g-word">🎯 {t.h}</div>
        <p className="mt-1 text-[12.5px] text-g-muted">{t.sub}</p>
      </div>

      {/* ── SEMENTE ──────────────────────────────────────────────────────────────────────── */}
      <div className="card p-5 min-w-0">
        {/* DOIS JEITOS DE ABRIR FILA: o bairro (território novo) e o site (a rua de um cliente). */}
        <div className="mb-3 inline-flex rounded-full border border-white/12 bg-white/[0.03] p-1">
          {[["bairro", t.mBairro], ["site", t.mSite]].map(([k, rot]) => (
            <button key={k} type="button" onClick={() => { setModo(k); setErro(""); }}
              className={`min-h-[40px] rounded-full px-4 text-[12.5px] font-bold transition ${modo === k ? "bg-g-green/20 text-g-word ring-1 ring-g-green/40" : "text-g-muted hover:text-g-word"}`}>
              {rot}
            </button>
          ))}
        </div>

        {modo === "bairro" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] text-g-muted">{t.catL}
              <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder={t.catPh}
                onKeyDown={(e) => { if (e.key === "Enter") buscarBairro(); }} className={field} />
            </label>
            <label className="block text-[11px] text-g-muted">{t.locL}
              <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder={t.locPh}
                onKeyDown={(e) => { if (e.key === "Enter") buscarBairro(); }} className={field} />
            </label>
          </div>
        ) : (
          <label className="block text-[11px] text-g-muted">{t.site}
            <input value={site} onChange={(e) => setSite(e.target.value)} placeholder={t.sitePh}
              onKeyDown={(e) => { if (e.key === "Enter") verVizinhanca(); }} className={field} />
          </label>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={modo === "bairro" ? buscarBairro : verVizinhanca} disabled={buscando || medindo} className="btn-bright text-[13px] disabled:opacity-50">
            {buscando ? "…" : (modo === "bairro" ? t.buscarB : t.ver)}
          </button>
          {buscando && (
            <span className="inline-flex items-center gap-2 text-[12px] text-g-muted">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-g-green/30 border-t-g-green" />
              {t.vendo}
            </span>
          )}
        </div>

        {/* ⚖️ o limite desta tela, escrito nela mesma */}
        <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11.5px] leading-relaxed text-g-muted">
          ⚖️ {t.aviso}
        </p>

        {erro && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">{erro}</p>
        )}
      </div>

      {/* ── A VIZINHANÇA ─────────────────────────────────────────────────────────────────── */}
      {viz && (
        <div className="card mt-4 p-5 min-w-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 backdrop-blur-xl">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.categoria}</div>
              <div className="mt-1 text-[14px] font-black text-g-word">
                {viz.categoria || <span style={{ color: NOT_MEASURED }}>— {t.naoMedido}</span>}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 backdrop-blur-xl">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.mediana}</div>
              {/* piso de 3: sem amostra que sustente, NÃO existe mediana honesta — e a tela diz
                  isso, em vez de mostrar um número que ninguém pode defender. */}
              {viz.mediana_avaliacoes == null ? (
                <div className="mt-1 text-[11.5px] leading-snug" style={{ color: NOT_MEASURED }}>{t.semMediana(viz.amostra ?? 0)}</div>
              ) : (
                <div className="mt-1 text-[22px] font-black tabular-nums text-g-word">{viz.mediana_avaliacoes}</div>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 backdrop-blur-xl">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.amostra}</div>
              <div className="mt-1 text-[14px] font-black text-g-word">{t.amostraN(viz.amostra ?? 0)}</div>
            </div>
          </div>

          <div className="mt-4 text-[12px] font-bold uppercase tracking-wide text-g-muted">{t.vizinhos}</div>
          <div className="mt-2 space-y-1.5">
            {(viz.vizinhos || []).map((v, i) => (
              <div key={`${v.site || v.nome}-${i}`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] text-g-word">{v.nome || v.site}</div>
                  {/* sem site NÃO some da lista: sumir com ele esconde parte da rua */}
                  {!v.mensuravel && <div className="text-[11px]" style={{ color: NOT_MEASURED }}>{t.semSite}</div>}
                </div>
                <div className="shrink-0 text-[11.5px] tabular-nums text-g-muted">
                  {v.nota == null && v.avaliacoes == null
                    ? <span style={{ color: NOT_MEASURED }}>{t.semFicha}</span>
                    : <>{v.nota != null && <span className="font-bold text-g-word">{v.nota}★</span>}{v.avaliacoes != null && <span> · {v.avaliacoes}</span>}</>}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {mensuraveis > 0 ? (
              <button onClick={medirTudo} disabled={medindo} className="btn-bright text-[13px] disabled:opacity-50">
                {medindo ? t.medindo : t.medir(mensuraveis)}
              </button>
            ) : (
              <span className="text-[12px]" style={{ color: NOT_MEASURED }}>{t.nadaMensuravel}</span>
            )}
            {prog.total > 0 && (
              <span className="inline-flex items-center gap-2 text-[12px] text-g-muted">
                {medindo && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-g-green/30 border-t-g-green" />}
                <span className="tabular-nums font-bold text-g-word">{t.prog(prog.feitos, prog.total)}</span>
              </span>
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-g-muted">{t.loteNota}</div>
        </div>
      )}

      {/* ── A FILA ───────────────────────────────────────────────────────────────────────── */}
      {filaOrdenada.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-g-muted">{t.fila}</div>
          <div className="space-y-3">
            {filaOrdenada.map((item, i) => {
              if (!item.ok) {
                // falhou não some da fila: sumir é pior que aparecer com o defeito declarado
                return (
                  <div key={`${item.dominio}-${i}`} className="card p-4 min-w-0" style={{ borderColor: `${PERDA}33` }}>
                    <div className="text-[13px] font-bold text-g-word break-all">{item.dominio || item.site}</div>
                    <div className="mt-1 text-[12px]" style={{ color: PERDA }}>{t.falhou}: <span className="text-g-muted">{item.motivo || "—"}</span></div>
                  </div>
                );
              }
              const link = `${origem()}${item.link}`;
              const frase = fraseDe(item);
              const estadoSalvo = salvos[item.dominio || item.site];
              return (
                <div key={item.id || `${item.dominio}-${i}`} className="card p-4 min-w-0">
                  {/* ── cabeçalho: quem é, e o buraco ── */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {/* NOME vs DOMÍNIO — nunca tratados como a mesma coisa */}
                      <div className="break-words text-[14px] font-extrabold text-g-word">
                        {item.nome_confirmado ? item.business : item.dominio}
                      </div>
                      {!item.nome_confirmado && item.nome_no_site && (
                        <div className="mt-0.5 text-[11px]" style={{ color: NOT_MEASURED }}>
                          ⚠️ {t.nomeNaoConf}: “{item.nome_no_site}”
                        </div>
                      )}
                      <div className="mt-0.5 break-all text-[11px] text-g-muted">{item.dominio}</div>
                      {/* TELEFONE: o dado que transforma uma lista de leitura em fila de ataque.
                          Vem da MESMA consulta que trouxe o nome — nunca de outra fonte. */}
                      {item.telefone && (
                        <a href={`tel:${String(item.telefone).replace(/[^0-9]/g, "")}`}
                          className="mt-1 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-g-green/15 px-3 text-[12px] font-bold text-g-green ring-1 ring-g-green/40 hover:bg-g-green/25">
                          📞 {item.telefone}
                        </a>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] tabular-nums">
                        {item.nota == null && item.avaliacoes == null ? (
                          <span style={{ color: NOT_MEASURED }}>{t.naoMedido}</span>
                        ) : (
                          <>
                            {item.nota != null && <span className="font-bold text-g-word">{item.nota}★</span>}
                            {item.avaliacoes != null && <span className="text-g-muted">· {item.avaliacoes}</span>}
                          </>
                        )}
                        {item.fonte_da_ficha && <span className="text-g-muted">· {t.fonte} {item.fonte_da_ficha}</span>}
                        {item.reaproveitado && <span className="text-g-muted">· {t.reaproveitado}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {/* ➕ MINHA FILA — sem isto o motor media, mostrava e esquecia: o vendedor
                          fechava a aba e a fila dele continuava zerada depois de pagar a medição. */}
                      <button type="button" onClick={() => salvarNaFila(item)} disabled={estadoSalvo === "busy" || estadoSalvo === "ok"}
                        className={`mb-2 inline-flex min-h-[40px] items-center rounded-full px-3 text-[12px] font-bold ring-1 transition ${
                          estadoSalvo === "ok" ? "bg-g-green/20 text-g-green ring-g-green/40"
                          : estadoSalvo === "err" ? "bg-[#e0855f]/15 text-[#e0855f] ring-[#e0855f]/40"
                          : "bg-white/[0.05] text-g-word ring-white/15 hover:bg-white/[0.09]"}`}>
                        {estadoSalvo === "ok" ? t.salvo : estadoSalvo === "err" ? t.salvoErr : estadoSalvo === "busy" ? "…" : t.salvar}
                      </button>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-g-muted">{t.buraco}</div>
                      {/* null → o MOTIVO em cinza. Nunca 0: 0 afirmaria "não tem buraco". */}
                      {item.buraco == null ? (
                        <div className="max-w-[170px] text-[11px] leading-snug" style={{ color: NOT_MEASURED }}>
                          {item.buraco_motivo || t.naoMedido}
                        </div>
                      ) : (
                        <div className="text-[26px] font-black tabular-nums" style={{ color: PERDA }}>{item.buraco}</div>
                      )}
                    </div>
                  </div>

                  {/* ── FERIDAS (vermelho) e FORÇAS (verde): duas listas, nunca uma ── */}
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(item.buracos || []).length > 0 && (
                      <div className="rounded-lg border px-3 py-2" style={{ borderColor: `${PERDA}40`, background: `${PERDA}10` }}>
                        <div className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: PERDA }}>{t.feridas}</div>
                        <ul className="mt-1 space-y-0.5">
                          {item.buracos.map((b, k) => (
                            <li key={b.chave || k} className="text-[12px] leading-snug text-g-word">• {b.texto}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(item.forcas || []).length > 0 && (
                      <div className="rounded-lg border px-3 py-2" style={{ borderColor: `${GANHO}40`, background: `${GANHO}10` }}>
                        <div className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: GANHO }}>{t.forcas}</div>
                        <ul className="mt-1 space-y-0.5">
                          {item.forcas.map((f, k) => (
                            <li key={f.chave || k} className="text-[12px] leading-snug text-g-word">• {f.texto}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* ── A FRASE, montada só com as feridas medidas ── */}
                  {frase && (
                    <div className="mt-3">
                      <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.frase}</div>
                      <div className="mt-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[12.5px] leading-relaxed text-g-word">{frase}</div>
                      <div className="mt-1 text-[11px]" style={{ color: NOT_MEASURED }}>{t.fraseNota}</div>
                    </div>
                  )}

                  {/* ── o link do relatório ── */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a href={link} target="_blank" rel="noopener" className="btn-ghost text-[12.5px]">↗ {t.relatorio}</a>
                    <button onClick={() => copiar(link, `l${item.id}`)} className="btn-ghost text-[12.5px]">
                      {copiado === `l${item.id}` ? t.copiado : t.copiarLink}
                    </button>
                    {frase && (
                      <button onClick={() => copiar(frase, `f${item.id}`)} className="btn-ghost text-[12.5px]">
                        {copiado === `f${item.id}` ? t.copiado : t.copiarFrase}
                      </button>
                    )}
                    {/* ➕ a porta do funil: leva ESTE prospect medido pro SellerFollowup, 1ª etapa */}
                    <SellerFunnelButton
                      lang={lang} seller={seller} market={market}
                      business={nomeDoFunil(item)}
                      note={notaDoFunil(item, link)}
                    />
                  </div>
                  <div className="mt-1.5 break-all font-mono text-[10.5px] text-g-muted">{link}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
