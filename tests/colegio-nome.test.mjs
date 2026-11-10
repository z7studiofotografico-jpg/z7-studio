import { test } from "node:test";
import assert from "node:assert/strict";
import { colegioNoCadastro, siglaDoColegio, nomeDoColegio } from "../js/colegio-nome.js";

const insts = [
  { nome: "C.E. Nuta Bartlet James" },
  { nome: "E.M. Cyro Monteiro" },
  { nome: "C.E. Yonne Maria Siqueira de Andrade" },
  { nome: "C.E. Diuma Madeira Salles de Souza" },
  { nome: "E.M. Alexandre Farah" },
  { nome: "Escola Legacy School - Nilópolis", sigla: "LSN" },
  { nome: "Escola Legacy School - Nova Iguaçu" },
  { nome: "C.E. João Cardoso" },
  { nome: "E.M. João Cardoso" }
];

test("nome do colégio pelo cadastro: completa o nome curto da planilha", () => {
  assert.equal(nomeDoColegio("C.E NUTA BARTLET", insts), "C.E. Nuta Bartlet James");
  assert.equal(nomeDoColegio("Nuta Bartlet James", insts), "C.E. Nuta Bartlet James");
  assert.equal(nomeDoColegio("Cyro Monteiro", insts), "E.M. Cyro Monteiro");
  assert.equal(nomeDoColegio("C.M Cyro Monteiro", insts), "E.M. Cyro Monteiro");
  assert.equal(nomeDoColegio("C.E Yonne Maria Siqueira Andrade", insts), "C.E. Yonne Maria Siqueira de Andrade");
  assert.equal(nomeDoColegio("GET E.M Alexandre Farah", insts), "E.M. Alexandre Farah");
  assert.equal(nomeDoColegio("C.E João Cardoso", insts), "C.E. João Cardoso");
});
test("nome do colégio: não troca quando não tem certeza", () => {
  // outro colégio (Profª … Sales ≠ Salles de Souza)
  assert.equal(nomeDoColegio("C.E Profª Diuma Madeira Sales", insts), "C.E Profª Diuma Madeira Sales");
  // dois colégios batem (Legacy Nilópolis e Nova Iguaçu)
  assert.equal(colegioNoCadastro("Legacy School", insts), null);
  // João Cardoso sem dizer se é estadual ou municipal: dois batem
  assert.equal(colegioNoCadastro("João Cardoso", insts), null);
  // uma palavra só não basta
  assert.equal(colegioNoCadastro("Nuta", insts), null);
});
test("sigla do colégio: a do cadastro ou a das iniciais do nome certo", () => {
  assert.equal(siglaDoColegio("C.E NUTA BARTLET", insts), "CENBJ");
  assert.equal(siglaDoColegio("Cyro Monteiro", insts), "EMCM");
  assert.equal(siglaDoColegio("Escola Legacy School - Nilópolis", insts), "LSN");
  assert.equal(siglaDoColegio("C.E Profª Diuma Madeira Sales", insts), "CEPDMS");
});
