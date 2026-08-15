-- ============================================================================
-- KIT DE CAMPANHA — guarda o conjunto que o time da Guileo publica de manhã.
--
-- POR QUE GUARDAR: o kit é produzido por IA e publicado À MÃO, horas depois, por outra pessoa.
-- Sem persistência, quem gerou tem que deixar a aba aberta até o time colar no gerenciador — e
-- quando fecha, o crédito de modelo foi gasto e a peça sumiu. Guardado, o kit também vira
-- HISTÓRICO: dá para olhar em janeiro qual criativo rodou em dezembro e o que ele trouxe (o
-- motor de anúncios já mede o retorno por campanha em ads_engine.sql).
--
-- O QUE ESTA TABELA NÃO É: fila de publicação. Nada aqui dispara nada. Publicar continua sendo
-- um humano no gerenciador do canal — e é honesto que seja, porque publicar sozinho depende de
-- token e aprovação de plataforma que não estão na nossa mão.
--
-- Gate: literal INGEST (SECURITY DEFINER). RLS ligado SEM policy → a tabela é inalcançável por
-- anon/public direto; só as funções abaixo entram, e elas exigem o segredo E o tenant.
-- Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

create table if not exists public.criativo_kits (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  canais       text[] not null default '{}',
  idioma       text,
  objetivo     text,
  publico      text,
  prontas      int  not null default 0,
  bloqueadas   int  not null default 0,
  kit          jsonb not null,
  created_at   timestamptz not null default now()
);

-- O índice é (tenant, data): toda leitura é "os últimos kits DESTE negócio". Índice só por data
-- faria o banco varrer os kits de todos os clientes para mostrar os de um.
create index if not exists criativo_kits_tenant_idx on public.criativo_kits (client_email, created_at desc);

alter table public.criativo_kits enable row level security;

-- ── GRAVAR ───────────────────────────────────────────────────────────────────────────────────
-- Devolve o ID. "ok:true" sem o id do que foi criado é promessa sem lastro — já custou caro em
-- agendamento, link de pagamento e sync de agente. Quem chama grava o id no que mostra na tela.
create or replace function public.criativo_kit_save(
  p_secret text, p_email text, p_kit jsonb,
  p_canais text[] default '{}', p_idioma text default null,
  p_objetivo text default null, p_publico text default null,
  p_prontas int default 0, p_bloqueadas int default 0
) returns json language plpgsql security definer set search_path=public as $$
declare v_tenant text := lower(trim(coalesce(p_email,''))); v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  if v_tenant = '' or position('@' in v_tenant) = 0 then return json_build_object('ok', false, 'erro', 'tenant invalido'); end if;
  if p_kit is null then return json_build_object('ok', false, 'erro', 'kit vazio'); end if;

  insert into criativo_kits (client_email, canais, idioma, objetivo, publico, prontas, bloqueadas, kit)
  values (v_tenant, coalesce(p_canais,'{}'), left(coalesce(p_idioma,''),5), left(coalesce(p_objetivo,''),300),
          left(coalesce(p_publico,''),400), greatest(coalesce(p_prontas,0),0), greatest(coalesce(p_bloqueadas,0),0), p_kit)
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id);
exception when others then
  -- Degradar, nunca 500: o kit já existe na resposta da rota. Perder o histórico é chato;
  -- perder a peça que a IA acabou de escrever é caro.
  return json_build_object('ok', false, 'erro', left(SQLERRM, 200));
end $$;

-- ── LER (só do próprio tenant — o e-mail vem AUTENTICADO pela rota, nunca do corpo) ──────────
create or replace function public.criativo_kit_list(
  p_secret text, p_email text, p_limit int default 10
) returns json language plpgsql security definer set search_path=public as $$
declare v_tenant text := lower(trim(coalesce(p_email,''))); v_out json;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;

  select coalesce(json_agg(t order by t.created_at desc), '[]'::json) into v_out
  from (
    select id, canais, idioma, objetivo, publico, prontas, bloqueadas, kit, created_at
    from criativo_kits
    where client_email = v_tenant
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit,10), 50))
  ) t;

  return json_build_object('ok', true, 'kits', v_out);
exception when others then
  return json_build_object('ok', false, 'erro', left(SQLERRM, 200), 'kits', '[]'::json);
end $$;

-- ── PERMISSÕES ───────────────────────────────────────────────────────────────────────────────
-- FECHADO PARA anon E public. O segredo está no repositório (é literal na função, porque o
-- Supabase proíbe GUC) — então segredo + chave anon pública seriam suficientes para chamar isto
-- de fora se anon pudesse executar. Só o service_role, que só o nosso Worker tem
-- (env.SUPABASE_SERVICE_ROLE, nunca embarcado no navegador), executa.
revoke all on function public.criativo_kit_save(text,text,jsonb,text[],text,text,text,int,int) from public, anon, authenticated;
revoke all on function public.criativo_kit_list(text,text,int) from public, anon, authenticated;
grant execute on function public.criativo_kit_save(text,text,jsonb,text[],text,text,text,int,int) to service_role;
grant execute on function public.criativo_kit_list(text,text,int) to service_role;
revoke all on table public.criativo_kits from public, anon, authenticated;
