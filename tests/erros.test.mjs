import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.document = globalThis.document || { createElement: () => ({}) };
const { ehDeRede, resumoErro } = await import("../js/erros.js");

test("falta de internet × defeito no app", () => {
  assert.ok(ehDeRede({ code: "unavailable", message: "Failed to get document because the client is offline." }));
  assert.ok(ehDeRede(new TypeError("Failed to fetch dynamically imported module: https://x/js/agenda.js")));
  assert.ok(!ehDeRede(new TypeError("Cannot read properties of undefined (reading 'nome')")));
  assert.ok(!ehDeRede({ code: "permission-denied", message: "Missing or insufficient permissions." }));
});
test("o registro do erro é curto (cabe nas regras: mensagem até 300, pilha até 800)", () => {
  const e = new Error("x".repeat(1000));
  const r = resumoErro("viewAgenda", e);
  assert.ok(r.msg.length <= 300 && r.pilha.length <= 800);
  assert.equal(r.onde, "viewAgenda");
});
