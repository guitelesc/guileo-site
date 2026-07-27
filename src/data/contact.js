// ───────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for all Guileo contact details.
// Update these values once → the whole site (lead form, footer,
// every CTA) updates automatically. Replace the placeholders.
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

import { trackContact } from "../lib/analytics.js";

// Helper: build a WhatsApp deep-link with an optional prefilled message.
// Stays PURE — just builds the URL, fires nothing.
export const waLink = (text = "") =>
  `https://wa.me/${CONTACT.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

// Helper: WhatsApp deep-link to a SPECIFIC recipient (e.g. the client's own customer).
// Falls back to Guileo's line only if no phone is given, so a "Message customer" button
// actually opens a chat to the customer — not to Guileo's support number.
export const waTo = (phone, text = "") => {
  const digits = String(phone || "").replace(/[^0-9]/g, "");
  return digits.length >= 8
    ? `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`
    : waLink(text);
};

// Helper: fire a Contact conversion, then open WhatsApp in a new tab.
// Use this for WhatsApp CTAs that should count as a contact conversion.
// trackContact() is fire-and-forget and no-ops until pixel IDs are set;
// the window.open always runs even if tracking is unavailable.
export const openWhatsApp = (text = "") => {
  try { trackContact(); } catch { /* tracking must never block contact */ }
  if (typeof window !== "undefined") window.open(waLink(text), "_blank", "noopener");
};

// Helper: the "Book a demo" link — a real Calendly/Cal.com URL if set, else WhatsApp (always functional).
export const bookLink = (text = "I'd like to book a Guileo demo") =>
  CONTACT.calendly && CONTACT.calendly !== "#" ? CONTACT.calendly : waLink(text);
