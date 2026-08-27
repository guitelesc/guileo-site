-- meta_token_for_email — leitura SERVIDOR-ONLY do Page Access Token de um tenant.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- POR QUE PRECISOU EXISTIR (2026-08-25)
-- `meta_creds_get` devolve `has_token` (booleano) e NUNCA o token — desenho certo, porque o
-- resultado dela vai para uma tela de admin. Mas a auditoria precisa PERGUNTAR À META (nome real
-- da página, Instagram ligado a ela), e para isso o servidor precisa do token de verdade.
-- `meta_tenant_for_page` já devolve o token, só que resolvido pelo MAPA — e é justamente o mapa
-- que pode estar errado (foi o caso encontrado hoje: mapa apontando para um tenant sem token).
-- Então falta a mesma leitura, chaveada por E-MAIL.
--
-- ⚠️ QUEM PODE CHAMAR: só quem tem o INGEST (servidor). Fica revogada de anon/authenticated, e o
-- endpoint que a usa NUNCA devolve o token na resposta — ele só o usa para falar com a Meta.
create or replace function public.meta_token_for_email(p_secret text, p_email text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_tok text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  select nullif(trim(coalesce(tokens->>'page_access_token','')), '')
    into v_tok
  from client_integrations
  where client_email = lower(trim(p_email)) and provider = 'meta'
  limit 1;
  return v_tok;
exception when undefined_table then return null;
end $$;

revoke all on function public.meta_token_for_email(text, text) from public, anon, authenticated;
grant execute on function public.meta_token_for_email(text, text) to service_role;
