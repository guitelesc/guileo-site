-- ═════════════════════════════════════════════════════════════════════════════
-- seller_email_registered — does this email belong to an active seller, and does it
-- already have a PERSONAL code? Lets /api/seller-login block the shared team-invite
-- code from impersonating a seller who has already locked their identity with a
-- personal code (the commission-attribution security gap). Read-only, INGEST-gated.
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.seller_email_registered(
  p_secret text, p_email text
) returns json
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_has_code boolean;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_email = '' then return json_build_object('registered', false, 'has_code', false); end if;

  select (personal_code is not null and length(trim(personal_code)) > 0)
    into v_has_code
    from public.sellers
   where email = v_email and active
   order by created_at asc
   limit 1;

  if not found then return json_build_object('registered', false, 'has_code', false); end if;
  return json_build_object('registered', true, 'has_code', coalesce(v_has_code, false));
exception
  when sqlstate '28000' then raise;
  when others then return json_build_object('registered', false, 'has_code', false); -- degrade, never block login
end $fn$;

grant execute on function public.seller_email_registered(text, text) to anon;
