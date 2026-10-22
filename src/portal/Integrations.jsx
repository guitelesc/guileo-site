/* Split out of Portal.jsx (performance): Integrations tab view — code moved verbatim. */
import { useMemo, useState, useEffect } from "react";
import { FaCircleCheck, FaPlug } from "react-icons/fa6";
import { portalApi, toast, loadDataKey, abrirChamado } from "../lib/portalApi.js";
import { waLink } from "../data/contact.js";
import { genIntegrations, SECTOR_ONBOARD, tr, Card, GuiMark, MiniStats, vnum, Toggle, UI_LANG } from "../pages/Portal.jsx";

function Integrations({ V, onNav, lang = "en", me }) {
  // HONESTY: in real mode the connect toggles are simulated (localStorage), so we never
  // assert "N connected and acting now" or a fabricated hours-saved number — those are
  // demo-only. Real accounts get an honest amber "pending" framing until an API is linked.
  const isReal = !!(me?.email && !me?.demo);
  const groups = useMemo(() => genIntegrations(V), [V]);
  const flat = groups.flatMap(([, tools]) => tools);
  const onb = SECTOR_ONBOARD[V.label];
  // Day-one seed: catalog defaults OR this sector's auto-connect list (activation).
  // HONESTY: real accounts start with NOTHING pre-"connected" (a real client hasn't linked any API
  // yet). Only the demo/showcase seeds the sector's auto list as connected. Prevents the day-one
  // "live across 6 systems" lie the audit caught.
  const seed = useMemo(() => Object.fromEntries(flat.map(([n, , , , , def]) => [n, isReal ? false : (!!def || (onb ? onb.auto.includes(n) : false))])), [V]); // eslint-disable-line
  /* 🚨 DOIS DEFEITOS NO MESMO ESTADO (2026-09-28):
     1. A CHAVE ERA O RAMO, NÃO O CLIENTE. `${V.label}:stack` — dois spas abertos no mesmo navegador
        (a vendedora que atende dois clientes, a dona com duas unidades) dividiam o MESMO estado:
        o que um "ligava" aparecia ligado no outro. Conta real usa o e-mail do tenant na chave.
     2. O INTERRUPTOR NÃO AVISAVA NINGUÉM. Em conta real ele gravava no localStorage e a linha
        passava a mostrar "⏳ Pending setup" — a dona entendia que o pedido estava com a nossa
        equipe, e ninguém tinha sido avisado de nada. Agora, em conta real, a linha tem um botão
        "Request setup" que ABRE UM CHAMADO de verdade (/api/support → abrirChamado); "Pending
        setup" só aparece com o número do chamado devolvido pelo servidor. Sem interruptor. */
  const tenant = (me?.email || "").toString().trim().toLowerCase();
  const chaveStack = isReal ? `stack:${tenant}:${V.label}` : `${V.label}:stack`;
  const chavePedidos = `stack:${tenant}:pedidos`;
  const [conn, setConn] = useState(() => (isReal ? {} : portalApi.loadState(chaveStack, seed)));
  useEffect(() => { setConn(isReal ? {} : portalApi.loadState(chaveStack, seed)); }, [chaveStack]); // eslint-disable-line
  const [pedidos, setPedidos] = useState(() => (isReal ? portalApi.loadState(chavePedidos, {}) : {}));   // nome → {id, at}
  useEffect(() => { setPedidos(isReal ? portalApi.loadState(chavePedidos, {}) : {}); }, [chavePedidos, isReal]); // eslint-disable-line
  const [pedindo, setPedindo] = useState("");
  const [onbSeen, setOnbSeen] = useState(() => portalApi.loadState(`${V.label}:onboard_seen`, false));
  const dismissOnb = () => { setOnbSeen(true); portalApi.saveState(`${V.label}:onboard_seen`, true); };
  // DEMONSTRAÇÃO: o interruptor é de vitrine, e o toast diz isso.
  const toggle = (name) => setConn((c) => {
    const n = { ...c, [name]: !c[name] };
    portalApi.saveState(chaveStack, n);
    toast(`${tr("Demo")} — ${name}: ${tr("sample switch, nothing was connected.")}`);
    return n;
  });
  // CONTA REAL: pedir a conexão = abrir chamado. Sucesso só com o id do chamado.
  const pedir = async (name) => {
    if (pedindo || pedidos[name]) return;
    // A agenda do Google tem fluxo próprio e real — mora na tela "Connect calendar".
    if (name === "Google Calendar") { onNav?.("schedulesync"); return; }
    const key = loadDataKey();
    if (!tenant || !key) { toast(tr("Add your connection code in Settings first — then I can send the request to our team.")); return; }
    setPedindo(name);
    const r = await abrirChamado(tenant, key, { subject: `Connect ${name}`, category: "other", body: `The client asked to connect ${name} from the Integrations screen of the Central.`, status: "open", priority: "normal", lang: UI_LANG });
    setPedindo("");
    if (r && r.id) {
      const n = { ...pedidos, [name]: { id: r.id, at: Date.now() } };
      setPedidos(n); portalApi.saveState(chavePedidos, n);
      toast(`${name} — ${tr("request sent to our team ✓")}`);
    } else if (r?.tipo === "nao_ativado") toast(tr("I couldn't register the request — support requests aren't switched on yet. Message us on WhatsApp instead."));
    else toast(tr("I couldn't send the request just now — nothing was registered. Try again."));
  };
  const liveCount = flat.filter(([n]) => conn[n]).length;
  const nPedidos = Object.keys(pedidos).length;

  // REAL Google Business connect — starts the OAuth flow (google-oauth-start). Honest-inert:
  // if the Google API key isn't set yet, the endpoint returns { ready:false, note } and we say so
  // instead of opening a broken screen. Gated by this tenant's own email + data key (localStorage).
  const [gbBusy, setGbBusy] = useState(false);
  const connectGoogleBiz = async () => {
    const key = loadDataKey(); // tolera a forma entre aspas que a hidratação da nuvem grava
    if (!isReal || !me?.email || !key) { toast(tr("Log in with your account to connect Google")); return; }
    setGbBusy(true);
    try {
      const r = await fetch("https://guileoai.com/api/google-oauth-start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: me.email, token: key }) });
      const d = await r.json().catch(() => ({}));
      if (d && d.url) { window.open(d.url, "_blank", "noopener"); toast(tr("Opening Google authorization…")); }
      // `d.note` é recado de engenharia do servidor (em português) — a tela usa a própria frase
      else { toast(tr("Google Business isn't available to connect yet")); }
    } catch { toast(tr("Could not reach Google connect — try again")); }
    finally { setGbBusy(false); }
  };

  // REAL Stripe Connect — starts the client's own Stripe Express onboarding (stripe-connect · action:link),
  // so charges the Gui collects land in THEIR bank, not Guileo's. Honest-inert: if Stripe isn't configured
  // the endpoint returns 503 and we say so. Gated by this tenant's own email + data key.
  const [stBusy, setStBusy] = useState(false);
  const connectStripe = async () => {
    const key = loadDataKey(); // tolera a forma entre aspas que a hidratação da nuvem grava
    if (!isReal || !me?.email || !key) { toast(tr("Log in with your account to connect payments")); return; }
    setStBusy(true);
    try {
      const r = await fetch("/api/stripe-connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "link", email: me.email, token: key, business: me?.business || "" }) });
      const d = await r.json().catch(() => ({}));
      if (d && d.url) { window.open(d.url, "_blank", "noopener"); toast(tr("Opening Stripe onboarding…")); }
      else if (r.status === 503) { toast(tr("Payments aren't switched on yet — coming soon")); }
      else { toast(d?.error ? tr("Couldn't start Stripe — try again") : tr("Payments aren't available to connect yet")); }
    } catch { toast(tr("Could not reach Stripe connect — try again")); }
    finally { setStBusy(false); }
  };

  return (
    <div className="space-y-4 stagger">
      {onb && !onbSeen && (
        <Card className="border-g-green/40 bg-g-green/[0.08]">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-g-green/20 text-g-green shrink-0"><FaCircleCheck /></span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-g-word">{lang === "pt" ? "Preparamos sua IA pro seu setor" : "We tailored your AI to your industry"}</div>
              {/* HONESTY: real accounts see "ready to connect", NOT "is live across" (nothing linked yet). Demo keeps the rich onb copy. */}
              <div className="text-xs text-g-light mt-0.5">{isReal ? (lang === "pt" ? "Já mapeamos as ferramentas certas do seu ramo — conecte cada uma abaixo pra ligar de verdade." : lang === "es" ? "Ya mapeamos las herramientas de tu rubro — conecta cada una abajo para activarla." : "We've mapped the right tools for your industry — connect each one below to make it live.") : (lang === "pt" ? onb.pt : onb.en)} <span className="text-g-muted">{lang === "pt" ? "Ajuste o que quiser abaixo." : "Tweak anything below."}</span></div>
            </div>
            <button onClick={dismissOnb} aria-label={tr("Dismiss")} className="text-g-muted hover:text-g-word text-sm shrink-0">✕</button>
          </div>
        </Card>
      )}
      <Card className="bg-gradient-to-br from-g-green/[0.12] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-11 w-11 rounded-xl bg-g-green/15 text-g-green"><FaPlug /></span>
            <div>
              <div className="text-sm font-extrabold text-g-word">{tr("Guileo plugs into your whole stack")}</div>
              <div className="text-xs text-g-muted mt-0.5">{isReal ? (lang === "es" ? <>No reemplazamos tus herramientas — tu IA trabaja <span className="text-g-light font-semibold">dentro</span> de ellas. <span className="text-g-gold font-bold">Cada una se activa</span> al enlazar su API.</> : lang === "pt" ? <>Não substituímos suas ferramentas — sua IA trabalha <span className="text-g-light font-semibold">dentro</span> delas. <span className="text-g-gold font-bold">Cada uma acende</span> ao conectar a API.</> : <>We don't replace your tools — your AI works <span className="text-g-light font-semibold">inside</span> them. <span className="text-g-gold font-bold">Each one goes live</span> the moment its API is linked.</>) : (lang === "es" ? <>No reemplazamos tus herramientas — tu IA trabaja <span className="text-g-light font-semibold">dentro</span> de ellas, en todas. <span className="text-g-green font-bold">{liveCount} conectadas</span> y actuando ahora.</> : lang === "pt" ? <>Não substituímos suas ferramentas — sua IA trabalha <span className="text-g-light font-semibold">dentro</span> delas, em todas. <span className="text-g-green font-bold">{liveCount} conectadas</span> e agindo agora.</> : <>We don't replace your tools — your AI works <span className="text-g-light font-semibold">inside</span> them, across all of them. <span className="text-g-green font-bold">{liveCount} connected</span> and acting right now.</>)}</div>
            </div>
          </div>
          <a href={waLink("Hi Guileo! Help me connect my tools/systems")} target="_blank" rel="noopener" className="btn-bright text-sm">{tr("Connect a tool →")}</a>
        </div>
        {/* live data flow: connected tools → Guileo brain */}
        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center -space-x-1.5 shrink-0">
            {flat.filter(([n]) => conn[n]).slice(0, 5).map(([name, Icon, color]) => (
              <span key={name} title={name} className="grid place-items-center h-7 w-7 rounded-lg ring-2 ring-g-cream" style={{ background: color + "22", color }}>{typeof Icon === "string" ? <span className="text-[11px]">{Icon}</span> : <Icon size={11} />}</span>
            ))}
          </div>
          <div className="flowtrack flex-1">
            {[0, 0.7, 1.4, 2.1].map((d, i) => <span key={i} className="flowdot" style={{ animationDelay: `${d}s` }} />)}
          </div>
          <GuiMark size={32} />
        </div>
      </Card>

      {/* 🔵 Google Business — REAL OAuth connect (reviews + local SEO). Honest-inert until the API key is set. */}
      <Card className="border-[#4285F4]/30 bg-[#4285F4]/[0.05]">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-[#4285F4]/15 text-lg shrink-0">🔵</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-g-word">{lang === "pt" ? "Conectar Google Business" : lang === "es" ? "Conectar Google Business" : "Connect Google Business"}</div>
            <div className="text-[11px] text-g-muted leading-snug mt-0.5">{lang === "pt" ? "Sua Gui pede avaliação depois da visita e RESPONDE as reviews no Google — o que faz seu perfil ranquear no \"perto de mim\". Você autoriza uma vez, com sua conta Google." : lang === "es" ? "Tu Gui pide reseñas tras la visita y RESPONDE las de Google — lo que hace rankear tu perfil en \"cerca de mí\". Autorizas una vez, con tu cuenta de Google." : "Your Gui asks for a review after each visit and REPLIES to your Google reviews — what makes your profile rank in \"near me\". You authorize once, with your Google account."}</div>
          </div>
          <button onClick={connectGoogleBiz} disabled={gbBusy} className="btn-bright text-[11px] px-3 py-1.5 shrink-0 disabled:opacity-60">{gbBusy ? "…" : (lang === "pt" ? "Conectar" : lang === "es" ? "Conectar" : "Connect")}</button>
        </div>
      </Card>

      {/* 💳 Stripe Connect — REAL Express onboarding so the Gui's charges land in the CLIENT's bank. Honest-inert (503) until Stripe is switched on. */}
      <Card className="border-[#635BFF]/30 bg-[#635BFF]/[0.05]">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-[#635BFF]/15 text-lg shrink-0">💳</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-g-word">{lang === "pt" ? "Receber pagamentos (Stripe)" : lang === "es" ? "Recibir pagos (Stripe)" : "Get paid (Stripe)"}</div>
            <div className="text-[11px] text-g-muted leading-snug mt-0.5">{lang === "pt" ? "Quando a Gui fecha e cobra na ligação, o dinheiro cai DIRETO na SUA conta — não na nossa. Você conecta sua conta Stripe uma vez; se não tiver, cria na hora." : lang === "es" ? "Cuando la Gui cierra y cobra en la llamada, el dinero cae DIRECTO en TU cuenta — no en la nuestra. Conectas tu Stripe una vez; si no tienes, la creas al momento." : "When Gui closes and collects on the call, the money lands DIRECTLY in YOUR account — not ours. Connect your Stripe once; no account yet, create one on the spot."}</div>
          </div>
          <button onClick={connectStripe} disabled={stBusy} className="btn-bright text-[11px] px-3 py-1.5 shrink-0 disabled:opacity-60">{stBusy ? "…" : (lang === "pt" ? "Conectar" : lang === "es" ? "Conectar" : "Connect")}</button>
        </div>
      </Card>

      <MiniStats items={isReal
        ? [["Setup requests sent", `${nPedidos}`], ["Setup", tr("Done-for-you")]]
        : [[tr("Connected"), `${liveCount}/${flat.length}`, "good"], [tr("Acting 24/7"), tr("Always-on")], [tr("Hours saved / wk"), `${vnum(V.label, "stackhrs", 8, 26)}h`, "good"], [tr("Setup"), tr("Done-for-you")]]} />

      {/* 💬 Gui webchat on THEIR OWN site — one script tag; real email when logged in, placeholder in demo */}
      {(() => {
        const wcEmail = me?.email && !me?.demo ? me.email : "YOUR_EMAIL";
        const wcSnippet = `<script src="https://guileoai.com/gui-widget.js" data-guileo="${wcEmail}" data-lang="${["pt", "es"].includes(lang) ? lang : "en"}" defer></script>`;
        const copy = () => {
          try {
            navigator.clipboard.writeText(wcSnippet);
            toast(tr("Snippet copied ✓ — paste it on your site"));
          } catch { toast(tr("Select and copy the snippet above")); }
        };
        return (
          <Card className="border-[#FF8A33]/30 bg-[#FF8A33]/[0.05]">
            <div className="flex items-start gap-3 mb-3">
              <span className="grid place-items-center h-10 w-10 rounded-xl bg-[#FF8A33]/15 text-lg shrink-0">💬</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold text-g-word">{lang === "pt" ? "Webchat no seu site" : lang === "es" ? "Webchat en tu sitio" : "Webchat on your site"}</div>
                <div className="text-[11px] text-g-muted leading-snug mt-0.5">{lang === "pt" ? "Sua Gui atendendo os visitantes do SEU site — responde, orça e capta leads 24/7, direto pro seu feed aqui no painel." : lang === "es" ? "Tu Gui atendiendo a los visitantes de TU sitio — responde, cotiza y capta leads 24/7, directo a tu feed en el panel." : "Your Gui greeting YOUR website visitors — answers, quotes and captures leads 24/7, straight into your feed here."}</div>
              </div>
            </div>
            <pre className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-[10.5px] leading-relaxed text-g-light overflow-x-auto whitespace-pre-wrap break-all select-all">{wcSnippet}</pre>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] text-g-muted leading-snug">
                {lang === "pt" ? <>1. Copie o código · 2. Cole antes do <span className="text-g-light font-semibold">&lt;/body&gt;</span> de qualquer página do seu site.</> : lang === "es" ? <>1. Copia el código · 2. Pégalo antes del <span className="text-g-light font-semibold">&lt;/body&gt;</span> en cualquier página de tu sitio.</> : <>1. Copy the snippet · 2. Paste it before <span className="text-g-light font-semibold">&lt;/body&gt;</span> on any page of your site.</>}
                <br />{lang === "pt" ? "Aparece em ~5 segundos · funciona em qualquer site (WordPress, Wix, Shopify, HTML…)" : lang === "es" ? "Aparece en ~5 segundos · funciona en cualquier sitio (WordPress, Wix, Shopify, HTML…)" : "Shows up in ~5 seconds · works on any site (WordPress, Wix, Shopify, plain HTML…)"}
              </div>
              <button onClick={copy} className="btn-bright text-[11px] px-3 py-1.5 shrink-0">{tr("Copy snippet")}</button>
            </div>
          </Card>
        );
      })()}

      {/* Gui recommends connecting — surfaces the highest-value disconnected tools */}
      {(() => {
        const off = flat.filter(([n]) => !conn[n] && !pedidos[n]).slice(0, 2);
        return off.length ? (
          <Card className="border-[#FF8A33]/30 bg-[#FF8A33]/[0.05]">
            <div className="flex items-center gap-2 mb-2.5"><GuiMark size={26} /><div className="text-xs font-extrabold text-g-word">{tr("Gui recommends connecting")}</div></div>
            <div className="space-y-2">
              {off.map(([name, Icon, color, doesEn, doesPt]) => (
                <div key={name} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2.5">
                  <span className="grid place-items-center h-8 w-8 rounded-lg text-base" style={{ background: color + "22", color }}>{typeof Icon === "string" ? <span>{Icon}</span> : <Icon size={14} />}</span>
                  <div className="flex-1 min-w-0"><div className="text-xs font-bold text-g-word">{name}</div><div className="text-[10px] text-g-muted leading-snug">{lang === "pt" ? doesPt : doesEn}</div></div>
                  {isReal
                    ? (pedidos[name]
                        ? <span className="text-[10px] font-black uppercase text-[#C98A00] shrink-0">⏳ {tr("Requested")}</span>
                        : <button onClick={() => pedir(name)} disabled={!!pedindo} className="btn-bright text-[11px] px-3 py-1.5 shrink-0 disabled:opacity-60">{pedindo === name ? "…" : name === "Google Calendar" ? tr("Connect") : tr("Request setup")}</button>)
                    : <button onClick={() => toggle(name)} className="btn-bright text-[11px] px-3 py-1.5 shrink-0">{tr("Connect")}</button>}
                </div>
              ))}
            </div>
          </Card>
        ) : null;
      })()}

      {groups.map(([cat, tools]) => (
        <Card key={cat} className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{cat}</div>
          <div className="divide-y divide-white/[0.06]">
            {tools.map(([name, Icon, color, doesEn, doesPt]) => (
              <div key={name} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid place-items-center h-10 w-10 rounded-xl text-lg" style={{ background: color + "22", color }}>{typeof Icon === "string" ? <span>{Icon}</span> : <Icon />}</span>
                <div className="flex-1 min-w-0">
                  {/* HONESTY: real accounts never show "Live" from a demo toggle — they show amber "Pending setup" until the API is truly linked. Only demo shows green Live. */}
                  <div className="text-sm font-bold text-g-word flex items-center gap-2">{name}{isReal
                    ? (pedidos[name] ? <span className="text-[9px] font-black uppercase text-[#C98A00] inline-flex items-center gap-1">⏳ {tr("Pending setup")} · {tr("request")} #{String(pedidos[name].id).slice(0, 8)}</span> : null)
                    : (conn[name] ? <span className="text-[9px] font-black uppercase text-g-green inline-flex items-center gap-1"><FaCircleCheck size={9} /> {tr("Live")} · {tr("Demo")}</span> : null)}</div>
                  <div className="text-[11px] text-g-muted leading-snug">{lang === "pt" ? doesPt : doesEn}</div>
                </div>
                {isReal
                  ? (pedidos[name]
                      ? null
                      : <button onClick={() => pedir(name)} disabled={!!pedindo} className="btn-ghost text-[11px] px-3 py-1.5 shrink-0 disabled:opacity-60">{pedindo === name ? "…" : name === "Google Calendar" ? tr("Connect") : tr("Request setup")}</button>)
                  : <Toggle on={!!conn[name]} onClick={() => toggle(name)} />}
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card className="border-g-gold/25 bg-g-gold/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-g-muted">{tr("Don't see your system? If it has an API (or Zapier/Make),")} <span className="text-g-light font-semibold">{tr("your team wires it")}</span> {tr("— Guileo becomes the brain on top of everything you already run.")}</div>
          <button onClick={() => onNav?.("brain")} className="btn-ghost text-sm shrink-0">{tr("Train your AI on it →")}</button>
        </div>
      </Card>
    </div>
  );
}

export default Integrations;
