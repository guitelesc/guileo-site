-- CONSENTIMENTO REGISTRADO (CR-11, 2026-10-13).
-- "Ofertas por telefone e SMS só vão para quem aceitou recebê-las. Essa permissão é pedida no agendamento."
-- ============================================================================
-- POR QUE EXISTE
--   crm_contacts.consent_sms / consent_call nascem TRUE por padrão (crm_spine.sql). Isso é PRESUNÇÃO, não
--   permissão: promoção por telefone a celular (TCPA) e por SMS exige consentimento expresso, e um auditor
--   pergunta "quem, quando, de onde, com que prova". Esta tabela é a resposta. A régua das campanhas
--   (consent_audience) lê DAQUI — nunca da coluna presumida.
-- O QUE GRAVA
--   uma linha por decisão: canal, sim/não, de onde veio (site_agendamento · balcao · ligacao · formulario ·
--   importacao) e a prova (texto da caixa marcada + hora, quem registrou no balcão, etc.). Nunca apaga:
--   "revogou" é uma linha nova com granted=false. A coluna do CRM é atualizada como ESPELHO do último registro.
-- PORTÕES: consent_record / consent_latest / consent_audience = INGEST (servidor, service_role);
--          desk_consent_get / desk_consent_set = _desk_ok (a tela do Balcão, como as outras desk_*).
-- Idempotente. RLS ligada, sem policy anon.
-- ============================================================================

create table if not exists public.crm_consent_log (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  contact_key  text not null,              -- _contato_chave(telefone ou e-mail)
  channel      text not null check (channel in ('sms', 'call', 'whatsapp', 'email')),
  granted      boolean not null,
  source       text not null,              -- site_agendamento | balcao | ligacao | formulario | importacao
  evidence     text,                       -- o que prova (caixa marcada + hora + reserva; quem registrou)
  at           timestamptz not null default now()
);
create index if not exists crm_consent_log_idx on public.crm_consent_log (client_email, contact_key, channel, at desc);
alter table public.crm_consent_log enable row level security;

