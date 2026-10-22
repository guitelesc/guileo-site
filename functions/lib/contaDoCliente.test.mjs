// O DINHEIRO DO CLIENTE DO CLIENTE vai para a conta DELE — ou a venda não acontece.
import { decidirConta, camposDoDestino, pagamentoDoClienteDoNegocio, paisDoNegocio } from "./contaDoCliente.js";

let falhas = 0, total = 0;
const confere = (nome, cond) => { total++; if (!cond) { falhas++; console.log(`❌ ${nome}`); } };
const OWNER = "smart@guileoai.com";
const ok = { account_id: "acct_1AbCdEfGhIjKlMn", charges_enabled: true };

confere("sem Stripe conectado não vende", decidirConta({ tenant: "spa@x.com", owner: OWNER, stripe: null }).modo === "sem_conta");
confere("linha vazia não vende", decidirConta({ tenant: "spa@x.com", owner: OWNER, stripe: {} }).motivo === "nao_conectado");
confere("cadastro do Stripe pela metade não vende", decidirConta({ tenant: "spa@x.com", owner: OWNER, stripe: { ...ok, charges_enabled: false } }).motivo === "cadastro_incompleto");
confere("charges_enabled em texto não vale como liberado", decidirConta({ tenant: "spa@x.com", owner: OWNER, stripe: { ...ok, charges_enabled: "true" } }).modo === "sem_conta");
confere("id que não é de conta Stripe não vale", decidirConta({ tenant: "spa@x.com", owner: OWNER, stripe: { account_id: "sk_live_x", charges_enabled: true } }).modo === "sem_conta");
const c = decidirConta({ tenant: "Spa@X.com", owner: OWNER, stripe: ok });
confere("conectado e liberado → conta do negócio", c.modo === "conectada" && c.conta === ok.account_id);
confere("a própria Guileo vende na plataforma", decidirConta({ tenant: OWNER, owner: OWNER, stripe: null }).modo === "plataforma");
confere("conta demo vende na plataforma", decidirConta({ tenant: "demo@guileoai.com", owner: OWNER }).modo === "plataforma");
confere("tenant sem e-mail não vende", decidirConta({ tenant: "", owner: OWNER, stripe: ok }).modo === "sem_conta");
confere("owner vazio não transforma ninguém em plataforma", decidirConta({ tenant: "spa@x.com", owner: "", stripe: null }).modo === "sem_conta");

const p = camposDoDestino(c, { cents: 10000, feePct: 0 });
confere("pagamento único: destino e titular na conta do negócio", p["payment_intent_data[transfer_data][destination]"] === ok.account_id && p["payment_intent_data[on_behalf_of]"] === ok.account_id);
confere("sem taxa configurada, nenhuma taxa", !("payment_intent_data[application_fee_amount]" in p));
confere("taxa de 5% sobre $100 = 500 centavos", camposDoDestino(c, { cents: 10000, feePct: 5 })["payment_intent_data[application_fee_amount]"] === "500");
const a = camposDoDestino(c, { assinatura: true, feePct: 5 });
confere("assinatura: os campos vão em subscription_data", a["subscription_data[transfer_data][destination]"] === ok.account_id && a["subscription_data[application_fee_percent]"] === "5" && !("payment_intent_data[transfer_data][destination]" in a));
confere("taxa absurda é limitada a 90%", camposDoDestino(c, { assinatura: true, feePct: 500 })["subscription_data[application_fee_percent]"] === "90");
confere("plataforma não ganha campo de destino", Object.keys(camposDoDestino({ modo: "plataforma" }, { cents: 100 })).length === 0);
confere("sem_conta não ganha campo de destino", Object.keys(camposDoDestino({ modo: "sem_conta" }, { cents: 100 })).length === 0);

// ── de quem é a venda ──
confere("gift card é venda do negócio", pagamentoDoClienteDoNegocio({ guileo: "giftcard" }));
confere("pacote e assinatura também", pagamentoDoClienteDoNegocio({ guileo: "package" }) && pagamentoDoClienteDoNegocio({ guileo: "membership" }));
confere("a etiqueta pode vir da assinatura (renovação)", pagamentoDoClienteDoNegocio({}, { guileo: "membership" }));
confere("recarga e setup da Guileo NÃO são do negócio", !pagamentoDoClienteDoNegocio({ guileo: "topup" }) && !pagamentoDoClienteDoNegocio({ guileo: "setup" }));
confere("pagamento sem etiqueta NÃO é do negócio", !pagamentoDoClienteDoNegocio({}) && !pagamentoDoClienteDoNegocio(null, undefined));

// ── o país da conta ──
confere("spa de Nova York → US", paisDoNegocio({ fusos: ["America/New_York", "America/New_York"] }) === "US");
confere("clínica de Cuiabá → BR", paisDoNegocio({ fusos: ["America/Cuiaba"] }) === "BR");
confere("o cadastro vence o fuso", paisDoNegocio({ perfil: "br", fusos: ["America/New_York"] }) === "BR");
confere("unidades em países diferentes: não adivinha", paisDoNegocio({ fusos: ["America/New_York", "America/Sao_Paulo"] }) === "");
confere("sem nada: não adivinha", paisDoNegocio({}) === "");
confere("+1 sozinho não decide (EUA ou Canadá)", paisDoNegocio({ telefone: "+19298288170" }) === "");
confere("+55 decide Brasil", paisDoNegocio({ telefone: "+5565999990000" }) === "BR");
confere("país inventado é ignorado", paisDoNegocio({ pedido: "ZZ", fusos: ["America/Chicago"] }) === "US");

if (falhas) { console.log(`\n${falhas} errados.`); process.exit(1); }
console.log(`✅ ${total}/${total} — gift card e pacote caem na conta do negócio, ou não são vendidos`);
