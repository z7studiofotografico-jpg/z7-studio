import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoNovo, nomeCurto, idadeDe, dadosLink, mensagemLink, textoVisitas, MAX_FOTOS } from "../js/link-previa.js";

test("código do link: 10 letras/números sem os que confundem", () => {
  const c = codigoNovo();
  assert.match(c, /^[a-z2-9]{10}$/);
  assert.doesNotMatch(c, /[01ilo]/);
  assert.notEqual(codigoNovo(), c);
});

test("página pública: só primeiro e último nome, sem telefone", () => {
  assert.equal(nomeCurto("MARIA DA SILVA SANTOS"), "Maria Santos");
  assert.equal(nomeCurto("joão"), "João");
  const it = { nome: "ANA PAULA LIMA", escola: "C.E. TESTE", tel: "21999998888", vendaComo: "paspatur", turma: "3º ano EM" };
  const r = { folhas: [{ id: "f1" }], fotos: Array.from({ length: 80 }, (_, i) => ({ id: "x" + i })) };
  const d = dadosLink(it, r, "R$ 350,00", "Pedro Alves", new Date("2026-11-11T12:00:00Z"));
  assert.equal(d.nome, "Ana Lima");
  assert.equal(d.kit, "paspatur");
  assert.equal(d.idade, "adulto");
  assert.equal(d.fotos.length, MAX_FOTOS);
  assert.equal(d.fotos[0], "x0");
  assert.equal(d.por, "Pedro");
  assert.equal(d.ate, "2026-12-11T12:00:00.000Z");
  assert.ok(!JSON.stringify(d).includes("21999998888"));
  // sem fotos separadas: usa a folha; preço sem cadastro ("[valor do kit]") não aparece
  const d2 = dadosLink({ nome: "Bia" }, { folhas: [{ id: "f1" }], fotos: [] }, "[valor do kit]", "");
  assert.deepEqual(d2.fotos, ["f1"]);
  assert.equal(d2.preco, "");
  assert.equal(d2.kit, "pr");
});

test("infantil ou adulto (qual amostra a página mostra primeiro)", () => {
  assert.equal(idadeDe({ turma: "5º ano" }), "infantil");
  assert.equal(idadeDe({ escola: "Escola de Educação Infantil Sol" }), "infantil");
  assert.equal(idadeDe({ turma: "Pré II" }), "infantil");
  assert.equal(idadeDe({ turma: "9º ano" }), "adulto");
  assert.equal(idadeDe({ turma: "3º ano EM" }), "adulto");
  assert.equal(idadeDe({ turma: "1º ano do Ensino Médio" }), "adulto");
  assert.equal(idadeDe({ escola: "Faculdade X" }), "adulto");
});

test("mensagem e visitas", () => {
  assert.match(mensagemLink({ nome: "MARIA SILVA" }, "abc"), /fotos de Maria .*previa\/\?c=abc/s);
  assert.equal(textoVisitas({ vistos: 0 }), "👀 A família ainda não abriu o link.");
  assert.match(
    textoVisitas({ vistos: 3, cliques: 1, vistoEm: "2026-11-11T17:20:00Z" }),
    /Abriu 3 vezes · último 11\/11 .* · tocou no WhatsApp 1 vez/
  );
});
