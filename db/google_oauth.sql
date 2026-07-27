-- Google Business OAuth handshake — server-side state store (CSRF + tenant binding).
-- The OAuth `state` travels to Google and back in the URL, so it must be an OPAQUE random
-- token, never the tenant's connection key. This table maps state → email, server-side only.
-- Lifecycle: gbp_oauth_begin(email) mints a state row → callback calls gbp_oauth_claim(state)
-- which returns the email exactly once (marks used) and only if not expired (10 min TTL).
-- Gated by the INGEST literal, SECURITY DEFINER, EXCEPTION-wrapped, idempotent.

create table if not exists public.google_oauth_pending (
  state       text primary key,
  email       text not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '10 minutes'
);
alter table public.google_oauth_pending enable row level security;  -- no anon policy → locked

-- MINT: create a fresh random state for this tenant email. Returns the state token.
create or replace function public.gbp_oauth_begin(p_secret text, p_email text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_state text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then return null; end if;
  if coalesce(p_email,'') = '' then return null; end if;
  -- opaque, unguessable; core pg_catalog gen_random_uuid (gen_random_bytes lives in the
  -- `extensions` schema on Supabase and is invisible under search_path=public). 64 hex chars.
  v_state := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  insert into public.google_oauth_pending(state, email) values (v_state, lower(p_email));
  -- opportunistic GC of stale rows (keeps the table tiny)
  delete from public.google_oauth_pending where expires_at < now() - interval '1 hour';
  return v_state;
exception when others then return null;
end $$;

-- CLAIM: exchange a state for its email exactly once. Returns null if unknown/used/expired.
create or replace function public.gbp_oauth_claim(p_secret text, p_state text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then return null; end if;
  update public.google_oauth_pending
     set used = true
   where state = p_state and used = false and expires_at > now()
   returning email into v_email;
  return v_email;  -- null when no row matched (bad/used/expired state)
exception when others then return null;
end $$;
