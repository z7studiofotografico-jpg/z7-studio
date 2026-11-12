// Cópia das prévias do Drive para o site (Hostinger), toda madrugada (11/11/2026).
// O Google passou a recusar o download direto das fotos pelo navegador; o app agora pega a foto primeiro do site:
//   https://z7studio.com.br/previas/<id do arquivo no Drive>.jpg
// O nome é o id do arquivo no Drive (33 letras e números ao acaso): ninguém adivinha a foto de outro aluno, e a
// pasta não lista os arquivos (.htaccess). Só copia o que é novo ou mudou (previas/indice.json guarda o que já foi).
// Precisa: FIREBASE_SERVICE_ACCOUNT (lê a pasta do Drive em config/app), FTP_HOST, FTP_USER, FTP_PASS.
// SIMULAR=true só conta o que copiaria. LIMITE = máximo de fotos por vez (o resto vai na próxima noite).
import { readFileSync } from "node:fs";
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
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const p = (await admin.firestore().doc("config/app").get()).data() || {};
  const link = p.drivePasta || p.drivePrevias || "";
  const id = (String(link).match(/folders\/([\w-]+)/) || [])[1] || link;
  if (!id) throw new Error("Pasta do Drive não configurada (Ajustes do app).");
  return id;
}
async function drive(url, tentativas = 4) {
  for (let i = 0; ; i++) {
    const r = await fetch(url);
    if (r.ok || i >= tentativas || ![403, 429, 500, 503].includes(r.status)) return r;
    await new Promise(res => setTimeout(res, 2000 * 2 ** i));
  }
}
// todas as imagens da pasta e das subpastas
async function listar(raiz) {
  const fotos = [];
  const fila = [raiz];
  while (fila.length) {
    const pai = fila.shift();
    let token = "";
    do {
      const q = encodeURIComponent(`'${pai}' in parents and trashed = false`);
      const campos = "nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,imageMediaMetadata(width,height))";
      const r = await drive(
        `${API}?q=${q}&fields=${campos}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${CHAVE}${token ? "&pageToken=" + token : ""}`
      );
      if (!r.ok) throw new Error(`Drive recusou a lista (${r.status}): ${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      for (const f of j.files || []) {
        if (f.mimeType === "application/vnd.google-apps.folder") fila.push(f.id);
        else if (/^image\/(jpeg|png|webp)$/.test(f.mimeType)) fotos.push(f);
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
    const r = await drive(`${API}/${f.id}?alt=media&supportsAllDrives=true&key=${CHAVE}`, 0);
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
ftp.close();
