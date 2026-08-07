-- =============================================================================
-- LIMPEZA DO FEED PÚBLICO /live  —  Luis cola no SQL Editor do Supabase
-- (o Claude não executa DELETE em massa em produção; e está certo assim)
--
-- POR QUE: a página /live é PÚBLICA e mostra "tudo que a Gui faz, ao vivo".
-- Hoje ela está tomada por lixo de teste — 25× "Dhshsshsh Dkskxdd / Xjsnsnsnssn",
-- 47× "Teste Self / Restaurante Teste", "MIGRA TEST (apagar)", vários "QA".
-- Isso é o que um prospect vê. E é o que o revisor da campanha A2P vai ver quando
-- abrir o site pra conferir o opt-in que a gente declarou.
--
-- SEGURANÇA: a cópia integral já existe em `gui_actions_backup_20260804`
-- (134 linhas, criada em 2026-08-04 antes de qualquer remoção).
-- Errou? `insert into gui_actions select * from gui_actions_backup_20260804
--          on conflict (id) do nothing;` traz tudo de volta.
--
-- CRITÉRIO: só sai lixo ÓBVIO (teclado batido, QA, smoke, "apagar" no nome).
-- Nome plausível de pessoa/negócio FICA, mesmo que seja semente — apagar o que
-- talvez seja lead real é pior do que deixar uma linha a mais.
-- =============================================================================

-- 1) CONFIRA ANTES (rode sozinho primeiro e olhe a lista):
select coalesce(nullif(name,''),'(sem nome)') || ' · ' || coalesce(nullif(business,''),'—') as vai_sair,
       action, source, created_at::date
from gui_actions
where name  ~* '(dhsh|xjsn|teste|^test|^qa|migra|joaoooo|cliente plano|^rev$|john d\.|maria s\.|maria silva|smoke|^ping$|nocall|^a$|^b$|^cliente (a|b|venda)$|fndndndn)'
   or business ~* '(xjsn|teste|^test$|guileo test|clínica sorriso|^luos$|^qa$)'
   or source ~* '(migration-verify|^qa$)'
order by created_at desc;

-- 2) APAGUE (só depois de olhar a lista acima):
delete from gui_actions
where name  ~* '(dhsh|xjsn|teste|^test|^qa|migra|joaoooo|cliente plano|^rev$|john d\.|maria s\.|maria silva|smoke|^ping$|nocall|^a$|^b$|^cliente (a|b|venda)$|fndndndn)'
   or business ~* '(xjsn|teste|^test$|guileo test|clínica sorriso|^luos$|^qa$)'
   or source ~* '(migration-verify|^qa$)';

-- 3) CONFIRA DEPOIS (esperado: ~30 linhas, todas com cara de gente de verdade):
select count(*) as sobraram from gui_actions;
select coalesce(nullif(name,''),'(sem nome)') || ' · ' || coalesce(nullif(business,''),'—') as ficou,
       action, created_at::date
from gui_actions order by created_at desc limit 30;
