// functions/lib/voiceLibrary.js — VOZ NATIVA POR IDIOMA, sem clique de ninguém.
//
// O PROBLEMA QUE ISTO RESOLVE: em 2026-08-05 o Luis ligou pra agente e disse "tá gringo". Estava
// certo: as 22 vozes da conta eram TODAS nativas do inglês. Elas são multilíngues, então falam
// português — com sotaque americano. Nenhum ajuste de texto cura sotaque. Num negócio local, o
// cliente ouve "estrangeiro" nos primeiros três segundos e isso custa a venda.
//
// A saída óbvia seria eu pedir pro Luis abrir a Voice Library e clicar "add to my voices". Eu tentei
// e ele recusou, com razão: trabalho manual meu não vira produto dele. O certo é o provisionamento
// SE CURAR SOZINHO — se o agente precisa de uma voz brasileira e a conta não tem, ele adiciona.
// Cliente novo nasce com voz nativa em todo idioma, para sempre, sem ritual de ninguém.
//
// ── AS TRAVAS ────────────────────────────────────────────────────────────────
//  1. IDEMPOTENTE. Antes de adicionar, olha o que a conta JÁ tem. Rodar mil vezes adiciona zero
//     vozes na segunda em diante — a biblioteca não vira lixão.
//  2. NUNCA DERRUBA A LIGAÇÃO. Toda falha aqui devolve null e o agente segue com a voz padrão.
//     Uma busca de voz que quebra o provisionamento troca um sotaque ruim por um telefone mudo.
//  3. ESCOLHA DETERMINÍSTICA. A voz é escolhida por ordenação estável (mais usada primeiro), não
//     por sorte. O mesmo idioma escolhe a mesma voz hoje e no mês que vem — cliente não acorda com
//     a recepcionista falando com outra voz.
//  4. TETO. No máximo UMA voz adicionada por idioma por chamada.
//  5. `fetch` NÃO LANÇA EM ERRO HTTP. Todo retorno passa por okJson(), que trata !r.ok como falha.
//     Essa foi a mesma confusão que abriu as 4 travas do provisionamento de números.

// Idiomas que queremos com voz NATIVA (não só "multilíngue com sotaque"). A chave é o código
// interno; `lib` é como a biblioteca da ElevenLabs rotula o idioma; `accent` é a marca regional que
// separa "português do Brasil" de "português de Portugal" — a diferença que o Luis ouviu na hora.
// `prefer` = sotaques em ORDEM DE PREFERÊNCIA. O primeiro que aparecer ganha. Para o espanhol isso
// importa muito: a primeira busca trouxe uma voz argentina — nativa, sim, mas de sotaque muito
// marcado para o mercado latino dos EUA, que é majoritariamente mexicano/caribenho. Neutro vende
// em todo lugar; regional vende num lugar e estranha nos outros.
export const NATIVE_VOICE_TARGETS = [
  // PT FIXADO na Nina M. (2026-08-18): o Luis OUVIU as 8 candidatas de estúdio e escolheu. A
  // anterior (Jenifer) tinha eco — e eco não aparece em metadado nenhum, só no ouvido de quem
  // escuta. Voz aprovada por escuta real não volta para sorteio: `pinned` curto-circuita a busca.
  { code: "pt", lib: "pt", pinned: "GM2UA3fbsIaLHcswCDX9", prefer: [/brazil|brasil/i], label: "português brasileiro" },
  // ES FIXADO (2026-08-18): o Luis ouviu e aprovou ("o espanhol está perfeito"). Voz aprovada em
  // ligação real não entra em sorteio nunca mais — subir a política de escolha re-sortearia as
  // DUAS línguas para consertar UMA. `pinned` ganha de qualquer busca.
  { code: "es", lib: "es", pinned: "x5O3bgPT2grYhry6qmWR", prefer: [/neutral|latin/i, /mexic/i, /colomb/i, /peru|chile/i, /argent|castil/i], label: "espanhol latino" },
];

