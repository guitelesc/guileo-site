/* GUILEO DESK — Baixar a sua base (2026-10-21). A promessa do /desk: "Exporte suas clientes quando quiser, de graça.
   Sem taxa de saída." O MindBody cobra ~US$ 500 e só no cancelamento; aqui é um botão, a qualquer hora.

   · Só a dona: `export` não está na lista da recepção (lib/deskAcesso.js) — o código bal_ volta 403.
   · Funciona com a assinatura cancelada (lib/deskTrava.js) — a base é dela.
   · O banco entrega páginas de 5000 (db/desk_v8_exportar.sql); a tela pede até chegar no `total` e só
     baixa se TODAS as páginas vieram. Parou no meio → diz isso e não entrega arquivo pela metade.
   · CSV montado no navegador: BOM (o Excel abre acento certo), aspas, e célula que começa com = + - @
     ganha um apóstrofo (fórmula não roda ao abrir). Telefone "+1 212…" fica como está.
   · Dinheiro sai em valor com 2 casas (a coluna *_cents perde o sufixo).

   CADA SITUAÇÃO TEM O SEU TEXTO (pedido do Luis, 2026-10-21): sem conexão (aviso, sem botão morto) ·
   preparando (com quantas linhas já vieram) · baixado (hora + linhas) · vazio (saiu só o cabeçalho) ·
   erro (o motivo) · parou no meio (não baixou). */
import { useState } from "react";
import { toast } from "../lib/portalApi.js";
import { Card } from "../pages/Portal.jsx";
import { chamarDesk, motivo, tx, loc } from "./deskApi.js";

