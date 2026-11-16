import { test } from "node:test";
import assert from "node:assert/strict";
import { criarDrive } from "../src/drive.js";
const mem = () => ({ d:{}, getItem(k){ return this.d[k] ?? null; }, setItem(k,v){ this.d[k]=v; } });
const pdf = async id => ({ arquivo:id+".pdf", obra:"Obra", data:"2026-12-01", base64:"AA==" });

test("falha mantém na fila", async () => {
  const D = criarDrive(mem()); D.enfileirar("d1");
  const r = await D.processar({ config:{url:"u",token:"t"}, gerarPdf:pdf, enviar: async () => ({ok:false, erro:"token inválido"}), marcarEnviado: async()=>{} });
  assert.equal(r.erros[0].msg, "token inválido"); assert.deepEqual(D.fila(), ["d1"]);
});
test("exceção (sem internet) mantém na fila", async () => {
  const D = criarDrive(mem()); D.enfileirar("d1");
  const r = await D.processar({ config:{url:"u",token:"t"}, gerarPdf:pdf, enviar: async () => { throw new Error("Failed to fetch"); }, marcarEnviado: async()=>{} });
  assert.equal(r.erros.length, 1); assert.deepEqual(D.fila(), ["d1"]);
});
test("sucesso remove e marca", async () => {
  const D = criarDrive(mem()); D.enfileirar("d1"); D.enfileirar("d2"); D.enfileirar("d1");
  const marc = [];
  const r = await D.processar({ config:{url:"u",token:"t"}, gerarPdf:pdf, enviar: async () => ({ok:true,url:"x"}), marcarEnviado: async(id,u)=>marc.push(id+u) });
  assert.equal(r.ok, 2); assert.deepEqual(D.fila(), []); assert.deepEqual(marc, ["d2x","d1x"]);
});
test("sem config não envia", async () => {
  const D = criarDrive(mem()); D.enfileirar("d1");
  const r = await D.processar({ config:null, gerarPdf:pdf, enviar: async () => ({ok:true}), marcarEnviado: async()=>{} });
  assert.equal(r.ok, 0); assert.deepEqual(D.fila(), ["d1"]);
});
test("diário apagado sai da fila", async () => {
  const D = criarDrive(mem()); D.enfileirar("d1");
  await D.processar({ config:{url:"u",token:"t"}, gerarPdf: async()=>null, enviar: async () => ({ok:true}), marcarEnviado: async()=>{} });
  assert.deepEqual(D.fila(), []);
});
