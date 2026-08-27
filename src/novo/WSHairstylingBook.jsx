/* WS HAIRSTYLING — A PÁGINA DE BOOKING, NO NOSSO DOMÍNIO
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   Mesmo princípio do Three Degrees: o clique mais importante fica em guileoai.com, não some pro
   domínio do provedor. O Vagaro continua existindo como saída secundária, para quem já é cliente.

   O CARDÁPIO É O DELES, lido do Vagaro (vagaro.com/wshairstyling/services, 26/08) — 28 serviços
   com o "starting at" e a faixa que a descrição declara. Nada arredondado, nada inventado.

   O ACHADO QUE VIRA A PÁGINA: eles publicam a tabela NYU JÁ CALCULADA (corte de $60 vira $48 pro
   estudante). Isso é ouro e está enterrado numa lista do Vagaro. Aqui o desconto é um INTERRUPTOR:
   a pessoa liga "I'm an NYU student" e a página inteira mostra o preço dela. Nenhum salão da
   região faz isso, e são 3 minutos do campus.
*/
import { useState, useMemo, useEffect, useRef } from "react";

const TEL = "+12125333344";
const TEL_FMT = "(212) 533-3344";
const VAGARO = "https://www.vagaro.com/wshairstyling";
const B = "/novo/ws-hairstyling";

/* [nome, preço base, faixa/condição, preço NYU (null = sem tarifa de estudante)] */
const MENU = [
  { g: "Haircuts", itens: [
    ["Women's Haircut & Style", "$90", "medium to long · price by thickness and length", "$72"],
    ["Women's Haircut (air dry)", "$70", "includes wash · blow-dry not included", "$60"],
    ["Master Stylist Men's Haircut", "$60", "", "$48"],
    ["Pixie Cut", "$75", "$75–90", null],
    ["Kid's Haircut (up to 8 y.o.)", "$40", "$40–60", null],
    ["Bang Trim", "$20", "$20–30", null],
  ]},
  { g: "Blowout & Styling", itens: [
    ["Wash / Blowout", "$60", "$60–100 by length and thickness", "$48"],
    ["Hot Tools (flat or curling iron)", "$25", "$25–35 · wash and blowout not included", null],
    ["Updo", "$80", "classic, braided or custom", null],
  ]},
  { g: "Color — L'Oréal Professionnel", itens: [
    ["Roots Touch Up", "$90", "$90–130 · add blowout if needed", null],
    ["INOA (no ammonia)", "$100", "$100–140 · without blowout", null],
    ["Single Process", "$100", "$100–250", null],
    ["Double Process Roots w/ Lightener", "$180", "toner included", null],
    ["Double Process / Color Correction", "Price on consultation", "our specialists match tone and style", null],
    ["Toner", "$50", "$50–80 · blowout not included", null],
    ["Gloss", "$50", "$50–70 · blowout not included", null],
  ]},
  { g: "Highlights", itens: [
    ["Partial Highlights", "$120", "blowout not included", null],
    ["Half Head of Highlights", "$150", "$150–250 · blowout not included", null],
    ["Full Head of Highlights", "$250", "blowout extra", null],
    ["Balayage", "$250", "blowout extra", null],
  ]},
  { g: "Smoothing & Treatments", destaque: true, itens: [
    ["Organic Keratin CEZANNE", "$320", "$320–400 · formaldehyde free", null],
    ["Brazilian Keratin", "$350", "$350–450", null],
    ["ProAddiction", "$320", "formaldehyde free · multi-protein system", null],
    ["Relaxer / Straightener", "$60", "$60–450 depending on hair", null],
    ["Deep Conditioning", "$30", "blowout not included", null],
    ["Fusio-Dose Kérastase", "$50", "custom blended in-salon · blowout not included", null],
  ]},
];

