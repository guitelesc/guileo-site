// ═══════════════════════════════════════════════════════════════════════════════════════════════
// A FICHA DO GOOGLE — a rede de segurança do diagnóstico (2026-08-15)
//
// POR QUE EXISTE: a leitura do site falha às vezes (captcha/Cloudflare/página em JS) e o prospect
// que marcou a demo ficaria sem o presente prometido.
// ⚠️ CORREÇÃO DO PRÓPRIO REGISTRO: escrevi aqui "metade dos sites está atrás de captcha" a partir
// de UMA amostra de 4. Horas depois os mesmos 2 sites leram normalmente — o bloqueio é
// INTERMITENTE, não uma propriedade do site. Vale RETENTAR antes de cair aqui. Uma medição só
// nunca vira taxa, e eu quase transformei quatro leituras em decisão de arquitetura.
//
// O Google Business não tem captcha, e traz três coisas que o SITE quase nunca dá:
//   · horário REAL (o do site costuma estar velho; o do Google o dono atualiza porque o cliente cobra)
//   · nota e QUANTIDADE de avaliações → a ferida "avaliação sem resposta", que é uma das que a Gui fecha
//   · telefone que o Google mostra — que é o número que o mundo REALMENTE disca
//
// ⚠️ INERTE-QUE-ACENDE: sem `GOOGLE_PLACES_KEY` devolve `{ok:false, motivo:"sem chave"}` e o
// diagnóstico segue sem ele. Nada finge funcionar; nada quebra por falta da chave.
//
// ⚠️ CUSTA DINHEIRO POR CHAMADA. Por isso só é chamado quando a leitura do site FALHOU — nunca
// como enfeite em cima de um site que já leu bem. Um fallback que roda sempre não é fallback: é
// uma segunda conta de terceiro que ninguém decidiu contratar.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const CAMPOS = [
  "places.displayName", "places.formattedAddress", "places.internationalPhoneNumber",
  "places.websiteUri", "places.rating", "places.userRatingCount",
  "places.regularOpeningHours.weekdayDescriptions", "places.businessStatus",
  // categoria: o Google já classificou o negócio ("Day spa", "Hair salon"). É ela que define
  // QUEM é concorrente. Sem ela a busca de vizinhos caía no NOME do próprio negócio — ver a
  // nota grande em vizinhos() logo abaixo.
  "places.primaryTypeDisplayName", "places.primaryType",
].join(",");

/**
 * Procura o negócio no Google e devolve a ficha normalizada.
 * `consulta` deve ser o mais específico possível (nome + cidade, ou o domínio).
 * Nunca levanta: qualquer falha vira { ok:false, motivo }.
 */
export async function fichaDoGoogle(env, consulta) {
  const chave = env.GOOGLE_PLACES_KEY || "";
  const q = String(consulta || "").trim().slice(0, 200);
  if (!chave) return { ok: false, motivo: "sem GOOGLE_PLACES_KEY — ficha do Google não consultada" };
  if (!q) return { ok: false, motivo: "consulta vazia" };

  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": chave,
        "X-Goog-FieldMask": CAMPOS,   // cobrado por campo pedido — só o que a análise usa
      },
      body: JSON.stringify({ textQuery: q, maxResultCount: 1 }),
    });
    // ⚠️ fetch NÃO levanta em erro HTTP. Sem o `.ok`, chave inválida viraria "negócio não
    // encontrado" — e a gente diria ao vendedor que o prospect não está no Google, o que é uma
    // acusação sobre o cliente feita a partir de um erro nosso. (Lição do provisionamento.)
    if (!r.ok) return { ok: false, motivo: `Google HTTP ${r.status}`, detalhe: (await r.text().catch(() => "")).slice(0, 160) };

    const d = await r.json().catch(() => ({}));
    const p = Array.isArray(d?.places) ? d.places[0] : null;
    if (!p) return { ok: false, motivo: "negócio não encontrado no Google" };

    const dias = Array.isArray(p?.regularOpeningHours?.weekdayDescriptions) ? p.regularOpeningHours.weekdayDescriptions : [];
    return {
      ok: true, fonte: "google",
      nome: p?.displayName?.text || "",
      endereco: p?.formattedAddress || "",
      telefone: p?.internationalPhoneNumber || "",
      site: p?.websiteUri || "",
      nota: typeof p?.rating === "number" ? p.rating : null,
      avaliacoes: typeof p?.userRatingCount === "number" ? p.userRatingCount : null,
      // O Google escreve "Monday: 9:00 AM – 6:00 PM" por dia — o mesmo formato que o parser de
      // horas já entende. Juntar com " · " mantém uma linha por dia legível na evidência.
      horarios: dias.join(" · "),
      dias_declarados: dias.filter((l) => !/closed|fechado/i.test(l)).length,
      status: p?.businessStatus || "",
      // categoria como o Google a escreve, no idioma da conta ("Day spa"); `tipo` é a chave
      // técnica ("day_spa"), que serve de reserva quando o rótulo não vem.
      categoria: p?.primaryTypeDisplayName?.text || "",
      tipo: p?.primaryType || "",
    };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 120) }; }
}

