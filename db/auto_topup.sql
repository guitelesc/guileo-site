-- ─────────────────────────────────────────────────────────────────────────────
-- GUILEO · RECARGA COM 1 CLIQUE (client_autotopup) — a intenção do cliente, no servidor.
--
-- POR QUE EXISTE: o cockpit (Ajustes → Notificações e cobrança) tinha um botão
-- "Auto top-up" que gravava `gui_payg` SÓ no localStorage do navegador. Nenhum
-- arquivo em functions/ jamais leu esse valor. Ou seja: o cliente ligava, via
-- "Auto top-up on ✓", zerava o crédito no sábado e nada acontecia — e ele tinha
-- certeza de ter ligado. Promessa sem lastro num caminho de DINHEIRO é a pior
-- classe de defeito desta plataforma.
--
-- ⚠️ O QUE ESTA TABELA NÃO É: ela NÃO é mandato de cobrança. Ligar aqui NÃO
-- autoriza a Guileo a passar o cartão sozinha. Cobrança off-session de verdade
-- exige mandato salvo (Stripe SetupIntent + payment method off_session, com o
-- consentimento explícito e registrado do cliente) — próximo passo, não este.
-- O que esta intenção liga é o AVISO ACIONÁVEL: quando o saldo zera, sai um
-- e-mail com o link de pagamento do pacote, e o cliente conclui em 1 clique.
-- O rótulo na tela diz exatamente isso, e nada além disso.
--
-- IDEMPOTENTE: rodar duas vezes não altera preferência de ninguém.
-- INGEST-gated SECURITY DEFINER; RLS on, sem policy para anon.
-- Colar no SQL Editor do Supabase (projeto ynihodbknhjirkdogxby, smart@guileoai.com).
-- Enquanto NÃO for colado: /api/auto-topup devolve `pronto:false` com o motivo e
-- a tela mostra o aviso — o botão NÃO finge ter salvado.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.client_autotopup (
  client_email text primary key,
  enabled      boolean not null default false,
  pack         text not null default 'recarga_500',
  updated_at   timestamptz not null default now()
);

-- Ninguém lê esta tabela pelo PostgREST — só as funções abaixo tocam nela.
alter table public.client_autotopup enable row level security;

-- ── GRAVAR A INTENÇÃO ────────────────────────────────────────────────────────
-- Devolve o estado REAL depois da escrita ({ok:true, enabled, pack}), nunca um
-- "ok" seco: "ok" sem o que foi gravado é promessa sem lastro, e num caminho de
-- dinheiro isso já custou caro aqui.
create or replace function public.client_autotopup_set(p_secret text, p_email text, p_enabled boolean, p_pack text default 'recarga_500')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  -- Lista fechada de pacotes: um `pack` livre viraria, um dia, um link de
  -- pagamento montado a partir de texto que o cliente digitou.
  v_pack  text := case when coalesce(p_pack, '') in ('recarga_500', 'recarga_1500') then p_pack else 'recarga_500' end;
  v_row   client_autotopup%rowtype;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' then return jsonb_build_object('ok', false, 'erro', 'email vazio'); end if;
  begin
    insert into client_autotopup (client_email, enabled, pack, updated_at)
    values (v_email, coalesce(p_enabled, false), v_pack, now())
    on conflict (client_email) do update
      set enabled = coalesce(p_enabled, false), pack = v_pack, updated_at = now()
    returning * into v_row;
    return jsonb_build_object('ok', true, 'enabled', v_row.enabled, 'pack', v_row.pack, 'updated_at', v_row.updated_at);
  exception when others then
    return jsonb_build_object('ok', false, 'erro', substr(sqlerrm, 1, 140));
  end;
end
$$;

-- ── LER A INTENÇÃO ───────────────────────────────────────────────────────────
-- Sem linha = desligado (o padrão). `ok:true` com `enabled:false` é resposta
-- legítima; `ok:false` é falha de leitura, e a tela precisa distinguir as duas —
-- "não consegui ler" desenhado como "está desligado" é o fallback que esconde erro.
create or replace function public.client_autotopup_get(p_secret text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_row   client_autotopup%rowtype;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' then return jsonb_build_object('ok', false, 'erro', 'email vazio'); end if;
  begin
    select * into v_row from client_autotopup where client_email = v_email;
    if not found then return jsonb_build_object('ok', true, 'enabled', false, 'pack', 'recarga_500'); end if;
    return jsonb_build_object('ok', true, 'enabled', v_row.enabled, 'pack', v_row.pack, 'updated_at', v_row.updated_at);
  exception when others then
    return jsonb_build_object('ok', false, 'erro', substr(sqlerrm, 1, 140));
  end;
end
$$;

-- ── QUEM LIGOU (o cron lê isto uma vez por rodada) ───────────────────────────
-- Uma chamada só, em vez de uma por cliente: a varredura de crédito já roda de
-- hora em hora e tem orçamento de subrequests. Devolve LISTA, e uma lista
-- ausente é ERRO na rota que chama — nunca "ninguém ligou".
create or replace function public.client_autotopup_enabled(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_lista jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  begin
    select coalesce(jsonb_agg(jsonb_build_object('email', client_email, 'pack', pack)), '[]'::jsonb)
      into v_lista from client_autotopup where enabled = true;
    return jsonb_build_object('ok', true, 'clientes', v_lista);
  exception when others then
    return jsonb_build_object('ok', false, 'erro', substr(sqlerrm, 1, 140));
  end;
end
$$;

grant execute on function public.client_autotopup_set(text, text, boolean, text) to anon;
grant execute on function public.client_autotopup_get(text, text) to anon;
grant execute on function public.client_autotopup_enabled(text) to anon;

-- ✅ Prova de 1 comando (troque o e-mail):
--   select public.client_autotopup_set('glo_ing_c7f2a9e4b8d16350','teste@x.com',true);   -- enabled:true
--   select public.client_autotopup_get('glo_ing_c7f2a9e4b8d16350','teste@x.com');        -- enabled:true
--   select public.client_autotopup_enabled('glo_ing_c7f2a9e4b8d16350');                  -- lista com o e-mail
--   select public.client_autotopup_set('glo_ing_c7f2a9e4b8d16350','teste@x.com',false);  -- enabled:false
