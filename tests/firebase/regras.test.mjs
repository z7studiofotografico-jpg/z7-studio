// Testa as regras do Firebase no emulador (roda no GitHub, em .github/workflows/testes.yml).
import { test, before, after, beforeEach } from "node:test";
import fs from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from "firebase/firestore";

const ADRIANO = "z7studiofotografico@gmail.com", LUCIANA = "lucianafanjos@gmail.com", PEDRO = "pedro@vendas.com", ANA = "ana@equipe.com", NOVO = "novo@equipe.com";
let env;
const como = em => env.authenticatedContext(em, { email: em }).firestore();
const semRegra = fn => env.withSecurityRulesDisabled(c => fn(c.firestore()));

before(async () => {
  env = await initializeTestEnvironment({ projectId: "z7-teste", firestore: { rules: fs.readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8080 } });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await semRegra(async db => {
    await setDoc(doc(db, "usuarios", PEDRO), { nome: "Pedro", papel: "equipe", ativo: true, modulos: ["lf", "agenda", "colegios"] });
    await setDoc(doc(db, "usuarios", ANA), { nome: "Ana", papel: "equipe", ativo: true, modulos: ["becas", "agenda", "funil", "rep"] });
    await setDoc(doc(db, "usuarios", NOVO), { nome: "Novo", papel: "equipe", ativo: true });
    await setDoc(doc(db, "instituicoes", "i1"), { nome: "ALFA", etapa: "FECHADO", resp: "Pedro", respEmail: PEDRO });
    await setDoc(doc(db, "instituicoes", "i2"), { nome: "BETA", etapa: "A VISITAR", resp: "", respEmail: "" });
    await setDoc(doc(db, "instituicoes", "i3"), { nome: "GAMA", etapa: "VISITADO", resp: "Ana", respEmail: ANA });
    await setDoc(doc(db, "formandos", "f1"), { instId: "i1", nome: "LUCAS", valor: 850, parcelas: 10, pagas: 1, pagamentos: [{ data: "2026-10-05", valor: 85 }], formaPag: "Cartão", respEmail: PEDRO, tel: "" });
    await setDoc(doc(db, "repasse", "r1"), { nome: "BIA", ano: 2099, etapa: "PAGO", valor: 350, formaPag: "Boleto", resp: "Pedro", respEmail: PEDRO });
    await setDoc(doc(db, "repasse", "r2"), { nome: "CAIO", ano: 2099, etapa: "NA FILA", resp: "", respEmail: "" });
    await setDoc(doc(db, "leads", "l1"), { nome: "Erica", etapa: "NOVO LEAD", resp: "", respEmail: "" });
    await setDoc(doc(db, "leads", "l2"), { nome: "Bia", etapa: "FECHADO", valor: 450, fechadoEm: "2026-10-01", resp: "Ana", respEmail: ANA });
    await setDoc(doc(db, "becas", "b1"), { cliente: "Igreja", valor: 1200, pago: 300, caucao: 100, status: "reservado" });
    await setDoc(doc(db, "agenda", "2099-11-10"), { data: "2099-11-10", status: "pendente", pedidoEmail: ANA, kind: "fotos" });
    await setDoc(doc(db, "privado", "p1"), { titulo: "Consulta médica" });
    await setDoc(doc(db, "tokens", "t1"), { email: ANA });
  });
});

