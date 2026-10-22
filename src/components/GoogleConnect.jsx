import { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════════════════════
   GOOGLE CONNECT — o MESMO botão nos dois lados (Luis, 2026-08-20):
     «pra eu ativar a agenda dela do Google é só logar no Google dela através do nosso sistema»

   Duas portas, um motor:
     • <GoogleConnectCard>  → cockpit do CLIENTE (aba Agenda e aba Google). Auth = e-mail +
       chave de conexão do tenant.
     • <SellerGoogle>       → hub do VENDEDOR, com a cliente sentada do lado. Ele escolhe um
       cliente DA CARTEIRA dele, gera o link e entrega o aparelho pra ela logar no Google dela.

   AS LEIS QUE ESTA TELA OBEDECE
   1. "Conectado ✓" é LEITURA, nunca intenção: o estado vem do que está GRAVADO no servidor
      (/api/google-oauth-start action:"status"), depois de voltar do Google. `r.ok` não prova
      nada — o endpoint responde 200 com { ok:false, error } quando não consegue LER.
   2. Erro nunca vira vazio: falha de leitura mostra o motivo CRU em vermelho. "Não deu pra
      perguntar" é diferente de "não conectado" — o segundo é uma afirmação sobre a conta do
      cliente que ninguém verificou.
   3. 🚨 O CASO PERIGOSO: o Google pode conceder MENOS do que pedimos (a pessoa desmarca a
      agenda na tela de consentimento). Aí existe token, existe "conectado", e o agendamento
      falha na PRIMEIRA ligação. Por isso a tela lista, item a item, o que está ligado — e
      grita em vermelho quando a agenda não veio.
   4. Honesto-inerte: sem GOOGLE_*_CLIENT_ID/SECRET no ambiente, a tela DIZ que a integração
      não está configurada e NÃO desenha um botão que não faz nada.
   5. 4 idiomas (pt·en·es·hi) com reserva sempre em `en`, nunca em `pt`.
   ═════════════════════════════════════════════════════════════════════════════════════════ */

const OK = "#3E9468", WARN = "#FFC23D", BAD = "#E2533F", GOO = "#4285F4";

const D = {
  title_cal: { en: "Your Google calendar", pt: "Sua agenda do Google", es: "Tu agenda de Google", hi: "आपका Google कैलेंडर" },
  title_rev: { en: "Your Google account", pt: "Sua conta do Google", es: "Tu cuenta de Google", hi: "आपका Google खाता" },
  sub_cal: {
    en: "Sign in to your own Google once and the agent reads your real availability and writes the booking straight into your calendar.",
    pt: "Faça login no seu próprio Google uma vez e a agente lê sua disponibilidade real e grava o agendamento direto na sua agenda.",
    es: "Inicia sesión en tu propio Google una vez y la agente lee tu disponibilidad real y agenda directo en tu calendario.",
    hi: "अपने Google में एक बार साइन इन करें — एजेंट आपकी असली उपलब्धता पढ़ेगी और बुकिंग सीधे आपके कैलेंडर में लिखेगी।",
  },
  sub_rev: {
    en: "One sign-in covers both: the calendar, and reading your Google reviews so you can approve the replies.",
    pt: "Um login só resolve os dois: a agenda, e a leitura das suas avaliações do Google para você aprovar as respostas.",
    es: "Un solo inicio de sesión cubre ambos: la agenda, y la lectura de tus reseñas de Google para que apruebes las respuestas.",
    hi: "एक ही साइन-इन दोनों के लिए: कैलेंडर, और आपकी Google समीक्षाएँ पढ़ना ताकि आप जवाब मंज़ूर कर सकें।",
  },
  connect: { en: "Connect my Google calendar", pt: "Conectar minha agenda do Google", es: "Conectar mi agenda de Google", hi: "मेरा Google कैलेंडर जोड़ें" },
  connect_seller: { en: "Generate the sign-in link for this client", pt: "Gerar o link de login pra este cliente", es: "Generar el enlace de acceso para este cliente", hi: "इस क्लाइंट के लिए साइन-इन लिंक बनाएँ" },
  reconnect: { en: "Reconnect", pt: "Reconectar", es: "Reconectar", hi: "फिर से जोड़ें" },
  disconnect: { en: "Disconnect", pt: "Desconectar", es: "Desconectar", hi: "डिस्कनेक्ट करें" },
  working: { en: "Working…", pt: "Trabalhando…", es: "Trabajando…", hi: "काम चल रहा है…" },
  checking: { en: "Checking the real state…", pt: "Verificando o estado real…", es: "Verificando el estado real…", hi: "असली स्थिति जाँची जा रही है…" },
  st_on: { en: "Connected", pt: "Conectado", es: "Conectado", hi: "जुड़ा हुआ" },
  st_partial: { en: "Connected — but incomplete", pt: "Conectado — mas incompleto", es: "Conectado — pero incompleto", hi: "जुड़ा — पर अधूरा" },
  st_off: { en: "Not connected yet", pt: "Ainda não conectado", es: "Aún no conectado", hi: "अभी कनेक्ट नहीं" },
  st_pick: { en: "Pick a client above", pt: "Escolha um cliente acima", es: "Elige un cliente arriba", hi: "ऊपर एक क्लाइंट चुनें" },
  st_err: { en: "Couldn't check right now", pt: "Não deu para verificar agora", es: "No se pudo verificar ahora", hi: "अभी जाँच नहीं हो सकी" },
  st_none: { en: "Integration not configured", pt: "Integração não configurada", es: "Integración no configurada", hi: "इंटीग्रेशन कॉन्फ़िगर नहीं" },
  not_configured: {
    en: "The Google sign-in isn't switched on for this platform yet (the Google keys are missing on the server). Nothing to click here — this lights up on its own the moment the keys are set.",
    pt: "O login do Google ainda não está ligado nesta plataforma (faltam as chaves do Google no servidor). Não há o que clicar aqui — isto acende sozinho no instante em que as chaves forem setadas.",
    es: "El acceso con Google todavía no está activado en esta plataforma (faltan las claves de Google en el servidor). No hay nada que pulsar aquí — se activa solo en cuanto se configuren las claves.",
    hi: "इस प्लेटफ़ॉर्म पर Google साइन-इन अभी चालू नहीं है (सर्वर पर Google कुंजियाँ नहीं हैं)। यहाँ क्लिक करने को कुछ नहीं — कुंजी सेट होते ही यह अपने आप सक्रिय हो जाएगा।",
  },
  account: { en: "Account", pt: "Conta", es: "Cuenta", hi: "खाता" },
  calendar: { en: "Calendar", pt: "Calendário", es: "Calendario", hi: "कैलेंडर" },
  whats_on: { en: "What's switched on", pt: "O que está ligado", es: "Qué está activado", hi: "क्या चालू है" },
  cap_read: { en: "Read availability", pt: "Ler disponibilidade", es: "Leer disponibilidad", hi: "उपलब्धता पढ़ना" },
  cap_write: { en: "Write bookings", pt: "Gravar agendamento", es: "Guardar la reserva", hi: "बुकिंग लिखना" },
  cap_rev: { en: "Read Google reviews and publish the replies you approve", pt: "Ler avaliações do Google e publicar as respostas que você aprovar", es: "Leer reseñas de Google y publicar las respuestas que apruebes", hi: "Google समीक्षाएँ पढ़ना और आपके मंज़ूर किए जवाब प्रकाशित करना" },
  danger_cal: {
    en: "The calendar permission was NOT granted. Google is signed in, but the agent cannot read availability or save a booking — the very first call would fail. Reconnect and leave the calendar box ticked on Google's screen.",
    pt: "A permissão de AGENDA não foi concedida. O Google está logado, mas a agente não consegue ler disponibilidade nem gravar agendamento — a primeira ligação já falharia. Reconecte e deixe a caixinha da agenda marcada na tela do Google.",
    es: "El permiso de AGENDA no fue concedido. Google está conectado, pero la agente no puede leer disponibilidad ni guardar una reserva — la primera llamada ya fallaría. Reconecta y deja marcada la casilla de la agenda en la pantalla de Google.",
    hi: "कैलेंडर की अनुमति नहीं दी गई। Google साइन-इन है, पर एजेंट न उपलब्धता पढ़ सकती है न बुकिंग सहेज सकती है — पहली ही कॉल विफल होगी। फिर से जोड़ें और Google की स्क्रीन पर कैलेंडर वाला बॉक्स चुना रहने दें।",
  },
  warn_rev: {
    en: "The reviews permission wasn't granted — the calendar works, but your Google reviews can't be read or answered from here yet.",
    pt: "A permissão das avaliações não foi concedida — a agenda funciona, mas suas avaliações do Google ainda não podem ser lidas nem respondidas por aqui.",
    es: "El permiso de reseñas no fue concedido — la agenda funciona, pero tus reseñas de Google aún no se pueden leer ni responder desde aquí.",
    hi: "समीक्षाओं की अनुमति नहीं मिली — कैलेंडर काम करता है, पर आपकी Google समीक्षाएँ अभी यहाँ से पढ़ी या जवाब नहीं दी जा सकतीं।",
  },
  // (2026-09-30) O Google devolveu invalid_grant: o acesso foi revogado ou expirou. Antes isso
  // aparecia como "conectado" aqui e "não conectado" na aba Google. Agora é dito com as letras.
  reconsent: {
    en: "Google access was revoked or has expired. Tap Reconnect and sign in to Google again — until then reviews can't be read or answered.",
    pt: "O acesso ao Google foi revogado ou expirou. Toque em Reconectar e faça login no Google de novo — até lá as avaliações não podem ser lidas nem respondidas.",
    es: "El acceso a Google fue revocado o expiró. Toca Reconectar e inicia sesión en Google otra vez — hasta entonces las reseñas no se pueden leer ni responder.",
    hi: "Google की पहुँच रद्द या समाप्त हो गई है। फिर से जोड़ें पर टैप करें और Google में दोबारा साइन इन करें — तब तक समीक्षाएँ पढ़ी या जवाब नहीं दी जा सकतीं।",
  },
  st_reconsent: { en: "Reconnect needed", pt: "Precisa reconectar", es: "Hay que reconectar", hi: "फिर से जोड़ना ज़रूरी" },
  note_rev_pending: {
    en: "Reviews aren't part of this sign-in yet (the Business Profile API is still waiting on Google's per-project approval). The calendar half works today.",
    pt: "As avaliações ainda não entram neste login (a API do Perfil de Empresa aguarda a aprovação do Google por projeto). A metade da agenda já funciona hoje.",
    es: "Las reseñas todavía no entran en este acceso (la API del Perfil de Empresa espera la aprobación de Google por proyecto). La parte de la agenda ya funciona hoy.",
    hi: "समीक्षाएँ अभी इस साइन-इन में शामिल नहीं हैं (Business Profile API अब भी Google की प्रोजेक्ट-स्वीकृति का इंतज़ार कर रही है)। कैलेंडर वाला हिस्सा आज भी काम करता है।",
  },
  opened: { en: "A Google window opened — sign in there, then come back to this screen.", pt: "Abriu uma janela do Google — faça login lá e volte para esta tela.", es: "Se abrió una ventana de Google — inicia sesión ahí y vuelve a esta pantalla.", hi: "एक Google विंडो खुली — वहाँ साइन इन करें, फिर इस स्क्रीन पर लौटें।" },
  link_hint: { en: "Or open this link on the client's own phone (valid for 10 minutes, one use):", pt: "Ou abra este link no celular da própria cliente (vale 10 minutos, uso único):", es: "O abre este enlace en el móvil de la propia clienta (vale 10 minutos, un solo uso):", hi: "या यह लिंक क्लाइंट के अपने फ़ोन पर खोलें (10 मिनट, एक बार):" },
  copy: { en: "Copy link", pt: "Copiar link", es: "Copiar enlace", hi: "लिंक कॉपी करें" },
  copied: { en: "Copied ✓", pt: "Copiado ✓", es: "Copiado ✓", hi: "कॉपी हो गया ✓" },
  open_now: { en: "Open Google now", pt: "Abrir o Google agora", es: "Abrir Google ahora", hi: "अभी Google खोलें" },
  refresh: { en: "Refresh state", pt: "Atualizar estado", es: "Actualizar estado", hi: "स्थिति रिफ़्रेश करें" },
  back_ok: { en: "Google came back connected — the state below was read from the server.", pt: "O Google voltou conectado — o estado abaixo foi lido do servidor.", es: "Google volvió conectado — el estado de abajo se leyó del servidor.", hi: "Google कनेक्टेड लौटा — नीचे की स्थिति सर्वर से पढ़ी गई है।" },
  back_partial: { en: "Google came back with only part of the permissions. Check the list below.", pt: "O Google voltou com só parte das permissões. Confira a lista abaixo.", es: "Google volvió con solo parte de los permisos. Revisa la lista abajo.", hi: "Google केवल कुछ अनुमतियों के साथ लौटा। नीचे की सूची देखें।" },
  back_err: { en: "Google returned an error:", pt: "O Google voltou com erro:", es: "Google devolvió un error:", hi: "Google ने त्रुटि लौटाई:" },
  disconnected: { en: "Disconnected ✓ — the credentials were deleted and the read-back proves it.", pt: "Desconectado ✓ — as credenciais foram apagadas e a releitura prova.", es: "Desconectado ✓ — las credenciales fueron borradas y la relectura lo prueba.", hi: "डिस्कनेक्ट ✓ — क्रेडेंशियल हटा दिए गए और पुनः-पढ़ाई यह साबित करती है।" },
  // ── o que a CLIENTE lê quando algo falha (2026-09-28) ──
  // No cockpit do cliente esta peça imprimia o motivo CRU: "resposta inválida (http 502)",
  // o `error` do servidor, a `note` de configuração ("as chaves do Google no servidor…"), o
  // `reason` que o Google devolve na URL. Tudo texto de engenharia, parte em português, na tela
  // de quem paga. No modo CLIENTE a frase sai daqui, pelo tipo da falha. No modo VENDEDOR (time
  // interno, que precisa do detalhe para diagnosticar) o motivo cru continua aparecendo.
  err_rede: { en: "I couldn't reach the server. Check your connection and try again.", pt: "Não consegui falar com o servidor. Confira sua conexão e tente de novo.", es: "No pude conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.", hi: "मैं सर्वर तक नहीं पहुँच सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।" },
  err_servidor: { en: "Something failed on our side. Nothing was changed — try again in a moment.", pt: "Algo falhou do nosso lado. Nada foi alterado — tente de novo em instantes.", es: "Algo falló de nuestro lado. No se cambió nada — inténtalo de nuevo en un momento.", hi: "हमारी तरफ़ कुछ गड़बड़ हुई। कुछ भी बदला नहीं गया — थोड़ी देर में फिर कोशिश करें।" },
  err_chave: { en: "Your connection code didn't match. Check it in Settings, then try again.", pt: "O seu código de conexão não conferiu. Confira em Configurações e tente de novo.", es: "Tu código de conexión no coincidió. Revísalo en Configuración e inténtalo de nuevo.", hi: "आपका कनेक्शन कोड मेल नहीं खाया। सेटिंग्स में जाँचें, फिर कोशिश करें।" },
  err_estranha: { en: "The server sent an answer I couldn't read. Try again in a moment.", pt: "O servidor mandou uma resposta que não consegui ler. Tente de novo em instantes.", es: "El servidor envió una respuesta que no pude leer. Inténtalo de nuevo en un momento.", hi: "सर्वर ने ऐसा उत्तर भेजा जिसे मैं पढ़ नहीं सका। थोड़ी देर में फिर कोशिश करें।" },
  back_err_cliente: { en: "Google didn't finish the connection. Tap Connect to try again.", pt: "O Google não concluiu a conexão. Toque em Conectar para tentar de novo.", es: "Google no completó la conexión. Toca Conectar para intentarlo de nuevo.", hi: "Google ने कनेक्शन पूरा नहीं किया। फिर कोशिश करने के लिए कनेक्ट पर टैप करें।" },
  not_configured_cliente: { en: "Google sign-in isn't switched on for your account yet — that step is on our side. Message our team and we'll turn it on.", pt: "O login do Google ainda não está ligado para a sua conta — esse passo é do nosso lado. Fale com a nossa equipe e a gente liga.", es: "El acceso con Google aún no está activado para tu cuenta — ese paso es de nuestro lado. Escríbele a nuestro equipo y lo activamos.", hi: "Google साइन-इन अभी आपके खाते के लिए चालू नहीं है — यह कदम हमारी तरफ़ का है। हमारी टीम को संदेश भेजें, हम चालू कर देंगे।" },
  // ── seller side ──
  seller_title: { en: "Connect the client's Google", pt: "Conectar o Google do cliente", es: "Conectar el Google del cliente", hi: "क्लाइंट का Google जोड़ें" },
  seller_sub: {
    en: "Sitting with the owner? Pick her business, generate the link and hand her the phone — she signs into her OWN Google and the calendar is live. You never see her password or her token.",
    pt: "Sentado com a dona? Escolha o negócio dela, gere o link e passe o aparelho — ela loga no PRÓPRIO Google dela e a agenda fica no ar. Você nunca vê a senha nem o token dela.",
    es: "¿Sentado con la dueña? Elige su negocio, genera el enlace y pásale el teléfono — ella entra en su PROPIO Google y la agenda queda activa. Nunca ves su contraseña ni su token.",
    hi: "मालिक के साथ बैठे हैं? उनका व्यवसाय चुनें, लिंक बनाएँ और फ़ोन दें — वे अपने ही Google में साइन इन करती हैं और कैलेंडर चालू हो जाता है। आप उनका पासवर्ड या टोकन कभी नहीं देखते।",
  },
  seller_pick: { en: "Client from your wallet", pt: "Cliente da sua carteira", es: "Cliente de tu cartera", hi: "आपके वॉलेट का क्लाइंट" },
  seller_pick_ph: { en: "Choose a client…", pt: "Escolha um cliente…", es: "Elige un cliente…", hi: "एक क्लाइंट चुनें…" },
  seller_empty: { en: "No client in your wallet yet — sign one in the ➕ tab first.", pt: "Nenhum cliente na sua carteira ainda — cadastre um na aba ➕ primeiro.", es: "Aún no hay clientes en tu cartera — registra uno en la pestaña ➕ primero.", hi: "आपके वॉलेट में अभी कोई क्लाइंट नहीं — पहले ➕ टैब में एक जोड़ें।" },
  seller_guard: {
    en: "Only clients in YOUR wallet appear here, and the server checks it again before generating any link — a typed e-mail is never accepted.",
    pt: "Só aparecem clientes da SUA carteira, e o servidor confere de novo antes de gerar qualquer link — e-mail digitado nunca é aceito.",
    es: "Solo aparecen clientes de TU cartera, y el servidor lo verifica de nuevo antes de generar cualquier enlace — un correo escrito a mano nunca se acepta.",
    hi: "यहाँ केवल आपके वॉलेट के क्लाइंट दिखते हैं, और लिंक बनाने से पहले सर्वर फिर जाँचता है — हाथ से टाइप किया ई-मेल कभी स्वीकार नहीं होता।",
  },
  wallet_err: { en: "Couldn't read your wallet:", pt: "Não consegui ler sua carteira:", es: "No pude leer tu cartera:", hi: "आपका वॉलेट नहीं पढ़ सका:" },
};
const tx = (lang, k) => { const o = D[k] || {}; return o[lang] || o.en || ""; };

// POST único. Devolve SEMPRE um objeto; `_err` carrega o motivo cru (nunca vira "não conectado")
// e `_tipo` diz QUAL frase a tela do cliente deve usar (err_rede | err_servidor | err_chave |
// err_estranha). O cru é para o vendedor/diagnóstico; o tipo é para quem paga.
const tipoDoHttp = (status) => (status === 401 || status === 403 ? "err_chave" : "err_servidor");
async function post(url, body) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    if (!d || typeof d !== "object") return { _err: `resposta inválida (http ${r.status})`, _tipo: r.ok ? "err_estranha" : tipoDoHttp(r.status) };
    if (d.error) return { _err: String(d.error).slice(0, 200), _tipo: tipoDoHttp(r.status) };
    if (!r.ok) return { _err: `http ${r.status}`, _tipo: tipoDoHttp(r.status) };
    return d;
  } catch (e) { return { _err: String((e && e.message) || e).slice(0, 200), _tipo: "err_rede" }; }
}

