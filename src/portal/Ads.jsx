/* Aba ANÚNCIOS do cockpit — O RESULTADO, não o anúncio.
   ─────────────────────────────────────────────────────────────────────────────
   O QUE ESTA TELA SUBSTITUIU (e por que importava):
   a versão anterior lia a constante CAMPAIGNS de Portal.jsx — campanhas INVENTADAS
   ("Meta · Weekend Promo, $480, ROAS 4.2") e um "Avg. ROAS 4.1×" escrito à mão. Era
   resíduo de demo que sobreviveu até o produto. Um cliente pagante abriria "Anúncios"
   e veria desempenho de campanhas que nunca existiram. Num produto vendido como
   agência, isso não é um bug de tela: é a base sobre a qual ele decide onde pôr o
   dinheiro do mês.

   A REGRA DESTA TELA: nenhum número aparece sem lastro no banco. Sem gasto lançado
   ela DIZ que não há como calcular — nunca mostra zero, porque "ROAS 0" e "não sei o
   gasto" são coisas opostas e a primeira faz cortar a campanha que estava dando certo.

   O QUE VEM PRIMEIRO: clientes novos, receita agendada, custo por cliente. O gasto e
   os cliques ficam embaixo, como apoio. O cliente não compra anúncio — compra
   resultado; a tela é ordenada por isso.

   ── 2026-08-11: OS MOTORES DESLIGADOS DA CASA ────────────────────────────────
   `functions/api/ads.js` tinha QUATRO ações sem um único chamador na interface:
   `reinvestir`, `criativo`, `alertas` e `importar`. Motor construído, testado e
   provado — e inalcançável por quem paga. Um motor que só responde a curl não
   existe para o cliente. Agora todos os quatro têm botão aqui.

   A ESTRELA É `reinvestir`: ela fecha o ciclo. Medir retorno e parar é linha reta;
   dizer "sobe de $10 para $15 por dia, porque cada $1 virou $4,20" é o trabalho pelo
   qual o cliente paga. Por isso a decisão carrega junto o `porque` INTEIRO (nunca
   cortado — é ele que ensina o dono a decidir sozinho) e o `receita_base`, que diz se
   o número é dinheiro RECEBIDO ou ESTIMATIVA pelo preço de tabela. Decidir orçamento
   com estimativa é legítimo; decidir sem saber que é estimativa, não.

   PRIVACIDADE DA SEMENTE: a lista de clientes do cliente NUNCA sai em texto puro. A
   API já devolve só SHA-256 — e é assim que fica na tela. */
import { useState, useEffect, useCallback } from "react";
import { Card, tr, UI_LANG } from "../pages/Portal.jsx";

