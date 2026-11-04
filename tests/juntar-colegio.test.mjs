import { test } from "node:test";
import assert from "node:assert/strict";
import { metaJuntada } from "../js/juntar-colegio.js";

test("juntar colégio: os alunos de “G” 2025 passam a contar no C.E. Roberto Lyra 2025", () => {
  const meta = { escolas: { G: 1, "C.E ROBERTO LYRA": 74 }, anos: { 2025: 75 }, escolasAno: { "G|2025": 1, "C.E ROBERTO LYRA|2025": 74 } };
  const m = metaJuntada(meta, { nomes: ["G"], ano: 2025 }, { nomes: ["C.E ROBERTO LYRA"], ano: 2025 });
  assert.deepEqual(m.escolasAno, { "C.E ROBERTO LYRA|2025": 75 });
  assert.deepEqual(m.escolas, { "C.E ROBERTO LYRA": 75 });
  assert.equal(m.anos[2025], 75);
});

test("excluir aluno: a lista de colégios diminui e o colégio some quando não sobra ninguém", async () => {
  const { metaMenos } = await import("../js/juntar-colegio.js");
  const meta = {
    escolas: { "E.M. ANTENOR": 2 },
    anos: { 2021: 1, 2022: 1 },
    escolasAno: { "E.M. ANTENOR|2021": 1, "E.M. ANTENOR|2022": 1 }
  };
  const m = metaMenos(meta, [{ escola: "E.M. ANTENOR", ano: 2021 }]);
  assert.deepEqual(m.escolasAno, { "E.M. ANTENOR|2022": 1 });
  assert.deepEqual(m.anos, { 2022: 1 });
  assert.equal(m.escolas["E.M. ANTENOR"], 1);
});
