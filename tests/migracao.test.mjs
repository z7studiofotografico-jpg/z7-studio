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
  assert.deepEqual(de("leads", "l1"), [{ nomeBusca: "erica souza", respEmail: "pedro@x.com" }]);
  assert.equal(conta.formandos, 1);
  // rodar de novo sobre o resultado não muda nada
  const depois = planejar(
    {
      instituicoes: [{ id: "i1", respEmail: "pedro@x.com" }],
      leads: [{ id: "l1", nome: "Érica Souza", nomeBusca: "erica souza", respEmail: "" }]
    },
    emailDe
  );
  assert.equal(depois.ops.length, 0);
});
