# Diário de Obra: app Android

App para preencher o Diário de Obra no celular:
cadastro da obra, escolha da obra, diário com clima, efetivo, segurança, equipamentos, serviços, observações e no mínimo 3 fotos com legenda.
Os dados ficam na nuvem (Firebase do Google). O app funciona **sem internet** e envia tudo sozinho quando o sinal volta.
Cada diário pode ser enviado em PDF ou em texto pelo botão Compartilhar do Android (WhatsApp, Drive, e-mail).

---

## Parte 1: criar a nuvem no Firebase (gratuito, cerca de 10 minutos)

1. Entre em **https://console.firebase.google.com** com sua conta Google.
2. **Criar um projeto**, com nome `diario-de-obra`, por exemplo. O Google Analytics pode ficar desligado.
3. **Banco de dados**: menu *Criação › Firestore Database › Criar banco de dados*.
   - Local: `southamerica-east1 (São Paulo)`.
   - Comece no **modo de produção**.
   - Abra a aba **Regras**, apague o que estiver lá, cole o conteúdo do arquivo `firestore.rules` deste projeto e toque em **Publicar**.
4. **Logins**: menu *Criação › Authentication › Vamos começar › E-mail/senha › Ativar › Salvar*.
   - Na aba **Usuários › Adicionar usuário**, crie o seu login e um para cada pessoa que vai preencher os diários (o mestre, por exemplo).
   - O app não permite que alguém crie a própria conta. Só entra quem você cadastrar aqui.
5. **Configuração para o app**: clique na engrenagem *› Configurações do projeto › Seus apps* e depois no ícone **`</>` (Web)*.
   - Apelido: `diario`. Não marque Hosting. Clique em **Registrar app**.
   - Aparece um bloco `const firebaseConfig = { apiKey: ..., ... }`. Guarde esse bloco: ele é colado no app na primeira vez.
   - Se quiser que ninguém precise colar nada, preencha esses valores no arquivo `src/firebase-config.js` antes da Parte 2.

> Plano gratuito (Spark): 1 GB de dados. Cada foto ocupa cerca de 200 a 400 KB, então o espaço dá para alguns milhares de fotos. As fotos ficam no próprio banco Firestore, então não é preciso ativar cobrança.

## Parte 2: gerar o APK no GitHub (gratuito)

1. Crie uma conta em **https://github.com**, se ainda não tiver.
2. **New repository**, com nome `diario-de-obra`, marcado como **Private** (importante: o projeto contém a chave de assinatura do app).
3. Na página do repositório: *uploading an existing file*. Arraste **todo o conteúdo** desta pasta, incluindo a pasta `.github`, e clique em **Commit changes**.
   - Se a pasta `.github` não for enviada pelo navegador, crie o arquivo manualmente: *Add file › Create new file*, com nome `.github/workflows/gerar-apk.yml`, e cole o conteúdo do arquivo de mesmo nome.
4. Abra a aba **Actions**. O processo **Gerar APK** começa sozinho e leva cerca de 5 a 8 minutos.
5. Quando ficar verde, abra a aba **Releases** (na coluna da direita da página inicial do repositório) e baixe `DiarioDeObra.apk`.

Toda vez que um arquivo do repositório for alterado, sai um APK novo, que se instala por cima do anterior sem perder nada.

## Parte 3: instalar no celular

1. No celular Android, abra o link da Release e baixe `DiarioDeObra.apk`. Outra opção é mandar o arquivo para você mesmo pelo WhatsApp.
2. Toque no arquivo. O Android pede para **permitir instalar apps desta fonte**: permita.
3. Abra **Diário de Obra**:
   - Cole o bloco `firebaseConfig` (só na primeira vez em cada celular).
   - Entre com o e-mail e a senha criados no Firebase.
   - Cadastre a obra, e o app está pronto para usar.

## Como o app funciona

- **Primeiro uso**: abre direto no cadastro da obra (nome, endereço, construtora, mestre, engenheiro, empreiteiras e equipamentos habituais).
- **Menu**: lista as obras. Ao tocar numa obra, aparecem os diários dela, e **Novo diário** abre o dia de hoje já preenchido com os dados da obra.
- **Fotos**: **Tirar foto** abre a câmera. **Da galeria** escolhe fotos já tiradas. Cada foto precisa de legenda.
  O botão **Concluir diário** só funciona com 3 fotos legendadas, clima, segurança e serviços preenchidos. Sem isso, use **Salvar rascunho**.
