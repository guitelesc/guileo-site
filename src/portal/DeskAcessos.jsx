/* ACESSO DA RECEPÇÃO (2026-10-05) — Balcão → Equipe. A dona cria um código para cada recepcionista; ela entra
   em guileoai.com/balcao com o e-mail do negócio + esse código e vê SÓ o dia (agenda, caixa, clientes,
   fechamento). Sem folha, relatórios, ajustes, estorno nem a Central. Regras: functions/lib/deskAcesso.js.
   O código aparece UMA vez (o banco guarda só o hash). Revogar corta na hora. */
import { useState, useEffect, useCallback } from "react";
import { toast } from "../lib/portalApi.js";
import { Card } from "../pages/Portal.jsx";
import { chamarDesk, motivo, tx, quando } from "./deskApi.js";

const campo = "mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-g-word placeholder:text-g-muted [color-scheme:dark]";
const dica = "mt-1 text-[11px] leading-snug text-g-muted";
const btnLinha = "rounded-full border border-white/15 px-3 py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-[11px] font-bold text-g-word hover:border-white/30 disabled:opacity-40";
const btnPrim = "rounded-full bg-g-green px-4 py-2 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-sm font-extrabold text-[#161512] disabled:opacity-40";

const T = {
  title: { en: "Front desk access", pt: "Acesso da recepção", es: "Acceso de recepción", hi: "रिसेप्शन एक्सेस" },
  hint: { en: "Give each receptionist her own code instead of your connection code. She sees only the day: schedule, checkout, clients and day close — no payroll, reports, settings, refunds or your dashboard.", pt: "Dê a cada recepcionista um código próprio, em vez do seu código de conexão. Ela vê só o dia: agenda, caixa, clientes e fechamento — sem folha, relatórios, ajustes, estorno nem a sua Central.", es: "Dale a cada recepcionista su propio código en vez de tu código de conexión. Ve solo el día: agenda, caja, clientas y cierre — sin nómina, informes, ajustes, reembolsos ni tu panel.", hi: "हर रिसेप्शनिस्ट को अपना कोड दें। वह केवल दिन देखती है: शेड्यूल, चेकआउट, ग्राहक और दिन का समापन।" },
  name: { en: "Her name", pt: "Nome dela", es: "Su nombre", hi: "उसका नाम" },
  create: { en: "Create access", pt: "Criar acesso", es: "Crear acceso", hi: "एक्सेस बनाएँ" },
  once: { en: "Send it now — it won't be shown again. The link opens the front desk straight away on her phone or tablet (no typing). Treat it like a key: send it only to her.", pt: "Mande agora — ele não aparece de novo. O link abre o balcão direto no celular ou tablet dela, sem digitar nada. É como uma chave: mande só para ela.", es: "Envíalo ahora — no se mostrará otra vez. El enlace abre la recepción directo en su celular o tableta, sin escribir. Es como una llave: envíalo solo a ella.", hi: "अभी भेजें — यह दोबारा नहीं दिखेगा। लिंक सीधे रिसेप्शन खोलता है।" },
  role: { en: "Access for", pt: "Acesso para", es: "Acceso para", hi: "किसके लिए" },
  roleDesk: { en: "Front desk (whole day)", pt: "Recepção (o dia todo)", es: "Recepción (todo el día)", hi: "रिसेप्शन" },
  rolePro: { en: "Professional", pt: "Profissional", es: "Profesional", hi: "प्रोफेशनल" },
  proHint: { en: "She sees only her own day — her clients (no phone/email), with “She's here”, “Done” and notes. No checkout, other staff or reports.", pt: "Ela vê só o dia dela — as clientes dela (sem telefone/e-mail), com “Chegou”, “Terminei” e nota. Sem caixa, sem colegas, sem relatórios.", es: "Ve solo su día — sus clientas (sin teléfono/correo), con “Llegó”, “Terminé” y notas. Sin caja, colegas ni informes.", hi: "वह केवल अपना दिन देखती है।" },
  copyLink: { en: "Copy entry link", pt: "Copiar link de entrada", es: "Copiar enlace de entrada", hi: "एंट्री लिंक कॉपी करें" },
  whats: { en: "Send on WhatsApp", pt: "Mandar no WhatsApp", es: "Enviar por WhatsApp", hi: "WhatsApp पर भेजें" },
  codeOnly: { en: "or the code alone", pt: "ou só o código", es: "o solo el código", hi: "या केवल कोड" },
  waText: { en: "Your front desk access: tap to open", pt: "Seu acesso ao balcão: toque para abrir", es: "Tu acceso a la recepción: toca para abrir", hi: "आपका रिसेप्शन एक्सेस:" },
  copy: { en: "Copy", pt: "Copiar", es: "Copiar", hi: "कॉपी" },
  copied: { en: "Copied", pt: "Copiado", es: "Copiado", hi: "कॉपी हुआ" },
  revoke: { en: "Revoke", pt: "Revogar", es: "Revocar", hi: "हटाएँ" },
  revokeQ: { en: "Revoke this access now? She is logged out on the next action.", pt: "Revogar este acesso agora? Ela sai na próxima ação.", es: "¿Revocar este acceso ahora? Sale en la próxima acción.", hi: "यह एक्सेस अभी हटाएँ?" },
  revoked: { en: "Revoked", pt: "Revogado", es: "Revocado", hi: "हटाया गया" },
  lastUse: { en: "last used", pt: "último uso", es: "último uso", hi: "अंतिम उपयोग" },
  never: { en: "never used", pt: "nunca usado", es: "nunca usado", hi: "कभी उपयोग नहीं" },
  none: { en: "No access created yet.", pt: "Nenhum acesso criado ainda.", es: "Aún no hay accesos.", hi: "अभी कोई एक्सेस नहीं।" },
  sample: { en: "Connect your account to create accesses.", pt: "Conecte a sua conta para criar acessos.", es: "Conecta tu cuenta para crear accesos.", hi: "एक्सेस बनाने के लिए खाता जोड़ें।" },
};

