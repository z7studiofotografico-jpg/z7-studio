import { test } from "node:test";
import assert from "node:assert/strict";
import { resumir, periodo, comissaoDe } from "../js/calc.js";
import { taxa } from "../js/regras.js";

const fontes = {
  leads: [{ etapa: "FECHADO", valor: 450, fechadoEm: "2026-10-02", servico: "Retrato", resp: "Adriano" }, { etapa: "NOVO LEAD", valor: 999 }],
  prs: [{ etapa: "PAGO", valor: 350, pagoEm: "2026-10-03", ano: 2026, formaPag: "Pix", respEmail: "pedro@x.com" }],
  insts: [{ id: "i1", nome: "ALFA", etapa: "FECHADO", fechadoEm: "2026-10-01", respEmail: "pedro@x.com", visitas: [{ data: "2026-10-01", porEmail: "pedro@x.com", como: "Visita presencial" }] }],
  forms: [
    { instId: "i1", contrato: "album", kit: "Kit 04", valor: 850, parcelas: 10, formaPag: "Cartão", vendidoEm: "2026-10-01", pagamentos: [{ data: "2026-10-05", valor: 85 }] },
    { instId: "i1", contrato: "colacao", valor: 400, parcelas: 3, vendidoEm: "2026-10-01", pagamentos: [{ data: "2026-10-05", valor: 133.34 }] }
  ],
  ens: [{ data: "2026-10-04", valor: 280.1, tipo: "Retrato" }, { data: "2026-10-04", valor: 300, leadId: "x" }],
  becas: [{ retirada: "2026-10-06", valor: 600, status: "reservado", porEmail: "luciana@x.com" }, { retirada: "2026-10-06", valor: 100, status: "cancelado" }]
};
test("resume vendas, a receber e comissão em centavos", () => {
  const r = resumir(fontes, "2026-10-20");
  const p = periodo(r, ["2026-10"]);
  assert.equal(p.total, 45000 + 35000 + 85000 + 40000 + 28010 + 60000);
  assert.equal(p.n, 6);
  assert.equal(r.aReceber, 765 + 266.66);
  const pedro = p.pessoas["pedro@x.com"];
  assert.equal(pedro.visitas, 1); assert.equal(pedro.fechados, 1);
  const c = comissaoDe(pedro, (l, f) => taxa({}, l, f));
  // 350*20% + 85*15% + 133,34*20% = 70 + 12,75 + 26,67
  assert.equal(c.total, 7000 + 1275 + 2667);
});

test("venda de PR 'a conferir' entra no total, mas a comissão só depois de conferida", () => {
  const f = Object.assign({}, fontes, { prs: [{ etapa: "PAGO", valor: 350, pagoEm: "2026-10-03", formaPag: "Pix", respEmail: "pedro@x.com", conferido: false }] });
  const r = resumir(f, "2026-10-20");
  assert.equal(r.aConferir, 1);
  const pedro = periodo(r, ["2026-10"]).pessoas["pedro@x.com"];
  const c = comissaoDe(pedro, (l, fp) => taxa({}, l, fp));
  assert.equal(c.total, 1275 + 2667); // sem os R$ 70 do PR
});
