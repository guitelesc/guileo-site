// Cloudflare Pages Function — POST /api/produtos   (CATÁLOGO DE PRODUTOS · varejo)
// O negócio de serviço que também vende coisa de prateleira (o spa que vende creme e shampoo)
// lista aqui os produtos: nome, marca, preço de venda e, se quiser, estoque. Os dados moram em
// db/produtos.sql (`biz_products` / `biz_product_sales`), atrás de RPCs SECURITY DEFINER com o
// literal INGEST e execução só do service_role.
//
// ESTE ENDPOINT NÃO VENDE. Não há "buy", não há checkout, não há link de pagamento: ele cadastra,
// lista e mostra as vendas que OUTRA peça registrou (product_sale_record). Cobrança é outro motor.
//
// PORTÃO POR TENANT — e-mail + chave de conexão via get_client_data, idêntico a packages.js /
// noshow-radar.js: uma chave nunca toca o catálogo de outro tenant. Sem fallback de OWNER_EMAIL.
// O client_email NUNCA vem do corpo do produto: é sempre o e-mail que passou no portão.
//
//   POST { token, email, action, lang? }          (conta e chave no CORPO — chave nunca em URL)
//     list                 -> { ok, count, products:[…] }      (todos; only_active:true filtra)
//     upsert { product }   -> { ok, product }                   (cria; com product.id, atualiza)
//     delete { id }        -> { ok, deleted }
//     sales                -> { ok, count, sales:[…] }          (últimas 100)
//
// FALHA ≠ VAZIO: leitura que não respondeu devolve { ok:false, code, error } com status de erro —
// nunca uma lista vazia com 200 (a tela diria "nenhum produto" para quem tem a prateleira cheia).
// `error` é a frase para o DONO, no idioma de `lang`; a instrução de engenharia vai em
// `detalhe_tecnico`. Corpo JSON de falha nossa usa 503, nunca 502 (a Cloudflare troca o corpo).
import { json } from "../lib/guard.js";
import { sbKey } from "../lib/sb.js";
import { validarProduto } from "../lib/produtos.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── As frases que o dono lê. Uma por código, três idiomas (hi cai em inglês, como o resto). ──
const FRASES = {
  unauthorized: {
    en: "Your connection code isn't matching — paste it again in Settings.",
    pt: "O seu código de conexão não confere — cole de novo em Configurações.",
    es: "Tu código de conexión no coincide — pégalo de nuevo en Configuración.",
  },
  name_required: { en: "Give the product a name.", pt: "Dê um nome ao produto.", es: "Ponle un nombre al producto." },
  name_too_long: { en: "The name is too long — keep it under 120 characters.", pt: "O nome está longo demais — use até 120 caracteres.", es: "El nombre es demasiado largo — usa hasta 120 caracteres." },
  price_invalid: { en: "Enter a valid price, from 0 to 100,000.", pt: "Informe um preço válido, de 0 a 100.000.", es: "Indica un precio válido, de 0 a 100.000." },
  stock_invalid: { en: "Stock must be a whole number from 0 to 1,000,000 — or leave it empty to not track it.", pt: "O estoque precisa ser um número inteiro de 0 a 1.000.000 — ou deixe vazio para não controlar.", es: "El inventario debe ser un número entero de 0 a 1.000.000 — o déjalo vacío para no controlarlo." },
  brand_too_long: { en: "The brand is too long — keep it under 80 characters.", pt: "A marca está longa demais — use até 80 caracteres.", es: "La marca es demasiado larga — usa hasta 80 caracteres." },
  description_too_long: { en: "The description is too long — keep it under 500 characters.", pt: "A descrição está longa demais — use até 500 caracteres.", es: "La descripción es demasiado larga — usa hasta 500 caracteres." },
  id_invalid: { en: "I couldn't tell which product that is. Reload the page and try again.", pt: "Não consegui identificar esse produto. Recarregue a página e tente de novo.", es: "No pude identificar ese producto. Recarga la página e inténtalo de nuevo." },
  location_invalid: { en: "That location isn't one of yours.", pt: "Essa unidade não é uma das suas.", es: "Esa sede no es una de las tuyas." },
  duplicate_name: { en: "You already have a product with this name.", pt: "Você já tem um produto com esse nome.", es: "Ya tienes un producto con ese nombre." },
  not_found: { en: "That product no longer exists. Reload the page.", pt: "Esse produto não existe mais. Recarregue a página.", es: "Ese producto ya no existe. Recarga la página." },
  already_closed: { en: "That reservation was already closed. Reload the page.", pt: "Essa reserva já foi fechada. Recarregue a página.", es: "Esa reserva ya fue cerrada. Recarga la página." },
  not_ready: { en: "Products aren't switched on for your account yet.", pt: "Os produtos ainda não estão ligados na sua conta.", es: "Los productos aún no están activados en tu cuenta." },
  server: { en: "Our server didn't answer. Try again in a moment.", pt: "O nosso servidor não respondeu. Tente de novo em instantes.", es: "Nuestro servidor no respondió. Inténtalo de nuevo en un momento." },
  unknown_action: { en: "I don't know how to do that here.", pt: "Não sei fazer isso aqui.", es: "No sé hacer eso aquí." },
};
const idioma = (l) => (l === "pt" || l === "es" ? l : "en");
const frase = (code, lang) => (FRASES[code] || FRASES.server)[idioma(lang)];
const STATUS = {
  unauthorized: 401, not_found: 404, duplicate_name: 409, already_closed: 409, not_ready: 503, server: 503, unknown_action: 400,
};
const falha = (code, lang, extra = {}) => json({ ok: false, code, error: frase(code, lang), ...extra }, STATUS[code] || 400);

