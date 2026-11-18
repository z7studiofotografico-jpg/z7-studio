import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarOpcoes, normalizar } from "../js/busca-select.js";

const ops = ["CIEP 336 - Octávio Malta", "CIEP 433", "C.E. João Paulo II", "C.E. Abdias do Nascimento", "Colégio 3360"].map(texto => ({
  valor: texto,
  texto
}));
test("procurar na lista: pelo número, pelo nome sem acento, várias palavras", () => {
  assert.equal(normalizar("C.E. João"), "c e joao");
  assert.deepEqual(
    filtrarOpcoes(ops, "336").map(o => o.texto),
    ["CIEP 336 - Octávio Malta", "Colégio 3360"]
  );
  assert.deepEqual(
    filtrarOpcoes(ops, "joao paulo").map(o => o.texto),
    ["C.E. João Paulo II"]
  );
  assert.deepEqual(
    filtrarOpcoes(ops, "ciep octavio").map(o => o.texto),
    ["CIEP 336 - Octávio Malta"]
  );
  assert.deepEqual(filtrarOpcoes(ops, "  "), []);
});
