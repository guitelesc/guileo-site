/* Products — o catálogo de VAREJO do negócio de serviço (o spa que vende creme, shampoo, óleo).
   `CatalogScreen` mostra o que se AGENDA (biz_services); esta tela é o que se LEVA PRA CASA:
   nome, marca, preço de venda e estoque (vazio = não controlado), ligar/desligar, e as vendas
   recentes que o sistema registrou.

   🚨 ESTA TELA NÃO TEM AMOSTRA. Ela desenha só o que o /api/produtos devolve: conta sem chave vê
   um aviso, conta lendo vê o esqueleto, leitura que falhou vê a frase que o servidor mandou e um
   "tentar de novo". Lista vazia só aparece quando o servidor respondeu uma lista vazia de verdade.

   Backend: POST /api/produtos { action, token, email, lang } — list | upsert | delete | sales.
   Não há venda nem cobrança aqui: cadastrar produto não cobra ninguém.
   Registro no Portal.jsx é do orquestrador: passar real/email/dataKey como em Recurring. */
import { useState, useEffect } from "react";
import { FaBoxOpen, FaPen, FaTrash, FaPlus, FaReceipt } from "react-icons/fa6";
import { toast } from "../lib/portalApi.js";
import { tr, UI_LANG, Card, Empty, SectionSkeleton } from "../pages/Portal.jsx";
import { moedaDoTenant } from "./Recurring.jsx";

