import { test } from "node:test";
import assert from "node:assert/strict";
import {
  siglaDe,
  lerCodigo,
  fmtCodigo,
  codigoBusca,
  pareceCodigo,
  codigoDaBusca,
  siglaUsada,
  proximoCodigo,
  ordemCodigo,
  avisoTel,
  telRelatorio
} from "../js/aluno-id.js";

test("sigla do colégio: iniciais, CIEP com o número e o último nome inteiro quando repete", () => {
  assert.equal(siglaDe("COLEGIO ESTADUAL PROFESSOR NEY CIDADE PALMEIRO"), "CEPNCP");
  assert.equal(siglaDe("Colégio Estadual Professor Ney Cidade Palmeiro"), "CEPNCP");
  assert.equal(siglaDe("Colégio Santa Maria da Glória"), "CSMG");
  assert.equal(siglaDe("CIEP 225 Mestre Marçal"), "CIEP225");
  assert.equal(siglaDe("CIEP433"), "CIEP433");
  assert.equal(siglaDe("Ciep nº 033 Brizolão"), "CIEP33");
  assert.equal(siglaDe("Colégio Estadual Professor Ney Cidade Palmeiro", ["CEPNCP"]), "CEPNCPALMEIRO");
  assert.equal(siglaDe(""), "");
});
test("ID: lê os formatos da planilha, monta no padrão e acha o próximo", () => {
  assert.deepEqual(lerCodigo("CEPNCP - 01"), { sigla: "CEPNCP", n: 1 });
  assert.deepEqual(lerCodigo("cepncp-7"), { sigla: "CEPNCP", n: 7 });
  assert.deepEqual(lerCodigo("CIEP225 - 03"), { sigla: "CIEP225", n: 3 });
  assert.equal(lerCodigo("12"), null);
  assert.equal(fmtCodigo("CEPNCP", 2), "CEPNCP - 02");
  assert.equal(fmtCodigo("CEPNCP", 120), "CEPNCP - 120");
  assert.equal(codigoBusca("CEPNCP - 1"), "CEPNCP01");
  assert.equal(codigoBusca("CEPNCP-01"), "CEPNCP01");
  const cs = ["CEPNCP - 01", "CEPNCP - 36", "CEPNCP - 05", "", "OUTRO - 90"];
  assert.equal(siglaUsada(cs), "CEPNCP");
  assert.equal(proximoCodigo("CEPNCP", cs), "CEPNCP - 37");
  assert.equal(proximoCodigo("NOVO", []), "NOVO - 01");
});
test("busca por ID e ordem da lista", () => {
  assert.ok(pareceCodigo("cepncp 5") && pareceCodigo("CEPNCP - 05") && pareceCodigo("CIEP225-3"));
  assert.ok(!pareceCodigo("Maria") && !pareceCodigo("21988887777") && !pareceCodigo("Ana Clara"));
  assert.equal(codigoDaBusca("cepncp 5"), "CEPNCP05");
  const l = [
    { nome: "Zé", codigo: "" },
    { nome: "B", codigo: "CEPNCP - 10" },
    { nome: "A", codigo: "CEPNCP - 2" }
  ].sort(ordemCodigo);
  assert.deepEqual(
    l.map(x => x.nome),
    ["A", "B", "Zé"]
  );
});
test("telefone: pega só o que com certeza está errado", () => {
  assert.equal(avisoTel("21988887777"), "");
  assert.equal(avisoTel("+55 21 98888-7777"), "");
  assert.equal(avisoTel("2198888777"), "celular sem o 9 (falta um dígito)");
  assert.equal(avisoTel("2126667777"), "telefone fixo (pode não ter WhatsApp)");
  assert.equal(avisoTel("20988887777"), "DDD 20 não existe");
  assert.equal(avisoTel("21888887777"), "celular sem o 9 na frente");
  assert.equal(avisoTel("21999999999"), "número parece inventado");
  assert.equal(avisoTel("21912345678"), "número parece inventado");
  assert.equal(avisoTel("2198"), "número incompleto");
  assert.equal(avisoTel(""), "");
  assert.equal(telRelatorio("21988887777"), "(21) 98888-7777");
  assert.equal(telRelatorio("20988887777"), "(20) 98888-7777 ⚠️ DDD 20 não existe");
});
