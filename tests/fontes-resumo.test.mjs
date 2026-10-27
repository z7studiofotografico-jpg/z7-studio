import { test } from "node:test";
import assert from "node:assert/strict";
import { lerFontes } from "../js/fontes-resumo.js";
import { resumir } from "../js/calc.js";

// banco de mentira: aplica os filtros como o Firestore
const banco = {
  formandos: [
    { id: "aberto", proxVenc: "2026-11-05", vendidoEm: "2020-01-01", pagamentos: [] },
    {
      id: "quitadoRecente",
      proxVenc: "",
      vendidoEm: "2023-01-01",
      ultimoPag: "2026-05-05",
      pagamentos: [{ data: "2026-05-05", valor: 10 }]
    },
    { id: "quitadoAntigo", proxVenc: "", vendidoEm: "2019-01-01", ultimoPag: "2020-01-05", pagamentos: [] },
    { id: "desistiu", proxVenc: "", status: "desistiu", vendidoEm: "2022-01-01", devolucao: { em: "2026-02-01", valor: 7 } }
  ],
  repasse: [
    { id: "pago", etapa: "PAGO", pagoEm: "2026-03-01" },
    { id: "naoQuer", etapa: "NÃO QUER", pagoEm: "2026-03-01" },
    { id: "pagoAntigo", etapa: "ENTREGUE", pagoEm: "2019-03-01" }
  ],
  becas: [
    { id: "b1", retirada: "2026-04-01", criadoEm: "2026-03-20" },
    { id: "b2", criadoEm: "2018-01-01" }
  ]
};
const pega = (o, c) => c.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const ler = async (c, filtros) =>
  (banco[c] || []).filter(x =>
    filtros.every(([a, o, v]) => {
      const y = pega(x, a);
      return o === ">=" ? y != null && y >= v : o === "!=" ? y !== undefined && y !== v : true;
    })
  );

test("resumo lê só o que mexe nos 24 meses e o que está em aberto", async () => {
  const f = await lerFontes(ler, "2026-10-27");
  assert.deepEqual(f.forms.map(x => x.id).sort(), ["aberto", "desistiu", "quitadoRecente"]);
  assert.deepEqual(
    f.prs.map(x => x.id),
    ["pago"]
  );
  assert.deepEqual(
    f.becas.map(x => x.id),
    ["b1"]
  );
  const r = resumir(f, "2026-10-27");
  assert.equal(r.meses["2026-05"].form.recAlb, 1000);
  assert.equal(r.meses["2026-02"].form.devolvido, 700);
});
test("antes da atualização de dados v7: lê todos os formandos (sem perder quem não tem ultimoPag)", async () => {
  const f = await lerFontes(ler, "2026-10-27", 6);
  assert.equal(f.forms.length, 4);
});
