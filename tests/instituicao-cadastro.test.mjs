import { test } from "node:test";
import assert from "node:assert/strict";
import { cadastroFalta, cadastroPendente, segmentoPeloNome } from "../js/instituicao-cadastro.js";

test("cadastro do colégio: falta telefone, nº de alunos e endereço até completar", () => {
  const it = { cadastroPendente: true, contatos: [], endereco: { cidade: "Seropédica" } };
  assert.deepEqual(cadastroFalta(it), ["contato com telefone", "nº de alunos", "endereço"]);
  assert.equal(cadastroPendente(it), true);
  const ok = Object.assign({}, it, { contatos: [{ nome: "Ana", tel: "21988887777" }], mediaAlunos: 90, endereco: { rua: "Rua A" } });
  assert.deepEqual(cadastroFalta(ok), []);
  assert.equal(cadastroPendente(ok), false);
  assert.equal(cadastroPendente({ contatos: [] }), false); // sem a marca: não é pendência
});
test("tipo pelo nome: CIEP e C.E. = 3º ano; E.M. e GET = 9º ano", () => {
  assert.equal(segmentoPeloNome("CIEP 225 Mário Quintana"), "medio");
  assert.equal(segmentoPeloNome("C.E. João Paulo II"), "medio");
  assert.equal(segmentoPeloNome("E.M. Cyro Monteiro"), "ano9");
  assert.equal(segmentoPeloNome("GET E.M. Alexandre Farah"), "ano9");
  assert.equal(segmentoPeloNome("Colégio Alfa"), "");
});
