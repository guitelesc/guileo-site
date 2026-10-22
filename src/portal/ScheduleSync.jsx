/* ─────────────────────────────────────────────────────────────────────────────
   ScheduleSync — the ONE screen where the client connects the booking system they
   already run (Google Calendar · Square · MindBody · Booksy · Vagaro). This is the
   cockpit face of scheduleAdapter.js: once a system is connected + ready, the Gui
   agent reads REAL availability from it and writes bookings straight into it — the
   client's calendar becomes the single source of truth, mirrored back into the
   Guileo engine (biz_appointments) so the cockpit still has the record. When nothing
   external is connected (or it's down), Gui keeps booking in the internal engine.

   HONESTY IS LAW (ARQUITETURA.md §3/§4):
     • Every card shows its REAL state from the connector's own status action.
     • A connector with no public API (Booksy) or none wired (Vagaro) says so plainly
       and never pretends to book — the internal engine stays the source of truth.
     • A connector coded-but-inert (MindBody waiting on partner key) returns ready:false
       and we render the honest amber note verbatim — we never fake a green "connected".
   Same per-tenant gate as every cockpit tab: email + connection-key (dataKey).
   ───────────────────────────────────────────────────────────────────────────── */
import { useState, useEffect, useCallback } from "react";
import { FaCircleCheck, FaCalendarCheck, FaClock, FaTriangleExclamation } from "react-icons/fa6";
import { toast, chamarApi } from "../lib/portalApi.js";
import { fraseDaFalha } from "./FalhaDeLeitura.jsx";
import { Card, GuiMark, UI_LANG, tr } from "../pages/Portal.jsx";
import { GoogleConnectCard } from "../components/GoogleConnect.jsx";
import { NOME_DO_PAINEL } from "./nome.js";

