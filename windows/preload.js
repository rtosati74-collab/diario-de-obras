const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  salvarPdf: (nome, bytes) => ipcRenderer.invoke("salvar-pdf", { nome, bytes })
});
