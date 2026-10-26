// Confere coisas do projeto que costumam quebrar sem ninguém ver
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DONOS, APROVADORES } from "../scripts/config.mjs";

const ler = f => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
test("os e-mails dos donos e da aprovadora nas regras do Firebase batem com o config.js", () => {
  const r = ler("firestore.rules");
  const dono = r
    .match(/function dono\(\)[^\[]*\[([^\]]*)\]/)[1]
    .match(/'([^']+)'/g)
    .map(x => x.slice(1, -1).toLowerCase());
  const apr = r
    .match(/function aprovador\(\)[^\[]*\[([^\]]*)\]/)[1]
    .match(/'([^']+)'/g)
    .map(x => x.slice(1, -1).toLowerCase());
  assert.deepEqual(dono.sort(), [...DONOS].sort());
  assert.deepEqual(apr.sort(), [...APROVADORES].sort());
});
test("todo arquivo js do app está na lista do service worker (para abrir sem internet)", () => {
  const sw = ler("sw.js");
  fs.readdirSync(new URL("../js/", import.meta.url))
    .filter(f => f.endsWith(".js"))
    .forEach(f => assert.ok(sw.includes(`./js/${f}`), `faltou ./js/${f} no sw.js`));
});
test("os módulos do app não usam innerHTML com dados (só textos fixos)", () => {
  fs.readdirSync(new URL("../js/", import.meta.url))
    .filter(f => f.endsWith(".js"))
    .forEach(f => {
      const linhas = ler("js/" + f)
        .split("\n")
        .filter(l => /innerHTML\s*=\s*[^"'`\s]/.test(l) || /innerHTML\s*=\s*`[^`]*\$\{/.test(l));
      assert.deepEqual(linhas, [], "innerHTML com valor dinâmico em " + f);
    });
});