/* Canais que ESTE salão atende de verdade. */
const CANAIS = [
  ["phone", "Phone", "+1 (212) 555-0000"],
  ["whatsapp", "WhatsApp", "+1 (212) 555-0000"],
  ["instagram", "Instagram", "@yourhandle"],
  ["email", "Email", "you@email.com"],
];

export default function WSHairstylingBook() {
  const [grupo, setGrupo] = useState("Haircuts");
  const [rel, setRel] = useState({ hora: "", aberto: false });
  const [nyu, setNyu] = useState(false);
  const [escolhido, setEscolhido] = useState(null);
  const [canal, setCanal] = useState("phone");
  const [passo, setPasso] = useState(0);
  const [form, setForm] = useState({ nome: "", contato: "", quando: "", recado: "" });
  const [outroQuando, setOutroQuando] = useState(false);
  const [envio, setEnvio] = useState(null);
  const pedido = useRef(null);

  useEffect(() => {
    const antes = document.title;
    document.title = "Book — WS Hairstyling NYC, 780 Broadway";
    return () => { document.title = antes; };
  }, []);

  /* o mesmo selo vivo da vitrine — hora e aberto/fechado do MESMO tick */
  useEffect(() => {
    const tick = () => {
      const f = (o) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...o }).format(new Date());
      const h = Number(f({ hour: "numeric", hour12: false }));
      const dom = f({ weekday: "short" }) === "Sun";
      setRel({ hora: f({ hour: "numeric", minute: "2-digit", hour12: true }), aberto: !dom && h >= 10 && h < 19 });
    };
    tick(); const id = setInterval(tick, 30000); return () => clearInterval(id);
  }, []);

  const atual = useMemo(() => MENU.find((m) => m.g === grupo) || MENU[0], [grupo]);
  /* O preço mostrado segue o interruptor — e quando o serviço não tem tarifa de estudante a
     página DIZ isso, em vez de calcular 20% por conta própria. Desconto inventado no preço de
     um salão é o cliente chegando com a conta errada e a recepção pagando. */
  const precoDe = (it) => (nyu && it[3] ? it[3] : it[1]);
  const semTarifa = (it) => nyu && !it[3];

  const enviar = async (e) => {
    e.preventDefault();
    setEnvio("indo");
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "ws-hairstyling", negocio: "WS Hairstyling NYC",
          nome: form.nome, telefone: form.contato,
          mensagem: `[${escolhido ? `${escolhido[0]} · ${precoDe(escolhido)}${nyu && escolhido[3] ? " (NYU rate)" : ""}` : "service?"}] ${form.quando || "any time"} · reply on ${canal}${form.recado ? ` · note: ${form.recado}` : ""}` }),
      });
      const d = await r.json().catch(() => null);
      setEnvio(d && d.ok ? { ok: true, ligacao: d.ligacao } : { erro: (d && d.error) || `HTTP ${r.status}` });
    } catch (err) { setEnvio({ erro: String(err).slice(0, 90) }); }
  };

  const pil = (on) => on
    ? { background: "var(--sumi)", color: "var(--champ)" }
    : { background: "var(--carvao3)", color: "var(--creme2)", border: "1px solid var(--linha)" };

  return (
    <div className="wsb-raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Jost:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        /* PADRÃO-VITRINE §3 — grão de tela na raiz. Sem isto o fundo lê como retângulo pintado.
           Estava no Three Degrees e eu esqueci de trazer: por isso o PADRAO-VITRINE.md existe. */
        .wsb-raiz::before{content:'';position:fixed;inset:0;pointer-events:none;opacity:.4;z-index:0;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .035 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");}
        .wsb-raiz > *{position:relative;z-index:1;}
        .wsb-raiz{--carvao:#262728;--carvao2:#1C1D1E;--carvao3:#313233;--sumi:#141516;
          --champ:#DACB96;--champ-c:#EBDCA8;--champ-e:#B8A776;
          --creme:#F4F1E9;--creme2:#B9B4A6;--linha:#3B3C3D;
          background:var(--carvao);color:var(--creme);min-height:100vh;
          font-family:'Jost',system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
        .wsb-disp{font-family:'Fraunces',Georgia,serif;font-weight:700;letter-spacing:-.01em;}
        .wsb-mono{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;}
        .wsb-rot{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:500;
          letter-spacing:.22em;text-transform:uppercase;color:var(--creme2);}
        .wsb-sub{display:block;width:64px;height:3px;background:var(--champ);margin:14px 0 0;}
        /* material da casa em superfície escura */
        .wsb-cartao{background:var(--carvao2);border:1px solid var(--linha);border-radius:20px;
          position:relative;
          background-image:linear-gradient(104deg,transparent 20%,rgba(255,255,255,.045) 34%,transparent 48%),
            radial-gradient(120% 70% at 82% -12%,rgba(255,255,255,.055),transparent 55%);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.10),inset 0 -1px 0 rgba(0,0,0,.34),
            0 2px 4px -2px rgba(0,0,0,.55),0 30px 66px -36px rgba(0,0,0,.9);}
        .wsb-cartao::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
          background:linear-gradient(115deg,rgba(255,255,255,.07) 0%,rgba(255,255,255,0) 38%);}
        .wsb-cartao > *{position:relative;z-index:1;}
        /* PADRÃO-VITRINE §5 — alvo de toque */
        .wsb-raiz a,.wsb-raiz button{min-height:38px;}
        .wsb-raiz .wsb-item{min-height:44px;}
        .wsb-b{display:inline-flex;align-items:center;gap:.5rem;border-radius:999px;font-weight:600;
          font-size:15px;padding:13px 26px;text-decoration:none;cursor:pointer;border:1px solid transparent;
          min-height:38px;transition:transform .14s ease,box-shadow .25s ease,border-color .25s ease;}
        .wsb-b:active{transform:translateY(1px);}
        /* o SELO da casa, na paleta deles */
        .wsb-b1{position:relative;overflow:hidden;border-radius:10px;
          background:linear-gradient(180deg,#2E2D2B,var(--sumi));color:var(--creme);
          border:1.5px solid var(--champ);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 1px 2px rgba(20,21,22,.3),
            0 14px 30px -16px rgba(20,21,22,.6);}
        .wsb-b1::after{content:'';position:absolute;inset:0;pointer-events:none;
          background:linear-gradient(105deg,transparent 34%,rgba(218,203,150,.32) 47%,transparent 60%);
          transform:translateX(-120%);transition:transform .75s cubic-bezier(.22,1,.36,1);}
        .wsb-b1:hover::after{transform:translateX(120%);}
        .wsb-b1:hover{border-color:var(--champ-c);}
        .wsb-b2{background:var(--carvao3);color:var(--creme);border:1px solid var(--linha);border-radius:10px;}
        .wsb-b2:hover{border-color:var(--champ);}
        .wsb-gr{color:var(--champ);font-family:'Fraunces',serif;margin-left:.35em;}
        .wsb-aba{border:0;background:transparent;cursor:pointer;font-family:inherit;font-weight:600;
          font-size:14px;padding:9px 16px;border-radius:999px;color:var(--creme2);min-height:38px;
          transition:all .18s ease;}
        .wsb-aba[data-on="1"]{background:var(--champ);color:#241F12;}
        /* A LINHA DO CARDÁPIO — a mesma régua da vitrine dele (nome · pontilhado · preço).
           A lista de cards uniformes era a cara-de-AI que o Luis apontou; a régua de menu é a
           linguagem que a página 1 já falava, e /book é a página 2 do mesmo lugar. */
        .wsb-item{display:flex;align-items:baseline;gap:.6rem;width:100%;text-align:left;cursor:pointer;
          background:transparent;border:0;border-bottom:1px solid rgba(255,255,255,.05);padding:12px 4px;
          color:inherit;min-height:44px;transition:background .16s ease;}
        .wsb-pontos{flex:1 1 auto;border-bottom:1px dotted rgba(218,203,150,.28);transform:translateY(-3px);min-width:24px;}
        .wsb-item:hover .wsb-nome{color:var(--champ);}
        .wsb-item[data-on="1"] .wsb-nome{color:var(--champ);}
        .wsb-nome{transition:color .16s ease;}
        .wsb-inp{width:100%;border-radius:14px;border:1px solid var(--linha);background:var(--carvao3);
          padding:12px 15px;font-size:15px;outline:none;color:var(--creme);}
        .wsb-inp:focus{border-color:var(--champ);box-shadow:0 0 0 3px rgba(218,203,150,.16);}
        .wsb-inp::placeholder{color:#8C877B;}
        .wsb-selo-logo{display:grid;place-items:center;flex:0 0 auto;width:44px;height:44px;
          border-radius:12px;overflow:hidden;background:var(--carvao3);border:1px solid var(--linha);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 8px 18px -10px rgba(0,0,0,.6);}
        .wsb-selo-logo img{width:100%;height:100%;object-fit:contain;padding:3px;}
        .wsb-fone-mini{display:none;}
        @media (max-width:379px){.wsb-fone-full{display:none;}.wsb-fone-mini{display:inline;}}
        @media (prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>

      <header className="mx-auto flex max-w-5xl flex-nowrap items-center justify-between gap-3 px-4 pb-3 pt-5 sm:px-5 sm:pt-6">
        <a href={B} className="flex min-w-0 items-center gap-2.5 no-underline" style={{ color: "inherit" }}>
          <span className="wsb-selo-logo"><img src={`${B}/logo.svg`} alt="WS Hairstyling NYC" width="44" height="44" /></span>
          <span className="min-w-0">
            <span className="wsb-disp block truncate text-[clamp(14px,3.6vw,16px)] leading-none">WS HAIRSTYLING</span>
            <span className="wsb-rot mt-1 block truncate" style={{ fontSize: "clamp(8.5px,2.2vw,10.5px)" }}>← back to the salon</span>
          </span>
        </a>
        <a href={`tel:${TEL}`} className="wsb-b wsb-b2 shrink-0" style={{ padding: "11px 18px", fontSize: 14 }}>
          <span className="wsb-fone-full">Call {TEL_FMT}</span><span className="wsb-fone-mini">Call</span>
        </a>
      </header>

      <section className="mx-auto max-w-5xl px-5 pt-6">
        <div className="wsb-rot" style={{ color: "var(--champ-e)" }}>Booking · 780 Broadway</div>
        <h1 className="wsb-disp mt-2 text-[clamp(1.9rem,5vw,3rem)] leading-tight">Pick your service.</h1>
        <span className="wsb-sub" />
        <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed" style={{ color: "var(--creme2)" }}>
          Every price published, nothing hidden. Choose one and tell us when — the front desk
          confirms your exact time. Walk-ins are welcome too.
        </p>
        <span className="mt-4 inline-flex items-center gap-2.5 rounded-full px-4 py-2"
          style={{ border: "1px solid var(--linha)", background: "var(--carvao3)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: rel.aberto ? "#7BD98F" : "var(--champ-e)" }} />
          <span className="wsb-mono text-[12.5px]">{rel.aberto ? "Open now — walk in or book" : "Closed"} · {rel.hora} NYC</span>
        </span>

        {/* O INTERRUPTOR NYU — o ativo que estava enterrado numa lista do Vagaro */}
        <button type="button" onClick={() => setNyu((v) => !v)}
          className="wsb-cartao mt-5 flex w-full items-center gap-3 p-4 text-left sm:w-auto">
          <span className="grid h-6 w-11 shrink-0 items-center rounded-full px-0.5"
            style={{ background: nyu ? "var(--champ)" : "var(--carvao3)", border: "1px solid var(--linha)" }}>
            <span className="block h-5 w-5 rounded-full transition-all duration-200"
              style={{ background: nyu ? "#241F12" : "var(--creme2)", transform: nyu ? "translateX(18px)" : "none" }} />
          </span>
          <span>
            <span className="block text-[15px] font-bold">I&apos;m an NYU student</span>
            <span className="wsb-rot mt-0.5 block" style={{ letterSpacing: ".12em" }}>
              20% off with a valid ID · three minutes from campus
            </span>
          </span>
        </button>
      </section>

      <section className="mx-auto max-w-5xl px-5 pt-6">
        <div className="flex flex-wrap gap-2">
          {MENU.map((m) => (
            <button key={m.g} type="button" className="wsb-aba" data-on={m.g === grupo ? "1" : "0"}
              onClick={() => setGrupo(m.g)}>
              {m.g} <span className="wsb-mono text-[11.5px] opacity-60">{m.itens.length}</span>
            </button>
          ))}
        </div>

        <div className="wsb-cartao mt-5 p-5 sm:p-6" style={atual.destaque ? { borderColor: "var(--champ)" } : undefined}>
          {atual.itens.map((it) => {
            const on = escolhido && escolhido[0] === it[0];
            return (
              <button key={it[0]} type="button" className="wsb-item" data-on={on ? "1" : "0"}
                onClick={() => { setEscolhido(it); setEnvio(null); setPasso(0); pedido.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
                <span className="mt-1 grid h-[18px] w-[18px] shrink-0 place-items-center self-start rounded-full text-[10px]"
                  style={{ border: `1.5px solid ${on ? "var(--champ)" : "rgba(218,203,150,.35)"}`,
                    background: on ? "var(--champ)" : "transparent", color: "#241F12" }}>
                  {on ? "✓" : ""}
                </span>
                <span className="min-w-0" style={{ maxWidth: "62%" }}>
                  <span className="wsb-nome block text-[15px] font-bold leading-snug">{it[0]}</span>
                  {it[2] && <span className="mt-0.5 block text-[12px] leading-snug" style={{ color: "var(--creme2)" }}>{it[2]}</span>}
                  {semTarifa(it) && (
                    <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--champ-e)" }}>
                      no student rate on this one
                    </span>
                  )}
                </span>
                <span className="wsb-pontos" aria-hidden="true" />
                <span className="shrink-0 self-start text-right">
                  <span className="wsb-mono block text-[15px]" style={{ color: "var(--champ)" }}>{precoDe(it)}</span>
                  {nyu && it[3] && (
                    <span className="wsb-mono block text-[11.5px] line-through" style={{ color: "var(--creme2)" }}>{it[1]}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section ref={pedido} className="mx-auto max-w-5xl px-5 py-8">
        <div className="wsb-cartao p-5 sm:p-7">
          {envio && envio.ok ? (
            <div>
              <div className="wsb-disp text-[20px]" style={{ color: "var(--champ)" }}>Request received.</div>
              <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--creme2)" }}>
                {envio.ligacao === "disparada"
                  ? "Your phone is about to ring — that's the salon's assistant calling you back."
                  : "The front desk will get back to you to confirm your time."}
              </p>
              <a href={B} className="wsb-b wsb-b2 mt-4">Back to the salon</a>
            </div>
          ) : (
            <>
              <div className="wsb-rot">Your request</div>
              <div className="wsb-disp mt-1.5 text-[19px]">
                {escolhido ? escolhido[0] : "Choose one above and it lands here"}
              </div>
              {escolhido && (
                <div className="wsb-mono mt-1 text-[13.5px]" style={{ color: "var(--creme2)" }}>
                  {precoDe(escolhido)}{nyu && escolhido[3] ? " · NYU rate, bring your ID" : ""}
                </div>
              )}

              <form onSubmit={enviar} className="mt-5">
                <div className="flex items-center gap-2">
                  {[0, 1].map((i) => (
                    <span key={i} className="h-1 flex-1 rounded-full transition-all duration-500"
                      style={{ background: i <= passo ? "var(--champ)" : "var(--linha)" }} />
                  ))}
                  <span className="wsb-mono ml-2 text-[11px]" style={{ color: "var(--creme2)" }}>{passo + 1}/2</span>
                </div>

                {passo === 0 ? (
                  <div className="mt-5">
                    <div className="wsb-rot mb-2">When works for you?</div>
                    <div className="flex flex-wrap gap-1.5">
                      {["Today, as soon as possible", "This week, mornings", "This week, afternoons", "Weekend", "I'm flexible"].map((w) => (
                        <button key={w} type="button" onClick={() => { setForm({ ...form, quando: w }); setOutroQuando(false); }}
                          className="rounded-full px-3 py-1.5 text-[12.5px] font-bold" style={pil(form.quando === w && !outroQuando)}>
                          {w}
                        </button>
                      ))}
                      <button type="button" onClick={() => { setOutroQuando(true); setForm({ ...form, quando: "" }); }}
                        className="rounded-full px-3 py-1.5 text-[12.5px] font-bold"
                        style={outroQuando ? pil(true) : { background: "transparent", color: "var(--creme2)", border: "1px dashed var(--linha)" }}>
                        A specific date…
                      </button>
                    </div>
                    {outroQuando && (
                      <input autoFocus value={form.quando} onChange={(e) => setForm({ ...form, quando: e.target.value })}
                        placeholder="e.g. Saturday the 14th, before 2pm" className="wsb-inp mt-2.5" />
                    )}

                    <div className="wsb-rot mb-2 mt-5">Where should we reply?</div>
                    <div className="flex flex-wrap gap-1.5">
                      {CANAIS.map(([k, rot]) => (
                        <button key={k} type="button" onClick={() => setCanal(k)}
                          className="rounded-full px-3 py-1.5 text-[12.5px] font-bold" style={pil(canal === k)}>{rot}</button>
                      ))}
                    </div>

                    <button type="button" onClick={() => setPasso(1)} disabled={!escolhido || !form.quando}
                      className="wsb-b wsb-b1 mt-5" style={!escolhido || !form.quando ? { opacity: .45, cursor: "not-allowed" } : undefined}>
                      Next<span className="wsb-gr">°</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      placeholder="Your name" className="wsb-inp sm:col-span-2" />
                    <input required type={canal === "email" ? "email" : canal === "instagram" ? "text" : "tel"}
                      value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })}
                      placeholder={(CANAIS.find((c) => c[0] === canal) || [])[2]} className="wsb-inp sm:col-span-2" />
                    <textarea rows={2} value={form.recado} onChange={(e) => setForm({ ...form, recado: e.target.value })}
                      placeholder="Anything the stylist should know? (optional)" className="wsb-inp sm:col-span-2" />
                    {envio && envio.erro && (
                      <p className="text-[13.5px] font-bold sm:col-span-2" style={{ color: "#E8836F" }}>
                        Didn&apos;t send: {envio.erro} — please call {TEL_FMT}.
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                      <button type="submit" disabled={envio === "indo"} className="wsb-b wsb-b1">
                        {envio === "indo" ? "Sending…" : "Start my appointment"}<span className="wsb-gr">°</span>
                      </button>
                      <button type="button" onClick={() => setPasso(0)} className="text-[13px] font-bold" style={{ color: "var(--creme2)" }}>back</button>
                    </div>
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[13px]" style={{ color: "var(--creme2)" }}>
          Prefer the salon&apos;s own calendar?{" "}
          <a href={VAGARO} target="_blank" rel="noreferrer" className="font-bold underline-offset-2 hover:underline" style={{ color: "var(--champ)" }}>
            open it on Vagaro
          </a>{" "}
          · or just call{" "}
          <a href={`tel:${TEL}`} className="font-bold underline-offset-2 hover:underline" style={{ color: "var(--champ)" }}>{TEL_FMT}</a>
        </p>
      </section>
    </div>
  );
}
