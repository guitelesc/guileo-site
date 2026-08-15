-- CONTAS INTERNAS ≠ CLIENTES  (aplicado 2026-08-10)
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- O painel contava toda linha de client_credits como cliente: dizia 6, cliente pagante era 1.
-- Não era sujeira de teste — era a métrica de retenção inteira mentindo 6×, e é dela que sai
-- qualquer decisão de crescimento.
--
-- POR QUE NÃO BASTA APAGAR: sim@guileoai.com alimenta a simulação que roda toda hora,
-- smart@guileoai.com é a linha de demonstração (+1 986 444 3334) e luistelesc@gmail.com é o
-- cliente-MODELO que o vendedor usa para demonstrar. Elas precisam EXISTIR e operar — só não
-- podem contar como cliente.
--
-- POR QUE `internal` FICA VISÍVEL NA RESPOSTA: esconder também é mentir. O dono precisa saber
-- que as contas existem; o que ele não pode é confundi-las com receita.
alter table public.client_credits
  add column if not exists internal boolean not null default false;

comment on column public.client_credits.internal is
  'true = conta da própria Guileo (teste, simulação, demonstração, modelo de vendedor). Existe e opera, mas NUNCA conta como cliente em métrica.';

update public.client_credits set internal = true
where client_email in ('e2e-test@guileoai.com','sim@guileoai.com','smart@guileoai.com',
                       'luistelesc@gmail.com','guileoai@gmail.com');

-- admin_journey: `retention` passa a filtrar `not internal` em todas as contagens, e ganha
-- `internal` ao lado. Ver a função aplicada na migração `tenants_internos`.
-- CLIENTE NOVO NASCE COMO CLIENTE: o default é false, então nenhum cadastro real some por engano.
-- Conta interna nova (outro sandbox, outro modelo) → marcar AQUI, senão ela infla o número.
