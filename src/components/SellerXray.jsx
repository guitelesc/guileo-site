import { useState } from "react";
import { fmtMoney, NOT_MEASURED, PERDA } from "../lib/reportScale.js";
import SellerFunnelButton from "./SellerFunnelButton.jsx";

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// GUILEO X-RAY no hub do vendedor — o produto de entrada, gerado SEM o Luis.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE: o X-Ray (o relatório MEDIDO em /apresentacao/:id) só nascia quando o Luis o
// gerava à mão. Isso trava receita: o vendedor tem a reunião, promete o raio-X e depois espera.
// Aqui ele roda sozinho — cola o site do prospect, gera, e sai da tela com o link pronto.
//
// BACKEND JÁ EXISTIA: POST /api/avaliacao com o crachá do vendedor (sid, assinado no login e
// verificado em lib/sellerSession.js). Nada de endpoint novo — esta aba é só a porta.
//
// ⚠️ AS DUAS LEIS DESTA SUPERFÍCIE (skill growth-report, seção 3):
//   1. o que o motor NÃO mediu aparece como "não medido" em CINZA — nunca 0, nunca sumido.
//      0 afirma "não há risco"; a verdade é "não deu pra medir". São coisas diferentes.
//   2. todo número de dinheiro carrega a MOEDA e a PREMISSA embaixo. Número sem premissa é
//      chute com cara de medição — e é justamente onde o dono confere.
//
// ⚠️ A MARCA VIAJA NA URL, NÃO NO PAYLOAD. Regerar uma avaliação PERDE logo/accent (aconteceu
// com os dois relatórios da Natura em 2026-08-19: a extração do site simplesmente não repetiu e
// nada deu erro). Por isso os campos opcionais accent/logo/capa: eles entram no link montado, e
// aí o relatório pode ser regerado quantas vezes for sem perder a cara do cliente.

