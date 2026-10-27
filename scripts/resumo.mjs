// Resumo do Dashboard: roda toda madrugada no GitHub (3h de Brasília).
// Lê as vendas uma vez, calcula com js/calc.js (o mesmo cálculo do app) e grava resumos/dashboard.
// Assim o Dashboard abre lendo 1 documento.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { resumir, pessoasDoResumo, fatiaDaPessoa, idResumoPessoa } from "../js/calc.js";
import { lerFontes } from "../js/fontes-resumo.js";

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
// o que ler está em js/fontes-resumo.js (o mesmo do botão "Atualizar agora")
const versao = Number(((await db.collection("config").doc("app").get()).data() || {}).versaoDados) || 0;
const fontes = await lerFontes((c, filtros) => ler(filtros.reduce((q, [a, o, v]) => q.where(a, o, v), db.collection(c))), hoje, versao);
const porNome = Object.fromEntries((await ler(db.collection("usuarios"))).filter(u => u.nome).map(u => [u.nome, u.id]));
const r = resumir(fontes, hoje, porNome);
// cada pessoa da equipe vê só os próprios números (resumos/pessoa_...)
const lote = db.batch();
pessoasDoResumo(r).forEach(e => lote.set(db.collection("resumos").doc(idResumoPessoa(e)), fatiaDaPessoa(r, e)));
await lote.commit();
// só grava se mudou alguma coisa (além do horário)
const semHora = x => JSON.stringify(Object.assign({}, x, { geradoEm: null, hoje: null }));
if (atual && semHora(atual) === semHora(r)) {
  await db.collection("resumos").doc("dashboard").update({ hoje: r.hoje, geradoEm: r.geradoEm });
  console.log("Nada mudou nos números.");
  process.exit(0);
}
await db.collection("resumos").doc("dashboard").set(r);
console.log(`Resumo gravado: ${Object.keys(r.meses).length} meses, a receber R$ ${r.aReceber}.`);
