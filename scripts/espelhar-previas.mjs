// Cópia das prévias do Drive para o site (Hostinger), toda madrugada (11/11/2026).
// O Google passou a recusar o download direto das fotos pelo navegador; o app agora pega a foto primeiro do site:
//   https://z7studio.com.br/previas/<id do arquivo no Drive>.jpg
// O nome é o id do arquivo no Drive (33 letras e números ao acaso): ninguém adivinha a foto de outro aluno, e a
// pasta não lista os arquivos (.htaccess). Só copia o que é novo ou mudou (previas/indice.json guarda o que já foi).
// Precisa: FIREBASE_SERVICE_ACCOUNT (lê a pasta do Drive em config/app), FTP_HOST, FTP_USER, FTP_PASS.
// 17/11/2026: grava também a lista das pastas (quem é quem) em previas/drive/, para o app achar as prévias antigas
// só pelo site, sem perguntar ao Google Drive (previas-api/drive.php entrega essa lista à equipe logada).
// SIMULAR=true só conta o que copiaria. LIMITE = máximo de fotos por vez (o resto vai na próxima noite).
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { Readable, Writable } from "node:stream";
import { Client } from "basic-ftp";
import admin from "firebase-admin";

const SIMULAR = String(process.env.SIMULAR || "") === "true";
const LIMITE = Number(process.env.LIMITE) || 40000;
const ATE = Date.now() + (Number(process.env.MINUTOS) || 300) * 60000; // para antes do limite de 6 h do GitHub
const API = "https://www.googleapis.com/drive/v3/files";
const CHAVE = (readFileSync(new URL("../config.js", import.meta.url), "utf8").match(/apiKey:\s*"([^"]+)"/) || [])[1];

const HTACCESS = `# prévias dos formandos (cópia do Drive feita pelo GitHub): não lista a pasta, não aparece no Google,
# e o app (app.z7studio.com.br) pode ler as fotos
Options -Indexes
<IfModule mod_headers.c>
  Header set Access-Control-Allow-Origin "*"
  Header set X-Robots-Tag "noindex, nofollow"
  Header set Cache-Control "public, max-age=604800"
</IfModule>
`;

async function pastaDoDrive() {
  if (process.env.DRIVE_PASTA) return process.env.DRIVE_PASTA;
  admin.initializeApp({ credential: admin.credential.cert(SA) });
  const p = (await admin.firestore().doc("config/app").get()).data() || {};
  const link = p.drivePasta || p.drivePrevias || "";
  const id = (String(link).match(/folders\/([\w-]+)/) || [])[1] || link;
  if (!id) throw new Error("Pasta do Drive não configurada (Ajustes do app).");
  return id;
}
// (28/11/2026) a pasta das prévias vai deixar de ser "qualquer pessoa com o link" (fotos de menores): o robô entra
// com a conta de serviço do Firebase (precisa ter a pasta compartilhada com ela, só leitura). Enquanto a pasta não
// estiver compartilhada com a conta, usa a chave antiga (pasta aberta), para a cópia não parar no meio da troca.
const SA = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null;
let tokenDrive = "",
  tokenAte = 0,
  comConta = !!SA;
