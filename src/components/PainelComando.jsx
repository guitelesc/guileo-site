import { useCallback, useEffect, useState } from "react";

/* ═══ PAINEL DE COMANDO — a primeira coisa que o dono vê no /admin ════════════════════════════
   A Visão geral contava visitas e eventos: números que sobem sozinhos e não decidem nada. Este
   painel responde as quatro perguntas que ele realmente faz ao abrir, na ordem em que importam:
   o dinheiro entrou? · a operação rodou? · os vendedores estão vendendo? · o que precisa de mim?

   🚨 A ÚLTIMA COLUNA É A RAZÃO DE EXISTIR. "O que precisa da minha mão" só mostra o que é AÇÃO
   dele — falha de verdade, cliente no vermelho, canal travado, fila sem contato. Encher essa
   coluna com sucesso ("convite enviado ✓") treina o dono a ignorar a lista inteira, e aí o item
   que importava passa despercebido no dia em que aparecer.

   🚨 ZERO É RESULTADO; TRAÇO É "NÃO MEDI". Nunca desenho 0 sobre leitura que falhou — foi esse
   `|| 0` que já produziu cinco diagnósticos falsos neste repositório. */

const OK = "#3E9468", ALERTA = "#FFC23D", RUIM = "#e0855f", NAO_MEDIDO = "#8A8578";

function Num({ v, cor, sufixo = "", prefixo = "" }) {
  const naoMedido = v == null;
  return (
    <div className="text-[26px] font-black leading-none tabular-nums"
      style={{ color: naoMedido ? NAO_MEDIDO : (cor || "#EDE7DC") }}>
      {naoMedido ? "—" : `${prefixo}${typeof v === "number" ? v.toLocaleString("en-US") : v}${sufixo}`}
    </div>
  );
}

function Bloco({ tag, cor, children }) {
  return (
    <section className="rounded-2xl border bg-white/[0.04] p-5 backdrop-blur-xl" style={{ borderColor: `${cor}33` }}>
      <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: cor }}>{tag}</div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function Celula({ rot, v, cor, prefixo, sufixo, nota }) {
  return (
    <div className="min-w-0">
      <Num v={v} cor={cor} prefixo={prefixo} sufixo={sufixo} />
      <div className="mt-1 truncate text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{rot}</div>
      {nota && <div className="mt-0.5 text-[10.5px]" style={{ color: NAO_MEDIDO }}>{nota}</div>}
    </div>
  );
}

/* ═══ ➕ CRÉDITOS — o botão que faltava embaixo da acusação ════════════════════════════════════
   O painel dizia "N cliente(s) com crédito negativo — cobrar ou recarregar" e não oferecia AÇÃO
   nenhuma: recarregar era SQL na mão no editor do Supabase, sem rastro de quem fez nem por quê.
   Acusação sem botão treina o dono a ignorar a linha inteira.

   🚨 MOTIVO É OBRIGATÓRIO (o servidor também recusa sem ele): crédito sem motivo é dinheiro sem
   história, e daqui a um mês ninguém sabe por que aquele cliente ganhou 500.
   🚨 O SALDO NOVO VOLTA NA TELA. "ok" sem comprovante é promessa sem lastro — se o banco não
   disser o saldo, isto não diz "pronto". */
