// O CATÁLOGO VIRA CONHECIMENTO DO AGENTE — automaticamente.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ISTO EXISTE (2026-08-25)
// A plataforma tinha DUAS verdades sobre preço: o que o `biz_services` guarda e o que o agente da
// ElevenLabs fala. Na noite de 25/08 elas divergiram na cara do cliente — o agente cotou $149 e a
// nossa própria constituição reprovou a resposta por "preço fora da lista". O conserto de verdade
// não é afrouxar a régua: é fazer as duas contarem a MESMA história, sem ninguém copiar à mão.
//
// ── POR QUE KB E NÃO PROMPT ─────────────────────────────────────────────────────────────────────
// O caminho preguiçoso seria enfiar o catálogo no prompt, como o sync já faz com o menu. Não cabe:
// o prompt do agente de teste já está em 28.637 caracteres, no teto, e um playbook de vertical
// sozinho tem ~20.000. Prompt é o que o agente É; KB é o que ele CONSULTA. Enfiar 20 mil caracteres
// de manual na identidade dele é como decorar o catálogo inteiro para atender uma ligação: enche a
// cabeça e piora a conversa. O KB é buscado por RAG — entra na resposta só quando a pergunta pede.
//
// ── AS TRÊS CAMADAS (desenho do Luis) ───────────────────────────────────────────────────────────
//   1. GUILEO   → o nosso Gui, que precisa saber a companhia inteira.
//   2. VERTICAL → "Gui Spa", "Gui Plumber": o playbook do TIPO de negócio, escrito uma vez e
//                 herdado por todos os clientes daquele ramo (13 playbooks em db/playbooks/).
//   3. CLIENTE  → o catálogo e o FAQ daquele negócio (Lilian herda vertical(spa) + Natura).
// Um documento por camada, com NOME ESTÁVEL — é o nome que torna a operação repetível: rodar de
// novo troca o conteúdo, não empilha cópia.
//
// ⚠️ O RISCO QUE ESTE ARQUIVO TRATA COM PARANOIA: anexar KB é um PATCH no agente. Se a ElevenLabs
// substituir o objeto `prompt` em vez de mesclar, um PATCH que mande só `knowledge_base` APAGA o
// cérebro do agente — o prompt, o KB do cliente, as lições, tudo. Por isso lemos o `prompt` INTEIRO
// e devolvemos ele de volta junto: fica correto tanto se o servidor mesclar quanto se substituir.
// Nunca "otimizar" isso mandando só o campo que mudou.

const API = "https://api.elevenlabs.io";
const H = (env) => ({ "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" });

// ⚠️ O CORPO SÓ PODE SER LIDO UMA VEZ. A 1ª versão fazia `.json()` e depois `.text()` — e o
// `.text()` voltava VAZIO porque o stream já tinha sido consumido. Resultado: "a ElevenLabs recusou
// o PATCH (HTTP 400)" com o detalhe em branco, ou seja, o erro do fornecedor engolido pelo meu
// próprio leitor. Lê texto UMA vez e tenta interpretar depois.
const ler = async (r) => {
  const t = await r.text().catch(() => "");
  let d = null; try { d = t ? JSON.parse(t) : null; } catch { /* resposta não-JSON fica em `t` */ }
  return { ok: r.ok, status: r.status, d, t };
};

// ── acharDoc: existe documento com este nome? ────────────────────────────────────────────────────
// O nome é a chave de idempotência. Sem isto, rodar a sincronia duas vezes cria dois catálogos e o
// agente passa a consultar preço velho e preço novo ao mesmo tempo — pior que não sincronizar.
export async function acharDoc(env, nome) {
  const r = await fetch(`${API}/v1/convai/knowledge-base?page_size=100`, { headers: H(env) });
  const { ok, d, status } = await ler(r);
  if (!ok) return { erro: `não consegui listar o KB (HTTP ${status})` };
  const lista = Array.isArray(d?.documents) ? d.documents : (Array.isArray(d) ? d : []);
  return { doc: lista.find((x) => (x?.name || "") === nome) || null, total: lista.length };
}

