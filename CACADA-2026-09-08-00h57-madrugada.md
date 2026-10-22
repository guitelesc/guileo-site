# A CAÇADA — lista de ligação · segunda-feira à noite, 07→08/09/2026

> **Última lista: 28/08. Onze dias sem lista.** A tarefa das 7h não rodou porque só dispara
> com o app aberto. Nesse intervalo **nenhuma ligação saiu** e **nenhuma medição nova entrou**.

## O que mudou desde 28/08

| | 28/08 | agora | |
|---|---|---|---|
| Prospects com telefone e score medido | 34 | **188** | ✅ a ponte foi feita — o motor de medição encontrou a fila |
| Avaliações em `business_evaluations` | — | **306** | ⚠️ **todas de 19–20/08. Zero desde 29/08.** |
| `stage='abordado'` | 6 | **8** | ✅ +2: NY Medical Midtown e Manhattan Dental Studio |
| Linhas na `seller_prospects` | 365 | **347** | ⚠️ 18 sumiram — não sei por quê |

**A boa notícia é grande:** de 34 para 188 medidos. O buraco que eu apontei na segunda — o motor
que mede nunca ter sido apontado para a lista que se liga — **foi fechado**.

## 🚨 Dois defeitos que a atualização revelou

**1. O score não distingue — mais da metade da base está em cinco baldes.**

| score | quantos negócios | buraco (100−score) |
|---|---|---|
| 28 | **83** | 72 |
| 38 | **64** | 62 |
| 75 | 12 | 25 |
| 50 | 11 | 50 |
| 19 | 8 | 81 |

São **178 de 306** em cinco valores idênticos. Um número que cai no mesmo inteiro para 83
negócios diferentes não é medição — é o que sobra quando os aspectos não são lidos e o cálculo
cai num padrão. **Ranquear por ele empata 83 negócios no topo**, e a ordem entre eles vira
sorteio. A lista de hoje **exclui os cinco baldes** e usa só quem tem score individual.

**2. Alguma coisa roda de hora em hora e apaga medição.** Registros de `updated_at` às
23:02, 01:02, 02:02, 03:02 desta madrugada, um prospect por vez. Em pelo menos dois casos a
nota foi reescrita **sem o `Buraco medido`**: *Keratinnyc Hair Salon* e *Maison de MI Salon*
voltaram a ser linha crua de endereço. Eles estavam na lista de 28/08 e sumiram dela.
Isso precisa ser identificado antes de rodar mais qualquer coisa em cima da `note`.

---

## A lista de hoje — 15 de NYC, com medição individual

📞 Só pelo portão `/api/call`. 🚫 SMS não sai. 🗣️ Frases em inglês; vira o idioma se o dono for BR/hispânico.

### Bloco A — defeito específico e verificável (ligue nestes primeiro)

