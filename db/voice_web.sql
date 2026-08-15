-- ============================================================================
-- Guileo · VOZ NO NAVEGADOR — livro-caixa das sessões  (Supabase → SQL Editor → Run)
-- Project ynihodbknhjirkdogxby (smart@guileoai.com). Idempotente: pode rodar 2x.
-- ----------------------------------------------------------------------------
-- POR QUE ISTO EXISTE
-- Conversa por voz CUSTA por minuto. Um botão de voz num site PÚBLICO sem livro-caixa é
-- uma torneira aberta: um visitante (ou um script) abre 500 sessões e a conta da ElevenLabs
-- chega no fim do mês. Este arquivo é o medidor e a trava, na única camada onde a trava não
-- pode ser burlada pelo navegador — o banco.
--
-- O MODELO É DE RESERVA, NÃO DE MEDIÇÃO POSTERIOR:
--   • ao ABRIR a sessão, reservamos o teto inteiro (ex.: 4 min) contra a cota do dia;
--   • ao FECHAR, devolvemos o que não foi usado.
-- Assim uma aba abandonada (que nunca manda o "fim") consome o teto, não zero — o inverso
-- (medir só no fim) deixaria qualquer um abrir sessões infinitas e nunca reportar nada.
--
-- CONTRATO DA CASA: SECURITY DEFINER com o literal INGEST hardcoded (Supabase proíbe GUC),
-- RLS ligada sem policy anon, e EXECUTE revogado de anon E public — só o nosso servidor
-- (service_role) abre esta porta. Bloco EXCEPTION onde a ausência de outra tabela poderia
-- derrubar tudo: falta de dado degrada a leitura, nunca quebra a trava.
-- ============================================================================

-- ── SESSÕES ─────────────────────────────────────────────────────────────────────────────────
create table if not exists public.voice_web_sessions (
  id                uuid primary key default gen_random_uuid(),
  client_email      text not null,
  slug              text,
  agent_id          text,
  conv_id           text,                       -- conversation_id da ElevenLabs (chega no fim)
  ip_hash           text,                       -- sha256(ip+segredo) — nunca o IP cru
  reserved_seconds  int  not null default 240,
  seconds_used      int,                        -- null enquanto aberta/abandonada
  status            text not null default 'open',  -- open | ended | expired
  created_at        timestamptz not null default now(),
  ended_at          timestamptz
);
alter table public.voice_web_sessions enable row level security;   -- sem policy anon: porta só por RPC

create index if not exists voice_web_sessions_tenant_day on public.voice_web_sessions (client_email, created_at desc);
create index if not exists voice_web_sessions_ip_day     on public.voice_web_sessions (ip_hash, created_at desc);
-- Uma conversa da ElevenLabs pertence a UM tenant. O índice único é o que impede um navegador
-- mentiroso de "roubar" a transcrição de outra conversa declarando o conversation_id dela.
create unique index if not exists voice_web_sessions_conv on public.voice_web_sessions (conv_id) where conv_id is not null;

-- ── LIMITES POR CLIENTE (opcional; sem linha = padrão) ──────────────────────────────────────
create table if not exists public.voice_web_limits (
  client_email     text primary key,
  enabled          boolean not null default true,
  session_seconds  int     not null default 240,   -- teto de UMA conversa
  daily_seconds    int     not null default 3600,  -- teto do dia inteiro do cliente (60 min)
  daily_sessions   int     not null default 40,
  updated_at       timestamptz not null default now()
);
alter table public.voice_web_limits enable row level security;

-- Teto da PLATAFORMA (soma de todos os clientes) — a última trava contra uma página viral.
-- Guardado como linha de limites do e-mail sentinela '*' para não precisar de outra tabela.
insert into public.voice_web_limits (client_email, enabled, session_seconds, daily_seconds, daily_sessions)
values ('*', true, 240, 18000, 400)
on conflict (client_email) do nothing;

