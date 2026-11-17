import { test } from "node:test";
import assert from "node:assert/strict";
import { prazoParaMandar, maisDias, prazoCurto } from "../js/prazo-atendimento.js";

test("prazo do atendimento: 3 dias até o fim do dia; o representante dá mais dias", () => {
  const agora = new Date(2026, 10, 17, 11, 0);
  const a = prazoParaMandar({}, agora);
  assert.equal(prazoCurto(a.prazo), "qui, 19/11");
  assert.equal(a.prazo.getHours(), 23);
  assert.ok(a.patch.prazoAtendimento);
  // já tem prazo valendo: não muda
  const b = prazoParaMandar({ prazoAtendimento: a.prazo.toISOString() }, agora);
  assert.equal(b.patch, null);
  // +1 dia conta do prazo
  assert.equal(prazoCurto(maisDias({ prazoAtendimento: a.prazo.toISOString() }, 1, agora)), "sex, 20/11");
  // prazo vencido: +1 conta de hoje
  assert.equal(prazoCurto(maisDias({ prazoAtendimento: new Date(2026, 10, 10).toISOString() }, 1, agora)), "qua, 18/11");
});
