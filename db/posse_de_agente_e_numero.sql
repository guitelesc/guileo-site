-- POSSE ÚNICA DE AGENTE E DE LINHA  (aplicado 2026-08-10)
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- `client_agents` tinha chave única SÓ em `client_email`. Dois clientes podiam reivindicar o
-- mesmo agente ou o mesmo número e o banco não reclamava. Foi exatamente isso em 2026-06:
-- a linha de demonstração da Guileo passou a ser atendida pelo agente do spa da Natura, os três
-- números estavam no mesmo agente, e ninguém foi avisado — o defeito só apareceu quando alguém
-- ligou.
--
-- A varredura de 2026-08-10 não achou duplicata NENHUMA. Estas travas não consertam dado sujo:
-- impedem o dado de sujar. Limpo por sorte volta a sujar — foi o que aconteceu com a page_id do
-- Facebook, achada na mesma auditoria (db/meta_pagina_unica.sql).
--
-- MODELO DO PRODUTO: um agente dedicado por cliente, uma linha por agente. Compartilhar não é
-- cenário legítimo sendo bloqueado — é o defeito virando impossível.
create unique index if not exists client_agents_agent_id_unico
  on public.client_agents (agent_id)          where coalesce(agent_id,'') <> '';
create unique index if not exists client_agents_numero_unico
  on public.client_agents (number)            where coalesce(number,'') <> '';
create unique index if not exists client_agents_el_phone_unico
  on public.client_agents (el_phone_number_id) where coalesce(el_phone_number_id,'') <> '';

-- PROVADO: tentei inserir dois tenants ladrões com o agente e o número da Natura →
-- unique_violation nos dois, 0 intrusos, 4 linhas legítimas intactas.
-- ⚠️ Trocar um cliente de número/agente agora exige LIMPAR o vínculo antigo antes.
