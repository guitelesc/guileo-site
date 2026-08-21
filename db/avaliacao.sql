-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- MOTOR DE AVALIAÇÃO DE NEGÓCIO — persistência + snapshot interno (2026-08-18)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- O que é: cada avaliação (score por aspecto + previsões + estratégia) fica GRAVADA. Duas razões:
--   1. prospect e vendedor leem a MESMA coisa pelo mesmo uuid (o desenho do diagnóstico);
--   2. HISTÓRICO — avaliar o mesmo negócio de novo mostra a evolução do score, e isso é produto
--      ("seu score subiu de 41 para 78 depois da Gui" é a frase de renovação).
--
-- Gate: INGEST literal ('glo_ing_c7f2a9e4b8d16350' = env INGEST_SECRET — Supabase proíbe GUC,
-- gate é sempre literal na função). Leitura pública só por uuid v4, que é o segredo do link.
-- RLS ligado SEM policy anon: só as SECURITY DEFINER abaixo entram. Idempotente: roda 2x sem dor.
--
-- Aplicar via MCP (apply_migration) — este arquivo é a fonte; NÃO foi aplicado ainda.

create table if not exists public.business_evaluations (
  id            uuid primary key default gen_random_uuid(),
  site          text not null,
  business      text,
  client_email  text,                       -- null = prospect; preenchido = modo cliente
  modo          text not null default 'prospect',   -- prospect | cliente
  score         integer,                    -- score_geral 0-100 (null = nada medível)
  payload       jsonb not null,             -- a avaliação inteira (contrato do lib/avaliacao.js)
  seller        text,
  contato       text,
  created_at    timestamptz not null default now(),
  aberto_em     timestamptz                 -- 1ª abertura do link = interesse real medido
);

create index if not exists idx_bizeval_email on public.business_evaluations (client_email, created_at desc);
create index if not exists idx_bizeval_site  on public.business_evaluations (site, created_at desc);

alter table public.business_evaluations enable row level security;
-- sem policy para anon: só as RPCs abaixo.

-- ── GRAVAR ──────────────────────────────────────────────────────────────────────────────────────
create or replace function public.avaliacao_save(
  p_secret text, p_site text, p_business text, p_client_email text, p_modo text,
  p_score integer, p_payload jsonb, p_seller text default null, p_contato text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(p_secret,'') <> 'glo_ing_c7f2a9e4b8d16350' then
    return jsonb_build_object('error','unauthorized');
  end if;
  if coalesce(trim(p_site),'') = '' or p_payload is null then
    return jsonb_build_object('error','site e payload obrigatórios');
  end if;
  insert into business_evaluations (site, business, client_email, modo, score, payload, seller, contato)
  values (trim(p_site), nullif(trim(coalesce(p_business,'')),''),
          nullif(lower(trim(coalesce(p_client_email,''))),''),
          case when p_modo in ('prospect','cliente') then p_modo else 'prospect' end,
          case when p_score between 0 and 100 then p_score else null end,
          p_payload, nullif(trim(coalesce(p_seller,'')),''), nullif(trim(coalesce(p_contato,'')),''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- ── LER (o link do prospect — o uuid é o segredo) ───────────────────────────────────────────────
create or replace function public.avaliacao_get(p_id uuid, p_marcar boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from business_evaluations where id = p_id;
  if not found then return null; end if;
  if p_marcar and r.aberto_em is null then
    update business_evaluations set aberto_em = now() where id = p_id;
  end if;
  return jsonb_build_object('id', r.id, 'site', r.site, 'business', r.business,
    'modo', r.modo, 'score', r.score, 'payload', r.payload,
    'created_at', r.created_at, 'aberto_em', r.aberto_em);
end $$;

-- ── HISTÓRICO (evolução do score de um negócio — a curva que vende renovação) ──────────────────
create or replace function public.avaliacao_historico(p_secret text, p_site text default null, p_email text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_secret,'') <> 'glo_ing_c7f2a9e4b8d16350' then
    return jsonb_build_object('error','unauthorized');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'score', score, 'modo', modo, 'created_at', created_at)
                     order by created_at)
    from business_evaluations
    where (p_site is not null and site = trim(p_site))
       or (p_email is not null and client_email = lower(trim(p_email)))
  ), '[]'::jsonb);
end $$;

