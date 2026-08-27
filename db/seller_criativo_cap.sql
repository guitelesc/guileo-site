-- ─────────────────────────────────────────────────────────────────────────────
-- GUILEO · COTA DIÁRIA DO CRIATIVO DO VENDEDOR (/api/seller-criativo)
--
-- POR QUE EXISTE: a peça de anúncio que o vendedor gera na reunião é paga pela
-- GUILEO (modelo Anthropic), não pelo cliente. O hub é feito para mil vendedores
-- ao mesmo tempo — sem teto POR PESSOA, um único clique repetido vira conta de
-- IA sem nenhuma peça a mais. Teto por IP não resolve: o custo é do vendedor,
-- não do escritório de onde ele abre o navegador.
--
-- COMO: um contador por (vendedor, dia UTC). A reivindicação é ATÔMICA
-- (insert … on conflict … do update … where), então dois cliques simultâneos
-- nunca contam como um só nem estouram o teto.
--
-- IDEMPOTENTE: rodar este arquivo duas vezes não quebra nada e não zera contador.
-- INGEST-gated SECURITY DEFINER; RLS on, sem policy para anon.
-- Colar no SQL Editor do Supabase (projeto ynihodbknhjirkdogxby, smart@guileoai.com).
--
-- ENQUANTO NÃO FOR COLADO: /api/seller-criativo continua gerando a peça e
-- devolve `cota.pronta:false` com o motivo. FAIL-OPEN é a escolha certa aqui —
-- o dano de um vendedor sem peça na frente do cliente é maior que o de cinco
-- chamadas de modelo — mas ele aparece na resposta, para ninguém acreditar que
-- existe teto onde não há.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.seller_criativo_uso (
  seller_email text not null,
  dia          date not null default (now() at time zone 'utc')::date,
  usadas       integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (seller_email, dia)
);

-- Ninguém lê esta tabela pelo PostgREST — só a função abaixo toca nela.
alter table public.seller_criativo_uso enable row level security;

-- Reivindica UMA geração. Devolve sempre o estado real:
--   { ok:true, pode:true|false, usadas:<int>, teto:<int> }
-- `pode:false` = o vendedor já bateu o teto de hoje (nada foi contado a mais).
-- Erro interno devolve { ok:false, erro } — quem chama decide, e hoje decide
-- gerar mesmo assim (fail-open consciente, documentado na rota).
create or replace function public.seller_criativo_claim(p_secret text, p_email text, p_teto integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_dia   date := (now() at time zone 'utc')::date;
  v_teto  integer := greatest(1, least(50, coalesce(p_teto, 5)));
  v_usadas integer;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' then return jsonb_build_object('ok', false, 'erro', 'email vazio'); end if;
  begin
    -- O `where` do update é o teto: acima dele o update NÃO acontece, o RETURNING
    -- vem vazio, e nada foi incrementado. Read-then-write aqui deixaria a janela
    -- em que dois cliques leem 4 e ambos gravam 5.
    insert into seller_criativo_uso (seller_email, dia, usadas, updated_at)
    values (v_email, v_dia, 1, now())
    on conflict (seller_email, dia) do update
      set usadas = seller_criativo_uso.usadas + 1, updated_at = now()
      where seller_criativo_uso.usadas < v_teto
    returning usadas into v_usadas;

    if v_usadas is null then
      -- Não contou: ou bateu o teto. Devolve o número REAL de hoje.
      select usadas into v_usadas from seller_criativo_uso where seller_email = v_email and dia = v_dia;
      return jsonb_build_object('ok', true, 'pode', false, 'usadas', coalesce(v_usadas, v_teto), 'teto', v_teto);
    end if;
    return jsonb_build_object('ok', true, 'pode', true, 'usadas', v_usadas, 'teto', v_teto);
  exception when others then
    return jsonb_build_object('ok', false, 'erro', substr(sqlerrm, 1, 140));
  end;
end
$$;

grant execute on function public.seller_criativo_claim(text, text, integer) to anon;

-- ✅ Pronto. Prova de 1 comando (troque o e-mail):
--   select public.seller_criativo_claim('glo_ing_c7f2a9e4b8d16350','teste@guileoai.com',2);  -- pode:true usadas:1
--   select public.seller_criativo_claim('glo_ing_c7f2a9e4b8d16350','teste@guileoai.com',2);  -- pode:true usadas:2
--   select public.seller_criativo_claim('glo_ing_c7f2a9e4b8d16350','teste@guileoai.com',2);  -- pode:FALSE usadas:2
