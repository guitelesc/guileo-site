// App-wide error boundary — a runtime crash shows a warm branded recovery screen
// instead of a white page. Never let a client see the app "die".
import { Component } from "react";
import { captureError } from "../lib/monitoring.js";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { broken: false };
  }
  static getDerivedStateFromError() { return { broken: true }; }
  componentDidCatch(err, info) {
    captureError(err, { componentStack: info?.componentStack });
    // Self-heal ANY transient crash — including the deploy/CDN window where the edge serves a
    // MIXED set of chunks across deployments (new index + stale-cached chunk → a render-time
    // TypeError, not a chunk-load error, so matching on the message would miss it). One hard
    // reload re-fetches a consistent set and the page comes back. Guarded so a GENUINE persistent
    // bug reloads at most once per 2 min, then falls through to this screen (never an infinite loop).
    try {
      const k = "g_err_reloaded";
      const last = Number(sessionStorage.getItem(k) || 0);
      if (Date.now() - last > 120000) {
        sessionStorage.setItem(k, String(Date.now()));
        location.reload();
      }
    } catch { /* sessionStorage blocked → just show the recovery screen */ }
  }
  render() {
    if (!this.state.broken) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#161512", color: "#EDE7DC", fontFamily: "Inter, system-ui, sans-serif", textAlign: "center", padding: 20 }}>
        <div>
          <div style={{ fontSize: 44 }}>🌱</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: "10px 0 6px" }}>Opa — algo saiu do trilho.</h1>
          <p style={{ color: "#948C7B", fontSize: 14, maxWidth: 360, margin: "0 auto" }}>Recarrega a página que tudo volta. Se persistir, fala com a gente: smart@guileoai.com</p>
          <button onClick={() => location.reload()} style={{ marginTop: 18, padding: "12px 26px", borderRadius: 999, border: "none", fontWeight: 800, fontSize: 14, color: "#fff", background: "linear-gradient(90deg,#3E9468,#2C6E4B)", cursor: "pointer" }}>↻ Recarregar</button>
        </div>
      </div>
    );
  }
}
