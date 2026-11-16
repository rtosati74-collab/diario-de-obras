// Cálculos de andamento físico da obra (usados no app Android e no programa Windows).
// Etapa: { id, nome, peso, inicio?: "YYYY-MM-DD", fim?: "YYYY-MM-DD" }
// Andamento de um diário: { <etapaId>: % concluído acumulado (0–100) }

const DIA = 86400000;
const t = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const ok = iso => typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso);
const r1 = n => Math.round(n * 10) / 10;

/** Pesos como frações que somam 1. Soma zero (ou vazia) → pesos iguais. */
export function pesosNormalizados(etapas) {
  const m = new Map();
  const lista = etapas || [];
  const soma = lista.reduce((s, e) => s + Math.max(0, +e.peso || 0), 0);
  lista.forEach(e => m.set(e.id, soma > 0 ? Math.max(0, +e.peso || 0) / soma : 1 / lista.length));
  return m;
}

/** % geral realizado (média ponderada). Ids que não são etapas atuais são ignorados. */
export function pctGeral(etapas, andamento) {
  if (!etapas || !etapas.length) return 0;
  const p = pesosNormalizados(etapas);
  let s = 0;
  etapas.forEach(e => { s += p.get(e.id) * Math.min(100, Math.max(0, +((andamento || {})[e.id]) || 0)); });
  return r1(s);
}

/** Fração prevista (0–1) de uma etapa numa data; null se a etapa não tem datas. */
function fracPrevista(e, d) {
  const a = ok(e.inicio), b = ok(e.fim);
  if (!a && !b) return null;
  if (!a || !b || t(e.fim) < t(e.inicio)) {      // só uma data, ou datas invertidas: degrau na data final
    const ref = b ? e.fim : e.inicio;
    return t(d) >= t(ref) ? 1 : 0;
  }
  const dur = (t(e.fim) - t(e.inicio)) / DIA + 1;
  const feitos = (t(d) - t(e.inicio)) / DIA + 1;
  return Math.min(1, Math.max(0, feitos / dur));
}

/** % geral previsto numa data (avanço linear entre início e fim). null se nenhuma etapa tem datas. */
export function previstoEm(etapas, dataISO) {
  const comDatas = (etapas || []).filter(e => fracPrevista(e, dataISO) !== null);
  if (!comDatas.length) return null;
  const p = pesosNormalizados(comDatas);
  return r1(comDatas.reduce((s, e) => s + p.get(e.id) * fracPrevista(e, dataISO) * 100, 0));
}

/** Valores iniciais do andamento para um diário novo: os do diário mais recente com data ≤ dataISO. */
export function andamentoInicial(etapas, diariosDaObra, dataISO) {
  const ant = (diariosDaObra || [])
    .filter(d => ok(d.data) && d.data <= dataISO && d.andamento)
    .sort((x, y) => y.data.localeCompare(x.data) || (y.atualizadoEm || 0) - (x.atualizadoEm || 0))[0];
  const out = {};
  (etapas || []).forEach(e => { out[e.id] = ant && ant.andamento[e.id] != null ? +ant.andamento[e.id] : 0; });
  return out;
}