const post = (corpo) =>
  fetch("/api/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "rede" }));

/* ── i18n desta aba ───────────────────────────────────────────────────────────
   O portal traduz por `tr()`, que é chaveado pela string EM INGLÊS (src/portal/dict-*.js).
   Esta aba nascera 100% em português cravado no código — legível para o dono brasileiro e
   invisível para os outros três idiomas que o cockpit suporta. Aqui a base passa a ser
   inglês (a chave de `tr`) com um dicionário local pt/es/hi, o mesmo padrão que AIAnalytics
   já usa: os dicionários globais são arquivos de outro dono, e uma aba não deve depender de
   outra pessoa aplicar um patch para falar a língua do cliente. */
const ADS_I18N = {
  pt: {
    "Loading…": "Carregando…",
    "I couldn't read your ads": "não consegui ler os anúncios",
    "it's paying — worth investing more": "está pagando — vale investir mais",
    "it pays for itself — keep it": "se paga — manter",
    "it costs more than it brings": "está custando mais do que traz",
    "still early — let it run": "ainda cedo — deixa rodar",
    "people clicked and nobody left contact — the problem is the page, not the ad": "gente clicou e ninguém deixou contato — o problema é a página, não o anúncio",
    "no spend logged — can't say": "sem gasto lançado — não dá para dizer",
    "EXAMPLE": "EXEMPLO",
    "Example · not your data": "Exemplo · não são seus dados",
    "These numbers show how the screen looks once your campaigns are running. Connect your account in Settings to see the real return.": "Estes números ilustram como a tela fica quando suas campanhas estiverem rodando. Conecte sua conta em Configurações para ver o retorno real.",
    "New customers": "Clientes novos",
    "came from ads and booked": "vieram de anúncio e agendaram",
    "Booked revenue": "Receita agendada",
    "services booked by these people": "serviços marcados por essas pessoas",
    "Cost per customer": "Custo por cliente",
    "no spend logged": "sem gasto lançado",
    "invested": "investido",
    "Last 30 days": "Resumo dos últimos 30 dias",
    "Log ad spend": "Lançar gasto de anúncio",
    "What was invested in a day, by campaign. It's what lets us say how much came back.": "O que foi investido num dia, por campanha. É o que permite dizer quanto voltou.",
    "Day": "Dia",
    "Channel": "Canal",
    "Campaign": "Campanha",
    "Amount e.g. 450.00": "Valor ex: 450,00",
    "Clicks (optional)": "Cliques (opcional)",
    "Amount spent": "Valor gasto",
    "Clicks": "Cliques",
    "Other": "Outro",
    "Save": "Salvar",
    "Saving…": "Salvando…",
    "spend recorded": "gasto registrado",
    "I couldn't save it": "não consegui salvar",
    "Logging the same day + campaign again REPLACES the value (it doesn't add) — re-importing never duplicates.": "Lançar o mesmo dia + campanha de novo SUBSTITUI o valor (não soma) — reimportar não duplica.",
    "No campaign measured yet": "Nenhuma campanha medida ainda",
    "As soon as the first campaign runs, every person it brings shows up here — with what was spent, how many booked and how much that turned into booked services.": "Assim que a primeira campanha rodar, cada pessoa que ela trouxer aparece aqui — com o que foi gasto, quantas marcaram e quanto isso virou em serviço agendado.",
    "By campaign": "Por campanha",
    "Customers": "Clientes",
    "Revenue": "Receita",
    "Every $1 became": "Cada $1 virou",
    "Want more customers?": "Quer mais clientes?",
    "The Guileo team creates and adjusts the campaigns; Gui answers whoever arrives, books and charges. What you see above is the real result — from what was spent to what was booked.": "A equipe Guileo cria e ajusta as campanhas; a Gui atende quem chega, agenda e cobra. O que você vê acima é o resultado real — do que foi gasto ao que foi agendado.",
    // ── reinvestir
    "Where the next dollar goes": "Para onde vai o próximo dólar",
    "The engine reads what each campaign returned and says how much to put in tomorrow — with the reasoning in full.": "O motor lê o que cada campanha devolveu e diz quanto pôr amanhã — com a conta inteira à vista.",
    "Recalculate": "Recalcular",
    "Calculating…": "Calculando…",
    "last 7 days": "últimos 7 dias",
    "last 30 days": "últimos 30 dias",
    "last 90 days": "últimos 90 dias",
    "raise it": "subir",
    "keep it": "manter",
    "cut it back": "reduzir",
    "don't touch it": "não mexer",
    "no data": "sem dados",
    "per day": "por dia",
    "today": "hoje",
    "new": "novo",
    "spent": "gasto",
    "leads": "leads",
    "every $1 became": "cada $1 virou",
    "money actually received": "dinheiro recebido",
    "ESTIMATE — list price, not money received": "ESTIMATIVA — preço de tabela, não dinheiro recebido",
    "part received, part estimated by list price": "parte recebida, parte estimada pelo preço de tabela",
    "booked, but no value measured": "agendou, mas sem valor medido",
    "the engine didn't report where this revenue came from": "o motor não informou de onde veio esta receita",
    "Part of the revenue below is an ESTIMATE from your list price — not money that landed. Deciding a budget on an estimate is legitimate; deciding without knowing it's an estimate is not.": "Parte da receita abaixo é ESTIMATIVA pelo seu preço de tabela — não dinheiro que entrou. Decidir orçamento com estimativa é legítimo; decidir sem saber que é estimativa, não.",
    "No campaign to decide on yet — log the spend above and the decision appears here.": "Nenhuma campanha para decidir ainda — lance o gasto acima e a decisão aparece aqui.",
    // ── semente
    "Seed audience": "Semente de público",
    "people who actually booked": "pessoas que realmente marcaram",
    "Upload these hashes as a Custom Audience (Meta) or Customer Match (Google) and create a lookalike from it — instead of aiming at \"interested in spa\", you aim at people like the ones who already bought.": "Suba estes hashes como Custom Audience (Meta) ou Customer Match (Google) e crie um público semelhante a partir deles — em vez de mirar \"interesse em spa\", você mira gente parecida com quem já comprou.",
    "Contacts never leave here in plain text — only the SHA-256 hash, which is exactly the format Meta and Google expect.": "Contato nenhum sai daqui em texto puro — só o hash SHA-256, que é exatamente o formato que a Meta e o Google esperam.",
    "Copy the hashes": "Copiar os hashes",
    "copied ✓": "copiado ✓",
    "your browser blocked the copy — select the text manually": "seu navegador bloqueou a cópia — selecione o texto à mão",
    // ── criativo
    "Ad creative": "Criativo do anúncio",
    "Headlines and descriptions in your business's language and tone, from your real services and prices — never an invented promise.": "Títulos e descrições no idioma e no tom do seu negócio, a partir dos serviços e preços reais — nunca uma promessa inventada.",
    "Goal (optional) e.g. fill Tuesdays": "Objetivo (opcional) ex: encher as terças",
    "Audience (optional) e.g. women 30+ nearby": "Público (opcional) ex: mulheres 30+ na região",
    "Generate creative": "Gerar criativo",
    "Writing…": "Escrevendo…",
    "characters": "caracteres",
    "over the platform's hard limit": "acima do limite duro da plataforma",
    "Headlines": "Títulos",
    "Descriptions": "Descrições",
    "Primary text": "Texto principal",
    "Headline": "Título",
    "Description": "Descrição",
    // ── importar
    "Import a report": "Importar relatório",
    "Paste the export from Google Ads (TAB) or Meta (CSV). Columns are read by NAME, in PT and EN. Re-importing the same period REPLACES it — it never adds up twice.": "Cole o export do Google Ads (TAB) ou da Meta (CSV). As colunas são lidas pelo NOME, em PT e EN. Reimportar o mesmo período SUBSTITUI — nunca soma duas vezes.",
    "Paste here: day, campaign, cost…": "Cole aqui: dia, campanha, custo…",
    "Import": "Importar",
    "Importing…": "Importando…",
    "rows recorded": "linhas gravadas",
    "rows refused": "linhas recusadas",
    "rows not processed": "linhas não processadas",
    "Some rows were not processed — split the report and paste it in parts, or your spend will read lower than it is.": "Algumas linhas não foram processadas — divida o relatório e cole em partes, senão seu gasto aparece menor do que é.",
    "Refused rows come with the reason — an importer that only says \"42 imported\" hides the 3 that stayed out, and those are the ones that throw the account off.": "As linhas recusadas vêm com o motivo — um importador que só diz \"42 importadas\" esconde as 3 que ficaram de fora, e são justamente elas que desequilibram a conta.",
    // ── alertas
    "Watchman · Guileo team": "O vigia · equipe Guileo",
    "Scans every client's campaigns and lists what needs a decision today. Only the Guileo team account can run it — it's a sweep across clients.": "Varre as campanhas de todos os clientes e lista o que precisa de decisão hoje. Só a conta da equipe Guileo consegue rodar — é uma varredura entre clientes.",
    "Scan campaigns": "Varrer campanhas",
    "Scanning…": "Varrendo…",
    "Burning money": "Queimando dinheiro",
    "Opportunities": "Oportunidades",
    "need a decision": "precisam de decisão",
    "Nothing needs a decision right now — and silence when there's nothing is part of the product.": "Nada precisa de decisão agora — e silêncio quando não há nada é parte do produto.",
    "This scan is only available to the Guileo team account.": "Esta varredura só está disponível para a conta da equipe Guileo.",
    "brought": "trouxe",
  },
  es: {
    "Loading…": "Cargando…",
    "I couldn't read your ads": "no pude leer tus anuncios",
    "it's paying — worth investing more": "está pagando — vale invertir más",
    "it pays for itself — keep it": "se paga — mantener",
    "it costs more than it brings": "cuesta más de lo que trae",
    "still early — let it run": "todavía es pronto — déjala correr",
    "people clicked and nobody left contact — the problem is the page, not the ad": "hubo clics y nadie dejó contacto — el problema es la página, no el anuncio",
    "no spend logged — can't say": "sin gasto registrado — no se puede decir",
    "EXAMPLE": "EJEMPLO",
    "Example · not your data": "Ejemplo · no son tus datos",
    "These numbers show how the screen looks once your campaigns are running. Connect your account in Settings to see the real return.": "Estos números ilustran cómo se ve la pantalla cuando tus campañas estén activas. Conecta tu cuenta en Configuración para ver el retorno real.",
    "New customers": "Clientes nuevos",
    "came from ads and booked": "vinieron de anuncios y reservaron",
    "Booked revenue": "Ingresos reservados",
    "services booked by these people": "servicios reservados por esas personas",
    "Cost per customer": "Costo por cliente",
    "no spend logged": "sin gasto registrado",
    "invested": "invertido",
    "Last 30 days": "Resumen de los últimos 30 días",
    "Log ad spend": "Registrar gasto de anuncios",
    "What was invested in a day, by campaign. It's what lets us say how much came back.": "Lo que se invirtió en un día, por campaña. Es lo que permite decir cuánto volvió.",
    "Day": "Día",
    "Channel": "Canal",
    "Campaign": "Campaña",
    "Amount e.g. 450.00": "Valor ej: 450,00",
    "Clicks (optional)": "Clics (opcional)",
    "Amount spent": "Valor gastado",
    "Clicks": "Clics",
    "Other": "Otro",
    "Save": "Guardar",
    "Saving…": "Guardando…",
    "spend recorded": "gasto registrado",
    "I couldn't save it": "no pude guardar",
    "Logging the same day + campaign again REPLACES the value (it doesn't add) — re-importing never duplicates.": "Registrar el mismo día + campaña otra vez SUSTITUYE el valor (no suma) — reimportar nunca duplica.",
    "No campaign measured yet": "Ninguna campaña medida todavía",
    "As soon as the first campaign runs, every person it brings shows up here — with what was spent, how many booked and how much that turned into booked services.": "En cuanto corra la primera campaña, cada persona que traiga aparece aquí — con lo gastado, cuántas reservaron y cuánto se convirtió en servicios reservados.",
    "By campaign": "Por campaña",
    "Customers": "Clientes",
    "Revenue": "Ingresos",
    "Every $1 became": "Cada $1 se volvió",
    "Want more customers?": "¿Quieres más clientes?",
    "The Guileo team creates and adjusts the campaigns; Gui answers whoever arrives, books and charges. What you see above is the real result — from what was spent to what was booked.": "El equipo Guileo crea y ajusta las campañas; Gui atiende a quien llega, reserva y cobra. Lo de arriba es el resultado real — de lo gastado a lo reservado.",
    "Where the next dollar goes": "Adónde va el próximo dólar",
    "The engine reads what each campaign returned and says how much to put in tomorrow — with the reasoning in full.": "El motor lee lo que devolvió cada campaña y dice cuánto poner mañana — con la cuenta completa a la vista.",
    "Recalculate": "Recalcular",
    "Calculating…": "Calculando…",
    "last 7 days": "últimos 7 días",
    "last 30 days": "últimos 30 días",
    "last 90 days": "últimos 90 días",
    "raise it": "subir",
    "keep it": "mantener",
    "cut it back": "reducir",
    "don't touch it": "no tocar",
    "no data": "sin datos",
    "per day": "por día",
    "today": "hoy",
    "new": "nuevo",
    "spent": "gastado",
    "leads": "leads",
    "every $1 became": "cada $1 se volvió",
    "money actually received": "dinero recibido",
    "ESTIMATE — list price, not money received": "ESTIMACIÓN — precio de lista, no dinero recibido",
    "part received, part estimated by list price": "parte recibida, parte estimada por precio de lista",
    "booked, but no value measured": "reservó, pero sin valor medido",
    "the engine didn't report where this revenue came from": "el motor no informó de dónde vino este ingreso",
    "Part of the revenue below is an ESTIMATE from your list price — not money that landed. Deciding a budget on an estimate is legitimate; deciding without knowing it's an estimate is not.": "Parte del ingreso de abajo es una ESTIMACIÓN por tu precio de lista — no dinero que entró. Decidir presupuesto con una estimación es legítimo; decidir sin saber que es estimación, no.",
    "No campaign to decide on yet — log the spend above and the decision appears here.": "Ninguna campaña para decidir todavía — registra el gasto arriba y la decisión aparece aquí.",
    "Seed audience": "Semilla de público",
    "people who actually booked": "personas que realmente reservaron",
    "Upload these hashes as a Custom Audience (Meta) or Customer Match (Google) and create a lookalike from it — instead of aiming at \"interested in spa\", you aim at people like the ones who already bought.": "Sube estos hashes como Custom Audience (Meta) o Customer Match (Google) y crea un público similar a partir de ellos — en vez de apuntar a \"interés en spa\", apuntas a gente parecida a quien ya compró.",
    "Contacts never leave here in plain text — only the SHA-256 hash, which is exactly the format Meta and Google expect.": "Ningún contacto sale de aquí en texto plano — solo el hash SHA-256, que es exactamente el formato que Meta y Google esperan.",
    "Copy the hashes": "Copiar los hashes",
    "copied ✓": "copiado ✓",
    "your browser blocked the copy — select the text manually": "tu navegador bloqueó la copia — selecciona el texto a mano",
    "Ad creative": "Creativo del anuncio",
    "Headlines and descriptions in your business's language and tone, from your real services and prices — never an invented promise.": "Títulos y descripciones en el idioma y tono de tu negocio, a partir de tus servicios y precios reales — nunca una promesa inventada.",
    "Goal (optional) e.g. fill Tuesdays": "Objetivo (opcional) ej: llenar los martes",
    "Audience (optional) e.g. women 30+ nearby": "Público (opcional) ej: mujeres 30+ cerca",
    "Generate creative": "Generar creativo",
    "Writing…": "Escribiendo…",
    "characters": "caracteres",
    "over the platform's hard limit": "por encima del límite duro de la plataforma",
    "Headlines": "Títulos",
    "Descriptions": "Descripciones",
    "Primary text": "Texto principal",
    "Headline": "Título",
    "Description": "Descripción",
    "Import a report": "Importar informe",
    "Paste the export from Google Ads (TAB) or Meta (CSV). Columns are read by NAME, in PT and EN. Re-importing the same period REPLACES it — it never adds up twice.": "Pega el export de Google Ads (TAB) o Meta (CSV). Las columnas se leen por NOMBRE, en PT e EN. Reimportar el mismo período SUSTITUYE — nunca suma dos veces.",
    "Paste here: day, campaign, cost…": "Pega aquí: día, campaña, costo…",
    "Import": "Importar",
    "Importing…": "Importando…",
    "rows recorded": "filas grabadas",
    "rows refused": "filas rechazadas",
    "Refused rows come with the reason — an importer that only says \"42 imported\" hides the 3 that stayed out, and those are the ones that throw the account off.": "Las filas rechazadas vienen con el motivo — un importador que solo dice \"42 importadas\" esconde las 3 que quedaron fuera, y son justo esas las que desequilibran la cuenta.",
    "Watchman · Guileo team": "El vigía · equipo Guileo",
    "Scans every client's campaigns and lists what needs a decision today. Only the Guileo team account can run it — it's a sweep across clients.": "Recorre las campañas de todos los clientes y lista lo que necesita decisión hoy. Solo la cuenta del equipo Guileo puede ejecutarlo — es un barrido entre clientes.",
    "Scan campaigns": "Barrer campañas",
    "Scanning…": "Barriendo…",
    "Burning money": "Quemando dinero",
    "Opportunities": "Oportunidades",
    "need a decision": "necesitan decisión",
    "Nothing needs a decision right now — and silence when there's nothing is part of the product.": "Nada necesita decisión ahora — y el silencio cuando no hay nada es parte del producto.",
    "This scan is only available to the Guileo team account.": "Este barrido solo está disponible para la cuenta del equipo Guileo.",
    "brought": "trajo",
  },
  hi: {
    "Loading…": "लोड हो रहा है…",
    "I couldn't read your ads": "मैं आपके विज्ञापन नहीं पढ़ पाया",
    "it's paying — worth investing more": "यह चल रहा है — और निवेश करना सही है",
    "it pays for itself — keep it": "यह अपनी लागत निकाल रहा है — इसे बनाए रखें",
    "it costs more than it brings": "यह जितना लाता है उससे ज़्यादा खर्च करा रहा है",
    "still early — let it run": "अभी जल्दी है — चलने दें",
    "people clicked and nobody left contact — the problem is the page, not the ad": "क्लिक आए पर किसी ने संपर्क नहीं छोड़ा — समस्या पेज की है, विज्ञापन की नहीं",
    "no spend logged — can't say": "कोई खर्च दर्ज नहीं — कुछ कहा नहीं जा सकता",
    "EXAMPLE": "उदाहरण",
    "Example · not your data": "उदाहरण · यह आपका डेटा नहीं है",
    "These numbers show how the screen looks once your campaigns are running. Connect your account in Settings to see the real return.": "ये आंकड़े दिखाते हैं कि आपके अभियान चलने पर यह स्क्रीन कैसी दिखेगी। असली रिटर्न देखने के लिए सेटिंग्स में अपना खाता जोड़ें।",
    "New customers": "नए ग्राहक",
    "came from ads and booked": "विज्ञापन से आए और बुकिंग की",
    "Booked revenue": "बुक की गई आय",
    "services booked by these people": "इन लोगों द्वारा बुक की गई सेवाएँ",
    "Cost per customer": "प्रति ग्राहक लागत",
    "no spend logged": "कोई खर्च दर्ज नहीं",
    "invested": "निवेश किया",
    "Last 30 days": "पिछले 30 दिन",
    "Log ad spend": "विज्ञापन खर्च दर्ज करें",
    "What was invested in a day, by campaign. It's what lets us say how much came back.": "एक दिन में, हर अभियान पर कितना लगाया। इसी से पता चलता है कि कितना वापस आया।",
    "Day": "दिन",
    "Channel": "चैनल",
    "Campaign": "अभियान",
    "Amount e.g. 450.00": "राशि जैसे 450.00",
    "Clicks (optional)": "क्लिक (वैकल्पिक)",
    "Amount spent": "खर्च की गई राशि",
    "Clicks": "क्लिक",
    "Other": "अन्य",
    "Save": "सहेजें",
    "Saving…": "सहेजा जा रहा है…",
    "spend recorded": "खर्च दर्ज हुआ",
    "I couldn't save it": "मैं इसे सहेज नहीं पाया",
    "Logging the same day + campaign again REPLACES the value (it doesn't add) — re-importing never duplicates.": "वही दिन + अभियान दोबारा दर्ज करने पर मान बदल जाता है (जुड़ता नहीं) — दोबारा आयात से कभी दोहराव नहीं होता।",
    "No campaign measured yet": "अभी कोई अभियान मापा नहीं गया",
    "As soon as the first campaign runs, every person it brings shows up here — with what was spent, how many booked and how much that turned into booked services.": "पहला अभियान चलते ही उससे आया हर व्यक्ति यहाँ दिखेगा — कितना खर्च हुआ, कितनों ने बुकिंग की और वह कितनी बुक सेवाओं में बदला।",
    "By campaign": "अभियान के अनुसार",
    "Customers": "ग्राहक",
    "Revenue": "आय",
    "Every $1 became": "हर $1 बना",
    "Want more customers?": "और ग्राहक चाहिए?",
    "The Guileo team creates and adjusts the campaigns; Gui answers whoever arrives, books and charges. What you see above is the real result — from what was spent to what was booked.": "Guileo की टीम अभियान बनाती और सुधारती है; Gui आने वाले हर व्यक्ति से बात करती है, बुकिंग करती है और भुगतान लेती है। ऊपर जो है वह असली नतीजा है — खर्च से बुकिंग तक।",
    "Where the next dollar goes": "अगला डॉलर कहाँ जाए",
    "The engine reads what each campaign returned and says how much to put in tomorrow — with the reasoning in full.": "इंजन पढ़ता है कि हर अभियान ने क्या लौटाया और बताता है कल कितना लगाना है — पूरी वजह के साथ।",
    "Recalculate": "फिर से गणना करें",
    "Calculating…": "गणना हो रही है…",
    "last 7 days": "पिछले 7 दिन",
    "last 30 days": "पिछले 30 दिन",
    "last 90 days": "पिछले 90 दिन",
    "raise it": "बढ़ाएँ",
    "keep it": "बनाए रखें",
    "cut it back": "घटाएँ",
    "don't touch it": "छेड़ें नहीं",
    "no data": "डेटा नहीं",
    "per day": "प्रति दिन",
    "today": "आज",
    "new": "नया",
    "spent": "खर्च",
    "leads": "लीड",
    "every $1 became": "हर $1 बना",
    "money actually received": "वास्तव में मिला पैसा",
    "ESTIMATE — list price, not money received": "अनुमान — सूची मूल्य, मिला हुआ पैसा नहीं",
    "part received, part estimated by list price": "कुछ मिला हुआ, कुछ सूची मूल्य से अनुमानित",
    "booked, but no value measured": "बुकिंग हुई, पर मूल्य नहीं मापा गया",
    "the engine didn't report where this revenue came from": "इंजन ने नहीं बताया कि यह आय कहाँ से आई",
    "Part of the revenue below is an ESTIMATE from your list price — not money that landed. Deciding a budget on an estimate is legitimate; deciding without knowing it's an estimate is not.": "नीचे दी गई आय का कुछ हिस्सा आपके सूची मूल्य से लगाया गया अनुमान है — खाते में आया पैसा नहीं। अनुमान के आधार पर बजट तय करना ठीक है; यह जाने बिना कि वह अनुमान है, तय करना ठीक नहीं।",
    "No campaign to decide on yet — log the spend above and the decision appears here.": "अभी तय करने के लिए कोई अभियान नहीं — ऊपर खर्च दर्ज करें और फैसला यहाँ दिखेगा।",
    "Seed audience": "बीज ऑडियंस",
    "people who actually booked": "वे लोग जिन्होंने सचमुच बुकिंग की",
    "Upload these hashes as a Custom Audience (Meta) or Customer Match (Google) and create a lookalike from it — instead of aiming at \"interested in spa\", you aim at people like the ones who already bought.": "इन हैश को Meta में Custom Audience या Google में Customer Match के रूप में अपलोड करें और उससे lookalike ऑडियंस बनाएँ — \"स्पा में रुचि\" को निशाना बनाने के बजाय आप उन लोगों जैसे लोगों को निशाना बनाते हैं जिन्होंने पहले ही खरीदा है।",
    "Contacts never leave here in plain text — only the SHA-256 hash, which is exactly the format Meta and Google expect.": "संपर्क कभी सादे टेक्स्ट में यहाँ से बाहर नहीं जाते — केवल SHA-256 हैश, जो ठीक वही प्रारूप है जिसकी Meta और Google को ज़रूरत है।",
    "Copy the hashes": "हैश कॉपी करें",
    "copied ✓": "कॉपी हो गया ✓",
    "your browser blocked the copy — select the text manually": "आपके ब्राउज़र ने कॉपी रोक दी — टेक्स्ट हाथ से चुनें",
    "Ad creative": "विज्ञापन क्रिएटिव",
    "Headlines and descriptions in your business's language and tone, from your real services and prices — never an invented promise.": "आपके व्यवसाय की भाषा और लहजे में शीर्षक और विवरण, आपकी असली सेवाओं और कीमतों से — कभी कोई गढ़ा हुआ वादा नहीं।",
    "Goal (optional) e.g. fill Tuesdays": "लक्ष्य (वैकल्पिक) जैसे मंगलवार भरना",
    "Audience (optional) e.g. women 30+ nearby": "ऑडियंस (वैकल्पिक) जैसे आसपास की 30+ महिलाएँ",
    "Generate creative": "क्रिएटिव बनाएँ",
    "Writing…": "लिखा जा रहा है…",
    "characters": "अक्षर",
    "over the platform's hard limit": "प्लेटफ़ॉर्म की सख़्त सीमा से ऊपर",
    "Headlines": "शीर्षक",
    "Descriptions": "विवरण",
    "Primary text": "मुख्य टेक्स्ट",
    "Headline": "शीर्षक",
    "Description": "विवरण",
    "Import a report": "रिपोर्ट आयात करें",
    "Paste the export from Google Ads (TAB) or Meta (CSV). Columns are read by NAME, in PT and EN. Re-importing the same period REPLACES it — it never adds up twice.": "Google Ads (TAB) या Meta (CSV) का एक्सपोर्ट यहाँ चिपकाएँ। कॉलम नाम से पढ़े जाते हैं (PT और EN)। वही अवधि दोबारा आयात करने पर मान बदल जाता है — दो बार नहीं जुड़ता।",
    "Paste here: day, campaign, cost…": "यहाँ चिपकाएँ: दिन, अभियान, लागत…",
    "Import": "आयात करें",
    "Importing…": "आयात हो रहा है…",
    "rows recorded": "पंक्तियाँ दर्ज",
    "rows refused": "पंक्तियाँ अस्वीकृत",
    "Refused rows come with the reason — an importer that only says \"42 imported\" hides the 3 that stayed out, and those are the ones that throw the account off.": "अस्वीकृत पंक्तियाँ कारण के साथ आती हैं — जो आयातक सिर्फ़ \"42 आयात हुईं\" कहता है वह उन 3 को छिपाता है जो छूट गईं, और वही हिसाब बिगाड़ती हैं।",
    "Watchman · Guileo team": "प्रहरी · Guileo टीम",
    "Scans every client's campaigns and lists what needs a decision today. Only the Guileo team account can run it — it's a sweep across clients.": "हर ग्राहक के अभियानों को स्कैन करता है और बताता है कि आज किस पर फ़ैसला चाहिए। इसे केवल Guileo टीम का खाता चला सकता है — यह सभी ग्राहकों पर चलने वाली जाँच है।",
    "Scan campaigns": "अभियान स्कैन करें",
    "Scanning…": "स्कैन हो रहा है…",
    "Burning money": "पैसा जल रहा है",
    "Opportunities": "अवसर",
    "need a decision": "पर फ़ैसला चाहिए",
    "Nothing needs a decision right now — and silence when there's nothing is part of the product.": "अभी किसी पर फ़ैसला ज़रूरी नहीं — और जब कुछ न हो तब चुप रहना भी उत्पाद का हिस्सा है।",
    "This scan is only available to the Guileo team account.": "यह जाँच केवल Guileo टीम के खाते के लिए उपलब्ध है।",
    "brought": "लाया",
  },
};
// Dicionário local primeiro, `tr()` global depois, inglês (a própria chave) por último.
const t = (s) => (ADS_I18N[UI_LANG] && ADS_I18N[UI_LANG][s]) || tr(s);

// Cada veredito vira uma frase de AÇÃO, não um rótulo técnico. "cedo_demais" sozinho
// não diz o que fazer; "ainda cedo — deixa rodar" diz.
const VEREDITO = {
  escalar: { txt: "it's paying — worth investing more", cor: "#3E9468" },
  mantem: { txt: "it pays for itself — keep it", cor: "#3E9468" },
  corta: { txt: "it costs more than it brings", cor: "#E5484D" },
  cedo_demais: { txt: "still early — let it run", cor: "#C8A24A" },
  sem_lead_apesar_do_trafego: { txt: "people clicked and nobody left contact — the problem is the page, not the ad", cor: "#C8A24A" },
  sem_dados: { txt: "no spend logged — can't say", cor: "#9A8F82" },
};

const input = "w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50";
const btn = "rounded-full px-4 py-1.5 text-xs font-bold bg-g-green/15 border border-g-green/40 text-g-green disabled:opacity-40 disabled:cursor-not-allowed hover:bg-g-green/25";
const cash = (n) => (n == null || !Number.isFinite(Number(n)) ? "—" : `$${Number(n).toFixed(2)}`);
const cashCents = (c) => (c == null ? "—" : `$${(Number(c) / 100).toFixed(2)}`);

/* O ERRO APARECE, com o motivo REAL da resposta. Lista vazia disfarçando falha é o defeito
   que esta aba inteira existe para não cometer: "não veio nada" e "não consegui ler" são
   estados opostos, e o primeiro faz o dono concluir que o anúncio não deu nada. */
function Erro({ msg }) {
  if (!msg) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-[11px] font-bold" style={{ background: "#E5484D14", border: "1px solid #E5484D44", color: "#E5484D" }}>
      {msg}
    </div>
  );
}

