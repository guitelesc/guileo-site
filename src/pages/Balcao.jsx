// /balcao — O BALCÃO DO NEGÓCIO (2026-10-05). Abre SEM digitar nada sempre que dá:
//   1. LINK DE ENTRADA da recepcionista (a dona copia em Balcão → Equipe → Acesso da recepção):
//      /balcao#e=<email>&c=<bal_…>. O código vai no FRAGMENTO (#) — o navegador não manda isso ao servidor
//      nem a logs; a página lê, guarda neste aparelho e apaga da barra de endereço na hora.
//   2. Código já guardado neste aparelho (localStorage) → entra direto.
//   3. A DONA logada na Central neste aparelho → entra direto com a chave dela (Balcão completo).
// Só se nada disso existir aparece o formulário (e-mail do negócio + código).
// O código da recepção só faz o que functions/lib/deskAcesso.js deixa; revogado → 401 → volta ao formulário.
import { useState, useEffect, lazy, Suspense } from "react";
import { prepararTelaAvulsa, Toaster } from "./Portal.jsx";
import { portalApi, loadDataKey } from "../lib/portalApi.js";
import marca from "../assets/guileo-mark.png";

const Desk = lazy(() => import("../portal/Desk.jsx"));
const MinhaAgenda = lazy(() => import("../portal/DeskMinhaAgenda.jsx"));
// A assistente do negócio no canto (Lilian no Natura): nome e voz vêm do agente de telefone dele (/api/gui-voz).
const Assistente = lazy(() => import("../portal/GuiCentral.jsx"));
// Ponto da equipe e o mês da profissional (functions/api/desk-eu.js) — só para quem entra com código próprio.
const Ponto = lazy(() => import("../portal/DeskPonto.jsx"));
const MeuMes = lazy(() => import("../portal/DeskMeuMes.jsx"));   // papel "profissional": só o dia dela
const GUARDA = "guileo_balcao";
const CODIGO = /^bal_[a-z2-7]{26}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const T = {
  title: { en: "Front desk", pt: "Recepção", es: "Recepción" },
  sub: { en: "Today's schedule, checkout and clients — in one screen.", pt: "A agenda do dia, o caixa e as clientes — numa tela só.", es: "La agenda del día, la caja y las clientas — en una sola pantalla." },
  formH: { en: "Sign in with the business email and the code the owner gave you.", pt: "Entre com o e-mail do negócio e o código que a dona te passou.", es: "Entra con el correo del negocio y el código que te dio la dueña." },
  email: { en: "Business email", pt: "E-mail do negócio", es: "Correo del negocio" },
  code: { en: "Your code", pt: "Seu código", es: "Tu código" },
  enter: { en: "Open the front desk", pt: "Abrir o balcão", es: "Abrir la recepción" },
  bad: { en: "Email or code doesn't match — the code may have been revoked. Check with the owner.", pt: "E-mail ou código não confere — o código pode ter sido revogado. Confira com a dona.", es: "El correo o el código no coincide — puede haber sido revocado. Consulta con la dueña." },
  badFormat: { en: "The code starts with bal_ and has 30 characters.", pt: "O código começa com bal_ e tem 30 caracteres.", es: "El código empieza con bal_ y tiene 30 caracteres." },
  down: { en: "Can't reach the front desk right now. Try again in a minute.", pt: "Não consegui abrir o balcão agora. Tente de novo em um minuto.", es: "No pude abrir la recepción ahora. Inténtalo en un minuto." },
  out: { en: "Sign out", pt: "Sair", es: "Salir" },
  opening: { en: "Opening the front desk…", pt: "Abrindo o balcão…", es: "Abriendo la recepción…" },
  checking: { en: "Checking…", pt: "Conferindo…", es: "Comprobando…" },
  owner: { en: "Owner", pt: "Dona", es: "Dueña" },
  recep: { en: "Front desk", pt: "Recepção", es: "Recepción" },
  pro: { en: "Professional", pt: "Profissional", es: "Profesional" },
  central: { en: "Open the dashboard", pt: "Abrir a Central", es: "Abrir el panel" },
  noCode: { en: "No code? The owner creates one in Front desk → Team → Front desk access, and can send you a link that opens straight in.", pt: "Sem código? A dona cria em Balcão → Equipe → Acesso da recepção — e pode te mandar um link que já abre direto.", es: "¿Sin código? La dueña lo crea en Recepción → Equipo → Acceso de recepción, y puede enviarte un enlace que abre directo." },
  isOwner: { en: "Are you the owner?", pt: "É a dona?", es: "¿Eres la dueña?" },
  ownerLink: { en: "Sign in to your dashboard and come back — it opens on its own.", pt: "Entre na sua Central e volte aqui — abre sozinho.", es: "Entra a tu panel y vuelve — se abre solo." },
  has: { en: ["Schedule", "Checkout", "Clients", "Day close"], pt: ["Agenda", "Caixa", "Clientes", "Fechamento"], es: ["Agenda", "Caja", "Clientas", "Cierre"] },
};