const U = {
  pt: {
    h: "Guileo X-Ray", sub: "Meça o negócio do prospect e saia com o link do relatório pronto pra mandar.",
    site: "Site do prospect", sitePh: "naturaspanyc.com",
    negocio: "Tipo de negócio (opcional)", negocioPh: "Ex: spa, barbearia, clínica",
    idioma: "Idioma do relatório", idiomaNota: "O motor escreve em 3 idiomas (pt · en · es).",
    contato: "Contato do prospect (opcional)", contatoPh: "e-mail ou telefone",
    gerar: "Gerar X-Ray", gerando: "Medindo o negócio… isso leva alguns segundos",
    marcaT: "A marca do cliente viaja no LINK, não no relatório.",
    marcaP: "Regerar uma avaliação perde logo e cor. Preencha aqui e eles entram na URL — aí você pode regerar à vontade sem o relatório perder a cara do cliente.",
    accent: "Cor do cliente (accent)", logo: "URL do logo", capa: "URL da capa",
    score: "Score geral", risco: "Receita em risco por mês", naoMedido: "não medido",
    semPremissa: "sem premissa gravada — trate como não medido",
    idAviso: "⚠️ Não deu pra confirmar que é este negócio",
    idQuem: (n) => `O site bloqueou nossa leitura, então a busca foi pelo domínio e o Google devolveu ${n ? `"${n}"` : "outro negócio"}. Confira o nome antes de mandar — se estiver errado, o relatório inteiro é sobre outra empresa.`,
    link: "Link pra mandar ao prospect", copiar: "📋 Copiar link", copiado: "Copiado ✓",
    abrir: "Abrir", negocioLbl: "Negócio",
    hist: "Gerados neste navegador", histNota: "Lista local (este navegador). Não existe hoje um endpoint que liste os X-Rays de um vendedor — então isto não é o histórico da conta.",
    limpar: "Limpar lista",
    erroSite: "Informe o site do prospect.",
    erroAuth: "Sua sessão expirou — saia e entre de novo pra gerar o X-Ray.",
    erroLer: "Não deu pra ler o site do prospect.",
    erroRede: "Erro de rede — não deu pra falar com o motor.",
  },
  en: {
    h: "Guileo X-Ray", sub: "Measure the prospect's business and walk away with the report link ready to send.",
    site: "Prospect website", sitePh: "naturaspanyc.com",
    negocio: "Business type (optional)", negocioPh: "e.g. spa, barbershop, clinic",
    idioma: "Report language", idiomaNota: "The engine writes in 3 languages (pt · en · es).",
    contato: "Prospect contact (optional)", contatoPh: "email or phone",
    gerar: "Generate X-Ray", gerando: "Measuring the business… this takes a few seconds",
    marcaT: "The client's brand travels in the LINK, not in the report.",
    marcaP: "Regenerating an evaluation loses logo and color. Fill these in and they go into the URL — then you can regenerate freely without the report losing the client's face.",
    accent: "Client color (accent)", logo: "Logo URL", capa: "Cover URL",
    score: "Overall score", risco: "Revenue at risk per month", naoMedido: "not measured",
    semPremissa: "no assumption stored — treat as not measured",
    idAviso: "⚠️ We could not confirm this is the right business",
    idQuem: (n) => `The site blocked our read, so the search fell back to the domain and Google returned ${n ? `"${n}"` : "another business"}. Check the name before you send — if it is wrong, the whole report is about a different company.`,
    link: "Link to send the prospect", copiar: "📋 Copy link", copiado: "Copied ✓",
    abrir: "Open", negocioLbl: "Business",
    hist: "Generated in this browser", histNota: "Local list (this browser). There is no endpoint today that lists a seller's X-Rays — so this is not the account history.",
    limpar: "Clear list",
    erroSite: "Enter the prospect's website.",
    erroAuth: "Your session expired — log out and back in to generate the X-Ray.",
    erroLer: "Couldn't read the prospect's website.",
    erroRede: "Network error — couldn't reach the engine.",
  },
  es: {
    h: "Guileo X-Ray", sub: "Mide el negocio del prospecto y sal con el enlace del informe listo para enviar.",
    site: "Sitio del prospecto", sitePh: "naturaspanyc.com",
    negocio: "Tipo de negocio (opcional)", negocioPh: "Ej: spa, barbería, clínica",
    idioma: "Idioma del informe", idiomaNota: "El motor escribe en 3 idiomas (pt · en · es).",
    contato: "Contacto del prospecto (opcional)", contatoPh: "e-mail o teléfono",
    gerar: "Generar X-Ray", gerando: "Midiendo el negocio… tarda unos segundos",
    marcaT: "La marca del cliente viaja en el ENLACE, no en el informe.",
    marcaP: "Regenerar una evaluación pierde logo y color. Complétalos aquí y entran en la URL — así puedes regenerar sin que el informe pierda la cara del cliente.",
    accent: "Color del cliente (accent)", logo: "URL del logo", capa: "URL de la portada",
    score: "Score general", risco: "Ingresos en riesgo por mes", naoMedido: "no medido",
    semPremissa: "sin premisa guardada — trátalo como no medido",
    idAviso: "⚠️ No pudimos confirmar que sea este negocio",
    idQuem: (n) => `El sitio bloqueó nuestra lectura, así que la búsqueda fue por el dominio y Google devolvió ${n ? `"${n}"` : "otro negocio"}. Revisa el nombre antes de enviar — si está mal, todo el informe es sobre otra empresa.`,
    link: "Enlace para enviar al prospecto", copiar: "📋 Copiar enlace", copiado: "Copiado ✓",
    abrir: "Abrir", negocioLbl: "Negocio",
    hist: "Generados en este navegador", histNota: "Lista local (este navegador). Hoy no existe un endpoint que liste los X-Ray de un vendedor — así que esto no es el historial de la cuenta.",
    limpar: "Limpiar lista",
    erroSite: "Ingresa el sitio del prospecto.",
    erroAuth: "Tu sesión expiró — sal y entra de nuevo para generar el X-Ray.",
    erroLer: "No se pudo leer el sitio del prospecto.",
    erroRede: "Error de red — no se pudo hablar con el motor.",
  },
  hi: {
    h: "Guileo X-Ray", sub: "प्रॉस्पेक्ट के बिज़नेस को मापें और भेजने के लिए तैयार रिपोर्ट लिंक लेकर निकलें।",
    site: "प्रॉस्पेक्ट की वेबसाइट", sitePh: "naturaspanyc.com",
    negocio: "बिज़नेस का प्रकार (वैकल्पिक)", negocioPh: "जैसे: स्पा, सैलून, क्लिनिक",
    idioma: "रिपोर्ट की भाषा", idiomaNota: "इंजन 3 भाषाओं में लिखता है (pt · en · es)।",
    contato: "प्रॉस्पेक्ट संपर्क (वैकल्पिक)", contatoPh: "ई-मेल या फ़ोन",
    gerar: "X-Ray बनाएं", gerando: "बिज़नेस मापा जा रहा है… कुछ सेकंड लगते हैं",
    marcaT: "क्लाइंट की ब्रांडिंग LINK में जाती है, रिपोर्ट में नहीं।",
    marcaP: "रिपोर्ट दोबारा बनाने पर लोगो और रंग खो जाते हैं। इन्हें यहाँ भरें — ये URL में चले जाते हैं, फिर आप बिना ब्रांड खोए दोबारा बना सकते हैं।",
    accent: "क्लाइंट का रंग (accent)", logo: "लोगो URL", capa: "कवर URL",
    score: "कुल स्कोर", risco: "प्रति माह जोखिम में राजस्व", naoMedido: "मापा नहीं गया",
    semPremissa: "कोई अनुमान दर्ज नहीं — इसे मापा-नहीं-गया मानें",
    idAviso: "⚠️ हम पुष्टि नहीं कर सके कि यह वही व्यवसाय है",
    idQuem: (n) => `साइट ने हमारी रीडिंग रोक दी, इसलिए खोज डोमेन से हुई और Google ने ${n ? `"${n}"` : "कोई और व्यवसाय"} लौटाया। भेजने से पहले नाम जाँच लें — गलत हुआ तो पूरी रिपोर्ट किसी और कंपनी की है।`,
    link: "प्रॉस्पेक्ट को भेजने का लिंक", copiar: "📋 लिंक कॉपी करें", copiado: "कॉपी ✓",
    abrir: "खोलें", negocioLbl: "बिज़नेस",
    hist: "इस ब्राउज़र में बनाए गए", histNota: "स्थानीय सूची (यही ब्राउज़र)। आज ऐसा कोई endpoint नहीं है जो एक सेलर के X-Ray सूचीबद्ध करे — इसलिए यह खाते का इतिहास नहीं है।",
    limpar: "सूची साफ़ करें",
    erroSite: "प्रॉस्पेक्ट की वेबसाइट डालें।",
    erroAuth: "आपका सेशन समाप्त हो गया — दोबारा लॉगिन करके X-Ray बनाएं।",
    erroLer: "प्रॉस्पेक्ट की वेबसाइट पढ़ी नहीं जा सकी।",
    erroRede: "नेटवर्क त्रुटि — इंजन से बात नहीं हो सकी।",
  },
};

