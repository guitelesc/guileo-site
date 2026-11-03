// /natura-channels — standalone login for the Natura channels module (email/WhatsApp/voice/SMS/FB/IG).
// Fully separate from the main site's Portal.jsx login: its own route, its own Supabase
// project (src/lib/naturaSupabase.js), its own server-side check (functions/api/natura-login.js).
// Visually this now matches the MAIN app's dark "warm cement" theme — same card, same inputs,
// same logo treatment as Portal.jsx's Login() — instead of the cream/gold "deck" skin, so it
// doesn't feel like a different product bolted onto the site.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { naturaSaveSession } from "../lib/naturaSession.js";
import logo from "../assets/guileo-mark.png";

const LOGIN_INPUT = "w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70";

export default function NaturaLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  const entrar = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErro("");
    try {
      const r = await fetch("/api/natura-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: pw }),
      });
      const data = await r.json().catch(() => ({}));
      setBusy(false);
      if (!r.ok || !data.ok) {
        setErro(data.error === "too many attempts" ? "Too many attempts — wait a minute." : "Wrong e-mail or password.");
        return;
      }
      naturaSaveSession({ email: data.user.email, name: data.user.name, sid: data.user.sid, at: Date.now() });
      nav("/natura-channels/dashboard");
    } catch {
      setBusy(false);
      setErro("Couldn't reach the server. Try again.");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-xl3 border border-white/15 bg-white/[0.04] backdrop-blur-xl p-8 shadow-lift text-center">
        <img src={logo} alt="Guileo" className="h-12 w-12 object-contain mx-auto" />
        <div className="mt-3 text-xl font-black uppercase tracking-tight bg-gradient-to-r from-g-green via-g-gold to-g-green bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">Lilian Channels</div>
        <p className="text-xs text-g-muted mt-1">Email, WhatsApp, voice, SMS, Facebook and Instagram — one dashboard.</p>
        <form onSubmit={entrar} className="mt-6 space-y-2.5 text-left">
          <input type="email" required autoComplete="username" value={email} onChange={(ev) => setEmail(ev.target.value)} aria-label="Email address" placeholder="you@email.com" className={LOGIN_INPUT} />
          <input type="password" required autoComplete="current-password" value={pw} onChange={(ev) => setPw(ev.target.value)} aria-label="Password" placeholder="Password" className={LOGIN_INPUT} />
          {erro && (
            <div role="alert" className="text-[11px] text-red-400 text-center">{erro}</div>
          )}
          <button disabled={busy} className="btn-bright text-sm w-full disabled:opacity-70">{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </motion.div>
    </div>
  );
}
