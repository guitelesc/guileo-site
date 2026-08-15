// functions/lib/emailTemplates.test.mjs — VARREDURA DE TODOS OS BUILDERS DE E-MAIL.
//
// POR QUE EXISTE: um e-mail quebrado só aparece na caixa de entrada de um cliente real, dias
// depois, e ninguém consegue reproduzir. Já aconteceram três vezes nesta base: cor de tema claro
// dentro da casca escura (contraste 1,05:1 → o cliente não via nem o nome da campanha), comentário
// `<!-- -->` viajando dentro da mensagem, e e-mail de marketing sem link de descadastro. Os três
// são detectáveis por um teste que RENDERIZA e OLHA o HTML final. Este é esse teste.
//
//   node functions/lib/emailTemplates.test.mjs
import * as T from "./emailTemplates.js";

let falhas = 0, checados = 0;
const erro = (m) => { falhas++; console.log(`  ✗ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);

// ── contraste WCAG (luminância relativa + razão) ─────────────────────────────
const lum = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// A superfície que carrega o texto em toda a casca é B.card (#161512). O piso é 3:1 — o mínimo
// WCAG para texto grande/negrito, que é o formato de praticamente tudo que usa cor de marca aqui
// (eyebrow em caixa alta, headline do cupom em 30px, valor do vale em 34px). O token B.faint
// (#6a655b) dá 3,15:1 e passa; um acento escuro vindo do site do cliente — Natura Spa, acento
// REAL extraído automaticamente = #0063a8 = 2,91:1 — não passa. É exatamente essa a diferença
// que este teste precisa enxergar, e era ela que passava batido.
const FUNDO = "#161512";
const PISO = 3.0;

// Amostra que todo builder aceita sem quebrar (campos extras são ignorados).
const brandCliente = { business: "Natura Spa", logo_url: "https://exemplo.com/logo.png", accent: "#7A5C3E", lang: "pt", address: "30-79 Steinway Street, Astoria, NY 11103" };
const AMOSTRA = {
  name: "Lilian", business: "Natura Spa", lang: "pt", brand: brandCliente,
  coupon: { label: "20% OFF", code: "BEMVINDA20", kind: "percent", value: 20, expires: "31/12" },
  leads: [{ name: "Ana", heat: "hot", channel: "🌐 Website", want: "quer massagem", action: "ligar" }],
  stats: { calls: 4, bookings: 2 }, membership: { name: "Clube", price_cents: 9900, interval: "month", perks: "1 massagem" },
  package: { name: "Pacote 5", sessions: 5 }, amount: 100, code: "GIFT123", milestone: 10, years: 2,
  service: "Massagem", whenLabel: "Qui 07/08 · 11:00", ref: "ABC123", summary: "resumo", message: "mensagem",
  headline: "Semana da Beleza", body: "corpo", title: "titulo", did: {}, needs: {}, brief: "brief",
  voteUrlBase: "https://guileoai.com/api/nps?e=x", voteBaseUrl: "https://guileoai.com/api/cx-vote?e=x",
  unsubscribeUrl: "https://guileoai.com/api/unsubscribe?c=a&e=b&t=c", unsub: "https://guileoai.com/api/unsubscribe?c=a&e=b&t=c",
  address: "30-79 Steinway Street, Astoria, NY 11103", bizEmail: "spa@exemplo.com",
  urgentes: [], oportunidades: [], topClients: [], highlights: [], ads: null, sentiment: null,
};

const builders = Object.entries(T).filter(([n, v]) => typeof v === "function" && /Email$/.test(n));

console.log(`\n📧 ${builders.length} builders de e-mail\n`);

// ── 1) CONTRASTE — nenhuma cor de texto pode sumir no fundo escuro ──────────
console.log(`1) contraste texto × casca ${FUNDO} (piso ${PISO}:1):`);
for (const [nome, build] of builders) {
  let html;
  try { html = (build(AMOSTRA) || {}).html || ""; } catch (e) { erro(`${nome} EXPLODIU: ${e.message}`); continue; }
  if (!html) { erro(`${nome} não devolveu html`); continue; }
  checados++;
  const cores = [...html.matchAll(/color:\s*(#[0-9a-fA-F]{3,6})\b/g)].map((m) => m[1]);
  // Exceções LEGÍTIMAS, não "cores que a gente resolveu ignorar":
  //  · #161512 / #0e0d0b — usadas como cor de TEXTO só em cima do botão de acento (fundo claro,
  //    escolhido por _textOn) e no preheader escondido (cor = fundo, de propósito).
  const legitimas = new Set(["#161512", "#0e0d0b"]);
  const ruins = [];
  for (const c of new Set(cores)) {
    if (legitimas.has(c.toLowerCase())) continue;
    const r = razao(c, FUNDO);
    if (r < PISO) ruins.push(`${c} (${r.toFixed(2)}:1)`);
  }
  if (ruins.length) erro(`${nome}: cor ilegível na casca escura → ${ruins.join(", ")}`);
}
if (!falhas) ok(`${checados} builders sem texto invisível`);

// ── 2) NENHUM COMENTÁRIO HTML VIAJA NA MENSAGEM ────────────────────────────
console.log("\n2) comentários <!-- --> no HTML final:");
let comentarios = 0;
for (const [nome, build] of builders) {
  let html = ""; try { html = (build(AMOSTRA) || {}).html || ""; } catch { continue; }
  const c = html.match(/<!--(?!\[if)[\s\S]*?-->/g);
  if (c) { comentarios++; erro(`${nome}: ${c.length} comentário(s) enviados ao destinatário — ex.: ${c[0].slice(0, 60)}…`); }
}
if (!comentarios) ok("nenhum builder envia comentário HTML");

// ── 3) MARKETING PRECISA DE DESCADASTRO (CAN-SPAM) ─────────────────────────
// Builders de campanha/marketing em massa: se receberam a URL de descadastro, ela TEM que sair
// no HTML. (Quem não recebe a URL é responsabilidade do chamador — coberto no relatório.)
console.log("\n3) link de descadastro sai quando fornecido:");
const marketing = ["couponEmail", "brandPromoEmail", "newsEmail", "promoEmail", "birthdayEmail",
  "anniversaryEmail", "recallEmail", "loyaltyMilestoneEmail", "rebookEmail", "welcomeFirstVisitEmail",
  "winbackCustomerEmail", "waitlistOfferEmail"];
for (const nome of marketing) {
  const build = T[nome];
  if (typeof build !== "function") { erro(`${nome} não existe`); continue; }
  const html = (build(AMOSTRA) || {}).html || "";
  if (!html.includes("/api/unsubscribe")) erro(`${nome}: recebeu a URL de descadastro e NÃO a imprimiu`);
}
console.log("   (falhas acima, se houver)");

// ── 4) ENDEREÇO POSTAL (CAN-SPAM) sai quando fornecido ─────────────────────
console.log("\n4) endereço postal sai quando fornecido:");
for (const nome of marketing) {
  const build = T[nome]; if (typeof build !== "function") continue;
  const html = (build(AMOSTRA) || {}).html || "";
  if (!html.includes("Steinway")) erro(`${nome}: recebeu endereço postal e NÃO o imprimiu`);
}
console.log("   (falhas acima, se houver)");

// ── 5) ESCAPE — nome hostil não vira markup ────────────────────────────────
console.log("\n5) injeção de HTML pelo nome do cliente:");
const HOSTIL = { ...AMOSTRA, name: '<script>alert(1)</script>', business: '"><img src=x onerror=alert(1)>' };
let vazou = 0;
for (const [nome, build] of builders) {
  let html = ""; try { html = (build(HOSTIL) || {}).html || ""; } catch { continue; }
  // Só conta como vazamento a TAG crua. O texto escapado (&lt;img src=x onerror=alert(1)&gt;)
  // contém a substring "onerror=alert(1)" e não é vazamento nenhum — procurar por ela dava
  // 39 falsos positivos e treinaria a gente a ignorar este teste.
  if (/<script\b/i.test(html.replace(/<script>\(function\(\)\{/g, "")) || /<img\s+src=x/i.test(html)) { vazou++; erro(`${nome}: injeção passou (tag crua no HTML)`); }
}
if (!vazou) ok("nenhum builder deixa markup do usuário passar");

console.log(`\n${falhas ? `❌ ${falhas} falha(s)` : "✅ tudo certo"} — ${checados} builders renderizados\n`);
process.exit(falhas ? 1 : 0);
