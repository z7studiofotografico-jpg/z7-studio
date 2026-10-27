// Service worker: sinal fraco usa a cópia guardada; erro do servidor não apaga a cópia; código nunca recebe HTML.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function carregar(redeFn) {
  const handlers = {};
  const guardados = new Map(); // url → Response
  const chave = (r, o) => {
    const u = new URL(typeof r === "string" ? new URL(r, "https://app.test/").href : r.url);
    if (o && o.ignoreSearch) u.search = "";
    return u.href;
  };
  const cache = {
    put: async (r, res) => guardados.set(chave(r), res),
    match: async (r, o) => {
      const k = chave(r, o);
      for (const [u, res] of guardados) if ((o && o.ignoreSearch ? u.replace(/\?.*/, "") : u) === k) return res.clone();
      return undefined;
    },
    addAll: async () => {}
  };
  const self = {
    location: new URL("https://app.test/sw.js"),
    addEventListener: (t, f) => (handlers[t] = f),
    skipWaiting: () => {},
    clients: { claim: () => {} }
  };
  const ctx = {
    self,
    URL,
    Response,
    Request,
    setTimeout,
    clearTimeout,
    importScripts: () => {},
    fetch: redeFn,
    caches: { open: async () => cache, match: (r, o) => cache.match(r, o), keys: async () => [], delete: async () => {} }
  };
  vm.runInNewContext(fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8"), ctx);
  const pedir = async (url, mode = "cors") => {
    let p;
    const esperas = [];
    handlers.fetch({ request: { url, method: "GET", mode }, respondWith: x => (p = x), waitUntil: x => esperas.push(x) });
    const res = await p;
    await Promise.all(esperas);
    return res;
  };
  return { pedir, guardados };
}

test("sinal fraco: depois de 2,5 s usa a cópia guardada", async () => {
  let lento = false;
  const { pedir } = carregar(async () => {
    if (lento) return new Promise(() => {}); // nunca responde
    return new Response("v1", { status: 200 });
  });
  assert.equal(await (await pedir("https://app.test/js/a.js")).text(), "v1");
  lento = true;
  const t0 = Date.now();
  assert.equal(await (await pedir("https://app.test/js/a.js")).text(), "v1");
  assert.ok(Date.now() - t0 < 4000);
});
test("erro do servidor não apaga a cópia boa; código que não existe não vira HTML", async () => {
  let status = 200;
  const { pedir } = carregar(async () => new Response(status === 200 ? "bom" : "erro", { status }));
  await pedir("https://app.test/js/b.js");
  status = 404;
  const r = await pedir("https://app.test/js/b.js");
  assert.equal(await r.text(), "bom");
  const sem = await pedir("https://app.test/js/nao-existe.js").catch(() => null);
  assert.ok(!sem || sem.status === 404 || sem.type === "error");
});
test("sem internet: página abre o app guardado; arquivo de código sem cópia dá erro (não HTML)", async () => {
  let online = true;
  const { pedir } = carregar(async () => {
    if (!online) throw new TypeError("Failed to fetch");
    return new Response("<html>app</html>", { status: 200 });
  });
  await pedir("https://app.test/index.html", "navigate");
  online = false;
  assert.match(await (await pedir("https://app.test/index.html?v=2", "navigate")).text(), /app/);
  const js = await pedir("https://app.test/js/novo.js");
  assert.equal(js.type, "error");
});
