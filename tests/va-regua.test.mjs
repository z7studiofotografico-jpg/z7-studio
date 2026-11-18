import test from "node:test";
import assert from "node:assert/strict";
import { etapaHoje, paraMandarHoje } from "../js/va-regua.js";

const f = (o = {}) => Object.assign({ status: "ativo", valor: 369, parcelas: 9, primeiroVenc: "2026-06-05", pagamentos: [] }, o);
const pagas = n => Array.from({ length: n }, () => ({ data: "2026-06-05", valor: 41 }));

test("régua: 3 dias antes, no dia, 3 e 10 dias depois, e de 7 em 7", () => {
  const x = f({ pagamentos: pagas(5) }); // próxima: a 6ª, vence 05/11
  assert.equal(etapaHoje(x, "2026-11-01"), null);
  assert.equal(etapaHoje(x, "2026-11-02").etapa, "d-3");
  assert.equal(etapaHoje(x, "2026-11-04").etapa, "d-3");
  assert.equal(etapaHoje(x, "2026-11-05").etapa, "d0");
  assert.equal(etapaHoje(x, "2026-11-08").etapa, "d+3");
  assert.equal(etapaHoje(x, "2026-11-15").etapa, "d+10");
  assert.equal(etapaHoje(x, "2026-11-22").etapa, "d+17");
  assert.equal(etapaHoje(x, "2026-11-22").txt, "17 dias de atraso");
});
test("régua: o lembrete mandado não aparece de novo; quitado não tem lembrete", () => {
  const x = f({ pagamentos: pagas(5), lembretes: [{ parcela: 6, etapa: "d0" }] });
  assert.equal(etapaHoje(x, "2026-11-06").enviado, true);
  assert.equal(paraMandarHoje([x], "2026-11-06").length, 0);
  assert.equal(paraMandarHoje([x], "2026-11-08").length, 1);
  assert.equal(etapaHoje(f({ pagamentos: pagas(9) }), "2026-11-05"), null);
});
