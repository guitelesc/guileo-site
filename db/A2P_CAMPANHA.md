# A2P 10DLC — desbloquear o SMS nos EUA

**Diagnóstico feito em 2026-08-04.** O A2P nunca esteve "por fazer": ele **reprovou na
última etapa**, em 16/06/2026, e ficou assim desde então. Toda falha de SMS (erro 30034)
vinha daqui.

| Etapa | Status |
|---|---|
| 1. Perfil do cliente (TRANSPOINT) | ✅ Twilio Approved |
| 2. Marca (Brand `BNd3e2effe975ce6e1917c26782991fcd5`) | ✅ Registrada |
| 3. Campanha (`CMf5c44e0b95135b7665d534e802298b03`) | 🔴 **Rejected** |

**Motivo oficial, escrito no console:**
> *"The campaign submission has been reviewed and it was rejected because of provided
> **Opt-in information**."*

**Causa concreta:** quatro campos obrigatórios estavam **em branco** — Privacy Policy URL,
Terms and Conditions URL, Opt-in Message e Opt-in Keywords. A *descrição* do opt-in estava
bem escrita, mas ela **afirma** que o site tem checkbox de consentimento, e o revisor abre o
site pra conferir. Sem os campos, não há como ele validar a afirmação.

⚠️ **O botão "Edit Campaign" NÃO resolve.** Ele só edita descrição e mensagens de exemplo —
os campos de opt-in não aparecem lá. É preciso **registrar uma campanha nova**
(Messaging → Regulatory Compliance → Campaigns → **Register new Campaign**), reusando a marca
TRANSPOINT que já está aprovada. Sem taxa de marca; só a de campanha.

---

## ✅ Já feito do nosso lado (2026-08-04)

O site foi ajustado ANTES de resubmeter, porque o revisor vai visitá-lo:

- `src/components/ConsentText.jsx` — fonte ÚNICA do texto de consentimento (antes estava
  copiado em **4** formulários; um deles, o PulseSection, tinha texto diferente e desatualizado).
- Texto agora cobre os 6 requisitos da operadora — faltavam **frequência** e **link da
  política de privacidade**:
  > *"I agree to be contacted by Gui (Guileo) at the number provided, by call and text.
  > Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out, HELP for help.
  > Privacy Policy."*
- Provado em produção: 3 formulários na home, **todos** com frequência e **todos** com link
  para `/privacy`, texto idêntico entre eles.
- Checkbox continua **obrigatório e desmarcado** por padrão (opt-in afirmativo), e o link da
  privacidade usa `stopPropagation` — clicar nele não marca o consentimento sem querer.

⏳ **Pendente antes de resubmeter:** rodar `db/LIMPAR_live_feed.sql`. A página pública
`/live` está tomada por lixo de teste ("Dhshsshsh", "Teste Self" ×47) e o revisor vai vê-la.

---

## O que preencher na campanha nova

| Campo | Valor |
|---|---|
| **Brand** | TRANSPOINT (a que já está aprovada — não registrar outra) |
| **Use case** | Low Volume Mixed |
| **Privacy Policy URL** | `https://guileoai.com/privacy` |
| **Terms and Conditions URL** | `https://guileoai.com/terms` |
| **Opt-in Keywords** | `START`, `YES`, `UNSTOP` |

**Opt-in Message** (a confirmação que o usuário recebe ao aceitar):
```
Guileo: you're subscribed. Msg & data rates may apply. Msg frequency varies.
Reply HELP for help, STOP to cancel.
```

**Campaign description** — a versão anterior não dizia que TRANSPOINT opera COMO Guileo, e
o revisor via uma campanha em nome de uma empresa que não era a marca registrada:
```
TRANSPOINT, operating as Guileo (guileoai.com), sends transactional and customer-care text
messages to people who explicitly opted in through the consent checkbox on our website forms
at guileoai.com, or by providing their number during a phone call and agreeing to be
contacted. Messages include appointment reminders and confirmations, missed-call text-backs,
lead follow-ups, review requests, and re-engagement. Every message identifies the sender and
includes opt-out instructions. We do not purchase or upload third-party lists.
```

**How do end-users consent** — precisa apontar ONDE o revisor confere:
```
End users opt in on our website forms at https://guileoai.com by entering their phone number
and checking a consent checkbox that is unchecked by default and required to submit. The
checkbox reads: "I agree to be contacted by Gui (Guileo) at the number provided, by call and
text. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out, HELP for help.
Privacy Policy." Consent text and timestamp are logged with the lead. Users also opt in
verbally during a phone call by providing their number and agreeing to be contacted. We do not
purchase or upload third-party lists.
```

