/* NATURA — ASSINATURA MENSAL (Luis, 2026-10-05: «faz a assinatura mensal no site»). Seção #membership da home.
   Regras e exemplos em naturaAssinatura.js; aqui é só a tela. Os planos vêm do portal do salão
   (/api/assinatura-planos). Desligada (ASSINATURA.aoVivo = false): planos reais aparecem sem botão de
   pagar, e sem plano no banco aparecem os EXEMPLOS com o selo "Preview". Ligada: "Join" pede o e-mail e
   abre o Checkout no Stripe do salão; sem plano, a seção some.
   Botao e Flor chegam de NaturaSpa.jsx (são as peças da página, não se duplicam aqui). */
import { useState, useEffect, useRef } from "react";
import { ASSINATURA, EXEMPLOS, perksDe, valorDe, porDe, oQueMostrar, emailValido } from "./naturaAssinatura.js";

/* Volta do Stripe (caminho da plataforma): ?assinatura=ok | cancelado. Lido uma vez e tirado da URL. */
function lerRetorno() {
  try {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("assinatura");
    if (r !== "ok" && r !== "cancelado") return "";
    q.delete("assinatura");
    const resto = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${resto ? `?${resto}` : ""}${window.location.hash}`);
    return r;
  } catch { return ""; }
}

export default function NaturaMembership({ hidden, Botao, Flor, unidades }) {
  const [retorno] = useState(lerRetorno);
  const [planos, setPlanos] = useState(null);        // null = ainda não leu (ou não conseguiu)
  const [aberto, setAberto] = useState("");          // id do plano com o e-mail aberto
  const [email, setEmail] = useState("");
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState("");
  const raiz = useRef(null);
  const buscou = useRef(false);

  /* Lê os planos quando a seção chega perto da tela — quem não rola até aqui não chama nada. */
  useEffect(() => {
    if (hidden || buscou.current || !raiz.current) return undefined;
    const buscar = () => {
      if (buscou.current) return;
      buscou.current = true;
      fetch(`${ASSINATURA.planos}?slug=${encodeURIComponent(ASSINATURA.slug)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j && j.ok && Array.isArray(j.planos)) setPlanos(j.planos); })
        .catch(() => { /* fora do ar: desligada mostra os exemplos; ligada, a seção some */ });
    };
    if (!("IntersectionObserver" in window)) { buscar(); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { buscar(); io.disconnect(); } }, { rootMargin: "600px 0px" });
    io.observe(raiz.current);
    return () => io.disconnect();
  }, [hidden]);

  const mostrar = oQueMostrar({ aoVivo: ASSINATURA.aoVivo, planos });
  const lista = mostrar === "real" ? planos : mostrar === "exemplo" ? EXEMPLOS : [];
  const vende = ASSINATURA.aoVivo && mostrar === "real";

  async function assinar(e, id) {
    e.preventDefault();
    if (!emailValido(email)) { setErro("Please enter a valid email so the salon can find your membership."); return; }
    setIndo(true); setErro("");
    try {
      const r = await fetch(ASSINATURA.checkout, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: ASSINATURA.slug, id, email: email.trim() }) });
      const j = await r.json().catch(() => ({}));
      if (j && j.ok && j.url) { window.location.assign(j.url); return; }
      setErro((j && j.error) || "We couldn’t open checkout. Nothing was charged — please try again.");
    } catch {
      setErro("We couldn’t open checkout. Nothing was charged — please try again.");
    }
    setIndo(false);
  }

  return (
    <section className="nt-sec nt-creme nm" id="membership" ref={raiz} hidden={hidden || mostrar === "nada"} aria-labelledby="nm-t">
      <style>{`
        .nm-aviso{display:inline-flex;align-items:center;gap:10px;padding:8px 16px;border-radius:999px;background:#fff;font-size:13px;font-weight:500;color:var(--tinta);margin-bottom:26px}
        .nm .nm-aviso{display:flex;width:fit-content;max-width:100%;margin:0 0 22px}
        .nm-aviso b{font-weight:600;color:var(--rosa-p)}
        .nm-aviso.nm-volta{box-shadow:inset 0 0 0 1px var(--rosa)}
        .nm-grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:20px}
        .nm-plano{display:flex;flex-direction:column;background:#fff;border-radius:22px;padding:30px 28px 28px;box-shadow:0 0 0 1px var(--fio),0 18px 40px -30px rgba(28,28,28,.35)}
        .nm-plano h3{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:400;font-size:26px;line-height:1.15;color:var(--tinta)}
        .nm-preco{display:flex;align-items:baseline;gap:8px;margin:14px 0 18px;padding-bottom:18px;border-bottom:1px solid var(--fio)}
        .nm-preco strong{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:300;font-variation-settings:'SOFT' 0,'opsz' 144;font-size:46px;line-height:1;color:var(--ouro-e)}
        .nm-preco span{font-size:14px;color:var(--texto)}
        .nm-plano ul{list-style:none;margin:0 0 24px;padding:0;display:grid;gap:10px;flex:1}
        .nm-plano li{position:relative;padding-left:22px;font-size:15px;line-height:1.5;color:var(--tinta)}
        .nm-plano li::before{content:"";position:absolute;left:2px;top:.62em;width:8px;height:8px;border-radius:50%;background:var(--rosa);box-shadow:0 0 0 3px color-mix(in srgb,var(--rosa) 22%,transparent)}
        .nm-plano .nt-b{width:100%}
        .nm-form{display:grid;gap:10px}
        .nm-form label{font-size:13px;font-weight:600;color:var(--tinta)}
        .nm-form input{min-height:48px;padding:0 18px;border-radius:999px;border:1px solid var(--fio);font:inherit;font-size:15px;color:var(--tinta);background:var(--nevoa)}
        .nm-form input:focus-visible{outline:2px solid var(--petrol);outline-offset:2px;background:#fff}
        .nm-erro{font-size:13px;color:var(--rosa-p);line-height:1.5}
        .nm-ver{font-size:12.5px;color:var(--texto);text-align:center}
        .nm .nt-nota{max-width:46em;margin-top:22px}
      `}</style>
      <div className="nt-in">
        <header className="nt-cab nt-rv">
          <Flor className="nt-flor" />
          <h2 className="nt-h2" id="nm-t">Membership</h2>
          <p className="nt-lead">A standing date with yourself. One visit every month at a member price, booked at either location.</p>
        </header>

        {retorno === "ok" && <p className="nm-aviso nm-volta" role="status"><b>Welcome</b> Your membership is active — the front desk will see it on your next visit.</p>}
        {retorno === "cancelado" && <p className="nm-aviso nm-volta" role="status"><b>Checkout cancelled</b> Nothing was charged.</p>}
        {mostrar === "exemplo" && <p className="nm-aviso"><b>Preview</b> Example plans — the salon sets the real ones.</p>}
        {mostrar === "real" && !ASSINATURA.aoVivo && <p className="nm-aviso"><b>Preview</b> Online sign-up opens soon. Ask at the front desk today.</p>}

        <div className="nm-grade nt-rv">
          {lista.map((p) => (
            <article className="nm-plano" key={p.id}>
              <h3>{p.name}</h3>
              <p className="nm-preco"><strong className="nt-num">{valorDe(p.price_cents)}</strong><span>/ {porDe(p.interval)}</span></p>
              <ul>{perksDe(p.perks).map((x) => <li key={x}>{x}</li>)}</ul>
              {vende && aberto !== p.id && (
                <Botao as="button" type="button" cheio onClick={() => { setAberto(p.id); setErro(""); }} aria-label={`Join ${p.name}`}>Join</Botao>
              )}
              {vende && aberto === p.id && (
                <form className="nm-form" onSubmit={(e) => assinar(e, p.id)} noValidate>
                  <label htmlFor={`nm-e-${p.id}`}>Your email</label>
                  <input id={`nm-e-${p.id}`} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required aria-describedby={erro ? `nm-x-${p.id}` : undefined} />
                  {erro && <p className="nm-erro" id={`nm-x-${p.id}`} role="alert">{erro}</p>}
                  <Botao as="button" type="submit" cheio disabled={indo}>{indo ? "Opening checkout…" : "Continue to secure checkout"}</Botao>
                  <p className="nm-ver">Secure payment by Stripe. Nothing is charged until you confirm.</p>
                </form>
              )}
            </article>
          ))}
        </div>

        {!vende && (
          <div className="nt-acoes">
            {unidades.map((u) => <Botao key={u.id} href={`tel:${u.tel}`} forte={`Ask at ${u.curto}`} fino={u.telFmt} />)}
          </div>
        )}
        <p className="nt-nota">Billed every month to your card until you cancel. To pause or cancel, call or email the salon before your next billing date.</p>
      </div>
    </section>
  );
}
