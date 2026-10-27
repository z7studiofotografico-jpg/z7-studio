import { test } from "node:test";
import assert from "node:assert/strict";
import {
  siglaDe,
  lerCodigo,
  fmtCodigo,
  codigoBusca,
  pareceCodigo,
  codigosDaBusca,
  comAno,
  siglaUsada,
  maiorNumero,
  proximoCodigo,
  reservarCodigo,
  ordemCodigo,
  avisoTel,
  telRelatorio,
  contatoRel
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
test("ID com o ano na frente: lê os formatos, converte o antigo e acha o próximo", () => {
  assert.deepEqual(lerCodigo("26CEPNCP-01"), { aa: 26, sigla: "CEPNCP", n: 1 });
  assert.deepEqual(lerCodigo("26cepncp - 7"), { aa: 26, sigla: "CEPNCP", n: 7 });
  assert.deepEqual(lerCodigo("CEPNCP - 01"), { aa: null, sigla: "CEPNCP", n: 1 });
  assert.deepEqual(lerCodigo("26CIEP225-03"), { aa: 26, sigla: "CIEP225", n: 3 });
  assert.equal(lerCodigo("12"), null);
  assert.equal(fmtCodigo(2026, "CEPNCP", 2), "26CEPNCP-02");
  assert.equal(fmtCodigo(2025, "CEPNCP", 120), "25CEPNCP-120");
  assert.equal(comAno("CEPNCP - 1", 2025), "25CEPNCP-01");
  assert.equal(comAno("26cepncp-3", 2025), "26CEPNCP-03");
  assert.equal(comAno("12", 2025), "12");
  assert.equal(codigoBusca("26CEPNCP-1"), "26CEPNCP01");
  assert.equal(codigoBusca("CEPNCP - 01"), "CEPNCP01");
  // mesmo colégio, anos diferentes: alunos diferentes, cada ano com a sua sequência
  const cs = ["26CEPNCP-01", "26CEPNCP-36", "25CEPNCP-50", "CEPNCP - 05", "", "26OUTRO-90"];
  assert.equal(siglaUsada(cs), "CEPNCP");
  assert.equal(maiorNumero(2026, "CEPNCP", cs), 36);
  assert.equal(proximoCodigo(2026, "CEPNCP", cs), "26CEPNCP-37");
  assert.equal(proximoCodigo(2025, "CEPNCP", cs), "25CEPNCP-51");
  assert.equal(proximoCodigo(2027, "NOVO", []), "27NOVO-01");
});
test("reserva do ID no banco: transação com o contador do colégio no ano", async () => {
  const banco = { "ids/26CEPNCP": { ultimo: 40 } };
  const FS = {
    doc: (db, c, id) => c + "/" + id,
    runTransaction: async (db, fn) =>
      fn({
        get: async ref => ({ exists: () => ref in banco, data: () => banco[ref] }),
        set: (ref, d) => (banco[ref] = d)
      })
  };
  assert.equal(await reservarCodigo(FS, null, 2026, "CEPNCP", ["26CEPNCP-36"]), "26CEPNCP-41");
  assert.equal(await reservarCodigo(FS, null, 2026, "CEPNCP", []), "26CEPNCP-42");
  assert.equal(await reservarCodigo(FS, null, 2025, "CEPNCP", ["25CEPNCP-09"]), "25CEPNCP-10");
  assert.deepEqual(banco["ids/25CEPNCP"], { ultimo: 10 });
  // banco recusou (regras antigas): calcula pela lista
  const falha = { doc: () => "x", runTransaction: async () => Promise.reject(new Error("permission-denied")) };
  assert.equal(await reservarCodigo(falha, null, 2026, "CA", ["26CA-04"]), "26CA-05");
});
test("busca por ID e ordem da lista", () => {
  assert.ok(pareceCodigo("cepncp 5") && pareceCodigo("26CEPNCP-05") && pareceCodigo("CIEP225-3") && pareceCodigo("26cepncp 5"));
  assert.ok(!pareceCodigo("Maria") && !pareceCodigo("21988887777") && !pareceCodigo("Ana Clara"));
  assert.deepEqual(codigosDaBusca("26cepncp 5", [2026]), ["26CEPNCP05"]);
  assert.deepEqual(codigosDaBusca("cepncp-5", [2026, 2025]), ["26CEPNCP05", "25CEPNCP05", "CEPNCP05"]);
  const l = [
    { nome: "Zé", codigo: "" },
    { nome: "C", codigo: "26CEPNCP-01" },
    { nome: "B", codigo: "25CEPNCP-10" },
    { nome: "A", codigo: "25CEPNCP-2" }
  ].sort(ordemCodigo);
  assert.deepEqual(
    l.map(x => x.nome),
    ["A", "B", "C", "Zé"]
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
  assert.equal(contatoRel("21988887777", "ana@x.com"), "(21) 98888-7777 · ana@x.com");
  assert.equal(contatoRel("", ""), "");
});
