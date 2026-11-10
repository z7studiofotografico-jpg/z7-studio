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