test("cadastro sem módulos não acessa nada", async () => {
  const db = como(NOVO);
  await assertFails(getDoc(doc(db, "leads", "l1")));
  await assertFails(getDoc(doc(db, "instituicoes", "i1")));
  await assertFails(getDoc(doc(db, "formandos", "f1")));
});
test("vendedor não mexe em pagamento, valor nem responsável do formando", async () => {
  const db = como(PEDRO);
  await assertSucceeds(getDoc(doc(db, "formandos", "f1")));
  await assertSucceeds(updateDoc(doc(db, "formandos", "f1"), { tel: "21999998888" }));
  await assertFails(updateDoc(doc(db, "formandos", "f1"), { pagas: 5 }));
  await assertFails(updateDoc(doc(db, "formandos", "f1"), { pagamentos: [] }));
  await assertFails(updateDoc(doc(db, "formandos", "f1"), { valor: 1 }));
  await assertFails(updateDoc(doc(db, "formandos", "f1"), { formaPag: "Pix" }));
  await assertFails(setDoc(doc(db, "formandos", "f2"), { instId: "i1", nome: "X", pagas: 2, pagamentos: [{ valor: 1 }] }));
  await assertSucceeds(setDoc(doc(db, "formandos", "f3"), { instId: "i1", nome: "Y", pagas: 0, pagamentos: [], respEmail: PEDRO }));
  await assertFails(deleteDoc(doc(db, "formandos", "f1")));   // tem parcela paga
});
test("apagar: o vendedor só apaga o colégio da conta dele, e formando sem parcela paga", async () => {
  const db = como(PEDRO);
  await semRegra(d => setDoc(doc(d, "formandos", "f7"), { instId: "i1", nome: "SEM PAGAR", pagas: 0, pagamentos: [], respEmail: PEDRO }));
  await assertFails(deleteDoc(doc(db, "instituicoes", "i3")));   // da Ana
  await assertFails(deleteDoc(doc(db, "instituicoes", "i2")));   // sem responsável
  await assertSucceeds(deleteDoc(doc(db, "formandos", "f7")));
  await assertSucceeds(deleteDoc(doc(db, "instituicoes", "i1")));
  await assertSucceeds(deleteDoc(doc(como(ADRIANO), "instituicoes", "i3")));
});
test("carteira: vendedor vê os colégios livres e os seus, e só os próprios formandos", async () => {
  const db = como(PEDRO);
  const nega = async (nome, p) => { try { await assertFails(p); } catch (e) { throw new Error("deveria negar: " + nome); } };
  const deixa = async (nome, p) => { try { await assertSucceeds(p); } catch (e) { throw new Error("deveria deixar: " + nome + " (" + e.message + ")"); } };
  await deixa("ler colégio próprio", getDoc(doc(db, "instituicoes", "i1")));
  await deixa("ler colégio livre", getDoc(doc(db, "instituicoes", "i2")));
  await nega("ler colégio da Ana", getDoc(doc(db, "instituicoes", "i3")));
  await deixa("listar a carteira", getDocs(query(collection(db, "instituicoes"), where("respEmail", "in", ["", PEDRO]))));
  await nega("listar todos os colégios", getDocs(query(collection(db, "instituicoes"))));
  await deixa("listar os próprios formandos", getDocs(query(collection(db, "formandos"), where("respEmail", "==", PEDRO))));
  await semRegra(d => setDoc(doc(d, "formandos", "f9"), { instId: "i3", nome: "Z", respEmail: ANA }));
  await nega("ler formando da Ana", getDoc(doc(db, "formandos", "f9")));
  await nega("cadastrar formando na carteira da Ana", setDoc(doc(db, "formandos", "f8"), { instId: "i1", nome: "W", pagas: 0, pagamentos: [], respEmail: ANA }));
});
test("PR: venda do vendedor fica a conferir; só o admin confere", async () => {
  await assertSucceeds(updateDoc(doc(como(PEDRO), "repasse", "r2"), { etapa: "PAGO", valor: 350, formaPag: "Pix", conferido: false, respEmail: PEDRO, resp: "Pedro" }));
  await assertFails(updateDoc(doc(como(PEDRO), "repasse", "r1"), { conferido: true }));
  await assertSucceeds(updateDoc(doc(como(ADRIANO), "repasse", "r1"), { conferido: true }));
});
test("admin registra pagamento", async () => {
  await assertSucceeds(updateDoc(doc(como(ADRIANO), "formandos", "f1"), { pagas: 2, pagamentos: [{ valor: 85 }, { valor: 85 }] }));
});
test("vendedor não troca o responsável de colégio de outra pessoa, mas assume um sem dono", async () => {
  const db = como(PEDRO);
  await assertFails(updateDoc(doc(db, "instituicoes", "i3"), { respEmail: PEDRO, resp: "Pedro" }));
  await assertSucceeds(updateDoc(doc(db, "instituicoes", "i2"), { respEmail: PEDRO, resp: "Pedro", etapa: "VISITADO" }));
  await assertFails(updateDoc(doc(db, "instituicoes", "i3"), { etapa: "PROPOSTA ENVIADA" }));   // colégio da Ana
  await assertFails(updateDoc(doc(db, "instituicoes", "i1"), { colacao: { valor: 1 } }));
  await assertFails(updateDoc(doc(db, "instituicoes", "i2"), { respEmail: ANA }));
});
test("PR pago: vendedor não muda valor, forma de pagamento nem responsável", async () => {
  const db = como(PEDRO);
  await assertFails(updateDoc(doc(db, "repasse", "r1"), { formaPag: "Pix" }));
  await assertFails(updateDoc(doc(db, "repasse", "r1"), { valor: 999 }));
  await assertSucceeds(updateDoc(doc(db, "repasse", "r1"), { etapa: "ENTREGUE", entregueEm: "2099-01-01" }));
  await assertSucceeds(updateDoc(doc(db, "repasse", "r2"), { etapa: "SEPARADO", resp: "Pedro", respEmail: PEDRO }));
  await assertFails(updateDoc(doc(db, "repasse", "r2"), { etapa: "SEPARADO", respEmail: ANA }));
});
test("agenda: cada um mexe só no próprio pedido; a Luciana aprova", async () => {
  await assertFails(updateDoc(doc(como(PEDRO), "agenda", "2099-11-10"), { status: "pendente", pedidoEmail: PEDRO, obs: "x" }));
  await assertFails(deleteDoc(doc(como(PEDRO), "agenda", "2099-11-10")));
  await assertSucceeds(setDoc(doc(como(PEDRO), "agenda", "2099-11-11"), { data: "2099-11-11", status: "pendente", pedidoEmail: PEDRO }));
  await assertFails(setDoc(doc(como(PEDRO), "agenda", "2099-11-12"), { data: "2099-11-12", status: "confirmado", pedidoEmail: PEDRO }));
  await assertSucceeds(updateDoc(doc(como(LUCIANA), "agenda", "2099-11-10"), { status: "confirmado" }));
  // depois de aprovado, quem pediu só marca que avisou o colégio
  await assertSucceeds(updateDoc(doc(como(ANA), "agenda", "2099-11-10"), { avisadoWhats: true, avisadoEm: "x" }));
  await assertFails(updateDoc(doc(como(ANA), "agenda", "2099-11-10"), { avisadoWhats: true, data: "2099-12-01" }));
  await assertFails(updateDoc(doc(como(PEDRO), "agenda", "2099-11-10"), { avisadoWhats: true }));
});
test("assunto particular e resumo do dashboard só para admin", async () => {
  await assertFails(getDoc(doc(como(PEDRO), "privado", "p1")));
  await assertSucceeds(getDoc(doc(como(LUCIANA), "privado", "p1")));
  await assertFails(getDoc(doc(como(PEDRO), "resumos", "dashboard")));
});
test("becas: só quem tem o módulo", async () => {
  await assertFails(getDocs(query(collection(como(PEDRO), "becas"))));
  await assertSucceeds(setDoc(doc(como(ANA), "becas", "b9"), { cliente: "X", status: "reservado" }));
  await assertFails(deleteDoc(doc(como(ANA), "becas", "b9")));
});
test("aparelhos: cada um grava só o seu, ninguém lê os dos outros", async () => {
  await assertSucceeds(setDoc(doc(como(PEDRO), "tokens", "t2"), { email: PEDRO }));
  await assertFails(setDoc(doc(como(PEDRO), "tokens", "t3"), { email: ANA }));
  await assertFails(getDoc(doc(como(PEDRO), "tokens", "t1")));
  await assertFails(deleteDoc(doc(como(PEDRO), "tokens", "t1")));
});

