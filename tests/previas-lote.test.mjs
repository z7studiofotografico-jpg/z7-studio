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

test("prévias em lote: quem já comprou fica de fora (pelo nome e pelo número)", async () => {
  const { pastasDeQuemComprou } = await import("../js/previas-lote.js");
  const pastas = [{ nome: "CEYMS 01 - MARIA SILVA" }, { nome: "CEYMS 02 - ANA COSTA" }, { nome: "CEYMS 03 - JOAO" }];
  const app = [
    { nome: "MARIA SILVA", etapa: "ENTREGUE" },
    { nome: "ANA COSTA", etapa: "NA FILA" },
    { nome: "JOAO PEDRO", etapa: "SEM TELEFONE" }
  ];
  const fora = pastasDeQuemComprou(pastas, app);
  assert.deepEqual(
    [...fora].map(p => p.nome),
    ["CEYMS 01 - MARIA SILVA"]
  );
  assert.equal(pastasDeQuemComprou(pastas, app, true).size, 2);
});

test("prévias em lote: o motivo de cada foto que não saiu, com o que fazer", async () => {
  const { motivoErro } = await import("../js/previas-lote.js");
  assert.match(motivoErro({ name: "NotFoundError" }, "a.jpg", null, "11 - MARCELLA "), /termina com espaço ou ponto/);
  assert.match(motivoErro({ name: "NotFoundError" }, "a.jpg"), /comprido demais para o Windows/);
  assert.match(motivoErro({ name: "NotReadableError" }, "a.jpg"), /não deixou ler/);
  assert.match(motivoErro(new Event("error"), "a.jpg", 0), /vazio/);
  assert.match(motivoErro(new Event("error"), "a.jpg", 500000), /não abre no navegador/);
});

test("prévias em lote: nomes que o Windows não abre", async () => {
  const { motivoErro } = await import("../js/previas-lote.js");
  assert.match(motivoErro({ name: "NotFoundError" }, "a?.jpg"), /caractere que o Windows não aceita/);
  assert.match(motivoErro({ name: "NotFoundError" }, "a.jpg", null, "KAUÁ"), /acento gravado em outro formato/);
});

test("prévias: a pasta aberta pela janela comum vira a mesma estrutura (pastas e fotos)", async () => {
  const { pastaDeArquivos, pastasComFotos } = await import("../js/previas-lote.js");
  const f = (cam, name) => ({ name, webkitRelativePath: cam + "/" + name });
  const raiz = pastaDeArquivos([
    f("LEGACY/00 - Ana Maria  da Silva.", "IMG 1.JPG"),
    f("LEGACY/00 - Ana Maria  da Silva.", "IMG 2.jpg"),
    f("LEGACY/Beto", "x.png")
  ]);
  const alunos = await pastasComFotos(raiz);
  assert.equal(raiz.name, "LEGACY");
  assert.deepEqual(
    alunos.map(a => [a.nome, a.arquivos.map(x => x.name)]),
    [
      ["00 - Ana Maria  da Silva.", ["IMG 1.JPG", "IMG 2.jpg"]],
      ["Beto", ["x.png"]]
    ]
  );
});

test("prévias livres: o nome da pasta fica exatamente como está", async () => {
  const { nomesDeSaida } = await import("../js/previas-lote.js");
  assert.deepEqual(nomesDeSaida([{ nome: "00 - Ana  Maria (IRMÃ DO 38).", caminho: ["x"] }], true), ["00 - Ana  Maria (IRMÃ DO 38)."]);
});

test("prévias livres: fotos soltas na pasta escolhida viram uma prévia por foto; pasta por aluno continua junta", async () => {
  const { umaPorFoto } = await import("../js/previas-lote.js");
  const h = n => ({ name: n });
  const r = umaPorFoto([
    { nome: "00 - LEGACY", caminho: [], arquivos: [h("ANA SOUZA.jpg"), h("BIA LIMA.JPG")] },
    { nome: "CARLOS", caminho: ["CARLOS"], arquivos: [h("1.jpg"), h("2.jpg")] }
  ]);
  assert.deepEqual(
    r.map(a => [a.nome, a.arquivos.length]),
    [
      ["ANA SOUZA", 1],
      ["BIA LIMA", 1],
      ["CARLOS", 2]
    ]
  );
});
