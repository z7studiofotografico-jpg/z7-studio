import { test } from "node:test";
import assert from "node:assert/strict";
import { sugerirDoTexto, lerData } from "../js/contrato-ficha.js";
import { anosParaVirar } from "../js/formatura-virada.js";
import { textoFormatura, preencher } from "../js/formatura-mensagens.js";

test("Ficha do contrato: datas em número e por extenso", () => {
  assert.equal(lerData("10/03/2026"), "2026-03-10");
  assert.equal(lerData("5.4.26"), "2026-04-05");
  assert.equal(lerData("Rio de Janeiro, 12 de março de 2026"), "2026-03-12");
  assert.equal(lerData("sem data"), "");
});

test("Ficha do contrato: sugere os campos a partir do texto do PDF", () => {
  const t =
    "CONTRATO Nº 045/2026 de prestação de serviços fotográficos. Turma com 120 formandos. " +
    "Valor total de R$ 48.000,00 dividido em 10 (dez) parcelas, sendo o primeiro vencimento em 05/03/2026. " +
    "A data da formatura será 12/12/2026 no Clube X. Rio de Janeiro, 20 de fevereiro de 2026.";
  const s = sugerirDoTexto(t);
  assert.equal(s.numero, "045/2026");
  assert.equal(s.valorTotal, "48.000,00");
  assert.equal(s.parcelas, 10);
  assert.equal(s.formandos, 120);
  assert.equal(s.primeiroVenc, "2026-03-05");
  assert.equal(s.dataFormatura, "2026-12-12");
  assert.equal(s.assinadoEm, "2026-02-20");
});

test("Ficha do contrato: texto vazio não sugere nada", () => {
  assert.deepEqual(sugerirDoTexto(""), {});
});

test("Virada da Formatura: o aviso só começa em 1º de fevereiro", () => {
  assert.deepEqual(anosParaVirar("2027-01-31"), []);
  assert.deepEqual(anosParaVirar("2027-02-01"), [2026, 2025]);
});

test("Mensagens da Formatura: a cobrança leva a chave Pix", () => {
  const m = preencher(textoFormatura({}, "cobranca"), {
    oi: "Bom dia",
    aluno: "Ana",
    colegio: "C.E. X",
    eu: "Adriano",
    oferta: "",
    pix: "21998817771"
  });
  assert.match(m, /21998817771/);
});
