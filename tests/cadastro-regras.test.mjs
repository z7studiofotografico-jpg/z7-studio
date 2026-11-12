import { test } from "node:test";
import assert from "node:assert/strict";
import { prefixoId, idDoAluno, faltaParaSalvar, conferirRepetido, linhasPlanilha } from "../js/cadastro-regras.js";

const nuta = { id: "i1", nome: "C.E. Nuta Bartlet James" };

test("ID: ano + sigla do colégio + o número do aluno (obrigatório)", () => {
  assert.equal(prefixoId(2026, nuta), "26CENBJ-");
  assert.equal(idDoAluno(2026, nuta, "2"), "26CENBJ-02");
  assert.equal(idDoAluno(2026, { nome: "X", sigla: "legacy" }, "15"), "26LEGACY-15");
  assert.equal(idDoAluno(2026, nuta, ""), "");
  assert.equal(idDoAluno(2026, null, "3"), "");
});

test("sem colégio, número ou o que contratou não salva", () => {
  assert.deepEqual(faltaParaSalvar({ ano: 2026, nome: "Ana", modulos: ["pr"] }).length, 2);
  const ok = { inst: nuta, ano: 2026, codigo: "26CENBJ-02", nome: "Ana", modulos: ["becas"], becaTipo: "tradPreta" };
  assert.deepEqual(faltaParaSalvar(ok), []);
  assert.match(faltaParaSalvar({ ...ok, becaTipo: "" }).join(), /beca/);
  assert.match(faltaParaSalvar({ ...ok, modulos: [] }).join(), /contratou/);
});

test("repetido: mesmo ID e mesmo nome é o mesmo aluno; mesmo ID com outro nome trava", () => {
  const f = { codigo: "26CENBJ-02", nome: "Aghata Souza", ano: 2026 };
  const achados = [
    { modulo: "pr", codigo: "26CENBJ-02", nome: "AGHATA DE SOUZA", ano: 2026 },
    { modulo: "becas", codigo: "26CENBJ-07", nome: "Aghata Souza", ano: 2026 }
  ];
  const r = conferirRepetido(f, achados);
  assert.equal(r.mesmoAluno.length, 1);
  assert.equal(r.idDeOutro, null);
  assert.equal(r.parecidos.length, 1);
  const r2 = conferirRepetido({ ...f, nome: "Bruno Lima" }, achados);
  assert.equal(r2.idDeOutro.modulo, "pr");
});

test("planilha de backup", () => {
  const l = linhasPlanilha(
    [{ nome: "Ana", contatos: [{ tipo: "Mãe", nome: "Maria", tel: "219" }] }],
    [
      ["nome", "Nome"],
      ["contatos", "Contatos"]
    ]
  );
  assert.deepEqual(l, [
    ["Nome", "Contatos"],
    ["Ana", "Mãe Maria 219"]
  ]);
});