const T = {
  title: { en: "Download your data", pt: "Baixe a sua base", es: "Descarga tus datos", hi: "अपना डेटा डाउनलोड करें" },
  promise: { en: "It's yours: free, any time, even after you cancel. Opens in Excel, Numbers or Google Sheets.", pt: "É sua: de graça, quando quiser, inclusive depois de cancelar. Abre no Excel, no Numbers ou no Google Planilhas.", es: "Es tuya: gratis, cuando quieras, incluso después de cancelar. Se abre en Excel, Numbers o Google Sheets.", hi: "यह आपका है: मुफ़्त, कभी भी, रद्द करने के बाद भी। Excel, Numbers या Google Sheets में खुलता है।" },
  clients: { en: "Clients", pt: "Clientes", es: "Clientas", hi: "ग्राहक" },
  clientsIn: { en: "Name, phone, email, birthday, visits, no-shows, spend, allergies and notes.", pt: "Nome, telefone, e-mail, aniversário, visitas, faltas, gasto, alergias e observações.", es: "Nombre, teléfono, correo, cumpleaños, visitas, ausencias, gasto, alergias y notas.", hi: "नाम, फ़ोन, ईमेल, जन्मदिन, विज़िट, नो-शो, ख़र्च, एलर्जी और नोट्स।" },
  appointments: { en: "Appointments", pt: "Agenda", es: "Agenda", hi: "बुकिंग" },
  appointmentsIn: { en: "Every appointment, past and future, with professional, service, status and where it came from.", pt: "Todos os agendamentos, passados e futuros, com profissional, serviço, situação e de onde veio.", es: "Todas las citas, pasadas y futuras, con profesional, servicio, estado y de dónde vino.", hi: "हर बुकिंग, पुरानी और आने वाली, प्रोफ़ेशनल, सेवा, स्थिति और स्रोत के साथ।" },
  sales: { en: "Sales", pt: "Vendas", es: "Ventas", hi: "बिक्री" },
  salesIn: { en: "Each item sold, with discount, tip, commission and how it was paid.", pt: "Cada item vendido, com desconto, gorjeta, comissão e forma de pagamento.", es: "Cada artículo vendido, con descuento, propina, comisión y forma de pago.", hi: "हर बेचा गया आइटम, छूट, टिप, कमीशन और भुगतान के तरीक़े के साथ।" },
  balances: { en: "Balances", pt: "Saldos", es: "Saldos", hi: "बैलेंस" },
  balancesIn: { en: "Packages with sessions left, gift cards with their balance, and memberships.", pt: "Pacotes com as sessões que faltam, vales-presente com o saldo e assinaturas.", es: "Paquetes con las sesiones que faltan, tarjetas regalo con su saldo y membresías.", hi: "बची हुई सेशन वाले पैकेज, बैलेंस वाले गिफ़्ट कार्ड और सदस्यताएँ।" },
  download: { en: "Download", pt: "Baixar", es: "Descargar", hi: "डाउनलोड" },
  again: { en: "Download again", pt: "Baixar de novo", es: "Descargar de nuevo", hi: "फिर से डाउनलोड" },
  all: { en: "Download all 4 spreadsheets", pt: "Baixar as 4 planilhas", es: "Descargar las 4 hojas", hi: "चारों शीट डाउनलोड करें" },
  allBusy: { en: "Downloading {i} of 4…", pt: "Baixando {i} de 4…", es: "Descargando {i} de 4…", hi: "4 में से {i} डाउनलोड हो रही है…" },
  preparing: { en: "Preparing…", pt: "Preparando…", es: "Preparando…", hi: "तैयार हो रहा है…" },
  preparingN: { en: "Preparing… {n} rows so far", pt: "Preparando… {n} linhas até agora", es: "Preparando… {n} filas hasta ahora", hi: "तैयार हो रहा है… अब तक {n} पंक्तियाँ" },
  done: { en: "Downloaded at {h}, {n} rows.", pt: "Baixado às {h}, {n} linhas.", es: "Descargado a las {h}, {n} filas.", hi: "{h} बजे डाउनलोड हुआ, {n} पंक्तियाँ।" },
  doneEmpty: { en: "Downloaded at {h}. Nothing here yet, so the file has only the column titles.", pt: "Baixado às {h}. Ainda não tem nada aqui, então a planilha saiu só com os títulos das colunas.", es: "Descargado a las {h}. Aún no hay nada, así que la hoja salió solo con los títulos de las columnas.", hi: "{h} बजे डाउनलोड हुआ। अभी कुछ नहीं है, इसलिए फ़ाइल में सिर्फ़ कॉलम के नाम हैं।" },
  partial: { en: "It stopped halfway, so I didn't download a half file. Try again.", pt: "Parou no meio, então não baixei a planilha pela metade. Tente de novo.", es: "Se detuvo a la mitad, así que no descargué la hoja a medias. Inténtalo de nuevo.", hi: "बीच में रुक गया, इसलिए आधी फ़ाइल डाउनलोड नहीं की। फिर से कोशिश करें।" },
  // {m} = motivo() do deskApi, que já diz o que fazer ("tente de novo", "conecte de novo"…) — não repetir aqui.
  failed: { en: "Not downloaded. {m}", pt: "Não baixou. {m}", es: "No se descargó. {m}", hi: "डाउनलोड नहीं हुआ। {m}" },
  allSome: { en: "Downloaded {ok} of 4. The one that failed says why.", pt: "Baixei {ok} de 4. A que falhou diz o motivo.", es: "Descargué {ok} de 4. La que falló dice el motivo.", hi: "4 में से {ok} डाउनलोड हुईं। जो नहीं हुई, उसमें कारण लिखा है।" },
  multi: { en: "Your browser may ask to allow several downloads. Allow it to get all 4.", pt: "O navegador pode perguntar se deixa baixar vários arquivos. Permita para receber as 4.", es: "Tu navegador puede preguntar si permite varias descargas. Permítelo para recibir las 4.", hi: "ब्राउज़र कई डाउनलोड की अनुमति माँग सकता है। चारों पाने के लिए अनुमति दें।" },
  privacy: { en: "These spreadsheets have your clients' contact details. Keep them somewhere safe.", pt: "As planilhas têm o contato das suas clientes. Guarde em lugar seguro.", es: "Las hojas tienen los contactos de tus clientas. Guárdalas en un lugar seguro.", hi: "इन शीट में आपके ग्राहकों के संपर्क हैं। इन्हें सुरक्षित रखें।" },
  notConnected: { en: "This is sample data, so there's nothing of yours to download yet. Connect your account in Settings with your connection code.", pt: "Isto é uma demonstração, então ainda não tem base sua para baixar. Conecte a sua conta em Configurações, com o código de conexão.", es: "Esto es una demostración, así que aún no hay datos tuyos para descargar. Conecta tu cuenta en Ajustes con tu código de conexión.", hi: "यह सैंपल डेटा है, इसलिए अभी डाउनलोड करने को आपका कुछ नहीं है। सेटिंग्स में कनेक्शन कोड से अपना खाता जोड़ें।" },
};
const t = (k, v = {}) => Object.entries(v).reduce((s, [a, b]) => s.replace(`{${a}}`, b), tx(T[k]));
const TIPOS = ["clients", "appointments", "sales", "balances"];
const NOME_ARQUIVO = { clients: "clientes", appointments: "agenda", sales: "vendas", balances: "saldos" };
const PAGINA = 5000;
const MAX_PAGINAS = 100;   // 500 mil linhas: teto de segurança contra laço sem fim

// Uma célula de CSV. Fórmula (= + - @ no começo) vira texto com apóstrofo — exceto número/telefone puro.
function celula(v) {
  if (v == null) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s)) s = "'" + s;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
