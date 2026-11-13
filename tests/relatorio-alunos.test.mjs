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
