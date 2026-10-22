/* GUILEO DESK — JUNTAR FICHAS DUPLICADAS (2026-10-22, desk_v15). A mesma cliente aparece duas vezes quando
   marcou uma vez pelo telefone e outra pelo e-mail, ou quando a importação do MindBody trouxe as duas.

   🚨 REGRAS DESTA TELA
   · Só a dona (recepção não vê; o servidor responde 403 de qualquer jeito).
   · Nada se junta sem a dona ver, lado a lado, como a ficha vai ficar (desk_merge_preview — a MESMA régua do
     juntar) e o que NÃO muda (saldos, vendas, pacotes, vales ficam onde estão).
   · Juntar é um registro: dá para desfazer (botão logo depois e "Separar" na ficha).
   · Erros aparecem DENTRO do painel (toast some). Textos nos 4 idiomas (T abaixo). */
import { useState, useEffect, useCallback } from "react";
import { Drawer, SectionSkeleton } from "../pages/Portal.jsx";
import { chamarDesk, motivo, dinheiro, quando, tx } from "./deskApi.js";

const T = {
  // aviso no topo de Clientes
  avisoN: { en: "{n} possible duplicate client cards", pt: "{n} possíveis fichas duplicadas", es: "{n} posibles fichas duplicadas", hi: "{n} संभावित डुप्लिकेट ग्राहक कार्ड" },
  aviso1: { en: "1 possible duplicate client card", pt: "1 possível ficha duplicada", es: "1 posible ficha duplicada", hi: "1 संभावित डुप्लिकेट ग्राहक कार्ड" },
  avisoSub: { en: "The same client with her phone on one card and her email on another, or the same full name. Merging puts history, packages and gift cards on one card — and can be undone.", pt: "A mesma cliente com o telefone numa ficha e o e-mail na outra, ou o mesmo nome completo. Juntar põe histórico, pacotes e vales numa ficha só — e dá para desfazer.", es: "La misma clienta con el teléfono en una ficha y el correo en otra, o el mismo nombre completo. Unir pone historial, paquetes y tarjetas regalo en una sola ficha — y se puede deshacer.", hi: "एक ही ग्राहक — एक कार्ड पर फ़ोन, दूसरे पर ईमेल, या एक ही पूरा नाम। मिलाने से इतिहास, पैकेज और गिफ्ट कार्ड एक कार्ड पर आ जाते हैं — और वापस लिया जा सकता है।" },
  review: { en: "Review", pt: "Revisar", es: "Revisar", hi: "देखें" },
  avisoZero: { en: "No duplicate client cards in sight.", pt: "Nenhuma ficha duplicada à vista.", es: "Ninguna ficha duplicada a la vista.", hi: "कोई डुप्लिकेट कार्ड नहीं दिखा।" },
  avisoFail: { en: "I couldn't look for duplicates.", pt: "Não consegui procurar duplicados.", es: "No pude buscar duplicados.", hi: "डुप्लिकेट नहीं खोज पाया।" },
  retry: { en: "Try again", pt: "Tentar de novo", es: "Intentar de nuevo", hi: "फिर कोशिश करें" },
  // lista
  listaTitle: { en: "Duplicate client cards", pt: "Fichas duplicadas", es: "Fichas duplicadas", hi: "डुप्लिकेट ग्राहक कार्ड" },
  listaSub: { en: "Check each group. Nothing is merged until you confirm.", pt: "Confira cada grupo. Nada é juntado sem você confirmar.", es: "Revisa cada grupo. Nada se une sin que confirmes.", hi: "हर समूह जाँचें। आपकी पुष्टि के बिना कुछ नहीं मिलता।" },
  reason_same_person: { en: "Same person in your records", pt: "Mesma pessoa no cadastro", es: "Misma persona en el registro", hi: "रिकॉर्ड में वही व्यक्ति" },
  reasonHelp_same_person: { en: "One card's phone and the other's email are on the same record.", pt: "O telefone de uma e o e-mail da outra estão no mesmo cadastro.", es: "El teléfono de una y el correo de la otra están en el mismo registro.", hi: "एक का फ़ोन और दूसरे का ईमेल एक ही रिकॉर्ड में हैं।" },
  reason_same_name: { en: "Same full name", pt: "Mesmo nome completo", es: "Mismo nombre completo", hi: "एक ही पूरा नाम" },
  reasonHelp_same_name: { en: "Check phone and email first — it could be someone else with the same name.", pt: "Confira telefone e e-mail antes — pode ser outra pessoa com o mesmo nome.", es: "Revisa teléfono y correo antes — puede ser otra persona con el mismo nombre.", hi: "पहले फ़ोन और ईमेल जाँचें — यह उसी नाम का कोई और हो सकता है।" },
  suggestedMain: { en: "stays as the main card", pt: "fica como principal", es: "queda como principal", hi: "मुख्य कार्ड रहेगा" },
  compare: { en: "Compare and merge", pt: "Comparar e juntar", es: "Comparar y unir", hi: "तुलना करें और मिलाएँ" },
  notSame: { en: "Not the same person", pt: "Não são a mesma pessoa", es: "No son la misma persona", hi: "एक ही व्यक्ति नहीं" },
  more: { en: "Showing {a} of {n}. Merge or dismiss these to see the next ones.", pt: "Mostrando {a} de {n}. Junte ou descarte estes para ver os próximos.", es: "Mostrando {a} de {n}. Une o descarta estos para ver los siguientes.", hi: "{n} में से {a} दिख रहे हैं।" },
  visit1: { en: "visit", pt: "visita", es: "visita", hi: "विज़िट" },
  visitN: { en: "visits", pt: "visitas", es: "visitas", hi: "विज़िट" },
  sale1: { en: "purchase", pt: "compra", es: "compra", hi: "खरीद" },
  pkg1: { en: "active package", pt: "pacote ativo", es: "paquete activo", hi: "सक्रिय पैकेज" },
  pkgN: { en: "active packages", pt: "pacotes ativos", es: "paquetes activos", hi: "सक्रिय पैकेज" },
  gc1: { en: "gift card with balance", pt: "vale com saldo", es: "tarjeta regalo con saldo", hi: "बैलेंस वाला गिफ्ट कार्ड" },
  gcN: { en: "gift cards with balance", pt: "vales com saldo", es: "tarjetas regalo con saldo", hi: "बैलेंस वाले गिफ्ट कार्ड" },
  saleN: { en: "purchases", pt: "compras", es: "compras", hi: "खरीद" },
  lastShort: { en: "last {d}", pt: "última {d}", es: "última {d}", hi: "पिछली {d}" },
  emptyList: { en: "Nothing left to review.", pt: "Nada mais para revisar.", es: "Nada más que revisar.", hi: "देखने के लिए कुछ नहीं बचा।" },
  dismissFail: { en: "Couldn't save that. Try again.", pt: "Não consegui guardar. Tente de novo.", es: "No pude guardarlo. Inténtalo de nuevo.", hi: "सहेज नहीं पाया।" },
  // comparação
  title: { en: "Merge client cards", pt: "Juntar fichas", es: "Unir fichas", hi: "कार्ड मिलाएँ" },
  sub: { en: "Check before merging. It can be undone.", pt: "Confira antes de juntar. Dá para desfazer.", es: "Revisa antes de unir. Se puede deshacer.", hi: "मिलाने से पहले जाँचें। वापस लिया जा सकता है।" },
  loading: { en: "Comparing the two cards…", pt: "Comparando as duas fichas…", es: "Comparando las dos fichas…", hi: "दोनों कार्ड की तुलना…" },
  keep: { en: "Stays (main card)", pt: "Fica (principal)", es: "Queda (principal)", hi: "रहेगा (मुख्य)" },
  drop: { en: "Joins this card", pt: "Entra nesta ficha", es: "Se une a esta ficha", hi: "इसमें जुड़ेगा" },
  swap: { en: "⇄ Switch which one stays", pt: "⇄ Trocar qual fica", es: "⇄ Cambiar cuál queda", hi: "⇄ कौन रहे, बदलें" },
  diffNames: { en: "The names are different. Make sure it's really the same person.", pt: "Os nomes são diferentes. Confira se é mesmo a mesma pessoa.", es: "Los nombres son distintos. Confirma que es la misma persona.", hi: "नाम अलग हैं। पक्का करें कि यह वही व्यक्ति है।" },
  resultTitle: { en: "How the card will look", pt: "Como a ficha fica", es: "Cómo queda la ficha", hi: "कार्ड कैसा दिखेगा" },
  f_name: { en: "Name", pt: "Nome", es: "Nombre", hi: "नाम" },
  f_phone: { en: "Phone", pt: "Telefone", es: "Teléfono", hi: "फ़ोन" },
  f_email: { en: "Email", pt: "E-mail", es: "Correo", hi: "ईमेल" },
  f_allergies: { en: "Allergies", pt: "Alergias", es: "Alergias", hi: "एलर्जी" },
  f_alerts: { en: "Alerts", pt: "Alertas", es: "Alertas", hi: "चेतावनियाँ" },
  f_notes: { en: "Notes", pt: "Notas", es: "Notas", hi: "नोट्स" },
  f_tags: { en: "Tags", pt: "Etiquetas", es: "Etiquetas", hi: "टैग" },
  f_trusted: { en: "Trusted client", pt: "Cliente de confiança", es: "Clienta de confianza", hi: "भरोसेमंद ग्राहक" },
  f_online: { en: "Can book online", pt: "Pode marcar online", es: "Puede reservar en línea", hi: "ऑनलाइन बुक कर सकती है" },
  f_consent: { en: "Offers consent", pt: "Permissão para ofertas", es: "Permiso para ofertas", hi: "ऑफ़र सहमति" },
  rule_sum: { en: "both added together — nothing is erased", pt: "as duas somadas — nada se apaga", es: "las dos sumadas — nada se borra", hi: "दोनों जोड़े गए — कुछ नहीं मिटता" },
  rule_online: { en: "one card was blocked — stays blocked", pt: "uma das fichas estava bloqueada — fica bloqueada", es: "una ficha estaba bloqueada — queda bloqueada", hi: "एक कार्ड ब्लॉक था — ब्लॉक रहेगा" },
  rule_trusted: { en: "she was trusted on one of the cards", pt: "era de confiança em uma das fichas", es: "era de confianza en una de las fichas", hi: "एक कार्ड पर भरोसेमंद थी" },
  rule_no: { en: "{c} said no on {d} — counts for both", pt: "{c} disse não em {d} — vale para as duas", es: "{c} dijo que no el {d} — vale para las dos", hi: "{c} ने {d} को मना किया — दोनों पर लागू" },
  yes: { en: "Yes", pt: "Sim", es: "Sí", hi: "हाँ" },
  no: { en: "No", pt: "Não", es: "No", hi: "नहीं" },
  ch_sms: { en: "Text", pt: "SMS", es: "SMS", hi: "SMS" },
  ch_call: { en: "Phone", pt: "Ligação", es: "Llamada", hi: "कॉल" },
  ch_whatsapp: { en: "WhatsApp", pt: "WhatsApp", es: "WhatsApp", hi: "WhatsApp" },
  ch_email: { en: "Email", pt: "E-mail", es: "Correo", hi: "ईमेल" },
  unchangedTitle: { en: "What doesn't change", pt: "O que não muda", es: "Lo que no cambia", hi: "क्या नहीं बदलता" },
  unchanged: { en: "Sales, packages, gift cards and appointments stay where they are — no balance changes. The main card shows everything together, including anything that arrives later under the old contact.", pt: "Vendas, pacotes, vales e agendamentos continuam onde estão — nenhum saldo muda. A ficha principal mostra tudo junto, inclusive o que chegar depois pelo contato antigo.", es: "Ventas, paquetes, tarjetas regalo y citas siguen donde están — ningún saldo cambia. La ficha principal muestra todo junto, incluso lo que llegue después por el contacto antiguo.", hi: "बिक्री, पैकेज, गिफ्ट कार्ड और अपॉइंटमेंट जहाँ हैं वहीं रहते हैं — कोई बैलेंस नहीं बदलता।" },
  confirm: { en: "Merge the 2 cards", pt: "Juntar as 2 fichas", es: "Unir las 2 fichas", hi: "2 कार्ड मिलाएँ" },
  merging: { en: "Merging…", pt: "Juntando…", es: "Uniendo…", hi: "मिला रहे हैं…" },
  notNow: { en: "Not now", pt: "Agora não", es: "Ahora no", hi: "अभी नहीं" },
  sampleBlocked: { en: "This is a sample — connect your account to merge real cards.", pt: "Isto é um exemplo — conecte a sua conta para juntar fichas de verdade.", es: "Esto es un ejemplo — conecta tu cuenta para unir fichas reales.", hi: "यह नमूना है — असली कार्ड मिलाने के लिए खाता जोड़ें।" },
  done: { en: "Cards merged", pt: "Fichas juntadas", es: "Fichas unidas", hi: "कार्ड मिल गए" },
  doneSub: { en: "{b} is now part of {a}'s card.", pt: "{b} agora faz parte da ficha de {a}.", es: "{b} ahora es parte de la ficha de {a}.", hi: "{b} अब {a} के कार्ड का हिस्सा है।" },
  doneConsent: { en: "Offers consent: the most restrictive answer now counts for both contacts.", pt: "Permissão para ofertas: a resposta mais restritiva passou a valer para os dois contatos.", es: "Permiso para ofertas: la respuesta más restrictiva ahora vale para ambos contactos.", hi: "सबसे सख्त सहमति अब दोनों संपर्कों पर लागू।" },
  undo: { en: "Undo", pt: "Desfazer", es: "Deshacer", hi: "वापस लें" },
  undoing: { en: "Undoing…", pt: "Desfazendo…", es: "Deshaciendo…", hi: "वापस ले रहे हैं…" },
  undone: { en: "Merge undone — both cards are back as they were.", pt: "Junção desfeita — as duas fichas voltaram como eram.", es: "Unión deshecha — las dos fichas volvieron como estaban.", hi: "मिलान वापस — दोनों कार्ड पहले जैसे।" },
  keptEdits: { en: "The main card was edited after the merge; that edit stayed on it.", pt: "A ficha principal foi editada depois de juntar; essa edição ficou nela.", es: "La ficha principal se editó después de unir; esa edición quedó en ella.", hi: "मिलाने के बाद मुख्य कार्ड बदला गया था; वह बदलाव उसी पर रहा।" },
  openCard: { en: "Open the card", pt: "Abrir a ficha", es: "Abrir la ficha", hi: "कार्ड खोलें" },
  close: { en: "Close", pt: "Fechar", es: "Cerrar", hi: "बंद करें" },
  // escolher a outra ficha
  pickTitle: { en: "Merge with which card?", pt: "Juntar com qual ficha?", es: "¿Unir con qué ficha?", hi: "किस कार्ड से मिलाएँ?" },
  pickSub: { en: "Find the other card of the same client. Next you'll see both side by side.", pt: "Procure a outra ficha da mesma cliente. Depois você vê as duas lado a lado.", es: "Busca la otra ficha de la misma clienta. Después verás las dos lado a lado.", hi: "उसी ग्राहक का दूसरा कार्ड खोजें।" },
  pickPh: { en: "Name, phone or email…", pt: "Nome, telefone ou e-mail…", es: "Nombre, teléfono o correo…", hi: "नाम, फ़ोन या ईमेल…" },
  pickHint: { en: "Type at least 2 letters or 3 digits.", pt: "Digite pelo menos 2 letras ou 3 números.", es: "Escribe al menos 2 letras o 3 números.", hi: "कम से कम 2 अक्षर या 3 अंक।" },
  searching: { en: "Searching…", pt: "Procurando…", es: "Buscando…", hi: "खोज रहे हैं…" },
  noResults: { en: "No other card found.", pt: "Nenhuma outra ficha encontrada.", es: "No se encontró otra ficha.", hi: "कोई और कार्ड नहीं मिला।" },
  // na ficha: o que foi juntado nela
  alsoHere: { en: "Also on this card", pt: "Também nesta ficha", es: "También en esta ficha", hi: "इस कार्ड पर भी" },
  mergedOn: { en: "merged on {d}", pt: "juntada em {d}", es: "unida el {d}", hi: "{d} को मिलाया" },
  separate: { en: "Separate", pt: "Separar", es: "Separar", hi: "अलग करें" },
  separateAsk: { en: "Separate again? Both cards go back to how they were.", pt: "Separar de novo? As duas fichas voltam como eram.", es: "¿Separar de nuevo? Las dos fichas vuelven como estaban.", hi: "फिर अलग करें? दोनों कार्ड पहले जैसे हो जाएँगे।" },
  separateYes: { en: "Yes, separate", pt: "Sim, separar", es: "Sí, separar", hi: "हाँ, अलग करें" },
  mergeWith: { en: "⇄ Merge with another card", pt: "⇄ Juntar com outra ficha", es: "⇄ Unir con otra ficha", hi: "⇄ दूसरे कार्ड से मिलाएँ" },
};
const t = (k) => tx(T[k]) || k;
const stats = (v, s) => `${Number(v) || 0} ${t(Number(v) === 1 ? "visit1" : "visitN")} · ${Number(s) || 0} ${t(Number(s) === 1 ? "sale1" : "saleN")}`;
const dia = (iso, tz) => (iso ? quando(iso, tz, { day: "numeric", month: "short", year: "numeric" }) : "");

