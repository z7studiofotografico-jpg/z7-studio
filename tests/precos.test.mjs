import { test } from "node:test";
import assert from "node:assert/strict";
// precos.js importa ui.js (DOM); aqui testamos só as funções puras
globalThis.document = globalThis.document || { createElement: () => ({}) };
const { lerPreco, mesmoPreco, textoPreco, soDiferencas } = await import("../js/precos.js");

test("preço lido: antecipado tem ao menos 1 parcela; depois das fotos vazio fica zerado", () => {
  assert.deepEqual(lerPreco("850,00", "10", "ant"), { valor: 850, parcelas: 10 });
  assert.deepEqual(lerPreco("", "", "ant"), { valor: 0, parcelas: 1 });
  assert.deepEqual(lerPreco("", "6", "pos"), { valor: 0, parcelas: 0 });
  assert.equal(textoPreco({ valor: 850, parcelas: 10 }), "10x de R$ 85,00");
  assert.equal(textoPreco({ valor: 0 }), "—");
  assert.ok(mesmoPreco({ valor: 85, parcelas: 1 }, { valor: 85.0, parcelas: 1 }));
});
test("tabela da turma guarda só o que difere da padrão", () => {
  const padrao = [{ id: "k04", ant: { valor: 850, parcelas: 10 }, pos: { valor: 0, parcelas: 0 }, rep: { valor: 0, parcelas: 0 } }];
  const iguais = [{ id: "k04", ant: { valor: 850, parcelas: 10 }, pos: { valor: 0, parcelas: 0 }, rep: { valor: 0, parcelas: 0 } }];
  assert.deepEqual(soDiferencas(iguais, padrao), []);
  const outra = [{ id: "k04", ant: { valor: 800, parcelas: 8 }, pos: { valor: 0, parcelas: 0 }, rep: { valor: 0, parcelas: 0 } }];
  assert.deepEqual(soDiferencas(outra, padrao), [{ id: "k04", ant: { valor: 800, parcelas: 8 } }]);
});
