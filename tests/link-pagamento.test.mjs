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
