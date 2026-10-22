// "Use a sua própria conta Stripe" — para negócio fora do Brasil (2026-10-05).
// A plataforma Stripe da Guileo é brasileira e o Stripe não repassa de plataforma BR para conta nos
// EUA. O negócio cria uma chave RESTRITA no próprio Stripe e cola aqui; o sinal do agendamento passa
// a ser cobrado direto na conta dele. A chave vai para o servidor e nunca volta (só os 4 finais).
import { useState, useEffect, useCallback } from "react";

const T = {
  pt: { title: "Negócio nos EUA? Use a sua conta Stripe", sub: "O dinheiro do sinal cai direto na sua conta Stripe, sem passar pela Guileo.",
    steps: ["Entre no seu Stripe → Developers → API keys.", "Clique em “Create restricted key”.", "Em “Checkout Sessions” marque Write e em “Charges” marque Read (para vermos estornos feitos no seu Stripe). Se quiser, “Account” Read para mostrarmos o nome da conta. Nada mais.", "Copie a chave (começa com rk_live_) e cole aqui."],
    ph: "rk_live_…", save: "Ligar minha conta", saving: "Testando a chave no Stripe…", need: "Preencha e-mail e código lá em cima.",
    on: "Ligada ✓", mode: { live: "modo real", test: "modo teste" }, remove: "Desligar", full: "Você colou a chave secreta COMPLETA. Funciona, mas é mais seguro criar uma restrita só com Checkout.",
    err: { invalid_key: "Isso não parece uma chave do Stripe (rk_live_… ou sk_live_…).", stripe_rejected_key: "O Stripe recusou essa chave. Confira se copiou inteira.", missing_checkout_permission: "A chave não tem permissão de Checkout Sessions (Write). Edite a chave no Stripe e marque essa opção.", unauthorized: "E-mail ou código de conexão não conferem.", x: "Não consegui agora. Tente de novo." },
    what: "O que liga: o link do sinal que a Lilian e o Balcão mandam. Pacote, vale-presente e loja online ainda precisam do caminho da Guileo." },
  en: { title: "Business in the US? Use your own Stripe account", sub: "Deposit money lands straight in your Stripe account, never through Guileo.",
    steps: ["Open your Stripe → Developers → API keys.", "Click “Create restricted key”.", "Under “Checkout Sessions” choose Write and under “Charges” choose Read (so we see refunds you make in Stripe). Optionally, “Account” Read so we can show the account name. Nothing else.", "Copy the key (starts with rk_live_) and paste it here."],
    ph: "rk_live_…", save: "Connect my account", saving: "Testing the key with Stripe…", need: "Fill in email and code above.",
    on: "Connected ✓", mode: { live: "live mode", test: "test mode" }, remove: "Disconnect", full: "You pasted the FULL secret key. It works, but a restricted key with only Checkout is safer.",
    err: { invalid_key: "That doesn't look like a Stripe key (rk_live_… or sk_live_…).", stripe_rejected_key: "Stripe rejected that key. Check you copied all of it.", missing_checkout_permission: "The key lacks Checkout Sessions (Write). Edit it in Stripe and tick that permission.", unauthorized: "Email or connection code don't match.", x: "Couldn't right now. Try again." },
    what: "What this turns on: the deposit link that the AI and the Front desk send. Packages, gift cards and the online shop still need Guileo's payment path." },
  es: { title: "¿Negocio en EE. UU.? Usa tu propia cuenta Stripe", sub: "El dinero del depósito cae directo en tu cuenta Stripe, sin pasar por Guileo.",
    steps: ["Entra a tu Stripe → Developers → API keys.", "Haz clic en “Create restricted key”.", "En “Checkout Sessions” elige Write y en “Charges” elige Read (para ver los reembolsos hechos en tu Stripe). Si quieres, “Account” Read para mostrar el nombre. Nada más.", "Copia la clave (empieza con rk_live_) y pégala aquí."],
    ph: "rk_live_…", save: "Conectar mi cuenta", saving: "Probando la clave con Stripe…", need: "Completa correo y código arriba.",
    on: "Conectada ✓", mode: { live: "modo real", test: "modo prueba" }, remove: "Desconectar", full: "Pegaste la clave secreta COMPLETA. Funciona, pero es más seguro crear una restringida solo con Checkout.",
    err: { invalid_key: "No parece una clave de Stripe (rk_live_… o sk_live_…).", stripe_rejected_key: "Stripe rechazó la clave. Revisa que esté completa.", missing_checkout_permission: "La clave no tiene Checkout Sessions (Write). Edítala en Stripe y marca ese permiso.", unauthorized: "El correo o el código de conexión no coinciden.", x: "No pude ahora. Inténtalo de nuevo." },
    what: "Qué activa: el enlace del depósito que envían la IA y la Recepción. Paquetes, tarjetas regalo y la tienda en línea aún necesitan el camino de Guileo." },
};
T.hi = T.en;

