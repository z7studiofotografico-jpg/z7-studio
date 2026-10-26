// Testes das regras de negócio. Rodar: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import * as R from "../js/regras.js";
import { feriado } from "../js/feriados.js";

test("lê valores no padrão brasileiro em centavos", () => {
  assert.equal(R.centavos("1.350,50"), 135050);
  assert.equal(R.centavos("1350"), 135000);
  assert.equal(R.centavos("9,5"), 950);
  assert.equal(R.centavos("9.5"), 950);          // antes virava 95!
  assert.equal(R.centavos("41.5"), 4150);        // antes virava 415!
  assert.equal(R.centavos("1.350"), 135000);
  assert.equal(R.centavos("R$ 85"), 8500);
  assert.equal(R.centavos(""), 0);
  assert.equal(R.centavos("abc"), 0);
  assert.equal(R.centavos(0.1 + 0.2), 30);
  assert.equal(R.lerReais("133,335"), 133.34);
});
test("formata em reais", () => {
  assert.equal(R.brl(400), "R$ 400");
  assert.equal(R.brl(1350.5), "R$ 1.350,50");
  assert.equal(R.brl(0.1 + 0.2), "R$ 0,30");
});
test("divide parcelas sem perder centavo", () => {
  assert.deepEqual(R.dividir(400, 3), [133.34, 133.33, 133.33]);
  assert.equal(R.somar(R.dividir(400, 3)), 400);
  assert.deepEqual(R.dividir(369, 9), Array(9).fill(41));
  assert.equal(R.somar(R.dividir(1000, 7)), 1000);
  assert.equal(R.pct(533, 13), 69.29);
  assert.equal(R.pct(100, 9.5), 9.5);
});
test("vencimento no fim do mês não pula fevereiro", () => {
  assert.equal(R.somaMeses("2027-01-31", 1), "2027-02-28");
  assert.equal(R.somaMeses("2028-01-31", 1), "2028-02-29");
  assert.equal(R.somaMeses("2026-10-05", 3), "2027-01-05");
  const f = { primeiroVenc: "2026-01-31", parcelas: 4, valor: 400 };
  assert.deepEqual([1, 2, 3, 4].map(n => R.vencDa(f, n)), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
});
test("parcelas atrasadas e próximo vencimento", () => {
  const f = { primeiroVenc: "2026-06-05", parcelas: 10, valor: 850, pagamentos: [{ data: "2026-06-05", valor: 85 }] };
  assert.equal(R.esperadas(f, "2026-07-05"), 1);   // no dia do vencimento ainda não atrasou
  assert.equal(R.esperadas(f, "2026-07-06"), 2);
  assert.equal(R.atrasado(f, "2026-07-06"), true);
  assert.equal(R.atrasado(f, "2026-07-05"), false);
  assert.equal(R.proxVenc(f), "2026-07-05");
  assert.equal(R.recebido(f), 85);
  assert.equal(R.emAberto(f), 765);
  assert.equal(R.proxVenc({ ...f, status: "desistiu" }), "");
  const antigo = { primeiroVenc: "2026-06-05", parcelas: 3, valor: 100, pagas: 2, vendidoEm: "2026-06-01" };
  assert.equal(R.pagasDe(antigo), 2);
  assert.equal(R.recebido(antigo), 66.67);
});
test("comissão por linha e forma de pagamento", () => {
  assert.equal(R.taxa({}, "pr", "Pix"), 20);
  assert.equal(R.taxa({}, "form", "Boleto"), 9.5);
  assert.equal(R.taxa({}, "colacao", "Boleto"), 20);
  assert.equal(R.taxa({ comissao: { pr: { Pix: 18 } } }, "pr", "Pix"), 18);
  assert.equal(R.formaDe("Cartão (link InfinityPay)"), "Link");
  assert.equal(R.formaDe("cartão"), "Cartão");
});
test("feriados", () => {
  assert.equal(feriado("2026-11-02"), "Finados");
  assert.equal(feriado("2027-02-08"), "Carnaval");
  assert.equal(feriado("2026-04-23"), "São Jorge (RJ)");
  assert.equal(feriado("2026-10-26"), "");
  assert.match(feriado("2026-02-18"), /Cinzas/); assert.match(feriado("2026-10-15"), /Professor/); assert.match(feriado("2026-12-31"), /Ano Novo/);
});
