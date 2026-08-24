// ───────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH dos contatos da Guileo — DADO PURO.
// Separado de contact.js em 24/08 porque aquele arquivo importa `analytics.js`,
// que usa `import.meta.env` (só existe no bundle do Vite). O e-mail roda numa
// Cloudflare Function, e importar o arquivo com comportamento derrubava o
// template inteiro — um dado não pode arrastar o mundo do navegador junto.
// contact.js re-exporta daqui: continua UMA fonte, agora importável dos dois lados.
// ───────────────────────────────────────────────────────────
export const CONTACT = {
  whatsapp: "19295350191",      // digits only, with country code (US +1 929 535 0191)
  email: "smart@guileoai.com",     // real owner inbox (confirmed by Luis 2026-06-10)
  calendly: "https://cal.com/guileo",   // Cal.com booking link for "Book a demo" (confirmed Luis's)
  socials: {
    instagram: "https://instagram.com/guileoai",     // main brand IG
    instagramAd: "https://instagram.com/guileo.ad",  // Guileo.AD leg IG
    linkedin: "",
    tiktok: "",
    youtube: "",
    telegram: "",
    x: "",
    google: "",                 // Google Business profile
  },
};
