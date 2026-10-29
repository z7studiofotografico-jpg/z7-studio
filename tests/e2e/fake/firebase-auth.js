// Login falso: o e-mail vem de window.__EMAIL (definido pelo teste antes de abrir a página)
let cbs = [];
// getAuth = o login do app; initializeAuth = a conexão extra só para cadastrar pessoas (sair dela não desloga ninguém)
export const getAuth = () => ({ principal: true }),
  initializeAuth = () => ({ principal: false }),
  setPersistence = async () => {},
  indexedDBLocalPersistence = {},
  inMemoryPersistence = {};
export function onAuthStateChanged(_a, cb) {
  cbs.push(cb);
  setTimeout(() => cb(window.__EMAIL ? { email: window.__EMAIL, uid: window.__EMAIL } : null), 10);
  return () => {};
}
export async function signInWithEmailAndPassword(_a, em) {
  window.__EMAIL = em;
  cbs.forEach(cb => cb({ email: em, uid: em }));
  return { user: { email: em } };
}
export async function createUserWithEmailAndPassword(_a, em) {
  return { user: { email: em } };
}
export async function sendPasswordResetEmail() {}
// convite: o teste define window.__RESET = { "codigo": "email" }
export async function verifyPasswordResetCode(_a, c) {
  const em = (window.__RESET || {})[c];
  if (!em) throw Object.assign(new Error("expirado"), { code: "auth/expired-action-code" });
  return em;
}
export async function confirmPasswordReset(_a, c) {
  if (!(window.__RESET || {})[c]) throw Object.assign(new Error("expirado"), { code: "auth/expired-action-code" });
}
export async function signOut(a) {
  if (a && a.principal === false) return;
  window.__EMAIL = "";
  cbs.forEach(cb => cb(null));
}
