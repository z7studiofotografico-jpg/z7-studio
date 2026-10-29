import { test } from "node:test";
import assert from "node:assert/strict";
import { idDaPasta, lerPastaColegio, lerNomeAluno, acharAluno, criarDrive } from "../js/drive-fotos.js";

test("link da pasta do Drive → id", () => {
  assert.equal(idDaPasta("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrSt_uv-w?usp=sharing"), "1AbCdEfGhIjKlMnOpQrSt_uv-w");
  assert.equal(idDaPasta("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp"), "1AbCdEfGhIjKlMnOp");
  assert.equal(idDaPasta("bobagem"), "");
});
test("pasta do colégio e nome do aluno", () => {
  assert.deepEqual(lerPastaColegio("Prévias - 2022 - C.E. YONNE MARIA SIQUEIRA"), { ano: 2022, chave: "YONNE MARIA SIQUEIRA" });
  assert.deepEqual(lerNomeAluno("CEYMS 02 - DOMINGOS JOSE.jpg"), { cod: "CEYMS 02", num: 2, nome: "DOMINGOS JOSE" });
  assert.deepEqual(lerNomeAluno("CEYMS 02 - DOMINGOS JOSE - pagina 2.jpg").nome, "DOMINGOS JOSE");
  const itens = ["CEYMS 01 - FABIOLA STURES", "CEYMS 02 - DOMINGOS JOSE", "CEYMS 20 - TUPIARA C. DE OLIVEIRA"].map(name => ({ name }));
  assert.equal(acharAluno(itens, { nome: "Domingos José" }).name, "CEYMS 02 - DOMINGOS JOSE");
  assert.equal(acharAluno(itens, { nome: "TUPIARA CRISTINA DE OLIVEIRA" }).name, "CEYMS 20 - TUPIARA C. DE OLIVEIRA");
  assert.equal(acharAluno(itens, { nome: "Maria Souza" }), null);
});
test("busca as fotos do aluno no Drive (colégio pelo ano e nome, aluno pelo nome)", async () => {
  const F = "application/vnd.google-apps.folder";
  const arvore = {
    raiz: [
      { id: "c21", name: "Prévias - 2021 - C.E. YONNE MARIA SIQUEIRA", mimeType: F },
      { id: "c22", name: "Prévias - 2022 - C.E. YONNE MARIA SIQUEIRA", mimeType: F }
    ],
    c22: [
      { id: "s2", name: "CEYMS 02 - DOMINGOS JOSE.jpg", mimeType: "image/jpeg" },
      { id: "p2", name: "CEYMS 02 - DOMINGOS JOSE", mimeType: F }
    ],
    p2: [
      { id: "f1", name: "CEYMS 02 - DOMINGOS JOSE - foto 01.jpg", mimeType: "image/jpeg" },
      { id: "f2", name: "CEYMS 02 - DOMINGOS JOSE - foto 02.jpg", mimeType: "image/jpeg" }
    ]
  };
  const buscar = async url => {
    const pai = decodeURIComponent(url).match(/'([^']+)' in parents/)[1];
    return { ok: true, json: async () => ({ files: arvore[pai] || [] }) };
  };
  const d = criarDrive("CHAVE", buscar);
  const r = await d.fotosDoAluno("raiz", { nome: "Domingos Jose", escola: "C.E YONNE MARIA SIQUEIRA DE ANDRADE", ano: 2022 });
  assert.deepEqual(
    r.folhas.map(f => f.id),
    ["s2"]
  );
  assert.deepEqual(
    r.fotos.map(f => f.id),
    ["f1", "f2"]
  );
  const nada = await d.fotosDoAluno("raiz", { nome: "Domingos Jose", escola: "CIEP 225", ano: 2022 });
  assert.match(nada.erro, /ainda não estão no Drive/);
});
