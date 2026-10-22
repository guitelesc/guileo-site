-- ============================================================================
-- GUILEO · DOCUMENTOS DO CLIENTE — leitura dos PRÓPRIOS contratos pelo tenant.
-- Projeto ynihodbknhjirkdogxby. Idempotente. Aplicado via MCP em 2026-09-28
-- (migration `contract_list_tenant`).
--
-- POR QUE EXISTE (incidente 2026-09-28): /api/contract `list` só abria com o
-- token de ADMIN (blitz_stats). O cliente, logado na Central com a chave DELE,
-- levava 401 e a tela Documentos mostrava "No documents yet" — inclusive para
-- quem tinha contrato assinado com a Guileo. `contract_list` também não servia:
-- ela filtra só por `client_email` (quem CRIOU o documento). O contrato que o
-- cliente ASSINOU foi criado pelo vendedor — o cliente é a CONTRAPARTE.
--
-- O QUE DEVOLVE: documentos em que o tenant é o DONO (client_email) OU a
-- CONTRAPARTE (counterparty_email). `papel` diz qual dos dois. Nunca devolve
-- `body`, `audit`, `signer_ip` nem o e-mail de quem criou o documento.
-- `sign_token` só sai quando o tenant é o DONO do documento (é ele quem manda o
-- link) ou quando é a contraparte (o link já foi endereçado a ele).
--
-- SEGURANÇA: SECURITY DEFINER, portão SCHED (mesma família contract_*), e o
-- e-mail que escopa a leitura é o que passou no portão get_client_data do
-- endpoint. Só o servidor chama: anon/authenticated NÃO executam.
-- ============================================================================
create or replace function public.contract_list_tenant(
  p_secret text, p_email text, p_limit integer default 200
) returns table (
  id uuid, papel text, doc_kind text, party_scope text, template_code text, lang text,
  title text, counterparty_name text, amount_cents bigint, status text,
  signer_name text, signed_at timestamptz, sign_token text, created_at timestamptz
)
language plpgsql security definer set search_path to 'public'
as $function$
declare v_tenant text := lower(trim(coalesce(p_email, '')));
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  -- e-mail vazio casaria com toda linha de counterparty_email vazio/nulo tratado como '' — nunca.
  if v_tenant = '' or position('@' in v_tenant) < 2 then raise exception 'no tenant' using errcode = 'P0002'; end if;
  return query
    select c.id,
           case when lower(c.client_email) = v_tenant then 'dono' else 'contraparte' end as papel,
           c.doc_kind, c.party_scope, c.template_code, c.lang, c.title, c.counterparty_name,
           c.amount_cents, c.status, c.signer_name, c.signed_at, c.sign_token, c.created_at
      from public.contracts c
     where lower(c.client_email) = v_tenant
        or lower(trim(coalesce(c.counterparty_email, ''))) = v_tenant
     order by c.created_at desc
     limit greatest(1, least(coalesce(p_limit, 200), 1000));
end $function$;

revoke all on function public.contract_list_tenant(text, text, integer) from public, anon, authenticated;
grant execute on function public.contract_list_tenant(text, text, integer) to service_role;
