/* ══════════════════════════════════════════════════════════════════════════════════════════════
   NY MEDICAL — página de consulta ("book"), no NOSSO domínio.
   PADRAO-VITRINE.md §6, adaptado à VERTICAL clínica: não há sistema de agendamento com cardápio
   PRECIFICADO (eles não publicam preço), então a "book" aqui é pedir a CONSULTA — escolher o
   serviço, dizer quando e como responder. SEM PREÇO em lugar nenhum. Mesmo header/selo/material
   da vitrine. O site deles fica como saída SECUNDÁRIA no rodapé.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useRef, useCallback, useEffect } from "react";

const TEL = "+12129882924";
const TEL_FMT = "(212) 988-2924";
const SITE_DELES = "https://igorkletsmanmd.com";
const SUPP_URL = "https://igorkletsmanmd.com/supplement-protocols/";
const B = "/novo/ny-medical";

/* [nome, cauda, o que inclui / a nota honesta que aparece NA ESCOLHA]. Sem preço — clínica. */
const SERVICOS = [
  ["Primary Care", "The foundation", "Preventive primary care: assessment, diagnosis and treatment. Same-day appointments, on-site testing and telehealth, with a multidisciplinary care team."],
  ["Hormone & Longevity", "BHRT · GH · women & men", "Bioidentical Hormone Replacement Therapy, Growth Hormone Therapy and comprehensive hormone support — built around your own bloodwork."],
  ["Body Treatments", "Emsculpt Neo · Emsella · Cellutone", "Device-based, non-invasive body treatments under the care of the practice."],
  ["Weight Loss Program", "Medically guided", "A weight loss program run and monitored by the care team, planned to your body and goals."],
  ["PrEP", "HIV prevention", "A personalized PrEP consultation and ongoing monitoring, handled discreetly by the team."],
  ["Supplement Protocol", "Vetted by condition", "Not sure which of the 17 protocols is yours? Tell the team the concern and they point you to the one Dr. Kletsman vetted for it."],
];

