/* Split out of Portal.jsx (performance): Waitlist tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { portalApi, toast, fetchFilaEspera } from "../lib/portalApi.js";
import { waLink, waTo } from "../data/contact.js";
import { genWaitlist, convoAction, pushCreated, MiniStats, vnum, Card, tr, Drawer, SectionSkeleton, relTime, UI_LANG } from "../pages/Portal.jsx";

// Motivo de falha → frase. A tela imprimia o código cru ("rede", "servidor", "chave_invalida")
// depois de "Couldn't read your waitlist —": vocabulário de engenharia, em português, numa conta
// em inglês (2026-09-28).
const FRASE_FALHA = {
  rede: "Check your connection and try again.",
  servidor: "Our server didn't answer. Try again in a moment.",
  chave_invalida: "Your connection code isn't matching — paste it again in Settings.",
  sem_credencial: "Your connection code is missing — paste it in Settings.",
  resposta_estranha: "The answer came back in a format I couldn't read. Try again in a moment.",
};
// Canal: só o que o registro diz. Estava cravado "WhatsApp" em toda linha real — inclusive em
// quem entrou na fila por LIGAÇÃO, num tenant cujo WhatsApp nem está aprovado.
const CANAL = { whatsapp: "WhatsApp", wa: "WhatsApp", sms: "SMS", phone: "Phone", call: "Phone", voice: "Phone", voz: "Phone", ligacao: "Phone", email: "Email", instagram: "Instagram", messenger: "Messenger", web: "Web chat", webchat: "Web chat", widget: "Web chat" };
// `quando` pode vir como instante ISO ou como texto livre ("sexta à tarde"): ISO vira data no
// idioma da sessão, texto livre passa como está.
const LOCALE = { pt: "pt-BR", es: "es-ES", hi: "hi-IN", en: "en-US" };
const quandoDe = (q) => { const s = String(q || ""); if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s; const d = new Date(s); return Number.isNaN(d.getTime()) ? s : d.toLocaleString(LOCALE[UI_LANG] || "en-US", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); };
const canalDe = (w) => { const c = String(w.canal || w.channel || w.origem || "").toLowerCase().trim(); return CANAL[c] || ""; };

function Waitlist({ V, real, email, dataKey }) {
  // ── A FILA DE ESPERA DE VERDADE (2026-08-20) ──────────────────────────────────────────────
  // `biz_waitlist` já tinha motor de ENTRADA (`biz_waitlist_add`, que a Gui chama quando o
  // horário pedido está cheio) e nenhuma leitura — então a tela desenhava uma fila inventada
  // enquanto a real ficava invisível. Fila de espera com nome falso é pior que fila vazia: o dono
  // liga para alguém que nunca pediu nada.
  // 🚨 Fila real VAZIA é resultado legítimo, e a tela diz isso — não cai na amostra por estar sem
  // ninguém. Só a FALHA de leitura mantém a amostra, e ela vem declarada.
  const [fila, setFila] = useState({ estado: "carregando", dados: null, motivo: null });
  const [seq, setSeq] = useState(0);   // "tentar de novo"
  useEffect(() => {
    let vivo = true;
    if (!real || !email || !dataKey) { setFila({ estado: "amostra", dados: null, motivo: null }); return () => { vivo = false; }; }
    setFila({ estado: "carregando", dados: null, motivo: null });
    fetchFilaEspera(email, dataKey).then((r) => { if (vivo) setFila({ estado: r.dados ? "ok" : "err", dados: r.dados, motivo: r.motivo }); });
    return () => { vivo = false; };
  }, [real, email, dataKey, seq]);

  const reais = fila.estado === "ok" && Array.isArray(fila.dados)
    ? fila.dados.map((w) => ({ name: (w.nome || "").toString().trim() || w.contato || tr("Customer"), want: w.servico || "", ch: canalDe(w), when: quandoDe(w.quando), since: w.criado_em || w.created_at ? relTime(w.criado_em || w.created_at) : "", contact: w.contato || "", real: true }))
    : null;
  // Conta conectada nunca cai na amostra: lendo = esqueleto, falhou = aviso e lista vazia.
  const rows = reais || (real ? [] : genWaitlist(V));
  const [filled, setFilled] = useState(() => portalApi.loadState(`${V.label}:wait`, []));
  const [sel, setSel] = useState(null);
  useEffect(() => { setFilled(portalApi.loadState(`${V.label}:wait`, [])); }, [V.label]);
  // 🚨 O "JÁ OFERECI" ERA UM ÍNDICE NO NAVEGADOR (2026-09-28). `filled` guarda POSIÇÕES da lista
  // de amostra; aplicado à fila real, escondia a 1ª e a 3ª pessoa de verdade só porque alguém
  // tinha clicado na 1ª e na 3ª linha da demonstração naquele navegador — e a posição muda a cada
  // pessoa que entra. Fila real mostra TODO MUNDO que o servidor devolveu.
  const open = rows.map((r, i) => ({ r, i })).filter(({ i }) => reais || !filled.includes(i));
  // Restaurants book into Live Orders flow; appointment/field sectors have a Schedule.
  const bookView = convoAction(V).view; // "schedule" for most, "liveorders" for restaurant
  // 🚨 "Done — I've offered … the slot" SEM OFERECER NADA (2026-09-28). `offer` só grava no
  // localStorage: nenhuma mensagem sai, nenhum horário é reservado. Em conta conectada o botão não
  // existe (a oferta automática quando um horário abre é do motor de agenda, no servidor); o que
  // sobra é "Message", que abre a conversa com a PRÓPRIA pessoa. Em demonstração o toast diz que
  // é demonstração.
  const offer = (i, name, want) => {
    if (real) return;
    setFilled((f) => { const n = [...f, i]; portalApi.saveState(`${V.label}:wait`, n); return n; });
    // Stitch: an accepted waitlist offer becomes a pending booking/reservation in its tab.
    if (bookView === "schedule") {
      pushCreated(V.label, "schedule", { time: "Offered", name, meta: `Waitlist · ${want || "open slot"}`, status: "Pending", ch: "WhatsApp", color: "#D6C29A" });
      setSel(null); toast(`${tr("Demo — sample offer added to the sample schedule. Nothing was sent to")} ${name}.`);
    } else {
      pushCreated(V.label, "liveorders", { id: `#${1000 + (Date.now() % 9000)}`, customer: name, items: `Reservation · ${want || "table"}`, total: 0, channel: "WhatsApp", status: "New", color: "#3E9468" });
      setSel(null); toast(`${tr("Demo — sample offer added to the sample schedule. Nothing was sent to")} ${name}.`);
    }
  };
  if (real && fila.estado === "carregando") return <SectionSkeleton rows={4} />;
  // nome que é telefone começa com "+": a bolinha mostra "#" em vez de um "+" solto
  const inicial = (n) => { const c = (n || "").toString().trim()[0] || "?"; return /[\p{L}]/u.test(c) ? c.toUpperCase() : "#"; };
  return (
    <>
      {fila.estado === "err" && (
        <div className="mb-3 rounded-xl border border-[#e0855f]/40 bg-[#e0855f]/[0.08] px-3.5 py-2.5 flex flex-wrap items-center gap-3 text-[12px] text-[#e0855f]">
          <span className="flex-1 min-w-[12rem]">{tr("Couldn't read your waitlist")} — {tr(FRASE_FALHA[fila.motivo] || "Try again in a moment.")}</span>
          <button onClick={() => setSeq((n) => n + 1)} className="btn-ghost text-xs shrink-0">{tr("↻ Try again")}</button>
        </div>
      )}
      {reais && reais.length === 0 && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[12px] text-g-muted">
          {tr("Nobody waiting right now. When Gui hits a full slot, whoever asks goes on this list automatically.")}
        </div>
      )}
      <div className="space-y-4 stagger">
      {/* 🚨 "Filled today 9 · No-shows saved 6 · Revenue recovered $1,420" eram `vnum()` — número
          de semente — impressos AO LADO da fila real. Em conta conectada só fica o que foi contado. */}
      {real
        ? (reais ? <MiniStats items={[["Waiting now", `${open.length}`]]} /> : null)
        : <MiniStats items={[["Waiting now", `${open.length}`], ["Filled today", `${vnum(V.label, "filled", 5, 16)}`, "good"], ["No-shows saved", `${vnum(V.label, "noshow", 3, 11)}`, "good"], ["Revenue recovered", `$${vnum(V.label, "wrev", 800, 2600).toLocaleString()}`, "good"]]} />}
      {(!real || reais) && <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Waitlist · turn empty slots into revenue")}</div>
        <div className="divide-y divide-white/[0.06]">
          {open.map(({ r, i }) => (
            <button key={i} onClick={() => setSel({ r, i })} className="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition">
              <span className="relative grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{inicial(r.name)}<span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full" style={{ background: "#FFC23D", boxShadow: "0 0 7px rgba(255,194,61,.6)" }} /></span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name}</div><div className="text-[11px] text-g-muted">{[r.want, r.real ? r.when : "", r.ch ? `${tr("via")} ${r.ch}` : "", r.since].filter(Boolean).join(" · ")}</div></div>
              {!real && <span onClick={(e) => { e.stopPropagation(); offer(i, r.name, r.want); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); offer(i, r.name, r.want); } }} role="button" tabIndex={0} className="btn-bright text-xs px-3 shrink-0">{tr("Offer slot")}</span>}
            </button>
          ))}
          {!real && open.length === 0 && <div className="px-5 py-8 text-center text-xs text-g-muted">{tr("No one waiting — every seat is full. I'll text the moment a slot opens. 🎉")}</div>}
          {real && open.length === 0 && <div className="px-5 py-8 text-center text-xs text-g-muted">{tr("Nobody on the waitlist.")}</div>}
        </div>
      </Card>}
      {sel && (
        <Drawer
          title={sel.r.name}
          subtitle={sel.r.want ? `${tr("Wants")}: ${sel.r.want}` : ""}
          fields={[[tr("Looking for"), sel.r.want], [tr("Channel"), sel.r.ch], [tr("Asked for"), sel.r.real ? sel.r.when : ""], [tr("Waiting"), sel.r.since], [tr("Contact"), sel.r.real ? sel.r.contact : ""]]}
          note={sel.r.real
            ? tr("This person asked for a time that was full, and Gui put them on the list. Reach out yourself when a slot opens — the button below opens the conversation with them.")
            : `The AI will text ${sel.r.name} the instant a matching slot frees up — first to reply keeps it. No empty chairs, no manual calls.`}
          actions={sel.r.real
            ? (/\d{8,}/.test(String(sel.r.contact || "").replace(/\D/g, ""))
                ? <a href={waTo(sel.r.contact, `Hi ${sel.r.name}, a slot just opened${sel.r.want ? ` for ${sel.r.want}` : ""}…`)} target="_blank" rel="noopener" className="btn-bright text-sm">{tr("💬 Message")}</a>
                : String(sel.r.contact || "").includes("@")
                  ? <a href={`mailto:${sel.r.contact}`} className="btn-bright text-sm">✉️ {tr("Email")}</a>
                  : <span className="text-[11.5px] text-g-muted">{tr("No phone or email on file for this person.")}</span>)
            : <><button onClick={() => offer(sel.i, sel.r.name, sel.r.want)} className="btn-bright text-sm">{tr("Offer next open slot")} <span className="text-[8px] font-black uppercase opacity-70">{tr("Demo")}</span></button><a href={waLink(`Hi ${sel.r.name}, a slot just opened for ${sel.r.want}…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">{tr("💬 Message")}</a></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
    </>
  );
}

export default Waitlist;
