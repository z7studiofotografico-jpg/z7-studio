import { test } from "node:test";
import assert from "node:assert/strict";
import { venceu, ehCelular } from "../js/trava.js";

test("trava: 1 hora sem uso", () => {
  const h = 3600000;
  assert.equal(venceu(1000, 1000 + h - 1), false);
  assert.equal(venceu(1000, 1000 + h), true);
  assert.equal(venceu(0, 99999999), false); // sem registro: ainda não conta
});
test("trava: só no celular", () => {
  assert.equal(ehCelular({ userAgent: "Mozilla/5.0 (Linux; Android 14) Mobile Safari", maxTouchPoints: 5 }), true);
  assert.equal(ehCelular({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", maxTouchPoints: 5 }), true);
  assert.equal(ehCelular({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130", maxTouchPoints: 0 }), false);
});
