import { test } from "node:test";
import assert from "node:assert/strict";
import { min, fimDe, conflitosEm, resumoDiaEm, tipoDoLead, diaTxt } from "../js/agenda-tempo.js";

test("horários: minutos, fim do ensaio e dia da semana", () => {
  assert.equal(min("09:30"), 570);
  assert.equal(min(""), null);
  assert.equal(fimDe({ hora: "09:30", duracao: 90 }), "11:00");
  assert.equal(fimDe({ hora: "23:30" }), "00:30");
  assert.equal(diaTxt("2026-10-27"), "ter, 27/10");
});
test("conflitos: ensaio que encavala, colégio no dia e compromisso de dia inteiro", () => {
  const estado = {
    ensaios: [
      { id: "e1", data: "2026-11-10", hora: "10:00", duracao: 60 },
      { id: "e2", data: "2026-11-10", hora: "14:00", duracao: 60, status: "remarcar" }
    ],
    items: [{ data: "2026-11-10", kind: "fotos", instNome: "ALFA" }],
    comps: [{ id: "c1", data: "2026-11-10", diaInteiro: true, titulo: "Viagem" }]
  };
  const c = conflitosEm(estado, "2026-11-10", "10:30", 60);
  assert.equal(c.encavala.length, 1);
  assert.equal(c.colegio.instNome, "ALFA");
  assert.equal(c.compBate.length, 1);
  // encostar no fim não é conflito; ensaio para remarcar não conta; o próprio ensaio é ignorado
  assert.equal(conflitosEm(estado, "2026-11-10", "11:00", 60).encavala.length, 0);
  assert.equal(conflitosEm(estado, "2026-11-10", "14:00", 60).encavala.length, 0);
  assert.equal(conflitosEm(estado, "2026-11-10", "10:00", 60, "e1").encavala.length, 0);
  const r = resumoDiaEm(estado, "2026-11-10", null, (k, n) => k + " " + n);
  assert.equal(r.length, 3);
  assert.match(r[0], /Viagem.*dia inteiro/);
});
test("tipo do ensaio pelo serviço do Funil", () => {
  assert.equal(tipoDoLead("Formatura individual (estúdio)"), "Formatura individual");
  assert.equal(tipoDoLead("Fotos da turma"), "Formatura em grupo");
  assert.equal(tipoDoLead("gestante"), "Gestante");
});
