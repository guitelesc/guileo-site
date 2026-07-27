-- ─────────────────────────────────────────────────────────────────────────────
-- SELLER / COLLABORATOR ROSTER for the /vendedor hub.
--
-- HOW LOGIN WORKS TODAY (no SQL needed to go live):
--   /api/seller-login validates {email, code} against env.SELLER_ROSTER — a JSON array
--   you set in Cloudflare Pages → Settings → Environment variables (Production).
--   Until SELLER_ROSTER is set, a bootstrap roster in the function source lets the owner in
--   (luistelesc@gmail.com / smart@guileoai.com with code GUILEO-DONO — ROTATE before sharing).
--
--   The code is validated SERVER-SIDE and never ships in the browser bundle. On success the
--   endpoint returns only {name, email, ref}; `ref` feeds the existing ?ref= attribution so
--   each seller's Track-A signups are credited to them.
--
-- EXAMPLE SELLER_ROSTER value (paste as the env var, one line):
--   [{"email":"maria@parceiro.com","code":"MARIA-7F3K","name":"Maria Silva","ref":"maria"},
--    {"email":"joao@parceiro.com","code":"JOAO-2P9X","name":"João Souza","ref":"joao"}]
--
-- Give each seller a STRONG, unique code. To rotate/revoke, edit the env var and redeploy.
-- ─────────────────────────────────────────────────────────────────────────────

-- OPTIONAL (later): move the roster into the DB so it can be managed without redeploys.
-- The table below is the target shape; wiring /api/seller-login to read it is a follow-up
-- (do it once the Supabase MCP is connected, or via the service-role REST endpoint).
create table if not exists sellers (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  code        text not null,              -- access code (store a hash in a hardened version)
  name        text,
  ref         text,                       -- attribution slug for ?ref=
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- RLS: never expose codes to the anon client. Reads happen only via the service role
-- inside /api/seller-login. Lock the table down so PostgREST/anon cannot select it.
alter table sellers enable row level security;
-- (no anon policy on purpose → anon/PostgREST get zero rows; the Pages Function uses the
--  service role which bypasses RLS.)

-- Seed example (edit / remove):
-- insert into sellers (email, code, name, ref) values
--   ('maria@parceiro.com', 'MARIA-7F3K', 'Maria Silva', 'maria')
-- on conflict (email) do update set code = excluded.code, name = excluded.name, ref = excluded.ref;