// ── self-contained 4-language strings (en·pt·es·hi) — no dict edits needed ──
const STR = {
  banner_title: {
    en: "One calendar for your whole business",
    pt: "Um calendário só pro seu negócio inteiro",
    es: "Un solo calendario para todo tu negocio",
    hi: "आपके पूरे व्यवसाय के लिए एक ही कैलेंडर",
  },
  banner_body: {
    en: (name) => <>{name} already books inside your Guileo panel. Connect the system you already use so everything becomes <span className="text-g-gold font-bold">one calendar</span> — no double-booking, ever.</>,
    pt: (name) => <>{name} já agenda no seu painel Guileo. Conecte o sistema que você já usa pra tudo virar <span className="text-g-gold font-bold">um calendário só</span> — sem choque de horário.</>,
    es: (name) => <>{name} ya agenda dentro de tu panel Guileo. Conecta el sistema que ya usas para que todo sea <span className="text-g-gold font-bold">un solo calendario</span> — sin choque de horarios.</>,
    hi: (name) => <>{name} पहले से आपके Guileo पैनल में बुकिंग करती है। जो सिस्टम आप पहले से इस्तेमाल करते हैं उसे जोड़ें ताकि सब कुछ <span className="text-g-gold font-bold">एक कैलेंडर</span> बन जाए — कभी डबल-बुकिंग नहीं।</>,
  },
  how_title: { en: "How the golden rule works", pt: "Como funciona a regra de ouro", es: "Cómo funciona la regla de oro", hi: "स्वर्णिम नियम कैसे काम करता है" },
  how_body: {
    en: `Connect one system → Gui reads its REAL availability and books INTO it (source of truth), then mirrors the booking into your ${NOME_DO_PAINEL}. Nothing connected → Gui uses the built-in Guileo engine. Never both on the same slot.`,
    pt: `Conecte um sistema → a Gui lê a disponibilidade REAL dele e agenda NELE (fonte da verdade), depois espelha a reserva aqui na ${NOME_DO_PAINEL}. Nada conectado → a Gui usa o motor Guileo interno. Nunca os dois no mesmo horário.`,
    es: `Conecta un sistema → Gui lee su disponibilidad REAL y agenda EN él (fuente de la verdad), luego refleja la reserva en tu ${NOME_DO_PAINEL}. Nada conectado → Gui usa el motor Guileo interno. Nunca ambos en el mismo horario.`,
    hi: `एक सिस्टम जोड़ें → Gui उसकी असली उपलब्धता पढ़ती है और उसी में बुक करती है (सत्य का स्रोत), फिर बुकिंग को आपके ${NOME_DO_PAINEL} में मिरर करती है। कुछ न जुड़ा हो → Gui आंतरिक Guileo इंजन इस्तेमाल करती है। एक ही स्लॉट पर कभी दोनों नहीं।`,
  },
  connected: { en: "Connected", pt: "Conectado", es: "Conectado", hi: "जुड़ा हुआ" },
  connect: { en: "Connect", pt: "Conectar", es: "Conectar", hi: "जोड़ें" },
  reconnect: { en: "Reconnect", pt: "Reconectar", es: "Reconectar", hi: "फिर से जोड़ें" },
  cancel: { en: "Cancel", pt: "Cancelar", es: "Cancelar", hi: "रद्द करें" },
  saving: { en: "Connecting…", pt: "Conectando…", es: "Conectando…", hi: "जोड़ रहे हैं…" },
  checking: { en: "Checking…", pt: "Verificando…", es: "Verificando…", hi: "जाँच हो रही है…" },
  soon: { en: "Soon", pt: "Em breve", es: "Pronto", hi: "जल्द" },
  no_api: { en: "No public API yet", pt: "Sem API pública ainda", es: "Sin API pública aún", hi: "अभी सार्वजनिक API नहीं" },
  stored_pending: { en: "Saved — lights up when the API opens", pt: "Salvo — acende quando a API abrir", es: "Guardado — se activa cuando abra la API", hi: "सहेजा गया — API खुलते ही सक्रिय" },
  demo_note: { en: "Preview — connecting activates during your setup.", pt: "Prévia — a conexão real acende no seu setup.", es: "Vista previa — la conexión se activa en tu setup.", hi: "पूर्वावलोकन — कनेक्शन आपके सेटअप में सक्रिय होता है।" },
  open_window: { en: "A Google window opened — approve access there, then come back.", pt: "Abriu uma janela do Google — aprove o acesso lá e volte aqui.", es: "Se abrió una ventana de Google — aprueba el acceso ahí y vuelve.", hi: "एक Google विंडो खुली — वहाँ एक्सेस स्वीकार करें, फिर लौटें।" },
  // ── estados que a tela DIZ com as próprias palavras (2026-09-28) ──
  // A nota crua do conector ia direto para a tela: "set MINDBODY_API_KEY in Cloudflare env",
  // "This business hasn't connected MindBody yet (action:connect)". Engenharia, em inglês fixo, na
  // tela de quem paga. Agora o ESTADO vem do servidor (ready / can_write / stored) e a FRASE é daqui.
  check_failed: { en: "Couldn't check", pt: "Não consegui verificar", es: "No pude verificar", hi: "जाँच नहीं हो सकी" },
  retry: { en: "↻ Try again", pt: "↻ Tentar de novo", es: "↻ Reintentar", hi: "↻ फिर कोशिश करें" },
  note_rw: { en: "Connected — Gui reads your real availability and books straight into it.", pt: "Conectado — a Gui lê a sua disponibilidade real e agenda direto nele.", es: "Conectado — Gui lee tu disponibilidad real y agenda directamente ahí.", hi: "जुड़ा हुआ — Gui आपकी असली उपलब्धता पढ़ती है और सीधे उसी में बुक करती है।" },
  note_ro: { en: "Connected, read-only — Gui sees your availability, but can't book into it yet. Reconnect with a login that is allowed to book.", pt: "Conectado, só leitura — a Gui vê a sua disponibilidade, mas ainda não consegue agendar nele. Reconecte com um login que possa agendar.", es: "Conectado, solo lectura — Gui ve tu disponibilidad, pero aún no puede agendar ahí. Reconecta con un usuario que pueda agendar.", hi: "जुड़ा हुआ, केवल पढ़ने के लिए — Gui आपकी उपलब्धता देखती है, पर अभी उसमें बुक नहीं कर सकती। ऐसे लॉगिन से फिर जोड़ें जिसे बुकिंग की अनुमति हो।" },
  note_our_side: { en: "This integration isn't switched on for your account yet — that step is on our side. Message our team and we'll turn it on. Until then Gui keeps booking in your Guileo calendar.", pt: "Esta integração ainda não está ligada para a sua conta — esse passo é do nosso lado. Fale com a nossa equipe e a gente liga. Até lá a Gui segue agendando no seu calendário Guileo.", es: "Esta integración aún no está activada para tu cuenta — ese paso es de nuestro lado. Escríbele a nuestro equipo y la activamos. Mientras tanto Gui sigue agendando en tu calendario Guileo.", hi: "यह इंटीग्रेशन अभी आपके खाते के लिए चालू नहीं है — यह कदम हमारी तरफ़ का है। हमारी टीम को संदेश भेजें, हम चालू कर देंगे। तब तक Gui आपके Guileo कैलेंडर में बुकिंग करती रहेगी।" },
  saved_noauth: { en: "Saved, but the login didn't work — check the ID and the credentials, then connect again.", pt: "Salvo, mas o login não funcionou — confira o ID e as credenciais e conecte de novo.", es: "Guardado, pero el acceso no funcionó — revisa el ID y las credenciales y conecta de nuevo.", hi: "सहेजा गया, पर लॉगिन काम नहीं किया — ID और क्रेडेंशियल जाँचें, फिर दोबारा जोड़ें।" },
  site_hint: { en: "The Site ID of YOUR studio, from your MindBody account.", pt: "O Site ID do SEU estúdio, na sua conta MindBody.", es: "El Site ID de TU estudio, en tu cuenta MindBody.", hi: "आपके स्टूडियो की Site ID, आपके MindBody खाते से।" },
  err: { en: "Couldn't connect — check the fields and try again.", pt: "Não deu pra conectar — confira os campos e tente de novo.", es: "No se pudo conectar — revisa los campos e inténtalo de nuevo.", hi: "कनेक्ट नहीं हो सका — फ़ील्ड जाँचें और फिर प्रयास करें।" },
};
const L = (k, ...a) => { const v = (STR[k] && (STR[k][UI_LANG] || STR[k].en)); return typeof v === "function" ? v(...a) : v; };

const STR_SITE_HINT = STR.site_hint;
// texto que NUNCA pode chegar na tela de um cliente: nome de env var, arquivo SQL, action de API.
const ehEngenharia = (t) => /api key|_KEY\b|_SECRET\b|cloudflare|\benv\b|supabase|\.sql\b|action:|developer access|HTTP \d{3}/i.test(String(t || ""));

// ── MINDBODY (2026-09-30) ────────────────────────────────────────────────────────────────────
// O servidor agora devolve o ESTADO (`estado`), não uma frase: sem_chave · nao_conectado ·
// login_recusado · site_nao_ativado · sem_mapa · ativo. A frase é daqui, via tr().
// Conectar não basta: enquanto o MAPA (serviço/unidade/profissional da Guileo ↔ MindBody) não for
// salvo, a Gui continua no calendário Guileo — antes, conectar sem mapa fazia toda reserva virar
// "a recepção confirma".
const fraseMindbody = (estado) => {
  if (estado === "sem_mapa") return tr("Connected. One step left: match your services below and save. Until then Gui keeps booking in your Guileo calendar.");
  if (estado === "login_recusado") return tr("MindBody refused the login. Use a staff or owner login that exists on this site, then connect again.");
  if (estado === "site_nao_ativado") return tr("This MindBody site hasn't approved Guileo yet. Open the activation link first, then connect again.");
  if (estado === "falta_login") return tr("One of your MindBody sites has no login yet. Connect each site with a staff or owner login.");
  return "";
};
// O que o servidor respondeu, como veio — a falha é mostrada com o corpo da resposta, não trocada
// por uma frase genérica.
const corpoDaFalha = (r) => {
  const d = r && r.data;
  if (!d || typeof d !== "object") return String((r && r.erro) || "");
  return String(d.detalhe_tecnico || d.motivo || d.estado || d.error || r.erro || "");
};
const parDe = (o, campo) => (o && o.site_id != null && o[campo] != null ? `${o.site_id}|${o[campo]}` : "");
const partirPar = (v) => { const i = String(v || "").indexOf("|"); return i < 0 ? null : { site_id: String(v).slice(0, i), id: String(v).slice(i + 1) }; };
const CAMPOS_QUE_A_GUI_TEM = ["FirstName", "LastName", "MobilePhone", "Email"];

