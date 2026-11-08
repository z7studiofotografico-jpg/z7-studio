import { test } from "node:test";
import assert from "node:assert/strict";
import { colegioPaga, vendidoPeloColegio, passaParaVendido } from "../js/colegio-paga.js";
import { situacaoTxt, enderecoTxt } from "../js/repasse-dados.js";
import { chaveColegio } from "../js/historico-dados.js";

test("colégio que paga: acha pelo nome (com abreviação e nome mais longo), sem confundir números", () => {
  const ch = new Set([chaveColegio("C.E. Yonne Maria Siqueira"), chaveColegio("CIEP 155")]);
  assert.equal(colegioPaga(ch, "C.E YONNE MARIA SIQUEIRA DE ANDRADE"), true);
  assert.equal(colegioPaga(ch, "CIEP 155"), true);
  assert.equal(colegioPaga(ch, "CIEP 156"), false);
  assert.equal(colegioPaga(ch, ""), false);
});
test("aluno vendido pelo colégio: pago, conferido, sem valor nem vendedor, entrega no colégio", () => {
  const v = vendidoPeloColegio("2026-11-08", "adm@x.com");
  assert.equal(v.etapa, "PAGO");
  assert.equal(v.valor, 0);
  assert.equal(v.conferido, true);
  assert.equal(v.respEmail, "");
  assert.equal(v.entregaTipo, "Entrega no colégio");
  assert.equal(situacaoTxt(Object.assign({}, v), "none"), "Pago pelo colégio · entrega no colégio");
  assert.equal(enderecoTxt(Object.assign({ endereco: { rua: "Rua A", bairro: "B", cidade: "C" } }, v)), "");
  // quem já comprou ou é histórico não muda
  assert.equal(passaParaVendido({ etapa: "NA FILA" }), true);
  assert.equal(passaParaVendido({ etapa: "ENTREGUE" }), false);
  assert.equal(passaParaVendido({ etapa: "CAÍDO", historico: true }), false);
});
