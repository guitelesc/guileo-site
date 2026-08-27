-- ─────────────────────────────────────────────────────────────────────────────
-- GUILEO · PRÉ-ALERTA DE CRÉDITO (20%) — a trava do aviso "está acabando".
--
-- POR QUE EXISTE: até 2026-08-25 o único aviso de crédito era o do ZERO
-- (client_credits.depleted_at → due_credit_alerts). Avisar no zero é avisar
-- DEPOIS que o Gui parou: o cliente já sentiu a queda antes de abrir o e-mail,
-- e para ele isso não se lê como "acabou o crédito", se lê como "o produto
-- quebrou". Este arquivo é só a MEMÓRIA de quem já foi avisado nesta descida —
-- os dados (saldo + plano) já vêm de `clients_list`, que existe há tempos.
--
-- RE-ARMA SOZINHO, em duas situações, e as duas importam:
--   · passou de 30 dias  → novo ciclo de cobrança, novo aviso;
--   · o saldo SUBIU desde o aviso → ele recarregou/subiu de plano e desceu de
--     novo. Sem esta segunda regra, quem recarrega em 10 dias ficaria 20 dias
--     descendo em silêncio — exatamente o cliente que mais consome.
--
-- ANTI-SPAM DE VERDADE: a reivindicação é ATÔMICA (insert … on conflict … where),
-- então dois tiques simultâneos do cron nunca mandam dois e-mails.
-- INGEST-gated SECURITY DEFINER; RLS on, sem policy para anon.
-- Colar no SQL Editor do Supabase (projeto ynihodbknhjirkdogxby, smart@guileoai.com).
-- Enquanto NÃO for colado, /api/credit-alerts continua fazendo o fluxo do zero e
-- apenas REPORTA `low_claim_ready:false` — nenhum e-mail de 20% sai sem trava
-- (mandar sem trava seria um e-mail por hora no mesmo cliente).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.credit_low_alerts (
  client_email      text primary key,
  alerted_at        timestamptz not null default now(),
  credits_at_alert  integer not null default 0
);

-- Ninguém lê esta tabela pelo PostgREST — só a função abaixo toca nela.
alter table public.credit_low_alerts enable row level security;

-- Reivindicação atômica do pré-alerta. true = pode mandar o e-mail AGORA (e já ficou
-- registrado). false = este cliente já foi avisado nesta descida. Degrada para false
-- em qualquer erro: na dúvida, NÃO avisa duas vezes (silêncio é menos danoso que spam
-- num e-mail de upsell — o aviso do ZERO continua existindo como rede de segurança).
create or replace function public.credit_low_claim(p_secret text, p_email text, p_credits integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  begin
    insert into credit_low_alerts (client_email, alerted_at, credits_at_alert)
    values (lower(trim(p_email)), now(), greatest(0, coalesce(p_credits, 0)))
    on conflict (client_email) do update
      set alerted_at = now(), credits_at_alert = greatest(0, coalesce(p_credits, 0))
      where credit_low_alerts.alerted_at < now() - interval '30 days'
         or credit_low_alerts.credits_at_alert < greatest(0, coalesce(p_credits, 0))
    returning client_email into v_email;
    return v_email is not null;
  exception when others then
    return false;
  end;
end
$$;

grant execute on function public.credit_low_claim(text, text, integer) to anon;

-- ✅ Pronto. /api/credit-alerts (agora chamado de hora em hora pelo cron-tick) passa a
--    mandar o pré-alerta de 20% no máximo 1× por cliente por ciclo.

-- ═══ RE-ARME SAUDÁVEL (revisor 2026-08-25, achado #6) ════════════════════════════════════════
-- O re-arme do claim comparava contra o saldo NO MOMENTO do claim (sempre ≤20%), então a segunda
-- descida dentro de 30 dias podia nunca avisar. Correção estrutural: com saldo ≥50% do balde, o
-- cron chama o reset e apaga a trava — a próxima descida avisa de novo. (Aplicado no banco vivo
-- em 2026-08-25; o chamador é o /api/credit-alerts.)
create or replace function public.credit_low_reset(p_secret text, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_hit int;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  delete from credit_low_alerts where client_email = lower(trim(p_email));
  get diagnostics v_hit = row_count;
  return v_hit > 0;
end
$$;
grant execute on function public.credit_low_reset(text, text) to anon;
