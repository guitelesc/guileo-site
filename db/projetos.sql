-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ACOMPANHAMENTO DE PROJETO (2026-10-08) — o checklist que a Origem e o parceiro de implantação
-- (Scale Pods) usam do começo ao fim de um projeto. Primeiro projeto: Natura Spa → Go-Live 29/10.
--
--   · /admin/projetos  (Luis)  → vê e edita tudo, marca "Aceito", gera/troca o link do parceiro.
--   · /projeto?t=<token> (Scale Pods) → vê o projeto e marca "Feito" + link da prova + nota.
--     O token É a permissão (como o /sign): só esse projeto, nada mais do sistema.
--
-- "Aceito" = o aceite por escrito da Origem no subcontrato (cláusula 4). Só o admin marca. Item
-- aceito fica TRAVADO para o parceiro (não desmarca, não troca a prova).
--
-- Padrões da casa: idempotente (pode colar de novo), RLS ligada sem policy, RPC SECURITY DEFINER,
-- admin gated por _gui_sched_ok(p_secret) (SCHED_SECRET, igual ao contract_get), parceiro gated
-- pelo token; EXECUTE só para service_role (o servidor). A semente NÃO sobrescreve progresso:
-- on conflict do nothing pela chave estável (projeto_id, chave).
-- ════════════════════════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create table if not exists public.projetos (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  nome         text not null,
  cliente      text,
  parceiro     text,
  tema         text not null default 'natura-deck',
  inicio       date,
  go_live      date,
  share_token  text unique not null default encode(gen_random_bytes(24), 'hex'),
  criado_em    timestamptz not null default now()
);

create table if not exists public.projeto_itens (
  id            uuid primary key default gen_random_uuid(),
  projeto_id    uuid not null references public.projetos(id) on delete cascade,
  chave         text not null,
  fase          text not null,
  ordem         int  not null default 0,
  titulo        text not null,          -- inglês (língua de trabalho com o parceiro)
  titulo_pt     text,                   -- português (tela do admin)
  dono          text not null default 'SP' check (dono in ('SP','OR','NA')),
  prazo         date,
  feito         boolean not null default false,
  feito_em      timestamptz,
  feito_por     text,
  aceito        boolean not null default false,
  aceito_em     timestamptz,
  bloqueado     boolean not null default false,
  prova_url     text,
  nota          text,
  atualizado_em timestamptz not null default now(),
  unique (projeto_id, chave)
);
create index if not exists projeto_itens_proj on public.projeto_itens (projeto_id, ordem);

create table if not exists public.projeto_eventos (
  id         bigserial primary key,
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  item_id    uuid references public.projeto_itens(id) on delete set null,
  quem       text not null,            -- 'origem' | 'parceiro'
  nome       text,                     -- quem do parceiro (texto livre, opcional)
  acao       text not null,            -- feito, desfeito, aceito, desaceito, prova, nota, bloqueado, comentario, item_novo, item_editado, item_apagado, link_novo
  detalhe    text,
  criado_em  timestamptz not null default now()
);
create index if not exists projeto_eventos_proj on public.projeto_eventos (projeto_id, criado_em desc);

alter table public.projetos        enable row level security;
alter table public.projeto_itens   enable row level security;
alter table public.projeto_eventos enable row level security;
revoke all on public.projetos, public.projeto_itens, public.projeto_eventos from anon, authenticated;
revoke all on sequence public.projeto_eventos_id_seq from anon, authenticated;

-- ── leitura completa de um projeto (uso interno das duas RPCs) ────────────────────────────────
create or replace function public._projeto_json(p_id uuid, p_com_token boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'projeto', (select to_jsonb(p) - case when p_com_token then 'nada' else 'share_token' end
                from public.projetos p where p.id = p_id),
    'itens',   coalesce((select jsonb_agg(to_jsonb(i) order by i.ordem, i.prazo nulls last)
                from public.projeto_itens i where i.projeto_id = p_id), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(to_jsonb(e) order by e.criado_em desc)
                from (select * from public.projeto_eventos where projeto_id = p_id
                      order by criado_em desc limit 200) e), '[]'::jsonb),
    'agora',   now()
  );
$$;

