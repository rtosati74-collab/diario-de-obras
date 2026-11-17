// Leitura e geração de planilhas do cronograma (SheetJS).
import * as XLSX from "xlsx";
import { interpretarLinhas } from "./cronograma.js";

const CAB = ["Etapa", "Peso (%)", "Início previsto", "Fim previsto"];

/** Lê .xlsx/.xls/.csv e devolve { etapas, erros, aba }. */
export function lerPlanilha(buffer, nomeArquivo) {
  const csv = /\.csv$/i.test(nomeArquivo || "");
  // CSV: mantém o texto das datas (senão o leitor troca dia e mês no formato americano)
  const wb = XLSX.read(buffer, { type: "array", raw: csv, cellDates: false, codepage: 65001 });
  let melhor = null;
  for (const nome of wb.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: "", blankrows: true });
    const r = interpretarLinhas(linhas);
    if (!melhor || r.etapas.length > melhor.etapas.length) melhor = { ...r, aba: nome };
    if (r.etapas.length && !r.erros.length) break;
  }
  return melhor || { etapas: [], erros: [{ linha: 0, msg: "Arquivo sem abas." }], aba: "" };
}

const serial = iso => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400e3;

/** Gera o modelo .xlsx (com as etapas atuais, se houver) e devolve os bytes. */
export function gerarModelo(etapas) {
  const linhas = (etapas && etapas.length ? etapas : [
    { nome: "Rampa Bloco 1", peso: 10, inicio: "2026-12-01", fim: "2026-12-12" },
    { nome: "Rampa Bloco 2", peso: 10, inicio: "2026-12-08", fim: "2026-12-19" },
    { nome: "Nova rampa da piscina", peso: 30, inicio: "2027-01-05", fim: "2027-01-30" }
  ]).map(e => [e.nome, +e.peso || 0, e.inicio ? serial(e.inicio) : "", e.fim ? serial(e.fim) : ""]);
  const ws = XLSX.utils.aoa_to_sheet([CAB, ...linhas]);
  for (let r = 1; r <= linhas.length; r++) ["C", "D"].forEach(c => { const cel = ws[c + (r + 1)]; if (cel && cel.v !== "") cel.z = "dd/mm/yyyy"; });
  ws["!cols"] = [{ wch: 36 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cronograma");
  const instr = XLSX.utils.aoa_to_sheet([
    ["Como preencher"],
    ["Uma linha por etapa. Não mude os títulos da linha 1 da aba Cronograma."],
    ["Peso (%): quanto a etapa vale no total da obra. Os pesos devem somar 100."],
    ["Datas: dd/mm/aaaa. Início e fim previstos de cada etapa."],
    ["Etapas com o mesmo nome das já cadastradas mantêm o % lançado nos diários."]
  ]);
  instr["!cols"] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, instr, "Instruções");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