// ── API ───────────────────────────────────────────────────────────────────────
// Devolve SEMPRE { ok, d?, msg? }. `msg` é a frase que o servidor escreveu (já no idioma da tela,
// via `lang`) — lida do CORPO, não deduzida do status. Só quando não há corpo legível (rede fora,
// resposta que não é JSON) a frase é daqui.
async function api(body) {
  let r;
  try {
    r = await fetch("/api/produtos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, lang: UI_LANG }) });
  } catch {
    return { ok: false, msg: tr("Check your connection and try again.") };
  }
  const d = await r.json().catch(() => null);
  if (r.ok && d && d.ok === true) return { ok: true, d };
  const doServidor = d && typeof d.error === "string" ? d.error.trim() : "";
  return { ok: false, code: d?.code || "", msg: doServidor || `${tr("Our server didn't answer. Try again in a moment.")} (HTTP ${r.status})` };
}

// ── dinheiro ──────────────────────────────────────────────────────────────────
// Mesma regra de Recurring.jsx: o símbolo vem da moeda do tenant, NADA é convertido.
const LOCALE_DA_MOEDA = { USD: "en-US", BRL: "pt-BR", EUR: "pt-PT", MXN: "es-MX", CAD: "en-CA", GBP: "en-GB", INR: "en-IN" };
// Redondo sai sem centavos ("$25"); quebrado sai SEMPRE com dois dígitos ("$25.50", nunca "$25.5").
const money = (cents, moeda) => {
  const c = Math.round(Number(cents) || 0);
  const v = c / 100;
  const cur = moeda || "USD";
  const casas = c % 100 === 0 ? 0 : 2;
  try { return new Intl.NumberFormat(LOCALE_DA_MOEDA[cur] || "en-US", { style: "currency", currency: cur, minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v); }
  catch { return `$${v.toLocaleString("en-US", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`; }
};

// O que o dono digitou → centavos, ou null se não dá para ter certeza. Descobre o FORMATO antes
// de limpar (a mesma regra de functions/lib/dinheiro.js): com os dois separadores, o ÚLTIMO é o
// decimal; com um só, três dígitos depois dele = milhar ("1.500", "1,000"), senão = decimal
// ("25,50", "25.5"). Tirar tudo que não é dígito e ponto faria "25,50" virar 2550 — cem vezes mais.
function precoParaCentavos(texto) {
  const bruto = String(texto == null ? "" : texto).trim();
  if (!bruto || bruto.includes("-")) return null;
  const s = bruto.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  const iP = s.lastIndexOf("."), iV = s.lastIndexOf(",");
  let inteiro = s, dec = "";
  if (iP >= 0 && iV >= 0) {
    const i = Math.max(iP, iV);
    inteiro = s.slice(0, i); dec = s.slice(i + 1);
  } else if (iP >= 0 || iV >= 0) {
    const i = Math.max(iP, iV);
    const vezes = s.split(s[i]).length - 1;
    const depois = s.slice(i + 1);
    if (vezes === 1 && depois.length !== 3) { inteiro = s.slice(0, i); dec = depois; }
  }
  inteiro = inteiro.replace(/[.,]/g, "");
  if (dec.length > 2 || /[.,]/.test(dec) || (!inteiro && !dec)) return null;
  const cents = Number(inteiro || "0") * 100 + Number((dec + "00").slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}
// Estoque: vazio = não controlado (null). Só dígitos valem; qualquer outra coisa é `undefined` (erro).
function estoqueDoCampo(texto) {
  const s = String(texto == null ? "" : texto).trim();
  if (!s) return null;
  return /^\d{1,7}$/.test(s) ? Number(s) : undefined;
}

const porNome = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
const localeDaTela = () => (UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US");
const quando = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(localeDaTela(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
const controlado = (p) => p.stock !== null && p.stock !== undefined;

function Field({ label, hint, className = "", ...props }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-g-muted mb-1">{label}</span>
      <input {...props} className="w-full min-w-0 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-g-word placeholder:text-g-muted/60 outline-none focus:border-g-gold/50 transition" />
      {hint ? <span className="block mt-1 text-[11px] text-g-muted">{hint}</span> : null}
    </label>
  );
}

// Faixa de falha: a frase do servidor como veio + tentar de novo.
function Falha({ titulo, msg, onRetry }) {
  return (
    <div className="rounded-xl border border-[#e0855f]/40 bg-[#e0855f]/[0.08] px-3.5 py-2.5 flex flex-wrap items-center gap-3 text-[12px] text-[#e0855f]">
      <span className="flex-1 min-w-[12rem] break-words">{titulo} — {msg}</span>
      <button onClick={onRetry} className="btn-ghost text-xs shrink-0">{tr("↻ Try again")}</button>
    </div>
  );
}

function Products({ real = null, email = "", dataKey = "" }) {
  // A pergunta é "esta conta está CONECTADA?" (e-mail + chave), não "os dados já chegaram?".
  const conta = !!(email && dataKey);
  const MOEDA = moedaDoTenant(real);
  const $$ = (cents) => money(cents, MOEDA);

  // Cada leitura guarda DE QUAL pedido ela é (conta + chave + tentativa). O que está na tela só
  // vale se for do pedido atual: trocou a chave ou pediu de novo → volta a ser "lendo" sozinho,
  // sem depender de alguém lembrar de zerar o estado antes (dado de outra chave nunca sobrevive).
  const [seq, setSeq] = useState(0);
  const pedido = conta ? `${email}\n${dataKey}\n${seq}` : "";
  const [lido, setLido] = useState({ pedido: "", prods: null, erro: "" });
  const [lidoVendas, setLidoVendas] = useState({ pedido: "", sales: null, erro: "" });
  const prods = lido.pedido === pedido ? lido.prods : null;            // null = lendo · array = o que o servidor devolveu
  const erro = lido.pedido === pedido ? lido.erro : "";                // frase da falha de leitura dos produtos
  const sales = lidoVendas.pedido === pedido ? lidoVendas.sales : null;
  const erroVendas = lidoVendas.pedido === pedido ? lidoVendas.erro : "";
  const setProds = (fn) => setLido((l) => ({ ...l, prods: fn(l.prods || []) }));
  const [form, setForm] = useState(null);           // { id, name, brand, price, stock, description, … }
  const [formErro, setFormErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [apagar, setApagar] = useState(null);       // id do produto com a confirmação aberta
  const [linhaOcupada, setLinhaOcupada] = useState(null);

  useEffect(() => {
    let vivo = true;
    if (!pedido) return () => { vivo = false; };
    const cred = { token: dataKey, email };
    api({ action: "list", ...cred }).then((r) => {
      if (!vivo) return;
      if (r.ok && Array.isArray(r.d.products)) setLido({ pedido, prods: [...r.d.products].sort(porNome), erro: "" });
      else setLido({ pedido, prods: [], erro: r.msg || tr("Our server didn't answer. Try again in a moment.") });
    });
    api({ action: "sales", ...cred }).then((r) => {
      if (!vivo) return;
      if (r.ok && Array.isArray(r.d.sales)) setLidoVendas({ pedido, sales: r.d.sales, erro: "" });
      else setLidoVendas({ pedido, sales: [], erro: r.msg || tr("Our server didn't answer. Try again in a moment.") });
    });
    return () => { vivo = false; };
  }, [pedido, dataKey, email]);

  const abrirNovo = () => { setFormErro(""); setApagar(null); setForm({ id: null, name: "", brand: "", price: "", stock: "", description: "", active: true }); };
  const abrirEdicao = (r) => {
    setFormErro(""); setApagar(null);
    setForm({ id: r.id, name: r.name || "", brand: r.brand || "", price: ((Number(r.price_cents) || 0) / 100).toString(), stock: controlado(r) ? String(r.stock) : "", description: r.description || "", active: r.active !== false, location_id: r.location_id });
  };

  const salvar = async () => {
    if (!form || busy) return;
    const name = (form.name || "").trim();
    if (!name) { setFormErro(tr("Give the product a name.")); return; }
    const price_cents = precoParaCentavos(form.price);
    if (price_cents === null) { setFormErro(tr("Enter a valid price — for example 25 or 25.50.")); return; }
    const stock = estoqueDoCampo(form.stock);
    if (stock === undefined) { setFormErro(tr("Stock must be a whole number — or leave it empty to not track it.")); return; }
    const product = { name, brand: (form.brand || "").trim(), description: (form.description || "").trim(), price_cents, stock, active: form.active !== false };
    if (form.id) { product.id = form.id; if (form.location_id !== undefined) product.location_id = form.location_id; }
    setBusy(true); setFormErro("");
    const r = await api({ action: "upsert", token: dataKey, email, product });
    setBusy(false);
    // só digo "salvo" com a linha gravada de volta na mão
    if (!r.ok || !r.d.product || !r.d.product.id) { setFormErro(r.msg || tr("Our server didn't answer. Try again in a moment.")); return; }
    const salvo = r.d.product;
    setProds((xs) => [...(xs || []).filter((x) => x.id !== salvo.id), salvo].sort(porNome));
    setForm(null);
    toast(tr("Product saved ✓"));
  };

  // RESERVA → PAGA / CANCELADA. A agente só RESERVA (a cliente paga no balcão); quem fecha é a
  // equipe. Cancelar devolve a unidade ao estoque — por isso relê produtos e vendas do servidor em
  // vez de mexer no número localmente. Sucesso só com o status novo devolvido pelo banco.
  const fecharReserva = async (sale, status) => {
    if (linhaOcupada) return;
    setLinhaOcupada(sale.id);
    const r = await api({ action: "sale_status", token: dataKey, email, id: sale.id, status });
    setLinhaOcupada(null);
    if (!r.ok || r.d.status !== status) { toast(r.msg || tr("Our server didn't answer. Try again in a moment.")); return; }
    toast(status === "paid" ? tr("Marked as paid ✓") : tr("Reservation cancelled — stock returned"));
    setSeq((n) => n + 1);
  };

  const alternar = async (row) => {
    if (linhaOcupada) return;
    setLinhaOcupada(row.id);
    const product = { id: row.id, name: row.name, brand: row.brand || "", description: row.description || "", price_cents: row.price_cents, stock: controlado(row) ? row.stock : null, active: row.active === false };
    const r = await api({ action: "upsert", token: dataKey, email, product });
    setLinhaOcupada(null);
    if (!r.ok || !r.d.product || !r.d.product.id) { toast(r.msg || tr("Our server didn't answer. Try again in a moment.")); return; }
    const salvo = r.d.product;
    setProds((xs) => (xs || []).map((x) => (x.id === salvo.id ? salvo : x)));
  };

  const confirmarApagar = async (row) => {
    if (linhaOcupada) return;
    setLinhaOcupada(row.id);
    const r = await api({ action: "delete", token: dataKey, email, id: row.id });
    setLinhaOcupada(null);
    if (!r.ok) {
      toast(r.msg || tr("Our server didn't answer. Try again in a moment."));
      // o servidor disse que ele já não existe: a linha sai da tela, porque a tela estava errada
      if (r.code === "not_found") { setProds((xs) => (xs || []).filter((x) => x.id !== row.id)); setApagar(null); }
      return;
    }
    setProds((xs) => (xs || []).filter((x) => x.id !== row.id));
    setApagar(null);
    if (form && form.id === row.id) setForm(null);
    toast(tr("Product deleted"));
  };

  // ── conta sem chave: nada de amostra — só o aviso ──
  if (!conta) {
    return (
      <Card className="text-center py-10">
        <div className="mx-auto grid place-items-center h-11 w-11 rounded-full bg-white/[0.06] text-g-gold"><FaBoxOpen size={16} /></div>
        <div className="mt-3 text-sm font-bold text-g-word">{tr("Your products show up here once your account is connected.")}</div>
        <div className="mt-1 text-xs text-g-muted">{tr("Paste your connection code in Settings to list what you sell.")}</div>
      </Card>
    );
  }
  if (prods === null) return <SectionSkeleton rows={5} />;

  const ativos = prods.filter((p) => p.active !== false).length;
  const zerados = prods.filter((p) => p.active !== false && controlado(p) && Number(p.stock) <= 0).length;

  return (
    <div className="space-y-5 min-w-0">
      {/* Header */}
      <div className="rounded-2xl border border-g-gold/25 bg-gradient-to-br from-g-gold/[0.07] to-white/[0.02] p-5 min-w-0">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-gold">
          <FaBoxOpen size={11} /> {tr("Products")}
        </div>
        <div className="mt-1 text-xl font-black text-g-word break-words">{tr("What you sell off the shelf")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("List each product with its sale price. Add a stock count if you want it tracked — leave it empty and it is never shown as sold out.")}</p>
        {!erro && prods.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-g-muted tabular-nums">
            <span><b className="text-g-word">{prods.length}</b> {tr("products")}</span>
            <span><b className="text-g-word">{ativos}</b> {tr("turned on")}</span>
            {zerados > 0 && <span className="text-[#e0855f]"><b>{zerados}</b> {tr("out of stock")}</span>}
          </div>
        )}
      </div>

      {erro && <Falha titulo={tr("Couldn't read your products")} msg={erro} onRetry={() => setSeq((n) => n + 1)} />}

      {/* ── PRODUTOS ─────────────────────────────────────────────── */}
      {!erro && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaBoxOpen size={11} /> {tr("Your products")}</span>
            <button onClick={abrirNovo} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-g-word hover:border-g-gold/40 transition inline-flex items-center gap-1.5 min-h-[44px]"><FaPlus size={9} /> {tr("New product")}</button>
          </div>

          {form && (
            <div className="px-4 sm:px-5 py-4 border-b border-white/10 bg-white/[0.015] grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 text-[11px] font-bold uppercase tracking-wider text-g-muted">{form.id ? tr("Edit product") : tr("New product")}</div>
              <Field label={tr("Name")} value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tr("Product name")} />
              <Field label={tr("Brand")} value={form.brand} maxLength={80} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder={tr("Optional")} />
              <Field label={`${tr("Sale price")} (${MOEDA})`} inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
              <Field label={tr("Stock")} inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder={tr("Not tracked")} hint={tr("Leave empty if you don't count stock.")} />
              <Field className="sm:col-span-2" label={tr("Description")} value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={tr("Optional")} />
              {formErro && <div role="alert" className="sm:col-span-2 rounded-lg border border-[#e0855f]/40 bg-[#e0855f]/[0.08] px-3 py-2 text-[12px] text-[#e0855f] break-words">{formErro}</div>}
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <button onClick={salvar} disabled={busy} className="btn-bright text-sm disabled:opacity-50">{busy ? tr("Saving…") : tr("Save product")}</button>
                <button onClick={() => { setForm(null); setFormErro(""); }} disabled={busy} className="btn-ghost text-sm">{tr("Cancel")}</button>
              </div>
            </div>
          )}

          <div className="divide-y divide-white/[0.05]">
            {prods.map((r) => {
              const on = r.active !== false;
              const semEstoque = controlado(r) && Number(r.stock) <= 0;
              const ocupada = linhaOcupada === r.id;
              return (
                <div key={r.id} className={`px-4 sm:px-5 py-3 ${ocupada ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <div className={`flex-1 basis-[7.5rem] min-w-0 ${on ? "" : "opacity-60"}`}>
                      <div className="text-sm font-bold text-g-word truncate">{r.name}{r.brand ? <span className="text-g-muted font-normal"> · {r.brand}</span> : null}</div>
                      <div className="text-[11px] text-g-muted flex flex-wrap gap-x-2 tabular-nums">
                        <span className="font-bold text-g-word">{$$(r.price_cents)}</span>
                        <span className={semEstoque ? "text-[#e0855f] font-bold" : ""}>
                          {!controlado(r) ? tr("Stock not tracked") : semEstoque ? tr("Out of stock") : `${r.stock} ${tr("in stock")}`}
                        </span>
                        {!on && <span>{tr("inactive")}</span>}
                      </div>
                      {r.description ? <div className="text-[11px] text-g-muted/80 truncate">{r.description}</div> : null}
                    </div>
                    <div className="flex items-center shrink-0 ml-auto">
                      <button type="button" role="switch" aria-checked={on} aria-label={tr("Active")} title={on ? tr("Active — tap to turn off") : tr("Inactive — tap to turn on")} disabled={ocupada} onClick={() => alternar(r)} className="grid place-items-center h-11 w-12">
                        <span className={`relative block h-5 w-9 rounded-full transition ${on ? "bg-g-green/80" : "bg-white/15"}`}>
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                        </span>
                      </button>
                      <button type="button" onClick={() => abrirEdicao(r)} disabled={ocupada} className="grid place-items-center h-11 w-10 text-g-muted hover:text-g-word" title={tr("Edit")} aria-label={tr("Edit")}><FaPen size={12} /></button>
                      <button type="button" onClick={() => setApagar(apagar === r.id ? null : r.id)} disabled={ocupada} className="grid place-items-center h-11 w-10 text-g-muted hover:text-red-400" title={tr("Delete")} aria-label={tr("Delete")}><FaTrash size={12} /></button>
                    </div>
                  </div>
                  {apagar === r.id && (
                    <div role="alertdialog" aria-label={tr("Delete this product?")} className="mt-2 rounded-xl border border-red-400/30 bg-red-400/[0.06] px-3.5 py-3">
                      <div className="text-[12px] font-bold text-g-word break-words">{tr("Delete this product?")} <span className="font-normal text-g-muted">{r.name}</span></div>
                      <div className="mt-0.5 text-[11px] text-g-muted">{tr("It leaves your list for good. Sales already recorded stay in your history.")}</div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => confirmarApagar(r)} disabled={ocupada} className="rounded-full border border-red-400/50 bg-red-400/15 px-3.5 text-[12px] font-bold text-red-300 hover:bg-red-400/25 transition min-h-[44px] disabled:opacity-50">{ocupada ? tr("Deleting…") : tr("Yes, delete")}</button>
                        <button type="button" onClick={() => setApagar(null)} disabled={ocupada} className="btn-ghost text-xs min-h-[44px]">{tr("Keep it")}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {prods.length === 0 && !form && <Empty icon="📦" text={tr("No products yet — add the first thing you sell off the shelf.")} />}
          </div>
        </Card>
      )}

      {/* ── VENDAS RECENTES ──────────────────────────────────────── */}
      <Card className="!p-0 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaReceipt size={11} /> {tr("Recent sales")}</span>
          {Array.isArray(sales) && !erroVendas && sales.length > 0 && <span className="text-[11px] text-g-muted tabular-nums">{sales.length}</span>}
        </div>
        {sales === null ? (
          <div className="px-5 py-6 text-center text-[12px] text-g-muted animate-pulse">{tr("Reading your sales…")}</div>
        ) : erroVendas ? (
          <div className="p-3"><Falha titulo={tr("Couldn't read your sales")} msg={erroVendas} onRetry={() => setSeq((n) => n + 1)} /></div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {sales.map((s) => (
              <div key={s.id} className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex-1 min-w-[10rem]">
                  <div className="text-sm font-bold text-g-word break-words">{s.product_name || tr("Deleted product")} <span className="text-g-muted font-normal">× {s.qty}</span></div>
                  <div className="text-[11px] text-g-muted tabular-nums break-words">{quando(s.created_at)} · {$$(s.unit_price_cents)} {tr("each")}</div>
                  {/* PARA QUEM separar: a agente reserva com o nome e o contato de quem pediu. */}
                  {(s.customer_name || s.customer_contact) && <div className="text-[11px] text-g-word/80 break-words">{tr("For")}: {[s.customer_name, s.customer_contact].filter(Boolean).join(" · ")}</div>}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wide rounded-full border px-2 py-0.5 shrink-0 ${s.status === "paid" ? "border-g-green/40 text-g-green" : s.status === "cancelled" ? "border-white/15 text-g-muted" : "border-g-gold/40 text-g-gold"}`}>
                  {s.status === "paid" ? tr("Paid") : s.status === "cancelled" ? tr("Cancelled") : tr("Reserved — not paid yet")}
                </span>
                <span className={`text-[13px] font-extrabold tabular-nums shrink-0 ${s.status === "cancelled" ? "text-g-muted line-through" : "text-g-word"}`}>{$$(s.total_cents != null ? s.total_cents : (Number(s.unit_price_cents) || 0) * (Number(s.qty) || 0))}</span>
                {s.status === "reserved" && (
                  <span className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => fecharReserva(s, "paid")} disabled={linhaOcupada === s.id} className="btn-bright text-xs disabled:opacity-50">{tr("Picked up & paid")}</button>
                    <button onClick={() => fecharReserva(s, "cancelled")} disabled={linhaOcupada === s.id} className="btn-ghost text-xs disabled:opacity-50">{tr("Cancel reservation")}</button>
                  </span>
                )}
              </div>
            ))}
            {sales.length === 0 && <Empty icon="🧾" text={tr("No sales recorded yet — each product sold shows up here.")} />}
          </div>
        )}
      </Card>
    </div>
  );
}

export default Products;
