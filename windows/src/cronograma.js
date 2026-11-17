// Importação das etapas da obra a partir de uma planilha (Excel ou CSV).
// Colunas esperadas: Etapa | Peso (%) | Início previsto | Fim previsto (qualquer ordem, cabeçalho em qualquer das 15 primeiras linhas).

export const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const pad = n => String(n).padStart(2, "0");

const COLS = {
  nome: /^(etapa|servico|descricao|atividade|item da obra|tarefa)/,
  peso: /^(peso|%|percentual)/,
  inicio: /^(inicio|comeco|data de inicio|data inicio)/,
  fim: /^(fim|termino|conclusao|data de fim|data fim|data de termino)/
};

function dataValida(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Converte célula em data ISO. Retorna "" se vazia, null se inválida. */
export function paraData(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date) {
    if (isNaN(v)) return null;
    const t = new Date(v.getTime() + 12 * 3600e3); // evita deslocamento de fuso
    return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate());
  }
  if (typeof v === "number") {                     // número serial do Excel (dias desde 30/12/1899)
    if (v < 20000 || v > 80000) return null;
    const t = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400e3);
    return t.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return dataValida(+m[1], +m[2], +m[3]) ? m[1] + "-" + pad(m[2]) + "-" + pad(m[3]) : null;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return dataValida(y, +m[2], +m[1]) ? y + "-" + pad(m[2]) + "-" + pad(m[1]) : null;
  }
  if (/^\d+(\.\d+)?$/.test(s)) return paraData(+s);
  return null;
}

/** Converte célula em peso. Retorna {v, pct} (pct = veio com "%"); null se inválido. */
function paraPeso(v) {
  if (v == null || v === "") return { v: 0, pct: false };
  if (typeof v === "number") return isFinite(v) && v >= 0 ? { v, pct: false } : null;
  const s = String(v).trim(), pct = s.includes("%");
  const n = Number(s.replace("%", "").replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return isFinite(n) && n >= 0 ? { v: n, pct } : null;
}

/**
 * @param linhas matriz de células (linha 0 = linha 1 da planilha)
 * @returns {{ etapas: {nome,peso,inicio,fim}[], erros: {linha, msg}[] }}
 */
export function interpretarLinhas(linhas) {
  const rows = (linhas || []).map(r => (Array.isArray(r) ? r : []));
  let cab = -1, map = { nome: 0, peso: 1, inicio: 2, fim: 3 };
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cels = rows[i].map(norm);
    const iNome = cels.findIndex(c => COLS.nome.test(c));
    if (iNome >= 0) {
      cab = i; map = { nome: iNome };
      ["peso", "inicio", "fim"].forEach(k => { const j = cels.findIndex(c => COLS[k].test(c)); if (j >= 0) map[k] = j; });
      break;
    }
  }
  const brutas = [], erros = [], vistos = new Set();
  for (let i = cab + 1; i < rows.length; i++) {
    const r = rows[i], linha = i + 1;
    const nome = String(r[map.nome] == null ? "" : r[map.nome]).trim();
    const vazio = [map.peso, map.inicio, map.fim].every(j => j == null || r[j] == null || String(r[j]).trim() === "");
    if (!nome && vazio) continue;
    if (!nome) { erros.push({ linha, msg: "linha sem nome de etapa" }); continue; }
    const k = norm(nome);
    if (vistos.has(k)) { erros.push({ linha, msg: "etapa repetida: \"" + nome + "\"" }); continue; }
    vistos.add(k);
    const peso = map.peso == null ? { v: 0, pct: false } : paraPeso(r[map.peso]);
    const inicio = map.inicio == null ? "" : paraData(r[map.inicio]);
    const fim = map.fim == null ? "" : paraData(r[map.fim]);
    if (peso === null) { erros.push({ linha, msg: "peso inválido em \"" + nome + "\"" }); continue; }
    if (inicio === null) { erros.push({ linha, msg: "data de início inválida em \"" + nome + "\" (use dd/mm/aaaa)" }); continue; }
    if (fim === null) { erros.push({ linha, msg: "data de fim inválida em \"" + nome + "\" (use dd/mm/aaaa)" }); continue; }
    if (inicio && fim && fim < inicio) { erros.push({ linha, msg: "\"" + nome + "\" termina antes de começar" }); continue; }
    brutas.push({ nome, peso, inicio, fim });
  }
  // Pesos escritos como fração (0,1 = 10%) quando nenhum passa de 1 e nenhum veio com "%"
  const fracao = brutas.length > 0 && brutas.every(b => !b.peso.pct && b.peso.v <= 1) && brutas.some(b => b.peso.v > 0);
  const etapas = brutas.map(b => ({ nome: b.nome, peso: Math.round((fracao ? b.peso.v * 100 : b.peso.v) * 100) / 100, inicio: b.inicio, fim: b.fim }));
  if (!etapas.length && !erros.length) erros.push({ linha: 0, msg: "Nenhuma etapa encontrada. A planilha precisa de uma coluna \"Etapa\" com os nomes." });
  return { etapas, erros };
}

/**
 * Junta as etapas da planilha com as atuais da obra, mantendo o id das que têm o mesmo nome
 * (para não perder o % já lançado nos diários).
 * @returns {{ etapas, status: ("nova"|"alterada"|"igual")[], removidas }}
 */
export function mesclarEtapas(atuais, novas, gerarId) {
  const porNome = new Map((atuais || []).map(e => [norm(e.nome), e]));
  const usados = new Set();
  const status = [];
  const etapas = novas.map(n => {
    const a = porNome.get(norm(n.nome));
    if (!a) { status.push("nova"); return { id: gerarId(), ...n }; }
    usados.add(a.id);
    const igual = (+a.peso || 0) === n.peso && (a.inicio || "") === n.inicio && (a.fim || "") === n.fim;
    status.push(igual ? "igual" : "alterada");
    return { id: a.id, ...n };
  });
  return { etapas, status, removidas: (atuais || []).filter(e => !usados.has(e.id)) };
}
