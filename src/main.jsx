import './lib/linkDeSenha.js'   // primeiro de todos: ver o arquivo
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// Build stamp — also forces fresh content-hashed asset names on each wave, so a client that
// cached a half-deployed bundle during a prior propagation window pulls the clean one.
window.__GUILEO_BUILD__ = "2026-07-21-pulse-timeline";
import { initAnalytics } from './lib/analytics.js'
import { initMonitoring } from './lib/monitoring.js'

// Boot ad pixels / conversion tracking once. No-ops entirely until pixel IDs
// are filled into src/lib/analytics.js (TRACKING_IDS) — dev/demo stay clean.
initAnalytics()
// Boot error monitoring (Sentry). No-ops until a DSN is set in src/lib/monitoring.js;
// the SDK isn't even downloaded until then. The ErrorBoundary reports through it.
initMonitoring()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
