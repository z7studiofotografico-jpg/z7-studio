// Texto do e-mail de convite da equipe (criar a senha do app Z7 Studio).
// O link do Firebase (…firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=…) vira o endereço do app,
// onde a tela js/criar-senha.js pede a senha nova.
export const APP_URL = "https://app.z7studio.com.br/";

export function linkDoApp(linkFirebase) {
  const q = new URL(linkFirebase).searchParams;
  const codigo = q.get("oobCode");
  if (!codigo) throw new Error("Link do Firebase sem oobCode");
  return `${APP_URL}?mode=resetPassword&oobCode=${encodeURIComponent(codigo)}`;
}

export function conviteEmail(nome, linkFirebase) {
  const link = linkDoApp(linkFirebase);
  const primeiro = String(nome).trim().split(/\s+/)[0] || "";
  const ola = primeiro ? `Olá, ${primeiro}!` : "Olá!";
  const texto = `${ola}\n\nVocê foi cadastrado(a) no app Z7 Studio. Para entrar, crie a sua senha neste link:\n\n${link}\n\nO link vale por 1 hora. Se expirar, peça um novo convite ao administrador.\n\nZ7 Studio`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c1b1d">
<p>${ola.replace(/[<>&]/g, "")}</p>
<p>Você foi cadastrado(a) no app <b>Z7 Studio</b>. Para entrar, crie a sua senha:</p>
<p><a href="${link}" style="display:inline-block;background:#1c1b1d;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none">Criar minha senha</a></p>
<p style="font-size:13px;color:#666">O link vale por 1 hora. Se expirar, peça um novo convite ao administrador.</p>
<p>Z7 Studio</p></div>`;
  return { subject: "Crie sua senha do app Z7 Studio", text: texto, html };
}
