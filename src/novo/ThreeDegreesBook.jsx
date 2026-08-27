/* THREE DEGREES — A PÁGINA DE BOOKING, NO NOSSO DOMÍNIO
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   Luis (25/08): «o click do booking abre outra página com outro domínio — cria a página de
   booking, pelo amor de Deus». Ele está certo e eu tinha errado duas vezes: primeiro duplicando
   a lista de estilistas na vitrine, depois jogando o visitante pro go.booker.com. A vitrine existe
   pro dono ver O SITE DELE fazendo tudo — mandar embora no clique mais importante mata o efeito
   e ainda entrega a conversão pra plataforma do concorrente.
   Aqui: /novo/three-degrees/book — os 34 serviços REAIS lidos do Booker deles (25/08), com preço,
   duração e as regras da casa, na identidade deles. O pedido cai no /api/lead-vitrine — o mesmo
   que dispara a Hana ligando de volta em segundos.
   O link pro Booker continua existindo, mas como saída secundária (quem já é cliente e quer a
   agenda real), nunca como o caminho principal.
*/
import { useState, useMemo, useEffect, useRef } from "react";

const TEL = "+12122548174";
const TEL_FMT = "(212) 254-8174";
const EMAIL = "info@threedegreesnyc.com";
const BOOKER = "https://go.booker.com/location/threedegreesnyc/service-menu";
const B = "/novo/three-degrees";

/* A CARA DE QUEM VAI CORTAR. O Booker deles mostra a foto ao lado de cada serviço e é isso que
   faz a pessoa escolher — ninguém marca "um corte", marca uma MÃO. Mapeado pelo nome que já
   aparece no título do serviço; serviço sem nome de pessoa (bleach, keratin) fica sem foto,
   porque inventar um rosto ali seria dizer quem atende sem saber. */
const FOTO = { Kei: "kei", Shawn: "shawn", Saeko: "saeko", Yuki: "yuki", Miho: "miho", Ab: "ab", Savannah: "savannah" };
const quemFaz = (titulo) => {
  const m = String(titulo).match(/w\/ (Kei|Shawn|Saeko|Yuki|Miho|Ab|Savannah)/);
  return m ? m[1] : null;
};

/* Os 34 serviços, exatamente como o Booker deles publica (nº, duração, preço, condição).
   Nada foi arredondado nem reescrito: é a fonte operacional do salão. */
const MENU = [
  { g: "Haircut", itens: [
    ["#1-1 Haircut w/ Kei — returning", "1h 10m", "$130", "w/ shampoo & blow-dry · $120–160"],
    ["#1-2 Haircut w/ Kei — new clients", "1h 15m", "$130", "w/ shampoo & blow-dry · $120–160"],
    ["#2 Haircut w/ Shawn", "1h", "$110", "$100–150"],
    ["#3 Haircut w/ Saeko", "1h", "$110", "$100–150"],
    ["#4 Haircut w/ Yuki", "1h", "$100", "$100–130"],
    ["#5 Haircut w/ Miho", "1h 15m", "$100", "$90–120"],
    ["#6 Haircut w/ Ab", "1h 15m", "$100", "$90–120"],
    ["#7 Haircut w/ Savannah", "1h 15m", "$90", "$80–110"],
    ["#8 Haircut w/ earliest availability", "1h 15m", "$100", "$90–120"],
    ["#9 Bangs cut", "30m", "$30", "shampoo/blow-dry not included"],
    ["#10 Blow dry with shampoo", "1h", "$60", "varies with length and thickness"],
  ]},
  { g: "Color", itens: [
    ["#11 Single color process w/ blow-dry", "2h", "$160", "no bleach · touch-up $150–160 · full head $160–200"],
    ["#11' Single color w/ Shawn", "2h", "$160", "Shawn takes RETURNING clients only"],
    ["#12 Single color process w/ haircut", "2h 45m", "$240", "no bleach · touch-up $220–230 · full $240–290"],
    ["#13 Double color process w/ blow-dry", "3h", "$290", "no bleach · $290–350"],
    ["#14 Bleach single process", "3h 30m", "$330", "1 bleach + color · $300–400"],
    ["#15 Bleach double process", "5h", "$500", "2 bleach + color · $450–600"],
    ["#16 Full highlights / balayage — first time", "4h 30m", "$350", "$350–480 · additional bleach/color +$90"],
    ["#17 Full highlights / balayage", "3h 30m", "$330", "$330–480"],
    ["#18 Highlights / balayage touch-up", "3h", "$290", "within 3 months · $290–350"],
    ["#19 Peekaboo / point / face frame", "3h 30m", "$290", "2 bleach + color · $290–390"],
    ["#20 Creative color / color correction", "7h", "from $700", "consultation required — never booked directly"],
    ["#21 In-person color consultation", "30m", "$30", "online consultation by email is free"],
  ]},
  { g: "Perm & straightening", destaque: true, itens: [
    ["#22 Digital / cold perm w/ Kei", "4h", "$350", "haircut included · $350–500"],
    ["#23 Digital / cold perm w/ Shawn", "3h 30m", "$320", "returning clients only · $320–400"],
    ["#24 Digital / cold perm w/ Saeko", "4h", "$320", "clients she has seen before · $320–400"],
    ["#25 Digital / cold perm w/ Yuki", "4h", "$320", "haircut included · $320–400"],
    ["#26 Digital / cold perm w/ Miho", "4h", "$320", "haircut included · $320–400"],
    ["#27 Digital / cold perm — earliest", "4h", "$320", "$320–400"],
    ["#28 Short hair cold perm", "3h", "$270", "top section only · $270–330"],
    ["#29 Japanese straight perm", "3h 30m", "$350", "$350–400 · haircut NOT included"],
    ["#30 Keratin treatment", "3h", "$350", "$350–400 · haircut NOT included"],
    ["#31 In-person perm consultation", "30m", "$30", "online consultation by email is free"],
  ]},
  { g: "Treatment & styling", itens: [
    ["#32 Olaplex or deep conditioning", "1h 30m", "$110", "w/ shampoo & blow-dry · results last up to 5 weeks"],
    ["#34 Up-do", "1h 30m", "$130", "$130–150 · consultation by email required"],
  ]},
];

