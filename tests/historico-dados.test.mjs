import test from "node:test";
import assert from "node:assert/strict";
import {
  numero,
  limparNome,
  chaveColegio,
  lerPercentual,
  anoDaPlanilha,
  resumoDoAno,
  colegiosNosAnos,
  destaques
} from "../js/historico-dados.js";

test("histórico: números da planilha (pt-BR, erros de fórmula, vazio)", () => {
  assert.equal(numero(1234.5), 1234.5);
  assert.equal(numero("1.669,75"), 1669.75);
  assert.equal(numero("407,36"), 407.36);
  assert.equal(numero("#DIV/0!"), 0);
  assert.equal(numero("#REF!"), 0);
  assert.equal(numero(""), 0);
});
test("histórico: nome limpo, tipo (PR ou formatura), turma e mesmo colégio em anos diferentes", () => {
  assert.deepEqual(limparNome("FORMATURA - C. E. JOAO PAULO II - 2025"), { nome: "C. E. JOAO PAULO II", tipo: "formatura", turma: 2025 });
  assert.deepEqual(limparNome("COLEGIO ESTADUAL JOAO PAULO II (FORMATURA)"), {
    nome: "COLEGIO ESTADUAL JOAO PAULO II",
    tipo: "formatura",
    turma: null
  });
  assert.deepEqual(limparNome("PR - CIEP 384 GONÇALVES DIAS (ARARUAMA) 2023"), {
    nome: "CIEP 384 GONÇALVES DIAS (ARARUAMA)",
    tipo: "pr",
    turma: 2023
  });
  assert.equal(chaveColegio("C.E JOÃO CARDOSO (NILOPOLIS)"), chaveColegio("E. E. JOÃO CARDOSO"));
  assert.equal(chaveColegio("CIEP225 - MARIO QUINTANA (CAMPO GRANDE)"), "CIEP 225");
  assert.notEqual(chaveColegio("C.E SANTO ANTONIO"), chaveColegio("C. E SANTO ANTONIO DE PADUA"));
});
test("histórico: lê a planilha PERCENTUAL (cabeçalho, linhas vazias, TOTAL, última atualização, observação)", () => {
  const cab = [
    "CÓDIGO",
    "INSTITUIÇÃO",
    "ALUNOS",
    "VENDAS",
    "% VENDA",
    "DEVOLUÇÃO",
    "% DEVOLUÇÃO",
    "ABERTO",
    "TICKET",
    "DINHEIRO",
    "CARTÃO",
    "BOLETO",
    "VALOR ALUNO",
    "TOTAL VENDAS",
    "ALUGUEL DE BECA",
    ""
  ];
  const h = lerPercentual(
    [
      cab,
      [
        "1",
        "FORMATURA - CIEP 169 - MARIA AUGUSTA CORREIA",
        "80",
        "45",
        "0.56",
        "",
        "",
        "",
        "383.7",
        "",
        "1240",
        "16027",
        "215.8",
        "17267",
        "2160",
        "1.669,75 DEVENDO FORMATURA"
      ],
      ["2", "PR - C.E YONNE MARIA", "54", "4", "0.07", "", "", "", "351", "1007", "397", "", "26", "1404", "", ""],
      ["3", "C.E SEM VENDA", "3", "", "0", "0", "0", "", "#DIV/0!", "", "", "", "0", "0", "", ""],
      ["", "", "", "", "#DIV/0!", "", "#DIV/0!", "", "#DIV/0!", "", "", "", "#DIV/0!", "0", "", ""],
      ["", "TOTAL", "137", "49", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["", "ULTIMA ATUALIZAÇÃO", "2026-10-21", "", "", "", "", "", "", "", "", "", "", "", "", ""]
    ],
    2026
  );
  assert.equal(h.ano, 2026);
  assert.equal(h.atualizadoEm, "2026-10-21");
  assert.equal(h.colegios.length, 3);
  const [f, p, z] = h.colegios;
  assert.equal(f.tipo, "formatura");
  assert.equal(f.total, 1726700);
  assert.equal(f.beca, 216000);
  assert.equal(f.obs, "1.669,75 DEVENDO FORMATURA");
  assert.equal(p.tipo, "pr");
  assert.equal(p.dinheiro + p.cartao + p.boleto, p.total);
  assert.equal(z.vendas, 0);
  const r = resumoDoAno(h);
  assert.equal(r.geral.alunos, 137);
  assert.equal(r.pr.vendas, 4);
  assert.equal(r.formatura.ticket, Math.round(1726700 / 45));
  assert.equal(anoDaPlanilha("2023 - PERCENTUAL PR_.xlsx", ["Folha1"]), 2023);
  assert.equal(anoDaPlanilha("percentual.xlsx", ["ANO 2021"]), 2021);
  assert.equal(anoDaPlanilha("d349f987-2021_-_PERCENTUAL_PR_E_FORMATURA.xlsx", ["ANO 2021"]), 2021);
});
test("histórico: o mesmo colégio em vários anos e os destaques", () => {
  const ano = (a, cs) => ({
    ano: a,
    colegios: cs.map(([nome, alunos, vendas]) => ({ nome, tipo: "pr", chave: chaveColegio(nome), alunos, vendas, total: vendas * 35000 }))
  });
  const h21 = ano(2021, [
    ["E.E. NUTA BARTLET JAMES", 44, 17],
    ["C.E SANTO ANTONIO", 50, 10]
  ]);
  const h22 = ano(2022, [
    ["C. E NUTA BARLET JAMES", 44, 17],
    ["C.E SANTO ANTONIO", 54, 13],
    ["C. E SANTO ANTONIO DE PADUA", 26, 8]
  ]);
  const rep = colegiosNosAnos([h21, h22]);
  const nuta = rep.find(x => /NUTA/.test(x.nome));
  assert.ok(nuta && nuta.anos[2021] && nuta.anos[2022], "erro de digitação no nome não separa o colégio");
  const santo = rep.find(x => x.nome === "C.E SANTO ANTONIO");
  assert.ok(santo && santo.anos[2022].alunos === 54, "Santo Antônio e Santo Antônio de Pádua continuam separados");
  const d = destaques(h22, h21);
  assert.match(d.join(" "), /Melhor conversão/);
  assert.match(d.join(" "), /em relação a 2021/);
});