export default function NYMedicalBook() {
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ nome: "", tel: "", quando: "", recado: "" });
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [rel, setRel] = useState({ hora: "", aberto: false });
  const cesta = useRef(null);

  useEffect(() => {
    const tick = () => {
      const f = (o) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...o }).format(new Date());
      const h = Number(f({ hour: "numeric", hour12: false }));
      const semana = !["Sat", "Sun"].includes(f({ weekday: "short" }));
      setRel({ hora: f({ hour: "numeric", minute: "2-digit", hour12: true }), aberto: semana && h >= 9 && h < 17 });
    };
    tick(); const id = setInterval(tick, 30000); return () => clearInterval(id);
  }, []);

  const escolhido = sel != null ? SERVICOS[sel] : null;

  const enviar = useCallback(async (e) => {
    e.preventDefault();
    setErro("");
    let ok;
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "ny-medical", negocio: "NY Medical",
          nome: form.nome, telefone: form.tel,
          mensagem: "[BOOKING] " + (escolhido ? escolhido[0] : "service?")
            + " · " + (form.quando || "any time")
            + (form.recado ? " · note: " + form.recado : ""),
        }),
      });
      const d = await r.json().catch(() => null);
      ok = !!(d && d.ok);
    } catch { ok = false; }
    if (ok) setEnviado(true);
    else setErro("That didn't send — call " + TEL_FMT + ", someone picks up.");
  }, [form, escolhido]);

  return (
    <div className="nm-raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,700;1,6..96,400&family=Jost:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .nm-raiz{
          --papel:#F5F7F6; --papel2:#E9EEEC; --branco:#FFFFFF;
          --tinta:#10201E; --tinta2:#4C5B58; --tinta3:#8A9793;
          --teal:#0E4F4F; --teal-e:#1A7A7A; --teal-f:#052E2E;
          --ouro:#C89660; --ouro-e:#A8763F; --linha:#D3DED9;
          background:var(--papel); color:var(--tinta); min-height:100vh;
          font-family:'Jost',system-ui,-apple-system,sans-serif; position:relative; overflow-x:hidden;
        }
        .nm-raiz::before{
          content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.32;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.4'/%3E%3C/svg%3E");
        }
        .nm-raiz > *{position:relative; z-index:1;}
        .nm-vogue{font-family:'Bodoni Moda',Didot,'Playfair Display',Georgia,serif;}
        .nm-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;}
        .nm-kicker,.nm-eyebrow{font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.26em;
          text-transform:uppercase; color:var(--teal);}
        .nm-num{font-family:'Bodoni Moda',Didot,serif; font-size:12.5px; letter-spacing:.12em; color:var(--ouro-e);}
        .nm-selo{
          position:relative; display:inline-flex; align-items:center; gap:9px; overflow:hidden;
          min-height:52px; padding:0 24px; border-radius:10px; font-weight:600; font-size:15px;
          text-decoration:none; color:var(--tinta); background:var(--branco);
          background-image:linear-gradient(180deg,rgba(255,255,255,.9),rgba(233,238,236,.9));
          border:1.5px solid var(--teal-e);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(5,46,46,.12),
                     0 1px 2px rgba(16,32,30,.14), 0 14px 26px -18px rgba(16,32,30,.5);
          transition:border-color .25s, box-shadow .25s, transform .12s;
        }
        .nm-selo::after{content:""; position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(115deg,transparent 30%,rgba(26,122,122,.5) 48%,transparent 66%);
          transform:translateX(-120%); transition:transform .75s ease;}
        .nm-selo:hover::after{transform:translateX(120%);}
        .nm-selo:hover{border-color:var(--teal-f);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(16,32,30,.16),
                     0 20px 34px -18px rgba(14,79,79,.55), 0 0 0 4px rgba(14,79,79,.2);}
        .nm-selo-forte:hover{border-color:var(--ouro-e);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(16,32,30,.16),
                     0 20px 34px -18px rgba(168,118,63,.5), 0 0 0 4px rgba(200,150,96,.26);}
        .nm-selo:active{transform:scale(.985);}
        .nm-selo[disabled],.nm-selo.off{opacity:.55; filter:saturate(.5); pointer-events:none;}
        .nm-selo-forte{border-color:var(--ouro-e); background-image:linear-gradient(180deg,#FFF,#F4EADD);}
        .nm-selo-forte::after{background:linear-gradient(115deg,transparent 30%,rgba(200,150,96,.6) 48%,transparent 66%);}
        .nm-card{position:relative; border-radius:20px; background:var(--branco); border:1px solid var(--linha);
          box-shadow:inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(16,32,30,.06),
                     0 1px 2px rgba(16,32,30,.06), 0 26px 48px -34px rgba(16,32,30,.42); overflow:hidden;}
        .nm-card::after{content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
          background:linear-gradient(115deg,rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 42%,rgba(255,255,255,.14) 100%);}
        .nm-card > *{position:relative; z-index:2;}
        .nm-pilula{min-height:44px; padding:0 16px; border-radius:999px; border:1px solid var(--linha);
          background:var(--branco); color:var(--tinta2); font-size:13.5px; font-weight:500;
          transition:border-color .2s,color .2s,background .2s;}
        .nm-pilula:hover{border-color:var(--teal-e); color:var(--tinta);}
        .nm-pilula[data-on="1"]{border-color:var(--teal-f); background:rgba(14,79,79,.12); color:var(--tinta);}
        .nm-campo{width:100%; min-height:52px; padding:0 16px; border-radius:12px;
          border:1px solid var(--linha); background:var(--branco); color:var(--tinta); font-size:15px;}
        .nm-campo::placeholder{color:var(--tinta3);}
        .nm-campo:focus{outline:none; border-color:var(--teal-f); box-shadow:0 0 0 3px rgba(14,79,79,.25);}
        .nm-linha{display:flex; align-items:flex-start; gap:12px; width:100%; text-align:left;
          min-height:56px; padding:12px 4px; border-bottom:1px solid var(--linha); transition:background .18s;}
        .nm-linha:hover{background:rgba(14,79,79,.06);}
        .nm-linha[data-on="1"]{background:rgba(14,79,79,.12);}
        .nm-pulso{position:relative; display:inline-flex; width:7px; height:7px; border-radius:999px;}
        .nm-pulso::after{content:""; position:absolute; inset:0; border-radius:inherit; background:inherit;
          animation:nm-ping 2.4s cubic-bezier(0,0,.2,1) infinite;}
        @keyframes nm-ping{0%{transform:scale(1);opacity:.7}80%,100%{transform:scale(2.6);opacity:0}}
        @media (prefers-reduced-motion: reduce){ .nm-pulso::after{animation:none;} }
      `}</style>

      <header className="sticky top-0 z-30 border-b" style={{ borderColor: "var(--linha)", background: "rgba(245,247,246,.86)", backdropFilter: "blur(14px)" }}>
        <div className="mx-auto flex max-w-5xl flex-nowrap items-center gap-3 px-4 py-3">
          <a href={B} className="flex min-w-0 flex-nowrap items-center gap-2.5">
            <span className="grid h-12 shrink-0 place-items-center overflow-hidden rounded-xl px-2.5"
              style={{ background: "var(--branco)", border: "1px solid var(--linha)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(16,32,30,.05), 0 1px 2px rgba(16,32,30,.14)" }}>
              <img src={B + "/logo.png"} alt="NY Medical" width="40" height="40" className="h-[34px] w-auto" />
            </span>
            <span className="nm-vogue min-w-0 truncate font-semibold" style={{ fontSize: "clamp(15px,3.6vw,21px)" }}>NY Medical</span>
          </a>
          <span className="flex-1" />
          <a href={"tel:" + TEL} className="nm-selo nm-selo-forte shrink-0" style={{ padding: "0 18px" }}>
            <span aria-hidden>☎</span><span className="hidden sm:inline">{TEL_FMT}</span><span className="sm:hidden">Call</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="nm-eyebrow">Book a consultation</div>
        <h1 className="nm-vogue mt-2 font-semibold" style={{ fontSize: "clamp(30px,5.4vw,50px)", lineHeight: 1.06, textWrap: "balance" }}>
          Pick what you need. The team sets the plan.
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium">
            <span className="nm-pulso" style={{ background: rel.aberto ? "var(--teal)" : "var(--ouro-e)" }} />
            <span className="nm-mono">{rel.aberto ? "Open now" : "Closed"} · {rel.hora} NYC</span>
          </span>
          <span className="nm-eyebrow">Same-day · Telehealth · Testing on site</span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div>
            <div className="nm-card px-5 py-2">
              {SERVICOS.map(([nome, cauda, nota], i) => (
                <button key={nome} type="button" data-on={sel === i ? "1" : "0"}
                  onClick={() => { setSel(i); cesta.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}
                  className="nm-linha">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-medium leading-snug">{nome}</span>
                    <span className="nm-mono mt-0.5 block text-[11px]" style={{ color: "var(--teal)", letterSpacing: ".08em" }}>{cauda}</span>
                    <span className="mt-1 block text-[12.5px] leading-snug" style={{ color: "var(--tinta3)" }}>{nota}</span>
                  </span>
                  <span className="nm-mono shrink-0 self-center text-[13px]" style={{ color: "var(--teal)" }}>{sel === i ? "✓" : "→"}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[13px]" style={{ color: "var(--tinta3)" }}>
              No prices are shown because the plan — and its cost — are set with the team at your consultation. The team also confirms your insurance coverage before the visit.
            </p>
          </div>

          <aside ref={cesta} className="lg:sticky lg:top-24 lg:self-start">
            <div className="nm-card p-5">
              {enviado ? (
                <div className="py-4 text-center">
                  <div className="nm-vogue text-[26px] font-semibold" style={{ color: "var(--teal)" }}>Sent.</div>
                  <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                    The practice has your request. If you would rather not wait, {TEL_FMT} rings the front desk.
                  </p>
                </div>
              ) : (
                <form onSubmit={enviar}>
                  <div className="nm-eyebrow">Your consultation</div>
                  {escolhido ? (
                    <div className="mt-3">
                      <div className="nm-vogue text-[20px] font-semibold leading-tight">{escolhido[0]}</div>
                      <div className="nm-mono mt-0.5 text-[12px]" style={{ color: "var(--teal)", letterSpacing: ".08em" }}>{escolhido[1]}</div>
                      <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                        Same-day, telehealth or in person — the front desk finds the first time that works.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                      Choose what you need on the left and it lands here.
                    </p>
                  )}

                  <div className="mt-4 space-y-2.5">
                    <input className="nm-campo" placeholder="Your name" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
                    <input className="nm-campo" type="tel" placeholder="Phone" value={form.tel} onChange={(e) => setForm((f) => ({ ...f, tel: e.target.value }))} />
                    <input className="nm-campo" placeholder="When suits you?" value={form.quando} onChange={(e) => setForm((f) => ({ ...f, quando: e.target.value }))} />
                    <textarea className="nm-campo py-3" rows={2} placeholder="Anything the team should know? (optional)"
                      value={form.recado} onChange={(e) => setForm((f) => ({ ...f, recado: e.target.value }))} style={{ minHeight: 70, resize: "vertical" }} />
                  </div>

                  <button type="submit" disabled={!escolhido || !form.nome.trim() || !form.tel.trim()}
                    className={"nm-selo nm-selo-forte mt-4 w-full justify-center" + (escolhido && form.nome.trim() && form.tel.trim() ? "" : " off")}>
                    <span aria-hidden>✦</span> Request this consultation
                  </button>
                  {erro && <p className="mt-2.5 text-[13px]" style={{ color: "var(--ouro-e)" }}>{erro}</p>}

                  <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                    This sends a request to the front desk — it is not medical advice. Anything clinical is confirmed by Dr. Kletsman's team.
                  </p>
                </form>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <a href={"tel:" + TEL} className="nm-card flex min-h-[52px] items-center gap-3 px-4 text-[14.5px]">
                <span aria-hidden style={{ color: "var(--ouro-e)" }}>☎</span> Call {TEL_FMT}
              </a>
              <a href={SUPP_URL} target="_blank" rel="noreferrer" className="nm-card flex min-h-[52px] items-center gap-3 px-4 text-[14.5px]">
                <span aria-hidden style={{ color: "var(--ouro-e)" }}>▤</span> Supplement protocol shop
              </a>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t" style={{ borderColor: "var(--linha)", background: "var(--papel2)" }}>
        <div className="mx-auto max-w-5xl px-4 py-8 text-[13px]" style={{ color: "var(--tinta3)" }}>
          <a href={B} className="underline" style={{ color: "var(--tinta2)" }}>← Back to the practice</a>
          <span className="px-2">·</span>
          <a href={SITE_DELES} target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--tinta2)" }}>
            Their current site
          </a>
        </div>
      </footer>
    </div>
  );
}
