-- db/aeo.sql — OS FATOS DO TENANT QUE FALTAVAM PARA UM LEITOR-MÁQUINA
-- Idempotente. Aplicar por MCP ou colar no SQL editor do projeto ynihodbknhjirkdogxby.
--
-- ── POR QUE ISTO EXISTE ────────────────────────────────────────────────────────────────────────
-- A RPC pública client_site_public já entrega nome, unidades, serviços e preços. Faltam DUAS
-- coisas para montar dados estruturados honestos (functions/lib/dadosEstruturados.js):
--
--   1. HORÁRIO. openingHoursSpecification é uma das propriedades que o Google efetivamente usa em
--      LocalBusiness, e "vocês abrem domingo?" é uma das perguntas que mais leva alguém a ligar.
--      A verdade sobre isso já está no banco — em biz_schedules, a MESMA agenda que a Gui consulta
--      para marcar. Não se cria uma "vitrine de horário" digitada à parte: ela envelheceria em
--      silêncio e a máquina passaria a repetir um horário que o negócio não pratica mais.
--
--   2. FAQ PÚBLICA DE VERDADE. E aqui está o achado desagradável desta onda ↓
--
-- ── 🚨 client_kb NÃO É UMA FAQ PÚBLICA ──────────────────────────────────────────────────────────
-- client_kb é o MANUAL DE OPERAÇÃO do agente, não conteúdo de vitrine. Auditado em 2026-08-11 no
-- único tenant com site cadastrado (Natura Spa, 16 linhas ativas). Entre elas:
--     • "WHO AM I — my voice and manner (read this first)"  → a persona inteira da agente
--     • "How should I quote prices? (pricing rule)"          → a estratégia de preço do dono
--     • "What services can I offer? (NEVER invent)"          → inclui "WE DO NOT DO NAILS"
--     • "When should I offer a human?"                       → o gatilho de escalada
--     • "How do I finish a booking? (never fake it)"         → regra interna anti-fraude
-- `category` NÃO separa os dois mundos: 'pricing' tem a regra interna, 'payment' tem uma pergunta
-- legítima de cliente. Não existe heurística confiável — e errar aqui publica o manual interno de
-- um cliente para a internet inteira.
--
-- Por isso a coluna abaixo é OPT-IN e FAIL-CLOSED: `aeo_publico boolean not null default false`.
-- Nada vira conteúdo público sem alguém dizer que sim. Uma FAQ vazia é um prejuízo pequeno;
-- publicar o prompt do agente de um cliente é um prejuízo que não se desfaz.
--
-- O conteúdo público do dia 1 NÃO depende disso: as respostas ("quanto custa", "que horas abre",
-- "onde fica") são derivadas dos FATOS (biz_services, biz_locations, biz_schedules), não da KB.
--
-- ⚠️ RELACIONADO E **NÃO CORRIGIDO AQUI**: client_site_public devolve `faq` com a KB CRUA, e
--    src/pages/ClientSite.jsx renderiza tudo sob "Perguntas frequentes". Nenhum site está
--    publicado hoje (client_sites: 1 linha, published=false), então nada vazou ainda — mas a
--    próxima publicação vaza. A correção está em db/aeo_kb_privacidade.sql, SEPARADA de propósito
--    porque muda o comportamento de arquivos de outra fatia. Ver o relatório desta onda.
--
-- ── PORTÕES ────────────────────────────────────────────────────────────────────────────────────
-- Literal do INGEST hardcoded na função (o Supabase proíbe `alter database set`, ver ARQUITETURA).
-- EXECUTE revogado de anon E public; só o service_role chama, sempre pelo servidor (svcJson).

begin;

-- ── 1. A marca de "isto pode ser público" ──────────────────────────────────────────────────────
alter table if exists public.client_kb
  add column if not exists aeo_publico boolean not null default false;

comment on column public.client_kb.aeo_publico is
  'true = esta linha pode ser publicada na internet (/site/aeo/:slug e JSON-LD). Default FALSE: a client_kb é o manual de operação do agente e contém persona, regras de preço e regras internas. Marcar uma a uma, com decisão humana.';

create index if not exists client_kb_aeo_publico_idx
  on public.client_kb (client_email) where aeo_publico is true;

