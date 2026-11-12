import { test } from "node:test";
import assert from "node:assert/strict";
import { menorLivre, soNumero, telDaFicha, contatosDaFicha, chaveGrupo } from "../js/fichas.js";

test("fichas: número livre mais perto do 1, sem pular nem repetir", () => {
  assert.equal(menorLivre(new Set([1, 2, 4])), 3);
  assert.equal(menorLivre(new Set([])), 1);
  assert.equal(menorLivre(new Set([2, 3])), 1);
});
test("fichas: número da ficha (CIEP 433 não é número de aluno quando vem só a sigla? lê os dígitos)", () => {
  assert.equal(soNumero("12"), 12);
  assert.equal(soNumero(""), null);
  assert.equal(soNumero("abc"), null);
  assert.equal(soNumero("CIEP 433"), null); // a ficha do Gustavo: o colégio no quadro, não o número
  assert.equal(soNumero("nº 7"), 7);
});
test("fichas: telefone com DDD 21 quando vem sem; contatos com telefone", () => {
  assert.equal(telDaFicha("97356-6011"), "21973566011");
  assert.equal(telDaFicha("21 97356 6011"), "21973566011");
  assert.equal(telDaFicha("123"), "");
  const c = contatosDaFicha({ nome: "Gustavo", celAluno: "21973566011", mae: "Solange", celMae: "21967544923", pai: "", celPai: "" });
  assert.deepEqual(
    c.map(x => x.tipo + ":" + x.tel),
    ["Formando:21973566011", "Mãe:21967544923"]
  );
  assert.equal(chaveGrupo("CIEP 433 - Togo", 2026), "CIEP-433-TOGO_2026");
});
