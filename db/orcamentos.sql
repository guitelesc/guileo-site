-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PEDIDO DE ORÇAMENTO — o que acontece quando a agente não tem o preço (2026-08-17)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- A lição v12 já mandava capturar: «NENHUMA RECUSA É A ÚLTIMA FRASE… registre como pedido de
-- orçamento». E a agente obedecia — pedia nome e telefone e dizia "já anotei seu número".
--
-- SÓ QUE "REGISTRE" NÃO TINHA ONDE. Testado em produção com a Lilian (Natura Spa): pedi
-- CoolSculpting Elite, dei nome e telefone, ela respondeu "I've got your number saved". No banco
-- sobrou UM TELEFONE — sem nome, sem serviço, sem motivo. O dono abre o CRM e vê um número solto.
-- Ele não consegue "retornar personalizado" porque não sobrou nada para personalizar: uma venda de
-- CoolSculpting virou uma ligação fria.
--
-- É a mesma família do defeito que atravessou o dia: a promessa é feita, o registro é parcial, e o
-- buraco só aparece quando alguém vai usar o dado. Aqui o custo é a venda mais cara do catálogo.
--
-- ⚠️ O CASAMENTO DO SERVIÇO MORA AQUI, NÃO NO JS. Se cada canal (webchat, voz, WhatsApp, SMS)
-- tentasse descobrir sozinho "qual serviço a pessoa pediu", teríamos quatro heurísticas divergindo
-- com o tempo — e a lição do dia é que regra duplicada é regra que some numa cópia. A RPC recebe a
-- MENSAGEM CRUA e resolve; os canais só entregam o que ouviram.
--
-- ⚠️ E ELA SÓ REGISTRA O QUE PODE PROVAR: sem telefone (ou e-mail) não há pedido, porque orçamento
-- sem como retornar é lixo que infla painel. Devolve null, e quem chamou sabe que não capturou.

