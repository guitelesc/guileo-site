// Cloudflare Pages Function — POST /api/criativo
//
// O KIT DE CAMPANHA: um pedido → o conjunto pronto que o time da Guileo publica de manhã.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// A parte de anunciar que NÃO depende de token, aprovação nem review de plataforma é ESCREVER a
// peça no formato exato de cada canal. É isso que esta rota faz — e ela é honesta sobre o resto:
// nada aqui publica nada. Publicar continua sendo um humano colando no gerenciador, que é
// exatamente o trabalho que a agência já faz.
//
//   POST { email, key, action:"canais" }                                  -> canais suportados + limites + FONTE de cada número
//   POST { email, key, action:"kit", canais:[], objetivo?, publico?, lang? } -> kit completo (peças + público + chamada)
//   POST { email, key, action:"listar", limite? }                         -> kits anteriores deste negócio
//
// ── O QUE ESTA ROTA SE RECUSA A FAZER ────────────────────────────────────────────────────────
// Entregar peça que promete o que o negócio não tem. Depois da IA escrever, uma auditoria
// determinística (auditarFatos) procura desconto, garantia, prazo, preço e "leve 2 pague 1" que
// não estejam nos fatos cadastrados nem no briefing do dono. O que não passa vem marcado
// `bloqueado`, com o motivo, e NÃO entra na conta de peças prontas. Anúncio com promessa
// inventada não é marketing ruim: é o cliente respondendo por propaganda enganosa.
//
// ── ACESSO ───────────────────────────────────────────────────────────────────────────────────
// Portão do TENANT (get_client_data liga e-mail ↔ chave de conexão), igual a /api/ads. O e-mail
// AUTENTICADO é o único que segue — `client_email` no corpo jamais é lido.
import { sellerAuthDB } from "./seller-login.js";
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { gerarKitCampanha, normalizarCanal } from "../lib/criativoAds.js";
import { FORMATOS, CANAIS } from "../lib/criativoFormatos.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// O catálogo que a tela mostra. Sai da MESMA fonte que o medidor usa — se um dia o limite do
// LinkedIn mudar, a tela e a apara mudam juntas. Catálogo escrito à parte vira mentira em duas
// semanas, e é a mentira que o time acredita porque está na tela.
const catalogo = () => CANAIS.map((c) => ({
  canal: c, nome: FORMATOS[c].nome, fonte: FORMATOS[c].fonte,
  campos: FORMATOS[c].campos.map((f) => ({
    campo: f.chave, rotulo: f.rotulo, qtd: f.qtd || 1,
    limite_exibicao: f.alvo,   // onde a plataforma TRUNCA na tela — é por onde escrevemos
    limite_rejeicao: f.duro,   // onde a API REJEITA — só serve de aviso
  })),
}));

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    // Limite mais apertado que o de /api/ads de propósito: cada kit são até 4 canais × 1–2
    // chamadas de modelo. Sem teto, um clique repetido vira conta de IA sem peça a mais.
    if (await rateLimited(request, env, "criativo", 12)) return json({ error: "muitas tentativas" }, 429);

    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.key || b.token || "").toString().trim();
    // ── TRÊS PORTAS, UM MOTOR (2026-08-12) ───────────────────────────────────────────────────
    // Até hoje só o CLIENTE alcançava o criativo, pela chave do cockpit. Mas quem mais precisa
    // dele é o VENDEDOR: num pitch, mostrar o anúncio que faríamos para AQUELE negócio vale mais
    // que qualquer slide. E o prospecto ainda não existe no sistema — não tem e-mail nem chave.
    // Por isso a porta do vendedor/admin aceita `negocio` em texto livre.
    //
    // ⚠️ O QUE SAI POR ESSAS DUAS PORTAS É MARCADO `demonstracao: true`. Uma peça feita a partir de
    // uma descrição solta NÃO tem os preços e serviços reais do negócio por trás — é uma amostra,
    // não o kit dele. Deixar as duas indistinguíveis criaria o pior mal-entendido possível numa
    // venda: o cliente achar que já existe trabalho feito para ele. A honestidade aqui é a mesma
    // do "painel de exemplo" no Pulse.
    const admToken = (b.admin_token || "").toString();
    const vendEmail = (b.seller_email || "").toString().toLowerCase().trim();
    const vendCode = (b.seller_code || "").toString();
    let porta = "cliente", demonstracao = false;

    if (admToken) {
      const a = await svcJson(env, "_admin_ok", { p_token: admToken }).catch(() => null);
      if (a !== true && a?.ok !== true) return json({ ok: false, error: "unauthorized" }, 401);
      porta = "admin"; demonstracao = true;
    } else if (vendEmail && vendCode) {
      // Verificação IMPORTADA de seller-login.js — nunca reescrita aqui (ver a nota lá).
      const v = await sellerAuthDB(env, vendEmail, vendCode).catch(() => null);
      if (!v || v.blocked || !v.roster) return json({ ok: false, error: "unauthorized" }, 401);
      porta = "vendedor"; demonstracao = true;
    } else {
      if (!email.includes("@") || !key) return json({ ok: false, error: "email + key required" }, 400);
      const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
        method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_email: email, p_key: key }),
      });
      // `ok:false` no corpo, além do 401 — a tela carrega com `if (!r || r.ok === false)`, e sem
      // esse campo trataria o corpo de ERRO como dado (sessão caída viraria "nenhuma peça").
      if (!gd.ok) return json({ ok: false, error: "unauthorized" }, 401);
    }

    const action = (b.action || "kit").toString();

    // ── O CATÁLOGO (não custa IA, não custa banco) ────────────────────────────────────────────
    if (action === "canais") return json({ ok: true, canais: catalogo() });

    // ── OS KITS ANTERIORES ────────────────────────────────────────────────────────────────────
    if (action === "listar") {
      if (!env.SUPABASE_SERVICE_ROLE) return json({ ok: true, kits: [], nota: "histórico indisponível: SUPABASE_SERVICE_ROLE não está configurado no Cloudflare (as RPCs do kit são fechadas para anon de propósito)." });
      const r = await svcJson(env, "criativo_kit_list", {
        p_secret: env.INGEST_SECRET || "", p_email: email, p_limit: Math.min(50, Math.max(1, Number(b.limite) || 10)),
      });
      // svcJson devolve o que a FUNÇÃO respondeu (não o "deu 200?" do HTTP) — a armadilha que já
      // deu falso fracasso e falso sucesso no mesmo dia.
      if (!r || r.ok !== true) return json({ ok: true, kits: [], nota: `não consegui ler o histórico: ${r?.erro || r?.detalhe || "motivo desconhecido"}` });
      return json({ ok: true, kits: r.kits || [] });
    }

    // ── O KIT ─────────────────────────────────────────────────────────────────────────────────
    if (action === "kit") {
      const pedidos = Array.isArray(b.canais) && b.canais.length ? b.canais : [b.canal || b.plataforma || "google"];
      const canais = [...new Set(pedidos.map(normalizarCanal))].slice(0, 4);

      const kit = await gerarKitCampanha(env, email, {
        canais, objetivo: b.objetivo, publico: b.publico, lang: b.lang,
      });
      if (!kit) return json({ ok: false, error: "IA não configurada (ANTHROPIC_API_KEY)" }, 501);

      // TODOS os canais falharam = falha de verdade, e ela tem que PARECER falha. Devolver 200 com
      // um kit de peças vazias é o desfecho que faz alguém colar nada no gerenciador.
      const vivas = kit.pecas.filter((p) => !p.erro);
      if (!vivas.length) {
        return json({ ok: false, error: `a IA não escreveu nenhuma peça — ${kit.pecas.map((p) => `${p.canal}: ${p.erro}`).join(" · ")}` }, 503);
      }

      // GUARDAR — e dizer com lastro se guardou. O kit é publicado horas depois, por outra pessoa;
      // sem histórico, quem gerou tem que deixar a aba aberta. Falhar aqui NUNCA derruba a peça
      // que a IA acabou de escrever: o kit vai na resposta de qualquer jeito.
      let salvo = { ok: false, motivo: "não solicitado" };
      if (b.salvar !== false) {
        if (!env.SUPABASE_SERVICE_ROLE) salvo = { ok: false, motivo: "SUPABASE_SERVICE_ROLE não configurado no Cloudflare — o kit não foi gravado no histórico (as RPCs são fechadas para anon de propósito)" };
        else {
          const r = await svcJson(env, "criativo_kit_save", {
            p_secret: env.INGEST_SECRET || "", p_email: email, p_kit: kit,
            p_canais: kit.canais_pedidos, p_idioma: kit.idioma,
            p_objetivo: kit.objetivo || "", p_publico: kit.publico?.publico || "",
            p_prontas: kit.prontas, p_bloqueadas: kit.pecas.filter((p) => p.bloqueado?.length).length,
          });
          // "ok" sem o id do que foi criado é promessa sem lastro.
          salvo = (r && r.ok === true && r.id) ? { ok: true, id: r.id } : { ok: false, motivo: r?.erro || r?.detalhe || "o banco não devolveu id" };
        }
      }

      // A MARCA VAI NA RESPOSTA, não só na variável. Um `demonstracao` que existe no servidor e
      // não chega na tela é honestidade que ninguém vê — e a tela não teria como distinguir a
      // amostra do kit real do cliente. `porta` acompanha para o histórico saber de onde veio.
      return json({ ok: true, ...kit, salvo, demonstracao, porta });
    }

    return json({ ok: false, error: `ação desconhecida: ${action}` }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