function Numerao({ rotulo, valor, sub, cor = "#EFE7DC", exemplo = false }) {
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wide text-g-muted">
        {rotulo}
        {/* O selo acompanha CADA número: quem der zoom numa captura de tela do
            painel continua vendo que aquilo é exemplo. */}
        {exemplo ? <span className="ml-1.5 text-[9px] font-black tracking-widest text-g-gold">{t("EXAMPLE")}</span> : null}
      </div>
      <div className="mt-1 text-2xl font-black num" style={{ color: cor }}>{valor}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-g-muted">{sub}</div> : null}
    </Card>
  );
}


// LANÇAR O GASTO DO DIA. Sem isto o motor inteiro fica sem a metade de cima da conta — e o
// endpoint de escrita existia só por curl, o que na prática significa que ninguém lança.
// Um número que ninguém consegue registrar é um número que não existe.
function LancarGasto({ email, dataKey, aoSalvar }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ dia: hoje, canal: "google", campanha: "", valor: "", cliques: "" });
  const [estado, setEstado] = useState("");   // "" | "salvando" | "ok" | mensagem de erro
  const campo = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const salvar = async () => {
    setEstado("salvando");
    const r = await post({ email, key: dataKey, action: "gasto", ...f });
    // SÓ É SUCESSO COM IDENTIFICADOR. O endpoint devolve o id da linha gravada; sem ele,
    // mostrar "salvo" seria a mesma promessa sem lastro que já custou caro aqui.
    if (r?.ok && r.id) {
      setEstado("ok");
      setF({ ...f, campanha: "", valor: "", cliques: "" });
      aoSalvar?.();
      setTimeout(() => setEstado(""), 2500);
    } else {
      setEstado(r?.error || t("I couldn't save it"));
    }
  };

  const podeSalvar = f.campanha.trim() && f.valor.trim() && /^\d{4}-\d{2}-\d{2}$/.test(f.dia) && estado !== "salvando";

  return (
    <Card>
      <div className="text-sm font-bold text-g-word">{t("Log ad spend")}</div>
      <p className="mt-0.5 text-[11px] text-g-muted">
        {t("What was invested in a day, by campaign. It's what lets us say how much came back.")}
      </p>
      <div className="mt-3 grid sm:grid-cols-5 gap-2">
        <input className={input} type="date" value={f.dia} onChange={campo("dia")} aria-label={t("Day")} />
        <select className={input} value={f.canal} onChange={campo("canal")} aria-label={t("Channel")}>
          <option value="google">Google</option>
          <option value="meta">Meta</option>
          <option value="tiktok">TikTok</option>
          <option value="outro">{t("Other")}</option>
        </select>
        <input className={input} placeholder={t("Campaign")} value={f.campanha} onChange={campo("campanha")} aria-label={t("Campaign")} />
        <input className={input} placeholder={t("Amount e.g. 450.00")} value={f.valor} onChange={campo("valor")} aria-label={t("Amount spent")} />
        <input className={input} placeholder={t("Clicks (optional)")} value={f.cliques} onChange={campo("cliques")} aria-label={t("Clicks")} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={salvar} disabled={!podeSalvar} className={btn}>
          {estado === "salvando" ? t("Saving…") : t("Save")}
        </button>
        {estado === "ok" ? <span className="text-[11px] text-g-green">{t("spend recorded")}</span> : null}
      </div>
      {estado && estado !== "ok" && estado !== "salvando" ? <div className="mt-2"><Erro msg={estado} /></div> : null}
      <p className="mt-2 text-[11px] text-g-muted">
        {t("Logging the same day + campaign again REPLACES the value (it doesn't add) — re-importing never duplicates.")}
      </p>
    </Card>
  );
}