const ler = () => { try { const v = JSON.parse(localStorage.getItem(GUARDA) || "null"); return v && EMAIL.test(v.email || "") && CODIGO.test(v.codigo || "") ? v : null; } catch { return null; } };
const gravar = (v) => { try { if (v) localStorage.setItem(GUARDA, JSON.stringify(v)); else localStorage.removeItem(GUARDA); } catch { /* aba privada: vale só nesta visita */ } };

// Link de entrada: #e=<email>&c=<código>. Lê e APAGA da barra (não fica no histórico nem num print).
function doLink() {
  try {
    const h = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
    const email = String(h.get("e") || "").trim().toLowerCase(), codigo = String(h.get("c") || "").trim().toLowerCase();
    if (h.has("c") || h.has("e")) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return EMAIL.test(email) && CODIGO.test(codigo) ? { email, codigo } : null;
  } catch { return null; }
}

// "quem" passa pela MESMA porta de todas as ações: confere o código (ou a chave da dona) antes de pintar.
async function conferir(email, chave) {
  try {
    const r = await fetch("/api/desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, key: chave, action: "quem" }) });
    const d = await r.json().catch(() => null);
    if (r.status === 200 && d?.ok === true) return { ok: true, papel: d.papel, nome: d.nome || "", negocio: d.negocio || "", logo: d.logo || "", assistente: d.assistente || "" };
    return { ok: false, motivo: r.status === 401 || r.status === 403 ? "bad" : "down" };
  } catch { return { ok: false, motivo: "down" }; }
}

// A dona logada na Central NESTE aparelho: e-mail da sessão + a chave de conexão que a Central já guarda.
async function daDona() {
  try {
    const s = await Promise.race([portalApi.session(), new Promise((r) => setTimeout(() => r(null), 4000))]);
    const chave = loadDataKey();
    return s && s.email && chave && !s.demo ? { email: String(s.email).toLowerCase(), chave } : null;
  } catch { return null; }
}

export default function Balcao() {
  const [lang, setLang] = useState(null);
  const [fase, setFase] = useState("abrindo");           // abrindo | form | dentro
  const [sessao, setSessao] = useState(null);            // { email, chave, papel, nome, negocio, logo }
  const [form, setForm] = useState({ email: "", codigo: "" });
  const [erro, setErro] = useState("");
  const [indo, setIndo] = useState(false);
  const tx = (o) => o[lang] || o.en;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const l = await prepararTelaAvulsa();
      if (!vivo) return;
      setLang(["pt", "es"].includes(l) ? l : "en");
      // 1) link de entrada · 2) código guardado · 3) a dona logada aqui
      const link = doLink();
      const guardado = ler();
      for (const tentativa of [link, guardado]) {
        if (!tentativa) continue;
        const c = await conferir(tentativa.email, tentativa.codigo);
        if (!vivo) return;
        if (c.ok) { gravar(tentativa); setSessao({ email: tentativa.email, chave: tentativa.codigo, ...c }); setFase("dentro"); return; }
        if (c.motivo === "bad") { if (tentativa === guardado) gravar(null); setErro("bad"); } else setErro("down");
        setForm((f) => ({ ...f, email: tentativa.email }));
      }
      const dona = await daDona();
      if (!vivo) return;
      if (dona) {
        const c = await conferir(dona.email, dona.chave);
        if (!vivo) return;
        if (c.ok) { setSessao({ email: dona.email, chave: dona.chave, ...c }); setFase("dentro"); setErro(""); return; }
      }
      setFase("form");
    })();
    return () => { vivo = false; };
  }, []);
  useEffect(() => {
    const man = document.head.querySelector('link[rel="manifest"]');
    if (man) man.setAttribute("href", "/balcao.webmanifest");
  }, []);
  useEffect(() => {
    const nome = sessao?.negocio ? `${sessao.negocio} · ` : "";
    document.title = `${nome}${lang ? tx(T.title) : "Front desk"} · Guileo Desk`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, sessao]);

  const entrar = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase(), codigo = form.codigo.trim().toLowerCase();
    if (!EMAIL.test(email) || !CODIGO.test(codigo)) { setErro(CODIGO.test(codigo) ? "bad" : "badFormat"); return; }
    setIndo(true); setErro("");
    const c = await conferir(email, codigo);
    setIndo(false);
    if (!c.ok) { setErro(c.motivo); return; }
    gravar({ email, codigo });
    setSessao({ email, chave: codigo, ...c }); setFase("dentro");
  };
  const sair = () => { gravar(null); setSessao(null); setForm((f) => ({ ...f, codigo: "" })); setFase("form"); };

  const Marca = (
    <div className="flex items-center gap-2.5">
      <img src={marca} alt="" className="h-8 w-8 object-contain" />
      <div className="leading-tight">
        <div className="text-[15px] font-extrabold tracking-tight text-g-word">Guileo <span className="text-g-green">Desk</span></div>
      </div>
    </div>
  );

  if (!lang || fase === "abrindo") {
    return (
      <div className="min-h-screen bg-[#161512] grid place-items-center">
        <div className="flex flex-col items-center gap-3 text-g-muted">
          <img src={marca} alt="Guileo" className="h-12 w-12 object-contain motion-safe:animate-pulse" />
          <div className="text-xs font-bold">{lang ? tx(T.opening) : ""}</div>
        </div>
      </div>
    );
  }

  if (fase === "dentro" && sessao) {
    const ehDona = sessao.papel === "dono";
    return (
      <div className="min-h-screen bg-[#161512] text-g-word">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#161512]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              {Marca}
              {(sessao.negocio || sessao.logo) && (
                <div className="flex min-w-0 items-center gap-2 border-l border-white/10 pl-3">
                  {sessao.logo && <img src={sessao.logo} alt="" className="h-7 w-7 shrink-0 rounded-md bg-white object-contain p-0.5" />}
                  <span className="truncate text-sm font-bold text-g-word">{sessao.negocio}</span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-g-green" aria-hidden="true" />
                {sessao.nome ? `${sessao.nome} · ` : ""}{ehDona ? tx(T.owner) : sessao.papel === "profissional" ? tx(T.pro) : tx(T.recep)}
              </span>
              {ehDona
                ? <a href="/portal" className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-g-word hover:border-white/30">{tx(T.central)}</a>
                : <button onClick={sair} className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-g-word hover:border-white/30">{tx(T.out)}</button>}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-4">
          <Suspense fallback={<div className="py-10 text-center text-sm text-g-muted">…</div>}>
            {!ehDona && <div className="mx-auto mb-4 max-w-xl"><Ponto email={sessao.email} dataKey={sessao.chave} modo="bater" /></div>}
            {sessao.papel === "profissional"
              ? <>
                  <MinhaAgenda email={sessao.email} dataKey={sessao.chave} nome={sessao.nome} />
                  <div className="mx-auto mt-4 max-w-xl"><MeuMes email={sessao.email} dataKey={sessao.chave} /></div>
                </>
              : <Desk real email={sessao.email} dataKey={sessao.chave} />}
          </Suspense>
        </main>
        {sessao.papel !== "profissional" && (
          <Suspense fallback={null}>
            <Assistente conectada email={sessao.email} dataKey={sessao.chave} dono={ehDona ? "" : sessao.nome || ""} negocio={sessao.negocio || ""} nomeInicial={sessao.assistente || ""}
              onNav={(v) => { if (v !== "desk" && ehDona) window.location.href = `/portal?tab=${encodeURIComponent(v)}`; }} />
          </Suspense>
        )}
        <Toaster />
      </div>
    );
  }

  const campo = "mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-[15px] text-g-word placeholder:text-g-muted/70 outline-none transition focus:border-g-green/60 focus:ring-2 focus:ring-g-green/20 [color-scheme:dark]";
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#161512] text-g-word">
      {/* luz quente atrás do cartão — decoração, não informação */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-18rem] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-g-green/10 blur-3xl" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
        <header className="flex items-center justify-between">{Marca}</header>
        <main className="flex flex-1 flex-col justify-center py-8">
          <h1 className="text-[2rem] font-extrabold leading-tight tracking-tight [text-wrap:balance]">{tx(T.title)}</h1>
          <p className="mt-1.5 text-[15px] text-g-muted">{tx(T.sub)}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {T.has[lang].map((x) => <span key={x} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-g-muted">{x}</span>)}
          </div>
          <form onSubmit={entrar} className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
            <p className="text-sm text-g-muted">{tx(T.formH)}</p>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-g-muted">{tx(T.email)}
              <input type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={campo} />
            </label>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-g-muted">{tx(T.code)}
              <input autoComplete="current-password" autoCapitalize="none" spellCheck={false} required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className={`${campo} font-mono tracking-wide`} placeholder="bal_…" />
            </label>
            {erro && <p role="alert" className="rounded-xl border border-g-gold/30 bg-g-gold/10 px-3 py-2 text-sm font-bold text-g-gold">{tx(T[erro] || T.down)}</p>}
            <button disabled={indo} className="w-full rounded-full bg-g-green px-5 py-3.5 text-[15px] font-extrabold text-[#161512] transition hover:brightness-110 disabled:opacity-50">{indo ? tx(T.checking) : tx(T.enter)}</button>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-g-muted">{tx(T.noCode)}</p>
          <p className="mt-2 text-xs text-g-muted"><span className="font-bold text-g-word">{tx(T.isOwner)}</span> <a href="/portal" className="underline decoration-white/30 underline-offset-2 hover:text-g-word">{tx(T.ownerLink)}</a></p>
        </main>
        <footer className="text-[11px] text-g-muted/70">guileoai.com</footer>
      </div>
    </div>
  );
}
