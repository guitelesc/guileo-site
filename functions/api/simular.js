// Cloudflare Pages Function — POST /api/simular
//
// A JORNADA INTEIRA, DE PONTA A PONTA, EM CIMA DO SISTEMA DE VERDADE.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Um cliente inventado liga, pergunta o cardápio, marca falando, remarca, tenta furar a fila,
// tenta marcar fora do expediente, é cobrado, tenta gastar demais, e cancela. Cada passo bate
// no MESMO endpoint que a agente usa numa ligação real — não há simulação de mentirinha aqui:
// se a simulação passa, aquele caminho funciona; se falha, ele está quebrado agora.
//
// ── POR QUE ISTO EXISTE ──────────────────────────────────────────────────────────────────────
// Todo defeito grave desta plataforma foi encontrado por alguém LIGANDO, nunca lendo código:
//   · a marcação por telefone NUNCA funcionou (Date.parse("amanhã às 9") devolve 2001-09-01);
//   · remarcar mandava a frase falada crua para o banco;
//   · a agente dizia "pronto, agendado" com o identificador vazio.
// Os três estavam em produção, com os testes verdes, porque nenhum teste percorria a jornada
// como um cliente percorre. Este arquivo é a tentativa de parar de depender de sorte.
//
// ── AS TRÊS REGRAS QUE SEGURAM ESTE ARQUIVO ──────────────────────────────────────────────────
//
// 1. NÃO ACEITA "ok". Todo passo exige a PROVA do efeito — o identificador do que foi criado, a
//    vaga que sumiu da agenda, a vaga que voltou depois do cancelamento. "ok" sem identificador
//    é promessa sem lastro, e foi exatamente assim que a agente confirmou agendamentos que não
//    existiam.
//
// 2. RODA NUM NEGÓCIO DE MENTIRA, E SÓ NELE (db/sim_tenant.sql). O tenant é uma CONSTANTE deste
//    arquivo, nunca vem do corpo da requisição. Uma rota que escreve, cancela e cobra e que
//    aceitasse "em qual negócio?" de quem chama não seria um teste — seria uma arma apontada
//    para a agenda dos clientes pagantes.
//
// 3. LIMPA O QUE SUJOU, no `finally`. Um teste que deixa agendamento fantasma na agenda é pior
//    que nenhum teste: da próxima vez o motor recusa por "horário ocupado" e o vermelho é meu.
//
// Nada aqui liga para ninguém, manda mensagem para ninguém ou move dinheiro: os caminhos de
// dinheiro rodam em `dry_run` (decidem sem executar) e os de e-mail com o cabeçalho de teste.
//
// ── ACESSO ───────────────────────────────────────────────────────────────────────────────────
// Mesma porta do /api/prontidao: dono da plataforma, com a chave de conexão conferida no banco.
import { json, isOwnerEmail, sameOrigin, rateLimited } from "../lib/guard.js";
import { faladoComoGente } from "../lib/faladoComoGente.js";
import { appointmentEmail } from "../lib/emailTemplates.js";
import { brandFor } from "../lib/clientBrand.js";

