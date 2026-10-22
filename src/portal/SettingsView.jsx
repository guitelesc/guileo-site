/* Split out of Portal.jsx (performance): SettingsView tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { FaWandMagicSparkles } from "react-icons/fa6";
import { loadDataKey, saveDataKey, toast, portalApi, fetchRealDataDetalhado, abrirChamado, chamarApi } from "../lib/portalApi.js";
import { fraseDaFalha } from "./FalhaDeLeitura.jsx";
import { tr, defProfile, syncProfile, nomeDoDono, Card, Toggle, UI_LANG } from "../pages/Portal.jsx";
import { waLink } from "../data/contact.js";
// 🚨 Este import FALTAVA (2026-09-27). A renomeação do painel (09/09) trocou "Growth Cockpit" por
// `${NOME_DO_PAINEL}` no cartão "Product tour" lá embaixo e não trouxe o import junto: a aba
// Configurações inteira estourava `ReferenceError` ao desenhar — justamente a aba onde se cola o
// código de conexão. Build verde não pega isto (é erro de execução, não de sintaxe).
import { NOME_DO_PAINEL } from "./nome.js";

// Panel UI ships in 4 languages; the AI agent speaks 16. (Kills the old "3 idiomas" fossil.)
const LANG_LINE = {
  en: "Panel EN·PT·ES·HI · Gui speaks 16 languages",
  pt: "Painel EN·PT·ES·HI · Gui atende em 16 idiomas",
  es: "Panel EN·PT·ES·HI · Gui atiende en 16 idiomas",
  hi: "पैनल EN·PT·ES·HI · Gui 16 भाषाओं में बात करती है",
};

/* ── "SALVO ✓" QUE NÃO CHEGAVA NA AGENTE (2026-09-27) ─────────────────────────────────────────
   Tom, saudação, passar para humano, só horário comercial, speed-to-lead, avisos e horário de
   silêncio são gravados no navegador (+ espelho na conta) e NENHUM arquivo em functions/ lê esses
   valores — conferido por busca, não suposto. Mesmo assim a tela dizia "sua IA usa isto em todos
   os canais ✓" e "sua IA foi atualizada ✓". A dona mudava a saudação, lia o ✓, e a agente seguia
   atendendo com a antiga: promessa sem lastro na peça que fala com o cliente do cliente.
   Em CONTA REAL a tela agora diz o que acontece de fato — fica salvo no painel, e chega na agente
   quando o nosso time aplica — e oferece o pedido, que abre um chamado de verdade pelo MESMO
   caminho do suporte (/api/support) e só diz "enviado" com o id do chamado na mão.
   Em DEMO nada muda: é a vitrine.
   ⚠️ No dia em que existir sincronização real destes campos, esta frase e o cartão do pedido saem
   JUNTOS com a entrada do motor — nunca antes. */
const SALVO_NO_PAINEL = "Saved in your panel — not on your live AI yet.";
/* ── FATO INVENTADO NÃO É VALOR (2026-09-28) ───────────────────────────────────────────────────
   O perfil nascia de `defProfile(V)`, que traz o horário da VITRINE ("Mon–Sun, 9am–10pm") — e em
   conta real ele entrava como VALOR do campo "Opening hours", não como exemplo. A dona de um spa
   que fecha às 19h abria Configurações e lia que abre todo dia até as 22h; e o "pedido de
   alteração" mandava esse horário para o nosso time aplicar na agente ao vivo. Um horário errado
   na boca da agente é cliente na porta fechada.
   Em conta real o que veio da amostra é apagado: horário igual ao da amostra (sem a marca de que
   foi a dona quem digitou), nome de negócio de vitrine, endereço de vitrine. Campo vazio pede
   preenchimento; campo com invenção pede desculpa. Em DEMO nada muda. */
const semAmostra = (p, V, contaReal) => {
  if (!contaReal || !p) return p;
  const am = defProfile(V);
  const limpo = { ...p };
  if (!p.hours_by_owner && (p.hours || "") === (am.hours || "")) limpo.hours = "";
  if (p.name && !nomeDoDono(p.name)) limpo.name = "";
  // o endereço da amostra só sobrevive em `V` de vitrine; em conta real `V.business.place` já vem ""
  if (!p.place_by_owner && p.place && p.place === am.place && !nomeDoDono(am.name)) limpo.place = "";
  return limpo;
};

