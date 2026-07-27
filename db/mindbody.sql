-- ─────────────────────────────────────────────────────────────────────────────
-- MINDBODY — read a tenant's stored MindBody source credentials + (multi-)studio map so the
-- connector (functions/api/mindbody.js) can issue a per-site token and book into their MindBody.
-- The creds are WRITTEN by the "connect" action via store_integration (client_integrations,
-- provider='mindbody', already live in prod); this READS them. INGEST-gated (hardcoded literal —
-- Supabase forbids GUC). Idempotent. Paste in Supabase (ynihodbknhjirkdogxby).
--
-- ── tokens (jsonb) SHAPE ──────────────────────────────────────────────────────
--   {
--     "source_name":     "Guileo_xxxxxxxx",   -- MindBody SOURCE credential (developer-account
--     "source_password": "••••••••",           --   level; works across every Site the source is
--                                               --   activated on — the SiteId header selects which)
--     "site_id":  "767008",                     -- DEFAULT Site-Id (Natura → Astoria 767008)
--     "sites": {                                -- MULTI-STUDIO: biz_location NAME → MindBody Site-Id
--        "Astoria":     "767008",               --   Natura Astoria studio
--        "UES Salon":   "5734109",              --   Natura UES studio (Salon)
--        "UES Med Spa": "5734109"               --   Natura UES studio (Med Spa) — same site as Salon
--     },
--     "session_types": { "Massage": 12, "Facial": 34 },  -- OPTIONAL spoken service → SessionTypeId
--     "staff":         { "767008": 100012 }              -- OPTIONAL default StaffId per Site-Id
--   }
-- The connector's resolveSite() picks Site-Id from: args.site_id → sites[args.location] → site_id.
-- One source credential + a `sites` map = the whole Natura account (both studios) in one row.
-- Honest: no MINDBODY_API_KEY (env) OR no row here → connector returns { ready:false } and the
-- unified adapter falls back to the internal Guileo engine. Nothing breaks.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.mb_creds_lookup(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select tokens
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'mindbody'
    limit 1
  );
end $$;
grant execute on function public.mb_creds_lookup(text, text) to anon;

-- ── OPTIONAL convenience writer ───────────────────────────────────────────────
-- The connector's "connect" action already stores creds via the generic store_integration RPC.
-- This helper lets Luis paste a tenant's full multi-studio MindBody creds directly in SQL (handy
-- for Natura's two studios) without the HTTP round-trip. Same INGEST gate. Same tokens shape above.
-- Example (Natura — fill in the real source credential once MindBody partner access is granted):
--   select public.mb_creds_store('glo_ing_7f3da9c2b4e8', 'natura@guileoai.com',
--     jsonb_build_object(
--       'source_name','Guileo_XXXX', 'source_password','••••',
--       'site_id','767008',
--       'sites', jsonb_build_object('Astoria','767008','UES Salon','5734109','UES Med Spa','5734109')
--     ));
create or replace function public.mb_creds_store(p_secret text, p_email text, p_tokens jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into client_integrations (client_email, provider, tokens)
  values (lower(trim(p_email)), 'mindbody', coalesce(p_tokens, '{}'::jsonb))
  on conflict (client_email, provider) do update
    set tokens = excluded.tokens, updated_at = now();
  return true;
end $$;
grant execute on function public.mb_creds_store(text, text, jsonb) to anon;
