-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- CHAVE CANÔNICA DE TELEFONE — a coluna passa a recusar formato torto.
--
-- O QUE ACONTECEU (2026-08-11): plantei uma prova do motor de reinvestimento com INSERT cru e
-- gravei `phone_key = '+19990004'`. O `_gui_phone_key()` devolve `19990004`, SEM o mais. O join
-- do `ads_roi` compara os dois, nunca casou, e o motor concluiu:
--
--     campanha-boa · gasto $300 · receita $0 · retorno 0 → REDUZIR
--
-- Ou seja: mandaria CORTAR o orçamento de uma campanha que estava dando 5 para 1. E não daria
-- erro nenhum — sairia um número tranquilo, com uma justificativa bem escrita e errada.
--
-- O caminho de produção (`ads_attr_record`, em db/ads_engine.sql) sempre chamou `_gui_phone_key`
-- e nunca errou — este comentário dizia `ads_atribuir`, nome que NÃO existe no banco (auditoria
-- repo × pg_proc em 2026-08-11); a função de produção sempre se chamou `ads_attr_record`. A
-- varredura em toda a base achou ZERO linhas tortas. Esta trava não conserta nada — ela impede
-- que o próximo INSERT fora do RPC (seed, importação de planilha, correção manual às pressas)
-- reintroduza a divergência sem ninguém ver.
--
-- POR QUE UM CHECK E NÃO UM TRIGGER QUE NORMALIZA: normalizar em silêncio esconde que alguém
-- escreveu pela porta errada. O CHECK devolve erro e a porta errada aparece na hora. Mesma
-- razão de eu ter tirado o fallback do preço na landing: onde falhar em silêncio custa dinheiro,
-- o certo é quebrar alto.
--
-- Idempotente. `_gui_phone_key` é IMMUTABLE (provolatile='i'), pré-requisito para CHECK.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'lead_attribution_phone_key_canonica'
       and conrelid = 'public.lead_attribution'::regclass
  ) then
    alter table public.lead_attribution
      add constraint lead_attribution_phone_key_canonica
      check (phone_key is null or phone_key = public._gui_phone_key(phone_key));
  end if;
end $$;
