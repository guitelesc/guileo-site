-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- FASES no Growth Report da Natura Spa (id a276494b-e09d-4ade-ad96-7b112eb0d663)
-- SEM RE-SCAN: o site dela bloqueia robô, então os fatos NÃO mudam. Isto só acrescenta ao payload
-- já gravado as duas chaves novas do motor — `fase` em cada passo de `estrategia` + o resumo
-- `fases` (o total defensável da Fase 1 e o aviso de potencial da Fase 2). Gerado pelos MESMOS
-- helpers exportados que o motor usa no scan (faseDoPasso / passosAvancar / ordenarFases /
-- resumoFases em functions/lib/avaliacao.js), sobre os dados internos já gravados no próprio id.
-- Idempotente: rodar duas vezes dá o mesmo resultado (as chaves são substituídas, não somadas).
-- ══════════════════════════════════════════════════════════════════════════════════════════════

update public.business_evaluations
   set payload = payload || $json$
{
 "estrategia": [
  {
   "gap": "93h/week with no one on the phone (the platform's own calendar)",
   "prioridade": 1,
   "produto_id": "answering",
   "recomendacao": "A 24/7 voice agent answering on your current number — it covers exactly the window where a call turns into voicemail today.",
   "produto_guileo": "Gui — 24/7 voice agent",
   "fase": "parar"
  },
  {
   "gap": "No text channel at all",
   "prioridade": 3,
   "produto_id": "widget_whatsapp",
   "recomendacao": "Chat widget + WhatsApp with the same agent and the same calendar — captures the people who will never call.",
   "produto_guileo": "Guileo Widget + WhatsApp",
   "fase": "parar"
  },
  {
   "gap": "A lead writes in and waits",
   "prioridade": 3,
   "produto_id": "speedlead",
   "recomendacao": "A submitted form becomes an agent call in ~60 seconds — whoever answers first keeps the customer.",
   "produto_guileo": "Speed-to-lead",
   "fase": "parar"
  },
  {
   "gap": "Catalog with unpriced services (17 of 20 priced)",
   "prioridade": 4,
   "produto_id": "catalog",
   "recomendacao": "Price the whole catalog — a service with no price becomes an invented quote on the call, or a quote request that waits for a human.",
   "produto_guileo": "Priced catalog + Close & Collect",
   "fase": "parar"
  },
  {
   "prioridade": 6,
   "fase": "avancar",
   "gap": "Recurring revenue sitting idle: 1 package(s) created and 0 sold, 0 membership(s), 0 gift card(s)",
   "recomendacao": "Sell packages/memberships on the call itself and by link — a customer who buys a package comes back by contract, not by memory.",
   "produto_id": "close_collect",
   "produto_guileo": "Packages, Memberships & Gift Cards",
   "potencial": "each package sold books several visits at once — potential: depends on how many customers accept prepaying and on the price you set."
  },
  {
   "prioridade": 7,
   "fase": "avancar",
   "gap": "27 calls recorded and 3 booking(s): 24 people reached out and never booked",
   "recomendacao": "The agent calls back everyone who reached out and didn't book — and everyone who hasn't returned in a while — with the offer and the calendar in hand.",
   "produto_id": "reactivation",
   "produto_guileo": "Automatic reactivation",
   "potencial": "each recovered visit is worth ~$116 at your average ticket — potential: depends on how many of those people are still interested and pick up the phone."
  },
  {
   "prioridade": 9,
   "fase": "avancar",
   "gap": "Today demand comes only from people who already know you: 27 calls in 30 days, 3 became bookings",
   "recomendacao": "Paid campaigns with the lead landing straight on the agent — every ad measured by bookings, not by clicks.",
   "produto_id": "marketing_ads",
   "produto_guileo": "Campaigns (Guileo AD)",
   "potencial": "opens a demand source that doesn't exist today — potential: depends on budget, market and creative; we measure it campaign by campaign after it's live."
  }
 ],
 "fases": {
  "parar": {
   "nome": "Stop the loss",
   "passos": 4,
   "cobre": {
    "valor": 1278,
    "moeda": "USD",
    "premissa": "The only dollar figure MEASURED in this report is the revenue at risk ($1,278/month), which comes from the calls that hit voicemail today — and 24/7 answering covers exactly that window. The other Phase 1 steps close measured gaps that have no dollar figure of their own; we don't add invented numbers, so they are not in this total."
   }
  },
  "avancar": {
   "nome": "Advance",
   "passos": 3,
   "aviso": "Every Phase 2 gain is POTENTIAL — it depends on what each step states. None of it has been measured in your business yet."
  }
 }
}
$json$::jsonb
 where id = 'a276494b-e09d-4ade-ad96-7b112eb0d663';

-- PROVA (tem que voltar 4 / 3 / 1278):
select jsonb_array_length(jsonb_path_query_array(payload,'$.estrategia[*] ? (@.fase == "parar")'))   as fase1_passos,
       jsonb_array_length(jsonb_path_query_array(payload,'$.estrategia[*] ? (@.fase == "avancar")')) as fase2_passos,
       payload->'fases'->'parar'->'cobre'->>'valor'                                                  as fase1_cobre_usd
  from public.business_evaluations
 where id = 'a276494b-e09d-4ade-ad96-7b112eb0d663';
