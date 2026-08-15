/* Públicos de anúncio.
   ─────────────────────────────────────────────────────────────────────────────
   O QUE ESTA TELA ERA ATÉ 2026-08-11: recebia só `{V, onNav}` — nunca sessão, nunca
   chave — e por isso o cliente pagante via os MESMOS públicos inventados que a demo:
   "Clientes VIP · 4.812 pessoas alcançáveis", tamanhos gerados por `vnum()` a partir
   do nome do negócio. E dois botões:
     · "Sync to ads"        → toast "sincronizado com o Meta Ads ✓". Nada foi sincronizado.
     · "Use in a campaign"  → gravava uma campanha falsa no localStorage.
   Um público de anúncio é uma decisão de ONDE PÔR DINHEIRO. Tamanho inventado faz o
   dono (ou a nossa própria equipe) planejar verba em cima de gente que não existe, e
   "sincronizado ✓" faz ele acreditar que a Meta já tem a lista — quando a plataforma
   nunca recebeu nada.

   O PÚBLICO REAL DA GUILEO JÁ EXISTE e é melhor que qualquer segmento inventado: a
   SEMENTE da aba Anúncios (`/api/ads` action `reinvestir`) devolve o hash SHA-256 de
   quem REALMENTE agendou — o formato que Meta e Google esperam para Custom Audience /
   Customer Match. Em modo real esta aba manda para lá em vez de fingir ter uma lista
   própria. O showcase segue vivo na demonstração, com selo em cada número. */
import { useState, useEffect } from "react";
import { toast, portalApi, loadDataKey } from "../lib/portalApi.js";
import { Count } from "../lib/ui.jsx";
import { loadCreated, genAudiences, pushCreated, Card, tr, Empty, SectionSkeleton, UI_LANG } from "../pages/Portal.jsx";

const t = (o) => o[UI_LANG] || o.en;

