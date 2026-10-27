import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.document = globalThis.document || { createElement: () => ({}) };
const { formandoDaLinha } = await import("../js/turma-ajustes.js");
const { kitsDe } = await import("../js/contrato.js");

const kits = kitsDe({}, {});
const inst = { contratoTurma: { inicio: "2026-03-05" } };

test("planilha: sem kit entra com o Kit 01 (adesão) no preço do contrato", () => {
  const f = formandoDaLinha({ NOME: "Ana Lima", Telefone: "21999990000" }, kits, inst, "2026-02-10");
  assert.equal(f.kitId, "k01");
  assert.equal(f.contrato, "adesao");
  assert.equal(f.status, "ativo");
  assert.equal(f.primeiroVenc, "2026-03-05");
  assert.ok(f.valor > 0);
});
test("planilha: kit pelo número, valor, parcelas, data dd/mm/aaaa e pagas", () => {
  const f = formandoDaLinha(
    { Aluno: "Bruno", KIT: "Kit 04", "Valor total": "900,00", Parcelas: 9, Vencimento: "05/04/2026", Pagas: 2 },
    kits,
    inst,
    "2026-02-10"
  );
  assert.deepEqual([f.kitId, f.contrato, f.valor, f.parcelas, f.primeiroVenc, f.pagasPlan], ["k04", "album", 900, 9, "2026-04-05", 2]);
});
test("planilha: kit que não é 01 a 05 fica como 'outro' com o texto da planilha", () => {
  const f = formandoDaLinha({ nome: "Caio", kit: "Pacote especial", valor: "500" }, kits, inst, "2026-02-10");
  assert.deepEqual([f.kitId, f.kit, f.valor], ["outro", "Pacote especial", 500]);
});