test("funil: equipe não apaga lead, não mexe em venda fechada e não toma lead de outra pessoa", async () => {
  const db = como(ANA);
  await assertSucceeds(updateDoc(doc(db, "leads", "l1"), { respEmail: ANA, resp: "Ana", notas: "ok" }));
  await assertFails(deleteDoc(doc(db, "leads", "l1")));
  await assertFails(updateDoc(doc(db, "leads", "l2"), { valor: 9999 }));
  await assertSucceeds(updateDoc(doc(db, "leads", "l2"), { notas: "entregue" }));
  await semRegra(d => setDoc(doc(d, "leads", "l3"), { nome: "Caio", etapa: "FOLLOW-UP", respEmail: PEDRO, resp: "Pedro" }));
  await assertFails(updateDoc(doc(db, "leads", "l3"), { respEmail: ANA, resp: "Ana" }));
  await assertSucceeds(deleteDoc(doc(como(ADRIANO), "leads", "l2")));
});
test("becas: equipe não muda valor nem caução, e o já pago só aumenta", async () => {
  const db = como(ANA);
  await assertFails(updateDoc(doc(db, "becas", "b1"), { valor: 10 }));
  await assertFails(updateDoc(doc(db, "becas", "b1"), { pago: 100 }));
  await assertSucceeds(updateDoc(doc(db, "becas", "b1"), { pago: 600, status: "retirado" }));
  await assertFails(deleteDoc(doc(db, "becas", "b1")));
});
test("PR: equipe não apaga venda paga", async () => {
  await assertFails(deleteDoc(doc(como(ANA), "repasse", "r1")));
  await assertSucceeds(deleteDoc(doc(como(ANA), "repasse", "r2")));
  await assertSucceeds(deleteDoc(doc(como(ADRIANO), "repasse", "r1")));
});
