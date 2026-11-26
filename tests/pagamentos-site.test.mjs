import { test } from "node:test";
import assert from "node:assert/strict";
import { patchPago } from "../js/pagamentos-site.js";

test("pagamento pelo site: aluno vira Pago, já conferido, com forma e parcelas", () => {
  const p = patchPago(
    { valor: 37700, forma: "cartao", parcelas: 10, transaction_nsu: "abc-123", recibo: "https://recibo/x", em: "2026-11-17T04:00:00Z" },
    "2026-11-17"
  );
  assert.equal(p.etapa, "PAGO");
  assert.equal(p.valor, 377);
  assert.equal(p.formaPag, "Link");
  assert.equal(p.comprovante, "https://recibo/x");
  assert.equal(p.conferido, true);
  assert.equal(p.pagoEm, "2026-11-17");
  assert.deepEqual(p.pagoPeloSite, { transacao: "abc-123", parcelas: 10, em: "2026-11-17T04:00:00Z" });
  const x = patchPago({ valor: 35000, forma: "pix", parcelas: 3, transaction_nsu: "t9" }, "2026-11-17");
  assert.equal(x.formaPag, "Pix");
  assert.equal(x.valor, 350);
  assert.equal(x.pagoPeloSite.parcelas, 1);
  assert.match(x.comprovante, /InfinitePay t9/);
});

test("pagou no cartão pelo link do botão do Pix: fica a conferir, com o aviso", async () => {
  const { patchPago } = await import("../js/pagamentos-site.js");
  const a = patchPago({ valor: 35000, forma: "cartao", order_nsu: "abcdefghjk-pxtbc12" }, "2026-11-26");
  assert.equal(a.conferido, false);
  assert.match(a.avisoPagamento, /link do Pix/);
  const b = patchPago({ valor: 35000, forma: "pix", order_nsu: "abcdefghjk-pxtbc12" }, "2026-11-26");
  assert.equal(b.conferido, true);
  const c = patchPago({ valor: 37700, forma: "cartao", order_nsu: "abcdefghjk-tbc12" }, "2026-11-26");
  assert.equal(c.conferido, true);
});
