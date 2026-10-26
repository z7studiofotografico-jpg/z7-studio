// Login falso: o e-mail vem de window.__EMAIL (definido pelo teste antes de abrir a página)
let cbs = [];
export const getAuth = () => ({}),
  initializeAuth = () => ({}),
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
export async function signOut() {
  window.__EMAIL = "";
  cbs.forEach(cb => cb(null));
}