/* ── IMPORTAR RELATÓRIO ───────────────────────────────────────────────────────
   O motor aceitava o export colado desde 2026-08-09 e ninguém nunca colou nada: não havia
   caixa. Lançar 40 campanhas à mão, uma por uma, é o mesmo que não medir. */
function Importar({ email, dataKey, aoImportar }) {
  const [canal, setCanal] = useState("google");
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [res, setRes] = useState(null);

  const importar = async () => {
    setBusy(true); setErro(""); setRes(null);
    const r = await post({ email, key: dataKey, action: "importar", canal, texto });
    setBusy(false);
    if (!r?.ok) { setErro(r?.error || t("I couldn't read your ads")); return; }
    setRes(r);
    if (r.gravadas > 0) { setTexto(""); aoImportar?.(); }
  };

  return (
    <Card>
      <div className="text-sm font-bold text-g-word">{t("Import a report")}</div>
      <p className="mt-0.5 text-[11px] text-g-muted">
        {t("Paste the export from Google Ads (TAB) or Meta (CSV). Columns are read by NAME, in PT and EN. Re-importing the same period REPLACES it — it never adds up twice.")}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <select className={`${input} max-w-[160px]`} value={canal} onChange={(e) => setCanal(e.target.value)} aria-label={t("Channel")}>
          <option value="google">Google</option>
          <option value="meta">Meta</option>
          <option value="tiktok">TikTok</option>
          <option value="outro">{t("Other")}</option>
        </select>
        <button onClick={importar} disabled={busy || !texto.trim()} className={btn}>
          {busy ? t("Importing…") : t("Import")}
        </button>
      </div>
      <textarea
        className={`${input} mt-2 font-mono text-[11px]`} rows={4} value={texto}
        onChange={(e) => setTexto(e.target.value)} placeholder={t("Paste here: day, campaign, cost…")} aria-label={t("Import a report")}
      />
      {erro ? <div className="mt-2"><Erro msg={erro} /></div> : null}
      {res ? (
        <div className="mt-3 space-y-2">
          <div className="text-[12px] font-bold text-g-word">
            <span className="text-g-green">{res.gravadas} {t("rows recorded")}</span>
            {res.recusadas ? <span style={{ color: "#E5484D" }}> · {res.recusadas} {t("rows refused")}</span> : null}
            {res.nao_processadas ? <span style={{ color: "#C8A24A" }}> · {res.nao_processadas} {t("rows not processed")}</span> : null}
          </div>
          {/* LINHAS QUE NEM CHEGARAM A SER LIDAS. O endpoint devolve `nao_processadas` + `nota`
              quando o relatório passa do teto — e esta tela ignorava os dois campos. O resultado
              era o pior possível: 900 linhas coladas, tela VERDE dizendo "800 gravadas", 100 linhas
              de gasto sumindo em silêncio. Gasto subdeclarado infla o retorno, e o motor manda
              escalar uma campanha que na verdade custa mais. Truncar sem avisar é a mentira mais
              barata de cometer e a mais cara de descobrir. Corrigido 2026-08-11. */}
          {res.nao_processadas || res.nota ? (
            <div className="rounded-lg p-3 text-[11px] leading-snug" style={{ background: "#C8A24A12", border: "1px solid #C8A24A40", color: "#C8A24A" }}>
              {res.nota || t("Some rows were not processed — split the report and paste it in parts, or your spend will read lower than it is.")}
            </div>
          ) : null}
          {(res.exemplos || []).map((e, i) => (
            <div key={i} className="text-[11px] text-g-muted">{e.dia} · {e.campanha} · {e.gasto}</div>
          ))}
          {/* AS RECUSADAS COM O MOTIVO — é o que o endpoint devolve de propósito, e escondê-las
              na tela desfaria a honestidade que ele construiu. */}
          {(res.detalhe_recusadas || []).length ? (
            <div className="rounded-lg p-3 space-y-1" style={{ background: "#C8A24A12", border: "1px solid #C8A24A40" }}>
              {res.detalhe_recusadas.map((d, i) => (
                <div key={i} className="text-[11px]" style={{ color: "#C8A24A" }}>
                  <span className="font-mono text-g-muted">{d.linha}</span> — {d.porque}
                </div>
              ))}
              <div className="text-[10px] text-g-muted pt-1">
                {t("Refused rows come with the reason — an importer that only says \"42 imported\" hides the 3 that stayed out, and those are the ones that throw the account off.")}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}


/* ── REINVESTIR — A ESTRELA ───────────────────────────────────────────────────
   Medir e parar é linha reta. Aqui o dinheiro que voltou vira o orçamento de amanhã e quem
   comprou vira a semente do próximo público — o ciclo fecha.

   TRÊS COISAS NÃO SE MEXEM NESTA TELA:
   1. O `porque` sai INTEIRO. É a única parte que ensina o dono a decidir sozinho; resumir
      transforma conselho em ordem, e ordem sem conta é o que toda agência ruim vende.
   2. `receita_base` fica VISÍVEL ao lado do número. 'tabela'/'misto' significam que parte do
      valor é ESTIMATIVA pelo preço de tabela — e um aviso sobe para o topo do cartão.
   3. Contato nenhum em texto puro. Só o hash SHA-256 que a API já devolve. */
const ACAO = {
  subir: { rotulo: "raise it", cor: "#3E9468", icone: "↑" },
  manter: { rotulo: "keep it", cor: "#C8A24A", icone: "=" },
  reduzir: { rotulo: "cut it back", cor: "#E5484D", icone: "↓" },
  nao_mexer: { rotulo: "don't touch it", cor: "#9A8F82", icone: "•" },
  sem_dados: { rotulo: "no data", cor: "#9A8F82", icone: "?" },
};

// O rótulo da PROCEDÊNCIA do número. Dinheiro recebido e preço de tabela decidem o mesmo
// orçamento — só que um é fato e o outro é estimativa, e a tela precisa dizer qual é qual.
const BASE = {
  recebido: { txt: "money actually received", cor: "#3E9468", estimativa: false },
  tabela: { txt: "ESTIMATE — list price, not money received", cor: "#C8A24A", estimativa: true },
  misto: { txt: "part received, part estimated by list price", cor: "#C8A24A", estimativa: true },
  sem_valor: { txt: "booked, but no value measured", cor: "#9A8F82", estimativa: false },
};

function Decisao({ d }) {
  const a = ACAO[d.acao] || ACAO.sem_dados;
  const b = d.receita_base ? BASE[d.receita_base] : null;
  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-g-word truncate">{d.campanha}</div>
          <div className="text-[11px] text-g-muted capitalize">
            {d.fonte || "—"} · {t("spent")} {cash(d.gasto)} · {d.leads} {t("leads")}
            {d.retorno != null ? ` · ${t("every $1 became")} $${Number(d.retorno).toFixed(2)}` : ""}
          </div>
        </div>
        <span className="text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{ background: a.cor + "22", color: a.cor }}>
          {a.icone} {t(a.rotulo)}
        </span>
      </div>

      {/* O ORÇAMENTO, que é o que vira ação hoje: de quanto para quanto, por dia. */}
      {d.orcamento_dia_atual != null ? (
        <div className="mt-2 flex items-baseline gap-2 text-sm">
          <span className="num font-bold text-g-word">{cash(d.orcamento_dia_atual)}</span>
          <span className="text-[10px] uppercase tracking-wide text-g-muted">{t("today")}</span>
          {d.orcamento_dia_novo != null ? (
            <>
              <span className="text-g-muted">→</span>
              <span className="num font-black" style={{ color: a.cor }}>{cash(d.orcamento_dia_novo)}</span>
              <span className="text-[10px] uppercase tracking-wide" style={{ color: a.cor }}>{t("new")}</span>
            </>
          ) : null}
          <span className="text-[11px] text-g-muted">/ {t("per day")}</span>
        </div>
      ) : null}

      {/* A PROCEDÊNCIA DA RECEITA — ao lado do número, não numa nota de rodapé. */}
      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-g-muted">{t("Revenue")}:</span>
        <span className="text-[12px] font-bold num" style={{ color: "#3E9468" }}>{cash(d.receita)}</span>
        {b ? (
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: b.cor + "1F", color: b.cor }}>
            {b.estimativa ? "≈ " : ""}{t(b.txt)}
          </span>
        ) : (
          <span className="text-[10px] text-g-muted">{t("the engine didn't report where this revenue came from")}</span>
        )}
      </div>

      {/* O PORQUÊ INTEIRO. Nunca truncado — é o que ensina. */}
      {d.porque ? <div className="mt-2 text-[12px] leading-relaxed text-g-muted">{d.porque}</div> : null}
    </div>
  );
}

function Semente({ s }) {
  const [msg, setMsg] = useState("");
  const hashes = Array.isArray(s?.hashes) ? s.hashes : [];
  const copiar = async () => {
    try { await navigator.clipboard.writeText(hashes.join("\n")); setMsg(t("copied ✓")); }
    catch { setMsg(t("your browser blocked the copy — select the text manually")); }
    setTimeout(() => setMsg(""), 3000);
  };
  return (
    <div className="px-5 py-4 border-t border-white/10">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black num text-g-word">{s?.pessoas ?? 0}</span>
        <span className="text-[11px] uppercase tracking-wide text-g-gold font-bold">{t("Seed audience")}</span>
        <span className="text-[11px] text-g-muted">· {t("people who actually booked")}</span>
      </div>
      {/* A FRASE ÚNICA: o que fazer com isto hoje. */}
      <p className="mt-1.5 text-[12px] leading-relaxed text-g-word">
        {t("Upload these hashes as a Custom Audience (Meta) or Customer Match (Google) and create a lookalike from it — instead of aiming at \"interested in spa\", you aim at people like the ones who already bought.")}
      </p>
      <p className="mt-1 text-[11px] text-g-muted">
        {t("Contacts never leave here in plain text — only the SHA-256 hash, which is exactly the format Meta and Google expect.")}
      </p>
      {s?.nota ? <div className="mt-2 text-[11px]" style={{ color: "#C8A24A" }}>{s.nota}</div> : null}
      {hashes.length ? (
        <>
          <div className="mt-2 flex items-center gap-3">
            <button onClick={copiar} className={btn}>{t("Copy the hashes")}</button>
            {msg ? <span className="text-[11px] text-g-muted">{msg}</span> : null}
          </div>
          <div className="mt-2 rounded-lg bg-black/25 border border-white/5 px-3 py-2 max-h-24 overflow-auto font-mono text-[10px] leading-relaxed text-g-muted break-all">
            {hashes.slice(0, 8).map((h) => <div key={h}>{h}</div>)}
            {hashes.length > 8 ? <div className="text-g-muted/70">… +{hashes.length - 8}</div> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Reinvestir({ email, dataKey, recarga }) {
  const [dias, setDias] = useState(30);
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (janela) => {
    setBusy(true); setErro("");
    const r = await post({ email, key: dataKey, action: "reinvestir", dias: janela });
    setBusy(false);
    // ok:false OU corpo sem `decisoes` = falha. Cair em lista vazia aqui faria a tela dizer
    // "nada para decidir" quando a verdade é "não consegui perguntar".
    if (!r?.ok || !Array.isArray(r.decisoes)) { setErro(r?.error || t("I couldn't read your ads")); setD(null); return; }
    setD(r);
  }, [email, dataKey]);

  useEffect(() => { carregar(dias); }, [carregar, dias, recarga]);

  const decisoes = d?.decisoes || [];
  const temEstimativa = decisoes.some((x) => BASE[x.receita_base]?.estimativa);
  const JANELAS = [[7, "last 7 days"], [30, "last 30 days"], [90, "last 90 days"]];

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{t("Where the next dollar goes")}</span>
        <div className="flex-1" />
        {JANELAS.map(([n, rot]) => (
          <button key={n} onClick={() => setDias(n)} disabled={busy}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full border transition disabled:opacity-40 min-h-[44px] inline-flex items-center"
            style={dias === n ? { background: "#C8A24A22", borderColor: "#C8A24A", color: "#C8A24A" } : { borderColor: "rgba(255,255,255,.12)", color: "#9A8F82" }}>
            {t(rot)}
          </button>
        ))}
        <button onClick={() => carregar(dias)} disabled={busy} className="text-[10px] font-bold text-g-gold hover:underline disabled:opacity-40">
          {busy ? t("Calculating…") : t("Recalculate")}
        </button>
      </div>

      <div className="px-5 py-3 text-[12px] text-g-muted">
        {t("The engine reads what each campaign returned and says how much to put in tomorrow — with the reasoning in full.")}
      </div>

      {/* O AVISO SOBE AO TOPO quando qualquer linha é estimativa. Ver o rótulo campanha a
          campanha é bom; ver antes de rolar é o que impede a decisão desavisada. */}
      {temEstimativa ? (
        <div className="mx-5 mb-3 rounded-lg px-3 py-2 text-[11px] leading-relaxed" style={{ background: "#C8A24A14", border: "1px solid #C8A24A44", color: "#C8A24A" }}>
          {t("Part of the revenue below is an ESTIMATE from your list price — not money that landed. Deciding a budget on an estimate is legitimate; deciding without knowing it's an estimate is not.")}
        </div>
      ) : null}

      {erro ? <div className="px-5 pb-4"><Erro msg={erro} /></div> : null}
      {busy && !d ? <div className="px-5 pb-4 text-sm text-g-muted">{t("Calculating…")}</div> : null}

      {d ? (
        <>
          <div className="divide-y divide-white/[0.06] border-t border-white/10">
            {decisoes.map((x, i) => <Decisao key={`${x.fonte}-${x.campanha}-${i}`} d={x} />)}
            {decisoes.length === 0 ? (
              <div className="px-5 py-4 text-[12px] text-g-muted">{t("No campaign to decide on yet — log the spend above and the decision appears here.")}</div>
            ) : null}
          </div>
          <Semente s={d.semente} />
        </>
      ) : null}
    </Card>
  );
}


/* ── O CRIATIVO ───────────────────────────────────────────────────────────────
   Mora junto do resultado de propósito: quem escreve o próximo anúncio precisa ver, na mesma
   tela, se o anterior deu cliente ou queimou dinheiro. O contador de caracteres aparece
   porque o limite é DURO — o Google trunca no meio da palavra e a Meta reprova a peça. */
const LIMITES = { google: { headlines: 30, descriptions: 90 }, meta: { primary_text: 125, headline: 40, description: 30 } };

function Linha({ rotulo, txt, limite }) {
  const n = String(txt || "").length;
  const estourou = n > limite;
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="flex-1 text-[13px] text-g-word">{txt}</div>
      <div className="text-[10px] font-bold num whitespace-nowrap" style={{ color: estourou ? "#E5484D" : "#9A8F82" }}>
        {n}/{limite}
      </div>
      {rotulo ? <span className="sr-only">{rotulo}</span> : null}
    </div>
  );
}

function Criativo({ email, dataKey }) {
  const [plataforma, setPlataforma] = useState("google");
  const [objetivo, setObjetivo] = useState("");
  const [publico, setPublico] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [r, setR] = useState(null);

  const gerar = async () => {
    setBusy(true); setErro(""); setR(null);
    const res = await post({ email, key: dataKey, action: "criativo", plataforma, objetivo, publico });
    setBusy(false);
    // 501 (sem chave de IA) e 502 (a IA não devolveu JSON) chegam com o motivo real — mostrar
    // "não deu" sem ele obrigaria o cliente a adivinhar se o problema é dele ou nosso.
    if (!res?.ok || !res.criativo) { setErro(res?.error || t("I couldn't read your ads")); return; }
    setR(res);
  };

  const c = r?.criativo;
  const lim = LIMITES[r?.plataforma === "meta" ? "meta" : "google"];

  return (
    <Card>
      <div className="text-sm font-bold text-g-word">{t("Ad creative")}</div>
      <p className="mt-0.5 text-[11px] text-g-muted">
        {t("Headlines and descriptions in your business's language and tone, from your real services and prices — never an invented promise.")}
      </p>
      <div className="mt-3 grid sm:grid-cols-4 gap-2">
        <select className={input} value={plataforma} onChange={(e) => setPlataforma(e.target.value)} aria-label={t("Channel")}>
          <option value="google">Google</option>
          <option value="meta">Meta</option>
        </select>
        <input className={`${input} sm:col-span-2`} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder={t("Goal (optional) e.g. fill Tuesdays")} />
        <input className={input} value={publico} onChange={(e) => setPublico(e.target.value)} placeholder={t("Audience (optional) e.g. women 30+ nearby")} />
      </div>
      <div className="mt-3">
        <button onClick={gerar} disabled={busy} className={btn}>{busy ? t("Writing…") : t("Generate creative")}</button>
      </div>
      {erro ? <div className="mt-2"><Erro msg={erro} /></div> : null}

      {c ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] uppercase tracking-widest text-g-gold font-black">
            {r.plataforma} {r.idioma ? `· ${r.idioma}` : ""} {r.negocio ? `· ${r.negocio}` : ""}
          </div>
          {r.plataforma === "meta" ? (
            <div className="mt-2 divide-y divide-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wide text-g-muted pt-1">{t("Primary text")}</div>
              <Linha txt={c.primary_text} limite={lim.primary_text} />
              <div className="text-[10px] uppercase tracking-wide text-g-muted pt-1">{t("Headline")}</div>
              <Linha txt={c.headline} limite={lim.headline} />
              <div className="text-[10px] uppercase tracking-wide text-g-muted pt-1">{t("Description")}</div>
              <Linha txt={c.description} limite={lim.description} />
            </div>
          ) : (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wide text-g-muted">{t("Headlines")}</div>
              <div className="divide-y divide-white/[0.06]">
                {(c.headlines || []).map((h, i) => <Linha key={i} txt={h} limite={lim.headlines} />)}
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wide text-g-muted">{t("Descriptions")}</div>
              <div className="divide-y divide-white/[0.06]">
                {(c.descriptions || []).map((h, i) => <Linha key={i} txt={h} limite={lim.descriptions} />)}
              </div>
            </div>
          )}
          {/* O QUE ESTOUROU VAI À VISTA. O motor devolve isso de propósito: quem publica precisa
              saber ANTES, não depois da reprovação da plataforma. */}
          {(r.excedeu_limite || []).length ? (
            <div className="mt-3 rounded-lg px-3 py-2 text-[11px]" style={{ background: "#E5484D14", border: "1px solid #E5484D44", color: "#E5484D" }}>
              {t("over the platform's hard limit")}: {r.excedeu_limite.join(" · ")} ({t("characters")})
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}


/* ── O VIGIA (só a conta da equipe Guileo) ────────────────────────────────────
   `alertas` é varredura ENTRE clientes e o endpoint recusa quem não é dono (401). A tela não
   tem como saber quem é dono antes de perguntar — então o botão existe para todos e a recusa
   vira uma frase honesta, em vez de um erro cru que parece defeito. */
function Vigia({ email, dataKey }) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [r, setR] = useState(null);

  const varrer = async () => {
    setBusy(true); setErro(""); setR(null);
    const res = await post({ email, key: dataKey, action: "alertas", dias: 14 });
    setBusy(false);
    if (res?.error === "unauthorized") { setErro(t("This scan is only available to the Guileo team account.")); return; }
    if (!res?.ok || !Array.isArray(res.queimando) || !Array.isArray(res.oportunidades)) {
      setErro(res?.error || t("I couldn't read your ads")); return;
    }
    setR(res);
  };

  const bloco = (titulo, itens, cor) => (
    itens.length ? (
      <div className="mt-3">
        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: cor }}>{titulo}</div>
        <div className="mt-1 divide-y divide-white/[0.06]">
          {itens.map((a, i) => (
            <div key={i} className="py-2">
              <div className="text-[13px] font-bold text-g-word">
                {a.campanha} <span className="font-normal text-g-muted capitalize">· {a.canal}</span>
                {a.cliente ? <span className="font-normal text-g-muted"> · {a.cliente}</span> : null}
              </div>
              <div className="text-[11px] text-g-muted">
                {t("spent")} {cashCents(a.gasto_cents)} · {t("brought")} {Number(a.agendamentos || 0)} {t("Customers").toLowerCase()}
                {Number(a.receita_cents) ? ` (${cashCents(a.receita_cents)})` : ""}
              </div>
              {a.o_que_fazer ? <div className="text-[12px] font-bold mt-0.5" style={{ color: cor }}>{a.o_que_fazer}</div> : null}
            </div>
          ))}
        </div>
      </div>
    ) : null
  );

  return (
    <Card>
      <div className="text-sm font-bold text-g-word">{t("Watchman · Guileo team")}</div>
      <p className="mt-0.5 text-[11px] text-g-muted">
        {t("Scans every client's campaigns and lists what needs a decision today. Only the Guileo team account can run it — it's a sweep across clients.")}
      </p>
      <div className="mt-3">
        <button onClick={varrer} disabled={busy} className={btn}>{busy ? t("Scanning…") : t("Scan campaigns")}</button>
      </div>
      {erro ? <div className="mt-2"><Erro msg={erro} /></div> : null}
      {r ? (
        <div className="mt-2">
          <div className="text-[11px] text-g-muted">{r.precisam_de_acao} {t("need a decision")}</div>
          {bloco(t("Burning money"), r.queimando, "#E5484D")}
          {bloco(t("Opportunities"), r.oportunidades, "#3E9468")}
          {r.precisam_de_acao === 0 ? (
            <div className="mt-2 text-[12px] text-g-muted">{t("Nothing needs a decision right now — and silence when there's nothing is part of the product.")}</div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}


// ── O QUE A TELA MOSTRA NUMA DEMONSTRAÇÃO ────────────────────────────────────
// Dilema real: sem sessão a aba ficava VAZIA — honesto, mas péssimo para vender,
// e é justamente a tela que um vendedor abre numa demonstração. O oposto (dado
// falso sem aviso) foi o defeito que esta tela veio consertar.
//
// A saída é a terceira: exemplo COM SELO. Cada número carrega a palavra EXEMPLO
// ao lado, e o cartão de topo diz em letra grande que nada ali é do cliente. O
// vendedor mostra o produto funcionando; ninguém confunde com resultado real.
// A régua: dado inventado só é aceitável quando é IMPOSSÍVEL confundir com real.
const EXEMPLO = {
  resumo: {
    gasto: "$1,240.00", receita_atribuida: "$5,860.00", leads: 41, retorno_geral: 4.73,
    leitura: "para cada $1 investido, voltaram $4.73 em serviços agendados",
  },
  campanhas: [
    { canal: "google", campanha: "corte-e-barba · Astoria", gasto: "$620.00", receita: "$3,420.00",
      leads: 22, agendamentos: 19, custo_por_lead: "$28.18", custo_por_cliente: "$32.63",
      retorno: 5.52, porque_sem_retorno: null, veredito: "escalar" },
    { canal: "meta", campanha: "coloração · verão", gasto: "$380.00", receita: "$2,440.00",
      leads: 14, agendamentos: 12, custo_por_lead: "$27.14", custo_por_cliente: "$31.67",
      retorno: 6.42, porque_sem_retorno: null, veredito: "escalar" },
    { canal: "google", campanha: "institucional", gasto: "$240.00", receita: "$0.00",
      leads: 5, agendamentos: 0, custo_por_lead: "$48.00", custo_por_cliente: null,
      retorno: 0, porque_sem_retorno: "trouxe lead mas ainda nao gerou agendamento",
      veredito: "sem_lead_apesar_do_trafego" },
  ],
};

function Ads({ email = "", dataKey = "" }) {
  const [d, setD] = useState(null);      // null = carregando
  const [erro, setErro] = useState("");

  const [recarga, setRecarga] = useState(0);
  useEffect(() => {
    let vivo = true;
    // SEM CREDENCIAL NÃO INVENTAMOS TELA. Antes, a ausência de sessão caía em dados de
    // demonstração — que é exatamente como a tela falsa nasceu. Agora diz o que é.
    if (!email || !dataKey) { setD({ ...EXEMPLO, ehExemplo: true }); return; }
    post({ email, key: dataKey, action: "roi", dias: 30 }).then((r) => {
      if (!vivo) return;
      if (!r || r.ok === false) { setErro(r?.error || t("I couldn't read your ads")); setD({}); return; }
      setD(r);
    });
    return () => { vivo = false; };
  }, [email, dataKey, recarga]);

  if (d === null) return <div className="text-sm text-g-muted">{t("Loading…")}</div>;


  const campanhas = d.campanhas || [];
  const resumo = d.resumo || {};
  const clientesNovos = campanhas.reduce((s, c) => s + Number(c.agendamentos || 0), 0);

  // O CUSTO POR CLIENTE do conjunto só existe quando houve gasto E cliente. Uma média de
  // médias mentiria aqui; então ou vem da conta real, ou não vem.
  const gastoNum = Number((resumo.gasto || "$0").replace(/[^0-9.]/g, "")) || 0;
  const custoPorCliente = gastoNum > 0 && clientesNovos > 0 ? `$${(gastoNum / clientesNovos).toFixed(2)}` : "—";

  return (
    <div className="space-y-4 stagger">
      {/* O SELO. Primeira coisa da tela, impossível de não ver — é o que separa
          "demonstração do produto" de "dado inventado passando por real". */}
      {d.ehExemplo ? (
        <div className="rounded-xl border border-g-gold/40 bg-g-gold/10 px-4 py-3">
          <div className="text-[11px] font-black uppercase tracking-widest text-g-gold">{t("Example · not your data")}</div>
          <div className="mt-0.5 text-sm text-g-word">
            {t("These numbers show how the screen looks once your campaigns are running. Connect your account in Settings to see the real return.")}
          </div>
        </div>
      ) : null}

      {/* O RESULTADO PRIMEIRO. O cliente compra cliente novo e faturamento — não cliques. */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Numerao rotulo={t("New customers")} valor={clientesNovos} sub={t("came from ads and booked")} cor="#EFE7DC" exemplo={d.ehExemplo} />
        <Numerao rotulo={t("Booked revenue")} valor={resumo.receita_atribuida || "—"} sub={t("services booked by these people")} cor="#3E9468" exemplo={d.ehExemplo} />
        <Numerao rotulo={t("Cost per customer")} valor={custoPorCliente} sub={gastoNum > 0 ? `${t("invested")}: ${resumo.gasto}` : t("no spend logged")} cor="#C8A24A" exemplo={d.ehExemplo} />
      </div>

      {/* A LEITURA EM UMA FRASE — é o que o dono do negócio lê antes de qualquer tabela. */}
      {resumo.leitura ? (
        <Card tone={resumo.retorno_geral >= 1 ? "green" : undefined}>
          <div className="text-[11px] uppercase tracking-wide text-g-muted">{t("Last 30 days")}</div>
          <div className="mt-1 text-sm text-g-word">{resumo.leitura}</div>
        </Card>
      ) : null}

      {erro ? <Card><Erro msg={erro} /></Card> : null}

      {/* A DECISÃO DE ORÇAMENTO — logo abaixo do resultado, porque é o que se faz COM ele. */}
      {d.ehExemplo ? null : <Reinvestir email={email} dataKey={dataKey} recarga={recarga} />}

      {d.ehExemplo ? null : <LancarGasto email={email} dataKey={dataKey} aoSalvar={() => setRecarga((n) => n + 1)} />}
      {d.ehExemplo ? null : <Importar email={email} dataKey={dataKey} aoImportar={() => setRecarga((n) => n + 1)} />}

      {campanhas.length === 0 ? (
        <Card>
          <div className="text-sm font-bold text-g-word">{t("No campaign measured yet")}</div>
          <p className="mt-1 text-sm text-g-muted">
            {t("As soon as the first campaign runs, every person it brings shows up here — with what was spent, how many booked and how much that turned into booked services.")}
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">
            {t("By campaign")}
          </div>
          <div className="divide-y divide-white/[0.06]">
            {campanhas.map((c, i) => {
              const v = VEREDITO[c.veredito] || VEREDITO.sem_dados;
              return (
                <div key={`${c.canal}-${c.campanha}-${i}`} className="px-5 py-3.5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-g-word truncate">{c.campanha}</div>
                      <div className="text-[11px] text-g-muted capitalize">{c.canal}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-g-muted">{t("Customers")}</div>
                      <div className="text-sm font-bold text-g-word num">{c.agendamentos}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-g-muted">{t("Revenue")}</div>
                      <div className="text-sm font-bold num" style={{ color: "#3E9468" }}>{c.receita || "—"}</div>
                    </div>
                    <div className="text-right w-24">
                      <div className="text-[11px] text-g-muted">{t("Every $1 became")}</div>
                      {/* NULL VIRA TRAÇO, NUNCA ZERO. O motivo aparece logo abaixo. */}
                      <div className="text-sm font-extrabold num text-g-word">
                        {c.retorno == null ? "—" : `$${Number(c.retorno).toFixed(2)}`}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 text-[11px]" style={{ color: v.cor }}>
                    {t(v.txt)}
                    {c.porque_sem_retorno ? <span className="text-g-muted"> · {c.porque_sem_retorno}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* A PEÇA do próximo anúncio, na mesma tela do resultado do anterior. */}
      {d.ehExemplo ? null : <Criativo email={email} dataKey={dataKey} />}
      {d.ehExemplo ? null : <Vigia email={email} dataKey={dataKey} />}

      {/* HONESTIDADE DE OPERAÇÃO: quem cria e ajusta as campanhas é o time, não a IA.
          Dizer isso na própria tela evita a promessa que o produto não cumpre hoje. */}
      <Card>
        <div className="text-sm font-bold text-g-word">{t("Want more customers?")}</div>
        <p className="mt-1 text-sm text-g-muted">
          {t("The Guileo team creates and adjusts the campaigns; Gui answers whoever arrives, books and charges. What you see above is the real result — from what was spent to what was booked.")}
        </p>
      </Card>
    </div>
  );
}

export default Ads;
