-- ============================================================================
-- GUILEO · TENANT KNOWLEDGE BASE  (paste in Supabase → SQL Editor → Run · project ynihodbknhjirkdogxby)
-- Idempotent. The "Cérebro do negócio": each tenant curates Q&A the AI answers FROM — the
-- business-specific facts a call/chat visitor asks ("Do you take walk-ins? Parking? Cancellation
-- policy?"). Gui (voice + web widget) reads the ACTIVE entries and answers precisely instead of
-- deferring to the team.
--
-- SECURITY: every RPC is SECURITY DEFINER, INGEST-gated by the same literal the ingest pipeline
-- uses ('glo_ing_c7f2a9e4b8d16350'), granted to anon, and CLIENT-SCOPED by p_email — no tenant can
-- read/write another tenant's KB. The table has RLS ON so only the definer funcs reach it.
-- The HTTP surface (/api/kb) additionally binds email↔connection-key via get_client_data before
-- ever calling these, so a client token only ever touches its OWN tenant's KB.
-- ============================================================================

-- ── TABLE ────────────────────────────────────────────────────────────────────
create table if not exists client_kb (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  question text not null,
  answer text not null default '',
  category text not null default 'general',   -- general | hours | policy | payment | location | services | other
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists idx_client_kb_email on client_kb(client_email, updated_at desc);
create index if not exists idx_client_kb_active on client_kb(client_email, active);

-- ── RLS: locked; only the SECURITY DEFINER funcs below reach this table ───────
alter table client_kb enable row level security;

-- ── helper: uniform INGEST gate ──────────────────────────────────────────────
create or replace function public._kb_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret is not distinct from 'glo_ing_c7f2a9e4b8d16350' $$;

-- ── UPSERT (create/edit a Q&A) — tenant-scoped ───────────────────────────────
create or replace function public.kb_upsert(
  p_secret text, p_email text, p_id uuid,
  p_question text, p_answer text default '',
  p_category text default 'general', p_active boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_id uuid;
begin
  if not public._kb_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  if nullif(trim(coalesce(p_question,'')),'') is null then raise exception 'question required' using errcode = 'P0001'; end if;
  if p_id is not null then
    update client_kb set
      question = coalesce(nullif(trim(p_question),''), question),
      answer = coalesce(p_answer, answer),
      category = coalesce(nullif(trim(p_category),''), category),
      active = coalesce(p_active, active),
      updated_at = now()
    where id = p_id and client_email = v_tenant
    returning id into v_id;
    if v_id is not null then return v_id; end if;   -- fell through = not this tenant's row → insert new
  end if;
  insert into client_kb(client_email, question, answer, category, active)
  values (v_tenant, trim(p_question), coalesce(p_answer,''), coalesce(nullif(trim(p_category),''),'general'), coalesce(p_active,true))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.kb_upsert(text,text,uuid,text,text,text,boolean) to anon;

-- ── DELETE (tenant-scoped) ───────────────────────────────────────────────────
create or replace function public.kb_delete(p_secret text, p_email text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email));
begin
  if not public._kb_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  delete from client_kb where id = p_id and client_email = v_tenant;
  return found;
end $$;
grant execute on function public.kb_delete(text,text,uuid) to anon;

-- ── LIST (tenant's KB, newest first) ─────────────────────────────────────────
create or replace function public.kb_list(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email));
begin
  if not public._kb_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', k.id, 'question', k.question, 'answer', k.answer,
             'category', k.category, 'active', k.active, 'updated_at', k.updated_at
           ) order by k.updated_at desc)
    from client_kb k where k.client_email = v_tenant
  ), '[]'::jsonb);
end $$;
grant execute on function public.kb_list(text,text) to anon;

-- ── FOR-AGENT: active entries concatenated into a compact block Gui reads at call/chat time.
--    Returns plain text ("Q: … A: …" lines), capped defensively. Empty string when nothing active. ──
create or replace function public.kb_for_agent(p_secret text, p_email text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_out text;
begin
  if not public._kb_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  select string_agg('Q: ' || k.question || ' — A: ' || nullif(trim(k.answer),''), E'\n' order by k.updated_at desc)
    into v_out
  from client_kb k
  where k.client_email = v_tenant and k.active is true and nullif(trim(k.answer),'') is not null;
  return left(coalesce(v_out, ''), 4000);   -- callers slice further (widget caps ~1200)
end $$;
grant execute on function public.kb_for_agent(text,text) to anon;