// VERSÃO DA POLÍTICA DE ESCOLHA. Entra no nome da voz adicionada ("Guileo pt v2 · …").
// Por que existe: a função é idempotente — se a conta já tem uma voz do idioma, ela nunca busca de
// novo. Ótimo para não encher a conta de lixo, péssimo quando o CRITÉRIO melhora: a v1 escolheu
// "Earthy and Wise" (madura, séria) porque ordenava por popularidade, e o Luis pediu "som de feliz
// e bem". Subir a versão faz o sistema procurar uma voz melhor UMA vez; as antigas ficam paradas na
// conta sem uso. Suba isto sempre que mudar o critério de escolha.
// v3 (2026-08-18): a v2 escolheu uma brasileira com ECO ("tá ruim" — Luis, em ligação real). O
// critério ganhou QUALIDADE DE ESTÚDIO: vozes `category: "professional"` (gravadas por dublador,
// com controle de captação) vêm antes das clonadas pela comunidade, que é onde mora o eco.
const VOICE_POLICY = "v3";

// O QUE É "SOM DE FELIZ E BEM" — o pedido do Luis, traduzido em palavras que a biblioteca usa para
// descrever voz. Positivo puxa pra cima; negativo puxa pra baixo (uma voz "authoritative" ou
// "serious" é excelente pra documentário e péssima pra recepção de spa).
const WARM = /warm|friendly|cheer|happy|bright|upbeat|pleasant|inviting|gentle|soothing|kind|caring|conversational|natural/i;
const COLD = /authorit|serious|deep|dramatic|intense|narrat|documentar|news|stern|raspy|gritty/i;

async function okJson(promise) {
  try {
    const r = await promise;
    if (!r || !r.ok) return null;      // fetch não lança em 4xx/5xx — checar é obrigatório
    return await r.json().catch(() => null);
  } catch { return null; }
}

const H = (env) => ({ "xi-api-key": env.ELEVENLABS_API_KEY });

// O que a conta JÁ tem. Devolve [] em qualquer falha, para o chamador nunca ter que checar null.
export async function listAccountVoices(env) {
  const d = await okJson(fetch("https://api.elevenlabs.io/v1/voices", { headers: H(env) }));
  return Array.isArray(d?.voices) ? d.voices : [];
}

// Uma voz da conta serve pra este idioma? Só conta se ela DECLARA o idioma — voz sem rótulo é
// tratada como desconhecida, nunca como "deve servir". Chutar aqui é como o sotaque volta.
function accountVoiceFor(voices, target) {
  const tag = `Guileo ${target.code} ${VOICE_POLICY}`;
  const hit = voices.find((v) => {
    const name = (v?.name || "").toString();
    // Uma voz que ESTE código adicionou, sob a política ATUAL. Vozes de uma política antiga não
    // contam: é assim que uma melhoria de critério chega em quem já foi provisionado.
    if (name.startsWith(tag)) return true;
    // Voz que ESTE código adicionou sob uma política ANTERIOR: ignorar. Sem esta linha a v1 continua
    // sendo aceita (o sotaque dela bate com a preferência) e a melhoria de critério nunca chega —
    // foi exatamente o que aconteceu ao subir para a v2: a busca nem rodou.
    if (name.startsWith("Guileo ")) return false;
    const lang = (v?.labels?.language || "").toString().toLowerCase();
    if (lang !== target.lib) return false;
    // Voz que o Luis adicionou à mão no painel: se bate o idioma e o sotaque, respeitamos a escolha
    // dele em vez de sair comprando outra. O dono manda.
    return (target.prefer || []).some((re) => re.test((v?.labels?.accent || "").toString()) || re.test(name));
  });
  return hit?.voice_id || null;
}

