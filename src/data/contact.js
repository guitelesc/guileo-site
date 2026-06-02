// ───────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for all Guileo contact details.
// Update these values once → the whole site (lead form, footer,
// every CTA) updates automatically. Replace the placeholders.
// ───────────────────────────────────────────────────────────
export const CONTACT = {
  whatsapp: "15551234567",      // digits only, with country code. e.g. Brazil: 5565999990000  ← REPLACE
  email: "hello@guileo.ai",     // ← REPLACE with real inbox
  calendly: "#",                // booking link (Calendly / Cal.com) for "Book a demo"  ← REPLACE
  socials: {
    instagram: "#",
    linkedin: "#",
    tiktok: "#",
    youtube: "#",
    telegram: "#",
    x: "#",
    google: "#",                // Google Business profile
  },
};

// Helper: build a WhatsApp deep-link with an optional prefilled message.
export const waLink = (text = "") =>
  `https://wa.me/${CONTACT.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