export default function ThreeDegreesBook() {
  const [grupo, setGrupo] = useState("Haircut");
  const [escolhido, setEscolhido] = useState(null);
  const [form, setForm] = useState({ nome: "", tel: "", quando: "" });
  const [envio, setEnvio] = useState(null);
  const pedido = useRef(null);

  useEffect(() => {
    const antes = document.title;
    document.title = "Book — Three Degrees Salon, East Village NYC";
    return () => { document.title = antes; };
  }, []);

  const atual = useMemo(() => MENU.find((m) => m.g === grupo) || MENU[0], [grupo]);
  /* A regra da casa que mais importa aparece NO MOMENTO da escolha, não no rodapé:
     quem clica num perm precisa saber do cabelo descolorido antes de digitar o telefone. */
  const alerta = escolhido && /perm|straight/i.test(escolhido[0])
    ? "Heads up: the salon does not perm hair that has ever been bleached — it's a hair-health rule. Not sure? Ask and they'll suggest a treatment instead."
    : escolhido && /correction|creative|up-do/i.test(escolhido[0])
      ? "This one starts with a consultation — send the request and the front desk will set it up."
      : null;

  const enviar = async (e) => {
    e.preventDefault();
    setEnvio("indo");
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "three-degrees", negocio: "Three Degrees Salon",
          nome: form.nome, telefone: form.tel,
          mensagem: `[${escolhido ? `${escolhido[0]} · ${escolhido[1]} · ${escolhido[2]}` : "service?"}] ${form.quando || "any time"}` }),
      });
      const d = await r.json().catch(() => null);
      setEnvio(d && d.ok ? { ok: true, ligacao: d.ligacao } : { erro: (d && d.error) || `HTTP ${r.status}` });
    } catch (err) { setEnvio({ erro: String(err).slice(0, 90) }); }
  };

  return (
    <div className="tdb-raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600;700&family=Karla:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        /* mesmo grão de papel da vitrine — a página de booking não pode parecer outro site */
        .tdb-raiz::before{content:'';position:fixed;inset:0;pointer-events:none;opacity:.35;z-index:0;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.55 0 0 0 0 0.53 0 0 0 0 0.47 0 0 0 .05 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");}
        .tdb-raiz > *{position:relative;z-index:1;}
        .tdb-raiz{--washi:#F7F4EC;--washi2:#EFEBE0;--sumi:#1B1A17;--sumi2:#57544C;
          --ouro:#F5B907;--ouro-e:#C79007;--linha:#DDD7C8;--papel:#FFFFFF;
          background:var(--washi);color:var(--sumi);min-height:100vh;
          font-family:'Karla',system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
        .tdb-disp{font-family:'Shippori Mincho',Georgia,serif;font-weight:600;}
        .tdb-mono{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;}
        .tdb-rot{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:500;
          letter-spacing:.26em;text-transform:uppercase;color:var(--sumi2);}
        .tdb-sub{display:block;width:64px;height:3px;background:var(--ouro);margin:14px 0 0;}
        .tdb-cartao{background:var(--papel);border:1px solid var(--linha);border-top-color:#E8E3D6;
          border-radius:20px;position:relative;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.85),inset 0 -1px 0 rgba(27,26,23,.07),
            0 1px 2px rgba(27,26,23,.10),0 18px 40px -18px rgba(27,26,23,.18);}
        /* PADRÃO-VITRINE §5 — alvo de toque (o diff com o WS mostrou que faltava aqui) */
        .tdb-raiz a,.tdb-raiz button{min-height:38px;}
        .tdb-raiz .tdb-item{min-height:44px;}
        .tdb-cartao::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
          background:linear-gradient(115deg,rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 38%);opacity:.6;}
        .tdb-cartao > *{position:relative;z-index:1;}
        .tdb-b{display:inline-flex;align-items:center;gap:.5rem;border-radius:999px;font-weight:700;
          font-size:15px;padding:13px 26px;text-decoration:none;cursor:pointer;border:1px solid transparent;
          transition:transform .12s ease,box-shadow .2s ease,background .2s ease;}
        .tdb-b:active{transform:scale(.985);}
        /* mesmo SELO da vitrine — o botão é a assinatura, e assinatura não muda de página */
        .tdb-b1{position:relative;overflow:hidden;border-radius:10px;
          background:linear-gradient(180deg,#232220,var(--sumi));color:var(--washi);
          border:1.5px solid var(--ouro);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 1px 2px rgba(27,26,23,.22),
            0 14px 30px -16px rgba(27,26,23,.55);}
        .tdb-b1::after{content:'';position:absolute;inset:0;pointer-events:none;
          background:linear-gradient(105deg,transparent 34%,rgba(245,185,7,.30) 47%,transparent 60%);
          transform:translateX(-120%);transition:transform .75s cubic-bezier(.22,1,.36,1);}
        .tdb-b1:hover::after{transform:translateX(120%);}
        .tdb-b1:hover{border-color:#FFD23F;}
        .tdb-selo-logo{display:grid;place-items:center;flex:0 0 auto;width:44px;height:44px;
          border-radius:12px;overflow:hidden;background:var(--papel);
          border:1px solid var(--linha);border-top-color:#EFEADC;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 1px 2px rgba(27,26,23,.14),
            0 8px 18px -10px rgba(27,26,23,.30);transition:transform .2s ease,box-shadow .25s ease;}
        .tdb-selo-logo img{width:100%;height:100%;object-fit:contain;padding:3px;}
        .tdb-marca:hover .tdb-selo-logo{transform:translateY(-1px);}
        .tdb-fone-mini{display:none;}
        @media (max-width:379px){.tdb-fone-full{display:none;}.tdb-fone-mini{display:inline;}}
        .tdb-gr{color:var(--ouro);font-family:'Shippori Mincho',serif;margin-left:.35em;}
        .tdb-b2{background:var(--papel);color:var(--sumi);border:1.5px solid var(--linha);border-radius:10px;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 1px 2px rgba(27,26,23,.10);
          transition:border-color .2s ease,box-shadow .25s ease,transform .14s ease;}
        .tdb-b2:hover{border-color:var(--ouro);box-shadow:inset 0 1px 0 #fff,0 0 0 3px rgba(245,185,7,.12),
          0 10px 20px -12px rgba(27,26,23,.4);}
        .tdb-b2:active{transform:translateY(1px);}
        .tdb-aba{border:0;background:transparent;cursor:pointer;font-family:inherit;font-weight:700;
          font-size:14px;padding:9px 16px;border-radius:999px;color:var(--sumi2);transition:all .18s ease;}
        .tdb-aba[data-on="1"]{background:var(--sumi);color:var(--washi);}
        .tdb-item{display:flex;align-items:flex-start;gap:.8rem;width:100%;text-align:left;cursor:pointer;
          background:transparent;border:0;border-bottom:1px solid var(--washi2);padding:13px 4px;color:inherit;
          transition:background .16s ease;}
        .tdb-item:hover{background:rgba(245,185,7,.06);}
        .tdb-item[data-on="1"]{background:rgba(245,185,7,.13);}
        .tdb-inp{width:100%;border-radius:14px;border:1px solid var(--linha);background:var(--papel);
          padding:12px 15px;font-size:15px;outline:none;color:var(--sumi);}
        .tdb-inp:focus{border-color:var(--sumi);box-shadow:0 0 0 3px rgba(27,26,23,.08);}
        @media (prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>

      <header className="mx-auto flex max-w-5xl flex-nowrap items-center justify-between gap-3 px-4 pb-3 pt-5 sm:px-5 sm:pt-6">
        <a href={B} className="tdb-marca flex min-w-0 items-center gap-2.5 no-underline" style={{ color: "inherit" }}>
          <span className="tdb-selo-logo"><img src={`${B}/logo.jpg`} alt="Three Degrees Salon" width="44" height="44" /></span>
          <span className="min-w-0">
            <span className="tdb-disp block truncate text-[clamp(14px,3.6vw,16px)] leading-none tracking-[.04em]">THREE DEGREES</span>
            <span className="tdb-rot mt-1 block truncate" style={{ fontSize: "clamp(8.5px,2.2vw,10.5px)" }}>← back to the salon</span>
          </span>
        </a>
        <a href={`tel:${TEL}`} className="tdb-b tdb-b2 shrink-0" style={{ padding: "11px 18px", fontSize: 14 }}>
          <span className="tdb-fone-full">Call {TEL_FMT}</span><span className="tdb-fone-mini">Call</span>
        </a>
      </header>

      <section className="mx-auto max-w-5xl px-5 pt-6">
        <div className="tdb-rot" style={{ color: "var(--ouro-e)" }}>Booking · 204 E 6th Street</div>
        <h1 className="tdb-disp mt-2 text-[clamp(1.9rem,5vw,3rem)] leading-tight">Pick your service.</h1>
        <span className="tdb-sub" />
        <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed" style={{ color: "var(--sumi2)" }}>
          Every service the salon offers, with the real price and the real time in the chair. Choose
          one and tell us when — the front desk confirms your exact slot.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-5 pt-7">
        <div className="flex flex-wrap gap-2">
          {MENU.map((m) => (
            <button key={m.g} type="button" className="tdb-aba" data-on={m.g === grupo ? "1" : "0"}
              onClick={() => setGrupo(m.g)}>
              {m.g} <span className="tdb-mono text-[11.5px] opacity-60">{m.itens.length}</span>
            </button>
          ))}
        </div>

        <div className="tdb-cartao mt-5 p-5 sm:p-6" style={atual.destaque ? { borderColor: "var(--ouro)" } : undefined}>
          {atual.destaque && (
            <div className="tdb-rot mb-2" style={{ color: "var(--ouro-e)" }}>The specialty · what people research this salon for</div>
          )}
          {atual.itens.map((it) => {
            const on = escolhido && escolhido[0] === it[0];
            return (
              <button key={it[0]} type="button" className="tdb-item" data-on={on ? "1" : "0"}
                onClick={() => { setEscolhido(it); setEnvio(null); pedido.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px]"
                  style={{ border: `1.5px solid ${on ? "var(--ouro-e)" : "var(--linha)"}`, background: on ? "var(--ouro)" : "transparent", color: "#241C03" }}>
                  {on ? "✓" : ""}
                </span>
                {(() => { const q = quemFaz(it[0]); return q ? (
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full" style={{ border: "1px solid var(--linha)" }}>
                    <img src={`${B}/${FOTO[q]}.jpg`} alt={q} className="h-full w-full object-cover" loading="lazy" />
                  </span>
                ) : null; })()}
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold leading-snug">{it[0]}</span>
                  {it[3] && <span className="mt-0.5 block text-[12.5px]" style={{ color: "var(--sumi2)" }}>{it[3]}</span>}
                </span>
                <span className="shrink-0 text-right">
                  <span className="tdb-mono block text-[15px]">{it[2]}</span>
                  <span className="tdb-mono block text-[11.5px]" style={{ color: "var(--sumi2)" }}>{it[1]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section ref={pedido} className="mx-auto max-w-5xl px-5 py-8">
        <div className="tdb-cartao p-5 sm:p-7">
          {envio && envio.ok ? (
            <div>
              <div className="tdb-disp text-[20px]" style={{ color: "var(--ouro-e)" }}>Request received.</div>
              <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--sumi2)" }}>
                {envio.ligacao === "disparada"
                  ? "Your phone is about to ring — that's the salon's assistant calling you back to confirm."
                  : "The front desk will call you back to confirm your exact time."}
              </p>
              <a href={B} className="tdb-b tdb-b2 mt-4">Back to the salon</a>
            </div>
          ) : (
            <>
              <div className="tdb-rot">Your request</div>
              <div className="mt-1.5 flex items-center gap-3">
                {escolhido && quemFaz(escolhido[0]) && (
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full" style={{ border: "1.5px solid var(--ouro)" }}>
                    <img src={`${B}/${FOTO[quemFaz(escolhido[0])]}.jpg`} alt={quemFaz(escolhido[0])} className="h-full w-full object-cover" />
                  </span>
                )}
                <div className="tdb-disp text-[19px]">{escolhido ? escolhido[0] : "Choose one above and it lands here"}</div>
              </div>
              {escolhido && (
                <div className="tdb-mono mt-1 text-[13.5px]" style={{ color: "var(--sumi2)" }}>
                  {escolhido[2]} · {escolhido[1]} in the chair
                </div>
              )}
              {alerta && (
                <p className="mt-3 rounded-xl px-4 py-3 text-[13.5px] leading-relaxed"
                  style={{ background: "rgba(245,185,7,.12)", border: "1px solid rgba(245,185,7,.4)" }}>
                  {alerta}
                </p>
              )}
              <form onSubmit={enviar} className="mt-5 grid gap-3 sm:grid-cols-2">
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Your name" className="tdb-inp" />
                <input required type="tel" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })}
                  placeholder="Phone" className="tdb-inp" />
                <select value={form.quando} onChange={(e) => setForm({ ...form, quando: e.target.value })}
                  className="tdb-inp sm:col-span-2" style={{ color: form.quando ? "var(--sumi)" : "#9B968A" }}>
                  <option value="">When works for you?</option>
                  <option>As soon as possible</option>
                  <option>This week, mornings</option>
                  <option>This week, afternoons</option>
                  <option>Weekend</option>
                  <option>I&apos;m flexible</option>
                </select>
                {envio && envio.erro && (
                  <p className="text-[13.5px] font-bold sm:col-span-2" style={{ color: "#B3261E" }}>
                    Didn&apos;t send: {envio.erro} — please call {TEL_FMT}.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                  {/* Luis (26/08): o botão estava CINZA e dizia a mecânica interna do salão.
                      Desativado agora é o mesmo selo com menos luz — nunca outra peça —, e a
                      promessa é o que a pessoa quer: começar a transformação dela. */}
                  <button type="submit" disabled={!escolhido || envio === "indo"} className="tdb-b tdb-b1"
                    style={!escolhido ? { opacity: .55, cursor: "not-allowed", filter: "saturate(.5)" } : undefined}>
                    {envio === "indo" ? "Sending…" : "Start my transformation"}
                    <span className="tdb-gr">°</span>
                  </button>
                  <a href={`tel:${TEL}`} className="text-[14px] font-bold" style={{ color: "var(--ouro-e)" }}>
                    or call {TEL_FMT}
                  </a>
                </div>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[13px]" style={{ color: "var(--sumi2)" }}>
          Prefer the salon&apos;s own calendar?{" "}
          <a href={BOOKER} target="_blank" rel="noreferrer" className="font-bold underline-offset-2 hover:underline" style={{ color: "var(--ouro-e)" }}>
            open it on Booker
          </a>{" "}
          · already booked?{" "}
          <a href="https://go.booker.com/location/threedegreesnyc/account" target="_blank" rel="noreferrer"
            className="font-bold underline-offset-2 hover:underline" style={{ color: "var(--ouro-e)" }}>
            modify or cancel
          </a>{" "}
          · consultations:{" "}
          <a href={`mailto:${EMAIL}`} className="font-bold underline-offset-2 hover:underline" style={{ color: "var(--ouro-e)" }}>{EMAIL}</a>
        </p>
      </section>
    </div>
  );
}
