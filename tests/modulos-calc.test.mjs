import { test } from "node:test";
import assert from "node:assert/strict";
import { recebimentos, resumirModulos } from "../js/modulos-calc.js";

const fontes = {
  repasse: [
    { etapa: "PAGO", pagoEm: "2027-01-10", valor: 150, ano: 2026 },
    { etapa: "ENTREGUE", pagoEm: "2026-12-01", valor: 100.5, ano: 2026, historico: true } // histórico de planilha: fora
  ],
  paspatur: [{ etapa: "PAGO", pagoEm: "2027-01-12", valor: 80, ano: 2026 }],
  formaturaAlunos: [
    { etapa: "PAGO", pagoEm: "2027-01-15", valor: 300, ano: 2026, seg: "lf" },
    { etapa: "PAGO", pagoEm: "2027-01-20", valor: 250, ano: 2025, seg: "rep" },
    { etapa: "CAÍDO", ano: 2026, seg: "lf" }
  ],
  insts: [
    { id: "i1", etapa: "FECHADO", fechadoEm: "2026-03-01", formatura: { data: "2026-12-10" }, visitas: [{ data: "2026-02-01" }] },
    { id: "i2", etapa: "NÃO FECHOU", naoFechou: { motivo: "Preço", em: "2026-05-02" }, visitas: [] }
  ],
  formandos: [
    {
      instId: "i1",
      pagamentos: [
        { data: "2026-11-05", valor: 85 },
        { data: "2027-01-05", valor: 85 }
      ]
    }
  ],
  alugueis: [
    {
      status: "Retirou a beca",
      ano: 2026,
      valor: 60,
      produtos: [{ produto: "paspatur", qtd: 2, valor: 25, estado: "baixado" }],
      historico: [{ para: "Retirou a beca", em: "2026-12-08T10:00:00Z" }]
    },
    { status: "Cadastrado", ano: 2026, valor: 60 }
  ],
  produtos: [{ id: "paspatur", nome: "Paspatur", controla: true, fisico: 3, reservado: 1, minimo: 2 }],
  movEstoque: [{ tipo: "baixa", em: "2026-12-08T10:00:00Z", modulo: "aluguel", itens: [{ produto: "paspatur", qtd: 2 }] }]
};

test("Dashboard por módulo: cada venda no seu módulo, em centavos", () => {
  const r = recebimentos(fontes);
  const por = m => r.filter(x => x.mod === m).reduce((t, x) => t + x.c, 0);
  assert.equal(por("pr"), 15000);
  assert.equal(por("paspatur"), 8000);
  assert.equal(por("flf"), 30000);
  assert.equal(por("frep"), 25000);
  assert.equal(por("va"), 17000);
  assert.equal(por("aluguel"), 11000); // 60 + 2 × 25
});

test("Dashboard por módulo: por turma × por caixa e o geral soma tudo", () => {
  const s = resumirModulos(fontes, "2027-01-25");
  // Venda Antecipada da turma de 2026: uma parcela entrou em 2026 e outra em 2027
  assert.deepEqual(s.mods.va.porTurma, { 2026: 17000 });
  assert.deepEqual(s.mods.va.porCaixa, { 2026: 8500, 2027: 8500 });
  assert.equal(s.mods.geral.totalC, 15000 + 8000 + 30000 + 25000 + 17000 + 11000);
  assert.equal(s.mods.pr.porMes["2027-01"], 15000);
  assert.equal(s.mods.aluguel.produtos.paspatur, 2);
  assert.equal(s.saidas.porProduto.paspatur, 2);
  assert.deepEqual(s.estoque.abaixo, ["Paspatur"]);
  assert.equal(s.insts.fechadas["2026-03"], 1);
  assert.equal(s.insts.visitadas["2026-02"], 1);
  assert.equal(s.insts.motivos.Preço, 1);
});