// Procura na biblioteca pública. Ordena por uso (cloned_by_count) para pegar a voz que o mercado
// já validou, e desempata pelo voice_id para a escolha ser estável entre execuções.
async function searchShared(env, target) {
  const qs = new URLSearchParams({ page_size: "60", language: target.lib, gender: "female" });
  const d = await okJson(fetch(`https://api.elevenlabs.io/v1/shared-voices?${qs}`, { headers: H(env) }));
  const all = Array.isArray(d?.voices) ? d.voices : [];
  const prefer = target.prefer || [];

  // Índice do sotaque na lista de preferência; -1 = não bate com nenhum.
  const accentRank = (v) => {
    const hay = `${v?.accent || ""} ${v?.name || ""} ${v?.description || ""}`;
    return prefer.findIndex((re) => re.test(hay));
  };
  // Quão "feliz e bem" a voz é descrita. Não é ciência exata — é melhor que ordenar por popularidade,
  // que foi o que trouxe uma voz "Earthy and Wise" pra atender um spa.
  const warmth = (v) => {
    const hay = `${v?.name || ""} ${v?.description || ""} ${(v?.use_cases || []).join(" ")} ${(v?.descriptives || []).join(" ")}`;
    return (WARM.test(hay) ? 1 : 0) - (COLD.test(hay) ? 1 : 0);
  };

  // Sem correspondência de sotaque preferimos NÃO adicionar nada a adicionar um português europeu
  // e chamar de brasileiro. Lista vazia é uma resposta honesta.
  const studio = (v) => (String(v?.category || "") === "professional" ? 1 : 0);
  return all
    .filter((v) => v?.voice_id && v?.public_owner_id && accentRank(v) >= 0)
    .sort((a, b) =>
      accentRank(a) - accentRank(b)                                   // 1º: sotaque preferido
      || studio(b) - studio(a)                                        // 2º: gravação de estúdio (sem eco)
      || warmth(b) - warmth(a)                                        // 3º: som acolhedor
      || (b.cloned_by_count || 0) - (a.cloned_by_count || 0)          // 4º: validada pelo mercado
      || String(a.voice_id).localeCompare(String(b.voice_id)));       // 5º: desempate estável
}

// Garante uma voz nativa para UM idioma. Devolve { voice_id, name, added } ou null.
// `owned` é passado de fora para a lista da conta ser buscada UMA vez, não uma por idioma.
export async function ensureVoiceForLang(env, target, owned) {
  if (!env.ELEVENLABS_API_KEY) return null;
  // Voz APROVADA EM LIGAÇÃO não entra em sorteio: pinned curto-circuita busca e idempotência.
  if (target.pinned) return { voice_id: target.pinned, name: "", added: false };
  const list = owned || (await listAccountVoices(env));
  const existing = accountVoiceFor(list, target);
  if (existing) return { voice_id: existing, name: "", added: false };

  const candidates = await searchShared(env, target);
  const pick = candidates[0];
  if (!pick) return null;                       // nada honesto pra adicionar → segue com a padrão

  // O nome carrega a política, e é por ele que accountVoiceFor reconhece a voz na próxima vez.
  const newName = `Guileo ${target.code} ${VOICE_POLICY} · ${(pick.name || "voz").toString().slice(0, 28)}`.slice(0, 60);
  const added = await okJson(fetch(
    `https://api.elevenlabs.io/v1/voices/add/${encodeURIComponent(pick.public_owner_id)}/${encodeURIComponent(pick.voice_id)}`,
    { method: "POST", headers: { ...H(env), "Content-Type": "application/json" }, body: JSON.stringify({ new_name: newName }) },
  ));
  // A conta pode já ter a voz sob outro nome, ou ter batido no limite do plano. Nos dois casos
  // seguimos sem voz nova em vez de estourar o provisionamento.
  const vid = added?.voice_id || null;
  return vid ? { voice_id: vid, name: newName, added: true } : null;
}

// Mapa { pt: voice_id, es: voice_id } com o que a conta consegue oferecer AGORA. Idioma sem voz
// nativa simplesmente não entra no mapa — o agente usa a voz padrão nele, que é o comportamento
// de hoje, nunca pior.
export async function resolveNativeVoices(env) {
  if (!env.ELEVENLABS_API_KEY) return {};
  let owned = await listAccountVoices(env);
  const out = {};
  for (const t of NATIVE_VOICE_TARGETS) {
    const got = await ensureVoiceForLang(env, t, owned);
    if (!got?.voice_id) continue;
    out[t.code] = got.voice_id;
    // Uma voz recém-adicionada precisa entrar na lista local, senão o próximo idioma volta a
    // consultar uma conta desatualizada e pode adicionar a mesma voz de novo.
    if (got.added) owned = await listAccountVoices(env);
  }
  return out;
}
