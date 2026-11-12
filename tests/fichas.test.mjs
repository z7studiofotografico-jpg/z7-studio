import { test } from "node:test";
import assert from "node:assert/strict";
import { menorLivre, soNumero, telDaFicha, contatosDaFicha, chaveGrupo } from "../js/fichas.js";

test("fichas: número livre mais perto do 1, sem pular nem repetir", () => {
  assert.equal(menorLivre(new Set([1, 2, 4])), 3);
  assert.equal(menorLivre(new Set([])), 1);
  assert.equal(menorLivre(new Set([2, 3])), 1);
});
test("fichas: número da ficha (CIEP 433 não é número de aluno quando vem só a sigla? lê os dígitos)", () => {
  assert.equal(soNumero("12"), 12);
  assert.equal(soNumero(""), null);
  assert.equal(soNumero("abc"), null);
  assert.equal(soNumero("CIEP 433"), null); // a ficha do Gustavo: o colégio no quadro, não o número
  assert.equal(soNumero("nº 7"), 7);
});
test("fichas: telefone com DDD 21 quando vem sem; contatos com telefone", () => {
  assert.equal(telDaFicha("97356-6011"), "21973566011");
  assert.equal(telDaFicha("21 97356 6011"), "21973566011");
  assert.equal(telDaFicha("123"), "");
  const c = contatosDaFicha({ nome: "Gustavo", celAluno: "21973566011", mae: "Solange", celMae: "21967544923", pai: "", celPai: "" });
  assert.deepEqual(
    c.map(x => x.tipo + ":" + x.tel),
    ["Formando:21973566011", "Mãe:21967544923"]
  );
  assert.equal(chaveGrupo("CIEP 433 - Togo", 2026), "CIEP-433-TOGO_2026");
});

test("fichas: acha o papel branco (ficha) na foto e ignora a renda da beca", async () => {
  const { acharPapel, ordemFicha } = await import("../js/fichas.js");
  const w = 100,
    h = 150,
    d = new Uint8ClampedArray(w * h * 4);
  const pinta = (x0, y0, x1, y1, v, xadrez = false) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        const c = xadrez && (x + y) % 2 ? 20 : v;
        d[i] = d[i + 1] = d[i + 2] = c;
        d[i + 3] = 255;
      }
  };
  pinta(0, 0, w, h, 20); // beca preta
  pinta(40, 20, 60, 60, 240, true); // renda: branca mas vazada
  pinta(30, 70, 70, 130, 235); // a ficha
  pinta(35, 90, 65, 91, 40); // uma linha escrita
  const p = acharPapel(d, w, h);
  assert.ok(p && p.x0 === 30 && p.y0 === 70 && p.x1 === 69 && p.y1 === 129, JSON.stringify(p));
  pinta(30, 70, 70, 130, 20);
  assert.equal(acharPapel(d, w, h), null); // sem ficha
  assert.deepEqual(ordemFicha(["A (2).jpg", "A (3).jpg", "A.JPG"]), [2, 0, 1]);
  assert.deepEqual(ordemFicha(["A (2).JPG", "A (1).JPG"]), [1, 0]);
});

test("fichas: junta com o aluno que já está no app (nome curto da planilha, pasta, número)", async () => {
  const { acharExistente, dadosDaPasta } = await import("../js/fichas.js");
  const ex = [
    { id: "a", nome: "NATALY BRENDA", nomeBusca: "NATALY BRENDA", codigo: "26CIEP433-02" },
    { id: "b", nome: "YASMIN ALEXANDRA", nomeBusca: "YASMIN ALEXANDRA", codigo: "26CIEP433-04" },
    { id: "c", nome: "WELLINGTON DE SOUZA", nomeBusca: "WELLINGTON DE SOUZA", codigo: "26CIEP433-05" }
  ];
  assert.deepEqual(dadosDaPasta("26 -CIEP433- 002 - NATALY BRENDA"), { num: 2, nome: "NATALY BRENDA" });
  assert.equal(acharExistente(ex, { pasta: "26 -CIEP433- 002 - NATALY BRENDA" }, { nome: "Nataly Brenda A. da Silva" }).id, "a");
  // a pasta 004 é do Wellington, mas no app o 04 é a Yasmin: vale o nome
  assert.equal(
    acharExistente(ex, { pasta: "26 -CIEP433- 004 - WELLINGTON DE SOUZA" }, { nome: "Wellington de Souza dos S. Serrano" }).id,
    "c"
  );
  assert.equal(acharExistente(ex, { pasta: "x" }, { nome: "Wellington de Souza Serrano" }).id, "c");
  assert.equal(acharExistente(ex, { pasta: "26 -CIEP433- 009 - FULANO" }, { nome: "Fulano Novo" }), null);
});
