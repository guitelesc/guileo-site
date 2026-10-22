// /admin/agente — sincronizar o agente de voz de UM cliente com a senha do /admin (2026-10-08).
// Existe porque o INGEST_SECRET é segredo do Cloudflare (ninguém lê de volta): sem esta tela, o
// "pode sincronizar a Natura" do dono não tinha como virar ação. Chama /api/sync-agent com
// admin_token — o cérebro sai do banco, nunca desta tela. Mostra o que o sync devolveu de verdade
// (versão carimbada, marca, idiomas); "ok" sem carimbo de versão é tratado como falha.
import { useEffect, useState } from "react";
import "./Sign.natura.css";
import "./Projeto.css";

const tokSessao = () => { try { return sessionStorage.getItem("guileo_admin_tok") || ""; } catch { return ""; } };

export default function AdminAgente() {
  const [token, setToken] = useState(tokSessao);
  const [email, setEmail] = useState("naturaspaadm@gmail.com");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [erro, setErro] = useState("");
  const [conf, setConf] = useState(false);

  useEffect(() => {
    document.body.classList.add("sign-natura-body");
    document.title = "Sincronizar agente · Guileo";
    return () => document.body.classList.remove("sign-natura-body");
  }, []);

  const sincronizar = async () => {
    setBusy(true); setErro(""); setRes(null); setConf(false);
    try {
      const r = await fetch("/api/sync-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), admin_token: token.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) setErro("Senha de admin incorreta.");
      else if (r.status === 429) setErro("Muitas tentativas. Espere um minuto.");
      else if (r.ok && d.ok && d.cerebro_versao) { setRes(d); try { sessionStorage.setItem("guileo_admin_tok", token.trim()); } catch { /* */ } }
      else setErro(`Não sincronizou: ${d.error || d.detail || `HTTP ${r.status}`}`);
    } catch { setErro("Não consegui falar com o servidor."); }
    setBusy(false);
  };

  return (
    <div className="sign-natura prj">
      <div className="sn-band"><div className="prj-wrap prj-band-in"><div><div className="sn-band-name">Guileo · Agente de voz</div><div className="sn-band-sub">Área interna</div></div></div></div>
      <div className="prj-wrap" style={{ paddingBlock: 36, maxWidth: 560 }}>
        <div className="sn-panel p-5 grid gap-4">
          <div>
            <div className="sn-eye">Sincronizar agente</div>
            <p className="sn-p text-sm mt-1">Reconstrói o agente do cliente a partir dos dados da Central (cérebro, serviços, preços, saudação, ferramentas). Use depois de aprovar uma mudança. Vale na hora para as próximas ligações.</p>
          </div>
          <label className="prj-lbl">E-mail do cliente<input className="prj-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="prj-lbl">Senha de admin<input className="prj-in" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} /></label>
          {!conf
            ? <button className="prj-btn" disabled={busy || !token || !email.includes("@")} onClick={() => setConf(true)}>Sincronizar agente</button>
            : <div className="prj-btns"><span className="text-sm font-bold">Sincronizar o agente AO VIVO de {email}?</span><button className="prj-btn" disabled={busy} onClick={sincronizar}>{busy ? "Sincronizando…" : "Sim, sincronizar"}</button><button className="prj-btn ghost" disabled={busy} onClick={() => setConf(false)}>Cancelar</button></div>}
          {erro && <div className="sn-err p-3 text-sm"><span className="sn-err-t font-bold">{erro}</span></div>}
          {res && (
            <div className="sn-done p-4 grid gap-1 text-sm" role="status">
              <b className="sn-ok">✓ Agente sincronizado</b>
              <span>Negócio: <b>{res.negocio}</b></span>
              <span>Versão do cérebro: <b>{res.cerebro_versao}</b></span>
              {Array.isArray(res.languages) && res.languages.every((x) => typeof x === "string") && <span>Idiomas: {res.languages.join(", ")}</span>}
              <span className="sn-muted">Agente: {res.agent_id}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
