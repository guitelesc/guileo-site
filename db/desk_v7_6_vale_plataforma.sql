-- GUILEO DESK v7.6 — VALE-PRESENTE vendido pela PLATAFORMA: nasce UMA vez por sessão (2026-10-05)
-- Aplicado como desk_v7_6_vale_plataforma. Só ACRESCENTA: nenhuma função existente muda. Idempotente.
--
-- POR QUÊ: o ramo "giftcard" do webhook da plataforma (functions/api/stripe-webhook.js) chamava
-- giftcard_create direto — que gera um código novo a cada chamada e não diz se o vale é novo. A trava
-- era só o id do EVENTO (mark_webhook_seen). Para o e-mail do vale sair UMA vez (e o vale nascer uma
-- vez mesmo que dois eventos diferentes tragam a mesma sessão: completed + async_payment_succeeded), o
-- banco precisa responder "acabei de criar" × "já existia". É isto que giftcard_platform_fulfill_svc faz:
-- trava por sessão (mesma família de pg_advisory_xact_lock da venda online), uma linha por sessão, e
-- `already` honesto. O e-mail (lib/vendaOnlineNegocio.js · enviarValePresente) só sai com already:false.
--
-- O VALE é criado pela MESMA giftcard_create de sempre, ancorado no valor PAGO (o webhook passa o
-- amount_total). O segredo (INGEST_SECRET) vem do servidor como parâmetro — nenhum segredo escrito aqui.
-- PORTA: só service_role.

create table if not exists public.giftcard_platform_sessions (
  session_id   text primary key,
  client_email text not null,
  gift_card_id uuid,
  code         text,
  cents        int,
  created_at   timestamptz not null default now()
);
alter table public.giftcard_platform_sessions enable row level security;
revoke all on table public.giftcard_platform_sessions from anon, authenticated;

--   novo            → { ok, already:false, result:{ gift_card_id, code, cents } }
--   mesma sessão    → { ok, already:true,  result:{ ... } }   (nada é criado de novo)
--   sessão de outro → { ok:false, reason:'sessao_de_outro' }
create or replace function public.giftcard_platform_fulfill_svc(
  p_secret text, p_tenant text, p_session text, p_cents int, p_recipient text, p_purchaser text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  e text := lower(trim(coalesce(p_tenant, ''))); r giftcard_platform_sessions%rowtype;
  v_amt int := greatest(coalesce(p_cents, 0), 0); v_card jsonb; v_res jsonb;
begin
  if coalesce(p_session, '') !~ '^[a-z]{2,4}_[A-Za-z0-9_]{6,200}$' or e !~ '@' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_amt <= 0 then return jsonb_build_object('ok', false, 'reason', 'amount_missing'); end if;
  perform pg_advisory_xact_lock(hashtext('vale_plataforma:' || p_session));
  select * into r from giftcard_platform_sessions where session_id = p_session;
  if found then
    if r.client_email <> e then return jsonb_build_object('ok', false, 'reason', 'sessao_de_outro'); end if;
    return jsonb_build_object('ok', true, 'already', true,
      'result', jsonb_build_object('gift_card_id', r.gift_card_id, 'code', r.code, 'cents', r.cents));
  end if;
  -- giftcard_create confere o segredo (lança 'unauthorized' se errado → nada é gravado, o JS alarma)
  v_card := public.giftcard_create(p_secret, e, jsonb_build_object('amount_cents', v_amt,
              'recipient_contact', coalesce(p_recipient, ''), 'purchaser_contact', coalesce(p_purchaser, '')));
  insert into giftcard_platform_sessions (session_id, client_email, gift_card_id, code, cents)
  values (p_session, e, nullif(v_card->>'id', '')::uuid, v_card->>'code', v_amt);
  v_res := jsonb_build_object('gift_card_id', v_card->>'id', 'code', v_card->>'code', 'cents', v_amt);
  return jsonb_build_object('ok', true, 'already', false, 'result', v_res);
end $$;

revoke all on function public.giftcard_platform_fulfill_svc(text,text,text,integer,text,text) from public, anon, authenticated;
grant execute on function public.giftcard_platform_fulfill_svc(text,text,text,integer,text,text) to service_role;
notify pgrst, 'reload schema';
