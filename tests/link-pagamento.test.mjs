import { test } from "node:test";
import assert from "node:assert/strict";
import { mensagemPagamento } from "../js/link-pagamento.js";

test("link de pagamento: a mensagem leva a página do aluno (não o link fixo) e os valores", () => {
  const m = mensagemPagamento({ nome: "TALLITA" }, "abcdefghjk", { pixVal: 350, valCartao: 377, parc: "até 10x sem juros" });
  assert.match(m, /z7studio\.com\.br\/previa\/\?c=abcdefghjk/);
  assert.match(m, /Pix/);
  assert.match(m, /cartão, até 10x sem juros/);
  assert.doesNotMatch(m, /comprovante/);
});

test("sinal do ensaio pago pelo link: fecha o lead conferido, sem mexer no valor do ensaio", async () => {
  const { patchSinal, ONDE } = await import("../js/pagamentos-site.js");
  const p = patchSinal({ valor: 10000, forma: "pix", transaction_nsu: "t1" }, "2026-11-25", { etapa: "FOLLOW-UP", valor: 450 });
  assert.equal(p.etapa, "FECHADO");
  assert.equal(p.conferido, true);
  assert.equal(p.sinalPago.valor, 100);
  assert.equal(p.valor, undefined);
  assert.deepEqual(Object.keys(patchSinal({ valor: 100 }, "2026-11-25", { etapa: "FECHADO" })), ["sinalPago"]);
  assert.ok(ONDE.some(([c, k]) => c === "leads" && k === "linkSinal"));
});
