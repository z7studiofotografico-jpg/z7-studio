import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.document = globalThis.document || { createElement: () => ({}) };
const { mesmoAluno, compararAluno, mesclarContatos, passarPara } = await import("../js/pedidos.js");

test("ordem combinada: nome completo, depois telefone, depois mãe e pai, depois colégio", () => {
  const a = {
    nome: "Lia Souza",
    escola: "Colégio Alfa",
    ano: 2026,
    contatos: [
      { tipo: "Mãe", nome: "Rosa Souza", tel: "21911112222" },
      { tipo: "Pai", nome: "Rui Souza", tel: "21955556666" }
    ]
  };
  // nome completo diferente nunca é o mesmo (mesmo com o mesmo telefone: irmão, ou nome abreviado)
  assert.equal(compararAluno(a, { nome: "Pedro Souza", contatos: [{ tel: "21911112222" }] }), null);
  assert.equal(compararAluno(a, { nome: "Lia S.", telefones: ["21911112222"] }), null);
  // telefone
  assert.deepEqual(compararAluno(a, { nome: "LIA SOUZA", escola: "Colegio Alfa", contatos: [{ tel: "21911112222" }] }), {
    motivo: "telefone",
    trocouColegio: false
  });
  // mãe E pai (telefones novos)
  const pais = [
    { tipo: "Mãe", nome: "ROSA SOUZA", tel: "21900000001" },
    { tipo: "Pai", nome: "rui souza", tel: "21900000002" }
  ];
  assert.equal(compararAluno(a, { nome: "Lia Souza", escola: "Colégio Alfa", contatos: pais }).motivo, "pais");
  // só a mãe igual não basta (precisa mãe e pai)
  assert.equal(compararAluno(a, { nome: "Lia Souza", escola: "Outro", contatos: [pais[0]] }), null);
  // colégio (mesmo ano), sem telefone nem pais para comparar
  assert.equal(compararAluno(a, { nome: "Lia Souza", escola: "colegio alfa", ano: 2026 }).motivo, "colegio");
  assert.equal(compararAluno(a, { nome: "Lia Souza", escola: "colegio alfa", ano: 2024 }), null);
  assert.equal(compararAluno(a, { nome: "Lia Souza", escola: "Outro" }), null);
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

test("mesmo nome e colégio em outro ano, sem família em comum, não é repetido; identificador do pedido", async () => {
  const { idPedido } = await import("../js/pedidos.js");
  assert.ok(!mesmoAluno({ nome: "Lia", escola: "Alfa", ano: 2024 }, { nome: "Lia", escola: "Alfa", ano: 2026 }));
  assert.ok(mesmoAluno({ nome: "Lia", escola: "Alfa", ano: 2026 }, { nome: "Lia", escola: "Alfa", ano: 2026 }));
  assert.equal(idPedido("pr", "r2", "Pedro.Silva@Vendas.com"), "pr_r2_pedro-silva-vendas-com");
});

test("aluno que trocou de colégio: achado pelo telefone ou pela mãe e pai, e marcado para avisar o admin", async () => {
  const { alunoNovo, podeVer, entradasFones } = await import("../js/pedidos.js");
  const antigo = {
    nome: "Maria Silva",
    escola: "Colégio Velho",
    ano: 2025,
    contatos: [
      { tipo: "Mãe", nome: "Rosa Silva", tel: "21911112222" },
      { tipo: "Pai", nome: "José Silva", tel: "21933334444" }
    ]
  };
  assert.deepEqual(compararAluno(antigo, { nome: "Maria Silva", escola: "Colégio Novo", ano: 2026, contatos: [{ tel: "21911112222" }] }), {
    motivo: "telefone",
    trocouColegio: true
  });
  assert.deepEqual(
    compararAluno(antigo, {
      nome: "Maria Silva",
      escola: "Colégio Novo",
      contatos: [
        { tipo: "Mãe", nome: "Rosa Silva", tel: "21999990000" },
        { tipo: "Pai", nome: "José Silva", tel: "21999990001" }
      ]
    }),
    { motivo: "pais", trocouColegio: true }
  );
  // irmão: mesmos pais e telefone, outro nome
  assert.ok(!mesmoAluno(antigo, { nome: "João Silva", escola: "Colégio Velho", ano: 2025, contatos: antigo.contatos }));
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
  assert.deepEqual(entradasFones("r1", antigo)[0], [
    "21911112222",
    { alunos: { r1: { nome: "MARIA SILVA", ano: 2025, escola: "COLEGIO VELHO" } } }
  ]);
});
