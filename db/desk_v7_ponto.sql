-- GUILEO DESK v7.8 · PONTO DA EQUIPE + "MEU MÊS" DA PROFISSIONAL (2026-10-05).
-- Regras completas: functions/lib/deskEu.js · rota: functions/api/desk-eu.js. Este arquivo só ACRESCENTA
-- (tabela nova + 8 funções); nenhuma tabela ou função existente muda. Idempotente.
--
-- QUEM CHAMA O QUÊ
--   · *_svc (ponto_status / ponto_bater / meu_mes) → SÓ service_role. O /api/desk-eu confere o código "bal_…"
--     (desk_acesso_entrar_svc), confere a ação na lista DELE (deskEu.js) e passa o id do acesso — nunca a chave
--     da dona. O código da equipe não abre nada aqui direto pelo PostgREST.
--   · desk_ponto_relatorio / desk_ponto_corrigir / desk_eu_dono_ok → porta _desk_ok (só a DONA).
--
-- NUNCA INVENTAR HORA: turno aberto há 16 h ou mais = "esqueceu de bater a saída". Ele NÃO é fechado com
-- uma hora qualquer: fica sem saída (esquecido_em marcado quando ela bate a próxima entrada) e a dona acerta
-- com motivo (ajustes guarda o antes/depois). Os 16 h moram em deskEu.js (HORAS_ESQUECIDO) e aqui — mudar os dois.

create table if not exists public.desk_ponto (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  acesso_id uuid not null references public.desk_acessos(id),
  pro_id uuid,
  nome text not null,
  entrada timestamptz not null,
  saida timestamptz,
  origem text not null default 'balcao' check (origem in ('balcao', 'dono')),
  esquecido_em timestamptz,                      -- ela bateu a entrada seguinte com este turno ainda aberto (>= 16 h)
  ajustes jsonb not null default '[]'::jsonb,    -- [{em, motivo, antes:{entrada,saida}, depois:{entrada,saida}}]
  created_at timestamptz not null default now(),
  constraint desk_ponto_saida_depois check (saida is null or saida > entrada)
);
create index if not exists desk_ponto_tenant_idx on public.desk_ponto (client_email, entrada desc);
create index if not exists desk_ponto_acesso_idx on public.desk_ponto (acesso_id, entrada desc);
-- Um turno aberto por acesso (o esquecido não conta: ele espera a dona, não trava a entrada de hoje).
create unique index if not exists desk_ponto_um_aberto on public.desk_ponto (acesso_id) where saida is null and esquecido_em is null;
alter table public.desk_ponto enable row level security;
revoke all on public.desk_ponto from public, anon, authenticated;

-- Fuso do negócio: public._desk_tz(p_email) JÁ EXISTE no banco (1ª unidade ativa, senão America/New_York) —
-- mesma régua do desk_reports_extra. Reusado aqui, não redefinido.

-- Um turno em JSON (as leituras usam a mesma forma).
create or replace function public._desk_ponto_json(t desk_ponto)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('id', t.id, 'acesso_id', t.acesso_id, 'pro_id', t.pro_id, 'nome', t.nome, 'entrada', t.entrada, 'saida', t.saida,
    'origem', t.origem, 'esquecido_em', t.esquecido_em, 'ajustes', jsonb_array_length(t.ajustes),
    'motivo', t.ajustes->-1->>'motivo')
$$;
revoke all on function public._desk_ponto_json(desk_ponto) from public, anon, authenticated;

-- O acesso vivo (não revogado; profissional ativa). Nulo = não pode bater.
create or replace function public._desk_acesso_vivo(e text, p_id uuid)
returns desk_acessos language sql stable security definer set search_path to 'public' as $$
  select a.* from desk_acessos a
   where a.id = p_id and a.client_email = e and a.revogado_em is null
     and (a.papel <> 'profissional' or exists (select 1 from biz_professionals p where p.id = a.pro_id and p.client_email = e and coalesce(p.active, true)))
$$;
revoke all on function public._desk_acesso_vivo(text, uuid) from public, anon, authenticated;

