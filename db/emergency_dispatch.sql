-- ============================================================================
-- Guileo · EMERGENCY DISPATCH  (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com)
-- THESIS (Miami): hurricane season + after-hours AC/plumbing emergencies. When a
-- caller has a REAL emergency ("no AC", "burst pipe", "flood") at 2am, an email
-- alert is not enough — the OWNER'S PHONE RINGS (real outbound voice call) so a
-- $400 emergency job is never lost to voicemail.
-- Este arquivo é o LADO DADOS: log + claim atômico (padrão marketing_date_claim,
-- db/growth_dates.sql) para que UMA emergência = UMA ligação ao dono, mesmo com
-- os retries do webhook do ElevenLabs. Tudo INGEST-gated (mesmo literal do
-- pipeline de ingest), security definer, granted to anon. RLS on, SEM policies
-- para anon (só as funções SECURITY DEFINER acessam). Client-scoped por
-- p_client_email. Idempotente (pode rodar de novo).
-- ============================================================================

-- ── TABELA: o log de emergências (também É a chave do claim/dedup) ───────────
create table if not exists public.emergency_log (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  contact      text,                                   -- telefone/email do cliente em apuros
  name         text,                                   -- quem ligou
  note         text,                                   -- o que aconteceu ("no AC", "cano estourou"…)
  called_owner boolean not null default false,         -- a ligação de voz pro dono saiu?
  dedupe_key   text not null,                          -- construído do BODY (retry-safe, nunca do timestamp puro)
  created_at   timestamptz not null default now()
);
-- UMA emergência = UMA linha: retries do webhook colidem aqui e só um vence.
create unique index if not exists emergency_log_dedupe on public.emergency_log (client_email, dedupe_key);
create index if not exists emergency_log_tenant on public.emergency_log (client_email, created_at desc);
alter table public.emergency_log enable row level security;   -- trancado; só SECURITY DEFINER acessa

-- ── CLAIM atômico (padrão marketing_date_claim): INSERT ON CONFLICT DO NOTHING.
-- Se dois retries colidem, exatamente UM leva a linha → recebe o id (e liga pro
-- dono); o outro → null (não liga de novo). Race-safe por construção.
create or replace function public.emergency_claim(
  p_secret text, p_client_email text, p_contact text, p_name text, p_note text, p_dedupe text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into emergency_log (client_email, contact, name, note, dedupe_key)
  values (lower(trim(p_client_email)), nullif(trim(coalesce(p_contact,'')),''),
          nullif(trim(coalesce(p_name,'')),''), left(coalesce(p_note,''), 500),
          coalesce(nullif(trim(p_dedupe),''),'-'))
  on conflict (client_email, dedupe_key) do nothing
  returning id into v_id;
  return v_id;   -- null = já reivindicada (retry) → NÃO ligar de novo
end $$;

-- ── Marca "o telefone do dono TOCOU" depois que a ligação de voz saiu ─────────
-- Tenant-bound: o UUID sozinho NUNCA autoriza (lei da casa) — a linha só muda se
-- pertencer ao tenant informado. A versão antiga (secret,id) é dropada.
drop function if exists public.emergency_mark_called(text, uuid);
create or replace function public.emergency_mark_called(p_secret text, p_client_email text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update emergency_log set called_owner = true
   where id = p_id and client_email = lower(trim(p_client_email));
  return found;
end $$;

-- ── LISTA pro cockpit (últimas 50 emergências do tenant) ─────────────────────
create or replace function public.emergency_list(p_secret text, p_client_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'contact', contact, 'name', name, 'note', note,
      'called_owner', called_owner, 'created_at', created_at
    ) order by created_at desc)
    from (
      select * from emergency_log
      where client_email = lower(trim(p_client_email))
      order by created_at desc limit 50
    ) e
  ), '[]'::jsonb);
end $$;

grant execute on function public.emergency_claim(text,text,text,text,text,text) to anon;
grant execute on function public.emergency_mark_called(text,text,uuid)          to anon;
grant execute on function public.emergency_list(text,text)                      to anon;
