import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🎨 CRIATIVO no hub do vendedor — o anúncio DAQUELE negócio, escrito na frente dele.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE: o motor de criativo (lib/criativoAds.js) só era alcançável pelo cockpit do
// CLIENTE — quem já comprou. Quem mais precisa dele é o vendedor: num pitch, mostrar a peça que
// rodaria para o negócio do prospect vale mais que qualquer slide, e o prospect ainda não existe
// no sistema (não tem e-mail nem chave). Esta aba é a porta que faltava.
//
// ⚠️ A LEI DESTA TELA: TUDO aqui é AMOSTRA, e o selo diz isso em cada geração. A peça sai de uma
// descrição digitada, não do cardápio real do negócio — sem preço cadastrado o motor tem ordem de
// não citar preço nenhum, e a auditoria de fatos bloqueia o que ele prometer a mais. Deixar a
// amostra indistinguível do kit real do cliente criaria o pior mal-entendido possível numa venda:
// o dono achar que já existe trabalho feito para ele.
//
// BACKEND: POST /api/seller-criativo com o crachá assinado do vendedor (sid). Teto de 5 gerações
// por dia POR VENDEDOR (o modelo é pago pela Guileo) — a tela mostra o contador, nunca esconde.

const U = {
  pt: {
    h: "Criativo de anúncio", sub: "Digite o negócio do prospect e mostre, na reunião, o anúncio que rodaríamos pra ele.",
    negocio: "Nome do negócio", negocioPh: "Ex: Natura Spa NYC",
    setor: "Setor (opcional)", setorPh: "Ex: spa, barbearia, clínica, restaurante",
    objetivo: "Objetivo da campanha (opcional)", objetivoPh: "Ex: encher a agenda de terça e quarta",
    canais: "Canais", gerar: "Gerar peças", gerando: "Escrevendo as peças… leva alguns segundos",
    amostra: "AMOSTRA — feita a partir do que você digitou, não do cardápio real do negócio. Sem preços cadastrados, a peça sai sem preço de propósito.",
    copiar: "📋 Copiar", copiado: "Copiado ✓", copiarTudo: "📋 Copiar a peça inteira",
    pronta: "pronta pra publicar", bloqueada: "bloqueada", bloqMotivo: "Por quê",
    avisos: "O que faltou pra peça ficar concreta",
    publico: "Público sugerido", chamada: "Chamada", origem: "origem",
    cota: (u, t) => `${u} de ${t} gerações usadas hoje`,
    cotaSemTeto: "teto diário ainda não instalado no banco",
    erroNegocio: "Digite o nome do negócio.",
    erroAuth: "Sua sessão expirou — saia e entre de novo.",
    erroRede: "Erro de rede — não deu pra falar com o motor.",
    limite: "limite",
  },
  en: {
    h: "Ad creative", sub: "Type the prospect's business and show, right in the meeting, the ad we'd run for them.",
    negocio: "Business name", negocioPh: "e.g. Natura Spa NYC",
    setor: "Industry (optional)", setorPh: "e.g. spa, barbershop, clinic, restaurant",
    objetivo: "Campaign goal (optional)", objetivoPh: "e.g. fill Tuesday and Wednesday",
    canais: "Channels", gerar: "Generate", gerando: "Writing the pieces… this takes a few seconds",
    amostra: "SAMPLE — written from what you typed, not from the business's real menu. With no prices on file, the piece deliberately carries no price.",
    copiar: "📋 Copy", copiado: "Copied ✓", copiarTudo: "📋 Copy the whole piece",
    pronta: "ready to publish", bloqueada: "blocked", bloqMotivo: "Why",
    avisos: "What was missing to make it concrete",
    publico: "Suggested audience", chamada: "Call to action", origem: "source",
    cota: (u, t) => `${u} of ${t} generations used today`,
    cotaSemTeto: "daily cap not installed in the database yet",
    erroNegocio: "Type the business name.",
    erroAuth: "Your session expired — sign out and back in.",
    erroRede: "Network error — couldn't reach the engine.",
    limite: "limit",
  },
  es: {
    h: "Creativo de anuncio", sub: "Escriba el negocio del prospecto y muestre, en la reunión, el anuncio que le pondríamos a rodar.",
    negocio: "Nombre del negocio", negocioPh: "Ej: Natura Spa NYC",
    setor: "Sector (opcional)", setorPh: "Ej: spa, barbería, clínica, restaurante",
    objetivo: "Objetivo de la campaña (opcional)", objetivoPh: "Ej: llenar martes y miércoles",
    canais: "Canales", gerar: "Generar piezas", gerando: "Escribiendo las piezas… tarda unos segundos",
    amostra: "MUESTRA — escrita con lo que usted escribió, no con el menú real del negocio. Sin precios cargados, la pieza sale sin precio a propósito.",
    copiar: "📋 Copiar", copiado: "Copiado ✓", copiarTudo: "📋 Copiar la pieza entera",
    pronta: "lista para publicar", bloqueada: "bloqueada", bloqMotivo: "Por qué",
    avisos: "Qué faltó para que la pieza fuera concreta",
    publico: "Público sugerido", chamada: "Llamada", origem: "origen",
    cota: (u, t) => `${u} de ${t} generaciones usadas hoy`,
    cotaSemTeto: "el tope diario aún no está instalado en la base",
    erroNegocio: "Escriba el nombre del negocio.",
    erroAuth: "Su sesión expiró — salga y entre de nuevo.",
    erroRede: "Error de red — no se pudo hablar con el motor.",
    limite: "límite",
  },
  hi: {
    h: "विज्ञापन क्रिएटिव", sub: "प्रॉस्पेक्ट का व्यवसाय लिखें और मीटिंग में ही दिखाएँ कि हम उसके लिए कौन-सा विज्ञापन चलाते.",
    negocio: "व्यवसाय का नाम", negocioPh: "जैसे: Natura Spa NYC",
    setor: "क्षेत्र (वैकल्पिक)", setorPh: "जैसे: स्पा, सैलून, क्लिनिक, रेस्टोरेंट",
    objetivo: "अभियान का लक्ष्य (वैकल्पिक)", objetivoPh: "जैसे: मंगल और बुध भरना",
    canais: "चैनल", gerar: "पीस बनाएँ", gerando: "पीस लिखे जा रहे हैं… कुछ सेकंड लगते हैं",
    amostra: "नमूना — यह आपके लिखे से बना है, व्यवसाय के असली मेन्यू से नहीं. कीमत दर्ज न होने पर पीस जान-बूझकर बिना कीमत के आता है.",
    copiar: "📋 कॉपी", copiado: "कॉपी हुआ ✓", copiarTudo: "📋 पूरा पीस कॉपी करें",
    pronta: "प्रकाशित करने योग्य", bloqueada: "रोका गया", bloqMotivo: "क्यों",
    avisos: "पीस ठोस बनाने के लिए क्या कमी रही",
    publico: "सुझाया गया ऑडियंस", chamada: "कॉल टू एक्शन", origem: "स्रोत",
    cota: (u, t) => `आज ${t} में से ${u} जनरेशन इस्तेमाल हुए`,
    cotaSemTeto: "दैनिक सीमा अभी डेटाबेस में नहीं लगी है",
    erroNegocio: "व्यवसाय का नाम लिखें.",
    erroAuth: "आपका सेशन समाप्त हो गया — साइन आउट कर के फिर आएँ.",
    erroRede: "नेटवर्क त्रुटि — इंजन से बात नहीं हो सकी.",
    limite: "सीमा",
  },
};

