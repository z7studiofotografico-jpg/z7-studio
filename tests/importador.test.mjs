import { test } from "node:test";
import assert from "node:assert/strict";
import { mapearColunas, acharCabecalho, statusDaPlanilha, idComAno, docComAno } from "../js/importador.js";
import { CAMPOS_ALUGUEL, paraDocAluguel, lerTamanho } from "../js/aluguel-importar.js";

test("importação: colunas em qualquer ordem, por nome e sinônimo; mapeamento lembrado vale primeiro", () => {
  const cab = ["OBS", "Formando", "Celular 1", "TAMANHO", "coluna estranha"];
  assert.deepEqual(mapearColunas(cab, CAMPOS_ALUGUEL), ["obs", "nome", "tel", "tamanho", ""]);
  assert.deepEqual(mapearColunas(cab, CAMPOS_ALUGUEL, { COLUNAESTRANHA: "faixa", OBS: "_ignorar" }), [
    "",
    "nome",
    "tel",
    "tamanho",
    "faixa"
  ]);
  assert.equal(acharCabecalho([["Lista da turma"], [], ["Nome", "Tamanho", "Faixa"], ["Ana", "P1", "azul fina"]], CAMPOS_ALUGUEL), 2);
});
test("status da planilha: CAIDO vira Caído", () => {
  assert.equal(statusDaPlanilha("11 CAIDO"), "Caído");
  assert.equal(statusDaPlanilha("CAÍDO 03"), "Caído");
  assert.equal(statusDaPlanilha("VENDA ANTECIPADA"), "Vendido");
});
test("aluguel: linha da planilha vira aluno (P1 = P menos longa; faixa e capelo pelo nome; valor 0 = contrato zerado)", () => {
  assert.deepEqual(lerTamanho("p1"), { tamanho: "P", menosLonga: true, idade: "adulto" });
  assert.deepEqual(lerTamanho("P ADULTO"), { tamanho: "P", menosLonga: false, idade: "adulto" });
  assert.deepEqual(lerTamanho("Infantil m"), { tamanho: "M", menosLonga: false, idade: "infantil" });
  assert.deepEqual(lerTamanho("GG"), { tamanho: "GG", menosLonga: false, idade: "" });
  const d = paraDocAluguel(
    { nome: " Ana ", tamanho: "M1", faixa: "Azul fina", capelo: "preto", valor: "" },
    { instId: "i1", instNome: "C.E. Alfa", ano: "2026" }
  );
  assert.equal(d.nome, "Ana");
  assert.equal(d.tamanho, "M");
  assert.equal(d.menosLonga, true);
  assert.equal(d.faixa, "azul_fina");
  assert.equal(d.capelo, "preto");
  assert.equal(d.contratoZerado, true);
  assert.deepEqual(d.__falta, []);
  assert.deepEqual(paraDocAluguel({ nome: "B", tamanho: "ZZ" }, {}).__falta, [
    "instituição (escolha acima)",
    "tamanho “ZZ” não reconhecido"
  ]);
});

test("mudar ano: ID e código do aluno trocam de ano; Linha de Frente vira Repasse no ano passado", () => {
  assert.equal(idComAno("7973_c-e-joao-paulo-ii_100_dioneti", 2025), "7974_c-e-joao-paulo-ii_100_dioneti");
  const d = docComAno({ ano: 2026, codigo: "26CJPI-100", seg: "lf", nome: "Ana" }, 2025, new Date("2026-11-07T12:00:00Z"));
  assert.equal(d.ano, 2025);
  assert.equal(d.codigo, "25CJPI-100");
  assert.equal(d.codigoBusca, "25CJPI100");
  assert.equal(d.seg, "rep");
  assert.equal(d.nome, "Ana");
});
