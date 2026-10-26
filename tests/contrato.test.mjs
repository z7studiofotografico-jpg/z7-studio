import { test } from "node:test";
import assert from "node:assert/strict";
import { KITS_PADRAO, kitsDe, plano, proximoVenc, somaDiasUteis, previsaoEntrega, devolucao } from "../js/contrato.js";

const k04 = KITS_PADRAO.find(k => k.id === "k04");
test("próximo vencimento é dia 05", () => {
  assert.equal(proximoVenc("2026-06-03"), "2026-06-05");
  assert.equal(proximoVenc("2026-06-05"), "2026-06-05");
  assert.equal(proximoVenc("2026-06-06"), "2026-07-05");
  assert.equal(proximoVenc("2026-12-20"), "2027-01-05");
});
test("antecipado: quem entra no começo paga 10x; quem entra depois paga menos parcelas e termina junto", () => {
  assert.deepEqual(plano(k04, "ant", "2026-06-05", "2026-05-20"), { valor: 850, parcelas: 10, primeiroVenc: "2026-06-05" });
  // entrou em setembro: de 05/09 a 05/03/27 = 7 parcelas, mesmo total
  assert.deepEqual(plano(k04, "ant", "2026-06-05", "2026-08-20"), { valor: 850, parcelas: 7, primeiroVenc: "2026-09-05" });
  // entrou depois do fim: 1 parcela
  assert.equal(plano(k04, "ant", "2026-06-05", "2027-04-10").parcelas, 1);
  assert.equal(plano(KITS_PADRAO[2], "ant", "2026-06-05", "2026-05-01").valor, 533);
});
test("depois das fotos: usa o preço que o Adriano definiu; sem preço, não oferece", () => {
  assert.equal(plano(k04, "pos", "2026-06-05", "2026-10-26"), null);
  const ks = kitsDe({ kitsFormatura: [{ ...k04, pos: { valor: 1100, parcelas: 6 } }] });
  assert.deepEqual(plano(ks[0], "pos", "2026-06-05", "2026-10-26"), { valor: 1100, parcelas: 6, primeiroVenc: "2026-11-05" });
});
test("entrega: 120 dias úteis depois da quitação, pulando fim de semana e feriado", () => {
  assert.equal(somaDiasUteis("2026-10-30", 1), "2026-11-03"); // sex → seg 02/11 é Finados → ter
  const f = { valor: 65, parcelas: 1, pagamentos: [{ data: "2026-06-05", valor: 65 }] };
  assert.match(previsaoEntrega(f), /^2026-1[12]-\d\d$/);
  assert.equal(previsaoEntrega({ valor: 850, parcelas: 10, pagamentos: [{ data: "2026-06-05", valor: 85 }] }), "");
});
test("devolução: desistência 70% do pago; reprovação = pago menos serviços", () => {
  assert.equal(devolucao("desistiu", 255), 178.5);
  assert.equal(devolucao("reprovou", 255, 65), 190);
  assert.equal(devolucao("reprovou", 50, 65), 0);
});