-- ── PARCEIRO: o token é a permissão ───────────────────────────────────────────────────────────
create or replace function public.projeto_parceiro(p_token text, p_acao text, p_dados jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_proj public.projetos;
  v_item public.projeto_itens;
  v_nome text := left(nullif(trim(coalesce(p_dados->>'nome', '')), ''), 60);
  v_url  text;
begin
  if p_token is null or length(p_token) < 24 then return jsonb_build_object('ok', false, 'erro', 'token'); end if;
  select * into v_proj from public.projetos where share_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'erro', 'token'); end if;

  if p_acao = 'ler' then
    return jsonb_build_object('ok', true) || public._projeto_json(v_proj.id, false);
  end if;

  if p_acao = 'comentar' then
    if length(trim(coalesce(p_dados->>'texto', ''))) = 0 then return jsonb_build_object('ok', false, 'erro', 'vazio'); end if;
    insert into public.projeto_eventos (projeto_id, item_id, quem, nome, acao, detalhe)
    values (v_proj.id, nullif(p_dados->>'item_id', '')::uuid, 'parceiro', v_nome, 'comentario', left(p_dados->>'texto', 2000));
    return jsonb_build_object('ok', true) || public._projeto_json(v_proj.id, false);
  end if;

  if p_acao = 'marcar' then
    select * into v_item from public.projeto_itens
     where id = nullif(p_dados->>'id', '')::uuid and projeto_id = v_proj.id for update;
    if not found then return jsonb_build_object('ok', false, 'erro', 'item'); end if;
    if v_item.aceito then return jsonb_build_object('ok', false, 'erro', 'aceito'); end if;

    if p_dados ? 'prova_url' then
      v_url := nullif(trim(p_dados->>'prova_url'), '');
      if v_url is not null and v_url !~* '^https://' then return jsonb_build_object('ok', false, 'erro', 'url'); end if;
      if v_url is distinct from v_item.prova_url then
        update public.projeto_itens set prova_url = left(v_url, 600), atualizado_em = now() where id = v_item.id;
        insert into public.projeto_eventos (projeto_id, item_id, quem, nome, acao, detalhe)
        values (v_proj.id, v_item.id, 'parceiro', v_nome, 'prova', v_url);
      end if;
    end if;
    if p_dados ? 'nota' and (p_dados->>'nota') is distinct from coalesce(v_item.nota, '') then
      update public.projeto_itens set nota = left(nullif(p_dados->>'nota', ''), 2000), atualizado_em = now() where id = v_item.id;
      insert into public.projeto_eventos (projeto_id, item_id, quem, nome, acao, detalhe)
      values (v_proj.id, v_item.id, 'parceiro', v_nome, 'nota', left(p_dados->>'nota', 300));
    end if;
    if p_dados ? 'bloqueado' and (p_dados->>'bloqueado')::boolean is distinct from v_item.bloqueado then
      update public.projeto_itens set bloqueado = (p_dados->>'bloqueado')::boolean, atualizado_em = now() where id = v_item.id;
      insert into public.projeto_eventos (projeto_id, item_id, quem, nome, acao)
      values (v_proj.id, v_item.id, 'parceiro', v_nome, case when (p_dados->>'bloqueado')::boolean then 'bloqueado' else 'desbloqueado' end);
    end if;
    if p_dados ? 'feito' and (p_dados->>'feito')::boolean is distinct from v_item.feito then
      update public.projeto_itens
         set feito = (p_dados->>'feito')::boolean,
             feito_em = case when (p_dados->>'feito')::boolean then now() end,
             feito_por = case when (p_dados->>'feito')::boolean then coalesce(v_nome, 'Scale Pods') end,
             bloqueado = case when (p_dados->>'feito')::boolean then false else bloqueado end,
             atualizado_em = now()
       where id = v_item.id;
      insert into public.projeto_eventos (projeto_id, item_id, quem, nome, acao)
      values (v_proj.id, v_item.id, 'parceiro', v_nome, case when (p_dados->>'feito')::boolean then 'feito' else 'desfeito' end);
    end if;
    return jsonb_build_object('ok', true) || public._projeto_json(v_proj.id, false);
  end if;

  return jsonb_build_object('ok', false, 'erro', 'acao');
end $$;

