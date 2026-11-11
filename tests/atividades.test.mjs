import { test } from "node:test";
import assert from "node:assert/strict";
import { atividadeDoPatch, resumoPorPessoa } from "../js/atividades.js";
import { gruposEquipe } from "../js/repasse-equipe.js";

const H = "2026-11-10";
const aluno = { nome: "BRUNO LIMA", escola: "NUTA", etapa: "SEPARADO", followup: null };

test("o que a equipe faz no aluno vira atividade", () => {
  assert.equal(atividadeDoPatch(aluno, { etapa: "CAÍDO" }, H).tipo, "caido");
  assert.equal(atividadeDoPatch(aluno, { etapa: "INTERESSADO" }, H).tipo, "interessado");
  assert.equal(atividadeDoPatch(aluno, { etapa: "PAGO" }, H).tipo, "venda");
  const h = atividadeDoPatch(aluno, { followup: H }, H);
  assert.equal(h.tipo, "hoje");
  assert.match(h.texto, /Bruno Lima \(Nuta\)/);
  // já estava para hoje (ou atrasado): não conta de novo; data futura não é "para hoje"
  assert.equal(atividadeDoPatch({ ...aluno, followup: "2026-11-09" }, { followup: H }, H), null);
  assert.equal(atividadeDoPatch(aluno, { followup: "2026-11-20" }, H), null);
  assert.equal(atividadeDoPatch(aluno, { notas: "x" }, H), null);
});

test("resumo do dia por pessoa", () => {
  const r = resumoPorPessoa([
    { email: "r@x", por: "Roberto", tipo: "hoje", n: 12 },
    { email: "r@x", por: "Roberto", tipo: "caido" },
    { email: "r@x", por: "Roberto", tipo: "venda" },
    { email: "m@x", por: "Maria", tipo: "visita" }
  ]);
  assert.equal(r[0].por, "Roberto");
  assert.equal(r[0].partes, "12 para hoje · 1 caído · 1 venda");
  assert.equal(r[1].partes, "1 visita");
});

test("botão da pessoa: para hoje, a trabalhar e caídos", () => {
  const g = gruposEquipe(
    [
      { etapa: "SEPARADO", followup: H },
      { etapa: "CONTATADO", followup: "2026-11-01" },
      { etapa: "SEPARADO", followup: null },
      { etapa: "INTERESSADO", followup: "2026-11-30" },
      { etapa: "CAÍDO" }
    ],
    H
  );
  assert.deepEqual(
    g.map(x => x.length),
    [2, 2, 1]
  );
});
