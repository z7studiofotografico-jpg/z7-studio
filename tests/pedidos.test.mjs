import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.document = globalThis.document || { createElement: () => ({}) };
const { mesmoAluno, mesclarContatos, passarPara } = await import("../js/pedidos.js");

test("mesmo aluno: nome e colégio, ou nome e telefone; irmãos com o mesmo telefone não", () => {
  const a = { nome: "Lia Souza", escola: "Colégio Alfa", contatos: [{ tel: "21911112222" }] };
  assert.ok(mesmoAluno(a, { nome: "LIA SOUZA", escola: "colegio alfa" }));
  assert.ok(mesmoAluno(a, { nome: "Lia Souza", escola: "Outro", contatos: [{ tel: "21911112222" }] }));
  assert.ok(!mesmoAluno(a, { nome: "Lia Souza", escola: "Outro" }));
  assert.ok(!mesmoAluno(a, { nome: "Pedro Souza", escola: "Colégio Alfa", contatos: [{ tel: "21911112222" }] }));
  assert.ok(mesmoAluno(a, { nome: "Lia S.", escola: "Colegio Alfa", telefones: ["21911112222"] }));
});
test("passar para quem pediu: da fila vai separado para a pessoa, com os contatos juntos; vendido não passa", () => {
  const p = { porEmail: "ana@x.com", porNome: "Ana", dados: { contatos: [{ tipo: "Pai", nome: "Rui", tel: "21933334444" }] } };
  const r = { nome: "Lia", escola: "Alfa", ano: 2020, etapa: "NA FILA", contatos: [{ tipo: "Mãe", nome: "Rosa", tel: "21911112222" }] };
  const x = passarPara(r, p, "2026-10-27");
  assert.equal(x.respEmail, "ana@x.com");
  assert.equal(x.etapa, "SEPARADO");
  assert.equal(x.separadoSeg, "rep");
  assert.deepEqual(x.telefones, ["21911112222", "21933334444"]);
  // com outra pessoa (já em contato): só troca o responsável, mantém a etapa
  const y = passarPara(Object.assign({}, r, { etapa: "CONTATADO", respEmail: "pedro@x.com" }), p, "2026-10-27");
  assert.equal(y.etapa, undefined);
  assert.equal(y.respEmail, "ana@x.com");
  assert.equal(passarPara(Object.assign({}, r, { etapa: "PAGO" }), p, "2026-10-27"), null);
  assert.deepEqual(mesclarContatos([{ tel: "1" }], [{ tel: "1" }, { tel: "2" }]), [{ tel: "1" }, { tel: "2" }]);
});

test("outro ano não é repetido (cada ano é um ensaio); identificador do pedido termina com o e-mail", async () => {
  const { idPedido } = await import("../js/pedidos.js");
  assert.ok(!mesmoAluno({ nome: "Lia", escola: "Alfa", ano: 2024 }, { nome: "Lia", escola: "Alfa", ano: 2026 }));
  assert.ok(mesmoAluno({ nome: "Lia", escola: "Alfa", ano: 2026 }, { nome: "Lia", escola: "Alfa", ano: 2026 }));
  assert.equal(idPedido("pr", "r2", "Pedro.Silva@Vendas.com"), "pr_r2_pedro-silva-vendas-com");
});
