// Pendências da equipe às 19h (horário de Brasília): para cada pessoa da equipe com algo pendente
// (colégios sem cadastro completo, retornos e contatos atrasados), manda uma notificação ao administrador
// principal (o primeiro dos donos em config.js: o Adriano). As contas ficam em js/pendencias-equipe.js.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { pendenciasDe } from "../js/pendencias-equipe.js";
import { DONOS } from "./config.mjs";

const APP_URL = (process.env.APP_URL || "").replace(/\/?$/, "/");
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Falta o segredo FIREBASE_SERVICE_ACCOUNT no GitHub.");
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const messaging = getMessaging();
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const dados = s => s.docs.map(d => d.data());

const usuarios = (await db.collection("usuarios").get()).docs.map(d => Object.assign({ email: d.id }, d.data()));
const equipe = usuarios.filter(u => u.ativo !== false && u.papel !== "admin" && !DONOS.includes(String(u.email).toLowerCase()));
if (!equipe.length) {
  console.log("Ninguém da equipe cadastrado: nada a enviar.");
  process.exit(0);
}
const [instPend, instRet, instOk, rep, leads] = await Promise.all([
  db.collection("instituicoes").where("cadastroPendente", "==", true).get(),
  db.collection("instituicoes").where("followup", "<", hoje).get(),
  db.collection("instituicoes").where("cadastroOkEm", ">=", hoje).get(),
  db.collection("repasse").where("followup", "<", hoje).get(),
  db.collection("leads").where("followup", "<", hoje).get()
]);
const vistos = new Set();
const inst = [...instPend.docs, ...instRet.docs, ...instOk.docs].filter(d => !vistos.has(d.id) && vistos.add(d.id)).map(d => d.data());
const avisos = equipe.map(p => pendenciasDe(p, { inst, rep: dados(rep), leads: dados(leads) }, hoje)).filter(Boolean);
console.log(`${hoje}: ${avisos.length} pessoa(s) da equipe com pendências.`);
if (!avisos.length) process.exit(0);

const principal = DONOS[0];
const tokens = (await db.collection("tokens").get()).docs.filter(t => String(t.get("email") || "").toLowerCase() === principal);
let enviados = 0;
for (const t of tokens)
  for (const [i, a] of avisos.entries()) {
    try {
      await messaging.send({
        token: t.id,
        webpush: {
          headers: { Urgency: "high", TTL: "43200" },
          notification: {
            title: a.title,
            body: a.body,
            icon: APP_URL + "icons/icon-192.png",
            badge: APP_URL + "icons/icon-192.png",
            tag: "z7-equipe-" + i,
            renotify: true
          },
          fcmOptions: APP_URL ? { link: APP_URL + "#inst-publico" } : undefined
        }
      });
      enviados++;
    } catch (e) {
      const code = e?.errorInfo?.code || e?.code || "";
      console.warn("Falha no envio:", code);
      if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(code)) {
        await t.ref.delete();
        break;
      }
    }
  }
console.log(`Notificações enviadas: ${enviados} (${tokens.length} aparelho(s) do administrador principal).`);
