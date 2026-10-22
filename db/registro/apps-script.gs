// REGISTRO GUILEO — Google Apps Script (cole no Google Sheets: Extensões → Apps Script)
// Recebe cada ligação / agendamento / lead que a Guileo registra e grava uma linha,
// numa aba por cliente (ex.: "naturaspaadm") + uma aba "Tudo" com todos juntos.
//
// COMO PUBLICAR (5 min, uma vez):
// 1. Crie uma planilha nova no Google Sheets ("Guileo — Registro").
// 2. Extensões → Apps Script → apague o que tiver e cole ESTE arquivo inteiro.
// 3. Troque TOKEN abaixo por uma senha longa sua (qualquer texto, ex.: 32 letras aleatórias).
// 4. Implantar → Nova implantação → tipo "App da Web" → Executar como: Eu → Quem pode acessar: Qualquer pessoa.
// 5. Copie a URL do App da Web.
// 6. No Cloudflare (Pages → guileoai → Settings → Environment variables), crie:
//      SHEET_WEBHOOK = a URL do passo 5
//      SHEET_TOKEN   = a mesma senha do passo 3
//    e faça um novo deploy (variável nova só vale depois do deploy).
var TOKEN = "TROQUE-POR-UMA-SENHA-LONGA";

var COLUNAS = ["Data", "Cliente", "Tipo", "Nome", "Telefone", "E-mail", "Serviço", "Quando",
               "Duração (s)", "Sentimento", "Resumo", "Canal", "Ref"];

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents || "{}");
    if (d.token !== TOKEN) return saida({ ok: false, erro: "token" });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var linha = [
      new Date(d.data || new Date()), d.cliente || "", d.tipo || "", d.nome || "", d.telefone || "",
      d.email || "", d.servico || "", d.quando || "", d.duracao_s === "" ? "" : d.duracao_s,
      d.sentimento || "", d.resumo || "", d.canal || "", d.ref || ""
    ];
    var abaCliente = aba(ss, (d.cliente || "sem-cliente").split("@")[0].slice(0, 90));
    abaCliente.appendRow(linha);
    aba(ss, "Tudo").appendRow(linha);
    return saida({ ok: true, linha: abaCliente.getLastRow() });
  } catch (err) {
    return saida({ ok: false, erro: String(err).slice(0, 200) });
  }
}

function aba(ss, nome) {
  var s = ss.getSheetByName(nome);
  if (!s) {
    s = ss.insertSheet(nome);
    s.appendRow(COLUNAS);
    s.setFrozenRows(1);
    s.getRange(1, 1, 1, COLUNAS.length).setFontWeight("bold");
  }
  return s;
}

function saida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