export default function StripeProprio({ email, code, lang = "pt", field = "", onConnected }) {
  const t = T[lang] || T.pt;
  const [chave, setChave] = useState("");
  const [estado, setEstado] = useState({ fase: "idle" }); // idle | saving | erro{motivo}
  const [status, setStatus] = useState(null);             // {connected, mode, last4, account_name}
  const [aviso, setAviso] = useState("");

  const chamar = useCallback(async (corpo) => {
    try {
      const r = await fetch("/api/stripe-own", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, key: code, ...corpo }) });
      return { http: r.status, d: await r.json().catch(() => null) };
    } catch { return { http: 0, d: null }; }
  }, [email, code]);

  useEffect(() => {
    let vivo = true;
    if (!email.includes("@") || !code) return () => { vivo = false; };
    chamar({ action: "status" }).then(({ d }) => { if (vivo && d?.ok) setStatus(d); });
    return () => { vivo = false; };
  }, [email, code, chamar]);

  const salvar = async () => {
    if (!email.includes("@") || !code) { setEstado({ fase: "erro", motivo: "need" }); return; }
    setEstado({ fase: "saving" }); setAviso("");
    const { http, d } = await chamar({ action: "save", secret_key: chave.trim() });
    if (d?.ok) {
      setChave(""); setEstado({ fase: "idle" }); if (d.full_key) setAviso(t.full);
      const s = await chamar({ action: "status" }); if (s.d?.ok) setStatus(s.d);
      onConnected?.();
      return;
    }
    setEstado({ fase: "erro", motivo: http === 401 ? "unauthorized" : d?.reason || "x" });
  };
  const desligar = async () => { const { d } = await chamar({ action: "remove" }); if (d?.ok) setStatus({ connected: false }); };

  const msg = estado.fase === "erro" ? (estado.motivo === "need" ? t.need : t.err[estado.motivo] || t.err.x) : "";
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[13px] font-extrabold text-g-word">🇺🇸 {t.title}</div>
      <p className="text-[12px] text-g-muted mt-0.5">{t.sub}</p>
      {status?.connected ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-g-green/30 bg-g-green/[0.08] px-3 py-2.5">
          <div className="text-[13px] font-bold text-g-word">{t.on} <span className="font-normal text-g-muted">{status.account_name ? `${status.account_name} · ` : ""}•••• {status.last4} · {t.mode[status.mode] || status.mode}</span></div>
          <button onClick={desligar} className="text-[12px] font-bold text-g-muted hover:text-g-word">{t.remove}</button>
        </div>
      ) : (
        <>
          <ol className="mt-2.5 space-y-1 text-[12px] text-g-muted list-decimal pl-4">{t.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <div className="mt-2.5 flex gap-2">
            <input type="password" autoComplete="off" spellCheck={false} value={chave} onChange={(e) => setChave(e.target.value)} placeholder={t.ph} aria-label={t.ph} className={field + " flex-1 !py-2.5 font-mono"} />
            <button onClick={salvar} disabled={estado.fase === "saving" || !chave.trim()} className="btn-ghost text-[12px] shrink-0 disabled:opacity-40">{estado.fase === "saving" ? t.saving : t.save}</button>
          </div>
        </>
      )}
      {msg && <div role="alert" className="mt-2 text-[12px] text-g-gold">{msg}</div>}
      {aviso && <div className="mt-2 text-[12px] text-g-gold">{aviso}</div>}
      <p className="mt-2 text-[11px] text-g-muted">{t.what}</p>
    </div>
  );
}
