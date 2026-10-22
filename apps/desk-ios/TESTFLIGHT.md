# Guileo Desk no TestFlight: o passo a passo do Luis

O app já está pronto e compila no simulador (prova em `docs/sim-desk.png`). O que falta é a parte da Apple, e essa
só você pode fazer: é a sua conta, o seu cartão e a sua assinatura. Nada aqui pede senha para ninguém além da Apple.

**Nome:** Guileo Desk · **Slogan:** The team behind your business · **Bundle ID:** `com.guileoai.desk`

## O que é este app (em 3 linhas)

- Uma "casca" nativa (Capacitor 8) que abre o Desk de verdade: `https://guileoai.com/portal?tab=desk&app=desk&src=ios-app`,
  o mesmo endereço do app instalável (PWA). Mudou o site, mudou o app. Não precisa mandar versão nova para cada ajuste.
- Ícone e tela de abertura: o calendário do Desk no cimento `#161512` (redesenhado em 1024 px por `scripts/make_icons.py`).
- Sem internet, mostra uma tela própria "Sem conexão / Tentar de novo" (EN/PT), não uma página de erro.
- A barra de status (hora, bateria) fica numa faixa de cimento; o site começa abaixo dela e não fica escondido
  atrás do entalhe do iPhone (`contentInset: always`).

---

## Passo 1: conta Apple Developer (US$ 99 por ano), uma vez só

1. No iPhone ou no Mac, entre em **developer.apple.com/programs/enroll** com o seu Apple ID (ative a verificação em
   duas etapas se pedir).
2. Escolha **como empresa (Organization)**, não como pessoa física. Assim o app aparece na loja como da empresa, e não
   com o seu nome.
   - Precisa do **D-U-N-S Number** da empresa (grátis; a própria página da Apple tem o link para pedir; leva de 1 a 5
     dias úteis se ainda não tiver).
   - O nome legal da empresa tem que bater com o do D-U-N-S.
3. Pague os US$ 99. A Apple pode ligar para confirmar. A aprovação leva de 1 a 2 dias.

> Se tiver pressa: dá para entrar como **pessoa física** hoje e trocar para empresa depois (a Apple migra a conta),
> mas aí o app aparece "por Luis Teles" até a troca.

**Pronto quando:** você entra em **appstoreconnect.apple.com** e vê "Apps".

## Passo 2: Xcode no Mac, uma vez só

1. Instale/atualize o **Xcode** pela App Store do Mac (este Mac já tem o Xcode 26.6).
2. Xcode → **Settings → Accounts → +** → Apple ID → entre com a conta do Passo 1.
3. Selecione o seu time (o nome da empresa) e clique em **Manage Certificates → + → Apple Distribution**.

## Passo 3: criar o app no App Store Connect, uma vez só

1. **appstoreconnect.apple.com → Apps → + → New App**
   - Platforms: **iOS**
   - Name: **Guileo Desk**
   - Primary language: **English (U.S.)**
   - Bundle ID: escolha **com.guileoai.desk** (se não aparecer na lista, crie antes em
     developer.apple.com → Certificates, IDs & Profiles → Identifiers → + → App IDs → App → Bundle ID explícito
     `com.guileoai.desk`, sem marcar nenhuma capability)
   - SKU: `guileo-desk-ios`
   - User access: Full access
2. Os textos da loja (EN + PT), palavras-chave, categoria e privacidade estão prontos em **STORE_LISTING.md**.
   Para o TestFlight interno você ainda não precisa deles; para os testadores externos e para a loja, sim.

## Passo 4: gerar e enviar o app (a cada versão nova da casca)

No Terminal, dentro desta pasta:

```bash
cd apps/desk-ios && npm install && npx cap sync ios && npx cap open ios
```

O Xcode abre o projeto. Então:

1. Na barra lateral, clique em **App** (o ícone azul) → aba **Signing & Capabilities**.
2. Marque **Automatically manage signing** e em **Team** escolha a sua empresa. O Bundle Identifier já vem
   `com.guileoai.desk`.
3. No topo, onde aparece o simulador, escolha **Any iOS Device (arm64)**.
4. Menu **Product → Archive**. Leva 1 a 3 minutos.
5. Abre a janela **Organizer** com o arquivo novo → **Distribute App** → **App Store Connect** → **Upload** →
   deixe as opções como vêm → **Upload**.
6. Em 10 a 30 minutos o build aparece em App Store Connect → seu app → **TestFlight**. Chega também um e-mail
   "has completed processing".

> Criptografia: o app já declara que não usa criptografia própria (`ITSAppUsesNonExemptEncryption = NO`), então a
> Apple não vai perguntar nada sobre exportação.

**Versão nova da casca** (só quando mudar algo nativo: ícone, nome, permissão): no Xcode, App → **General** →
aumente **Build** (1 → 2 → 3…). O mesmo número de build não sobe duas vezes. Mudanças no site NÃO precisam disso.

