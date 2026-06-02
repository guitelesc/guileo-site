import { useState } from "react";
import { CATS, CLAUSES } from "../data/contratos";

export default function Contratos() {
  const [view, setView] = useState("index");
  const current = CATS.find((c) => c.code === view);

  if (view === "index") {
    return (
      <div style={{ fontFamily: "system-ui,sans-serif", background: "#F4F7F2", minHeight: "100vh", padding: 20 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ background: "#13211B", borderRadius: 14, padding: "22px 26px", marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#7FB800" }}>GUILEO · CONTRATOS</div>
            <div style={{ fontSize: 13, color: "#9fb0a4", marginTop: 4 }}>Área interna · 10 modelos de prestação de serviços · 2026</div>
            <div style={{ fontSize: 11, color: "#6f8074", marginTop: 8 }}>
              Selecione a categoria. Cada contrato é autocontido (escopo + 12 cláusulas legais + assinatura). Para assinar: imprima (Ctrl+P) ou exporte como PDF.
            </div>
            <a href="/" style={{ fontSize: 12, color: "#7FB800", textDecoration: "none", marginTop: 8, display: "inline-block" }}>← Voltar ao site</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}>
            {CATS.map((cat) => (
              <div key={cat.code} onClick={() => setView(cat.code)} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", cursor: "pointer", boxShadow: "0 2px 8px rgba(20,60,40,.08)", borderTop: `4px solid ${cat.color}` }}>
                <div style={{ padding: "16px 16px 12px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: cat.color, marginBottom: 4 }}>{cat.code}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#13211B" }}>{cat.icon} {cat.cat}</div>
                  <div style={{ fontSize: 11, color: "#5E6E63", marginTop: 4, lineHeight: 1.5 }}>{cat.subtitle}</div>
                </div>
                <div style={{ background: cat.color + "12", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: cat.color }}>{cat.price}</div>
                    <div style={{ fontSize: 10, color: "#5E6E63" }}>{cat.timeline}</div>
                  </div>
                  <div style={{ background: cat.color, color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 20 }}>Abrir →</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const ct = current, col = ct.color;
  return (
    <div style={{ fontFamily: "'Helvetica Neue',Arial,sans-serif", background: "#F5F3F0", minHeight: "100vh" }}>
      <style>{`@media print{.no-print{display:none!important}.page{page-break-after:always}}@page{size:A4;margin:14mm}`}</style>
      <div className="no-print" style={{ background: "#13211B", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => setView("index")} style={{ background: "transparent", border: "1px solid #2c3a32", color: "#9fb0a4", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>← Índice</button>
        <div style={{ color: "#7FB800", fontSize: 13, fontWeight: 700 }}>{ct.cat}</div>
        <button onClick={() => window.print()} style={{ background: col, border: "none", color: "#fff", padding: "6px 18px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🖨 Imprimir / PDF</button>
      </div>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 16px" }}>
        {/* PAGE 1 */}
        <div className="page" style={{ background: "#fff", marginBottom: 20, boxShadow: "0 2px 16px rgba(0,0,0,.1)", borderRadius: 4 }}>
          <div style={{ background: col, padding: "24px 28px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.7)", letterSpacing: 1 }}>{ct.code} · CONTRATO Nº ________ · DATA ___/___/2026</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginTop: 4 }}>{ct.cat}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.75)", marginTop: 4 }}>{ct.subtitle}</div>
          </div>
          <div style={{ padding: "20px 28px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[{ label: "CONTRATANTE (CLIENTE)", fields: [["Nome / Razão Social",""],["CNPJ / CPF",""],["E-mail",""],["WhatsApp",""],["Endereço",""]], accent: "#1A3A5C" },
                { label: "CONTRATADA — GUILEO", fields: [["Razão Social","Guileo Digital LTDA"],["Responsável","Luis Guilherme Teles da Costa"],["E-mail","contato@guileoai.com"],["Site","guileoai.com"],["Endereço","Cuiabá, MT — Brasil"]], accent: col }].map((p, pi) => (
                <div key={pi} style={{ border: "1px solid #E8E8E8", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ background: p.accent, padding: "6px 10px", fontSize: 9, fontWeight: 700, color: "#fff" }}>{p.label}</div>
                  {p.fields.map(([l, v], fi) => (
                    <div key={fi} style={{ display: "flex", padding: "5px 10px", background: fi % 2 ? "#fff" : "#FAFAFA" }}>
                      <div style={{ fontSize: 9, color: "#888", width: 95 }}>{l}:</div>
                      <div style={{ fontSize: 9.5, color: v ? "#333" : "#bbb", flex: 1 }}>{v || "______________________"}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, marginBottom: 20, background: "#E0E0E0", borderRadius: 6, overflow: "hidden" }}>
              {[["💰 VALOR TOTAL","R$ ____________"],["📅 INÍCIO","___/___/2026"],["⏱ PRAZO",ct.timeline],["💳 PAGAMENTO",ct.payment]].map(([l, v], i) => (
                <div key={i} style={{ background: i % 2 ? "#243546" : col, padding: "10px 12px" }}>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,.7)" }}>{l}</div>
                  <div style={{ fontSize: 9.5, color: "#fff", fontWeight: 600, marginTop: 3 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ background: col, padding: "7px 12px", borderRadius: "6px 6px 0 0", fontSize: 10, fontWeight: 700, color: "#fff" }}>📝 ESCOPO ESPECÍFICO</div>
            {ct.scope.map(([l, v], i) => (
              <div key={i} style={{ display: "flex", padding: "7px 12px", background: i % 2 ? "#fff" : "#FAFAFA", border: "1px solid #EBEBEB", borderTop: "none" }}>
                <div style={{ fontSize: 9.5, fontWeight: 600, color: "#555", width: 150 }}>{l}:</div>
                <div style={{ fontSize: 9.5, color: "#333", flex: 1 }}>{v}</div>
              </div>
            ))}
            <div style={{ border: "1px solid #EBEBEB", borderTop: "none", padding: "7px 12px", background: "#FAFAFA", fontSize: 9.5 }}><b style={{ color: "#555" }}>Revisões incluídas:</b> {ct.revisions}</div>
          </div>
        </div>
        {/* PAGE 2 — CLAUSES */}
        <div className="page" style={{ background: "#fff", marginBottom: 20, boxShadow: "0 2px 16px rgba(0,0,0,.1)", borderRadius: 4 }}>
          <div style={{ background: col, padding: "10px 28px", fontSize: 11, fontWeight: 700, color: "#fff" }}>GUILEO · {ct.code} · CLÁUSULAS GERAIS</div>
          <div style={{ padding: "16px 28px" }}>
            {CLAUSES.map(([n, t, txt]) => (
              <div key={n} style={{ display: "flex", marginBottom: 8 }}>
                <div style={{ background: col, color: "#fff", fontSize: 9, fontWeight: 800, width: 22, height: 22, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 8 }}>{n}</div>
                <div style={{ flex: 1, background: "#FAFAFA", borderRadius: 4, padding: "6px 10px", borderLeft: `3px solid ${col}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: col, marginBottom: 3 }}>{t}</div>
                  <div style={{ fontSize: 8.5, color: "#444", lineHeight: 1.55 }}>{txt}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* PAGE 3 — DELIVERS + SIGNATURE */}
        <div className="page" style={{ background: "#fff", boxShadow: "0 2px 16px rgba(0,0,0,.1)", borderRadius: 4 }}>
          <div style={{ background: col, padding: "10px 28px", fontSize: 11, fontWeight: 700, color: "#fff" }}>GUILEO · {ct.code} · ENTREGAS & ASSINATURA</div>
          <div style={{ padding: "16px 28px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[{ t: "✅ GUILEO ENTREGA", items: ct.delivers, bg: "#E8F5EE", b: col }, { t: "📋 CLIENTE FORNECE", items: ct.needs, bg: "#EEF4FF", b: "#1A3A5C" }].map((blk, bi) => (
                <div key={bi} style={{ background: blk.bg, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ background: blk.b, padding: "6px 10px", fontSize: 9, fontWeight: 700, color: "#fff" }}>{blk.t}</div>
                  {blk.items.map((it, i) => (
                    <div key={i} style={{ padding: "5px 10px", fontSize: 8.5, color: "#333", display: "flex", gap: 5 }}><span style={{ color: blk.b }}>•</span>{it}</div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ background: "#FFF8F0", border: "1px solid #F0C090", borderRadius: 6, padding: "8px 12px", marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#B85A16", marginBottom: 5 }}>⚠️ NÃO ESTÁ INCLUÍDO</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                {ct.excludes.map((e, i) => (<div key={i} style={{ fontSize: 8.5, color: "#666", display: "flex", gap: 5 }}><span style={{ color: "#B85A16" }}>✗</span>{e}</div>))}
              </div>
            </div>
            <div style={{ fontSize: 8.5, color: "#888", marginBottom: 12 }}>Cuiabá, MT, _____ de ________________ de 2026. As partes declaram ter lido e concordado com todos os termos.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[{ p: "CONTRATANTE", n: "_____________________", s: "CPF/CNPJ: ____________" }, { p: "CONTRATADA — GUILEO", n: "Luis Guilherme Teles da Costa", s: "CEO & Founder · " + ct.code }].map((sg, si) => (
                <div key={si} style={{ background: "#FAFAFA", borderRadius: 6, padding: "10px 12px", borderBottom: `3px solid ${si ? col : "#888"}` }}>
                  <div style={{ fontSize: 8, color: "#888", marginBottom: 12 }}>{sg.p}</div>
                  <div style={{ borderBottom: "1px solid #ccc", marginBottom: 6, height: 20 }} />
                  <div style={{ fontSize: 9, color: "#333", fontWeight: 600 }}>{sg.n}</div>
                  <div style={{ fontSize: 8, color: "#888", marginTop: 2 }}>{sg.s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
