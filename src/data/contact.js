// ───────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for all Guileo contact details.
// Update these values once → the whole site (lead form, footer,
// every CTA) updates automatically. Replace the placeholders.
// ───────────────────────────────────────────────────────────
export const CONTACT = {
  whatsapp: "19295350191",      // digits only, with country code (US +1 929 535 0191)
  email: "hello@guileo.ai",     // ← REPLACE with real inbox if different
  calendly: "",                 // set a Calendly/Cal.com URL to use it; empty → "Book a demo" falls back to WhatsApp
  socials: {
    instagram: "",
    linkedin: "",
    tiktok: "",
    youtube: "",
    telegram: "",
    x: "",
    google: "",                 // Google Business profile
  },
};

// Helper: build a WhatsApp deep-link with an optional prefilled message.
export const waLink = (text = "") =>
  `https://wa.me/${CONTACT.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

// Helper: the "Book a demo" link — a real Calendly/Cal.com URL if set, else WhatsApp (always functional).
export const bookLink = (text = "I'd like to book a Guileo demo") =>
  CONTACT.calendly && CONTACT.calendly !== "#" ? CONTACT.calendly : waLink(text);
