import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anoDaTurma,
  ehRepasse,
  KITS_PADRAO,
  kitsDe,
  plano,
  proximoVenc,
  somaDiasUteis,
  previsaoEntrega,
  devolucao,
  diferencasDaTurma,
  vendaSugerida
} from "../js/contrato.js";

const k04 = KITS_PADRAO.find(k => k.id === "k04");
test("próximo vencimento é dia 05", () => {
  assert.equal(proximoVenc("2026-06-03"), "2026-06-05");
  assert.equal(proximoVenc("2026-06-05"), "2026-06-05");
  assert.equal(proximoVenc("2026-06-06"), "2026-07-05");
  assert.equal(proximoVenc("2026-12-20"), "2027-01-05");
});
test("antecipado: quem entra no começo paga 10x; quem entra depois paga menos parcelas e termina junto", () => {
  assert.deepEqual(plano(k04, "ant", "2026-06-05", "2026-05-20"), { valor: 850, parcelas: 10, primeiroVenc: "2026-06-05", aviso: "" });
  // entrou em setembro: de 05/09 a 05/03/27 = 7 parcelas, mesmo total
  const tarde = plano(k04, "ant", "2026-06-05", "2026-08-20");
  assert.deepEqual([tarde.valor, tarde.parcelas, tarde.primeiroVenc], [850, 7, "2026-09-05"]);
  assert.match(tarde.aviso, /7x em vez de 10x/);
  // entrou depois do fim: 1 parcela
  const fora = plano(k04, "ant", "2026-06-05", "2027-04-10");
  assert.equal(fora.parcelas, 1);
  assert.match(fora.aviso, /já terminou .*05\/03\/2027.*1x à vista/);
  assert.equal(
    plano(
      KITS_PADRAO.find(k => k.id === "k03"),
      "ant",
      "2026-06-05",
      "2026-05-01"
    ).valor,
    533
  );
});
test("depois das fotos: usa o preço que o Adriano definiu; sem preço, não oferece", () => {
  assert.equal(plano(k04, "pos", "2026-06-05", "2026-10-26"), null);
  const ks = kitsDe({ kitsFormatura: [{ ...k04, pos: { valor: 1100, parcelas: 6 } }] }).filter(k => k.id === "k04");
  assert.deepEqual(plano(ks[0], "pos", "2026-06-05", "2026-10-26"), { valor: 1100, parcelas: 6, primeiroVenc: "2026-11-05", aviso: "" });
});
test("entrega: 120 dias úteis depois da quitação, pulando fim de semana e feriado", () => {
  assert.equal(somaDiasUteis("2026-10-30", 1), "2026-11-03"); // sex → seg 02/11 é Finados → ter
  const f = { valor: 65, parcelas: 1, pagamentos: [{ data: "2026-06-05", valor: 65 }] };
  assert.match(previsaoEntrega(f), /^2026-1[12]-\d\d$/);
  assert.equal(previsaoEntrega({ valor: 850, parcelas: 10, pagamentos: [{ data: "2026-06-05", valor: 85 }] }), "");
});
test("devolução: desistência 70% do pago; reprovação = pago menos serviços", () => {
  assert.equal(devolucao("desistiu", 255), 178.5);
  assert.equal(devolucao("reprovou", 255, 65), 190);
  assert.equal(devolucao("reprovou", 50, 65), 0);
});

test("cada turma pode ter a sua tabela; o aviso mostra o que mudou", () => {
  const P = { kitsFormatura: [{ ...k04, pos: { valor: 1100, parcelas: 6 } }] };
  const inst = { kits: [{ id: "k04", ant: { valor: 790, parcelas: 8 } }] };
  const k = kitsDe(P, inst).find(x => x.id === "k04");
  assert.equal(k.ant.valor, 790);
  assert.equal(k.ant.parcelas, 8);
  assert.equal(k.pos.valor, 1100);
  assert.deepEqual(diferencasDaTurma(P, inst), ["k04|ant"]);
  assert.equal(kitsDe(P, null).find(x => x.id === "k04").ant.valor, 850);
  assert.ok(kitsDe(P).some(x => x.id === "k01s"));
});
test("antecipado até o dia da formatura; depois, preço depois das fotos", () => {
  const inst = { formatura: { data: "2026-11-20" } };
  assert.equal(vendaSugerida(inst, "2026-11-20"), "ant");
  assert.equal(vendaSugerida(inst, "2026-11-21"), "pos");
  assert.equal(vendaSugerida({}, "2026-11-21"), "ant");
});
test("oferta depois das fotos: só quem tem apenas o Kit 01", async () => {
  const { candidatosPosFoto } = await import("../js/contrato.js");
  const l = [
    { id: "a", nome: "Ana", kitId: "k01", status: "ativo" },
    { id: "b", nome: "Bruno", kitId: "k01", status: "ativo" },
    { id: "b2", nome: "Bruno", kitId: "k04", status: "ativo", venda: "pos" },
    { id: "c", nome: "Carla", kitId: "k04", status: "ativo" },
    { id: "d", nome: "Davi", kitId: "k01s", status: "ativo" },
    { id: "e", nome: "Eva", kitId: "k01", status: "desistiu" },
    { id: "f", nome: "Fábio", contrato: "colacao", status: "ativo" }
  ];
  assert.deepEqual(
    candidatosPosFoto(l).map(f => f.id),
    ["a", "d", "f"]
  );
});

test("repasse: turma de ano anterior vira repasse em 1º de janeiro, com tabela própria", () => {
  const inst = { formatura: { data: "2026-11-20" } };
  assert.equal(anoDaTurma(inst), 2026);
  assert.equal(ehRepasse(inst, "2026-12-31"), false);
  assert.equal(ehRepasse(inst, "2027-01-01"), true);
  assert.equal(vendaSugerida(inst, "2027-01-02"), "rep");
  const k = kitsDe({ kitsFormatura: [{ id: "k04", rep: { valor: 690, parcelas: 5 } }] }).find(x => x.id === "k04");
  assert.deepEqual(plano(k, "rep", "", "2027-01-10"), { valor: 690, parcelas: 5, primeiroVenc: "2027-02-05", aviso: "" });
  assert.equal(
    plano(
      KITS_PADRAO.find(x => x.id === "k04"),
      "rep",
      "",
      "2027-01-10"
    ),
    null
  );
});
