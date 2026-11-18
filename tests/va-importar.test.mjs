import test from "node:test";
import assert from "node:assert/strict";
import { lerPlanilhaVA, kitDoTotal, situacaoDaObs, colunasDeMes } from "../js/va-importar-regras.js";
import { KITS_PADRAO } from "../js/contrato.js";

test("colunas de mês: dia 05 e virada do ano (janeiro em diante é o ano seguinte)", () => {
  const m = colunasDeMes(["FORMANDO", "PG. 05 JUNHO", "PG DEZEMBRO", "PG JANEIRO", "PG MARÇO"], 2026);
  assert.deepEqual(
    m.map(x => x.data),
    ["2026-06-05", "2026-12-05", "2027-01-05", "2027-03-05"]
  );
});
test("kit pelo total: exato, perto (negociação) e pelos itens", () => {
  assert.equal(kitDoTotal(65, KITS_PADRAO).id, "k01");
  assert.equal(kitDoTotal(369, KITS_PADRAO).id, "k02");
  assert.equal(kitDoTotal(376.38, KITS_PADRAO).id, "k02");
  assert.equal(kitDoTotal(801, KITS_PADRAO, { album170: true }).id, "k04");
  assert.equal(kitDoTotal(700, KITS_PADRAO, { quadro: true }).id, "k03");
});
test("OBS: quitou, pagou, atrasado e o resto para conferir", () => {
  assert.equal(situacaoDaObs("Quitou"), "quitou");
  assert.equal(situacaoDaObs("pagou"), "pagou");
  assert.equal(situacaoDaObs("atrasado"), "atrasado");
  assert.equal(situacaoDaObs("boleto enviado"), "conferir");
});
test("linha → aluno: parcelas pagas até o mês atual, contatos e Linha de Frente para o Kit 01", () => {
  const cab = [
    "BECA",
    "TURMA",
    "ID",
    "FORMANDO",
    "CELULAR 1",
    "CEL 2 MAE",
    "REPONSAVEL",
    "FOTOS",
    "OBS",
    "PG. 05 JUNHO",
    "PG JULHO",
    "PG AGOSTO"
  ];
  const r = lerPlanilhaVA(
    cab,
    [
      ["P", 3001, "CETP - 01", "ANA", 21990000001, 21980000000, "MAE ANA", 1, "pagou", 41, 41, 41],
      ["M", 3002, "CETP - 02", "BIA", 21990000002, "", "", 1, "atrasado", 41, 41, 41],
      ["G", 3002, "CETP - 03", "CAIO", 21990000003, "", "", "-", "pagou", "", 65, ""],
      ["", "", "", "*INFORME:* recado longo que não é aluno", "", "", "", "", "", "", "", ""]
    ],
    { kits: KITS_PADRAO, ano: 2026, hoje: "2026-07-20" }
  );
  assert.equal(r.alunos.length, 3);
  const [ana, bia, caio] = r.alunos;
  assert.equal(ana.doc.pagas, 2); // junho e julho (até o vencimento deste mês)
  assert.equal(bia.doc.pagas, 1); // atrasado: falta a deste mês
  assert.equal(ana.doc.codigo, "26CETP-01");
  assert.deepEqual(
    ana.doc.contatos.map(c => c.tipo + ":" + c.nome),
    ["Formando:ANA", "Mãe:MAE ANA"]
  );
  assert.equal(caio.doc.kitId, "k01");
  assert.equal(caio.lf, true);
  assert.equal(ana.lf, false);
});
