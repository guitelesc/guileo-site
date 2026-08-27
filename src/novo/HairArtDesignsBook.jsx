/* ══════════════════════════════════════════════════════════════════════════════════════════════
   HAIR ART DESIGNS — página de agendamento, no NOSSO domínio.
   PADRAO-VITRINE.md §6: cardápio COMPLETO lido do sistema de booking DELE (Phorest, 32 serviços),
   regra da casa NA ESCOLHA, mesmo header/selo/material da vitrine. A foto do profissional NÃO vai
   na linha aqui (o Phorest deles não mapeia quem faz o quê) — vai no cartão do pedido, onde é verdade.
   O Phorest fica como saída SECUNDÁRIA no rodapé.

   ⚠️ DURAÇÃO não aparece: o Phorest deles não publica. Sem fonte, não se escreve — inventar
   "45 min" é o mesmo defeito do preço-âncora, só que na agenda.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useMemo, useRef, useCallback, useEffect } from "react";

const TEL = "+12123004407";
const TEL_FMT = "(212) 300-4407";
const TEXTO = "+13323233125";
const TEXTO_FMT = "(332) 323-3125";
const PHOREST = "https://phorest.com/book/salons/hairartdesigns";
const B = "/novo/hair-art-designs";

/* Quem atende. Foto pareada no mesmo nó do Phorest; Amelia não tem foto lá e fica sem. */
const ARTISTAS = [
  { nome: "Iryna", papel: "Founder · Senior Stylist", foto: "iryna" },
  { nome: "Jenipher", papel: "Senior Stylist", foto: "jenipher" },
  { nome: "Rafael", papel: "Senior Stylist", foto: "rafael" },
  { nome: "Evgeniia", papel: "Senior Stylist", foto: "evgeniia" },
  { nome: "Amelia", papel: "Assistant", foto: null },
];

/* [nome, preço-base, é "a partir de"?, regra da casa que aparece NA ESCOLHA] */
const GRUPOS = [
  { cat: "Haircut", itens: [
    ["Short Haircut", 95, true, "Includes consultation, shampoo and scalp massage, finished with a blowout."],
    ["Medium Haircut", 125, true, "Includes consultation, shampoo and scalp massage, finished with a blowout."],
    ["Thick / Long Haircut", 145, true, "Includes consultation, shampoo and scalp massage, finished with a blowout."],
    ["Bob", 115, false, "The one flat price on the menu — no range."],
    ["Kids Hair Cut", 90, true, ""],
    ["Bang Trim", 15, true, ""],
  ]},
  { cat: "Hair colour", itens: [
    ["Balayage Full Head", 350, true, "The house speciality. Iryna will tell you which technique she is using and why before she starts."],
    ["Balayage Half Head", 275, true, ""],
    ["Highlights Full Head", 350, true, ""],
    ["Highlights Half Head", 275, true, ""],
    ["Foliage Full Head", 350, true, ""],
    ["Foliage Half Head", 265, true, ""],
    ["Custom Colour", 380, true, "Designed for your hair — the figure is agreed at the consultation."],
    ["Double Process", 400, true, ""],
    ["Platinum All Over", 400, true, ""],
    ["Platinum New Growth", 220, true, "For hair already platinum — the regrowth only."],
    ["Platinum Over Grown", 300, true, "When the regrowth has gone past a few inches."],
    ["All Over Single Colour", 185, true, ""],
    ["Root Touch Up", 145, true, ""],
    ["Root Shadow", 50, true, ""],
    ["Base Break", 50, true, ""],
    ["Low Lights", 85, true, ""],
    ["Face Frame", 195, true, ""],
    ["Toner", 85, true, ""],
    ["Colour Correction", 150, true, "Charged by the hour — how long it takes depends on what has to be undone."],
    ["Eyebrow Tint", 10, true, ""],
  ]},
  { cat: "Hair treatments", itens: [
    ["Keratin", 350, true, "Smoothing treatment."],
    ["Deep Treatment", 50, true, ""],
    ["K18", 50, true, ""],
    ["Wella Ultra Repair", 50, true, ""],
  ]},
  { cat: "Styling", itens: [
    ["Blow Out and Style", 65, true, ""],
    ["Updos", 120, true, ""],
  ]},
];