create table if not exists public.biz_quote_requests (
  id             uuid primary key default gen_random_uuid(),
  client_email   text not null,
  contact_id     uuid,
  customer_name  text,
  phone          text,
  -- mesma chave canônica do CRM: telefone sem "+" nem pontuação. Foi a falta dela que já partiu a
  -- memória de um cliente em duas pessoas (ver project_guileo_caller_identity).
  phone_key      text generated always as (nullif(regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g'), '')) stored,
  email          text,
  service_id     uuid,          -- quando casou com o catálogo
  service_name   text not null, -- o que a pessoa PEDIU, mesmo que não exista no catálogo
  channel        text,          -- webchat | voice | whatsapp | sms | form
  lang           text,
  note           text,
  status         text not null default 'pendente', -- pendente | cotado | fechado | perdido
  quoted_cents   integer,
  quoted_at      timestamptz,
  responded_at   timestamptz,   -- quando alguém (Gui ou humano) de fato retornou
  attempts       integer not null default 0,
  last_attempt_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_quote_req_tenant_status on public.biz_quote_requests (client_email, status, created_at desc);
create index if not exists idx_quote_req_phonekey on public.biz_quote_requests (client_email, phone_key);

alter table public.biz_quote_requests enable row level security;
-- sem policy para anon: só as RPCs SECURITY DEFINER abaixo entram aqui.

-- ── CAPTURA ─────────────────────────────────────────────────────────────────────────────────────
-- Recebe a mensagem CRUA e decide sozinha se há pedido de orçamento a registrar.
-- Regra: existe um serviço DESTE tenant, SEM preço, cujo nome aparece na mensagem? Então é pedido.
-- Se o serviço não existir no catálogo mas a pessoa pediu preço de algo, ainda registramos com o
-- texto dela — porque "o que o cliente pede e você não vende" é exatamente o dado de crescimento.
create or replace function public.biz_quote_capture(
  p_secret text, p_email text, p_phone text, p_name text, p_message text,
  p_channel text default 'webchat', p_lang text default 'en', p_service text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e text := lower(trim(coalesce(p_email,'')));
  msg text := translate(lower(coalesce(p_message,'')),
              'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  fone text := nullif(trim(coalesce(p_phone,'')), '');
  chave text := nullif(regexp_replace(coalesce(fone,''), '[^0-9]', '', 'g'), '');
  s record; achado uuid; nome_serv text; novo uuid;
  nome text := nullif(trim(coalesce(p_name,'')), '');
  m text[]; w text;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  if e = '' then return null; end if;
  -- SEM COMO RETORNAR, NÃO É PEDIDO. Orçamento que não dá pra responder é número em painel.
  if chave is null then return null; end if;

  -- NOME NA PRÓPRIA MENSAGEM. O canal manda o nome da sessão — e visitante anônimo não tem sessão
  -- com nome. Na 1ª captura real ("My name is Ana…") o telefone entrou e o nome se perdeu, e o
  -- retorno "personalizado" viraria "Hi!". A extração mora AQUI pela mesma razão do casamento de
  -- serviço: se cada canal tivesse seu regex, teríamos quatro divergindo. EN/PT/ES, conservador:
  -- só depois de um marcador explícito, 1-3 palavras, e corta o que claramente não é nome.
  if nome is null then
    m := regexp_match(coalesce(p_message,''),
      '(?:my name is|i''?m|this is|meu nome [ée]|me chamo|aqui [ée]|mi nombre es|me llamo|soy)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2})', 'i');
    if m is not null then
      -- \m…\M = fronteira de palavra: sem ela, o "e" da lista comia o E final de "Mike" → "Mik".
      nome := trim(regexp_replace(m[1],
        '\s+\m(?:and|e|y|my|meu|mi|calling|interested|from|de|da|do)\M(\s.*)?$', '', 'i'));
      nome := nullif(initcap(nome), '');
    end if;
  end if;

  -- 1) serviço explícito (o canal já sabe qual é) tem prioridade sobre adivinhar pelo texto
  if p_service is not null and trim(p_service) <> '' then
    nome_serv := trim(p_service);
    select id into achado from biz_services
     where client_email = e and lower(name) = lower(nome_serv) limit 1;
  else
    -- 2) casa pelo nome: serviço SEM preço cujo nome (ou a 1ª palavra dele) aparece na mensagem.
    --    Ordena pelo nome mais longo primeiro para "CoolSculpting Elite" ganhar de "CoolSculpting".
    -- CASAMENTO ATRAVESSA IDIOMA. O catálogo é em inglês e o cliente pede em português/espanhol:
    -- "Acupuncture" × "acupuntura", "Laser…" × "láser". A 1ª captura real em PT prometeu "já anotei"
    -- e NÃO gravou nada — o nome nunca casaria letra a letra. Radical de 5 letras com acento dobrado
    -- casa as três línguas ("acupu", "laser", "cools") sem heurística por canal.
    for s in
      select id, name from biz_services
       where client_email = e and price_cents is null and active is true
       order by length(name) desc
    loop
      if position(lower(s.name) in msg) > 0 then
        achado := s.id; nome_serv := s.name; exit;
      end if;
      foreach w in array regexp_split_to_array(
        translate(lower(s.name), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z]+')
      loop
        if length(w) >= 5 and position(left(w, 5) in msg) > 0 then
          achado := s.id; nome_serv := s.name; exit;
        end if;
      end loop;
      exit when nome_serv is not null;
    end loop;
  end if;

  if nome_serv is null then return null; end if;

  -- 3) DEDUPE: mesma pessoa pedindo o mesmo serviço em 24h é a MESMA conversa, não dois pedidos.
  --    Sem isto, cada mensagem de um papo vira uma linha e o dono vê 5 orçamentos de 1 pessoa.
  select id into novo from biz_quote_requests
   where client_email = e and phone_key = chave and lower(service_name) = lower(nome_serv)
     and status = 'pendente' and created_at > now() - interval '24 hours'
   limit 1;
  if novo is not null then
    update biz_quote_requests
       set customer_name = coalesce(nome, customer_name),
           updated_at = now()
     where id = novo;
    return novo;
  end if;

  insert into biz_quote_requests (client_email, customer_name, phone, service_id, service_name, channel, lang, note)
  values (e, nome, fone, achado, nome_serv, coalesce(p_channel,'webchat'), p_lang,
          left(coalesce(p_message,''), 400))
  returning id into novo;
  return novo;
end $$;

-- ── FILA DE RETORNO ─────────────────────────────────────────────────────────────────────────────
-- Quem já pode receber a ligação de volta. Espera alguns minutos (a conversa pode continuar e virar
-- agendamento sozinha), limita tentativas, e nunca devolve quem já foi respondido.
create or replace function public.biz_quotes_due(
  p_secret text, p_email text, p_min_idade_min integer default 10,
  p_max_tentativas integer default 3, p_limit integer default 50
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email,''))); out jsonb;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'nome', q.customer_name, 'phone', q.phone, 'servico', q.service_name,
           'canal', q.channel, 'lang', q.lang, 'tentativas', q.attempts,
           'minutos', round(extract(epoch from (now() - q.created_at))/60.0)
         ) order by q.created_at), '[]'::jsonb) into out
    from biz_quote_requests q
   where q.client_email = e
     and q.status = 'pendente'
     and q.responded_at is null
     and q.phone is not null
     and q.attempts < greatest(coalesce(p_max_tentativas,3), 1)
     and q.created_at < now() - (greatest(coalesce(p_min_idade_min,10),0) || ' minutes')::interval
     and (q.last_attempt_at is null or q.last_attempt_at < now() - interval '4 hours')
   limit greatest(least(coalesce(p_limit,50), 200), 1);
  return jsonb_build_object('ok', true, 'due', out);
