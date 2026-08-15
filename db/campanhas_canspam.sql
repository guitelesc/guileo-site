-- ============================================================================
-- GUILEO · CAMPANHAS — CAN-SPAM + AUDIÊNCIA HONESTA + MARK TENANT-BOUND
-- Auditoria A4 (2026-08-11). Três buracos provados no motor de campanhas:
--
--  1) ENDEREÇO FÍSICO (CAN-SPAM 15 U.S.C. §7704(a)(5)(A)(iii)): clientEmailShell já
--     renderiza `brand.address`, mas brandFor() (functions/lib/clientBrand.js) NUNCA
--     devolve esse campo → NENHUM e-mail de campanha jamais saiu com endereço postal.
--     O endereço EXISTE em biz_locations (ex.: Natura Astoria, "30-79 Steinway Street…").
--     `client_postal_address` entrega o endereço da unidade ativa do tenant.
--
--  2) SEGMENTO MORTO: campaign_audience filtrava lifecycle in ('lapsed','churned') /
--     'active' / 'vip'. Mas quem ESCREVE lifecycle hoje é crm_classify_sweep, e ele grava
--     'lead' | 'customer' | 'loyal' | 'dormant'. Ou seja: a campanha "reativar clientes
--     sumidos" resolvia ZERO destinatários — o dono clicava Enviar e recebia "0 enviados"
--     sem entender por quê. Agora os segmentos aceitam OS DOIS vocabulários.
--
--  3) SUPRESSÃO FAIL-CLOSED: o descadastro só era aplicado no JS (coupons.js). Se aquela
--     leitura falhasse (401/rede), quem pediu descadastro voltava a receber. Agora a
--     própria audiência já exclui os suprimidos — o JS vira 2ª camada, não a única.
--
--  4) campaign_mark_sent aceitava só p_id (UUID solto = mutação cross-tenant, contra a lei
--     "toda mutação é (client_email, id)") e SOBRESCREVIA sent_count com o envio parcial.
--     Nova assinatura tenant-bound que ACUMULA. A antiga fica viva (fallback do JS).
--
-- Idempotente. SECURITY DEFINER com literal INGEST. RLS já ligada nas tabelas de origem.
-- Projeto ynihodbknhjirkdogxby.
-- ============================================================================

-- ── 1) ENDEREÇO POSTAL DO TENANT (CAN-SPAM) ─────────────────────────────────
-- Devolve "Rua, Cidade" da primeira unidade ATIVA com endereço preenchido; '' se não houver
-- (o rodapé então omite a linha em vez de imprimir vírgula solta).
create or replace function public.client_postal_address(p_secret text, p_client_email text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(coalesce(p_client_email,''))); v_addr text := ''; v_city text := ''; v_out text := '';
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  if v_tenant = '' then return ''; end if;
  begin
    select btrim(coalesce(address,'')), btrim(coalesce(city,''))
      into v_addr, v_city
      from public.biz_locations
     where client_email = v_tenant
       and coalesce(active, true)
       and coalesce(btrim(address),'') <> ''
     order by created_at asc nulls last
     limit 1;
  exception when others then v_addr := ''; v_city := ''; end;  -- tabela ausente nunca derruba um envio
  v_addr := coalesce(v_addr,''); v_city := coalesce(v_city,'');
  if v_addr = '' then return ''; end if;
  -- Só acrescenta a cidade se o endereço ainda não a contiver (evita "…, Astoria, NY, Astoria, NY").
  if v_city <> '' and position(lower(v_city) in lower(v_addr)) = 0 then
    v_out := v_addr || ', ' || v_city;
  else
    v_out := v_addr;
  end if;
  return v_out;
end $$;

revoke all on function public.client_postal_address(text,text) from public;
revoke all on function public.client_postal_address(text,text) from anon;
grant execute on function public.client_postal_address(text,text) to service_role;

-- ── 2+3) AUDIÊNCIA: vocabulário real + supressão fail-closed ────────────────
create or replace function public.campaign_audience(p_secret text, p_client_email text, p_segment text, p_limit int default 500)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_client_email));
  v_seg    text := lower(coalesce(nullif(trim(p_segment),''),'all'));
  v_lim    int  := greatest(1, least(coalesce(p_limit,500), 2000));
  v_out    jsonb := '[]'::jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  begin
    select coalesce(jsonb_agg(jsonb_build_object('name', full_name, 'email', email)), '[]'::jsonb)
      into v_out
      from (
        select full_name, email
          from public.crm_contacts c
          where c.client_email = v_tenant
            and c.email is not null and position('@' in c.email) > 1
            -- SUPRESSÃO NA RAIZ: quem se descadastrou desta empresa nunca entra na audiência.
            and not exists (
              select 1 from public.email_suppressions s
               where s.client_email = v_tenant
                 and s.contact_email = lower(btrim(c.email))
            )
            and (
              v_seg = 'all'
              -- 'customer'/'dormant' = vocabulário do crm_classify_sweep; 'active'/'lapsed'/'churned' = legado.
              or (v_seg = 'active' and c.lifecycle in ('active','customer','loyal','vip'))
              or (v_seg = 'lapsed' and c.lifecycle in ('lapsed','churned','dormant'))
              or (v_seg = 'vip'    and c.lifecycle = 'vip')
              or (v_seg = 'loyal'  and c.lifecycle in ('loyal','vip'))
              or (v_seg = 'leads'  and c.lifecycle = 'lead')
            )
          order by c.last_seen_at desc
          limit v_lim
      ) q;
  exception when undefined_table then
    -- CRM não pasteado ainda → fallback: emails distintos de agendamentos (também suprimidos).
    begin
      select coalesce(jsonb_agg(jsonb_build_object('name', customer_name, 'email', customer_contact)), '[]'::jsonb)
        into v_out
        from (
          select distinct on (lower(customer_contact)) customer_name, customer_contact
            from public.biz_appointments a
            where a.client_email = v_tenant
              and a.customer_contact is not null and position('@' in a.customer_contact) > 1
              and not exists (
                select 1 from public.email_suppressions s
                 where s.client_email = v_tenant
                   and s.contact_email = lower(btrim(a.customer_contact))
              )
            order by lower(customer_contact), created_at desc
            limit v_lim
        ) q;
    exception when undefined_table then v_out := '[]'::jsonb; end;
  end;
  return coalesce(v_out, '[]'::jsonb);
end $$;

grant execute on function public.campaign_audience(text,text,text,int) to anon;

-- ── 4) MARK SENT tenant-bound + acumulativo ─────────────────────────────────
create or replace function public.campaign_mark_sent(p_secret text, p_client_email text, p_id uuid, p_count int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(coalesce(p_client_email,'')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  if v_tenant = '' then return false; end if;
  update public.campaigns
     set status     = 'sent',
         -- ACUMULA: um retry parcial não pode apagar o total já enviado.
         sent_count = coalesce(sent_count, 0) + greatest(coalesce(p_count, 0), 0)
   where id = p_id and client_email = v_tenant;
  return found;
end $$;

revoke all on function public.campaign_mark_sent(text,text,uuid,int) from public;
grant execute on function public.campaign_mark_sent(text,text,uuid,int) to anon;

-- ✅ Aplicado via MCP em 2026-08-11.