-- ── SNAPSHOT INTERNO (modo cliente: o que só o banco sabe) ─────────────────────────────────────
-- Cada métrica num bloco próprio com EXCEPTION: tabela ausente degrada aquela métrica para null,
-- nunca derruba o snapshot inteiro (padrão da casa — nunca 500 por tabela ausente).
create or replace function public.avaliacao_client_snapshot(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e text := lower(trim(coalesce(p_email,'')));
  v_servicos int; v_com_preco int; v_ticket numeric; v_pmin numeric; v_pmax numeric;
  v_unidades int; v_pros int; v_ag_total int; v_ag_30d int;
  v_lig_total int; v_lig_30d int; v_dur int; v_pos int; v_neg int;
  v_kb int; v_pacotes int; v_memberships int; v_gift int; v_pac_vendidos int;
  v_agenda_h numeric; v_agenda_dias int;
begin
  if coalesce(p_secret,'') <> 'glo_ing_c7f2a9e4b8d16350' then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  if e = '' then return jsonb_build_object('ok', false, 'error', 'email obrigatório'); end if;

  begin
    select count(*), count(*) filter (where price_cents > 0),
           round(avg(price_cents) filter (where price_cents > 0) / 100.0, 2),
           min(price_cents) filter (where price_cents > 0) / 100.0,
           max(price_cents) filter (where price_cents > 0) / 100.0
      into v_servicos, v_com_preco, v_ticket, v_pmin, v_pmax
      from biz_services where client_email = e and active;
  exception when undefined_table then null; end;

  begin
    select count(*) into v_unidades from biz_locations where client_email = e and active;
  exception when undefined_table then null; end;
  begin
    select count(*) into v_pros from biz_professionals where client_email = e and active;
  exception when undefined_table then null; end;
  begin
    select count(*), count(*) filter (where created_at > now() - interval '30 days')
      into v_ag_total, v_ag_30d from biz_appointments where client_email = e;
  exception when undefined_table then null; end;

  begin
    select count(*), count(*) filter (where created_at > now() - interval '30 days'),
           round(avg(duration_secs) filter (where duration_secs > 0)),
           count(*) filter (where sentiment ilike 'positive%'),
           count(*) filter (where sentiment ilike 'negative%')
      into v_lig_total, v_lig_30d, v_dur, v_pos, v_neg
      from call_logs where client_email = e;
  exception when undefined_table then null; end;

  -- horas de agenda cobertas por semana = UNIÃO dos turnos (range_agg evita contar duas vezes o
  -- mesmo horário quando dois profissionais trabalham juntos). É o que destrava a previsão quando
  -- o site não publica horário legível: a agenda interna é o horário REAL do negócio.
  begin
    select round(coalesce(sum(len),0)/60.0,1), count(*) into v_agenda_h, v_agenda_dias
    from (
      select weekday, (select sum(upper(r)-lower(r)) from unnest(range_agg(int4range(s.start_min, s.end_min))) r) as len
      from biz_schedules s join biz_professionals p on p.id = s.pro_id
      where p.client_email = e group by weekday
    ) t;
  exception when undefined_table then null; end;

  begin
    select count(*) into v_kb from client_kb where client_email = e;
  exception when undefined_table then null; end;
  begin
    select count(*) into v_pacotes from packages where client_email = e;
  exception when undefined_table then null; end;
  begin
    select count(*) into v_memberships from memberships where client_email = e;
  exception when undefined_table then null; end;
  begin
    select count(*) into v_gift from gift_cards where client_email = e;
  exception when undefined_table then null; end;
  begin
    select count(*) into v_pac_vendidos from package_purchases where client_email = e;
  exception when undefined_table then null; end;

  return jsonb_build_object(
    'ok', true, 'client_email', e,
    'servicos', v_servicos, 'servicos_com_preco', v_com_preco,
    'ticket_medio', v_ticket, 'preco_min', v_pmin, 'preco_max', v_pmax,
    'unidades', v_unidades, 'profissionais', v_pros,
    'agendamentos_total', v_ag_total, 'agendamentos_30d', v_ag_30d,
    'ligacoes_total', v_lig_total, 'ligacoes_30d', v_lig_30d,
    'dur_media_s', v_dur, 'lig_positivas', v_pos, 'lig_negativas', v_neg,
    'agenda_horas_semana', v_agenda_h, 'agenda_dias', v_agenda_dias,
    'kb_docs', v_kb, 'pacotes', v_pacotes, 'memberships', v_memberships,
    'gift_cards', v_gift, 'pacotes_vendidos', v_pac_vendidos
  );
end $$;

-- anon executa (o gate mora DENTRO da função; avaliacao_get é aberta por design — uuid é o segredo)
grant execute on function public.avaliacao_save(text,text,text,text,text,integer,jsonb,text,text) to anon;
grant execute on function public.avaliacao_get(uuid,boolean) to anon;
grant execute on function public.avaliacao_historico(text,text,text) to anon;
grant execute on function public.avaliacao_client_snapshot(text,text) to anon;

-- PROVA (depois de aplicar):
--   select public.avaliacao_client_snapshot('glo_ing_c7f2a9e4b8d16350','naturaspaadm@gmail.com');
--   select public.avaliacao_save('errado','x','','','prospect',1,'{}'::jsonb);  -- → unauthorized
