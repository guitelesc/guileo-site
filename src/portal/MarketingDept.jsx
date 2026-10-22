/* Marketing (departamento) — segmentos + campanhas do cliente.
   ─────────────────────────────────────────────────────────────────────────────
   O DEFEITO QUE ESTA VERSÃO CORRIGE (2026-08-11): os seis botões de segmento
   ("Todos", "Leads", "Clientes", "VIPs", "Inativos", "Em risco") faziam UMA coisa:
   `toast("Campaign drafted for X ✓")`. Nenhum POST, nenhum rascunho, nada gravado.
   O texto acima deles prometia "escolha um público — a Gui redige e envia por SMS,
   WhatsApp e e-mail". Um cliente pagante clicava, lia o ✓ verde, e ia embora
   acreditando que uma campanha existia. Botão sem motor + sucesso sem comprovante,
   na mesma linha.

   AGORA cada botão chama um motor que EXISTE: `/api/crm` action `segment_count`
   devolve quantos contatos reais aquele segmento tem hoje. O clique responde com o
   número com lastro (ou "não deu para contar", jamais 0 disfarçando falha) e abre o
   compositor de verdade, onde a campanha é realmente escrita e enviada. Contar antes
   de enviar é também a ordem certa: ninguém deve disparar para um público sem saber
   seu tamanho.

   A lista de campanhas passou a distinguir FALHA de VAZIO: `fetchCrmCampaigns`
   devolvia `[]` tanto para "nenhuma campanha" quanto para 401/erro de rede, e a tela
   dizia "Nenhuma campanha ainda" para quem só tinha perdido a sessão. */
import { useState, useCallback, useEffect } from "react";
import { fetchCrmCampaignsDetalhado } from "../lib/portalApi.js";
import { SectionSkeleton, tr, DeptTabs, Card, Empty, UI_LANG } from "../pages/Portal.jsx";
import FalhaDeLeitura from "./FalhaDeLeitura.jsx";

const t = (o) => o[UI_LANG] || o.en;

