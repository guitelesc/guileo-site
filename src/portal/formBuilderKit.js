/* Construtor de formulário (Captura) — a parte sem tela: textos nos 4 idiomas, tipos de campo,
   modelos prontos e a geração das chaves.

   O formato que sai daqui é EXATAMENTE o que a página pública /f/:id (src/pages/Formulario.jsx) lê:
     { key, label, type, required, options? }
       type ∈ text | textarea | email | tel | date | checkbox | select | signature
       options: só em "select" — lista de textos (Formulario.optionsOf aceita array de strings)
   Assinatura: a página só torna o quadro de assinatura OBRIGATÓRIO quando existe um campo
   type:"signature" com required:true — por isso no máximo UM campo de assinatura.

   Chaves: as respostas são gravadas por chave. Campo que já veio do servidor MANTÉM a chave
   (renomear o rótulo de um formulário publicado não pode separar as respostas antigas das novas);
   campo novo ganha a chave do rótulo (slug), única dentro do formulário. */

// Textos do construtor. Os dicionários do Portal (tr) não são deste arquivo — tabela local.
const S = {
  en: {
    fields: "Fields", addField: "Add field", labelPh: "Question or label", type: "Type", required: "Required",
    moveUp: "Move up", moveDown: "Move down", remove: "Remove field",
    options: "Options", addOption: "Add option", optionPh: "Option", removeOption: "Remove option",
    t_text: "Short text", t_textarea: "Long text", t_email: "Email", t_tel: "Phone", t_date: "Date",
    t_checkbox: "Yes/No checkbox", t_select: "Multiple choice", t_signature: "Signature",
    sigTaken: "(already in the form)",
    sigNote: "The customer signs with a finger or mouse at the end of the form.",
    checkboxNote: "The customer ticks this box. If it's required, the form can't be sent without it.",
    templates: "Start from a template", tplSpa: "Spa intake & consent", tplMed: "Med spa consent",
    replaceConfirm: "Replace the current fields with this template?",
    contactNote: "Name, phone and email always appear at the top of the form. Add them here only to change their label or make them required.",
    noFields: "No fields yet — add one or start from a template.",
    errLabel: "Every field needs a label.", errOptions: "Multiple choice needs at least two options.",
    errOneSig: "Only one signature field per form.", errMax: "A form can have up to 30 fields.",
    savedTitle: "Form saved — this is the link for your customers", copy: "Copy", copied: "Link copied ✓", open: "Open", close: "Close",
    // rótulos dos modelos (o cliente final lê)
    f_allergies: "Allergies (products, ingredients or medications)",
    f_medications: "Medications you are currently taking",
    f_pregnant: "I am pregnant or breastfeeding",
    f_skin: "Skin conditions",
    o_none: "None", o_sensitive: "Sensitive skin", o_acne: "Acne", o_rosacea: "Rosacea", o_eczema: "Eczema / dermatitis", o_psoriasis: "Psoriasis", o_other: "Other",
    f_avoid: "Areas to avoid during the treatment",
    f_previous: "Previous treatments in the last 6 months (e.g. Botox, fillers, peels, laser)",
    f_consent: "I confirm the information is true and I consent to the treatment",
    f_signature: "Signature",
  },
  pt: {
    fields: "Campos", addField: "Adicionar campo", labelPh: "Pergunta ou rótulo", type: "Tipo", required: "Obrigatório",
    moveUp: "Subir", moveDown: "Descer", remove: "Remover campo",
    options: "Opções", addOption: "Adicionar opção", optionPh: "Opção", removeOption: "Remover opção",
    t_text: "Texto curto", t_textarea: "Texto longo", t_email: "E-mail", t_tel: "Telefone", t_date: "Data",
    t_checkbox: "Caixa Sim/Não", t_select: "Múltipla escolha", t_signature: "Assinatura",
    sigTaken: "(já está no formulário)",
    sigNote: "O cliente assina com o dedo ou o mouse no fim do formulário.",
    checkboxNote: "O cliente marca esta caixa. Se for obrigatória, o formulário não é enviado sem ela.",
    templates: "Começar de um modelo", tplSpa: "Ficha de spa e consentimento", tplMed: "Consentimento de med spa",
    replaceConfirm: "Trocar os campos atuais por este modelo?",
    contactNote: "Nome, telefone e e-mail sempre aparecem no topo do formulário. Adicione aqui só para mudar o rótulo ou torná-los obrigatórios.",
    noFields: "Nenhum campo ainda — adicione um ou comece de um modelo.",
    errLabel: "Todo campo precisa de um rótulo.", errOptions: "Múltipla escolha precisa de pelo menos duas opções.",
    errOneSig: "Só um campo de assinatura por formulário.", errMax: "Um formulário pode ter até 30 campos.",
    savedTitle: "Formulário salvo — este é o link para seus clientes", copy: "Copiar", copied: "Link copiado ✓", open: "Abrir", close: "Fechar",
    f_allergies: "Alergias (produtos, ingredientes ou medicamentos)",
    f_medications: "Medicamentos que você usa atualmente",
    f_pregnant: "Estou grávida ou amamentando",
    f_skin: "Condições de pele",
    o_none: "Nenhuma", o_sensitive: "Pele sensível", o_acne: "Acne", o_rosacea: "Rosácea", o_eczema: "Eczema / dermatite", o_psoriasis: "Psoríase", o_other: "Outra",
    f_avoid: "Áreas a evitar durante o tratamento",
    f_previous: "Tratamentos nos últimos 6 meses (ex.: Botox, preenchimento, peeling, laser)",
    f_consent: "Confirmo que as informações são verdadeiras e autorizo o tratamento",
    f_signature: "Assinatura",
  },
  es: {
    fields: "Campos", addField: "Agregar campo", labelPh: "Pregunta o etiqueta", type: "Tipo", required: "Obligatorio",
    moveUp: "Subir", moveDown: "Bajar", remove: "Quitar campo",
    options: "Opciones", addOption: "Agregar opción", optionPh: "Opción", removeOption: "Quitar opción",
    t_text: "Texto corto", t_textarea: "Texto largo", t_email: "Correo electrónico", t_tel: "Teléfono", t_date: "Fecha",
    t_checkbox: "Casilla Sí/No", t_select: "Opción múltiple", t_signature: "Firma",
    sigTaken: "(ya está en el formulario)",
    sigNote: "El cliente firma con el dedo o el ratón al final del formulario.",
    checkboxNote: "El cliente marca esta casilla. Si es obligatoria, el formulario no se envía sin ella.",
    templates: "Empezar desde una plantilla", tplSpa: "Ficha de spa y consentimiento", tplMed: "Consentimiento de med spa",
    replaceConfirm: "¿Reemplazar los campos actuales por esta plantilla?",
    contactNote: "Nombre, teléfono y correo siempre aparecen arriba del formulario. Agrégalos aquí solo para cambiar la etiqueta o hacerlos obligatorios.",
    noFields: "Todavía no hay campos — agrega uno o empieza desde una plantilla.",
    errLabel: "Cada campo necesita una etiqueta.", errOptions: "La opción múltiple necesita al menos dos opciones.",
    errOneSig: "Solo un campo de firma por formulario.", errMax: "Un formulario puede tener hasta 30 campos.",
    savedTitle: "Formulario guardado — este es el enlace para tus clientes", copy: "Copiar", copied: "Enlace copiado ✓", open: "Abrir", close: "Cerrar",
    f_allergies: "Alergias (productos, ingredientes o medicamentos)",
    f_medications: "Medicamentos que tomas actualmente",
    f_pregnant: "Estoy embarazada o en periodo de lactancia",
    f_skin: "Condiciones de la piel",
    o_none: "Ninguna", o_sensitive: "Piel sensible", o_acne: "Acné", o_rosacea: "Rosácea", o_eczema: "Eccema / dermatitis", o_psoriasis: "Psoriasis", o_other: "Otra",
    f_avoid: "Zonas a evitar durante el tratamiento",
    f_previous: "Tratamientos en los últimos 6 meses (ej.: Botox, rellenos, peelings, láser)",
    f_consent: "Confirmo que la información es verdadera y doy mi consentimiento para el tratamiento",
    f_signature: "Firma",
  },
  hi: {
    fields: "फ़ील्ड", addField: "फ़ील्ड जोड़ें", labelPh: "सवाल या लेबल", type: "प्रकार", required: "ज़रूरी",
    moveUp: "ऊपर करें", moveDown: "नीचे करें", remove: "फ़ील्ड हटाएँ",
    options: "विकल्प", addOption: "विकल्प जोड़ें", optionPh: "विकल्प", removeOption: "विकल्प हटाएँ",
    t_text: "छोटा टेक्स्ट", t_textarea: "लंबा टेक्स्ट", t_email: "ईमेल", t_tel: "फ़ोन", t_date: "तारीख",
    t_checkbox: "हाँ/नहीं चेकबॉक्स", t_select: "बहुविकल्पी", t_signature: "हस्ताक्षर",
    sigTaken: "(फ़ॉर्म में पहले से है)",
    sigNote: "ग्राहक फ़ॉर्म के आख़िर में उँगली या माउस से हस्ताक्षर करता है।",
    checkboxNote: "ग्राहक यह बॉक्स टिक करता है। ज़रूरी हो तो इसके बिना फ़ॉर्म नहीं भेजा जा सकता।",
    templates: "टेम्पलेट से शुरू करें", tplSpa: "स्पा इनटेक और सहमति", tplMed: "मेड स्पा सहमति",
    replaceConfirm: "मौजूदा फ़ील्ड को इस टेम्पलेट से बदलें?",
    contactNote: "नाम, फ़ोन और ईमेल हमेशा फ़ॉर्म में सबसे ऊपर दिखते हैं। इन्हें यहाँ सिर्फ़ लेबल बदलने या ज़रूरी बनाने के लिए जोड़ें।",
    noFields: "अभी कोई फ़ील्ड नहीं — एक जोड़ें या टेम्पलेट से शुरू करें।",
    errLabel: "हर फ़ील्ड का एक लेबल होना चाहिए।", errOptions: "बहुविकल्पी में कम से कम दो विकल्प चाहिए।",
    errOneSig: "एक फ़ॉर्म में सिर्फ़ एक हस्ताक्षर फ़ील्ड।", errMax: "एक फ़ॉर्म में अधिकतम 30 फ़ील्ड हो सकते हैं।",
    savedTitle: "फ़ॉर्म सेव हो गया — यह आपके ग्राहकों के लिए लिंक है", copy: "कॉपी करें", copied: "लिंक कॉपी हो गया ✓", open: "खोलें", close: "बंद करें",
    f_allergies: "एलर्जी (प्रोडक्ट, सामग्री या दवाइयाँ)",
    f_medications: "अभी ली जा रही दवाइयाँ",
    f_pregnant: "मैं गर्भवती हूँ या स्तनपान करा रही हूँ",
    f_skin: "त्वचा की स्थिति",
    o_none: "कोई नहीं", o_sensitive: "संवेदनशील त्वचा", o_acne: "मुँहासे", o_rosacea: "रोसेशिया", o_eczema: "एक्ज़िमा / डर्मेटाइटिस", o_psoriasis: "सोरायसिस", o_other: "अन्य",
    f_avoid: "उपचार के दौरान किन हिस्सों से बचना है",
    f_previous: "पिछले 6 महीनों में हुए उपचार (जैसे बोटॉक्स, फ़िलर, पील, लेज़र)",
    f_consent: "मैं पुष्टि करता/करती हूँ कि जानकारी सही है और उपचार के लिए सहमति देता/देती हूँ",
    f_signature: "हस्ताक्षर",
  },
};
export const fb = (lang) => S[lang] || S.en;

