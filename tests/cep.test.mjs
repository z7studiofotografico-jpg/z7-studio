import { test } from "node:test";
import assert from "node:assert/strict";
import { lerCep, mostrarCep, buscarCep, faltaEndereco } from "../js/cep.js";

test("CEP: lê e mostra", () => {
  assert.equal(lerCep("26.540-000"), "26540000");
  assert.equal(lerCep("2654000"), "");
  assert.equal(mostrarCep("26540000"), "26540-000");
});
test("CEP: busca rua, bairro e cidade (ViaCEP)", async () => {
  const urls = [];
  const buscar = async u => {
    urls.push(u);
    return u.includes("00000000")
      ? { ok: true, json: async () => ({ erro: true }) }
      : { ok: true, json: async () => ({ logradouro: "Rua A", bairro: "Centro", localidade: "Nilópolis", uf: "RJ" }) };
  };
  assert.deepEqual(await buscarCep("26540-000", buscar), { rua: "Rua A", bairro: "Centro", cidade: "Nilópolis", uf: "RJ" });
  assert.equal(urls[0], "https://viacep.com.br/ws/26540000/json/");
  assert.equal(await buscarCep("00000-000", buscar), null);
  assert.equal(await buscarCep("123", buscar), null);
  await assert.rejects(buscarCep("26540000", async () => ({ ok: false, status: 500 })));
});
test("endereço completo: CEP, rua, número, bairro e cidade", () => {
  assert.deepEqual(faltaEndereco({}), ["CEP", "Rua", "Número", "Bairro", "Cidade"]);
  assert.deepEqual(faltaEndereco({ cep: "26540000", rua: "Rua A", numero: "S/N", bairro: "Centro", cidade: "Nilópolis" }), []);
  assert.deepEqual(faltaEndereco({ cep: "2654", rua: "Rua A", numero: " ", bairro: "Centro", cidade: "Nilópolis" }), ["CEP", "Número"]);
});
