-- db/aeo_kb_privacidade.sql — 🚨 TAPA O VAZAMENTO DO MANUAL DO AGENTE NO SITE PÚBLICO
--
-- ⚠️ ESTE ARQUIVO ESTÁ SEPARADO DE db/aeo.sql DE PROPÓSITO.
-- Ele muda o comportamento de uma RPC que pertence a OUTRA fatia (client_site_public, consumida
-- por src/pages/ClientSite.jsx). Aplicar é decisão do orquestrador/Luis, não de quem construiu o
-- AEO. db/aeo.sql sozinho é 100% aditivo e não mexe em nada existente.
--
-- ── O DEFEITO ──────────────────────────────────────────────────────────────────────────────────
-- client_site_public devolve `faq` montada com client_kb INTEIRA (where active is true), e
-- ClientSite.jsx renderiza tudo sob o título "Perguntas frequentes" / "FAQ".
--
-- Só que client_kb NÃO é uma FAQ de vitrine — é o MANUAL DE OPERAÇÃO do agente. Auditoria do
-- único tenant com site cadastrado (Natura Spa, naturaspaadm@gmail.com, 16 linhas ativas,
-- 2026-08-11). O que seria publicado, com estas palavras, na internet aberta:
--
--   • "WHO AM I — my voice and manner (read this first)"
--     → "You are LILIAN, of Natura Spa + Salon. Not a bot… CARRY YOURSELF LIKE A FOUR SEASONS
--        CONCIERGE…" — a persona inteira, incluindo o nome interno da agente.
--   • "How should I quote prices? (pricing rule)"
--     → "prices are STARTING prices, not fixed… Astoria is lower than the Upper East Side…"
--        — a estratégia de precificação do dono, escrita para uso interno.
--   • "What services can I offer? (NEVER invent)"  → "WE DO NOT DO NAILS…"
--   • "When should I offer a human? (do not let a caller leave frustrated)"
--     → o gatilho exato de escalada — um roteiro de como forçar atendimento humano.
--   • "How do I finish a booking? (never fake it)" → regra interna anti-fraude.
--
-- ── POR QUE NÃO EXPLODIU AINDA ─────────────────────────────────────────────────────────────────
-- client_sites tem UMA linha e ela está com published = false. Como client_site_public só
-- responde para published = true, NADA vazou até agora. O vazamento acontece no instante em que
-- o primeiro dono clicar em "publicar" — inclusive a Natura, que é o cliente pagante.
-- Ou seja: risco zero hoje, risco certo na próxima publicação.
--
-- ── POR QUE NÃO DÁ PARA FILTRAR POR HEURÍSTICA ─────────────────────────────────────────────────
-- `category` não separa os dois mundos: 'pricing' guarda a regra interna, 'payment' guarda uma
-- pergunta legítima de cliente ("Do you sell gift cards?"). 'services' tem as duas coisas.
-- Detectar "texto de instrução" por maiúsculas/segunda pessoa erraria nos dois sentidos, e o erro
-- caro é irreversível: uma vez publicado e indexado, não se despublica de verdade.
--
-- ── A CORREÇÃO ─────────────────────────────────────────────────────────────────────────────────
-- Fail-closed: a FAQ pública passa a ser só o que foi marcado explicitamente
-- (client_kb.aeo_publico = true, coluna criada em db/aeo.sql, default false).
-- É a MESMA fonte que a página /site/aeo/:slug já usa — uma decisão, um lugar.
--
-- EFEITO IMEDIATO: a seção "Perguntas frequentes" de ClientSite.jsx fica VAZIA até alguém liberar
-- linha por linha. ClientSite.jsx já trata isso sozinho (`{data.faq?.length ? … : null}`), então
-- a seção simplesmente não é renderizada — nenhuma tela quebra, nenhum deploy é necessário.
-- Com zero sites publicados, o impacto visível hoje é ZERO.
--
-- Idempotente. Reversível: para voltar ao comportamento antigo, remova a linha marcada com ←.

begin;

create or replace function public.client_site_public(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_email text; v_config jsonb; v_prof jsonb;
  v_services jsonb; v_locations jsonb; v_faq jsonb;
begin
  select client_email, config into v_email, v_config
    from client_sites where slug = lower(trim(coalesce(p_slug,''))) and published = true;
  if v_email is null then return jsonb_build_object('found', false); end if;

  select tokens into v_prof from client_integrations
   where client_email = v_email and provider = 'profile';
  v_prof := coalesce(v_prof, '{}'::jsonb);

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', s.name, 'price_cents', s.price_cents, 'duration_min', s.duration_min
         ) order by s.price_cents nulls last), '[]'::jsonb)
    into v_services from biz_services s
   where s.client_email = v_email and s.active is true;

  -- phone AQUI é o telefone comercial da unidade (público). NUNCA forward_number.
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', l.name, 'address', l.address, 'city', l.city, 'phone', l.phone
         ) order by l.name), '[]'::jsonb)
    into v_locations from biz_locations l
   where l.client_email = v_email and l.active is true;

  -- client_kb é o MANUAL DE OPERAÇÃO do agente (persona, regra de preço, regra de escalada),
  -- não conteúdo de vitrine. Só sai o que foi liberado UMA A UMA por decisão humana.
  select coalesce(jsonb_agg(jsonb_build_object('q', k.question, 'a', k.answer) order by k.id), '[]'::jsonb)
    into v_faq from client_kb k
   where k.client_email = v_email
     and k.active is true
     and k.aeo_publico is true;   -- ← A CORREÇÃO (remover esta linha reverte o comportamento)

  -- Lista de saída EXPLÍCITA (allowlist). Campo novo no perfil não vaza sozinho.
  return jsonb_build_object(
    'found', true,
    'business_name', coalesce(v_prof->>'business_name',''),
    'industry',      coalesce(v_prof->>'industry',''),
    'lang',          coalesce(v_prof->>'lang','pt'),
    'review_link',   coalesce(v_prof->>'review_link',''),
    'config',        coalesce(v_config,'{}'::jsonb),
    'services',      v_services,
    'locations',     v_locations,
    'faq',           v_faq
  );
end $function$;

commit;

-- ── PROVA ──────────────────────────────────────────────────────────────────────────────────────
-- 1) antes de liberar nada, a faq tem que sair vazia:
--    select jsonb_array_length(public.client_site_public('natura-spa')->'faq');   -- espera 0
--    (hoje devolve found:false porque published=false — testar após publicar, ou em rascunho)
-- 2) liberar UMA resposta genuinamente de cliente e conferir que só ela aparece:
--    update client_kb set aeo_publico = true
--     where client_email = 'naturaspaadm@gmail.com' and question = 'Do you sell gift cards?';
-- 3) conferir que NENHUMA linha de instrução foi liberada por engano:
--    select question from client_kb where aeo_publico is true order by client_email, id;