function Chip({ kind, label }) {
  const c = kind === "on" ? OK : kind === "partial" ? WARN : kind === "err" ? BAD : "#9A8F82";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-black leading-none"
      style={{ color: c, background: `${c}1e`, boxShadow: `inset 0 0 0 1px ${c}40` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 7px ${c}99` }} />{label}
    </span>
  );
}

function Cap({ on, label }) {
  return (
    <li className="flex items-center gap-2 text-[12.5px]" style={{ color: on ? OK : BAD }}>
      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-black"
        style={{ background: `${on ? OK : BAD}22`, color: on ? OK : BAD }}>{on ? "✓" : "✕"}</span>
      <span className={on ? "text-g-ink" : ""}>{label}</span>
    </li>
  );
}

/* ── O PAINEL (o motor visual compartilhado pelos dois lados) ─────────────────────────────────
   `auth` são os campos de identificação que vão em TODO POST:
     cliente  → { email, token }
     vendedor → { seller_email, seller_code, client_email }                                  */
function GooglePanel({ lang = "pt", auth, focus = "calendar", mode = "client", flash = "", needsReconsent = false }) {
  const [st, setSt] = useState(null);       // { configured, connected, scopes:{…} } lido do servidor
  const [err, setErrCru] = useState("");    // motivo CRU da falha de leitura (diagnóstico / vendedor)
  const [errTipo, setErrTipo] = useState("err_servidor");   // qual frase a tela do CLIENTE mostra
  const setErr = (cru, tipo) => { setErrCru(cru || ""); if (cru) setErrTipo(tipo || "err_servidor"); };
  const ehCliente = mode !== "seller";
  const [busy, setBusy] = useState("");
  const [link, setLink] = useState("");     // URL de consentimento (modo vendedor)
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const ready = mode === "seller" ? !!(auth && auth.client_email) : !!(auth && auth.email && auth.token);
  const authKey = JSON.stringify(auth || {});
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // Nada de setState ANTES do await: enquanto `st` é null a tela mostra "verificando", que é a
  // verdade. Pintar "não conectado" durante a espera seria afirmar sobre uma conta ainda não lida.
  const load = useCallback(async () => {
    const d = await (ready ? post("/api/google-oauth-start", { ...JSON.parse(authKey), action: "status" }) : Promise.resolve(null));
    if (!alive.current) return;
    setBusy("");
    if (!ready) { setSt(null); setErr(""); return; }
    if (d._err) { setSt(null); setErr(d._err, d._tipo); return; }
    setErr(""); setSt(d);
  }, [ready, authKey]);

  useEffect(() => { load(); }, [load]);

  const start = async () => {
    setBusy("start"); setMsg(""); setLink("");
    const d = await post("/api/google-oauth-start", { ...auth, action: "start" });
    if (!alive.current) return;
    setBusy("");
    if (d._err) { setErr(d._err, d._tipo); return; }
    if (!d.ready || !d.url) { setSt((s) => ({ ...(s || {}), configured: false, note: d.note || "" })); return; }
    setLink(d.url);
    try { window.open(d.url, "_blank", "noopener"); setMsg(tx(lang, "opened")); } catch { /* popup bloqueado → o link fica na tela */ }
  };

  const disconnect = async () => {
    setBusy("off"); setMsg("");
    const d = await post("/api/google-oauth-start", { ...auth, action: "disconnect" });
    if (!alive.current) return;
    setBusy("");
    if (d._err) { setErr(d._err, d._tipo); return; }
    setMsg(tx(lang, "disconnected"));
    await load();
  };

  const copy = () => { try { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ } };

  const configured = st ? st.configured !== false : true;
  const connected = !!(st && st.connected);
  const cal = !!(st && st.scopes && st.scopes.calendar);
  const rev = !!(st && st.scopes && st.scopes.business);
  const revPossible = !!(st && st.business_ready);
  // Sem cliente escolhido não existe estado nenhum pra afirmar — dizer "não conectado" aqui
  // seria uma afirmação sobre uma conta que ninguém consultou.
  const chip = !ready ? { kind: "off", label: tx(lang, mode === "seller" ? "st_pick" : "st_off") }
    : err ? { kind: "err", label: tx(lang, "st_err") }
    : !st ? { kind: "off", label: tx(lang, "checking") }
    : !configured ? { kind: "off", label: tx(lang, "st_none") }
    : !connected ? { kind: "off", label: tx(lang, "st_off") }
    : needsReconsent ? { kind: "err", label: tx(lang, "st_reconsent") }
    : cal && (rev || !revPossible) ? { kind: "on", label: tx(lang, "st_on") }
    : { kind: "partial", label: tx(lang, "st_partial") };
  const btnBase = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-5 text-[13px] font-bold";

  return (
    <div className="rounded-2xl border p-4 backdrop-blur-xl sm:p-5"
      style={{ borderColor: `${GOO}40`, background: `${GOO}0f` }}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[20px]" style={{ background: `${GOO}22` }}>📅</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-extrabold text-g-word">{tx(lang, focus === "reviews" ? "title_rev" : "title_cal")}</span>
            <Chip kind={chip.kind} label={chip.label} />
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-g-muted">{tx(lang, focus === "reviews" ? "sub_rev" : "sub_cal")}</p>
        </div>
      </div>

      {/* aviso de volta do Google (?google=…) — informativo; a VERDADE é o estado lido abaixo */}
      {flash === "connected" && <p className="mt-3 rounded-xl px-3 py-2 text-[12px]" style={{ background: `${OK}18`, color: OK }}>{tx(lang, "back_ok")}</p>}
      {flash === "partial" && <p className="mt-3 rounded-xl px-3 py-2 text-[12px]" style={{ background: `${WARN}18`, color: WARN }}>{tx(lang, "back_partial")}</p>}
      {flash && flash !== "connected" && flash !== "partial" && (
        <p className="mt-3 rounded-xl px-3 py-2 text-[12px]" style={{ background: `${BAD}18`, color: BAD }}>{ehCliente ? tx(lang, "back_err_cliente") : `${tx(lang, "back_err")} ${flash}`}</p>
      )}

      {/* ERRO DE LEITURA — motivo cru. Nunca "não conectado". */}
      {err && (
        <p className="mt-3 break-words rounded-xl px-3 py-2 text-[12px] font-semibold" style={{ background: `${BAD}18`, color: BAD }}>
          {tx(lang, "st_err")}: {ehCliente ? tx(lang, errTipo) : err}
        </p>
      )}

      {/* HONESTO-INERTE — sem chave no ambiente, nada de botão que não faz nada */}
      {!err && !configured && (
        <p className="mt-3 rounded-xl px-3 py-2 text-[12px] leading-relaxed" style={{ background: `${WARN}14`, color: WARN }}>
          {ehCliente ? tx(lang, "not_configured_cliente") : ((st && st.note) || tx(lang, "not_configured"))}
        </p>
      )}

      {/* ACESSO REVOGADO — quem sabe é o /api/google-business (viu o invalid_grant); a aba Google repassa */}
      {!err && configured && connected && needsReconsent && (
        <p className="mt-3 rounded-xl px-3 py-2 text-[12px] font-semibold leading-relaxed" style={{ background: `${BAD}18`, color: BAD }}>⚠️ {tx(lang, "reconsent")}</p>
      )}

      {/* ESTADO REAL */}
      {!err && configured && connected && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 backdrop-blur-xl">
          {st.account && <div className="text-[12px] text-g-muted">{tx(lang, "account")}: <b className="break-all text-g-word">{st.account}</b></div>}
          {st.calendar_id && <div className="mt-0.5 text-[12px] text-g-muted">{tx(lang, "calendar")}: <b className="break-all text-g-word">{st.calendar_id}</b></div>}
          <div className="mt-2 text-[10.5px] font-black uppercase tracking-wider text-g-muted">{tx(lang, "whats_on")}</div>
          <ul className="mt-1.5 space-y-1">
            <Cap on={cal} label={tx(lang, "cap_read")} />
            <Cap on={cal} label={tx(lang, "cap_write")} />
            {revPossible && <Cap on={rev} label={tx(lang, "cap_rev")} />}
          </ul>
          {!cal && (
            <p className="mt-2.5 rounded-lg px-3 py-2 text-[12px] font-semibold leading-relaxed" style={{ background: `${BAD}18`, color: BAD }}>
              ⚠️ {tx(lang, "danger_cal")}
            </p>
          )}
          {cal && revPossible && !rev && (
            <p className="mt-2.5 rounded-lg px-3 py-2 text-[12px] leading-relaxed" style={{ background: `${WARN}14`, color: WARN }}>{tx(lang, "warn_rev")}</p>
          )}
          {cal && !revPossible && (
            <p className="mt-2.5 rounded-lg px-3 py-2 text-[12px] leading-relaxed" style={{ background: `${WARN}14`, color: WARN }}>{tx(lang, "note_rev_pending")}</p>
          )}
        </div>
      )}

      {msg && <p className="mt-3 text-[12px] text-g-muted">{msg}</p>}

      {/* link de consentimento — o vendedor pode abrir no aparelho da cliente */}
      {link && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 backdrop-blur-xl">
          <div className="text-[11.5px] text-g-muted">{tx(lang, "link_hint")}</div>
          <div className="mt-1.5 max-h-24 overflow-y-auto break-all rounded-lg bg-white/[0.05] px-2.5 py-2 font-mono text-[11px] text-g-ink">{link}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={copy} className={`${btnBase} border border-white/15 bg-white/[0.05] text-g-word`}>{copied ? tx(lang, "copied") : `📋 ${tx(lang, "copy")}`}</button>
            <a href={link} target="_blank" rel="noopener" className={`${btnBase} border`} style={{ borderColor: `${GOO}55`, background: `${GOO}1e`, color: "#9CC0FF" }}>↗ {tx(lang, "open_now")}</a>
          </div>
        </div>
      )}

      {/* AÇÕES */}
      {configured && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={start} disabled={!ready || !!busy}
            className={`${btnBase} disabled:opacity-50`} style={{ background: `${GOO}26`, color: "#BFD4FF", boxShadow: `inset 0 0 0 1px ${GOO}66` }}>
            {busy === "start" ? tx(lang, "working") : connected ? `↻ ${tx(lang, "reconnect")}` : (mode === "seller" ? tx(lang, "connect_seller") : tx(lang, "connect"))}
          </button>
          <button type="button" onClick={load} disabled={!ready || !!busy}
            className={`${btnBase} border border-white/15 bg-white/[0.04] text-g-muted disabled:opacity-50`}>
            {`↻ ${tx(lang, "refresh")}`}
          </button>
          {connected && (
            <button type="button" onClick={disconnect} disabled={!!busy}
              className={`${btnBase} border disabled:opacity-50`} style={{ borderColor: `${BAD}55`, background: `${BAD}12`, color: BAD }}>
              {busy === "off" ? tx(lang, "working") : tx(lang, "disconnect")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Lê o ?google=… com que o callback devolveu a pessoa (só informativo — a verdade é o status).
function useFlash() {
  const [flash] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const g = p.get("google");
      if (!g) return "";
      return g === "error" ? (p.get("reason") || "error") : g;
    } catch { return ""; }
  });
  return flash;
}

/* ── LADO DO CLIENTE (cockpit) ───────────────────────────────────────────────────────────── */
export function GoogleConnectCard({ lang = "pt", email = "", dataKey = "", focus = "calendar", needsReconsent = false }) {
  const flash = useFlash();
  if (!email || !dataKey) return null;   // demo/preview: sem tenant real não há o que conectar
  return <GooglePanel lang={lang} focus={focus} mode="client" flash={flash} needsReconsent={needsReconsent} auth={{ email, token: dataKey }} />;
}

/* ── LADO DO VENDEDOR (hub) ──────────────────────────────────────────────────────────────── */
export default function SellerGoogle({ lang = "pt", seller }) {
  const flash = useFlash();
  const [rows, setRows] = useState(null);   // null = carregando · [] = vazio
  const [wErr, setWErr] = useState("");
  const [pick, setPick] = useState("");

  useEffect(() => {
    let on = true;
    (async () => {
      if (!seller?.email) return;
      const d = await post("/api/onboard-draft", { action: "wallet", seller_email: seller.email, seller_code: seller.code || "", seller: { name: seller.name, email: seller.email, ref: seller.ref } });
      if (!on) return;
      if (d._err) { setRows([]); setWErr(d._err); return; }
      const list = Array.isArray(d.rows) ? d.rows : [];
      setRows(list.filter((r) => r && r.client_email && (r.status || "draft") !== "deleted"));
    })();
    return () => { on = false; };
  }, [seller?.email, seller?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const field = "mt-1 w-full min-h-[48px] rounded-xl border border-white/10 bg-black/30 px-3 text-[16px] text-g-word focus:border-g-gold/50 focus:outline-none";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-g-gold/25 bg-g-gold/[0.04] p-5 backdrop-blur-xl">
        <div className="text-sm font-extrabold text-g-gold">🔗 {tx(lang, "seller_title")}</div>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-g-muted">{tx(lang, "seller_sub")}</p>

        <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-g-muted">
          {tx(lang, "seller_pick")}
          <select value={pick} onChange={(e) => setPick(e.target.value)} className={field}>
            <option value="" className="bg-[#161512]">{tx(lang, "seller_pick_ph")}</option>
            {(rows || []).map((r) => (
              <option key={r.client_email} value={r.client_email} className="bg-[#161512]">
                {(r.business || r.client_email)} — {r.client_email}
              </option>
            ))}
          </select>
        </label>

        {wErr && <p className="mt-2 break-words text-[12px] font-semibold" style={{ color: BAD }}>{tx(lang, "wallet_err")} {wErr}</p>}
        {!wErr && rows !== null && rows.length === 0 && <p className="mt-2 text-[12px] text-g-muted">{tx(lang, "seller_empty")}</p>}
        <p className="mt-2 text-[11.5px] leading-relaxed text-g-muted">🛡️ {tx(lang, "seller_guard")}</p>
      </div>

      <GooglePanel key={pick} lang={lang} focus="calendar" mode="seller" flash={pick ? flash : ""}
        auth={{ seller_email: seller?.email || "", seller_code: seller?.code || "", client_email: pick }} />
    </div>
  );
}
