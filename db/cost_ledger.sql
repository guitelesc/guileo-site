-- ─────────────────────────────────────────────────────────────────────────────
-- Guileo — COST LEDGER ("o que a Guileo PAGA por cliente/motor").  FUNDAÇÃO 5a.
-- Project ynihodbknhjirkdogxby (account smart@guileoai.com).
--
-- Unit economics = receita (o que a Guileo RECEBE do cliente) − custo (o que a
-- Guileo PAGA aos provedores). Este arquivo é o lado do CUSTO: uma linha por
-- evento de custo real, escrita pelos pontos que já existem no código (voz na
-- elevenlabs-webhook, LLM em askClaude, SMS em call.js/twilio.js, taxa em
-- stripe-webhook). Nada é estimado às cegas: se um ponto ainda não grava, aquele
-- provedor simplesmente NÃO aparece — e /api/unit-economics marca "parcial".
--
-- FONTE ÚNICA: só existe UMA porta de escrita (record_cost_event, INGEST-gated) e
-- duas de leitura (cost_summary por tenant · cost_summary_all + guileo_receipts_all
-- p/ o admin). Nenhum PII cruza tenant: leitura por tenant é escopada por email.
--
-- SEGURANÇA: RLS ON, ZERO policy anon → a tabela base é intocável direto; as únicas
-- portas são as RPCs SECURITY DEFINER gated pelo literal INGEST (mesmo dos demais
-- writes server-side). Idempotente: safe re-rodar o arquivo inteiro; e cada custo é
-- idempotente por (provider, ref) — provedores RE-tentam webhooks (ElevenLabs/Stripe).
--
-- Cole no Supabase SQL Editor (projeto ynihodbknhjirkdogxby, smart@guileoai.com).
-- Até colar, /api/unit-economics devolve { ready:false } gracioso — nada quebra.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.cost_events (
  id            bigint generated always as identity primary key,
  client_email  text        not null,               -- tenant que gerou o custo ('' = plataforma/sem atribuição)
  provider      text        not null,               -- elevenlabs | anthropic | twilio | stripe
  kind          text        not null,               -- voice_call | llm | sms | fee | other
  cost_cents    bigint      not null default 0,      -- SEMPRE em centavos, sempre >= 0
  ref           text,                                -- id externo (conversation_id/message.id/messageSid/pi) → idempotência
  meta          jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
alter table public.cost_events enable row level security;   -- sem policy → anon não toca direto

create index if not exists cost_events_email_time on public.cost_events (client_email, created_at desc);
create index if not exists cost_events_provider    on public.cost_events (provider, created_at desc);
-- idempotência real: um mesmo evento externo (retry de webhook) grava UMA vez.
create unique index if not exists cost_events_provider_ref
  on public.cost_events (provider, ref) where ref is not null and ref <> '';

-- ── ESCRITA (a ÚNICA porta) ─────────────────────────────────────────────────
-- record_cost_event(secret, email, provider, kind, cost_cents, ref, meta) → boolean
-- Retorna true se INSERIU (false = duplicata idempotente ignorada ou provider inválido).
-- Chamada de: elevenlabs-webhook (voz) · askClaude (LLM) · call.js/twilio.js (SMS) ·
-- stripe-webhook (fee). É best-effort no chamador: nunca deve bloquear o fluxo real.
create or replace function public.record_cost_event(
  p_secret text, p_email text, p_provider text, p_kind text,
  p_cost_cents bigint, p_ref text default null, p_meta jsonb default '{}'::jsonb
) returns boolean
language plpgsql security definer set search_path = public as $fn$
declare v_prov text; v_ins int := 0;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  v_prov := lower(trim(coalesce(p_provider, '')));
  -- só provedores conhecidos → custo desconhecido não polui a margem
  if v_prov not in ('elevenlabs','anthropic','twilio','stripe') then return false; end if;
  insert into public.cost_events (client_email, provider, kind, cost_cents, ref, meta)
  values (
    lower(trim(coalesce(p_email, ''))), v_prov,
    coalesce(nullif(trim(p_kind), ''), 'other'),
    greatest(0, coalesce(p_cost_cents, 0)),           -- custo nunca negativo
    nullif(trim(coalesce(p_ref, '')), ''),
    coalesce(p_meta, '{}'::jsonb)
  )
  on conflict (provider, ref) where ref is not null and ref <> '' do nothing;
  get diagnostics v_ins = row_count;
  return v_ins > 0;
end $fn$;

-- ── LEITURA por tenant (cockpit / drill-down) ───────────────────────────────
-- cost_summary(secret, email, since) → jsonb
--   { ready, total_cents, by_provider:{elevenlabs,anthropic,twilio,stripe}, event_count }
create or replace function public.cost_summary(
  p_secret text, p_email text, p_since timestamptz default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_since timestamptz := coalesce(p_since, now() - interval '30 days');
  v_by jsonb := '{}'::jsonb; v_total bigint := 0; v_count int := 0;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  begin
    select coalesce(jsonb_object_agg(t.provider, t.cents), '{}'::jsonb),
           coalesce(sum(t.cents), 0)::bigint, coalesce(sum(t.cnt), 0)::int
      into v_by, v_total, v_count
    from (
      select provider, sum(cost_cents)::bigint as cents, count(*)::int as cnt
        from public.cost_events
       where client_email = v_email and created_at >= v_since
       group by provider
    ) t;
  exception when others then v_by := '{}'::jsonb; v_total := 0; v_count := 0;
  end;
  return jsonb_build_object('ready', true, 'total_cents', v_total,
    'by_provider', v_by, 'event_count', v_count);
end $fn$;

-- ── LEITURA plataforma (admin / unit-economics) ─────────────────────────────
-- cost_summary_all(secret, since) → jsonb
--   { ready, platform:{ total_cents, by_provider }, providers_wired:[...],
--     clients:[ { email, cost_cents, by_provider } ] }
--   providers_wired = provedores que REALMENTE gravaram algo na janela → o endpoint
--   compara com o conjunto esperado p/ decidir se a margem é "parcial".
create or replace function public.cost_summary_all(
  p_secret text, p_since timestamptz default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_since timestamptz := coalesce(p_since, now() - interval '30 days');
  v_plat_by jsonb := '{}'::jsonb; v_plat_total bigint := 0;
  v_wired jsonb := '[]'::jsonb; v_clients jsonb := '[]'::jsonb;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  begin
    -- por-provedor plataforma
    select coalesce(jsonb_object_agg(provider, cents), '{}'::jsonb), coalesce(sum(cents),0)::bigint
      into v_plat_by, v_plat_total
    from (select provider, sum(cost_cents)::bigint as cents
            from public.cost_events where created_at >= v_since group by provider) a;
    -- provedores que gravaram (honestidade do "parcial")
    select coalesce(jsonb_agg(distinct provider), '[]'::jsonb) into v_wired
      from public.cost_events where created_at >= v_since;
    -- por cliente (com breakdown), custo desc
    select coalesce(jsonb_agg(crow order by (crow->>'cost_cents')::bigint desc), '[]'::jsonb)
      into v_clients
      from (
        select jsonb_build_object(
                 'email', client_email,
                 'cost_cents', sum(cost_cents)::bigint,
                 'by_provider', jsonb_object_agg(provider, pc)
               ) as crow
        from (
          select client_email, provider, sum(cost_cents)::bigint as pc
            from public.cost_events where created_at >= v_since
            group by client_email, provider
        ) g
        group by client_email
      ) c;
  exception when others then
    v_plat_by := '{}'::jsonb; v_plat_total := 0; v_wired := '[]'::jsonb; v_clients := '[]'::jsonb;
  end;
  return jsonb_build_object('ready', true,
    'platform', jsonb_build_object('total_cents', v_plat_total, 'by_provider', v_plat_by),
    'providers_wired', v_wired, 'clients', v_clients);
end $fn$;

-- ── RECEITA da Guileo (o que a Guileo RECEBE do cliente) ────────────────────
-- guileo_receipts_all(secret, since) → jsonb { ready, total_cents, clients:[{email,cents}] }
--   Espelha a lógica de money_reconcile.sql: os pagamentos Stripe que viram client_events
--   type='payment' channel='stripe' são os RECEBIMENTOS DA GUILEO (planos + top-ups de
--   crédito). O close&collect (client_charge, dinheiro do PRÓPRIO cliente) grava só
--   revenue_record e NUNCA um client_event → aqui não entra. amount é gravado em DÓLARES
--   (webhook = cents/100) → volta a centavos. Se a tabela não existir, degrada p/ ready:false.
create or replace function public.guileo_receipts_all(
  p_secret text, p_since timestamptz default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_since timestamptz := coalesce(p_since, now() - interval '30 days');
  v_total bigint := 0; v_clients jsonb := '[]'::jsonb; v_ready boolean := true;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  begin
    select coalesce(sum(e.cents), 0)::bigint,
           coalesce(jsonb_agg(e.crow order by e.cents desc), '[]'::jsonb)
      into v_total, v_clients
    from (
      select client_email,
             round(sum(amount) * 100)::bigint as cents,
             jsonb_build_object('email', client_email, 'cents', round(sum(amount)*100)::bigint) as crow
        from public.client_events
       where channel = 'stripe' and type = 'payment' and amount > 0 and created_at >= v_since
       group by client_email
    ) e;
  exception when others then v_ready := false; v_total := 0; v_clients := '[]'::jsonb;
  end;
  return jsonb_build_object('ready', v_ready, 'total_cents', v_total, 'clients', v_clients);
end $fn$;

grant execute on function public.record_cost_event(text, text, text, text, bigint, text, jsonb) to anon;
grant execute on function public.cost_summary(text, text, timestamptz)      to anon;
grant execute on function public.cost_summary_all(text, timestamptz)        to anon;
grant execute on function public.guileo_receipts_all(text, timestamptz)     to anon;

-- ── PROVA (rodar após colar) ────────────────────────────────────────────────
-- select public.record_cost_event('glo_ing_7f3da9c2b4e8','natura@guileoai.com','elevenlabs','voice_call',12,'conv_demo_1','{}');  -- true
-- select public.record_cost_event('glo_ing_7f3da9c2b4e8','natura@guileoai.com','elevenlabs','voice_call',12,'conv_demo_1','{}');  -- false (idempotente)
-- select public.record_cost_event('glo_ing_7f3da9c2b4e8','natura@guileoai.com','anthropic','llm',3,'msg_demo_1','{}');            -- true
-- select public.cost_summary('glo_ing_7f3da9c2b4e8','natura@guileoai.com', now()-interval '30 days');   -- {total_cents:15, by_provider:{elevenlabs:12,anthropic:3}...}
-- select public.cost_summary_all('glo_ing_7f3da9c2b4e8', now()-interval '30 days');                     -- platform + providers_wired:["elevenlabs","anthropic"] + clients[]
-- select public.guileo_receipts_all('glo_ing_7f3da9c2b4e8', now()-interval '30 days');                  -- recebimentos Guileo por cliente
