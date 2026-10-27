import { test } from "node:test";
import assert from "node:assert/strict";
import { resumir, periodo, comissaoDe } from "../js/calc.js";
import { taxa } from "../js/regras.js";

const fontes = {
  leads: [
    { etapa: "FECHADO", valor: 450, fechadoEm: "2026-10-02", servico: "Retrato", resp: "Adriano" },
    { etapa: "NOVO LEAD", valor: 999 }
  ],
  prs: [{ etapa: "PAGO", valor: 350, pagoEm: "2026-10-03", ano: 2026, formaPag: "Pix", respEmail: "pedro@x.com" }],
  insts: [
    {
      id: "i1",
      nome: "ALFA",
      etapa: "FECHADO",
      fechadoEm: "2026-10-01",
      respEmail: "pedro@x.com",
      visitas: [{ data: "2026-10-01", porEmail: "pedro@x.com", como: "Visita presencial" }]
    }
  ],
  forms: [
    {
      instId: "i1",
      contrato: "album",
      kit: "Kit 04",
      valor: 850,
      parcelas: 10,
      formaPag: "Cartão",
      vendidoEm: "2026-10-01",
      pagamentos: [{ data: "2026-10-05", valor: 85 }]
    },
    {
      instId: "i1",
      contrato: "colacao",
      valor: 400,
      parcelas: 3,
      vendidoEm: "2026-10-01",
      pagamentos: [{ data: "2026-10-05", valor: 133.34 }]
    }
  ],
  ens: [
    { data: "2026-10-04", valor: 280.1, tipo: "Retrato" },
    { data: "2026-10-04", valor: 300, leadId: "x" }
  ],
  becas: [
    { retirada: "2026-10-06", valor: 600, status: "reservado", porEmail: "luciana@x.com" },
    { retirada: "2026-10-06", valor: 100, status: "cancelado" }
  ]
};
test("resume vendas, a receber e comissão em centavos", () => {
  const r = resumir(fontes, "2026-10-20");
  const p = periodo(r, ["2026-10"]);
  assert.equal(p.total, 45000 + 35000 + 85000 + 40000 + 28010 + 60000);
  assert.equal(p.n, 6);
  assert.equal(r.aReceber, 765 + 266.66);
  const pedro = p.pessoas["pedro@x.com"];
  assert.equal(pedro.visitas, 1);
  assert.equal(pedro.fechados, 1);
  const c = comissaoDe(pedro, (l, f) => taxa({}, l, f));
  // 350*20% + 85*15% + 133,34*20% = 70 + 12,75 + 26,67
  assert.equal(c.total, 7000 + 1275 + 2667);
});

test("venda de PR 'a conferir' entra no total, mas a comissão só depois de conferida", () => {
  const f = Object.assign({}, fontes, {
    prs: [{ etapa: "PAGO", valor: 350, pagoEm: "2026-10-03", formaPag: "Pix", respEmail: "pedro@x.com", conferido: false }]
  });
  const r = resumir(f, "2026-10-20");
  assert.equal(r.aConferir, 1);
  const pedro = periodo(r, ["2026-10"]).pessoas["pedro@x.com"];
  const c = comissaoDe(pedro, (l, fp) => taxa({}, l, fp));
  assert.equal(c.total, 1275 + 2667); // sem os R$ 70 do PR
});

test("cada card tem os seus números: PR, Formaturas e Funil separados", () => {
  const f = Object.assign({}, fontes, {
    leads: [
      {
        etapa: "FECHADO",
        valor: 450,
        fechadoEm: "2026-10-02",
        criadoEm: "2026-10-01T10:00:00Z",
        origem: "Meta Ads",
        servico: "Retrato",
        respEmail: "adr@x.com"
      },
      { etapa: "NOVO LEAD", valor: 300, criadoEm: "2026-10-05T10:00:00Z", origem: "Meta Ads", followup: "2026-10-10" },
      { etapa: "PERDIDO", criadoEm: "2026-10-03T10:00:00Z", atualizadoEm: "2026-10-08T10:00:00Z", origem: "Instagram" }
    ],
    separados: [
      { separadoEm: "2026-10-03", separadoSeg: "lf", respEmail: "pedro@x.com" },
      { separadoEm: "2026-10-04", separadoSeg: "lf", respEmail: "pedro@x.com" }
    ]
  });
  const r = resumir(f, "2026-10-20"),
    p = periodo(r, ["2026-10"]);
  // Funil
  assert.equal(p.funil.criados, 3);
  assert.equal(p.funil.fechados, 1);
  assert.equal(p.funil.perdidos, 1);
  assert.equal(p.funil.v, 45000);
  assert.equal(p.funil.origem["Meta Ads"].criados, 2);
  assert.equal(p.funil.origem["Meta Ads"].fechados, 1);
  assert.equal(r.agora.funil.abertos, 1);
  assert.equal(r.agora.funil.atrasados, 1);
  assert.equal(r.agora.funil.emNegociacao, 30000);
  // PR
  assert.equal(p.pr.v, 35000);
  assert.equal(p.pr.n, 1);
  assert.equal(p.pr.separados, 2);
  assert.equal(p.pr.lf.sep, 2);
  assert.equal(p.pr.pessoas["pedro@x.com"].sep, 2);
  assert.equal(p.pr.forma.Pix.v, 35000);
  // Formaturas
  assert.equal(p.form.colegios, 1);
  assert.equal(p.form.vendAlb.v, 85000);
  assert.equal(p.form.vendCol.v, 40000);
  assert.equal(p.form.recAlb, 8500);
  assert.equal(p.form.recCol, 13334);
  assert.equal(r.agora.form.aReceberAlb, 76500);
  assert.equal(r.agora.form.aReceberCol, 26666);
});

test("venda do funil a conferir não entra nos números até o admin conferir", () => {
  const leads = [
    { etapa: "FECHADO", valor: 450, fechadoEm: "2026-10-02", criadoEm: "2026-10-01", conferido: true },
    { etapa: "FECHADO", valor: 99999, fechadoEm: "2026-10-02", criadoEm: "2026-10-01", conferido: false }
  ];
  const r = resumir({ leads }, "2026-10-20");
  assert.equal(r.aConferirFunil, 1);
  assert.equal(r.meses["2026-10"].funil.fechados, 1);
  assert.equal(r.meses["2026-10"].funil.v, 45000);
});

test("desistência: o que foi pago continua recebido e a devolução entra como saída", () => {
  const forms = [
    {
      instId: "i1",
      contrato: "album",
      valor: 1000,
      parcelas: 10,
      status: "desistiu",
      vendidoEm: "2026-08-01",
      pagamentos: [
        { data: "2026-08-05", valor: 100 },
        { data: "2026-09-05", valor: 100 }
      ],
      devolucao: { valor: 140, em: "2026-10-10", regra: "desistência" }
    }
  ];
  const r = resumir({ forms }, "2026-10-20");
  assert.equal(r.meses["2026-08"].form.recAlb, 10000);
  assert.equal(r.meses["2026-09"].form.recAlb, 10000);
  assert.equal(r.meses["2026-10"].form.devolvido, 14000);
  assert.equal(r.aReceber, 0);
  const p = periodo(r, ["2026-08", "2026-09", "2026-10"]);
  assert.equal(p.form.devolvido, 14000);
  assert.equal(Object.keys(r.meses["2026-08"].form.vendAlb).length, 0);
});
