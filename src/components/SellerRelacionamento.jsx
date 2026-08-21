import { useCallback, useEffect, useState } from "react";

/* ═══ RELACIONAMENTO — o elo do vendedor com quem ele já vendeu ══════════════════════════════
   Pedido do Luis: "onde o cliente também AVALIA o vendedor, e tem um chat que acessa ele direto".
   Esta tela é o lado do VENDEDOR: a nota que a carteira dele deu, e a carteira em si.

   🚨 A NOTA SEM O NOME. Média, quantidade, distribuição e tendência — nunca quem deu. O banco
   reforça: `consultor_nota_resumo` devolve `anonimato_seguro:false` e esconde os comentários
   enquanto houver menos de 3 votos, porque em carteira pequena um comentário sozinho identifica
   quem falou. Aqui a tela OBEDECE essa bandeira em vez de reimplementar a regra — regra duplicada
   é regra que se desencontra.

   🚨 ZERO NÃO É "NOTA BAIXA". Sem voto nenhum, `media` vem `null` e a tela diz "ainda sem nota",
   em cinza. Desenhar 0,0 ali seria acusar o vendedor de um desempenho que ninguém mediu — é o
   mesmo `|| 0` que já produziu diagnóstico falso cinco vezes neste repositório. */

const NOT_MEASURED = "#8A8578";
const GANHO = "#3E9468";
const PERDA = "#e0855f";

const U = {
  pt: {
    chatH: "Conversas com seus clientes", chatVazio: "Nenhum cliente te escreveu ainda. Quando escrever, a conversa abre aqui.", chatPh: "Responder…", enviar: "Enviar", enviando: "…", chatErr: "Não saiu:",
    h: "Relacionamento", sub: "A nota que a sua carteira te deu e os clientes que são seus. A nota é anônima: você vê a média, nunca quem deu.",
    nota: "Sua nota", votos: "avaliações", semNota: "ainda sem nota — ninguém avaliou você ainda",
    tend: "Tendência", tendSobe: "subindo", tendCai: "caindo", tendIgual: "estável", tendSem: "sem base de comparação",
    dist: "Como se distribui", coment: "O que disseram",
    comentTravado: "Comentários só aparecem a partir de 3 avaliações — com menos que isso, um comentário sozinho entrega quem escreveu.",
    semComent: "Nenhum comentário escrito ainda.",
    carteira: "Sua carteira", semCarteira: "Você ainda não tem cliente ativo na carteira. Quando o primeiro fechar, ele aparece aqui.",
    erro: "Não consegui ler", recarregar: "↻ Atualizar", carregando: "Carregando…",
    periodo: "últimos {d} dias",
    porQue: "Por que isso importa: cliente que avalia mal e ninguém procura vira cancelamento silencioso. Aqui você vê antes.",
  },
  en: {
    chatH: "Conversations with your clients", chatVazio: "No client has written to you yet. When they do, the thread opens here.", chatPh: "Reply…", enviar: "Send", enviando: "…", chatErr: "Didn't send:",
    h: "Relationship", sub: "The rating your book gave you and the clients that are yours. Ratings are anonymous: you see the average, never who gave it.",
    nota: "Your rating", votos: "ratings", semNota: "no rating yet — nobody has rated you",
    tend: "Trend", tendSobe: "rising", tendCai: "falling", tendIgual: "steady", tendSem: "nothing to compare against",
    dist: "How it splits", coment: "What they said",
    comentTravado: "Comments appear from 3 ratings on — with fewer, a lone comment gives away who wrote it.",
    semComent: "No written comments yet.",
    carteira: "Your book", semCarteira: "No active client in your book yet. When the first one closes, they show up here.",
    erro: "Couldn't read", recarregar: "↻ Refresh", carregando: "Loading…",
    periodo: "last {d} days",
    porQue: "Why it matters: a client who rates you badly and hears from no one becomes a silent cancellation. Here you see it first.",
  },
  es: {
    chatH: "Conversaciones con tus clientes", chatVazio: "Ningún cliente te ha escrito aún. Cuando lo haga, la conversación se abre aquí.", chatPh: "Responder…", enviar: "Enviar", enviando: "…", chatErr: "No salió:",
    h: "Relación", sub: "La nota que tu cartera te dio y los clientes que son tuyos. La nota es anónima: ves el promedio, nunca quién la dio.",
    nota: "Tu nota", votos: "valoraciones", semNota: "aún sin nota — nadie te ha valorado",
    tend: "Tendencia", tendSobe: "subiendo", tendCai: "bajando", tendIgual: "estable", tendSem: "sin base de comparación",
    dist: "Cómo se reparte", coment: "Qué dijeron",
    comentTravado: "Los comentarios aparecen a partir de 3 valoraciones — con menos, un comentario solo delata a quien escribió.",
    semComent: "Aún no hay comentarios escritos.",
    carteira: "Tu cartera", semCarteira: "Aún no tienes cliente activo en la cartera. Cuando cierre el primero, aparecerá aquí.",
    erro: "No pude leer", recarregar: "↻ Actualizar", carregando: "Cargando…",
    periodo: "últimos {d} días",
    porQue: "Por qué importa: un cliente que te valora mal y a quien nadie busca se vuelve una cancelación silenciosa. Aquí lo ves antes.",
  },
  hi: {
    chatH: "आपके क्लाइंट से बातचीत", chatVazio: "अभी किसी क्लाइंट ने नहीं लिखा। जब लिखेंगे, बातचीत यहाँ खुलेगी।", chatPh: "जवाब दें…", enviar: "भेजें", enviando: "…", chatErr: "नहीं गया:",
    h: "रिश्ता", sub: "आपकी क्लाइंट-सूची ने दी रेटिंग और आपके क्लाइंट। रेटिंग गुमनाम है: आप औसत देखते हैं, कभी नहीं कि किसने दी।",
    nota: "आपकी रेटिंग", votos: "रेटिंग", semNota: "अभी कोई रेटिंग नहीं — किसी ने आपको रेट नहीं किया",
    tend: "रुझान", tendSobe: "बढ़ रहा", tendCai: "गिर रहा", tendIgual: "स्थिर", tendSem: "तुलना का आधार नहीं",
    dist: "कैसे बँटा है", coment: "उन्होंने क्या कहा",
    comentTravado: "टिप्पणियाँ 3 रेटिंग से दिखती हैं — कम में अकेली टिप्पणी लिखने वाले को उजागर कर देती है।",
    semComent: "अभी कोई लिखित टिप्पणी नहीं।",
    carteira: "आपके क्लाइंट", semCarteira: "अभी कोई सक्रिय क्लाइंट नहीं। पहला बंद होते ही यहाँ दिखेगा।",
    erro: "पढ़ नहीं सका", recarregar: "↻ रिफ़्रेश", carregando: "लोड हो रहा है…",
    periodo: "पिछले {d} दिन",
    porQue: "यह क्यों मायने रखता है: बुरी रेटिंग देने वाला क्लाइंट, जिससे कोई संपर्क नहीं करता, चुपचाप चला जाता है। यहाँ आप पहले देख लेते हैं।",
  },
};

