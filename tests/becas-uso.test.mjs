import { test } from "node:test";
import assert from "node:assert/strict";
import { usoDeAluno, usoDeAvulso, acertoDoUso, separarUso, donosAlugueis, donosAvulsos } from "../js/becas-uso.js";
import { usoDosAlunos } from "../js/becas-estoque.js";

test("cópia do estoque: só números, só o que segura beca", () => {
  const a = { id: "a1", nome: "Maria", tel: "219", valor: 90, status: "Beca medida", becaTipo: "tradPreta", tamanho: "M", faixa: "azul" };
  const u = usoDeAluno(a);
  assert.equal(u.tipo, "aluno");
  assert.ok(!("nome" in u) && !("tel" in u) && !("valor" in u));
  assert.equal(usoDeAluno({ status: "Cadastrado" }), null);
  assert.equal(usoDeAluno({ status: "Devolvida" }), null);
  assert.equal(usoDeAluno({ status: "Beca medida", excluido: { em: "x" } }), null);
  // o estoque conta igual pela cópia
  assert.deepEqual(usoDosAlunos([u]).tamanhos, usoDosAlunos([a]).tamanhos);
  const v = usoDeAvulso({
    id: "v1",
    cliente: "Igreja",
    valor: 500,
    status: "reservado",
    retirada: "2026-12-01",
    devolucao: "2026-12-05",
    becasQtd: { tradPreta: 3, x: 0 },
    tamanhosQtd: { tradPreta: { M: 3 } }
  });
  assert.deepEqual(v.becasQtd, { tradPreta: 3 });
  assert.ok(!("cliente" in v) && !("valor" in v));
  assert.equal(usoDeAvulso({ status: "devolvido" }), null);
});

test("acerto: grava o que falta ou mudou e apaga o que não segura mais beca", () => {
  const alunos = [
    { id: "a1", status: "Beca medida", becaTipo: "t", tamanho: "M" },
    { id: "a2", status: "Devolvida" }
  ];
  const avulsos = [{ id: "v1", status: "retirado", becasQtd: { t: 2 } }];
  const copias = [Object.assign({ id: "aluno_a1" }, usoDeAluno(alunos[0])), { id: "aluno_a2", tipo: "aluno", status: "Beca medida" }];
  const r = acertoDoUso(alunos, avulsos, copias);
  assert.deepEqual(
    r.gravar.map(([id]) => id),
    ["avulso_v1"]
  );
  assert.deepEqual(r.apagar, ["aluno_a2"]);
  const s = separarUso([
    { id: "aluno_a1", tipo: "aluno" },
    { id: "avulso_v1", tipo: "avulso" }
  ]);
  assert.equal(s.alunos[0].id, "a1");
  assert.equal(s.avulsos[0].id, "v1");
});

test("donos: aluno com quem fechou o contrato; avulso com quem registrou", () => {
  const contratos = [{ instId: "i1", ano: 2026, respEmail: "Ana@x.com" }];
  const alunos = [
    { id: "a1", instId: "i1", ano: "2026" },
    { id: "a2", instId: "i1", ano: 2026, respEmail: "ana@x.com" },
    { id: "a3", instId: "i2", ano: 2026 },
    { id: "a4", instId: "i1", ano: 2025, respEmail: "bia@x.com" }
  ];
  // sem contrato: fica o dono que já tem (a4); sem nenhum, "" (a3)
  assert.deepEqual(donosAlugueis(alunos, contratos), [
    ["a1", "ana@x.com"],
    ["a3", ""]
  ]);
  // os sem dono e sem contrato passam para quem o admin disser
  assert.deepEqual(donosAlugueis([{ id: "a5", instId: "i2", ano: 2026, respEmail: "" }], contratos, "lu@x.com"), [["a5", "lu@x.com"]]);
  assert.deepEqual(donosAvulsos([{ id: "v1", porEmail: "Bia@x.com" }, { id: "v2" }, { id: "v3", respEmail: "x" }]), [
    ["v1", "bia@x.com"],
    ["v2", ""]
  ]);
});