-- ── RESERVAR (abrir sessão) ─────────────────────────────────────────────────────────────────
-- Devolve { ok, session_id, max_seconds, reason, restante_hoje }. FECHA por padrão: qualquer
-- caminho que não seja um "pode" explícito devolve ok=false com o MOTIVO, e o site mostra o
-- motivo em vez de um botão que não faz nada.
create or replace function public.voice_web_reserve(
  p_secret text, p_email text, p_slug text, p_agent_id text, p_ip_hash text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(coalesce(p_email,'')));
  v_lim    public.voice_web_limits%rowtype;
  v_plat   public.voice_web_limits%rowtype;
  v_usado  int; v_sessoes int; v_ip int; v_plat_usado int;
  v_id     uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' or position('@' in v_tenant) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_tenant');
  end if;

  -- Serializa a decisão: dois cliques simultâneos não podem furar a mesma cota.
  perform pg_advisory_xact_lock(918273645);

  select * into v_lim  from voice_web_limits where client_email = v_tenant;
  if not found then
    v_lim.enabled := true; v_lim.session_seconds := 240; v_lim.daily_seconds := 3600; v_lim.daily_sessions := 40;
  end if;
  if v_lim.enabled is not true then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;

  select * into v_plat from voice_web_limits where client_email = '*';
  if not found then v_plat.daily_seconds := 18000; v_plat.daily_sessions := 400; v_plat.enabled := true; end if;
  if v_plat.enabled is not true then
    return jsonb_build_object('ok', false, 'reason', 'platform_off');
  end if;

  -- Consumo do dia = o que já foi medido OU, para sessão sem fecho, o teto reservado.
  select coalesce(sum(coalesce(seconds_used, reserved_seconds)), 0), count(*)
    into v_usado, v_sessoes
    from voice_web_sessions
   where client_email = v_tenant and created_at >= date_trunc('day', now());

  select coalesce(sum(coalesce(seconds_used, reserved_seconds)), 0)
    into v_plat_usado
    from voice_web_sessions
   where created_at >= date_trunc('day', now());

  select count(*) into v_ip
    from voice_web_sessions
   where ip_hash = nullif(trim(coalesce(p_ip_hash,'')),'')
     and created_at >= date_trunc('day', now());

  if v_sessoes >= v_lim.daily_sessions then
    return jsonb_build_object('ok', false, 'reason', 'daily_sessions');
  end if;
  if v_usado + v_lim.session_seconds > v_lim.daily_seconds then
    return jsonb_build_object('ok', false, 'reason', 'daily_minutes', 'restante_hoje', greatest(v_lim.daily_seconds - v_usado, 0));
  end if;
  if v_plat_usado + v_lim.session_seconds > v_plat.daily_seconds then
    return jsonb_build_object('ok', false, 'reason', 'platform_daily');
  end if;
  -- 6 sessões por IP por dia: um visitante de verdade nunca precisa de mais.
  if p_ip_hash is not null and trim(p_ip_hash) <> '' and v_ip >= 6 then
    return jsonb_build_object('ok', false, 'reason', 'ip_cap');
  end if;

  insert into voice_web_sessions (client_email, slug, agent_id, ip_hash, reserved_seconds)
  values (v_tenant, nullif(trim(coalesce(p_slug,'')),''), nullif(trim(coalesce(p_agent_id,'')),''),
          nullif(trim(coalesce(p_ip_hash,'')),''), v_lim.session_seconds)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'session_id', v_id, 'max_seconds', v_lim.session_seconds,
    'restante_hoje', greatest(v_lim.daily_seconds - v_usado - v_lim.session_seconds, 0)
  );
end $$;