export default function DeskAcessos({ conectado, email, dataKey, tz, pros = [] }) {
  const [lista, setLista] = useState(null);
  const [nome, setNome] = useState("");
  const [para, setPara] = useState("recepcao");     // "recepcao" | <id da profissional>
  const nomePro = (id) => pros.find((p) => p.id === id)?.name || "";
  const [novo, setNovo] = useState(null);           // { nome, codigo } — mostrado uma vez
  const [ocupado, setOcupado] = useState("");

  const ler = useCallback(async () => {
    if (!conectado) return;
    const { d } = await chamarDesk(email, dataKey, { action: "acessos_list" });
    if (d?.ok === true) setLista(d.acessos || []);
  }, [conectado, email, dataKey]);
  useEffect(() => { ler(); }, [ler]);

  const criar = async () => {
    if (!conectado) { toast(tx(T.sample)); return; }
    if (!nome.trim()) return;
    setOcupado("criar");
    const ehPro = para !== "recepcao";
    const { http, d } = await chamarDesk(email, dataKey, { action: "acessos_criar", nome: nome.trim(), ...(ehPro ? { papel: "profissional", pro_id: para } : {}) });
    setOcupado("");
    if (d?.ok === true && d.codigo) { setNovo({ nome: d.nome, codigo: d.codigo }); setNome(""); ler(); }
    else toast(motivo(d, http));
  };
  const revogar = async (a) => {
    if (!window.confirm(`${a.nome}: ${tx(T.revokeQ)}`)) return;
    setOcupado(a.id);
    const { http, d } = await chamarDesk(email, dataKey, { action: "acessos_revogar", id: a.id });
    setOcupado("");
    if (d?.ok === true) { toast(tx(T.revoked)); ler(); } else toast(motivo(d, http));
  };
  // Link de entrada: o código vai no FRAGMENTO (#), que o navegador não manda ao servidor; /balcao lê e apaga da barra.
  const linkDe = (n) => `${window.location.origin}/balcao#e=${encodeURIComponent(email)}&c=${n.codigo}`;
  const copiar = async (txt) => {
    try { await navigator.clipboard.writeText(txt); toast(tx(T.copied)); } catch { /* continua na tela para copiar à mão */ }
  };

  return (
    <Card className="!p-4 space-y-3">
      <div>
        <div className="text-sm font-extrabold text-g-word">🔑 {tx(T.title)}</div>
        <p className={dica}>{tx(T.hint)}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[180px] flex-1 text-[11px] font-bold uppercase tracking-wider text-g-muted">{tx(T.name)}
          <input value={nome} onChange={(e) => setNome(e.target.value.slice(0, 60))} onKeyDown={(e) => { if (e.key === "Enter") criar(); }} className={campo} placeholder="Maria" />
        </label>
        <label className="min-w-[180px] flex-1 text-[11px] font-bold uppercase tracking-wider text-g-muted">{tx(T.role)}
          <select value={para} onChange={(e) => { setPara(e.target.value); if (e.target.value !== "recepcao" && !nome.trim()) setNome(nomePro(e.target.value)); }} className={campo}>
            <option value="recepcao">{tx(T.roleDesk)}</option>
            {pros.map((p) => <option key={p.id} value={p.id}>{tx(T.rolePro)}: {p.name}</option>)}
          </select>
        </label>
        <button onClick={criar} disabled={ocupado === "criar" || !nome.trim()} className={btnPrim}>{ocupado === "criar" ? "…" : tx(T.create)}</button>
      </div>
      {para !== "recepcao" && <p className={dica}>{tx(T.proHint)}</p>}
      {novo && (
        <div className="rounded-xl border border-g-gold/40 bg-g-gold/10 p-3 space-y-2" role="status">
          <div className="text-xs font-extrabold text-g-word">{novo.nome}</div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => copiar(linkDe(novo))} className={btnPrim}>{tx(T.copyLink)}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${tx(T.waText)} ${linkDe(novo)}`)}`} target="_blank" rel="noopener noreferrer" className={btnLinha}>{tx(T.whats)}</a>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-g-muted">
            {tx(T.codeOnly)}:
            <code className="select-all break-all rounded-lg bg-black/30 px-2 py-1 text-xs font-bold tracking-wider text-g-word">{novo.codigo}</code>
            <button onClick={() => copiar(novo.codigo)} className={btnLinha}>{tx(T.copy)}</button>
          </div>
          <p className={dica}>{tx(T.once)}</p>
        </div>
      )}
      {conectado && lista && lista.length === 0 && <p className={dica}>{tx(T.none)}</p>}
      {lista && lista.length > 0 && (
        <ul className="divide-y divide-white/10">
          {lista.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <div className={`text-sm font-bold ${a.revogado_em ? "text-g-muted line-through" : "text-g-word"}`}>{a.nome} <span className="ml-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-g-muted no-underline">{a.papel === "profissional" ? `${tx(T.rolePro)}${nomePro(a.pro_id) ? ` · ${nomePro(a.pro_id)}` : ""}` : tx(T.roleDesk)}</span></div>
                <div className="text-[11px] text-g-muted">{a.revogado_em ? `${tx(T.revoked)} · ${quando(a.revogado_em, tz)}` : a.ultimo_uso ? `${tx(T.lastUse)} · ${quando(a.ultimo_uso, tz)}` : tx(T.never)}</div>
              </div>
              {!a.revogado_em && <button onClick={() => revogar(a)} disabled={ocupado === a.id} className={btnLinha}>{tx(T.revoke)}</button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
