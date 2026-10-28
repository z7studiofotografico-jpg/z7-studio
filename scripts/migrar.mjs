// Atualiza os dados antigos para o formato atual do app. Roda no GitHub (Actions → "Atualizar dados" → Run),
// não no celular de ninguém. Pode rodar quantas vezes quiser: só mexe no que ainda está no formato antigo.
// SIMULAR=true mostra quantos registros mudariam, sem gravar nada. O que muda está em js/migracao.js.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "node:fs";
import { planejar, criarEmailDe, relatorioResponsaveis, VERSAO_DADOS } from "../js/migracao.js";
import { CFG } from "./config.mjs";

const SIMULAR = String(process.env.SIMULAR || "") === "true";
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Falta o segredo FIREBASE_SERVICE_ACCOUNT no GitHub.");
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const ler = async nome => (await db.collection(nome).get()).docs.map(d => ({ id: d.id, ...d.data() }));

const nomes = ["instituicoes", "formandos", "repasse", "agenda", "ensaios", "leads", "fones", "config", "ids"];
const cols = Object.fromEntries(await Promise.all(nomes.map(async n => [n, await ler(n)])));
// responsável antigo (nome) → e-mail de quem está cadastrado na Equipe (ou dono no config.js)
const { emailDe, comoAchou } = criarEmailDe(await ler("usuarios"), CFG.donos);
const { ops, conta } = planejar(cols, emailDe);
const resp = relatorioResponsaveis(cols, emailDe, comoAchou);

console.log(SIMULAR ? "SIMULAÇÃO (nada gravado):" : "Atualizando:", JSON.stringify(conta), "·", ops.length, "gravações");
// aparece como aviso no resumo da execução no GitHub
console.log(`::notice title=Atualizar dados::${SIMULAR ? "Simulação" : "Gravado"}: ${JSON.stringify(conta)} · ${ops.length} gravações`);
// Responsáveis antigos: quem foi ligado a quem e quem não achou ninguém (aparece na página da execução no GitHub)
const semDono = resp.filter(r => !r.email);
resp.forEach(r =>
  console.log(
    `${r.email ? "✓" : "✗"} ${r.nome} → ${r.email || "NÃO ACHOU"}${r.como ? " (" + r.como + ")" : ""} · ${r.registros} registro(s)`
  )
);
if (semDono.length)
  console.log(
    `::warning title=Responsáveis sem cadastro::${semDono.length} nome(s) não bate(m) com ninguém da Equipe: ${semDono.map(r => r.nome).join(", ")}. Veja a tabela no resumo.`
  );
if (process.env.GITHUB_STEP_SUMMARY) {
  const onde = o =>
    Object.entries(o)
      .map(([k, n]) => `${k}: ${n}`)
      .join(", ");
  const linhas = [
    `## Atualizar dados (${SIMULAR ? "simulação, nada gravado" : "gravado"})`,
    "",
    `${ops.length} gravações · ${
      Object.entries(conta)
        .map(([k, n]) => `${k}: ${n}`)
        .join(" · ") || "nada a mudar"
    }`,
    "",
    "### Responsáveis dos registros antigos",
    "",
    resp.length ? "| Nome no registro | Ligado a | Como achou | Registros |" : "Nenhum registro antigo sem o e-mail do responsável.",
    ...(resp.length ? ["|---|---|---|---|"] : []),
    ...resp.map(r => `| ${r.nome} | ${r.email || "**não achou ninguém**"} | ${r.como || "—"} | ${r.registros} (${onde(r.onde)}) |`),
    "",
    semDono.length
      ? "**Os que não acharam ninguém** ficam só para o admin (a equipe não vê). Para ligar: cadastre a pessoa em Equipe com esse nome (ou corrija o nome dela) e rode de novo; ou, no app, abra o contato e escolha o responsável."
      : "",
    resp.some(r => r.como === "primeiro nome")
      ? "Confira os ligados pelo **primeiro nome**: se não for a mesma pessoa, cadastre o nome completo certo antes de rodar sem simular."
      : ""
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, linhas.join("\n") + "\n");
}
if (!SIMULAR) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(o => {
      const r = db.collection(o.col).doc(o.id);
      const dados = Object.assign({}, o.dados);
      (o.apagar || []).forEach(c => (dados[c] = FieldValue.delete()));
      if (o.tipo === "s") b.set(r, dados);
      else b.update(r, dados);
    });
    await b.commit();
  }
  await db.collection("config").doc("app").set({ versaoDados: VERSAO_DADOS }, { merge: true });
  console.log("Pronto. Versão dos dados:", VERSAO_DADOS);
}
