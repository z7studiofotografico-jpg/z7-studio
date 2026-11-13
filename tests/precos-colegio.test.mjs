import { test } from "node:test";
import assert from "node:assert/strict";
import { comPrecoDoColegio, usarPrecos, chavePreco } from "../js/precos-colegio.js";

const base = { lfPix: 350, lfCartao: 377, kitPromo: 297, pixLF: "PIX350", pixRep: "PIX297", pix: "chave" };
test("preço do colégio: cada unidade tem a sua chave", () => {
  assert.notEqual(chavePreco("LEGACY SCHOOL (NILÓPOLIS)", 2026), chavePreco("LEGACY SCHOOL (N. IGUAÇU)", 2026));
  assert.equal(chavePreco("Ciep 433 - Togo", 2026), chavePreco("CIEP 433 – TOGO", "2026"));
});
test("preço do colégio: sem preço bloqueia (valores zerados, sem código Pix)", () => {
  usarPrecos({});
  const p = comPrecoDoColegio(base, { escola: "CIEP 433", ano: 2026 }, "pr");
  assert.equal(p.semPrecoColegio, true);
  assert.equal(p.lfPix, 0);
  assert.equal(p.pixLF, undefined);
  assert.equal(p.pix, "chave");
});
test("preço do colégio: usa o valor do colégio e só mantém o código Pix quando o valor é igual", () => {
  usarPrecos({ [chavePreco("CIEP 433", 2026)]: { pr: { lfPix: 300, lfCartao: 377 } } });
  const p = comPrecoDoColegio(base, { escola: "CIEP 433", ano: 2026 }, "pr");
  assert.equal(p.semPrecoColegio, undefined);
  assert.equal(p.lfPix, 300);
  assert.equal(p.pixLF, undefined);
  assert.equal(p.kitPromo, 0);
  const pas = comPrecoDoColegio(base, { escola: "CIEP 433", ano: 2026 }, "paspatur");
  assert.equal(pas.semPrecoColegio, true);
});