// ── kbUpsert: põe o texto no KB com um nome estável ──────────────────────────────────────────────
// ORDEM DELIBERADA: cria o novo ANTES de apagar o velho. Se apagássemos primeiro e a criação
// falhasse, o agente ficaria sem catálogo nenhum — um instante sem preço é pior que um instante com
// preço velho. E o antigo só é removido depois que o novo já está anexado (ver kbSincronizar).
export async function kbUpsert(env, { nome, texto }) {
  if (!env?.ELEVENLABS_API_KEY) return { ok: false, motivo: "ELEVENLABS_API_KEY ausente" };
  const t = (texto || "").toString().trim();
  if (!t) return { ok: false, motivo: "texto vazio — não sincronizo catálogo em branco por cima de um bom" };

  const achou = await acharDoc(env, nome);
  if (achou.erro) return { ok: false, motivo: achou.erro };

  const r = await fetch(`${API}/v1/convai/knowledge-base/text`, {
    method: "POST", headers: H(env), body: JSON.stringify({ name: nome, text: t.slice(0, 100000) }),
  });
  const { ok, d, status, t: erro } = await ler(r);
  if (!ok) return { ok: false, motivo: `a ElevenLabs recusou o documento (HTTP ${status})`, detalhe: (erro || "").slice(0, 400) };
  const id = d?.id || d?.documentation_id || "";
  if (!id) return { ok: false, motivo: "documento criado sem id — não dá para anexar" };
  return { ok: true, id, nome, antigo: achou.doc?.id || null, chars: t.length };
}

export async function kbApagar(env, id) {
  try {
    const r = await fetch(`${API}/v1/convai/knowledge-base/${encodeURIComponent(id)}`, { method: "DELETE", headers: H(env) });
    return { ok: r.ok, status: r.status };
  } catch { return { ok: false }; }
}

