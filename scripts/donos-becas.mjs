// Becas por responsável (11/11/2026): grava o dono ("respEmail") nos aluguéis antigos e monta a cópia do estoque
// (becasUso). Roda no GitHub (Actions → "Donos das becas" → Run). SIMULAR=true só conta.
// Aluno de aluguel: dono = quem fechou o contrato do colégio no ano (sem contrato: "" = a equipe toda vê).
// Avulso: dono = quem registrou (porEmail). Depois disso o app mantém tudo sozinho.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { acertoDoUso, donosAlugueis, donosAvulsos, USO } from "../js/becas-uso.js";

const SIMULAR = String(process.env.SIMULAR || "") === "true";
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const ler = async nome => (await db.collection(nome).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [alunos, avulsos, contratos, copias] = await Promise.all([ler("alugueis"), ler("becas"), ler("contratosColegio"), ler(USO)]);
const SEM_CONTRATO = String(process.env.SEM_CONTRATO || "")
  .trim()
  .toLowerCase(); // dono dos alunos sem contrato
const dA = donosAlugueis(alunos, contratos, SEM_CONTRATO),
  dV = donosAvulsos(avulsos);
const { gravar, apagar } = acertoDoUso(alunos, avulsos, copias);
const conta = {};
dA.forEach(([, r]) => (conta[r || "(sem dono)"] = (conta[r || "(sem dono)"] || 0) + 1));
console.log(`Alunos de aluguel: ${alunos.length} · dono a gravar: ${dA.length}`, JSON.stringify(conta));
console.log(`Avulsos: ${avulsos.length} · dono a gravar: ${dV.length}`);
console.log(`Cópia do estoque: ${gravar.length} a gravar · ${apagar.length} a apagar`);
if (!SIMULAR) {
  const ops = [
    ...dA.map(
      ([id, r]) =>
        b =>
          b.update(db.doc(`alugueis/${id}`), { respEmail: r })
    ),
    ...dV.map(
      ([id, r]) =>
        b =>
          b.update(db.doc(`becas/${id}`), { respEmail: r })
    ),
    ...gravar.map(
      ([id, u]) =>
        b =>
          b.set(db.doc(`${USO}/${id}`), u)
    ),
    ...apagar.map(id => b => b.delete(db.doc(`${USO}/${id}`)))
  ];
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(f => f(b));
    await b.commit();
  }
  console.log("Gravado:", ops.length);
}
console.log(
  `::notice title=Donos das becas::${SIMULAR ? "Simulação" : "Gravado"}: ${dA.length} alunos, ${dV.length} avulsos, ${gravar.length + apagar.length} no estoque`
);