-- ── 2. O complemento do site público: horário real + FAQ liberada ──────────────────────────────
-- Devolve SÓ o que client_site_public não tem. Quem consome já leu o resto de lá, então nada é
-- duplicado (e nenhum campo novo pode vazar por engano por existir num só lugar).
--
-- `hours` é um objeto { "<nome da unidade>": [ {weekday,start_min,end_min} ] }, agregado de
-- biz_schedules por unidade. weekday 0 = domingo (mesma convenção do EXTRACT(DOW) do Postgres).
-- Várias linhas do mesmo dia (um pro por linha) são reduzidas ao envelope da unidade: o menor
-- start e o maior end — que é exatamente "de quando até quando este lugar atende".
create or replace function public.client_site_aeo(p_secret text, p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_email text;
  v_hours jsonb := '{}'::jsonb;
  v_faq   jsonb := '[]'::jsonb;
  v_tz    text;
begin
  if coalesce(p_secret,'') <> 'glo_ing_c7f2a9e4b8d16350' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select client_email into v_email
    from client_sites
   where slug = lower(trim(coalesce(p_slug,''))) and published = true;

  -- Site não publicado ou inexistente → não existe nada. Mesmo 404 honesto do resto da rota.
  if v_email is null then
    return jsonb_build_object('ok', true, 'found', false);
  end if;

  -- Cada bloco degrada sozinho: tabela ausente/renomeada tira UM dado, nunca derruba a página.
  begin
    with dia as (
      -- 1 linha por (unidade, dia) = o envelope de atendimento daquele dia naquele lugar
      select l.name as loc, s.weekday as wd,
             min(s.start_min) as abre, max(s.end_min) as fecha
        from biz_schedules s
        join biz_locations l on l.id = s.location_id
       where l.client_email = v_email
         and l.active is true
         and s.weekday between 0 and 6
         and s.end_min > s.start_min
       group by l.name, s.weekday
    ), porloc as (
      select loc, jsonb_agg(jsonb_build_object('weekday', wd, 'start_min', abre, 'end_min', fecha)
                            order by wd) as linhas
        from dia group by loc
    )
    select coalesce(jsonb_object_agg(loc, linhas), '{}'::jsonb) into v_hours from porloc;
  exception when others then v_hours := '{}'::jsonb;
  end;

  begin
    select coalesce(jsonb_agg(jsonb_build_object('q', k.question, 'a', k.answer) order by k.id), '[]'::jsonb)
      into v_faq
      from client_kb k
     where k.client_email = v_email
       and k.active is true
       and k.aeo_publico is true;   -- ← fail-closed: sem marca explícita, não sai
  exception when others then v_faq := '[]'::jsonb;
  end;

  -- O fuso da unidade é a única pista de MOEDA no cadastro (biz_services não guarda currency).
  -- Sem fuso conhecido, o gerador simplesmente NÃO publica preço — ver MOEDA_POR_FUSO em
  -- functions/lib/dadosEstruturados.js.
  begin
    select l.tz into v_tz from biz_locations l
     where l.client_email = v_email and l.active is true and coalesce(l.tz,'') <> ''
     order by l.name limit 1;
  exception when others then v_tz := null;
  end;

  return jsonb_build_object('ok', true, 'found', true, 'hours', v_hours, 'faq_publico', v_faq, 'tz', coalesce(v_tz,''));
end $$;

revoke all on function public.client_site_aeo(text, text) from public;
revoke all on function public.client_site_aeo(text, text) from anon;
revoke all on function public.client_site_aeo(text, text) from authenticated;   -- default grant do Supabase; a plataforma nao usa Supabase Auth por tenant
grant execute on function public.client_site_aeo(text, text) to service_role;

-- ── 3. Os sites publicados (para o sitemap por tenant) ─────────────────────────────────────────
-- Só slug + updated_at. Nenhum e-mail, nenhum dado de tenant. published=false não aparece —
-- um site em rascunho não pode entrar em sitemap nenhum.
create or replace function public.client_sites_publicos(p_secret text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v jsonb;
begin
  if coalesce(p_secret,'') <> 'glo_ing_c7f2a9e4b8d16350' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
             'slug', s.slug,
             'lastmod', to_char(coalesce(s.updated_at, s.created_at), 'YYYY-MM-DD')
           ) order by s.slug), '[]'::jsonb)
      into v
      from client_sites s
     where s.published = true and s.slug is not null;
  exception when others then v := '[]'::jsonb;
  end;
  return jsonb_build_object('ok', true, 'sites', coalesce(v, '[]'::jsonb));
end $$;

revoke all on function public.client_sites_publicos(text) from public;
revoke all on function public.client_sites_publicos(text) from anon;
revoke all on function public.client_sites_publicos(text) from authenticated;   -- default grant do Supabase; a plataforma nao usa Supabase Auth por tenant
grant execute on function public.client_sites_publicos(text) to service_role;

commit;

-- ── PROVA (rodar depois de aplicar) ────────────────────────────────────────────────────────────
-- select public.client_site_aeo('errado','natura-spa');            -- espera: {"ok":false,...}
-- select public.client_site_aeo('glo_ing_c7f2a9e4b8d16350','natura-spa');
-- select public.client_sites_publicos('glo_ing_c7f2a9e4b8d16350');
-- Para liberar UMA resposta da KB como pública (decisão humana, uma a uma):
-- update client_kb set aeo_publico = true
--  where client_email = '...' and question = 'Do you sell gift cards?';
