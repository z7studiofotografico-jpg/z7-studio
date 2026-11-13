import { test } from "node:test";
import assert from "node:assert/strict";
import { corInst, mesmoColegio, gruposDoColegio } from "../js/inst-janela.js";

test("cor da linha do colégio", () => {
  assert.equal(corInst({ etapa: "FECHADO" }, "won"), "verde");
  assert.equal(corInst({ etapa: "VISITADO" }, "late"), "vermelho");
  assert.equal(corInst({ etapa: "A VISITAR" }, "today"), "amarelo");
  assert.equal(corInst({ etapa: "A VISITAR" }, "none"), "cinza");
  assert.equal(corInst({ etapa: "NÃO FECHOU" }, "late"), "fim");
  assert.equal(corInst({ etapa: "VISITADO", arquivado: true }, "today"), "fim");
});

test("mesmo colégio pelo nome", () => {
  assert.ok(mesmoColegio("NUTA BARTLET JAMES", "NUTA BARTLET JAMES"));
  assert.ok(mesmoColegio("NUTA BARTLET", "NUTA BARTLET JAMES"));
  assert.ok(!mesmoColegio("ANA", "ANA NERY"), "nome curto demais não junta");
  assert.ok(!mesmoColegio("JOAO CARDOSO", "MARIA CARDOSO"));
  assert.ok(!mesmoColegio("", "X"));
});

test("alunos do colégio no PR, por ano", () => {
  const meta = {
    escolasAno: {
      "C.E. João Cardoso|2026": 30,
      "C.E C.E JOÃO CARDOSO|2026": 2,
      "C.E. João Cardoso|2024": 12,
      "Escola Legacy School - Nilópolis|2026": 40
    }
  };
  const g = gruposDoColegio(meta, "Colégio Estadual João Cardoso");
  assert.deepEqual(
    g.map(x => [x.ano, x.n]),
    [
      [2026, 32],
      [2024, 12]
    ]
  );
  assert.equal(g[0].valor.split("|")[0], "2026");
  assert.equal(gruposDoColegio({}, "Qualquer").length, 0);
});

test("filtros do relatório do aluguel de becas", async () => {
  const { filtrarRelatorio } = await import("../js/aluguel-relatorio.js");
  const l = [
    { nome: "A", ano: 2026, instId: "c1", serie: "9º ANO", status: "Cadastrado" },
    { nome: "B", ano: 2026, instId: "c1", serie: "5º ANO", status: "Retirou a beca", devolucao: "2026-01-01" },
    { nome: "C", ano: 2026, instId: "c2", serie: "9º ANO", status: "Devolvida" },
    { nome: "D", ano: 2025, instId: "c1", serie: "9º ANO" }
  ];
  const n = f =>
    filtrarRelatorio(l, f, "2026-11-10")
      .map(a => a.nome)
      .join("");
  assert.equal(n({}), "ABCD");
  assert.equal(n({ ano: "2026", inst: "c1" }), "AB");
  assert.equal(n({ ano: "2026", turma: "9º ANO" }), "AC");
  assert.equal(n({ sit: "atrasados" }), "B");
  assert.equal(n({ sit: "andamento", ano: "2026" }), "AB");
  assert.equal(n({ sit: "Cadastrado" }), "AD");
});