// Os canais que a tela oferece. Nomes fixos aqui de propósito: são só os RÓTULOS do botão — os
// limites e os campos de cada peça vêm SEMPRE do backend (cada peça carrega `campos`), justamente
// pra não existir uma segunda cópia da tabela de limites nesta tela.
const CANAIS = [["google", "Google"], ["meta", "Meta"], ["youtube", "YouTube"], ["tiktok", "TikTok"], ["linkedin", "LinkedIn"]];

// Junta a peça inteira num texto colável (o que o vendedor manda no WhatsApp depois da reunião).
function pecaComoTexto(p) {
  const linhas = [`${p.nome || p.canal}`];
  for (const c of p.campos || []) {
    const v = p.criativo?.[c.campo];
    if (Array.isArray(v)) v.filter(Boolean).forEach((x, i) => linhas.push(`${c.rotulo} ${i + 1}: ${x}`));
    else if (v) linhas.push(`${c.rotulo}: ${v}`);
  }
  return linhas.join("\n");
}

export default function SellerCriativo({ lang = "pt", sid = "" }) {
  const t = U[lang] || U.pt;
  const [negocio, setNegocio] = useState("");
  const [setor, setSetor] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [canais, setCanais] = useState(["google", "meta"]);
  const [estado, setEstado] = useState("idle"); // idle | busy | ok | err
  const [erro, setErro] = useState("");
  const [kit, setKit] = useState(null);
  const [cota, setCota] = useState(null);
  const [copiado, setCopiado] = useState("");

  const alternar = (c) => setCanais((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : cs.length >= 4 ? cs : [...cs, c]));

  const copiar = async (chave, texto) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(chave); setTimeout(() => setCopiado(""), 1600); }
    catch { /* clipboard bloqueado (http/permissão) — o texto continua na tela pra selecionar à mão */ }
  };

  const gerar = async () => {
    const n = negocio.trim();
    if (!n) { setErro(t.erroNegocio); setEstado("err"); return; }
    setEstado("busy"); setErro(""); setKit(null);
    try {
      const r = await fetch("/api/seller-criativo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid, negocio: n, setor: setor.trim(), objetivo: objetivo.trim(), canais, lang }),
      });
      const d = await r.json().catch(() => ({}));
      // LER A RESPOSTA, não só o status. O motor devolve 429 com `error:"cota"` e 502 quando
      // NENHUM canal escreveu — nenhum dos dois é sucesso, e nenhum pode virar uma tela vazia.
      if (r.status === 401) { setErro(t.erroAuth); setEstado("err"); return; }
      if (d && d.cota) setCota(d.cota);
      if (!r.ok || d?.ok !== true) {
        setErro(d?.mensagem || d?.error || `HTTP ${r.status}`);
        setEstado("err"); return;
      }
      setKit(d); setEstado("ok");
    } catch { setErro(t.erroRede); setEstado("err"); }
  };

  const field = "w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50";

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-extrabold text-g-word">🎨 {t.h}</div>
        <div className="mt-1 text-[12.5px] text-g-muted">{t.sub}</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="text-[10px] font-black uppercase tracking-wide text-g-muted">{t.negocio}</span>
            <input value={negocio} onChange={(e) => setNegocio(e.target.value)} placeholder={t.negocioPh} className={`mt-1 ${field}`} /></label>
          <label className="block"><span className="text-[10px] font-black uppercase tracking-wide text-g-muted">{t.setor}</span>
            <input value={setor} onChange={(e) => setSetor(e.target.value)} placeholder={t.setorPh} className={`mt-1 ${field}`} /></label>
        </div>
        <label className="mt-3 block"><span className="text-[10px] font-black uppercase tracking-wide text-g-muted">{t.objetivo}</span>
          <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder={t.objetivoPh} className={`mt-1 ${field}`} /></label>

        <div className="mt-3">
          <span className="text-[10px] font-black uppercase tracking-wide text-g-muted">{t.canais}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CANAIS.map(([c, nome]) => (
              <button key={c} onClick={() => alternar(c)} aria-pressed={canais.includes(c)}
                className={`inline-flex min-h-[44px] items-center rounded-full px-3.5 text-[12px] font-bold transition ${
                  canais.includes(c) ? "bg-g-green/15 text-g-word ring-1 ring-g-green/40" : "text-g-muted ring-1 ring-white/10 hover:text-g-word"
                }`}>{nome}</button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={gerar} disabled={estado === "busy" || !canais.length}
            className="btn-bright inline-flex min-h-[44px] items-center px-5 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed">
            {estado === "busy" ? t.gerando : t.gerar}
          </button>
          {/* O CONTADOR APARECE SEMPRE QUE O SERVIDOR MANDA — inclusive quando ele diz que o teto
              ainda não existe no banco. Teto invisível é teto que ninguém confia. */}
          {cota && (
            <span className="text-[11px] text-g-muted">
              {cota.pronta ? t.cota(cota.usadas ?? 0, cota.teto ?? 5) : `⚠️ ${t.cotaSemTeto}${cota.motivo ? ` (${cota.motivo})` : ""}`}
            </span>
          )}
        </div>

        {estado === "err" && erro && (
          <div className="mt-3 rounded-xl border border-[#E5484D]/40 bg-[#E5484D]/10 px-3.5 py-2.5 text-[12.5px] text-[#FF9E9E]">{erro}</div>
        )}
      </div>

      {estado === "ok" && kit && (
        <div className="mt-4 space-y-3">
          {/* O SELO DE AMOSTRA VEM PRIMEIRO, antes de qualquer peça. */}
          <div className="rounded-xl border border-g-gold/35 bg-g-gold/[0.08] px-3.5 py-2.5 text-[12px] text-g-word">⚠️ {t.amostra}</div>

          {(kit.publico?.publico || kit.chamada?.texto) && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[12.5px] text-g-muted">
              {kit.publico?.publico && <div><b className="text-g-word">{t.publico}:</b> {kit.publico.publico}{kit.publico.origem ? <span className="text-g-muted"> · {t.origem}: {kit.publico.origem}</span> : null}</div>}
              {kit.chamada?.texto && <div className="mt-1"><b className="text-g-word">{t.chamada}:</b> {kit.chamada.texto}</div>}
            </div>
          )}

          {kit.pecas?.map((p, i) => (
            <div key={`${p.canal}-${i}`} className={`rounded-2xl border p-4 ${p.bloqueado?.length ? "border-[#E5484D]/40 bg-[#E5484D]/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[13px] font-extrabold text-g-word">{p.nome || p.canal}</div>
                {p.erro ? <span className="text-[11px] font-bold text-[#FF9E9E]">{p.erro}</span>
                  : p.bloqueado?.length ? <span className="text-[10px] font-black uppercase text-[#FF9E9E]">{t.bloqueada}</span>
                    : p.publicavel ? <span className="text-[10px] font-black uppercase text-g-green">✓ {t.pronta}</span> : null}
              </div>

              {!p.erro && (
                <div className="mt-2.5 space-y-2">
                  {(p.campos || []).map((c) => {
                    const v = p.criativo?.[c.campo];
                    const vals = Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [];
                    if (!vals.length) return null;
                    return (
                      <div key={c.campo}>
                        <div className="text-[10px] font-black uppercase tracking-wide text-g-muted">{c.rotulo}{c.limite ? ` · ${t.limite} ${c.limite}` : ""}</div>
                        {vals.map((x, j) => (
                          <div key={j} className="mt-1 flex items-start gap-2">
                            <div className="flex-1 rounded-lg bg-black/25 px-3 py-2 text-[13px] text-g-word">{x}</div>
                            <button onClick={() => copiar(`${i}-${c.campo}-${j}`, x)} className="inline-flex min-h-[36px] shrink-0 items-center rounded-full px-2.5 text-[11px] font-bold text-g-muted hover:text-g-word">
                              {copiado === `${i}-${c.campo}-${j}` ? t.copiado : t.copiar}
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {p.bloqueado?.length > 0 && (
                    <div className="rounded-lg border border-[#E5484D]/35 px-3 py-2 text-[11.5px] text-[#FF9E9E]">
                      <b>{t.bloqMotivo}:</b> {p.bloqueado.join(" · ")}
                    </div>
                  )}
                  <button onClick={() => copiar(`tudo-${i}`, pecaComoTexto(p))} className="inline-flex min-h-[36px] items-center rounded-full ring-1 ring-white/12 px-3 text-[11px] font-bold text-g-muted hover:text-g-word">
                    {copiado === `tudo-${i}` ? t.copiado : t.copiarTudo}
                  </button>
                </div>
              )}
            </div>
          ))}

          {kit.avisos?.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[10px] font-black uppercase tracking-wide text-g-muted">{t.avisos}</div>
              <ul className="mt-1.5 space-y-1 text-[12px] text-g-muted">{kit.avisos.map((a, i) => <li key={i}>• {a}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
