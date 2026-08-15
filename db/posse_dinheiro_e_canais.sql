-- POSSE ÚNICA DE DINHEIRO E CANAIS  (aplicado 2026-08-10)
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Última família de "posse ambígua" da auditoria de lançamento. Todos estes campos são mapas
-- ENTRADA → DONO: chega uma cobrança, uma mensagem ou uma ligação e o sistema pergunta "de quem
-- é isto?". Dois clientes reivindicando o mesmo identificador transformam a resposta em sorteio —
-- e sorteio aqui não dá erro, não acende alerta, não aparece em teste.
--
--   stripe_connect.account_id      → para QUAL CONTA BANCÁRIA o dinheiro vai   (0 linhas ao travar)
--   whatsapp_cloud.phone_number_id → de quem é a mensagem que chegou
--   twilio_number.number           → de quem é a ligação que chegou
--
-- POR QUE AGORA: o Stripe estava com a tabela VAZIA. Travar antes do primeiro registro é o momento
-- mais barato que existe — a regra nasce antes do dado, em vez de precisar limpar depois que
-- alguém já recebeu dinheiro do cliente errado.
create unique index if not exists ci_stripe_account_unico
  on public.client_integrations ((tokens->>'account_id'))
  where provider='stripe_connect' and coalesce(tokens->>'account_id','') <> '';

create unique index if not exists ci_whatsapp_phone_unico
  on public.client_integrations ((tokens->>'phone_number_id'))
  where provider='whatsapp_cloud' and coalesce(tokens->>'phone_number_id','') <> '';

create unique index if not exists ci_twilio_numero_unico
  on public.client_integrations ((tokens->>'number'))
  where provider='twilio_number' and coalesce(tokens->>'number','') <> '';

-- PROVADO: dois tenants tentando a mesma conta Stripe → unique_violation; lixo de teste removido.
-- ⚠️ Trocar cliente de conta/número agora exige apagar o vínculo antigo primeiro.
