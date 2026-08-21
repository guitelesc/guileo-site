-- ============================================================================
-- Guileo · A VOZ DA PRÓPRIA GUILEO NA LANDING — teto de custo do slug reservado "guileo"
-- Supabase → SQL Editor → Run. Project ynihodbknhjirkdogxby. Idempotente: pode rodar 2x.
-- Depende de db/voice_web.sql (tabelas voice_web_sessions / voice_web_limits).
-- ----------------------------------------------------------------------------
-- POR QUE ESTE ARQUIVO EXISTE
-- O botão de voz do site do CLIENTE fica numa página que só o cliente dele visita. O botão da
-- landing da Guileo fica na porta de entrada de um site com anúncio apontando pra ele — é a
-- superfície de voz mais exposta que existe no produto, e a única onde o minuto sai do bolso
-- da Guileo, não do teto de um cliente pagante.
--
-- O medidor JÁ EXISTE e é o mesmo (voice_web_reserve): reserva o teto ao abrir, devolve a sobra
-- ao fechar, conta por IP, por tenant e pela plataforma inteira. O que faltava era a LINHA de
-- limites do tenant interno — sem ela, a landing herdaria o padrão de cliente pagante
-- (4 min/sessão, 60 min/dia, 40 sessões), que é generoso demais pra uma porta pública.
--
-- OS NÚMEROS, e por que estes: 3 minutos bastam pra provar que a Gui atende (a demo telefônica
-- média não passa disso); 30 minutos/dia é o custo máximo que a landing pode gastar sem alguém
-- ter decidido gastar mais; 20 sessões/dia mantém o teto diário coerente com o teto de sessão.
-- Aumentar é uma linha de UPDATE — e deve ser uma DECISÃO, não um padrão herdado.
--
-- ⚠️ NÃO APLICADO. Enquanto esta linha não existir, a voz da landing continua funcionando com
-- o padrão de cliente (mais folgado). Nada quebra sem ela; o que falta é a trava apertada.
-- ============================================================================

insert into public.voice_web_limits (client_email, enabled, session_seconds, daily_seconds, daily_sessions)
values ('demo@guileoai.com', true, 180, 1800, 20)
on conflict (client_email) do update
  set enabled         = excluded.enabled,
      session_seconds = excluded.session_seconds,
      daily_seconds   = excluded.daily_seconds,
      daily_sessions  = excluded.daily_sessions,
      updated_at      = now();

-- PROVA (rodar depois do paste):
--   select * from public.voice_web_limits where client_email = 'demo@guileoai.com';
--     -- esperado: enabled=t, session_seconds=180, daily_seconds=1800, daily_sessions=20
--   select public.voice_web_stats('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com');
--     -- esperado: teto_sessao=180, teto_dia=1800, teto_sessoes=20
--
-- DESLIGAR A VOZ DA LANDING EM UM COMANDO (se a conta da ElevenLabs apertar):
--   update public.voice_web_limits set enabled = false, updated_at = now()
--    where client_email = 'demo@guileoai.com';
--   -- a landing passa a mostrar "a voz está desativada neste momento" e o convite de LIGAÇÃO
--   -- continua no ar. Nenhum deploy necessário.
