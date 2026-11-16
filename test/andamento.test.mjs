import { test } from "node:test";
import assert from "node:assert/strict";
import { pesosNormalizados, pctGeral, previstoEm, andamentoInicial } from "../src/andamento.js";

const E = [
  { id:"a", nome:"Rampa Bloco 1", peso:10, inicio:"2026-12-01", fim:"2026-12-10" },
  { id:"b", nome:"Rampa piscina", peso:90, inicio:"2026-12-11", fim:"2026-12-20" }
];

test("pesos normalizados", () => {
  const p = pesosNormalizados(E);
  assert.equal(p.get("a"), 0.1); assert.equal(p.get("b"), 0.9);
});
test("pesos todos zero ficam iguais", () => {
  const p = pesosNormalizados([{id:"a",peso:0},{id:"b",peso:0}]);
  assert.equal(p.get("a"), 0.5); assert.equal(p.get("b"), 0.5);
});
test("pesos que somam 50 sao normalizados", () => {
  const p = pesosNormalizados([{id:"a",peso:25},{id:"b",peso:25}]);
  assert.equal(p.get("a"), 0.5);
});
test("pctGeral pondera e ignora etapa orfa", () => {
  assert.equal(pctGeral(E, { a:100, b:50, zzz:100 }), 55);
  assert.equal(pctGeral(E, {}), 0);
  assert.equal(pctGeral([], { a:10 }), 0);
});
test("previstoEm linear", () => {
  assert.equal(previstoEm(E, "2026-11-30"), 0);
  assert.equal(previstoEm(E, "2026-12-05"), 5);      // 10% x 50%
  assert.equal(previstoEm(E, "2026-12-10"), 10);
  assert.equal(previstoEm(E, "2026-12-15"), 55);     // 10 + 90 x 50%
  assert.equal(previstoEm(E, "2027-01-01"), 100);
});
test("previstoEm ignora etapa sem datas e redistribui peso", () => {
  const e2 = [{ id:"a", peso:50, inicio:"2026-12-01", fim:"2026-12-10" }, { id:"b", peso:50 }];
  assert.equal(previstoEm(e2, "2026-12-10"), 100);
  assert.equal(previstoEm([{ id:"b", peso:50 }], "2026-12-10"), null);
});
test("previstoEm fim antes do inicio vira degrau no fim", () => {
  const e3 = [{ id:"a", peso:1, inicio:"2026-12-10", fim:"2026-12-01" }];
  assert.equal(previstoEm(e3, "2026-11-30"), 0);
  assert.equal(previstoEm(e3, "2026-12-01"), 100);
});
test("andamentoInicial usa diario anterior mais recente", () => {
  const ds = [
    { data:"2026-12-02", andamento:{ a:20 } },
    { data:"2026-12-04", andamento:{ a:40, b:5 } },
    { data:"2026-12-09", andamento:{ a:90 } }
  ];
  assert.deepEqual(andamentoInicial(E, ds, "2026-12-05"), { a:40, b:5 });
  assert.deepEqual(andamentoInicial(E, ds, "2026-12-01"), { a:0, b:0 });
  assert.deepEqual(andamentoInicial(E, [], "2026-12-05"), { a:0, b:0 });
});
