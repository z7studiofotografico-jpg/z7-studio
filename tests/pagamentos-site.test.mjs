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
  assert.equal(p.formaPag, "Cartão");
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