export const FIELD_TYPES = ["text", "textarea", "email", "tel", "date", "checkbox", "select", "signature"];
const ALIAS = { long: "textarea", long_text: "textarea", paragraph: "textarea", phone: "tel", telephone: "tel", yesno: "checkbox", yes_no: "checkbox", boolean: "checkbox", bool: "checkbox", choice: "select", radio: "select", multiple_choice: "select", dropdown: "select" };
const fold = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const normType = (t) => { const x = fold(t).trim(); const y = ALIAS[x] || x; return FIELD_TYPES.includes(y) ? y : "text"; };
const optsOf = (f) => {
  const o = f.options ?? f.choices;
  if (Array.isArray(o)) return o.map((x) => (typeof x === "object" && x ? (x.label ?? x.value ?? "") : x)).map(String);
  if (typeof o === "string") return o.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  return [];
};

let _uid = 0;
const uid = () => `fld_${Date.now().toString(36)}_${(_uid += 1)}`;

// Campo de edição (estado da tela). `keyFixed`: a chave NÃO é regerada a partir do rótulo.
export const blankField = (type = "text") => ({ uid: uid(), key: "", keyFixed: false, label: "", type, required: false, options: type === "select" ? ["", ""] : [] });
// Campos que vieram do servidor (editar um formulário existente): a chave fica.
export const fromServer = (fields) => (Array.isArray(fields) ? fields : []).filter((f) => f && (f.key || f.label)).slice(0, 30).map((f) => {
  const type = normType(f.type);
  const key = (f.key || "").toString();
  return { uid: uid(), key, keyFixed: !!key, label: (f.label || f.key || "").toString(), type, required: !!f.required, options: type === "select" ? optsOf(f) : [] };
});

