// /parceiro/entrar — PARTNER SIGN-IN (CR-03, 2026-10-13). Scale Pods enters Guileo Central with a
// named account: Supabase e-mail + password, then a one-time code by e-mail per client. After the
// code, the browser holds the chosen client's connection key and /portal works as that client, with
// the partner's name in the header. Every sign-in is logged server-side.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { portalApi, saveDataKey, parceiroEntrar, parceiroSair } from "../lib/portalApi.js";
import { supabase } from "../lib/supabase.js";
import "./Sign.natura.css";
import "./Projeto.css";

const token = async () => { try { const { data } = await supabase.auth.getSession(); return data?.session?.access_token || ""; } catch { return ""; } };
const api = async (body) => {
  try {
    const r = await fetch("/api/parceiro-acesso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, access_token: await token() }) });
    return await r.json().catch(() => ({ ok: false, erro: "indisponivel" }));
  } catch { return { ok: false, erro: "indisponivel" }; }
};
const ERR = { unauthorized: "Sign in first.", parceiro: "This account is not a partner account, or it was revoked.", tenant: "You don't have access to that client.", otp: "Wrong code. Check the e-mail and try again.", expirado: "That code expired. Send a new one.", email: "Couldn't send the e-mail. Try again in a minute.", devagar: "Too many attempts — wait a few minutes.", indisponivel: "Couldn't reach the server." };

export default function ParceiroEntrar() {
  const nav = useNavigate();
  const [step, setStep] = useState("login"); // login → tenant → code
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [me, setMe] = useState(null); const [tenant, setTenant] = useState("");
  const [otp, setOtp] = useState(""); const [para, setPara] = useState("");
  const [busy, setBusy] = useState(false); const [erro, setErro] = useState("");

  useEffect(() => { document.body.classList.add("sign-natura-body"); document.title = "Partner sign-in · Guileo"; return () => document.body.classList.remove("sign-natura-body"); }, []);
  useEffect(() => { (async () => { if (await token()) carregarMe(); })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const carregarMe = async () => {
    setBusy(true); setErro("");
    const r = await api({ action: "me" });
    setBusy(false);
    if (r.ok) { setMe(r); setTenant(r.tenants?.[0] || ""); setStep("tenant"); } else { setErro(ERR[r.erro] || ERR.indisponivel); if (r.erro === "parceiro") { try { await supabase.auth.signOut(); } catch { /* */ } } }
  };
  const entrar = async (e) => {
    e.preventDefault(); setBusy(true); setErro("");
    const r = await portalApi.login(email.trim(), pw);
    if (r?.error) { setBusy(false); setErro("Wrong e-mail or password."); return; }
    await carregarMe();
  };
  const pedirCodigo = async () => {
    setBusy(true); setErro("");
    const r = await api({ action: "otp", tenant, tenant_nome: me?.nomes?.[tenant] || tenant });
    setBusy(false);
    if (r.ok) { setPara(r.para); setStep("code"); } else setErro(ERR[r.erro] || ERR.indisponivel);
  };
  const confirmar = async (e) => {
    e.preventDefault(); setBusy(true); setErro("");
    const r = await api({ action: "confirmar", otp: otp.trim() });
    setBusy(false);
    if (!r.ok) { setErro(ERR[r.erro] || ERR.indisponivel); return; }
    parceiroSair();
    parceiroEntrar({ tenant: r.tenant, nome: r.nome, empresa: r.empresa, email_parceiro: r.email_parceiro, at: Date.now() });
    saveDataKey(r.key);
    nav("/portal");
  };

  return (
    <div className="sign-natura prj">
      <div className="sn-band"><div className="prj-wrap prj-band-in"><div><div className="sn-band-name">Guileo Central</div><div className="sn-band-sub">Partner sign-in</div></div></div></div>
      <div className="prj-wrap" style={{ paddingBlock: 36, maxWidth: 520 }}>
        <div className="sn-panel p-5 grid gap-4">
          {step === "login" && (
            <form className="grid gap-3" onSubmit={entrar}>
              <div><div className="sn-eye">Step 1 of 3</div><h1 className="sn-h2 mt-1">Your partner account</h1><p className="sn-p text-sm mt-1">The e-mail and password Origem gave you. Change the password on first use (Settings → Account).</p></div>
              <label className="prj-lbl">E-mail<input className="prj-in" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
              <label className="prj-lbl">Password<input className="prj-in" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
              {erro && <div className="sn-err p-3 text-sm"><span className="sn-err-t font-bold">{erro}</span></div>}
              <button className="prj-btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            </form>
          )}
          {step === "tenant" && me && (
            <div className="grid gap-3">
              <div><div className="sn-eye">Step 2 of 3 · {me.nome} · {me.empresa}</div><h1 className="sn-h2 mt-1">Which client?</h1><p className="sn-p text-sm mt-1">A one-time code goes to your e-mail. Each sign-in is logged.</p></div>
              <div className="grid gap-2">
                {(me.tenants || []).map((t) => (
                  <label key={t} className="sn-panel p-3 flex items-center gap-3" style={{ cursor: "pointer", borderColor: tenant === t ? "var(--sn-ink)" : undefined }}>
                    <input type="radio" name="tenant" className="sn-check" checked={tenant === t} onChange={() => setTenant(t)} />
                    <span><b>{me.nomes?.[t] || t}</b><span className="sn-muted text-xs block">{t}</span></span>
                  </label>
                ))}
                {!(me.tenants || []).length && <div className="sn-warn p-3 text-sm">No client assigned yet — ask Origem.</div>}
              </div>
              {erro && <div className="sn-err p-3 text-sm"><span className="sn-err-t font-bold">{erro}</span></div>}
              <div className="prj-btns"><button type="button" className="prj-btn" disabled={busy || !tenant} onClick={pedirCodigo}>{busy ? "Sending…" : "Send me the code"}</button><button type="button" className="prj-btn ghost" onClick={async () => { try { await supabase.auth.signOut(); } catch { /* */ } setStep("login"); }}>Sign out</button></div>
            </div>
          )}
          {step === "code" && (
            <form className="grid gap-3" onSubmit={confirmar}>
              <div><div className="sn-eye">Step 3 of 3</div><h1 className="sn-h2 mt-1">Enter the 6-digit code</h1><p className="sn-p text-sm mt-1">Sent to <b>{para}</b>. It expires in 10 minutes.</p></div>
              <input className="prj-in" inputMode="numeric" pattern="\d{6}" maxLength={6} autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} style={{ fontFamily: "var(--sn-mono)", fontSize: 26, letterSpacing: ".3em", textAlign: "center" }} aria-label="6-digit code" />
              {erro && <div className="sn-err p-3 text-sm"><span className="sn-err-t font-bold">{erro}</span></div>}
              <div className="prj-btns"><button className="prj-btn" disabled={busy || otp.length !== 6}>{busy ? "Checking…" : "Open Guileo Central"}</button><button type="button" className="prj-btn ghost" disabled={busy} onClick={pedirCodigo}>Send a new code</button><button type="button" className="prj-btn ghost" onClick={() => setStep("tenant")}>Back</button></div>
            </form>
          )}
        </div>
        <p className="sn-muted text-xs mt-4">Build and test on the test account first. Natura's live account only after Origem's written OK.</p>
      </div>
    </div>
  );
}
