/* /agente — MOTOR DE AGENTE PRONTO (Luis 24/08)
   Duas telas no mesmo arquivo, porque são a mesma coisa vista de dois lados:
     • /agente          → o VENDEDOR cola a URL do site + o que viu no X-Ray/Pulse e monta.
     • /agente/:token   → o DONO abre e vê o agente DELE, com a saudação, os serviços e os preços
                          dele. Ele julga olhando, não imaginando — igual ao Website Upgrade.

   ⚠️ MONTAR NÃO É NASCER. Enquanto o estado for `previa`, nada existe na ElevenLabs e nenhum
   número foi comprado. A tela diz isso em voz alta: já paguei nesta base o preço de um botão que
   comprava número sem ninguém pedir. Nascer de verdade continua sendo um passo separado.

   ⚠️ LACUNA É CONTEÚDO. O que o site não disse aparece em vermelho, com o efeito prático escrito
   ("a agente vai dizer 'confirmo com a equipe' em vez de cotar"). Preencher um campo com chute
   pra tela ficar bonita é como a agente nasce inventando preço. */
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import logo from "../assets/guileo-mark.png";

const T = {
  pt: { montar: "Montar o agente", url: "Link do site do cliente", notas: "O que você viu no X-Ray / Pulse (opcional)",
        notasPh: "Ex.: 4 ligações perdidas por dia, sem retorno. Google com 3.9★ e 2 reviews sem resposta.",
        btn: "Montar agente →", montando: "Lendo o site…", pronto: "Agente montado", copiar: "Copiar link pro cliente",
        copiado: "Copiado ✓", erro: "Não consegui montar",
        h: "O agente do", sub: "Montado a partir do site. Ainda não está no ar — é a prévia pra você aprovar.",
        saud: "Como ele atende", serv: "O que ele sabe cotar", cereb: "O que ele sabe do negócio",
        hab: "O que ele faz numa ligação", falta: "O que falta pra ele não inventar nada",
        semPreco: "sem preço no site", previa: "PRÉVIA · ainda não está no ar",
        rodape: "Aprovando, a gente liga o número e ele começa a atender. Nada é cobrado até você dizer sim." },
  en: { montar: "Build the agent", url: "Client's website link", notas: "What you saw in the X-Ray / Pulse (optional)",
        notasPh: "e.g. 4 missed calls a day, no callback. Google at 3.9★ with 2 unanswered reviews.",
        btn: "Build agent →", montando: "Reading the site…", pronto: "Agent built", copiar: "Copy the client's link",
        copiado: "Copied ✓", erro: "Couldn't build it",
        h: "The agent for", sub: "Built from the site. Not live yet — this is the preview for you to approve.",
        saud: "How it answers", serv: "What it can quote", cereb: "What it knows about the business",
        hab: "What it does on a call", falta: "What's missing so it never invents anything",
        semPreco: "no price on the site", previa: "PREVIEW · not live yet",
        rodape: "Approve it and we connect the number — it starts answering. Nothing is charged until you say yes." },
};