-- ── ADMIN (Origem): gated pelo segredo do servidor ────────────────────────────────────────────
create or replace function public.projeto_admin(p_secret text, p_acao text, p_dados jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_proj public.projetos;
  v_item public.projeto_itens;
  v_id   uuid;
  v_ac   boolean;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;

  if p_acao = 'listar' then
    return jsonb_build_object('ok', true, 'projetos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', p.slug, 'nome', p.nome, 'cliente', p.cliente, 'parceiro', p.parceiro, 'go_live', p.go_live,
        'total', (select count(*) from public.projeto_itens i where i.projeto_id = p.id),
        'feitos', (select count(*) from public.projeto_itens i where i.projeto_id = p.id and i.feito),
        'aceitos', (select count(*) from public.projeto_itens i where i.projeto_id = p.id and i.aceito)
      ) order by p.go_live nulls last) from public.projetos p), '[]'::jsonb));
  end if;

  select * into v_proj from public.projetos where slug = p_dados->>'slug';
  if not found then return jsonb_build_object('ok', false, 'erro', 'projeto'); end if;

  if p_acao = 'ler' then
    return jsonb_build_object('ok', true) || public._projeto_json(v_proj.id, true);
  end if;

  if p_acao = 'novo_link' then
    update public.projetos set share_token = encode(gen_random_bytes(24), 'hex') where id = v_proj.id;
    insert into public.projeto_eventos (projeto_id, quem, acao, detalhe) values (v_proj.id, 'origem', 'link_novo', 'old link revoked');
    return jsonb_build_object('ok', true) || public._projeto_json(v_proj.id, true);
  end if;

  if p_acao = 'comentar' then
    if length(trim(coalesce(p_dados->>'texto', ''))) = 0 then return jsonb_build_object('ok', false, 'erro', 'vazio'); end if;
    insert into public.projeto_eventos (projeto_id, item_id, quem, nome, acao, detalhe)
    values (v_proj.id, nullif(p_dados->>'item_id', '')::uuid, 'origem', 'Luis', 'comentario', left(p_dados->>'texto', 2000));
    return jsonb_build_object('ok', true) || public._projeto_json(v_proj.id, true);
  end if;

  if p_acao = 'apagar' then
    delete from public.projeto_itens where id = nullif(p_dados->>'id', '')::uuid and projeto_id = v_proj.id returning * into v_item;
    if found then
      insert into public.projeto_eventos (projeto_id, quem, acao, detalhe) values (v_proj.id, 'origem', 'item_apagado', v_item.titulo);
    end if;
    return jsonb_build_object('ok', true) || public._projeto_json(v_proj.id, true);
  end if;

  if p_acao = 'salvar' then
    v_id := nullif(p_dados->>'id', '')::uuid;
    if v_id is null then
      if length(trim(coalesce(p_dados->>'titulo', ''))) = 0 then return jsonb_build_object('ok', false, 'erro', 'titulo'); end if;
      insert into public.projeto_itens (projeto_id, chave, fase, ordem, titulo, titulo_pt, dono, prazo)
      values (v_proj.id, 'm-' || encode(gen_random_bytes(6), 'hex'), coalesce(nullif(p_dados->>'fase', ''), 'w1'),
              coalesce((p_dados->>'ordem')::int, (select coalesce(max(ordem), 0) + 10 from public.projeto_itens where projeto_id = v_proj.id)),
              left(p_dados->>'titulo', 300), left(nullif(p_dados->>'titulo_pt', ''), 300),
              coalesce(nullif(p_dados->>'dono', ''), 'SP'), nullif(p_dados->>'prazo', '')::date)
      returning * into v_item;
      insert into public.projeto_eventos (projeto_id, item_id, quem, nome, acao, detalhe) values (v_proj.id, v_item.id, 'origem', 'Luis', 'item_novo', v_item.titulo);
      return jsonb_build_object('ok', true) || public._projeto_json(v_proj.id, true);
    end if;

    select * into v_item from public.projeto_itens where id = v_id and projeto_id = v_proj.id for update;
    if not found then return jsonb_build_object('ok', false, 'erro', 'item'); end if;

    -- campos de texto/data (só os que vieram)
    update public.projeto_itens set
      titulo    = case when p_dados ? 'titulo'    and length(trim(p_dados->>'titulo')) > 0 then left(p_dados->>'titulo', 300) else titulo end,
      titulo_pt = case when p_dados ? 'titulo_pt' then left(nullif(p_dados->>'titulo_pt', ''), 300) else titulo_pt end,
      fase      = case when p_dados ? 'fase'      then coalesce(nullif(p_dados->>'fase', ''), fase) else fase end,
      dono      = case when p_dados ? 'dono'      then coalesce(nullif(p_dados->>'dono', ''), dono) else dono end,
      prazo     = case when p_dados ? 'prazo'     then nullif(p_dados->>'prazo', '')::date else prazo end,
      prova_url = case when p_dados ? 'prova_url' then left(nullif(trim(p_dados->>'prova_url'), ''), 600) else prova_url end,
      nota      = case when p_dados ? 'nota'      then left(nullif(p_dados->>'nota', ''), 2000) else nota end,
      bloqueado = case when p_dados ? 'bloqueado' then (p_dados->>'bloqueado')::boolean else bloqueado end,
      atualizado_em = now()
    where id = v_item.id;
    if p_dados ?| array['titulo','titulo_pt','fase','dono','prazo','prova_url','nota','bloqueado'] then
      insert into public.projeto_eventos (projeto_id, item_id, quem, nome, acao) values (v_proj.id, v_item.id, 'origem', 'Luis', 'item_editado');
    end if;

    if p_dados ? 'feito' and (p_dados->>'feito')::boolean is distinct from v_item.feito then
      update public.projeto_itens set feito = (p_dados->>'feito')::boolean,
             feito_em = case when (p_dados->>'feito')::boolean then now() end,
             feito_por = case when (p_dados->>'feito')::boolean then 'Origem' end,
             aceito = case when (p_dados->>'feito')::boolean then aceito else false end,
             aceito_em = case when (p_dados->>'feito')::boolean then aceito_em end
       where id = v_item.id;
      insert into public.projeto_eventos (projeto_id, item_id, quem, nome, acao)
      values (v_proj.id, v_item.id, 'origem', 'Luis', case when (p_dados->>'feito')::boolean then 'feito' else 'desfeito' end);
    end if;

    if p_dados ? 'aceito' and (p_dados->>'aceito')::boolean is distinct from v_item.aceito then
      v_ac := (p_dados->>'aceito')::boolean;
      -- aceitar implica feito (o aceite é sobre a entrega)
      update public.projeto_itens set aceito = v_ac, aceito_em = case when v_ac then now() end,
             feito = case when v_ac then true else feito end,
             feito_em = case when v_ac and not feito then now() else feito_em end,
             feito_por = case when v_ac and not feito then 'Origem' else feito_por end,
             bloqueado = case when v_ac then false else bloqueado end
       where id = v_item.id;
      insert into public.projeto_eventos (projeto_id, item_id, quem, nome, acao)
      values (v_proj.id, v_item.id, 'origem', 'Luis', case when v_ac then 'aceito' else 'desaceito' end);
    end if;
    return jsonb_build_object('ok', true) || public._projeto_json(v_proj.id, true);
  end if;

  return jsonb_build_object('ok', false, 'erro', 'acao');
