// /admin/parceiros — PARCEIROS COM ACESSO NOMINAL (CR-03, 2026-10-13). O Luis cria o usuário da
// Scale Pods (nome, e-mail, quais clientes), recebe a senha inicial UMA vez para entregar pessoa a
// pessoa, vê as entradas registradas, liga/desliga clientes e revoga. Senha do /admin, como as outras.
import { useCallback, useEffect, useState } from "react";
import "./Sign.natura.css";
import "./Projeto.css";

const TENANTS = [
  { email: "e2e-test@guileoai.com", nome: "Conta de teste (e2e-test)" },
  { email: "naturaspaadm@gmail.com", nome: "Natura Spa + Salon (AO VIVO)" },
];
const tokSessao = () => { try { return sessionStorage.getItem("guileo_admin_tok") || ""; } catch { return ""; } };
const fmt = (ts) => ts ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/New_York", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(ts)) : "—";

export default function AdminParceiros() {
  const [token, setToken] = useState(tokSessao);
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [f, setF] = useState({ nome: "", email: "", empresa: "Scale Pods", tenants: ["e2e-test@guileoai.com"] });
  const [busy, setBusy] = useState(false);
  const [senha, setSenha] = useState(null); // {email, senha_inicial} — aparece uma vez
  const [conf, setConf] = useState("");

  useEffect(() => { document.body.classList.add("sign-natura-body"); document.title = "Parceiros · Guileo"; return () => document.body.classList.remove("sign-natura-body"); }, []);

  const post = useCallback(async (body) => {
    try {
      const r = await fetch("/api/parceiro-acesso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, admin_token: token.trim() }) });
      return await r.json().catch(() => ({ ok: false, erro: "indisponivel" }));
    } catch { return { ok: false, erro: "indisponivel" }; }
  }, [token]);

  const carregar = async () => {
    setErro("");
    const r = await post({ action: "admin_listar" });
    if (r.ok) { setLista(r.parceiros); try { sessionStorage.setItem("guileo_admin_tok", token.trim()); } catch { /* */ } }
    else setErro(r.erro === "unauthorized" ? "Senha de admin incorreta." : `Não consegui carregar (${r.erro || "?"}${r.detalhe ? ": " + r.detalhe : ""}). O SQL db/parceiros.sql já foi colado?`);
  };
  useEffect(() => { if (token) carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const criar = async (e) => {
    e.preventDefault(); setBusy(true); setErro(""); setSenha(null);
    const r = await post({ action: "admin_criar", ...f });
    setBusy(false);
    if (r.ok) { setSenha({ email: r.parceiro.email, senha_inicial: r.senha_inicial, ja: r.usuario_ja_existia }); setF({ nome: "", email: "", empresa: "Scale Pods", tenants: ["e2e-test@guileoai.com"] }); carregar(); }
    else setErro(r.erro === "tenant" ? `Cliente não existe: ${r.detalhe}` : r.erro === "service_role" ? r.detalhe : `Não criou: ${r.detalhe || r.erro}`);
  };
  const revogar = async (id) => { setConf(""); const r = await post({ action: "admin_revogar", id }); if (!r.ok) setErro(`Não revogou: ${r.erro}`); carregar(); };
  const tenants = async (p, email, on) => {
    const t = on ? [...new Set([...(p.tenants || []), email])] : (p.tenants || []).filter((x) => x !== email);
    const r = await post({ action: "admin_tenants", id: p.id, tenants: t }); if (!r.ok) setErro(`Não salvou: ${r.erro}`); carregar();
  };

  if (!lista) return (
    <div className="sign-natura prj">
      <div className="sn-band"><div className="prj-wrap prj-band-in"><div><div className="sn-band-name">Guileo · Parceiros</div><div className="sn-band-sub">Área interna</div></div></div></div>
      <form className="prj-wrap" style={{ paddingBlock: 40, maxWidth: 440 }} onSubmit={(e) => { e.preventDefault(); carregar(); }}>
        <div className="sn-panel p-5 grid gap-3"><div className="sn-eye">Acesso nominal de parceiros</div>
          <label className="prj-lbl">Senha de admin<input className="prj-in" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} /></label>
          {erro && <div className="sn-err p-3 text-sm"><span className="sn-err-t font-bold">{erro}</span></div>}
          <button className="prj-btn" disabled={!token}>Entrar</button></div>
      </form>
    </div>
  );

  return (
    <div className="sign-natura prj">
      <div className="sn-band"><div className="prj-wrap prj-band-in"><div><div className="sn-band-name">Guileo · Parceiros</div><div className="sn-band-sub">Quem entra na Central em nome da Origem</div></div></div></div>
      <div className="prj-wrap grid gap-5" style={{ paddingBlock: 28, maxWidth: 820 }}>
        <form className="sn-panel p-5 grid gap-3" onSubmit={criar}>
          <div><div className="sn-eye">Novo parceiro</div><p className="sn-p text-sm mt-1">Cria o usuário (e-mail + senha) e diz em quais clientes ele pode entrar. A senha inicial aparece <b>uma vez</b>: entregue por ligação ou gerenciador de senhas. Ele troca no primeiro acesso.</p></div>
          <div className="prj-edit" style={{ padding: 0 }}>
            <div className="row">
              <label className="prj-lbl">Nome<input className="prj-in" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></label>
              <label className="prj-lbl">E-mail do parceiro<input className="prj-in" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></label>
              <label className="prj-lbl">Empresa<input className="prj-in" value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value })} /></label>
            </div>
          </div>
          <div className="prj-lbl">Pode entrar em</div>
          {TENANTS.map((t) => (
            <label key={t.email} className="prj-toggle"><input type="checkbox" className="sn-check" checked={f.tenants.includes(t.email)} onChange={(e) => setF({ ...f, tenants: e.target.checked ? [...f.tenants, t.email] : f.tenants.filter((x) => x !== t.email) })} /> {t.nome} <span className="sn-muted text-xs">{t.email}</span></label>
          ))}
          {erro && <div className="sn-err p-3 text-sm"><span className="sn-err-t font-bold">{erro}</span></div>}
          <div><button className="prj-btn" disabled={busy}>{busy ? "Criando…" : "Criar parceiro"}</button></div>
          {senha && (
            <div className="sn-done p-4 grid gap-1 text-sm" role="status">
              <b className="sn-ok">✓ Parceiro criado · {senha.email}</b>
              {senha.senha_inicial
                ? <><span>Senha inicial (aparece só agora):</span><code className="sn-code" style={{ fontSize: 16, userSelect: "all" }}>{senha.senha_inicial}</code><span className="sn-muted">Entra em <b>guileoai.com/parceiro/entrar</b>. Entregue pessoa a pessoa.</span></>
                : <span className="sn-muted">O usuário já existia; a senha dele continua a mesma. Clientes atualizados.</span>}
            </div>
          )}
        </form>

        <div className="sn-panel overflow-hidden">
          <div className="p-4" style={{ borderBottom: "1px solid var(--sn-line)" }}><div className="sn-eye">Parceiros ({lista.length})</div></div>
          <ul className="prj-list">
            {lista.map((p) => (
              <li key={p.id} className={"prj-item" + (p.revogado_em ? " acc" : "")} style={{ gridTemplateColumns: "1fr" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <b>{p.nome}</b><span className="sn-muted text-sm">{p.email} · {p.empresa}</span>
                  {p.revogado_em ? <span className="pill s-cr" style={{ fontSize: 11 }}>Revogado {fmt(p.revogado_em)}</span> : <span className="pill s-live" style={{ fontSize: 11 }}>Ativo</span>}
                </div>
                <div className="prj-meta">Entradas: <b>{p.entradas}</b> · Última: {fmt(p.ultimo_uso)} {p.ultimo_tenant ? `em ${p.ultimo_tenant}` : ""}</div>
                {!p.revogado_em && (
                  <div className="prj-meta" style={{ gap: 14 }}>
                    {TENANTS.map((t) => <label key={t.email} className="prj-toggle"><input type="checkbox" className="sn-check" checked={(p.tenants || []).includes(t.email)} onChange={(e) => tenants(p, t.email, e.target.checked)} /> {t.nome}</label>)}
                  </div>
                )}
                {!p.revogado_em && (
                  <div className="prj-btns" style={{ marginTop: 6 }}>
                    {conf !== p.id ? <button type="button" className="prj-btn danger" onClick={() => setConf(p.id)}>Revogar acesso</button>
                      : <><b className="sn-err-t text-sm">Apaga o usuário e trava a linha. Troque a chave dos clientes em /admin se precisar.</b><button type="button" className="prj-btn danger" onClick={() => revogar(p.id)}>Sim, revogar</button><button type="button" className="prj-btn ghost" onClick={() => setConf("")}>Cancelar</button></>}
                  </div>
                )}
              </li>
            ))}
            {!lista.length && <li className="prj-item sn-muted text-sm" style={{ display: "block" }}>Nenhum parceiro ainda.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
