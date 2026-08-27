// ⚠️ ESTE TESTE MORA EM functions/lib/ E NÃO AO LADO DO QUE ELE TESTA — de propósito.
// functions/api/ é o diretório de ROTAS do Cloudflare Pages: todo arquivo ali vira rota e entra no
// bundle do Worker. Um .test.mjs que importa `node:fs` (que não existe no runtime do Workers)
// derruba o bundle, e a rota vizinha passa a devolver 502 do EDGE — sem erro de build, sem erro de
// lint, sem nada no deploy. Foi assim que eu derrubei /api/vitrine-agenda em produção em 27/08.
// Os testes que leem arquivo vivem em functions/lib/ e functions/site/, que não são rotas.
// A ATRIBUIÇÃO DO VENDEDOR NO TRILHO BRASILEIRO — quem recebe a comissão não pode vir do corpo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// O external_reference é "tenant|plano|ref_do_vendedor", e o webhook o parte por "|". A revisão de
// 27/08 achou que /api/pay-link-br limpava o "|" de DUAS das três partes: `planLabel` e `ref`
// passavam por clean(), o `tenant` não — e o regex de e-mail usava [^\s@], que ACEITA pipe.
// Um tenant com pipe desloca o split e entrega ao chamador o controle da 3ª parte: a comissão.
// O arquivo prometia, em comentário, exatamente aquilo que não fazia.
//
// ⚠️ HONESTIDADE SOBRE O ALCANCE DESTE TESTE: hoje nenhum plano tem `amountBRL`, então o webhook
// para em `brl_price_indefinido` ANTES de atribuir vendedor — o trilho está inerte e a falha era
// LATENTE, não explorável. Por isso aqui a mintagem é exercida de verdade (é onde o link forjado
// nasceria, e onde a correção fecha o buraco), e a defesa do lado que RECEBE é travada de forma
// estrutural, com esta nota dizendo o porquê. No dia em que amountBRL for preenchido, transformar
// as duas últimas asserções em chamada real ao webhook é o primeiro passo.
import fs from "node:fs";

let falhas = 0;
const ok = (c, o) => { if (!c) { falhas++; console.log("  ✗ " + o); } else console.log("  ✓ " + o); };

// ── mock de rede: o roster do vendedor responde que ele é real ───────────────────────────────
globalThis.fetch = async (url) => {
  if (String(url).includes("/rpc/seller_auth_check")) {
    return new Response(JSON.stringify({ ok: true, name: "Vendedor Real", ref: "vendedor-real" }), { status: 200 });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

const { onRequestPost } = await import("../api/pay-link-br.js");

const chamar = async (corpo) => {
  const req = new Request("https://guileoai.com/api/pay-link-br", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://guileoai.com" },
    body: JSON.stringify({ seller_email: "vendedor@guileoai.com", seller_code: "X", ...corpo }),
  });
  const res = await onRequestPost({ request: req, env: { INGEST_SECRET: "glo_ing_c7f2a9e4b8d16350", MERCADOPAGO_TOKEN: "TESTE" } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

console.log("\n— MINTAGEM: o pipe não entra mais no external_reference —");
let r = await chamar({ tenant: "cliente|Plano|outro-vendedor@x.com", plan: "starter" });
ok(r.status === 400, "tenant com pipe é RECUSADO (400)");
ok(/\|/.test(r.body.motivo || ""), `o motivo diz qual é o problema: "${(r.body.motivo || "").slice(0, 60)}"`);

r = await chamar({ tenant: "cliente@exemplo.com", plan: "starter" });
ok(r.status !== 400 || !/\|/.test(r.body.motivo || ""), "e-mail normal continua passando pelo portão do tenant");

r = await chamar({ tenant: "não-é-email", plan: "starter" });
ok(r.status === 400 && !/\|/.test(r.body.motivo || ""), "e-mail inválido sem pipe dá o motivo genérico, não o do pipe");

console.log("\n— o regex do tenant não pode voltar a aceitar o separador —");
const mint = fs.readFileSync(new URL("../api/pay-link-br.js", import.meta.url), "utf8");
ok(/const isEmail[^\n]*\[\^\\s@\|\]/.test(mint), "o isEmail exclui `|` explicitamente");
ok(/\$\{tenant\}\|\$\{planLabel\}\|\$\{ref\}/.test(mint), "o formato de 3 partes segue o mesmo (links antigos continuam válidos)");
ok(/const ref = clean\(seller\.ref\)/.test(mint), "o ref continua vindo da AUTH (seller.ref), nunca do corpo");

console.log("\n— RECEBIMENTO: o guarda de defesa em profundidade (trava estrutural, ver nota no topo) —");
const hook = fs.readFileSync(new URL("../api/mercadopago-webhook.js", import.meta.url), "utf8");
ok(/partes\.length > 3 \? "" :/.test(hook), "mais de 3 partes → refSeller vazio: link forjado não atribui comissão a ninguém");
ok(/mp_external_ref_malformado/.test(hook), "e o caso é gritado por emitFailure, não engolido");
ok(/const er = await fetch\("https:\/\/api\.resend\.com\/emails"/.test(hook) && /aviso_comissao_nao_saiu/.test(hook),
   "o e-mail de comissão confere o retorno e registra a falha real");

console.log(falhas ? `\n❌ ${falhas} falha(s)\n` : "\n✅ atribuição BR: o ref não vem do corpo, nem por dentro do tenant\n");
process.exit(falhas ? 1 : 0);