const TETO = {
  "Short Haircut": 125, "Medium Haircut": 145, "Thick / Long Haircut": 175, "Bang Trim": 45,
  "Balayage Full Head": 600, "Balayage Half Head": 350, "Highlights Full Head": 600,
  "Highlights Half Head": 350, "Foliage Full Head": 600, "Foliage Half Head": 350,
  "Custom Colour": 650, "Double Process": 650, "Platinum New Growth": 300, "Platinum Over Grown": 450,
  "All Over Single Colour": 250, "Root Touch Up": 165, "Toner": 150, "Blow Out and Style": 85,
  "Updos": 250, "Keratin": 450,
};

const faixa = (nome, base, aberto) => {
  if (!aberto) return "$" + base;
  const t = TETO[nome];
  return t ? "$" + base + "–$" + t : "from $" + base;
};

export default function HairArtDesignsBook() {
  const [cat, setCat] = useState("Haircut");
  const [sel, setSel] = useState(null);          // nome do serviço
  const [artista, setArtista] = useState("");
  const [form, setForm] = useState({ nome: "", tel: "", quando: "", recado: "" });
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [rel, setRel] = useState({ hora: "", aberto: false });
  const cesta = useRef(null);

  useEffect(() => {
    const tick = () => {
      const f = (o) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...o }).format(new Date());
      const h = Number(f({ hour: "numeric", hour12: false }));
      setRel({ hora: f({ hour: "numeric", minute: "2-digit", hour12: true }), aberto: h >= 11 && h < 20 });
    };
    tick(); const id = setInterval(tick, 30000); return () => clearInterval(id);
  }, []);

  const escolhido = useMemo(() => {
    if (!sel) return null;
    for (const g of GRUPOS) {
      const it = g.itens.find(([n]) => n === sel);
      if (it) return { cat: g.cat, nome: it[0], base: it[1], aberto: it[2], regra: it[3] };
    }
    return null;
  }, [sel]);

  const enviar = useCallback(async (e) => {
    e.preventDefault();
    setErro("");
    let ok;
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "hair-art-designs", negocio: "Hair Art Designs",
          nome: form.nome, telefone: form.tel,
          mensagem: "[BOOKING] " + (escolhido ? escolhido.nome + " · " + faixa(escolhido.nome, escolhido.base, escolhido.aberto) : "service?")
            + (artista ? " · with " + artista : " · any artist")
            + " · " + (form.quando || "any time")
            + (form.recado ? " · note: " + form.recado : ""),
        }),
      });
      const d = await r.json().catch(() => null);
      ok = !!(d && d.ok);
    } catch { ok = false; }
    if (ok) setEnviado(true);
    else setErro("That didn't send — call " + TEL_FMT + ", someone picks up.");
  }, [form, escolhido, artista]);

  const grupo = GRUPOS.find((g) => g.cat === cat) || GRUPOS[0];
  const quemFaz = ARTISTAS.find((a) => a.nome === artista);

  return (
    <div className="ha-raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Jost:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .ha-raiz{
          --papel:#F6F3EE; --papel2:#EDE8E0; --branco:#FFFFFF;
          --tinta:#2C3330; --tinta2:#5E6B65; --tinta3:#8C978F;
          --salvia:#A8C8C0; --salvia-e:#6E9A8F; --salvia-f:#4A6B62;
          --pessego:#D4A078; --pessego-e:#B87B4E; --linha:#DCD5CA;
          background:var(--papel); color:var(--tinta); min-height:100vh;
          font-family:'Jost',system-ui,-apple-system,sans-serif; position:relative; overflow-x:hidden;
        }
        .ha-raiz::before{
          content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.35;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.42'/%3E%3C/svg%3E");
        }
        .ha-raiz > *{position:relative; z-index:1;}
        .ha-serif{font-family:'Cormorant Garamond',Georgia,serif;}
        .ha-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;}
        .ha-eyebrow{font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.2em;
          text-transform:uppercase; color:var(--salvia-f);}
        .ha-selo{
          position:relative; display:inline-flex; align-items:center; gap:9px; overflow:hidden;
          min-height:52px; padding:0 24px; border-radius:10px; font-weight:600; font-size:15px;
          text-decoration:none; color:var(--tinta); background:var(--branco);
          background-image:linear-gradient(180deg,rgba(255,255,255,.9),rgba(237,232,224,.9));
          border:1.5px solid var(--salvia-e);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(74,107,98,.12),
                     0 1px 2px rgba(44,51,48,.14), 0 14px 26px -18px rgba(44,51,48,.5);
          transition:border-color .25s, box-shadow .25s, transform .12s;
        }
        .ha-selo::after{content:""; position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(115deg,transparent 30%,rgba(168,200,192,.55) 48%,transparent 66%);
          transform:translateX(-120%); transition:transform .75s ease;}
        .ha-selo:hover::after{transform:translateX(120%);}
        .ha-selo:active{transform:scale(.985);}
        .ha-selo[disabled],.ha-selo.off{opacity:.55; filter:saturate(.5); pointer-events:none;}
        .ha-selo-forte{border-color:var(--pessego-e); background-image:linear-gradient(180deg,#FFF,#F3E4D6);}
        .ha-selo-forte::after{background:linear-gradient(115deg,transparent 30%,rgba(212,160,120,.6) 48%,transparent 66%);}
        .ha-card{position:relative; border-radius:20px; background:var(--branco); border:1px solid var(--linha);
          box-shadow:inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(44,51,48,.06),
                     0 1px 2px rgba(44,51,48,.06), 0 26px 48px -34px rgba(44,51,48,.42); overflow:hidden;}
        .ha-card::after{content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
          background:linear-gradient(115deg,rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 42%,rgba(255,255,255,.14) 100%);}
        .ha-card > *{position:relative; z-index:2;}
        .ha-pilula{min-height:44px; padding:0 16px; border-radius:999px; border:1px solid var(--linha);
          background:var(--branco); color:var(--tinta2); font-size:13.5px; font-weight:500;
          transition:border-color .2s,color .2s,background .2s;}
        .ha-pilula:hover{border-color:var(--salvia-e); color:var(--tinta);}
        .ha-pilula[data-on="1"]{border-color:var(--salvia-f); background:rgba(168,200,192,.2); color:var(--tinta);}
        .ha-campo{width:100%; min-height:52px; padding:0 16px; border-radius:12px;
          border:1px solid var(--linha); background:var(--branco); color:var(--tinta); font-size:15px;}
        .ha-campo::placeholder{color:var(--tinta3);}
        .ha-campo:focus{outline:none; border-color:var(--salvia-f); box-shadow:0 0 0 3px rgba(168,200,192,.3);}
        .ha-linha{display:flex; align-items:center; gap:12px; width:100%; text-align:left;
          min-height:56px; padding:10px 4px; border-bottom:1px solid var(--linha); transition:background .18s;}
        .ha-linha:hover{background:rgba(168,200,192,.1);}
        .ha-linha[data-on="1"]{background:rgba(168,200,192,.2);}
        .ha-pulso{position:relative; display:inline-flex; width:7px; height:7px; border-radius:999px;}
        .ha-pulso::after{content:""; position:absolute; inset:0; border-radius:inherit; background:inherit;
          animation:ha-ping 2.4s cubic-bezier(0,0,.2,1) infinite;}
        @keyframes ha-ping{0%{transform:scale(1);opacity:.7}80%,100%{transform:scale(2.6);opacity:0}}
        @media (prefers-reduced-motion: reduce){ .ha-pulso::after{animation:none;} }
      `}</style>

      {/* MESMO cabeçalho da vitrine — marca e ação na mesma linha */}
      <header className="sticky top-0 z-30 border-b" style={{ borderColor: "var(--linha)", background: "rgba(246,243,238,.86)", backdropFilter: "blur(14px)" }}>
        <div className="mx-auto flex max-w-5xl flex-nowrap items-center gap-3 px-4 py-3">
          <a href={B} className="flex min-w-0 flex-nowrap items-center gap-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl"
              style={{ background: "var(--branco)", border: "1px solid var(--linha)", boxShadow: "inset 0 1px 0 rgba(255,255,255,1), 0 1px 2px rgba(44,51,48,.12)" }}>
              <img src={B + "/logo.png"} alt="Hair Art Designs" width="34" height="20" className="w-[34px]" />
            </span>
            <span className="ha-serif min-w-0 truncate font-semibold" style={{ fontSize: "clamp(15px,3.6vw,21px)" }}>Hair Art Designs</span>
          </a>
          <span className="flex-1" />
          <a href={"tel:" + TEL} className="ha-selo ha-selo-forte shrink-0" style={{ padding: "0 18px" }}>
            <span aria-hidden>☎</span><span className="hidden sm:inline">{TEL_FMT}</span><span className="sm:hidden">Call</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="ha-eyebrow">Booking</div>
        <h1 className="ha-serif mt-2 font-semibold" style={{ fontSize: "clamp(30px,5.4vw,50px)", lineHeight: 1.06, textWrap: "balance" }}>
          Pick the service. See the price. Then who does it.
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium">
            <span className="ha-pulso" style={{ background: rel.aberto ? "var(--salvia-f)" : "var(--pessego-e)" }} />
            <span className="ha-mono">{rel.aberto ? "Open now" : "Closed"} · {rel.hora} NYC</span>
          </span>
          <span className="ha-eyebrow">Open 7 days · 11am–8pm</span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
          {/* ── CARDÁPIO ───────────────────────────────────────────────────────────────── */}
          <div>
            <div className="flex flex-wrap gap-2">
              {GRUPOS.map((g) => (
                <button key={g.cat} type="button" onClick={() => setCat(g.cat)} className="ha-pilula" data-on={cat === g.cat ? "1" : "0"}>
                  {g.cat} <span className="ha-mono ml-1 text-[11px] opacity-60">{g.itens.length}</span>
                </button>
              ))}
            </div>

            <div className="ha-card mt-4 px-5 py-2">
              {grupo.itens.map(([nome, base, aberto, regra]) => (
                <button key={nome} type="button" data-on={sel === nome ? "1" : "0"}
                  onClick={() => { setSel(nome); cesta.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}
                  className="ha-linha">
                  {/* SEM AVATAR NA LINHA — de propósito. O Phorest deles não diz QUEM faz cada
                      serviço, então uma foto aqui afirmaria o que ninguém disse. E o mesmo ícone
                      repetido 20 vezes é decoração, não informação: é o que dá cara de AI.
                      O rosto aparece uma vez só, no cartão do pedido, onde significa algo. */}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium leading-snug">{nome}</span>
                    {/* A REGRA DA CASA APARECE NA ESCOLHA, não no rodapé */}
                    {regra && <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: "var(--tinta3)" }}>{regra}</span>}
                  </span>
                  <span className="ha-mono shrink-0 text-[13.5px]" style={{ color: "var(--salvia-f)" }}>{faixa(nome, base, aberto)}</span>
                </button>
              ))}
            </div>

            <div className="mt-5">
              <div className="ha-eyebrow">Who do you want?</div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" onClick={() => setArtista("")} className="ha-pilula" data-on={artista === "" ? "1" : "0"}>Whoever is free</button>
                {ARTISTAS.map((a) => (
                  <button key={a.nome} type="button" onClick={() => setArtista(a.nome)} className="ha-pilula" data-on={artista === a.nome ? "1" : "0"}>
                    {a.nome}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── O PEDIDO ───────────────────────────────────────────────────────────────── */}
          <aside ref={cesta} className="lg:sticky lg:top-24 lg:self-start">
            <div className="ha-card p-5">
              {enviado ? (
                <div className="py-4 text-center">
                  <div className="ha-serif text-[26px] font-semibold" style={{ color: "var(--salvia-f)" }}>Sent.</div>
                  <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                    The salon has your request. If you would rather not wait, {TEL_FMT} rings the front desk.
                  </p>
                </div>
              ) : (
                <form onSubmit={enviar}>
                  <div className="ha-eyebrow">Your appointment</div>
                  {escolhido ? (
                    <div className="mt-3">
                      <div className="flex items-start gap-3">
                        {quemFaz?.foto ? (
                          <img src={B + "/staff/" + quemFaz.foto + ".jpg"} alt={quemFaz.nome} width="44" height="44"
                            className="h-11 w-11 shrink-0 rounded-full object-cover" style={{ border: "2px solid var(--salvia)" }} />
                        ) : null}
                        <div className="min-w-0">
                          <div className="ha-serif text-[20px] font-semibold leading-tight">{escolhido.nome}</div>
                          <div className="ha-mono mt-0.5 text-[14px]" style={{ color: "var(--salvia-f)" }}>
                            {faixa(escolhido.nome, escolhido.base, escolhido.aberto)}
                          </div>
                          <div className="ha-eyebrow mt-1">{artista ? "with " + artista : "any artist"}</div>
                        </div>
                      </div>
                      {escolhido.aberto && (
                        <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                          A starting price. The exact figure is agreed at the consultation, before anything is mixed.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                      Choose a service on the left and it lands here, priced.
                    </p>
                  )}

                  <div className="mt-4 space-y-2.5">
                    <input className="ha-campo" placeholder="Your name" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
                    <input className="ha-campo" type="tel" placeholder="Phone" value={form.tel} onChange={(e) => setForm((f) => ({ ...f, tel: e.target.value }))} />
                    <input className="ha-campo" placeholder="When suits you?" value={form.quando} onChange={(e) => setForm((f) => ({ ...f, quando: e.target.value }))} />
                    <textarea className="ha-campo py-3" rows={2} placeholder="Anything they should know? (optional)"
                      value={form.recado} onChange={(e) => setForm((f) => ({ ...f, recado: e.target.value }))} style={{ minHeight: 70, resize: "vertical" }} />
                  </div>

                  <button type="submit" disabled={!escolhido || !form.nome.trim() || !form.tel.trim()}
                    className={"ha-selo ha-selo-forte mt-4 w-full justify-center" + (escolhido && form.nome.trim() && form.tel.trim() ? "" : " off")}>
                    <span aria-hidden>✦</span> Request this appointment
                  </button>
                  {erro && <p className="mt-2.5 text-[13px]" style={{ color: "var(--pessego-e)" }}>{erro}</p>}

                  <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                    Cancelling more than 24 hours ahead is free. Inside 24 hours is 50% of the booked service.
                  </p>
                </form>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <a href={"tel:" + TEL} className="ha-card flex min-h-[52px] items-center gap-3 px-4 text-[14.5px]">
                <span aria-hidden style={{ color: "var(--pessego-e)" }}>☎</span> Call {TEL_FMT}
              </a>
              <a href={"sms:" + TEXTO} className="ha-card flex min-h-[52px] items-center gap-3 px-4 text-[14.5px]">
                <span aria-hidden style={{ color: "var(--pessego-e)" }}>✉</span> Text {TEXTO_FMT}
              </a>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t" style={{ borderColor: "var(--linha)", background: "var(--papel2)" }}>
        <div className="mx-auto max-w-5xl px-4 py-8 text-[13px]" style={{ color: "var(--tinta3)" }}>
          <a href={B} className="underline" style={{ color: "var(--tinta2)" }}>← Back to the salon</a>
          <span className="px-2">·</span>
          {/* O provedor deles fica como saída SECUNDÁRIA, aqui embaixo */}
          <a href={PHOREST} target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--tinta2)" }}>
            Book on their own system
          </a>
        </div>
      </footer>
    </div>
  );
}
