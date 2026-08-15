-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- RESERVA DE UMA LINHA — a peça que faltava para o post não sair duas vezes.
--
-- O DEFEITO (achado por revisão adversarial, 2026-08-11)
-- Havia DOIS caminhos que publicam na conta do cliente:
--   · o cockpit  (o dono clica "Aprovar", ou o modo automático) → chamava publishRow() DIRETO;
--   · a varredura (cron)                                        → reservava antes, com claim_publish.
-- A reserva só carimba `meta.publish_claim_at` — a linha continua `status='draft'` e
-- `external_id` nulo. Ou seja: a linha que o cockpit está publicando NESTE SEGUNDO seguia 100%
-- elegível para a varredura.
--
--   14:00:00  dono clica Aprovar → publishToMeta faz 2 chamadas ao Instagram (segundos de rede)
--   14:00:03  a varredura reivindica a MESMA linha e publica de novo
--   →         dois posts idênticos no perfil do cliente
--
-- A janela é o round-trip inteiro da Meta, em 100% dos aprovar/automático. Estava latente só
-- porque a varredura não estava ligada ao cron — e ligar a varredura (que é o conserto do outro
-- defeito, "post agendado nunca publica") era exatamente o gatilho que armava este. Por isso os
-- dois só podiam ser resolvidos juntos.
--
-- A SOLUÇÃO: uma porta única. `publishRow()` passa a reservar SEMPRE, e quem já tem a reserva
-- (a varredura) avisa que já tem. Esta função é a reserva de UMA linha, por id, atômica.
--
-- POR QUE `for update skip locked` E NÃO UM SELECT-DEPOIS-UPDATE: entre ler e escrever cabe outro
-- processo inteiro. O lock na leitura é o que torna "reservei" uma afirmação verdadeira em vez de
-- uma esperança. `skip locked` faz o segundo pedido devolver vazio na hora, em vez de esperar.
--
-- Devolve a linha reservada, ou NULL quando: não existe, não é deste tenant, não está em 'draft',
-- já tem external_id (já publicada), ou já está reservada há menos de 30 minutos por outro.
-- NULL aqui significa "não é sua para publicar" — e quem chamou tem que respeitar.
-- Idempotente. Revogada de anon/public: só o service_role das Pages Functions chama.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.social_post_claim_one(p_secret text, p_email text, p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_tenant text := lower(trim(coalesce(p_email,''))); v_out jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' or p_id is null then return null; end if;

  with alvo as (
    select id from public.social_posts
     where id = p_id
       and client_email = v_tenant          -- TENANT SEMPRE: UUID sozinho nunca autoriza (lei da casa)
       and status = 'draft'
       and external_id is null              -- já publicada não se republica, nunca
       and (
         meta->>'publish_claim_at' is null
         or (meta->>'publish_claim_at')::timestamptz < now() - interval '30 minutes'
       )
     for update skip locked                 -- quem chegar depois leva vazio em vez de esperar
  ),
  reservada as (
    update public.social_posts s
       set meta = coalesce(s.meta,'{}'::jsonb) || jsonb_build_object('publish_claim_at', now()),
           updated_at = now()
      from alvo a
     where s.id = a.id
     returning s.*
  )
  select to_jsonb(reservada) into v_out from reservada;

  return v_out;   -- NULL = não é sua para publicar
exception when undefined_table then return null;
end $function$;

revoke all on function public.social_post_claim_one(text,text,uuid) from anon, public;
