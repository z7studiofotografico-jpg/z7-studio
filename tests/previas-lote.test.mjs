import { test } from "node:test";
import assert from "node:assert/strict";
import { pastasComFotos, nomesDeSaida } from "../js/previas-lote.js";

// pasta falsa no formato do File System Access (values() devolve arquivos e pastas)
const arq = name => ({ kind: "file", name });
const pasta = (name, itens) => ({
  kind: "directory",
  name,
  async *values() {
    yield* itens;
  }
});
test("prévias em lote: cada pasta com fotos é um aluno; nomes de saída sem repetir", async () => {
  const colegio = pasta("2026 - C.E. JOAO CARDOSO", [
    arq("Thumbs.db"),
    pasta("3001", [pasta("01 - MARIA SILVA", [arq("IMG_10.JPG"), arq("IMG_2.jpg"), arq("leia.txt")]), pasta("02 - ANA", [arq("a.png")])]),
    pasta("3002", [pasta("01 - MARIA SILVA", [arq("x.jpeg")]), pasta("vazia", [])])
  ]);
  const alunos = await pastasComFotos(colegio);
  assert.deepEqual(
    alunos.map(a => [a.nome, a.arquivos.map(f => f.name)]),
    [
      ["01 - MARIA SILVA", ["IMG_2.jpg", "IMG_10.JPG"]],
      ["02 - ANA", ["a.png"]],
      ["01 - MARIA SILVA", ["x.jpeg"]]
    ]
  );
  assert.deepEqual(nomesDeSaida(alunos), ["01 - MARIA SILVA", "02 - ANA", "3002 - 01 - MARIA SILVA"]);
});
test("nome do colégio a partir da pasta do servidor", async () => {
  const { nomeDoColegio } = await import("../js/previas-lote.js");
  assert.deepEqual(nomeDoColegio("2022-03-30 - C.E. YONNE MARIA SIQUEIRA - entregue"), { nome: "C.E. YONNE MARIA SIQUEIRA", ano: "2022" });
  assert.deepEqual(nomeDoColegio("2022-09-21 - SANTO ANTONIO - pronto"), { nome: "SANTO ANTONIO", ano: "2022" });
  assert.deepEqual(nomeDoColegio("C.E. TESTE 2026"), { nome: "C.E. TESTE 2026", ano: "" });
});
