import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTel, linhaParaDoc, docId, faltando, slug } from "../js/repasse-dados.js";

test("telefone da planilha: tira o 55, guarda o nome entre parênteses e recusa número curto", () => {
  assert.deepEqual(parseTel("+55 (21) 98888-7777", "Mãe"), { tipo: "Mãe", nome: "", tel: "21988887777" });
  assert.deepEqual(parseTel("21988887777 (Marta)", "Mãe"), { tipo: "Mãe", nome: "Marta", tel: "21988887777" });
  assert.equal(parseTel("12345", "Pai"), null);
});
test("linha da planilha vira aluno: ano pela data do ensaio, mãe primeiro, telefones sem repetir", () => {
  const d = linhaParaDoc({ nome: " Lia ", escola: "Colegio Alfa", data: "10/03/2025", c1: "21911112222", c2: "21911112222 (Rosa)" }, null);
  assert.equal(d.nome, "Lia");
  assert.equal(d.ano, 2025);
  assert.equal(d.contatos.length, 1);
  assert.deepEqual([d.contatos[0].tipo, d.contatos[0].nome], ["Mãe", "Rosa"]);
});
test("identificador estável (reimportar não duplica) e o que falta para entrar na fila", () => {
  const d = { ano: 2025, escola: "Colégio Alfa", codigo: "12", nome: "Lia Souza" };
  assert.equal(docId(d, 0), docId({ ...d }, 99));
  assert.equal(slug("Colégio Alfa"), "colegio-alfa");
  assert.deepEqual(faltando({ escola: "X", ano: 2025, nome: "Lia", contatos: [] }), ["responsável", "telefone"]);
  assert.deepEqual(faltando({ escola: "X", ano: 2025, nome: "Lia", contatos: [{ tipo: "Mãe", nome: "Rosa", tel: "1" }] }), []);
});