-- ── FECHAR (devolver o que sobrou + carimbar a conversa) ────────────────────────────────────
-- p_seconds vem do navegador e por isso NÃO é confiável para cima: é limitado ao teto reservado
-- (nunca aumenta a conta) e nunca fica negativo. O conversation_id só cola se ninguém mais o
-- tiver reivindicado (índice único) — é o que impede um navegador de reivindicar a transcrição
-- de outra empresa.
create or replace function public.voice_web_end(
  p_secret text, p_session uuid, p_seconds int, p_conv text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res int; v_conv text := nullif(trim(coalesce(p_conv,'')),''); v_dono text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_session is null then return jsonb_build_object('ok', false, 'reason', 'no_session'); end if;

  select reserved_seconds, client_email into v_res, v_dono
    from voice_web_sessions where id = p_session and ended_at is null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_open'); end if;

  if v_conv is not null then
    -- já reivindicado por outra sessão? então este id não é desta conversa: descarta o carimbo,
    -- e o registro continua válido (o minuto foi gasto de qualquer jeito).
    if exists (select 1 from voice_web_sessions where conv_id = v_conv and id <> p_session) then
      v_conv := null;
    end if;
  end if;

  update voice_web_sessions
     set seconds_used = greatest(least(coalesce(p_seconds, v_res), v_res), 0),
         conv_id      = coalesce(v_conv, conv_id),
         status       = 'ended',
         ended_at     = now()
   where id = p_session;

  return jsonb_build_object('ok', true, 'seconds', greatest(least(coalesce(p_seconds, v_res), v_res), 0));
end $$;

-- ── DE QUEM É ESTA CONVERSA (atribuição do webhook pós-chamada) ─────────────────────────────
-- O webhook da ElevenLabs identifica o tenant por dynamic_variables.client_email (forjável pelo
-- navegador numa sessão web!) ou pelo agent_id. Quando nenhum dos dois resolve, ESTA é a fonte
-- honesta: o conversation_id foi carimbado pelo NOSSO servidor, dentro da sessão que o NOSSO
-- servidor abriu. Devolve '' quando não conhece — nunca chuta um tenant.
create or replace function public.voice_web_owner(p_secret text, p_conv text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select client_email into v_email from voice_web_sessions
   where conv_id = nullif(trim(coalesce(p_conv,'')),'') limit 1;
  return coalesce(v_email, '');
end $$;

-- ── LEITURA (painel/prova): quanto de voz-web este cliente usou hoje ────────────────────────
create or replace function public.voice_web_stats(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(coalesce(p_email,'')));
  v_lim public.voice_web_limits%rowtype;
  v_seg int; v_n int; v_abertas int;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select * into v_lim from voice_web_limits where client_email = v_tenant;
  if not found then v_lim.session_seconds := 240; v_lim.daily_seconds := 3600; v_lim.daily_sessions := 40; v_lim.enabled := true; end if;
  select coalesce(sum(coalesce(seconds_used, reserved_seconds)),0), count(*), count(*) filter (where ended_at is null)
    into v_seg, v_n, v_abertas
    from voice_web_sessions
   where client_email = v_tenant and created_at >= date_trunc('day', now());
  return jsonb_build_object(
    'ok', true, 'enabled', v_lim.enabled, 'hoje_segundos', v_seg, 'hoje_sessoes', v_n, 'abertas', v_abertas,
    'teto_sessao', v_lim.session_seconds, 'teto_dia', v_lim.daily_seconds, 'teto_sessoes', v_lim.daily_sessions
  );
end $$;

-- ── PORTAS: só o service_role. anon e public não executam nada disto. ───────────────────────
revoke all on function public.voice_web_reserve(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.voice_web_end(text,uuid,int,text)           from public, anon, authenticated;
revoke all on function public.voice_web_owner(text,text)                  from public, anon, authenticated;
revoke all on function public.voice_web_stats(text,text)                  from public, anon, authenticated;

-- PROVA (rodar depois do paste):
--   select public.voice_web_reserve('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com','demo','agent_X','iptest');
--   -- guarde o session_id devolvido:
--   select public.voice_web_end('glo_ing_c7f2a9e4b8d16350','<session_id>'::uuid, 37, 'conv_TESTE');
--   select public.voice_web_owner('glo_ing_c7f2a9e4b8d16350','conv_TESTE');   -- demo@guileoai.com
--   select public.voice_web_stats('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com');
--   delete from public.voice_web_sessions where client_email='demo@guileoai.com';
