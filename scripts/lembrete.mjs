// Lembrete diário do Z7 Studio.
// Roda no GitHub Actions às 9h (horário de Brasília): lê os leads com contato vencido
// e manda uma notificação para cada aparelho cadastrado, com os leads daquela pessoa.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { somaDias } from "../js/regras.js";
import { candidatosPosFoto } from "../js/contrato.js";
import { DONOS, APROVADORES } from "./config.mjs";

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
const vencidos = leadsSnap.docs.map(d => d.data()).filter(l => l.followup && l.followup <= hoje);
// Repasse: contatos com data vencida (só as etapas em andamento).
const REP_ABERTAS = ["SEPARADO", "CONTATADO", "INTERESSADO"];
const repSnap = await db.collection("repasse").where("followup", "<=", hoje).get();
const repVencidos = repSnap.docs.map(d => d.data()).filter(r => REP_ABERTAS.includes(r.etapa));
// Instituições: retornos vencidos (colégios, cursos e faculdades)
const instSnap = await db.collection("instituicoes").where("followup", "<=", hoje).get();
const instVencidos = instSnap.docs.map(d => d.data()).filter(x => x.etapa !== "FECHADO");
// Pendência: formatura marcada sem o dia de medir beca + ensaio
const comFormatura = await db.collection("instituicoes").where("formatura.status", "in", ["pendente", "confirmado"]).get();
const nomesVenc = new Set(instVencidos.map(x => x.nome));
comFormatura.docs
  .map(d => d.data())
  .filter(x => !(x.diaFotos && x.diaFotos.data && x.diaFotos.status !== "recusado") && !nomesVenc.has(x.nome))
  .forEach(x => instVencidos.push(Object.assign({}, x, { followup: hoje })));
// Agenda: datas esperando aprovação (só para quem aprova)
const pendAgenda = (await db.collection("agenda").where("status", "==", "pendente").get()).size;
// pedidos de aluno repetido no PR (a equipe tentou incluir quem já estava cadastrado): o admin decide
const pedidosPR = (await db.collection("pedidos").where("status", "==", "pendente").get()).size;
// Ensaios no estúdio: lembrar o cliente na véspera (donos) e os que a Luciana precisa analisar
const amanha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + 864e5));
const ensAmanha = (await db.collection("ensaios").where("data", "==", amanha).get()).docs
  .map(d => d.data())
  .filter(e => e.kind !== "pessoal" && e.status !== "remarcar" && !e.lembrado);
const ensAnalisar = (await db.collection("ensaios").where("status", "==", "analisar").get()).size;
// Entregas de fotos atrasadas e avaliações para pedir (ensaios dos últimos 90 dias)
const cfg = (await db.collection("config").doc("app").get()).data() || {};
const recentes = (await db.collection("ensaios").where("data", ">=", somaDias(hoje, -90)).get()).docs
  .map(d => d.data())
  .filter(e => e.kind !== "pessoal" && e.data < hoje && e.status !== "faltou" && e.status !== "remarcar");
const entAtrasadas = recentes.filter(
  e => !(e.entrega && e.entrega.etapa === "Entregue") && somaDias(e.data, Number(cfg.prazo) || 15) < hoje
).length;
const avaliacoes = cfg.linkAvaliacao
  ? recentes.filter(e => e.entrega && e.entrega.etapa === "Entregue" && !e.avaliacaoPedida && e.entrega.em <= somaDias(hoje, -3)).length
  : 0;
// Parcelas atrasadas das turmas: o próximo vencimento em aberto (proxVenc) já passou. Conta sem baixar os documentos.
const parcAtrasadas = (await db.collection("formandos").where("proxVenc", ">", "").where("proxVenc", "<", hoje).count().get()).data().count;
// Aluguel de becas: devoluções atrasadas e retiradas de amanhã
const becasAbertas = (await db.collection("becas").where("status", "in", ["reservado", "retirado"]).get()).docs.map(d => d.data());
const becasAtr = becasAbertas.filter(b => b.status === "retirado" && b.devolucao && b.devolucao < hoje).length;
const becasRet = becasAbertas.filter(b => b.status === "reservado" && b.retirada === amanha).length;
// Datas aprovadas que quem agendou ainda não avisou o colégio pelo WhatsApp
const paraAvisar = {};
(await db.collection("agenda").where("status", "==", "confirmado").get()).docs
  .map(d => d.data())
  .filter(a => a.data >= hoje && !a.avisadoWhats && a.pedidoEmail && a.contato && a.contato.tel)
  .forEach(a => {
    paraAvisar[a.pedidoEmail] = (paraAvisar[a.pedidoEmail] || 0) + 1;
  });
