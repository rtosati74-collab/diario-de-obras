/**
 * Diário de Obra → Google Drive
 * Recebe o PDF de cada diário concluído no app e salva em:
 *   Meu Drive / Diário de Obra / <nome da obra> / Diario_<obra>_<data>.pdf
 *
 * COMO USAR (uma vez só):
 * 1. Cole abaixo, entre as aspas, o código de segurança mostrado no app (Conta › Google Drive).
 * 2. Implantar › Nova implantação › tipo "App da Web"
 *      Executar como: Eu
 *      Quem pode acessar: Qualquer pessoa
 * 3. Autorize o acesso ao seu Drive e copie o endereço que termina em /exec para o app.
 */
const TOKEN = "COLE_AQUI_O_CODIGO_DO_APP";
const PASTA_RAIZ = "Diário de Obra";

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    if (!p || p.token !== TOKEN) return resposta({ ok: false, erro: "código de segurança não confere com o do script" });

    const raiz = pasta(DriveApp.getRootFolder(), PASTA_RAIZ);
    if (p.teste) return resposta({ ok: true, url: raiz.getUrl() });

    if (!p.base64 || !p.arquivo || !p.obra) return resposta({ ok: false, erro: "dados incompletos" });
    const destino = pasta(raiz, String(p.obra).replace(/[\\/:*?"<>|]/g, "-").trim() || "Obra");

    // Substitui a versão anterior do mesmo diário
    const antigos = destino.getFilesByName(p.arquivo);
    while (antigos.hasNext()) antigos.next().setTrashed(true);

    const blob = Utilities.newBlob(Utilities.base64Decode(p.base64), "application/pdf", p.arquivo);
    const arq = destino.createFile(blob);
    return resposta({ ok: true, url: arq.getUrl() });
  } catch (err) {
    return resposta({ ok: false, erro: String(err && err.message || err) });
  }
}

function doGet() {
  return resposta({ ok: true, info: "Script do Diário de Obra ativo." });
}

function pasta(pai, nome) {
  const it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
