// Resumo do Dashboard: roda toda madrugada no GitHub (3h de Brasília).
// Lê as vendas uma vez, calcula com js/calc.js (o mesmo cálculo do app) e grava resumos/dashboard.
// Assim o Dashboard abre lendo 1 documento.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { resumir } from "../js/calc.js";
import { somaDias } from "../js/regras.js";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Falta o segredo FIREBASE_SERVICE_ACCOUNT no GitHub.");
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
// Se o resumo de hoje já foi feito (pelo botão "Atualizar agora" ou por outra rodada), não lê tudo de novo
const atual = (await db.collection("resumos").doc("dashboard").get()).data();
if (atual && atual.hoje === hoje && !process.env.FORCAR) {
  console.log("Resumo de hoje já existe; nada a fazer.");
  process.exit(0);
}
const ler = async q => (await q.get()).docs.map(d => Object.assign({ id: d.id }, d.data()));
// Funil: só os últimos 24 meses (o Dashboard guarda 24 meses)
const corte = somaDias(hoje, -730);
const [leadsNovos, leadsFechados, prs, forms, insts, ens, becas, separados] = await Promise.all([
  ler(db.collection("leads").where("criadoEm", ">=", corte)),
  ler(db.collection("leads").where("fechadoEm", ">=", corte)),
  ler(db.collection("repasse").where("etapa", "in", ["PAGO", "ENTREGUE"])),
  ler(db.collection("formandos")),
  ler(db.collection("instituicoes")),
  ler(db.collection("ensaios").where("data", ">=", somaDias(hoje, -730))),
  ler(db.collection("becas")),
  ler(db.collection("repasse").where("separadoEm", ">=", somaDias(hoje, -730)))
]);
const leads = [...new Map([...leadsNovos, ...leadsFechados].map(l => [l.id, l])).values()];
const porNome = Object.fromEntries((await ler(db.collection("usuarios"))).filter(u => u.nome).map(u => [u.nome, u.id]));
const r = resumir({ leads, prs, forms, insts, ens, becas, separados }, hoje, porNome);
// só grava se mudou alguma coisa (além do horário)
const semHora = x => JSON.stringify(Object.assign({}, x, { geradoEm: null, hoje: null }));
if (atual && semHora(atual) === semHora(r)) {
  await db.collection("resumos").doc("dashboard").update({ hoje: r.hoje, geradoEm: r.geradoEm });
  console.log("Nada mudou nos números.");
  process.exit(0);
}
await db.collection("resumos").doc("dashboard").set(r);
console.log(`Resumo gravado: ${Object.keys(r.meses).length} meses, a receber R$ ${r.aReceber}.`);