// ── amostra (sem conexão): a mesma forma das respostas do servidor ───────────────────────────────
const AMOSTRA_GRUPOS = {
  ok: true, total: 2, groups: [
    { reason: "same_person", assinatura: "7185550142|maria.silva@example.com", members: [
      { contact_key: "7185550142", contact: "+1 718 555 0142", name: "Maria Silva", visits: 9, sales: 6, last_visit: new Date(Date.now() - 12 * 864e5).toISOString() },
      { contact_key: "maria.silva@example.com", contact: "maria.silva@example.com", name: "Maria S.", visits: 2, sales: 1, last_visit: new Date(Date.now() - 200 * 864e5).toISOString() }] },
    { reason: "same_name", assinatura: "3475550190|jenny.kim@example.com", members: [
      { contact_key: "3475550190", contact: "+1 347 555 0190", name: "Jenny Kim", visits: 4, sales: 3, last_visit: new Date(Date.now() - 30 * 864e5).toISOString() },
      { contact_key: "jenny.kim@example.com", contact: "jenny.kim@example.com", name: "Jenny Kim", visits: 1, sales: 0, last_visit: null }] },
  ],
};
const amostraPrevia = (keep, drop) => {
  const m = AMOSTRA_GRUPOS.groups.flatMap((g) => g.members);
  const a = m.find((x) => x.contact === keep) || m[0], b = m.find((x) => x.contact === drop) || m[1];
  return { ok: true, main: { ...a, spend_cents: 84000, packages: 1, gift_cards: 0 }, alias: { ...b, spend_cents: 9500, packages: 0, gift_cards: 1 },
    result: { name: a.name, phone: a.contact.startsWith("+") ? a.contact : b.contact, email: a.contact.includes("@") ? a.contact : b.contact,
      allergies: "Nut oils · Latex", alerts: "Prefers light pressure", notes: "", tags: ["vip"], trusted: true, can_book_online: false },
    consent: { sms: { main: { granted: true, at: new Date(Date.now() - 90 * 864e5).toISOString() }, alias: { granted: false, at: new Date(Date.now() - 20 * 864e5).toISOString() }, result: false } },
    different_names: a.name !== b.name };
};

