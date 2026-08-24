-- GUILEO · CAMPOS CUSTOMIZÁVEIS DO CRM — já aplicado em 2026-08-22 (migração
-- `crm_campos_customizaveis` + `crm_campos_rpcs`). Este arquivo é a fonte reproduzível.
--
-- POR QUE ASSIM: definição do campo numa tabela POR TENANT + valor num jsonb no contato.
-- Coluna nova por campo seria DDL em produção a cada clique do cliente — risco de downtime
-- (lei nº 8). O Twenty resolve isso com um metaschema inteiro; aqui uma tabela + um jsonb dão
-- o mesmo resultado sem sair do Supabase e sem partir o dado em dois bancos.
--
-- O QUE FOI PROVADO ANTES DE SUBIR (ida-e-volta no SQL, não build verde):
--   número inválido → RECUSADO (não vira 0)      · campo não definido → recusado
--   tipo inválido   → recusado                    · vazio → APAGA a chave (não guarda "")
--   Natura definiu a MESMA chave e tentou escrever no contato do sim → `contato_nao_encontrado`,
--   e o valor do sim continuou 7. Multi-tenant provado, não suposto.

alter table crm_contacts add column if not exists custom jsonb not null default '{}'::jsonb;

create table if not exists crm_custom_fields (
  client_email text not null,
  key          text not null,
  label        text not null,
  kind         text not null default 'text',   -- text | number | date | bool | select
  options      jsonb not null default '[]'::jsonb,
  ord          integer not null default 0,
  created_at   timestamptz not null default now(),
  primary key (client_email, key)
);
create index if not exists crm_custom_fields_tenant on crm_custom_fields(client_email, ord);

-- As 3 RPCs (crm_fields_list, crm_field_set, crm_contact_custom_set) estão na migração
-- `crm_campos_rpcs`. Regras que elas nunca quebram:
--   · portão: p_secret = INGEST_SECRET, e a escrita casa `client_email` (lei nº 7)
--   · devolvem O QUE FICOU, nunca só "ok" (lei nº 3)
--   · apagar a DEFINIÇÃO não apaga o valor no contato — recriar a chave traz o histórico de volta
--   · teto de 30 campos por tenant: sem isso a ficha do contato vira formulário infinito
