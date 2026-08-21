/* Reputação — o que os clientes DO CLIENTE dizem sobre ele.
   ─────────────────────────────────────────────────────────────────────────────
   O QUE ESTA TELA ERA ATÉ 2026-08-11 (e por que precisava mudar):
   ela recebia apenas `{V, onNav}` — nunca sessão, nunca chave de conexão — e por
   isso mostrava a MESMA tela para um cliente pagante e para um visitante da demo:
   nota média, "87 avaliações este mês", "312 pedidos enviados", "31% de conversão"
   e uma distribuição 78/15/4/2/1 — todos gerados por `vnum(V.label, …)`, ou seja,
   derivados do NOME do negócio. Números plausíveis, estáveis entre recargas (o que
   os faz parecer reais) e sem um único byte de lastro.

   Pior que os números eram os botões. Quatro deles diziam ter feito algo:
     · "Request reviews now"  → gravava no localStorage e dizia "os pedidos estão a
                                caminho dos seus clientes recentes". Nada saiu.
     · "Reply / thank"        → "uma resposta calorosa foi publicada". Não foi.
     · "Share"                → "compartilhei nas suas redes". Não compartilhou.
     · "Boost as ad"          → criava uma campanha FALSA no localStorage, que
                                reaparecia na aba Campanhas como se existisse.
   Um dono de salão que abrisse esta aba concluiria que a reputação dele está sendo
   cuidada. É a categoria de defeito mais cara que existe num produto vendido como
   agência: não quebra o build, não aparece em log nenhum, e destrói a confiança no
   dia em que o cliente confere no Google e não acha nada.

   A REGRA AGORA: em modo real, nenhum número sem lastro. A única fonte de verdade
   de avaliação que a plataforma tem hoje é o Perfil do Google (`/api/google-business`),
   e ele só responde quando a API do Google estiver aprovada para este projeto. Então
   a tela tem TRÊS estados, não dois: ligada (lê e mostra), conectada-mas-aguardando
   (diz isso), e NÃO DEU PARA VERIFICAR (falha de rede/permissão — que nunca pode ser
   apresentada como "você não tem avaliações").
   O showcase antigo continua vivo para a demonstração — com selo, em cada número. */
import { useState, useEffect } from "react";
import NoSeuPlano from "./NoSeuPlano.jsx";
import { portalApi, loadDataKey, toast } from "../lib/portalApi.js";
import { genReviews, loadCreated, genCustomers, pushCreated, MiniStats, vnum, Card, tr, Drawer, Empty, SectionSkeleton, UI_LANG } from "../pages/Portal.jsx";

// i18n local — os dicionários globais são de outro dono; a aba não deve depender de
// um patch alheio para falar a língua do cliente (mesmo padrão de GoogleHub/SocialHub).
const t = (o) => o[UI_LANG] || o.en;
// A demonstração nunca diz "enviado ✓" — diz que é demonstração.
const toastDemo = (m) => toast(m);

