// Cloudflare Pages Function — POST /api/auto-topup
//
// A INTENÇÃO DE RECARGA, GRAVADA NO SERVIDOR. ⚠️ CAMINHO DE DINHEIRO.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Até 2026-08-25 o botão "Auto top-up" do cockpit (SettingsView) gravava `gui_payg` SÓ no
// localStorage do navegador — nenhum arquivo em functions/ jamais leu esse valor. O cliente
// ligava, via "Auto top-up on ✓", zerava o crédito no sábado e nada acontecia. Ele tinha certeza
// de ter ligado. Num caminho de dinheiro, promessa sem lastro é a pior classe de defeito.
//
//   POST { email, token|key, action:"get" }                  -> { ok, pronto, enabled, pack }
//   POST { email, token|key, action:"set", enabled, pack? }  -> { ok, pronto, enabled, pack }
//
// ── O QUE ESTE BOTÃO **NÃO** FAZ ─────────────────────────────────────────────────────────────
// Não autoriza a Guileo a passar o cartão sozinha. Cobrança off-session de verdade exige mandato
// salvo (Stripe SetupIntent + payment method off_session, com consentimento explícito e
// registrado) — próximo passo, não este. O que a intenção liga é o AVISO ACIONÁVEL: quando o
// saldo zera, sai um e-mail com o link de pagamento do pacote e o cliente conclui em 1 clique
// (functions/api/credit-alerts.js). O rótulo na tela diz exatamente isso, e nada além disso.
//
// ── ACESSO ───────────────────────────────────────────────────────────────────────────────────
// Portão do TENANT, o mesmo padrão de noshow-radar.js: `get_client_data` liga e-mail ↔ chave de
// conexão. O e-mail AUTENTICADO é o único que segue — nenhum `client_email` do corpo é lido, e
// não existe fallback para OWNER_EMAIL. Sem isso, uma chave qualquer ligaria/desligaria a
// preferência de cobrança de outro negócio.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const PACKS = ["recarga_500", "recarga_1500"];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);
    if (await rateLimited(request, env, "auto-topup", 30)) return json({ ok: false, error: "muitas tentativas" }, 429);

    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ ok: false, error: "unauthorized" }, 401);

    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ ok: false, error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    // A FORMA, não só o status: `get_client_data` responde 200 com corpo de erro quando a chave
    // não casa com o e-mail. Ler só `gd.ok` é a lição "status HTTP não é autenticação".
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ ok: false, error: "unauthorized" }, 401);

    const action = (b.action || "get").toString();
    const ING = env.INGEST_SECRET || "";

    if (action === "get") {
      const r = await svcJson(env, "client_autotopup_get", { p_secret: ING, p_email: email });
      // `pronto:false` = não deu para LER. A tela precisa distinguir isso de "está desligado";
      // desenhar erro como "desligado" é o fallback que esconde erro — e aqui esconderia uma
      // preferência de cobrança que o cliente jura ter ligado.
      if (!r || r.ok !== true) return json({ ok: true, pronto: false, enabled: null, motivo: r?.erro || r?.detalhe || (r?.erro_http ? `RPC indisponível (${r.erro_http})` : "motivo desconhecido") });
      return json({ ok: true, pronto: true, enabled: r.enabled === true, pack: r.pack || "recarga_500" });
    }

    if (action === "set") {
      // `enabled` tem que ser booleano de verdade: `undefined` viraria `false` silenciosamente e
      // DESLIGARIA a preferência de quem só queria trocar de pacote.
      if (typeof b.enabled !== "boolean") return json({ ok: false, error: "enabled deve ser true ou false" }, 400);
      const pack = PACKS.includes((b.pack || "").toString()) ? b.pack.toString() : "recarga_500";
      const r = await svcJson(env, "client_autotopup_set", { p_secret: ING, p_email: email, p_enabled: b.enabled, p_pack: pack });
      // "SALVOU" SÓ COM COMPROVANTE: a rota devolve o estado que o BANCO confirmou, não o que a
      // tela pediu. Sem isso, um erro de RPC viraria um botão verde sobre nada gravado.
      if (!r || r.ok !== true) return json({ ok: false, pronto: false, error: r?.erro || r?.detalhe || (r?.erro_http ? `RPC indisponível (${r.erro_http}) — cole db/auto_topup.sql` : "não consegui salvar") }, 502);
      return json({ ok: true, pronto: true, enabled: r.enabled === true, pack: r.pack || pack });
    }

    return json({ ok: false, error: `ação desconhecida: ${action}` }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
