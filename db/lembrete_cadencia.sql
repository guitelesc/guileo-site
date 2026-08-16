-- LEMBRETE: LISTAR ≠ MARCAR — e a cadência que faltava. 2026-08-16.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- O DEFEITO
-- `biz_due_reminders` fazia SELECT e, na linha seguinte, `update ... set reminded=true` para TODOS
-- os vencendo — ANTES de qualquer envio. E o chamador (functions/api/proactive.js) pula quem não
-- tem e-mail, porque o SMS está preso na campanha A2P.
-- Resultado: contato por TELEFONE saía marcado como lembrado e nunca era lembrado, PARA SEMPRE.
-- Não é caso de canto: é o caminho do GUI-42F0, o primeiro agendamento real da plataforma.
-- Marcar antes de fazer é "sucesso sem comprovante" — e aqui o registro falso apaga a 2ª chance.
--
-- O SEGUNDO DEFEITO, invisível: a rodada era 1×/dia (13h UTC) com janela de 24h. Reserva criada
-- às 14h para o dia seguinte às 10h nunca caía em janela nenhuma — a próxima rodada acontece
-- DEPOIS do horário. O cliente não era lembrado e o dono lia como "faltou".
--
-- A CORREÇÃO
--   · `biz_reminders_due`  — SÓ LÊ. Nunca escreve. Janela padrão 26h (as 2h a mais cobrem a folga
--     entre rodadas horárias).
--   · `biz_reminder_mark`  — carimba UMA linha, DEPOIS do envio confirmado, com canal e hora.
--     Idempotente: `not reminded` na cláusula, então re-executar devolve false e não remarca.
--   · colunas `reminded_at` / `reminder_channel`: `reminded` sozinho não dizia QUANDO nem POR ONDE,
--     e sem isso não há como distinguir "lembrado de verdade" de "marcado pelo bug".
--   · a rodada de lembrete virou HORÁRIA (cron-tick → /api/proactive?apenas=lembretes); o marketing
--     continua 1×/dia, porque aniversário e win-back de hora em hora seriam spam.
--
-- A RPC ANTIGA CONTINUA DE PÉ de propósito: se um deploy escorregar, nada quebra. Ela deixa de ser
-- chamada, não de existir.
--
-- IDEMPOTENTE: pode colar quantas vezes quiser.

alter table biz_appointments add column if not exists reminded_at timestamptz;
alter table biz_appointments add column if not exists reminder_channel text;

create or replace function public.biz_reminders_due(
  p_secret text, p_email text, p_hours integer default 26, p_limit integer default 50
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare v jsonb; begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',a.id,'contact',a.customer_contact,'name',a.customer_name,
           'service',s.name,'when',lower(a.span),'ref',a.ref) order by lower(a.span)),'[]'::jsonb)
    into v
    from biz_appointments a left join biz_services s on s.id=a.service_id
   where a.client_email=p_email and a.status='booked' and not a.reminded
     and lower(a.span) between now() and now()+(p_hours||' hours')::interval
   limit greatest(coalesce(p_limit,50),1);
  return jsonb_build_object('due', coalesce(v,'[]'::jsonb));
end $function$;

create or replace function public.biz_reminder_mark(
  p_secret text, p_email text, p_id uuid, p_channel text default 'email'
) returns boolean
language plpgsql security definer set search_path to 'public'
as $function$
declare n int; begin
  if not _gui_sched_ok(p_secret) then return false; end if;
  update biz_appointments
     set reminded = true, reminded_at = now(), reminder_channel = left(coalesce(p_channel,'email'),24)
   where id = p_id and client_email = p_email and not reminded;
  get diagnostics n = row_count;
  return n > 0;
end $function$;

revoke all on function public.biz_reminders_due(text,text,integer,integer) from public;
revoke all on function public.biz_reminder_mark(text,text,uuid,text) from public;
grant execute on function public.biz_reminders_due(text,text,integer,integer) to anon;
grant execute on function public.biz_reminder_mark(text,text,uuid,text) to anon;

-- ── REPARO DO ESTOQUE ───────────────────────────────────────────────────────────────────────────
-- Quem foi marcado pelo bug tem `reminded=true` e `reminded_at IS NULL` (a coluna nasceu hoje).
-- Só faz sentido soltar quem AINDA está no futuro: reabrir um horário de junho não lembra ninguém.
-- Medido em 2026-08-16: 1 linha marcada pelo bug (GUI-DEMO2), e ela já passou — então este UPDATE
-- não altera nada hoje. Fica escrito porque a causa só foi corrigida agora: se algum agendamento
-- futuro tiver sido contaminado antes deste deploy, é esta linha que o devolve para a fila.
update biz_appointments
   set reminded = false
 where reminded and reminded_at is null and lower(span) > now();
