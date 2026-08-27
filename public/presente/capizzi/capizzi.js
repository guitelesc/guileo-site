/* O JSON-LD é montado aqui e IMPRESSO na tela — a mesma string que o botão copia.
   Nada de "confia em mim": o dono lê exatamente o que vai colar.
   Script EXTERNO por obrigação: o CSP do guileoai.com bloqueia <script> inline e o bloco de
   código sairia VAZIO na tela do prospect, sem erro visível. */
var LD = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Capizzi Pizza",
  "url": "https://capizzinyc.com/",
  "telephone": "",
  "email": "capizzinychellskitchen@gmail.com",
  "servesCuisine": ["Italian", "Pizza", "Wood-fired pizza"],
  "priceRange": "$$",
  "menu": "https://capizzinyc.com/pages/food-menu",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "547 9th Avenue",
    "addressLocality": "New York",
    "addressRegion": "NY",
    "postalCode": "10018",
    "addressCountry": "US"
  },
  "areaServed": { "@type": "Place", "name": "Hell's Kitchen, Midtown West, Manhattan" },
  /* Os horários DELES, incluindo a parada das 15h30 às 17h — que só existe como texto solto no
     rodapé. Duas faixas por dia é exatamente o que schema.org modela; o site não modelava nada. */
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday"],
      "opens": "11:00", "closes": "15:30" },
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday"],
      "opens": "17:00", "closes": "23:00" },
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Friday", "Saturday"],
      "opens": "11:00", "closes": "15:30" },
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Friday", "Saturday"],
      "opens": "17:00", "closes": "24:00" },
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Sunday", "opens": "12:00", "closes": "22:00" }
  ],
  /* sameAs correto: só o que é REALMENTE de vocês. */
  "sameAs": ["https://www.instagram.com/capizzinyc/"],
  "potentialAction": {
    "@type": "OrderAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://www.doordash.com/store/capizzi-new-york-2361336/",
      "actionPlatform": [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/IOSPlatform",
        "http://schema.org/AndroidPlatform"
      ]
    },
    "deliveryMethod": "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"
  },
  "hasMenu": {
    "@type": "Menu",
    "url": "https://capizzinyc.com/pages/food-menu",
    "hasMenuSection": [
      { "@type": "MenuSection", "name": "Appetizers & Salads" },
      { "@type": "MenuSection", "name": "Pizzas" },
      { "@type": "MenuSection", "name": "Desserts" },
      { "@type": "MenuSection", "name": "Wine & Beer" }
    ]
  }
};

var bloco = '<script type="application/ld+json">\n' + JSON.stringify(LD, null, 2) + '\n<\/script>';

/* esc() escapa & < > e NÃO as aspas — o realce procura a aspa literal. Procurando &quot; ele não
   acha nada e o bloco sai sem cor nenhuma, calado. (Já aconteceu uma vez.) */
function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
document.getElementById('ld').innerHTML = esc(bloco)
  .replace(/"([^"]+)"(\s*:)/g, '<span class="k">"$1"</span>$2')
  .replace(/:\s"([^"]*)"/g, ': <span class="s">"$1"</span>');

document.getElementById('copy').addEventListener('click', function () {
  function marca() {
    var o = document.getElementById('ok');
    o.dataset.on = '1';
    setTimeout(function () { o.dataset.on = '0'; }, 2200);
  }
  /* navigator.clipboard exige https E permissão; num webview de e-mail falha calado.
     O caminho antigo garante que o botão não minta dizendo "Copied" sem ter copiado. */
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = bloco; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (ok) { marca(); }
    else {
      var o = document.getElementById('ok');
      o.textContent = 'Select the block above and copy it'; o.dataset.on = '1';
    }
  }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(bloco).then(marca, fallback);
  } else { fallback(); }
});
