import { test } from "node:test";
import assert from "node:assert/strict";
import { repetidosDe, gruposRepetidos, escolherQueFica, juntarCampos } from "../js/colegio-repetido.js";

const insts = [
  { id: "a", nome: "E.M. Manoel Gomes", resp: "Luciana", contatos: [{ nome: "Will", tel: "21991915685" }], diaPaspatur: { data: "2026-11-18" } },
  { id: "b", nome: "Escola Municipal Manoel Gomes", resp: "Roberto", contatos: [{ nome: "Will", tel: "021991915685" }, { nome: "Márcia", tel: "2199999" }] },
  { id: "c", nome: "EM MANOEL GOMES" },
  { id: "d", nome: "C.E. Manoel Gomes" },
  { id: "e", nome: "E.M. Mário Piragibe" }
];
test("acha o mesmo colégio escrito de outro jeito (e não confunde estadual com municipal)", () => {
  assert.deepEqual(repetidosDe("e.m. manoel gomes", insts).map(i => i.id), ["a", "b", "c"]);
  assert.deepEqual(repetidosDe("Colégio Estadual Manoel Gomes", insts).map(i => i.id), ["d"]);
  assert.deepEqual(repetidosDe("E.M. Antenor Nascente", insts), []);
});
test("agrupa os repetidos e escolhe o que tem mais informação", () => {
  const g = gruposRepetidos(insts);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].map(i => i.id).sort(), ["a", "b", "c"]);
  assert.equal(escolherQueFica(g[0]).id, "a");
});
test("juntar completa os contatos sem repetir", () => {
  const p = juntarCampos(insts[0], [insts[1], insts[2]]);
  assert.deepEqual(p.contatos.map(c => c.nome), ["Will", "Márcia"]);
});
