// MEU SITE — a aba onde o dono publica o próprio site (/site/:slug).
//
// O produto "Site · Apps · Loja" era vendido sem máquina de entrega. Esta tela é o
// controle dele: escolhe o endereço, escreve a chamada, e publica. O conteúdo pesado
// (serviços, preços, unidades, FAQ) NÃO se edita aqui de propósito — ele já vive no
// cockpit e na boca da Gui. Um segundo lugar pra editar preço criaria duas verdades,
// e a Gui passaria a falar um valor diferente do que o site mostra.
import { useEffect, useState } from "react";
import NoSeuPlano from "./NoSeuPlano.jsx";
// tr() do Portal: a tela era a ÚNICA do painel em português fixo — um dono em EN/ES/HI lia PT aqui.
import { tr } from "../pages/Portal.jsx";
import { NOME_DO_PAINEL } from "./nome.js";
import { chamarApi } from "../lib/portalApi.js";
import FalhaDeLeitura, { fraseDaFalha } from "./FalhaDeLeitura.jsx";

const slugify = (s) => (s || "").toString().toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

export default function MeuSite({ V, email, dataKey , real = null}) {
  const [site, setSite] = useState(null);
  const [form, setForm] = useState({ slug: "", headline: "", about: "", color: "#2F6F4E" });
  const [published, setPublished] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);
  // leitura: "carregando" | "ok" | "falhou" | "sem_conta"
  const [leitura, setLeitura] = useState(email && dataKey ? "carregando" : "sem_conta");
  const [falha, setFalha] = useState(null);
  const [tentativa, setTentativa] = useState(0);

  const post = (body) => chamarApi("/api/client-site", { email, key: dataKey, ...body });

  useEffect(() => {
    if (!email || !dataKey) { setLeitura("sem_conta"); return; }
    let alive = true;
    // 🚨 (2026-09-28) Aqui havia um `.catch(() => {})` e um `if (!d?.ok) return`: quando a leitura
    // falhava, a tela ficava com o formulário VAZIO e o rótulo "Still a draft — only you can see
    // it", mesmo com o site PUBLICADO e recebendo cliente. A dona via um rascunho em branco, e os
    // botões "Publish site" / "Save draft" estavam a um clique de gravar por cima do site no ar
    // (ou de tirá-lo do ar). Sem ler, não se edita: a tela diz que não leu e trava os botões.
    setLeitura("carregando"); setFalha(null);
    post({ action: "get" }).then((r) => {
      if (!alive) return;
      // sem o objeto `site` na resposta eu NÃO sei se existe site — e "não sei" não é "rascunho"
      if (r.motivo || !r.data?.ok || !r.data.site || typeof r.data.site !== "object") { setFalha(r.motivo || "resposta_estranha"); setLeitura("falhou"); return; }
      const s = r.data.site;
      setSite(s);
      if (s.exists) {
        setForm({ slug: s.slug || "", headline: s.config?.headline || "", about: s.config?.about || "", color: s.config?.color || "#2F6F4E" });
        setPublished(!!s.published);
      }
      setLeitura("ok");
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, dataKey, tentativa]);
  const travado = busy || leitura === "carregando" || leitura === "falhou";

  async function save(nextPublished) {
    const slug = slugify(form.slug);
    if (slug.length < 3) { setMsg({ kind: "err", text: tr("The address needs at least 3 characters.") }); return; }
    if (leitura === "falhou" || leitura === "carregando") return;   // nunca gravar por cima do que não foi lido
    setBusy(true); setMsg({ kind: "", text: "" });
    const r = await post({ action: "save", slug, published: nextPublished, ...form });
    const d = r.data || {};
    // Checar o retorno de verdade: um "salvo!" sobre uma gravação recusada faria o dono
    // divulgar um endereço que não existe.
    if (r.motivo || !d.ok) {
      // O `error` do servidor é texto cru em português ("gravação falhou", "slug inválido") —
      // serve para ESCOLHER a frase, nunca para ser impresso (a tela é de uma cliente em inglês).
      const e = String(d.error || "").toLowerCase();
      const why = e === "slug_em_uso" ? tr("That address already belongs to another business — pick another.")
        : (e === "slug_invalido" || /slug inv/.test(e)) ? tr("Invalid address: use only letters, numbers and hyphens.")
        : r.motivo && r.http !== 400 ? `${tr("Couldn't save.")} ${fraseDaFalha(r.motivo)}`
        : tr("Couldn't save — try again?");
      setMsg({ kind: "err", text: why });
    } else {
      setPublished(nextPublished);
      setSite({ ...(site || {}), exists: true, slug: d.slug });
      setMsg({ kind: "ok", text: nextPublished ? tr("Live! 🌱") : tr("Saved as draft.") });
    }
    setBusy(false);
  }

  const url = `https://guileoai.com/site/${slugify(form.slug) || tr("your-business")}`;
  const L = {
    card: { background: V?.card || "#1c1b18", border: `1px solid ${V?.line || "#2a2823"}`, borderRadius: 14, padding: 20, marginBottom: 16 },
    label: { display: "block", fontSize: ".82rem", color: V?.dim || "#9a958a", marginBottom: 6, marginTop: 14 },
    input: { width: "100%", padding: "11px 12px", borderRadius: 9, border: `1px solid ${V?.line || "#2a2823"}`, background: V?.bg || "#161512", color: V?.fg || "#efece5", fontSize: ".95rem", boxSizing: "border-box" },
    btn: (primary) => ({ padding: "11px 18px", borderRadius: 9, border: primary ? 0 : `1px solid ${V?.line || "#2a2823"}`, background: primary ? "#FF8A33" : "transparent", color: primary ? "#161512" : V?.fg || "#efece5", fontWeight: 650, cursor: busy ? "wait" : "pointer", marginRight: 10 }),
  };

  return (
    <>
     <NoSeuPlano real={real} produto="websites" />
   <div>
      <h2 style={{ margin: "0 0 6px" }}>{tr("My website")}</h2>
      <p style={{ color: V?.dim || "#9a958a", marginTop: 0 }}>
        {tr(`Your site builds itself from what is already here — services, prices, locations and FAQ. Change a price in the ${NOME_DO_PAINEL} and the site and Gui's answers change with it.`)}
      </p>

      {leitura === "falhou" && (
        <div style={{ marginBottom: 16 }}>
          <FalhaDeLeitura motivo={falha} onRetry={() => setTentativa((n) => n + 1)} titulo={tr("I couldn't read your site just now — so I won't let you overwrite it. Nothing changed.")} />
        </div>
      )}

      <div style={{ ...L.card, opacity: leitura === "falhou" || leitura === "carregando" ? 0.5 : 1 }} aria-busy={leitura === "carregando"}>
        <label style={L.label}>{tr("Site address")}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ color: V?.dim || "#9a958a", fontSize: ".9rem" }}>guileoai.com/site/</span>
          <input style={{ ...L.input, flex: 1, minWidth: 180 }} value={form.slug}
            placeholder={tr("your-business")}
            onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </div>

        <label style={L.label}>{tr("Main headline")}</label>
        <input style={L.input} value={form.headline} placeholder={tr("E.g.: Your moment of care starts here")}
          onChange={(e) => setForm({ ...form, headline: e.target.value })} />

        <label style={L.label}>{tr("About the business (2 lines)")}</label>
        <textarea style={{ ...L.input, minHeight: 76, resize: "vertical" }} value={form.about}
          placeholder={tr("What you do, for whom, and what makes you different.")}
          onChange={(e) => setForm({ ...form, about: e.target.value })} />

        <label style={L.label}>{tr("Brand color")}</label>
        <input type="color" style={{ ...L.input, height: 44, padding: 4, maxWidth: 90 }} value={form.color}
          onChange={(e) => setForm({ ...form, color: e.target.value })} />

        <div style={{ marginTop: 22 }}>
          <button style={L.btn(true)} disabled={travado} onClick={() => save(true)}>
            {published ? tr("Save and update") : tr("Publish site")}
          </button>
          <button style={L.btn(false)} disabled={travado} onClick={() => save(false)}>
            {published ? tr("Take offline") : tr("Save draft")}
          </button>
        </div>

        {msg.text ? (
          <p style={{ marginTop: 14, color: msg.kind === "ok" ? "#5EC26A" : "#e06c5a", fontWeight: 600 }}>{msg.text}</p>
        ) : null}
      </div>

      {/* O cartão de estado ("rascunho" / "no ar") só existe quando o estado foi LIDO. */}
      {(leitura === "ok" || leitura === "sem_conta") && <div style={L.card}>
        <div style={{ fontSize: ".82rem", color: V?.dim || "#9a958a", marginBottom: 8 }}>
          {published ? tr("Live at:") : tr("Will be at:")}
        </div>
        <a href={url} target="_blank" rel="noreferrer" style={{ color: "#FF8A33", fontWeight: 600, wordBreak: "break-all" }}>{url}</a>
        {!published ? (
          <p style={{ color: V?.dim || "#9a958a", fontSize: ".85rem", marginTop: 10, marginBottom: 0 }}>
            {tr("Still a draft — only you can see it. Nobody finds this address until you publish.")}
          </p>
        ) : (
          <p style={{ color: V?.dim || "#9a958a", fontSize: ".85rem", marginTop: 10, marginBottom: 0 }}>
            {tr("Anyone who fills in the site form becomes a lead instantly, and Gui calls them back in ~1 minute.")}
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
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{tr("Your site is also an app")}</div>
              <p style={{ color: V?.dim || "#9a958a", fontSize: ".85rem", margin: 0 }}>
                {tr("Your customers install this address on their phone's home screen — with your icon and your name, no app store. Send the link and the invite appears on its own.")}
              </p>
            </div>
            <button
              type="button"
              style={L.btnGhost || L.btn2 || { padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "transparent", color: "inherit", cursor: "pointer" }}
              onClick={() => {
                if (navigator.share) navigator.share({ title: form.headline || tr("Our app"), url }).catch(() => {});
                else navigator.clipboard?.writeText(url);
              }}
            >{tr("Share")}</button>
          </div>
        ) : null}
      </div>}
    </div>
   </>
  );
}