function MarketingDept({ V, onNav, email = "", dataKey = "" }) {
  const demo = !dataKey;
  const [campaigns, setCampaigns] = useState([]);
  const [state, setState] = useState(demo ? "ok" : "loading");
  const [falha, setFalha] = useState(null);    // motivo da falha de leitura
  const [seg, setSeg] = useState(null);        // { key, label, count|null, err }
  const [counting, setCounting] = useState("");
  const load = useCallback(() => {
    setState("loading");
    // 🚨 (2026-09-28) O `if (d === null)` que morava aqui NUNCA era verdadeiro: o leitor antigo
    // devolve `[]` em toda falha, então a promessa do cabeçalho deste arquivo ("distingue FALHA de
    // VAZIO") não estava cumprida — 401 e wifi caído seguiam mostrando "No campaigns yet".
    // O leitor detalhado devolve o motivo; agora o estado "err" é alcançável.
    setFalha(null);
    fetchCrmCampaignsDetalhado(dataKey, email).then((r) => {
      if (r.motivo) { setFalha(r.motivo); setState("err"); return; }
      setCampaigns((r.data || []).filter(Boolean)); setState("ok");
    });
  }, [dataKey, email]);
  useEffect(() => {
    if (demo) {
      setCampaigns([
        { id: "c1", name: "Win back lapsed clients", channel: "sms", segment: "lapsed", status: "sent", audience_count: 128, sent_count: 128 },
        { id: "c2", name: "VIP early access", channel: "whatsapp", segment: "vip", status: "scheduled", audience_count: 18, sent_count: 0 },
        { id: "c3", name: "New-lead nurture", channel: "sms", segment: "lead", status: "draft", audience_count: 42, sent_count: 0 },
      ]); setState("ok"); return;
    }
    load();
  }, [demo, dataKey, email, load]); // eslint-disable-line react-hooks/exhaustive-deps

  // CONTAR O SEGMENTO DE VERDADE. `ready:false` (SQL de marketing ainda não aplicado) e
  // erro de rede NÃO viram "0 contatos" — viram "não deu para contar", que é a verdade.
  const countSegment = async (key, label) => {
    if (demo) { setSeg({ key, label, count: null, demoNote: true }); return; }
    setCounting(key); setSeg(null);
    try {
      const r = await fetch("/api/crm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "segment_count", token: dataKey, email, segment: key }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d?.ok === false || d?.ready === false) setSeg({ key, label, count: null, err: true });
      else setSeg({ key, label, count: Number(d.count) || 0 });
    } catch { setSeg({ key, label, count: null, err: true }); }
    setCounting("");
  };

  if (state === "loading") return <SectionSkeleton />;
  if (state === "err") return <FalhaDeLeitura motivo={falha} onRetry={load} titulo={tr("I couldn't load your campaigns just now.")} />;
  const SEGMENTS = [["all", tr("Everyone")], ["lead", tr("Leads")], ["customer", tr("Customers")], ["vip", tr("VIPs")], ["lapsed", tr("Lapsed")], ["at_risk", tr("At risk")]];
  const chColor = (c) => c === "whatsapp" ? "#25D366" : c === "email" ? "#D6C29A" : "#3E9468";
  const stColor = (s) => s === "sent" ? "#3E9468" : s === "scheduled" ? "#D6C29A" : "#9AA0A6";
  return (
    <div className="space-y-4 stagger">
      <DeptTabs cur="marketing" onNav={onNav} items={[["marketing", "Marketing"], ["campaigns", "Campaigns"], ["audiences", "Ad Audiences"]]} />

      {demo && (
        <div className="rounded-xl2 border border-g-gold/40 bg-g-gold/10 px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {t({ en: "Example · not your data — connect your account to see your real segments and campaigns.", pt: "Exemplo · não são seus dados — conecte sua conta para ver seus segmentos e campanhas reais.", es: "Ejemplo · no son tus datos — conecta tu cuenta para ver tus segmentos y campañas reales.", hi: "उदाहरण · यह आपका डेटा नहीं — असली सेगमेंट देखने के लिए खाता कनेक्ट करें।" })}
        </div>
      )}

      <Card className="border-g-gold/25 bg-g-gold/[0.05]">
        <div className="text-sm font-extrabold text-g-word">📣 {t({ en: "How many people are in each segment?", pt: "Quantas pessoas há em cada segmento?", es: "¿Cuánta gente hay en cada segmento?", hi: "हर सेगमेंट में कितने लोग हैं?" })}</div>
        <div className="text-xs text-g-muted mt-0.5">
          {t({ en: "Tap a segment to count it against your real contacts — then write and send the campaign in the composer.", pt: "Toque num segmento para contá-lo nos seus contatos reais — depois escreva e envie a campanha no compositor.", es: "Toca un segmento para contarlo con tus contactos reales — luego escribe y envía la campaña en el compositor.", hi: "असली संपर्कों में गिनने के लिए सेगमेंट पर टैप करें — फिर कंपोज़र में अभियान लिखें और भेजें।" })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SEGMENTS.map(([k, label]) => (
            <button key={k} onClick={() => countSegment(k, label)} disabled={counting === k}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[12.5px] text-g-ink hover:border-g-gold/40 hover:text-g-word transition disabled:opacity-50">
              {counting === k ? "…" : label}
            </button>
          ))}
        </div>
        {seg && (
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3">
            <div className="text-sm font-bold text-g-word">
              {seg.label}: {seg.count == null ? "—" : <span className="num">{seg.count.toLocaleString()}</span>}{" "}
              <span className="font-normal text-g-muted text-[12px]">
                {seg.count == null ? "" : t({ en: "contacts", pt: "contatos", es: "contactos", hi: "संपर्क" })}
              </span>
            </div>
            {/* Três estados, nunca dois: contado · demonstração · não deu para contar. */}
            {seg.demoNote && <div className="mt-1 text-[11px] text-g-gold font-bold">{t({ en: "Sample screen — connect your account to count your real contacts.", pt: "Tela de exemplo — conecte sua conta para contar seus contatos reais.", es: "Pantalla de ejemplo — conecta tu cuenta para contar contactos reales.", hi: "नमूना स्क्रीन — असली संपर्क गिनने के लिए खाता कनेक्ट करें।" })}</div>}
            {seg.err && <div className="mt-1 text-[11px] font-bold" style={{ color: "#E2533F" }}>{t({ en: "I couldn't count this segment right now — that's a connection/activation problem, not an empty segment.", pt: "Não consegui contar este segmento agora — isso é falha de conexão/ativação, não segmento vazio.", es: "No pude contar este segmento ahora — es un problema de conexión/activación, no un segmento vacío.", hi: "अभी यह सेगमेंट गिन नहीं सका — यह कनेक्शन/सक्रियण की समस्या है, खाली सेगमेंट नहीं।" })}</div>}
            {seg.count > 0 && (
              <button onClick={() => onNav?.("coupons")} className="mt-2 text-[11px] font-bold text-g-gold hover:underline">
                {t({ en: "Write the campaign →", pt: "Escrever a campanha →", es: "Escribir la campaña →", hi: "अभियान लिखें →" })}
              </button>
            )}
          </div>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Campaigns")}</span></div>
        <div className="divide-y divide-white/[0.06]">
          {campaigns.length ? campaigns.map((c, i) => (
            <div key={c.id || i} className="flex items-center gap-3 px-5 py-3">
              <span className="grid place-items-center h-9 w-9 rounded-full text-white text-[11px] font-black shrink-0" style={{ background: chColor(c.channel) }}>{(c.channel || "sms").slice(0, 2).toUpperCase()}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name}</div><div className="text-[11px] text-g-muted truncate">{tr("Segment")}: {c.segment} · {c.audience_count || 0} {tr("contacts")}</div></div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: stColor(c.status) + "22", color: stColor(c.status) }}>{tr(c.status || "draft")}</span>
            </div>
          )) : <Empty icon="📣" text={demo ? tr("Launch a campaign to a segment and it shows up here with its audience and status.") : tr("No campaigns yet — pick a segment above to launch your first.")} />}
        </div>
      </Card>
    </div>
  );
}

export default MarketingDept;