async function tokenDoRobo() {
  if (Date.now() < tokenAte) return tokenDrive;
  const agora = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const corpo =
    b64({ alg: "RS256", typ: "JWT" }) +
    "." +
    b64({
      iss: SA.client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: agora,
      exp: agora + 3600
    });
  const assinatura = createSign("RSA-SHA256").update(corpo).sign(SA.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + corpo + "." + assinatura
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("A conta do robô não conseguiu entrar no Google: " + JSON.stringify(j).slice(0, 200));
  tokenDrive = j.access_token;
  tokenAte = Date.now() + 50 * 60000;
  return tokenDrive;
}
async function pedirDrive(url) {
  if (comConta && url.startsWith(API)) return fetch(url, { headers: { Authorization: "Bearer " + (await tokenDoRobo()) } });
  return fetch(url.startsWith(API) && !/[?&]key=/.test(url) ? url + (url.includes("?") ? "&" : "?") + "key=" + CHAVE : url);
}
async function drive(url, tentativas = 4) {
  for (let i = 0; ; i++) {
    const r = await pedirDrive(url);
    if (r.ok || i >= tentativas || ![403, 429, 500, 503].includes(r.status)) return r;
    await new Promise(res => setTimeout(res, 2000 * 2 ** i));
  }
}
// o que tem em cada pasta (pastas e fotos), para a lista que vai para o site
const pastas = {},
  paiDe = {},
  nomes = {};
// todas as imagens da pasta e das subpastas
async function listar(raiz) {
  const fotos = [];
  pastas[raiz] = pastas[raiz] || [];
  const fila = [raiz];
  while (fila.length) {
    const pai = fila.shift();
    let token = "";
    do {
      const q = encodeURIComponent(`'${pai}' in parents and trashed = false`);
      const campos = "nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,imageMediaMetadata(width,height))";
      const r = await drive(
        `${API}?q=${q}&fields=${campos}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${token ? "&pageToken=" + token : ""}`
      );
      if (!r.ok) throw new Error(`Drive recusou a lista (${r.status}): ${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      for (const f of j.files || []) {
        const pasta = f.mimeType === "application/vnd.google-apps.folder";
        if (pasta) {
          fila.push(f.id);
          pastas[f.id] = pastas[f.id] || [];
          paiDe[f.id] = pai;
          nomes[f.id] = f.name;
        } else if (/^image\/(jpeg|png|webp)$/.test(f.mimeType)) fotos.push(f);
        if (pasta || /^image\/(jpeg|png|webp)$/.test(f.mimeType)) pastas[pai].push({ id: f.id, name: f.name, mimeType: f.mimeType });
      }
      token = j.nextPageToken || "";
    } while (token);
  }
  return fotos;
}
// a foto inteira; se o Google recusar o download, a miniatura no tamanho original
// (11/11/2026: a recusa vinha em toda foto, com 2 esperas de 2 e 4 s cada: depois da primeira recusa vai direto
//  pela miniatura; a cópia levava uns 20 s por foto)
let diretoRecusado = false;
async function baixar(f) {
  let status = 0;
  if (!diretoRecusado) {
    const r = await drive(`${API}/${f.id}?alt=media&supportsAllDrives=true`, 0);
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    status = r.status;
    if (r.status === 403) diretoRecusado = true;
  }
  if (f.thumbnailLink) {
    const md = f.imageMediaMetadata || {};
    const lado = Math.max(Number(md.width) || 0, Number(md.height) || 0) || 2400;
    const r2 = await drive(f.thumbnailLink.replace(/=s\d+(-c)?$/, "") + "=s" + lado, 3);
    if (r2.ok) return Buffer.from(await r2.arrayBuffer());
    status = r2.status;
  }
  throw new Error(`não baixou (${status})`);
}
async function lerTexto(ftp, nome) {
  const partes = [];
  try {
    await ftp.downloadTo(new Writable({ write: (c, _e, cb) => (partes.push(c), cb()) }), nome);
    return Buffer.concat(partes).toString("utf8");
  } catch (_) {
    return "";
  }
}

const raiz = await pastaDoDrive();
console.log("Pasta do Drive:", raiz);
if (SA) {
  console.log("Conta do robô (compartilhar a pasta com ela, só leitura):", SA.client_email);
  const t = await pedirDrive(`${API}/${raiz}?fields=id,name&supportsAllDrives=true`);
  if (!t.ok) {
    console.log(`A conta do robô ainda não vê a pasta (${t.status}): usando a chave antiga (pasta aberta com link).`);
    comConta = false;
  } else console.log('A conta do robô lê a pasta: pode tirar o "qualquer pessoa com o link".');
}
const fotos = await listar(raiz);
const gb = n => (n / 1024 ** 3).toFixed(1) + " GB";
console.log("Fotos no Drive:", fotos.length, "·", gb(fotos.reduce((t, f) => t + (Number(f.size) || 0), 0)));

if (SIMULAR && !process.env.FTP_HOST) {
  console.log("Simulação sem FTP: só a lista do Drive.");
  process.exit(0);
}
const ftp = new Client(60000);
await ftp.access({ host: process.env.FTP_HOST, user: process.env.FTP_USER, password: process.env.FTP_PASS, secure: false });
// a conta FTP pode começar na pasta do usuário (com public_html dentro) ou já no public_html
const lista = (await ftp.list()).map(x => x.name);
const destino = lista.includes("public_html") ? "public_html/previas" : "previas";
await ftp.ensureDir(destino); // entra na pasta
console.log("Pasta no site:", destino);

const indice = JSON.parse((await lerTexto(ftp, "indice.json")) || "{}");
const novas = fotos.filter(f => indice[f.id] !== f.modifiedTime);
console.log(
  "Novas ou mudadas:",
  novas.length,
  "·",
  gb(novas.reduce((t, f) => t + (Number(f.size) || 0), 0)),
  SIMULAR ? "(simulação: nada é copiado)" : ""
);
if (!SIMULAR) {
  await ftp.uploadFrom(Readable.from([Buffer.from(HTACCESS)]), ".htaccess");
  // várias cópias ao mesmo tempo (cada uma com a sua conexão FTP)
  const fila = novas.slice(0, LIMITE);
  const inicio = Date.now();
  let ok = 0,
    erro = 0,
    salvoEm = 0;
  const salvarIndice = c => c.uploadFrom(Readable.from([Buffer.from(JSON.stringify(indice))]), "indice.json");
  const pasta = await ftp.pwd(); // (antes de começar: o cliente principal já vai estar ocupado copiando)
  // a Hostinger às vezes derruba a conexão: o trabalhador abre outra e segue (a foto volta para a fila)
  const conectar = async () => {
    const c = new Client(60000);
    await c.access({ host: process.env.FTP_HOST, user: process.env.FTP_USER, password: process.env.FTP_PASS, secure: false });
    await c.cd(pasta);
    return c;
  };
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const tentativas = new Map();
  async function trabalhador(n) {
    let c = n === 0 ? ftp : null;
    while (fila.length && Date.now() < ATE) {
      if (!c || c.closed) {
        try {
          c = await conectar();
        } catch (e) {
          console.warn(`Conexão ${n}: não abriu (${e.message}); tenta de novo em 30 s`);
          await espera(30000);
          continue;
        }
      }
      const f = fila.shift();
      if (!f) break; // outra conexão pegou a última foto enquanto esta reconectava
      try {
        const b = await baixar(f);
        await c.uploadFrom(Readable.from([b]), f.id + ".jpg");
        indice[f.id] = f.modifiedTime;
        ok++;
      } catch (e) {
        const t = (tentativas.get(f.id) || 0) + 1;
        tentativas.set(f.id, t);
        if (c.closed && t < 3)
          fila.push(f); // caiu a conexão: tenta essa foto de novo depois
        else {
          erro++;
          console.warn("Falhou:", f.name, e.message);
        }
        if (c.closed) await espera(5000);
      }
      // guarda o índice de vez em quando (se o GitHub parar no meio, não copia tudo de novo)
      if (ok + erro - salvoEm >= 500 && !c.closed) {
        salvoEm = ok + erro;
        await salvarIndice(c).catch(e => console.warn("Índice não salvou agora:", e.message));
        console.log(`${ok + erro} feitas · ${((Date.now() - inicio) / (ok + erro) / 1000).toFixed(1)} s por foto`);
      }
    }
    if (c && c !== ftp) c.close();
  }
  await Promise.all(Array.from({ length: Number(process.env.JUNTAS) || 6 }, (_, n) => trabalhador(n)));
  // o índice no final, numa conexão nova (a principal pode ter caído)
  const fim = await conectar().catch(() => null);
  if (fim) {
    await salvarIndice(fim).catch(e => console.warn("Índice não salvou:", e.message));
    fim.close();
  }
  console.log(`Copiadas: ${ok} · com erro: ${erro} · faltam: ${Math.max(0, novas.length - ok - erro)} (vão na próxima vez)`);
}
if (!SIMULAR) await gravarListas(raiz);

// A lista das pastas no site, em pedaços: "topo" (a pasta das prévias e as pastas por ano) e um arquivo por colégio
// (a pasta do colégio e as dos alunos dentro). mapa.json diz em qual arquivo está cada pasta.
// Só sobe o pedaço que mudou (hashes.json guarda a impressão de cada um).
async function gravarListas(raiz) {
  const { createHash } = await import("node:crypto");
  const ehAno = n => /^pr[ée]vias(\s+20\d\d)?$/i.test(String(n || "").trim());
  const topo = new Set([raiz, ...Object.keys(pastas).filter(id => paiDe[id] === raiz && ehAno(nomes[id]))]);
  const grupoDe = id => {
    if (topo.has(id)) return "topo";
    let x = id;
    while (paiDe[x] && !topo.has(paiDe[x])) x = paiDe[x];
    return x;
  };
  const grupos = {},
    mapa = {};
  for (const id of Object.keys(pastas)) {
    const g = grupoDe(id);
    mapa[id] = g;
    (grupos[g] = grupos[g] || { pastas: {}, nomes: {} }).pastas[id] = pastas[id]
      .slice()
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    grupos[g].nomes[id] = nomes[id] || "";
  }
  const c = new Client(60000);
  await c.access({ host: process.env.FTP_HOST, user: process.env.FTP_USER, password: process.env.FTP_PASS, secure: false });
  const raizFtp = (await c.list()).some(x => x.name === "public_html") ? "public_html/previas" : "previas";
  await c.ensureDir(raizFtp + "/drive");
  await c.uploadFrom(Readable.from([Buffer.from("Require all denied\n")]), ".htaccess");
  const antes = JSON.parse((await lerTexto(c, "hashes.json")) || "{}");
  const depois = {};
  let subiram = 0;
  for (const [g, d] of Object.entries(grupos)) {
    const txt = JSON.stringify(d);
    depois[g] = createHash("sha1").update(txt).digest("hex");
    if (antes[g] === depois[g]) continue;
    await c.uploadFrom(Readable.from([Buffer.from(txt)]), g + ".json");
    subiram++;
  }
  await c.uploadFrom(Readable.from([Buffer.from(JSON.stringify({ raiz, mapa }))]), "mapa.json");
  await c.uploadFrom(Readable.from([Buffer.from(JSON.stringify(depois))]), "hashes.json");
  c.close();
  console.log(`Lista das pastas no site: ${Object.keys(grupos).length} pedaços (${subiram} atualizados)`);
}
ftp.close();
