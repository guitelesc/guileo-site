-- GUILEO — call_logs: per-call analysis + full transcript, in the project Luis OWNS
-- (ynihodbknhjirkdogxby). The legacy data project (fccwbafkbhkyrvauzshl) lives on an
-- account we can't administer, so the webhook MIRRORS every call here and the portal
-- reads transcripts from here (via /api/call-logs). Gated by the existing _gui_sched_ok.
-- Applied via Supabase MCP migrations: call_logs_with_transcript + call_logs_conv_unique_fix.

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  conversation_id text,
  created_at timestamptz not null default now(),
  summary text,
  sentiment text,            -- positive | neutral | negative
  intent text,
  note text,
  duration_secs int,
  success text,
  end_reason text,
  amount numeric not null default 0,
  transcript jsonb not null default '[]'::jsonb
);
create index if not exists idx_call_logs_email on public.call_logs(client_email, created_at desc);
-- plain unique (NULLs distinct) so ON CONFLICT (conversation_id) works; webhook maps '' -> NULL.
create unique index if not exists uq_call_logs_conv on public.call_logs(conversation_id);
alter table public.call_logs enable row level security;

-- WRITE (idempotent on conversation_id) — called by the ElevenLabs webhook mirror.
create or replace function public.log_call(
  p_secret text, p_email text, p_conv text, p_summary text, p_sentiment text, p_intent text,
  p_note text, p_duration int, p_success text, p_end_reason text, p_amount numeric, p_transcript jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  if coalesce(p_email,'')='' then return jsonb_build_object('ok',false); end if;
  insert into call_logs(client_email,conversation_id,summary,sentiment,intent,note,duration_secs,success,end_reason,amount,transcript)
    values (p_email, nullif(p_conv,''), p_summary, p_sentiment, p_intent, p_note, p_duration, p_success, p_end_reason, coalesce(p_amount,0), coalesce(p_transcript,'[]'::jsonb))
  on conflict (conversation_id) do update set
    summary=excluded.summary, sentiment=excluded.sentiment, intent=excluded.intent, note=excluded.note,
    duration_secs=excluded.duration_secs, success=excluded.success, end_reason=excluded.end_reason,
    amount=excluded.amount, transcript=excluded.transcript
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end $$;

-- READ — called by /api/call-logs after it validates the client's connection key.
create or replace function public.get_call_logs(p_secret text, p_email text, p_limit int default 100)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'created_at',created_at,'summary',summary,'sentiment',sentiment,'intent',intent,'note',note,
      'duration_secs',duration_secs,'success',success,'end_reason',end_reason,'amount',amount,'transcript',transcript
    ) order by created_at desc),'[]'::jsonb)
    into v from (select * from call_logs where client_email=p_email order by created_at desc limit p_limit) t;
  return jsonb_build_object('calls', coalesce(v,'[]'::jsonb));
end $$;
