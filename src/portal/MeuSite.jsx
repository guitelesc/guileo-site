// MEU SITE — a aba onde o dono publica o próprio site (/site/:slug).
//
// O produto "Site · Apps · Loja" era vendido sem máquina de entrega. Esta tela é o
// controle dele: escolhe o endereço, escreve a chamada, e publica. O conteúdo pesado
// (serviços, preços, unidades, FAQ) NÃO se edita aqui de propósito — ele já vive no
// cockpit e na boca da Gui. Um segundo lugar pra editar preço criaria duas verdades,
// e a Gui passaria a falar um valor diferente do que o site mostra.
import { useEffect, useState } from "react";

const slugify = (s) => (s || "").toString().toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

export default function MeuSite({ V, email, dataKey }) {
  const [site, setSite] = useState(null);
  const [form, setForm] = useState({ slug: "", headline: "", about: "", color: "#2F6F4E" });
  const [published, setPublished] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);

  const post = (body) => fetch("/api/client-site", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, key: dataKey, ...body }),
  });

  useEffect(() => {
    if (!email || !dataKey) return;
    let alive = true;
    post({ action: "get" }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!alive || !d?.ok) return;
      const s = d.site || {};
      setSite(s);
      if (s.exists) {
        setForm({ slug: s.slug || "", headline: s.config?.headline || "", about: s.config?.about || "", color: s.config?.color || "#2F6F4E" });
        setPublished(!!s.published);
      }
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, dataKey]);

  async function save(nextPublished) {
    const slug = slugify(form.slug);
    if (slug.length < 3) { setMsg({ kind: "err", text: "O endereço precisa de pelo menos 3 letras." }); return; }
    setBusy(true); setMsg({ kind: "", text: "" });
    try {
      const r = await post({ action: "save", slug, published: nextPublished, ...form });
      const d = await r.json().catch(() => ({}));
      // Checar o retorno de verdade: um "salvo!" sobre uma gravação recusada faria o dono
      // divulgar um endereço que não existe.
      if (!r.ok || !d.ok) {
        const why = d.error === "slug_em_uso" ? "Esse endereço já é de outro negócio — escolhe outro."
          : d.error === "slug_invalido" ? "Endereço inválido: use só letras, números e hífen."
          : d.error || "Não consegui salvar.";
        setMsg({ kind: "err", text: why });
      } else {
        setPublished(nextPublished);
        setSite({ ...(site || {}), exists: true, slug: d.slug });
        setMsg({ kind: "ok", text: nextPublished ? "No ar! 🌱" : "Salvo como rascunho." });
      }
    } catch { setMsg({ kind: "err", text: "Não consegui salvar — tenta de novo?" }); }
    setBusy(false);
  }

  const url = `https://guileoai.com/site/${slugify(form.slug) || "seu-negocio"}`;
  const L = {
    card: { background: V?.card || "#1c1b18", border: `1px solid ${V?.line || "#2a2823"}`, borderRadius: 14, padding: 20, marginBottom: 16 },
    label: { display: "block", fontSize: ".82rem", color: V?.dim || "#9a958a", marginBottom: 6, marginTop: 14 },
    input: { width: "100%", padding: "11px 12px", borderRadius: 9, border: `1px solid ${V?.line || "#2a2823"}`, background: V?.bg || "#161512", color: V?.fg || "#efece5", fontSize: ".95rem", boxSizing: "border-box" },
    btn: (primary) => ({ padding: "11px 18px", borderRadius: 9, border: primary ? 0 : `1px solid ${V?.line || "#2a2823"}`, background: primary ? "#FF8A33" : "transparent", color: primary ? "#161512" : V?.fg || "#efece5", fontWeight: 650, cursor: busy ? "wait" : "pointer", marginRight: 10 }),
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 6px" }}>Meu site</h2>
      <p style={{ color: V?.dim || "#9a958a", marginTop: 0 }}>
        Seu site monta sozinho com o que já está aqui — serviços, preços, unidades e perguntas frequentes.
        Mudou o preço no cockpit, muda no site e na fala da Gui junto.
      </p>

      <div style={L.card}>
        <label style={L.label}>Endereço do site</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ color: V?.dim || "#9a958a", fontSize: ".9rem" }}>guileoai.com/site/</span>
          <input style={{ ...L.input, flex: 1, minWidth: 180 }} value={form.slug}
            placeholder="seu-negocio"
            onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </div>

        <label style={L.label}>Chamada principal</label>
        <input style={L.input} value={form.headline} placeholder="Ex.: Seu momento de cuidado começa aqui"
          onChange={(e) => setForm({ ...form, headline: e.target.value })} />

        <label style={L.label}>Sobre o negócio (2 linhas)</label>
        <textarea style={{ ...L.input, minHeight: 76, resize: "vertical" }} value={form.about}
          placeholder="O que você faz, pra quem, e o que te torna diferente."
          onChange={(e) => setForm({ ...form, about: e.target.value })} />

        <label style={L.label}>Cor da marca</label>
        <input type="color" style={{ ...L.input, height: 44, padding: 4, maxWidth: 90 }} value={form.color}
          onChange={(e) => setForm({ ...form, color: e.target.value })} />

        <div style={{ marginTop: 22 }}>
          <button style={L.btn(true)} disabled={busy} onClick={() => save(true)}>
            {published ? "Salvar e atualizar" : "Publicar site"}
          </button>
          <button style={L.btn(false)} disabled={busy} onClick={() => save(false)}>
            {published ? "Tirar do ar" : "Salvar rascunho"}
          </button>
        </div>

        {msg.text ? (
          <p style={{ marginTop: 14, color: msg.kind === "ok" ? "#5EC26A" : "#e06c5a", fontWeight: 600 }}>{msg.text}</p>
        ) : null}
      </div>

      <div style={L.card}>
        <div style={{ fontSize: ".82rem", color: V?.dim || "#9a958a", marginBottom: 8 }}>
          {published ? "No ar em:" : "Vai ficar em:"}
        </div>
        <a href={url} target="_blank" rel="noreferrer" style={{ color: "#FF8A33", fontWeight: 600, wordBreak: "break-all" }}>{url}</a>
        {!published ? (
          <p style={{ color: V?.dim || "#9a958a", fontSize: ".85rem", marginTop: 10, marginBottom: 0 }}>
            Ainda é rascunho — só você enxerga. Ninguém acha esse endereço até você publicar.
          </p>
        ) : (
          <p style={{ color: V?.dim || "#9a958a", fontSize: ".85rem", marginTop: 10, marginBottom: 0 }}>
            Quem preencher o formulário do site vira lead na hora, e a Gui liga de volta em ~1 minuto.
          </p>
        )}

        {/* O DONO PRECISA SABER QUE GANHOU UM APP. O site publicado é instalável na tela inicial
            do celular do cliente final — ícone e nome DELE, sem loja de aplicativos. Sem este
            bloco, o recurso existe e ninguém usa: é a mesma classe de "motor sem chamador" que
            esta onda passou a noite caçando. O ícone mostrado é o mesmo que o celular instala,
            servido por /site/icon/<slug>-192.png — se aparecer aqui, é porque funciona. */}
        {published ? (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <img src={`/site/icon/${slugify(form.slug)}-192.png`} alt="" width="44" height="44" style={{ borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Seu site também é um app</div>
              <p style={{ color: V?.dim || "#9a958a", fontSize: ".85rem", margin: 0 }}>
                Seus clientes instalam esse endereço na tela inicial do celular — com o seu ícone e o seu nome, sem loja de aplicativos. Mande o link que o convite aparece sozinho.
              </p>
            </div>
            <button
              type="button"
              style={L.btnGhost || L.btn2 || { padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "transparent", color: "inherit", cursor: "pointer" }}
              onClick={() => {
                if (navigator.share) navigator.share({ title: form.headline || "Nosso app", url }).catch(() => {});
                else navigator.clipboard?.writeText(url);
              }}
            >Compartilhar</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
