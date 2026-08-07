-- ============================================================================
-- GUILEO · CAPTURE TOOLS  (paste in Supabase → SQL Editor → Run · project ynihodbknhjirkdogxby)
-- Idempotent. Turns every touchpoint into a captured lead:
--   1. intake_forms + intake_submissions — a business builds a pre-visit form; a customer fills it
--      via a link (public submit). Each submission best-effort becomes a CRM lead (crm_upsert_contact).
--   2. photo_quotes — a home-services customer sends a photo URL + description; the owner sees it in
--      the cockpit and sets a price. (Photo is a URL for now — actual upload/storage is a later step.)
--   3. gb_creds_lookup — reads a tenant's stored Google Business credentials for the (PENDING) review
--      connector; inert until env.GOOGLE_BUSINESS_* + tenant connect.
--
-- SECURITY: every RPC is SECURITY DEFINER, INGEST-gated by the same literal the ingest pipeline uses
-- ('glo_ing_c7f2a9e4b8d16350'), granted to anon, and CLIENT-SCOPED by p_email — no tenant can read/write
-- another tenant's forms, submissions or photo-quotes. Tables have RLS ON so only the definer funcs
-- reach them. crm_upsert_contact (scheduling-gated) is called from inside the definer with the sched
-- literal 'gss_Kp9mX4vR2tZ7nQ5wL8bc' (best-effort: missing func just skips the CRM lead, never errors).
-- ============================================================================

-- ── TABLES ──────────────────────────────────────────────────────────────────
create table if not exists intake_forms (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  name text not null,
  fields jsonb not null default '[]'::jsonb,   -- [{key,label,type,required}]
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_intake_forms_email on intake_forms(client_email, created_at desc);

create table if not exists intake_submissions (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  form_id uuid not null references intake_forms(id) on delete cascade,
  contact jsonb not null default '{}'::jsonb,   -- {name,phone,email}
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_intake_subs_email on intake_submissions(client_email, created_at desc);
create index if not exists idx_intake_subs_form on intake_submissions(form_id, created_at desc);

create table if not exists photo_quotes (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  contact text,                                 -- phone/email/handle the customer left
  name text,
  photo_url text,
  note text,
  status text not null default 'pending',       -- pending | quoted | won | lost
  quote_cents int,
  created_at timestamptz not null default now()
);
create index if not exists idx_photo_quotes_email on photo_quotes(client_email, created_at desc);

-- ── RLS: locked; only the SECURITY DEFINER funcs below reach these tables ─────
alter table intake_forms       enable row level security;
alter table intake_submissions enable row level security;
alter table photo_quotes       enable row level security;

-- ── helper: uniform INGEST gate ──────────────────────────────────────────────
create or replace function public._capture_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret is not distinct from 'glo_ing_c7f2a9e4b8d16350' $$;

-- ── INTAKE FORMS: upsert (create/edit) — tenant-scoped ────────────────────────
create or replace function public.intake_form_upsert(
  p_secret text, p_email text, p_id uuid, p_name text,
  p_fields jsonb default '[]'::jsonb, p_active boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_id uuid;
begin
  if not public._capture_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_id is not null then
    update intake_forms set
      name = coalesce(nullif(p_name,''), name),
      fields = coalesce(p_fields, fields),
      active = coalesce(p_active, active)
    where id = p_id and client_email = v_tenant
    returning id into v_id;
    if v_id is not null then return v_id; end if;
  end if;
  insert into intake_forms(client_email, name, fields, active)
  values (v_tenant, coalesce(nullif(p_name,''),'Formulário'), coalesce(p_fields,'[]'::jsonb), coalesce(p_active,true))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.intake_form_upsert(text,text,uuid,text,jsonb,boolean) to anon;

-- ── INTAKE FORMS: list (tenant's forms, newest first) ─────────────────────────
create or replace function public.intake_form_list(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email));
begin
  if not public._capture_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', f.id, 'name', f.name, 'fields', f.fields, 'active', f.active,
             'created_at', f.created_at,
             'submissions', (select count(*) from intake_submissions s where s.form_id = f.id)
           ) order by f.created_at desc)
    from intake_forms f where f.client_email = v_tenant
  ), '[]'::jsonb);
end $$;
grant execute on function public.intake_form_list(text,text) to anon;

