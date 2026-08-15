-- UMA PÁGINA, UM DONO  (aplicado 2026-08-10)
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Achado na auditoria de lançamento: `dr@medmundobr.com` (conta LEGADA — sem agente e que nem
-- cliente é) reivindicava a MESMA page_id da Natura Spa, gravada um dia depois. Enquanto nenhuma
-- das duas tinha token, era inofensivo; no minuto em que um token entrasse, a DM de um cliente
-- real poderia ser roteada para o tenant errado.
--
-- Mesma família do incidente dos números de 2026-06: o vínculo não quebra — a POSSE fica ambígua,
-- e ambiguidade só aparece quando já é prejuízo.
delete from public.client_integrations
where provider = 'meta' and client_email = 'dr@medmundobr.com'
  and tokens->>'page_id' = '1088591857680829';

-- A TRAVA. Corrigir o dado sem fechar a porta só adia o próximo caso — e o próximo teria token.
create unique index if not exists client_integrations_page_id_unico
  on public.client_integrations ((tokens->>'page_id'))
  where provider = 'meta' and coalesce(tokens->>'page_id','') <> '';

-- PROVADO: tentativa de inserir um segundo dono para a mesma página → unique_violation.
-- ⚠️ Consequência para quem conecta: se um cliente trocar de página, APAGUE a linha antiga antes.
