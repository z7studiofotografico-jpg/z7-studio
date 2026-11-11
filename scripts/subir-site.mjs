// Sobe as páginas de site/publico para a hospedagem do site (Hostinger, por FTP). Roda no GitHub
// (.github/workflows/site-publico.yml) quando algo em site/publico muda. Ex.: site/publico/previa/index.html
// → z7studio.com.br/previa/ (a página do link da prévia do aluno).
import { Client } from "basic-ftp";
import fs from "node:fs";
import path from "node:path";

const RAIZ = new URL("../site/publico/", import.meta.url).pathname;
const arquivos = [];
(function andar(dir) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) andar(p);
    else arquivos.push(path.relative(RAIZ, p));
  }
})(RAIZ);
console.log("Arquivos:", arquivos.join(", "));
const ftp = new Client(60000);
await ftp.access({ host: process.env.FTP_HOST, user: process.env.FTP_USER, password: process.env.FTP_PASS, secure: false });
// a conta FTP pode começar na pasta do usuário (com public_html dentro) ou já no public_html
const raizSite = (await ftp.list()).some(x => x.name === "public_html") ? "/public_html" : await ftp.pwd();
for (const a of arquivos) {
  await ftp.cd(raizSite);
  const pasta = path.dirname(a);
  if (pasta !== ".") await ftp.ensureDir(pasta);
  await ftp.uploadFrom(path.join(RAIZ, a), path.basename(a));
  console.log("Subiu:", a);
}
ftp.close();
