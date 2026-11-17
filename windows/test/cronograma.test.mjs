import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretarLinhas, mesclarEtapas } from "../src/cronograma.js";

test("lê cabeçalho em qualquer linha e colunas em qualquer ordem", () => {
  const r = interpretarLinhas([
    ["Cronograma da obra"], [],
    ["Fim previsto", "ETAPA", "Peso (%)", "Início previsto"],
    ["12/12/2026", "Rampa Bloco 1", "10%", "01/12/2026"],
    [new Date(Date.UTC(2027, 0, 30)), "Rampa piscina", 30, new Date(Date.UTC(2027, 0, 5))]
  ]);
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.etapas, [
    { nome: "Rampa Bloco 1", peso: 10, inicio: "2026-12-01", fim: "2026-12-12" },
    { nome: "Rampa piscina", peso: 30, inicio: "2027-01-05", fim: "2027-01-30" }
  ]);
});
test("sem cabeçalho usa colunas A-D", () => {
  const r = interpretarLinhas([["Bloco 1", "10,5", "2026-12-01", "2026-12-10"]]);
  assert.deepEqual(r.etapas, [{ nome: "Bloco 1", peso: 10.5, inicio: "2026-12-01", fim: "2026-12-10" }]);
});
test("pesos em fração viram percentual", () => {
  const r = interpretarLinhas([["Etapa", "Peso"], ["A", 0.25], ["B", 0.75]]);
  assert.deepEqual(r.etapas.map(e => e.peso), [25, 75]);
});
test("número serial de data do Excel", () => {
  const r = interpretarLinhas([["Etapa", "Peso", "Início", "Término"], ["A", 10, 46357, 46367]]);
  assert.equal(r.etapas[0].inicio, "2026-12-01"); assert.equal(r.etapas[0].fim, "2026-12-11");
});
test("data com ano de 2 dígitos e linhas vazias ignoradas", () => {
  const r = interpretarLinhas([["Etapa", "Peso", "Início", "Fim"], ["A", 10, "01/12/26", "5/1/27"], ["", "", "", ""], [null]]);
  assert.deepEqual(r.etapas, [{ nome: "A", peso: 10, inicio: "2026-12-01", fim: "2027-01-05" }]);
});
test("erros por linha: data inválida, fim antes do início, nome repetido", () => {
  const r = interpretarLinhas([["Etapa", "Peso", "Início", "Fim"], ["A", 10, "32/13/2026", "01/12/2026"], ["B", 10, "10/12/2026", "01/12/2026"], ["b", 5, "", ""]]);
  assert.deepEqual(r.erros.map(e => e.linha), [2, 3, 4]);
  assert.match(r.erros[0].msg, /início/i); assert.match(r.erros[1].msg, /antes/i); assert.match(r.erros[2].msg, /repetid/i);
});
test("planilha sem etapas", () => {
  const r = interpretarLinhas([["Etapa", "Peso"]]);
  assert.deepEqual(r.etapas, []); assert.match(r.erros[0].msg, /nenhuma etapa/i);
});
test("mesclar mantém id por nome (sem acento/maiúscula) e classifica", () => {
  const atuais = [{ id: "e1", nome: "Rampa Bloco 1", peso: 10, inicio: "2026-12-01", fim: "2026-12-12" },
                  { id: "e2", nome: "Rampa Piscina", peso: 30, inicio: "", fim: "" },
                  { id: "e3", nome: "Pintura", peso: 5, inicio: "", fim: "" }];
  const novas = [{ nome: "rampa bloco 1", peso: 10, inicio: "2026-12-01", fim: "2026-12-12" },
                 { nome: "Rampa piscína", peso: 40, inicio: "2027-01-05", fim: "2027-01-30" },
                 { nome: "Corrimãos", peso: 50, inicio: "", fim: "" }];
  const m = mesclarEtapas(atuais, novas, () => "novo");
  assert.deepEqual(m.etapas.map(e => e.id), ["e1", "e2", "novo"]);
  assert.equal(m.etapas[0].nome, "rampa bloco 1");
  assert.deepEqual(m.status, ["igual", "alterada", "nova"]);
  assert.deepEqual(m.removidas.map(e => e.id), ["e3"]);
});
