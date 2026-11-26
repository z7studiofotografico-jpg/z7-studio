// 💳 Pagamentos do kit pelo site, sem depender do app aberto (25/11/2026).
// Antes, o aluno só virava Pago quando o Adriano estava com o app aberto (o app busca a cada 2 minutos). Este robô
// roda no GitHub a cada 10 minutos: busca os pagamentos que a InfinitePay confirmou no site, marca o aluno do link
// como Pago (o mesmo que o app faz; o sinal do ensaio fecha o lead do Funil) e avisa no celular do Adriano, da Luciana e de quem atende o aluno.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { DONOS } from "./config.mjs";
import { patchPago, patchSinal, ONDE } from "../js/pagamentos-site.js";

const API = "https://z7studio.com.br/previas-api/pagamentos.php";
const COMPROU = ["PAGO", "ENTREGUE"];
const APP_URL = (process.env.APP_URL || "").replace(/\/?$/, "/");
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const brl = v => "R$ " + Number(v).toFixed(2).replace(".", ",");
const primeiro = s =>
  String(s || "")
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/^./, c => c.toUpperCase());

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Falta o segredo FIREBASE_SERVICE_ACCOUNT no GitHub.");
  process.exit(1);
}
const credencial = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
initializeApp({ credential: credencial });
const db = getFirestore();
// o site aceita quem consegue ler a área do administrador no banco: a conta de serviço consegue
const { access_token } = await credencial.getAccessToken();
const chamar = async (o = {}) => {
  const r = await fetch(API, Object.assign({}, o, { headers: { Authorization: "Bearer " + access_token } }));
  if (!r.ok) throw new Error("pagamentos do site: " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
};

const { pagamentos = [] } = await chamar();
console.log(`${pagamentos.length} pagamento(s) do site para registrar.`);
const avisos = [];
for (const p of pagamentos) {
  try {
    let achou = null;
    for (const [col, campo] of ONDE) {
      const s = await db.collection(col).where(campo, "==", p.codigo).limit(1).get();
      if (!s.empty) {
        achou = { col, ref: s.docs[0].ref, it: s.docs[0].data() };
        break;
      }
    }
    if (!achou) {
      console.warn("Pagamento sem aluno com o link", p.codigo, "(fica na lista do site)");
      continue;
    }
    if (achou.col === "leads") {
      if (!achou.it.sinalPago) {
        const patch = Object.assign(patchSinal(p, hoje, achou.it), { atualizadoEm: new Date().toISOString() });
        await achou.ref.update(patch);
        avisos.push({
          para: [...DONOS, String(achou.it.respEmail || "").toLowerCase()].filter(Boolean),
          title: `💳 ${primeiro(achou.it.nome)} pagou o sinal do ensaio (${p.forma === "pix" ? "Pix" : "cartão"} ${brl(patch.sinalPago.valor)})`,
          body: "A venda já está como Fechado no Funil. Falta marcar a data do ensaio."
        });
        console.log("Sinal pago:", achou.ref.id);
      }
    } else if (!COMPROU.includes(achou.it.etapa)) {
      const patch = Object.assign(patchPago(p, hoje), { atualizadoEm: new Date().toISOString() });
      await achou.ref.update(patch);
      avisos.push({
        para: [...DONOS, String(achou.it.respEmail || "").toLowerCase()].filter(Boolean),
        title: `💳 ${primeiro(achou.it.nome)} pagou o kit (${p.forma === "pix" ? "Pix" : "cartão"} ${brl(patch.valor)})`,
        body: `${achou.it.codigo ? achou.it.codigo + " · " : ""}${achou.it.escola || ""}. Já está como Vendido no app.`
      });
      console.log("Pago:", achou.col, achou.ref.id);
    }
    const f = new FormData();
    f.append("feito", p.transaction_nsu);
    await chamar({ method: "POST", body: f });
  } catch (e) {
    console.error("Pagamento", p && p.transaction_nsu, e.message);
    process.exitCode = 1;
  }
}

if (avisos.length) {
  const messaging = getMessaging();
  const tokens = (await db.collection("tokens").get()).docs;
  for (const a of avisos)
    for (const t of tokens.filter(t => a.para.includes(String(t.get("email") || "").toLowerCase()))) {
      await messaging
        .send({
          token: t.id,
          webpush: {
            headers: { Urgency: "high", TTL: "86400" },
            notification: { title: a.title, body: a.body, icon: APP_URL + "icons/icon-192.png", tag: "pago-" + a.title },
            fcmOptions: APP_URL ? { link: APP_URL } : undefined
          }
        })
        .catch(e => console.warn("Aviso não foi:", e.code || e.message));
    }
}
