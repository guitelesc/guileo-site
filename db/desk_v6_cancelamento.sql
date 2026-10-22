-- GUILEO DESK v6 — HORA DO CANCELAMENTO + TAXA DE CANCELAMENTO TARDIO + ASSINATURA EM DIA (2026-10-05)
-- Aplicado como desk_v6_1_cancelamento (partes 1 e 2) e desk_v6_1_assinatura_sync (parte 3).
-- Só ACRESCENTA: nenhuma função existente muda. Idempotente.
--
-- POR QUÊ: não dava para cobrar cancelamento em cima da hora porque o sistema não guardava QUANDO a
-- cliente cancelou. E a assinatura vendida no Stripe DO NEGÓCIO nunca avisava a gente quando era
-- cancelada ou o cartão falhava (o webhook é da conta dele, não nosso).
--
-- 🚨 biz_appointments é a tabela do agente de voz AO VIVO. O gatilho daqui:
--   · só roda quando o status MUDA para cancelado (cláusula WHEN — nas outras atualizações a função nem
--     é chamada; booking, remarcar, falta, nota, sinal: nada passa por ele);
--   · só mexe em attributes (cancelled_at, cancelled_by); nenhuma outra coluna;
--   · nunca levanta erro: qualquer falha interna devolve a linha como veio (o cancelamento acontece igual).
-- Prova (2026-10-05, conta e2e-test, DO com rollback): o MESMO roteiro antes e depois do gatilho —
-- biz_book → biz_reschedule → nota → biz_book → biz_mark_noshow → biz_cancel → biz_hold vencido →
-- biz_release_expired — deu respostas e linhas idênticas (md5 das colunas fora attributes igual; attributes
-- iguais tirando cancelled_at/cancelled_by, que só aparecem nas duas linhas canceladas).

-- ═══ 1. QUANDO E QUEM CANCELOU ═════════════════════════════════════════════════════════════════
-- cancelled_at: o momento do cancelamento. Se quem cancela já mandou um valor NESTA atualização, vale o
--   dele; um valor velho (cancelou, voltou para "marcado", cancelou de novo) é trocado pelo de agora.
-- cancelled_by: cliente (link da reserva) · balcao · ia · expirou (reserva provisória que venceu) ·
--   desconhecido. Quem chama pode mandar o seu NESTA atualização; senão o gatilho põe 'expirou' (era
--   hold) ou 'desconhecido'. /api/reserva corrige para 'cliente' logo depois (desk_cancelled_by_svc);
--   o balcão e a IA ficam 'desconhecido' no gatilho e a leitura (desk_late_cancel_info_svc) deduz o
--   balcão pela marca desk_status_at que o /api/desk grava no mesmo instante.
create or replace function public._biz_appt_cancelled_at()
returns trigger language plpgsql as $$
begin
  begin
    new.attributes := coalesce(new.attributes, '{}'::jsonb) || jsonb_build_object(
      'cancelled_at', case when new.attributes->'cancelled_at' is not null
                            and new.attributes->'cancelled_at' is distinct from old.attributes->'cancelled_at'
                           then new.attributes->'cancelled_at' else to_jsonb(now()) end,
      'cancelled_by', case when new.attributes->'cancelled_by' is not null
                            and new.attributes->'cancelled_by' is distinct from old.attributes->'cancelled_by'
                           then new.attributes->'cancelled_by'
                           when old.status = 'hold' then to_jsonb('expirou'::text)
                           else to_jsonb('desconhecido'::text) end);
  exception when others then
    null;   -- nunca bloqueia um cancelamento
  end;
  return new;
end $$;

drop trigger if exists biz_appt_cancelled_at_trg on public.biz_appointments;
create trigger biz_appt_cancelled_at_trg
  before update of status on public.biz_appointments
  for each row
  when (new.status in ('cancelled', 'canceled') and old.status not in ('cancelled', 'canceled'))
  execute function public._biz_appt_cancelled_at();

-- Quem chama diz quem cancelou, logo depois do cancelamento (o motor biz_cancel não recebe esse dado).
-- Só troca 'desconhecido' (ou vazio), só em agendamento já cancelado, só deste negócio.
create or replace function public.desk_cancelled_by_svc(p_tenant text, p_id uuid, p_by text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if p_by not in ('cliente', 'balcao', 'ia') then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  update biz_appointments set attributes = attributes || jsonb_build_object('cancelled_by', p_by)
   where id = p_id and client_email = lower(trim(p_tenant)) and status in ('cancelled', 'canceled')
     and coalesce(attributes->>'cancelled_by', 'desconhecido') = 'desconhecido';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'updated', n);
end $$;

-- ═══ 2. TAXA DE CANCELAMENTO TARDIO ════════════════════════════════════════════════════════════
-- Não existe campo próprio para a taxa de cancelamento tardio no cadastro do serviço: o valor é o MESMO
-- da taxa de falta (config.noshow_fee_cents). A janela é biz_services.cancel_window_h (a mesma que o
-- link da reserva usa para não deixar a cliente cancelar sozinha). Quem decide se é tardio é
-- lib/stripeDoNegocio.js (cancelamentoTardio, testado); aqui só os fatos.
create or replace function public._desk_ts(p text)
returns timestamptz language plpgsql stable as $$
begin
  return p::timestamptz;
exception when others then return null;
end $$;

