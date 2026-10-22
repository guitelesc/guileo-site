import { useCallback, useEffect, useState } from "react";

/* ═══ 🔎 FUNIL DO SITE — o que o visitante faz entre chegar e deixar contato ═══════════════════
   Fonte: site_eventos (src/lib/evento.js grava; /api/admin-comando action "funil_site" lê).

   🚨 CADA ETAPA É % DAS VISITAS, NÃO DA ETAPA ANTERIOR. O visitante pode abrir a Gui pelo botão
   flutuante sem ter clicado no CTA do hero — então "abriu a Gui" pode ser maior que "clicou pra
   falar", e a taxa etapa-a-etapa passaria de 100%. Um funil que mostra 140% ensina a desconfiar
   do painel inteiro.

   🚨 VISITANTE É APROXIMADO. Vem do hash do IP (sem cookie). Rede de empresa conta como 1;
   celular trocando de antena conta como 2. Serve pra tendência, não pra contrato. */

const OK = "#3E9468", MUDO = "#8A8578", OURO = "#D6C29A";

const ETAPAS = [
  { rot: "Visitas", ev: ["pageview"], dica: "página carregada" },
  { rot: "Clicou pra falar", ev: ["cta_hero", "cta_menu"], dica: "botão do topo ou do menu" },
  { rot: "Abriu a Gui", ev: ["gui_aberta"], dica: "widget aberto" },
  { rot: "Conversou", ev: ["gui_chamada", "gui_mensagem"], dica: "ligou pelo navegador ou mandou mensagem" },
  { rot: "Deixou contato", ev: ["lead_enviado", "xray_enviado"], dica: "formulário ou Raio-X enviado" },
];

export default function AdminFunil({ token }) {
  const [dias, setDias] = useState(7);
  const [d, setD] = useState(null);
  const [estado, setEstado] = useState("carregando");
  const [erro, setErro] = useState("");

  const ler = useCallback(async () => {
    if (!token) return;
    setEstado("carregando"); setErro("");
    try {
      const r = await fetch("/api/admin-comando", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "funil_site", dias }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.ok) { setEstado("err"); setErro((j && (j.motivo || j.error)) || `HTTP ${r.status}`); return; }
      setD(j); setEstado("ok");
    } catch (e) { setEstado("err"); setErro(String(e).slice(0, 120)); }
  }, [token, dias]);

  useEffect(() => { ler(); }, [ler]);

  const pe = (d && d.por_evento) || {};
  const soma = (evs) => evs.reduce((s, e) => s + Number(pe[e] || 0), 0);
  const visitas = soma(["pageview"]);
  const linhas = ETAPAS.map((e) => ({ ...e, n: soma(e.ev) }));
  // "Deixou contato" vem do BANCO de leads (formulário + Raio-X + o que a Gui capturou na conversa),
  // não dos eventos do navegador: o lead que a Gui grava pela ferramenta nunca passa pelo navegador.
  const L = d && d.leads;
  if (L) { linhas[4].n = L.formulario + L.gui_conversa; linhas[4].dica = `${L.formulario} formulário · ${L.gui_conversa} na conversa com a Gui${L.suspeitos ? ` · ${L.suspeitos} robô fora` : ""}`; }
  else if (d) linhas[4].dica = "leads não lidos (só eventos do navegador)";

  // Visitas por dia (só pageview) — o eixo mostra todos os dias da janela, inclusive os zerados:
  // dia sem barra é informação, não buraco no gráfico.
  const porDia = {};
  for (const x of (d && d.por_dia) || []) if (x.nome === "pageview") porDia[x.dia] = Number(x.n || 0);
  const serie = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    serie.push({ dia: dt, n: porDia[dt] || 0 });
  }
  const maxDia = Math.max(1, ...serie.map((s) => s.n));

  return (
    <div className="rounded-2xl border border-g-line bg-g-creamd/70 p-5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold/80">🔎 Funil do site</div>
          <div className="text-[12px] text-g-muted">guileoai.com · da visita ao contato</div>
        </div>
        <div className="flex items-center gap-1.5">
          {[7, 30].map((n) => (
            <button key={n} onClick={() => setDias(n)}
              className={`rounded-full border px-3 py-1 text-[12px] font-bold ${dias === n ? "border-g-gold/50 text-g-gold" : "border-g-line text-g-muted hover:text-g-word"}`}>
              {n} dias
            </button>
          ))}
        </div>
      </div>

      {estado === "carregando" && !d && <div className="mt-4 text-[13px] text-g-muted">Lendo os eventos…</div>}
      {estado === "err" && (
        <div className="mt-4 rounded-xl border border-[#c8623c]/40 bg-[#c8623c]/10 px-3 py-2 text-[13px] text-[#e8a488]">
          Não consegui ler o funil — {erro}. Os eventos continuam sendo gravados; é só a leitura.
        </div>
      )}

      {d && (
        <>
          <div className="mt-4 space-y-2">
            {linhas.map((l, i) => {
              const pct = visitas ? (l.n / visitas) * 100 : 0;
              return (
                <div key={l.rot} className="grid grid-cols-[150px_1fr_88px] items-center gap-3">
                  <div>
                    <div className="text-[13px] font-bold text-g-word">{l.rot}</div>
                    <div className="text-[10.5px] text-g-muted">{l.dica}</div>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/[0.04]">
                    <div className="h-full rounded-full" style={{ width: `${i === 0 ? (visitas ? 100 : 0) : Math.min(100, pct)}%`, background: i === linhas.length - 1 ? OURO : OK, opacity: 0.35 + 0.65 * (1 - i / linhas.length) }} />
                  </div>
                  <div className="text-right tabular-nums">
                    <span className="text-[15px] font-black" style={{ color: l.n ? "#EDE7DC" : MUDO }}>{l.n}</span>
                    {i > 0 && <span className="ml-1.5 text-[11px] text-g-muted">{visitas ? `${pct.toFixed(pct < 10 ? 1 : 0)}%` : "—"}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex items-baseline justify-between text-[11px] text-g-muted">
              <span>Visitas por dia</span>
              <span>~{d.visitantes_aprox ?? "?"} visitantes (aprox., por IP)</span>
            </div>
            <div className="flex h-16 items-end gap-[3px]" role="img" aria-label={`Visitas por dia nos últimos ${dias} dias`}>
              {serie.map((s) => (
                <div key={s.dia} title={`${s.dia}: ${s.n}`} className="flex-1 rounded-t-sm"
                  style={{ height: `${Math.max(4, (s.n / maxDia) * 100)}%`, background: s.n ? OK : "rgba(255,255,255,0.05)" }} />
              ))}
            </div>
          </div>

          {linhas[4].n === 0 && visitas > 0 && (
            <div className="mt-4 rounded-xl border border-g-line bg-white/[0.03] px-3 py-2 text-[12.5px] text-g-ink">
              Nenhum contato deixado em {dias} dias, com {visitas} visitas e {linhas[3].n} conversas com a Gui.
              O gargalo está depois da conversa — a Gui precisa pedir nome e telefone antes de a pessoa sair.
            </div>
          )}
        </>
      )}
    </div>
  );
}
