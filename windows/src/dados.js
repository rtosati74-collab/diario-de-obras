// Consolida os diários de uma obra num período para o relatório do contratante.
import { pctGeral, previstoEm, pesosNormalizados } from "../../src/andamento.js";

const r1 = n => Math.round(n * 10) / 10;
const totalFunc = d => (d.empreiteiras || []).reduce((s, e) => s + (+e.func || 0), 0);

function proxDia(iso) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + 1));
  return d.toISOString().slice(0, 10);
}

/** Um diário por data (o mais recente), ordenados por data. */
function porData(diarios) {
  const m = new Map();
  diarios.forEach(d => {
    const a = m.get(d.data);
    if (!a || (d.atualizadoEm || 0) >= (a.atualizadoEm || 0)) m.set(d.data, d);
  });
  return [...m.values()].sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * @param obra    { nome, etapas?: [...] }
 * @param diarios todos os diários da obra
 * @param op      { inicio, fim, incluirRascunhos? }
 */
export function montarDados(obra, diarios, op) {
  const { inicio, fim } = op;
  const etapas = obra.etapas || [];
  const validos = porData((diarios || []).filter(d => d.data && (op.incluirRascunhos || d.status === "final")));
  const ate = validos.filter(d => d.data <= fim);
  const antes = validos.filter(d => d.data < inicio);
  const dias = validos.filter(d => d.data >= inicio && d.data <= fim);
  // Só diários que registraram andamento contam para o realizado (os antigos, sem etapas, ficam de fora)
  const temAnd = d => d.andamento && Object.keys(d.andamento).length > 0;
  const ultimo = ate.filter(temAnd).at(-1), ultimoAntes = antes.filter(temAnd).at(-1);

  const realizado = etapas.length && ultimo ? pctGeral(etapas, ultimo.andamento) : 0;
  const previsto = etapas.length ? previstoEm(etapas, fim) : null;
  const totais = dias.map(totalFunc);

  const resumo = {
    realizado,
    realizadoInicio: etapas.length && ultimoAntes ? pctGeral(etapas, ultimoAntes.andamento) : 0,
    previsto,
    desvio: previsto == null ? null : r1(realizado - previsto),
    diasComDiario: dias.length,
    diasChuva: dias.filter(d => d.clima && (d.clima.manha === "C" || d.clima.tarde === "C")).length,
    efetivoMedio: totais.length ? r1(totais.reduce((s, n) => s + n, 0) / totais.length) : 0,
    efetivoMax: totais.length ? Math.max(...totais) : 0,
    acidentes: dias.filter(d => d.acidente === "sim").length
  };

  // Curva: do começo da obra até o fim do planejado (ou do período, o que for depois)
  const curva = [];
  if (etapas.length) {
    const datas = etapas.flatMap(e => [e.inicio, e.fim]).filter(Boolean);
    if (validos.length) datas.push(validos[0].data);
    if (datas.length) {
      const ini = datas.reduce((a, b) => (a < b ? a : b));
      const fimCurva = [fim, ...datas].reduce((a, b) => (a > b ? a : b));
      const real = new Map(ate.filter(temAnd).map(d => [d.data, pctGeral(etapas, d.andamento)]));
      for (let d = ini; d <= fimCurva; d = proxDia(d)) {
        curva.push({ data: d, previsto: previstoEm(etapas, d), realizado: real.has(d) ? real.get(d) : null });
      }
    }
  }

  const pesos = pesosNormalizados(etapas);
  const etapasOut = etapas.map(e => ({
    nome: e.nome, peso: r1(pesos.get(e.id) * 100),
    previsto: previstoEm([e], fim),
    realizado: ultimo && ultimo.andamento ? +(ultimo.andamento[e.id] || 0) : 0
  }));

  const nomes = [];
  dias.forEach(d => (d.empreiteiras || []).forEach(e => { const n = (e.nome || "").trim() || "Sem nome"; if (!nomes.includes(n)) nomes.push(n); }));
  const efetivo = {
    datas: dias.map(d => d.data),
    series: nomes.map(nome => ({
      nome,
      valores: dias.map(d => (d.empreiteiras || []).filter(e => ((e.nome || "").trim() || "Sem nome") === nome).reduce((s, e) => s + (+e.func || 0), 0))
    }))
  };

  const clima = { S: 0, I: 0, C: 0 };
  dias.forEach(d => ["manha", "tarde"].forEach(p => { const v = d.clima && d.clima[p]; if (v in clima) clima[v]++; }));

  const seguranca = {
    acidentes: dias.filter(d => d.acidente === "sim").map(d => ({ data: d.data, desc: d.acidenteDesc || "" })),
    epi: { sim: 0, parcial: 0, nao: 0 }
  };
  dias.forEach(d => { if (d.epi in seguranca.epi) seguranca.epi[d.epi]++; });

  return { periodo: { inicio, fim }, semEtapas: !etapas.length, resumo, curva, etapas: etapasOut, efetivo, clima, seguranca, dias };
}
