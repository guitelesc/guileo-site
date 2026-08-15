-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- O ELO EXATO LIGAÇÃO → AGENDAMENTO  (2026-08-12)
--
-- O BURACO QUE ISTO FECHA (registrado em JORNADA.md como o último aberto do motor de agente):
-- «não existe elo exato ligação→agendamento (`call_logs` não guarda telefone; a ferramenta de
--  agenda não recebe o id da conversa). Enquanto não houver, "resultado confirmado" só afirma
--  dinheiro. Amarrar por janela de tempo seria trocar um palpite por outro.»
--
-- Estava certo em recusar o palpite. Telefone + janela de tempo casa a pessoa errada no dia em que
-- duas ligações do mesmo número acontecem perto — e num negócio movimentado isso é terça-feira.
--
-- POR QUE UMA TABELA NOVA E NÃO UMA COLUNA EM biz_appointments:
-- o caminho de agendamento é caminho de DINHEIRO (reserva atômica, depósito, cobrança). Mexer na
-- assinatura da RPC de book para carregar mais um parâmetro é risco desproporcional ao ganho —
-- um elo de relatório não pode ter chance de derrubar uma reserva. Esta tabela é escrita DEPOIS
-- do book já ter dado certo: se a escrita aqui falhar, o cliente segue agendado e só o relatório
-- fica sem o elo. A falha cai no lado barato.
--
-- ⚠️ O ELO É FAIL-CLOSED. `conversation_id` só entra se casar com o formato real da ElevenLabs
-- (`conv_` + alfanumérico). Se o provedor não substituir o placeholder, chega a string literal
-- "{{system__conversation_id}}" — e um elo falso é PIOR que elo nenhum: ele afirma com confiança
-- que aquela ligação gerou aquele agendamento. O CHECK recusa; a linha simplesmente não nasce.
-- Mesma razão do CHECK em lead_attribution.phone_key: normalizar em silêncio esconde a porta errada.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.call_bookings (
  id               uuid primary key default gen_random_uuid(),
  client_email     text not null,
  conversation_id  text not null,
  appointment_id   uuid not null,
  created_at       timestamptz not null default now(),
  constraint call_bookings_conv_formato check (conversation_id ~ '^conv_[A-Za-z0-9_-]{6,}$')
);

-- Um agendamento pertence a UMA ligação. Se o agente chamar book duas vezes na mesma conversa
-- (retry, ou o modelo repetindo), o elo não duplica — mesma lógica de idempotência do resto.
create unique index if not exists call_bookings_unico
  on public.call_bookings (client_email, conversation_id, appointment_id);

-- Consulta natural: "desta ligação, saiu agendamento?"
create index if not exists call_bookings_por_conversa
  on public.call_bookings (client_email, conversation_id);

alter table public.call_bookings enable row level security;
-- Sem policy: ninguém alcança pela chave pública. Só as RPCs SECURITY DEFINER abaixo.

-- ── GRAVAR O ELO ────────────────────────────────────────────────────────────────────────────
-- Chamada pelo agent-schedule DEPOIS de um book bem-sucedido. Devolve o id criado (ou o existente),
-- nunca um "ok" sem lastro — a regra da casa: sucesso sem comprovante é promessa.
create or replace function public.call_booking_link(
  p_secret text, p_email text, p_conv text, p_appointment uuid
) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_tenant text := lower(trim(p_email)); v_id uuid;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  if p_conv is null or p_conv !~ '^conv_[A-Za-z0-9_-]{6,}$' then
    -- Não é erro: é o placeholder não substituído ou uma chamada sem conversa (ex.: agendamento
    -- pelo portal). Devolve `ligado:false` para quem chamou saber que NÃO houve elo.
    return jsonb_build_object('ok', true, 'ligado', false, 'motivo', 'conversation_id ausente ou fora do formato');
  end if;
  insert into call_bookings (client_email, conversation_id, appointment_id)
  values (v_tenant, p_conv, p_appointment)
  on conflict (client_email, conversation_id, appointment_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from call_bookings
     where client_email = v_tenant and conversation_id = p_conv and appointment_id = p_appointment;
  end if;
  return jsonb_build_object('ok', true, 'ligado', true, 'id', v_id);
end $$;

-- ── LER: "esta ligação virou agendamento?" ──────────────────────────────────────────────────
-- É isto que permite o cockpit dizer RESULTADO CONFIRMADO sem chutar. Devolve os agendamentos
-- reais (com serviço e horário), não uma contagem — para a tela poder mostrar o que foi marcado.
create or replace function public.call_booking_of(p_secret text, p_email text, p_conv text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_tenant text := lower(trim(p_email)); v_out jsonb;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'appointment_id', a.id,
           'quando', lower(ap.span),
           'servico', s.name,
           'status', ap.status
         ) order by lower(ap.span)), '[]'::jsonb)
    into v_out
    from call_bookings a
    join biz_appointments ap on ap.id = a.appointment_id and ap.client_email = v_tenant
    left join biz_services s on s.id = ap.service_id
   where a.client_email = v_tenant and a.conversation_id = p_conv;
  return jsonb_build_object('ok', true, 'agendamentos', v_out);
end $$;

revoke all on function public.call_booking_link(text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.call_booking_of(text,text,text)       from public, anon, authenticated;
grant execute on function public.call_booking_link(text,text,text,uuid) to service_role;
grant execute on function public.call_booking_of(text,text,text)       to service_role;
