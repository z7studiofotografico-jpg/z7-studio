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

test("aluno transferido: mesma família (telefone, mãe/pai ou endereço) em outro colégio e outro ano é o mesmo aluno", async () => {
  const { alunoNovo, podeVer, entradasFones } = await import("../js/pedidos.js");
  const antigo = {
    nome: "Maria Silva",
    escola: "Colégio Velho",
    ano: 2025,
    contatos: [{ tipo: "Mãe", nome: "Rosa Silva", tel: "21911112222" }],
    endereco: { rua: "Rua A", numero: "10" }
  };
  // outro colégio e outro ano, mesmo telefone
  assert.ok(
    mesmoAluno(antigo, { nome: "Maria Silva", escola: "Colégio Novo", ano: 2026, contatos: [{ tipo: "Mãe", tel: "21911112222" }] })
  );
  // telefone novo, mas a mesma mãe
  assert.ok(
    mesmoAluno(antigo, {
      nome: "Maria Silva",
      escola: "Colégio Novo",
      ano: 2026,
      contatos: [{ tipo: "Mãe", nome: "ROSA SILVA", tel: "21999990000" }]
    })
  );
  // só o endereço em comum
  assert.ok(mesmoAluno(antigo, { nome: "Maria S.", escola: "Novo", ano: 2026, endereco: { rua: "RUA A", numero: "10" } }));
  // irmão: mesma mãe e telefone, outro primeiro nome
  assert.ok(
    !mesmoAluno(antigo, {
      nome: "João Silva",
      escola: "Colégio Velho",
      ano: 2025,
      contatos: [{ tipo: "Mãe", nome: "Rosa Silva", tel: "21911112222" }]
    })
  );
  // homônimo em outro colégio, sem nada da família em comum
  assert.ok(
    !mesmoAluno(antigo, {
      nome: "Maria Silva",
      escola: "Colégio Novo",
      ano: 2026,
      contatos: [{ tipo: "Mãe", nome: "Ana", tel: "21900000000" }]
    })
  );
  // cadastro como novo: entra para quem pediu, separado (ou incompleto se faltar dado)
  const n = alunoNovo(
    {
      porEmail: "pedro@x.com",
      porNome: "Pedro",
      dados: { nome: "Maria Silva", escola: "Novo", ano: 2026, contatos: [{ tipo: "Mãe", nome: "Rosa", tel: "21911112222" }] }
    },
    "2026-10-27",
    "2026-10-27T10:00:00Z"
  );
  assert.deepEqual([n.etapa, n.respEmail, n.nomeBusca, n.separadoSeg], ["SEPARADO", "pedro@x.com", "MARIA SILVA", "lf"]);
  // quem só tem a Linha de Frente não veria um aluno do Repasse de outro ano
  assert.ok(!podeVer({ papel: "equipe", modulos: ["lf"] }, 2025));
  assert.ok(podeVer({ papel: "equipe", modulos: ["lf"] }, new Date().getFullYear()));
  assert.ok(podeVer({ papel: "equipe", modulos: ["rep"] }, 2020));
  assert.deepEqual(entradasFones("r1", antigo), [["21911112222", { alunos: { r1: { nome: "MARIA SILVA", ano: 2025 } } }]]);
});
