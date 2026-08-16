// Cloudflare Pages Function — POST /api/ads
//
// "GASTEI X EM ANÚNCIO. VOLTOU QUANTO?" — a única pergunta que importa, respondida com lastro.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// O Google e a Meta sabem CLIQUES. O dono do negócio sabe FATURAMENTO. Ninguém liga os dois porque
// o elo do meio é o TELEFONE, que nenhuma plataforma de anúncio enxerga. A Guileo é dona desse elo
// — atende, marca e cobra. Por isso ela consegue fechar gasto → lead → ligação → agendamento →
// receita, que é uma conta que o Google não faz nem com todos os dados dele.
//
//   POST { email, key, action:"roi", dias? }                            -> retorno por campanha
//   POST { email, key, action:"gasto", dia, canal, campanha, valor }    -> lança o gasto do dia
//
// ── O QUE ESTA ROTA SE RECUSA A FAZER ────────────────────────────────────────────────────────
// Inventar número. Se o gasto de uma campanha não foi lançado, o retorno vem NULL com o motivo,
// nunca zero. "ROAS 0" e "não sei o gasto" são coisas OPOSTAS, e mostrar a primeira quando a
// verdade é a segunda faz o cliente cortar justamente a campanha que estava dando certo. Num
// painel de anúncio, o número falso não é um detalhe estético — é a decisão errada de onde pôr
// o dinheiro do mês.
//
// ── ACESSO ───────────────────────────────────────────────────────────────────────────────────
// Portão do TENANT (get_client_data liga e-mail ↔ chave de conexão). Cada negócio só enxerga o
// próprio dinheiro. Nunca aceita `client_email` do corpo — o tenant vem do que foi autenticado.
import { json, sameOrigin, rateLimited, isOwnerEmail } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { paraCentavos, moedaNaoDolar } from "../lib/dinheiro.js";
import { gerarCriativoAds } from "../lib/criativoAds.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const dinheiro = (c) => (c == null ? null : `$${(Number(c) / 100).toFixed(2)}`);