-- ── EQUIPE (só o servidor) ──────────────────────────────────────────────────────────────────────
-- Situação de quem está no balcão: os turnos dela dos últimos 14 dias + qualquer um ainda sem saída.
create or replace function public.desk_ponto_status_svc(p_email text, p_acesso_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := lower(trim(coalesce(p_email, ''))); a desk_acessos := public._desk_acesso_vivo(e, p_acesso_id);
begin
  if a.id is null then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  return jsonb_build_object('ok', true, 'tz', public._desk_tz(e), 'agora', now(), 'nome', a.nome, 'papel', a.papel,
    'turnos', coalesce((select jsonb_agg(public._desk_ponto_json(t) order by t.entrada desc)
      from desk_ponto t where t.client_email = e and t.acesso_id = a.id and (t.entrada >= now() - interval '14 days' or t.saida is null)), '[]'::jsonb));
end $$;

-- Bater o ponto. p_esperado = o que o botão mostrava ('entrada' | 'saida'): se a situação mudou (toque duplo,
-- outra aba) nada é gravado e volta 'state_changed'. Turno aberto há 16 h ou mais NÃO fecha: vira esquecido
-- e a entrada nova abre (a dona acerta a saída depois, com motivo).
create or replace function public.desk_ponto_bater_svc(p_email text, p_acesso_id uuid, p_esperado text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := lower(trim(coalesce(p_email, ''))); a desk_acessos; t desk_ponto; v desk_ponto; esq jsonb := null;
begin
  if coalesce(p_esperado, '') not in ('entrada', 'saida') then return jsonb_build_object('ok', false, 'reason', 'bad_request'); end if;
  -- trava o acesso: dois toques ao mesmo tempo viram fila, nunca dois turnos
  select * into a from desk_acessos where id = p_acesso_id and client_email = e for update;
  a := public._desk_acesso_vivo(e, p_acesso_id);
  if a.id is null then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  select * into t from desk_ponto where acesso_id = a.id and client_email = e and saida is null and esquecido_em is null;
  if t.id is not null and t.entrada > now() - interval '16 hours' then
    if p_esperado <> 'saida' then return jsonb_build_object('ok', false, 'reason', 'state_changed', 'dentro', true); end if;
    update desk_ponto set saida = now() where id = t.id returning * into v;
    return jsonb_build_object('ok', true, 'acao', 'saida', 'turno', public._desk_ponto_json(v));
  end if;
  if p_esperado <> 'entrada' then return jsonb_build_object('ok', false, 'reason', 'state_changed', 'dentro', false); end if;
  if t.id is not null then
    update desk_ponto set esquecido_em = now() where id = t.id returning * into v;
    esq := public._desk_ponto_json(v);
  end if;
  insert into desk_ponto (client_email, acesso_id, pro_id, nome, entrada, origem)
  values (e, a.id, a.pro_id, a.nome, now(), 'balcao') returning * into v;
  return jsonb_build_object('ok', true, 'acao', 'entrada', 'turno', public._desk_ponto_json(v), 'esquecido', esq);
end $$;

-- ── DONA ────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.desk_eu_dono_ok(p_email text, p_key text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
begin
  return jsonb_build_object('ok', true, 'tz', public._desk_tz(e));
end $$;

-- Período em DIAS do negócio (de/até inclusive), convertido no fuso do negócio aqui (o horário de verão
-- fica com o Postgres). Turnos que COMEÇAM no período + todo turno ainda sem saída (para o esquecido de
-- semana passada não sumir do olho da dona).
create or replace function public.desk_ponto_relatorio(p_email text, p_key text, p_de date, p_ate date)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); z text := public._desk_tz(e); f timestamptz; t timestamptz;
begin
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 92 then return jsonb_build_object('ok', false, 'reason', 'invalid_range'); end if;
  f := p_de::timestamp at time zone z; t := (p_ate + 1)::timestamp at time zone z;
  return jsonb_build_object('ok', true, 'tz', z, 'agora', now(), 'de', p_de, 'ate', p_ate, 'from', f, 'to', t,
    'turnos', coalesce((select jsonb_agg(public._desk_ponto_json(x) || jsonb_build_object('papel', a.papel, 'revogado', a.revogado_em is not null) order by x.entrada)
       from desk_ponto x join desk_acessos a on a.id = x.acesso_id
      where x.client_email = e and ((x.entrada >= f and x.entrada < t) or x.saida is null)), '[]'::jsonb));
end $$;

-- Acertar um turno (só a dona, sempre com motivo; o antes/depois fica em ajustes). p_saida nulo = a saída
-- não muda (acertar só a entrada de um turno aberto). Nunca mais de 24 h, nunca no futuro.
create or replace function public.desk_ponto_corrigir(p_email text, p_key text, p_id uuid, p_entrada timestamptz, p_saida timestamptz, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); t desk_ponto; v desk_ponto; m text := left(trim(coalesce(p_motivo, '')), 300);
        ne timestamptz; ns timestamptz;
begin
  if length(m) < 3 then return jsonb_build_object('ok', false, 'reason', 'reason_required'); end if;
  select * into t from desk_ponto where id = p_id and client_email = e for update;
  if t.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  ne := coalesce(p_entrada, t.entrada); ns := coalesce(p_saida, t.saida);
  if ne > now() + interval '5 minutes' or (ns is not null and ns > now() + interval '5 minutes') then return jsonb_build_object('ok', false, 'reason', 'future'); end if;
  if ns is not null and ns <= ne then return jsonb_build_object('ok', false, 'reason', 'invalid_hours'); end if;
  if ns is not null and ns - ne > interval '24 hours' then return jsonb_build_object('ok', false, 'reason', 'too_long'); end if;
  update desk_ponto set entrada = ne, saida = ns,
         ajustes = ajustes || jsonb_build_array(jsonb_build_object('em', now(), 'motivo', m,
                     'antes', jsonb_build_object('entrada', t.entrada, 'saida', t.saida), 'depois', jsonb_build_object('entrada', ne, 'saida', ns)))
   where id = t.id returning * into v;
  return jsonb_build_object('ok', true, 'turno', public._desk_ponto_json(v));
end $$;

-- ── MEU MÊS DA PROFISSIONAL (só o servidor; o pro_id vem do acesso conferido, nunca do navegador) ──────
-- Mesma régua do "quem vende mais" (desk_reports_extra.pro_sales) e do fechamento (desk_day_close.by_pro):
-- linhas de venda PAGAS com o pro_id dela; comissão = a gravada em cada linha no caixa (o % dela naquele dia).
-- Mês corrente até agora, no fuso do negócio. Nunca devolve número de outra profissional.
create or replace function public.desk_meu_mes_svc(p_email text, p_pro_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := lower(trim(coalesce(p_email, ''))); z text; f timestamptz; p biz_professionals;
begin
  select * into p from biz_professionals where id = p_pro_id and client_email = e;
  if p.id is null then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  z := public._desk_tz(e);
  f := date_trunc('month', now() at time zone z) at time zone z;
  return (
    with ap as (
      select a.status, a.attributes from public.vivo_biz_appointments(e) a
       where a.pro_id = p.id and lower(a.span) >= f and lower(a.span) < now() and a.status not in ('blocked', 'hold')
    ), v as (
      select l.kind, l.total_cents, l.commission_cents, l.sale_id from desk_sale_lines l join desk_sales s on s.id = l.sale_id
       where l.client_email = e and s.client_email = e and s.status = 'paid' and l.pro_id = p.id and s.created_at >= f and s.created_at <= now()
    )
    select jsonb_build_object('ok', true, 'tz', z, 'de', f, 'ate', now(), 'nome', p.name,
      'pct_servico', coalesce((p.config->>'commission_service_pct')::numeric, 0),
      'pct_produto', coalesce((p.config->>'commission_product_pct')::numeric, 0),
      'concluidos', (select count(*) from ap where ap.attributes->>'desk_status' = 'completed' and ap.status not in ('cancelled', 'no_show')),
      'faltas', (select count(*) from ap where ap.status = 'no_show'),
      'concluidos_sem_caixa', (select count(*) from ap where ap.attributes->>'desk_status' = 'completed' and ap.status not in ('cancelled', 'no_show') and not (ap.attributes ? 'sale_id')),
      'servicos_cents', (select coalesce(sum(total_cents), 0) from v where kind = 'service'),
      'produtos_cents', (select coalesce(sum(total_cents), 0) from v where kind = 'product'),
      'gorjetas_cents', (select coalesce(sum(total_cents), 0) from v where kind = 'tip'),
      'comissao_cents', (select coalesce(sum(commission_cents), 0) from v where kind in ('service', 'product')),
      'vendas', (select count(distinct sale_id) from v where kind in ('service', 'product')))
  );
end $$;

revoke all on function public.desk_ponto_status_svc(text, uuid) from public, anon, authenticated;
revoke all on function public.desk_ponto_bater_svc(text, uuid, text) from public, anon, authenticated;
revoke all on function public.desk_meu_mes_svc(text, uuid) from public, anon, authenticated;
grant execute on function public.desk_ponto_status_svc(text, uuid) to service_role;
grant execute on function public.desk_ponto_bater_svc(text, uuid, text) to service_role;
grant execute on function public.desk_meu_mes_svc(text, uuid) to service_role;
revoke all on function public.desk_eu_dono_ok(text, text) from public;
revoke all on function public.desk_ponto_relatorio(text, text, date, date) from public;
revoke all on function public.desk_ponto_corrigir(text, text, uuid, timestamptz, timestamptz, text) from public;
grant execute on function public.desk_eu_dono_ok(text, text) to anon, authenticated, service_role;
grant execute on function public.desk_ponto_relatorio(text, text, date, date) to anon, authenticated, service_role;
grant execute on function public.desk_ponto_corrigir(text, text, uuid, timestamptz, timestamptz, text) to anon, authenticated, service_role;