// Fotos prontas (últimos 60 dias): quem tem só o Kit 01 pode receber a oferta dos kits
const ofertas = []; // { inst, n, respEmail }
const comFotos = (await db.collection("instituicoes").where("contratoTurma.fotosProntasEm", ">=", somaDias(hoje, -60)).get()).docs;
// uma consulta para cada 30 turmas (antes era uma por turma)
const formsDe = {};
for (let i = 0; i < comFotos.length; i += 30) {
  const ids = comFotos.slice(i, i + 30).map(d => d.id);
  (await db.collection("formandos").where("instId", "in", ids).get()).docs.forEach(x => {
    const f = x.data();
    (formsDe[f.instId] = formsDe[f.instId] || []).push(f);
  });
}
comFotos.forEach(d => {
  const i = d.data(),
    n = candidatosPosFoto(formsDe[d.id] || []).length;
  if (n) ofertas.push({ inst: i.nome || "", n, respEmail: String(i.respEmail || "").toLowerCase() });
});
const tokensSnap = await db.collection("tokens").get();
console.log(`Hoje ${hoje}: ${vencidos.length} lead(s) com contato vencido, ${tokensSnap.size} aparelho(s).`);

const primeiro = n => (n || "").trim().split(/\s+/)[0] || "Lead";
let enviados = 0;

// Quem foi desativado na Equipe não recebe mais lembrete.
const usuarios = new Map((await db.collection("usuarios").get()).docs.map(d => [d.id, d.data()]));

