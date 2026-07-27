# Delivery — conectar os 3 agregadores (restaurante)

A Guileo recebe TODO pedido (Uber Eats + DoorDash + Grubhub + iFood) num lugar só, via um
**agregador**. O endpoint já está pronto e normaliza qualquer um deles:

```
POST https://guileoai.com/api/delivery-webhook?client=<email-do-restaurante>&secret=<DELIVERY_WEBHOOK_SECRET>
```

- `client=` → o email do restaurante (multi-tenant: cada restaurante usa o SEU email).
- `secret=` → um segredo único que VOCÊ gera e põe no Cloudflare como `DELIVERY_WEBHOOK_SECRET`
  (ou mande no header `x-guileo-secret`). Sem ele bater → 401 (ninguém forja pedido).

## Passo único de setup (1 vez)
1. No **Cloudflare Pages → guileoai → Settings → Environment variables (Production)**, crie
   `DELIVERY_WEBHOOK_SECRET` = um valor aleatório forte (ex: 32 chars). Redeploy.
2. Em cada agregador, aponte o **webhook de "novo pedido"** pra URL acima (com o `client` e `secret`).

## Os 3 recomendados

### 1. Otter (TryOtter) — recomendado pra começar
- Mais usado por restaurantes SMB; junta Uber/DoorDash/Grubhub num tablet só.
- Onde: painel Otter → **Integrations / Webhooks** (ou peça ao suporte deles "order webhook").
- Cole a URL. Otter manda cada pedido novo → cai em Live Orders + receita no cockpit.

### 2. Deliverect — pra escala / com PDV
- Robusto, integra com o PDV do restaurante. Tem API + webhooks oficiais.
- Onde: Deliverect → **Settings → Webhooks** → "Order created" → cole a URL.
- Se o Deliverect exigir assinatura própria, me passe o **signing secret** que eu valido.

### 3. Cuboh — pra independentes
- Simples, ótimo pra restaurante único. Webhook de pedido no painel.
- Onde: Cuboh → **Integrations / Developer** → webhook de pedido → cole a URL.

## O que o sistema já faz com cada pedido (automático)
- 🛵 aparece em **Live Orders** do cockpit (junto dos pedidos diretos da Gui)
- 💰 entra no **ledger de receita** (rola tudo num lugar)
- 📥 vira **evento no inbox** + entra no **CRM 360°** do cliente (contato + timeline)
- Detecta a **marketplace real** (Uber/DoorDash/Grubhub/iFood) mesmo quando vem pelo agregador.

## O que eu preciso de você
- Escolha **1 pra começar** (sugiro **Otter**), crie a conta, ligue as plataformas do restaurante nela.
- Gere o `DELIVERY_WEBHOOK_SECRET` no Cloudflare e aponte o webhook do agregador pra URL.
- Se o agregador assinar os webhooks com um segredo próprio, me mande que eu adiciono a verificação
  de assinatura específica dele (hoje a auth é pelo `secret=` compartilhado, que já protege).