// Formulário novo: os mesmos três campos de antes (viram o bloco de contato na página pública,
// não perguntas repetidas) — no idioma da tela.
export const starterFields = (trFn) => [
  { ...blankField("text"), label: trFn("Name"), required: true },
  { ...blankField("tel"), label: trFn("Phone"), required: true },
  { ...blankField("email"), label: trFn("Email") },
];

// Modelos. Chaves FIXAS em inglês (iguais em qualquer idioma da tela) — as respostas de um spa
// que troca o idioma do painel continuam na mesma coluna. Nome/telefone/e-mail NÃO entram: o
// bloco de contato da página já pede. A chave do consentimento NÃO é "consent": a página grava
// answers.consent = "yes" quando o cliente assina, e uma chave igual seria sobrescrita.
const fx = (key, type, label, required = false, options = []) => ({ uid: uid(), key, keyFixed: true, label, type, required, options });
export const TEMPLATES = {
  spa: (L) => [
    fx("allergies", "textarea", L.f_allergies, true),
    fx("medications", "textarea", L.f_medications),
    fx("pregnant_or_breastfeeding", "checkbox", L.f_pregnant),
    fx("skin_conditions", "select", L.f_skin, false, [L.o_none, L.o_sensitive, L.o_acne, L.o_rosacea, L.o_eczema, L.o_psoriasis, L.o_other]),
    fx("areas_to_avoid", "textarea", L.f_avoid),
    fx("consent_confirmation", "checkbox", L.f_consent, true),
    fx("signature", "signature", L.f_signature, true),
  ],
  medspa: (L) => [
    fx("allergies", "textarea", L.f_allergies, true),
    fx("medications", "textarea", L.f_medications),
    fx("previous_treatments_6m", "textarea", L.f_previous),
    fx("pregnant_or_breastfeeding", "checkbox", L.f_pregnant),
    fx("skin_conditions", "select", L.f_skin, false, [L.o_none, L.o_sensitive, L.o_acne, L.o_rosacea, L.o_eczema, L.o_psoriasis, L.o_other]),
    fx("areas_to_avoid", "textarea", L.f_avoid),
    fx("consent_confirmation", "checkbox", L.f_consent, true),
    fx("signature", "signature", L.f_signature, true),
  ],
};

