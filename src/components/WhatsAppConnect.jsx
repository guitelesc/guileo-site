import { useState } from "react";

// 💬 Conectar WhatsApp — o dono COLA o token do WhatsApp Cloud (Usuário do Sistema, permanente)
// e ele vai direto pro banco pelo /api/whatsapp-connect (admin-gated). O token nunca passa por
// chat nem volta pra tela depois de salvo.
//
// A DIFERENÇA DESTE CARD pro de Meta: ele não diz "salvo", diz "PROVADO". O backend pergunta ao
// Graph quem é o número ANTES de gravar e relê depois — porque em 17/08 um token guardado e
// vencido deixou a Gui lendo mensagem e não respondendo, e o cockpit não tinha como saber.
// Por isso existe também o botão "Testar", que responde "ainda funciona?" sem mandar mensagem
// pra cliente nenhum (é uma leitura no Graph, não um envio).
export default function WhatsAppConnect({ token }) {
  const [f, setF] = useState({ email: "", access_token: "", phone_number_id: "", waba_id: "", label: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const chamar = async (action, corpo) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/whatsapp-connect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token, email: f.email, ...corpo }),
      }).then((x) => x.json());
      setBusy(false);
      return r;
    } catch { setBusy(false); return { error: "Erro de rede." }; }
  };

  const conectar = async (e) => {
    e.preventDefault();
    if (!f.email.includes("@")) { setMsg({ err: "Informe o email do cliente Guileo." }); return; }
    if (!f.access_token.trim()) { setMsg({ err: "Cole o token (começa com EAA…)." }); return; }
    const r = await chamar("connect", {
      access_token: f.access_token.trim(),
      phone_number_id: f.phone_number_id.trim(),
      waba_id: f.waba_id.trim(),
      label: f.label.trim(),
    });
    if (r.ok) { setMsg({ ok: r.note }); setF({ ...f, access_token: "" }); }   // limpa o campo do segredo
    else setMsg({ err: r.error || r.note || "Falhou." });
  };

  const testar = async () => {
    if (!f.email.includes("@")) { setMsg({ err: "Informe o email do cliente pra testar." }); return; }
    const r = await chamar("testar", {});
    if (r.error) { setMsg({ err: r.error }); return; }
    setMsg(r.vivo
      ? { ok: `🟢 Token VIVO — número ${r.numero || r.phone_number_id}${r.token_kind ? ` (${r.token_kind})` : ""}. A Gui consegue responder.` }
      : { err: `🔴 Token não responde: ${r.motivo}. A Gui vai ler as mensagens e NÃO conseguir responder.` });
  };

  const inp = "mt-1 block w-full rounded-lg border border-g-line bg-white/[0.05] px-2.5 py-1.5 text-[12px] text-g-word placeholder:text-g-muted";
  return (
    <div className="mt-6 rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">💬 Conectar WhatsApp (Cloud API)</div>
      <p className="text-[12px] text-g-muted">
        Cole o <b>token do Usuário do Sistema</b> (Meta Business → Usuários do sistema → Gerar token, expiração <b>Nunca</b>).
        Ele é <b>conferido no Graph antes de ser gravado</b>: token que não responde não entra no banco.
        Deixe os IDs em branco pra manter os que já estão guardados — trocar só o token é o caso normal.
      </p>
      <form onSubmit={conectar} className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] font-bold text-g-muted">Email do cliente Guileo
          <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="ex.: luistelesc@gmail.com" className={inp} /></label>
        <label className="text-[11px] font-bold text-g-muted">Rótulo (opcional)
          <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="ex.: Natura Spa — linha principal" className={inp} /></label>
        <label className="text-[11px] font-bold text-g-muted">phone_number_id (deixe vazio pra manter)
          <input value={f.phone_number_id} onChange={(e) => setF({ ...f, phone_number_id: e.target.value })} placeholder="ex.: 1264285130098700" className={inp} /></label>
        <label className="text-[11px] font-bold text-g-muted">waba_id (deixe vazio pra manter)
          <input value={f.waba_id} onChange={(e) => setF({ ...f, waba_id: e.target.value })} placeholder="ex.: 972448889140826" className={inp} /></label>
        <label className="text-[11px] font-bold text-g-muted sm:col-span-2">Token de acesso (cole aqui — começa com EAA…)
          <input type="password" autoComplete="off" value={f.access_token} onChange={(e) => setF({ ...f, access_token: e.target.value })} placeholder="EAA…" className={inp} /></label>
        <button disabled={busy} className="rounded-lg bg-gradient-to-r from-g-green to-g-dark px-3.5 py-2 text-[12px] font-bold text-white disabled:opacity-50">
          {busy ? "Conferindo com a Meta…" : "💬 Ligar WhatsApp ao cliente"}
        </button>
        <button type="button" onClick={testar} disabled={busy} className="rounded-lg border border-g-line px-3.5 py-2 text-[12px] font-bold text-g-word disabled:opacity-50">
          🩺 Testar o token guardado
        </button>
      </form>
      {msg && <div className={`mt-2 text-[12px] font-bold ${msg.ok ? "text-g-green" : "text-[#c8623c]"}`}>{msg.ok || msg.err}</div>}
    </div>
  );
}
