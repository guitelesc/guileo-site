// functions/lib/brandExtract.js — A IDENTIDADE DO CLIENTE, TIRADA DO SITE DELE.
//
// POR QUE EXISTE: o e-mail de confirmação que o cliente do NEGÓCIO recebe precisa ter a cara do
// negócio — logo e cor dele. Preencher isso à mão, cliente por cliente, não escala: cada novo
// cliente viraria uma tarefa minha, e o Luis foi direto ao ponto — "assim como cada cliente".
// O site do próprio negócio já carrega a identidade dele. Basta ler.
//
// ── AS TRAVAS ────────────────────────────────────────────────────────────────
//  1. NUNCA INVENTA. Só sai daqui o que estava no HTML do site. Não achou logo? devolve vazio, e o
//     e-mail usa o monograma com a inicial — que sempre renderiza. Cor "aproximada" seria mentira
//     visual: o dono abre o e-mail e vê uma marca que não é a dele.
//  2. NADA DE SVG. Gmail, Outlook e Apple Mail não renderizam <img src="...svg"> — seria um quadrado
//     quebrado no topo da confirmação, pior que não ter logo. Só png/jpg/webp.
//  3. SEM REDE INTERNA. Recusa host local/IP privado: este código busca uma URL que veio do cadastro
//     do cliente, e uma URL apontando pra dentro da infra seria SSRF.
//  4. TETO DE TEMPO E TAMANHO. 12s e 600KB. Um site lento não pode segurar o provisionamento.
//  5. NÃO SOBRESCREVE O DONO. Quem chama só grava em campo VAZIO — escolha manual sempre vence.

const BAD_HOST = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?$|0\.0\.0\.0$)/i;

function safeUrl(raw) {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (BAD_HOST.test(u.hostname)) return null;
    return u;
  } catch { return null; }
}