// ── o aviso no topo de Clientes (só a dona) ──────────────────────────────────────────────────────
export function DuplicadosAviso({ email, dataKey, conectado, tz, seq = 0, onComparar }) {
  const [st, setSt] = useState({ fase: "lendo", d: null });
  const [aberto, setAberto] = useState(false);
  const [meuSeq, setMeuSeq] = useState(0);
  useEffect(() => {
    let vivo = true;
    if (!conectado) { setSt({ fase: "ok", d: AMOSTRA_GRUPOS }); return () => { vivo = false; }; }
    setSt((s) => ({ fase: s.d ? "relendo" : "lendo", d: s.d }));
    chamarDesk(email, dataKey, { action: "merge_suggest" }).then(({ d }) => { if (vivo) setSt(d?.ok ? { fase: "ok", d } : { fase: "falhou", d: null }); });
    return () => { vivo = false; };
  }, [email, dataKey, conectado, seq, meuSeq]);
  const total = Number(st.d?.total) || 0;
  if (st.fase === "lendo") return null;   // a busca é o principal da aba; o aviso entra quando souber o que dizer
  if (st.fase === "falhou") return (
    <div className="flex items-center justify-between gap-3 rounded-xl2 border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] text-g-muted">
      <span>{t("avisoFail")}</span><button type="button" onClick={() => setMeuSeq((n) => n + 1)} className="font-bold text-g-word underline">{t("retry")}</button>
    </div>
  );
  if (!total) return <div className="text-[11px] text-g-muted">✓ {t("avisoZero")}</div>;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-g-gold/35 bg-g-gold/[0.07] px-4 py-3">
        <div className="min-w-0 max-w-2xl">
          <div className="text-sm font-extrabold text-g-word"><span aria-hidden className="mr-1.5">🔁</span>{total === 1 ? t("aviso1") : t("avisoN").replace("{n}", total)}</div>
          <div className="text-[11px] text-g-muted mt-0.5">{t("avisoSub")}</div>
        </div>
        <button type="button" onClick={() => setAberto(true)} className="shrink-0 rounded-full border border-g-gold/50 px-4 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word hover:bg-g-gold/10">{t("review")}</button>
      </div>
      {aberto && <DuplicadosLista email={email} dataKey={dataKey} conectado={conectado} tz={tz} d={st.d} onClose={() => setAberto(false)}
        recarregar={() => setMeuSeq((n) => n + 1)} onComparar={(k, dr) => { setAberto(false); onComparar(k, dr); }} />}
    </>
  );
}

