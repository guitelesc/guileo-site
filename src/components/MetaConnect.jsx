import { useState } from "react";

// 🔗 Conectar Meta — o dono COLA o Page Access Token (gerado na Meta) pra ligar uma Página do
// Facebook / conta Instagram a um cliente do Guileo. POST /api/meta-connect (admin-gated).
// Depois disso o webhook sabe de quem é a mensagem e a Gui responde. Light theme /admin.
export default function MetaConnect({ token }) {
  const [f, setF] = useState({ email: "", page_id: "", page_access_token: "", ig_id: "", business: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.email.includes("@")) { setMsg({ err: "Informe o email do cliente Guileo." }); return; }
    if (!f.page_id && !f.ig_id) { setMsg({ err: "Informe o ID da Página (ou do Instagram)." }); return; }
    if (!f.page_access_token.trim()) { setMsg({ err: "Cole o Page Access Token." }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/meta-connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "connect", token, ...f }) }).then((x) => x.json());
      if (r.ok) { setMsg({ ok: r.note || "Ligado! A Gui já recebe e responde nessa página." }); setF({ ...f, page_access_token: "" }); }
      else setMsg({ err: r.error || "Falhou — confira os dados." });
    } catch { setMsg({ err: "Erro de rede." }); }
    setBusy(false);
  };

  const inp = "mt-1 block w-full rounded-lg border border-g-line bg-white/[0.05] px-2.5 py-1.5 text-[12px] text-g-word placeholder:text-g-muted";
  return (
    <div className="mt-6 rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">🔗 Conectar Meta (Instagram / Messenger)</div>
      <p className="text-[12px] text-g-muted">Cole o <b>Page Access Token</b> (gerado na Meta em "Gere tokens de acesso") pra ligar a Página do FB / Instagram a um cliente. Depois disso a Gui recebe e responde os DMs.</p>
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
      {msg && <div className={`mt-2 text-[12px] font-bold ${msg.ok ? "text-g-green" : "text-[#c8623c]"}`}>{msg.ok || msg.err}</div>}
    </div>
  );
}
