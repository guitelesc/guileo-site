# Guileo — Build / Deploy / Validate Runbook

The "system to run everything easily." Every feature ships with a **1-second test route**.

## 1. Deploy (one command)

```bash
npm run deploy          # = bash scripts/deploy.sh — build + push to the `preview` branch, prints the hash
```

- Production (`guileoai.com` / main) is **never** touched here. Production publish is a separate, explicit step the user must approve.
- Output ends with `✅ Preview: https://<hash>.guileoai.pages.dev` (+ `/portal`).

## 2. Validate (1-second routes, via Chrome MCP)

The portal uses **isolated localStorage per preview origin**, and the in-app demo login can hang in a headless tab. So:

1. Open the preview `/portal` tab.
2. Eval `scripts/smoke.js` once → installs `window.__g`.
3. `__g.seed()` → **reload the tab** (seeds the demo session on this origin).
4. Drive it with one call per check:

```js
__g.nav('Integrations')        // jump to a section
__g.openGui()                  // open Gui
__g.ask('every monday chase overdue')   // send a command
__g.lastReply()                // read Gui's answer
__g.sweep()                    // {sections, empty, blanks} across all nav
__g.state(/automations|stack|payments/) // dump matching localStorage
```

> Timing note: after a React-state click, read the DOM in a **separate** eval call (let the render flush). A `false` on an immediate same-call read is usually a race, not a bug — re-read.

## 3. Per-feature test route (the rule)

**Every time you add a feature, add its 1-second route here** so it can be re-checked instantly.

| Feature | Route (after `__g.seed()` + reload) | Pass = |
|---|---|---|
| Integrations hub | `__g.nav('Integrations')` | "plugs into your whole stack" + "Connected N/12" |
| Gui invoice | `__g.openGui()` → `__g.ask('send an invoice to my top customer')` | "invoice sent … Payments" + payment row in `__g.state(/created:payments/)` |
| Gui undo | after an action: `__g.ask('undo')` | "Undone ✓" + row removed |
| Gui bilingual | `__g.ask('manda uma fatura pro meu melhor cliente')` | reply starts "Pronto ✓ — fatura enviada" |
| Gui why | `__g.ask('why did you suggest that?')` | "I rank actions by $ at risk × …" |
| Gui across stack | `__g.ask('post this to instagram')` | "Posted ✓ … Social" |
| Gui automation | `__g.ask('every monday chase overdue')` | "Set ✓ … every Monday" + `__g.state(/automations/)` |
| Proactive radar | `__g.openGui()` | "👀 Heads up — …" + launcher badge count |
| Weekly summary | `__g.nav('Overview')` | "Your week, by Gui" card |
| Full sweep | `__g.sweep()` | `{empty: 0}` |

## 4. Backup (never lose progress)

```bash
rsync -a --delete --exclude node_modules --exclude dist --exclude .git /tmp/guileo-novo/ /Users/guiteles/guileo-site/
cd /Users/guiteles/guileo-site && git add -A && git commit -m "…"   # author: Luis Teles <luistelesc@gmail.com>
```

## 5. Deferred (needs the user — NOT in preview flow)

Supabase keys + `// CONNECT:` branches · `guileoai.com` DNS → Cloudflare · production publish · real OAuth for integrations. Seams are ready: `:stack`→real APIs, `:automations`→cron, `guiAlerts`→push, `guiPlan`→LLM tool-calling.