// O erro que a RPC devolveu → um dos nossos códigos. A função do banco levanta nomes estáveis
// (duplicate_name, not_found, invalid_location…); o PostgREST os entrega em `message`.
function codigoDoBanco(status, corpo) {
  const msg = String((corpo && (corpo.message || corpo.error)) || "").toLowerCase();
  const pg = String((corpo && corpo.code) || "");
  if (msg.includes("duplicate_name") || pg === "23505") return "duplicate_name";
  if (msg.includes("not_found") && pg !== "PGRST202") return "not_found";
  if (msg.includes("invalid_location")) return "location_invalid";
  if (msg.includes("name_required")) return "name_required";
  if (msg.includes("name_too_long")) return "name_too_long";
  if (msg.includes("price_invalid")) return "price_invalid";
  if (msg.includes("stock_invalid")) return "stock_invalid";
  // função ausente (SQL não aplicado) ou sem permissão de execução (service_role ausente no ambiente)
  if (status === 404 || pg === "PGRST202" || pg === "42883" || pg === "42501" || status === 401 || status === 403) return "not_ready";
  return "server";
}

const lerJson = (texto) => { try { return texto ? JSON.parse(texto) : null; } catch { return null; } };

export async function onRequestPost(context) {
  const { request, env } = context;
  let lang = "en";
  try {
    const b = await request.json().catch(() => ({}));
    lang = idioma((b && b.lang) || "");

    // ── PORTÃO POR TENANT (o mesmo de packages.js / noshow-radar.js / coupons.js) ──
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return falha("unauthorized", lang);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return falha("unauthorized", lang);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return falha("unauthorized", lang);

    const secret = env.INGEST_SECRET || "";
    // Chama a RPC e devolve { dados } ou { erro: Response }. Lê o CORPO do banco — `r.ok` sozinho
    // é só "deu 200?", e o motivo de uma recusa (nome duplicado, produto de outro tenant) mora no corpo.
    const chamar = async (name, body) => {
      let r;
      try {
        r = await fetch(`${SB}/rest/v1/rpc/${name}`, {
          method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: secret, p_email: email, ...body }),
        });
      } catch (e) {
        return { erro: falha("server", lang, { detalhe_tecnico: `${name}: ${String(e).slice(0, 140)}` }) };
      }
      const texto = await r.text().catch(() => "");
      const corpo = lerJson(texto);
      if (r.ok) return { dados: corpo };
      const code = codigoDoBanco(r.status, corpo);
      const cru = `${name} HTTP ${r.status}: ${String((corpo && (corpo.message || corpo.code)) || texto).slice(0, 140)}`;
      const tecnico = code === "not_ready"
        ? `${cru} — apply db/produtos.sql and check SUPABASE_SERVICE_ROLE (the RPCs are service_role-only) and INGEST_SECRET.`
        : cru;
      return { erro: falha(code, lang, code === "not_ready" || code === "server" ? { detalhe_tecnico: tecnico } : {}) };
    };

    const action = (b.action || "list").toString();

    // ── LISTAR ───────────────────────────────────────────────────────────────
    if (action === "list") {
      const { dados, erro } = await chamar("product_list", { p_only_active: b.only_active === true });
      if (erro) return erro;
      if (!Array.isArray(dados)) return falha("server", lang, { detalhe_tecnico: "product_list did not return an array" });
      return json({ ok: true, count: dados.length, products: dados });
    }

    // ── CRIAR / ATUALIZAR ────────────────────────────────────────────────────
    if (action === "upsert") {
      const v = validarProduto(b.product);
      if (!v.ok) return falha(v.erro, lang);
      const { dados, erro } = await chamar("product_upsert", { p_product: v.produto });
      if (erro) return erro;
      // SUCESSO PRECISA DE COMPROVANTE: sem a linha gravada de volta (com id), não digo "salvo".
      if (!(dados && typeof dados === "object" && dados.id)) return falha("server", lang, { detalhe_tecnico: "product_upsert returned no row" });
      return json({ ok: true, product: dados });
    }

    // ── APAGAR ───────────────────────────────────────────────────────────────
    if (action === "delete") {
      const id = (b.id || "").toString();
      if (!UUID.test(id)) return falha("id_invalid", lang);
      const { dados, erro } = await chamar("product_delete", { p_id: id });
      if (erro) return erro;
      // false = o id não é deste tenant (ou já foi apagado). Não é sucesso.
      if (dados !== true) return falha("not_found", lang);
      return json({ ok: true, deleted: true });
    }

    // ── VENDAS RECENTES (últimas 100) ────────────────────────────────────────
    if (action === "sales") {
      const { dados, erro } = await chamar("product_sales_list", { p_limit: 100 });
      if (erro) return erro;
      if (!Array.isArray(dados)) return falha("server", lang, { detalhe_tecnico: "product_sales_list did not return an array" });
      return json({ ok: true, count: dados.length, sales: dados });
    }

    // ── FECHAR UMA RESERVA: paga (buscou e pagou) ou cancelada (devolve ao estoque) ──
    if (action === "sale_status") {
      const id = (b.id || "").toString();
      const status = (b.status || "").toString();
      if (!UUID.test(id) || !["paid", "cancelled"].includes(status)) return falha("id_invalid", lang);
      const { dados, erro } = await chamar("product_sale_set_status", { p_sale_id: id, p_status: status });
      if (erro) return erro;
      // comprovante: o banco devolve o status que gravou. `already_closed` = alguém já fechou esta.
      if (!(dados && dados.ok === true && dados.status === status)) {
        return falha(dados && dados.reason === "already_closed" ? "already_closed" : "not_found", lang);
      }
      return json({ ok: true, status: dados.status, stock: dados.stock ?? null });
    }

    return falha("unknown_action", lang);
  } catch (e) {
    return falha("server", lang, { detalhe_tecnico: String(e).slice(0, 160) });
  }
}
