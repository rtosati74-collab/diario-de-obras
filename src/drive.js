// Fila de envio de diários concluídos para o Google Drive (via Apps Script).
// A fila fica no aparelho (localStorage) para sobreviver a falta de internet e ao fechar o app.

const KEY = "diario-obra-fila-drive";

function ler(store) {
  try { const v = JSON.parse(store.getItem(KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function gravar(store, lista) { try { store.setItem(KEY, JSON.stringify(lista)); } catch (e) {} }

export function criarDrive(store) {
  let rodando = null;
  return {
    fila: () => ler(store),
    enfileirar(id) { const f = ler(store).filter(x => x !== id); f.push(id); gravar(store, f); },
    remover(id) { gravar(store, ler(store).filter(x => x !== id)); },
    /**
     * Envia todos os pendentes, um por vez.
     * deps: { config:{url, token}, gerarPdf(id) -> Promise<{arquivo, obra, data, base64}|null>,
     *         enviar(url, token, payload) -> Promise<{ok, url?, erro?}>, marcarEnviado(id, url) }
     * gerarPdf devolvendo null = diário não existe mais (sai da fila).
     */
    processar(deps) {
      if (rodando) return rodando;
      rodando = (async () => {
        const res = { ok: 0, erros: [] };
        if (!deps.config || !deps.config.url || !deps.config.token) return res;
        for (const id of ler(store)) {
          try {
            const p = await deps.gerarPdf(id);
            if (!p) { this.remover(id); continue; }
            const r = await deps.enviar(deps.config.url, deps.config.token, p);
            if (r && r.ok) { this.remover(id); res.ok++; await deps.marcarEnviado(id, r.url || ""); }
            else res.erros.push({ id, msg: (r && r.erro) || "resposta inválida" });
          } catch (e) { res.erros.push({ id, msg: (e && e.message) || String(e) }); }
        }
        return res;
      })().finally(() => { rodando = null; });
      return rodando;
    }
  };
}

const memoria = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } };
export const Drive = criarDrive(typeof localStorage !== "undefined" ? localStorage : memoria);
