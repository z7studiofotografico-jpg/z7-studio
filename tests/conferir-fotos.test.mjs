import { test } from "node:test";
import assert from "node:assert/strict";
import { nomeArquivoAluno, pastaDoColegio, temFoto, acharAluno, criarDrive, corpoEnvio, lerNomeAluno } from "../js/drive-fotos.js";
import { separarFotos } from "../js/conferir-fotos.js";
import { pastaParaGravar } from "../js/enviar-foto.js";

const F = "application/vnd.google-apps.folder";

test("nome do aluno no Drive: formato do gerador de prévias e o app acha de volta", () => {
  const it = { nome: "Maria Eduarda Silva", codigo: "26CEPNCP-07" };
  assert.equal(nomeArquivoAluno(it), "CEPNCP 07 - MARIA EDUARDA SILVA");
  assert.deepEqual(lerNomeAluno(nomeArquivoAluno(it) + " - foto 01.jpg").num, 7);
  // duas Marias Eduardas no mesmo colégio: o número do ID desempata
  const itens = [{ name: "CEPNCP 08 - MARIA EDUARDA COSTA.jpg" }, { name: nomeArquivoAluno(it) + ".jpg" }];
  assert.equal(acharAluno(itens, it).name, "CEPNCP 07 - MARIA EDUARDA SILVA.jpg");
  // sem ID, só o nome; hífen e barra não quebram o nome
  assert.equal(nomeArquivoAluno({ nome: "José-Carlos / Souza" }), "JOSE CARLOS SOUZA");
  assert.equal(nomeArquivoAluno({ nome: "" }), "ALUNO");
});

test("pasta do colégio: mesmo ano e nome igual ou parecido", () => {
  const cols = [
    { id: "a", name: "Prévias - 2025 - CEPD 117" },
    { id: "b", name: "Prévias - 2026 - CEPD 117" },
    { id: "c", name: "Prévias - 2026 - CIEP 155" }
  ];
  assert.equal(pastaDoColegio(cols, { escola: "CEPD 117", ano: 2026 }).id, "b");
  assert.equal(pastaDoColegio(cols, { escola: "CIEP 156", ano: 2026 }), null);
});

test("separa quem está sem foto: com foto · já comprou · sem telefone · falta gerar", () => {
  const itens = [
    { name: "CEPNCP 01 - ANA LIMA", mimeType: F },
    { name: "CEPNCP 02 - BRUNO REIS.jpg", mimeType: "image/jpeg" }
  ];
  const r = separarFotos(
    [
      { nome: "Ana Lima", codigo: "26CEPNCP-01", etapa: "NA FILA" },
      { nome: "Bruno Reis", codigo: "26CEPNCP-02", etapa: "ENTREGUE" },
      { nome: "Carla Dias", etapa: "ENTREGUE" },
      { nome: "Davi Melo", etapa: "PAGO" },
      { nome: "Enzo Nunes", etapa: "SEM TELEFONE" },
      { nome: "Zeca Prado", etapa: "INTERESSADO" },
      { nome: "Fabi Rosa", etapa: "NA FILA" }
    ],
    itens
  );
  assert.deepEqual(
    r.com.map(x => x.nome),
    ["Ana Lima", "Bruno Reis"]
  );
  assert.deepEqual(
    r.comprou.map(x => x.nome),
    ["Carla Dias", "Davi Melo"]
  );
  assert.deepEqual(
    r.semTel.map(x => x.nome),
    ["Enzo Nunes"]
  );
  assert.deepEqual(
    r.faltam.map(x => x.nome),
    ["Fabi Rosa", "Zeca Prado"]
  );
  // colégio sem pasta no Drive: ninguém tem foto
  assert.equal(separarFotos([{ nome: "Ana Lima", etapa: "NA FILA" }], []).faltam.length, 1);
  assert.equal(temFoto(itens, { nome: "Fabi Rosa" }), false);
});

