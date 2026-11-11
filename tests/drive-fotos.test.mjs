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
test("link direto da pasta de um colégio e nome com letra a menos (YONE × YONNE)", async () => {
  const F = "application/vnd.google-apps.folder";
  const arvore = {
    col: [
      { id: "s2", name: "CEYMS 02 - DOMINGOS JOSE.jpg", mimeType: "image/jpeg" },
      { id: "p2", name: "CEYMS 02 - DOMINGOS JOSE", mimeType: F }
    ],
    p2: [{ id: "f1", name: "x.jpg", mimeType: "image/jpeg" }]
  };
  const buscar = async url => {
    const u = decodeURIComponent(url);
    if (/\/files\/col\?/.test(u)) return { ok: true, json: async () => ({ name: "Prévias - 2022 - C.E. YONE MARIA SIQUEIRA" }) };
    const pai = u.match(/'([^']+)' in parents/)[1];
    return { ok: true, json: async () => ({ files: arvore[pai] || [] }) };
  };
  const r = await criarDrive("K", buscar).fotosDoAluno("col", {
    nome: "DOMINGOS JOSE",
    escola: "C.E YONNE MARIA SIQUEIRA DE ANDRADE",
    ano: 2022
  });
  assert.deepEqual(
    r.fotos.map(f => f.id),
    ["f1"]
  );
  assert.deepEqual(
    r.folhas.map(f => f.id),
    ["s2"]
  );
});

test("acha a prévia com os jeitos de nomear das planilhas antigas (CIEP com número, SIGLA - NN, ano na frente)", () => {
  const maria = { nome: "MARIA EDUARDA SILVA SOUZA", codigoOrig: "CIEP 384 - 07", codigo: "21CIEP384-07" };
  const joao = { nome: "JOAO PEDRO LIMA", codigoOrig: "EEMZC - 12", codigo: "21EEMZC-12" };
  for (const n of [
    "CIEP384 07 - MARIA EDUARDA SILVA SOUZA.jpg",
    "CIEP 384 - 07 - MARIA EDUARDA SILVA SOUZA.jpg",
    "CIEP 384 07 - MARIA EDUARDA.jpg"
  ]) {
    assert.equal(lerNomeAluno(n).num, 7, n);
    assert.ok(acharAluno([{ name: n }], maria), n);
  }
  for (const n of [
    "EEMZC 12 - JOAO PEDRO LIMA.jpg",
    "EEMZC - 12 - JOAO PEDRO LIMA.jpg",
    "21EEMZC-12 - JOAO PEDRO LIMA.jpg",
    "JOAO PEDRO LIMA.jpg"
  ])
    assert.ok(acharAluno([{ name: n }], joao), n);
  assert.equal(lerNomeAluno("EEMZC - 12 - JOAO PEDRO LIMA").nome, "JOAO PEDRO LIMA");
  // dois com o mesmo primeiro nome: o número decide
  const itens = [{ name: "CIEP 384 - 06 - MARIA EDUARDA" }, { name: "CIEP 384 - 07 - MARIA EDUARDA" }];
  assert.equal(acharAluno(itens, maria).name, "CIEP 384 - 07 - MARIA EDUARDA");
});

import { ehPastaAno as _ehPastaAno } from "../js/drive-fotos.js";
test("pasta por ano das prévias (Prévias 2026 / PREVIAS) é reconhecida; a do colégio não", () => {
  assert.equal(_ehPastaAno("Prévias 2026"), true);
  assert.equal(_ehPastaAno("PREVIAS"), true);
  assert.equal(_ehPastaAno("Prévias - 2026 - CIEP 433"), false);
});

import { lerNomeAluno as _ler } from "../js/drive-fotos.js";
test("nome do aluno nos formatos novos das prévias", () => {
  assert.deepEqual([_ler("01 - CIEP 225 - LORENA RODRIGUES").num, _ler("01 - CIEP 225 - LORENA RODRIGUES").nome], [1, "LORENA RODRIGUES"]);
  assert.deepEqual([_ler("26 -CIEP336- 07 - SOFIA SOUZA").num, _ler("26 -CIEP336- 07 - SOFIA SOUZA").nome], [7, "SOFIA SOUZA"]);
  assert.deepEqual([_ler("01 - CIEP 460-2022- JAMILLE DE BRITO.jpg").num, _ler("01 - CIEP 460-2022- JAMILLE DE BRITO.jpg").nome], [1, "JAMILLE DE BRITO"]);
  assert.deepEqual([_ler("2025 -CEJPII- 002 - (N) FABRICIO LIMA").num, _ler("2025 -CEJPII- 002 - (N) FABRICIO LIMA").nome], [2, "FABRICIO LIMA"]);
  assert.equal(_ler("CEYMS 02 - DOMINGOS JOSE").nome, "DOMINGOS JOSE");
});

test("nome do aluno: número colado na sigla e sufixo -1", () => {
  assert.deepEqual([_ler("2024 - CEPD 08 - THAIS GUEDES").num, _ler("2024 - CEPD 08 - THAIS GUEDES").nome], [8, "THAIS GUEDES"]);
  assert.deepEqual([_ler("2025 -CIEP169- 01 - MARIA CLARA ABREU-1").num, _ler("2025 -CIEP169- 01 - MARIA CLARA ABREU-1").nome], [1, "MARIA CLARA ABREU"]);
});

