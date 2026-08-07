-- ============================================================================
-- Guileo · CLIENT AGENTS REGISTRY  (paste in Supabase → SQL Editor → Run)
-- Project ynihodbknhjirkdogxby (smart@guileoai.com).
-- ----------------------------------------------------------------------------
-- ONE accessible place that maps a tenant → their ElevenLabs agent + outbound number,
-- so /api/call can dial a speed-to-lead callback AS the client's OWN Gui (their voice,
-- name, prices, KB, and — when set — their own caller-ID), not the shared platform agent.
--
-- WHY: the per-client agent_id was scattered / on an inaccessible project (client_by_agent
-- reads a table this DB can't see; natura's agent_id was in NO readable table). This registry
-- is the single forward lookup email → { agent_id, el_phone_number_id, number }. Provisioning
-- (onboard-client.js) writes it at agent-birth; /api/call reads it (only on the internal,
-- DIGEST-gated dial path — a public caller can never request another tenant's agent).
--
-- CONTRACT: INGEST-gated on the literal, SECURITY DEFINER, tenant-scoped, idempotent.
-- RLS ON, no anon policy. Safe to paste twice.
-- ============================================================================

create table if not exists public.client_agents (
  client_email       text primary key,
  agent_id           text,                  -- ElevenLabs conversational-AI agent id (the client's Gui)
  el_phone_number_id text,                  -- ElevenLabs phone_number_id (their imported number) for outbound caller-ID
  number             text,                  -- the E.164 number (display/reference)
  updated_at         timestamptz not null default now()
);
alter table public.client_agents enable row level security;   -- no anon policy; RPC-only door

-- ── WRITE (provisioning): upsert what we know; nulls never clobber a good value. ──
create or replace function public.client_agent_upsert(
  p_secret text, p_email text, p_agent_id text, p_el_phone_number_id text default null, p_number text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'tenant required' using errcode = '22023'; end if;
  insert into client_agents (client_email, agent_id, el_phone_number_id, number, updated_at)
  values (v_tenant, nullif(trim(coalesce(p_agent_id,'')),''), nullif(trim(coalesce(p_el_phone_number_id,'')),''),
          nullif(trim(coalesce(p_number,'')),''), now())
  on conflict (client_email) do update set
    agent_id           = coalesce(nullif(trim(coalesce(excluded.agent_id,'')),''),           client_agents.agent_id),
    el_phone_number_id = coalesce(nullif(trim(coalesce(excluded.el_phone_number_id,'')),''), client_agents.el_phone_number_id),
    number             = coalesce(nullif(trim(coalesce(excluded.number,'')),''),             client_agents.number),
    updated_at = now();
  return jsonb_build_object('ok', true, 'email', v_tenant);
end $$;

-- ── READ (call.js, internal dial path): email → { agent_id, el_phone_number_id, number }. ──
-- Returns null fields when the tenant has no registered agent → /api/call falls back to the
-- platform agent (no regression). Never returns another tenant's row.
create or replace function public.client_agent_resolve(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_agent text; v_pn text; v_num text; v_cc_agent text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then return jsonb_build_object('agent_id', null, 'el_phone_number_id', null, 'number', null); end if;
  select agent_id, el_phone_number_id, number into v_agent, v_pn, v_num from client_agents where client_email = v_tenant;
  -- FALLBACK: many clients already have their agent_id on client_credits.agent_id (set_client_agent),
  -- so a client with no client_agents row still dials AS their own Gui (platform caller-ID until a
  -- number is registered here). el_phone_number_id only comes from client_agents (new onboards).
  if v_agent is null then
    begin select agent_id into v_cc_agent from client_credits where client_email = v_tenant; exception when others then v_cc_agent := null; end;
    v_agent := nullif(trim(coalesce(v_cc_agent,'')),'');
  end if;
  return jsonb_build_object('agent_id', v_agent, 'el_phone_number_id', v_pn, 'number', v_num);
end $$;

grant execute on function public.client_agent_upsert(text,text,text,text,text) to anon;
grant execute on function public.client_agent_resolve(text,text)                to anon;

-- one-time backfill: seed client_agents from any agent_id already on client_credits (idempotent).
insert into public.client_agents (client_email, agent_id)
select client_email, agent_id from public.client_credits
where agent_id is not null and trim(agent_id) <> ''
on conflict (client_email) do update set agent_id = coalesce(client_agents.agent_id, excluded.agent_id);

-- PROOF:
-- select public.client_agent_upsert('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com','agent_ABC','pn_XYZ','+15551230000');
-- select public.client_agent_resolve('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com');   -- {agent_id:agent_ABC, el_phone_number_id:pn_XYZ, number:+15551230000}
-- select public.client_agent_resolve('glo_ing_c7f2a9e4b8d16350','nobody@guileoai.com'); -- {agent_id:null,...} → call.js uses platform agent
-- delete from client_agents where client_email='demo@guileoai.com';