create or replace function public.desk_late_cancel_info_svc(p_tenant text, p_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce((select jsonb_build_object('ok', true, 'id', a.id, 'status', a.status, 'customer_name', a.customer_name,
            'customer_contact', a.customer_contact, 'start', lower(a.span), 'service', s.name,
            'window_h', coalesce(s.cancel_window_h, 0),
            'fee_cents', coalesce((s.config->>'noshow_fee_cents')::int, 0), 'fee_from', 'noshow_fee_cents',
            'cancelled_at', public._desk_ts(a.attributes->>'cancelled_at'),
            'cancelled_by', case
               when coalesce(a.attributes->>'cancelled_by', 'desconhecido') <> 'desconhecido' then a.attributes->>'cancelled_by'
               when abs(extract(epoch from public._desk_ts(a.attributes->>'self_cancel_at') - public._desk_ts(a.attributes->>'cancelled_at'))) < 600 then 'cliente'
               when a.attributes->>'desk_status' = 'cancelled'
                and abs(extract(epoch from public._desk_ts(a.attributes->>'desk_status_at') - public._desk_ts(a.attributes->>'cancelled_at'))) < 600 then 'balcao'
               else 'desconhecido' end,
            'deposit_paid', coalesce((a.attributes->>'deposit_paid')::boolean, false),
            'fee', a.attributes->'late_cancel_fee',
            'charged', coalesce(a.attributes->'late_cancel_fee'->>'status', '') = 'paid',
            'noshow_paid', coalesce(a.attributes->'noshow_fee'->>'status', '') = 'paid',
            'card', (select jsonb_build_object('customer', c.stripe_customer_id, 'payment_method', c.payment_method_id, 'brand', c.brand,
                            'last4', c.last4, 'livemode', c.livemode)
                       from desk_saved_cards c where c.client_email = a.client_email and c.contact_key = public._desk_ck(a.customer_contact)))
          from biz_appointments a left join biz_services s on s.id = a.service_id
         where a.id = p_id and a.client_email = lower(trim(p_tenant))),
         jsonb_build_object('ok', false, 'reason', 'not_found'))
$$;

-- Mesmo contrato do desk_noshow_fee_mark_svc: um 'paid' nunca é sobrescrito por uma tentativa pior.
-- (Atualiza só attributes — o gatilho da parte 1 nem é chamado.)
create or replace function public.desk_late_cancel_fee_mark_svc(p_tenant text, p_id uuid, p_result jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  update biz_appointments set attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('late_cancel_fee',
           coalesce(p_result, '{}'::jsonb) || jsonb_build_object('at', now()))
   where id = p_id and client_email = lower(trim(p_tenant))
     and (coalesce(attributes->'late_cancel_fee'->>'status', '') <> 'paid' or coalesce(p_result->>'status', '') = 'paid');
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1);
end $$;

do $g$
declare f text;
begin
  foreach f in array array['desk_cancelled_by_svc(text,uuid,text)', 'desk_late_cancel_info_svc(text,uuid)',
                           'desk_late_cancel_fee_mark_svc(text,uuid,jsonb)', '_desk_ts(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $g$;

-- ═══ 3. ASSINATURA EM DIA (conferência de hora em hora, /api/sinal-reconcile) ═══════════════════
-- Para cada assinatura viva com sub_… num negócio com Stripe próprio, o reconcile lê o status no Stripe
-- DO NEGÓCIO e grava aqui. No máximo 50 por rodada, a conferida há mais tempo primeiro.
alter table public.membership_subscribers add column if not exists stripe_checked_at timestamptz;
alter table public.membership_subscribers add column if not exists stripe_check jsonb;   -- último resultado {ok, stripe_status|reason, detail}
create index if not exists membership_subscribers_sync on public.membership_subscribers (stripe_checked_at nulls first, started_at)
  where stripe_sub_id is not null and status in ('active', 'past_due', 'paused');

create or replace function public.desk_membership_sync_list_svc(p_limit int)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('tenant', x.client_email, 'id', x.id, 'sub', x.stripe_sub_id, 'status', x.status,
           'contact', x.contact, 'membership', x.name, 'last', x.stripe_check) order by x.ord), '[]'::jsonb)
    from (select ms.client_email, ms.id, ms.stripe_sub_id, ms.status, ms.contact, ms.stripe_check, m.name,
                 row_number() over (order by ms.stripe_checked_at nulls first, ms.started_at) ord
            from membership_subscribers ms left join memberships m on m.id = ms.membership_id
           where ms.stripe_sub_id is not null and ms.status in ('active', 'past_due', 'paused')
             and exists (select 1 from client_integrations i where i.client_email = ms.client_email and i.provider = 'stripe_own')
           order by ms.stripe_checked_at nulls first, ms.started_at
           limit least(greatest(coalesce(p_limit, 50), 1), 50)) x
$$;

-- Grava a conferência. p_status null = não deu para ler (só carimba a hora e o motivo, status fica).
-- → { ok, changed, old, new }
create or replace function public.desk_membership_sync_mark_svc(p_tenant text, p_id uuid, p_status text, p_check jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_old text; v_new text;
begin
  select status into v_old from membership_subscribers where id = p_id and client_email = lower(trim(p_tenant)) for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  v_new := case when p_status in ('active', 'past_due', 'canceled', 'paused') then p_status else v_old end;
  update membership_subscribers set status = v_new, stripe_checked_at = now(), stripe_check = p_check where id = p_id;
  return jsonb_build_object('ok', true, 'changed', v_new is distinct from v_old, 'old', v_old, 'new', v_new);
end $$;

do $g$
declare f text;
begin
  foreach f in array array['desk_membership_sync_list_svc(int)', 'desk_membership_sync_mark_svc(text,uuid,text,jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $g$;
