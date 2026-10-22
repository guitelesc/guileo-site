/* Split out of Portal.jsx (performance): Channels tab view.
   ── OS CANAIS DE VERDADE (2026-08-20) ──────────────────────────────────────────────────────────
   Esta tela desenhava canais fictícios com números de conversa inventados, enquanto
   `client_integrations` sabia exatamente o que está conectado. É a pergunta que o dono faz todo
   dia — "o WhatsApp já está funcionando?" — e a tela respondia com ficção.

   🚨 O QUE ESTA TELA MOSTRA É CONEXÃO, NÃO VOLUME. A versão de amostra exibia "conversas" e
   "ganhas" por canal; esses números não existem por canal no banco. Trocar dado inventado por
   outro dado inventado não seria conserto. Volume real por canal vive na Caixa e no Overview,
   que já leem eventos; aqui a verdade é binária e útil: ligado, com qual identidade, desde quando.

   🚨 NENHUMA CREDENCIAL CHEGA AQUI. A RPC devolve rótulo seguro (número, @, link) e nunca o token
   — devolver `tokens` inteiro mandaria o access_token da Meta do cliente para dentro do navegador. */
import { useState, useEffect } from "react";
import { fetchCanais } from "../lib/portalApi.js";
import { CHANNELS, Card, tr, FaixaAmostra } from "../pages/Portal.jsx";
import { Count } from "../lib/ui.jsx";

// nome bonito por provedor; provedor desconhecido aparece com o próprio nome, nunca sumido.
const ROTULO = {
  twilio_number: "Telefone", whatsapp_cloud: "WhatsApp", instagram: "Instagram", meta: "Facebook / Meta",
  google_business: "Google Meu Negócio", reviews: "Avaliações", ads: "Anúncios",
  mindbody: "MindBody", notify_phone: "Alerta do dono", sms: "SMS", tiktok: "TikTok",
};
const ICONE = {
  twilio_number: "📞", whatsapp_cloud: "💬", instagram: "📸", meta: "👍", google_business: "🗺️",
  reviews: "⭐", ads: "📣", mindbody: "🧘", notify_phone: "🔔", sms: "✉️", tiktok: "🎵",
};

function Channels({ real, email, dataKey }) {
  const [canais, setCanais] = useState({ estado: "carregando", dados: null, motivo: null });
  useEffect(() => {
    let vivo = true;
    if (!real || !email || !dataKey) { setCanais({ estado: "amostra", dados: null, motivo: null }); return () => { vivo = false; }; }
    fetchCanais(email, dataKey).then((r) => { if (vivo) setCanais({ estado: r.dados ? "ok" : "err", dados: r.dados, motivo: r.motivo }); });
    return () => { vivo = false; };
  }, [real, email, dataKey]);
  const reais = canais.estado === "ok" && Array.isArray(canais.dados) ? canais.dados : null;

  return (
    <>
      <FaixaAmostra real={real && !reais} />
      {canais.estado === "err" && (
        <div className="mb-3 rounded-xl border border-[#e0855f]/40 bg-[#e0855f]/[0.08] px-3.5 py-2.5 text-[12px] text-[#e0855f]">
          {tr("Couldn't read your channels")} — {canais.motivo}
        </div>
      )}

      {reais ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger">
          {reais.map((c) => {
            /* `pending` é do próprio registro: o canal foi cadastrado mas a plataforma ainda não
               liberou. Dizer isso é o que impede o dono de achar que está no ar e não estar. */
            const pendente = c.estado === "pending";
            return (
              <Card key={c.canal} tone={pendente ? undefined : "green"}>
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.07] text-[20px]">{ICONE[c.canal] || "🔗"}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-g-word">{ROTULO[c.canal] || c.canal}</div>
                    <div className="truncate text-[11px] text-g-muted">{c.rotulo || tr("connected")}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: pendente ? "#FFC23D" : "#3E9468", boxShadow: `0 0 8px ${pendente ? "#FFC23D" : "#3E9468"}` }} />
                  <span className="text-[11.5px] font-bold" style={{ color: pendente ? "#FFC23D" : "#3E9468" }}>
                    {pendente ? tr("Waiting for approval") : tr("Live")}
                  </span>
                </div>
              </Card>
            );
          })}
          {reais.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3">
              <div className="py-4 text-center text-[12.5px] text-g-muted">{tr("No channel connected yet.")}</div>
            </Card>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {CHANNELS.map((c) => (
            <Card key={c.name} tone="green">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center h-11 w-11 rounded-xl bg-white/[0.07]" style={{ color: c.color }}><c.Icon size={20} /></span>
                <div><div className="text-sm font-extrabold text-g-word">{c.name}</div><div className="text-[11px] text-g-muted">{c.note}</div></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div><div className="text-xl font-extrabold text-g-word num"><Count to={c.convos} /></div><div className="text-[10px] uppercase tracking-wide text-g-muted">{tr("Conversations")}</div></div>
                <div><div className="text-xl font-extrabold text-g-green money-glow num"><Count to={c.won} /></div><div className="text-[10px] uppercase tracking-wide text-g-muted">{tr("Won / booked")}</div></div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export default Channels;