- **Faixa de status**: verde quer dizer *Sincronizado na nuvem*, laranja *Enviando*, cinza *Sem internet* (os dados ficam guardados no celular).
- **PDF**: gera o diário no formato do formulário de papel, com uma página de fotos, e abre o Compartilhar (Drive, WhatsApp, e-mail).

## Para quem for mexer no código

```
npm install
npm run build          # gera a pasta www/
npx cap sync android   # copia para o projeto Android
cd android && ./gradlew assembleRelease
```
Código do app: `src/app.js`. Visual: `src/style.css`. Feito com Capacitor 7, Firebase 11 e jsPDF.

---

## Novidades: andamento da obra, Google Drive e programa para Windows

### A) Etapas e andamento físico (no celular)

1. Abra a obra e toque em **Editar dados da obra**.
2. Preencha **Contratante** (aparece na capa do relatório).
3. Em **Etapas da obra**, toque em **Adicionar etapa** para cada parte do serviço. Exemplo:

   | Etapa | Peso % | Início previsto | Fim previsto |
   |---|---|---|---|
   | Rampa Bloco 1 | 10 | 01/12 | 12/12 |
   | … Bloco 2 a 7 | 10 cada | … | … |
   | Nova rampa da piscina | 30 | 05/01 | 30/01 |

   Os pesos devem somar 100%. Se não somarem, o app ajusta proporcionalmente e avisa.
4. Em cada diário aparece a seção **Andamento físico**: arraste a barra ou digite o **% concluído acumulado** de cada etapa. O diário novo já vem com os valores do anterior.

### B) Cópia automática no Google Drive (uma vez só, uns 5 minutos)

1. No celular: tela inicial › ícone de **pessoa** (Conta) › **Google Drive**. Toque em **Copiar código**.
   Mande esse código para você pelo WhatsApp para usar no computador.
2. No computador, entre em **https://script.google.com** com a conta Google onde os diários devem ficar e clique em **Novo projeto**.
3. Apague o que estiver na tela e cole todo o conteúdo do arquivo `apps-script/Codigo.gs` (está neste projeto).
4. Na linha `const TOKEN = "COLE_AQUI_O_CODIGO_DO_APP";` troque o texto entre aspas pelo código copiado no passo 1. Clique no disquete (**Salvar**).
5. Clique em **Implantar › Nova implantação**. Na engrenagem, escolha **App da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   Clique em **Implantar** e depois em **Autorizar acesso**. Escolha sua conta. Se aparecer "O Google não verificou este app", clique em **Avançado › Acessar (não seguro)** – o app é seu.
6. Copie o **URL do app da Web** (termina em `/exec`) e mande para o celular.
7. No celular, cole o endereço no campo **2. Endereço do script** e toque em **Salvar**. O app testa a ligação e cria a pasta **Meu Drive › Diário de Obra**.

A partir daí, cada diário **concluído** vira um PDF em `Diário de Obra / <nome da obra>`. Sem internet, ele fica na fila e é enviado depois. O diário mostra "Salvo no Google Drive".

### C) Programa "Relatório de Obra" para Windows

1. Depois de enviar os arquivos ao GitHub, a aba **Actions** roda também **Gerar programa Windows** (uns 5 a 10 minutos).
2. Em **Releases**, baixe **RelatorioDeObra-Setup.exe** e execute.
   O Windows pode mostrar "O Windows protegeu o computador": clique em **Mais informações › Executar assim mesmo** (o programa não tem assinatura digital paga).
3. Na primeira vez, cole o mesmo bloco **firebaseConfig** do celular e entre com seu e-mail e senha.
4. Escolha a obra, o período (mês atual, mês anterior, obra toda ou datas) e clique em **Gerar relatório em PDF**.

O relatório traz: capa com resumo (% realizado x previsto e desvio), curva de avanço, andamento por etapa, efetivo diário, tempo, segurança, serviços de cada dia, fotos com legenda e assinatura do responsável técnico.
