-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- O NÚMERO DO CLIENTE TEM UMA FONTE SÓ  (2026-08-14)
--
-- O QUE ACONTECEU: o alerta 📵 "tem agente mas NENHUM número" disparava todo dia para o
-- smart@guileoai.com, que TEM número (+19864443334). Não era o alerta mentindo nem o banco
-- mentindo: os dois liam tabelas diferentes.
--
--   client_agents.number ................. onde o provisionamento e o sync escrevem
--   client_integrations (twilio_number) .. o que client_number_lookup lia
--
-- O Natura estava nas duas; o smart só na primeira. Um cliente provisionado pelo caminho que
-- escreve só `client_agents` fica invisível para esta busca.
--
-- ⚠️ POR QUE ISTO É DINHEIRO, E NÃO SÓ BARULHO: esta função não é usada só pelo monitor. Ela é
-- o portão do "já temos número? se não, COMPRA um" em provision.js e onboard-client.js. Uma
-- busca que devolve NULL para um cliente que já tem número manda o sistema comprar um SEGUNDO
-- número — cobrança recorrente nova, e o cliente com duas linhas onde uma toca no vazio.
-- O alerta barulhento era o sintoma visível de uma falha cara e silenciosa.
--
-- A CORREÇÃO: a busca passa a olhar as DUAS fontes, na ordem de confiança — a integração
-- explícita primeiro (é ela que carrega o vínculo com o provedor), `client_agents.number`
-- depois. Consertar aqui conserta os SEIS chamadores de uma vez; consertar no monitor teria
-- consertado o alerta e deixado a compra dupla de pé.
--
-- NÃO normaliza, NÃO inventa: se as duas estiverem vazias, devolve NULL — que é a resposta
-- verdadeira "este cliente não tem número", e aí o 📵 está certo em gritar.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.client_number_lookup(p_secret text, p_email text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_tenant text := lower(trim(p_email)); v_num text;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  -- 1ª fonte: a integração explícita (carrega o vínculo com o provedor)
  select nullif(trim(tokens->>'number'), '') into v_num
    from client_integrations
   where client_email = v_tenant and provider = 'twilio_number'
   limit 1;
  if v_num is not null then return v_num; end if;

  -- 2ª fonte: o registro do agente (onde o provisionamento e o sync escrevem)
  select nullif(trim(number), '') into v_num
    from client_agents
   where client_email = v_tenant
   limit 1;
  return v_num;  -- null aqui é verdade: o cliente não tem número em lugar nenhum
end $$;

revoke all on function public.client_number_lookup(text,text) from public, anon, authenticated;
grant execute on function public.client_number_lookup(text,text) to service_role;

-- ── E A MARCA `internal` CHEGA A QUEM VARRE CLIENTES ────────────────────────────────────────
-- Os outros dois 📵 (luistelesc@, e2e-test@) eram tecnicamente verdadeiros e mesmo assim ruído:
-- são contas NOSSAS, que nunca deveriam ter número. `client_credits.internal` já existia (do
-- trabalho de métrica honesta) mas `clients_list` não devolvia a marca — então todo motor que
-- varre clientes tratava conta de teste como cliente. Aditivo: quem lê email/plan/credits não muda.
drop function if exists public.clients_list(text);
create or replace function public.clients_list(p_secret text)
returns table(client_email text, plan text, credits integer, internal boolean)
language plpgsql security definer set search_path to 'public' as $$
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  return query select c.client_email, c.plan, c.credits, coalesce(c.internal, false) from client_credits c;
end $$;
revoke all on function public.clients_list(text) from public, anon, authenticated;
grant execute on function public.clients_list(text) to service_role;

-- ── LER O CADASTRO DE UM TENANT PELO E-MAIL ────────────────────────────────────────────────
-- O `draft_get` existente exige uuid + e-mail do vendedor, que quem opera POR TENANT não tem.
-- Usada pelo /api/encaminhar pra montar o documento com os dados reais (nome do negócio, nome
-- da agente, idioma, TODAS as linhas do cliente).
create or replace function public.draft_payload_for(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v jsonb;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  select payload into v from onboard_drafts
   where client_email = lower(trim(p_email))
   order by updated_at desc nulls last limit 1;
  return v;  -- null = tenant sem cadastro; quem chama decide (nunca inventa)
end $$;
revoke all on function public.draft_payload_for(text,text) from public, anon, authenticated;
grant execute on function public.draft_payload_for(text,text) to service_role;
