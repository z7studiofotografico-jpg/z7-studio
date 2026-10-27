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

test("mensagens da formatura: cobrança, oferta e prévia", async () => {
  const { msgCobranca, msgOfertaKit, msgPrevia } = await import("../js/mensagens.js");
  const c = msgCobranca({ nome: "Lucas Silva", parcela: "2/10", item: "do Kit 04", valor: "R$ 85,00", venc: "05/10/2026", atrasada: true });
  assert.match(c, /^Oi, Lucas!.*parcela 2\/10 do Kit 04, de R\$ 85,00, que venceu dia 05\/10\/2026/s);
  const o = msgOfertaKit({ nome: "Ana", escola: "Colegio Alfa", linhas: ["• Kit 04: R$ 1.100,00"], repasse: true, ano: 2025 });
  assert.match(o, /formatura de 2025 no Colegio Alfa.*• Kit 04/s);
  assert.match(msgPrevia("Caio Lima", 35, ""), /^Oi, Caio! Aqui estão as 35 fotos/);
});

test("nenhuma função exportada depende de um setCtx chamado antes", () => {
  for (const f of fs.readdirSync(new URL("../js/", import.meta.url))) {
    const s = fs.readFileSync(new URL("../js/" + f, import.meta.url), "utf8");
    assert.ok(!/export function setCtx/.test(s), f + " ainda exporta setCtx");
  }
});
test("index.html não tem código dentro da página (o código fica em js/app.js, com lint)", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].filter(m => m[1].trim());
  assert.equal(inline.length, 0);
});

// Organização: arquivos pequenos o bastante para ler e mudar com segurança, e sem dependência circular
// (A importa B que importa A: a ordem de carregar vira armadilha e uma parte não dá para testar sozinha).
test("nenhum arquivo do app passa de 850 linhas", () => {
  const dir = new URL("../js/", import.meta.url);
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".js"))) {
    const n = fs.readFileSync(new URL(f, dir), "utf8").split("\n").length;
    assert.ok(n <= 850, `${f} tem ${n} linhas: divida em partes`);
  }
});
test("os arquivos do app não dependem um do outro em círculo", () => {
  const dir = new URL("../js/", import.meta.url);
  const deps = {};
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".js"))) {
    const s = fs.readFileSync(new URL(f, dir), "utf8");
    deps[f] = [...s.matchAll(/(?:import|export)[^"';]*?from\s+"\.\/([\w-]+\.js)"/g)].map(m => m[1]);
  }
  const estado = {};
  const visita = (f, caminho) => {
    if (estado[f] === 2) return;
    assert.ok(estado[f] !== 1, "dependência circular: " + [...caminho, f].join(" → "));
    estado[f] = 1;
    (deps[f] || []).forEach(d => visita(d, [...caminho, f]));
    estado[f] = 2;
  };
  Object.keys(deps).forEach(f => visita(f, []));
});
