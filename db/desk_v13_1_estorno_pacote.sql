-- GUILEO DESK v13.1 — estorno devolve TODAS as sessões que o pagamento de pacote debitou (2026-10-21)
-- Achado pelo smoke do item 6: o facial debitou 2 sessões (desk_v13, config.pkg_sessions) e o estorno
-- (desk_void_sale) devolvia sempre 1 — a compra ficava "usada" e o estorno da venda do pacote era recusado.
--   1. desk_payments.sessions = quantas sessões aquele pagamento `package` debitou (gravado no checkout,
--      com a regra do serviço NAQUELE momento — mudar o serviço depois não muda o que foi debitado).
--   2. desk_void_sale devolve coalesce(sessions, 1) — pagamentos antigos (sem o número) debitaram 1.
-- Idempotente: add column if not exists / patches textuais que se reconhecem.

alter table desk_payments add column if not exists sessions int;

do $p$
declare d text := pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure); n text;
begin
  if position('client_email, method, amount_cents, ref, sessions)' in d) > 0 then return; end if;
  n := replace(d,
    E'insert into desk_payments (sale_id, client_email, method, amount_cents, ref) values (v_id, e, lower(pg->>\'method\'), (pg->>\'amount_cents\')::bigint, left(pg->>\'ref\', 80));',
    E'insert into desk_payments (sale_id, client_email, method, amount_cents, ref, sessions) values (v_id, e, lower(pg->>\'method\'), (pg->>\'amount_cents\')::bigint, left(pg->>\'ref\', 80),\n' ||
    E'      case when lower(pg->>\'method\') = \'package\' then greatest(coalesce((select (s.config->>\'pkg_sessions\')::int from biz_services s\n' ||
    E'                where s.id = nullif(pg->>\'service_id\', \'\')::uuid and s.client_email = e), 1), 1) end);');
  if n = d then raise exception 'desk_v13_1: insert do pagamento não encontrado em desk_checkout — nada alterado'; end if;
  execute n;
end $p$;

do $p$
declare d text := pg_get_functiondef('public.desk_void_sale(text,text,uuid,text)'::regprocedure); n text;
begin
  if position('coalesce(r.sessions, 1)' in d) > 0 then return; end if;
  n := replace(d, 'set sessions_used = greatest(sessions_used - 1, 0) where id = r.ref::uuid',
                  'set sessions_used = greatest(sessions_used - coalesce(r.sessions, 1), 0) where id = r.ref::uuid');
  if n = d then raise exception 'desk_v13_1: devolução de sessão não encontrada em desk_void_sale — nada alterado'; end if;
  execute n;
end $p$;
