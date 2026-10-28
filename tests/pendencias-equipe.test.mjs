import { test } from "node:test";
import assert from "node:assert/strict";
import { pendenciasDe } from "../js/pendencias-equipe.js";

const roberto = { email: "roberto@z7.com", nome: "Roberto Silva" };
const hoje = "2026-10-29";
test("19h: pendências do Roberto (cadastro, retornos) e o que ele atualizou", () => {
  const inst = [
    { nome: "CIEP 225", resp: "Roberto", respEmail: "", cadastroPendente: true, contatos: [], etapa: "VISITADO" },
    { nome: "C.E. Alfa", respEmail: "roberto@z7.com", cadastroPendente: false, cadastroOkEm: "2026-10-29T15:00:00Z" },
    { nome: "C.E. Beta", respEmail: "roberto@z7.com", etapa: "VISITADO", followup: "2026-10-20" },
    { nome: "CIEP 156", respEmail: "adriano@z7.com", cadastroPendente: true, contatos: [] }
  ];
  const rep = [{ respEmail: "roberto@z7.com", etapa: "CONTATADO", followup: "2026-10-28" }];
  const r = pendenciasDe(roberto, { inst, rep }, hoje);
  assert.equal(r.title, "Roberto: 3 pendências hoje");
  assert.match(r.body, /1 colégio sem cadastro completo \(ex\.: CIEP 225: falta contato com telefone, nº de alunos, endereço\)/);
  assert.match(r.body, /1 retorno de colégio atrasado/);
  assert.match(r.body, /1 contato do PR atrasado/);
  assert.match(r.body, /Atualizou hoje: C\.E\. Alfa/);
});
test("19h: tudo completo avisa que está ok; sem nada, não manda", () => {
  const ok = pendenciasDe(
    roberto,
    { inst: [{ nome: "C.E. Alfa", respEmail: "roberto@z7.com", cadastroPendente: false, cadastroOkEm: "2026-10-29T20:00:00Z" }] },
    hoje
  );
  assert.equal(ok.title, "Roberto: tudo em dia ✅");
  assert.match(ok.body, /Cadastro de todos os colégios completo/);
  assert.equal(pendenciasDe(roberto, { inst: [] }, hoje), null);
  // dias depois, sem nada novo: não manda de novo
  const dep = pendenciasDe(
    roberto,
    { inst: [{ nome: "C.E. Alfa", respEmail: "roberto@z7.com", cadastroPendente: false, cadastroOkEm: "2026-10-01" }] },
    hoje
  );
  assert.equal(dep, null);
});