// ── A FERIDA QUE SÓ O GOOGLE MOSTRA ──────────────────────────────────────────────────────────
// Avaliação é o ativo mais público de um negócio local e o mais abandonado: quase ninguém
// responde. E "responder avaliação" é literalmente uma das coisas que a Gui faz.
// NÃO inventa nada: sem nota ou sem contagem, não nasce achado.
export function achadoDeAvaliacoes(f) {
  if (!f || !f.ok || f.avaliacoes == null) return null;
  const n = f.avaliacoes, nota = f.nota;
  if (n === 0) {
    return {
      id: "sem_avaliacoes", gravidade: "alta",
      titulo: "Nenhuma avaliação no Google",
      evidencia: "Ficha do Google sem nenhuma avaliação registrada.",
      dor: "Quem procura serviço local compara estrelas antes de ligar. Sem nota, o negócio não entra na comparação.",
      gui: "Depois de cada atendimento a agente pede a avaliação — e responde as que chegam.",
    };
  }
  // Poucas avaliações para um negócio local é sinal de que ninguém está pedindo, não de que
  // ninguém gostou. É exatamente o buraco que a Gui fecha, e por isso vira achado.
  if (n < 25) {
    return {
      id: "poucas_avaliacoes", gravidade: "media",
      titulo: `Só ${n} avaliação(ões) no Google${nota != null ? ` (nota ${nota})` : ""}`,
      evidencia: `Ficha do Google: ${n} avaliação(ões)${nota != null ? `, nota ${nota}` : ""}.`,
      dor: "Concorrente com o triplo de avaliações aparece primeiro e ganha a ligação, mesmo atendendo pior.",
      gui: "A agente pede avaliação a cada cliente atendido e responde as que chegam, sem ninguém lembrar.",
    };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O VIZINHO — a comparação que faz dono de negócio local mudar de ideia (2026-08-15)
//
// "Você fecha às 18h" é uma informação. "Seus 3 concorrentes mais próximos atendem depois das
// 18h e você não" é uma AMEAÇA — e é a única frase da análise inteira que sai do plano do
// conselho e entra no plano do medo de perder cliente para quem está na mesma rua.
//
// ⚠️ AS TRÊS TRAVAS DE HONESTIDADE, e elas decidem se a comparação vende ou queima:
//  1. **VIZINHO DE VERDADE**: busca por tipo+localização a partir do endereço DELE. Comparar um
//     spa de Astoria com um de Manhattan é comparação inválida, e o dono percebe na hora.
//  2. **NUNCA CITA NOME**. O relatório diz "3 de 5 concorrentes próximos", não "o Salão X faz".
//     Nomear o vizinho num documento que o prospect pode encaminhar transforma a Guileo em
//     fofoqueira do bairro — e o próximo cliente pergunta o que a gente vai falar DELE por aí.
//  3. **SÓ COMPARA O QUE OS DOIS DECLARAM**. Concorrente sem horário publicado não conta nem a
//     favor nem contra: sai da amostra. Um "3 de 5" com dois chutes dentro é um número falso
//     com cara de pesquisa.
// Amostra pequena demais (< 3 com dado) → não nasce achado. Melhor não dizer que dizer torto.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { horasFechadas } from "./horario.js";

export async function vizinhos(env, { tipo, endereco, excluirNome = "", excluirSite = "", cidade = false }) {
  const chave = env.GOOGLE_PLACES_KEY || "";
  if (!chave) return { ok: false, motivo: "sem GOOGLE_PLACES_KEY" };

  // 🚨 O DEFEITO QUE MATOU A ANÁLISE DE CONCORRENTE (2026-08-19, achado no relatório da Natura).
  // Quem chamava passava `tipo: negocio || perfil.nome`. `negocio` é uma DICA opcional e quase
  // sempre vem vazia — então o `||` trocava, calado, a pergunta inteira: em vez de "quem são os
  // salões perto dela", o Google recebia "Natura Spa | Hair Salon & Spa in New York, NY" e
  // devolvia UM resultado, um xará dela. Um vizinho é menos que o piso de 3, então a comparação
  // de prova social nem nasceu — e nada disso apareceu como erro. É a lição do fallback que
  // esconde o erro: o `||` não falhou, ele respondeu outra pergunta com cara de sucesso.
  // Agora o tipo tem que ser CATEGORIA. Se o que chegou for o próprio nome, recusamos com motivo.
  const cat = String(tipo || "").trim();
  const ehONome = cat && excluirNome && cat.toLowerCase() === String(excluirNome).trim().toLowerCase();
  if (!cat || ehONome) {
    return { ok: false, motivo: "sem a categoria do negócio — buscar vizinho pelo nome dele acha xará, não concorrente" };
  }
  // ⚠️ RUA E NÚMERO ESTREITAM DEMAIS. A 1ª versão buscava "med spa near 1501 South Miami Avenue
  // #201, Miami, FL" e voltou DOIS vizinhos — abaixo do piso de 3, então o achado não nasceu e a
  // comparação morreu sem erro nenhum. O "#201" é ruído: o Google trata como texto da consulta.
  // Cortar até a cidade/estado devolve a vizinhança de verdade, que é o que a comparação quer.
  const local = cidade ? String(endereco || "").split(",").slice(-2).join(",").trim() : endereco;
  const q = `${cat} in ${local || endereco || ""}`.trim().slice(0, 200);
  if (!endereco) return { ok: false, motivo: "sem endereço do prospect — não dá pra achar vizinho de verdade" };

  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "X-Goog-Api-Key": chave,
        // 🚨 TELEFONE E ENDEREÇO ENTRAM NA MÁSCARA (2026-08-20). Esta busca alimenta a FILA DE ATAQUE
        // do vendedor, e uma fila sem telefone é uma lista de leitura: o botão de ligar não tem
        // pra onde apontar. O Google já devolve os dois na MESMA consulta que a gente já paga —
        // pedir depois seria uma segunda chamada cobrada pelo dado que estava na mão.
        // COORDENADA JUNTO (2026-08-21): a fila do vendedor passa a ordenar por DISTÂNCIA — ele
        // trabalha uma rota, não uma lista aleatória. `places.location` vem na MESMA consulta que
        // já pagamos; pedir depois seria pagar duas vezes pelo mesmo fato.
        "X-Goog-FieldMask": "places.displayName,places.rating,places.userRatingCount,places.regularOpeningHours.weekdayDescriptions,places.websiteUri,places.nationalPhoneNumber,places.formattedAddress,places.location",
      },
      body: JSON.stringify({ textQuery: q, maxResultCount: 10 }),
    });
    if (!r.ok) return { ok: false, motivo: `Google HTTP ${r.status}` };
    const d = await r.json().catch(() => ({}));
    // Auto-exclusão: o próprio negócio SEMPRE aparece na busca da própria categoria. Comparar
    // alguém consigo mesmo infla a amostra e mente na mediana. Dois testes EXATOS, nada de
    // adivinhação por semelhança de nome (que cortaria concorrente de verdade): nome normalizado
    // igual, ou MESMO domínio de site — dois endereços do mesmo negócio compartilham o site.
    const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
    const meuNome = norm(excluirNome), meuDominio = dominio(excluirSite);
    const bruta = Array.isArray(d?.places) ? d.places : [];
    const lista = bruta.filter((p) => {
      if (meuNome && norm(p?.displayName?.text) === meuNome) return false;
      if (meuDominio && dominio(p?.websiteUri) === meuDominio) return false;
      return true;
    });
    return { ok: true, lista, consulta: q, brutos: bruta.length };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 120) }; }
}

