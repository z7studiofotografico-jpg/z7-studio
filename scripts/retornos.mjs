// 📅 Retornos da provável venda (24/11/2026).
// Roda no GitHub Actions de 15 em 15 minutos: procura os alunos com o retorno marcado (retornoAvisar =
// "AAAA-MM-DDTHH:MM", horário de Brasília) que já chegou e avisa no celular o representante do aluno e o admin.
// Depois apaga o retornoAvisar, para não avisar de novo. Se o aluno já saiu da negociação (pagou, caiu…),
// só apaga, sem avisar.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { DONOS } from "./config.mjs";

const APP_URL = (process.env.APP_URL || "").replace(/\/?$/, "/");
const ABERTAS = ["SEPARADO", "CONTATADO", "INTERESSADO"];
const COLS = ["repasse", "paspatur"];

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Falta o segredo FIREBASE_SERVICE_ACCOUNT no GitHub.");
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const messaging = getMessaging();

// agora em Brasília, no mesmo formato gravado pelo app
const agora = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
  .format(new Date())
  .replace(" ", "T");
const nomeBonito = n =>
  String(n || "")
    .toLowerCase()
    .replace(/(^|\s)\S/g, x => x.toUpperCase());

const avisos = []; // { para: [e-mails], title, body }
for (const col of COLS) {
  const snap = await db.collection(col).where("retornoAvisar", ">=", "2").where("retornoAvisar", "<=", agora).get();
  for (const d of snap.docs) {
    const it = d.data();
    await d.ref.update({ retornoAvisar: FieldValue.delete() });
    if (!ABERTAS.includes(it.etapa) || it.excluido) continue;
    const r = it.retorno || {};
    const quando = `${String(r.data || "").slice(8, 10)}/${String(r.data || "").slice(5, 7)} às ${r.hora || ""}`;
    avisos.push({
      para: [String(it.respEmail || "").toLowerCase(), ...DONOS].filter(Boolean),
      title: `📅 Retorno agora: ${nomeBonito(it.nome)}`,
      body:
        `Entrar em contato com ${r.com || "o cliente"}${r.tel ? " · " + r.tel : ""} para confirmar a venda (${quando})` +
        (r.motivo ? ` · ${r.motivo}` : "") +
        (it.resp ? ` · ${String(it.resp).split(" ")[0]}` : "")
    });
  }
}
console.log(`Agora ${agora}: ${avisos.length} retorno(s) para avisar.`);
if (!avisos.length) process.exit(0);

const usuarios = new Map((await db.collection("usuarios").get()).docs.map(d => [d.id, d.data()]));
const tokens = (await db.collection("tokens").get()).docs;
let enviados = 0;
for (const a of avisos) {
  for (const t of tokens) {
    const email = String(t.get("email") || "").toLowerCase();
    if (!email || !a.para.includes(email)) continue;
    const perfil = usuarios.get(email);
    if (perfil && perfil.ativo === false) continue;
    try {
      await messaging.send({
        token: t.id,
        webpush: {
          headers: { Urgency: "high", TTL: "3600" },
          notification: {
            title: a.title,
            body: a.body,
            icon: APP_URL + "icons/icon-192.png",
            badge: APP_URL + "icons/icon-192.png",
            tag: "z7-retorno-" + a.title,
            renotify: true
          },
          fcmOptions: APP_URL ? { link: APP_URL + "#pr" } : undefined
        }
      });
      enviados++;
    } catch (e) {
      const code = e?.errorInfo?.code || e?.code || "";
      console.warn(`Falha para ${email}: ${code}`);
      if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(code)) await t.ref.delete();
    }
  }
}
console.log(`${enviados} notificação(ões) enviada(s).`);
