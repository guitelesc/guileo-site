import { useState } from "react";
import { STAGES } from "./SellerFollowup.jsx";

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ➕ PRO MEU FUNIL — a ponte entre o que foi MEDIDO (Fila de ataque, X-Ray) e o funil que já existe.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE: as duas telas de medição produzem a lista de prospects mais quente da plataforma
// — negócio medido, números do Google, relatório pronto — e tudo isso morria no F5. O funil de 6
// etapas (SellerFollowup) já existia e estava testado; faltava só a porta. Este botão é a porta.
//
// 🚨 AS 3 LEIS DESTE BOTÃO:
//   1. COMPROVANTE. "Salvo" só aparece depois de LER a resposta e achar `ok:true` COM
//      `prospect.id`. `r.ok` não basta: o endpoint devolve 200 em casos que não gravaram. Sem id,
//      é ERRO com motivo — nunca um ✓. (Regra da casa: "sucesso precisa de comprovante".)
//   2. O 401 DE CÓDIGO DE TIME TEM MENSAGEM PRÓPRIA. O endpoint exige `roster:true` (código
//      PESSOAL) porque o CRM de prospects é privado de cada vendedor — decisão de segurança
//      correta. Mas o backend devolve o MESMO `{error:"unauthorized"}` para sessão expirada e
//      para código de time, então a mensagem nomeia as duas causas, começando pela provável.
//      Um "erro" genérico aqui deixaria o vendedor de código de time trabalhando achando que
//      estava gravando — foi exatamente o defeito corrigido noutra tela.
//   3. O 500 MOSTRA O MOTIVO CRU ("save failed (paste db/seller_prospects.sql)") — é acionável
//      pro Luis. Traduzir/esconder isso transformaria uma instrução em um enigma.
//
// A ETAPA vem de STAGES[0] (SellerFollowup) — lida de lá, nunca redigitada: se o funil mudar o
// começo, este botão acompanha sozinho.

const PRIMEIRA_ETAPA = STAGES[0];

// o mesmo teto do backend (p_note ... slice(0,1500) em seller-prospects.js). Cortar aqui é honesto;
// deixar o servidor cortar em silêncio seria sumiço de dado.
const NOTE_MAX = 1500;
const BIZ_MAX = 200;

const F = {
  pt: {
    add: "➕ pro meu funil", indo: "salvando…", pronto: "✓ no funil",
    errTime: "O funil exige CÓDIGO PESSOAL. Você entrou com o código do time, então seu prospect NÃO foi gravado — peça seu código pessoal ao Luis.",
    errSessao: "Sua sessão expirou. Saia e entre de novo — o prospect não foi gravado.",
    semId: "O servidor respondeu sem o id do prospect — não dá pra afirmar que gravou. Tente de novo.",
    semNome: "Sem nome nem domínio pra identificar o prospect.",
    rede: "Erro de rede — não deu pra falar com o funil.",
  },
  en: {
    add: "➕ to my funnel", indo: "saving…", pronto: "✓ in the funnel",
    errTime: "The funnel requires a PERSONAL code. You signed in with the team code, so your prospect was NOT saved — ask Luis for your personal code.",
    errSessao: "Your session expired. Log out and back in — the prospect was not saved.",
    semId: "The server answered without the prospect id — we can't claim it saved. Try again.",
    semNome: "No name or domain to identify the prospect.",
    rede: "Network error — couldn't reach the funnel.",
  },
  es: {
    add: "➕ a mi embudo", indo: "guardando…", pronto: "✓ en el embudo",
    errTime: "El embudo exige CÓDIGO PERSONAL. Entraste con el código del equipo, así que tu prospecto NO se guardó — pídele a Luis tu código personal.",
    errSessao: "Tu sesión expiró. Sal y entra de nuevo — el prospecto no se guardó.",
    semId: "El servidor respondió sin el id del prospecto — no se puede afirmar que guardó. Inténtalo de nuevo.",
    semNome: "Sin nombre ni dominio para identificar al prospecto.",
    rede: "Error de red — no se pudo hablar con el embudo.",
  },
  hi: {
    add: "➕ मेरे फ़नल में", indo: "सहेजा जा रहा है…", pronto: "✓ फ़नल में",
    errTime: "फ़नल के लिए व्यक्तिगत कोड चाहिए। आपने टीम कोड से लॉगिन किया, इसलिए प्रॉस्पेक्ट सेव नहीं हुआ — Luis से अपना व्यक्तिगत कोड माँगें।",
    errSessao: "आपका सेशन समाप्त हो गया। दोबारा लॉगिन करें — प्रॉस्पेक्ट सेव नहीं हुआ।",
    semId: "सर्वर ने प्रॉस्पेक्ट id के बिना जवाब दिया — यह नहीं कहा जा सकता कि सेव हुआ। दोबारा कोशिश करें।",
    semNome: "प्रॉस्पेक्ट को पहचानने के लिए न नाम है न डोमेन।",
    rede: "नेटवर्क त्रुटि — फ़नल से बात नहीं हो सकी।",
  },
};

