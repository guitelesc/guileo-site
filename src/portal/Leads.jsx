/* Split out of Portal.jsx (performance): Leads tab view — code moved verbatim. */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, tr, LEADS , FaixaAmostra} from "../pages/Portal.jsx";

function Leads({ real }) {
  // ── OS LEADS DE VERDADE (2026-08-20) ──────────────────────────────────────────────────────
  // A tela desenhava a constante `LEADS` enquanto o cockpit já carregava 185 eventos reais de
  // mensagem e ligação. Cada um desses eventos É um lead: alguém que chamou o negócio.
  // 🚨 O CANAL SAI DO CAMPO `channel`, NÃO DO TEXTO DO RESUMO. O resumo é frase para humano ler
  // ("💬 Webchat lead on Natura Spa..."), e raspar canal de frase erra no dia em que a frase mudar.
  const leadsReais = useMemo(() => {
    if (!real || !Array.isArray(real.events)) return null;
    return real.events
      .filter((e) => e && (e.type === "message" || e.type === "call" || e.type === "lead"))
      .slice(0, 40)
      .map((e) => {
        // o resumo traz "💬 Webchat lead on X: pergunta" — o nome do contato raramente vem, e
        // inventar um seria pior: uso o canal como identidade e deixo a frase falar.
        const texto = String(e.summary || "").replace(/^[^A-Za-z0-9À-ÿ]+/, "");
        return {
          name: texto.split(":")[0].slice(0, 44) || tr("Contact"),
          ch: e.channel || e.type,
          when: e.created_at ? new Date(e.created_at).toLocaleString() : "",
          status: e.type === "call" ? tr("Called") : tr("Wrote"),
          color: e.type === "call" ? "#FF8A33" : "#4C9AFF",
        };
      });
  }, [real]);
  const linhas = leadsReais || LEADS;

  return (
    <>
      <FaixaAmostra real={real && !leadsReais} />
      <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recent leads")}</span>
        <span className="text-[11px] text-g-muted tabular-nums">{linhas.length}</span>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {linhas.map((l, i) => (
          <motion.div key={l.name + i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 px-5 py-3">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{l.name[0]}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word">{l.name}</div><div className="text-[11px] text-g-muted">{l.ch} · {l.when}</div></div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: l.color + "22", color: l.color }}>{l.status}</span>
          </motion.div>
        ))}
      </div>
    </Card>
    </>
  );
}

export default Leads;