const api = async (body) => {
  try {
    const r = await fetch("/api/agente-pronto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await r.json();          // 4xx também traz JSON útil — não descartar
  } catch { return null; }
};

function Bloco({ titulo, children, cor = "#c2a878" }) {
  return (
    <div className="mt-6">
      <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: cor }}>{titulo}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function AgentePronto() {
  const { token } = useParams();
  const lang = (navigator.language || "en").toLowerCase().startsWith("pt") ? "pt" : "en";
  const t = T[lang];
  const [ag, setAg] = useState(null);
  const [erro, setErro] = useState("");
  const [url, setUrl] = useState("");
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const r = await api({ action: "ver", token });
      if (r && r.ok) setAg(r.agente);
      else setErro(r && r.found === false ? "404" : "erro");
    })();
  }, [token]);

  const montar = useCallback(async () => {
    setBusy(true); setErro("");
    const r = await api({ action: "montar", url: url.trim(), notas, lang });
    setBusy(false);
    // A resposta CRUA decide. `r.ok` do fetch diria "o servidor respondeu", não "o agente existe".
    if (r && r.ok) { setAg(r.agente); setLink(r.link); }
    else setErro((r && r.error) || t.erro);
  }, [url, notas, lang, t.erro]);

  // ── TELA DO VENDEDOR ────────────────────────────────────────────────────────────────────────
  if (!token && !ag) {
    return (
      <div className="min-h-screen surface-real text-g-ink" style={{ background: "#161512" }}>
        <div className="mx-auto max-w-lg px-5 py-12">
          <div className="flex items-center gap-2 opacity-70"><img src={logo} alt="" className="h-6 w-6" /><span className="text-[12px] text-g-muted">Guileo · vendedor</span></div>
          <h1 className="mt-6 text-3xl font-black">{t.montar}</h1>
          <label className="mt-8 block text-[12px] font-bold uppercase tracking-wider text-g-muted">{t.url}</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url"
                 className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] outline-none focus:border-g-green/60" />
          <label className="mt-5 block text-[12px] font-bold uppercase tracking-wider text-g-muted">{t.notas}</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} placeholder={t.notasPh}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-g-green/60" />
          <button onClick={montar} disabled={busy || !url.trim()}
                  className={`mt-6 w-full rounded-xl px-5 py-3.5 text-[15px] font-black ${busy || !url.trim() ? "bg-white/10 text-g-muted" : "bg-g-green text-white"}`}>
            {busy ? t.montando : t.btn}
          </button>
          {erro && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13.5px] text-red-300">{erro}</p>}
        </div>
      </div>
    );
  }

  if (erro === "404") return <div className="flex min-h-screen items-center justify-center text-g-muted" style={{ background: "#161512" }}>—</div>;
  if (!ag) return <div className="flex min-h-screen items-center justify-center text-g-muted" style={{ background: "#161512" }}>…</div>;

  const cor = ag.cor || "#c2a878";
  return (
    <div className="min-h-screen surface-real text-g-ink" style={{ background: "#161512" }}>
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {ag.logo ? <img src={ag.logo} alt="" className="h-9 w-9 rounded-lg object-contain" /> : null}
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: cor }}>{t.h}</div>
              <div className="text-[19px] font-black leading-tight">{ag.negocio || ag.site}</div>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-g-gold/40 bg-g-gold/10 px-3 py-1 text-[10px] font-black tracking-wide text-g-gold">{t.previa}</span>
        </div>
        <p className="mt-4 text-[14px] leading-relaxed text-g-muted">{t.sub}</p>

        {ag.saudacao && (
          <Bloco titulo={t.saud} cor={cor}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[17px] leading-relaxed">“{ag.saudacao}”</p>
            </div>
          </Bloco>
        )}

        {ag.servicos?.length > 0 && (
          <Bloco titulo={t.serv} cor={cor}>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {ag.servicos.map((sv, i) => (
                <div key={i} className={`flex items-center justify-between gap-3 px-4 py-3 ${i ? "border-t border-white/8" : ""}`}>
                  <span className="text-[14.5px]">{sv.nome}</span>
                  {/* Preço ausente GRITA. Preencher com número plausível é como nasce cotação falsa. */}
                  {sv.preco
                    ? <span className="shrink-0 font-mono text-[14px] font-black text-g-gold">{sv.preco}</span>
                    : <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">{t.semPreco}</span>}
                </div>
              ))}
            </div>
          </Bloco>
        )}

        {ag.cerebro && (
          <Bloco titulo={t.cereb} cor={cor}>
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[14px] leading-relaxed text-g-muted">{ag.cerebro}</p>
          </Bloco>
        )}

        <Bloco titulo={t.hab} cor={cor}>
          <ul className="space-y-2">
            {(ag.habilidades || []).map((h, i) => (
              <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed"><span className="text-g-green font-black">✓</span>{h}</li>
            ))}
          </ul>
        </Bloco>

        {ag.lacunas?.length > 0 && (
          <Bloco titulo={t.falta} cor="#e0685f">
            <ul className="space-y-2 rounded-2xl border border-red-500/25 bg-red-500/[0.07] p-4">
              {ag.lacunas.map((l, i) => (
                <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-red-200"><span className="font-black">!</span>{l}</li>
              ))}
            </ul>
          </Bloco>
        )}

        {ag.notas && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13.5px] leading-relaxed text-g-muted whitespace-pre-line">{ag.notas}</div>
        )}

        <p className="mt-8 text-center text-[13px] leading-relaxed text-g-muted">{t.rodape}</p>

        {link && (
          <button onClick={() => { navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }}
                  className="mt-6 w-full rounded-xl bg-g-green px-5 py-3.5 text-[15px] font-black text-white">
            {copiado ? T[lang].copiado : T[lang].copiar}
          </button>
        )}

        <div className="mt-10 flex items-center justify-center gap-2 opacity-50">
          <img src={logo} alt="" className="h-4 w-4" /><span className="text-[11px] text-g-muted">Guileo</span>
        </div>
      </div>
    </div>
  );
}
