-- 2026-09-28 · A senha do /admin deixa de morar em texto puro dentro da função.
-- Antes: `select p_token = '<senha>'` — qualquer um que lesse a definição via a senha (e ela era
-- curta). Agora só a IMPRESSÃO DIGITAL (sha256) fica no banco; a senha nova foi gerada na máquina do
-- Luis, foi pro Keychain dele e pro ADMIN_TOKEN do Cloudflare, e nunca passou por chat nem por log.
-- Trocar a senha de novo: gerar, pôr no Cloudflare (ADMIN_TOKEN) e trocar SÓ o hash abaixo.
CREATE OR REPLACE FUNCTION public._admin_ok(p_token text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select coalesce(p_token, '') <> ''
     and encode(extensions.digest(p_token, 'sha256'), 'hex') = '6bef84cb565e74d692b13eef694456c38224fcc3010aa35e51125175652c8b52';
$function$;
notify pgrst, 'reload schema';