function DuplicadosLista({ email, dataKey, conectado, tz, d, onClose, recarregar, onComparar }) {
  const [tirados, setTirados] = useState({});
  const [erro, setErro] = useState("");
  const grupos = (d?.groups || []).filter((g) => !tirados[g.assinatura]);
  const naoSao = async (g) => {
    setErro("");
    if (!conectado) { setTirados((x) => ({ ...x, [g.assinatura]: true })); return; }
    const { d: r } = await chamarDesk(email, dataKey, { action: "merge_dismiss", keys: g.members.map((m) => m.contact_key) });
    if (r?.ok) { setTirados((x) => ({ ...x, [g.assinatura]: true })); recarregar(); } else setErro(t("dismissFail"));
  };
  return (
    <Drawer title={t("listaTitle")} subtitle={t("listaSub")} onClose={onClose}>
      <div className="space-y-3">
        {erro && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-xs text-red-300">{erro}</div>}
        {grupos.length === 0 && <div className="text-xs text-g-muted">{t("emptyList")}</div>}
        {grupos.map((g) => {
          const forte = g.reason === "same_person";
          return (
            <section key={g.assinatura} className="rounded-xl2 border border-white/10 bg-white/[0.03] p-3 space-y-2">
              <div>
                <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${forte ? "border-g-green/40 text-g-green" : "border-g-gold/50 text-g-gold"}`}>{t(`reason_${g.reason}`)}</span>
                <div className="text-[11px] text-g-muted mt-1">{t(`reasonHelp_${g.reason}`)}</div>
              </div>
              {g.members.map((m, i) => (
                <div key={m.contact_key} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{m.name || "—"}</div>
                    <div className="text-[11px] text-g-muted truncate">{m.contact}</div>
                    <div className="text-[11px] text-g-muted num">{stats(m.visits, m.sales)}{m.last_visit ? ` · ${t("lastShort").replace("{d}", dia(m.last_visit, tz))}` : ""}</div>
                  </div>
                  {i === 0
                    ? <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-g-muted text-right max-w-[7rem]">{t("suggestedMain")}</span>
                    : <button type="button" onClick={() => onComparar(g.members[0].contact, m.contact)}
                        className="shrink-0 rounded-full border border-g-green/40 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-green">{t("compare")}</button>}
                </div>
              ))}
              <button type="button" onClick={() => naoSao(g)} className="py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-[11px] text-g-muted underline hover:text-g-word">{t("notSame")}</button>
            </section>
          );
        })}
        {Number(d?.total) > (d?.groups || []).length && (
          <div className="text-[11px] text-g-muted">{t("more").replace("{a}", (d?.groups || []).length).replace("{n}", d.total)}</div>
        )}
      </div>
    </Drawer>
  );
}

// ── lado a lado, confirmar, desfazer ─────────────────────────────────────────────────────────────
export function JuntarDrawer({ email, dataKey, conectado, tz, keep: keep0, drop: drop0, onClose, onMerged, onAbrir }) {
  const [par, setPar] = useState({ keep: keep0, drop: drop0 });
  const [st, setSt] = useState({ fase: "lendo", d: null, erro: "" });
  const [feito, setFeito] = useState(null);       // { merge_id, nomeA, nomeB, consent } | { desfeito, kept }
  const [ocupado, setOcupado] = useState("");
  useEffect(() => {
    let vivo = true;
    setSt({ fase: "lendo", d: null, erro: "" });
    if (!conectado) { setSt({ fase: "ok", d: amostraPrevia(par.keep, par.drop), erro: "" }); return () => { vivo = false; }; }
    chamarDesk(email, dataKey, { action: "merge_preview", keep: par.keep, drop: par.drop }).then(({ d, http }) => {
      if (!vivo) return;
      setSt(d?.ok ? { fase: "ok", d, erro: "" } : { fase: "falhou", d: null, erro: motivo(d, http) });
    });
    return () => { vivo = false; };
  }, [par, conectado, email, dataKey]);

  const juntar = async () => {
    if (!conectado) { setSt((s) => ({ ...s, erro: t("sampleBlocked") })); return; }
    setOcupado("juntar"); setSt((s) => ({ ...s, erro: "" }));
    const { d, http } = await chamarDesk(email, dataKey, { action: "merge", keep: par.keep, drop: par.drop });
    setOcupado("");
    if (d?.ok) { setFeito({ merge_id: d.merge_id, nomeA: st.d?.main?.name || par.keep, nomeB: par.drop, consent: Number(d.consent_records) > 0 }); onMerged?.(); }
    else setSt((s) => ({ ...s, erro: motivo(d, http) }));
  };
  const desfazer = async () => {
    setOcupado("desfazer");
    const { d, http } = await chamarDesk(email, dataKey, { action: "merge_undo", id: feito.merge_id });
    setOcupado("");
    if (d?.ok) { setFeito({ desfeito: true, kept: !!d.kept_edits }); onMerged?.(); }
    else setFeito((f) => ({ ...f, erro: motivo(d, http) }));
  };

  // depois de juntar / desfazer
  if (feito) return (
    <Drawer title={feito.desfeito ? t("undo") : t("done")} onClose={onClose}
      actions={feito.desfeito
        ? <button onClick={onClose} className="flex-1 min-h-[44px] rounded-full bg-g-green px-4 py-2.5 text-sm font-extrabold text-[#161512]">{t("close")}</button>
        : <>
            <button onClick={desfazer} disabled={!!ocupado} className="flex-1 min-h-[44px] rounded-full border border-white/15 px-4 py-2.5 text-sm font-bold text-g-word disabled:opacity-40">{ocupado ? t("undoing") : t("undo")}</button>
            <button onClick={() => onAbrir?.(par.keep)} className="flex-1 min-h-[44px] rounded-full bg-g-green px-4 py-2.5 text-sm font-extrabold text-[#161512]">{t("openCard")}</button>
          </>}>
      <div className="space-y-3 pt-1">
        {feito.desfeito ? (
          <div className="rounded-xl2 border border-white/10 bg-white/[0.04] p-4 text-sm text-g-word">
            {t("undone")}{feito.kept && <div className="mt-2 text-xs text-g-muted">{t("keptEdits")}</div>}
          </div>
        ) : (
          <div className="rounded-xl2 border border-g-green/30 bg-g-green/[0.07] p-4 text-center">
            <div className="text-3xl" aria-hidden>✓</div>
            <div className="text-sm font-bold text-g-word mt-1">{t("doneSub").replace("{a}", feito.nomeA).replace("{b}", feito.nomeB)}</div>
            {feito.consent && <div className="text-[11px] text-g-muted mt-2">{t("doneConsent")}</div>}
          </div>
        )}
        {feito.erro && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-xs text-red-300">{feito.erro}</div>}
      </div>
    </Drawer>
  );

  const d = st.d;
  const r = d?.result || {};
  const linhas = d ? [
    ["f_name", r.name], ["f_phone", r.phone], ["f_email", r.email],
    ["f_allergies", r.allergies, (d.main?.profile?.allergies && d.alias?.profile?.allergies) ? t("rule_sum") : ""],
    ["f_alerts", r.alerts, (d.main?.profile?.alerts && d.alias?.profile?.alerts) ? t("rule_sum") : ""],
    ["f_notes", r.notes, (d.main?.profile?.notes && d.alias?.profile?.notes) ? t("rule_sum") : ""],
    ["f_tags", (r.tags || []).join(", ")],
    ["f_trusted", r.trusted ? t("yes") : t("no"), r.trusted && !(d.main?.profile?.trusted && d.alias?.profile?.trusted) ? t("rule_trusted") : ""],
    ["f_online", r.can_book_online === false ? t("no") : t("yes"), r.can_book_online === false ? t("rule_online") : ""],
  ].filter(([, v]) => v != null && v !== "") : [];
  const canais = Object.entries(d?.consent || {});
  return (
    <Drawer title={t("title")} subtitle={t("sub")} onClose={onClose}
      actions={st.fase === "ok" ? <>
        <button onClick={onClose} className="flex-1 min-h-[44px] rounded-full border border-white/15 px-4 py-2.5 text-sm font-bold text-g-word">{t("notNow")}</button>
        <button onClick={juntar} disabled={!!ocupado} className="flex-1 min-h-[44px] rounded-full bg-g-green px-4 py-2.5 text-sm font-extrabold text-[#161512] disabled:opacity-40">{ocupado ? t("merging") : t("confirm")}</button>
      </> : st.fase === "falhou" ? <button onClick={onClose} className="flex-1 min-h-[44px] rounded-full border border-white/15 px-4 py-2.5 text-sm font-bold text-g-word">{t("close")}</button> : null}>
      <div className="space-y-3 pt-1">
        {st.fase === "lendo" && <><div className="text-xs text-g-muted">{t("loading")}</div><SectionSkeleton rows={4} /></>}
        {st.erro && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-xs text-red-300">{st.erro}</div>}
        {d && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[["keep", d.main], ["drop", d.alias]].map(([k, x]) => (
                <div key={k} className={`rounded-xl2 border p-3 ${k === "keep" ? "border-g-green/35 bg-g-green/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
                  <div className="text-[10px] uppercase tracking-wide text-g-muted">{t(k)}</div>
                  <div className="text-sm font-extrabold text-g-word truncate mt-0.5">{x?.name || "—"}</div>
                  <div className="text-[11px] text-g-muted truncate">{x?.contact}</div>
                  <div className="text-[11px] text-g-muted num mt-1">{stats(x?.visits, x?.sales)} · {dinheiro(x?.spend_cents || 0, tz)}</div>
                  {(x?.packages > 0 || x?.gift_cards > 0) && <div className="text-[11px] text-g-muted num">{[x.packages > 0 ? `${x.packages} ${t(x.packages === 1 ? "pkg1" : "pkgN")}` : "", x.gift_cards > 0 ? `${x.gift_cards} ${t(x.gift_cards === 1 ? "gc1" : "gcN")}` : ""].filter(Boolean).join(" · ")}</div>}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setPar((p) => ({ keep: p.drop, drop: p.keep }))} disabled={!!ocupado}
              className="py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word underline disabled:opacity-40">{t("swap")}</button>
            {d.different_names && <div role="note" className="rounded-xl border border-g-gold/40 bg-g-gold/[0.08] px-3 py-2 text-xs text-g-word">⚠ {t("diffNames")}</div>}

            <section className="rounded-xl2 border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
              <div className="text-xs font-extrabold text-g-word">{t("resultTitle")}</div>
              {linhas.map(([k, v, regra]) => (
                <div key={k} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-g-muted shrink-0">{t(k)}</span>
                  <span className="text-right min-w-0">
                    <span className="font-bold text-g-word break-words">{v}</span>
                    {regra && <span className="block text-[10px] text-g-muted">{regra}</span>}
                  </span>
                </div>
              ))}
              {canais.length > 0 && (
                <div className="pt-1.5 border-t border-white/10 space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-g-muted">{t("f_consent")}</div>
                  {canais.map(([ch, c]) => {
                    const quemNao = c.alias?.granted === false ? { ct: d.alias?.contact, at: c.alias?.at } : c.main?.granted === false ? { ct: d.main?.contact, at: c.main?.at } : null;
                    return (
                      <div key={ch} className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-g-muted">{t(`ch_${ch}`)}</span>
                        <span className="text-right">
                          <span className={`font-bold ${c.result === false ? "text-red-300" : "text-g-word"}`}>{c.result === false ? t("no") : c.result === true ? t("yes") : "—"}</span>
                          {c.result === false && quemNao && <span className="block text-[10px] text-g-muted">{t("rule_no").replace("{c}", quemNao.ct || "").replace("{d}", dia(quemNao.at, tz))}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-xl2 border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs font-extrabold text-g-word">{t("unchangedTitle")}</div>
              <p className="text-[11px] text-g-muted mt-1">{t("unchanged")}</p>
            </section>
          </>
        )}
      </div>
    </Drawer>
  );
}

// ── escolher a outra ficha à mão (da ficha aberta) ───────────────────────────────────────────────
export function EscolherOutraFicha({ email, dataKey, conectado, contatoAtual, keyAtual, amostraLista = [], onClose, onEscolher }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState({ fase: "parado", lista: [] });
  const buscar = useCallback(async (s) => {
    if (!conectado) { const n = s.toLowerCase(); setSt({ fase: "ok", lista: amostraLista.filter((c) => `${c.name} ${c.contact}`.toLowerCase().includes(n)) }); return; }
    setSt((x) => ({ fase: "procurando", lista: x.lista }));
    const { d } = await chamarDesk(email, dataKey, { action: "client_search", q: s });
    setSt(Array.isArray(d) ? { fase: "ok", lista: d } : { fase: "ok", lista: [] });
  }, [conectado, email, dataKey, amostraLista]);
  useEffect(() => {
    const s = q.trim();
    const pronta = s.replace(/\D/g, "").length >= 3 || s.replace(/[^\p{L}]/gu, "").length >= 2;
    if (!pronta) { setSt({ fase: "parado", lista: [] }); return undefined; }
    const id = setTimeout(() => buscar(s), 300);
    return () => clearTimeout(id);
  }, [q, buscar]);
  const lista = st.lista.filter((c) => c.contact_key !== keyAtual && c.contact !== contatoAtual);
  return (
    <Drawer title={t("pickTitle")} subtitle={t("pickSub")} onClose={onClose}>
      <div className="space-y-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("pickPh")} aria-label={t("pickPh")} autoFocus
          className="w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 min-h-[40px] text-sm text-g-word placeholder:text-g-muted" />
        {st.fase === "parado" && <div className="text-[11px] text-g-muted">{t("pickHint")}</div>}
        {st.fase === "procurando" && lista.length === 0 && <div className="text-[11px] text-g-muted">{t("searching")}</div>}
        {st.fase === "ok" && lista.length === 0 && <div className="text-[11px] text-g-muted">{t("noResults")}</div>}
        <ul className="divide-y divide-white/[0.06] rounded-xl2 border border-white/10 overflow-hidden">
          {lista.map((c) => (
            <li key={c.contact_key || c.contact}>
              <button type="button" onClick={() => onEscolher(c.contact)} className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05]">
                <div className="text-sm font-bold text-g-word truncate">{c.name || "—"}</div>
                <div className="text-[11px] text-g-muted truncate">{c.contact}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Drawer>
  );
}

// ── na ficha: "também nesta ficha" com Separar (desfaz a junção) — só a dona ─────────────────────
export function Apelidos({ email, dataKey, conectado, tz, aliases = [], dona, recarregar }) {
  const [perguntando, setPerguntando] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [msg, setMsg] = useState({ txt: "", erro: false });
  if (!aliases.length && !msg.txt) return null;
  const separar = async (a) => {
    if (!conectado) { setMsg({ txt: t("sampleBlocked"), erro: true }); return; }
    setOcupado(a.merge_id);
    const { d, http } = await chamarDesk(email, dataKey, { action: "merge_undo", id: a.merge_id });
    setOcupado(""); setPerguntando("");
    if (d?.ok) { setMsg({ txt: t("undone") + (d.kept_edits ? ` ${t("keptEdits")}` : ""), erro: false }); recarregar?.(); }
    else setMsg({ txt: motivo(d, http), erro: true });
  };
  return (
    <div className="rounded-xl2 border border-white/10 bg-white/[0.03] px-4 py-2.5 space-y-1.5">
      {aliases.length > 0 && <div className="text-[10px] uppercase tracking-wide text-g-muted">{t("alsoHere")}</div>}
      {aliases.map((a) => (
        <div key={a.contact_key} className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="min-w-0"><span className="font-bold text-g-word break-all">{a.contact}</span> <span className="text-g-muted">· {t("mergedOn").replace("{d}", dia(a.at, tz))}</span></span>
          {dona && a.merge_id && (perguntando === a.merge_id ? (
            <span className="flex items-center gap-2">
              <span className="text-g-muted">{t("separateAsk")}</span>
              <button type="button" onClick={() => separar(a)} disabled={!!ocupado} className="rounded-full border border-red-400/40 px-3 py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] font-bold text-red-300 disabled:opacity-40">{ocupado ? t("undoing") : t("separateYes")}</button>
              <button type="button" onClick={() => setPerguntando("")} className="text-g-muted underline">{t("notNow")}</button>
            </span>
          ) : (
            <button type="button" onClick={() => setPerguntando(a.merge_id)} className="py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-g-muted underline hover:text-g-word">{t("separate")}</button>
          ))}
        </div>
      ))}
      {msg.txt && <div role={msg.erro ? "alert" : "status"} className={`text-[11px] ${msg.erro ? "text-red-300" : "text-g-muted"}`}>{msg.txt}</div>}
    </div>
  );
}
export function BotaoJuntar({ onClick }) {
  return <button type="button" onClick={onClick} className="rounded-full border border-white/15 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word hover:bg-white/[0.06]">{t("mergeWith")}</button>;
}