for (const t of tokensSnap.docs) {
  const nome = t.get("nome") || "";
  const perfil = usuarios.get(String(t.get("email") || "").toLowerCase());
  if (perfil && perfil.ativo === false) continue;
  // Quem tem módulos limitados só recebe lembrete do que pode ver.
  const mods = perfil && Array.isArray(perfil.modulos) && perfil.papel !== "admin" ? perfil.modulos : null;
  const meus = mods && !mods.includes("funil") ? [] : vencidos.filter(l => !l.resp || !nome || l.resp === nome);
  const meusRep = mods && !mods.includes("rep") && !mods.includes("lf") ? [] : repVencidos.filter(r => !r.resp || !nome || r.resp === nome);
  const meusInst = mods && !mods.includes("colegios") ? [] : instVencidos.filter(x => !x.resp || !nome || x.resp === nome);
  let title, body;
  if (TESTE) {
    title = "Z7 Studio: notificação de teste ✅";
    body = `Funcionando neste aparelho${nome ? " de " + nome : ""}. ${meus.length} contato(s) para hoje.`;
  } else {
    const souAprov = APROVADORES.includes(String(t.get("email") || "").toLowerCase());
    const aprova = souAprov ? pendAgenda + ensAnalisar : 0;
    const souAdmin = DONOS.includes(String(t.get("email") || "").toLowerCase()) || (perfil && perfil.papel === "admin");
    const lembrar = souAdmin ? ensAmanha.length : 0;
    const ent = souAdmin ? entAtrasadas : 0,
      aval = souAdmin ? avaliacoes : 0,
      parc = souAdmin ? parcAtrasadas : 0,
      ped = souAdmin ? pedidosPR : 0;
    const bec = souAdmin || (mods && mods.includes("becas")) ? becasAtr + becasRet : 0;
    const avisar = paraAvisar[String(t.get("email") || "").toLowerCase()] || 0;
    const minhasOfertas = ofertas.filter(o => souAdmin || o.respEmail === String(t.get("email") || "").toLowerCase());
    const ofe = minhasOfertas.reduce((a, o) => a + o.n, 0);
    if (
      !meus.length &&
      !meusRep.length &&
      !meusInst.length &&
      !aprova &&
      !lembrar &&
      !ent &&
      !aval &&
      !parc &&
      !bec &&
      !avisar &&
      !ofe &&
      !ped
    )
      continue;
    const total = meus.length + meusRep.length + meusInst.length + aprova + lembrar + ent + aval + parc + bec + avisar + ofe + ped;
    const atrasados =
      meus.filter(l => l.followup < hoje).length +
      meusRep.filter(r => r.followup < hoje).length +
      meusInst.filter(x => x.followup < hoje).length;
    const partes = [];
    if (meus.length)
      partes.push(
        `Funil: ${meus
          .slice(0, 3)
          .map(l => primeiro(l.nome))
          .join(", ")}${meus.length > 3 ? ` e mais ${meus.length - 3}` : ""}`
      );
    if (meusRep.length) partes.push(`PR: ${meusRep.length}`);
    if (aprova) partes.push(`Agenda: ${aprova} para analisar`);
    if (ped) partes.push(`📩 ${ped} pedido${ped > 1 ? "s" : ""} de aluno repetido no PR`);
    if (lembrar) partes.push(`Lembrar ${lembrar} cliente${lembrar > 1 ? "s" : ""} do ensaio de amanhã`);
    if (ent) partes.push(`⚠️ ${ent} entrega${ent > 1 ? "s" : ""} de fotos atrasada${ent > 1 ? "s" : ""}`);
    if (aval) partes.push(`Pedir ${aval} avaliação${aval > 1 ? "ões" : ""} no Google`);
    if (ofe)
      partes.push(
        `📸 Pode oferecer os kits: ${minhasOfertas
          .slice(0, 2)
          .map(o => `${o.n} aluno${o.n > 1 ? "s" : ""} do ${o.inst}`)
          .join(", ")}${minhasOfertas.length > 2 ? " e mais" : ""}`
      );
    if (avisar) partes.push(`📲 Avisar ${avisar} colégio${avisar > 1 ? "s" : ""} da data aprovada`);
    if (bec && becasAtr) partes.push(`👘 ${becasAtr} devolução${becasAtr > 1 ? "ões" : ""} de becas atrasada${becasAtr > 1 ? "s" : ""}`);
    if (bec && becasRet) partes.push(`👘 ${becasRet} retirada${becasRet > 1 ? "s" : ""} de becas amanhã`);
    if (parc) partes.push(`${parc} parcela${parc > 1 ? "s" : ""} de turma atrasada${parc > 1 ? "s" : ""}`);
    if (meusInst.length)
      partes.push(
        `Instituições: ${meusInst
          .slice(0, 2)
          .map(x => primeiro(x.nome))
          .join(", ")}${meusInst.length > 2 ? ` e mais ${meusInst.length - 2}` : ""}`
      );
    title = `Bom dia${nome ? ", " + primeiro(nome) : ""}! ${total} contato${total > 1 ? "s" : ""} para hoje`;
    body = partes.join(" · ") + (atrasados ? ` · ${atrasados} atrasado${atrasados > 1 ? "s" : ""}` : "");
  }
  try {
    await messaging.send({
      token: t.id,
      webpush: {
        headers: { Urgency: "high", TTL: "86400" },
        notification: {
          title,
          body,
          icon: APP_URL + "icons/icon-192.png",
          badge: APP_URL + "icons/icon-192.png",
          tag: "z7-lembrete",
          renotify: true
        },
        fcmOptions: APP_URL ? { link: APP_URL } : undefined
      }
    });
    enviados++;
  } catch (e) {
    const code = e?.errorInfo?.code || e?.code || "";
    console.warn(`Falha para ${nome || "aparelho"}: ${code}`);
    // Aparelho desinstalou o app ou trocou de navegador: remove o cadastro antigo.
    if (
      ["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"].includes(code)
    ) {
      await t.ref.delete();
    }
  }
}
console.log(`Notificações enviadas: ${enviados}.`);
