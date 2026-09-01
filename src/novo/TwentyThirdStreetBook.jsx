/* ══════════════════════════════════════════════════════════════════════════════════════════════
   23RD STREET HAIR SALON — página de agendamento, no NOSSO domínio.
   PADRAO-VITRINE.md §6: cardápio COMPLETO (30 serviços, extensões PRIMEIRO), regra da casa NA
   ESCOLHA, mesmo header/selo/material/paleta ROXA da vitrine. A foto do profissional NÃO vai na
   linha (eles não mapeiam quem faz o quê) — nem no cartão (nenhum especialista tem headshot).

   O provedor deles NÃO tem sistema online (o site é WordPress/telefone), então no RODAPÉ o link
   secundário é o SITE DELES, com texto "Their current site" — não um provedor de booking.

   ⚠️ DURAÇÃO não aparece: eles não publicam. Sem fonte, não se escreve — inventar "45 min" é o
   mesmo defeito do preço-âncora, só que na agenda. HORÁRIO por semana também não é sabido: o selo
   vivo mostra só a hora de NY + same-day, nunca aberto/fechado.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useMemo, useRef, useCallback, useEffect } from "react";

const TEL = "+16468629323";
const TEL_FMT = "(646) 862-9323";
const TEXTO = "+19173090101";
const TEXTO_FMT = "(917) 309-0101";
const SITE_DELES = "https://23rdstreethairsalon.com/";
const B = "/novo/23rd-street";

/* Os 7 especialistas do site deles. Foto NÃO: nenhum tem headshot publicado. Duneisy é a das
   extensões citada em quase todo review. */
const ARTISTAS = [
  { nome: "Duneisy", papel: "Extension Specialist", foto: null },
  { nome: "Tina", papel: "Colorist · Makeup", foto: null },
  { nome: "Dilya", papel: "Stylist · Makeup", foto: null },
  { nome: "Lydia", papel: "Stylist", foto: null },
  { nome: "Yana", papel: "Extensions Specialist", foto: null },
  { nome: "Nancy", papel: "Extensions Specialist", foto: null },
  { nome: "Julia", papel: "Junior Stylist · Makeup", foto: null },
];

/* [nome, preço-base, é "a partir de"?, regra da casa que aparece NA ESCOLHA] — extensões primeiro */
const GRUPOS = [
  { cat: "Hair extensions", itens: [
    ["K-Tips", 1250, true, "Individual keratin bonds, installed and blended. Priced by length and how much hair — agreed at the consultation."],
    ["Tape-Ins", 1250, true, "Wefts taped in and blended. Same range applies by length and volume."],
    ["Weft", 1150, true, ""],
    ["Beaded I-Tip / Microlinks", 1150, true, "No heat, no glue — beaded strands. Duneisy's I-tips are the ones reviewers say last."],
    ["Brazilian Knots", 1450, true, ""],
    ["Nano / Ice", 1550, true, "The finest, most discreet bonds."],
    ["Clip-Ins", 875, true, "Custom clip-ins, coloured and cut to blend."],
    ["Extension Removal", 100, true, "From — depends on the method and how many."],
  ]},
  { cat: "Color", itens: [
    ["Balayage / Full Head Highlights (with toner)", 335, true, "Hand-painted, finished with a toning gloss."],
    ["Highlights", 220, true, ""],
    ["Partial Highlights", 150, true, ""],
    ["Single Colour", 140, true, ""],
    ["Money Piece", 145, false, "A flat price — the brightened front pieces only."],
    ["Clear Gloss / Toner", 95, false, ""],
    ["Colour Correction", 540, true, "Charged by the work — how long depends on what has to be undone."],
  ]},
  { cat: "Haircuts", itens: [
    ["Women's Haircut", 95, true, "Consultation, wash and finish."],
    ["Men's Haircut", 65, false, ""],
    ["Girls Haircut (under 10)", 55, false, ""],
    ["Just A Wash", 20, false, ""],
    ["Bang Trim", 20, false, ""],
  ]},
  { cat: "Treatments", itens: [
    ["Keratin Treatment", 250, true, "Smoothing treatment."],
    ["Japanese Straightening", 300, true, ""],
    ["Moroccan Oil Treatment", 45, true, ""],
    ["Olaplex Add-On", 35, false, "Bond-builder added to any colour service."],
  ]},
  { cat: "Style & makeup", itens: [
    ["Blowout", 65, true, ""],
    ["Hollywood Waves Blowout", 55, false, ""],
    ["Up-Do", 85, true, ""],
    ["Evening Makeup", 130, false, ""],
    ["Bridal Trial Makeup", 130, true, ""],
    ["Bridal Makeup (day of)", 180, true, ""],
  ]},
];