// *_cents → valor com 2 casas e a coluna sem o sufixo; as colunas seguem a ordem em que aparecem.
function paraCsv(rows) {
  if (!rows.length) return "";
  const chaves = [];
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!chaves.includes(k)) chaves.push(k); }));
  const cab = chaves.map((k) => k.replace(/_cents$/, ""));
  const valor = (r, k) => (/_cents$/.test(k) && r[k] != null && r[k] !== "" ? (Number(r[k]) / 100).toFixed(2) : r[k]);
  return [cab.join(","), ...rows.map((r) => chaves.map((k) => celula(valor(r, k))).join(","))].join("\r\n");
}
function baixar(nome, texto) {
  const blob = new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const hora = () => new Date().toLocaleTimeString(loc(), { hour: "numeric", minute: "2-digit" });

// titulo=false quando já existe um seletor acima dizendo "Baixar a sua base" (aba Importar e exportar);
// sozinho (conta cancelada, aba travada) o cartão leva o título.
export default function DeskExportar({ email = "", dataKey = "", conectado = false, titulo = true }) {
  // tipo → { fase: 'lendo', n } | { fase: 'feito', n, h } | { fase: 'erro', msg }
  const [estado, setEstado] = useState({});
  const [lote, setLote] = useState(0);        // 1–4 enquanto "Baixar as 4" roda
  const ocupado = lote > 0 || Object.values(estado).some((x) => x?.fase === "lendo");

  // Lê todas as páginas de um tipo. Devolve as linhas, ou { erro } com o texto para a linha.
  const lerTudo = async (what) => {
    const linhas = [];
    for (let p = 0; p < MAX_PAGINAS; p++) {
      const { http, d } = await chamarDesk(email, dataKey, { action: "export", what, offset: linhas.length });
      if (d?.ok !== true || !Array.isArray(d.rows)) return { erro: t("failed", { m: motivo(d, http) }) };
      linhas.push(...d.rows);
      const total = Number(d.total) || 0;
      if (!d.rows.length || linhas.length >= total || d.rows.length < PAGINA) return linhas.length < total ? { erro: t("partial") } : { linhas };
      setEstado((s) => ({ ...s, [what]: { fase: "lendo", n: linhas.length } }));
    }
    return { erro: t("partial") };
  };

  const exportarUm = async (what) => {
    setEstado((s) => ({ ...s, [what]: { fase: "lendo", n: 0 } }));
    const r = await lerTudo(what);
    if (r.erro) { setEstado((s) => ({ ...s, [what]: { fase: "erro", msg: r.erro } })); return false; }
    baixar(`guileo-desk-${NOME_ARQUIVO[what]}-${new Date().toISOString().slice(0, 10)}.csv`, paraCsv(r.linhas));
    setEstado((s) => ({ ...s, [what]: { fase: "feito", n: r.linhas.length, h: hora() } }));
    return true;
  };
  const exportarTodas = async () => {
    let ok = 0;
    for (let i = 0; i < TIPOS.length; i++) { setLote(i + 1); if (await exportarUm(TIPOS[i])) ok++; }
    setLote(0);
    if (ok < TIPOS.length) toast(t("allSome", { ok }));
  };

  const linhaStatus = (e) => {
    if (!e?.fase) return null;
    if (e.fase === "lendo") return <span className="text-g-muted">{e.n ? t("preparingN", { n: e.n.toLocaleString(loc()) }) : t("preparing")}</span>;
    if (e.fase === "erro") return <span className="text-red-300">{e.msg}</span>;
    return <span className="text-g-green">✓ {e.n ? t("done", { h: e.h, n: e.n.toLocaleString(loc()) }) : t("doneEmpty", { h: e.h })}</span>;
  };

  return (
    <Card>
      {titulo && <h3 className="text-sm font-extrabold text-g-word mb-1">{t("title")}</h3>}
      <p className={`max-w-xl ${titulo ? "text-xs text-g-muted" : "text-sm text-g-word"}`}>{t("promise")}</p>

      <ul className="mt-3 divide-y divide-white/10 rounded-xl2 border border-white/10">
        {TIPOS.map((k) => {
          const e = estado[k];
          return (
            // Botão da linha sempre ao lado do texto (também no celular): só "Baixar as 4" ocupa a largura toda.
            <li key={k} className="flex items-center justify-between gap-3 px-3 py-3 sm:gap-4">
              <div className="min-w-0">
                <div className="text-sm font-bold text-g-word">{t(k)}</div>
                <div className="text-xs text-g-muted">{t(`${k}In`)}</div>
                {e?.fase && <div className="mt-1 text-[11px]" aria-live="polite">{linhaStatus(e)}</div>}
              </div>
              {conectado && (
                <button type="button" disabled={ocupado} onClick={() => exportarUm(k)}
                  className="shrink-0 min-h-[40px] max-w-[45%] rounded-full border border-white/15 bg-white/[0.04] px-3 sm:px-4 py-2 text-xs font-bold text-g-word hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-g-green disabled:opacity-40">
                  {e?.fase === "lendo" ? t("preparing") : e?.fase === "feito" ? t("again") : t("download")}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {conectado ? (
        <div className="mt-3 space-y-2">
          <button type="button" disabled={ocupado} onClick={exportarTodas}
            className="w-full sm:w-auto min-h-[44px] rounded-full bg-g-green px-5 py-2.5 text-sm font-extrabold text-[#161512] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-g-green disabled:opacity-40">
            {lote ? t("allBusy", { i: lote }) : t("all")}
          </button>
          <p className="text-[11px] text-g-muted">{t("multi")}</p>
          <p className="text-[11px] text-g-gold">🔒 {t("privacy")}</p>
        </div>
      ) : (
        <p role="note" className="mt-3 rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] px-3 py-2 text-xs text-g-light">{t("notConnected")}</p>
      )}
    </Card>
  );
}
