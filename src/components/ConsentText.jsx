// TEXTO DE CONSENTIMENTO (TCPA / A2P 10DLC) — FONTE ÚNICA.
//
// POR QUE ESTE ARQUIVO EXISTE: o texto vivia copiado em 4 formulários. Isso é texto
// REGULATÓRIO — quando a operadora exige uma mudança, esquecer um dos quatro é o
// suficiente pra reprovar a campanha inteira. Aqui muda em um lugar e vale em todos.
//
// O QUE A OPERADORA EXIGE (e o que faltava até 2026-08-03, quando a campanha A2P foi
// reprovada exatamente por "opt-in information"):
//   1. quem vai contatar (marca)          ✅ já tinha
//   2. por qual meio (ligação/mensagem)   ✅ já tinha
//   3. que podem incidir tarifas          ✅ já tinha
//   4. como sair (STOP)                   ✅ já tinha
//   5. FREQUÊNCIA das mensagens           ❌ FALTAVA
//   6. link para a Política de Privacidade ❌ FALTAVA
//
// 13/10/2026 — 4ª tentativa: o verificador da Twilio acusou "consent to messages from affiliates or
// other companies" porque a frase nomeava "Gui (Guileo)" e não a empresa REGISTRADA (TRANSPOINT, o EIN).
// Agora a frase nomeia a empresa registrada pelo nome fantasia + razão social. Mudou aqui, mude a
// citação em db/A2P_CAMPANHA_COLAR_*.txt e na campanha da Twilio no MESMO dia.
//
// O revisor da campanha ABRE o site pra conferir se o consentimento bate com o que foi
// declarado. Este texto é o que ele vai ler.
const T = {
  en: {
    lead: "I agree to receive calls and text messages from Guileo AI (TRANSPOINT) at the number provided.",
    rates: "Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out, HELP for help.",
    privacy: "Privacy Policy",
  },
  pt: {
    lead: "Concordo em receber ligações e mensagens de texto da Guileo AI (TRANSPOINT) no número informado.",
    rates: "Podem incidir tarifas de mensagem e dados. A frequência varia. Responda STOP para sair, HELP para ajuda.",
    privacy: "Política de Privacidade",
  },
  es: {
    lead: "Acepto recibir llamadas y mensajes de texto de Guileo AI (TRANSPOINT) en el número indicado.",
    rates: "Pueden aplicar tarifas de mensajes y datos. La frecuencia varía. Responde STOP para cancelar, HELP para ayuda.",
    privacy: "Política de Privacidad",
  },
  hi: {
    lead: "मैं दिए गए नंबर पर Guileo AI (TRANSPOINT) से कॉल और टेक्स्ट मैसेज पाने के लिए सहमत हूँ।",
    rates: "मैसेज और डेटा शुल्क लागू हो सकते हैं। फ़्रीक्वेंसी बदलती रहती है। रोकने के लिए STOP, मदद के लिए HELP भेजें।",
    privacy: "गोपनीयता नीति",
  },
};

export default function ConsentText({ lang = "en" }) {
  const t = T[(lang || "en").slice(0, 2)] || T.en;
  return (
    <>
      {t.lead} {t.rates}{" "}
      <a
        href="/privacy"
        target="_blank"
        rel="noreferrer"
        // stopPropagation: o texto vive DENTRO do <label> do checkbox — sem isto, clicar no
        // link também alternaria a caixa, e o usuário marcaria consentimento sem querer.
        onClick={(e) => e.stopPropagation()}
        className="underline underline-offset-2"
      >
        {t.privacy}
      </a>
      .
    </>
  );
}
