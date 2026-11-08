// Lista única do PR: junta os alunos do Paspatur na lista do PR (vendaComo: "paspatur"). Roda no GitHub
// (Actions → "Juntar Paspatur no PR" → Run), não no celular de ninguém. SIMULAR=true só mostra o que mudaria.
// Antes de gravar, guarda uma cópia dos alunos do Paspatur e das contagens na coleção copiaPaspatur (dentro do
// banco; o app não lê e as regras não deixam ninguém do app ler). O que muda está em juntar-paspatur-plano.mjs.
// O projeto no GitHub é público: o resumo da execução mostra só números e colégios, nunca nome de aluno.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import { planejarJuncao } from "./juntar-paspatur-plano.mjs";

const SIMULAR = String(process.env.SIMULAR || "") === "true";
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Falta o segredo FIREBASE_SERVICE_ACCOUNT no GitHub.");
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const ler = async q => (await q.get()).docs.map(d => ({ id: d.id, ...d.data() }));
const um = async (col, id) => {
  const s = await db.collection(col).doc(id).get();
  return s.exists ? s.data() : null;
};

const [repasse, paspatur, repMeta, pasMeta, importacoes, exclusoes, edicoes] = await Promise.all([
  ler(db.collection("repasse").select("codigo", "ano", "escola")),
  ler(db.collection("paspatur")),
  um("config", "repasse_meta"),
  um("config", "paspatur_meta"),
  ler(db.collection("importacoes").where("col", "==", "paspatur")),
  ler(db.collection("exclusoes").where("col", "==", "paspatur")),
  ler(db.collection("edicoes").where("col", "==", "paspatur"))
]);
const plano = planejarJuncao({ repasseIds: repasse.map(r => r.id), paspatur, repMeta, pasMeta, importacoes, exclusoes, edicoes });

// mesmo ID de aluno (26CEPNCP-01) em pessoas diferentes das duas listas: só avisa
const cod = r => (r.codigo ? `${r.codigo}|${r.ano || ""}` : "");
const porCodigo = new Map(repasse.filter(cod).map(r => [cod(r), r]));
const mesmoCodigo = paspatur.filter(p => cod(p) && porCodigo.has(cod(p)) && porCodigo.get(cod(p)).id !== p.id);

const conta = (lista, chave) => {
  const m = {};
  lista.forEach(r => (m[chave(r)] = (m[chave(r)] || 0) + 1));
  return m;
};
const etapas = conta(paspatur, p => p.etapa || "—");
const linhasPorColegio = lista =>
  Object.entries(conta(lista, r => `${r.escola || "sem colégio"} · ${r.ano || "sem ano"}`)).map(([k, n]) => `- ${k}: ${n}`);
const resumo =
  `${plano.alunos} aluno(s) do Paspatur · ${plano.ops.length} gravações · ` +
  `${plano.repetidos.length} já estavam no PR com o mesmo ID · ${mesmoCodigo.length} com o ID de aluno de outra pessoa`;
console.log(SIMULAR ? "SIMULAÇÃO (nada gravado):" : "Juntando:", resumo);
console.log("Situações:", JSON.stringify(etapas));
console.log(`::notice title=Juntar Paspatur no PR::${SIMULAR ? "Simulação" : "Gravado"}: ${resumo}`);
if (process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      `## Juntar Paspatur no PR (${SIMULAR ? "simulação, nada gravado" : "gravado"})`,
      "",
      resumo,
      "",
      "Situações: " +
        Object.entries(etapas)
          .map(([k, n]) => `${k}: ${n}`)
          .join(" · "),
      "",
      "### Alunos do Paspatur por colégio e ano",
      ...linhasPorColegio(paspatur),
      "",
      plano.repetidos.length ? "### Já estavam no PR com o mesmo ID (ficam os dois; o do Paspatur ganha _pas no fim)" : "",
      ...linhasPorColegio(plano.repetidos),
      "",
      mesmoCodigo.length ? "### Mesmo ID de aluno em pessoas diferentes (conferir no app)" : "",
      ...linhasPorColegio(mesmoCodigo)
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
  // 1) cópia de segurança
  const copia = [
    ...paspatur.map(({ id, ...d }) => ({ id, d })),
    { id: "_config_repasse_meta", d: repMeta || {} },
    { id: "_config_paspatur_meta", d: pasMeta || {} }
  ];
  await gravar(copia, (b, x) => b.set(db.collection("copiaPaspatur").doc(x.id), Object.assign({}, x.d, { copiadoEm: em })));
  // 2) a junção
  await gravar(plano.ops, (b, o) => {
    const r = db.collection(o.col).doc(o.id);
    if (o.tipo === "s") b.set(r, o.dados);
    else if (o.tipo === "m") b.set(r, o.dados, { merge: true });
    else if (o.tipo === "u") b.update(r, o.dados);
    else if (o.tipo === "d") b.delete(r);
  });
  console.log("Pronto.");
}