-- ── INTAKE SUBMIT (PUBLIC): a customer fills a form via link. Tenant is DERIVED from the
--    form (never trusted from the caller) so a public link can't write into another tenant.
--    Best-effort: also upserts a crm_contacts lead so the capture becomes a CRM lead. ──
create or replace function public.intake_submit(
  p_secret text, p_form_id uuid, p_contact jsonb, p_answers jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text; v_active boolean; v_sub uuid;
  v_name text := nullif(trim(coalesce(p_contact->>'name','')),'');
  v_phone text := nullif(trim(coalesce(p_contact->>'phone','')),'');
  v_email text := nullif(trim(coalesce(p_contact->>'email','')),'');
begin
  if not public._capture_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  select client_email, active into v_tenant, v_active from intake_forms where id = p_form_id;
  if v_tenant is null then raise exception 'unknown form' using errcode = 'P0002'; end if;
  if v_active is not true then raise exception 'form closed' using errcode = 'P0001'; end if;

  insert into intake_submissions(client_email, form_id, contact, answers)
  values (v_tenant, p_form_id, coalesce(p_contact,'{}'::jsonb), coalesce(p_answers,'{}'::jsonb))
  returning id into v_sub;

  -- best-effort → capture becomes a CRM lead (scheduling-gated func; skip silently if absent)
  begin
    perform public.crm_upsert_contact(
      'gss_Kp9mX4vR2tZ7nQ5wL8bc', v_tenant, v_phone, v_email, v_name, 'intake-form', 0
    );
  exception when undefined_function or others then null; end;

  return v_sub;
end $$;
grant execute on function public.intake_submit(text,uuid,jsonb,jsonb) to anon;

-- ── INTAKE SUBMISSIONS: list (all forms, or one form via p_form_id) — tenant-scoped ──
create or replace function public.intake_submissions_list(
  p_secret text, p_email text, p_form_id uuid default null, p_limit int default 200
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_lim int := greatest(1, least(coalesce(p_limit,200), 1000));
begin
  if not public._capture_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)) from (
      select s.id, s.form_id, f.name as form_name, s.contact, s.answers, s.created_at
      from intake_submissions s
      left join intake_forms f on f.id = s.form_id
      where s.client_email = v_tenant
        and (p_form_id is null or s.form_id = p_form_id)
      order by s.created_at desc limit v_lim
    ) t
  ), '[]'::jsonb);
end $$;
grant execute on function public.intake_submissions_list(text,text,uuid,int) to anon;

-- ── PHOTO QUOTE (PUBLIC create): customer submits a photo URL + description → pending quote.
--    Also best-effort upserts a CRM lead. Photo is a URL string for now (upload = later step). ──
create or replace function public.photo_quote_create(
  p_secret text, p_email text, p_contact text, p_name text, p_photo_url text, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_id uuid;
begin
  if not public._capture_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'no tenant' using errcode = 'P0002'; end if;
  insert into photo_quotes(client_email, contact, name, photo_url, note, status)
  values (v_tenant, nullif(trim(coalesce(p_contact,'')),''), nullif(trim(coalesce(p_name,'')),''),
          nullif(trim(coalesce(p_photo_url,'')),''), nullif(trim(coalesce(p_note,'')),''), 'pending')
  returning id into v_id;

  begin
    perform public.crm_upsert_contact(
      'gss_Kp9mX4vR2tZ7nQ5wL8bc', v_tenant,
      case when coalesce(p_contact,'') ~ '[0-9]' then p_contact else null end,   -- phone-ish
      case when position('@' in coalesce(p_contact,'')) > 0 then p_contact else null end,  -- email-ish
      nullif(trim(coalesce(p_name,'')),''), 'photo-quote', 0
    );
  exception when undefined_function or others then null; end;

  return v_id;
end $$;
grant execute on function public.photo_quote_create(text,text,text,text,text,text) to anon;

-- ── PHOTO QUOTES: list (all, or by status) — tenant-scoped ────────────────────
create or replace function public.photo_quote_list(
  p_secret text, p_email text, p_status text default null, p_limit int default 200
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_lim int := greatest(1, least(coalesce(p_limit,200), 1000));
begin
  if not public._capture_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', q.id, 'contact', q.contact, 'name', q.name, 'photo_url', q.photo_url,
             'note', q.note, 'status', q.status, 'quote_cents', q.quote_cents, 'created_at', q.created_at
           ) order by q.created_at desc)
    from photo_quotes q
    where q.client_email = v_tenant
      and (p_status is null or q.status = p_status)
    limit v_lim
  ), '[]'::jsonb);
end $$;
grant execute on function public.photo_quote_list(text,text,text,int) to anon;

-- ── PHOTO QUOTE: owner sets a price (and optional status) — tenant-scoped ──────
create or replace function public.photo_quote_quote(
  p_secret text, p_email text, p_id uuid, p_quote_cents int, p_status text default 'quoted'
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_hit int;
begin
  if not public._capture_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  update photo_quotes set
    quote_cents = case when p_quote_cents is null then quote_cents else greatest(p_quote_cents, 0) end,
    status = coalesce(nullif(p_status,''), status)
  where id = p_id and client_email = v_tenant;
  get diagnostics v_hit = row_count;
  return v_hit > 0;
end $$;
grant execute on function public.photo_quote_quote(text,text,uuid,int,text) to anon;

-- ── GOOGLE BUSINESS creds lookup — reads a tenant's stored Google Business tokens (written by the
--    'connect' action via store_integration, provider='google_business'). Same shape as mb_creds_lookup.
--    INGEST-gated. The review connector (functions/api/google-business.js) is INERT until env is set. ──
create or replace function public.gb_creds_lookup(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._capture_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select tokens from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'google_business'
    limit 1
  );
exception when undefined_table then return null;
end $$;
grant execute on function public.gb_creds_lookup(text,text) to anon;

-- ✅ Done. LIVE: intake forms + public submit (→ CRM lead) + photo-quotes (→ CRM lead) + owner-set price.
--    PENDING: gb_creds_lookup feeds the Google Business review connector, inert until env.GOOGLE_BUSINESS_*.
