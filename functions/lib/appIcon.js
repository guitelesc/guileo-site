// functions/lib/appIcon.js — O ÍCONE DO APP DO CLIENTE, GERADO NA HORA.
//
// POR QUE EXISTE: o PWA do cliente (/site/:slug) precisa de um ícone PNG de verdade — o Android
// exige >=192px para considerar o site instalável e o iOS só aceita PNG no apple-touch-icon (SVG
// não renderiza na tela inicial). O ícone é a cara do NEGÓCIO na tela do celular do cliente final.
//
// ── AS TRAVAS (regra da casa) ───────────────────────────────────────────────────────────────────
//  1. NUNCA a logo da Guileo no app de outro negócio. Sem logo própria → MONOGRAMA: quadrado na
//     cor da marca dele + a inicial do negócio. Sempre renderiza, sempre é ele.
//  2. Nada de biblioteca: Worker não tem canvas nem fonte. O PNG é escrito byte a byte aqui
//     (paleta de 16 tons, profundidade 4 bits) e a letra é desenhada por DISTÂNCIA a traços
//     geométricos — o que dá antialias de graça e um monograma limpo em qualquer tamanho.
//  3. Quadrado cheio, sem cantos arredondados e sem transparência: Android (maskable) e iOS
//     recortam a máscara deles por cima. Um PNG com canto transparente vira borda suja no iOS.
//  4. A letra vive dentro dos 46% centrais → dentro da "safe zone" do ícone maskable do Android,
//     então o MESMO arquivo serve purpose "any maskable" sem cortar a inicial.
//
// Prova: functions/lib/appIcon.test.mjs descomprime o PNG gerado com node:zlib e confere
// assinatura, IHDR, paleta e o tamanho exato dos dados — não "parece que deu certo".

// ── PNG (escrita crua) ──────────────────────────────────────────────────────────────────────────
const TAB_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TAB_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; i++) { a = (a + bytes[i]) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}

const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);

