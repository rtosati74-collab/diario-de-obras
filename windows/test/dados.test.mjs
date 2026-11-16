import { test } from "node:test";
import assert from "node:assert/strict";
import { montarDados } from "../src/dados.js";

const obra = { nome:"Rampas", etapas:[
  { id:"a", nome:"Rampas blocos", peso:60, inicio:"2026-11-01", fim:"2026-11-30" },
  { id:"b", nome:"Rampa piscina", peso:40, inicio:"2026-12-01", fim:"2026-12-31" } ] };
const D = (data, extra) => ({ id:"d"+data, data, status:"final", andamento:{}, empreiteiras:[], clima:{manha:"S",tarde:"S"}, acidente:"nao", epi:"sim", fotos:[], ...extra });
const diarios = [
  D("2026-11-05", { andamento:{a:10,b:0}, empreiteiras:[{nome:"Silva",func:"4"},{nome:"Souza",func:"2"}], clima:{manha:"S",tarde:"C"} }),
  D("2026-11-20", { andamento:{a:50,b:0}, empreiteiras:[{nome:"Silva",func:"6"}], acidente:"sim", acidenteDesc:"Corte leve", epi:"parcial" }),
  D("2026-12-03", { andamento:{a:80,b:10}, empreiteiras:[{nome:"Souza",func:"3"}] }),
  D("2026-12-04", { status:"rascunho", andamento:{a:99,b:99} })
];

test("resumo do período de novembro", () => {
  const r = montarDados(obra, diarios, { inicio:"2026-11-01", fim:"2026-11-30" });
  assert.equal(r.resumo.realizado, 30);          // 60% x 50
  assert.equal(r.resumo.previsto, 60);
  assert.equal(r.resumo.desvio, -30);
  assert.equal(r.resumo.realizadoInicio, 0);
  assert.equal(r.resumo.diasComDiario, 2);
  assert.equal(r.resumo.diasChuva, 1);
  assert.equal(r.resumo.efetivoMedio, 6);        // (6+6)/2
  assert.equal(r.resumo.efetivoMax, 6);
  assert.equal(r.resumo.acidentes, 1);
});
test("rascunhos ficam fora por padrão", () => {
  const r = montarDados(obra, diarios, { inicio:"2026-12-01", fim:"2026-12-31" });
  assert.equal(r.resumo.diasComDiario, 1);
  assert.equal(r.resumo.realizado, 52);          // 48 + 4
  assert.equal(r.resumo.realizadoInicio, 30);
  const r2 = montarDados(obra, diarios, { inicio:"2026-12-01", fim:"2026-12-31", incluirRascunhos:true });
  assert.equal(r2.resumo.diasComDiario, 2);
});
test("curva previsto x realizado", () => {
  const r = montarDados(obra, diarios, { inicio:"2026-11-01", fim:"2026-11-30" });
  assert.equal(r.curva[0].data, "2026-11-01");
  assert.equal(r.curva.at(-1).data, "2026-12-31");  // plano até o fim da obra
  assert.equal(r.curva.at(-1).previsto, 100);
  const p = Object.fromEntries(r.curva.map(c => [c.data, c.realizado]));
  assert.equal(p["2026-11-05"], 6); assert.equal(p["2026-11-20"], 30);
  assert.equal(p["2026-11-06"], null);
  assert.equal(p["2026-12-03"], null);             // depois do fim do período
});
test("etapas, efetivo, clima e segurança", () => {
  const r = montarDados(obra, diarios, { inicio:"2026-11-01", fim:"2026-11-30" });
  assert.deepEqual(r.etapas.map(e => [e.nome, e.peso, e.previsto, e.realizado]), [["Rampas blocos",60,100,50],["Rampa piscina",40,0,0]]);
  assert.deepEqual(r.efetivo.datas, ["2026-11-05","2026-11-20"]);
  assert.deepEqual(r.efetivo.series, [{nome:"Silva",valores:[4,6]},{nome:"Souza",valores:[2,0]}]);
  assert.deepEqual(r.clima, { S:3, I:0, C:1 });
  assert.deepEqual(r.seguranca.acidentes, [{ data:"2026-11-20", desc:"Corte leve" }]);
  assert.deepEqual(r.seguranca.epi, { sim:1, parcial:1, nao:0 });
});
test("obra sem etapas", () => {
  const r = montarDados({ nome:"X" }, diarios, { inicio:"2026-11-01", fim:"2026-11-30" });
  assert.equal(r.semEtapas, true); assert.equal(r.resumo.previsto, null); assert.deepEqual(r.curva, []);
});
test("vários diários na mesma data: vale o mais recente", () => {
  const ds = [D("2026-11-05",{andamento:{a:10},atualizadoEm:1}), D("2026-11-05",{id:"x",andamento:{a:20},atualizadoEm:2})];
  const r = montarDados(obra, ds, { inicio:"2026-11-01", fim:"2026-11-30" });
  assert.equal(r.resumo.diasComDiario, 1); assert.equal(r.resumo.realizado, 12);
});
test("diário antigo sem andamento não derruba o realizado", () => {
  const ds = [D("2026-11-05",{andamento:{a:50}}), D("2026-11-06",{andamento:undefined})];
  const r = montarDados(obra, ds, { inicio:"2026-11-01", fim:"2026-11-30" });
  assert.equal(r.resumo.realizado, 30);
  assert.equal(r.curva.find(c=>c.data==="2026-11-06").realizado, null);
});
