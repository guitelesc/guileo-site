-- GUILEO DESK v16 — ESCOLHER A PROFISSIONAL NO /agendar (2026-10-22, Onda 1 item 9 "largar o MindBody")
-- No MindBody a cliente escolhe com quem quer marcar no agendamento online; aqui o motor escolhia sozinho.
-- O motor JÁ filtra por profissional (biz_availability / biz_book com p_pro_id, duração dela pela regra
-- profissional × serviço do desk_v10). Faltava:
--   1. vitrine_pros(tenant): a lista que a PÁGINA PÚBLICA pode mostrar — só equipe (sem sala/equipamento),
--      ativa, que a dona NÃO escondeu do site, com nome, título, cor e, por serviço que ela faz, a duração
--      DELA (_biz_eff). Nunca telefone, e-mail ou pagamento. Só o servidor chama (service_role).
--   2. "Não marca pelo site" (biz_professionals.config.online = false): a dona tira alguém da escolha online
--      (ex.: estagiária) sem tirar da agenda. A pessoa some da lista E o "Sem preferência" do site não cai
--      nela (o /api/vitrine-agenda filtra os horários pelas visíveis). Balcão e Lilian continuam marcando.
--      desk_staff_save aceita `online`; desk_agenda devolve `pros[].online` para a tela de Equipe.
-- Preço por profissional NÃO existe no cadastro (a regra do v10 é duração/preparo/limpeza/pagamento DELA, não
-- preço de venda) — a página mostra a duração dela quando difere da do serviço.
-- Idempotente: create or replace + remendos que se reconhecem e param com erro (nada muda pela metade).

-- ═══ TRAVA: a equipe no ar tem de ser a do desk_v10 (regras por serviço) ═════════════════════════
do $t$
begin
  if position('service_rules' in pg_get_functiondef('public.desk_staff_save(text,text,jsonb)'::regprocedure)) = 0
     or to_regprocedure('public._biz_eff(uuid,uuid)') is null then
    raise exception 'desk_v16: a equipe no ar não está na versão esperada (desk_v10) — nada foi alterado.';
  end if;
end $t$;

-- ═══ A LISTA DO SITE ═══════════════════════════════════════════════════════════════════════════
create or replace function public.vitrine_pros(p_tenant text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.name, 'title', nullif(trim(coalesce(p.title, '')), ''), 'color', p.config->>'color',
           'locations', coalesce((select jsonb_agg(pl.location_id) from biz_pro_locations pl where pl.pro_id = p.id), '[]'::jsonb),
           'services', coalesce((select jsonb_agg(jsonb_build_object('service_id', s.id, 'name', s.name, 'duration_min', e.dur, 'service_duration_min', s.duration_min) order by s.name)
                                   from biz_pro_services ps
                                   join biz_services s on s.id = ps.service_id and s.client_email = p.client_email and coalesce(s.active, true)
                                   cross join lateral public._biz_eff(p.id, s.id) e
                                  where ps.pro_id = p.id), '[]'::jsonb))
         order by p.name), '[]'::jsonb)
    from biz_professionals p
   where p.client_email = lower(trim(coalesce(p_tenant, ''))) and coalesce(p.active, true)
     and coalesce(p.kind, 'staff') = 'staff' and coalesce((p.config->>'online')::boolean, true)
$$;
revoke all on function public.vitrine_pros(text) from public, anon, authenticated;
grant execute on function public.vitrine_pros(text) to service_role;

-- ═══ "NÃO MARCA PELO SITE" no salvar da equipe — roda uma vez ═════════════════════════════════════
do $p$
declare d text := pg_get_functiondef('public.desk_staff_save(text,text,jsonb)'::regprocedure); n text;
begin
  if position('''online''' in d) > 0 then return; end if;
  n := replace(d,
    E'             || case when p_pro ? \'commission_product_pct\' then jsonb_build_object(\'commission_product_pct\', least(greatest((p_pro->>\'commission_product_pct\')::numeric, 0), 100)) else \'{}\'::jsonb end',
    E'             || case when p_pro ? \'commission_product_pct\' then jsonb_build_object(\'commission_product_pct\', least(greatest((p_pro->>\'commission_product_pct\')::numeric, 0), 100)) else \'{}\'::jsonb end\n' ||
    E'             || case when p_pro ? \'online\' then jsonb_build_object(\'online\', coalesce((p_pro->>\'online\')::boolean, true)) else \'{}\'::jsonb end   -- desk_v16: false = não marca pelo site');
  if n = d then raise exception 'desk_v16: bloco do config não encontrado em desk_staff_save — nada alterado'; end if;
  execute n;
end $p$;

-- ═══ a agenda devolve pros[].online (a tela de Equipe mostra e edita) — roda uma vez ═════════════════
do $p$
declare d text := pg_get_functiondef('public.desk_agenda(text,text,timestamptz,timestamptz)'::regprocedure); n text; k int;
begin
  if position('''online''' in d) > 0 then return; end if;
  k := (length(d) - length(replace(d, '''color'', p.config->>''color'',', ''))) / length('''color'', p.config->>''color'',');
  if k <> 1 then raise exception 'desk_v16: esperava 1 "color" dos profissionais em desk_agenda, achei % — nada alterado', k; end if;
  n := replace(d, '''color'', p.config->>''color'',', '''color'', p.config->>''color'', ''online'', coalesce((p.config->>''online'')::boolean, true),');
  execute n;
end $p$;

-- ═══ CHECAGEM: tem de devolver aplicado = true ══════════════════════════════════════════════════
select to_regprocedure('public.vitrine_pros(text)') is not null
   and position('''online''' in pg_get_functiondef('public.desk_staff_save(text,text,jsonb)'::regprocedure)) > 0
   and position('''online''' in pg_get_functiondef('public.desk_agenda(text,text,timestamptz,timestamptz)'::regprocedure)) > 0
   and position('service_rules' in pg_get_functiondef('public.desk_staff_save(text,text,jsonb)'::regprocedure)) > 0
   as aplicado;
