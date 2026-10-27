import { test } from "node:test";
import assert from "node:assert/strict";
import { planejar } from "../js/migracao.js";

test("atualização dos dados antigos: responsável por e-mail, parcelas, privado e busca do funil", () => {
  const emailDe = n => ({ "Pedro Vendedor": "pedro@x.com" })[n] || "";
  const { ops, conta } = planejar(
    {
      instituicoes: [{ id: "i1", resp: "Pedro Vendedor" }, { id: "i2" }, { id: "i3", respEmail: "ana@x.com" }],
      formandos: [{ id: "f1", instId: "i1", valor: 850, parcelas: 10, pagas: 1, primeiroVenc: "2026-01-10" }],
      repasse: [{ id: "r1", resp: "Pedro Vendedor" }],
      agenda: [{ id: "2026-11-10", pedidoPor: "Pedro Vendedor" }],
      ensaios: [{ id: "c1", kind: "pessoal", particular: true, titulo: "Consulta médica" }],
      leads: [{ id: "l1", nome: "Érica Souza", resp: "Pedro Vendedor" }]
    },
    emailDe
  );
  const de = (col, id) => ops.filter(o => o.col === col && o.id === id).map(o => o.dados);
  assert.deepEqual(de("instituicoes", "i1"), [{ respEmail: "pedro@x.com" }]);
  assert.deepEqual(de("instituicoes", "i2"), [{ respEmail: "" }]);
  assert.equal(de("instituicoes", "i3").length, 0);
  const f = de("formandos", "f1")[0];
  assert.equal(f.respEmail, "pedro@x.com");
  assert.equal(f.pagas, 1);
  assert.equal(f.pagamentos.length, 1);
  assert.match(f.proxVenc, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(de("repasse", "r1"), [{ respEmail: "pedro@x.com" }]);
  assert.deepEqual(de("agenda", "2026-11-10"), [{ pedidoEmail: "pedro@x.com" }]);
  assert.equal(de("privado", "c1")[0].titulo, "Consulta médica");
  assert.deepEqual(de("ensaios", "c1"), [{ titulo: "", obs: "" }]);
  assert.deepEqual(de("leads", "l1"), [{ nomeBusca: "ERICA SOUZA", respEmail: "pedro@x.com" }]);
  assert.equal(conta.formandos, 1);
  // rodar de novo sobre o resultado não muda nada
  const depois = planejar(
    {
      instituicoes: [{ id: "i1", respEmail: "pedro@x.com" }],
      leads: [{ id: "l1", nome: "Érica Souza", nomeBusca: "ERICA SOUZA", respEmail: "" }]
    },
    emailDe
  );
  assert.equal(depois.ops.length, 0);
});

test("v6: Kit 01 vira 'adesao' e o preço antigo de colação da turma vira o Kit 01 da tabela da turma", () => {
  const { ops, conta } = planejar(
    {
      instituicoes: [
        { id: "i1", respEmail: "", colacao: { valor: 90, parcelas: 3 } },
        { id: "i2", respEmail: "", colacao: { valor: 90 }, kits: [{ id: "k01", ant: { valor: 70, parcelas: 1 } }] },
        { id: "i3", respEmail: "" }
      ],
      formandos: [
        { id: "f1", contrato: "colacao", respEmail: "", pagamentos: [], proxVenc: "" },
        { id: "f2", contrato: "album", status: "semkit", respEmail: "", pagamentos: [], proxVenc: "" }
      ]
    },
    () => ""
  );
  const op = (col, id) => ops.find(o => o.col === col && o.id === id);
  assert.deepEqual(op("instituicoes", "i1").dados.kits, [{ id: "k01", ant: { valor: 90, parcelas: 3 } }]);
  assert.deepEqual(op("instituicoes", "i1").apagar, ["colacao"]);
  assert.equal(op("instituicoes", "i2").dados.kits, undefined); // a tabela da turma já tinha o Kit 01
  assert.deepEqual(op("instituicoes", "i2").apagar, ["colacao"]);
  assert.equal(op("instituicoes", "i3"), undefined);
  assert.equal(op("formandos", "f1").dados.contrato, "adesao");
  assert.equal(op("formandos", "f2"), undefined);
  assert.equal(conta["formandos antigos sem kit (não mudados)"], 1);
});

test("v7: guarda a data do último pagamento (para o resumo não ler todos os formandos)", () => {
  const { ops } = planejar(
    {
      formandos: [
        {
          id: "f1",
          respEmail: "",
          proxVenc: "",
          pagamentos: [
            { data: "2025-03-05", valor: 1 },
            { data: "2025-05-05", valor: 1 }
          ]
        },
        { id: "f2", respEmail: "", proxVenc: "", pagamentos: [{ data: "2025-03-05", valor: 1 }], ultimoPag: "2025-03-05" },
        { id: "f3", respEmail: "", proxVenc: "", pagamentos: [] }
      ]
    },
    () => ""
  );
  const de = id => (ops.find(o => o.col === "formandos" && o.id === id) || {}).dados;
  assert.equal(de("f1").ultimoPag, "2025-05-05");
  assert.equal(de("f2"), undefined);
  assert.equal(de("f3"), undefined);
});

test("v7: nome de busca no formato único (maiúsculas) em leads e instituições", () => {
  const { ops } = planejar(
    {
      instituicoes: [{ id: "i1", respEmail: "", nome: "Colégio Ação", nomeBusca: "colegio acao" }],
      leads: [{ id: "l1", respEmail: "", nome: "Érica  Souza", nomeBusca: "erica  souza" }]
    },
    () => ""
  );
  const de = (c, id) => (ops.find(o => o.col === c && o.id === id) || {}).dados;
  assert.equal(de("instituicoes", "i1").nomeBusca, "COLEGIO ACAO");
  assert.equal(de("leads", "l1").nomeBusca, "ERICA SOUZA");
});
