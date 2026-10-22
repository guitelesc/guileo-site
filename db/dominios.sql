-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- DOMÍNIO PRÓPRIO DO CLIENTE — tenant_domains
--
-- O QUE É: uma linha por domínio de cliente apontado para o nosso Cloudflare Pages. É por ela (e SÓ
-- por ela) que functions/_middleware.js decide que `https://www.<dominio-do-cliente>/` serve a
-- página daquele cliente. Sem linha ativa o domínio não serve nada nosso.
--
-- REGRAS
--   · host é a chave: minúsculo, único — e único também SEM o "www." (apex e www são o mesmo site;
--     a linha guarda a forma CANÔNICA, a outra forma recebe 301 no middleware).
--   · Um host já registrado por um cliente não muda de dono por esta RPC (host_taken).
--   · active=false (padrão) → o middleware responde 404 liso naquele domínio. Nunca o site da Guileo.
--   · indexable=false (padrão) → a página sai com noindex. Vira true no dia em que o domínio é dele.
--   · pixel_meta / tag_google são os IDs DO CLIENTE (públicos por natureza). Nunca os da Guileo.
--
-- PORTÃO: literal INGEST, execute só para service_role. RLS ligada, SEM policy: nenhuma leitura
-- direta da tabela — só pelas funções SECURITY DEFINER. Idempotente: pode rodar de novo.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.tenant_domains (
  host         text primary key,
  client_email text not null,
  kind         text not null,
  slug         text not null,
  active       boolean not null default false,
  indexable    boolean not null default false,
  pixel_meta   text,
  tag_google   text,
  created_at   timestamptz not null default now(),
  constraint tenant_domains_host_minusculo check (host = lower(host)),
  constraint tenant_domains_kind check (kind in ('vitrine', 'site'))
);

-- apex e www são o MESMO domínio: nunca duas linhas para o mesmo site.
create unique index if not exists tenant_domains_raiz
  on public.tenant_domains ((regexp_replace(host, '^www\.', '')));
create index if not exists tenant_domains_tenant on public.tenant_domains (client_email);

alter table public.tenant_domains enable row level security;
revoke all on table public.tenant_domains from anon, authenticated;

-- ── CONSULTAR ────────────────────────────────────────────────────────────────────────────────
-- Entra o Host do pedido (com ou sem "www.", qualquer caixa, ponto final tolerado).
-- Sai a linha ATIVA daquele domínio, ou NULL. Linha inativa é NULL: para o middleware ela não existe.
create or replace function public.domain_lookup(p_secret text, p_host text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_raiz text := regexp_replace(regexp_replace(lower(trim(coalesce(p_host, ''))), '\.$', ''), '^www\.', '');
  v_out  jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_raiz = '' then return null; end if;
  select to_jsonb(d) into v_out
    from public.tenant_domains d
   where d.active
     and regexp_replace(d.host, '^www\.', '') = v_raiz
   limit 1;
  return v_out;
end $$;

-- ── GRAVAR ───────────────────────────────────────────────────────────────────────────────────
-- Cria ou atualiza a linha do domínio. Devolve a linha gravada.
-- Erros com nome estável: email_invalid · host_invalid · host_reserved · kind_invalid ·
-- slug_invalid · pixel_invalid · tag_invalid · host_taken.
-- host: nome de host de verdade — sem esquema, sem caminho, sem porta, sem IP; nunca um host nosso.
create or replace function public.domain_set(
  p_secret text, p_email text, p_host text, p_kind text, p_slug text,
  p_active boolean, p_indexable boolean, p_pixel_meta text, p_tag_google text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(coalesce(p_email, '')));
  v_host   text := lower(trim(coalesce(p_host, '')));
  v_kind   text := lower(trim(coalesce(p_kind, '')));
  v_slug   text := lower(trim(coalesce(p_slug, '')));
  v_pixel  text := nullif(trim(coalesce(p_pixel_meta, '')), '');
  v_tag    text := nullif(upper(trim(coalesce(p_tag_google, ''))), '');
  v_raiz   text;
  v_row    public.tenant_domains%rowtype;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'email_invalid' using errcode = '22023'; end if;

  -- Só letras, dígitos, hífen e ponto; pelo menos dois rótulos; TLD alfabético. Isso já recusa
  -- "https://x", "x.com/pagina", "x.com:8080", "localhost" e qualquer IP.
  if length(v_host) > 253
     or v_host !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$' then
    raise exception 'host_invalid' using errcode = '22023';
  end if;
  v_raiz := regexp_replace(v_host, '^www\.', '');
  if v_raiz = 'guileoai.com' or v_raiz like '%.guileoai.com'
     or v_raiz = 'pages.dev' or v_raiz like '%.pages.dev'
     or v_raiz ~ '(^|\.)(localhost|local|test|invalid|example|internal)$' then
    raise exception 'host_reserved' using errcode = '22023';
  end if;

  if v_kind not in ('vitrine', 'site') then raise exception 'kind_invalid' using errcode = '22023'; end if;
  if v_slug !~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$' then raise exception 'slug_invalid' using errcode = '22023'; end if;
  if v_pixel is not null and v_pixel !~ '^[0-9]{5,20}$' then raise exception 'pixel_invalid' using errcode = '22023'; end if;
  if v_tag is not null and v_tag !~ '^(G|AW|GTM)-[A-Z0-9]{4,20}$' then raise exception 'tag_invalid' using errcode = '22023'; end if;

  select * into v_row from public.tenant_domains
   where regexp_replace(host, '^www\.', '') = v_raiz
   for update;

  if v_row.host is not null then
    -- O domínio já é de alguém. Só o MESMO cliente atualiza a própria linha.
    if v_row.client_email <> v_tenant then raise exception 'host_taken' using errcode = '42501'; end if;
    update public.tenant_domains
       set host = v_host, kind = v_kind, slug = v_slug,
           active = coalesce(p_active, false), indexable = coalesce(p_indexable, false),
           pixel_meta = v_pixel, tag_google = v_tag
     where host = v_row.host and client_email = v_tenant
    returning * into v_row;
  else
    insert into public.tenant_domains (host, client_email, kind, slug, active, indexable, pixel_meta, tag_google)
    values (v_host, v_tenant, v_kind, v_slug, coalesce(p_active, false), coalesce(p_indexable, false), v_pixel, v_tag)
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end $$;

revoke all on function public.domain_lookup(text, text) from public, anon, authenticated;
revoke all on function public.domain_set(text, text, text, text, text, boolean, boolean, text, text) from public, anon, authenticated;
grant execute on function public.domain_lookup(text, text) to service_role;
grant execute on function public.domain_set(text, text, text, text, text, boolean, boolean, text, text) to service_role;

notify pgrst, 'reload schema';
