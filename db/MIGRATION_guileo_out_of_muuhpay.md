# Migration: separate Guileo out of the `muuh-pay` Supabase project

**Why:** Guileo's data layer was created INSIDE `muuh-pay` (ref `fccwbafkbhkyrvauzshl`) — MUUH's
**production fintech DB** (pix, NFe, rural credit, ledger; thousands of tables). That project lives
under account **luistelesc@gmail.com → "guitelesc's Org"** (NOT smart@guileoai.com, and NOT visible
to the Supabase MCP). Two businesses sharing one prod DB is a real risk → move Guileo into the
Guileo-owned project **`ynihodbknhjirkdogxby`** ("smart@guileoai.com's Project", MCP-writable).

**Status:** extraction STARTED. Not urgent — today's call-transcript feature already works via the
`call_logs` mirror in the owned project. Do NOT rush the code-repoint step (touches the live site).

## Already extracted
- **33 Guileo functions** (full source) → `guileo-site/_migra_funcs.csv` (cols: nome, args, definicao).
  Gate secret is hardcoded in them: `glo_ing_c7f2a9e4b8d16350` (= INGEST_SECRET). Recreate VERBATIM so the
  gate keeps matching the code's env — no code change to the secret needed.

### The 33 functions
add_client_credits, add_dnc, admin_actions, admin_all_events, admin_get_client_key, admin_site_stats,
booking_reply, client_agent_lookup, client_by_agent, client_conversations, client_events_since,
client_health, client_key_for, client_mark_read, client_send_message, client_thread, clients_list,
due_credit_alerts, get_client_data, get_client_profile, ingest_client_event, ingest_dormant, is_dnc,
log_consent, lookup_client_by_number, mark_credit_alerted, mark_webhook_seen, recent_activity,
set_client_agent, set_client_number, set_client_profile, store_integration. (revenue_record lives in the
OWNED project already.)

### Dependencies still to extract from muuh-pay
- **Helper functions:** `_admin_ok`, `_gui_assert_client` (gates the 33 call).
- **Tables (DDL + data):** client_events, client_credits, client_bookings, client_integrations,
  consent_log, do_not_contact, dormant_contacts, processed_webhooks, site_hits, clients,
  business_profile, kb_entries, and the messages table behind client_conversations/_thread/_send_message.

## Remaining steps
1. Extract: `_admin_ok` + `_gui_assert_client` source; each table's CREATE DDL (cols/PK/indexes); row counts; data.
   - Extraction mechanism: muuh-pay SQL editor (Luis clicks Run — classifier blocks Claude executing on
     that prod) → Export CSV → move out of TCC-protected ~/Downloads (`mv ~/Downloads/<name>.csv ~/guileo-site/...`).
     NOTE: don't use "newest csv" matching — other downloads interfere; move by exact name.
2. Recreate in `ynihodbknhjirkdogxby` via Supabase MCP `apply_migration`: tables first, then helpers, then the 33.
3. Copy data (small expected; confirm row counts first).
4. Repoint code: change `fccwbafkbhkyrvauzshl` → `ynihodbknhjirkdogxby` + anon key in the ~24 files that
   reference the data project (grep `fccwbafkbhkyrvauzshl`). Keep INGEST_SECRET env as-is.
5. `npm run build` + deploy + end-to-end test (portal real mode, webhook, leads, credits, reports).
6. Leave the muuh-pay copies untouched (don't delete) until verified for a few days.

## Cleanup
- Temp artifact `guileo-site/_migra_funcs.csv` holds the INGEST secret — delete after migration; do not commit.
