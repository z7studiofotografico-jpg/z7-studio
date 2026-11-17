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

test("aluguel: 'Beca pelerine azul' no Tamanho = pelerine, tamanho único (sem aviso)", () => {
  const d = paraDocAluguel({ nome: "Ana", tamanho: "Beca pelerine azul", serie: "5º ano" }, { instId: "i1", ano: 2026 });
  assert.equal(d.becaTipo, "pelerineAzul");
  assert.equal(d.tamanho, "");
  assert.deepEqual(d.__falta, []);
  const k = paraDocAluguel(
    { nome: "Bia", pacote: "Kit 1", serie: "5º ano" },
    { instId: "i1", ano: 2026, contrato: { kits: [{ nome: "Kit 1", serie: "5º ano", itens: ["pelerine", "canudo"], valor: 95 }] } }
  );
  assert.equal(k.becaTipo, "pelerineAzul");
  assert.equal(k.valor, 95);
  assert.deepEqual(k.pacote, ["pelerine", "canudo"]);
  // pacote vazio: o Kit 1 da turma
  const v = paraDocAluguel(
    { nome: "Caio", tamanho: "PP", serie: "9º ano" },
    { instId: "i1", ano: 2026, contrato: { kits: [{ nome: "Kit 1", serie: "9º ano", itens: ["beca", "canudo"], valor: 100 }] } }
  );
  assert.equal(v.valor, 100);
  assert.deepEqual(v.pacote, ["beca", "canudo"]);
});

test("Kit “Sem item” entra em Não vai participar, sem kit e sem valor", async () => {
  const { paraDocAluguel } = await import("../js/aluguel-importar.js");
  const ext = { instId: "x", instNome: "X", ano: 2026, contrato: { kits: [{ nome: "Kit 1", serie: "", itens: ["beca"], valor: 90 }] } };
  for (const p of ["Sem item", "Não vai participar", "nenhum"]) {
    const d = paraDocAluguel({ nome: "A", pacote: p }, ext);
    assert.equal(d.naoParticipa, true);
    assert.deepEqual(d.pacote, []);
    assert.equal(d.valor, 0);
    assert.deepEqual(d.__falta, []);
  }
});
