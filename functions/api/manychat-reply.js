// Cloudflare Pages Function — POST /api/manychat-reply
// O MANYCHAT PERGUNTA, O AGENTE DO CLIENTE RESPONDE.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// A ponte que faltava. Já existia `/api/manychat-lead` (ManyChat → nosso funil: captura o lead).
// O que não existia é o caminho de VOLTA: o ManyChat mandar a mensagem da DM e receber, no mesmo
// pedido, o texto que o agente daquele negócio responderia. É isso que transforma o ManyChat de
// "árvore de botões" em atendimento de verdade — os botões continuam para o que é fluxo, e tudo
// que é conversa cai aqui.
//
// Vale para QUALQUER cliente: cada negócio conecta o Instagram/WhatsApp DELE na conta ManyChat
// dele e aponta um External Request para cá com as credenciais DELE. Nada é por conta da Guileo.
//
// ── COMO SE LIGA (no ManyChat) ────────────────────────────────────────────────────────────────
//   Ação: External Request → POST https://guileoai.com/api/manychat-reply
//   Corpo: { "email": "<tenant>", "key": "<chave do cliente>", "text": "{{last_input_text}}",
//            "name": "{{first_name}}", "from": "{{user_id}}", "lang": "pt", "channel": "instagram" }
//   Resposta: { "ok": true, "reply": "..." }  → mapear `reply` para uma variável e enviar.
//
// ── POR QUE NÃO UM SEGREDO ÚNICO DA GUILEO ────────────────────────────────────────────────────
// O `manychat-lead` usa um segredo compartilhado, e ali faz sentido: ele só cria lead. Aqui o
// pedido diz DE QUAL NEGÓCIO é a resposta — com um segredo único, quem tivesse acesso ao ManyChat
// de um cliente poderia pedir a resposta (e os preços, e o KB) de outro. O par e-mail + chave DO
// CLIENTE resolve na raiz: a credencial que vive dentro da ferramenta de terceiro abre exatamente
// um tenant, o dele. Chave vazada aqui = um cliente, nunca a casa.
// (ARQUITETURA.md: "Todo dado/mutação é escopado por client_email. UUID sozinho nunca autoriza.")
import { json, rateLimited } from "../lib/guard.js";
import { handleInboundMessage } from "../lib/messageAdapter.js";
import { emitFailure } from "../lib/failure.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost({ request, env }) {
  try {
    // ⚠️ Sem `sameOrigin`: quem posta aqui é o servidor do ManyChat, não um navegador nosso.
    // O par e-mail + chave faz esse papel. Limite por IP folgado para a ferramenta, apertado
    // para um script — a rota é pública por natureza.
    if (await rateLimited(request, env, "mc-reply", 90, 60)) return json({ ok: false, reply: "", motivo: "muitas mensagens" }, 429);

    const b = await request.json().catch(() => ({}));
    const H = (n) => (request.headers.get(n) || "").toString().trim();

    // ── DUAS FORMAS DE CHAMAR, E POR QUE AS DUAS EXISTEM ──────────────────────────────────────
    // (a) CORPO montado à mão (External Request com JSON próprio).
    // (b) BLOCO DINÂMICO: o corpo é o "Full Contact Data" do ManyChat — o objeto DELE, que a gente
    //     não controla — e a credencial vai no CABEÇALHO. Este é o caminho recomendado, por dois
    //     motivos concretos: o editor de JSON do ManyChat fecha chave sozinho e as variáveis
    //     digitadas à mão não se ligam (deu "JSON inválido" na primeira tentativa); e credencial
    //     em cabeçalho não vaza em log de URL nem em print de tela do corpo.
    // Leitura tolerante do contato, mesma disciplina do /api/manychat-lead: aceito as variações
    // conhecidas e NUNCA invento campo que não veio.
    // 🚨 O CABEÇALHO VENCE O CORPO, e a ordem inversa custou um 401 que o curl nunca reproduziria.
    // O objeto de contato do ManyChat TEM um campo `key` — a chave do INSCRITO dele
    // (`"key":"user:132293861"`) — e também um `email`, o do contato. Lendo `b.key || header`, o
    // dado do terceiro sobrescrevia a credencial do tenant e a autenticação falhava sempre.
    // A regra que fica: **cabeçalho é configuração NOSSA, corpo é dado de TERCEIRO.** Dado de
    // terceiro nunca sobrescreve configuração — nem por engano, nem de propósito (um contato com
    // `key` escolhida por ele seria uma tentativa de falar como outro tenant).
    // Só descoberto porque o teste foi rodado DE DENTRO do ManyChat; meu curl passava porque eu
    // nunca tinha mandado um corpo que contivesse `key`.
    const email = (H("x-guileo-email") || b.email || "").toString().trim().toLowerCase();
    const key = (H("x-guileo-key") || b.key || "").toString().trim();
    const text = (b.text || b.message || b.mensagem || b.last_input_text || "").toString().trim().slice(0, 2000);
    if (!email.includes("@") || !key) return json({ ok: false, reply: "", motivo: "informe email e key do cliente" }, 400);

    // A CHAVE É CONFERIDA CONTRA O BANCO, não contra o formato. `get_client_data` é o mesmo portão
    // que o portal usa — se ela não abre este tenant, não há resposta nenhuma.
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ ok: false, reply: "", motivo: "credencial não confere" }, 401);

    // Mensagem vazia acontece (sticker, reação, áudio ainda não transcrito). Devolver `reply:""`
    // com `ok:true` faria o ManyChat enviar uma bolha em branco para o cliente; melhor dizer que
    // não há o que responder e deixar o fluxo dele decidir.
    if (!text) {
      // ⚠️ A JANELA ANTES DO CONSERTO. Texto vazio é legítimo (sticker, reação, áudio), mas TAMBÉM
      // é o que acontece se o ManyChat mandar o campo com outro nome — e os dois casos produzem o
      // MESMO silêncio na DM. Sem isto, um erro de contrato ficaria invisível exatamente como os
      // 19 dias de WhatsApp respondendo para o vazio. Então, quando a chamada vem autenticada
      // (é o bloco dinâmico configurado, não um curioso), gravamos QUAIS CAMPOS chegaram: na
      // primeira DM real a gente descobre o nome certo em vez de adivinhar.
      try {
        await emitFailure(env, "manychat_sem_texto", email,
          "o ManyChat chamou sem texto — se não for sticker/áudio, o campo da mensagem tem outro nome",
          { campos: Object.keys(b || {}).slice(0, 25) });
      } catch { /* diagnóstico nunca derruba a resposta */ }
      // Sticker, reação, áudio ainda não transcrito. No formato ManyChat devolvemos ZERO mensagens
      // — é o único jeito de não mandar bolha em branco para o cliente.
      if (String(H("x-guileo-formato") || b.formato || "").toLowerCase() === "manychat") return json({ version: "v2", content: { messages: [] } });
      return json({ ok: true, reply: "", vazio: true, motivo: "nada a responder — mensagem sem texto" });
    }

    const r = await handleInboundMessage(env, {
      channel: (b.channel || "instagram").toString().slice(0, 20),
      tenantEmail: email,
      from: (b.from || b.user_id || b.id || b.key || "").toString().slice(0, 80),
      text,
      name: (b.name || b.first_name || "").toString().slice(0, 80),
      // ORDEM DELIBERADA: o idioma DO CONTATO (o ManyChat manda `language`/`locale`) vale mais que
      // o padrão da conta, porque é do cliente e não nosso. O cabeçalho é só a rede — e a regra
      // "a mensagem vence" continua valendo lá dentro, no chatEleven.
      lang: (H("x-guileo-lang") || b.lang || b.language || b.locale || "pt").toString().slice(0, 5),
      meta: { provider: "manychat" },
    });

    // ── DOIS FORMATOS DE RESPOSTA, UMA LÓGICA ────────────────────────────────────────────────
    // `formato:"manychat"` → o corpo que o BLOCO DINÂMICO do ManyChat sabe renderizar sozinho
    // (ele pede o conteúdo ao servidor e desenha a mensagem). É melhor que devolver JSON solto e
    // mapear para variável: um passo a menos no fluxo, e nada de bolha em branco quando a
    // variável não preenche. Qualquer outro valor mantém o JSON simples, para quem usa External
    // Request com mapeamento — os dois caminhos existem e nenhum quebra o outro.
    const paraManychat = String(H("x-guileo-formato") || b.formato || "").toLowerCase() === "manychat";
    const mc = (texto) => json({ version: "v2", content: { messages: texto ? [{ type: "text", text: texto }] : [] } });

    // `ready:false` = o cérebro não conseguiu responder. Dizer isso é obrigatório: um `ok:true`
    // com texto vazio faria o ManyChat mandar silêncio e o cliente concluir que ninguém atende.
    if (!r?.ready || !r?.reply) {
      const motivo = r?.rateLimited ? "muitas mensagens deste contato" : "o cérebro não respondeu — encaminhe para um humano";
      // No formato ManyChat não existe campo de erro: se não houver texto, ele não manda NADA.
      // Então o fracasso vira uma frase humana e honesta, no idioma do contato — silêncio na DM
      // é a pior saída possível, porque o cliente conclui que ninguém atende.
      if (paraManychat) {
        const L = (H("x-guileo-lang") || b.lang || b.language || b.locale || "pt").toString().slice(0, 2);
        return mc({ pt: "Recebi sua mensagem! Já vou te responder por aqui — só um instante. 🌱",
          es: "¡Recibí tu mensaje! Te respondo por aquí en un momento. 🌱" }[L]
          || "Got your message! I'll come back to you right here in a moment. 🌱");
      }
      return json({ ok: false, reply: "", escalar: true, motivo }, 200);
    }
    if (paraManychat) return mc(r.reply);
    return json({ ok: true, reply: r.reply, escalar: !!r.escalate, duplicada: !!r.duplicate });
  } catch (e) {
    return json({ ok: false, reply: "", motivo: String(e).slice(0, 160) }, 200);
  }
}