test("corpo do envio ao Drive (metadados + foto)", async () => {
  const t = await corpoEnvio({ name: "x.jpg", parents: ["p1"] }, new Blob(["FOTO"]), "image/jpeg", "BB").text();
  assert.match(
    t,
    /^--BB\r\nContent-Type: application\/json; charset=UTF-8\r\n\r\n\{"name":"x.jpg","parents":\["p1"\]\}\r\n--BB\r\nContent-Type: image\/jpeg\r\n\r\nFOTO\r\n--BB--$/
  );
});

// Drive falso: guarda as pastas e arquivos criados
function driveFalso(inicial, erroAo = null) {
  const arquivos = inicial.slice();
  const pedidos = [];
  let n = 0;
  const resp = (status, j) => ({ ok: status < 300, status, json: async () => j, text: async () => JSON.stringify(j) });
  const buscar = async (url, o = {}) => {
    pedidos.push({ url, metodo: o.method || "GET", auth: (o.headers || {}).Authorization });
    if (erroAo && erroAo(url, o, pedidos.length)) return resp(403, { error: { message: "forbidden" } });
    if (!o.method) {
      const pai = decodeURIComponent(url).match(/'([^']+)' in parents/);
      if (pai) return resp(200, { files: arquivos.filter(f => f.pai === pai[1] && !f.lixo) });
      return resp(200, { name: "Z7 – Prévias PR" });
    }
    if (o.method === "PATCH") {
      const id = url.split("/files/")[1].split("?")[0];
      arquivos.find(f => f.id === id).lixo = true;
      return resp(200, { id });
    }
    let meta;
    if (/uploadType=multipart/.test(url)) {
      const t = await o.body.text();
      meta = JSON.parse(t.split("\r\n\r\n")[1].split("\r\n")[0]);
    } else meta = JSON.parse(o.body);
    const f = { id: "n" + ++n, name: meta.name, mimeType: meta.mimeType || "image/jpeg", pai: meta.parents[0] };
    arquivos.push(f);
    return resp(200, f);
  };
  return { arquivos, pedidos, D: criarDrive(async () => "TOKEN", buscar) };
}

test("gravar no Drive: acha a pasta do colégio; se não houver, cria dentro da pasta do ano", async () => {
  const { D, arquivos, pedidos } = driveFalso([
    { id: "ano26", name: "Prévias 2026", mimeType: F, pai: "raiz" },
    { id: "cepd", name: "Prévias - 2026 - CEPD 117", mimeType: F, pai: "ano26" }
  ]);
  let r = await pastaParaGravar(D, "raiz", { escola: "CEPD 117", ano: 2026 });
  assert.equal(r.pasta.id, "cepd");
  assert.equal(r.criada, false);
  r = await pastaParaGravar(D, "raiz", { escola: "CIEP 155", ano: 2026 });
  assert.equal(r.criada, true);
  const nova = arquivos.find(f => f.id === r.pasta.id);
  assert.equal(nova.name, "Prévias - 2026 - CIEP 155");
  assert.equal(nova.pai, "ano26");
  assert.equal(nova.mimeType, F);
  // a foto enviada já aparece na lista guardada e o aluno passa a ter foto
  const sub = await D.criarPasta(nova.id, "CIEP 03 - ANA LIMA");
  await D.enviar(sub.id, "CIEP 03 - ANA LIMA - foto 01.jpg", new Blob(["x"]));
  assert.equal(temFoto(await D.listar(nova.id), { nome: "Ana Lima" }), true);
  // tudo com a conta Google de quem envia
  assert.ok(pedidos.every(x => x.auth === "Bearer TOKEN"));
  // lixeira (envio que caiu no meio)
  await D.lixeira(sub.id);
  D.esquecer();
  assert.equal(temFoto(await D.listar(nova.id), { nome: "Ana Lima" }), false);
});

test("gravar no Drive: sem permissão de Editor, avisa em palavras simples", async () => {
  const { D } = driveFalso([], (url, o) => o.method === "POST");
  await assert.rejects(D.criarPasta("raiz", "x"), /precisa ser Editor/);
  // com a chave do Google (sem conta), não grava
  const semConta = criarDrive("CHAVE", async () => ({ ok: true }));
  await assert.rejects(semConta.criarPasta("raiz", "x"), /ID do cliente Google/);
});
