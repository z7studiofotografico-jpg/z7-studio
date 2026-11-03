import { test } from "node:test";
import assert from "node:assert/strict";
import {
  textoParaClaude,
  urlClaude,
  limparDuvida,
  precoCliente,
  preencherAjuda,
  listaPrecos,
  situacoesDo,
  CARDS
} from "../js/ajuda-vendas.js";
import { metaSemAnos } from "../js/limpar-dados.js";
import { comAlteracao } from "../js/alteracoes.js";

const cat = [
  { id: "kit_pr", nome: "Kit PR", grupo: "Kit", categoria: "venda", preco: 150, precoMin: 120 },
  { id: "paspatur", nome: "Paspatur", grupo: "Paspatur", categoria: "venda", preco: 30, precoMin: 0 },
  { id: "papel", nome: "Papel", categoria: "insumo", custo: 2 }
];

test("Ajuda de vendas: preço para o cliente nunca abaixo do mínimo", () => {
  assert.equal(precoCliente({ preco: 100, precoMin: 120 }), 120);
  assert.equal(precoCliente({ preco: 150, precoMin: 120 }), 150);
  assert.deepEqual(listaPrecos(cat, ["Kit"]), ["- Kit PR: R$ 150,00 (mínimo R$ 120,00)"]);
});

test("Ajuda de vendas: texto para o Claude sem telefone, com regras, preços do card e espaço para a dúvida", () => {
  const t = textoParaClaude({ card: "pr", aluno: "MARIA DA SILVA", colegio: "c.e. joão cardoso", cat, precoModulo: "R$ 150,00" });
  assert.match(t, /Aluno\(a\): Maria\n/);
  assert.doesNotMatch(t, /Silva/);
  assert.match(t, /Nunca invente preço/);
  assert.match(t, /abaixo do “mínimo”/);
  assert.match(t, /consulte o Adriano/);
  assert.match(t, /Kit PR: R\$ 150,00/);
  assert.doesNotMatch(t, /Paspatur: R\$/); // o PR não leva o preço do paspatur
  assert.match(t, /COLE AQUI A DÚVIDA DO CLIENTE/);
  const semPix = t.replace("21998817771", "");
  assert.doesNotMatch(semPix, /\d{8,}/);
});

test("Ajuda de vendas: cada card tem as suas situações e o Claude recebe o assunto do card", () => {
  for (const k of ["pr", "paspatur", "formatura", "va", "instituicao", "funil", "aluguel"]) assert.ok(CARDS[k].situacoes.length >= 5, k);
  assert.match(textoParaClaude({ card: "aluguel" }), /aluguel de beca/);
  assert.match(textoParaClaude({ card: "aluguel", cat }), /Paspatur: R\$ 30,00/);
  const g = { textos: { aluguel: { preco: "Só {preco}" } }, extras: { aluguel: [{ titulo: "Posso pagar depois?", texto: "Pode sim" }] } };
  const s = situacoesDo("aluguel", g);
  assert.equal(s.find(x => x.k === "preco").texto, "Só {preco}");
  assert.equal(s[s.length - 1].nome, "Posso pagar depois?");
  assert.match(textoParaClaude({ card: "aluguel", guardado: g }), /Posso pagar depois\?: Pode sim/);
});

test("Ajuda de vendas: completa os campos e deixa o que falta à vista", () => {
  assert.equal(preencherAjuda("{oi} {aluno} {preco}", { oi: "Olá!", aluno: "Ana", preco: "" }), "Olá! Ana {preco}");
});

test("Limpar para reimportar: a lista de escolas perde só os anos apagados", () => {
  const m = {
    escolas: { A: 3, B: 1 },
    anos: { 2026: 3, 2027: 1 },
    escolasAno: { "A|2026": 2, "A|2027": 1, "B|2026": 1 },
    viradas: { x: 1 }
  };
  assert.deepEqual(metaSemAnos(m, [2026]), { escolas: { A: 1 }, anos: { 2027: 1 }, escolasAno: { "A|2027": 1 } });
  assert.deepEqual(metaSemAnos(m, [], true), { escolas: {}, anos: {}, escolasAno: {} });
});

test("Histórico de alterações: quem mudou o quê (e a etapa de/para)", () => {
  const p = comAlteracao({ etapa: "SEPARADO", alteracoes: [] }, { etapa: "PAGO", valor: 10, atualizadoEm: "x" }, "Ana");
  assert.equal(p.alteracoes.length, 1);
  assert.deepEqual(p.alteracoes[0].campos, ["etapa", "valor"]);
  assert.equal(p.alteracoes[0].de, "SEPARADO");
  assert.equal(p.alteracoes[0].por, "Ana");
  assert.equal(comAlteracao({}, { atendendo: {} }, "Ana").alteracoes, undefined);
});

test("Perguntar ao Claude: a dúvida vai junto, sem telefone nem e-mail, e o link abre com o texto na caixa", () => {
  assert.equal(limparDuvida("me chama no (21) 98888-7777 ou ana@x.com"), "me chama no [número] ou [e-mail]");
  const t = textoParaClaude({ card: "pr", aluno: "Ana", duvida: "Dá para parcelar?" });
  assert.match(t, /DÚVIDA DO CLIENTE:\nDá para parcelar\?/);
  assert.doesNotMatch(t, /COLE AQUI/);
  const u = urlClaude(t);
  assert.match(u, /^https:\/\/claude\.ai\/new\?q=/);
  assert.equal(decodeURIComponent(u.split("?q=")[1]), t);
});
