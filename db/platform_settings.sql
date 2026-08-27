-- ============================================================================
-- Guileo · REGRAS DE COBRANÇA NO BANCO — platform_settings  (cole no Supabase → Run)
-- Projeto ynihodbknhjirkdogxby (smart@guileoai.com). Idempotente, pode colar 2×.
-- ----------------------------------------------------------------------------
-- POR QUE EXISTE: DUNNING_ENFORCE, GRACE_DAYS e SILENT_DAYS são decisões de NEGÓCIO
-- (quantos dias de tolerância o dono dá antes de pausar um inadimplente) e estavam
-- presas como env var no painel do Cloudflare. Duas consequências caras:
--   1) mudar a regra exige acesso ao Cloudflare — e só vale no PRÓXIMO deploy
--      (ver feedback_secret_exige_redeploy: trocar a env var não vale até redeploy);
--   2) o dono não vê a regra em lugar nenhum, então não sabe qual está valendo.
-- Aqui a regra vira dado: editável no /admin, valendo no próximo ciclo do cron.
--
-- ⚠️ A ENV CONTINUA VALENDO COMO FALLBACK, de propósito. `dunning-sweep.js` lê o
-- settings PRIMEIRO e cai na env quando a tabela não existe / não tem a chave. Assim
-- este arquivo pode ser colado depois do deploy sem nenhuma janela em que a cobrança
-- fique sem regra (regra zero-downtime).
--
-- CONTRATO (igual a db/cx_settings.sql): SECURITY DEFINER, search_path=public,
-- portão por LITERAL do INGEST, RLS ON sem policy anon, grant execute to anon.
-- ============================================================================

create table if not exists public.platform_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;

-- ── LER TUDO (o sweep e o /admin leem o mesmo objeto) ────────────────────────
-- Devolve { chave: valor } só com o que foi REALMENTE gravado. Chave ausente = "não
-- decidido aqui" → quem chama usa a env. Nunca inventa um default no banco: um valor
-- fabricado aqui silenciaria a env e mudaria a cobrança sem ninguém ter decidido.
create or replace function public.platform_settings_get(p_secret text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  begin
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v from platform_settings;
  exception when others then
    return '{}'::jsonb;   -- degrada para "nada decidido" → o chamador usa a env
  end;
  return coalesce(v, '{}'::jsonb);
end $$;

grant execute on function public.platform_settings_get(text) to anon;

-- ── GRAVAR UMA CHAVE ────────────────────────────────────────────────────────
-- Lista branca explícita: esta tabela governa COBRANÇA. Sem a trava, o mesmo botão
-- viraria um editor de configuração livre da plataforma inteira.
create or replace function public.platform_settings_set(p_secret text, p_key text, p_value text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_key text := lower(trim(coalesce(p_key, '')));
        v_val text := trim(coalesce(p_value, ''));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_key not in ('dunning_enforce', 'grace_days', 'silent_days') then
    raise exception 'chave nao permitida: %', v_key using errcode = '22023';
  end if;
  -- validação por chave — número que não é número vira "0" e zera a tolerância do dono.
  if v_key = 'dunning_enforce' then
    if v_val not in ('0', '1') then raise exception 'dunning_enforce e 0 ou 1' using errcode = '22023'; end if;
  else
    if v_val !~ '^[0-9]{1,3}$' or v_val::int < 1 then
      raise exception '% tem que ser inteiro >= 1', v_key using errcode = '22023';
    end if;
  end if;
  insert into platform_settings (key, value, updated_at)
  values (v_key, v_val, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('ok', true, 'key', v_key, 'value', v_val);
end $$;

grant execute on function public.platform_settings_set(text, text, text) to anon;

-- ✅ Pronto. /api/dunning-sweep passa a ler a regra daqui (env como fallback) e a
--    seção "⚙️ Regras de cobrança" do /admin passa a editá-la sem tocar no Cloudflare.
