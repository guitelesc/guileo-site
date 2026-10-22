// /admin/projetos — o quadro do projeto para a ORIGEM (Luis), em português: tudo do parceiro +
// Aceito, editar, criar, apagar e o link privado da Scale Pods (copiar / trocar).
// A senha é a mesma do /admin (sessionStorage "guileo_admin_tok", igual ao ProviderSignPanel).
import { useCallback, useEffect, useState } from "react";
import ProjetoBoard from "../components/ProjetoBoard.jsx";
import "./Sign.natura.css";
import "./Projeto.css";

const tokSessao = () => { try { return sessionStorage.getItem("guileo_admin_tok") || ""; } catch { return ""; } };

export default function AdminProjetos() {
  const [token, setToken] = useState(tokSessao);
  const [lista, setLista] = useState(null);
  const [slug, setSlug] = useState("");
  const [erro, setErro] = useState("");
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [trocar, setTrocar] = useState(false);

  useEffect(() => {
    document.body.classList.add("sign-natura-body");
    document.title = "Projetos · Guileo";
    return () => document.body.classList.remove("sign-natura-body");
  }, []);

  const post = useCallback(async (body) => {
    try {
      const r = await fetch("/api/projeto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, token: token.trim() }) });
      return await r.json().catch(() => ({ ok: false, erro: "indisponivel" }));
    } catch { return { ok: false, erro: "indisponivel" }; }
  }, [token]);

  const entrar = async (e) => {
    e && e.preventDefault(); setErro("");
    const r = await post({ action: "admin_listar" });
    if (r && r.ok) {
      try { sessionStorage.setItem("guileo_admin_tok", token.trim()); } catch { /* */ }
      setLista(r.projetos);
      if (r.projetos.length === 1) setSlug(r.projetos[0].slug);
    } else setErro(r && r.erro === "unauthorized" ? "Senha de admin incorreta." : "Não consegui carregar os projetos (o SQL db/projetos.sql já foi colado?).");
  };
  useEffect(() => { if (token) entrar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // o board relê o projeto; aqui só pegamos o link do parceiro de cada resposta
  const call = useCallback(async (body) => {
    const r = await post(body);
    if (r && r.ok && r.projeto && r.projeto.share_token) setLink(`${window.location.origin}/projeto?t=${r.projeto.share_token}`);
    return r;
  }, [post]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }
    catch { const el = document.getElementById("prj-link-in"); if (el) { el.select(); } }
  };
  const novoLink = async () => { const r = await call({ action: "admin_link", slug }); setTrocar(false); if (!(r && r.ok)) setErro("Não consegui gerar o link novo."); };

  if (!lista) {
    return (
      <div className="sign-natura prj">
        <div className="sn-band"><div className="prj-wrap prj-band-in"><div><div className="sn-band-name">Guileo · Projetos</div><div className="sn-band-sub">Área interna</div></div></div></div>
        <form className="prj-wrap" style={{ paddingBlock: 40, maxWidth: 440 }} onSubmit={entrar}>
          <div className="sn-panel p-5 grid gap-3">
            <div className="sn-eye">Acompanhamento de projetos</div>
            <label className="prj-lbl">Senha de admin<input className="prj-in" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} /></label>
            {erro && <div className="sn-err p-3 text-sm"><span className="sn-err-t font-bold">{erro}</span></div>}
            <button className="prj-btn" disabled={!token}>Entrar</button>
          </div>
        </form>
      </div>
    );
  }

  if (!slug) {
    return (
      <div className="sign-natura prj">
        <div className="sn-band"><div className="prj-wrap prj-band-in"><div className="sn-band-name">Guileo · Projetos</div></div></div>
        <div className="prj-wrap grid gap-3" style={{ paddingBlock: 32 }}>
          {lista.map((p) => (
            <button key={p.slug} type="button" className="sn-panel p-5 text-left" onClick={() => setSlug(p.slug)}>
              <div className="sn-eye">{p.cliente} · {p.parceiro}</div>
              <div className="sn-h2 mt-1">{p.nome}</div>
              <div className="sn-muted text-sm mt-1">Go-Live {p.go_live} · {p.feitos}/{p.total} feitos · {p.aceitos}/{p.total} aceitos</div>
            </button>
          ))}
          {!lista.length && <div className="sn-muted">Nenhum projeto ainda.</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      <ProjetoBoard modo="admin" lang="pt" call={call} slug={slug} />
      {/* link privado da Scale Pods — fixo no rodapé do admin */}
      <div className="sign-natura" style={{ position: "sticky", bottom: 0 }}>
        <div className="sn-bar"><div className="prj-wrap" style={{ paddingBlock: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <b className="text-sm">Link da Scale Pods</b>
          <input id="prj-link-in" className="prj-in" style={{ flex: "1 1 280px", fontFamily: "var(--sn-mono)", fontSize: 12 }} readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link da Scale Pods" />
          <button type="button" className="prj-btn" onClick={copiar} disabled={!link}>{copiado ? "Copiado ✓" : "Copiar"}</button>
          {!trocar
            ? <button type="button" className="prj-btn ghost" onClick={() => setTrocar(true)}>Trocar link</button>
            : <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><span className="text-sm sn-err-t font-bold">O link atual para de funcionar.</span><button type="button" className="prj-btn danger" onClick={novoLink}>Trocar</button><button type="button" className="prj-btn ghost" onClick={() => setTrocar(false)}>Cancelar</button></span>}
          {erro && <span className="text-sm sn-err-t">{erro}</span>}
        </div></div>
      </div>
    </>
  );
}
