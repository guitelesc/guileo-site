-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- ÁREA DE ESPERA DAS PÁGINAS CONCEDIDAS NO OAUTH.  Idempotente. Depende de db/meta_multi_conta.sql.
--
-- POR QUE EXISTE (medido 2026-09-01): guardamos o token da PÁGINA, nunca o do USUÁRIO — decisão
-- certa. Mas `/me/accounts` (a lista de Páginas do dono) SÓ existe para token de usuário: com
-- token de Página, `/me` é a Página, e ela não tem a aresta `accounts`. A Meta responde
-- `(#100) Tried accessing nonexisting field (accounts)`.
-- Ou seja: a lista de Páginas só existe DURANTE o OAuth e morria quando o callback terminava.
-- Sem ela, um cliente com duas marcas nunca conseguia conectar a segunda.
--
-- O QUE ESTA TABELA NÃO É: ela NÃO dá posse. Guarda "estas Páginas apareceram na autorização
-- deste cliente", com o token de cada uma e PRAZO CURTO. A posse continua sendo escolha explícita
-- do dono (meta_conta_adicionar_da_oferta), com a trava de dono no banco — porque a concessão do
-- Facebook é da PESSOA, e ela enxerga Páginas de clientes diferentes.
--
-- E a oferta é escopada em QUEM autorizou: não dá para adicionar a Página de outro tenant a
-- partir do seu próprio consentimento.
--
-- PRAZO: 60 minutos. Token de Página parado numa tabela de espera é superfície de risco sem dono;
-- se vencer, o dono refaz o OAuth (3 cliques) em vez de a gente guardar credencial de graça por
-- tempo indeterminado.
--
-- ⚠️ O TOKEN SAI DA ESPERA DENTRO DO BANCO (meta_conta_adicionar_da_oferta) — nunca passa pela
-- rota nem pelo navegador. meta_ofertas_listar não devolve token nenhum.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.meta_paginas_ofertadas (
  client_email  text not null,
  page_id       text not null,
  nome          text,
  ig_id         text,
  ig_username   text,
  page_token    text not null,
  criado_em     timestamptz not null default now(),
  expira_em     timestamptz not null default (now() + interval '60 minutes'),
  primary key (client_email, page_id)
);
create index if not exists idx_ofertadas_expira on public.meta_paginas_ofertadas (expira_em);
alter table public.meta_paginas_ofertadas enable row level security;  -- sem policy: só SECURITY DEFINER

-- ── GRAVAR (chamado pelo callback do OAuth, que é quem tem a lista) ────────────────────────────
-- Limpa o expirado e as ofertas antigas DESTE cliente antes de gravar: oferta velha que sobrevive
-- vira Página que o dono vê na tela e não existe mais na autorização.
create or replace function public.meta_ofertas_gravar(p_secret text, p_email text, p_paginas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email)); v_n int := 0;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_email = '' or jsonb_typeof(coalesce(p_paginas,'null'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'motivo', 'dados_faltando');
  end if;
  delete from meta_paginas_ofertadas where expira_em < now() or client_email = v_email;
  insert into meta_paginas_ofertadas (client_email, page_id, nome, ig_id, ig_username, page_token)
  select v_email, e->>'page_id',
         nullif(trim(coalesce(e->>'nome','')),''),
         nullif(trim(coalesce(e->>'ig_id','')),''),
         nullif(trim(coalesce(e->>'ig_username','')),''),
         e->>'page_token'
    from jsonb_array_elements(p_paginas) e
   where nullif(trim(coalesce(e->>'page_id','')),'') is not null
     and nullif(trim(coalesce(e->>'page_token','')),'') is not null
  on conflict (client_email, page_id) do update set
    nome = excluded.nome, ig_id = excluded.ig_id, ig_username = excluded.ig_username,
    page_token = excluded.page_token, criado_em = now(), expira_em = now() + interval '60 minutes';
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'guardadas', v_n);
exception when others then
  return jsonb_build_object('ok', false, 'motivo', 'erro:' || left(sqlerrm, 90));
end $$;

-- ── LISTAR (para a tela) — NUNCA devolve token ────────────────────────────────────────────────
-- Traz o DONO atual: oferecer como livre uma Página que já é de outro cliente é como o DM sai na
-- marca errada. E `pronta` diz se há Instagram amarrado — sem isso o dono adiciona e fica
-- esperando um DM que nunca vem.
create or replace function public.meta_ofertas_listar(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email)); v jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'page_id', o.page_id, 'nome', o.nome,
           'ig_id', coalesce(o.ig_id,''), 'ig_usuario', coalesce(o.ig_username,''),
           'pronta', (o.ig_id is not null and o.ig_id <> ''),
           'dono', coalesce(a.client_email, m.client_email, ''),
           'minha', (coalesce(a.client_email, m.client_email, '') = v_email),
           'livre', (a.client_email is null and m.client_email is null),
           'expira_em', o.expira_em) order by o.nome), '[]'::jsonb)
    into v
    from meta_paginas_ofertadas o
    left join meta_accounts a on a.page_id = o.page_id
    left join meta_page_map  m on m.page_id = o.page_id
   where o.client_email = v_email and o.expira_em > now();
  return v;
exception when others then return '[]'::jsonb;
end $$;

-- ── ADICIONAR A PARTIR DA OFERTA — tudo numa transação ────────────────────────────────────────
create or replace function public.meta_conta_adicionar_da_oferta(
  p_secret text, p_email text, p_page_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email)); o record;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  select * into o from meta_paginas_ofertadas
   where client_email = v_email and page_id = trim(p_page_id) and expira_em > now();
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'oferta_expirada_ou_inexistente',
      'dica', 'refaça a autorização (OAuth) para esta Página voltar a aparecer');
  end if;
  -- reusa a trava de dono; ela é quem recusa Página de outro cliente e diz DE QUEM é
  return meta_conta_adicionar(p_secret, v_email, o.page_id, o.ig_id, o.page_token, o.nome, o.ig_username);
end $$;

grant execute on function public.meta_ofertas_gravar(text,text,jsonb)           to anon;
grant execute on function public.meta_ofertas_listar(text,text)                 to anon;
grant execute on function public.meta_conta_adicionar_da_oferta(text,text,text)  to anon;
