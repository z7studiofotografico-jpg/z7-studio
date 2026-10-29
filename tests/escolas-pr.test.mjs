import { test } from "node:test";
import assert from "node:assert/strict";
import { gruposEscolas, escolhaDe, contarEscolasAno, nomeDaEscola } from "../js/escolas-pr.js";

test("PR: uma linha por colégio e ano, juntando os jeitos de escrever o mesmo colégio", () => {
  const meta = {
    escolasAno: {
      "C.E C.E JOÃO CARDOSO|2026": 30,
      "e.e.joao Cardoso|2026": 6,
      "C. E. JOAO CARDOSO|2025": 48,
      "CIEP 225 MARIO QUINTANA|2024": 165,
      "CIEP225 - MARIO QUINTANA|2024": 2
    }
  };
  const g = gruposEscolas(meta, { "JOAO CARDOSO": "C.E. João Cardoso" });
  assert.deepEqual(
    g.map(x => [x.rotulo, x.n]),
    [
      ["2026 - C.E. João Cardoso", 36],
      ["2025 - C.E. João Cardoso", 48],
      ["2024 - CIEP 225 Mario Quintana", 167]
    ]
  );
  const e = escolhaDe(g[0].valor, g);
  assert.equal(e.ano, 2026);
  assert.deepEqual(e.nomes.sort(), ["C.E C.E JOÃO CARDOSO", "e.e.joao Cardoso"]);
  // Linha de Frente: só o ano atual
  assert.equal(gruposEscolas(meta, {}, a => a >= 2026).length, 1);
  assert.equal(nomeDaEscola({ "C.E C.E JOÃO CARDOSO": 3 }), "C.E. João Cardoso");
});
test("conta os alunos por escola e ano", () => {
  assert.deepEqual(
    contarEscolasAno([{ escola: "A", ano: 2025 }, { escola: "A", ano: 2025 }, { escola: "B", ano: 2024 }, { escola: "C" }]),
    {
      "A|2025": 2,
      "B|2024": 1
    }
  );
});