// Absolutiza uma URL de imagem relativa contra a página, e recusa o que e-mail não renderiza.
function pickImage(src, base) {
  if (!src) return "";
  let abs;
  try { abs = new URL(src, base).toString(); } catch { return ""; }
  if (!/^https?:\/\//i.test(abs)) return "";
  if (!/\.(png|jpe?g|webp)(\?|#|$)/i.test(abs)) return "";   // svg/gif/ico fora — ver trava 2
  return abs.slice(0, 400);
}

// O LOGO. Procura na ordem em que um site costuma declarar a marca de verdade:
// og:image é o que o próprio site escolheu pra se representar quando compartilhado; depois
// <img> cujo nome/alt diz "logo"; por fim o apple-touch-icon (quase sempre um PNG quadrado).
function findLogo(html, base) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const cands = [];
  if (og) cands.push(og[1]);
  const imgs = html.match(/<img[^>]+>/gi) || [];
  for (const tag of imgs) {
    if (!/logo|brand/i.test(tag)) continue;
    const m = tag.match(/\bsrc=["']([^"']+)["']/i) || tag.match(/\bdata-src=["']([^"']+)["']/i);
    if (m) cands.push(m[1]);
  }
  const touch = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i);
  if (touch) cands.push(touch[1]);
  for (const c of cands) { const u = pickImage(c, base); if (u) return u; }
  return "";
}

// A COR. Preferimos o que o site DECLARA como cor de tema (<meta name="theme-color">) — é uma
// afirmação explícita da marca. Sem isso, a cor mais repetida no CSS da página, ignorando neutros
// (preto/branco/cinza), que aparecem em qualquer site e não dizem nada sobre a marca.
function findAccent(html) {
  const meta = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  if (meta && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(meta[1].trim())) return meta[1].trim().toLowerCase();

  const counts = new Map();
  for (const m of html.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const hex = m[1].toLowerCase();
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    // neutro (cinza/preto/branco) → não é cor de marca. Saturação baixa OU muito claro/escuro.
    if (max - min < 40 || max < 40 || min > 215) continue;
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  let best = "", n = 0;
  // desempate estável pelo próprio hex: o mesmo site devolve sempre a mesma cor
  for (const [hex, c] of [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    if (c > n) { best = hex; n = c; }
  }
  return best ? `#${best}` : "";
}

// buscarHtml(url) → { html, base } · { why } em qualquer falha. NUNCA lança.
// Extraída de brandFromSite em 2026-08-10 para que a extração de PERFIL use exatamente as mesmas
// travas (SSRF, redirect, tipo, tamanho, captcha). Escrever um segundo buscador seria abrir uma
// segunda porta para auditar — e esta aqui já passou por revisão adversarial.
export async function buscarHtml(siteUrl) {
  const u = safeUrl(String(siteUrl || "").trim());
  if (!u) return { why: "url-invalida-ou-interna" };
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    // Muitos sites redirecionam (sem-www → www, / no fim). Pedimos `follow` explicitamente e, se
    // ainda assim vier uma página minúscula com Location, seguimos UM salto na mão. O sintoma sem
    // isso é traiçoeiro: a resposta é 200 text/html, mas com 174 bytes — a casca do redirect. Foi
    // exatamente o que aconteceu com naturaspanyc.com (2026-08-05).
    const get = (url) => fetch(url, {
      signal: ctl.signal, redirect: "follow",
      headers: { "User-Agent": "GuileoBrandBot/1.0 (+https://guileoai.com)", Accept: "text/html" },
    });
    let r = await get(u.toString()).finally(() => clearTimeout(timer));
    if (!r.ok) return { why: `http-${r.status}` };          // fetch não lança em 4xx/5xx
    if (!/text\/html/i.test(r.headers.get("content-type") || "")) return { why: `tipo-${(r.headers.get("content-type")||"vazio").slice(0,40)}` };
    let html = (await r.text()).slice(0, 600_000);          // teto de tamanho
    let base = r.url || u.toString();
    if (html.length < 2000) {
      const loc = (html.match(/https?:\/\/[^"'<>\s]+/) || [])[0];
      const nxt = loc && safeUrl(loc);                      // o destino passa pelas MESMAS travas
      if (nxt && nxt.toString() !== base) {
        const r2 = await get(nxt.toString());
        if (r2.ok && /text\/html/i.test(r2.headers.get("content-type") || "")) {
          html = (await r2.text()).slice(0, 600_000);
          base = r2.url || nxt.toString();
        }
      }
    }
    // PROTEÇÃO ANTI-ROBÔ. Hospedagens respondem 200 com casca de CAPTCHA quando o pedido vem de
    // datacenter. Não se contorna CAPTCHA — reconhecer e NOMEAR permite pedir o dado ao dono.
    if (/sgcaptcha|\/cdn-cgi\/challenge|captcha|__cf_chl|sucuri_cloudproxy/i.test(html)) {
      return { why: "site-protegido-por-captcha" };
    }
    return { html, base };
  } catch (e) { return { why: `erro-${String(e && e.name || e).slice(0, 40)}` }; }
}

// brandFromSite(siteUrl) → { logo_url, accent, source } · { why } em qualquer falha.
// NUNCA lança: um site fora do ar não pode derrubar o provisionamento de um cliente.
export async function brandFromSite(siteUrl) {
  const got = await buscarHtml(siteUrl);
  if (got.why) return { why: got.why };
  const { html, base } = got;
  const logo_url = findLogo(html, base);
  const accent = findAccent(html);
  if (!logo_url && !accent) {
    const amostra = html.replace(/\s+/g, " ").slice(0, 150);
    return { why: `html-${html.length}b · ${amostra}` };
  }
  return { ...(logo_url ? { logo_url } : {}), ...(accent ? { accent } : {}), source: base };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// PERFIL COMPLETO A PARTIR DO SITE — a PONTA DE ENTRADA do motor.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE: hoje cadastrar um cliente é alguém digitando nome, serviços, preços, horário e
// endereço, um por um. Isso não escala e é o gargalo do vendedor: ele precisa da atenção do dono
// para preencher formulário, quando devia estar vendendo. O site do negócio já tem quase tudo.
//
// A REGRA QUE MANDA AQUI é a mesma lição v1 dos agentes: NUNCA INVENTAR. Preço plausível não é
// preço; horário "provavelmente 9h às 18h" é convite para o cliente chegar na porta fechada.
// O que não estiver escrito volta em `faltando` — e é ISSO que dá valor: a lista do que perguntar.
// Sem ela, o vendedor não sabe o que perguntar; com ela, a conversa vira "só me confirma três
// coisas" em vez de "me manda tudo".
//
// perfilDoSite(url) → { nome, telefone, endereco, horarios, servicos[], idioma, logo_url,
//                       accent, faltando[], fonte } · { why } em qualquer falha. NUNCA lança.

// Entidades HTML viram texto de verdade. Sem isto, um nome com "&amp;" chega ao cérebro da agente
// e é FALADO como "amp" na saudação — o defeito aparece no ouvido do cliente, não na tela.
const decodi = (t) => String(t || "")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim();

const texto = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
                      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const meta = (html, nome) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${nome}["'][^>]*content=["']([^"']+)`, "i"))
        || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${nome}["']`, "i"));
  return m ? m[1].trim() : "";
};

// dados estruturados (schema.org) são a fonte MAIS confiável: o site DECLARA, não inferimos.
function doSchema(html) {
  const out = {};
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { continue; }
    for (const no of (Array.isArray(j) ? j : [j, ...(j["@graph"] || [])])) {
      if (!no || typeof no !== "object") continue;
      if (!out.nome && no.name && typeof no.name === "string") out.nome = no.name.slice(0, 120);
      if (!out.telefone && no.telephone) out.telefone = String(no.telephone).slice(0, 40);
      const a = no.address;
      if (!out.endereco && a && typeof a === "object") {
        out.endereco = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode]
          .filter(Boolean).join(", ").slice(0, 200);
      } else if (!out.endereco && typeof a === "string") out.endereco = a.slice(0, 200);
      const h = no.openingHours || no.openingHoursSpecification;
      if (!out.horarios && h) out.horarios = (Array.isArray(h) ? h : [h])
        .map((x) => typeof x === "string" ? x
             : [(Array.isArray(x.dayOfWeek) ? x.dayOfWeek.join("/") : x.dayOfWeek), x.opens, x.closes].filter(Boolean).join(" "))
        .filter(Boolean).slice(0, 8).join(" · ").slice(0, 260);
    }
  }
  return out;
}

