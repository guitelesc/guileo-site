import { test } from "node:test";
import assert from "node:assert/strict";
import { assinaturaDoCliente as f } from "./assinaturaDoCliente.js";

const M = { guileo: "membership", client_email: "Spa@Example.com", id: "11111111-2222-3333-4444-555555555555" };

test("cancelamento da assinatura de um cliente do negócio", () => {
  assert.deepEqual(f("customer.subscription.deleted", { id: "sub_abc123", metadata: M }),
    { tenant: "spa@example.com", id: M.id, subId: "sub_abc123", status: "canceled" });
});
test("cartão do cliente falhou: fica em atraso, nas duas formas da fatura", () => {
  assert.equal(f("invoice.payment_failed", { subscription: "sub_x1", subscription_details: { metadata: M } }).status, "past_due");
  const r = f("invoice.payment_failed", { parent: { subscription_details: { subscription: "sub_x2", metadata: M } } });
  assert.equal(r.subId, "sub_x2"); assert.equal(r.status, "past_due");
});
test("assinatura da própria Guileo NÃO é de cliente: segue o caminho antigo", () => {
  assert.equal(f("customer.subscription.deleted", { id: "sub_g", metadata: { plan: "growth" } }), null);
  assert.equal(f("customer.subscription.deleted", { id: "sub_g" }), null);
  assert.equal(f("invoice.payment_failed", { subscription: "sub_g", subscription_details: { metadata: {} } }), null);
  assert.equal(f("invoice.payment_failed", {}), null);
});
test("outros eventos não são tocados", () => {
  assert.equal(f("checkout.session.completed", { metadata: M }), null);
  assert.equal(f("invoice.paid", { subscription: "sub_x", subscription_details: { metadata: M } }), null);
});
test("faltando negócio, mensalidade ou assinatura: não chuta, avisa que está incompleta", () => {
  assert.equal(f("customer.subscription.deleted", { id: "sub_a", metadata: { ...M, id: "nao-e-uuid" } }).incompleta, true);
  assert.equal(f("customer.subscription.deleted", { id: "", metadata: M }).incompleta, true);
  assert.equal(f("customer.subscription.deleted", { id: "sub_a", metadata: { ...M, client_email: "" } }).incompleta, true);
  assert.equal(f("invoice.payment_failed", { subscription_details: { metadata: M } }).incompleta, true);
});
test("assinatura expandida (objeto) também é lida", () => {
  assert.equal(f("invoice.payment_failed", { subscription: { id: "sub_obj9" }, subscription_details: { metadata: M } }).subId, "sub_obj9");
});
