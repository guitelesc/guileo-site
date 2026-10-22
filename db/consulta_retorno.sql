-- ACOMPANHAMENTO DE CONSULTA (2026-10-13) — "Lilian follows up Med Spa consultations that did not book".
-- Contrato do Natura (Anexo A, Parte 4, planejado) e slide 17 da apresentação.
-- ============================================================================
-- REGRA
--   • serviço com `config.followup_days` > 0 (a consulta grátis do Med Spa; qualquer serviço de "primeiro
--     contato"). 0 ou ausente = nunca acompanhar — consulta não é "volta" (rebook_days continua 0 nela);
--   • quem fez a consulta e, passados N dias, NÃO marcou nada depois dela (nenhum horário depois da
--     consulta, futuro ou já realizado) recebe UM e-mail da assistente oferecendo marcar ou tirar dúvida;
--   • janela: entre N e N+21 dias depois da consulta. Rodada perdida não apaga a pessoa da fila; depois
--     de 21 dias a janela fecha (ninguém recebe "sobre a sua consulta" de três meses atrás);
--   • respeita `live_desde` (teste de antes da entrada em operação não vira cliente);
--   • falta/cancelada no balcão (attributes.desk_status) não é consulta feita;
--   • um e-mail por consulta (biz_marketing_sent kind='consult_followup', ref=id) e uma pessoa por rodada.
-- Gated por _gui_sched_ok (SCHED) e concedido só ao service_role: chamada de servidor
-- (functions/api/consulta-retorno.js). Idempotente.
-- ============================================================================

create or replace function public._followup_dias(p_config jsonb) returns int
language sql immutable as $$
  select case when coalesce(p_config->>'followup_days','') ~ '^[0-9]{1,3}$'
              then least((p_config->>'followup_days')::int, 365) else 0 end
$$;

create or replace function public.consulta_followup_due_all(
  p_secret text, p_limit int default 40, p_so_tenant text default null, p_agora timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_out jsonb;
  v_lim int := greatest(1, least(coalesce(p_limit, 40), 200));
  v_t   text := nullif(lower(trim(coalesce(p_so_tenant, ''))), '');
  v_now timestamptz := coalesce(p_agora, now());
begin
  if not public._gui_sched_ok(p_secret) then return jsonb_build_object('error', 'unauthorized'); end if;

  with consultas as (
    select a.id, a.client_email as tenant, a.customer_name, a.customer_contact, a.service_id, a.location_id,
           upper(a.span) as fim, public._contato_chave(a.customer_contact) as ckey,
           s.name as service, public._followup_dias(s.config) as dias
      from biz_appointments a
      join biz_services s on s.id = a.service_id and s.client_email = a.client_email
     where a.status in ('booked', 'confirmed', 'completed', 'done')
       and coalesce(a.attributes->>'desk_status', '') not in ('no_show', 'cancelled')
       and public._followup_dias(s.config) > 0
       and upper(a.span) <= v_now - (public._followup_dias(s.config) || ' days')::interval
       and upper(a.span) >  v_now - ((public._followup_dias(s.config) + 21) || ' days')::interval
       and coalesce(trim(a.customer_contact), '') <> ''
       and (v_t is null or a.client_email = v_t)
       and a.created_at >= coalesce(public.tenant_live_desde(a.client_email), '-infinity'::timestamptz)
  ),
  livre as (
    select c.*, public._contato_email(c.tenant, c.customer_contact) as email
      from consultas c
     where not exists (   -- marcou qualquer coisa DEPOIS da consulta: o acompanhamento já aconteceu sozinho
             select 1 from biz_appointments f
              where f.client_email = c.tenant
                and f.status in ('booked', 'confirmed', 'hold', 'completed', 'done')
                and f.id <> c.id and lower(f.span) > c.fim
                and public._contato_chave(f.customer_contact) = c.ckey)
       and not exists (   -- esta consulta já foi acompanhada
             select 1 from biz_marketing_sent ms
              where ms.client_email = c.tenant and ms.kind = 'consult_followup' and ms.ref = c.id::text)
  ),
  uma as (select distinct on (tenant, ckey) * from livre order by tenant, ckey, fim desc)
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', 'consult_followup', 'tenant', u.tenant, 'ref', u.id::text, 'period', '-',
           'name', u.customer_name, 'email', u.email, 'tem_email', u.email is not null,
           'phone', case when u.customer_contact like '%@%' then null else u.customer_contact end,
           'service', u.service, 'dias', u.dias, 'when', u.fim,
           'location', l.name, 'tz', l.tz) order by u.fim), '[]'::jsonb)
    into v_out
    from (select * from uma order by fim limit v_lim) u
    left join biz_locations l on l.id = u.location_id;

  return jsonb_build_object('due', v_out, 'total', jsonb_array_length(v_out));
end $$;
revoke all on function public.consulta_followup_due_all(text, int, text, timestamptz) from public, anon, authenticated;
grant execute on function public.consulta_followup_due_all(text, int, text, timestamptz) to service_role;
