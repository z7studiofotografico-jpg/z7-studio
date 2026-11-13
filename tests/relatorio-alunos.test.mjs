import { test } from "node:test";
import assert from "node:assert/strict";
import { tabelaAlunos, colunasEscolhidas, COLUNAS_RELATORIO } from "../js/relatorio-alunos.js";

test("alunos por colégio: só as colunas marcadas, na ordem padrão", () => {
  const c = colunasEscolhidas(new Set(["nome", "codigo", "endereco.bairro"]));
  assert.deepEqual(
    c.map(x => x[0]),
    ["codigo", "nome", "endereco.bairro"]
  );
  assert.ok(COLUNAS_RELATORIO.some(x => x[0] === "c:Mãe:tel"));
});
test("alunos por colégio: em ordem de ID, nome com maiúscula, contato e endereço", () => {
  const alunos = [
    {
      codigo: "26CIEP433-10",
      nome: "MARIA SILVA",
      contatos: [{ tipo: "Mãe", nome: "Ana", tel: "21999990000" }],
      endereco: { bairro: "Centro" }
    },
    { codigo: "26CIEP433-02", nome: "joão souza" },
    { nome: "sem id" }
  ];
  const t = tabelaAlunos(alunos, colunasEscolhidas(new Set(["codigo", "nome", "c:Mãe:tel", "endereco.bairro"])));
  assert.deepEqual(t.cols, ["ID", "Aluno", "Telefone da mãe", "Bairro"]);
  assert.deepEqual(t.linhas[0], ["26CIEP433-02", "João Souza", "", ""]);
  assert.deepEqual(t.linhas[1], ["26CIEP433-10", "Maria Silva", "21999990000", "Centro"]);
  assert.equal(t.linhas[2][0], "");
});

import { idDaPlanilha } from "../js/aluguel-importar.js";
test("aluguel: ID da planilha vira o ID do app", () => {
  const inst = { nome: "Escola Legacy School - Nilópolis" };
  assert.equal(idDaPlanilha("7", 2026, inst), "26ELSN-07");
  assert.equal(idDaPlanilha("26ELSN-12", 2026, inst), "26ELSN-12");
  assert.equal(idDaPlanilha("", 2026, inst), "");
  assert.equal(idDaPlanilha("abc", 2026, inst), "");
});
import { paraDocAluguel } from "../js/aluguel-importar.js";
test("aluguel: colunas Aluguel, Paspatur e Canudo viram o kit do aluno", () => {
  const ext = { instId: "x", instNome: "Escola Legacy School - Nilópolis", inst: { nome: "Escola Legacy School - Nilópolis" }, ano: 2026 };
  assert.deepEqual(paraDocAluguel({ nome: "A", codigo: "3", itBeca: "1", itPaspatur: "1", itCanudo: "1" }, ext).pacote, [
    "beca",
    "paspatur",
    "canudo"
  ]);
  assert.deepEqual(paraDocAluguel({ nome: "B", itPaspatur: "-", itCanudo: "" }, ext).pacote, []);
  assert.equal(paraDocAluguel({ nome: "A", codigo: "3" }, ext).codigo, "26ELSN-03");
});
import { tamanhoBeca } from "../js/becas-estoque.js";
test("beca: infantil ou adulto sempre escrito", () => {
  assert.equal(tamanhoBeca({ becaTipo: "infPreta", tamanho: "GG" }), "Infantil GG");
  assert.equal(tamanhoBeca({ becaTipo: "tradPreta", tamanho: "P", menosLonga: true }), "Adulto P1");
  assert.equal(tamanhoBeca({ becaTipo: "tradPreta" }), "Adulto · sem tamanho");
  const ext = { instId: "x", inst: { nome: "Escola Legacy School - Nilópolis" }, ano: 2026, idade: "infantil" };
  assert.equal(paraDocAluguel({ nome: "A", tamanho: "GG" }, ext).becaTipo, "infPreta");
  assert.equal(paraDocAluguel({ nome: "B", tamanho: "P ADULTO" }, ext).becaTipo, "tradPreta");
});
test("aluguel: valor pelo kit com os preços do colégio (item avulso também)", () => {
  const precos = { beca: 35, paspatur: 80, canudo: 15, certificado: 0 };
  const ext = { instId: "x", inst: { nome: "Escola Legacy School - Nilópolis" }, ano: 2026, precos };
  assert.equal(paraDocAluguel({ nome: "A", itBeca: "1", itPaspatur: "1", itCanudo: "1" }, ext).valor, 130);
  assert.equal(paraDocAluguel({ nome: "B", itPaspatur: "1" }, ext).valor, 80);
  const z = paraDocAluguel({ nome: "C" }, ext);
  assert.equal(z.valor, 0);
  assert.equal(z.contratoZerado, true);
  assert.equal(paraDocAluguel({ nome: "D", valor: "50", itPaspatur: "1" }, ext).valor, 50);
});
