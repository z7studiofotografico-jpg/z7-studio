// Lembrete diário do Z7 Funil.
// Roda no GitHub Actions às 9h (horário de Brasília): lê os leads com contato vencido
// e manda uma notificação para cada aparelho cadastrado, com os leads daquela pessoa.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const OPEN = ["NOVO LEAD", "QUALIFICADO", "PROPOSTA ENVIADA", "FOLLOW-UP"];
const APP_URL = (process.env.APP_URL || "").replace(/\/?$/, "/");
const TESTE = String(process.env.TESTE || "") === "true";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Falta o segredo FIREBASE_SERVICE_ACCOUNT no GitHub.");
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const messaging = getMessaging();

// Data de hoje em Brasília, no formato AAAA-MM-DD (o mesmo que o app grava).
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

const leadsSnap = await db.collection("leads").where("etapa", "in", OPEN).get();
const vencidos = leadsSnap.docs.map((d) => d.data()).filter((l) => l.followup && l.followup <= hoje);
const tokensSnap = await db.collection("tokens").get();
console.log(`Hoje ${hoje}: ${vencidos.length} lead(s) com contato vencido, ${tokensSnap.size} aparelho(s).`);

const primeiro = (n) => (n || "").trim().split(/\s+/)[0] || "Lead";
let enviados = 0;

// Quem foi desativado na Equipe não recebe mais lembrete.
const usuarios = new Map((await db.collection("usuarios").get()).docs.map((d) => [d.id, d.data()]));

for (const t of tokensSnap.docs) {
  const nome = t.get("nome") || "";
  const perfil = usuarios.get(String(t.get("email") || "").toLowerCase());
  if (perfil && perfil.ativo === false) continue;
  const meus = vencidos.filter((l) => !l.resp || !nome || l.resp === nome);
  let title, body;
  if (TESTE) {
    title = "Z7 Funil: notificação de teste ✅";
    body = `Funcionando neste aparelho${nome ? " de " + nome : ""}. ${meus.length} contato(s) para hoje.`;
  } else {
    if (!meus.length) continue;
    const atrasados = meus.filter((l) => l.followup < hoje).length;
    const nomes = meus.slice(0, 4).map((l) => primeiro(l.nome)).join(", ") + (meus.length > 4 ? ` e mais ${meus.length - 4}` : "");
    title = `Bom dia${nome ? ", " + nome : ""}! ${meus.length} contato${meus.length > 1 ? "s" : ""} para hoje`;
    body = nomes + (atrasados ? ` · ${atrasados} atrasado${atrasados > 1 ? "s" : ""}` : "");
  }
  try {
    await messaging.send({
      token: t.id,
      webpush: {
        notification: { title, body, icon: APP_URL + "icons/icon-192.png", badge: APP_URL + "icons/icon-192.png", tag: "z7-lembrete", renotify: true },
        fcmOptions: APP_URL ? { link: APP_URL } : undefined,
      },
    });
    enviados++;
  } catch (e) {
    const code = e?.errorInfo?.code || e?.code || "";
    console.warn(`Falha para ${nome || "aparelho"}: ${code}`);
    // Aparelho desinstalou o app ou trocou de navegador: remove o cadastro antigo.
    if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"].includes(code)) {
      await t.ref.delete();
    }
  }
}
console.log(`Notificações enviadas: ${enviados}.`);
