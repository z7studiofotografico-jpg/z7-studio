import { test } from "node:test";
import assert from "node:assert/strict";
import { separarPorFicha, nomePasta, nomesDasFotos, abreviarNome } from "../js/fichas-separar.js";

test("separa os alunos pela foto da ficha (fotos reais do Manoel Gomes, 0910 a 0920)", () => {
  const papel = new Set(["_MG_0910.JPG", "_MG_0913.JPG", "_MG_0914.JPG", "_MG_0917.JPG"]);
  const nomes = Array.from({ length: 11 }, (_, i) => `_MG_${910 + i}`.replace("_MG_", "_MG_0") + ".JPG");
  const { grupos, antes } = separarPorFicha(nomes.map(name => ({ name, papel: papel.has(name) })));
  assert.deepEqual(antes, []);
  assert.equal(grupos.length, 3);
  assert.deepEqual(grupos[0].fotos, ["_MG_0910.JPG", "_MG_0911.JPG", "_MG_0912.JPG"]);
  // 0913 e 0914: o mesmo aluno segurou a ficha duas vezes
  assert.deepEqual(grupos[1].fichas, ["_MG_0913.JPG", "_MG_0914.JPG"]);
  assert.deepEqual(grupos[1].fotos, ["_MG_0913.JPG", "_MG_0914.JPG", "_MG_0915.JPG", "_MG_0916.JPG"]);
  assert.equal(grupos[2].fotos.length, 4);
});
test("ficha marcada à mão começa outro aluno, mesmo logo depois de outra ficha", () => {
  const r = separarPorFicha([{ name: "a", papel: true }, { name: "b", papel: 2 }, { name: "c" }]);
  assert.deepEqual(r.grupos.map(g => g.fotos), [["a"], ["b", "c"]]);
});
test("fotos antes da 1ª ficha ficam de fora", () => {
  const r = separarPorFicha([{ name: "a.jpg" }, { name: "b.jpg", papel: true }, { name: "c.jpg" }]);
  assert.deepEqual(r.antes, ["a.jpg"]);
  assert.deepEqual(r.grupos[0].fotos, ["b.jpg", "c.jpg"]);
});
test("nome da pasta e das fotos no padrão do estúdio", () => {
  assert.equal(nomePasta("26CIEP336-01", "Davi Siqueira Soares"), "26 -CIEP336- 01 - DAVI SIQUEIRA SOARES");
  assert.deepEqual(nomesDasFotos("26 -CIEP336- 01 - DAVI SIQUEIRA SOARES", ["_MG_0911.JPG", "_MG_0910.JPG"]), [
    ["_MG_0910.JPG", "26 -CIEP336- 01 - DAVI SIQUEIRA SOARES (1).JPG"],
    ["_MG_0911.JPG", "26 -CIEP336- 01 - DAVI SIQUEIRA SOARES (2).JPG"]
  ]);
});
test("nome grande é abreviado para caber no Windows", () => {
  assert.equal(abreviarNome("Davi Siqueira Soares"), "DAVI SIQUEIRA SOARES");
  const a = abreviarNome("Maria Eduarda Ferreira dos Santos da Silva Oliveira");
  assert.ok(a.length <= 30, a);
  assert.ok(a.startsWith("MARIA") && a.endsWith("OLIVEIRA"), a);
  assert.equal(abreviarNome("Maria Eduarda Ferreira dos Santos Silva"), "MARIA EDUARDA F. S. SILVA");
  assert.equal(nomePasta("26CIEP336-09", "Mariah Eduarda Fernandes dos Santos Pereira"), "26 -CIEP336- 09 - MARIAH EDUARDA F. S. PEREIRA");
  assert.ok(!/[\\/:*?"<>|]/.test(nomePasta("26X-01", 'Ana / "Bia"')));
});
