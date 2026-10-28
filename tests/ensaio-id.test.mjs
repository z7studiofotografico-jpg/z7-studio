import test from "node:test";
import assert from "node:assert/strict";
import {
  tipoIdEnsaio,
  fmtCodigoEnsaio,
  lerCodigoEnsaio,
  precisaCodigo,
  maiorEnsaio,
  anoDoFechamento,
  darCodigoEnsaio
} from "../js/ensaio-id.js";

test("ID do ensaio: tipo pelo serviço do Funil", () => {
  assert.equal(tipoIdEnsaio("Formatura individual (estúdio)"), "EST");
  assert.equal(tipoIdEnsaio("Formatura individual (externo)"), "EXT");
  assert.equal(tipoIdEnsaio("Corporativo"), "COP");
  assert.equal(tipoIdEnsaio("Retrato"), "EST");
  assert.equal(tipoIdEnsaio("Turma"), "");
  assert.equal(tipoIdEnsaio("Outro"), "");
});
test("ID do ensaio: formato 26EST-00001 e leitura", () => {
  assert.equal(fmtCodigoEnsaio(2026, "EST", 1), "26EST-00001");
  assert.equal(fmtCodigoEnsaio(2027, "COP", 123), "27COP-00123");
  assert.deepEqual(lerCodigoEnsaio("26ext-00042"), { aa: "26", tipo: "EXT", n: 42 });
  assert.equal(lerCodigoEnsaio("26CEPNCP-01"), null);
});
test("ID do ensaio: só venda fechada de ensaio e sem ID", () => {
  assert.equal(precisaCodigo({ etapa: "FECHADO", servico: "Corporativo" }), true);
  assert.equal(precisaCodigo({ etapa: "FECHADO", servico: "Corporativo", codigoEnsaio: "26COP-00001" }), false);
  assert.equal(precisaCodigo({ etapa: "PROPOSTA ENVIADA", servico: "Corporativo" }), false);
  assert.equal(precisaCodigo({ etapa: "FECHADO", servico: "Turma" }), false);
  assert.equal(anoDoFechamento({ fechadoEm: "2025-12-30" }), 2025);
  assert.equal(
    maiorEnsaio(2026, "EST", [{ codigoEnsaio: "26EST-00007" }, { codigoEnsaio: "26EXT-00009" }, { codigoEnsaio: "25EST-00050" }]),
    7
  );
});

// Firestore de mentira (em memória) para a transação
function fsFalso(dados) {
  const doc = (_db, c, id) => ({ caminho: c + "/" + id });
  const runTransaction = async (_db, fn) => {
    const ops = [];
    const r = await fn({
      get: async ref => ({ exists: () => ref.caminho in dados, data: () => dados[ref.caminho] }),
      set: (ref, d) => ops.push(() => (dados[ref.caminho] = d)),
      update: (ref, d) => ops.push(() => Object.assign(dados[ref.caminho], d))
    });
    ops.forEach(f => f());
    return r;
  };
  return { doc, runTransaction };
}
test("ID do ensaio: segue a sequência por ano e tipo e não dá dois IDs ao mesmo lead", async () => {
  const dados = {
    "leads/a": { etapa: "FECHADO", servico: "Formatura individual (estúdio)", fechadoEm: "2026-10-01" },
    "leads/b": { etapa: "FECHADO", servico: "Formatura individual (estúdio)", fechadoEm: "2026-10-02" },
    "leads/c": { etapa: "FECHADO", servico: "Formatura individual (externo)", fechadoEm: "2026-10-02" }
  };
  const FS = fsFalso(dados);
  assert.equal(await darCodigoEnsaio(FS, null, "a", []), "26EST-00001");
  assert.equal(await darCodigoEnsaio(FS, null, "a", []), "26EST-00001");
  assert.equal(await darCodigoEnsaio(FS, null, "b", []), "26EST-00002");
  assert.equal(await darCodigoEnsaio(FS, null, "c", []), "26EXT-00001");
  assert.equal(dados["ids/ensaio_26EST"].ultimo, 2);
  // sem internet: não chuta número
  const off = { doc: FS.doc, runTransaction: async () => Promise.reject(new Error("offline")) };
  const w = console.warn;
  console.warn = () => {};
  assert.equal(await darCodigoEnsaio(off, null, "a", []), "");
  console.warn = w;
});

test("WhatsApp certo no Android: o link abre direto o app do número em uso", async () => {
  const { linkNoApp } = await import("../js/numeros-celular.js");
  const u = linkNoApp("https://wa.me/5521999998888?text=Ol%C3%A1%20tudo%20bem", "business");
  assert.match(u, /^intent:\/\/send\/\?phone=5521999998888&text=Ol%C3%A1%20tudo%20bem#Intent;scheme=whatsapp;package=com\.whatsapp\.w4b;/);
  assert.match(u, /S\.browser_fallback_url=https%3A%2F%2Fwa\.me%2F5521999998888/);
  assert.match(linkNoApp("https://wa.me/5521999998888", "whatsapp"), /package=com\.whatsapp;/);
  assert.equal(linkNoApp("https://wa.me/5521999998888", ""), "");
  assert.equal(linkNoApp("https://exemplo.com", "whatsapp"), "");
});