-- espelho no CRM: a coluna presumida passa a refletir o ÚLTIMO registro daquela pessoa naquele canal
create or replace function public._consent_espelhar(p_tenant text, p_ckey text, p_channel text, p_granted boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_channel = 'sms' then
    update crm_contacts set consent_sms = p_granted, updated_at = now()
     where client_email = p_tenant and (phone_key = p_ckey or lower(email) = p_ckey);
  elsif p_channel = 'call' then
    update crm_contacts set consent_call = p_granted, updated_at = now()
     where client_email = p_tenant and (phone_key = p_ckey or lower(email) = p_ckey);
  end if;
end $$;
revoke all on function public._consent_espelhar(text, text, text, boolean) from public, anon, authenticated;

-- SERVIDOR: grava uma decisão. Devolve o id da linha (prova de gravação) ou levanta 28000.
create or replace function public.consent_record(
  p_secret text, p_email text, p_contact text, p_channel text, p_granted boolean,
  p_source text default 'servidor', p_evidence text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_t text := lower(trim(coalesce(p_email, ''))); v_k text := public._contato_chave(p_contact); v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_t = '' or coalesce(v_k, '') = '' then raise exception 'contact required'; end if;
  if p_channel not in ('sms', 'call', 'whatsapp', 'email') then raise exception 'bad channel'; end if;
  insert into crm_consent_log (client_email, contact_key, channel, granted, source, evidence)
  values (v_t, v_k, p_channel, coalesce(p_granted, false), left(coalesce(p_source, 'servidor'), 40), left(p_evidence, 400))
  returning id into v_id;
  perform public._consent_espelhar(v_t, v_k, p_channel, coalesce(p_granted, false));
  return v_id;
end $$;
revoke all on function public.consent_record(text, text, text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.consent_record(text, text, text, text, boolean, text, text) to service_role;

-- o último registro por canal de UMA pessoa: {sms:{granted,at,source}|null, call:…, whatsapp:…, email:…}
create or replace function public._consent_ultimo(p_tenant text, p_ckey text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(x.channel, jsonb_build_object('granted', x.granted, 'at', x.at, 'source', x.source)), '{}'::jsonb)
    from (select distinct on (channel) channel, granted, at, source
            from crm_consent_log where client_email = p_tenant and contact_key = p_ckey
           order by channel, at desc) x
$$;
revoke all on function public._consent_ultimo(text, text) from public, anon, authenticated;

create or replace function public.consent_latest(p_secret text, p_email text, p_contact text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return public._consent_ultimo(lower(trim(coalesce(p_email, ''))), public._contato_chave(p_contact));
end $$;
revoke all on function public.consent_latest(text, text, text) from public, anon, authenticated;
grant execute on function public.consent_latest(text, text, text) to service_role;

-- A RÉGUA DAS CAMPANHAS: quem tem o último registro = SIM naquele canal. Só isso entra numa promoção.
create or replace function public.consent_audience(p_secret text, p_email text, p_channel text, p_limit int default 500)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_t text := lower(trim(coalesce(p_email, '')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('contact_key', u.contact_key, 'at', u.at, 'source', u.source,
                                        'name', c.full_name, 'phone', c.phone, 'email', c.email))
      from (select distinct on (contact_key) contact_key, granted, at, source
              from crm_consent_log where client_email = v_t and channel = p_channel
             order by contact_key, at desc limit greatest(1, least(coalesce(p_limit, 500), 2000))) u
      left join lateral (select full_name, phone, email from crm_contacts c
                          where c.client_email = v_t and (c.phone_key = u.contact_key or lower(c.email) = u.contact_key)
                          limit 1) c on true
     where u.granted), '[]'::jsonb);
end $$;
revoke all on function public.consent_audience(text, text, text, int) from public, anon, authenticated;
grant execute on function public.consent_audience(text, text, text, int) to service_role;

-- BALCÃO (tela da ficha da cliente): ler e registrar, com a chave da dona (_desk_ok levanta 28000 se errada).
create or replace function public.desk_consent_get(p_email text, p_key text, p_contact text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := public._desk_ok(p_email, p_key); ck text := public._contato_chave(p_contact);
begin
  if coalesce(ck, '') = '' then return jsonb_build_object('ok', false, 'reason', 'invalid_contact'); end if;
  return jsonb_build_object('ok', true, 'contact_key', ck, 'consent', public._consent_ultimo(e, ck));
end $$;
revoke all on function public.desk_consent_get(text, text, text) from public, anon, authenticated;
grant execute on function public.desk_consent_get(text, text, text) to anon, authenticated, service_role;

create or replace function public.desk_consent_set(p_email text, p_key text, p_contact text, p_channel text, p_granted boolean, p_evidence text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := public._desk_ok(p_email, p_key); ck text := public._contato_chave(p_contact); v_id uuid;
begin
  if coalesce(ck, '') = '' then return jsonb_build_object('ok', false, 'reason', 'invalid_contact'); end if;
  if p_channel not in ('sms', 'call', 'whatsapp', 'email') then return jsonb_build_object('ok', false, 'reason', 'bad_channel'); end if;
  insert into crm_consent_log (client_email, contact_key, channel, granted, source, evidence)
  values (e, ck, p_channel, coalesce(p_granted, false), 'balcao', left(coalesce(p_evidence, 'registrado no Balcão'), 400))
  returning id into v_id;
  perform public._consent_espelhar(e, ck, p_channel, coalesce(p_granted, false));
  return jsonb_build_object('ok', true, 'id', v_id, 'consent', public._consent_ultimo(e, ck));
end $$;
revoke all on function public.desk_consent_set(text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.desk_consent_set(text, text, text, text, boolean, text) to anon, authenticated, service_role;