// Frase da tela para cada desfecho de `abrirChamado` — o `motivo` cru ("nao_gravou", "rede",
// "HTTP 500") é diagnóstico nosso, não conversa com cliente.
const fraseDoChamado = (r, temChave) => {
  switch (r?.tipo) {
    case "nao_ativado": return tr("support isn't activated yet");
    case "rede": return fraseDaFalha("rede");
    case "sem_credencial": return fraseDaFalha(temChave ? "chave_invalida" : "sem_credencial");
    case "resposta_estranha": return fraseDaFalha("resposta_estranha");
    default: return tr("Our support desk couldn't record it. Please message our team directly.");
  }
};

const HANDLES_PADRAO = { voice: true, chat: true, reviews: true, recall: true, afterhours: true, marketing: false };

function SettingsView({ V, real = null, me = null }) {
  // conta REAL = logada e não-demo, com ou sem chave de conexão (a mesma régua do menu no Portal)
  const contaReal = !!me?.email && !me?.demo;
  const [toggles, setToggles] = useState(HANDLES_PADRAO);
  // Connection code — the access key Luis hands out at onboarding; unlocks REAL data.
  const [dataKey, setDataKey] = useState(() => loadDataKey());
  const [keyDraft, setKeyDraft] = useState(dataKey);
  // Resultado da ÚLTIMA conferência do código feita por esta tela: null (não conferi) |
  // "verificando" | "ok" | motivo da falha. É o que separa "código errado" de "não consegui conferir".
  const [checagem, setChecagem] = useState(null);
  const conferirCodigo = async () => {
    if (!me?.email || !dataKey) return;
    setChecagem("verificando");
    const r = await fetchRealDataDetalhado(me.email, dataKey);
    setChecagem(r.motivo || "ok");
    if (!r.motivo) window.dispatchEvent(new Event("gui:datakey"));   // o Portal busca os dados de novo
  };
  // Tem código, tem conta, e os dados não chegaram: descobrir POR QUÊ antes de culpar o código.
  useEffect(() => {
    if (real || !dataKey || !me?.email || me?.demo) return;
    conferirCodigo();
  }, [real, dataKey, me?.email, me?.demo]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveKey = async () => {
    const v = keyDraft.trim();
    saveDataKey(v); // localStorage `guileo_data_key` + cloud-kv mirror
    setDataKey(v);
    window.dispatchEvent(new Event("gui:datakey")); // Portal re-fetches real data
    if (!v) { toast(tr("Connection code removed — back to demo data")); return; }
    // VALIDATE LOUDLY — a code that belongs to a different email used to fail silently
    // (the portal just kept showing demo data and the client thought Guileo was broken).
    if (me?.email) {
      toast(tr("Connection code saved — syncing your real data…"));
      // 🚨 (2026-09-28) Qualquer falha — inclusive wifi caído e servidor fora — dizia "This code
      // doesn't match this email". A cliente tinha colado o código CERTO, lia que estava errado,
      // e ia pedir outro (ou desconfiava da conta). "Não confere" só quando o servidor DISSE.
      const r = await fetchRealDataDetalhado(me.email, v);
      setChecagem(r.motivo || "ok");
      if (r.motivo === "chave_invalida") toast(tr("⚠️ This code doesn't match this email — sign in with the SAME email used at payment/signup, or double-check the code."));
      else if (r.motivo) toast(`${tr("Code saved, but I couldn't check it right now.")} ${fraseDaFalha(r.motivo)}`);
    } else {
      toast(tr("Code saved — now sign in with your account e-mail to activate it."));
    }
  };
  // Em DEMO os interruptores de "What your AI handles" vivem só na memória (some no reload — é
  // vitrine). Em conta real isso seria pior que inútil: a pessoa desliga "AI voice agent", recarrega
  // e ele volta ligado sem aviso. Lá eles moram junto das outras configurações (`st.handles`), para
  // persistirem e entrarem no pedido de alteração.
  const flip = (k) => {
    if (contaReal) {
      const v = !handles[k];
      setS("handles", { ...handles, [k]: v });
      toast(`${tr(LBL[k])}: ${v ? tr("On") : tr("Off")} · ${tr(SALVO_NO_PAINEL)}`);
      return;
    }
    setToggles((t) => { const v = !t[k]; toast(`${tr(LBL[k])}: ${v ? tr("On") : tr("Off")}`); return { ...t, [k]: v }; });
  };
  const LBL = { voice: "AI voice agent", chat: "WhatsApp & SMS AI", reviews: "Auto-request reviews", recall: "Recalls & reminders", afterhours: "After-hours coverage", marketing: "Weekly marketing digest" };

  // Editable business profile → feeds the trained AI's location & hours answers.
  const lerPerfil = () => semAmostra(portalApi.loadProfile(V.label, defProfile(V)), V, contaReal);
  const [profile, setProfile] = useState(lerPerfil);
  const [draft, setDraft] = useState(profile);
  useEffect(() => { const p = lerPerfil(); setProfile(p); setDraft(p); }, [V.label, contaReal]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  // quem digita horário/endereço nesta tela é a dona: a marca impede que o valor dela seja
  // confundido com o da amostra na próxima carga (mesmo que ela digite exatamente o mesmo texto)
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value, ...(k === "hours" ? { hours_by_owner: true } : k === "place" ? { place_by_owner: true } : {}) }));
  const saveProfile = () => {
    syncProfile(V.label, V, draft); // persist + re-sync the AI's location & hours answers
    setProfile(draft);
    // conta real: o perfil ficou salvo no painel; a agente ao vivo NÃO foi tocada por este botão
    toast(contaReal ? tr(SALVO_NO_PAINEL) : "Business profile saved — your AI is updated ✓");
  };
  const fieldCls = "mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70";
  // 3º item = EXEMPLO (placeholder), nunca valor. O do horário diz "e.g." para não parecer um fato.
  const PROFILE_FIELDS = [["Business name", "name", tr("Your business name")], ["Address / location", "place", tr("e.g. 123 Main St, City")], ["Opening hours", "hours", tr("e.g. Mon–Sat, 9am–7pm")], ["Public phone", "phone", tr("(optional)")]];
  // Configurações de operação. PERSISTEM no painel (localStorage + espelho na conta), mas nenhum
  // motor em functions/ as lê ainda — por isso, em conta real, a tela não afirma que a agente as usa.
  const defS = { tone: "Friendly", greeting: "", on_booking: true, on_missed: true, on_review: true, daily_summary: true, quiet_enabled: false, quiet_start: "21:00", quiet_end: "08:00", after_hours_msg: "", fallback_number: "", require_approval: true, speed_to_lead: true, business_hours_only: false };
  const [st, setSt] = useState(() => ({ ...defS, ...portalApi.loadState(`${V.label}:settings`, {}) }));
  useEffect(() => { setSt({ ...defS, ...portalApi.loadState(`${V.label}:settings`, {}) }); }, [V.label]); // eslint-disable-line
  const setS = (k, v) => setSt((s) => { const n = { ...s, [k]: v }; portalApi.saveState(`${V.label}:settings`, n); return n; });
  const handles = contaReal ? { ...HANDLES_PADRAO, ...(st.handles || {}) } : toggles;
  // aviso de "salvo" dos interruptores: em conta real ele não pode dizer mais do que aconteceu
  const avisaSalvo = () => toast(contaReal ? tr(SALVO_NO_PAINEL) : tr("Saved ✓"));

  // ── PEDIDO DE ALTERAÇÃO (só conta real) ─────────────────────────────────────────────────────
  // `assinatura` = retrato do que está salvo AGORA. O pedido guarda o retrato do que foi enviado:
  // se os dois batem, o time já tem a versão atual; se não batem, há mudança que ninguém pediu
  // ainda — e a tela diz isso em vez de deixar um "✓ enviado" velho cobrindo uma mudança nova.
  const assinatura = JSON.stringify({ st, profile });
  const [pedido, setPedido] = useState(() => portalApi.loadState(`${V.label}:settings_pedido`, null));
  const [pedidoEstado, setPedidoEstado] = useState("parado"); // parado | enviando | erro
  const [pedidoMotivo, setPedidoMotivo] = useState("");
  // (sem efeito de recarga por `V.label`: o pedido só existe em conta real, e conta real não troca
  // de segmento — o seletor de indústria é exclusivo da demonstração.)
  const pedidoEmDia = !!pedido?.id && pedido.assinatura === assinatura;
  // O corpo do chamado vai em inglês corrido, de propósito: quem lê é o nosso time, não a cliente.
  const resumoDoPedido = () => {
    const oo = (v) => (v ? "on" : "off");
    return [
      "SETTINGS CHANGE REQUEST — sent from the panel. Nothing was applied to the live agent automatically.",
      // "(not provided)" é explícito de propósito: quem aplica o pedido não pode ler um campo vazio
      // como "mantenha o que está" nem preencher com o horário da vitrine.
      `Business: ${profile.name || "(not provided)"} | address: ${profile.place || "(not provided)"} | hours: ${profile.hours || "(not provided — do NOT assume any hours)"} | phone: ${profile.phone || "(not provided)"}`,
      `Tone: ${st.tone || "—"}`,
      `Custom greeting: ${st.greeting ? `"${String(st.greeting).slice(0, 400)}"` : "(none)"}`,
      `Hand off to a human on request: ${oo(st.human_handoff !== false)}`,
      `Approve before money/customer messages: ${oo(st.require_approval !== false)}`,
      `Speed-to-lead: ${oo(st.speed_to_lead !== false)}`,
      `Business hours only: ${oo(!!st.business_hours_only)}`,
      `Notify — booking: ${oo(st.on_booking !== false)}, missed: ${oo(st.on_missed !== false)}, review: ${oo(st.on_review !== false)}, daily summary: ${oo(st.daily_summary !== false)}`,
      `Quiet hours: ${st.quiet_enabled ? `${st.quiet_start}–${st.quiet_end}` : "off"}`,
      `AI handles — ${Object.keys(HANDLES_PADRAO).map((k) => `${k}: ${oo(handles[k])}`).join(", ")}`,
    ].join("\n").slice(0, 1900);
  };
  const pedirAlteracao = async () => {
    if (pedidoEstado === "enviando") return;
    setPedidoEstado("enviando"); setPedidoMotivo("");
    // status "escalated": este pedido SÓ anda se um humano agir — é exatamente o caso que o
    // /api/support avisa ao time (chamado aberto e calado não cumpre prazo nenhum).
    const r = await abrirChamado(me?.email || "", dataKey, {
      subject: "Settings change request", category: "agent", body: resumoDoPedido(),
      ai_handled: false, status: "escalated", priority: "normal",
    });
    if (r.id) {
      const novo = { id: r.id, assinatura };
      portalApi.saveState(`${V.label}:settings_pedido`, novo);
      setPedido(novo); setPedidoEstado("parado");
      toast(`✓ ${tr("Request sent — our team applies it within 1 business day.")}`);
    } else {
      setPedidoEstado("erro");
      setPedidoMotivo(fraseDoChamado(r, !!dataKey));
    }
  };
  // ── RECARGA COM 1 CLIQUE — a preferência agora mora no SERVIDOR (2026-08-25) ────────────────
  // Até hoje este botão gravava `gui_payg` só no localStorage e NENHUM arquivo em functions/ lia
  // esse valor. O cliente ligava, via "Auto top-up on ✓", zerava o crédito no sábado e nada
  // acontecia — com a certeza de ter ligado. Num caminho de dinheiro, promessa sem lastro é a
  // pior classe de defeito, e o rótulo mudou junto: o que este botão liga é o e-mail com o LINK
  // do pacote quando o saldo zera. A Guileo NÃO passa o cartão sozinha (isso exige mandato salvo
  // — próximo passo). O rótulo não pode prometer o que o código não faz.
  //
  // TRÊS ESTADOS, de propósito: ligado · desligado · NÃO DEU PRA LER. Desenhar o terceiro como
  // "desligado" é o fallback que esconde erro — e aqui esconderia uma preferência de cobrança.
  const [payg, setPaygS] = useState(null);
  const [paygEstado, setPaygEstado] = useState("carregando"); // carregando | pronto | salvando | erro
  const [paygMotivo, setPaygMotivo] = useState("");
  const [paygTentativa, setPaygTentativa] = useState(0);
  const paygNaoLigado = () => tr("This setting isn't switched on for your account yet. Message our team and we'll turn it on.");
  // SEM CHAVE não é um estado do servidor, é uma condição da tela — por isso é DERIVADO, e não
  // mais um setState dentro do efeito (que a regra de hooks proíbe, com razão: escrever estado no
  // corpo do efeito provoca um segundo render a cada montagem).
  const paygSemChave = !dataKey || !me?.email;
  useEffect(() => {
    let vivo = true;
    if (paygSemChave) return undefined;
    (async () => {
      const r = await chamarApi("/api/auto-topup", { email: me.email, token: dataKey, action: "get" });
      if (!vivo) return;
      const d = r.data;
      // LER A RESPOSTA, não só o status: a rota devolve 200 com `pronto:false` quando a RPC
      // ainda não foi colada. Isso NÃO é "desligado".
      if (!r.motivo && d?.ok === true && d.pronto === true) { setPaygS(d.enabled === true); setPaygEstado("pronto"); setPaygMotivo(""); }
      // `paygMotivo` guarda a FRASE já traduzida — o texto cru do servidor ("nao_gravou", "HTTP 500")
      // chegava na tela da cliente com um ⚠️ na frente.
      else { setPaygS(null); setPaygMotivo(r.motivo ? fraseDaFalha(r.motivo) : paygNaoLigado()); setPaygEstado("erro"); }
    })();
    return () => { vivo = false; };
  }, [dataKey, me?.email, paygSemChave, paygTentativa]); // eslint-disable-line react-hooks/exhaustive-deps
  const flipPayg = async () => {
    if (paygSemChave) { toast(tr("Paste your connection code first — this setting lives on your account, not in this browser.")); return; }
    if (paygEstado === "salvando") return;
    const alvo = payg !== true;
    setPaygEstado("salvando");
    const r = await chamarApi("/api/auto-topup", { email: me?.email || "", token: dataKey, action: "set", enabled: alvo });
    const d = r.data;
    // O ESTADO VEM DO BANCO, não do que a tela pediu. Sem isso, um erro de RPC pintaria o botão
    // de verde sobre nada gravado — que é exatamente o defeito que este bloco veio consertar.
    if (!r.motivo && d?.ok === true && d.pronto === true) {
      setPaygS(d.enabled === true); setPaygEstado("pronto"); setPaygMotivo("");
      window.dispatchEvent(new Event("gui:credits"));
      toast(d.enabled ? tr("Saved ✓ — when your balance hits zero, the top-up link comes by e-mail.") : tr("Saved ✓ — one-click top-up is off."));
    } else {
      const frase = r.motivo ? fraseDaFalha(r.motivo) : paygNaoLigado();
      // o botão volta ao último estado LIDO (payg não foi tocado) — e a tela diz por quê
      setPaygMotivo(frase); setPaygEstado("erro");
      toast(`⚠️ ${tr("Couldn't save this on your account")} — ${frase}`);
    }
  };
  return (
    <div className="space-y-4 stagger">
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Business profile")}</div>
          <span className="text-[10px] text-g-muted inline-flex items-center gap-1"><FaWandMagicSparkles size={9} className="text-g-green" /> {tr("feeds your AI's answers")}</span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {PROFILE_FIELDS.map(([label, k, ph]) => (
            <label key={k} className="block px-5 py-3"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{tr(label)}</span>
              <input value={draft[k] || ""} onChange={set(k)} placeholder={ph} className={fieldCls} />
              {contaReal && k === "hours" && !draft.hours && <span className="mt-1 block text-[11px] text-g-gold">{tr("Not filled in yet — your AI won't state opening hours it doesn't know.")}</span>}</label>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-3">
          <span className="text-[11px] text-g-muted">{dirty ? tr("Unsaved changes") : contaReal ? tr("Saved in your panel. Your live AI gets it when our team applies your request.") : tr("Your AI uses these facts when customers ask.")}</span>
          <button onClick={saveProfile} disabled={!dirty} className="btn-bright text-sm disabled:opacity-40 disabled:cursor-not-allowed">{contaReal ? tr("Save") : tr("Save & update AI")}</button>
        </div>
      </Card>

      {/* CONNECTION CODE — unlocks the client's real backend data in this dashboard */}
      <Card className={`p-0 overflow-hidden ${real ? "border-g-green/30" : ""}`}>
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Connection code")}</span>
          {real && <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>}
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px] text-g-muted">{tr("Paste the code your Guileo team sent you — it unlocks your business's real data in this dashboard.")}</p>
          {!real && <a href="/go-live" className="inline-flex items-center gap-1 text-[11px] font-bold text-g-light hover:text-g-word transition mt-1.5">🚀 {tr("Don't have a code? Activate Gui →")}</a>}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <input value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveKey()}
              placeholder="GUI-XXXX-XXXX" aria-label={tr("Connection code")} autoComplete="off" spellCheck={false}
              className="flex-1 min-w-[180px] rounded-xl border border-white/15 bg-black/20 px-3.5 py-2.5 text-sm font-mono text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
            <button onClick={saveKey} disabled={keyDraft.trim() === dataKey} className="btn-bright text-sm disabled:opacity-40 disabled:cursor-not-allowed">{tr("Save code")}</button>
            {dataKey && <button onClick={() => { setKeyDraft(""); saveDataKey(""); setDataKey(""); window.dispatchEvent(new Event("gui:datakey")); toast(tr("Connection code removed — back to demo data")); }} className="text-[11px] font-bold text-g-muted hover:text-red-400 transition">{tr("Remove")}</button>}
          </div>
          <p className={`mt-2 text-[11px] ${real ? "text-g-green" : "text-g-muted"}`}>
            {real
              ? tr("Connected — showing your business's real data ✓")
              : dataKey
                ? (me?.email && !me?.demo
                  ? (checagem === "verificando" || checagem === null ? tr("Checking your code…")
                    : checagem === "chave_invalida" ? tr("Code saved — no data matched yet. Check the code with your Guileo team.")
                    : checagem === "ok" ? tr("Your code checks out — loading your data…")
                    // rede / servidor / resposta estranha: o código pode estar CERTO. Não culpar o código.
                    : `${tr("I couldn't check your code just now.")} ${fraseDaFalha(checagem)}`)
                  : tr("Sign in with your account e-mail to activate it."))
                : null}
          </p>
          {!real && dataKey && me?.email && !me?.demo && checagem && !["verificando", "ok", "chave_invalida"].includes(checagem) && (
            <button type="button" onClick={conferirCodigo} className="mt-1.5 rounded-full border border-g-gold/40 px-3 py-1 text-[11px] font-black text-g-gold hover:bg-g-gold/10 transition">{tr("↻ Try again")}</button>
          )}
        </div>
      </Card>

      {/* GROWTH — client-facing outreach preferences (persisted to profile; backend reads them later) */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">⚡ {tr("Growth")}</div>
        <p className="px-5 pt-3 text-[11px] text-g-muted">{contaReal ? tr("Tune how Gui reaches out. Saved in your panel — your live AI gets it when our team applies your request.") : tr("Tune how Gui reaches out — saved to your profile, applied across every channel.")}</p>
        <div className="mt-1 divide-y divide-white/[0.06]">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="pr-3"><div className="text-sm text-g-word font-semibold">⚡ {tr("Speed-to-Lead")}</div><div className="text-[11px] text-g-muted">{tr("Call new leads in 60s")}</div></div>
            <Toggle on={st.speed_to_lead !== false} onClick={() => { const v = st.speed_to_lead === false; setS("speed_to_lead", v); try { localStorage.setItem("guileo_speed_to_lead", v ? "1" : "0"); } catch { /* private */ } avisaSalvo(); }} />
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="pr-3"><div className="text-sm text-g-word font-semibold">🌙 {tr("Business hours only")}</div><div className="text-[11px] text-g-muted">{tr("Don't let Gui call or message at 2am.")}</div></div>
            <Toggle on={!!st.business_hours_only} onClick={() => { const v = !st.business_hours_only; setS("business_hours_only", v); avisaSalvo(); }} />
          </div>
        </div>
      </Card>

      {/* AI behavior — tone + custom greeting shape every customer interaction */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("AI voice & greeting")}</div>
        <div className="divide-y divide-white/[0.06]">
          <label className="block px-5 py-3"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{tr("Tone")}</span>
            <select value={st.tone} onChange={(e) => setS("tone", e.target.value)} className={fieldCls}>{["Friendly", "Professional", "Warm & casual", "Concise", "Enthusiastic"].map((o) => <option key={o} value={o}>{tr(o)}</option>)}</select></label>
          <label className="block px-5 py-3"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{tr("Custom greeting")}</span>
            <textarea value={st.greeting} onChange={(e) => setS("greeting", e.target.value)} placeholder={`e.g. "Hi! Thanks for contacting ${draft.name || V.business.name} 👋 How can I help?"`} rows={2} className={fieldCls} /></label>
          <div className="flex items-center justify-between px-5 py-3.5"><div><div className="text-sm text-g-word font-semibold">{tr("Hand off to a human on request")}</div><div className="text-[11px] text-g-muted">{tr("When a customer asks for a person, the AI alerts your team.")}</div></div><Toggle on={st.human_handoff !== false} onClick={() => setS("human_handoff", st.human_handoff === false)} /></div>
          <div className="flex items-center justify-between px-5 py-3.5"><div className="pr-3"><div className="text-sm text-g-word font-semibold">{tr("Approve before Gui sends money or customer messages")}</div><div className="text-[11px] text-g-muted">{tr("Invoices, charges, deliveries, social posts and campaigns wait for your one-tap OK. Answers and navigation stay instant.")}</div></div><Toggle on={st.require_approval !== false} onClick={() => setS("require_approval", st.require_approval === false)} /></div>
        </div>
        {contaReal
          ? <div className="px-5 py-2.5 border-t border-white/10 text-[11px] text-g-gold">{tr(SALVO_NO_PAINEL)} {tr("Request the change below and our team applies it.")}</div>
          : <div className="px-5 py-2.5 border-t border-white/10 text-[11px] text-g-green">{tr("Saved automatically · your AI uses this on every channel ✓")}</div>}
      </Card>

      {/* Notifications & billing — when the owner gets pinged + auto top-up (revenue safety) */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Notifications & billing")}</div>
        <div className="divide-y divide-white/[0.06]">
          {[["on_booking", "New booking or order"], ["on_missed", "Missed call or lead"], ["on_review", "New review"], ["daily_summary", "Daily summary from Gui"]].map(([k, label]) => (
            <div key={k} className="flex items-center justify-between px-5 py-3.5"><span className="text-sm text-g-word font-semibold">{tr(label)}</span><Toggle on={st[k] !== false} onClick={() => setS(k, st[k] === false)} /></div>
          ))}
          {/* ⚠️ RÓTULO HONESTO. Dizia "Auto top-up … refill when low" — uma recarga automática que não
              existe (e não gravava nada fora deste navegador). O que existe é o e-mail com o link
              pronto no momento em que o saldo zera; a cobrança continua sendo um clique do dono. */}
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="pr-3">
              <div className="text-sm text-g-word font-semibold">{tr("One-click top-up by e-mail when credits hit zero")}</div>
              <div className="text-[11px] text-g-muted">{tr("The moment your balance hits zero we e-mail you the top-up link, ready to pay. We never charge your card on our own.")}</div>
              {paygSemChave && <div className="mt-1 text-[11px] text-g-gold">{tr("Add your connection code above to turn this on.")}</div>}
              {!paygSemChave && paygEstado === "carregando" && <div className="mt-1 text-[11px] text-g-muted">{tr("Loading your setting…")}</div>}
              {paygEstado === "salvando" && <div className="mt-1 text-[11px] text-g-muted">{tr("Saving…")}</div>}
              {!paygSemChave && paygEstado === "erro" && <div role="alert" className="mt-1 text-[11px] text-[#FF9E9E]">⚠️ {tr("Couldn't read this from your account")}{paygMotivo ? ` — ${paygMotivo}` : ""} <button type="button" onClick={() => { setPaygEstado("carregando"); setPaygTentativa((n) => n + 1); }} className="ml-1 underline font-bold">{tr("↻ Try again")}</button></div>}
            </div>
            <Toggle on={payg === true && !paygSemChave} onClick={flipPayg} />
          </div>
          <div className="flex items-center justify-between px-5 py-3.5"><div className="flex items-center gap-3"><span className="text-sm text-g-word font-semibold">{tr("Quiet hours")}</span></div><Toggle on={!!st.quiet_enabled} onClick={() => setS("quiet_enabled", !st.quiet_enabled)} /></div>
          {st.quiet_enabled && (
            <div className="flex items-center gap-3 px-5 py-3">
              <label className="flex-1"><span className="text-[10px] uppercase tracking-wide text-g-muted">{tr("From")}</span><input type="time" value={st.quiet_start} onChange={(e) => setS("quiet_start", e.target.value)} className={fieldCls} /></label>
              <label className="flex-1"><span className="text-[10px] uppercase tracking-wide text-g-muted">{tr("To")}</span><input type="time" value={st.quiet_end} onChange={(e) => setS("quiet_end", e.target.value)} className={fieldCls} /></label>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Account")}</div>
        <div className="divide-y divide-white/[0.06]">
          {[["Plan", real ? ({ starter: "Essential", growth: "Personalized", scale: "Full Operation" }[real.plan] || real.plan || "—") : (V.plan?.label || "Growth Plan")], ["Languages", LANG_LINE[UI_LANG] || LANG_LINE.en], ["Timezone", "Local"]].map(([k, v], i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5"><span className="text-sm text-g-muted">{k}</span><span className="text-sm font-bold text-g-word text-right">{v}</span></div>
          ))}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("What your AI handles")}</div>
        <div className="divide-y divide-white/[0.06]">
          {Object.keys(LBL).map((k) => (
            <div key={k} className="flex items-center justify-between px-5 py-3.5"><span className="text-sm text-g-word font-semibold">{tr(LBL[k])}</span><Toggle on={!!handles[k]} onClick={() => flip(k)} /></div>
          ))}
        </div>
      </Card>
      {/* PEDIDO DE ALTERAÇÃO — só conta real. É a ponte honesta entre "salvo no painel" e "valendo na
          agente": abre um chamado de verdade e só afirma "enviado" com o id na mão. */}
      {contaReal && (
      <Card className={`p-0 overflow-hidden ${pedidoEmDia ? "border-g-green/30" : "border-g-gold/30"}`}>
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Apply to your live AI")}</div>
        <div className="px-5 py-4">
          <p className="text-[11px] text-g-muted leading-relaxed">{tr("What you change on this page is saved in your panel. It reaches your live AI when our team applies it — within 1 business day of your request.")}</p>
          {pedidoEmDia ? (
            <p className="mt-2.5 text-[11px] font-bold text-g-green">✓ {tr("Request sent — our team applies it within 1 business day.")} <span className="font-mono font-normal text-g-muted">#{String(pedido.id).slice(0, 8)}</span></p>
          ) : (
            <>
              {pedido?.id && <p className="mt-2.5 text-[11px] text-g-gold">{tr("You changed something after your last request — send it again so our team gets the new version.")}</p>}
              {dataKey ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={pedirAlteracao} disabled={pedidoEstado === "enviando" || dirty} className="btn-bright text-sm disabled:opacity-40 disabled:cursor-not-allowed">{pedidoEstado === "enviando" ? tr("Sending…") : tr("Request this change")}</button>
                  {dirty && <span className="text-[11px] text-g-muted">{tr("Save your business profile first.")}</span>}
                </div>
              ) : (
                <div className="mt-3">
                  {/* sem chave o /api/support recusa (401) — não se oferece um botão que vai falhar */}
                  <div className="text-[11px] text-g-gold">{tr("Add your connection code above to send this request from here.")}</div>
                  <a href={waLink("Hi Guileo team! I changed my AI settings in my panel — please apply them to my live AI.")} target="_blank" rel="noopener" className="btn-ghost text-sm mt-2 inline-flex items-center px-4">💬 {tr("I'll message my team")}</a>
                </div>
              )}
              {pedidoEstado === "erro" && <div className="mt-2 text-[11px] text-[#FF9E9E]">⚠️ {tr("I couldn't send the request")}{pedidoMotivo ? ` — ${pedidoMotivo}` : ""}</div>}
            </>
          )}
        </div>
      </Card>
      )}
      {/* sample-only: fabricated connections/webhooks must never render for a real client */}
      {!real && (
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Integrations & webhooks")}</div>
        <div className="divide-y divide-white/[0.06]">
          {[["📅 Calendar (Google/Apple)", "Connected"], ["💳 Stripe payments", "Connected"], ["🍔 POS / orders", "Connected"], ["📣 Meta & Google Ads", "Connected"], ["🛵 Delivery platforms", "Connected"]].map(([name, st]) => (
            <div key={name} className="flex items-center justify-between px-5 py-3"><span className="text-sm text-g-word font-semibold">{name}</span><span className="text-[10px] font-black uppercase text-g-green inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{st}</span></div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-white/10">
          <div className="text-[10px] font-black uppercase tracking-wide text-g-muted mb-2">{tr("Live webhook events")}</div>
          <div className="space-y-1.5 font-mono text-[10px] text-g-muted">
            {[["order.created", "→ POS · just now"], ["booking.confirmed", "→ Calendar · 2m"], ["payment.succeeded", "→ Stripe · 6m"], ["review.received", "→ Reputation · 11m"]].map(([ev, meta]) => (
              <div key={ev} className="flex items-center gap-2"><span className="text-g-green">●</span><span className="text-g-word">{ev}</span><span className="flex-1" /><span>{meta}</span></div>
            ))}
          </div>
        </div>
      </Card>
      )}
      {!real && (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-sm font-bold text-g-word">{tr("Demo data")}</div><div className="text-[11px] text-g-muted">{tr("Reset resolved alerts, won deals, filled slots & read flags back to the sample state.")}</div></div>
        <button onClick={() => { ["alerts", "fups", "wait", "notifsRead", "created:liveorders", "created:schedule", "created:deliveries", "created:campaigns", "created:impact", "created:audiences", "created:reviewreq", "created:payments", "created:team", "created:locations", "created:giftcards", "integrations", "owndelivery", "loyalty", "goal"].forEach((k) => { try { localStorage.removeItem(`guileo_state_${V.label}:${k}`); } catch { /* ignore */ } }); toast("Demo data reset — reloading…"); setTimeout(() => location.reload(), 600); }} className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-g-muted hover:text-g-word hover:border-g-gold/40 transition shrink-0">{tr("↻ Reset demo data")}</button>
      </Card>
      )}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-sm font-bold text-g-word">{tr("Product tour")}</div><div className="text-[11px] text-g-muted">{tr(`Replay the guided walkthrough of your ${NOME_DO_PAINEL} from the top.`)}</div></div>
        <button onClick={() => { ["guileo_tour_done", "guileo_firstvalue_done"].forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } }); toast(tr("Restarting the tour…")); setTimeout(() => location.reload(), 500); }} className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-g-muted hover:text-g-word hover:border-g-gold/40 transition shrink-0">{tr("↻ Re-take the tour")}</button>
      </Card>
      <p className="text-center text-[11px] text-g-muted">{contaReal ? tr("Changes here reach your live AI when our team applies your request. Need something custom? Your team's a tap away. 💬") : tr("Changes apply instantly. Need something custom? Your team's a tap away. 💬")}</p>
    </div>
  );
}

export default SettingsView;