end $$;

-- ── leitura mínima para a PRÉVIA DO LINK (só escolhe o cartão; nenhum dado sai) ────────────────
create or replace function public.projeto_tema_por_token(p_token text)
returns text language sql stable security definer set search_path = public as $$
  select tema from public.projetos where share_token = p_token;
$$;

revoke all on function public._projeto_json(uuid, boolean) from public, anon, authenticated;
revoke all on function public.projeto_parceiro(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.projeto_admin(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.projeto_tema_por_token(text) from public, anon, authenticated;
grant execute on function public.projeto_parceiro(text, text, jsonb) to service_role;
grant execute on function public.projeto_admin(text, text, jsonb) to service_role;
grant execute on function public.projeto_tema_por_token(text) to service_role;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- SEMENTE: Natura Spa × Guileo AI — implantação até o Go-Live (29/10/2026)
-- Fonte: Scale Pods Field Guide / Kickoff Pack (versão de 08/10/2026). Não sobrescreve progresso.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
insert into public.projetos (slug, nome, cliente, parceiro, tema, inicio, go_live)
values ('natura-build', 'Natura Spa × Guileo AI · Build to Go-Live', 'Natura Spa NYC Inc.', 'Scale Pods', 'natura-deck', '2026-10-09', '2026-10-29')
on conflict (slug) do nothing;

insert into public.projeto_itens (projeto_id, chave, fase, ordem, dono, prazo, titulo, titulo_pt)
select p.id, s.chave, s.fase, s.ordem, s.dono, s.prazo::date, s.titulo, s.titulo_pt
from public.projetos p
cross join (values
  -- Semana 1 · acessos, pedidos, revisão
  ('access',     'w1', 10,  'SP', '2026-10-09', 'Accept the dashboard and voice-workspace invites; 2FA on everywhere', 'Aceitar os convites do painel e do ElevenLabs; 2FA ligado em tudo'),
  ('mb-packet',  'w1', 20,  'SP', '2026-10-09', 'MindBody developer Go Live packet sent to Origem', 'Pacote do Go Live da MindBody enviado à Origem'),
  ('mb-submit',  'w1', 30,  'OR', '2026-10-09', 'Submit the MindBody developer Go Live request', 'Enviar o pedido de Go Live de desenvolvedor à MindBody'),
  ('drafts',     'w1', 40,  'SP', '2026-10-09', 'Drafts: Meta verification + App Review, WhatsApp templates, A2P resubmission, Google Business Profile request', 'Rascunhos: verificação + App Review da Meta, modelos de WhatsApp, reenvio do A2P, pedido do Perfil da Empresa no Google'),
  ('cr-first',   'w1', 50,  'SP', '2026-10-09', 'First code requests filed', 'Primeiros pedidos de código enviados'),
  ('status-1',   'w1', 60,  'SP', '2026-10-12', 'Weekly status #1', 'Status semanal nº 1'),
  ('filed',      'w1', 70,  'SP', '2026-10-12', 'Meta, A2P and Google requests filed (submission IDs)', 'Pedidos da Meta, A2P e Google enviados (com os números de protocolo)'),
  ('review',     'w1', 80,  'SP', '2026-10-12', 'Agent review on the TEST agent: greeting, languages, services, prices, hours, booking rules, hand-off, no medical advice', 'Revisão do agente de TESTE: saudação, idiomas, serviços, preços, horários, regras de agenda, transferência, sem conselho médico'),
  ('script',     'w1', 90,  'SP', '2026-10-13', 'Test-call script T-01 to T-17 (EN + PT/ES) approved by Origem', 'Roteiro de ligações T-01 a T-17 (EN + PT/ES) aprovado pela Origem'),
  ('embed',      'w1', 100, 'SP', '2026-10-13', 'Website chat embed spec approved by Origem', 'Especificação do chat do site aprovada pela Origem'),
  ('transfer-n', 'w1', 110, 'NA', '2026-10-13', 'Direct number per location for transfers', 'Número direto de cada unidade para transferências'),
  ('baseline',   'w1', 120, 'SP', '2026-10-14', 'Baseline run of the script on the TEST agent; defects logged', 'Primeira rodada do roteiro no agente de TESTE; defeitos registrados'),
  ('cr01',       'w1', 130, 'OR', '2026-10-14', 'CR-01 · Virtual-assistant + recording disclosure in every greeting', 'CR-01 · Aviso de assistente virtual + gravação em toda saudação'),
  ('cr02',       'w1', 140, 'OR', '2026-10-14', 'CR-02 · Voice reschedule / cancel / find', 'CR-02 · Remarcar / cancelar / encontrar por voz'),
  -- Semana 2 · integrações e agendamento
  ('sandbox',    'w2', 210, 'SP', '2026-10-15', 'MindBody sandbox proof: read and write per site', 'Prova no sandbox da MindBody: leitura e gravação por unidade'),
  ('fwd-plan',   'w2', 220, 'SP', '2026-10-15', 'Line-forwarding plan per line (carrier, codes, ring timer)', 'Plano de encaminhamento por linha (operadora, códigos, tempo de toque)'),
  ('resched',    'w2', 230, 'SP', '2026-10-16', 'Reschedule and cancel proven, following Natura''s rules (calendar before / after)', 'Remarcar e cancelar provados, com as regras da Natura (agenda antes / depois)'),
  ('prices',     'w2', 240, 'SP', '2026-10-16', 'Services, prices, durations and deposits per location, from Natura''s written list', 'Serviços, preços, durações e sinais por unidade, da lista escrita da Natura'),
  ('kb',         'w2', 250, 'SP', '2026-10-16', 'Knowledge base per location: hours, address, policies, never-do list', 'Base de conhecimento por unidade: horários, endereço, políticas, o que nunca fazer'),
  ('cr03',       'w2', 260, 'OR', '2026-10-16', 'CR-03 · Scale Pods named login (2FA, Natura + test account only)', 'CR-03 · Login nominal da Scale Pods (2FA, só Natura + conta de teste)'),
  ('status-2',   'w2', 270, 'SP', '2026-10-19', 'Weekly status #2', 'Status semanal nº 2'),
  ('add-svc',    'w2', 280, 'SP', '2026-10-19', 'Add a service to a visit; professional and room free; no double booking', 'Adicionar serviço a um horário; profissional e sala livres; sem conflito'),
  ('mb-gate',    'w2', 290, 'OR', '2026-10-20', 'MindBody gate: developer Go Live approved? If not, Go-Live is postponed and Natura informed', 'Portão MindBody: Go Live aprovado? Se não, Go-Live adiado e a Natura avisada'),
  ('leads',      'w2', 300, 'SP', '2026-10-20', 'Leads, follow-up list and one-tap callback proven on the test account', 'Leads, lista de retorno e retorno com um toque provados na conta de teste'),
  ('regress',    'w2', 310, 'SP', '2026-10-21', 'Full regression after CR-01 / CR-02; proofs packaged', 'Regressão completa depois do CR-01 / CR-02; provas organizadas'),
  -- Semana 3 · três unidades, encaminhamento, aceite, Go-Live
  ('locations',  'w3', 410, 'SP', '2026-10-22', 'Three-location sheet signed off: services, prices, hours, numbers', 'Ficha das três unidades aprovada: serviços, preços, horários, números'),
  ('mb-connect', 'w3', 420, 'SP', '2026-10-23', 'Both Natura MindBody sites connected, services mapped, clients imported', 'As duas contas MindBody da Natura conectadas, serviços mapeados, clientes importados'),
  ('live-test',  'w3', 430, 'SP', '2026-10-23', 'Safe live test on the agreed MindBody test resource', 'Teste real seguro no recurso de teste combinado na MindBody'),
  ('status-3',   'w3', 440, 'SP', '2026-10-26', 'Weekly status #3', 'Status semanal nº 3'),
  ('acceptance', 'w3', 450, 'SP', '2026-10-26', 'Acceptance submission for every Part 1 item, with proofs', 'Pedido de aceite de cada item da Parte 1, com provas'),
  ('webchat',    'w3', 460, 'SP', '2026-10-26', 'Website chat verified on the preview / domain', 'Chat do site verificado na prévia / no domínio'),
  ('pilot',      'w3', 470, 'SP', '2026-10-27', 'Controlled pilot on Natura''s line (Origem''s written OK; Natura informed)', 'Piloto controlado na linha da Natura (OK por escrito da Origem; Natura avisada)'),
  ('promote',    'w3', 480, 'OR', '2026-10-27', 'Promote the configuration to Natura''s live agent (standard check 17/17)', 'Levar a configuração ao agente real da Natura (padrão 17/17)'),
  ('forward',    'w3', 490, 'NA', '2026-10-28', 'Line forwarding executed; three test calls per line', 'Encaminhamento feito; três ligações de teste por linha'),
  ('evidence',   'w3', 500, 'SP', '2026-10-28', 'Final Go-Live evidence pack', 'Pacote final de provas do Go-Live'),
  ('golive',     'w3', 510, 'OR', '2026-10-29', 'Go-Live notice sent to Natura; hypercare starts', 'Aviso de Go-Live enviado à Natura; acompanhamento intensivo começa'),
  -- Parte 2 · depois da aprovação de terceiros (aprovação + 30 dias)
  ('meta',       'p2', 610, 'SP', null, 'Messenger and Instagram live (approval + 30 days)', 'Messenger e Instagram no ar (aprovação + 30 dias)'),
  ('whatsapp',   'p2', 620, 'SP', null, 'WhatsApp live (approval + 30 days)', 'WhatsApp no ar (aprovação + 30 dias)'),
  ('sms',        'p2', 630, 'SP', null, 'Text messages live after A2P approval', 'Mensagens de texto no ar depois da aprovação do A2P'),
  ('g-reviews',  'p2', 640, 'SP', null, 'Google review reply drafts (Natura approves before publishing)', 'Rascunhos de resposta às avaliações do Google (a Natura aprova antes)'),
  ('mb-match',   'p2', 650, 'SP', null, 'Customer records matched to MindBody clients', 'Fichas de clientes ligadas aos clientes da MindBody'),
  -- Partes 3–4 · depois do Go-Live
  ('part3',      'p34', 710, 'SP', null, 'Part 3 features: proven in test mode, 10 business days after Natura''s go-ahead', 'Recursos da Parte 3: provados em teste, 10 dias úteis depois do OK da Natura'),
  ('part4',      'p34', 720, 'SP', null, 'Part 4 features: approach note + test run within 180 days of Go-Live', 'Recursos da Parte 4: nota de abordagem + teste em até 180 dias após o Go-Live')
) as s(chave, fase, ordem, dono, prazo, titulo, titulo_pt)
where p.slug = 'natura-build'
on conflict (projeto_id, chave) do nothing;

-- prova: deve mostrar 1 projeto e 43 itens
select p.slug, p.go_live, count(i.*) as itens from public.projetos p left join public.projeto_itens i on i.projeto_id = p.id group by 1, 2;