// chaves que a página/servidor usam por conta própria (submit separa signature/signed_at; a
// página grava consent quando há assinatura)
const RESERVED = new Set(["signature", "signed_at", "consent"]);
export const slugKey = (label) => fold(label).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

// Valida e devolve { fields } prontos para save_form, ou { erro: "<chave do texto>" }.
export const buildFields = (list) => {
  const rows = (Array.isArray(list) ? list : []).map((f) => ({ ...f, label: (f.label || "").trim() }));
  if (rows.length > 30) return { erro: "errMax" };
  if (rows.some((f) => !f.label)) return { erro: "errLabel" };
  if (rows.filter((f) => f.type === "signature").length > 1) return { erro: "errOneSig" };
  const opts = (f) => [...new Set((f.options || []).map((o) => (o || "").toString().trim().slice(0, 120)).filter(Boolean))].slice(0, 30);
  if (rows.some((f) => f.type === "select" && opts(f).length < 2)) return { erro: "errOptions" };

  const used = new Set();
  const uniq = (base) => { let k = base.slice(0, 60); let n = 2; while (used.has(k)) { const suf = `_${n}`; k = `${base.slice(0, 60 - suf.length)}${suf}`; n += 1; } used.add(k); return k; };
  // 1º as chaves fixas (já publicadas / do modelo), depois as novas — a nova é que se desvia
  const keys = rows.map((f) => (f.keyFixed && f.key ? uniq(f.key.toString()) : null));
  rows.forEach((f, i) => {
    if (keys[i]) return;
    let base = slugKey(f.label) || `field_${i + 1}`;
    if (f.type === "signature") base = "signature";
    else if (RESERVED.has(base)) base = `${base}_answer`;
    keys[i] = uniq(base);
  });
  return {
    fields: rows.map((f, i) => {
      const out = { key: keys[i], label: f.label.slice(0, 120), type: normType(f.type), required: !!f.required };
      if (out.type === "select") out.options = opts(f);
      return out;
    }),
  };
};
