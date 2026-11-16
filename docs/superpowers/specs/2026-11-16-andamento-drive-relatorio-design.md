# Andamento da obra, cópia no Google Drive e relatório para Windows

Data: 16/11/2026 · Responsável: Rosmandi L. Tosati (Freire Tosati Engenharia)

## Por quê

O contratante (síndico/condomínio) precisa **entender o andamento da obra**: quanto já foi feito, se está no prazo e o que comprova isso (fotos). Hoje o app registra o dia a dia, mas não mede avanço físico e não gera nada consolidado para o contratante. Os diários também devem ficar guardados no Google Drive do engenheiro, legíveis sem o app.

## Objetivos

1. Registrar no diário o **% concluído acumulado por etapa** da obra.
2. Salvar **automaticamente** o PDF de cada diário concluído no **Google Drive** (pasta por obra).
3. Programa **Windows** que gera um **relatório em PDF** de um período, com curva previsto x realizado, andamento por etapa, efetivo, clima, segurança, serviços e fotos.

## Fora do escopo

- Editar diários no Windows (só leitura e relatório).
- Login Google dentro do app (OAuth/Google Cloud).
- Assinatura digital do .exe (o Windows mostrará aviso do SmartScreen).
- Funcionamento offline do programa Windows.

## O que seria um fracasso mesmo funcionando

- Exigir do usuário configuração no Google Cloud Console ou passos técnicos além de colar um código.
- Relatório que precise de ajuste manual para ser entregue ao contratante.
- Perder diários já lançados ao atualizar o app.

## Restrições

- Usuário não programador; tudo que ele configura precisa ser "copiar e colar".
- APK e .exe gerados pelo GitHub Actions (único caminho disponível; o ambiente do Claude não acessa as ferramentas do Android/Windows).
- Firebase plano gratuito (Spark): sem Cloud Functions, sem Storage. Fotos continuam no Firestore.
- Diários e obras já existentes continuam válidos (campos novos opcionais).

## Abordagens consideradas (escolhidas pelo usuário: A, A, A)

| Decisão | A (escolhida) | B (descartada) |
|---|---|---|
| Andamento | Etapas com peso e datas previstas; % acumulado por etapa no diário → curva previsto x realizado | Só % por etapa, sem datas → mostra só realizado |
| Google Drive | Script do Google (Apps Script) na conta do usuário recebe o PDF e salva na pasta | Login Google no app (exige Google Cloud, SHA-1, OAuth) |
| Windows | Programa instalável (Electron) gerado no GitHub | Página no navegador |

## Desenho

### 1. Andamento (app Android)

- **Cadastro da obra** ganha a seção **Etapas**: nome, peso (%), início previsto, fim previsto. Pesos que não somam 100 são normalizados (aviso na tela mostrando a soma).
- **Diário** ganha a seção **Andamento**: para cada etapa, % concluído acumulado (0–100, passos de 5, com slider e número). Um diário novo vem preenchido com os valores do diário anterior mais recente da obra. Diminuir um % é permitido, com aviso.
- Exibe o **% geral da obra** (média ponderada) no diário e na lista de diários.
- Obra sem etapas cadastradas: o diário mostra um aviso com atalho para cadastrá-las, em vez da seção.
- Etapa excluída: valores antigos dela são ignorados nos cálculos.
- Cadastro da obra ganha também o campo **Contratante** (usado na capa do relatório). *(decisão do implementador)*
- Dados: `obra.etapas = [{id, nome, peso, inicio, fim}]`; `diario.andamento = {<etapaId>: pct}`.
- PDF do diário ganha a tabela de andamento (etapa, peso, %).

### 2. Google Drive (app Android)

- Documento `config/geral` no Firestore guarda `driveUrl` e `driveToken` (configurado uma vez no app, em **Conta › Google Drive**, vale para todos os celulares).
- Apps Script (código fornecido) publicado como "App da Web" na conta do usuário: recebe `{token, obra, data, arquivo, pdfBase64}`, confere o token, salva em `Meu Drive/Diário de Obra/<obra>/Diario_<obra>_<data>.pdf`, substituindo versão anterior do mesmo dia.
- Ao **concluir** (ou salvar de novo um diário concluído), o app gera o PDF e envia. Sem internet: entra numa fila local e é reenviado quando o app abrir com conexão. Sucesso grava `diario.driveEm` (data/hora) e o diário mostra "No Drive ✓".
- Envio via `CapacitorHttp` (sem CORS).

### 3. Programa Windows "Relatório de Obra"

- Electron + mesmo Firebase (login e-mail/senha; configuração colada uma vez, como no celular).
- Telas: login → escolher obra → período (mês atual, mês anterior, obra toda, personalizado) → opções (fotos: todas / até 4 por dia) → **Gerar relatório** → salvar PDF e abrir.
- Conteúdo do PDF (A4):
  1. Capa: obra, endereço, contratante, construtora, período, emissão, responsável técnico.
  2. Resumo: % realizado, % previsto, desvio, dias com diário, dias de chuva, efetivo médio/máximo, acidentes.
  3. Curva previsto x realizado (do início da obra ao fim do período).
  4. Andamento por etapa: barras previsto x realizado + tabela.
  5. Efetivo diário por empreiteira (barras empilhadas).
  6. Clima: dias de sol / instável / chuva (manhã e tarde).
  7. Segurança: acidentes (com descrição) e uso de EPI.
  8. Serviços executados e observações por dia.
  9. Registro fotográfico por data, 2 por linha, com legenda.
  10. Campo de assinatura do responsável técnico.
- Previsto em uma data = Σ peso × fração linear entre início e fim da etapa (0 antes, 1 depois).
- Gráficos desenhados com Chart.js em canvas e inseridos no PDF (jsPDF).
- Workflow `gerar-windows.yml` (windows-latest, electron-builder NSIS) publica `RelatorioDeObra-Setup.exe` nas Releases.

## Entrega

- Código no mesmo repositório (`windows/` para o programa). Atualizar o GitHub pelo navegador é trabalhoso; o ideal é conectar o GitHub ao Claude para envio direto.
- Guia em português: configurar o script do Drive, etapas da obra, instalar o .exe.

## Deixado ao implementador

Layout exato das telas e do PDF, cores dos gráficos, mensagens de erro, nomes internos.
