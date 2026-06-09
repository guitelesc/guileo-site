import { useEffect, useMemo } from "react";
import logo from "../assets/guileo-mark.png";
import { waLink } from "../data/contact.js";

// ─────────────────────────────────────────────────────────────────────────────
// /proposta — the close-to-cash bridge. A tailored, print-friendly proposal the
// Growth Partner sends after the pitch. Everything is driven by URL query params,
// so a personalized link is generated in seconds — no admin panel needed:
//
//   /proposta?to=Tony&biz=Tony's Pizza&pkg=Performance + Sales&price=1497
//            &setup=990&credits=440&recover=3900&by=Luis
//            &items=Voice AI 24/7,WhatsApp,Anúncios,Agenda&pay=https://buy.stripe.com/xxxx
//
// `pay` = a Stripe Payment Link the partner creates for THIS price (Luis's action —
// no credential ever touches the code). If absent, "Aceitar e pagar" falls back to
// WhatsApp so the proposal is always actionable.
// ─────────────────────────────────────────────────────────────────────────────

// Optional account-wide default payment link. Leave "" — paste a Stripe Payment
// Link here only if you want a single fixed-price checkout as the fallback.
const DEFAULT_PAY_LINK = "";

const DEFAULT_ITEMS = ["Voice AI agent 24/7", "WhatsApp & SMS AI", "Captura e qualificação de leads", "Follow-up automático", "Anúncios & conteúdo", "Painel Growth Cockpit"];

const money = (v) => "$" + Number(v || 0).toLocaleString("en-US");

export default function Proposta() {
  const p = useMemo(() => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""), []);
  const to = p.get("to") || "";
  const biz = p.get("biz") || "";
  const pkg = p.get("pkg") || "Performance + Sales";
  const price = p.get("price") || "1497";
  const setup = p.get("setup") || "";
  const credits = p.get("credits") || "440";
  const recover = p.get("recover") || "3900";
  const by = p.get("by") || "";
  const items = (p.get("items") ? p.get("items").split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ITEMS);
  const payLink = p.get("pay") || DEFAULT_PAY_LINK;

  // ROI line: if Gui recovers `recover`/mo and costs `price`/mo, show the net.
  const net = Number(recover || 0) - Number(price || 0);

  useEffect(() => { document.title = `Proposta Guileo${to ? " · " + to : ""}`; }, [to]);

  const acceptHref = payLink || waLink(`Oi Guileo! Aceito a proposta${biz ? " da " + biz : ""} (${pkg} · ${money(price)}/mês). Quero começar.`);

  return (
    <div className="surface-real min-h-screen px-5 py-10 text-g-ink sm:py-16">
      <style>{`@media print{.no-print{display:none !important}body{background:#fff}}`}</style>

      <div className="relative z-10 mx-auto max-w-3xl">
        {/* header */}
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-2"><img src={logo} alt="Guileo" className="h-9 w-9 object-contain" /><span className="text-lg font-extrabold text-g-word">Guileo</span></a>
          <div className="text-right text-[11px] font-bold uppercase tracking-wider text-g-muted">
            Proposta comercial<br /><span className="text-g-gold">válida por 7 dias</span>
          </div>
        </div>

        {/* title */}
        <div className="mt-10">
          <div className="text-[12px] font-bold uppercase tracking-[0.22em] text-g-gold">Proposta {to ? `para ${to}` : ""}</div>
          <h1 className="mt-2 font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,4vw,2.6rem)" }}>
            {biz ? <>Um sistema de crescimento sob medida para <span className="text-g-green">{biz}</span>.</> : "Um sistema de crescimento sob medida para o seu negócio."}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-g-ink">
            A Guileo instala um time de IA + marketing que atende, vende e faz crescer o seu negócio sozinho, 24/7. Abaixo, o pacote que desenhamos pra você — e o retorno que ele costuma trazer.
          </p>
        </div>

        {/* the package card */}
        <div className="mt-8 overflow-hidden rounded-xl3 border border-g-gold/30 bg-white/[0.04] shadow-lift">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 bg-g-gold/[0.05] p-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">Seu pacote</div>
              <div className="text-2xl font-black text-g-word">{pkg}</div>
            </div>
            <div className="text-right">
              <div className="text-[34px] font-black leading-none text-g-word">{money(price)}<span className="text-base font-bold text-g-muted">/mês</span></div>
              {setup && <div className="mt-1 text-[12px] text-g-muted">+ {money(setup)} setup único</div>}
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-[1.3fr_1fr]">
            {/* included */}
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-muted">O que está incluído</div>
              <ul className="mt-3 space-y-2">
                {items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-[14px] text-g-word"><span className="text-g-green">✓</span> {it}</li>
                ))}
              </ul>
            </div>
            {/* meters / ROI */}
            <div className="rounded-2xl border border-g-line bg-white/[0.03] p-5">
              <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
                <span className="text-[12px] text-g-muted">Créditos Gui / mês</span>
                <span className="text-lg font-black text-g-word">{Number(credits).toLocaleString()}</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-white/10 py-2">
                <span className="text-[12px] text-g-muted">Recupera tipicamente</span>
                <span className="text-lg font-black text-g-green">{money(recover)}/mês</span>
              </div>
              {net > 0 && (
                <div className="mt-3 rounded-lg bg-g-green/10 p-3 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-g-green">Retorno líquido estimado</div>
                  <div className="text-xl font-black text-g-word">+{money(net)}/mês</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* timeline + guarantee */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[["🌱", "No ar em 7 dias", "Da assinatura ao sistema rodando."], ["🛡️", "Garantia de 30 dias", "Não gostou? Devolvemos."], ["🤝", "Humano com você", "Um fundador toca junto."]].map(([ic, t, d]) => (
            <div key={t} className="rounded-2xl border border-g-line bg-white/[0.03] p-4 text-center">
              <div className="text-2xl">{ic}</div>
              <div className="mt-2 text-[13px] font-black text-g-word">{t}</div>
              <p className="mt-1 text-[11.5px] leading-snug text-g-muted">{d}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="no-print mt-9 rounded-xl3 border border-g-green/30 bg-g-green/[0.06] p-7 text-center">
          <div className="text-lg font-black text-g-word">Pronto pra começar{to ? `, ${to}` : ""}?</div>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-g-muted">
            {payLink ? "Confirme abaixo e ative seu sistema. Pagamento seguro." : "Confirme abaixo e a gente combina o pagamento e dá início em 7 dias."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a href={acceptHref} target="_blank" rel="noopener" className="btn-gold text-base">✅ Aceitar e {payLink ? "pagar" : "começar"}</a>
            <a href={waLink(`Oi Guileo! Tenho dúvida sobre a proposta${biz ? " da " + biz : ""}.`)} target="_blank" rel="noopener" className="btn text-sm">💬 Tenho uma dúvida</a>
            <button onClick={() => window.print()} className="btn-ghost text-sm">🖨️ Imprimir / PDF</button>
          </div>
        </div>

        {/* signature line */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-5 text-[12px] text-g-muted">
          <span>{by ? `Preparado por ${by} · Guileo` : "Guileo · Tribeca Global Inc."}</span>
          <span>📧 hello@guileoai.com</span>
        </div>
      </div>
    </div>
  );
}
