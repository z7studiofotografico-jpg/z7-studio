import { test } from "node:test";
import assert from "node:assert/strict";
import { PADRAO, montarCatalogo, disponivel, precisaComprar, custoReal, margem, DO_ALUGUEL } from "../js/catalogo.js";

test("catálogo: fotos avulsas, kit, insumos (papéis A4/A3, plastificação, tintas)", () => {
  const ids = PADRAO.map(p => p.id);
  for (const t of [
    "foto_7x10",
    "foto_21x29_7",
    "foto_60x150",
    "kit_pr",
    "paspatur",
    "papel_glossy230_A4",
    "papel_micro260_A3",
    "plastificacao_303x426",
    "tinta_sublimatica"
  ])
    assert.ok(ids.includes(t), t);
  assert.equal(PADRAO.find(p => p.id === "foto_50x70").produzidoPor, "laboratório");
  assert.equal(new Set(ids).size, ids.length);
  DO_ALUGUEL.forEach(id => assert.ok(ids.includes(id), id));
});
test("estoque: disponível nunca negativo; custo real com a ficha; margem", () => {
  assert.equal(disponivel({ fisico: 3, reservado: 5 }), 0);
  assert.equal(disponivel({ fisico: 10, reservado: 4 }), 6);
  assert.equal(precisaComprar({ controla: true, minimo: 5, fisico: 6, reservado: 2 }), true);
  const cat = montarCatalogo({ papel_glossy230_A4: { custo: 2 }, tinta_corante: { custo: 0.5 }, foto_10x15: { preco: 10 } });
  const f = cat.find(p => p.id === "foto_10x15");
  assert.equal(custoReal(f, cat), 0.57); // 1/4 de folha A4 (R$ 0,50) + 0,15 ml de tinta (R$ 0,075)
  assert.equal(margem(f, cat), 94);
});