// ── kbAnexar: liga os documentos ao agente SEM derrubar nada ─────────────────────────────────────
export async function kbAnexar(env, { agentId, docs = [] }) {
  const g = await fetch(`${API}/v1/convai/agents/${encodeURIComponent(agentId)}`, { headers: H(env) });
  const { ok, d, status } = await ler(g);
  if (!ok) return { ok: false, motivo: `não consegui ler o agente (HTTP ${status})` };

  const prompt = d?.conversation_config?.agent?.prompt;
  // Sem prompt legível, PARA. Escrever por cima do que não se conseguiu ler é como assinar um
  // documento sem abrir — e aqui o que está em jogo é o cérebro inteiro do agente.
  if (!prompt || typeof prompt !== "object") return { ok: false, motivo: "não consegui ler o prompt do agente — não vou escrever por cima às cegas" };

  // ⚠️ ARMADILHA DA API (25/08): o GET devolve `tools` (legado, embutido) E `tool_ids` (novo,
  // por referência). Devolver o prompt inteiro reenvia os dois e a ElevenLabs responde 400
  // "Cannot specify both tools and tool IDs". Ou seja: a leitura fiel do agente é, sozinha, um
  // corpo inválido para escrever de volta — o formato de leitura e o de escrita não são o mesmo.
  // Removemos só o campo LEGADO quando existe o moderno; nada de ferramenta se perde, porque
  // `tool_ids` aponta para as mesmas. E conferimos a contagem depois do PATCH: se as ferramentas
  // sumissem, o agente pararia de agendar e de cobrar — falha silenciosa e cara.
  const pLimpo = { ...prompt };
  if (Array.isArray(pLimpo.tool_ids) && pLimpo.tool_ids.length) delete pLimpo.tools;
  else if (Array.isArray(pLimpo.tools) && pLimpo.tools.length) delete pLimpo.tool_ids;
  const ferramentasAntes = (Array.isArray(prompt.tool_ids) ? prompt.tool_ids.length : 0) || (Array.isArray(prompt.tools) ? prompt.tools.length : 0);

  const atual = Array.isArray(prompt.knowledge_base) ? prompt.knowledge_base : [];
  // Mescla por NOME: o documento novo daquela camada substitui o da mesma camada, e todo o resto
  // (KB que o cliente subiu, outras camadas) fica de pé.
  const nomesNovos = new Set(docs.map((x) => x.nome));
  const mesclado = [
    ...atual.filter((x) => !nomesNovos.has(x?.name || "")),
    ...docs.map((x) => ({ type: "text", id: x.id, name: x.nome, usage_mode: "auto" })),
  ];

  const r = await fetch(`${API}/v1/convai/agents/${encodeURIComponent(agentId)}`, {
    method: "PATCH", headers: H(env),
    // O `prompt` vai INTEIRO de volta (ver o aviso no topo do arquivo). Só o knowledge_base muda.
    body: JSON.stringify({ conversation_config: { agent: { prompt: { ...pLimpo, knowledge_base: mesclado } } } }),
  });
  const v = await ler(r);
  if (!v.ok) return { ok: false, motivo: `a ElevenLabs recusou o PATCH (HTTP ${v.status})`, detalhe: (v.t || "").slice(0, 400) };

  // CONFERE NA FONTE. "200 OK" não é prova de que ficou anexado — já tomei 200 que não mudou nada
  // nesta casa. A verdade é o que o agente devolve depois.
  const c = await ler(await fetch(`${API}/v1/convai/agents/${encodeURIComponent(agentId)}`, { headers: H(env) }));
  const depois = c.d?.conversation_config?.agent?.prompt?.knowledge_base || [];
  const anexados = docs.filter((x) => depois.some((y) => y?.id === x.id));
  const pDepois = c.d?.conversation_config?.agent?.prompt || {};
  const promptIntacto = (pDepois.prompt || "").length;
  const ferramentasDepois = (Array.isArray(pDepois.tool_ids) ? pDepois.tool_ids.length : 0) || (Array.isArray(pDepois.tools) ? pDepois.tools.length : 0);
  return {
    ok: anexados.length === docs.length && ferramentasDepois >= ferramentasAntes && promptIntacto > 0,
    anexados: anexados.map((x) => x.nome),
    kb_total: depois.length,
    prompt_chars: promptIntacto,
    ferramentas: `${ferramentasAntes} → ${ferramentasDepois}`,
    motivo: anexados.length !== docs.length ? "o PATCH passou mas o agente não mostra os documentos" : (ferramentasDepois < ferramentasAntes ? `🚨 PERDEU FERRAMENTA (${ferramentasAntes} → ${ferramentasDepois})` : (promptIntacto ? "" : "🚨 o prompt do agente ficou vazio")),
  };
}

// ── kbSincronizar: a operação inteira, na ordem segura ───────────────────────────────────────────
export async function kbSincronizar(env, { agentId, camadas = [] }) {
  const feitos = [], erros = [];
  for (const c of camadas) {
    const up = await kbUpsert(env, { nome: c.nome, texto: c.texto });
    if (!up.ok) { erros.push(`${c.nome}: ${up.motivo}`); continue; }
    feitos.push(up);
  }
  if (!feitos.length) return { ok: false, motivo: erros.join(" · ") || "nada para sincronizar", erros };

  const anexo = await kbAnexar(env, { agentId, docs: feitos.map((f) => ({ id: f.id, nome: f.nome })) });
  // O documento antigo só morre DEPOIS que o novo está comprovadamente no agente.
  if (anexo.ok) for (const f of feitos) if (f.antigo) await kbApagar(env, f.antigo);

  return {
    ok: anexo.ok, ...anexo,
    camadas: feitos.map((f) => ({ nome: f.nome, chars: f.chars, id: f.id, substituiu: f.antigo || null })),
    erros,
  };
}