**Mensagens de exemplo** — trocar `{name}`/`{business}` por exemplos REAIS. Operadora
costuma reprovar amostra com variável não preenchida, porque não dá pra avaliar o conteúdo:
```
1) Hi Maria, this is Gui from Natura Spa. Reminder: your appointment is tomorrow at 2:00 PM.
   Reply 1 to confirm, 2 to reschedule. Reply STOP to opt out.
2) Hi, this is Gui from Natura Spa - sorry we missed your call! How can we help? Reply here
   or call us back anytime. Reply STOP to opt out.
3) Hi Carlos, this is Gui from Natura Spa. Thanks for your interest! When's a good time for a
   quick call to get you set up? Reply STOP to opt out.
4) Hi Maria, Gui here from Natura Spa. Hope we took great care of you! Mind leaving a quick
   review? https://guileoai.com/r/abc Reply STOP to opt out.
```

---

## Depois da aprovação

1. Ligar os números ao Messaging Service **Guileo** (`MGbf483d9d758294b063356ee63a0f355e`) —
   o `+1 986 444 3334` já está nele.
2. Provar com `POST /api/sms-check` (portão de admin) — devolve o erro CRU da Twilio + a
   tradução dos códigos comuns. Construído em 2026-08-03 justamente porque a causa da falha
   era invisível; foi ele que teria mostrado o 30034 em 5 segundos.

Ligar isto acende de uma vez: missed-call text-back, lembretes de agendamento, speed-to-lead
por SMS, blitz de reativação e a demo de voz nos EUA.

---

## 🚨 2026-08-22 — a campanha de 04/08 REPROVOU TAMBÉM. Motivo novo.

Descoberto ao construir `/api/canais-prova` (a plataforma não tinha janela nenhuma para SMS e
WhatsApp — 18 dias de "em análise" que já era "reprovada"). Estado lido ao vivo na Twilio:

| Etapa | Status real |
|---|---|
| Marca A2P | ✅ APPROVED |
| Campanha | 🔴 **FAILED** |

**Motivo oficial — erro `30909`, campo `MESSAGE_FLOW`:**
> *"rejected due to issues verifying the Call to Action (CTA) provided for the campaign."*

Ou seja: **não é mais opt-in incompleto.** O texto de consentimento está certo (conferido ao vivo
em 22/08: inglês, desmarcado, obrigatório, com frequência e link de privacidade). O que falhou é
que o revisor **não consegue verificar** o CTA: declaramos "os formulários em guileoai.com" e ele
cai numa landing de ~15.000px e precisa caçar o opt-in.

### O que foi corrigido para a próxima submissão (feito e no ar em 22/08)

`https://guileoai.com/sms` — a página que existe só para isso. Ela já existia desde 07/08 (e a
campanha nunca foi recadastrada apontando para ela), mas só **descrevia** o opt-in com uma caixa
de amostra desabilitada. Agora tem o **formulário real** (o mesmo `<LeadForm/>` da home — uma
fonte, dois lugares, sem segundo caminho de captura), com o canal já em **Phone** (achar
"WhatsApp" pré-selecionado num programa de SMS é a incoerência que reprova) e o passo 1 do texto
reescrito para bater com o que o revisor vê na tela.

### Ao recadastrar — o campo que reprovou

No **Message Flow / "How do end-users consent"**, mandar o revisor direto para a prova:

```
End users opt in at https://guileoai.com/sms — a page dedicated to this program that shows the
program name, the message types, the frequency and cost disclosure, the STOP/HELP instructions,
and the actual sign-up form. On that form the user enters their name and phone number and must
tick a consent checkbox that is UNCHECKED by default and required to submit. The checkbox reads:
"I agree to be contacted by Gui (Guileo) at the number provided, by call and text. Msg & data
rates may apply. Msg frequency varies. Reply STOP to opt out, HELP for help. Privacy Policy."
The same form and the same checkbox appear at https://guileoai.com. Consent text and timestamp
are logged with the lead. Users also opt in verbally on a call by giving their number and
agreeing to be contacted. We do not purchase or upload third-party lists.
```

Resto dos campos: sem mudança (tabela acima). Reusar a marca TRANSPOINT, já aprovada.

### A janela, para isto nunca mais ficar 18 dias invisível

- Público, sem segredo: `POST /api/cron-tick?semaforo=1` → `semaforo.mensagens` traz a cor dos
  dois canais **e o motivo** (`campanha_sms`, `motivo_campanha`, `falta_whatsapp`).
- Detalhe completo: `GET /api/canais-prova?token=…` (token do cron OU senha do /admin).
- "Não medido" nunca sai verde — sai **cinza**, que é uma resposta diferente de "está bom".
