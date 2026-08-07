-- db/phone_reengage.sql  ·  PHONE RE-ENGAGEMENT EXECUTOR (#19)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com).  Idempotent — safe to re-run.
-- Turns a queued churn-reengage / booking-recovery client_event that carries a PHONE
-- (not an email) into a real Gui callback. Cross-tenant READ (the cron sweep is platform-wide,
-- like proactive.js) + a claim table so a re-run never double-dials. INGEST-gated (same literal
-- as the ingest pipeline), SECURITY DEFINER, and locked to service_role (PII: returns phone
-- numbers; money: triggers outbound calls) — anon EXECUTE is revoked. RLS on, no anon policies.

create table if not exists public.phone_reengage_claims (
  event_id     uuid primary key,
  client_email text,
  claimed_at   timestamptz not null default now()
);
alter table public.phone_reengage_claims enable row level security;

-- READ: due phone re-engagement intents across all tenants.
-- DUE = a recent (<=3d) client_event whose payload.kind is churn-reengage|booking-recovery,
-- whose payload.contact is a PHONE (>=8 digits, no '@'), that has NOT already been emailed
-- (via<>'email') nor marked watch-only (suggested<>'watch'), and is NOT yet claimed.
create or replace function public.phone_reengage_due(p_secret text, p_limit int default 30)
returns table(event_id uuid, client_email text, contact text, name text, kind text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  return query
    select e.id,
           lower(e.client_email),
           regexp_replace(coalesce(e.payload->>'contact',''), '[^0-9+]', '', 'g') as contact,
           coalesce(nullif(e.payload->>'name',''), '') as name,
           coalesce(e.payload->>'kind','') as kind,
           e.created_at
    from public.client_events e
    left join public.phone_reengage_claims c on c.event_id = e.id
    where c.event_id is null
      and coalesce(e.payload->>'kind','') in ('churn-reengage','booking-recovery')
      and e.created_at > now() - interval '3 days'
      and coalesce(e.payload->>'via','')       <> 'email'   -- already reactivated by email
      and coalesce(e.payload->>'suggested','') <> 'watch'   -- 'watch' = monitor only, never dial
      and position('@' in coalesce(e.payload->>'contact','')) = 0
      and length(regexp_replace(coalesce(e.payload->>'contact',''), '[^0-9]', '', 'g')) >= 8
    order by e.created_at asc
    limit greatest(1, least(coalesce(p_limit,30), 100));
end;
$$;

-- CLAIM: atomically win an event exactly once (dedup). Returns true only for the winner.
create or replace function public.phone_reengage_claim(p_secret text, p_event_id uuid, p_client_email text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_ins int;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  insert into public.phone_reengage_claims(event_id, client_email)
  values (p_event_id, lower(trim(coalesce(p_client_email,''))))
  on conflict (event_id) do nothing;
  get diagnostics v_ins = row_count;
  return v_ins > 0;
end;
$$;

-- LOCK DOWN: PII/money RPCs — service_role only, anon/public revoked.
revoke all on function public.phone_reengage_due(text,int)         from public;
revoke all on function public.phone_reengage_due(text,int)         from anon;
revoke all on function public.phone_reengage_claim(text,uuid,text) from public;
revoke all on function public.phone_reengage_claim(text,uuid,text) from anon;
grant execute on function public.phone_reengage_due(text,int)         to service_role;
grant execute on function public.phone_reengage_claim(text,uuid,text) to service_role;