// O NEGÓCIO DE MENTIRA. Constante de propósito — ver regra 2 no cabeçalho.
const TENANT = "sim@guileoai.com";
const TZ = "America/New_York";
const CLIENTE = { nome: "Cliente Simulado", fone: "+15550100777", email: "sim@guileoai.com" };

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "simular", 6)) return json({ error: "muitas tentativas" }, 429);
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.key || "").toString().trim();
    if (!isOwnerEmail(email, env)) return json({ error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    if (!env.AGENT_ACTION_SECRET) return json({ error: "AGENT_ACTION_SECRET ausente — a simulação fala com a agenda pelo mesmo portão da agente" }, 501);

    const origin = new URL(request.url).origin;

    // O servidor chama a si mesmo com o segredo que já tem — nada é exposto para fora.
    // x-guileo-client fixa o tenant do jeito que o provisionamento fixa no agente real.
    // x-guileo-test:1 é o que impede qualquer e-mail de sair de verdade.
    const agenda = (corpo) => fetch(`${origin}/api/agent-schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guileo-secret": env.AGENT_ACTION_SECRET,
        "x-guileo-client": TENANT,
        "x-guileo-test": "1",
      },
      body: JSON.stringify(corpo),
    }).then(async (r) => await r.json().catch(() => ({}))).catch((e) => ({ erro: String(e).slice(0, 120) }));

    const acao = (corpo) => fetch(`${origin}/api/agent-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guileo-secret": env.AGENT_ACTION_SECRET,
        "x-guileo-client": TENANT,
        "x-guileo-test": "1",
      },
      body: JSON.stringify({ dry_run: true, ...corpo }),   // dry_run SEMPRE: decide, não gasta
    }).then(async (r) => await r.json().catch(() => ({}))).catch((e) => ({ erro: String(e).slice(0, 120) }));

    // ── O REGISTRO DE CADA PASSO ──────────────────────────────────────────────────────────────
    // `prova` é o dado bruto que sustenta o veredito. Sem ele o resultado é opinião: quem lê o
    // relatório precisa poder discordar de mim olhando o mesmo número que eu olhei.
    const passos = [];
    // `ok` tem TRÊS valores, não dois: true, false e null = "não deu para provar aqui".
    // Sem o terceiro, uma sonda que não consegue concluir é obrigada a escolher uma cor — e
    // escolhe verde, porque é o que não dá trabalho. Foi assim que a trava de gasto "passou":
    // o tenant de teste não tem Stripe ligado, então ele recusa TUDO, inclusive o absurdo. Verde
    // e vermelho eram os dois falsos ali. O honesto é dizer que o teste não foi feito.
    const registrar = async (nome, oQueDeveriaAcontecer, fn) => {
      try {
        const { ok, prova } = await fn();
        passos.push({ passo: nome, esperado: oQueDeveriaAcontecer, ok: ok === null ? null : !!ok, prova });
      } catch (e) {
        // Um passo que explode é FALHA, nunca silêncio: engolir a exceção transformaria um motor
        // quebrado num passo ausente, e ninguém procura o que não aparece na lista.
        passos.push({ passo: nome, esperado: oQueDeveriaAcontecer, ok: false, prova: `explodiu: ${String(e).slice(0, 160)}` });
      }
    };

    let marcado = null;              // id do agendamento criado — a limpeza precisa dele
    let respostaDaMarcacao = "";     // a frase EXATA que a agente falaria ao confirmar
    const SERVICO = "Corte Simulação";

    try {
      // ── 1. O CARDÁPIO ─────────────────────────────────────────────────────────────────────
      let menu = null;
      await registrar("cardapio", "a agente enxerga os serviços do negócio", async () => {
        menu = await agenda({ op: "lookup" });
        // op:lookup devolve os nomes já como TEXTO (services.map(s => s.name) lá dentro).
        // Eu li `.name` de uma string e recebi undefined — a sonda acusou o motor de vazar
        // tenant quando o motor estava certo. Ler o campo errado é o jeito mais fácil de
        // inventar um defeito que não existe.
        const nomes = (menu.services || []).map((x) => String(x));
        return { ok: nomes.length >= 3, prova: { servicos: nomes.length, nomes: nomes.slice(0, 3) } };
      });

      // ── 2. TEM VAGA? ──────────────────────────────────────────────────────────────────────
      let livres = [];
      await registrar("agenda_tem_vaga", "o motor devolve horários livres de verdade", async () => {
        const av = await agenda({ op: "availability", service: SERVICO });
        livres = av.slots || [];
        return { ok: livres.length > 0, prova: { quantos: livres.length, primeiro: livres[0]?.start || null } };
      });

      const alvo = livres[0]?.start || null;
      const frase = alvo ? faladoComoGente(alvo, TZ) : "";

      // ── 3. MARCAR FALANDO ─────────────────────────────────────────────────────────────────
      // O passo que o bug de 2026-08-07 derrubava. Pede como gente pede.
      await registrar("marcar_falando", "marca de verdade e devolve o IDENTIFICADOR", async () => {
        if (!frase) return { ok: false, prova: "sem horário livre para pedir" };
        const r = await agenda({ op: "book", service: SERVICO, when: frase, name: CLIENTE.nome, contact: CLIENTE.fone, lang: "pt" });
        marcado = r.appointment_id || null;
        respostaDaMarcacao = (r.message || "").toString();
        // A REGRA DE OURO: r.ok não vale nada sozinho. Sem identificador, não houve agendamento.
        return { ok: !!marcado, prova: { pediu: frase, appointment_id: marcado, resposta: (r.message || "").slice(0, 120) } };
      });

      // ── 4. A VAGA SUMIU DA AGENDA ─────────────────────────────────────────────────────────
      // Prova pelo EFEITO, não pela palavra. O passo 3 podia ter mentido; a agenda não mente.
      await registrar("vaga_saiu_da_lista", "o horário marcado não é mais oferecido a outro cliente", async () => {
        const av = await agenda({ op: "availability", service: SERVICO });
        const aindaOferece = (av.slots || []).some((s) => s.start === alvo);
        return { ok: !!marcado && !aindaOferece, prova: { horario: alvo, ainda_oferecido: aindaOferece } };
      });

      // ── 5. NÃO MARCA DOIS NO MESMO HORÁRIO ────────────────────────────────────────────────
      // Numa clínica isto é dois pacientes na mesma cadeira. É o erro mais caro possível.
      await registrar("nao_marca_dois", "o mesmo horário não pode ser vendido duas vezes", async () => {
        const r = await agenda({ op: "book", service: SERVICO, when: frase, name: "Intruso Simulado", contact: "+15550100888", lang: "pt" });
        const segundoId = r.appointment_id || null;
        if (segundoId) marcado = marcado || segundoId;   // se vazou, ainda assim tem que ser limpo
        return { ok: !segundoId, prova: { segundo_id: segundoId, resposta: (r.message || "").slice(0, 120) } };
      });

      // ── 6. FORA DO EXPEDIENTE ─────────────────────────────────────────────────────────────
      // Fecha às 18h. Pedir 23h tem que virar pergunta, nunca agendamento.
      await registrar("recusa_fora_do_expediente", "prefere perguntar a marcar num horário que não existe", async () => {
        const r = await agenda({ op: "book", service: SERVICO, when: "amanha as 23:00", name: "Fora Simulado", contact: "+15550100999", lang: "pt" });
        return { ok: !r.appointment_id, prova: { appointment_id: r.appointment_id || null, resposta: (r.message || "").slice(0, 120) } };
      });

      // ── 7. FRASE SEM DIA NEM HORA ─────────────────────────────────────────────────────────
      // "quero marcar" não pode virar um chute. Ambiguidade vira pergunta.
      await registrar("recusa_frase_vaga", "PERGUNTA o dia em vez de dizer que um horário está ocupado", async () => {
        const r = await agenda({ op: "book", service: SERVICO, when: "quero marcar", name: "Vago Simulado", contact: "+15550100666", lang: "pt" });
        // Recusar não basta: o MOTIVO tem que ser verdade. Dizer "esse horário não está livre"
        // para quem não falou horário nenhum é a Gui inventando um fato para se justificar.
        const msg = (r.message || "").toString();
        const perguntou = /qual dia|que dia|dia e hor/i.test(msg) || r.reason === "sem_horario_pedido";
        return { ok: !r.appointment_id && perguntou, prova: { appointment_id: r.appointment_id || null, motivo: r.reason || null, resposta: msg.slice(0, 140) } };
      });

      // ── 8. REMARCAR FALANDO ───────────────────────────────────────────────────────────────
      // O caminho que mandava a fala crua para o banco. Só o ciclo real pega isto.
      await registrar("remarcar_falando", "move para o horário pedido, não para outro qualquer", async () => {
        if (!marcado) return { ok: false, prova: "nada marcado para remarcar" };
        const av = await agenda({ op: "availability", service: SERVICO });
        const novo = (av.slots || []).find((s) => s.start !== alvo)?.start || null;
        if (!novo) return { ok: false, prova: "não havia um segundo horário livre" };
        const fraseNova = faladoComoGente(novo, TZ);
        const r = await agenda({ op: "reschedule", appointment_id: marcado, when: fraseNova, contact: CLIENTE.fone, lang: "pt" });
        // Confere pelo EFEITO: o horário antigo tem que voltar a ser oferecido e o novo, sumir.
        const dep = await agenda({ op: "availability", service: SERVICO });
        const oferece = (iso) => (dep.slots || []).some((s) => s.start === iso);
        return {
          ok: !!r.ok && oferece(alvo) && !oferece(novo),
          prova: { pediu: fraseNova, voltou_a_oferecer_o_antigo: oferece(alvo), novo_horario_ocupado: !oferece(novo) },
        };
      });

      // ── 8b. A AGENTE FALA A LÍNGUA DE QUEM LIGOU ──────────────────────────────────────────
      // Esta sonda nasceu do resultado da própria simulação: um cliente que ligava em português
      // ouvia "Esse horário não está livre — tenho Sat, Aug 8, 9:30 AM with Ana". Metade da frase
      // em cada idioma. Sem uma sonda fixa aqui, a correção regride na próxima mexida e ninguém
      // percebe — porque nada dá erro; só soa mal, e só para quem não fala inglês.
      await registrar("fala_no_idioma_de_quem_ligou", "nenhum pedaço em inglês numa ligação em português", async () => {
        // Confere as DUAS frases que o cliente mais ouve: as opções e a confirmação. Olhar só uma
        // deu verde com "Your confirmation number is GUI-B0B6" no meio de uma frase em português.
        const av = await agenda({ op: "availability", service: SERVICO, lang: "pt" });
        const conf = marcado
          ? await agenda({ op: "find", contact: CLIENTE.fone, lang: "pt" })
          : { message: "" };
        const frases = [(av.message || "").toString(), (conf.message || "").toString(), (respostaDaMarcacao || "")];
        const suspeitos = [" with ", " at ", "I have", "Which works", "I don't see openings", " AM", " PM",
                           "Your confirmation", "held for", "You'll get", "Anything else", "I found", "Done —"];
        const restos = suspeitos.filter((r) => frases.some((f) => f.includes(r)));
        return { ok: restos.length === 0 && frases.some((f) => f.length > 10), prova: { restos_em_ingles: restos, frases: frases.map((f) => f.slice(0, 110)) } };
      });

      // ── 8c. O INGLÊS NÃO REGREDIU ─────────────────────────────────────────────────────────
      // Traduzir ~20 frases é justamente quando se quebra o idioma que já funcionava — e o inglês
      // é a MAIORIA dos clientes. Uma tabela de idiomas sem sonda no idioma-base é uma armadilha:
      // o erro só aparece numa ligação real, em inglês, semanas depois.
      await registrar("ingles_nao_regrediu", "um cliente em inglês continua ouvindo inglês", async () => {
        const av = await agenda({ op: "availability", service: SERVICO, lang: "en" });
        const msg = (av.message || "").toString();
        const ehIngles = /\bI have\b/.test(msg) && /\bwith\b/.test(msg) && !/tenho|com Ana Simulação/.test(msg);
        return { ok: ehIngles, prova: { frase: msg.slice(0, 150) } };
      });

      // ── 9. COBRANÇA: A DECISÃO, SEM O GASTO ───────────────────────────────────────────────
      await registrar("cobranca_decide", "sabe cobrar o valor do serviço sem precisar executar", async () => {
        const r = await acao({ action: "sale", amount: 60, details: "Corte Simulacao", name: CLIENTE.nome, contact: CLIENTE.fone, lang: "pt" });
        const d = r.decision || {};
        // "veio uma decisão" não é prova de nada — um motor morto que devolve {} passaria. O que
        // dá para afirmar sem Stripe ligado é que ele LEU o valor e sabe dizer se pode cobrar.
        const leuOValor = String(d.amount ?? "") === "60";
        if (!leuOValor) return { ok: false, prova: d };
        if (d.stripe_connected === false) {
          return { ok: null, prova: { motivo: "sem Stripe conectado no tenant de teste, a cobrança real não é exercitável — o que dá para provar é que o valor foi lido corretamente", decisao: d } };
        }
        return { ok: d.chargeable === true || d.can_collect === true, prova: d };
      });

      // ── 10. A TRAVA DE GASTO ──────────────────────────────────────────────────────────────
      // Dinheiro nunca passa sem trava. Um corte de US$ 60 não pode virar uma cobrança de 90 mil.
      await registrar("trava_de_gasto", "RECUSA um valor absurdo — e recusa por causa do VALOR", async () => {
        const r = await acao({ action: "sale", amount: 90000, details: "valor absurdo de proposito", name: CLIENTE.nome, contact: CLIENTE.fone, lang: "pt" });
        const absurdo = r.decision || {};
        // A PERGUNTA CERTA NÃO É "RECUSOU?" — É "RECUSOU POR CAUSA DO VALOR?". Neste tenant o
        // Stripe não está conectado, então ele recusa QUALQUER cobrança, inclusive as legítimas.
        // Só "recusou" daria verde sem a trava existir. Comparo com a decisão do valor pequeno:
        // se as duas forem idênticas, o que recusou foi a falta de Stripe, não a trava — e nesse
        // caso a resposta honesta é "não deu para provar aqui", nunca um verde de cortesia.
        const pequeno = (await acao({ action: "sale", amount: 60, details: "valor normal", name: CLIENTE.nome, contact: CLIENTE.fone, lang: "pt" })).decision || {};
        const iguais = JSON.stringify({ ...absurdo, amount: null }) === JSON.stringify({ ...pequeno, amount: null });
        if (iguais) {
          return { ok: null, prova: { motivo: "o tenant de teste não tem Stripe conectado — ele recusa QUALQUER valor, então este teste não distingue a trava", decisao: absurdo } };
        }
        const bloqueou = absurdo.would_charge === false || absurdo.allowed === false || absurdo.blocked === true || absurdo.needs_human === true;
        return { ok: bloqueou, prova: { decisao_valor_alto: absurdo, decisao_valor_normal: pequeno } };
      });

      // ── 11. O NEGÓCIO DO VIZINHO NÃO VAZA ─────────────────────────────────────────────────
      // O teste multi-tenant que importa: mando no CORPO o e-mail de outro negócio e o cabeçalho
      // do meu. Se o corpo ganhasse, um agente mal configurado (ou um pedido forjado) escreveria
      // na agenda de outro cliente. Tem que continuar sendo o cardápio do negócio de mentira.
      await registrar("tenant_nao_vaza", "o e-mail no corpo NUNCA sobrepõe o negócio do cabeçalho", async () => {
        const r = await agenda({ op: "lookup", client_email: "naturaspaadm@gmail.com", email: "naturaspaadm@gmail.com" });
        const nomes = (r.services || []).map((x) => String(x));
        const ehDoSim = nomes.some((n) => /Simulação/i.test(n));
        const vazou = nomes.some((n) => !/Simulação/i.test(n));
        return { ok: ehDoSim && !vazou, prova: { servicos_devolvidos: nomes.slice(0, 5), vazou_de_outro_negocio: vazou } };
      });

      // ── 12. O E-MAIL SAI COM A MARCA DO CLIENTE ───────────────────────────────────────────
      // Renderiza, não envia. O defeito clássico aqui é o e-mail do cliente sair com a logo da
      // Guileo — o cliente descobre isso pelo cliente DELE, que é o pior lugar para descobrir.
      await registrar("email_com_a_marca_do_cliente", "a confirmação leva o nome do negócio, não o da Guileo", async () => {
        // brandFor devolve `business`, não `name`. Eu li `name`, recebi undefined, e o teste
        // ficou verde mesmo assim — porque o nome do SERVIÇO ("Corte Simulação") também casava
        // com o "Simula" que eu procurava no HTML. Verde pelo motivo errado é pior que vermelho:
        // vermelho manda olhar, verde manda seguir em frente.
        const marca = await brandFor(env, TENANT).catch(() => null);
        const negocio = (marca?.business || "").toString();
        const html = appointmentEmail({
          kind: "book", name: CLIENTE.nome, business: negocio, service: SERVICO,
          whenLabel: frase, lang: "pt", brand: marca,
        });
        const corpo = (html?.html || html || "").toString();
        // Procura um pedaço do nome do NEGÓCIO que NÃO existe no nome do serviço — senão o
        // serviço satisfaz a busca sozinho e a marca nunca é realmente conferida.
        const marcador = "negócio de teste";
        return {
          ok: !!negocio && corpo.length > 200 && corpo.includes(marcador),
          prova: { negocio, bytes: corpo.length, acha_o_nome_do_negocio: corpo.includes(marcador), logo: marca?.origem_logo || null },
        };
      });

      // ── 13. CANCELAR DEVOLVE A VAGA ───────────────────────────────────────────────────────
      // Cancelar sem devolver a vaga é receita perdida em silêncio: o horário fica morto na
      // agenda e ninguém percebe, porque nada dá erro.
      await registrar("cancelar_devolve_a_vaga", "o horário cancelado volta a ser vendável", async () => {
        if (!marcado) return { ok: false, prova: "nada marcado para cancelar" };
        const r = await agenda({ op: "cancel", appointment_id: marcado, contact: CLIENTE.fone, lang: "pt" });
        const av = await agenda({ op: "availability", service: SERVICO });
        const quantos = (av.slots || []).length;
        if (r.ok) marcado = null;   // já cancelado — a limpeza no finally não precisa repetir
        return { ok: !!r.ok && quantos >= livres.length, prova: { cancelou: !!r.ok, vagas_antes: livres.length, vagas_depois: quantos } };
      });
    } finally {
      // ── LIMPEZA ───────────────────────────────────────────────────────────────────────────
      // No `finally` porque um passo que explode no meio é justamente quando o lixo fica para
      // trás. Best-effort: falhar a limpeza não pode apagar o relatório que já foi produzido.
      if (marcado) {
        try { await agenda({ op: "cancel", appointment_id: marcado, contact: CLIENTE.fone }); } catch { /* melhor esforço */ }
      }
      try {
        await fetch(`${origin}/api/agent-schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-guileo-secret": env.AGENT_ACTION_SECRET, "x-guileo-client": TENANT, "x-guileo-test": "1" },
          body: JSON.stringify({ op: "cancel", contact: "+15550100888" }),
        });
      } catch { /* melhor esforço */ }
    }

    const falharam = passos.filter((p) => p.ok === false);
    const naoProvados = passos.filter((p) => p.ok === null);
    return json({
      negocio_de_teste: TENANT,
      passos_totais: passos.length,
      passaram: passos.filter((p) => p.ok === true).length,
      falharam: falharam.map((p) => p.passo),
      // Aparecem SEPARADOS de propósito. Somados aos verdes viravam um número bonito que esconde
      // exatamente o que ninguém conferiu — e é sempre o não-conferido que quebra em produção.
      nao_deu_para_provar: naoProvados.map((p) => p.passo),
      // O veredito é do conjunto: 12 de 13 verdes com o agendamento quebrado é um sistema
      // quebrado. Uma média esconde exatamente o passo que importa.
      veredito: falharam.length ? `${falharam.length} passo(s) quebrado(s)`
        : naoProvados.length ? `jornada funcionando; ${naoProvados.length} passo(s) sem como provar neste ambiente`
        : "jornada inteira funcionando",
      passos,
    });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
}
