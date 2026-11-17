// Processo principal do programa "Relatório de Obra" (Windows).
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

function criarJanela() {
  const win = new BrowserWindow({
    width: 1240, height: 860, minWidth: 900, minHeight: 640,
    title: "Relatório de Obra", backgroundColor: "#ECEFF2", autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, "dist", "index.html"));
  // links externos abrem no navegador
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

ipcMain.handle("salvar-pdf", async (ev, { nome, bytes }) => {
  const win = BrowserWindow.fromWebContents(ev.sender);
  const r = await dialog.showSaveDialog(win, {
    title: "Salvar relatório",
    defaultPath: path.join(app.getPath("documents"), nome),
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (r.canceled || !r.filePath) return { ok: false, cancelado: true };
  fs.writeFileSync(r.filePath, Buffer.from(bytes));
  shell.openPath(r.filePath);
  return { ok: true, caminho: r.filePath };
});

ipcMain.handle("salvar-arquivo", async (ev, { nome, bytes, tipo }) => {
  const win = BrowserWindow.fromWebContents(ev.sender);
  const filtros = { xlsx: [{ name: "Planilha do Excel", extensions: ["xlsx"] }], pdf: [{ name: "PDF", extensions: ["pdf"] }] };
  const r = await dialog.showSaveDialog(win, { title: "Salvar arquivo", defaultPath: path.join(app.getPath("documents"), nome), filters: filtros[tipo] || [] });
  if (r.canceled || !r.filePath) return { ok: false, cancelado: true };
  fs.writeFileSync(r.filePath, Buffer.from(bytes));
  shell.openPath(r.filePath);
  return { ok: true, caminho: r.filePath };
});

app.whenReady().then(criarJanela);
app.on("window-all-closed", () => app.quit());
