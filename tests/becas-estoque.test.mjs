import { test } from "node:test";
import assert from "node:assert/strict";
import { usoDosAlunos, faltaParaAluno, somarUso, FAIXAS, CAPELOS } from "../js/becas-estoque.js";

test("estoque das becas: 14 faixas, 2 capelos; uso contado dos alunos (reservado e fora)", () => {
  assert.equal(FAIXAS.length, 14);
  assert.deepEqual(
    CAPELOS.map(c => c[0]),
    ["azulRoyal", "preto"]
  );
  const al = [
    { status: "Beca medida", becaTipo: "tradPreta", tamanho: "P", menosLonga: true, faixa: "azul_fina", capelo: "preto" },
    { status: "Retirou a beca", becaTipo: "tradPreta", tamanho: "P", faixa: "azul_fina", capelo: "preto" },
    { status: "Devolvida", becaTipo: "tradPreta", tamanho: "P" },
    { status: "Cadastrado", becaTipo: "tradPreta", tamanho: "P" },
    { status: "Beca medida", becaTipo: "tradPreta", tamanho: "P", excluido: { em: "x" } }
  ];
  const u = usoDosAlunos(al);
  assert.equal(u.tamanhos.tradPreta.P, 2);
  assert.equal(u.menosLonga.tradPreta.P, 1);
  assert.equal(u.faixas.azul_fina, 2);
  assert.equal(u.reservado, 1);
  assert.equal(u.fora, 1);
  const E = {
    becas: { tradPreta: 188 },
    tamanhos: { tradPreta: { P: 2 } },
    menosLonga: { tradPreta: { P: 1 } },
    faixas: { azul_fina: 3 },
    capelos: { preto: 2 }
  };
  // P cheio (2 de 2), P1 cheio (1 de 1), capelo preto cheio
  assert.deepEqual(faltaParaAluno(E, u, { becaTipo: "tradPreta", tamanho: "P", menosLonga: true, faixa: "azul_fina", capelo: "preto" }), [
    "Beca tradicional preta P",
    "P1 (menos longa)",
    "Capelo preto"
  ]);
  assert.deepEqual(faltaParaAluno(E, u, { becaTipo: "tradPreta", tamanho: "M", faixa: "azul_fina" }), []);
  assert.equal(somarUso(u, { faixas: { azul_fina: 1 } }).faixas.azul_fina, 3);
});
