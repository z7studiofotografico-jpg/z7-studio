import { test } from "node:test";
import assert from "node:assert/strict";
import { planejarJuncao } from "../scripts/juntar-paspatur-plano.mjs";

const pas = (id, extra = {}) => ({
  id,
  nome: "ALUNO " + id,
  escola: "COLEGIO X",
  ano: 2026,
  etapa: "NA FILA",
  contatos: [{ tipo: "Mãe", tel: "21999990000" }],
  ...extra
});

test("junção: aluno do Paspatur vai para o PR marcado, a venda vai igual e sai da lista antiga", () => {
  const { ops, novoId, repetidos, alunos } = planejarJuncao({
    repasseIds: ["r1"],
    paspatur: [pas("p1", { etapa: "PAGO", valor: 200, formaPag: "Pix", pagoEm: "2026-10-01", resp: "Ana", respEmail: "ana@x.com" })]
  });
  assert.equal(alunos, 1);
  assert.equal(repetidos.length, 0);
  assert.equal(novoId.p1, "p1");
  const novo = ops.find(o => o.col === "repasse" && o.id === "p1");
  assert.equal(novo.tipo, "s");
  assert.equal(novo.dados.vendaComo, "paspatur");
  assert.equal(novo.dados.valor, 200);
  assert.equal(novo.dados.respEmail, "ana@x.com");
  assert.equal(novo.dados.etapa, "PAGO");
  assert.equal(novo.dados.id, undefined);
  assert.ok(ops.some(o => o.col === "fones" && o.id === "21999990000" && o.dados.alunos.p1));
  // apagar da lista antiga vem depois de gravar no PR
  const iGrava = ops.indexOf(novo);
  const iApaga = ops.findIndex(o => o.col === "paspatur" && o.id === "p1" && o.tipo === "d");
  assert.ok(iApaga > iGrava);
});

test("junção: ID que já existe no PR não é sobrescrito (ganha _pas) e é avisado", () => {
  const { ops, novoId, repetidos } = planejarJuncao({ repasseIds: ["a1", "a1_pas"], paspatur: [pas("a1")] });
  assert.equal(novoId.a1, "a1_pas2");
  assert.equal(repetidos.length, 1);
  assert.ok(!ops.some(o => o.col === "repasse" && o.id === "a1"));
  assert.ok(ops.some(o => o.col === "repasse" && o.id === "a1_pas2"));
});

test("junção: contagens somadas e registros que apontavam para o Paspatur passam para o PR", () => {
  const { ops } = planejarJuncao({
    repasseIds: ["b1"],
    paspatur: [pas("b1"), pas("b2")],
    repMeta: { escolas: { "COLEGIO X": 3 }, anos: { 2026: 3 }, escolasAno: { "COLEGIO X|2026": 3 } },
    pasMeta: { escolas: { "COLEGIO X": 2, "COLEGIO Y": 1 }, anos: { 2026: 3 }, escolasAno: { "COLEGIO X|2026": 2 } },
    importacoes: [
      { id: "i1", col: "paspatur", modulo: "paspatur", ids: ["b1", "b2"] },
      { id: "i2", col: "repasse", ids: ["z"] }
    ],
    exclusoes: [{ id: "paspatur_b1", col: "paspatur", docId: "b1", status: "pendente" }],
    edicoes: [{ id: "e1", col: "paspatur", alunoId: "b2" }]
  });
  const meta = ops.find(o => o.col === "config" && o.id === "repasse_meta").dados;
  assert.deepEqual(meta.escolas, { "COLEGIO X": 5, "COLEGIO Y": 1 });
  assert.equal(meta.anos[2026], 6);
  assert.equal(meta.escolasAno["COLEGIO X|2026"], 5);
  const imp = ops.filter(o => o.col === "importacoes");
  assert.equal(imp.length, 1);
  assert.deepEqual(imp[0].dados, { col: "repasse", modulo: "repasse", ids: ["b1_pas", "b2"] });
  assert.ok(ops.some(o => o.col === "exclusoes" && o.id === "repasse_b1_pas" && o.dados.docId === "b1_pas" && o.dados.col === "repasse"));
  assert.ok(ops.some(o => o.col === "exclusoes" && o.id === "paspatur_b1" && o.tipo === "d"));
  assert.deepEqual(ops.find(o => o.col === "edicoes").dados, { col: "repasse", alunoId: "b2" });
});

test("junção: sem nada no Paspatur, não grava nada", () => {
  assert.equal(planejarJuncao({ repasseIds: ["x"], paspatur: [] }).ops.length, 0);
});
