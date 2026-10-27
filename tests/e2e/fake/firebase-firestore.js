// Firestore falso, em memória, para testar o app de ponta a ponta no navegador (sem internet).
// O estado fica em window.__store (Map "colecao/id" -> objeto). Não aplica as regras de segurança
// (essas são testadas no emulador, em tests/firebase).
const store = (window.__store = window.__store || new Map());
// Contador de operações em andamento: o teste espera chegar a zero antes de conferir os dados (sem espera fixa)
window.__ops = 0;
window.__ultimo = Date.now();
const conta =
  fn =>
  async (...a) => {
    window.__ops++;
    window.__ultimo = Date.now();
    try {
      return await fn(...a);
    } finally {
      window.__ops--;
      window.__ultimo = Date.now();
    }
  };
const listeners = [];
let seq = 0;
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({}),
  persistentMultipleTabManager = () => ({});
export function collection(_db, n) {
  return { t: "col", n };
}
export function doc(a, n, id) {
  if (a && a.t === "col") return { t: "doc", n: a.n, id: n || "auto" + ++seq + Math.random().toString(36).slice(2, 7) };
  return { t: "doc", n, id };
}
export const query = (c, ...k) => ({ c, k });
export const where = (f, op, v) => ({ w: 1, f, op, v }),
  orderBy = (f, d) => ({ o: 1, f, d }),
  limit = n => ({ l: n });
export const deleteField = () => ({ __apagar: 1 });
export const startAt = v => ({ sa: v }),
  endAt = v => ({ ea: v }),
  documentId = () => "__id__";
const pega = (o, f) => (f === "__id__" ? o.id : f.split(".").reduce((x, k) => (x == null ? x : x[k]), o.v));
function run(q) {
  const c = q.c || q,
    k = q.k || [];
  let arr = [...store.entries()]
    .filter(([kk]) => kk.startsWith(c.n + "/") && !kk.slice(c.n.length + 1).includes("/"))
    .map(([kk, v]) => ({ id: kk.slice(c.n.length + 1), v }));
  for (const w of k.filter(x => x.w))
    arr = arr.filter(x => {
      const a = pega(x, w.f);
      switch (w.op) {
        case "==":
          return a === w.v;
        case "!=":
          return a !== undefined && a !== w.v;
        case "<":
          return a != null && a < w.v;
        case "<=":
          return a != null && a <= w.v;
        case ">":
          return a != null && a > w.v;
        case ">=":
          return a != null && a >= w.v;
        case "in":
          return w.v.includes(a);
        case "array-contains":
          return (a || []).includes(w.v);
        case "array-contains-any":
          return (a || []).some(v => w.v.includes(v));
      }
      return true;
    });
  const o = k.find(x => x.o);
  if (o) {
    arr = arr.filter(x => pega(x, o.f) != null).sort((a, b) => String(pega(a, o.f)).localeCompare(String(pega(b, o.f))));
    if (o.d === "desc") arr.reverse();
    const sa = k.find(x => "sa" in x),
      ea = k.find(x => "ea" in x);
    if (sa) arr = arr.filter(x => pega(x, o.f) >= sa.sa);
    if (ea) arr = arr.filter(x => pega(x, o.f) <= ea.ea);
  } else arr.sort((a, b) => a.id.localeCompare(b.id));
  const l = k.find(x => x.l);
  if (l) arr = arr.slice(0, l.l);
  const docs = arr.map(x => ({ id: x.id, data: () => clone(x.v), ref: { t: "doc", n: c.n, id: x.id }, exists: () => true }));
  return { docs, empty: !docs.length, size: docs.length, forEach: f => docs.forEach(f) };
}
let pend = false;
function fire() {
  if (pend) return;
  pend = true;
  setTimeout(() => {
    pend = false;
    listeners.slice().forEach(([q, cb]) => {
      try {
        cb(run(q));
      } catch (e) {
        console.error(e);
      }
    });
  }, 0);
}
window.__fire = fire;
export function onSnapshot(q, cb) {
  if (q.t === "doc") {
    const f = () => {
      const v = store.get(q.n + "/" + q.id);
      cb({ exists: () => !!v, data: () => clone(v), id: q.id });
    };
    listeners.push([{ c: { n: "__none" } }, f]);
    setTimeout(f, 5);
    return () => {
      const i = listeners.findIndex(x => x[1] === f);
      if (i >= 0) listeners.splice(i, 1);
    };
  }
  const L = [q, cb];
  listeners.push(L);
  setTimeout(() => cb(run(q)), 5);
  return () => {
    const i = listeners.indexOf(L);
    if (i >= 0) listeners.splice(i, 1);
  };
}
// registra as leituras (o teste confere que telas não leem coleções inteiras sem precisar)
window.__leituras = [];
export const getDocs = async q => {
  const qq = q.t === "col" ? { c: q, k: [] } : q;
  window.__leituras.push({ col: qq.c.n, filtros: qq.k.filter(x => x.w).length });
  return run(qq);
};
export const getDoc = async r => {
  const v = store.get(r.n + "/" + r.id);
  return { exists: () => !!v, data: () => clone(v), id: r.id, ref: r };
};
export const getCountFromServer = async q => ({ data: () => ({ count: run(q).size }) });
function aplica(o, p) {
  for (const [kk, vv] of Object.entries(clone(p))) {
    if (kk.includes(".")) {
      const ps = kk.split(".");
      let t = o;
      ps.slice(0, -1).forEach(x => {
        t[x] = Object.assign({}, t[x] || {});
        t = t[x];
      });
      t[ps[ps.length - 1]] = vv;
    } else if (vv && vv.__apagar) delete o[kk];
    else o[kk] = vv;
  }
  return o;
}
async function setDoc_(r, d, opt) {
  const k = r.n + "/" + r.id;
  store.set(k, opt && opt.merge ? aplica(clone(store.get(k)) || {}, d) : clone(d));
  fire();
}
async function updateDoc_(r, p) {
  const k = r.n + "/" + r.id;
  if (!store.has(k)) throw Object.assign(new Error("not-found"), { code: "not-found" });
  store.set(k, aplica(clone(store.get(k)), p));
  fire();
}
async function addDoc_(c, d) {
  const r = doc(c);
  await setDoc(r, d);
  return r;
}
async function deleteDoc_(r) {
  store.delete(r.n + "/" + r.id);
  fire();
}
export function writeBatch() {
  const ops = [];
  return {
    set: (r, d, o) => ops.push(() => setDoc(r, d, o)),
    update: (r, p) => ops.push(() => updateDoc(r, p)),
    delete: r => ops.push(() => deleteDoc(r)),
    commit: conta(async () => {
      for (const f of ops) await f();
    })
  };
}
async function runTransaction_(_db, fn) {
  const ops = [];
  const tx = {
    get: r => getDoc(r),
    set: (r, d, o) => {
      ops.push(() => setDoc(r, d, o));
      return tx;
    },
    update: (r, p) => {
      ops.push(() => updateDoc(r, p));
      return tx;
    },
    delete: r => {
      ops.push(() => deleteDoc(r));
      return tx;
    }
  };
  const res = await fn(tx);
  for (const f of ops) await f();
  return res;
}

export const setDoc = conta(setDoc_);
export const updateDoc = conta(updateDoc_);
export const addDoc = conta(addDoc_);
export const deleteDoc = conta(deleteDoc_);
export const runTransaction = conta(runTransaction_);