// PREÇOS. Só entra par "nome — valor" que aparece JUNTO no texto. Um número solto pode ser
// telefone, CEP ou ano; virar preço seria a agente cotando o CEP do cliente.
function acharServicos(txt) {
  const achados = [];
  const re = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 '&/+-]{2,44}?)\s*[–—\-:·]?\s*(?:R\$|\$|US\$)\s?(\d{1,4}(?:[.,]\d{2})?)/g;
  for (const m of txt.matchAll(re)) {
    const nome = m[1].trim().replace(/^(de|from|a partir de|por)\s+/i, "");
    const valor = parseFloat(m[2].replace(",", "."));
    if (nome.length < 3 || !isFinite(valor) || valor <= 0 || valor > 100000) continue;
    if (achados.some((x) => x.nome.toLowerCase() === nome.toLowerCase())) continue;
    achados.push({ nome: nome.slice(0, 60), preco: valor });
    if (achados.length >= 30) break;
  }
  return achados;
}

export async function perfilDoSite(siteUrl) {
  const got = await buscarHtml(siteUrl);
  if (got.why) return { why: got.why };
  const { html, base } = got;
  const txt = texto(html).slice(0, 120_000);
  const sch = doSchema(html);

  // O NOME DO NEGÓCIO, não o título da página. Sites põem a frase de efeito junto
  // ("Natura Spa New York | Hair Care, Beauty Care & Massages") e isso viraria a saudação inteira:
  // "obrigado por ligar para Natura Spa New York barra vertical Hair Care…".
  // O corte existia, mas só no caminho do <title> — e este caso veio pelo og:title. Trava que vale
  // num caminho só não é trava. Agora vale para TODA origem (achado na própria prova, 2026-08-10).
  const soNome = (v) => decodi(v).split(/\s[|–—]\s|\s-\s/)[0].trim().slice(0, 120);
  const nome = soNome(sch.nome || meta(html, "og:site_name") || meta(html, "og:title")
            || (html.match(/<title[^>]*>([^<]{2,160})</i)?.[1] || ""));
  // telefone: o link tel: é DECLARAÇÃO do site; texto solto seria adivinhação
  const telefone = sch.telefone || (html.match(/href=["']tel:([^"']{6,25})/i)?.[1] || "").replace(/[^\d+]/g, "");
  const idioma = (html.match(/<html[^>]+lang=["']([a-z]{2})/i)?.[1] || "").toLowerCase();
  const servicos = acharServicos(txt);
  const marca = { logo_url: findLogo(html, base), accent: findAccent(html) };

  const perfil = {
    nome: nome || "",
    telefone: telefone || "",
    endereco: decodi(sch.endereco) || "",
    horarios: decodi(sch.horarios) || "",
    idioma: idioma || "",
    servicos,
    logo_url: marca.logo_url || "",
    accent: marca.accent || "",
    fonte: base,
  };
  // O QUE FALTA É O PRODUTO. Esta lista é o roteiro do vendedor (ou da Gui, na ligação de kickoff).
  perfil.faltando = Object.entries({
    nome: "o nome do negócio", telefone: "um telefone de contato", endereco: "o endereço",
    horarios: "o horário de funcionamento", logo_url: "a logo", idioma: "o idioma de atendimento",
  }).filter(([k]) => !perfil[k]).map(([, rotulo]) => rotulo);
  if (!servicos.length) perfil.faltando.push("os serviços e preços");
  return perfil;
}