| # | Negócio | Telefone | Buraco | O defeito medido | Relatório |
|---|---|---|---|---|---|
| 1 | **Astoria Plumbers** 🔥 | 646-919-1074 | **84** | Site responde **404**. 4.7★/68 avaliações contra mediana 46 na quadra. **Site novo já pronto.** | [ver](https://guileoai.com/apresentacao/13fee6fa-5c5e-47bf-a571-fb81b281392a) |
| 2 | **Near me Plumbing Astoria** | 347-345-0243 | **74** | Telefone **não clicável**, sem formulário, sem agendamento. 📈 relatório aberto **32×** | [ver](https://guileoai.com/apresentacao/a3ec4200-6143-4fd1-b320-0e53ebae6695) |
| 3 | **Queens Plumber** | 929-481-3200 | **68** | Site é app Lovable **inacabado** — o Google lê 1.613 bytes, com o TODO do template publicado. **Site novo pronto.** | [ver](https://guileoai.com/apresentacao/bfadc079-3007-4f65-b2ee-c22b7716340a) |
| 4 | **Sideris Plumbing & Heating** | 718-626-1836 | **68** | 71 avaliações contra mediana 45 — ganha no Google, **sem formulário nenhum** no site. 📈 aberto 9× | [ver](https://guileoai.com/apresentacao/a76a9f94-4a71-4449-8d72-d9002347db80) |
| 5 | **Murray Hill Endodontics** | 212-736-3676 | **66** | Horário publicado 9h–17h → **160 horas por semana sem ninguém no telefone.** Endodontia é dor: quem liga fora não espera. | [ver](https://guileoai.com/apresentacao/8841f2d9-d006-46c9-a1fd-6dd4a40da2e7) |
| 6 | **Med Spa in NYC** | 212-794-9600 | **65** | **129 horas por semana** sem atendimento, pela ficha do Google | [ver](https://guileoai.com/apresentacao/df65706c-cbc1-4344-b781-d10af4eb9922) |
| 7 | **Lavan** | 929-658-9857 | **64** | 4.9★ e **28 avaliações** contra mediana de **329** nos 9 salões vizinhos | [ver](https://guileoai.com/apresentacao/134236a3-6a58-48dc-9e10-8e1ed9f5f708) |
| 8 | **Melani General Contractor** | 347-354-0131 | **60** | **Três telefones diferentes publicados** — página, dado estruturado e Google, todos distintos | [ver](https://guileoai.com/apresentacao/e9f3abca-95c0-4715-ae02-a1c094513b67) |
| 9 | **Rosetta Pizza** | 212-414-4800 | **59** | 137 avaliações contra mediana de **1.635** nos nove vizinhos. Telefone não clicável | [ver](https://guileoai.com/apresentacao/f89efa42-9b1f-4603-950d-72adb57f344f) |
| 10 | **National Dental Chelsea** | 917-779-8589 | **56** | 684 avaliações (mais que a rua) com **4.3** — e sem agendar sem ligar | [ver](https://guileoai.com/apresentacao/040c40c6-42b5-4fed-937f-30ea306ee222) |
| 11 | **My NYC Dentist** | 212-206-7215 | **54** | Tem agendamento online, mas **telefone não clicável e sem formulário** | [ver](https://guileoai.com/apresentacao/ef0e2047-099e-4c81-bc17-9f0858d9e27d) |
| 12 | **Magnifique Hair Salon** | 212-686-3600 | **54** | 357 avaliações contra mediana 205 — e **sem formulário, sem agendamento** | [ver](https://guileoai.com/apresentacao/af5f9256-0a31-4ffe-aeb4-dc3f2d735ef4) |

### Bloco B — medidos, mas o achado é genérico

Nestes o motor só encontrou *"não dá para agendar sem falar com alguém"* — o mesmo texto que
saiu para dezenas de outros. É verdadeiro, mas **não é um argumento sob medida**: não abra a
ligação com ele como se fosse um achado exclusivo daquele negócio.

| Negócio | Telefone | Buraco | Achado |
|---|---|---|---|
| Salon Kinya | 212-576-1117 | 67 | sem agendamento online · site num idioma só |
| Linea Hair Salon | 212-481-1570 | 66 | sem agendamento online · site num idioma só |
| Dazzle Beauty Salon | 212-922-3625 | 65 | sem agendamento online · site num idioma só |
| Luna Lucci Hair Salon | 917-261-2350 | 51 | contato principal é **formulário** — lead espera resposta |
| New Energy Spa Massage | 212-389-1161 | 51 | sem agendamento online · site num idioma só |

## Saíram da lista de 28/08
**NY Medical Midtown** e **Manhattan Dental Studio** viraram `abordado` — não ligue de novo
sem olhar o que já foi dito. **Keratinnyc** e **Maison de MI** perderam a medição na
reescrita horária (defeito 2 acima) e voltam quando forem remedidos.
**Penn Plaza Dental** (era o 3º) caiu para o balde empatado de 83 negócios — o score dele é 28,
o mesmo de outros 82. O sinal do Google continua real (**8 avaliações** contra mediana de 805),
mas o buraco 72 dele não distingue nada. Ligue por causa das 8 avaliações, não do número 72.

## Os números do run
- **347** prospects · **323** com telefone em `stage='new'` · **8** abordados na base inteira
- **188** com score medido (eram 34) · **178 de 306** avaliações caem em 5 valores idênticos
- **0** medições novas desde 20/08 · **0** ligações registradas desde a lista de 28/08
- **12** no bloco A · **5** no bloco B · nada foi discado, nada foi enviado, nenhum `stage` mudou