async function gbp(body) {
  try {
    const r = await fetch("/api/google-business", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    // O veredito viaja com a resposta: um 401/500 JAMAIS pode parecer "zero avaliações".
    return { ...(d && typeof d === "object" ? d : {}), _ok: r.ok && d?.ok !== false };
  } catch { return { _ok: false }; }
}

// ── MODO REAL ────────────────────────────────────────────────────────────────
// Só mostra o que o Google devolveu. Sem avaliação lida, os números são "—" (não 0):
// "nota 0" e "não consegui ler" são estados opostos, e o primeiro é uma acusação.
function RealReputation({ email, dataKey, onNav }) {
  const [S, setS] = useState(null); // null = carregando

  useEffect(() => {
    let alive = true;
    (async () => {
      const st = await gbp({ action: "status", email, token: dataKey });
      if (!alive) return;
      if (!st._ok) { setS({ err: true }); return; }
      const connected = !!st.connected, apiReady = !!st.ready;
      let reviews = null, revErr = false;
      if (connected && apiReady) {
        const rv = await gbp({ action: "list_reviews", email, token: dataKey });
        if (!alive) return;
        if (rv._ok && Array.isArray(rv.reviews)) reviews = rv.reviews;
        else revErr = true;
      }
      setS({ connected, apiReady, reviews, revErr });
    })();
    return () => { alive = false; };
  }, [email, dataKey]);

  if (S === null) return <SectionSkeleton rows={5} />;

  const list = Array.isArray(S.reviews) ? S.reviews : [];
  const stars = list.map((r) => Number(r.stars || r.rating || 0)).filter((n) => n > 0);
  const avg = stars.length ? (stars.reduce((a, b) => a + b, 0) / stars.length).toFixed(1) : null;
  // Distribuição só existe se houver avaliação lida. Antes era 78/15/4/2/1 cravado no código.
  const dist = [5, 4, 3, 2, 1].map((n) => [n, stars.length ? Math.round((stars.filter((s) => s === n).length / stars.length) * 100) : null]);

  const banner = S.err
    ? ["#E2533F", t({
        en: "Couldn't check your Google profile just now — this is a connection problem on our side, not a statement about your reviews.",
        pt: "Não consegui verificar seu Perfil do Google agora — isso é falha de conexão do nosso lado, não uma afirmação sobre suas avaliações.",
        es: "No pude verificar tu Perfil de Google ahora — es un problema de conexión de nuestro lado, no una afirmación sobre tus reseñas.",
        hi: "अभी आपकी Google प्रोफ़ाइल जाँच नहीं सका — यह हमारी ओर की कनेक्शन समस्या है, आपकी समीक्षाओं के बारे में दावा नहीं।" })]
    : !S.connected
      ? ["#C8A24A", t({
          en: "Your Google profile isn't linked yet — that's where your reviews live. Link it on the Google tab and they show up here.",
          pt: "Seu Perfil do Google ainda não está conectado — é lá que ficam suas avaliações. Conecte na aba Google e elas aparecem aqui.",
          es: "Tu Perfil de Google aún no está enlazado — ahí viven tus reseñas. Enlázalo en la pestaña Google y aparecerán aquí.",
          hi: "आपकी Google प्रोफ़ाइल अभी जुड़ी नहीं — समीक्षाएँ वहीं रहती हैं। Google टैब में जोड़ें और वे यहाँ दिखेंगी।" })]
      : !S.apiReady
        ? ["#C8A24A", t({
            en: "Profile linked · reading reviews switches on the moment Google approves the API. Until then we show nothing rather than guess.",
            pt: "Perfil conectado · a leitura das avaliações liga assim que o Google aprovar a API. Até lá não mostramos nada em vez de chutar.",
            es: "Perfil enlazado · la lectura de reseñas se activa cuando Google apruebe la API. Hasta entonces no mostramos nada en vez de adivinar.",
            hi: "प्रोफ़ाइल जुड़ी · Google API स्वीकृति मिलते ही समीक्षाएँ पढ़ना चालू। तब तक अनुमान के बजाय कुछ नहीं दिखाते।" })]
        : S.revErr
          ? ["#E2533F", t({
              en: "Couldn't load your reviews just now — connection problem, not an empty profile.",
              pt: "Não consegui carregar suas avaliações agora — falha de conexão, não perfil vazio.",
              es: "No pude cargar tus reseñas ahora — problema de conexión, no un perfil vacío.",
              hi: "अभी समीक्षाएँ लोड नहीं हो सकीं — कनेक्शन की समस्या, खाली प्रोफ़ाइल नहीं।" })]
          : null;

  return (
    <div className="space-y-4 stagger">
      <div className="rounded-2xl border border-[#FFC23D]/25 bg-gradient-to-br from-[#FFC23D]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FFC23D" }}>
          ⭐ {t({ en: "Reputation", pt: "Reputação", es: "Reputación", hi: "प्रतिष्ठा" })}
          <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]">
            <span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />
            {t({ en: "LIVE — your account", pt: "AO VIVO — sua conta", es: "EN VIVO — tu cuenta", hi: "लाइव — आपका खाता" })}
          </span>
        </div>
        <div className="mt-1 text-xl font-black text-g-word">
          {t({ en: "What your customers say about you.", pt: "O que seus clientes dizem de você.", es: "Lo que tus clientes dicen de ti.", hi: "आपके ग्राहक आपके बारे में क्या कहते हैं।" })}
        </div>
      </div>

      {banner && (
        <div className="rounded-xl2 px-4 py-3 text-[11.5px] leading-snug"
          style={{ color: banner[0], background: banner[0] + "12", border: `1px solid ${banner[0]}40` }}>
          {banner[1]}
          <button onClick={() => onNav?.("googlehub")} className="ml-1 font-black underline">
            {t({ en: "Open Google →", pt: "Abrir Google →", es: "Abrir Google →", hi: "Google खोलें →" })}
          </button>
        </div>
      )}

      {/* Números com lastro OU traço. Nunca zero por falta de leitura. */}
      <MiniStats items={[
        [t({ en: "Avg rating", pt: "Nota média", es: "Nota media", hi: "औसत रेटिंग" }), avg ? `${avg} ★` : "—", avg && Number(avg) >= 4 ? "good" : undefined],
        [t({ en: "Reviews read", pt: "Avaliações lidas", es: "Reseñas leídas", hi: "पढ़ी गई समीक्षाएँ" }), list.length ? `${list.length}` : "—"],
        [t({ en: "Replied", pt: "Respondidas", es: "Respondidas", hi: "जवाब दी गईं" }), list.length ? `${list.filter((r) => r.replied || r.reply).length}` : "—"],
      ]} />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">
            {t({ en: "Rating breakdown", pt: "Distribuição das notas", es: "Distribución de notas", hi: "रेटिंग वितरण" })}
          </div>
          {dist.map(([n, v]) => (
            <div key={n} className="mb-2 last:mb-0 flex items-center gap-2">
              <span className="text-xs text-g-muted w-8">{n}★</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-g-gold to-g-green" style={{ width: `${v || 0}%` }} />
              </div>
              <span className="text-[11px] text-g-muted w-8 text-right">{v == null ? "—" : `${v}%`}</span>
            </div>
          ))}
          {/* O pedido de avaliação É real — mas roda sozinho no servidor, depois da visita
              (SERVER_AUTOMATIONS). O botão antigo dizia estar disparando e não disparava nada. */}
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2.5 text-[11px] text-g-muted leading-snug">
            {t({
              en: "Gui asks for a review automatically after each visit — once per visit, with your review link. There's nothing to fire by hand here.",
              pt: "A Gui pede a avaliação automaticamente depois de cada visita — uma vez por visita, com o seu link. Não há nada para disparar à mão aqui.",
              es: "Gui pide la reseña automáticamente después de cada visita — una vez por visita, con tu enlace. No hay nada que disparar a mano.",
              hi: "हर विज़िट के बाद Gui अपने-आप समीक्षा माँगती है — प्रति विज़िट एक बार, आपके लिंक के साथ। यहाँ हाथ से कुछ भेजना नहीं है।" })}
          </div>
        </Card>

        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">
            {t({ en: "Your reviews", pt: "Suas avaliações", es: "Tus reseñas", hi: "आपकी समीक्षाएँ" })}
          </div>
          {list.length === 0 ? (
            <Empty icon={S.err || S.revErr ? "⚠️" : "⭐"} text={
              S.err || S.revErr
                ? t({ en: "Couldn't read your reviews — connection problem, not an empty profile.", pt: "Não consegui ler suas avaliações — falha de conexão, não perfil vazio.", es: "No pude leer tus reseñas — problema de conexión, no un perfil vacío.", hi: "समीक्षाएँ नहीं पढ़ सका — कनेक्शन की समस्या।" })
                : t({ en: "No reviews synced yet — they appear here the moment your Google profile is reading.", pt: "Nenhuma avaliação sincronizada ainda — elas aparecem aqui assim que seu Perfil do Google estiver lendo.", es: "Aún no hay reseñas sincronizadas — aparecerán cuando tu Perfil de Google esté leyendo.", hi: "अभी कोई समीक्षा नहीं — Google प्रोफ़ाइल पढ़ना शुरू करते ही यहाँ दिखेंगी।" })} />
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {list.map((r, i) => {
                const st = Number(r.stars || r.rating || 0);
                return (
                  <div key={r.id || i} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-g-word truncate">{r.name || r.reviewer || "—"}</span>
                      <span className="text-xs text-g-gold shrink-0">{"★".repeat(st)}<span className="text-g-muted">{"★".repeat(Math.max(0, 5 - st))}</span></span>
                    </div>
                    {(r.text || r.comment) && <div className="text-[12px] text-g-muted mt-0.5 leading-snug">"{r.text || r.comment}"</div>}
                    <div className="mt-1 text-[10px] font-bold" style={{ color: r.replied || r.reply ? "#3E9468" : "#9A8F82" }}>
                      {r.replied || r.reply
                        ? t({ en: "✓ Gui replied", pt: "✓ a Gui respondeu", es: "✓ Gui respondió", hi: "✓ Gui ने जवाब दिया" })
                        : t({ en: "· awaiting reply", pt: "· aguardando resposta", es: "· esperando resposta", hi: "· जवाब बाकी" })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── MODO DEMONSTRAÇÃO ────────────────────────────────────────────────────────
// O showcase antigo, intacto — mas com selo em cima e a palavra EXEMPLO ao lado de
// cada número. A régua: dado inventado só é aceitável quando é IMPOSSÍVEL confundir
// com real. As ações continuam sendo o roteiro da demonstração e dizem isso.
function DemoReputation({ V, onNav }) {
  const reviews = genReviews(V);
  const dist = [["5★", 78], ["4★", 15], ["3★", 4], ["2★", 2], ["1★", 1]];
  const [sel, setSel] = useState(null);
  const [reqs, setReqs] = useState(() => loadCreated(V.label, "reviewreq"));
  useEffect(() => { setReqs(loadCreated(V.label, "reviewreq")); }, [V.label]);
  const ex = t({ en: "EXAMPLE", pt: "EXEMPLO", es: "EJEMPLO", hi: "उदाहरण" });
  const blast = () => {
    (V.customers || genCustomers(V)).slice(0, 3).forEach((c) => pushCreated(V.label, "reviewreq", { name: c.name, ch: c.channel }));
    setReqs(loadCreated(V.label, "reviewreq"));
    // Demonstração NÃO diz que enviou. Diz que é demonstração.
    toastDemo(t({ en: "Sample tour — nothing was actually sent. Connect your account to run this for real.", pt: "Roteiro de exemplo — nada foi enviado de verdade. Conecte sua conta para valer.", es: "Recorrido de ejemplo — no se envió nada. Conecta tu cuenta para hacerlo real.", hi: "नमूना — कुछ भी वास्तव में नहीं भेजा गया। असली के लिए खाता कनेक्ट करें।" }));
  };
  const boost = (r) => {
    pushCreated(V.label, "campaigns", { name: `⭐ ${r.name}'s ${r.stars}★ review → ad`, channel: r.ch || "Meta", sent: 0, opened: 0, revenue: 0, status: "Active" });
    setSel(null);
    toastDemo(t({ en: "Sample tour — this ad exists only in the demo.", pt: "Roteiro de exemplo — este anúncio só existe na demonstração.", es: "Recorrido de ejemplo — este anuncio solo existe en la demo.", hi: "नमूना — यह विज्ञापन केवल डेमो में है।" }));
    onNav?.("campaigns");
  };
  return (
    <div className="space-y-4 stagger">
      <div className="rounded-xl2 border border-g-gold/40 bg-g-gold/10 px-4 py-3">
        <div className="text-[11px] font-black uppercase tracking-widest text-g-gold">
          {t({ en: "Example · not your data", pt: "Exemplo · não são seus dados", es: "Ejemplo · no son tus datos", hi: "उदाहरण · यह आपका डेटा नहीं" })}
        </div>
        <div className="mt-0.5 text-sm text-g-word">
          {t({ en: "These numbers show how the screen looks once your Google profile is connected. Nothing here is a real review of your business.", pt: "Estes números ilustram como a tela fica quando seu Perfil do Google estiver conectado. Nada aqui é avaliação real do seu negócio.", es: "Estos números ilustran cómo se ve la pantalla con tu Perfil de Google conectado. Nada aquí es una reseña real.", hi: "ये आंकड़े दिखाते हैं कि Google प्रोफ़ाइल जुड़ने पर स्क्रीन कैसी दिखेगी। यहाँ कुछ भी असली समीक्षा नहीं है।" })}
        </div>
      </div>
      <MiniStats items={[
        [`${t({ en: "Avg rating", pt: "Nota média", es: "Nota media", hi: "औसत रेटिंग" })} · ${ex}`, `${((46 + vnum(V.label, "rate", 0, 3)) / 10).toFixed(1)} ★`, "good"],
        [`${t({ en: "Reviews this month", pt: "Avaliações no mês", es: "Reseñas del mes", hi: "इस माह समीक्षाएँ" })} · ${ex}`, `${vnum(V.label, "revc", 40, 140)}`, "good"],
        [`${t({ en: "Requests sent", pt: "Pedidos enviados", es: "Solicitudes enviadas", hi: "भेजे गए अनुरोध" })} · ${ex}`, `${vnum(V.label, "reqs", 200, 420) + reqs.length}`],
        [`${t({ en: "Request → review", pt: "Pedido → avaliação", es: "Solicitud → reseña", hi: "अनुरोध → समीक्षा" })} · ${ex}`, `${vnum(V.label, "conv", 24, 38)}%`, "good"],
      ]} />
      {reqs.length > 0 && (
        <Card className="border-g-gold/25 bg-g-gold/[0.05]">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-2">{tr("⭐ Review requests in flight")} · {ex}</div>
          <div className="flex flex-wrap gap-2">{reqs.map((r, i) => (<span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "#3FB4FF", boxShadow: "0 0 7px rgba(63,180,255,.55)" }} />{r.name} <span className="text-g-muted">· {r.ch || "WhatsApp"} · awaiting</span></span>))}</div>
        </Card>
      )}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Rating breakdown")} · {ex}</div>
          {dist.map(([l, v]) => (<div key={l} className="mb-2 last:mb-0 flex items-center gap-2"><span className="text-xs text-g-muted w-8">{l}</span><div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-gold to-g-green" style={{ width: `${v}%` }} /></div><span className="text-[11px] text-g-muted w-8 text-right">{v}%</span></div>))}
          <button onClick={blast} className="btn-bright text-sm w-full mt-4 justify-center">{tr("Request reviews now")}</button>
        </Card>
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recent reviews · collected by AI")} · {ex}</div>
          <div className="divide-y divide-white/[0.06]">{reviews.map((r, i) => (<button key={i} onClick={() => setSel(r)} className="w-full text-left px-5 py-3 hover:bg-white/[0.04] transition"><div className="flex items-center justify-between"><span className="text-sm font-bold text-g-word">{r.name}</span><span className="text-xs text-g-gold">{"★".repeat(r.stars)}<span className="text-g-muted">{"★".repeat(5 - r.stars)}</span></span></div><div className="text-[12px] text-g-muted mt-0.5">"{r.text}" <span className="text-g-light">· {r.ch}</span></div></button>))}</div>
        </Card>
      </div>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={`${sel.ch} review · ${ex}`}
          badge={<span className="text-xs text-g-gold">{"★".repeat(sel.stars)}</span>}
          fields={[["Rating", `${sel.stars} / 5`], ["Channel", sel.ch], ["Status", ex]]}
          note={<>"{sel.text}"<div className="mt-2 text-g-muted">{tr("The AI requested this review automatically after a great experience.")}</div></>}
          actions={<>{sel.stars >= 4 && <button onClick={() => boost(sel)} className="btn-ghost text-sm">🚀 {tr("Boost as ad")}</button>}</>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

function Reputation({ V, onNav, real: realProp = null, email: emailProp = "", dataKey: dataKeyProp = "" }) {
  // Portal.jsx passa só {V, onNav} para esta aba — então ela resolve a sessão sozinha,
  // exatamente como Campaigns.jsx e SocialInbox.jsx fazem. Sem isso, um cliente pagante
  // via a tela de demonstração como se fosse a reputação dele.
  const [sess, setSess] = useState(realProp != null ? null : undefined);
  useEffect(() => {
    if (realProp != null) return;
    let alive = true;
    portalApi.session().then((s) => { if (alive) setSess(s || null); }).catch(() => { if (alive) setSess(null); });
    return () => { alive = false; };
  }, [realProp]);

  const email = (emailProp || sess?.email || "").toString().trim().toLowerCase();
  const dataKey = dataKeyProp || loadDataKey();
  if (realProp == null && sess === undefined) return <SectionSkeleton rows={5} />;
  const live = !!(email && dataKey && (realProp != null || sess?.demo !== true));
  // O convite de plano entra SÓ no ramo real — em demonstração o cockpit inteiro é vitrine, e
  // dizer "não está no seu plano" para quem não tem plano nenhum é ruído sem sentido.
  return live
    ? (<>
        <NoSeuPlano real={realProp} produto="reputation" />
        <RealReputation email={email} dataKey={dataKey} onNav={onNav} />
      </>)
    : <DemoReputation V={V} onNav={onNav} />;
}

export default Reputation;
