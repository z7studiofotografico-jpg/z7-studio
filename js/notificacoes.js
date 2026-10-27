// Notificações no celular (Firebase Cloud Messaging): pedir permissão, guardar o aparelho e mostrar a situação em Ajustes.
import { getMessaging, getToken, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { toast } from "./util.js";
const $ = id => document.getElementById(id);
// o = { app, db, CFG, swReg: () => registro do service worker, me: () => nome, user: () => usuário logado }
export function criarNotificacoes(o) {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  function pushSupported() {
    return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  }
  function renderPushState() {
    const el = $("pushState");
    if (isIOS && !standalone) {
      el.textContent = "No iPhone, primeiro adicione o app à Tela de Início e abra por lá. Só assim as notificações funcionam.";
      $("pPush").hidden = true;
      return;
    }
    if (!pushSupported()) {
      el.textContent = "Este navegador não recebe notificações.";
      $("pPush").hidden = true;
      return;
    }
    const p = Notification.permission;
    el.textContent =
      p === "granted"
        ? "Notificações ativadas neste aparelho."
        : p === "denied"
          ? "As notificações foram bloqueadas. Libere nas configurações do navegador ou do celular."
          : "Notificações desativadas neste aparelho.";
    $("pPush").hidden = p === "granted" || p === "denied";
  }
  function renderPushBanner() {
    $("pushBanner").hidden = !(pushSupported() && Notification.permission === "default" && (!isIOS || standalone));
  }
  async function enablePush(fromClick) {
    if (!pushSupported() || !o.swReg()) return;
    try {
      if (!(await isSupported())) {
        if (fromClick) toast("Este aparelho não recebe notificações.");
        return;
      }
      const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      renderPushBanner();
      renderPushState();
      if (perm !== "granted") {
        if (fromClick) toast("Notificações não autorizadas");
        return;
      }
      const token = await getToken(getMessaging(o.app), { vapidKey: o.CFG.vapidKey, serviceWorkerRegistration: o.swReg() });
      if (!token) return;
      await setDoc(doc(o.db, "tokens", token), {
        nome: o.me() || "",
        email: o.user()?.email || "",
        aparelho: navigator.userAgent.slice(0, 160),
        atualizadoEm: new Date().toISOString()
      });
      try {
        localStorage.setItem("z7token", token);
      } catch (_) {}
      if (fromClick) toast("Notificações ativadas ✅");
    } catch (e) {
      if (fromClick) toast("Não foi possível ativar as notificações.");
      console.warn(e);
    }
  }
  function refreshPushToken() {
    if (pushSupported() && Notification.permission === "granted") enablePush(false);
  }
  $("btnPush").onclick = () => enablePush(true);
  $("pPush").onclick = () => enablePush(true);
  return { renderPushState, renderPushBanner, enablePush, refreshPushToken };
}