/** Compara o prospect com os vizinhos. Devolve o achado, ou null se a amostra não sustentar. */
export function achadoDoVizinho(meuHoras, viz, meuAvaliacoes) {
  if (!viz?.ok || !Array.isArray(viz.lista)) return null;
  const out = [];

  // ── HORÁRIO: quem fecha mais tarde que ele ──────────────────────────────────────────────────
  if (meuHoras && meuHoras.fechadas != null) {
    const comHorario = viz.lista
      .map((p) => horasFechadas((p?.regularOpeningHours?.weekdayDescriptions || []).join(" · ")))
      .filter((h) => h && h.fechadas != null);
    if (comHorario.length >= 3) {
      const abertosMais = comHorario.filter((h) => h.fechadas < meuHoras.fechadas).length;
      if (abertosMais >= Math.ceil(comHorario.length / 2)) {
        out.push({
          id: "vizinho_horario", gravidade: "alta",
          titulo: `${abertosMais} de ${comHorario.length} concorrentes próximos ficam disponíveis mais tempo que vocês`,
          evidencia: `Comparação com ${comHorario.length} negócios do mesmo tipo perto do endereço de vocês, pelo horário que cada um publica no Google.`,
          dor: "Na hora em que vocês não atendem, a ligação não some — ela vai para quem atende. E quem atendeu fica com o cliente no mês seguinte também.",
          gui: "A agente cobre exatamente essa janela: atende 24h, marca, e passa pra vocês só o que precisa de gente.",
        });
      }
    }
  }

  // ── AVALIAÇÕES: quem tem mais prova social ──────────────────────────────────────────────────
  if (meuAvaliacoes != null) {
    const com = viz.lista.map((p) => p?.userRatingCount).filter((n) => typeof n === "number");
    if (com.length >= 3) {
      const acima = com.filter((n) => n > meuAvaliacoes).length;
      if (acima >= Math.ceil(com.length / 2)) {
        const mediana = com.slice().sort((a, b) => a - b)[Math.floor(com.length / 2)];
        out.push({
          id: "vizinho_avaliacoes", gravidade: "media",
          titulo: `${acima} de ${com.length} concorrentes próximos têm mais avaliações que vocês`,
          evidencia: `Vocês: ${meuAvaliacoes} avaliações. Mediana dos vizinhos: ${mediana}.`,
          dor: "Quem procura no Google compara estrelas antes de ligar — e a lista já vem ordenada contra quem tem menos.",
          gui: "A agente pede avaliação depois de cada atendimento e responde as que chegam, todo dia, sem ninguém lembrar.",
        });
      }
    }
  }
  return out.length ? out : null;
}
