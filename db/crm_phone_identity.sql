-- db/crm_phone_identity.sql — UMA PESSOA, UM CADASTRO.
--
-- O PROBLEMA (achado em 2026-08-07, na 1ª ligação real do Luis):
-- O mesmo telefone existia DUAS vezes por cliente, em formatos diferentes:
--     smart@guileoai.com · 9295350191   → "Coke"  (2 visitas)
--     smart@guileoai.com · +19295350191 → "Luis"  (2 visitas)
-- As funções normalizavam o E-MAIL do tenant, nunca o TELEFONE. Então cada pessoa podia virar
-- duas identidades, e a memória se partia no meio: a agente atendeu o Luis chamando de "Coke".
-- Numa clínica isso é dois prontuários para o mesmo paciente — inaceitável.
--
-- Segundo defeito, mais sutil: "Coke" nasceu de um nome MAL-OUVIDO numa ligação, e sobrescreveu
-- o cadastro bom. Reconhecimento de fala erra; o cadastro não pode herdar o erro.
--
-- Idempotente: pode rodar quantas vezes quiser.

-- ── 1. A CHAVE CANÔNICA ──────────────────────────────────────────────────────────────────────
-- Só dígitos. Para número dos EUA/Canadá (11 dígitos começando com 1), corta o 1 → 10 dígitos.
-- Assim "+1 (929) 535-0191", "19295350191" e "9295350191" viram a MESMA chave.
create or replace function public._gui_phone_key(p text)
returns text language sql immutable as $$
  select case
    when d = '' then null
    when length(d) = 11 and left(d,1) = '1' then right(d,10)
    else d
  end
  from (select regexp_replace(coalesce(p,''), '[^0-9]', '', 'g') as d) x;
$$;

-- ── 2. COLUNA CANÔNICA + ÍNDICE ÚNICO ────────────────────────────────────────────────────────
-- Gerada pelo banco: não existe caminho de escrita que consiga divergir dela.
alter table public.crm_contacts
  add column if not exists phone_key text generated always as (public._gui_phone_key(phone)) stored;

-- ── 3. FUNDE OS DUPLICADOS QUE JÁ EXISTEM ────────────────────────────────────────────────────
-- Mantém o cadastro com MAIS visitas (o histórico real). Soma as visitas e o valor gasto, e fica
-- com o nome do vencedor — a menos que ele esteja vazio. O timeline é reapontado para o vencedor
-- ANTES de apagar o perdedor, senão o histórico da pessoa some junto.
do $$
declare r record; v_win uuid; v_sum int; v_ltv bigint;
begin
  for r in
    select client_email, phone_key
    from crm_contacts
    where phone_key is not null
    group by 1,2 having count(*) > 1
  loop
    select id into v_win from crm_contacts
      where client_email = r.client_email and phone_key = r.phone_key
      order by visit_count desc nulls last, length(coalesce(full_name,'')) desc, created_at asc
      limit 1;

    select sum(coalesce(visit_count,0)), sum(coalesce(ltv_cents,0))
      into v_sum, v_ltv
      from crm_contacts where client_email = r.client_email and phone_key = r.phone_key;

    -- histórico dos perdedores passa para o vencedor
    begin
      update crm_timeline_events e set contact_id = v_win
      where e.client_email = r.client_email
        and e.contact_id in (select id from crm_contacts
                             where client_email = r.client_email and phone_key = r.phone_key and id <> v_win);
    exception when undefined_table or undefined_column then null;
    end;

    update crm_contacts set visit_count = v_sum, ltv_cents = v_ltv,
           phone = '+1' || r.phone_key   -- forma canônica, uma só daqui pra frente
      where id = v_win and length(r.phone_key) = 10;

    delete from crm_contacts
     where client_email = r.client_email and phone_key = r.phone_key and id <> v_win;
  end loop;
end $$;

-- Depois de fundir, o índice único IMPEDE que a identidade se parta de novo.
create unique index if not exists crm_contacts_tenant_phone_key
  on public.crm_contacts (client_email, phone_key) where phone_key is not null;

-- ── 4. BUSCA PELA CHAVE, NÃO PELO FORMATO ────────────────────────────────────────────────────
create or replace function public.crm_caller_lookup(p_secret text, p_email text, p_phone text)
returns table(full_name text, last_seen_at timestamptz, visit_count integer, ltv_cents bigint, lifecycle text, last_summary text)
language plpgsql security definer set search_path to 'public' as $function$
declare v_tenant text := lower(trim(p_email)); v_key text := public._gui_phone_key(p_phone); v_id uuid;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_key is null then return; end if;
  -- Antes: casava por formato e pegava "o mais recente", que podia ser o cadastro errado.
  -- Agora a chave é única por tenant, então não há o que desempatar.
  select c.id into v_id from crm_contacts c
    where c.client_email = v_tenant and c.phone_key = v_key limit 1;
  if v_id is null then return; end if;
  return query select c.full_name, c.last_seen_at, c.visit_count, c.ltv_cents, c.lifecycle,
    coalesce((select e.summary from crm_timeline_events e
              where e.client_email = v_tenant and e.contact_id = v_id
              order by e.occurred_at desc limit 1), '')::text
    from crm_contacts c where c.id = v_id;
exception when undefined_table then
  return query select c.full_name, c.last_seen_at, c.visit_count, c.ltv_cents, c.lifecycle, ''::text
    from crm_contacts c where c.id = v_id;
end $function$;

revoke all on function public._gui_phone_key(text) from anon;
revoke all on function public.crm_caller_lookup(text,text,text) from anon;
