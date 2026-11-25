// 💳 Contas fixas do estúdio que não podem atrasar (25/11/2026).
// Roda no GitHub Actions todo dia às 9h (Brasília): 3 dias antes, 1 dia antes e no dia do vencimento,
// avisa no celular da Luciana e do Adriano. Primeira conta: o Cora Pro, que mantém a API dos boletos no ar
// (sem ele, a Cora corta a Integração Direta e o app para de gerar e dar baixa nos boletos).
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { DONOS } from "./config.mjs";

// dia = dia do mês do vencimento (o Cora Pro foi assinado em 25/11/2026)
export const CONTAS = [
  {
    nome: "Cora Pro",
    dia: 25,
    valor: 44.9,
    oque: "Deixe saldo na conta Cora para a assinatura do Cora Pro. Sem ela, a API dos boletos sai do ar e o app para de gerar e dar baixa nos boletos."
  }
];

const APP_URL = (process.env.APP_URL || "").replace(/\/?$/, "/");
const brl = v => "R$ " + Number(v).toFixed(2).replace(".", ",");
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const [ano, mes, dia] = hoje.split("-").map(Number);
const fimMes = new Date(ano, mes, 0).getDate();
// quantos dias faltam para o próximo vencimento (o dia 31 vira o último dia dos meses curtos)
function faltam(c) {
  const d = Math.min(c.dia, fimMes);
  if (d >= dia) return d - dia;
  const prox = Math.min(c.dia, new Date(ano, mes + 1, 0).getDate());
  return fimMes - dia + prox;
}
const avisos = CONTAS.map(c => ({ c, f: faltam(c) }))
  .filter(x => [3, 1, 0].includes(x.f))
  .map(({ c, f }) => ({
    title: f ? `💳 ${c.nome} vence em ${f} dia${f > 1 ? "s" : ""} (${brl(c.valor)})` : `💳 ${c.nome} vence hoje (${brl(c.valor)})`,
    body: c.oque
  }));
console.log(`Hoje ${hoje}: ${avisos.length} conta(s) para avisar.`);
if (!avisos.length) process.exit(0);

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Falta o segredo FIREBASE_SERVICE_ACCOUNT no GitHub.");
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const messaging = getMessaging();
const tokens = (await db.collection("tokens").get()).docs.filter(t => DONOS.includes(String(t.get("email") || "").toLowerCase()));
let enviados = 0;
for (const a of avisos)
  for (const t of tokens) {
    try {
      await messaging.send({
        token: t.id,
        webpush: {
          headers: { Urgency: "high", TTL: "86400" },
          notification: {
            title: a.title,
            body: a.body,
            icon: APP_URL + "icons/icon-192.png",
            badge: APP_URL + "icons/icon-192.png",
            tag: "z7-conta-" + a.title
          },
          fcmOptions: APP_URL ? { link: APP_URL } : undefined
        }
      });
      enviados++;
    } catch (e) {
      const code = e?.errorInfo?.code || e?.code || "";
      console.warn(`Falha: ${code}`);
      if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(code)) await t.ref.delete();
    }
  }
console.log(`${enviados} notificação(ões) enviada(s).`);
