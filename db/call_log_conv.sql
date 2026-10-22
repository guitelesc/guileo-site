-- call_log_conv — resolve o conversation_id da ElevenLabs de UMA ligação, só se ela for do tenant.
-- (2026-09-28) O botão "ouvir a ligação" do portal busca o áudio na ElevenLabs pelo conversation_id.
-- O navegador manda o `id` da linha (uuid) + e-mail/chave já validados em /api/call-logs; o uuid
-- SOZINHO nunca autoriza nada — o filtro por client_email é o portão. Idempotente.
create or replace function public.call_log_conv(p_secret text, p_email text, p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if not _gui_sched_ok(p_secret) then return null; end if;
  select conversation_id into v from call_logs
   where id = p_id and client_email = lower(trim(p_email)) and coalesce(conversation_id,'') <> '';
  return v;
end $$;
revoke all on function public.call_log_conv(text, text, uuid) from public, anon, authenticated;
grant execute on function public.call_log_conv(text, text, uuid) to service_role;
notify pgrst, 'reload schema';