// ── MODO REAL ────────────────────────────────────────────────────────────────
// Sem motor próprio de segmentação publicitária hoje, a resposta honesta não é uma
// lista vazia com cara de "você não tem públicos": é dizer onde está o público que
// EXISTE e vale mais — os compradores de verdade.
function RealAudiences({ onNav }) {
  return (
    <div className="space-y-4 stagger">
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.08] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          🎯 {t({ en: "Ad audiences", pt: "Públicos de anúncio", es: "Públicos de anuncio", hi: "विज्ञापन ऑडियंस" })}
          <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]">
            <span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />
            {t({ en: "LIVE — your account", pt: "AO VIVO — sua conta", es: "EN VIVO — tu cuenta", hi: "लाइव — आपका खाता" })}
          </span>
        </div>
        <div className="mt-1 text-xl font-black text-g-word">
          {t({ en: "Aim at people like the ones who already bought.", pt: "Mire em gente parecida com quem já comprou.", es: "Apunta a gente parecida a quien ya compró.", hi: "उन जैसे लोगों को निशाना बनाएँ जिन्होंने पहले ही खरीदा।" })}
        </div>
      </div>

      <Card>
        <div className="text-sm font-bold text-g-word">
          {t({ en: "Your real seed audience lives in Ads", pt: "Sua semente de público real está em Anúncios", es: "Tu semilla de público real está en Anuncios", hi: "आपकी असली बीज ऑडियंस Ads में है" })}
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-g-muted">
          {t({
            en: "Guileo doesn't invent segments. It builds ONE audience with real backing: the people who actually booked and paid, exported as SHA-256 hashes — exactly the format Meta (Custom Audience) and Google (Customer Match) expect. Upload it and create a lookalike from it: instead of aiming at \"interested in spa\", you aim at people like the ones who already bought. Contacts never leave in plain text.",
            pt: "A Guileo não inventa segmentos. Ela monta UM público com lastro: as pessoas que realmente agendaram e pagaram, exportadas como hash SHA-256 — exatamente o formato que a Meta (Custom Audience) e o Google (Customer Match) esperam. Suba e crie um público semelhante a partir dele: em vez de mirar \"interesse em spa\", você mira gente parecida com quem já comprou. Contato nenhum sai em texto puro.",
            es: "Guileo no inventa segmentos. Construye UN público con respaldo: las personas que realmente reservaron y pagaron, exportadas como hash SHA-256 — el formato que Meta (Custom Audience) y Google (Customer Match) esperan. Súbelo y crea un público similar: en vez de apuntar a \"interés en spa\", apuntas a gente parecida a quien ya compró.",
            hi: "Guileo सेगमेंट नहीं गढ़ती। वह एक ऐसा ऑडियंस बनाती है जिसका आधार असली है: वे लोग जिन्होंने सचमुच बुकिंग और भुगतान किया, SHA-256 हैश के रूप में — ठीक वही प्रारूप जो Meta और Google चाहते हैं। संपर्क कभी सादे टेक्स्ट में बाहर नहीं जाते।" })}
        </p>
        <button onClick={() => onNav?.("ads")}
          className="mt-3 inline-flex items-center justify-center gap-1 rounded-full border border-[#FF8A33]/40 bg-[#FF8A33]/[0.10] px-4 py-2 text-xs font-bold text-[#FF8A33] hover:bg-[#FF8A33]/[0.18] transition">
          {t({ en: "Open Ads → Seed audience", pt: "Abrir Anúncios → Semente de público", es: "Abrir Anuncios → Semilla de público", hi: "Ads खोलें → बीज ऑडियंस" })}
        </button>
      </Card>

      <Card>
        <div className="text-sm font-bold text-g-word">
          {t({ en: "Why there's no list of segments here", pt: "Por que não há uma lista de segmentos aqui", es: "Por qué no hay una lista de segmentos aquí", hi: "यहाँ सेगमेंट की सूची क्यों नहीं है" })}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-g-muted">
          {t({
            en: "Guileo has no live connection to your Meta or Google ad account yet, so it cannot push an audience to them or read one back. A screen showing sizes and a \"synced ✓\" button would be inventing both. When the connection is approved, your real segments appear here — and the button will actually sync.",
            pt: "A Guileo ainda não tem conexão ativa com sua conta de anúncios na Meta ou no Google, então não consegue enviar nem ler um público lá. Uma tela com tamanhos e um botão \"sincronizado ✓\" estaria inventando os dois. Quando a conexão for aprovada, seus segmentos reais aparecem aqui — e o botão vai sincronizar de verdade.",
            es: "Guileo aún no tiene conexión activa con tu cuenta de anuncios en Meta o Google, así que no puede enviar ni leer un público. Una pantalla con tamaños y un botón \"sincronizado ✓\" estaría inventando ambos. Cuando se apruebe la conexión, tus segmentos reales aparecerán aquí.",
            hi: "Guileo का आपके Meta या Google विज्ञापन खाते से अभी सक्रिय कनेक्शन नहीं है, इसलिए वह वहाँ ऑडियंस भेज या पढ़ नहीं सकती। आकार और \"सिंक ✓\" बटन वाली स्क्रीन दोनों गढ़ रही होती। स्वीकृति के बाद आपके असली सेगमेंट यहाँ दिखेंगे।" })}
        </p>
      </Card>
    </div>
  );
}