import { parecidoColegio as _par } from "../js/drive-fotos.js";
test("colégio com nome parecido na pasta do Drive", () => {
  assert.ok(_par("C. E. NUTA BARTLET JAMES", "NUTHA BARTLET JAMES") >= 0.75);
  assert.ok(_par("C.E. DIUMA MADEIRA SALLES DE SOUZA", "DIUMA MADEIRA SALLES FERREIRA") >= 0.75);
  assert.ok(_par("C. E. PROFESSORA JEANNETTE DE SOUZA COELHO MANNARINO", "P JEANNETTE S C MANNARINO") >= 0.75);
  assert.equal(_par("CIEP 156 DR. ALBERT SABIN", "CIEP 155 MARIA JOAQUINA"), 0);
  assert.ok(_par("C.E SANTO ANTONIO", "SANTO ANTONIO DE PADUA") < 0.75);
});

test("trocar as fotos: a escolha feita à mão vale antes da busca pelo nome", async () => {
  const P = "application/vnd.google-apps.folder";
  const arvore = {
    raiz: [{ id: "c1", name: "Prévias - 2026 - C.E. NUTA BARTLET", mimeType: P }],
    c1: [
      { id: "f1", name: "CNB 01 - ANA LIMA.jpg", mimeType: "image/jpeg" },
      { id: "p1", name: "CNB 01 - ANA LIMA", mimeType: P },
      { id: "f2", name: "CNB 02 - SUELLEN PEREIRA.jpg", mimeType: "image/jpeg" },
      { id: "p2", name: "CNB 02 - SUELLEN PEREIRA", mimeType: P }
    ],
    p1: [{ id: "a1", name: "1.jpg", mimeType: "image/jpeg" }],
    p2: [
      { id: "s1", name: "1.jpg", mimeType: "image/jpeg" },
      { id: "s2", name: "2.jpg", mimeType: "image/jpeg" }
    ]
  };
  const buscar = async url => {
    const pai = (decodeURIComponent(url).match(/'([\w-]+)' in parents/) || [])[1];
    return { ok: true, json: async () => ({ files: arvore[pai] || [] }) };
  };
  const d = criarDrive("K", buscar);
  const it = { nome: "Ana Lima", escola: "C.E. Nuta Bartlet", ano: 2026, codigo: "26CNB-01" };
  const auto = await d.fotosDoAluno("raiz", it);
  assert.deepEqual([auto.folhas.map(f => f.id), auto.fotos.map(f => f.id)], [["f1"], ["a1"]]);
  const lista = await d.alunosDaPasta("c1");
  assert.deepEqual(
    lista.map(a => [a.cod, a.nome, a.folhaId, a.pastaId]),
    [
      ["CNB 01", "ANA LIMA", "f1", "p1"],
      ["CNB 02", "SUELLEN PEREIRA", "f2", "p2"]
    ]
  );
  const trocado = await d.fotosDoAluno("raiz", Object.assign({}, it, { fotosDrive: { colegioId: "c1", folhaId: "f2", pastaId: "p2" } }));
  assert.equal(trocado.escolhida, true);
  assert.deepEqual([trocado.folhas.map(f => f.id), trocado.fotos.map(f => f.id)], [["f2"], ["s1", "s2"]]);
});

test("foto: se o download direto falhar, baixa pela miniatura no tamanho original", async () => {
  const { criarDrive, miniaturaGrande } = await import("../js/drive-fotos.js");
  assert.equal(miniaturaGrande("https://lh3.googleusercontent.com/x/AB=s220", 1080), "https://lh3.googleusercontent.com/x/AB=s1080");
  const pedidos = [];
  const buscar = async u => {
    pedidos.push(u);
    if (/z7studio\.com\.br\/previas/.test(u)) throw new TypeError("Failed to fetch"); // ainda não está no site
    if (/alt=media/.test(u)) throw new TypeError("Failed to fetch");
    if (/fields=thumbnailLink/.test(u))
      return { ok: true, json: async () => ({ thumbnailLink: "https://lh3.googleusercontent.com/x/AB=s220", imageMediaMetadata: { width: 1080, height: 535 } }) };
    return { ok: true, blob: async () => "FOTO" };
  };
  const D = criarDrive("chave", buscar);
  assert.equal(await D.baixar("f1"), "FOTO");
  assert.ok(pedidos.some(u => u === "https://lh3.googleusercontent.com/x/AB=s1080"));
});

test("foto: vem primeiro da cópia no site, sem pedir ao Drive", async () => {
  const { criarDrive, SITE_PREVIAS } = await import("../js/drive-fotos.js");
  const pedidos = [];
  const buscar = async u => {
    pedidos.push(u);
    return { ok: true, headers: { get: () => "image/jpeg" }, blob: async () => "DO SITE" };
  };
  const D = criarDrive("chave", buscar);
  assert.equal(await D.baixar("abc123"), "DO SITE");
  assert.deepEqual(pedidos, [SITE_PREVIAS + "/abc123.jpg"]);
});