## Passo 5: testadores do TestFlight

**Internos (até 100 pessoas, sem revisão da Apple, na hora):**
1. App Store Connect → **Users and Access → +** → convide a pessoa com o papel **Developer** ou **Marketing**
   (ela precisa aceitar o convite por e-mail).
2. Seu app → **TestFlight → Internal Testing → +** → crie o grupo "Equipe Guileo" → adicione as pessoas → marque o build.
3. Cada pessoa instala o app **TestFlight** da App Store, abre o convite no iPhone, e toca em **Install**.

**Externos (até 10.000, por e-mail ou link público, ex.: as recepcionistas do Natura):**
1. **TestFlight → External Testing → +** → grupo "Clientes piloto" → adicione o build.
2. A primeira vez passa por uma revisão rápida da Apple (geralmente menos de 1 dia). Ela pede:
   - "What to Test": *Sign in with your Guileo account and use the calendar and checkout.*
   - **Uma conta de demonstração** (e-mail + senha de um negócio de TESTE com agendamentos de exemplo, nunca a conta
     de um cliente real) para o revisor entrar.
3. Depois de aprovado, ative **Public Link** e mande o link para quem você quiser.

## Passo 6: App Store (depois do TestFlight)

1. Preencha a página da versão com os textos de **STORE_LISTING.md** (EN e, em "Localizations", PT-BR).
2. **Screenshots**: iPhone 6,9" (1320 × 2868) e iPad 13" (2064 × 2752), de 3 a 10 cada. Tire do simulador
   (Xcode → Open Developer Tool → Simulator → iPhone 17 Pro Max / iPad Pro 13" → Cmd+S) logado na conta de
   demonstração.
3. **App Privacy**: responda como está na tabela de STORE_LISTING.md.
4. **App Review Information**: conta de demonstração + a nota pronta em STORE_LISTING.md.
5. **Submit for Review**. Leva de 1 a 3 dias.

---

## O que pode travar a revisão (e o que já está resolvido)

| Risco | Situação |
|---|---|
| "App é só um site" (regra 4.2) | O app abre direto na agenda logada, com ícone, abertura e tela offline próprios. Para reforçar antes da loja: notificação de agendamento novo (push) é o próximo nativo que mais ajuda. |
| Venda dentro do app (regra 3.1.1) | O app abre o Desk, não a página de planos `/desk` (que tem "Assinar"). Se alguma tela do portal oferecer upgrade de plano pago, ela precisa sumir no app: o site recebe `GuileoDeskApp` no user agent para esconder isso. **Pendente no site.** |
| Rastreamento sem pedir permissão (5.1.2) | Os pixels do Meta/Google só carregam com consentimento. Para responder "No tracking" com segurança: não carregar pixels quando o user agent tiver `GuileoDeskApp`. **Pendente no site.** |
| Microfone | Já declarado ("only when you talk to the AI assistant"). |
| Apagar conta (5.1.1(v)) | **Atenção:** a tela de entrada do portal abre em "Create your account". App que deixa criar conta TEM que deixar apagar a conta dentro do app. Duas saídas no site: (a) dentro do app, abrir direto em "Sign in" e esconder "Create account"; ou (b) ter "Apagar minha conta" nas Configurações. **Pendente no site; resolve antes da loja** (o TestFlight interno passa sem isso). |
| Botão "Install the Desk app" | Aparece também dentro do app nativo (visto no simulador). Esconder quando o user agent tiver `GuileoDeskApp`. **Pendente no site.** |
| Revisor sem conta | O botão "Enter demo (sample data)" da tela de entrada já abre a agenda de exemplo. Mesmo assim, mande uma conta de teste (o revisor costuma exigir). |
| Baixar planilhas (Exportar) | Dentro do app o download de arquivo do navegador não funciona igual ao Safari. **Testar no TestFlight**; se falhar, o caminho é o plugin de compartilhar do Capacitor. |

## Para quem mexe no código

```bash
cd apps/desk-ios
npm install                 # Capacitor 8.5.3 (core, ios, cli)
python3 scripts/make_icons.py   # redesenha ícone 1024 + splash 2732 dentro do projeto iOS
npx cap sync ios            # copia config e www/ para ios/
npx cap run ios             # roda no simulador
```

- Endereço que o app abre: `capacitor.config.json` → `server.url`. Domínios que ficam dentro do app:
  `allowNavigation` (guileoai.com). Qualquer outro (WhatsApp, Stripe, Google) abre no Safari.
- O app adiciona `GuileoDeskApp/1.0` ao user agent: é por ele que o site sabe que está dentro do app.
- `ios/` é versionado (é onde ficam Info.plist, ícone e assinatura); `ios/App/App/public` e `capacitor.config.json`
  dentro de `ios/` são gerados pelo `cap sync` e ficam fora do git.