// ── MODO DEMONSTRAÇÃO ───────────────────────────────────────────────────────
function DemoAudiences({ V, onNav }) {
  const rows = [...loadCreated(V.label, "audiences"), ...(V.audiences || genAudiences(V))];
  const ex = t({ en: "EXAMPLE", pt: "EXEMPLO", es: "EJEMPLO", hi: "उदाहरण" });
  const demoNote = t({ en: "Sample tour — nothing was synced. Connect your account to work with real audiences.", pt: "Roteiro de exemplo — nada foi sincronizado. Conecte sua conta para trabalhar com públicos reais.", es: "Recorrido de ejemplo — no se sincronizó nada. Conecta tu cuenta para públicos reales.", hi: "नमूना — कुछ भी सिंक नहीं हुआ। असली ऑडियंस के लिए खाता कनेक्ट करें।" });
  const launch = (a) => {
    pushCreated(V.label, "campaigns", { name: `Campaign · ${a.name}`, channel: a.source === "Meta" ? "Meta" : a.source === "Google" ? "Google" : "Email", sent: 0, opened: 0, revenue: 0, status: "Active" });
    toast(demoNote);
    onNav?.("campaigns");
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl2 border border-g-gold/40 bg-g-gold/10 px-4 py-3">
        <div className="text-[11px] font-black uppercase tracking-widest text-g-gold">
          {t({ en: "Example · not your data", pt: "Exemplo · não são seus dados", es: "Ejemplo · no son tus datos", hi: "उदाहरण · यह आपका डेटा नहीं" })}
        </div>
        <div className="mt-0.5 text-sm text-g-word">
          {t({ en: "These audience sizes are illustrative. No list here has been sent to any ad platform.", pt: "Estes tamanhos de público são ilustrativos. Nenhuma lista aqui foi enviada a plataforma de anúncio nenhuma.", es: "Estos tamaños son ilustrativos. Ninguna lista fue enviada a plataforma alguna.", hi: "ये आकार केवल उदाहरण हैं। यहाँ कोई सूची किसी विज्ञापन प्लेटफ़ॉर्म को नहीं भेजी गई।" })}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {rows.map((a, i) => (
          <Card key={i} className="flex flex-col">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-g-word flex items-center gap-1.5">{a.name}{a.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("new")}</span>}</div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-g-muted">{a.source}</span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-g-word"><Count to={a.size} /> <span className="text-[9px] font-black tracking-widest text-g-gold align-middle">{ex}</span></div>
            <div className="text-[11px] text-g-muted">{t({ en: "people reachable", pt: "pessoas alcançáveis", es: "personas alcanzables", hi: "पहुँच योग्य लोग" })}</div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => toast(demoNote)} className="text-[11px] font-bold rounded-full border border-g-gold/35 bg-g-gold/[0.08] px-3 py-1.5 text-g-gold hover:bg-g-gold/[0.16] transition">{tr("Sync to ads")}</button>
              <button onClick={() => launch(a)} className="text-[11px] font-bold rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-g-word hover:border-g-gold/40 transition">{t({ en: "Use in a campaign →", pt: "Usar numa campanha →", es: "Usar en una campaña →", hi: "अभियान में उपयोग →" })}</button>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <div className="sm:col-span-2"><Card><Empty icon="🎯" text={tr("No audiences built yet — your AI segments customers automatically as data grows.")} /></Card></div>}
      </div>
    </div>
  );
}

function Audiences({ V, onNav, real: realProp = null, email: emailProp = "", dataKey: dataKeyProp = "" }) {
  // Portal.jsx passa só {V, onNav} — a aba resolve a sessão sozinha (padrão de Campaigns.jsx).
  const [sess, setSess] = useState(realProp != null ? null : undefined);
  useEffect(() => {
    if (realProp != null) return;
    let alive = true;
    portalApi.session().then((s) => { if (alive) setSess(s || null); }).catch(() => { if (alive) setSess(null); });
    return () => { alive = false; };
  }, [realProp]);
  const email = (emailProp || sess?.email || "").toString().trim().toLowerCase();
  const dataKey = dataKeyProp || loadDataKey();
  if (realProp == null && sess === undefined) return <SectionSkeleton rows={4} />;
  const live = !!(email && dataKey && (realProp != null || sess?.demo !== true));
  return live ? <RealAudiences onNav={onNav} /> : <DemoAudiences V={V} onNav={onNav} />;
}

export default Audiences;