export default function SellerFunnelButton({ lang = "pt", seller = null, business = "", note = "", market = "us" }) {
  const f = F[lang] || F.pt;
  const [estado, setEstado] = useState("idle"); // idle | busy | done | err
  const [erro, setErro] = useState("");

  const salvar = async () => {
    if (estado === "busy" || estado === "done") return;
    const nome = (business || "").toString().trim().slice(0, BIZ_MAX);
    if (!nome) { setErro(f.semNome); setEstado("err"); return; }
    setEstado("busy"); setErro("");
    try {
      const r = await fetch("/api/seller-prospects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          seller_email: seller?.email || "",
          seller_code: seller?.code || "",
          prospect: {
            business: nome,
            note: (note || "").toString().slice(0, NOTE_MAX),
            stage: PRIMEIRA_ETAPA,
            market,
          },
        }),
      });
      const d = await r.json().catch(() => ({}));
      // 401 = código de time OU sessão morta. Mensagem própria, nunca "erro".
      // 401 tem DUAS causas com soluções OPOSTAS. O backend agora as separa por nome:
      // `team_code` → precisa do código pessoal;  qualquer outra → sessão morta, relogar.
      // Erro genérico faz o vendedor tentar a coisa errada e desistir.
      if (r.status === 401) {
        const d401 = await r.json().catch(() => ({}));
        setErro(d401 && d401.error === "team_code" ? f.errTime : f.errSessao);
        setEstado("err"); return;
      }
      // 🚨 O COMPROVANTE: ok:true E prospect.id. Sem id, não gravou — mesmo com 200.
      if (!d.ok || !d.prospect || !d.prospect.id) {
        // 500 traz o motivo CRU (ex.: "save failed (paste db/seller_prospects.sql)") — mostrar
        // exatamente isso é o que torna o defeito acionável.
        setErro(d.error || d.erro || (r.ok ? f.semId : `HTTP ${r.status}`));
        setEstado("err"); return;
      }
      setEstado("done");
    } catch { setErro(f.rede); setEstado("err"); }
  };

  const done = estado === "done";
  return (
    <span className="inline-flex min-w-0 flex-col gap-1">
      <button
        type="button"
        onClick={salvar}
        disabled={done || estado === "busy"}
        aria-live="polite"
        className={
          done
            ? "inline-flex min-h-[44px] items-center justify-center rounded-full border border-g-green/40 bg-g-green/10 px-5 text-[12.5px] font-bold text-g-green"
            : "btn-ghost min-h-[44px] text-[12.5px] disabled:opacity-60"
        }
      >
        {done ? f.pronto : estado === "busy" ? f.indo : f.add}
      </button>
      {estado === "err" && erro && (
        <span className="max-w-[420px] rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11.5px] leading-snug text-red-300">
          {erro}
        </span>
      )}
    </span>
  );
}
