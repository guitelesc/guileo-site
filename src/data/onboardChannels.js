// The full omnichannel catalog captured at onboarding ("CADASTRO COMPLETO"). The seller fills
// EVERY channel the client uses; the intake payload stores them under `channels`. Some are LIVE
// today, the rest are captured now and stay wired+inert — they light up automatically the moment
// that platform's API is approved (same pattern already proven with WhatsApp).
//
// CHANNEL STATUS truth (honest, no fake):
//   LIVE today    → phone/voice, web widget, email
//   PENDING (capture the handle/link now, "acende quando a API liberar") → SMS (A2P 10DLC
//                    reprovado, erro Twilio 30034), whatsapp, instagram, facebook, linkedin,
//                    tiktok, youtube, google_business, ads, reviews
//
// 🚨 A FONTE DA VERDADE É `functions/lib/productFacts.js` (ARQUITETURA §3 "Honestidade de canal").
// Este arquivo dizia SMS = live enquanto o productFacts dizia PENDING — e a lei diz que os
// arquivos de estado de canal são lidos como lei e NÃO PODEM DISCORDAR. Vendedor que marca SMS
// no cadastro achando que acende hoje promete ao dono do negócio um canal que não sai: é
// reembolso e reputação de envio queimada. Quando o A2P aprovar, os três mudam JUNTOS, no mesmo
// commit: productFacts.js · selfServePlans.js · ARQUITETURA.md (e este catálogo com eles).
//
// field tells the form which input to render for each channel:
//   'buy'    → phone flow (buy a number / map an existing one / forward)
//   'toggle' → on/off (web widget, ads)
//   'number' → a phone number
//   'handle' → an @handle / username
//   'url'    → a full link
export const CHANNELS = [
  // ── LIVE ──────────────────────────────────────────────────────────────────
  { key: "phone",  label: "Telefone / Voz", emoji: "📞", status: "live", field: "buy",    placeholder: "Comprar número, mapear o atual ou encaminhar",
    note: "A Gui atende ligações 24/7 com voz própria. Compre um número novo, use o atual (mapeando) ou encaminhe as chamadas." },
  { key: "widget", label: "Widget no site", emoji: "🌐", status: "live", field: "toggle", placeholder: "",
    note: "O chat da Gui no site do cliente, com o LOGO e a COR da marca dele. Uma tag e pronto." },
  { key: "email",  label: "E-mail",         emoji: "📧", status: "live", field: "toggle", placeholder: "",
    note: "A Gui envia confirmações, orçamentos e follow-ups por e-mail de marca. Ativo hoje." },

  // ── PENDING (capture agora, acende quando a API liberar) ─────────────────────
  // SMS mora AQUI, não em LIVE: a campanha A2P 10DLC foi reprovada (erro Twilio 30034) e o
  // envio nos EUA está bloqueado. O código está pronto e acende sozinho na aprovação.
  { key: "sms",    label: "SMS",            emoji: "💬", status: "pending", field: "toggle", placeholder: "",
    note: "Respostas e lembretes por SMS a partir do número da Gui. Código pronto — PENDENTE do registro A2P 10DLC nos EUA (campanha reprovada, erro 30034). Acende sozinho quando aprovar." },
  { key: "whatsapp",        label: "WhatsApp",         emoji: "🟢", status: "pending", field: "number", placeholder: "+1 555 000 0000",
    note: "Número do WhatsApp Business. Já está wired — acende quando a API do WhatsApp liberar." },
  { key: "instagram",       label: "Instagram",        emoji: "📸", status: "pending", field: "handle", placeholder: "@perfil",
    note: "DMs e comentários respondidos pela Gui. Capturamos o @ agora — acende quando a API liberar." },
  { key: "facebook",        label: "Facebook",         emoji: "👍", status: "pending", field: "handle", placeholder: "@página",
    note: "Messenger e comentários da Página. Capturamos o @ agora — acende quando a API liberar." },
  { key: "linkedin",        label: "LinkedIn",         emoji: "💼", status: "pending", field: "url",    placeholder: "https://linkedin.com/company/…",
    note: "Página da empresa no LinkedIn. Capturamos o link agora — acende quando a API liberar." },
  { key: "tiktok",          label: "TikTok",           emoji: "🎵", status: "pending", field: "handle", placeholder: "@perfil",
    note: "Mensagens e comentários no TikTok. Capturamos o @ agora — acende quando a API liberar." },
  { key: "youtube",         label: "YouTube",          emoji: "▶️", status: "pending", field: "url",    placeholder: "https://youtube.com/@canal",
    note: "Comentários do canal. Capturamos o link agora — acende quando a API liberar." },
  { key: "google_business", label: "Google Empresas",  emoji: "🔎", status: "pending", field: "url",    placeholder: "https://g.page/…",
    note: "Perfil do Google (mensagens e avaliações). Capturamos o link agora — acende quando a API liberar." },
  { key: "ads",             label: "Anúncios",         emoji: "📣", status: "pending", field: "toggle", placeholder: "",
    note: "Gestão e resposta de leads de anúncios (Meta/Google). Capturamos o interesse agora — acende quando a API liberar." },
  { key: "reviews",         label: "Avaliações",       emoji: "⭐", status: "pending", field: "url",    placeholder: "Link para pedir avaliação",
    note: "Máquina de reviews: a Gui pede avaliação no momento certo. Capturamos o link agora — acende quando a API liberar." },
];

// Helpers: split the catalog by status for the two sections of the intake form.
export const CHANNELS_LIVE = CHANNELS.filter((c) => c.status === "live");
export const CHANNELS_PENDING = CHANNELS.filter((c) => c.status === "pending");
