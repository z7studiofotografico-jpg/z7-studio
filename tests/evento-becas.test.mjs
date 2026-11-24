import { test } from "node:test";
import assert from "node:assert/strict";
import { usoDeEvento, separarUso, usoNoPeriodo, conferirPedido, pedidoDosAlunos, acertoDoUso } from "../js/becas-uso.js";

const inst = { id: "pec", nome: "Escola Pec" };
const ev = {
  data: "2026-12-07",
  status: "confirmado",
  becas: { becasQtd: { tradPreta: 3 }, tamanhosQtd: { tradPreta: { P: 2, M: 1 } }, devolucao: "2026-12-16" }
};

test("agendamento vira cópia do estoque com as datas", () => {
  const u = usoDeEvento(inst, "diaBecas", ev);
  assert.equal(u.tipo, "evento");
  assert.equal(u.retirada, "2026-12-07");
  assert.equal(u.devolucao, "2026-12-16");
  assert.deepEqual(u.tamanhosQtd, { tradPreta: { P: 2, M: 1 } });
  assert.equal(usoDeEvento(inst, "diaBecas", { data: "2026-12-07", becas: { becasQtd: {} } }), null);
});

test("o agendamento toma o lugar dos alunos do mesmo colégio e ano", () => {
  const copias = [
    { id: "aluno_1", tipo: "aluno", status: "Beca medida", becaTipo: "tradPreta", tamanho: "P", instId: "pec", ano: 2026 },
    { id: "aluno_2", tipo: "aluno", status: "Beca medida", becaTipo: "tradPreta", tamanho: "P", instId: "outro", ano: 2026 },
    Object.assign({ id: "evento_pec_diaBecas" }, usoDeEvento(inst, "diaBecas", ev))
  ];
  const s = separarUso(copias);
  assert.deepEqual(
    s.alunos.map(a => a.id),
    ["2"]
  );
  assert.equal(s.eventos.length, 1);
  // (23/11/2026) as becas valem por dia: conta só no dia da entrega; aluno sem dia (colégio sem agenda) não conta
  const noDia = usoNoPeriodo(copias, "2026-12-07", "", "x");
  assert.equal(noDia.uso.tamanhos.tradPreta.P, 2);
  const outroDia = usoNoPeriodo(copias, "2026-12-10", "", "x");
  assert.equal((outroDia.uso.tamanhos.tradPreta || {}).P, undefined);
  // o próprio agendamento não conta contra ele
  assert.equal((usoNoPeriodo(copias, "2026-12-07", "", "evento_pec_diaBecas").uso.tamanhos.tradPreta || {}).P, undefined);
});

test("confere o pedido com o estoque e mostra o que falta", () => {
  const E = { becas: { tradPreta: 10 }, tamanhos: { tradPreta: { P: 3, M: 5 } } };
  const uso = { becas: {}, tamanhos: { tradPreta: { P: 2 } }, faixas: {}, capelos: {} };
  const l = conferirPedido(E, uso, { becasQtd: { tradPreta: 4 }, tamanhosQtd: { tradPreta: { P: 3, M: 1 } } });
  assert.deepEqual(
    l.find(x => x.rot.endsWith(" P")),
    { rot: "Beca tradicional preta P", pede: 3, livre: 1, falta: 2 }
  );
  assert.equal(l.find(x => x.rot.endsWith(" M")).falta, 0);
});

test("quantidades a partir dos alunos e acerto não apaga agendamentos", () => {
  const p = pedidoDosAlunos([
    { becaTipo: "tradPreta", tamanho: "P", faixa: "azul_fina" },
    { becaTipo: "tradPreta" },
    { becaTipo: "tradPreta", tamanho: "M", naoParticipa: true }
  ]);
  assert.equal(p.becasQtd.tradPreta, 2);
  assert.equal(p.semMedida, 1);
  assert.equal(p.faixasQtd.azul_fina, 1);
  const { apagar } = acertoDoUso([], [], [{ id: "evento_pec_diaBecas", tipo: "evento" }]);
  assert.deepEqual(apagar, []);
});