function Creditos({ token, aoAjustar }) {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null); // { ok, texto }
  // Um id por tentativa: clique duplo ou retry de rede NÃO viram crédito dobrado (o banco
  // devolve o mesmo resultado da 1ª chamada). Só troca depois de um sucesso.
  const [reqId, setReqId] = useState(() => novoId());

  const enviar = async (e) => {
    e.preventDefault();
    const n = Math.trunc(Number(qtd));
    if (!email.includes("@")) { setRes({ ok: false, texto: "e-mail do cliente inválido" }); return; }
    if (!Number.isFinite(n) || n === 0) { setRes({ ok: false, texto: "quantidade tem que ser diferente de zero" }); return; }
    if (!motivo.trim()) { setRes({ ok: false, texto: "escreva o motivo — crédito sem motivo é dinheiro sem história" }); return; }
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/admin-comando", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "grant_credits", email: email.trim(), amount: n, reason: motivo.trim(), request_id: reqId }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || j.ok !== true) { setRes({ ok: false, texto: (j && (j.motivo || j.error)) || `HTTP ${r.status}` }); return; }
      setRes({ ok: true, texto: `${j.repetido ? "já tinha sido feito — " : ""}${j.amount > 0 ? "+" : ""}${j.amount} para ${j.email}. Saldo agora: ${j.saldo}${j.auditoria === false ? " (⚠️ sem rastro no feed: " + (j.nota || "") + ")" : ""}` });
      setReqId(novoId()); setQtd(""); setMotivo("");
      if (aoAjustar) aoAjustar();
    } catch (err) { setRes({ ok: false, texto: String(err).slice(0, 120) }); }
    finally { setBusy(false); }
  };

  const campo = "min-h-[44px] rounded-xl border border-white/15 bg-white/[0.05] px-3 text-[12.5px] text-g-word placeholder:text-g-muted focus:outline-none";
  return (
    <div className="mt-3">
      <button type="button" onClick={() => setAberto((a) => !a)}
        className="inline-flex min-h-[44px] items-center rounded-full border px-4 text-[12px] font-bold"
        style={{ borderColor: `${OK}55`, color: OK }}>
        {aberto ? "Fechar" : "➕ Créditos"}
      </button>
      {aberto && (
        <form onSubmit={enviar} className="mt-2.5 grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-4">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e-mail do cliente" className={`${campo} sm:col-span-2`} />
          <input value={qtd} onChange={(e) => setQtd(e.target.value)} type="number" step="1" placeholder="quantidade (± )" className={campo} />
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="motivo (obrigatório)" className={campo} />
          <button disabled={busy} className="min-h-[44px] rounded-xl px-4 text-[12.5px] font-black text-black disabled:opacity-60 sm:col-span-4"
            style={{ background: OK }}>
            {busy ? "Ajustando…" : "Ajustar crédito"}
          </button>
          <p className="text-[11px] sm:col-span-4" style={{ color: NAO_MEDIDO }}>
            Negativo estorna (ex.: −200 desfaz um crédito dado por engano). Fica registrado no feed do cliente.
          </p>
          {res && (
            <div className="rounded-lg border px-3 py-2 text-[12px] sm:col-span-4"
              style={{ borderColor: `${res.ok ? OK : RUIM}55`, color: res.ok ? OK : RUIM }}>
              {res.ok ? "✅ " : "⛔ "}{res.texto}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

// id de tentativa — crypto.randomUUID não existe em todo navegador antigo; o fallback ainda é único
// o bastante para o que ele guarda (uma janela de clique), e nunca fica vazio (id vazio = sem trava).
function novoId() {
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch { /* */ }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function PainelComando({ token }) {
  const [d, setD] = useState(null);
  const [estado, setEstado] = useState("carregando");
  const [erro, setErro] = useState("");

  const ler = useCallback(async () => {
    if (!token) return;
    setEstado("carregando"); setErro("");
    try {
      const r = await fetch("/api/admin-comando", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setEstado("err"); setErro(j?.error || j?.motivo || `HTTP ${r.status}`); return; }
      setD(j.painel); setEstado("ok");
    } catch (e) { setEstado("err"); setErro(String(e).slice(0, 120)); }
  }, [token]);

  useEffect(() => { ler(); }, [ler]);
  // 60s: o painel é para decidir, não para hipnotizar. Atualização de 5s faz o número piscar e
  // convida a olhar em vez de agir.
  useEffect(() => { const t = setInterval(ler, 60000); return () => clearInterval(t); }, [ler]);

  if (estado === "err") return (
    <div className="rounded-2xl border px-4 py-3 text-[12.5px]" style={{ borderColor: `${RUIM}55`, color: RUIM }}>
      Não consegui ler o painel: {erro}
    </div>
  );
  if (!d) return <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-[12.5px] text-g-muted">Lendo o comando…</div>;

  const op24 = (d.ligacoes_24h || 0) + (d.mensagens_24h || 0) + (d.agendamentos_24h || 0) + (d.pedidos_24h || 0);
  const falhas = Array.isArray(d.falhas_24h) ? d.falhas_24h : [];

  // A lista de ação é MONTADA, não escrita à mão: cada item nasce de um número medido, então ela
  // encolhe sozinha quando o problema é resolvido — e nunca fica com item morto.
  const acoes = [];
  if (falhas.length) acoes.push({ t: `${falhas.length} falha(s) nas últimas 24h`, sub: falhas[0]?.o_que || "", cor: RUIM });
  if (d.no_vermelho > 0) acoes.push({ t: `${d.no_vermelho} cliente(s) com crédito negativo`, sub: "atendendo no vermelho — cobrar ou recarregar", cor: RUIM });
  if (d.quase_no_fim > 0) acoes.push({ t: `${d.quase_no_fim} cliente(s) quase sem crédito`, sub: "abaixo de 100 — avisar antes de parar", cor: ALERTA });
  if (d.canais_pendentes > 0) acoes.push({ t: `${d.canais_pendentes} canal(is) aguardando liberação`, sub: "o cliente vê que não responde", cor: ALERTA });
  if (d.prospects_sem_email > 0) acoes.push({ t: `${d.prospects_sem_email} prospects sem e-mail`, sub: "o botão de completar contato resolve em lote", cor: ALERTA });
  if (d.promessas_abertas > 0) acoes.push({ t: `${d.promessas_abertas} promessa(s) de $50 em aberto`, sub: "prometido ao lead e ainda não virou cliente", cor: ALERTA });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 1 · DINHEIRO */}
        <Bloco tag="💰 Dinheiro" cor="#D6C29A">
          <div className="grid grid-cols-3 gap-3">
            <Celula rot="Clientes" v={d.clientes_reais} cor={d.clientes_reais > 0 ? OK : NAO_MEDIDO}
              nota="sem contas internas" />
            <Celula rot="Receita 30d" v={d.receita_30d} prefixo="$" cor={d.receita_30d > 0 ? OK : NAO_MEDIDO} />
            <Celula rot="Créditos" v={d.creditos_totais} cor={d.no_vermelho > 0 ? RUIM : "#EDE7DC"} />
          </div>
        </Bloco>

        {/* 2 · OPERAÇÃO */}
        <Bloco tag="⚡ Operação · 24h" cor="#FF8A33">
          <div className="grid grid-cols-4 gap-3">
            <Celula rot="Ligações" v={d.ligacoes_24h} cor={d.ligacoes_24h > 0 ? OK : NAO_MEDIDO} />
            <Celula rot="Mensagens" v={d.mensagens_24h} cor={d.mensagens_24h > 0 ? OK : NAO_MEDIDO} />
            <Celula rot="Agendas" v={d.agendamentos_24h} cor={d.agendamentos_24h > 0 ? OK : NAO_MEDIDO} />
            <Celula rot="Pedidos" v={d.pedidos_24h} cor={d.pedidos_24h > 0 ? OK : NAO_MEDIDO} />
          </div>
          {op24 === 0 && (
            // silêncio de 24h é um FATO que merece frase, não um zero mudo espalhado em quatro tiles
            <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: NAO_MEDIDO }}>
              Nenhum evento nas últimas 24h. Se algum cliente deveria estar recebendo ligação, isso é um sinal — não uma pausa.
            </p>
          )}
        </Bloco>

        {/* 3 · VENDA */}
        <Bloco tag="🎯 Venda" cor="#4C9AFF">
          <div className="grid grid-cols-3 gap-3">
            <Celula rot="Vendedores" v={d.vendedores} cor="#EDE7DC" />
            <Celula rot="Na fila" v={d.prospects} cor={d.prospects > 0 ? OK : NAO_MEDIDO} />
            <Celula rot="Sem toque" v={d.prospects_sem_toque}
              cor={d.prospects_sem_toque > 0 ? ALERTA : OK} nota="ninguém ligou ainda" />
          </div>
          <div className="mt-3 text-[11.5px] text-g-muted">
            {d.relatorios} relatórios X-Ray medidos · {d.prospects_sem_fone} sem telefone
          </div>
        </Bloco>
      </div>

      {/* 4 · O QUE PRECISA DA MINHA MÃO */}
      <Bloco tag="🚨 Precisa de você" cor={acoes.length ? RUIM : OK}>
        {acoes.length === 0 ? (
          <p className="text-[13px]" style={{ color: OK }}>
            Nada pendente. Nenhuma falha em 24h, ninguém no vermelho, nenhum canal travado.
          </p>
        ) : (
          <ul className="space-y-2">
            {acoes.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: a.cor, boxShadow: `0 0 8px ${a.cor}` }} />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-g-word">{a.t}</div>
                  {a.sub && <div className="mt-0.5 text-[11.5px] text-g-muted">{a.sub}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={ler}
            className="inline-flex min-h-[44px] items-center rounded-full border border-white/15 px-4 text-[12px] font-bold text-g-muted hover:text-g-word">
            {estado === "carregando" ? "Lendo…" : "↻ Atualizar"}
          </button>
          {d.avisos_24h > 0 && <span className="text-[11.5px] text-g-muted">{d.avisos_24h} aviso(s) de sistema em 24h — não são problema</span>}
        </div>
        {/* A AÇÃO MORA EMBAIXO DA ACUSAÇÃO. "cobrar ou recarregar" com o recarregar a um clique. */}
        <Creditos token={token} aoAjustar={ler} />
      </Bloco>
    </div>
  );
}
