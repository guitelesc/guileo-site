/* O JSON-LD é montado aqui e IMPRESSO na tela — a mesma string que o botão copia.
   Nada de "confie em mim": o dono lê exatamente o que vai colar. */
const LD = {
  "@context": "https://schema.org",
  "@type": "HairSalon",
  "name": "D'Shal Salon",
  "url": "https://dshalnyc.com/",
  "telephone": "+1-212-689-6815",
  "email": "dshalnyc@gmail.com",
  "priceRange": "$20–$500",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "309 E 23rd Street",
    "addressLocality": "New York",
    "addressRegion": "NY",
    "postalCode": "10010",
    "addressCountry": "US"
  },
  "areaServed": { "@type": "Place", "name": "Gramercy, Kips Bay and Midtown East, Manhattan" },
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Tuesday","Wednesday","Thursday","Friday","Saturday"],
      "opens": "10:00", "closes": "19:30" },
    { "@type": "OpeningHoursSpecification", "dayOfWeek": "Sunday", "opens": "10:00", "closes": "18:00" }
  ],
  "sameAs": [
    "https://www.instagram.com/dshal.salon/",
    "https://www.vagaro.com/dshalsalon/book-now"
  ],
  "potentialAction": {
    "@type": "ReserveAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://www.vagaro.com/dshalsalon/book-now",
      "actionPlatform": [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/IOSPlatform",
        "http://schema.org/AndroidPlatform"
      ]
    },
    "result": { "@type": "Reservation", "name": "Salon appointment" }
  },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Services",
    "itemListElement": [
      "Women's haircut","Men's haircut","Children's haircut","Shampoo and blowout",
      "Root touch up","Full head color","Balayage","Ombré","Full head highlights",
      "Half head highlights","Partial highlights","Double process color","Color gloss",
      "Color correction","Keratin treatment","Brazilian blowout","Olaplex treatment",
      "K18 treatment","Hair extensions","Updo","Bridal hair","Makeup","Bridal makeup",
      "Facials","Massage","Waxing and hair removal"
    ].map(function (n) {
      return { "@type": "Offer", "itemOffered": { "@type": "Service", "name": n } };
    })
  }
};

const bloco = '<script type="application/ld+json">\n' + JSON.stringify(LD, null, 2) + '\n<\/script>';

/* Realce simples: chaves em dourado, valores em verde. Sem biblioteca — a página tem que abrir
   em qualquer lugar, inclusive dentro de um cliente de e-mail que abre o link no navegador dele. */
const esc = function (t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
/* esc() escapa & < > e NÃO as aspas — o realce tem que procurar a aspa literal.
   Procurando &quot; ele não achava nada e o bloco saía sem cor nenhuma, calado. */
document.getElementById('ld').innerHTML = esc(bloco)
  .replace(/"([^"]+)"(\s*:)/g, '<span class="k">"$1"</span>$2')
  .replace(/:\s"([^"]*)"/g, ': <span class="s">"$1"</span>');

document.getElementById('copy').addEventListener('click', function () {
  const marca = function () {
    const o = document.getElementById('ok');
    o.dataset.on = '1';
    setTimeout(function () { o.dataset.on = '0'; }, 2200);
  };
  /* navigator.clipboard exige https E permissão; num webview de e-mail ele falha calado.
     O caminho antigo é o que garante que o botão não minta dizendo "Copied" sem copiar. */
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(bloco).then(marca, fallback);
  } else { fallback(); }
  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = bloco; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (ok) { marca(); }
    else { document.getElementById('ok').textContent = 'Select the block above and copy it'; document.getElementById('ok').dataset.on = '1'; }
  }
});
