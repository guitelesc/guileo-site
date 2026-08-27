import { useState } from "react";

// 🔗 Conectar Meta — o dono COLA o Page Access Token (gerado na Meta) pra ligar uma Página do
// Facebook / conta Instagram a um cliente do Guileo. POST /api/meta-connect (admin-gated).
// Depois disso o webhook sabe de quem é a mensagem e a Gui responde. Light theme /admin.
export default function MetaConnect({ token }) {
  const [f, setF] = useState({ email: "", page_id: "", page_access_token: "", ig_id: "", business: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  // ── CONFERIR: o estado vem do PROVEDOR, não do nosso banco ──────────────────────────────────
  // Este cartão só sabia ESCREVER. Em 25/08 o painel dava "conectado" para uma página cujo token a
  // Meta já tinha invalidado ("the session has been invalidated because the user changed their
  // password") — ou seja, a página estava muda e a tela dizia que estava no ar. Quem conecta
  // precisa poder conferir na mesma tela, com as palavras da Meta, e não descobrir dias depois.
  const [ver, setVer] = useState(null);
  const [vendo, setVendo] = useState(false);

  const conferir = async () => {
    if (!f.email.includes("@")) { setMsg({ err: "Informe o email do cliente para conferir." }); return; }
    setVendo(true); setVer(null); setMsg(null);
    try {
      const st = await fetch("/api/meta-connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", token, email: f.email }) }).then((x) => x.json());
      // A auditoria pergunta à Meta o nome real da página E qual Instagram está ligado nela — é
      // assim que a gente descobre o `ig_id` sem mandar o dono caçar número em painel.
      let au = null;
      try { au = await fetch("/api/meta-connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "auditar", token, email: f.email }) }).then((x) => x.json()); } catch { /* auditoria é bônus */ }
      setVer({ st, au });
    } catch { setMsg({ err: "Erro de rede." }); }
    setVendo(false);
  };

  const mapearIg = async (ig_id) => {
    setVendo(true);
    try {
      const r = await fetch("/api/meta-connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mapear_ig", token, email: f.email, ig_id }) }).then((x) => x.json());
      setMsg(r.ok ? { ok: r.motivo } : { err: r.motivo || "não deu" });
      if (r.ok) await conferir();
    } catch { setMsg({ err: "Erro de rede." }); }
    setVendo(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!f.email.includes("@")) { setMsg({ err: "Informe o email do cliente Guileo." }); return; }
    if (!f.page_id && !f.ig_id) { setMsg({ err: "Informe o ID da Página (ou do Instagram)." }); return; }
    if (!f.page_access_token.trim()) { setMsg({ err: "Cole o Page Access Token." }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/meta-connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "connect", token, ...f }) }).then((x) => x.json());
      // ⚠️ A TELA NÃO PODE COMER A METADE ÚTIL DA RESPOSTA (2026-08-27). Esta linha mostrava só
      // `r.error` — e o endpoint devolve junto o `como_resolver`, que é a parte que diz O QUE FAZER
      // (ex.: "este token EXPIRA em ~2h → troque por um token LONGO antes de colar"). Quem recebia
      // o erro sem a instrução tentava de novo do mesmo jeito. Erro sem conserto é só frustração.
      // E no sucesso existe `aviso`: token guardado mas SEM a permissão do evento — o caso em que
      // tudo fica verde e a Meta simplesmente não entrega. Esconder isso é o pior desfecho: parece
      // que deu certo.
      if (r.ok) {
        setMsg({ ok: r.note || "Ligado! A Gui já recebe e responde nessa página.", aviso: r.aviso || null });
        setF({ ...f, page_access_token: "" });
      } else {
        setMsg({ err: r.error || "Falhou — confira os dados.", como: r.como_resolver || r.detalhe || null });
      }
    } catch { setMsg({ err: "Erro de rede." }); }
    setBusy(false);
  };

  const inp = "mt-1 block w-full rounded-lg border border-g-line bg-white/[0.05] px-2.5 py-1.5 text-[12px] text-g-word placeholder:text-g-muted";
  // TRÊS estados, nunca dois: verde = a Meta aceitou · vermelho = a Meta recusou (com o motivo
  // dela) · cinza = não deu para perguntar, que NÃO é um ok.
  const sinal = (v) => (v === true ? "🟢" : v === false ? "🔴" : "⚪");
  return (
    <div className="mt-6 rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">🔗 Conectar Meta (Instagram / Messenger)</div>
      <p className="text-[12px] text-g-muted">Cole o <b>Page Access Token</b> (gerado na Meta em "Gere tokens de acesso") pra ligar a Página do FB / Instagram a um cliente. Depois disso a Gui recebe e responde os DMs.</p>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={conferir} disabled={vendo}
          className="rounded-lg border border-g-line px-3 py-1.5 text-[12px] font-bold text-g-word disabled:opacity-50">
          {vendo ? "conferindo…" : "Conferir na Meta"}
        </button>
        <span className="text-[11px] text-g-muted">pergunta ao provedor, não ao nosso banco</span>
      </div>

      {ver && (
        <div className="mt-3 rounded-xl border border-g-line bg-black/10 p-3 text-[12px] leading-relaxed">
          <div><b>{sinal(ver.st?.vivo)} Página:</b> {ver.st?.page_id || "—"} {ver.st?.motivo ? <span className="text-g-muted">· {ver.st.motivo}</span> : null}</div>
          <div className="mt-1">
            <b>{ver.st?.instagram_mapeado ? "🟢" : "🔴"} Instagram:</b>{" "}
            {ver.st?.ig_id
              ? ver.st.ig_id
              : (ver.au?.instagram?.id
                ? <>não mapeado — achei <b>@{ver.au.instagram.usuario || ver.au.instagram.id}</b>{" "}
                    <button type="button" onClick={() => mapearIg(ver.au.instagram.id)} disabled={vendo}
                      className="ml-1 rounded-md bg-g-gold/20 px-2 py-0.5 font-bold text-g-gold disabled:opacity-50">mapear agora</button></>
                : "nenhum Instagram ligado a esta Página na Meta")}
          </div>
          {ver.au?.mapa_diverge && (
            <div className="mt-2 rounded-lg border border-g-gold/40 bg-g-gold/10 px-2 py-1 text-g-gold">
              🚨 o mapa manda as mensagens desta página para <b>{ver.au.mapa_aponta_para}</b>, não para {f.email} — reconecte pelo dono certo
            </div>
          )}
          {ver.au && ver.au.ok === false && <div className="mt-1 text-g-muted">auditoria: {ver.au.motivo}</div>}
        </div>
      )}

      <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] font-bold text-g-muted">Email do cliente Guileo
          <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="ex.: naturaspaadm@gmail.com" className={inp} /></label>
        <label className="text-[11px] font-bold text-g-muted">Nome do negócio (opcional)
          <input value={f.business} onChange={(e) => setF({ ...f, business: e.target.value })} placeholder="ex.: MED MUNDO BR" className={inp} /></label>
        <label className="text-[11px] font-bold text-g-muted">ID da Página do Facebook
          <input value={f.page_id} onChange={(e) => setF({ ...f, page_id: e.target.value })} placeholder="ex.: 1088591857680829" className={inp} /></label>
        <label className="text-[11px] font-bold text-g-muted">ID da conta Instagram (opcional)
          <input value={f.ig_id} onChange={(e) => setF({ ...f, ig_id: e.target.value })} placeholder="só se conectar IG" className={inp} /></label>
        <label className="text-[11px] font-bold text-g-muted sm:col-span-2">Page Access Token (cole aqui — começa com EAA…)
          <input value={f.page_access_token} onChange={(e) => setF({ ...f, page_access_token: e.target.value })} placeholder="EAAG…" className={inp} /></label>
        <button disabled={busy} className="rounded-lg bg-gradient-to-r from-g-green to-g-dark px-3.5 py-2 text-[12px] font-bold text-white disabled:opacity-50 sm:col-span-2">{busy ? "Ligando…" : "🔗 Ligar página ao cliente"}</button>
      </form>
      {msg && (
        <div className="mt-2">
          <div className={`text-[12px] font-bold ${msg.ok ? "text-g-green" : "text-[#c8623c]"}`}>{msg.ok || msg.err}</div>
          {/* o CONSERTO, quando existe — sem ele o erro só frustra */}
          {msg.como && <div className="mt-1 text-[12px] text-g-muted">↳ {msg.como}</div>}
          {/* guardou, mas falta a permissão do evento: verde que não entrega */}
          {msg.aviso && <div className="mt-1 rounded-lg border border-[#c89a3c] bg-[#c89a3c]/10 px-2.5 py-1.5 text-[12px] text-[#8a6a1f]">{msg.aviso}</div>}
        </div>
      )}
    </div>
  );
}
