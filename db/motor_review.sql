-- MOTOR DE REVIEW — o pedido de avaliação depois da visita. 2026-08-17.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- POR QUE ESTE ARQUIVO EXISTE
-- O semáforo acusava três "motores mortos" (due_reminders, due_review_requests, due_winback):
-- nomes da geração ANTERIOR do schema que o `automations.js` chamava, e `(await rpc(...)) || []`
-- transformava "esta função não existe" em ZERO LINHAS — 96 rodadas por dia reportando sucesso.
--
-- Ao abrir os três, eram problemas DIFERENTES:
--   · due_reminders  → o proactive.js JÁ manda lembrete pelas RPCs certas. Motor duplicado morto.
--   · due_winback    → o proactive.js JÁ reativa (dormentes 60d + quebra de cadência). Idem.
--   · due_review_requests → NINGUÉM pedia review. Sem RPC, sem template, sem motor. Nunca existiu.
-- Os dois primeiros se consertam com tesoura (revivê-los = e-mail em dobro pra quem paga).
-- O terceiro é este arquivo.
--
-- POR QUE REVIEW É O MOTOR QUE MAIS PAGA
-- Review alimenta o ranking do Maps, o Maps alimenta a ligação, e a ligação a Gui já atende. É o
-- único dos três que fecha o ciclo de volta na ENTRADA de leads em vez de mexer só na saída.
--
-- ⚠️ DESCOBERTA QUE DESENHOU A JANELA: `biz_appointments` NÃO TEM status "atendido". Os status são
-- 'booked' / 'cancelled' / 'no_show' — ninguém carimba que a pessoa apareceu. Então "a visita
-- aconteceu" só pode ser INFERIDA: o horário já passou e não foi cancelado nem marcado como falta.
-- É a melhor verdade disponível, e está escrito aqui para ninguém ler `status='booked'` como
-- "ainda vai acontecer".
--
-- ⚠️ E O RISCO DE LIGAR UM MOTOR NOVO: sem um teto de idade, a PRIMEIRA rodada varreria todo
-- agendamento passado do banco e dispararia pedido de avaliação para gente que foi atendida meses
-- atrás. O cliente estreia a funcionalidade com uma explosão de e-mail e desliga na mesma hora.
-- Por isso a janela tem DOIS lados: `p_after_hours` (esperar a visita esfriar) e `p_max_days`
-- (nunca perguntar sobre visita velha). Motor novo nasce olhando só para a frente.
--
-- ⚠️ NÃO FILTRAMOS POR "CLIENTE FELIZ" — DE PROPÓSITO. Pedir avaliação pública só a quem gostou
-- ("review gating") viola a política de conteúdo proibido do Google e pode derrubar o perfil do
-- negócio. Todo mundo atendido recebe o mesmo convite, uma vez. Filtrar quem responde é o cliente
-- que faz, no atendimento — não nós, no SELECT.
--
-- O PADRÃO É O DO LEMBRETE (db/lembrete_cadencia.sql): LISTAR ≠ MARCAR. A RPC de leitura NUNCA
-- escreve; o carimbo vem depois do envio confirmado, uma linha por vez. Foi exatamente o contrário
-- disso que fez contato-por-telefone sair marcado como lembrado sem nunca ter sido lembrado.
--
-- IDEMPOTENTE: pode colar quantas vezes quiser.

alter table biz_appointments add column if not exists review_asked boolean not null default false;
alter table biz_appointments add column if not exists review_asked_at timestamptz;
alter table biz_appointments add column if not exists review_channel text;

-- Índice do caminho quente: o motor varre por tenant + fim do horário, filtrando quem já foi
-- perguntado. Parcial porque `review_asked = false` é a minoria permanente que interessa.
create index if not exists biz_appt_review_due_idx
  on biz_appointments (client_email, upper(span))
  where review_asked = false;

-- ── LEITURA (nunca escreve) ────────────────────────────────────────────────────────────────────
-- Devolve as visitas que já aconteceram e ainda não receberam o convite.
-- Não filtra por tipo de contato: quem só tem telefone continua na fila até o A2P sair, do mesmo
-- jeito que o lembrete faz. Quem decide o que consegue enviar é o chamador.
create or replace function public.biz_review_due(
  p_secret text, p_email text,
  p_after_hours integer default 3,     -- esperar a visita esfriar antes de perguntar
  p_max_days integer default 7,        -- e nunca perguntar sobre visita velha (ver aviso acima)
  p_limit integer default 50
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare v jsonb; begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'contact', a.customer_contact, 'name', a.customer_name,
           'service', s.name, 'when', upper(a.span), 'ref', a.ref) order by upper(a.span) desc), '[]'::jsonb)
    into v
    from biz_appointments a left join biz_services s on s.id = a.service_id
   where a.client_email = p_email
     and a.status = 'booked'                       -- 'cancelled'/'no_show' nunca viraram visita
     and not a.review_asked
     and upper(a.span) < now() - (greatest(coalesce(p_after_hours,3),0)||' hours')::interval
     and upper(a.span) > now() - (greatest(coalesce(p_max_days,7),1)||' days')::interval
   limit greatest(coalesce(p_limit,50),1);
  return jsonb_build_object('due', coalesce(v,'[]'::jsonb));
end $function$;

-- ── CARIMBO (uma linha, depois do envio confirmado) ────────────────────────────────────────────
-- `not review_asked` na cláusula torna o re-envio impossível: repetir devolve false em vez de
-- perguntar duas vezes. Devolver boolean (e não void) é o que permite ao chamador PROVAR que
-- carimbou — "ok" sem comprovante é promessa sem lastro.
create or replace function public.biz_review_mark(
  p_secret text, p_email text, p_id uuid, p_channel text default 'email'
) returns boolean
language plpgsql security definer set search_path to 'public'
as $function$
declare n int; begin
  if not _gui_sched_ok(p_secret) then return false; end if;
  update biz_appointments
     set review_asked = true, review_asked_at = now(),
         review_channel = left(coalesce(p_channel,'email'), 24)
   where id = p_id and client_email = p_email and not review_asked;
  get diagnostics n = row_count;
  return n > 0;
end $function$;

revoke all on function public.biz_review_due(text,text,integer,integer,integer) from public;
revoke all on function public.biz_review_mark(text,text,uuid,text) from public;
grant execute on function public.biz_review_due(text,text,integer,integer,integer) to anon;
grant execute on function public.biz_review_mark(text,text,uuid,text) to anon;

-- ── ANTI-EXPLOSÃO NA ESTREIA ───────────────────────────────────────────────────────────────────
-- O teto de 7 dias já protege a primeira rodada, mas ele é um PARÂMETRO: quem chamar com
-- p_max_days=365 amanhã reabre o histórico inteiro. Este UPDATE fecha a porta no estoque: tudo que
-- é anterior a hoje nasce como "já perguntado" — não porque perguntamos, mas porque a janela de
-- perguntar passou. Uma vez só, e a coluna nasce agora, então não há o que reverter.
update biz_appointments
   set review_asked = true, review_channel = 'skipped:historico'
 where not review_asked and review_asked_at is null and upper(span) < now() - interval '7 days';
