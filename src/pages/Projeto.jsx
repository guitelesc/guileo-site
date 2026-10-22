// /projeto?t=<token> — o quadro do projeto para o PARCEIRO (Scale Pods), em inglês. O token é a
// permissão (como o /sign). Prévia do link no WhatsApp: functions/lib/projetoOg.js.
import { useCallback, useEffect } from "react";
import ProjetoBoard from "../components/ProjetoBoard.jsx";
import "./Sign.natura.css";
import "./Projeto.css";

export default function Projeto() {
  const tok = (() => { try { return new URLSearchParams(window.location.search).get("t") || ""; } catch { return ""; } })();
  useEffect(() => {
    document.body.classList.add("sign-natura-body");
    const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex, nofollow"; document.head.appendChild(m);
    document.title = "Natura Spa × Guileo AI · Build to Go-Live";
    return () => { document.body.classList.remove("sign-natura-body"); m.remove(); };
  }, []);
  const call = useCallback(async (body) => {
    try {
      const r = await fetch("/api/projeto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, t: tok }) });
      return await r.json().catch(() => ({ ok: false, erro: "indisponivel" }));
    } catch { return { ok: false, erro: "indisponivel" }; }
  }, [tok]);
  return <ProjetoBoard modo="parceiro" lang="en" call={call} />;
}
