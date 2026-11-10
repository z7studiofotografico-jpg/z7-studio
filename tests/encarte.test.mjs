import { test } from "node:test";
import assert from "node:assert/strict";

test("encarte do Kit Paspatur: público = calendário, particular = foto da turma", async () => {
  const { encartePorTipo } = await import("../js/encarte.js");
  assert.equal(encartePorTipo("publico", "Colegio X"), "calendario");
  assert.equal(encartePorTipo("particular", "C.E. Tal"), "turma");
  assert.equal(encartePorTipo("", "C.E. João Cardoso"), "calendario");
  assert.equal(encartePorTipo("", "CIEP 117"), "calendario");
  assert.equal(encartePorTipo("", "Escola Municipal Rosa"), "calendario");
  assert.equal(encartePorTipo("", "Centro Educacional Peres Medeiros"), "turma");
  assert.equal(encartePorTipo("", "Legacy School"), "turma");
});