// A CONVERSÃO DE DINHEIRO MORA EM functions/lib/dinheiro.js — um lugar só.
//
// Ela morava AQUI, e por isso existiam três regras diferentes para a mesma pergunta ("quanto é
// este texto em centavos?") em três arquivos que decidem dinheiro real. Duas delas estavam
// erradas de formas opostas (ver o cabeçalho de lib/dinheiro.js: "45,00" virava $4.500 na guarda
// de cobrança; "1.240" virava $1,24 no orçamento de campanha). Regra duplicada não fica
// duplicada: fica divergente, e a cópia que ninguém lembra de corrigir é a que decide o dinheiro.
//
// Reexportado para não quebrar quem já importava daqui (functions/lib/dinheiro.test.mjs).
// Export extra é inofensivo numa Pages Function (o runtime só procura onRequest*).
export { paraCentavos };

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "ads", 30)) return json({ error: "muitas tentativas" }, 429);
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.key || b.token || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "email + key required" }, 400);

    // PORTÃO DO TENANT: get_client_data recusa a combinação errada. O e-mail AUTENTICADO é o único
    // que segue para as RPCs — um `client_email` no corpo jamais é lido, senão qualquer cliente
    // veria (e lançaria) o gasto de anúncio de outro.
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    // `ok:false` no corpo, além do 401: a aba de anúncios carrega com `if (!r || r.ok === false)`
    // e, sem esse campo, tratava o corpo de ERRO como dado — "Clientes novos 0", "Custo por cliente
    // —", "nenhuma campanha medida". Chave de conexão expirada fazia o dono concluir que os
    // anúncios dele não deram nada, quando o que aconteceu foi a sessão cair. Recusa tem que
    // parecer recusa. Corrigido 2026-08-11.
    if (!gd.ok) return json({ ok: false, error: "unauthorized" }, 401);

    const action = (b.action || "roi").toString();



    // ── LANÇAR GASTO ──────────────────────────────────────────────────────────────────────────
    if (action === "gasto") {
      // MOEDA QUE NÃO É DÓLAR É RECUSA, não conversão implícita. Todo o resto do motor mede em
      // US$ (preço de serviço, receita, teto de cobrança). "R$ 1.500" gravado como 1500 dólares
      // não dá erro nenhum: dá um retorno ~5× errado, com cara de número certo, e o motor de
      // reinvestimento decide o orçamento do mês em cima dele. Achado 2026-08-11.
      const moeda = moedaNaoDolar(b.valor ?? b.spend ?? b.gasto);
      if (moeda) return json({ ok: false, error: `o valor veio em ${moeda} e o motor mede em US$ — converta antes de lançar (o retorno seria calculado com moedas misturadas)` }, 400);
      const centavos = paraCentavos(b.valor ?? b.spend ?? b.gasto);
      if (centavos == null) return json({ ok: false, error: "valor de gasto ilegível — mande como 1500 ou $1.500,00" }, 400);
      const dia = (b.dia || b.day || "").toString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return json({ ok: false, error: "dia precisa ser AAAA-MM-DD" }, 400);

      const r = await svcJson(env, "ads_spend_set", {
        p_secret: env.INGEST_SECRET || "", p_email: email, p_day: dia,
        p_source: (b.canal || b.source || "outro").toString().slice(0, 40),
        p_campaign: (b.campanha || b.campaign || "").toString().slice(0, 120),
        p_spend_cents: centavos,
        p_clicks: Number(b.cliques ?? b.clicks) || 0,
        p_impressions: Number(b.impressoes ?? b.impressions) || 0,
      });
      // Sem identificador não houve gravação — a regra de ouro, aplicada também aqui.
      if (!r?.ok || !r.id) return json({ ok: false, error: r?.reason || "o banco não confirmou o lançamento" }, 502);
      return json({ ok: true, id: r.id, dia, gasto: dinheiro(centavos) });
    }

    // ── IMPORTAR RELATÓRIO (colar do Google Ads / Meta) ───────────────────────────────────────
    //
    // POR QUE ISTO EXISTE E NÃO A API OFICIAL: a API do Google Ads exige um developer token que o
    // Google aprova em SEMANAS, e a da Meta exige App Review para `ads_read`. Nenhuma das duas
    // fica pronta para um lançamento em 3 dias — e a aprovação não depende de código nenhum.
    //
    // Mas as duas plataformas exportam um relatório em 10 segundos. Colar esse relatório aqui é o
    // que a agência de verdade faz de manhã, e entrega o MESMO dado que a API entregaria.
    //
    // A forma gravada é idêntica à do lançamento manual e à que a API vai preencher um dia:
    // `ads_spend_set` é upsert por (dia, canal, campanha). Então reimportar o mesmo período
    // SUBSTITUI em vez de somar — que é o erro que faz campanha lucrativa parecer perdedora — e
    // no dia em que o token sair, o importador oficial escreve na mesma tabela sem retrabalho.
    if (action === "importar") {
      const texto = (b.texto || b.csv || "").toString().slice(0, 200000);
      if (!texto.trim()) return json({ ok: false, error: "cole o relatório exportado (CSV ou colado da tela)" }, 400);
      const canalPadrao = (b.canal || b.source || "").toString().toLowerCase();

      // Aceita vírgula, ponto-e-vírgula ou TAB — colar da tela do Google gera TAB, o CSV gera
      // vírgula, e o Excel em português gera ponto-e-vírgula. Adivinhar errado perde a planilha.
      const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const separar = (l) => (l.includes("\t") ? l.split("\t") : l.includes(";") ? l.split(";") : l.split(","))
        .map((c) => c.trim().replace(/^"|"$/g, ""));

      // Descobre as colunas pelo CABEÇALHO, em PT e EN. Posição fixa quebraria a cada mudança de
      // layout das plataformas — e quebraria em silêncio, gravando gasto na coluna errada.
      const cab = separar(linhas[0]).map((c) => c.toLowerCase());
      const acha = (...nomes) => cab.findIndex((c) => nomes.some((n) => c.includes(n)));
      const iDia = acha("day", "date", "dia", "data");
      const iCamp = acha("campaign", "campanha");
      const iGasto = acha("cost", "spend", "custo", "gasto", "amount spent", "valor");
      const iCliq = acha("click", "clique");
      const iImp = acha("impr");
      // CANAL POR LINHA, quando o arquivo traz. O importador gravava TUDO no canal do dropdown
      // (default "google"): colar export da Meta sem trocar o select partia a campanha em duas no
      // full outer join do ads_roi — metade com gasto e 0 leads, metade com leads e gasto NULL, e
      // AS DUAS liam como fracasso. Ordem de verdade: coluna da linha > dropdown > assinatura do
      // cabeçalho (só a Meta escreve "amount spent") > "outro". Achado 2026-08-11.
      // "campaign type" / "advertising channel type" são como o EXPORT DO GOOGLE ADS nomeia a
      // coluna que diz Search vs Video — sem elas o gasto de YouTube chega sem canal e cai no
      // dropdown, que é justamente o que acabou de ser separado. Separar no normCanal e não
      // enxergar a coluna que carrega o dado seria meia correção.
      const iCanal = acha("source", "platform", "canal", "plataforma", "publisher", "rede", "network",
        "campaign type", "advertising channel", "tipo de campanha");
      const canalDoCabecalho = cab.some((c) => c.includes("amount spent")) ? "meta" : "";
      const normCanal = (v) => {
        const t = String(v || "").toLowerCase();
        if (/meta|facebook|instagram|fb\b/.test(t)) return "meta";
        // ── YOUTUBE É CANAL PRÓPRIO (2026-08-15) ─────────────────────────────────────────────
        // Estava dobrado dentro de "google", e isso apagava a única comparação que decide onde
        // pôr dinheiro: BUSCA é quem já procura por você (intenção); VÍDEO é quem foi
        // interrompido (interrupção). Custo por agendamento e tempo até fechar são diferentes —
        // somados, o veredito dizia "google deu lucro" e ninguém sabia qual dos dois pagou a
        // conta. O motor CRIATIVO já tratava youtube como formato próprio (criativoFormatos.js):
        // as duas metades da casa discordavam sobre o que é um canal, e a de dinheiro perdia.
        // ⚠️ Vale de agora em diante. Linhas já gravadas como "google" continuam como estão —
        // reclassificar histórico por regex mudaria número que alguém já leu e decidiu em cima.
        if (/youtube|yt\b|video/.test(t)) return "youtube";
        if (/google|adwords|gads|search|sem\b/.test(t)) return "google";
        if (/tiktok/.test(t)) return "tiktok";
        return t.trim().slice(0, 40);
      };
      if (iDia < 0 || iCamp < 0 || iGasto < 0) {
        return json({ ok: false, error: `não achei as colunas obrigatórias no cabeçalho (dia, campanha, custo). Vi: ${cab.slice(0, 8).join(" | ")}` }, 400);
      }

      // TETO DE LINHAS com recibo parcial. Cada linha vira um subrequest sequencial ao banco, e o
      // Cloudflare corta em ~1000 subrequests: uma planilha de 3.000 linhas estourava no meio, o
      // catch externo devolvia 500 e as linhas JÁ GRAVADAS ficavam sem lista do que entrou —
      // o pior estado possível de um importador. Melhor parar cedo, entregar o recibo do que
      // entrou e pedir o resto em outra colada. Achado 2026-08-11.
      const TETO_LINHAS = 800;
      const corpoLinhas = linhas.slice(1);
      const sobraram = Math.max(0, corpoLinhas.length - TETO_LINHAS);

      const gravadas = [], recusadas = [];
      for (const linha of corpoLinhas.slice(0, TETO_LINHAS)) {
        const c = separar(linha);
        const diaBruto = (c[iDia] || "").slice(0, 10);
        // Só data COMPLETA e inequívoca. "05/08" é 5 de agosto ou 8 de maio? Adivinhar aqui
        // desloca o gasto de dia e desalinha a conta inteira — melhor recusar a linha.
        const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaBruto) ? diaBruto : null;
        // MOEDA MISTA É O ERRO SILENCIOSO DESTE IMPORTADOR. O export da Meta de uma conta
        // brasileira traz "R$ 1.234,56" e a coluna se chama "Amount spent" igual à americana.
        // Gravado como 1234.56 DÓLARES, o gasto fica ~5× maior que a realidade, o retorno ~5×
        // menor, e o veredito da campanha inverte — sem nenhum aviso, porque o número é válido.
        // Recusa com o motivo à vista, que é o padrão do resto deste importador.
        const moedaLinha = moedaNaoDolar(c[iGasto]);
        const centavos = moedaLinha ? null : paraCentavos(c[iGasto]);
        const campanha = (c[iCamp] || "").slice(0, 120);
        if (!dia || centavos == null || !campanha) {
          recusadas.push({
            linha: linha.slice(0, 80),
            porque: !dia ? "data precisa ser AAAA-MM-DD"
              : moedaLinha ? `valor em ${moedaLinha} — o motor mede em US$; converta o relatório antes de colar`
                : centavos == null ? "valor ilegível" : "campanha vazia",
          });
          continue;
        }
        const canalLinha = iCanal >= 0 ? normCanal(c[iCanal]) : "";
        const r = await svcJson(env, "ads_spend_set", {
          p_secret: env.INGEST_SECRET || "", p_email: email, p_day: dia,
          p_source: canalLinha || normCanal(canalPadrao) || canalDoCabecalho || "outro",
          p_campaign: campanha, p_spend_cents: centavos,
          p_clicks: iCliq >= 0 ? Number(String(c[iCliq]).replace(/[^0-9]/g, "")) || 0 : 0,
          p_impressions: iImp >= 0 ? Number(String(c[iImp]).replace(/[^0-9]/g, "")) || 0 : 0,
        });
        if (r?.ok && r.id) gravadas.push({ dia, campanha, gasto: dinheiro(centavos) });
        else recusadas.push({ linha: linha.slice(0, 80), porque: r?.reason || "o banco não confirmou" });
      }

      // AS RECUSADAS VÃO JUNTO, com o motivo. Um importador que diz só "42 linhas importadas"
      // esconde as 3 que ficaram de fora — e são justamente as que desequilibram a conta.
      return json({
        ok: true, gravadas: gravadas.length, recusadas: recusadas.length,
        detalhe_recusadas: recusadas.slice(0, 10), exemplos: gravadas.slice(0, 3),
        // O QUE NÃO COUBE VAI DITO. Truncar em silêncio faria o dono achar que importou tudo — e
        // a conta dele fecharia errado sem nenhum aviso.
        nao_processadas: sobraram || undefined,
        nota: sobraram ? `as primeiras ${TETO_LINHAS} linhas foram processadas; ${sobraram} ficaram de fora — cole o restante em outra leva` : undefined,
      });
    }

    // ── APONTAR UM NÚMERO PARA UMA CAMPANHA ───────────────────────────────────────────────────
    // É o que faz a LIGAÇÃO virar atribuição: cada campanha anuncia a sua própria linha, e quem
    // liga já chega identificado. Sem isto, todo cliente que vê o anúncio e LIGA (o caminho
    // principal num negócio local) fica invisível para o relatório de retorno.
    if (action === "numero") {
      const numero = (b.numero || b.number || "").toString().trim();
      if (!numero) return json({ ok: false, error: "informe o número da linha" }, 400);
      const r = await svcJson(env, "ads_number_map", {
        p_secret: env.INGEST_SECRET || "", p_email: email, p_number: numero,
        p_source: (b.canal || "outro").toString().slice(0, 40),
        p_campaign: (b.campanha || "").toString().slice(0, 120),
      });
      if (!r?.ok || !r.id) return json({ ok: false, error: r?.reason || "não consegui apontar o número" }, 502);
      return json({ ok: true, id: r.id, numero, campanha: b.campanha || "(sem campanha)" });
    }

    // ── O VIGIA: o que precisa de AÇÃO agora ──────────────────────────────────────────────────
    // Diferença entre painel e agência: o painel espera você abrir; a agência te avisa. Só o DONO
    // da plataforma vê (é varredura entre clientes) — é o time que age em nome deles.
    if (action === "alertas") {
      // `ok:false` junto do 401: sem ele, qualquer tela que só cheque `if (!r.ok)` lê a recusa
      // como "sucesso com lista vazia" e mostra "nenhuma campanha precisa de ação" para quem na
      // verdade não tinha permissão de olhar. O campo `error` continua igual — acréscimo, não troca.
      if (!isOwnerEmail(email, env)) return json({ ok: false, error: "unauthorized" }, 401);
      const r = await svcJson(env, "ads_alertas", { p_secret: env.INGEST_SECRET || "", p_days: Number(b.dias) || 14 });
      if (!r || r.erro_http) return json({ ok: false, error: "não consegui varrer as campanhas" }, 502);
      const al = r.alertas || [];
      // TRÊS BALDES, não dois. `medir` (db/ads_alertas.sql) é a campanha que trouxe agendamento
      // e nenhum deles tem valor: não dá para dizer se paga. Antes esse caso caía no ramo
      // "gastando mais do que traz" e virava alarme vermelho de PAUSAR uma campanha que estava
      // trazendo cliente. Cair no balde de oportunidade seria o erro oposto — "vale investir
      // mais" numa campanha que ninguém mediu. Cegueira tem balde próprio.
      const porGravidade = (g) => al.filter((a) => a.gravidade === g);
      const semMedicao = porGravidade("medir");
      return json({
        ok: true,
        // Só conta como "precisa de ação" o que TEM veredito. O que falta medir é outra fila.
        precisam_de_acao: al.length - semMedicao.length,
        // Urgente e oportunidade SEPARADOS: misturar faz o time tratar "escalar o que funciona"
        // com a mesma pressa de "está queimando" — e o oposto também, que é pior.
        queimando: porGravidade("alta"),
        oportunidades: porGravidade("oportunidade"),
        sem_medicao: semMedicao,
      });
    }

    // O DISPARO do aviso mora em /api/ads-vigia.js (porta do cron, gated por DIGEST_TOKEN).
    // Duas rotas capazes de mandar o mesmo e-mail em massa seria duas verdades sobre o mesmo
    // disparo — e a que ninguém lembra de manter é a que manda errado. Aqui só se CONSULTA.

    // (Havia aqui uma SEGUNDA cópia idêntica do bloco `alertas`, inalcançável porque o de cima já
    //  retorna. Removida em 2026-08-11. Código morto duplicado é pior que código morto sozinho:
    //  quem for corrigir um comportamento edita uma das cópias, testa, vê o resultado antigo e
    //  conclui que não entendeu o sistema.)

    // ── ONDE O AVISO É DISPARADO (e por que não é aqui) ──────────────────────────────────────
    // Existia aqui um `action:"vigiar"` que varria TODOS os clientes e mandava o e-mail semanal —
    // exatamente o que o comentário logo acima diz que não pode existir duas vezes, e que
    // functions/api/ads-vigia.js já faz. Duas rotas capazes do mesmo disparo em massa não são
    // redundância: são duas verdades sobre o mesmo e-mail, com portões diferentes (esta pedia
    // e-mail de dono; a outra pede DIGEST_TOKEN), e só uma delas tinha `?seco=1` para ensaiar sem
    // mandar e checagem de RESEND_API_KEY. A que ninguém lembra de manter é a que manda errado.
    // Removida em 2026-08-11 — nenhum chamador no repositório inteiro (nem tela, nem cron, nem
    // script). O disparo mora em /api/ads-vigia.js; aqui só se CONSULTA (`action:"alertas"`).

    // ── O CRIATIVO DO ANÚNCIO ─────────────────────────────────────────────────────────────────
    // Mora AQUI, junto do retorno, de propósito: a peça e o resultado dela são a mesma conversa.
    // Quem escreve o anúncio precisa ver, na mesma tela, se o anterior deu cliente ou queimou
    // dinheiro — senão a agência produz criativo no escuro, que é como se paga retainer e não
    // se cresce.
    if (action === "criativo") {
      const r = await gerarCriativoAds(env, email, {
        plataforma: b.plataforma || b.canal, objetivo: b.objetivo, publico: b.publico, lang: b.lang,
      });
      if (!r) return json({ ok: false, error: "IA não configurada (ANTHROPIC_API_KEY)" }, 501);
      if (r.erro) return json({ ok: false, error: r.erro }, 502);
      return json({ ok: true, ...r });
    }

    // ── REINVESTIR — a peça que FECHA O CICLO ─────────────────────────────────────────────────
    // Sem ela o motor era uma linha reta: media o retorno e parava. O dono lia "escalar" e tinha
    // que decidir sozinho quanto, quando e para quem — que é justamente o trabalho que ele nos
    // paga para não fazer.
    //
    // Devolve DUAS coisas, e as duas viram ação no mesmo dia:
    //   1. O ORÇAMENTO NOVO, com a conta à vista. "Escalar" não é instrução; "sobe de $10 para
    //      $15 por dia, porque cada $1 virou $4,20" é.
    //   2. A SEMENTE — quem REALMENTE pagou. É a base do público semelhante da próxima campanha:
    //      em vez de mirar "interesse em spa", mira gente parecida com quem já comprou.
    //      Sai em SHA-256 (o formato que a Meta espera) — a lista de clientes do cliente NUNCA
    //      sai daqui em texto puro. Privacidade e compatibilidade na mesma decisão.
    if (action === "reinvestir") {
      const dias = Math.min(365, Math.max(7, Number(b.dias) || 30));
      const r = await svcJson(env, "ads_roi", { p_secret: env.INGEST_SECRET || "", p_email: email, p_days: dias });
      // `erro_http` e `ok === false`, NÃO `.error`: svcJson nunca devolve `.error` (ver sb.js:38-46)
      // — em falha devolve {ok:false, erro_http, detalhe}. Com a guarda errada, um 401/403/500 do
      // banco passava direto, `r.campanhas` virava [] e a tela do dono dizia "nenhum gasto de
      // anúncio lançado neste período". Erro de permissão apresentado como ausência de resultado:
      // a mesma família que já custou cinco diagnósticos falsos num dia só. Corrigido 2026-08-11.
      if (!r || r.erro_http || r.ok === false) return json({ ok: false, error: `não consegui ler o retorno${r?.erro_http ? ` (http ${r.erro_http})` : ""}` }, 502);
      const campanhas = Array.isArray(r.campanhas) ? r.campanhas : [];

      const decisoes = campanhas.map((c) => {
        // ⚠️ MESMO NOME, DOIS CONTRATOS — armadilha conhecida, documentada em vez de escondida:
        // nas ações `gasto` e `importar`, o campo `gasto` volta como STRING JÁ FORMATADA ("$620.00",
        // via dinheiro()); aqui em `reinvestir` ele é NÚMERO em dólares (620). Quem escrever uma
        // tela nova e assumir um dos dois formatos gera NaN silencioso no outro. Mantido assim
        // porque a tela de anúncios já consome este formato; se algum dia unificar, o certo é
        // `gasto_cents` (número) + `gasto_fmt` (texto) em TODAS as ações, nunca um nome ambíguo.
        const gasto = Number(c.gasto_cents || 0) / 100;
        const receita = Number(c.receita_cents || 0) / 100;
        const leads = Number(c.leads || 0);
        // ORÇAMENTO/DIA: divide pelos dias em que a campanha REALMENTE gastou, não pela janela.
        // Antes era `gasto / dias`, com `dias` = o seletor 7/30/90. Campanha lançada há 5 dias a
        // $60/dia (total $300, janela 30) aparecia como $10/dia — e o motor dizia "sobe de $10 para
        // $15 (+50%)". Quem seguisse CORTAVA 75% do orçamento da melhor campanha lendo na tela que
        // estava escalando. `dias_com_gasto` vem do ads_roi (count distinct day em ad_spend).
        // Fallback para a janela só se o campo não vier — RPC antigo em cache de deploy.
        const diasReais = Number(c.dias_com_gasto || 0) || dias;
        const dia = gasto > 0 ? gasto / diasReais : 0;
        // `receita_base` viaja junto com a decisão: 'recebido' = dinheiro que entrou; 'tabela' =
        // preço de tabela do serviço (ESTIMATIVA); 'misto' = parte de cada. Decidir orçamento com
        // estimativa é legítimo — decidir sem saber que é estimativa, não. O rótulo é a diferença
        // entre um número e um número honesto.
        const base = { campanha: c.campanha, fonte: c.fonte, gasto, receita, leads,
                       receita_base: c.receita_base || null,
                       orcamento_dia_atual: dia ? Number(dia.toFixed(2)) : null };
        // MESMA REGRA DE AMOSTRA DO VEREDITO: mandar mexer em dinheiro com 1 lead é chute com o
        // dinheiro do cliente. Sem lastro, a resposta é "não mexe" — e o motivo vai junto.
        if (!gasto) return { ...base, acao: "sem_dados", porque: "nenhum gasto lançado nesta campanha" };
        if (leads < 3) return { ...base, acao: "nao_mexer", porque: `só ${leads} lead(s) — amostra pequena demais para decidir com o dinheiro dele` };

        // ── CEGO NÃO É RUIM ──────────────────────────────────────────────────────────────────
        // A campanha trouxe agendamento, mas nenhum deles tem valor: serviço sem preço cadastrado
        // e cobrança que não passou pela Gui. Receita lê 0, retorno lê 0 — e a regra de baixo
        // mandaria CORTAR o orçamento de uma campanha que está trazendo cliente.
        // Zero por falta de medição não é zero por falta de resultado. Aqui o motor admite que
        // está cego e diz o que destrava a medição, em vez de disfarçar a cegueira de veredito.
        const semValor = Number(c.agendamentos_sem_valor || 0);
        if (receita === 0 && semValor > 0) {
          return { ...base, acao: "nao_mexer", agendamentos_sem_valor: semValor,
                   porque: `trouxe ${semValor} agendamento(s), mas nenhum com valor — não dá para medir retorno. Cadastre o preço do serviço ou registre a cobrança pela Gui e este número passa a decidir sozinho` };
        }

        const retorno = gasto > 0 ? receita / gasto : 0;
        const r2 = Number(retorno.toFixed(2));
        if (retorno >= 3) {
          // +50% por vez, nunca dobrar: plataforma de anúncio reaprende a cada mudança grande e
          // a campanha que estava boa entra em aprendizado de novo — subir devagar preserva o que
          // já funciona.
          const novo = Number((dia * 1.5).toFixed(2));
          return { ...base, retorno: r2, acao: "subir", orcamento_dia_novo: novo,
                   porque: `cada $1 virou $${r2} — sobe de $${dia.toFixed(2)} para $${novo} por dia (+50%, nunca o dobro: mudança grande joga a campanha de volta no aprendizado)` };
        }
        if (retorno >= 1) return { ...base, retorno: r2, acao: "manter",
                   porque: `cada $1 virou $${r2} — paga, mas não o bastante para escalar. Mantém e observa mais uma semana` };
        // corta pela METADE, não zera: matar em seco perde o aprendizado acumulado da campanha.
        const novo = Number((dia / 2).toFixed(2));
        return { ...base, retorno: r2, acao: "reduzir", orcamento_dia_novo: novo,
                 porque: `cada $1 virou só $${r2} — corta de $${dia.toFixed(2)} para $${novo} por dia. Metade, não zero: matar em seco joga fora o aprendizado da conta` };
      });

      // A SEMENTE: quem pagou de verdade, em hash. `ads_semente` devolve os contatos com
      // agendamento não-cancelado no período, já normalizados.
      let semente = { pessoas: 0, hashes: [], nota: null };
      try {
        const sr = await svcJson(env, "ads_semente", { p_secret: env.INGEST_SECRET || "", p_email: email, p_days: dias });
        if (sr && Array.isArray(sr.contatos)) {
          // NORMALIZAÇÃO ANTES DO HASH — era só trim/lowercase/sem-espaço, então "(929) 535-0191"
          // virava "(929)535-0191" e o hash não casava com NADA do outro lado. Upload passa, taxa
          // de match ~0, e a verba é gasta num público que não existe. Achado 2026-08-11.
          //
          // ⚠️ META E GOOGLE PEDEM COISAS DIFERENTES para telefone, e por isso saem DOIS conjuntos:
          //   · Meta Custom Audience → só DÍGITOS com código de país, sem "+" e sem símbolos;
          //   · Google Customer Match → E.164, que INCLUI o "+".
          // Um hash serve a uma e não à outra. O texto antigo dizia "o formato que as duas esperam"
          // — falso para metade dos casos. E-mail é igual nos dois (minúsculo, sem espaço).
          const enc = new TextEncoder();
          const sha = async (txt) => {
            const buf = await crypto.subtle.digest("SHA-256", enc.encode(txt));
            return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
          };
          const meta = [], google = [];
          let ignorados = 0;
          for (const c of sr.contatos.slice(0, 5000)) {
            const cru = String(c || "").trim();
            if (!cru) continue;
            if (cru.includes("@")) {                       // e-mail: as duas plataformas concordam
              const em = cru.toLowerCase().replace(/\s+/g, "");
              const h = await sha(em);
              meta.push(h); google.push(h);
              continue;
            }
            const digitos = cru.replace(/\D/g, "");
            // Telefone curto demais não é telefone — hash de lixo suja o público e não avisa.
            if (digitos.length < 8) { ignorados++; continue; }
            meta.push(await sha(digitos));
            google.push(await sha(`+${digitos}`));
          }
          semente = {
            pessoas: meta.length,
            hashes: meta,            // compatibilidade: quem já lia `hashes` continua lendo o da Meta
            hashes_meta: meta,
            hashes_google: google,
            ignorados: ignorados || undefined,
            nota: [
              meta.length < 20 ? "menos de 20 pessoas — a Meta costuma exigir ~100 para criar público semelhante; use como base e deixe crescer" : null,
              ignorados ? `${ignorados} contato(s) sem telefone válido ficaram de fora` : null,
            ].filter(Boolean).join(" · ") || null,
          };
        } else semente.nota = "sem lastro para semente (aplique db/ads_semente.sql?)";
      } catch { semente.nota = "não consegui montar a semente"; }

      return json({ ok: true, dias, decisoes, semente,
        como_usar: "1) ajuste o orçamento diário conforme `acao`. 2) suba `semente.hashes_meta` como Custom Audience (Meta) e `semente.hashes_google` como Customer Match (Google) — são conjuntos DIFERENTES porque a Meta hasheia só dígitos e o Google hasheia E.164 com '+'. 3) crie um público semelhante a partir da audiência." });
    }

    // ── O RETORNO ─────────────────────────────────────────────────────────────────────────────
    const dias = Math.min(365, Math.max(1, Number(b.dias) || 30));
    const r = await svcJson(env, "ads_roi", { p_secret: env.INGEST_SECRET || "", p_email: email, p_days: dias });
    // Mesma correção da guarda acima: svcJson sinaliza falha em `erro_http`/`ok:false`, nunca em
    // `.error`. Ver a explicação completa por volta da linha 313.
    if (!r || r.erro_http || r.ok === false) return json({ ok: false, error: `não consegui ler o retorno${r?.erro_http ? ` (http ${r.erro_http})` : ""}` }, 502);

    const campanhas = (r.campanhas || []).map((c) => ({
      canal: c.canal, campanha: c.campanha,
      gasto: dinheiro(c.gasto_cents), receita: dinheiro(c.receita_cents),
      leads: c.leads, agendamentos: c.agendamentos,
      custo_por_lead: dinheiro(c.custo_por_lead_cents),
      custo_por_cliente: dinheiro(c.custo_por_cliente_cents),
      // `retorno` é "para cada $1 gasto, voltaram $X". NULL quando não dá para saber — e o
      // motivo vai junto, para a tela não precisar inventar uma explicação.
      retorno: c.retorno == null ? null : Number(c.retorno),
      porque_sem_retorno: c.porque_sem_retorno,
      // O VEREDITO EM UMA PALAVRA — e a regra que impede o pior conselho possível.
      //
      // MATEMÁTICA NÃO É CONSELHO. Uma campanha lançada ontem tem receita 0, logo retorno 0, logo
      // "corta" — e mandar o cliente matar uma campanha antes dela ter tido chance é o erro mais
      // caro que uma agência comete. Foi exatamente o que esta linha fez no primeiro teste: $450
      // lançados às 9h e veredito "corta" às 9h01.
      //
      // Então o veredito exige AMOSTRA: sem gasto não há veredito; com gasto mas sem tráfego ou
      // sem lead ainda, o veredito é "cedo demais" — que é a verdade, e é acionável (esperar).
      veredito: (() => {
        if (c.retorno == null) return "sem_dados";
        const cliques = Number(c.cliques || 0), leads = Number(c.leads || 0);
        if (leads === 0 && cliques < 50) return "cedo_demais";
        if (leads === 0) return "sem_lead_apesar_do_trafego";   // tráfego chegou e ninguém converteu → é a PÁGINA, não o anúncio
        if (leads < 3) return "cedo_demais";                     // 1-2 leads não decidem nada
        const r = Number(c.retorno);
        return r >= 3 ? "escalar" : r >= 1 ? "mantem" : "corta";
      })(),
    }));

    // O total só é comparável quando existe gasto dos dois lados; senão o "retorno geral" some.
    const totalGasto = Number(r.total_gasto_cents || 0);
    const totalReceita = (r.campanhas || []).reduce((s, c) => s + Number(c.receita_cents || 0), 0);

    return json({
      ok: true,
      periodo_dias: dias,
      resumo: {
        gasto: dinheiro(totalGasto),
        receita_atribuida: dinheiro(totalReceita),
        leads: r.total_leads || 0,
        retorno_geral: totalGasto > 0 ? Number((totalReceita / totalGasto).toFixed(2)) : null,
        // A frase que o dono do negócio lê primeiro. Sem gasto lançado ela DIZ isso, em vez de
        // mostrar um zero que ele interpretaria como "o anúncio não deu nada".
        leitura: totalGasto === 0
          ? "nenhum gasto de anúncio lançado neste período — sem isso não dá para dizer se voltou"
          : totalReceita === 0
            ? "gasto lançado, mas nenhuma receita atribuída ainda — os leads podem não ter fechado ou a origem não está chegando"
            : `para cada $1 investido, voltaram $${(totalReceita / totalGasto).toFixed(2)} em serviços agendados`,
      },
      campanhas,
    });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
}
