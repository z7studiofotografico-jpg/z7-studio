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
  // lê o arquivo inteiro: o texto atribuído pode ocupar várias linhas
  fs.readdirSync(new URL("../js/", import.meta.url))
    .filter(f => f.endsWith(".js"))
    .forEach(f => {
      const src = ler("js/" + f),
        ruins = [];
      const re = /innerHTML\s*[:=]\s*/g;
      let m;
      while ((m = re.exec(src))) {
        const resto = src.slice(m.index + m[0].length),
          q = resto[0];
        if (q === '"' || q === "'") continue; // texto fixo entre aspas
        if (q === "`") {
          const fim = resto.indexOf("`", 1);
          if (resto.slice(1, fim).includes("${")) ruins.push(src.slice(0, m.index).split("\n").length);
          continue;
        }
        ruins.push(src.slice(0, m.index).split("\n").length); // variável ou expressão
      }
      assert.deepEqual(ruins, [], "innerHTML com valor dinâmico em " + f + " (linhas " + ruins.join(", ") + ")");
    });
});
