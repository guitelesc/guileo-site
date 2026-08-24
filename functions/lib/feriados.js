// FERIADOS PÚBLICOS — Nager.Date (date.nager.at), sem chave.
//
// POR QUE EXISTE: o motor de datas especiais (`biz_special_dates`) já existia e funcionava —
// mas era 100% MANUAL. Em 2026-08-22 a tabela estava VAZIA para todos os clientes: ninguém
// digitou um feriado sequer. Dono de salão não senta pra cadastrar 17 datas, e o resultado é a
// agenda aceitando marcar no Natal e a Gui confirmando com toda a confiança do mundo.
//
// ⚠️ SUGESTÃO, NUNCA FECHAMENTO AUTOMÁTICO. Muito negócio ABRE em feriado — salão no Dia dos
// Namorados é o dia mais cheio do ano. Fechar a loja de alguém sozinho seria o mesmo erro dos
// "sucessos" que ninguém pediu: a Gui recusaria dinheiro que o dono queria receber. Aqui só
// propõe; quem fecha é o dono, em 1 clique.
//
// CONTRATO (o da casa, e o que a skill de APIs públicas exige):
//  · Chamada de terceiro sai do SERVIDOR. Esta API não pede chave, mas a regra vale igual.
//  · PRAZO em toda chamada. Sem isso um provedor lento pendura a requisição e a tela fica
//    "carregando" para sempre, sem erro e sem botão de tentar de novo.
//  · Falhou → **null**, nunca `[]`. Lista vazia LÊ como "não há feriado neste ano" e viraria a
//    mesma família de erro do `|| []` que já transformou motor morto em "nada encontrado".
//  · O texto que volta (nome do feriado) é DADO, vai pra tela como conteúdo — nunca entra em
//    prompt sem cerca nem decide rota.

const BASE = "https://date.nager.at/api/v3/PublicHolidays";

// Devolve [{ date, nome, nomeLocal }] ou **null** quando não deu pra saber.
// SEM PADRÃO DE PAÍS, de propósito. Um `= "US"` aqui faz um cliente SEM país cadastrado receber
// feriado americano calado — dado errado com cara de certo, que é o defeito mais caro deste
// repositório. País ausente é "não sei", e "não sei" é null. Quem quiser assumir US assume no
// chamador, onde a escolha fica visível.
export async function feriadosDoAno(pais, ano = new Date().getUTCFullYear()) {
  const p = String(pais || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(p)) return null;
  const a = parseInt(ano, 10);
  if (!Number.isFinite(a) || a < 2000 || a > 2100) return null;
  try {
    const r = await fetch(`${BASE}/${a}/${p}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;                       // 404 = país não coberto. Isso NÃO é "sem feriado".
    const d = await r.json().catch(() => null);
    if (!Array.isArray(d)) return null;
    return d
      .filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)))
      .map((x) => ({
        date: String(x.date),
        nome: String(x.name || "").slice(0, 80),
        nomeLocal: String(x.localName || x.name || "").slice(0, 80),
      }));
  } catch { return null; }                        // timeout/rede — também é "não sei", não é vazio
}

// Feriados daqui pra frente, atravessando a virada do ano (dezembro não pode enxergar 3 semanas).
export async function feriadosDaqui(pais, hojeISO = null) {
  const hoje = /^\d{4}-\d{2}-\d{2}$/.test(String(hojeISO || "")) ? String(hojeISO)
    : new Date().toISOString().slice(0, 10);
  const ano = parseInt(hoje.slice(0, 4), 10);
  const [a, b] = await Promise.all([feriadosDoAno(pais, ano), feriadosDoAno(pais, ano + 1)]);
  // Se NENHUM dos dois veio, não sei — devolve null. Se só o do ano que vem falhou, o deste ano
  // ainda é uma resposta verdadeira, só mais curta.
  if (a === null && b === null) return null;
  return [...(a || []), ...(b || [])].filter((x) => x.date >= hoje).sort((x, y) => x.date < y.date ? -1 : 1);
}
