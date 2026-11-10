import { test } from "node:test";
import assert from "node:assert/strict";
import { planejarIds, numeroDoId } from "../scripts/acertar-ids-plano.mjs";

const insts = [{ nome: "C.E. Nuta Bartlet James" }, { nome: "E.M. Cyro Monteiro" }, { nome: "E.M. Antenor Nascente" }];

test("número do ID", () => {
  assert.equal(numeroDoId("26CNB-02"), 2);
  assert.equal(numeroDoId("EMCM 73"), 73);
  assert.equal(numeroDoId("CERF 52"), 52);
  assert.equal(numeroDoId("7"), 7);
  assert.equal(numeroDoId(""), null);
  assert.equal(numeroDoId("SEM ID"), null);
});

test("acertar IDs: sigla com o E, ano na frente e nome do cadastro", () => {
  const { ops, grupos } = planejarIds(
    [
      { id: "a", escola: "C.E. Nuta Bartlet", ano: 2026, codigo: "26CNB-02" },
      { id: "b", escola: "E. M. Antenor Nascente", ano: 2025, codigo: "25MAN-01" },
      { id: "c", escola: "C.M Cyro Monteiro", ano: 2023, codigo: "EMCM 73" },
      { id: "d", escola: "C.E Rubens Farrula", ano: 2023, codigo: "CERF 52" },
      { id: "e", escola: "E.M. Alexandre Farah", ano: 2021, codigo: "21EMAF-01" }
    ],
    insts,
    { "26CENBJ": 5 }
  );
  const p = id => (ops.find(o => o.col === "repasse" && o.id === id) || {}).dados;
  assert.deepEqual(p("a"), {
    escola: "C.E. Nuta Bartlet James",
    escolaOrig: "C.E. Nuta Bartlet",
    codigo: "26CENBJ-02",
    codigoBusca: "26CENBJ02",
    codigoAntigo: "26CNB-02"
  });
  assert.equal(p("b").codigo, "25EMAN-01");
  assert.equal(p("b").escola, "E.M. Antenor Nascente"); // escrito igual ao cadastro
  assert.equal(p("c").codigo, "23EMCM-73");
  assert.equal(p("c").escola, "E.M. Cyro Monteiro");
  assert.equal(p("d").codigo, "23CERF-52");
  assert.equal(p("e"), undefined, "2021 já estava certo");
  // contador: 26CENBJ já estava em 5 (não volta); 25EMAN vai para 1
  assert.ok(!ops.some(o => o.col === "ids" && o.id === "26CENBJ"));
  assert.ok(ops.some(o => o.col === "ids" && o.id === "25EMAN" && o.dados.ultimo === 1));
  const meta = ops.find(o => o.col === "config").dados;
  assert.equal(meta.escolasAno["C.E. Nuta Bartlet James|2026"], 1);
  assert.equal(meta.escolasAno["E.M. Alexandre Farah|2021"], 1);
  assert.ok(grupos.some(g => g.siglaDe === "CNB" && g.siglaPara === "CENBJ"));
});

test("acertar IDs: rodar de novo não muda nada", () => {
  const { ops } = planejarIds(
    [{ id: "a", escola: "C.E. Nuta Bartlet James", ano: 2026, codigo: "26CENBJ-02", escolaOrig: "C.E. Nuta Bartlet" }],
    insts,
    {
      "26CENBJ": 2
    }
  );
  assert.equal(ops.length, 0);
});
