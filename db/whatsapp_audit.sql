-- ─────────────────────────────────────────────────────────────────────────────
-- AUDITORIA DO WHATSAPP — listar QUEM tem credencial, pra poder testar se ela vive.
--
-- POR QUE EXISTE (2026-08-24): o painel "Estado dos canais" mostrava WhatsApp 🟢 Ligado
-- porque as env vars existem no Cloudflare. Só que o que faz a Gui RESPONDER não é a env
-- var — é o token do TENANT, no banco. Em 03/08 esse token venceu e o painel continuou
-- verde por três semanas, enquanto a Gui lia mensagem e não respondia.
--
-- Presença de chave ≠ chave funcionando. Esta função entrega a lista pra rota conferir
-- cada token no Graph e pintar o card com a VERDADE.
--
-- NUNCA devolve o access_token — só o suficiente pra testar (phone_number_id) e pra
-- mostrar de quem é. Segredo não sai do banco por uma rota de leitura de painel.
-- Idempotente. Colar no projeto ynihodbknhjirkdogxby.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.whatsapp_cloud_list_tenants(p_secret text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'client_email',    client_email,
           'phone_number_id', tokens->>'phone_number_id',
           'display_number',  tokens->>'display_number',
           'label',           tokens->>'label',
           'env',             tokens->>'env',
           'token_kind',      tokens->>'token_kind',
           'tem_token',       coalesce(length(tokens->>'access_token'),0) > 0,
           'validado_em',     tokens->>'validated_at'
         ) order by client_email), '[]'::jsonb)
    into v
  from client_integrations
  where provider = 'whatsapp_cloud';

  return v;
end $$;

revoke all on function public.whatsapp_cloud_list_tenants(text) from public, anon, authenticated;
grant execute on function public.whatsapp_cloud_list_tenants(text) to service_role;
