-- ============================================================================
-- Guileo · TENANT MONEY GUARDRAILS  (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com)
-- THESIS: "estratégia de milhões, nada de erro" — every money mutation must be
-- TENANT-BOUND, not just UUID-bound. The recurring-revenue + coupon RPCs matched
-- rows by id only, so a UUID that leaked out of one tenant's panel (screenshot,
-- support ticket, browser history) could spend/delete ANOTHER tenant's money
-- objects. This file rebinds every mutation to (client_email, id) and closes the
-- seller-commission retro-tagging hole. Idempotente (pode rodar de novo).
--
-- BACKWARD-COMPATIBLE ROLLOUT: the Pages Functions already send p_client_email
-- and FALL BACK to the legacy id-only signature on 404 — so nothing breaks before
-- this is pasted, and the legacy signatures are DROPPED here so the loose door
-- closes the moment it runs.
-- ============================================================================

-- ── 1) PACKAGE USE — atomic decrement, now tenant-bound ──────────────────────
-- Old signature dropped: package_use(p_secret, p_purchase_id) matched any tenant's
-- purchase by UUID alone (a leaked purchase id could be drained cross-tenant).
drop function if exists public.package_use(text, uuid);

create or replace function public.package_use(p_secret text, p_client_email text, p_purchase_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  -- atomic gate: decrementa só se houver saldo E a compra for DESTE tenant.
  update public.package_purchases set sessions_used = sessions_used + 1
    where id = p_purchase_id
      and client_email = lower(trim(p_client_email))
      and sessions_used < sessions_total
    returning * into v;
  if v.id is null then
    select * into v from public.package_purchases
      where id = p_purchase_id and client_email = lower(trim(p_client_email)) limit 1;
    if v.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
    return jsonb_build_object('ok', false, 'reason', 'exhausted', 'sessions_left', 0);
  end if;
  return jsonb_build_object('ok', true, 'sessions_left', greatest(v.sessions_total - v.sessions_used, 0), 'purchase', to_jsonb(v));
end $$;

grant execute on function public.package_use(text,text,uuid) to anon;

-- ── 2) PACKAGE DELETE — tenant-bound ─────────────────────────────────────────
drop function if exists public.package_delete(text, uuid);

create or replace function public.package_delete(p_secret text, p_client_email text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  delete from public.packages where id = p_id and client_email = lower(trim(p_client_email));
  return found;
end $$;

grant execute on function public.package_delete(text,text,uuid) to anon;

-- ── 3) MEMBERSHIP DELETE — tenant-bound ──────────────────────────────────────
drop function if exists public.membership_delete(text, uuid);

create or replace function public.membership_delete(p_secret text, p_client_email text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  delete from public.memberships where id = p_id and client_email = lower(trim(p_client_email));
  return found;
end $$;

grant execute on function public.membership_delete(text,text,uuid) to anon;

-- ── 4) COUPON DELETE — tenant-bound ──────────────────────────────────────────
drop function if exists public.coupon_delete(text, uuid);

create or replace function public.coupon_delete(p_secret text, p_client_email text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  delete from public.coupons where id = p_id and client_email = lower(trim(p_client_email));
  return found;
end $$;

grant execute on function public.coupon_delete(text,text,uuid) to anon;

-- ── 5) COUPON REDEEM — atomic increment, now tenant-bound ────────────────────
-- Old signature dropped: coupon_redeem(p_secret, p_id, p_contact) could burn another
-- tenant's max_redemptions cap by UUID alone.
drop function if exists public.coupon_redeem(text, uuid, text);

create or replace function public.coupon_redeem(p_secret text, p_client_email text, p_id uuid, p_contact text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  -- atomic gate: só incrementa quando ativo, dentro da janela, sob o limite E do tenant certo.
  update public.coupons set redeemed = redeemed + 1
    where id = p_id
      and client_email = lower(trim(p_client_email))
      and active
      and (starts_at is null or now() >= starts_at)
      and (expires_at is null or now() <= expires_at)
      and (max_redemptions is null or redeemed < max_redemptions)
    returning * into v;
  if v.id is null then
    -- descobre o porquê (best-effort) sem reabrir corrida — só dentro do próprio tenant.
    select * into v from public.coupons where id = p_id and client_email = lower(trim(p_client_email)) limit 1;
    if v.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
    if not v.active then return jsonb_build_object('ok', false, 'reason', 'inactive'); end if;
    if v.expires_at is not null and now() > v.expires_at then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
    if v.max_redemptions is not null and v.redeemed >= v.max_redemptions then return jsonb_build_object('ok', false, 'reason', 'exhausted'); end if;
    return jsonb_build_object('ok', false, 'reason', 'not_redeemable');
  end if;
  insert into public.coupon_redemptions (coupon_id, client_email, contact)
  values (v.id, v.client_email, nullif(trim(coalesce(p_contact,'')),''));
  return jsonb_build_object('ok', true, 'redeemed', v.redeemed, 'coupon', to_jsonb(v));
end $$;

grant execute on function public.coupon_redeem(text,text,uuid,text) to anon;

-- ── 6) SELLER CONVERSIONS — kill the RETRO-TAGGING commission hole ───────────
-- /api/lead is a public site form: anyone could post a lead with ?ref=<their-ref> and
-- contact = an EXISTING paying client's email, and the old join would credit that seller
-- with ALL of the client's historical payments. Fix: the lead must PREDATE the payment —
-- only payments recorded AFTER the seller's first attributed lead for that email count.
-- Same name + signature, so /api/seller-stats needs no change.
create or replace function public.seller_conversions(p_secret text, p_ref text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if coalesce(trim(p_ref), '') = '' then return json_build_object('converted', 0, 'paid', 0); end if;
  return (
    with leads as (
      select lower(trim(g.contact)) as email, min(g.created_at) as first_lead_at
      from gui_actions g
      where g.action = 'lead'
        and g.contact like '%@%'
        and g.details like ('%👤ref:' || trim(p_ref) || '%')
      group by lower(trim(g.contact))
    ),
    pays as (
      select e.client_email, sum(coalesce(e.amount, 0)) as paid
      from client_events e
      join leads l on lower(trim(e.client_email)) = l.email
      where e.type = 'payment'
        and e.created_at > l.first_lead_at   -- a lead tagged AFTER the money moved earns nothing
      group by e.client_email
    )
    select json_build_object(
      'converted', (select count(*) from pays),
      'paid', coalesce((select sum(paid) from pays), 0)
    )
  );
end
$$;

grant execute on function public.seller_conversions(text, text) to anon;

-- ✅ Done. package_use / package_delete / membership_delete / coupon_delete /
--    coupon_redeem are tenant-bound (the Pages Functions already send p_client_email),
--    and seller commissions only count payments that happened AFTER the attributed lead.
