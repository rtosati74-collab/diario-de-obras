# Andamento, Google Drive e Relatório Windows: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medir o avanço físico por etapa no diário, copiar cada diário concluído para o Google Drive e gerar no Windows um relatório PDF de período para o contratante.

**Architecture:** Cálculos de andamento e estatísticas ficam em módulos puros (`src/andamento.js`, `windows/src/dados.js`) testados com `node --test` e compartilhados pelo app Android e pelo programa Windows. O Drive recebe o PDF por um Apps Script publicado como app da Web; a URL e o token ficam em `config/geral` no Firestore. O programa Windows é Electron com Firebase JS, Chart.js e jsPDF, empacotado no GitHub Actions (windows-latest, electron-builder NSIS).

**Tech Stack:** Capacitor 7.6.9, Firebase 11.10.0, jsPDF 3.0.4, esbuild 0.25.12, Electron 33.x, electron-builder 25.x, Chart.js 4.4.x, Google Apps Script.

**Spec:** `docs/superpowers/specs/2026-11-16-andamento-drive-relatorio-design.md`

## Global Constraints

- Campos novos são opcionais: obras e diários antigos abrem sem erro.
- Configuração do usuário é só "copiar e colar" (sem Google Cloud Console).
- Firebase Spark: só Firestore e Auth.
- Datas em `YYYY-MM-DD`; percentuais 0–100, passo 5 no controle.
- Versões de pacotes com no mínimo 2 semanas de publicação.
- Textos da interface em português do Brasil.

## Review Focus

1. Obra sem etapas → diário e relatório funcionam; relatório omite curva e mostra aviso "Etapas não cadastradas".
2. Pesos somando ≠ 100 (ou 0) → normalização; soma 0 → todos com peso igual.
3. Etapa com fim antes do início ou sem datas → previsto trata como degrau na data existente; sem datas → fora da curva prevista.
4. Diário com etapa já excluída no `andamento` → ignorada no % geral.
5. Envio ao Drive sem internet ou com token errado → fica na fila e mostra erro legível; não bloqueia salvar.

---

### Task 1: Módulo de andamento (puro)

**Files:** Create `src/andamento.js`, `test/andamento.test.mjs`

**Interfaces — Produces:**
- `pesosNormalizados(etapas) -> Map<id, fração 0..1>`
- `pctGeral(etapas, andamento) -> number` (0–100, 1 casa)
- `previstoEm(etapas, dataISO) -> number` (0–100)
- `andamentoInicial(etapas, diariosDaObra, dataISO) -> {id: pct}` (último diário com data ≤ dataISO; senão 0)

- [ ] Testes: pesos 10/90 → 0.1/0.9; pesos 0/0 → 0.5/0.5; `pctGeral` com etapa órfã ignora; `previstoEm` antes do início 0, no meio 50 (linear), depois 100; etapa sem datas ignorada no previsto (peso redistribuído entre as com datas); `andamentoInicial` pega o diário anterior mais recente.
- [ ] Implementar, rodar `node --test test/`, commit.

### Task 2: App Android — etapas, contratante e andamento no diário

**Files:** Modify `src/app.js`, `src/style.css`

- Cadastro da obra: campo Contratante; seção Etapas (nome, peso, início, fim, remover) com soma dos pesos exibida.
- Diário: seção Andamento (slider 0–100 passo 5 + número) por etapa; % geral ao vivo; aviso quando diminui; obra sem etapas → aviso com botão "Cadastrar etapas".
- Lista e visualização: % geral; tabela de andamento; PDF do diário com tabela de andamento.
- [ ] Teste manual com Firebase simulado (Playwright): cadastrar 2 etapas, diário com 30/50 → % geral exibido corretamente; PDF contém "ANDAMENTO".

### Task 3: Google Drive

**Files:** Create `src/drive.js`, `apps-script/Codigo.gs`; Modify `src/app.js`

**Interfaces — Produces:** `enfileirar(diarioId)`, `processarFila({gerarPdf, obter, marcarEnviado}) -> Promise<{ok, erros}>`, `enviarPdf(url, token, payload) -> Promise<{ok, url?, erro?}>`

- Folha "Conta" ganha "Google Drive": URL + token (gera token aleatório; mostra para colar no script), salvos em `config/geral`.
- Concluir diário → enfileira; fila processada após salvar, ao abrir o app e no evento `online`. Sucesso → `diario.driveEm`.
- Apps Script `doPost`: confere token, cria pastas `Diário de Obra/<obra>`, substitui arquivo de mesmo nome, devolve `{ok:true,url}`.
- [ ] Teste: `processarFila` com `enviarPdf` simulado falhando mantém item na fila; sucesso remove e chama `marcarEnviado`.

### Task 4: Programa Windows — dados do relatório (puro)

**Files:** Create `windows/src/dados.js`, `windows/test/dados.test.mjs`

**Interfaces — Produces:** `montarDados(obra, diarios, {inicio, fim}) -> {periodo, resumo:{realizado, previsto, desvio, diasComDiario, diasChuva, efetivoMedio, efetivoMax, acidentes}, curva:[{data, previsto, realizado|null}], etapas:[{nome, peso, previsto, realizado}], efetivo:{datas, series:[{nome, valores}]}, clima:{S,I,C}, seguranca:{acidentes:[{data, desc}], epi:{sim, parcial, nao}}, dias:[diario...]}`

- [ ] Testes com obra de 2 etapas e 3 diários: resumo, curva (realizado só em datas com diário), efetivo empilhado por empreiteira, clima contando manhã e tarde, filtro de período.

### Task 5: Programa Windows — interface, PDF e empacotamento

**Files:** Create `windows/package.json`, `windows/main.js`, `windows/preload.js`, `windows/build.mjs`, `windows/src/index.html`, `windows/src/app.js`, `windows/src/relatorio.js`, `windows/src/style.css`, `.github/workflows/gerar-windows.yml`

- Telas: configuração Firebase → login → obras → período/opções → gerar → salvar (diálogo) e abrir PDF.
- `gerarRelatorio(dados, obra, opcoes, carregarFoto) -> Promise<Uint8Array>` com as 10 seções do spec; gráficos Chart.js em canvas fora da tela (`animation:false`) → PNG.
- [ ] Teste: abrir o renderer no Chromium com Firebase simulado, gerar PDF e conferir páginas renderizadas.
- [ ] Workflow: `npm ci` + `npm run dist` em `windows/`, publica `RelatorioDeObra-Setup.exe` na Release.

### Task 6: Guia e entrega

- Atualizar `LEIA-ME.md` (etapas, Drive, programa Windows); zip atualizado.
