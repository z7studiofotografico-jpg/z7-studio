// Acertar os IDs e os nomes dos colégios do PR (ver acertar-ids-plano.mjs). Roda no GitHub
// (Actions → "Acertar IDs dos colégios" → Run). SIMULAR=true só mostra o que mudaria.
// Antes de gravar, guarda o ID e o colégio antigos de cada aluno na coleção copiaIds (dentro do banco).
// O projeto no GitHub é público: o resumo mostra só colégios, siglas e quantidades, nunca nome de aluno.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import { planejarIds } from "./acertar-ids-plano.mjs";

const SIMULAR = String(process.env.SIMULAR || "") === "true";
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Falta o segredo FIREBASE_SERVICE_ACCOUNT no GitHub.");
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const ler = async q => (await q.get()).docs.map(d => ({ id: d.id, ...d.data() }));

const [insts, alunos, ids] = await Promise.all([
  ler(db.collection("instituicoes").select("nome", "sigla")),
  ler(db.collection("repasse").select("escola", "ano", "codigo", "escolaOrig")),
  ler(db.collection("ids"))
]);
const contadores = Object.fromEntries(ids.map(x => [x.id, x.ultimo]));
const plano = planejarIds(alunos, insts, contadores);
const resumo = `${alunos.length} alunos no PR · ${plano.alunos} com ID ou colégio corrigido · ${plano.ops.length} gravações`;
console.log(SIMULAR ? "SIMULAÇÃO (nada gravado):" : "Gravando:", resumo);
console.log(`::notice title=Acertar IDs dos colégios::${SIMULAR ? "Simulação" : "Gravado"}: ${resumo}`);
const linhas = plano.grupos
  .sort((a, b) => a.para.localeCompare(b.para) || a.ano - b.ano)
  .map(g => `| ${g.ano} | ${g.de} | ${g.para === g.de ? "(igual)" : g.para} | ${g.siglaDe} → ${g.siglaPara} | ${g.n} |`);
console.log(linhas.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      `## Acertar IDs dos colégios (${SIMULAR ? "simulação, nada gravado" : "gravado"})`,
      "",
      resumo,
      "",
      "| Ano | Colégio no app | Nome do cadastro | Sigla | Alunos |",
      "|---|---|---|---|---|",
      ...linhas
    ].join("\n") + "\n"
  );

if (!SIMULAR) {
  const gravar = async (lista, fazer) => {
    for (let i = 0; i < lista.length; i += 400) {
      const b = db.batch();
      lista.slice(i, i + 400).forEach(x => fazer(b, x));
      await b.commit();
    }
  };
  const em = new Date().toISOString();
  const porId = new Map(alunos.map(a => [a.id, a]));
  // 1) cópia de segurança: colégio e ID de antes de cada aluno que muda
  const muda = plano.ops.filter(o => o.col === "repasse").map(o => porId.get(o.id));
  await gravar(muda, (b, a) =>
    b.set(db.collection("copiaIds").doc(a.id), { escola: a.escola || "", codigo: a.codigo || "", copiadoEm: em })
  );
  // 2) a correção
  await gravar(plano.ops, (b, o) => {
    const r = db.collection(o.col).doc(o.id);
    // config: troca as três contagens inteiras (os nomes antigos dos colégios saem) e deixa o resto como está
    if (o.tipo === "u" || o.col === "config") b.update(r, o.dados);
    else if (o.tipo === "m") b.set(r, o.dados, { merge: true });
  });
  console.log("Pronto.");
}
