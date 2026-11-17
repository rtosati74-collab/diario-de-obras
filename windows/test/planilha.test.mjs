import { test } from "node:test";
import assert from "node:assert/strict";
import { lerPlanilha, gerarModelo } from "../src/planilha.js";

test("modelo gerado é lido de volta igual", () => {
  const et = [{ nome: "Rampa Bloco 1", peso: 10, inicio: "2026-12-01", fim: "2026-12-12" }, { nome: "Piscina", peso: 90, inicio: "", fim: "2027-01-30" }];
  const r = lerPlanilha(new Uint8Array(gerarModelo(et)), "modelo.xlsx");
  assert.deepEqual(r.erros, []); assert.equal(r.aba, "Cronograma");
  assert.deepEqual(r.etapas, et);
});
test("CSV brasileiro com ; e datas dd/mm não troca dia e mês", () => {
  const csv = "Etapa;Peso;Início;Fim\nRampa 1;10,5;01/12/2026;12/12/2026\n";
  const r = lerPlanilha(new TextEncoder().encode(csv), "crono.csv");
  assert.deepEqual(r.etapas, [{ nome: "Rampa 1", peso: 10.5, inicio: "2026-12-01", fim: "2026-12-12" }]);
});
