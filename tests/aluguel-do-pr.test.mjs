import { test } from "node:test";
import assert from "node:assert/strict";
import { aluguelDoPR, kitSemBeca } from "../js/aluguel-do-pr.js";
import * as R from "../js/contrato-colegio-regras.js";

test("aluno do cadastro automático entra no contrato com o kit e o valor (sem beca)", () => {
  const c = { pacotePadrao: ["certificado", "canudo"], kits: [{ nome: "Kit", itens: ["certificado", "canudo"], valor: 45 }], respEmail: "ROB@x.com" };
  const x = { id: "p1", nome: "KEVIN LUCAS", codigo: "26EMMG-01", turma: "901", telefones: ["21984997521"], contatos: [{ tipo: "Mãe", nome: "Ana", tel: "21" }] };
  const d = aluguelDoPR(x, { id: "mg", nome: "E.M. MANOEL GOMES" }, 2026, c, R);
  assert.equal(d.serie, "9º ano");
  assert.equal(d.valor, 45);
  assert.equal(d.semBeca, true);
  assert.equal(d.becaTipo, "");
  assert.ok(d.tel.endsWith("21984997521"));
  assert.equal(d.respEmail, "rob@x.com");
  assert.equal(d.status, "Cadastrado");
  assert.equal(kitSemBeca(["beca", "canudo"]), false);
});
