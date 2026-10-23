// Lembrete diário do Z7 Studio.
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
// Repasse: contatos com data vencida (só as etapas em andamento).
const REP_ABERTAS = ["SEPARADO", "CONTATADO", "INTERESSADO"];
const repSnap = await db.collection("repasse").where("followup", "<=", hoje).get();
const repVencidos = repSnap.docs.map((d) => d.data()).filter((r) => REP_ABERTAS.includes(r.etapa));
// Instituições: retornos vencidos (colégios, cursos e faculdades)
const instSnap = await db.collection("instituicoes").where("followup", "<=", hoje).get();
const instVencidos = instSnap.docs.map((d) => d.data()).filter((x) => x.etapa !== "FECHADO");
// Agenda: datas esperando aprovação (só para quem aprova)
const APROVADORES = ["lucianafanjos@gmail.com"];
const pendAgenda = (await db.collection("agenda").where("status", "==", "pendente").get()).size;
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
  // Quem tem módulos limitados só recebe lembrete do que pode ver.
  const mods = perfil && Array.isArray(perfil.modulos) && perfil.papel !== "admin" ? perfil.modulos : null;
  const meus = mods && !mods.includes("funil") ? [] : vencidos.filter((l) => !l.resp || !nome || l.resp === nome);
  const meusRep = mods && !mods.includes("rep") && !mods.includes("lf") ? [] : repVencidos.filter((r) => !r.resp || !nome || r.resp === nome);
  const meusInst = mods && !mods.includes("colegios") ? [] : instVencidos.filter((x) => !x.resp || !nome || x.resp === nome);
  let title, body;
  if (TESTE) {
    title = "Z7 Studio: notificação de teste ✅";
    body = `Funcionando neste aparelho${nome ? " de " + nome : ""}. ${meus.length} contato(s) para hoje.`;
  } else {
    const aprova = APROVADORES.includes(String(t.get("email") || "").toLowerCase()) ? pendAgenda : 0;
    if (!meus.length && !meusRep.length && !meusInst.length && !aprova) continue;
    const total = meus.length + meusRep.length + meusInst.length + aprova;
    const atrasados = meus.filter((l) => l.followup < hoje).length + meusRep.filter((r) => r.followup < hoje).length + meusInst.filter((x) => x.followup < hoje).length;
    const partes = [];
    if (meus.length) partes.push(`Funil: ${meus.slice(0, 3).map((l) => primeiro(l.nome)).join(", ")}${meus.length > 3 ? ` e mais ${meus.length - 3}` : ""}`);
    if (meusRep.length) partes.push(`PR: ${meusRep.length}`);
    if (aprova) partes.push(`Agenda: ${aprova} data${aprova > 1 ? "s" : ""} para aprovar`);
    if (meusInst.length) partes.push(`Instituições: ${meusInst.slice(0, 2).map((x) => primeiro(x.nome)).join(", ")}${meusInst.length > 2 ? ` e mais ${meusInst.length - 2}` : ""}`);
    title = `Bom dia${nome ? ", " + primeiro(nome) : ""}! ${total} contato${total > 1 ? "s" : ""} para hoje`;
    body = partes.join(" · ") + (atrasados ? ` · ${atrasados} atrasado${atrasados > 1 ? "s" : ""}` : "");
  }
  try {
    await messaging.send({
      token: t.id,
      webpush: {
        headers: { Urgency: "high", TTL: "86400" },
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