export default function SellerRelacionamento({ lang = "pt", seller = null }) {
  const t = U[lang] || U.pt;
  const [estado, setEstado] = useState("carregando"); // carregando | ok | err
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");

  const [chat, setChat] = useState([]);       // [{autor, texto, cliente, quando}]
  const [aberto, setAberto] = useState("");   // e-mail do cliente cuja conversa está aberta
  const [rascunho, setRascunho] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [chatErr, setChatErr] = useState("");

  const carregaChat = useCallback(async () => {
    try {
      const r = await fetch("/api/seller-relacionamento", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "chat_ler", seller_email: seller?.email, seller_code: seller?.code || "" }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setChat(Array.isArray(j.mensagens) ? j.mensagens : []);
    } catch { /* o bloco do chat some sozinho; o resto da tela não depende dele */ }
  }, [seller?.email, seller?.code]);

  const responder = async () => {
    const t2 = rascunho.trim();
    if (!t2 || !aberto) return;
    setEnviando(true); setChatErr("");
    try {
      const r = await fetch("/api/seller-relacionamento", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "chat_enviar", cliente: aberto, texto: t2, seller_email: seller?.email, seller_code: seller?.code || "" }),
      });
      const j = await r.json().catch(() => null);
      // só limpo o campo com o id na mão: limpar sem comprovante apaga o que o vendedor escreveu.
      if (r.ok && j?.ok && j.id) { setRascunho(""); await carregaChat(); }
      else setChatErr(j?.motivo || `HTTP ${r.status}`);
    } catch (e) { setChatErr(String(e).slice(0, 120)); }
    finally { setEnviando(false); }
  };

  const carrega = useCallback(async () => {
    setEstado("carregando"); setErro("");
    try {
      const r = await fetch("/api/seller-relacionamento", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seller_email: seller?.email, seller_code: seller?.code || "", dias: 90 }),
      });
      const j = await r.json().catch(() => null);
      // Ler a RESPOSTA, não só o status: este endpoint devolve 200 com os erros DE CADA BLOCO
      // separados, porque nota e carteira falham por motivos diferentes.
      if (!r.ok || !j?.ok) { setEstado("err"); setErro(j?.error === "team_code" ? "team" : (j?.motivo || j?.error || `HTTP ${r.status}`)); return; }
      setD(j); setEstado("ok");
    } catch (e) { setEstado("err"); setErro(String(e).slice(0, 120)); }
  }, [seller?.email, seller?.code]);

  useEffect(() => { carrega(); carregaChat(); }, [carrega, carregaChat]);

  const n = d?.nota || null;
  const temNota = n && typeof n.media === "number" && n.votos > 0;
  const tendRotulo = !temNota || n.media_anterior == null ? t.tendSem
    : n.media > n.media_anterior ? t.tendSobe
    : n.media < n.media_anterior ? t.tendCai : t.tendIgual;
  const tendCor = !temNota || n.media_anterior == null ? NOT_MEASURED
    : n.media > n.media_anterior ? GANHO : n.media < n.media_anterior ? PERDA : NOT_MEASURED;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-extrabold text-g-word">🤝 {t.h}</div>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-g-muted">{t.sub}</p>
        </div>
        <button type="button" onClick={carrega}
          className="inline-flex min-h-[48px] shrink-0 items-center rounded-full border border-white/15 px-4 text-[12.5px] font-bold text-g-muted hover:text-g-word">
          {estado === "carregando" ? t.carregando : t.recarregar}
        </button>
      </div>

      {estado === "err" && (
        <div className="rounded-2xl border px-4 py-3 text-[12.5px] backdrop-blur-xl" style={{ borderColor: `${PERDA}55`, color: PERDA }}>
          {t.erro}: {erro === "team" ? "esta tela precisa do seu código PESSOAL, não o do time." : erro}
        </div>
      )}

      {estado === "ok" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ── A NOTA ─────────────────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">
              {t.nota} · {t.periodo.replace("{d}", d.dias)}
            </div>

            {d.nota_erro ? (
              <div className="mt-2 text-[12.5px]" style={{ color: PERDA }}>{d.nota_erro}</div>
            ) : !temNota ? (
              // ausência declarada, nunca 0,0 — 0 acusaria um desempenho que ninguém mediu
              <div className="mt-2 text-[13px]" style={{ color: NOT_MEASURED }}>{t.semNota}</div>
            ) : (
              <>
                <div className="mt-1 flex items-end gap-3">
                  <div className="text-[44px] font-black leading-none tabular-nums text-g-word">{n.media.toFixed(1)}</div>
                  <div className="pb-1 text-[12.5px] text-g-muted">{n.votos} {t.votos}</div>
                </div>
                <div className="mt-2 text-[12px] font-bold" style={{ color: tendCor }}>
                  {t.tend}: {tendRotulo}
                </div>

                {/* distribuição — só as notas que existem, cada barra proporcional ao total */}
                {n.distribuicao && Object.keys(n.distribuicao).length > 0 && (
                  <div className="mt-4">
                    <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.dist}</div>
                    <div className="mt-2 space-y-1.5">
                      {[5, 4, 3, 2, 1].map((k) => {
                        const q = Number(n.distribuicao[k] || n.distribuicao[String(k)] || 0);
                        const pct = n.votos > 0 ? Math.round((q / n.votos) * 100) : 0;
                        return (
                          <div key={k} className="flex items-center gap-2">
                            <span className="w-6 shrink-0 text-[11px] tabular-nums text-g-muted">{k}★</span>
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                              <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: k >= 4 ? GANHO : k === 3 ? NOT_MEASURED : PERDA }} />
                            </span>
                            <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-g-muted">{q}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* comentários — a tela OBEDECE a bandeira do banco, não reimplementa a regra */}
                <div className="mt-4">
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.coment}</div>
                  {!n.anonimato_seguro ? (
                    <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: NOT_MEASURED }}>🔒 {t.comentTravado}</p>
                  ) : !Array.isArray(n.comentarios) || n.comentarios.length === 0 ? (
                    <p className="mt-1.5 text-[12px]" style={{ color: NOT_MEASURED }}>{t.semComent}</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {n.comentarios.map((c, i) => (
                        <li key={i} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] leading-relaxed text-g-ink">
                          “{typeof c === "string" ? c : (c?.comentario || c?.texto || "")}”
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── A CARTEIRA ─────────────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{t.carteira}</div>
            {d.carteira_erro ? (
              <div className="mt-2 text-[12.5px]" style={{ color: PERDA }}>{d.carteira_erro}</div>
            ) : !Array.isArray(d.carteira) || d.carteira.length === 0 ? (
              <div className="mt-2 text-[13px]" style={{ color: NOT_MEASURED }}>{t.semCarteira}</div>
            ) : (
              <ul className="mt-3 space-y-2">
                {d.carteira.map((c, i) => {
                  const nome = c?.business || c?.negocio || c?.client_email || "—";
                  const plano = c?.plan || c?.plano || "";
                  const mail = c?.client_email || "";
                  return (
                    <li key={c?.client_email || i} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-bold text-g-word">{nome}</div>
                          {mail && <div className="truncate text-[11px] text-g-muted">{mail}</div>}
                        </div>
                        {plano && <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-g-ink">{plano}</span>}
                      </div>
                      {mail && (
                        <a href={`mailto:${mail}`}
                          className="mt-2 inline-flex min-h-[40px] items-center rounded-full bg-white/[0.05] px-3 text-[12px] font-bold text-g-word ring-1 ring-white/15 hover:bg-white/[0.09]">
                          ✉️ {mail.split("@")[0]}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── CHAT DIRETO ─────────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{t.chatH}</div>
            {chat.length === 0 ? (
              <div className="mt-2 text-[13px]" style={{ color: NOT_MEASURED }}>{t.chatVazio}</div>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[...new Set(chat.map((m) => m.cliente).filter(Boolean))].map((c) => {
                    const naoLidas = chat.filter((m) => m.cliente === c && m.autor === "cliente" && !m.lido).length;
                    return (
                      <button key={c} type="button" onClick={() => { setAberto(c === aberto ? "" : c); setChatErr(""); }}
                        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[12px] font-bold ring-1 transition ${aberto === c ? "bg-g-green/20 text-g-word ring-g-green/40" : "bg-white/[0.05] text-g-muted ring-white/15 hover:text-g-word"}`}>
                        {c.split("@")[0]}
                        {naoLidas > 0 && <span className="rounded-full bg-[#FF8A33] px-1.5 text-[10px] font-black text-black">{naoLidas}</span>}
                      </button>
                    );
                  })}
                </div>
                {aberto && (
                  <div className="mt-3">
                    <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {chat.filter((m) => m.cliente === aberto).map((m) => (
                        <li key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${m.autor === "vendedor" ? "ml-auto bg-g-green/15 text-g-word" : "bg-white/[0.05] text-g-ink"}`}>
                          {m.texto}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input value={rascunho} onChange={(e) => setRascunho(e.target.value)} placeholder={t.chatPh}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) responder(); }}
                        className="min-w-[200px] flex-1 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-[14px] text-g-word placeholder:text-g-muted/70 focus:border-g-green/50 focus:outline-none" />
                      <button type="button" onClick={responder} disabled={enviando || !rascunho.trim()}
                        className="inline-flex min-h-[48px] items-center rounded-full bg-g-green/20 px-5 text-[13px] font-bold text-g-green ring-1 ring-g-green/40 hover:bg-g-green/30 disabled:opacity-50">
                        {enviando ? t.enviando : t.enviar}
                      </button>
                    </div>
                    {chatErr && <div className="mt-2 text-[12px]" style={{ color: PERDA }}>{t.chatErr} {chatErr}</div>}
                  </div>
                )}
              </>
            )}
          </div>

          <p className="lg:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] leading-relaxed text-g-muted backdrop-blur-xl">
            💡 {t.porQue}
          </p>
        </div>
      )}
    </div>
  );
}