end $$;

-- ── MARCAR ──────────────────────────────────────────────────────────────────────────────────────
create or replace function public.biz_quote_mark(
  p_secret text, p_email text, p_id uuid, p_status text default null,
  p_quoted_cents integer default null, p_tentou boolean default false
) returns boolean
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email,''))); n int;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  update biz_quote_requests
     set status = coalesce(nullif(trim(coalesce(p_status,'')),''), status),
         quoted_cents = coalesce(p_quoted_cents, quoted_cents),
         quoted_at = case when p_quoted_cents is not null then now() else quoted_at end,
         responded_at = case when coalesce(p_status,'') in ('cotado','fechado','perdido') then now() else responded_at end,
         attempts = attempts + (case when p_tentou then 1 else 0 end),
         last_attempt_at = case when p_tentou then now() else last_attempt_at end,
         updated_at = now()
   where id = p_id and client_email = e;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ── INTELIGÊNCIA DE CRESCIMENTO ─────────────────────────────────────────────────────────────────
-- O dado que ninguém coleta e que vale dinheiro: o que os clientes MAIS PEDEM e o negócio ainda não
-- sabe vender. Cada linha aqui é o mercado dizendo onde falta preço no catálogo.
create or replace function public.biz_quotes_top_missing(
  p_secret text, p_email text, p_days integer default 90
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email,''))); d int := greatest(least(coalesce(p_days,90),730),1); out jsonb;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  select coalesce(jsonb_agg(x order by x->>'pedidos' desc), '[]'::jsonb) into out from (
    select jsonb_build_object(
      'servico', q.service_name,
      'pedidos', count(*),
      'pessoas', count(distinct q.phone_key),
      'no_catalogo', bool_or(q.service_id is not null),
      'fechados', count(*) filter (where q.status = 'fechado'),
      'perdidos', count(*) filter (where q.status = 'perdido'),
      'sem_resposta', count(*) filter (where q.responded_at is null)
    ) as x
    from biz_quote_requests q
    where q.client_email = e and q.created_at > now() - (d || ' days')::interval
    group by q.service_name
  ) t;
  return jsonb_build_object('ok', true, 'janela_dias', d, 'servicos', out);
end $$;

grant execute on function public.biz_quote_capture(text,text,text,text,text,text,text,text) to anon;
grant execute on function public.biz_quotes_due(text,text,integer,integer,integer) to anon;
grant execute on function public.biz_quote_mark(text,text,uuid,text,integer,boolean) to anon;
grant execute on function public.biz_quotes_top_missing(text,text,integer) to anon;