const TETO = {
  "K-Tips": 1550, "Tape-Ins": 1550, "Weft": 1450, "Beaded I-Tip / Microlinks": 1450,
  "Brazilian Knots": 1650, "Nano / Ice": 1850, "Clip-Ins": 1100, "Extension Removal": 250,
  "Balayage / Full Head Highlights (with toner)": 385, "Highlights": 265,
  "Partial Highlights": 200, "Single Colour": 180, "Colour Correction": 750,
  "Women's Haircut": 130, "Keratin Treatment": 350, "Japanese Straightening": 450,
  "Moroccan Oil Treatment": 65, "Blowout": 85, "Up-Do": 150, "Bridal Trial Makeup": 185,
  "Bridal Makeup (day of)": 270,
};

const faixa = (nome, base, aberto) => {
  if (!aberto) return "$" + base;
  const t = TETO[nome];
  return t ? "$" + base + "–$" + t : "from $" + base;
};

export default function TwentyThirdStreetBook() {
  const [cat, setCat] = useState("Hair extensions");
  const [sel, setSel] = useState(null);          // nome do serviço
  const [artista, setArtista] = useState("");
  const [form, setForm] = useState({ nome: "", tel: "", quando: "", recado: "" });
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [hora, setHora] = useState("");
  const cesta = useRef(null);

  useEffect(() => {
    const tick = () => setHora(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date()));
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
          slug: "23rd-street", negocio: "23rd Street Hair Salon",
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

  return (
    <div className="ha-raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,700;1,6..96,400&family=Jost:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .ha-raiz{
          --papel:#F7F4F9; --papel2:#EEE8F2; --branco:#FFFFFF;
          --tinta:#1A1420; --tinta2:#5C5266; --tinta3:#948A9E;
          --roxo:#6C00A8; --roxo-e:#8B2FC9; --roxo-f:#4A0072; --linha:#E0D6E6;
          background:var(--papel); color:var(--tinta); min-height:100vh;
          font-family:'Jost',system-ui,-apple-system,sans-serif; position:relative; overflow-x:hidden;
        }
        .ha-raiz::before{
          content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.30;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.42'/%3E%3C/svg%3E");
        }
        .ha-raiz > *{position:relative; z-index:1;}
        .ha-vogue{font-family:'Bodoni Moda',Didot,'Playfair Display',Georgia,serif;}
        .ha-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;}
        .ha-kicker,.ha-eyebrow{font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.26em;
          text-transform:uppercase; color:var(--roxo-f);}
        .ha-num{font-family:'Bodoni Moda',Didot,serif; font-size:12.5px; letter-spacing:.12em; color:var(--roxo);}
        .ha-selo{
          position:relative; display:inline-flex; align-items:center; gap:9px; overflow:hidden;
          min-height:52px; padding:0 24px; border-radius:10px; font-weight:600; font-size:15px;
          text-decoration:none; color:var(--tinta); background:var(--branco);
          background-image:linear-gradient(180deg,rgba(255,255,255,.9),rgba(238,232,242,.9));
          border:1.5px solid var(--roxo-e);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(74,0,114,.12),
                     0 1px 2px rgba(26,20,32,.14), 0 14px 26px -18px rgba(26,20,32,.5);
          transition:border-color .25s, box-shadow .25s, transform .12s;
        }
        .ha-selo::after{content:""; position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(115deg,transparent 30%,rgba(139,47,201,.5) 48%,transparent 66%);
          transform:translateX(-120%); transition:transform .75s ease;}
        .ha-selo:hover::after{transform:translateX(120%);}
        .ha-selo:hover{border-color:var(--roxo-f);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(26,20,32,.16),
                     0 20px 34px -18px rgba(74,0,114,.55), 0 0 0 4px rgba(108,0,168,.22);}
        .ha-selo-forte:hover{border-color:var(--roxo-f);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(26,20,32,.16),
                     0 20px 34px -18px rgba(74,0,114,.55), 0 0 0 4px rgba(108,0,168,.26);}
        .ha-selo:active{transform:scale(.985);}
        .ha-selo[disabled],.ha-selo.off{opacity:.55; filter:saturate(.5); pointer-events:none;}
        .ha-selo-forte{border-color:var(--roxo-f); background-image:linear-gradient(180deg,#FFF,#F0E4F7);}
        .ha-selo-forte::after{background:linear-gradient(115deg,transparent 30%,rgba(108,0,168,.55) 48%,transparent 66%);}
        .ha-card{position:relative; border-radius:20px; background:var(--branco); border:1px solid var(--linha);
          box-shadow:inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(26,20,32,.06),
                     0 1px 2px rgba(26,20,32,.06), 0 26px 48px -34px rgba(26,20,32,.42); overflow:hidden;}
        .ha-card::after{content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
          background:linear-gradient(115deg,rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 42%,rgba(255,255,255,.14) 100%);}
        .ha-card > *{position:relative; z-index:2;}
        .ha-pilula{min-height:44px; padding:0 16px; border-radius:999px; border:1px solid var(--linha);
          background:var(--branco); color:var(--tinta2); font-size:13.5px; font-weight:500;
          transition:border-color .2s,color .2s,background .2s;}
        .ha-pilula:hover{border-color:var(--roxo-e); color:var(--tinta);}
        .ha-pilula[data-on="1"]{border-color:var(--roxo-f); background:rgba(108,0,168,.14); color:var(--tinta);}
        .ha-campo{width:100%; min-height:52px; padding:0 16px; border-radius:12px;
          border:1px solid var(--linha); background:var(--branco); color:var(--tinta); font-size:15px;}
        .ha-campo::placeholder{color:var(--tinta3);}
        .ha-campo:focus{outline:none; border-color:var(--roxo-f); box-shadow:0 0 0 3px rgba(108,0,168,.28);}
        .ha-linha{display:flex; align-items:center; gap:12px; width:100%; text-align:left;
          min-height:56px; padding:10px 4px; border-bottom:1px solid var(--linha); transition:background .18s;}
        .ha-linha:hover{background:rgba(108,0,168,.07);}
        .ha-linha[data-on="1"]{background:rgba(108,0,168,.13);}
        .ha-pulso{position:relative; display:inline-flex; width:7px; height:7px; border-radius:999px;}
        .ha-pulso::after{content:""; position:absolute; inset:0; border-radius:inherit; background:inherit;
          animation:ha-ping 2.4s cubic-bezier(0,0,.2,1) infinite;}
        @keyframes ha-ping{0%{transform:scale(1);opacity:.7}80%,100%{transform:scale(2.6);opacity:0}}
        @media (prefers-reduced-motion: reduce){ .ha-pulso::after{animation:none;} }
      `}</style>

      {/* MESMO cabeçalho da vitrine — marca e ação na mesma linha */}
      <header className="sticky top-0 z-30 border-b" style={{ borderColor: "var(--linha)", background: "rgba(247,244,249,.86)", backdropFilter: "blur(14px)" }}>
        <div className="mx-auto flex max-w-5xl flex-nowrap items-center gap-3 px-4 py-3">
          <a href={B} className="flex min-w-0 flex-nowrap items-center gap-2.5">
            <span className="grid h-12 shrink-0 place-items-center overflow-hidden rounded-xl px-2.5"
              style={{ background: "var(--branco)", border: "1px solid var(--linha)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(26,20,32,.05), 0 1px 2px rgba(26,20,32,.14)" }}>
              <img src={B + "/logo.png"} alt="23rd Street Hair Salon" width="192" height="192" className="h-[36px] w-auto" />
            </span>
            <span className="ha-vogue min-w-0 truncate font-semibold" style={{ fontSize: "clamp(15px,3.6vw,21px)" }}>23rd Street Hair Salon</span>
          </a>
          <span className="flex-1" />
          <a href={"tel:" + TEL} className="ha-selo ha-selo-forte shrink-0" style={{ padding: "0 18px" }}>
            <span aria-hidden>☎</span><span className="hidden sm:inline">{TEL_FMT}</span><span className="sm:hidden">Call</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="ha-eyebrow">Booking</div>
        <h1 className="ha-vogue mt-2 font-semibold" style={{ fontSize: "clamp(30px,5.4vw,50px)", lineHeight: 1.06, textWrap: "balance" }}>
          Pick the service. See the price. Then who does it.
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium">
            <span className="ha-pulso" style={{ background: "var(--roxo)" }} />
            <span className="ha-mono">{hora} NYC · same-day appointments</span>
          </span>
          <a href={"sms:" + TEXTO} className="ha-eyebrow" style={{ textDecoration: "underline" }}>Text {TEXTO_FMT}</a>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
          {/* CARDÁPIO */}
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
                  {/* SEM AVATAR NA LINHA — eles não dizem QUEM faz cada serviço, e o mesmo ícone
                      repetido 20 vezes é decoração, não informação. */}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium leading-snug">{nome}</span>
                    {/* A REGRA DA CASA APARECE NA ESCOLHA, não no rodapé */}
                    {regra && <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: "var(--tinta3)" }}>{regra}</span>}
                  </span>
                  <span className="ha-mono shrink-0 text-[13.5px]" style={{ color: "var(--roxo-f)" }}>{faixa(nome, base, aberto)}</span>
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

          {/* O PEDIDO */}
          <aside ref={cesta} className="lg:sticky lg:top-24 lg:self-start">
            <div className="ha-card p-5">
              {enviado ? (
                <div className="py-4 text-center">
                  <div className="ha-vogue text-[26px] font-semibold" style={{ color: "var(--roxo-f)" }}>Sent.</div>
                  <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                    The salon has your request. If you would rather not wait, {TEL_FMT} rings the front desk.
                  </p>
                </div>
              ) : (
                <form onSubmit={enviar}>
                  <div className="ha-eyebrow">Your appointment</div>
                  {escolhido ? (
                    <div className="mt-3">
                      <div className="ha-vogue text-[20px] font-semibold leading-tight">{escolhido.nome}</div>
                      <div className="ha-mono mt-0.5 text-[14px]" style={{ color: "var(--roxo-f)" }}>
                        {faixa(escolhido.nome, escolhido.base, escolhido.aberto)}
                      </div>
                      <div className="ha-eyebrow mt-1">{artista ? "with " + artista : "any artist"}</div>
                      {escolhido.aberto && (
                        <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                          A starting price. The exact figure is agreed at the consultation, before anything is ordered.
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
                  {erro && <p className="mt-2.5 text-[13px]" style={{ color: "var(--roxo)" }}>{erro}</p>}

                  <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                    You will get a text on the {TEXTO_FMT} line to confirm.
                  </p>
                </form>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <a href={"tel:" + TEL} className="ha-card flex min-h-[52px] items-center gap-3 px-4 text-[14.5px]">
                <span aria-hidden style={{ color: "var(--roxo)" }}>☎</span> Call {TEL_FMT}
              </a>
              <a href={"sms:" + TEXTO} className="ha-card flex min-h-[52px] items-center gap-3 px-4 text-[14.5px]">
                <span aria-hidden style={{ color: "var(--roxo)" }}>✉</span> Text / WhatsApp {TEXTO_FMT}
              </a>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t" style={{ borderColor: "var(--linha)", background: "var(--papel2)" }}>
        <div className="mx-auto max-w-5xl px-4 py-8 text-[13px]" style={{ color: "var(--tinta3)" }}>
          <a href={B} className="underline" style={{ color: "var(--tinta2)" }}>← Back to the salon</a>
          <span className="px-2">·</span>
          {/* Eles não têm booking online — a saída secundária é o SITE DELES */}
          <a href={SITE_DELES} target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--tinta2)" }}>
            Their current site
          </a>
        </div>
      </footer>
    </div>
  );
}
