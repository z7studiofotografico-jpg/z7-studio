// Envia os e-mails da fila "emails" (datas confirmadas para os colégios) pelo Gmail do estúdio.
// Roda no GitHub Actions a cada 15 minutos. Precisa dos segredos:
//   FIREBASE_SERVICE_ACCOUNT, GMAIL_USER (ex.: z7studiofotografico@gmail.com) e GMAIL_APP_PASSWORD (senha de app do Google).
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

const { FIREBASE_SERVICE_ACCOUNT, GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
if (!FIREBASE_SERVICE_ACCOUNT) { console.error("Falta o segredo FIREBASE_SERVICE_ACCOUNT."); process.exit(1); }
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) { console.log("Gmail ainda não configurado (GMAIL_USER / GMAIL_APP_PASSWORD). Nada enviado."); process.exit(0); }

initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const fila = await db.collection("emails").where("status", "==", "pendente").limit(30).get();
console.log(`${fila.size} e-mail(s) na fila.`);
if (fila.empty) process.exit(0);

const mail = nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s/g, "") } });
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let ok = 0;
for (const d of fila.docs) {
  const e = d.data();
  try {
    await mail.sendMail({
      from: `"Z7 Studio Fotográfico" <${GMAIL_USER}>`,
      to: (e.para || []).join(", "),
      replyTo: GMAIL_USER,
      subject: e.assunto || "Z7 Studio · Datas confirmadas",
      text: e.texto || "",
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c1b1d">${esc(e.texto || "").replace(/\n/g, "<br>")}</div>`
    });
    await d.ref.update({ status: "enviado", enviadoEm: new Date().toISOString() });
    ok++;
  } catch (err) {
    console.warn(`Falha ao enviar para ${(e.para || []).join(", ")}: ${err.message}`);
    const tent = (e.tentativas || 0) + 1;
    await d.ref.update({ tentativas: tent, erro: String(err.message).slice(0, 300), status: tent >= 5 ? "erro" : "pendente" });
  }
}
console.log(`Enviados: ${ok}.`);
