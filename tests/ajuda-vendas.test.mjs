import { test } from "node:test";
import assert from "node:assert/strict";
import { textoParaClaude, precoCliente, preencherAjuda, listaPrecos } from "../js/ajuda-vendas.js";

const cat = [
  { id: "kit_pr", nome: "Kit PR", categoria: "venda", preco: 150, precoMin: 120 },
  { id: "paspatur", nome: "Paspatur", categoria: "venda", preco: 0, precoMin: 0 },
  { id: "papel", nome: "Papel", categoria: "insumo", custo: 2 }
];

test("Ajuda de vendas: preço para o cliente nunca abaixo do mínimo", () => {
  assert.equal(precoCliente({ preco: 100, precoMin: 120 }), 120);
  assert.equal(precoCliente({ preco: 150, precoMin: 120 }), 150);
  assert.deepEqual(listaPrecos(cat), ["- Kit PR: R$ 150,00 (mínimo R$ 120,00)"]);
});

test("Ajuda de vendas: texto para o Claude sem telefone, com regras, preços e espaço para a dúvida", () => {
  const t = textoParaClaude({ aluno: "MARIA DA SILVA", colegio: "c.e. joão cardoso", cat, precoModulo: "R$ 150,00", modulo: "kit PR" });
  assert.match(t, /Aluno\(a\): Maria\n/);
  assert.doesNotMatch(t, /Silva/);
  assert.match(t, /Nunca invente preço/);
  assert.match(t, /abaixo do “mínimo”/);
  assert.match(t, /consulte o Adriano/);
  assert.match(t, /Kit PR: R\$ 150,00/);
  assert.match(t, /COLE AQUI A DÚVIDA DO CLIENTE/);
  // nenhum telefone (só a chave Pix da empresa)
  const semPix = t.replace("21998817771", "");
  assert.doesNotMatch(semPix, /\d{8,}/);
});

test("Ajuda de vendas: completa os campos e deixa o que falta à vista", () => {
  assert.equal(preencherAjuda("{oi} {aluno} {preco}", { oi: "Olá!", aluno: "Ana", preco: "" }), "Olá! Ana {preco}");
});
