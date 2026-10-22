// functions/lib/retornoAutomatico.js — O PORTÃO DO RETORNO AUTOMÁTICO (2026-10-01)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// twilio-voice.js e voice-fallback.js ligam de volta para quem não foi atendido SEM passar pelo
// call.js — discam direto no ElevenLabs. Ficaram então sem as duas travas que o call.js ganhou
// depois da fraude de 09/2026 (ver `destinoPermitido` em contato.js):
//   1. DESTINO: ligavam de volta para qualquer país. Quem liga de um número caro (+972, ilhas do
//      +1, 900) e desliga faz a Guileo pagar a ligação de volta — o mesmo golpe, por outra porta.
//   2. NÃO-PERTURBE: se a lista não pudesse ser lida, discavam mesmo assim.
// Aqui as duas valem igual às do call.js: destino só onde a Guileo vende, e lista que não foi LIDA
// é ligação que não sai. Devolve o número já limpo, para as duas portas discarem a mesma coisa.
import { paraE164, destinoPermitido } from "./contato.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";

// `lerDnc(e164)` devolve true/false quando LEU a lista e lança (ou devolve outra coisa) quando não.
// Vem de fora para o teste não depender de rede.
export async function podeRetornar(env, de, lerDnc) {
  const bruto = (de || "").toString().trim();
  // O Twilio manda o `From` em E.164. Sem `+` é dado estragado — não se adivinha país para discar.
  const e164 = bruto.startsWith("+") ? paraE164(bruto) : null;
  if (!e164) return { ok: false, motivo: "numero_invalido" };
  const d = destinoPermitido(e164, (env && env.CALL_DDI_EXTRA) || "");
  if (!d.ok) return { ok: false, motivo: d.motivo, e164 };
  let dnc;
  try { dnc = await lerDnc(e164); } catch { return { ok: false, motivo: "dnc_nao_lido", e164 }; }
  if (dnc === true) return { ok: false, motivo: "dnc", e164 };
  if (dnc !== false) return { ok: false, motivo: "dnc_nao_lido", e164 };
  return { ok: true, e164 };
}

// A leitura de verdade: só um `false` LIDO libera. Sem segredo, HTTP ruim ou resposta estranha = lança.
export function leitorDnc(env, anon) {
  return async (e164) => {
    if (!env || !env.INGEST_SECRET) throw new Error("sem_segredo");
    const r = await fetch(`${SB_URL}/rest/v1/rpc/is_dnc`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_phone: e164 }),
    });
    if (!r.ok) throw new Error(`http_${r.status}`);
    const v = await r.json();
    if (v === true || v === false) return v;
    throw new Error("resposta_estranha");
  };
}