function Selo({ tipo }) {
  const txt = tipo === "sem" ? tr("No match") : tipo === "escolher" ? tr("Choose one") : tr("Check");
  return <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase" style={{ color: "#FFC23D", background: "#FFC23D1e", boxShadow: "inset 0 0 0 1px #FFC23D55" }}><FaTriangleExclamation size={8} /> {txt}</span>;
}

// O passo de mapa + importação. Só existe em conta REAL e conectada; tudo o que mostra veio do
// servidor agora (catálogo da Guileo, catálogo do MindBody, sugestão, mapa salvo).
function MindbodyMapa({ call, onSalvo }) {
  const [cat, setCat] = useState(null);
  const [falha, setFalha] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [sel, setSel] = useState({ locations: {}, services: {}, staff: {}, tz: {} });
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState(null);
  const [imp, setImp] = useState(null);
  const [vez, setVez] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true); setFalha(null);
      const r = await call("/api/mindbody", { action: "catalog" });
      if (!vivo) return;
      const d = r.data;
      if (r.motivo || !d || !d.mindbody || !Array.isArray(d.mindbody.sites) || !d.guileo) {
        setFalha({ motivo: r.motivo || "resposta_estranha", corpo: corpoDaFalha(r) }); setCat(null); setCarregando(false); return;
      }
      const salvo = d.salvo || {}, sug = (d.sugestao && d.sugestao.mapa) || {};
      const ini = { locations: {}, services: {}, staff: {}, tz: {} };
      for (const l of d.guileo.locations || []) ini.locations[l.id] = parDe((salvo.locations || {})[l.id] || (sug.locations || {})[l.id], "location_id");
      for (const x of d.guileo.services || []) ini.services[x.id] = parDe((salvo.services || {})[x.id] || (sug.services || {})[x.id], "session_type_id");
      for (const x of d.guileo.professionals || []) ini.staff[x.id] = parDe((salvo.staff || {})[x.id] || (sug.staff || {})[x.id], "staff_id");
      for (const st of d.mindbody.sites) ini.tz[st.site_id] = st.tz || "";
      setSel(ini); setCat(d); setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [call, vez]);

  if (carregando) return <div className="px-5 py-4 border-t border-white/[0.06] text-[11px] text-g-muted">{tr("Loading your MindBody catalog…")}</div>;
  if (falha || !cat) {
    return (
      <div role="alert" className="px-5 py-4 border-t border-white/[0.06] text-[11px] leading-snug text-[#e0855f] space-y-2">
        <div><b>{tr("I couldn't load your MindBody catalog.")}</b> {fraseDaFalha(falha && falha.motivo)}</div>
        {falha && falha.corpo && <div className="font-mono text-[10px] text-g-muted break-words">{falha.corpo}</div>}
        <button onClick={() => setVez((n) => n + 1)} className="rounded-full border border-[#e0855f]/50 px-3 py-1 text-[11px] font-black hover:bg-[#e0855f]/10 transition">{tr("↻ Try again")}</button>
      </div>
    );
  }

  const sites = cat.mindbody.sites;
  const variosSites = sites.length > 1;
  const pend = {};
  for (const p of (cat.sugestao && cat.sugestao.pendencias) || []) pend[p.id] = p.situacao;
  const salvo = cat.salvo || {};
  const selo = (grupo, id) => {
    const v = sel[grupo][id];
    if (!v) return pend[id] === "ambiguo" ? "escolher" : "sem";
    if (pend[id] === "conferir" && !((salvo[grupo] || {})[id])) return "conferir";
    return "";
  };
  const escolher = (grupo, id, v) => { setRecado(null); setSel((c) => ({ ...c, [grupo]: { ...c[grupo], [id]: v } })); };
  const opcoes = (campoLista) => sites.map((st) => ({ site: st, itens: st[campoLista] || [] }));

  const bloco = (titulo, grupo, itens, campoLista, nota) => (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-g-light">{titulo}</div>
        {nota && <div className="text-[10px] text-g-muted text-right">{nota}</div>}
      </div>
      <div className="space-y-1.5">
        {itens.map((it) => {
          const s = selo(grupo, it.id);
          return (
            <div key={it.id} className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 basis-40 text-[12px] text-g-word truncate" title={it.name}>{it.name}</div>
              {s && <Selo tipo={s} />}
              <select value={sel[grupo][it.id] || ""} onChange={(e) => escolher(grupo, it.id, e.target.value)}
                className="min-w-0 flex-1 basis-52 rounded-xl border border-white/[0.1] bg-black/30 px-2.5 py-1.5 text-[12px] text-g-word focus:outline-none focus:border-g-gold/50">
                <option value="" className="bg-[#161512]">{tr("— not matched —")}</option>
                {opcoes(campoLista).map(({ site, itens: lista }) => (
                  variosSites
                    ? <optgroup key={site.site_id} label={`${site.nome || site.site_id} — ${site.site_id}`} className="bg-[#161512]">
                        {lista.map((o) => <option key={`${site.site_id}|${o.id}`} value={`${site.site_id}|${o.id}`} className="bg-[#161512]">{o.nome}</option>)}
                      </optgroup>
                    : lista.map((o) => <option key={`${site.site_id}|${o.id}`} value={`${site.site_id}|${o.id}`} className="bg-[#161512]">{o.nome}</option>)
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );

  const semPar = (cat.guileo.services || []).filter((x) => !sel.services[x.id]).length;

  const salvar = async () => {
    setSalvando(true); setRecado(null);
    const sug = (cat.sugestao && cat.sugestao.mapa) || {};
    const mapping = { locations: {}, services: {}, staff: {}, sites: {} };
    for (const [id, v] of Object.entries(sel.locations)) { const p = partirPar(v); if (p) mapping.locations[id] = { site_id: p.site_id, location_id: p.id }; }
    for (const [id, v] of Object.entries(sel.staff)) { const p = partirPar(v); if (p) mapping.staff[id] = { site_id: p.site_id, staff_id: p.id }; }
    for (const [id, v] of Object.entries(sel.services)) {
      const p = partirPar(v); if (!p) continue;
      // a unidade do serviço: a que já acompanhava este mesmo par (salvo ou sugerido); senão a
      // única unidade do site, quando o site só tem uma
      const antes = [(salvo.services || {})[id], (sug.services || {})[id]].find((o) => o && String(o.site_id) === p.site_id && String(o.session_type_id) === p.id && o.location_id != null);
      const st = sites.find((x) => String(x.site_id) === p.site_id);
      const unica = st && (st.locations || []).length === 1 ? st.locations[0].id : null;
      mapping.services[id] = { site_id: p.site_id, session_type_id: p.id, ...(antes ? { location_id: antes.location_id } : (unica != null ? { location_id: unica } : {})) };
    }
    for (const st of sites) mapping.sites[st.site_id] = { tz: String(sel.tz[st.site_id] || "").trim() };
    const r = await call("/api/mindbody", { action: "save_mapping", mapping });
    const d = r.data;
    setSalvando(false);
    if (r.motivo) { setRecado({ tipo: "erro", texto: `${tr("I couldn't save the matching.")} ${fraseDaFalha(r.motivo)}`, corpo: corpoDaFalha(r) }); return; }
    if (!d || d.ok !== true) {
      const texto = d && d.estado === "mapa_vazio" ? tr("Match at least one service before saving.")
        : d && d.estado === "fuso_obrigatorio" ? tr("Enter a valid time zone for each MindBody site before saving.")
        : tr("I couldn't save the matching.");
      setRecado({ tipo: "erro", texto, corpo: d && d.estado ? "" : corpoDaFalha(r) }); return;
    }
    const recusados = Array.isArray(d.recusados) ? d.recusados.length : 0;
    setCat((c) => ({ ...c, salvo: d.salvo || c.salvo }));
    setRecado(recusados
      ? { tipo: "erro", texto: tr("Some lines were not saved — the selection no longer exists in MindBody. Check them and save again."), corpo: d.recusados.map((x) => `${x.tipo}: ${x.motivo}`).join(" · ") }
      : { tipo: "ok", texto: tr("Saved — Gui now reads and books in MindBody.") });
    toast(tr("Saved — Gui now reads and books in MindBody."));
    if (onSalvo) onSalvo();
  };

  // Importa em lotes: o servidor lê algumas páginas por chamada e diz de onde continuar.
  const importar = async () => {
    const tot = { lidos: 0, novos: 0, atualizados: 0, sem_contato: 0, erros: 0 };
    setImp({ rodando: true, ...tot });
    for (const st of sites) {
      let offset = 0;
      for (let volta = 0; volta < 500; volta++) {
        const r = await call("/api/mindbody", { action: "import_clients", site_id: st.site_id, offset });
        const d = r.data;
        if (r.motivo || !d || d.ok !== true) { setImp({ rodando: false, ...tot, falha: { motivo: r.motivo || "servidor", corpo: corpoDaFalha(r) } }); return; }
        for (const k of Object.keys(tot)) tot[k] += Number(d[k]) || 0;
        setImp({ rodando: true, ...tot });
        if (d.fim || !(Number(d.proximo_offset) > offset)) break;
        offset = Number(d.proximo_offset);
      }
    }
    setImp({ rodando: false, fim: true, ...tot });
  };

  const exigidos = sites.map((st) => ({ st, extras: (st.campos_obrigatorios || []).filter((c) => !CAMPOS_QUE_A_GUI_TEM.includes(c)) })).filter((x) => x.extras.length);

  return (
    <div className="px-5 pb-5 pt-4 border-t border-white/[0.06] space-y-4 bg-black/15">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[13px] font-extrabold text-g-word">{tr("Match Guileo to MindBody")}</div>
          {salvo.ativo === true
            ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase" style={{ color: "#3E9468", background: "#3E946822", boxShadow: "inset 0 0 0 1px #3E946855" }}><FaCircleCheck size={8} /> {tr("Live")}</span>
            : <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase" style={{ color: "#FFC23D", background: "#FFC23D1e", boxShadow: "inset 0 0 0 1px #FFC23D55" }}><FaClock size={8} /> {tr("Not live yet")}</span>}
        </div>
        <div className="text-[11px] text-g-muted leading-snug mt-1">{tr("Gui only books what is matched here. Check each line, fix what is flagged, then save.")}</div>
      </div>

      {bloco(tr("Services"), "services", cat.guileo.services || [], "session_types", semPar ? `${semPar} ${tr("without a match")}` : "")}
      {bloco(tr("Locations"), "locations", cat.guileo.locations || [], "locations", "")}
      {bloco(tr("Professionals"), "staff", cat.guileo.professionals || [], "staff", tr("Optional — only needed when a caller asks for someone by name."))}

      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-g-light mb-1.5">{tr("Time zone")}</div>
        <div className="space-y-1.5">
          {sites.map((st) => (
            <div key={st.site_id} className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 basis-40 text-[12px] text-g-word truncate">{st.nome || st.site_id} — {st.site_id}</div>
              {!String(sel.tz[st.site_id] || "").trim() && <Selo tipo="sem" />}
              <input type="text" value={sel.tz[st.site_id] || ""} onChange={(e) => { setRecado(null); setSel((c) => ({ ...c, tz: { ...c.tz, [st.site_id]: e.target.value } })); }}
                autoComplete="off" spellCheck={false} aria-label={tr("Time zone of this MindBody site (for example America/New_York)")}
                className="min-w-0 flex-1 basis-52 rounded-xl border border-white/[0.1] bg-black/30 px-2.5 py-1.5 text-[12px] text-g-word focus:outline-none focus:border-g-gold/50" />
            </div>
          ))}
        </div>
        <div className="text-[10px] text-g-muted mt-1">{tr("Time zone of this MindBody site (for example America/New_York)")}</div>
      </div>

      {exigidos.map(({ st, extras }) => (
        <div key={st.site_id} className="text-[11px] leading-snug text-[#FFC23D]">
          {tr("MindBody requires these fields to create a new client:")} <span className="font-mono">{extras.join(", ")}</span> ({st.nome || st.site_id}). {tr("New callers can't be added automatically until that changes. Existing clients book normally.")}
        </div>
      ))}

      <div className="space-y-2">
        <button onClick={salvar} disabled={salvando} className="btn-bright text-[12px] px-4 py-2 w-full disabled:opacity-60">{salvando ? tr("Saving…") : tr("Save matching")}</button>
        {recado && (
          <div role={recado.tipo === "erro" ? "alert" : "status"} className={`text-[11px] leading-snug ${recado.tipo === "erro" ? "text-[#e0855f]" : "text-[#3E9468]"}`}>
            {recado.texto}
            {recado.corpo && <div className="font-mono text-[10px] text-g-muted break-words mt-0.5">{recado.corpo}</div>}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-white/[0.06] space-y-2">
        <div className="text-[11px] text-g-muted leading-snug">{tr("Brings your MindBody clients into your Guileo customer list: name, phone, email and birthday. Nothing is changed in MindBody.")}</div>
        <button onClick={importar} disabled={!!(imp && imp.rodando)} className="btn-ghost text-[12px] px-4 py-2 w-full disabled:opacity-60">{imp && imp.rodando ? tr("Importing…") : tr("Import customers")}</button>
        {imp && (
          <div role="status" className={`text-[11px] leading-snug ${imp.falha ? "text-[#e0855f]" : "text-g-light"}`}>
            {imp.falha ? <b>{tr("The import stopped.")} </b> : (imp.fim ? <b>{tr("Import finished")} — </b> : null)}
            {imp.lidos} {tr("customers read")} · {imp.novos} {tr("added")} · {imp.atualizados} {tr("updated")} · {imp.sem_contato} {tr("without phone or email")}
            {imp.erros > 0 && <> · {imp.erros} {tr("could not be saved")}</>}
            {imp.falha && <div className="mt-0.5">{fraseDaFalha(imp.falha.motivo)}{imp.falha.corpo && <span className="block font-mono text-[10px] text-g-muted break-words">{imp.falha.corpo}</span>}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// Per-system definitions. mode drives the connect UX:
//   oauth  → open the provider's consent window (Google Calendar)
//   form   → inline credential form → POST {action:'connect'} to the endpoint
//   store  → same form, but the API isn't live; we store creds honestly (Booksy)
//   soon   → nothing wired yet; card is informational only (Vagaro)
const SYSTEMS = [
  {
    key: "square", icon: "🟩", name: "Square Appointments", color: "#3E9468", mode: "form",
    endpoint: "/api/square-appointments", provider: "square",
    tag: { en: "Salon / retail bookings", pt: "Agenda de salão / varejo", es: "Reservas de salón / retail", hi: "सैलून / रिटेल बुकिंग" },
    fields: [
      { name: "access_token", type: "password", label: { en: "Personal Access Token", pt: "Personal Access Token", es: "Personal Access Token", hi: "Personal Access Token" }, hint: { en: "Square Developer → your app → Production access token", pt: "Square Developer → seu app → Production access token", es: "Square Developer → tu app → Production access token", hi: "Square Developer → आपका ऐप → Production access token" } },
      { name: "location_id", type: "text", label: { en: "Location ID", pt: "Location ID", es: "Location ID", hi: "Location ID" }, hint: { en: "Square dashboard → Locations", pt: "Painel Square → Locations", es: "Panel Square → Locations", hi: "Square डैशबोर्ड → Locations" } },
    ],
  },
  {
    key: "mindbody", icon: "🧘", name: "MindBody", color: "#8B6FE0", mode: "form",
    endpoint: "/api/mindbody", provider: "mindbody",
    tag: { en: "Spa / wellness studios", pt: "Spa / estúdios de bem-estar", es: "Spa / estudios de bienestar", hi: "स्पा / वेलनेस स्टूडियो" },
    fields: [
      // 🚨 (2026-09-28) Aqui havia um <select> com DUAS opções fixas no código: "Astoria — 767008" e
      // "UES — 5734109". São as unidades de UM cliente (Natura Spa) — e apareciam para TODO tenant.
      // Outro negócio via os estúdios de um concorrente e, conectando, apontaria a própria agenda
      // para o Site-Id de outra empresa. Agora: campo de texto. Se ESTE tenant já conectou e o
      // servidor devolveu os estúdios DELE (`sites` do status), vira lista — só com os dele.
      { name: "site_id", type: "site", label: { en: "Studio (Site ID)", pt: "Estúdio (Site ID)", es: "Estudio (Site ID)", hi: "स्टूडियो (Site ID)" },
        hint: STR_SITE_HINT },
      { name: "source_name", type: "text", label: { en: "Source / API username", pt: "Source / usuário da API", es: "Source / usuario de API", hi: "Source / API उपयोगकर्ता" } },
      { name: "source_password", type: "password", label: { en: "Source password", pt: "Senha do source", es: "Contraseña del source", hi: "Source पासवर्ड" } },
    ],
  },
  {
    key: "booksy", icon: "💈", name: "Booksy", color: "#00B2A9", mode: "store",
    endpoint: "/api/booksy", provider: "booksy",
    tag: { en: "Barber / beauty bookings", pt: "Agenda de barbearia / beleza", es: "Reservas de barbería / belleza", hi: "नाई / ब्यूटी बुकिंग" },
    fields: [
      { name: "business_id", type: "text", label: { en: "Booksy business ID or profile URL", pt: "ID do negócio ou URL do perfil Booksy", es: "ID de negocio o URL de perfil Booksy", hi: "Booksy बिज़नेस ID या प्रोफ़ाइल URL" } },
    ],
  },
  {
    key: "vagaro", icon: "✂️", name: "Vagaro", color: "#5B7FDB", mode: "soon",
    tag: { en: "Salon / spa bookings", pt: "Agenda de salão / spa", es: "Reservas de salón / spa", hi: "सैलून / स्पा बुकिंग" },
  },
];

// Status badge — signal palette by meaning (done green · attention amber · muted).
function StatusPill({ state }) {
  if (state === "connected") return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase" style={{ color: "#3E9468", background: "#3E946822", boxShadow: "inset 0 0 0 1px #3E946855" }}><FaCircleCheck size={9} /> {L("connected")}</span>;
  if (state === "stored") return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase" style={{ color: "#FFC23D", background: "#FFC23D1e", boxShadow: "inset 0 0 0 1px #FFC23D55" }}><FaClock size={9} /> {L("stored_pending")}</span>;
  if (state === "soon") return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase text-g-muted" style={{ background: "rgba(255,255,255,0.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)" }}>{L("soon")}</span>;
  if (state === "loading") return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-g-muted">{L("checking")}</span>;
  if (state === "erro") return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase" style={{ color: "#e0855f", background: "#e0855f1e", boxShadow: "inset 0 0 0 1px #e0855f55" }}><FaTriangleExclamation size={9} /> {L("check_failed")}</span>;
  return null;
}

function ScheduleSync({ V, real = null, email = "", dataKey = "" }) { // eslint-disable-line no-unused-vars
  const demo = !dataKey;
  const agent = V?.aiName || V?.agentName || "Gui";
  const [fetched, setFetched] = useState({}); // key → { state, note } from the live status calls
  const [open, setOpen] = useState("");        // which card's form is expanded
  const [form, setForm] = useState({});        // provider → { field: value }
  const [busy, setBusy] = useState("");        // provider currently submitting
  const [ativacao, setAtivacao] = useState(null); // MindBody: { rodando } | { codigo, link } | { falha, corpo }

  // Base state per card before any live status lands (loading spinner for pollable connectors).
  const baseState = (s) => (s.mode === "soon" ? "soon" : (s.mode === "oauth" ? "idle" : (demo ? "idle" : "loading")));

  // POST helper — every call carries the per-tenant gate (token=dataKey, email).
  // Devolve {data, motivo} e nunca levanta.
  const call = useCallback((endpoint, body) => chamarApi(endpoint, { token: dataKey, email: email || "", lang: UI_LANG, ...body }), [dataKey, email]);

  // Traduz a RESPOSTA do conector em estado + frase nossa. A nota crua nunca é guardada para a tela.
  const lerEstado = (d) => {
    // MindBody devolve o estado pronto (ver fraseMindbody). `mb` guarda o estado; a frase é nossa.
    if (d && d.estado) {
      const sites = d.sites && typeof d.sites === "object" ? d.sites : null;
      if (d.estado === "ativo") return { state: "connected", frase: "note_rw", sites, mb: "ativo" };
      if (d.estado === "sem_mapa") return { state: "connected", frase: "", sites, mb: "sem_mapa" };
      if (d.estado === "sem_chave") return { state: "idle", frase: "note_our_side" };
      if (d.estado === "login_recusado" || d.estado === "falta_login") return { state: "idle", frase: "", sites, mb: d.estado };
      return { state: "idle", frase: "" };
    }
    if (d && d.ready) return { state: "connected", frase: d.can_write === false ? "note_ro" : "note_rw", sites: d.sites && typeof d.sites === "object" ? d.sites : null };
    if (d && d.stored) return { state: "stored", frase: "" };
    // não pronto: se o motivo é do NOSSO lado (chave de parceiro ausente), diz isso sem jargão
    if (d && ehEngenharia(d.note) && /key|env|developer/i.test(String(d.note))) return { state: "idle", frase: "note_our_side" };
    return { state: "idle", frase: "" };
  };

  // Read each connector's REAL state on mount (real accounts only; demo shows previews).
  // 🚨 (2026-09-28) Erro de leitura virava "idle" — o cartão de um sistema CONECTADO aparecia com
  // o botão "Connect", como se a integração tivesse caído. A dona reconectava (ou ligava pro
  // suporte) por causa de um wifi. Agora falha é "Couldn't check" + tentar de novo.
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let alive = true;
    if (demo) return;
    SYSTEMS.filter((s) => s.mode === "form" || s.mode === "store").forEach(async (s) => {
      const r = await call(s.endpoint, { action: "status" });
      if (!alive) return;
      setFetched((cur) => ({ ...cur, [s.key]: r.motivo ? { state: "erro", motivo: r.motivo, corpo: s.key === "mindbody" ? corpoDaFalha(r) : "" } : lerEstado(r.data) }));
    });
    return () => { alive = false; };
  }, [demo, call, tentativa]);
  const reverificar = (key) => { setFetched((cur) => ({ ...cur, [key]: { state: "loading" } })); setTentativa((n) => n + 1); };

  const setField = (provider, name, value) => setForm((f) => ({ ...f, [provider]: { ...(f[provider] || {}), [name]: value } }));

  // Square / MindBody / Booksy — submit the inline credential form.
  const submitForm = async (sys) => {
    if (demo) { toast(L("demo_note")); return; }
    setBusy(sys.key);
    const vals = form[sys.provider] || {};
    const payload = { action: "connect" };
    sys.fields.forEach((f) => { payload[f.name] = String(vals[f.name] || "").trim(); });
    const r = await call(sys.endpoint, payload);
    const d = r.data;
    if (sys.key === "mindbody" && d && d.estado && !r.motivo) {
      // O servidor confere o login NO MindBody antes de gravar; login recusado não é gravado.
      if (d.connected) {
        setFetched((cur) => ({ ...cur, [sys.key]: { state: "connected", frase: d.estado === "ativo" ? "note_rw" : "", mb: d.estado, sites: { ...((cur[sys.key] || {}).sites || {}), ...(d.site ? { [d.site.nome || d.site.id]: d.site.id } : {}) } } }));
        setForm((f) => ({ ...f, [sys.provider]: {} }));   // a senha não fica na memória da tela
        setOpen(""); toast(`${sys.name} — ${L("connected")} ✓`);
      } else if (d.estado === "sem_chave") {
        setFetched((cur) => ({ ...cur, [sys.key]: { state: "idle", frase: "note_our_side" } }));
        setOpen(""); toast(L("note_our_side"));
      } else {
        setFetched((cur) => ({ ...cur, [sys.key]: { ...(cur[sys.key] || {}), state: "idle", frase: "", mb: d.estado } }));
        toast(fraseMindbody(d.estado) || L("err"));
      }
      setBusy(""); return;
    }
    if (sys.key === "mindbody" && r.motivo && r.http !== 400) {
      toast(`${L("check_failed")} — ${fraseDaFalha(r.motivo)}${corpoDaFalha(r) ? ` (${corpoDaFalha(r)})` : ""}`);
      setBusy(""); return;
    }
    if (r.motivo && r.http !== 400) {
      // falha NOSSA (rede/servidor/chave de conexão) — não é "confira os campos"
      toast(`${L("check_failed")} — ${fraseDaFalha(r.motivo)}`);
    } else if (d && (d.ready || d.connected)) {
      setFetched((cur) => ({ ...cur, [sys.key]: { state: "connected", frase: "note_rw", sites: (cur[sys.key] || {}).sites || null } }));
      setOpen(""); toast(`${sys.name} — ${L("connected")} ✓`);
    } else if (d && ehEngenharia(d.note) && /key|env|developer/i.test(String(d.note))) {
      setFetched((cur) => ({ ...cur, [sys.key]: { state: "idle", frase: "note_our_side" } }));
      setOpen(""); toast(L("note_our_side"));
    } else if (d && (d.stored || d.ok)) {
      // Guardado com honestidade: sem API viva (Booksy) → "acende quando abrir"; com API viva mas
      // login recusado (MindBody/Square) → diz que o login não funcionou. São coisas diferentes.
      const semLogin = sys.mode === "form";
      setFetched((cur) => ({ ...cur, [sys.key]: { state: semLogin ? "idle" : "stored", frase: semLogin ? "saved_noauth" : "" } }));
      if (!semLogin) setOpen("");
      toast(semLogin ? L("saved_noauth") : L("stored_pending"));
    } else {
      toast(L("err"));
    }
    setBusy("");
  };

  // MindBody: a DONA do site precisa aprovar a Guileo antes de a conexão funcionar. O link sai
  // do próprio MindBody (GET /site/activationcode) para o Site ID digitado.
  const pedirAtivacao = async () => {
    const site_id = String(((form.mindbody || {}).site_id) || "").trim();
    if (!site_id) { toast(tr("Type the Site ID first.")); return; }
    setAtivacao({ rodando: true });
    const r = await call("/api/mindbody", { action: "activation", site_id });
    const d = r.data;
    if (r.motivo || !d || d.ok !== true || !(d.link || d.codigo)) { setAtivacao({ falha: r.motivo || "servidor", corpo: corpoDaFalha(r) }); return; }
    setAtivacao({ codigo: d.codigo || "", link: d.link || "" });
  };

  return (
    <div className="space-y-4 stagger">
      {/* ── Banner: the golden-rule promise ── */}
      <Card className="bg-gradient-to-br from-[#4285F4]/[0.10] to-g-gold/[0.06] border-[#4285F4]/25">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center h-11 w-11 rounded-xl bg-[#4285F4]/15 text-[#4285F4] shrink-0"><FaCalendarCheck /></span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-g-word">{L("banner_title")}</div>
            <div className="text-xs text-g-light leading-relaxed mt-1">{L("banner_body", agent)}</div>
          </div>
          <GuiMark size={32} />
        </div>
      </Card>

      {/* ── How the anti-clash rule works (honest, always shown) ── */}
      <Card className="border-g-gold/25 bg-g-gold/[0.04]">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-g-gold/15 text-g-gold text-sm shrink-0"><FaTriangleExclamation size={13} /></span>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-g-word mb-0.5">{L("how_title")}</div>
            <div className="text-[11px] text-g-muted leading-snug">{L("how_body")}</div>
          </div>
        </div>
      </Card>

      {/* ── GOOGLE — o login único (agenda + avaliações). Substitui o antigo cartão "Google
             Calendar" desta lista, que abria /api/gcal-connect sem o portão do tenant e pedia
             só o escopo de calendário. Aqui o estado é LIDO do servidor e diz, item a item, o
             que o Google realmente concedeu. ── */}
      <GoogleConnectCard lang={UI_LANG} email={email} dataKey={dataKey} focus="calendar" />

      {/* ── One card per booking system ── */}
      {SYSTEMS.map((sys) => {
        const st = fetched[sys.key] || { state: baseState(sys) };
        const isConnected = st.state === "connected";
        const isSoon = sys.mode === "soon";
        const showForm = open === sys.key && (sys.mode === "form" || sys.mode === "store");
        return (
          <Card key={sys.key} className="p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="grid place-items-center h-11 w-11 rounded-xl text-xl shrink-0" style={{ background: sys.color + "22" }}>{sys.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold text-g-word flex items-center gap-2 flex-wrap">{sys.name}<StatusPill state={demo ? "idle" : st.state} /></div>
                <div className="text-[11px] text-g-muted leading-snug mt-0.5">{sys.tag[UI_LANG] || sys.tag.en}</div>
              </div>
              {/* Action control */}
              {isSoon ? (
                <span className="text-[11px] text-g-muted italic shrink-0">{L("no_api")}</span>
              ) : (
                <button onClick={() => setOpen(showForm ? "" : sys.key)} disabled={demo || st.state === "loading"} className={`text-[12px] px-3.5 py-1.5 shrink-0 ${demo ? "btn-ghost opacity-60" : (isConnected ? "btn-ghost" : "btn-bright")}`}>{showForm ? L("cancel") : (isConnected ? L("reconnect") : L("connect"))}</button>
              )}
            </div>

            {/* Frase NOSSA para o estado lido do conector (âmbar quando pendente). */}
            {!demo && st.frase && !showForm && (
              <div className={`px-5 pb-3 -mt-1 text-[11px] leading-snug ${isConnected && st.frase === "note_rw" ? "text-g-muted" : "text-[#FFC23D]"}`}>{L(st.frase)}</div>
            )}
            {!demo && sys.key === "mindbody" && st.mb && fraseMindbody(st.mb) && !showForm && (
              <div className="px-5 pb-3 -mt-1 text-[11px] leading-snug text-[#FFC23D]">{fraseMindbody(st.mb)}</div>
            )}
            {!demo && st.state === "erro" && !showForm && (
              <div role="alert" className="px-5 pb-3 -mt-1 text-[11px] leading-snug text-[#e0855f] flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">{fraseDaFalha(st.motivo)}{st.corpo && <span className="block font-mono text-[10px] text-g-muted break-words">{st.corpo}</span>}</span>
                <button onClick={() => reverificar(sys.key)} className="rounded-full border border-[#e0855f]/50 px-3 py-1 text-[11px] font-black hover:bg-[#e0855f]/10 transition">{L("retry")}</button>
              </div>
            )}
            {demo && (
              <div className="px-5 pb-3 -mt-1 text-[11px] leading-snug text-g-muted">{L("demo_note")}</div>
            )}
            {isSoon && (
              <div className="px-5 pb-3 -mt-1 text-[11px] leading-snug text-g-muted">{{ en: "No public booking API today. Gui keeps booking in your Guileo engine; this lights up the day Vagaro opens one.", pt: "Sem API pública de agenda hoje. A Gui segue agendando no motor Guileo; acende no dia que a Vagaro abrir uma.", es: "Sin API pública de reservas hoy. Gui sigue agendando en tu motor Guileo; se activa cuando Vagaro abra una.", hi: "आज कोई सार्वजनिक बुकिंग API नहीं। Gui आपके Guileo इंजन में बुकिंग करती रहती है; Vagaro के API खोलते ही यह सक्रिय होगा।" }[UI_LANG] || "No public booking API today. Gui keeps booking in your Guileo engine."}</div>
            )}

            {/* Inline credential form */}
            {showForm && (
              <div className="px-5 pb-4 pt-1 border-t border-white/[0.06] space-y-3 bg-black/15">
                {sys.fields.map((f) => (
                  <label key={f.name} className="block">
                    <span className="text-[11px] font-bold text-g-light">{f.label[UI_LANG] || f.label.en}</span>
                    {/* Site ID: sempre digitável (um negócio pode ter mais de um site e precisa poder
                        conectar o segundo). Os sites que ESTE tenant já cadastrou — vindos do status
                        dele, nunca de uma lista fixa — aparecem como sugestão. */}
                    <input type={f.type === "site" ? "text" : f.type} inputMode={f.type === "site" ? "numeric" : undefined} value={(form[sys.provider] || {})[f.name] || ""} onChange={(e) => setField(sys.provider, f.name, e.target.value)}
                      autoComplete="off" spellCheck={false} list={f.type === "site" && st.sites && Object.keys(st.sites).length > 0 ? `sites-${sys.key}` : undefined}
                      className="mt-1 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-[13px] text-g-word placeholder-g-muted focus:outline-none focus:border-g-gold/50" />
                    {f.type === "site" && st.sites && Object.keys(st.sites).length > 0 && (
                      <datalist id={`sites-${sys.key}`}>
                        {[...new Map(Object.entries(st.sites).map(([nome, id]) => [String(id), nome])).entries()].map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                      </datalist>
                    )}
                    {f.hint && <span className="block mt-1 text-[10px] text-g-muted leading-snug">{f.hint[UI_LANG] || f.hint.en}</span>}
                  </label>
                ))}
                <button onClick={() => submitForm(sys)} disabled={busy === sys.key} className="btn-bright text-[12px] px-4 py-2 w-full">{busy === sys.key ? L("saving") : L("connect")}</button>
                {sys.key === "mindbody" && !demo && (
                  <div className="pt-1 space-y-1.5">
                    <button onClick={pedirAtivacao} disabled={!!(ativacao && ativacao.rodando)} className="btn-ghost text-[12px] px-4 py-2 w-full disabled:opacity-60">{ativacao && ativacao.rodando ? L("checking") : tr("Get my activation link")}</button>
                    {ativacao && (ativacao.link || ativacao.codigo) && (
                      <div className="text-[11px] leading-snug text-g-light space-y-1">
                        <div>{tr("Open this link logged in to MindBody as the owner to approve Guileo, then come back and connect.")}</div>
                        {ativacao.link && <a href={ativacao.link} target="_blank" rel="noopener noreferrer" className="inline-block font-bold text-g-gold underline break-all">{tr("Open activation link")}</a>}
                        {ativacao.codigo && <div>{tr("Activation code")}: <span className="font-mono text-g-word break-all">{ativacao.codigo}</span></div>}
                      </div>
                    )}
                    {ativacao && ativacao.falha && (
                      <div role="alert" className="text-[11px] leading-snug text-[#e0855f]">
                        {tr("I couldn't get the activation link.")} {fraseDaFalha(ativacao.falha)}
                        {ativacao.corpo && <span className="block font-mono text-[10px] text-g-muted break-words">{ativacao.corpo}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* MindBody conectado → o passo de mapa + importação (só conta real; nada de amostra) */}
            {sys.key === "mindbody" && !demo && isConnected && !showForm && (
              <MindbodyMapa call={call} onSalvo={() => setFetched((cur) => ({ ...cur, mindbody: { ...(cur.mindbody || {}), state: "connected", frase: "note_rw", mb: "ativo" } }))} />
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default ScheduleSync;