// O motor escreve em pt|en|es (LANGS em functions/lib/avaliacao.js). `hi` cai em `en` lá dentro —
// então o seletor não oferece hindi: oferecer o que o motor não entrega é prometer o que não sai.
const REPORT_LANGS = [["pt", "🇧🇷 Português"], ["en", "🇺🇸 English"], ["es", "🇪🇸 Español"]];
const LOCALE = { pt: "pt-BR", en: "en-US", es: "es-ES" };

const HIST_KEY = "guileo_xray_local";
const loadHist = (email) => {
  try {
    const all = JSON.parse(localStorage.getItem(HIST_KEY) || "{}");
    return Array.isArray(all[email]) ? all[email] : [];
  } catch { return []; }
};
const saveHist = (email, linhas) => {
  try {
    const all = JSON.parse(localStorage.getItem(HIST_KEY) || "{}");
    all[email] = linhas.slice(0, 20);
    localStorage.setItem(HIST_KEY, JSON.stringify(all));
  } catch { /* histórico local nunca pode quebrar a aba */ }
};

export default function SellerXray({ lang = "pt", seller = null, sid = "", market = "us", handoff = null }) {
  const t = U[lang] || U.pt;
  const email = seller?.email || "anon";

  // HANDOFF (2026-08-20): a fila de leads manda um negócio pra cá quando ele ainda não tem
  // relatório medido. Chegar no X-Ray com o campo VAZIO obrigaria o vendedor a redigitar o que
  // o hub já sabe — e redigitar é onde ele desiste. Semente só no primeiro render: depois disso
  // o campo é dele, e um refetch não pode apagar o que ele está escrevendo.
  const [site, setSite] = useState(() => (handoff?.site || "").toString());
  const [negocio, setNegocio] = useState(() => (handoff?.business || "").toString());
  const [contato, setContato] = useState("");
  const [rLang, setRLang] = useState(lang === "hi" ? "en" : lang);
  const [accent, setAccent] = useState("");
  const [logo, setLogo] = useState("");
  const [capa, setCapa] = useState("");

  const [estado, setEstado] = useState("idle"); // idle | busy | ok | err
  const [erro, setErro] = useState("");
  const [res, setRes] = useState(null);         // { id, avaliacao }
  const [copiado, setCopiado] = useState(false);
  const [hist, setHist] = useState(() => loadHist(seller?.email || "anon"));

  // O link é montado AQUI (não vem do backend) porque é aqui que a marca entra: os parâmetros
  // opcionais são o que sobrevive a uma regeração da avaliação.
  const montarLink = (id) => {
    const qs = [];
    if (accent.trim()) qs.push(`accent=${encodeURIComponent(accent.trim().startsWith("#") ? accent.trim() : `#${accent.trim()}`)}`);
    if (logo.trim()) qs.push(`logo=${encodeURIComponent(logo.trim())}`);
    if (capa.trim()) qs.push(`capa=${encodeURIComponent(capa.trim())}`);
    const origem = typeof window !== "undefined" ? window.location.origin : "https://guileoai.com";
    return `${origem}/apresentacao/${id}${qs.length ? `?${qs.join("&")}` : ""}`;
  };

  const gerar = async () => {
    const s = site.trim();
    if (!s) { setErro(t.erroSite); setEstado("err"); return; }
    setEstado("busy"); setErro(""); setRes(null); setCopiado(false);
    try {
      const r = await fetch("/api/avaliacao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: s, negocio: negocio.trim(), lang: rLang, sid,
          seller: seller?.email || seller?.name || "", contato: contato.trim(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      // ⚠️ LER A RESPOSTA, não só o status (lição "status HTTP não é autenticação"): o motor
      // devolve 409 com `erro: nao_deu_pra_ler` e 500 com `nao_gravou` — nenhum deles é sucesso,
      // e nenhum deles pode virar uma tela vazia sem explicação.
      if (r.status === 401) { setErro(t.erroAuth); setEstado("err"); return; }
      if (!r.ok || !d.ok || !d.id) {
        const motivo = d.motivo || d.erro || d.error || `HTTP ${r.status}`;
        setErro(`${d.erro === "nao_deu_pra_ler" ? `${t.erroLer} ` : ""}${motivo}`);
        setEstado("err"); return;
      }
      setRes({ id: d.id, avaliacao: d.avaliacao || {} });
      setEstado("ok");
      const linha = {
        id: d.id, site: s,
        business: d.avaliacao?.business || "",
        score: d.avaliacao?.score_geral ?? null,
        at: new Date().toISOString(),
      };
      const novo = [linha, ...hist.filter((h) => h.id !== d.id)];
      setHist(novo); saveHist(email, novo);
    } catch {
      setErro(t.erroRede); setEstado("err");
    }
  };

  const av = res?.avaliacao || null;
  const score = av?.score_geral;
  const risco = av?.previsoes?.receita_em_risco_estimada_mes || null;
  // valor 0 é um número medido de verdade; só `null`/ausente é "não medido". Por isso `== null`
  // e nunca um `||`, que transformaria zero em ausência (a lição "fallback esconde erro").
  const riscoValor = risco && risco.valor != null ? Number(risco.valor) : null;
  const link = res ? montarLink(res.id) : "";
  // 🚨 IDENTIFICAÇÃO NÃO CONFIRMADA. Quando o site do prospect bloqueia a leitura (403/captcha), o
  // motor busca no Google só pelo domínio e pode grudar num XARÁ — aconteceu de verdade: o
  // relatório saiu com o nome de outro spa e os 4.5/16 dele. O motor agora marca; aqui a gente
  // PARA o vendedor antes de mandar, porque este é o último ponto com um humano olhando.
  const ident = av?.identificacao || null;
  const idDuvidosa = !!(ident && ident.confirmada === false);

  const field = "w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50";

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-extrabold text-g-word">🩻 {t.h}</div>
        <p className="mt-1 text-[12.5px] text-g-muted">{t.sub}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 min-w-0">
        {/* ── FORMULÁRIO ─────────────────────────────────────────────────────────────── */}
        <div className="card p-5 min-w-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[11px] text-g-muted sm:col-span-2">{t.site}
              <input value={site} onChange={(e) => setSite(e.target.value)} placeholder={t.sitePh} className={field} />
            </label>
            <label className="text-[11px] text-g-muted">{t.negocio}
              <input value={negocio} onChange={(e) => setNegocio(e.target.value)} placeholder={t.negocioPh} className={field} />
            </label>
            <label className="text-[11px] text-g-muted">{t.idioma}
              <select value={rLang} onChange={(e) => setRLang(e.target.value)} className={field}>
                {REPORT_LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-g-muted sm:col-span-2">{t.contato}
              <input value={contato} onChange={(e) => setContato(e.target.value)} placeholder={t.contatoPh} className={field} />
            </label>
          </div>
          <div className="mt-1 text-[11px] text-g-muted">{t.idiomaNota}</div>

          {/* AVISO DA MARCA + os campos que a fazem viajar na URL */}
          <div className="mt-4 rounded-lg border border-g-gold/30 bg-g-gold/[0.08] px-3 py-2.5">
            <div className="text-[12px] font-bold text-g-gold">⚠️ {t.marcaT}</div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-g-gold/85">{t.marcaP}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="text-[11px] text-g-muted">{t.accent}
                <input value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#D6C29A" className={field} />
              </label>
              <label className="text-[11px] text-g-muted">{t.logo}
                <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" className={field} />
              </label>
              <label className="text-[11px] text-g-muted">{t.capa}
                <input value={capa} onChange={(e) => setCapa(e.target.value)} placeholder="https://…/capa.jpg" className={field} />
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={gerar} disabled={estado === "busy"} className="btn-bright text-[13px] disabled:opacity-50">
              {estado === "busy" ? "…" : t.gerar}
            </button>
            {estado === "busy" && (
              <span className="inline-flex items-center gap-2 text-[12px] text-g-muted">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-g-green/30 border-t-g-green" />
                {t.gerando}
              </span>
            )}
          </div>

          {estado === "err" && erro && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">{erro}</p>
          )}
        </div>

        {/* ── RESULTADO ──────────────────────────────────────────────────────────────── */}
        <div className="min-w-0">
          {res && (
            <div className="card p-5 min-w-0">
              {av?.business && (
                <div className="text-[11px] uppercase tracking-wide text-g-muted">
                  {t.negocioLbl}: <span className="font-bold text-g-word">{av.business}</span>
                </div>
              )}

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* SCORE — null vira "não medido" em cinza, nunca 0. */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 backdrop-blur-xl">
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.score}</div>
                  {score == null ? (
                    <div className="mt-1 text-[15px] font-black" style={{ color: NOT_MEASURED }}>— {t.naoMedido}</div>
                  ) : (
                    <div className="mt-1 text-[26px] font-black tabular-nums text-g-word">{score}<span className="text-[13px] font-bold text-g-muted">/100</span></div>
                  )}
                </div>

                {idDuvidosa && (
                  <div className="mb-4 rounded-xl border p-3"
                    style={{ borderColor: `${PERDA}55`, background: `${PERDA}12` }}>
                    <div className="text-[12.5px] font-bold" style={{ color: PERDA }}>{t.idAviso}</div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-g-muted">{t.idQuem(ident.nome_no_google)}</p>
                  </div>
                )}

                {/* DINHEIRO EM RISCO — sempre com moeda; sem premissa, não é número de venda. */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 backdrop-blur-xl">
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.risco}</div>
                  {riscoValor == null ? (
                    <div className="mt-1 text-[15px] font-black" style={{ color: NOT_MEASURED }}>— {t.naoMedido}</div>
                  ) : (
                    <div className="mt-1 text-[26px] font-black tabular-nums" style={{ color: PERDA }}>
                      {fmtMoney(riscoValor, risco.moeda || "USD", LOCALE[rLang] || "pt-BR")}
                    </div>
                  )}
                </div>
              </div>

              {/* A PREMISSA embaixo do número — a regra que sustenta a página inteira. */}
              {riscoValor != null && (
                <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: risco.premissa ? undefined : NOT_MEASURED }}>
                  <span className={risco.premissa ? "text-g-muted" : ""}>{risco.premissa || t.semPremissa}</span>
                </p>
              )}

              {/* O LINK — o que o vendedor veio buscar. */}
              <div className="mt-4">
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.link}</div>
                <div className="mt-1.5 break-all rounded-lg border border-white/10 bg-black/25 px-3 py-2 font-mono text-[11.5px] text-g-word">{link}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => { navigator.clipboard?.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}
                    className="btn-bright text-[13px]">{copiado ? t.copiado : t.copiar}</button>
                  <a href={link} target="_blank" rel="noopener" className="btn-ghost text-[13px]">↗ {t.abrir}</a>
                  {/* ➕ a porta do funil: o negócio AVALIADO vira prospect na 1ª etapa, com score
                      e link do relatório na nota. Sem cifra — o "$ em risco" fica no relatório. */}
                  <SellerFunnelButton
                    lang={lang} seller={seller} market={market}
                    business={av?.business || site.trim()}
                    note={[`${t.score}: ${score == null ? t.naoMedido : `${score}/100`}`, link].join("\n")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── LISTA LOCAL ────────────────────────────────────────────────────────────
              Não existe hoje RPC/endpoint que liste as avaliações de UM vendedor
              (avaliacao_historico filtra por site/e-mail e é gated pelo INGEST, que não
              vai pro navegador). Então esta lista diz exatamente o que é: local. */}
          {hist.length > 0 && (
            <div className="card mt-4 p-5 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-extrabold text-g-word">{t.hist}</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-g-muted">{t.histNota}</p>
                </div>
                <button onClick={() => { setHist([]); saveHist(email, []); }} className="shrink-0 text-[11px] text-g-muted hover:text-g-word">{t.limpar}</button>
              </div>
              <div className="mt-3 space-y-1.5">
                {hist.map((h) => (
                  <a key={h.id} href={montarLink(h.id)} target="_blank" rel="noopener"
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 hover:border-g-green/30">
                    <span className="min-w-0 truncate text-[12.5px] text-g-word">{h.business || h.site}</span>
                    <span className="shrink-0 text-[11.5px] font-bold tabular-nums"
                      style={{ color: h.score == null ? NOT_MEASURED : undefined }}>
                      {h.score == null ? "—" : `${h.score}/100`}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