function junta(partes) {
  let total = 0;
  for (const p of partes) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

function chunk(tipo, dados) {
  const nome = new Uint8Array([...tipo].map((c) => c.charCodeAt(0)));
  const corpo = junta([nome, dados]);
  return junta([u32(dados.length), corpo, u32(crc32(corpo))]);
}

// zlib com blocos STORED (sem compressão). Deliberado: um deflate de verdade seria ~200 linhas de
// Huffman para economizar num arquivo que a borda serve em cache por 1 dia. 192px = ~19KB.
function zlibStored(raw) {
  const partes = [new Uint8Array([0x78, 0x01])];
  for (let i = 0; i < raw.length || i === 0; i += 65535) {
    const pedaco = raw.subarray(i, Math.min(i + 65535, raw.length));
    const ultimo = i + 65535 >= raw.length ? 1 : 0;
    const len = pedaco.length;
    partes.push(new Uint8Array([ultimo, len & 255, (len >> 8) & 255, ~len & 255, (~len >> 8) & 255]));
    partes.push(pedaco);
  }
  partes.push(u32(adler32(raw)));
  return junta(partes);
}

// PNG colorType 3 (paleta), bitDepth 4 → 2 pixels por byte, 16 cores.
function pngPaleta4(w, h, indices, paleta) {
  const bytesLinha = Math.ceil(w / 2);
  const raw = new Uint8Array((bytesLinha + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;                                    // filtro None
    for (let x = 0; x < w; x += 2) {
      const a = indices[y * w + x] & 15;
      const b = x + 1 < w ? indices[y * w + x + 1] & 15 : 0;
      raw[o++] = (a << 4) | b;
    }
  }
  const plte = new Uint8Array(48);
  for (let i = 0; i < 16; i++) { plte[i * 3] = paleta[i][0]; plte[i * 3 + 1] = paleta[i][1]; plte[i * 3 + 2] = paleta[i][2]; }
  const ihdr = junta([u32(w), u32(h), new Uint8Array([4, 3, 0, 0, 0])]);
  return junta([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("IDAT", zlibStored(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

// ── COR ─────────────────────────────────────────────────────────────────────────────────────────
export function hexRgb(hex) {
  let h = String(hex || "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const lum = ([r, g, b]) => {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

// ── A LETRA ─────────────────────────────────────────────────────────────────────────────────────
// Alfabeto monolinear geométrico: cada glifo é uma lista de polilinhas numa caixa 0..1 (y para
// baixo). O traço vira espessura no desenho, então as pontas saem arredondadas naturalmente.
const arco = (cx, cy, r, a0, a1) => {
  const pts = [];
  const passo = a1 >= a0 ? 9 : -9;
  for (let a = a0; passo > 0 ? a <= a1 : a >= a1; a += passo) {
    const rad = (a * Math.PI) / 180;
    pts.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
  }
  return pts;
};
const circulo = (cx, cy, r) => arco(cx, cy, r, 0, 360);

const GLIFOS = {
  A: [[[0.08, 1], [0.5, 0.02], [0.92, 1]], [[0.24, 0.66], [0.76, 0.66]]],
  B: [[[0.18, 0.02], [0.18, 0.98]], [[0.18, 0.02], [0.55, 0.02]], arco(0.55, 0.26, 0.24, -90, 90),
      [[0.55, 0.5], [0.18, 0.5]], [[0.18, 0.5], [0.58, 0.5]], arco(0.58, 0.74, 0.24, -90, 90), [[0.58, 0.98], [0.18, 0.98]]],
  C: [arco(0.5, 0.5, 0.46, 52, 308)],
  D: [[[0.18, 0.02], [0.18, 0.98]], [[0.18, 0.02], [0.46, 0.02]], arco(0.46, 0.5, 0.48, -90, 90), [[0.46, 0.98], [0.18, 0.98]]],
  E: [[[0.86, 0.02], [0.2, 0.02], [0.2, 0.98], [0.86, 0.98]], [[0.2, 0.5], [0.74, 0.5]]],
  F: [[[0.86, 0.02], [0.2, 0.02], [0.2, 0.98]], [[0.2, 0.5], [0.74, 0.5]]],
  G: [arco(0.5, 0.5, 0.46, 52, 308), [[0.78, 0.86], [0.96, 0.86], [0.96, 0.52], [0.6, 0.52]]],
  H: [[[0.2, 0.02], [0.2, 0.98]], [[0.8, 0.02], [0.8, 0.98]], [[0.2, 0.5], [0.8, 0.5]]],
  I: [[[0.5, 0.02], [0.5, 0.98]]],
  J: [[[0.76, 0.02], [0.76, 0.72]], arco(0.5, 0.72, 0.26, 0, 180)],
  K: [[[0.22, 0.02], [0.22, 0.98]], [[0.84, 0.02], [0.22, 0.56]], [[0.38, 0.42], [0.86, 0.98]]],
  L: [[[0.24, 0.02], [0.24, 0.98], [0.84, 0.98]]],
  M: [[[0.12, 0.98], [0.12, 0.02], [0.5, 0.6], [0.88, 0.02], [0.88, 0.98]]],
  N: [[[0.2, 0.98], [0.2, 0.02], [0.8, 0.98], [0.8, 0.02]]],
  O: [circulo(0.5, 0.5, 0.46)],
  P: [[[0.2, 0.98], [0.2, 0.02], [0.56, 0.02]], arco(0.56, 0.28, 0.26, -90, 90), [[0.56, 0.54], [0.2, 0.54]]],
  Q: [circulo(0.5, 0.5, 0.44), [[0.64, 0.68], [0.94, 0.98]]],
  R: [[[0.2, 0.98], [0.2, 0.02], [0.56, 0.02]], arco(0.56, 0.28, 0.26, -90, 90), [[0.56, 0.54], [0.2, 0.54]], [[0.46, 0.54], [0.84, 0.98]]],
  S: [[[0.86, 0.16], [0.72, 0.04], [0.42, 0.02], [0.22, 0.14], [0.22, 0.34], [0.42, 0.46], [0.62, 0.52],
       [0.82, 0.64], [0.82, 0.84], [0.62, 0.97], [0.32, 0.97], [0.14, 0.85]]],
  T: [[[0.08, 0.03], [0.92, 0.03]], [[0.5, 0.03], [0.5, 0.98]]],
  U: [[[0.2, 0.02], [0.2, 0.7]], arco(0.5, 0.7, 0.3, 180, 0), [[0.8, 0.7], [0.8, 0.02]]],
  V: [[[0.1, 0.02], [0.5, 0.98], [0.9, 0.02]]],
  W: [[[0.05, 0.02], [0.27, 0.98], [0.5, 0.36], [0.73, 0.98], [0.95, 0.02]]],
  X: [[[0.16, 0.02], [0.84, 0.98]], [[0.84, 0.02], [0.16, 0.98]]],
  Y: [[[0.16, 0.02], [0.5, 0.5], [0.84, 0.02]], [[0.5, 0.5], [0.5, 0.98]]],
  Z: [[[0.16, 0.03], [0.84, 0.03], [0.16, 0.97], [0.84, 0.97]]],
  0: [circulo(0.5, 0.5, 0.44), [[0.7, 0.28], [0.3, 0.72]]],
  1: [[[0.28, 0.2], [0.52, 0.02], [0.52, 0.98]]],
  2: [[[0.18, 0.22], [0.32, 0.05], [0.6, 0.02], [0.8, 0.16], [0.78, 0.36], [0.18, 0.97], [0.84, 0.97]]],
  3: [[[0.18, 0.15], [0.4, 0.02], [0.68, 0.06], [0.8, 0.2], [0.68, 0.42], [0.44, 0.48], [0.72, 0.55],
       [0.84, 0.72], [0.7, 0.93], [0.4, 0.98], [0.18, 0.87]]],
  4: [[[0.72, 0.02], [0.12, 0.72], [0.9, 0.72]], [[0.72, 0.02], [0.72, 0.98]]],
  5: [[[0.8, 0.04], [0.3, 0.04], [0.26, 0.42], [0.5, 0.36], [0.76, 0.5], [0.8, 0.72], [0.64, 0.93], [0.34, 0.96], [0.16, 0.85]]],
  6: [circulo(0.5, 0.68, 0.3), [[0.74, 0.06], [0.28, 0.52]]],
  7: [[[0.16, 0.04], [0.86, 0.04], [0.42, 0.98]]],
  8: [circulo(0.5, 0.26, 0.24), circulo(0.5, 0.74, 0.26)],
  9: [circulo(0.5, 0.32, 0.3), [[0.72, 0.48], [0.4, 0.96]]],
};
// Inicial que não é A-Z0-9 (ideograma, cirílico, emoji…): um anel neutro. Não fingimos uma letra
// que não é a dele nem enfiamos a marca da casa.
const ANEL = [circulo(0.5, 0.5, 0.42)];

// A INICIAL DO NEGÓCIO. "Açaí do Zé" → "A"; "3 Irmãos" → "3". Sem acento (Ã→A) porque o alfabeto
// é monolinear e um til viraria sujeira.
export function inicialDe(nome) {
  const s = String(nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const m = s.match(/[A-Za-z0-9]/);
  return m ? m[0].toUpperCase() : "";
}

// ── O DESENHO ───────────────────────────────────────────────────────────────────────────────────
// iconePng({ nome, cor, size }) → Uint8Array de um PNG quadrado, cheio, na cor da marca.
export function iconePng({ nome, cor, size = 192 }) {
  const s = Math.max(48, Math.min(1024, Math.round(size)));
  const bg = hexRgb(cor) || [47, 111, 78];               // mesmo padrão do ClientSite.jsx
  const fg = lum(bg) > 0.55 ? [23, 23, 23] : [255, 255, 255];  // contraste real, não branco cego
  const paleta = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    paleta.push([0, 1, 2].map((k) => Math.round(bg[k] + (fg[k] - bg[k]) * t)));
  }

  const px = new Uint8Array(s * s);                       // 0 = cor da marca em todo o quadrado
  const traços = GLIFOS[inicialDe(nome)] || ANEL;

  // Caixa da letra: 46% do lado, centrada → dentro da safe zone do maskable do Android.
  const G = s * 0.46;
  const x0 = (s - G) / 2, y0 = (s - G) / 2;
  const meia = G * 0.075;                                 // metade da espessura do traço, em px

  // Só percorremos a caixa da letra (+ folga do traço). O resto do quadrado já está pintado —
  // varrer 100% dos pixels custaria ~5× mais CPU no Worker por nada.
  const m = Math.ceil(meia + 2);
  const ix0 = Math.max(0, Math.floor(x0 - m)), ix1 = Math.min(s - 1, Math.ceil(x0 + G + m));
  const iy0 = Math.max(0, Math.floor(y0 - m)), iy1 = Math.min(s - 1, Math.ceil(y0 + G + m));

  // Segmentos em PIXEL, com bbox — rejeitar por bbox é o que mantém isto barato.
  const segs = [];
  for (const linha of traços) {
    for (let i = 0; i + 1 < linha.length; i++) {
      const ax = x0 + linha[i][0] * G, ay = y0 + linha[i][1] * G;
      const bx = x0 + linha[i + 1][0] * G, by = y0 + linha[i + 1][1] * G;
      segs.push({
        ax, ay, bx, by, dx: bx - ax, dy: by - ay, len2: (bx - ax) ** 2 + (by - ay) ** 2,
        minx: Math.min(ax, bx) - m, maxx: Math.max(ax, bx) + m,
        miny: Math.min(ay, by) - m, maxy: Math.max(ay, by) + m,
      });
    }
  }

  for (let y = iy0; y <= iy1; y++) {
    const py = y + 0.5;
    for (let x = ix0; x <= ix1; x++) {
      const pxx = x + 0.5;
      let d2 = Infinity;
      for (const g of segs) {
        if (pxx < g.minx || pxx > g.maxx || py < g.miny || py > g.maxy) continue;
        let t = g.len2 > 0 ? ((pxx - g.ax) * g.dx + (py - g.ay) * g.dy) / g.len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = pxx - (g.ax + t * g.dx), ey = py - (g.ay + t * g.dy);
        const v = ex * ex + ey * ey;
        if (v < d2) d2 = v;
      }
      if (d2 === Infinity) continue;
      // antialias de 1px: alpha = quanto do pixel está dentro do traço
      const a = meia - Math.sqrt(d2) + 0.5;
      if (a <= 0) continue;
      px[y * s + x] = Math.round(Math.min(1, a) * 15);
    }
  }

  return pngPaleta4(s, s, px, paleta);
}
