// Atualiza os dados antigos para o formato atual do app. Roda no GitHub (Actions → "Atualizar dados" → Run),
// não no celular de ninguém. Pode rodar quantas vezes quiser: só mexe no que ainda está no formato antigo.
// SIMULAR=true mostra quantos registros mudariam, sem gravar nada. O que muda está em js/migracao.js.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { planejar, VERSAO_DADOS } from "../js/migracao.js";
import { CFG } from "./config.mjs";

const SIMULAR = String(process.env.SIMULAR || "") === "true";
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Falta o segredo FIREBASE_SERVICE_ACCOUNT no GitHub.");
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const ler = async nome => (await db.collection(nome).get()).docs.map(d => ({ id: d.id, ...d.data() }));

const porNome = {};
(await ler("usuarios")).forEach(u => {
  if (u.nome) porNome[u.nome] = u.id;
});
(CFG.donos || []).forEach(d => {
  if (d.nome && !porNome[d.nome]) porNome[d.nome] = d.email.toLowerCase();
});
const nomes = ["instituicoes", "formandos", "repasse", "agenda", "ensaios", "leads"];
const cols = Object.fromEntries(await Promise.all(nomes.map(async n => [n, await ler(n)])));
const { ops, conta } = planejar(cols, nome => porNome[nome] || "");

console.log(SIMULAR ? "SIMULAÇÃO (nada gravado):" : "Atualizando:", JSON.stringify(conta), "·", ops.length, "gravações");
// aparece como aviso no resumo da execução no GitHub
console.log(`::notice title=Atualizar dados::${SIMULAR ? "Simulação" : "Gravado"}: ${JSON.stringify(conta)} · ${ops.length} gravações`);
if (!SIMULAR) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(o => {
      const r = db.collection(o.col).doc(o.id);
      if (o.tipo === "s") b.set(r, o.dados);
      else b.update(r, o.dados);
    });
    await b.commit();
  }
  await db.collection("config").doc("app").set({ versaoDados: VERSAO_DADOS }, { merge: true });
  console.log("Pronto. Versão dos dados:", VERSAO_DADOS);
}
