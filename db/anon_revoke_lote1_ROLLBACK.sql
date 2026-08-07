-- ⏪ VOLTA ATRÁS do lote 1 de revogação do anon (2026-08-04).
--
-- Cole ISTO no SQL editor do Supabase se qualquer coisa quebrar depois do lote 1.
-- Devolve exatamente os grants que existiam antes — nada mais, nada menos.
--
-- O lote 1 revogou 41 funções que NENHUM código chama pela chave anon
-- (nem o navegador em src/, nem os Workers em functions/). A única dependência
-- interna era biz_appt_guard → _biz_special_for, e as duas caíram juntas: chamada
-- de dentro de uma função SECURITY DEFINER roda como DONO, não como anon.

grant execute on function public._admin_ok(p_token text) to anon, authenticated;
grant execute on function public._ads_norm_status(p_status text) to anon, authenticated;
grant execute on function public._ads_ok(p_secret text) to anon, authenticated;
grant execute on function public._agent_eval_ok(p_secret text) to anon, authenticated;
grant execute on function public._biz_special_for(p_email text, p_date date) to anon, authenticated;
grant execute on function public._capture_ok(p_secret text) to anon, authenticated;
grant execute on function public._cls_ok(p_secret text) to anon, authenticated;
grant execute on function public._crl_ok(p_secret text) to anon, authenticated;
grant execute on function public._cx_sentiment(p_score numeric) to anon, authenticated;
grant execute on function public._esup_ok(p_secret text) to anon, authenticated;
grant execute on function public._gui_assert_client(p_email text, p_key text) to anon, authenticated;
grant execute on function public._inbox_events(p_client_email text) to anon, authenticated;
grant execute on function public._kb_ok(p_secret text) to anon, authenticated;
grant execute on function public._mkt_ok(p_secret text) to anon, authenticated;
grant execute on function public._onb_ord(p_step text) to anon, authenticated;
grant execute on function public._ops_sched_ok(p_secret text) to anon, authenticated;
grant execute on function public._pool_ok(p_secret text) to anon, authenticated;
grant execute on function public._slc_ok(p_secret text) to anon, authenticated;
grant execute on function public._sp_ok(p_secret text) to anon, authenticated;
grant execute on function public._sup_ok(p_secret text) to anon, authenticated;
grant execute on function public.agent_evals_recent(p_secret text, p_limit integer) to anon, authenticated;
grant execute on function public.autonomy_get(p_secret text, p_email text) to anon, authenticated;
grant execute on function public.biz_appt_guard() to anon, authenticated;
grant execute on function public.biz_release_expired() to anon, authenticated;
grant execute on function public.crm_campaign_upsert(p_secret text, p_email text, p_name text, p_channel text, p_segment text, p_message text, p_status text, p_audience integer) to anon, authenticated;
grant execute on function public.crm_invoice_upsert(p_secret text, p_email text, p_contact_id uuid, p_amount_cents bigint, p_status text, p_due_at timestamp with time zone, p_number text, p_deal_id uuid) to anon, authenticated;
grant execute on function public.crm_leads_recent(p_secret text, p_email text, p_days integer) to anon, authenticated;
grant execute on function public.gb_creds_store(p_secret text, p_email text, p_tokens jsonb) to anon, authenticated;
grant execute on function public.gui_release_expired_holds(p_secret text) to anon, authenticated;
grant execute on function public.mb_creds_store(p_secret text, p_email text, p_tokens jsonb) to anon, authenticated;
grant execute on function public.ops_capacity_upsert(p_secret text, p_email text, p_resource_kind text, p_slot_start timestamp with time zone, p_slot_end timestamp with time zone, p_max_units integer, p_appointment_id uuid) to anon, authenticated;
grant execute on function public.ops_inventory_86(p_secret text, p_email text, p_sku text, p_on boolean) to anon, authenticated;
grant execute on function public.ops_inventory_upsert(p_secret text, p_email text, p_sku text, p_name text, p_on_hand integer, p_reorder_point integer, p_reorder_qty integer, p_cost_cents bigint, p_unit text) to anon, authenticated;
grant execute on function public.revenue_summary(p_secret text, p_email text, p_days integer) to anon, authenticated;
grant execute on function public.seller_code_set(p_secret text, p_email text, p_code text) to anon, authenticated;
grant execute on function public.slowday_auto_enabled(p_secret text, p_email text) to anon, authenticated;
grant execute on function public.slowday_set_auto(p_secret text, p_email text, p_on boolean) to anon, authenticated;
grant execute on function public.spend_policy_get(p_secret text, p_email text) to anon, authenticated;
grant execute on function public.spend_policy_set(p_secret text, p_email text, p_max_single_cents integer, p_max_day_cents integer, p_require_human_over_cents integer) to anon, authenticated;
grant execute on function public.whatsapp_cloud_creds_lookup(p_secret text, p_email text) to anon, authenticated;
grant execute on function public.whatsapp_cloud_prune_seen(p_secret text) to anon, authenticated;
