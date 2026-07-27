-- ============================================================================
-- Guileo · SELLER NOTIFY — lookups para avisar o vendedor nos momentos de ouro
-- (cliente nasceu / pagamento atribuído). INGEST-gated, read-only, idempotente.
-- ============================================================================

-- Quem é o vendedor DONO deste cliente (carteira permanente)? → {email, name}
create or replace function public.seller_of_client(p_secret text, p_client_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select jsonb_build_object('email', s.email, 'name', coalesce(s.name, split_part(s.email,'@',1)))
    into v
    from onboard_drafts d
    join sellers s on s.email = coalesce(d.assigned_seller, d.seller_email) and s.active
   where d.client_email = lower(trim(p_client_email))
   order by d.created_at desc limit 1;
  return coalesce(v, 'null'::jsonb);
end $$;

-- Vendedor por ref_slug (o ?ref= do checkout) → {email, name}
create or replace function public.seller_by_ref(p_secret text, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select jsonb_build_object('email', s.email, 'name', coalesce(s.name, split_part(s.email,'@',1)))
    into v from sellers s
   where s.active and s.ref_slug = lower(trim(coalesce(p_ref,'')))
   limit 1;
  return coalesce(v, 'null'::jsonb);
end $$;

grant execute on function public.seller_of_client(text,text) to anon;
grant execute on function public.seller_by_ref(text,text)    to anon;

-- ✅ onboard-client.js (cliente live) e stripe-webhook.js (attribution) usam estes
--    lookups pra mandar sellerClientLiveEmail / sellerCommissionEmail (emailTemplates.js).
