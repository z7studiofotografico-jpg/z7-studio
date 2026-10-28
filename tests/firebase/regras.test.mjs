// Testa as regras do Firebase no emulador (roda no GitHub, em .github/workflows/testes.yml).
import { test, before, after, beforeEach } from "node:test";
import fs from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer
} from "firebase/firestore";

const ADRIANO = "z7studiofotografico@gmail.com",
  LUCIANA = "lucianafanjos@gmail.com",
  PEDRO = "pedro@vendas.com",
  ANA = "ana@equipe.com",
  NOVO = "novo@equipe.com",
  FORM = "form@equipe.com";
let env;
const como = em => env.authenticatedContext(em, { email: em }).firestore();
const semRegra = fn => env.withSecurityRulesDisabled(c => fn(c.firestore()));

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "z7-teste",
    firestore: { rules: fs.readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8080 }
  });
});
after(async () => {
  if (env) await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await semRegra(async db => {
    await setDoc(doc(db, "usuarios", PEDRO), { nome: "Pedro", papel: "equipe", ativo: true, modulos: ["lf", "agenda", "colegios"] });
    await setDoc(doc(db, "usuarios", ANA), { nome: "Ana", papel: "equipe", ativo: true, modulos: ["becas", "agenda", "funil", "rep"] });
    await setDoc(doc(db, "usuarios", NOVO), { nome: "Novo", papel: "equipe", ativo: true });
    await setDoc(doc(db, "usuarios", FORM), { nome: "Fabi", papel: "equipe", ativo: true, modulos: ["formaturas"] });
    await setDoc(doc(db, "instituicoes", "i1"), { nome: "ALFA", etapa: "FECHADO", resp: "Pedro", respEmail: PEDRO });
    await setDoc(doc(db, "instituicoes", "i2"), { nome: "BETA", etapa: "A VISITAR", resp: "", respEmail: "" });
    await setDoc(doc(db, "instituicoes", "i3"), { nome: "GAMA", etapa: "VISITADO", resp: "Ana", respEmail: ANA });
    await setDoc(doc(db, "formandos", "f1"), {
      instId: "i1",
      nome: "LUCAS",
      valor: 850,
      parcelas: 10,
      pagas: 1,
      pagamentos: [{ data: "2026-10-05", valor: 85 }],
      formaPag: "Cartão",
      respEmail: PEDRO,
      tel: ""
    });
    await setDoc(doc(db, "repasse", "r1"), {
      nome: "BIA",
      ano: 2099,
      etapa: "PAGO",
      valor: 350,
      formaPag: "Boleto",
      resp: "Pedro",
      respEmail: PEDRO
    });
    await setDoc(doc(db, "repasse", "r2"), { nome: "CAIO", ano: 2099, etapa: "NA FILA", resp: "", respEmail: "" });
    await setDoc(doc(db, "leads", "l1"), { nome: "Erica", etapa: "NOVO LEAD", resp: "", respEmail: "" });
    await setDoc(doc(db, "leads", "l2"), {
      nome: "Bia",
      etapa: "FECHADO",
      valor: 450,
      fechadoEm: "2026-10-01",
      resp: "Ana",
      respEmail: ANA
    });
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
  // só em turma da própria carteira (i3 é da Ana, i2 está sem responsável, "zz" não existe)
  await assertFails(setDoc(doc(db, "formandos", "f3b"), { instId: "i3", nome: "Y", pagas: 0, pagamentos: [], respEmail: PEDRO }));
  await assertFails(setDoc(doc(db, "formandos", "f3c"), { instId: "i2", nome: "Y", pagas: 0, pagamentos: [], respEmail: PEDRO }));
  await assertFails(setDoc(doc(db, "formandos", "f3d"), { instId: "zz", nome: "Y", pagas: 0, pagamentos: [], respEmail: PEDRO }));
  await assertFails(setDoc(doc(db, "formandos", "f3e"), { nome: "Y", pagas: 0, pagamentos: [], respEmail: PEDRO }));
  await assertFails(deleteDoc(doc(db, "formandos", "f1"))); // tem parcela paga
});
test("apagar: o vendedor só apaga o colégio da conta dele, e formando sem parcela paga", async () => {
  const db = como(PEDRO);
  await semRegra(d => setDoc(doc(d, "formandos", "f7"), { instId: "i1", nome: "SEM PAGAR", pagas: 0, pagamentos: [], respEmail: PEDRO }));
  await assertFails(deleteDoc(doc(db, "instituicoes", "i3"))); // da Ana
  await assertFails(deleteDoc(doc(db, "instituicoes", "i2"))); // sem responsável
  await assertSucceeds(deleteDoc(doc(db, "formandos", "f7")));
  await assertSucceeds(deleteDoc(doc(db, "instituicoes", "i1")));
  await assertSucceeds(deleteDoc(doc(como(ADRIANO), "instituicoes", "i3")));
});
test("carteira: vendedor vê os colégios livres e os seus, e só os próprios formandos", async () => {
  const db = como(PEDRO);
  const nega = async (nome, p) => {
    try {
      await assertFails(p);
    } catch (e) {
      throw new Error("deveria negar: " + nome);
    }
  };
  const deixa = async (nome, p) => {
    try {
      await assertSucceeds(p);
    } catch (e) {
      throw new Error("deveria deixar: " + nome + " (" + e.message + ")");
    }
  };
  await deixa("ler colégio próprio", getDoc(doc(db, "instituicoes", "i1")));
  await deixa("ler colégio livre", getDoc(doc(db, "instituicoes", "i2")));
  await nega("ler colégio da Ana", getDoc(doc(db, "instituicoes", "i3")));
  await deixa("listar a carteira", getDocs(query(collection(db, "instituicoes"), where("respEmail", "in", ["", PEDRO]))));
  await nega("listar todos os colégios", getDocs(query(collection(db, "instituicoes"))));
  await deixa("listar os próprios formandos", getDocs(query(collection(db, "formandos"), where("respEmail", "==", PEDRO))));
  await semRegra(d => setDoc(doc(d, "formandos", "f9"), { instId: "i3", nome: "Z", respEmail: ANA }));
  await nega("ler formando da Ana", getDoc(doc(db, "formandos", "f9")));
  await nega(
    "cadastrar formando na carteira da Ana",
    setDoc(doc(db, "formandos", "f8"), { instId: "i1", nome: "W", pagas: 0, pagamentos: [], respEmail: ANA })
  );
});
test("PR: venda do vendedor fica a conferir; só o admin confere", async () => {
  await assertSucceeds(
    updateDoc(doc(como(PEDRO), "repasse", "r2"), {
      etapa: "PAGO",
      valor: 350,
      formaPag: "Pix",
      conferido: false,
      respEmail: PEDRO,
      resp: "Pedro"
    })
  );
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
  await assertFails(updateDoc(doc(db, "instituicoes", "i3"), { etapa: "PROPOSTA ENVIADA" })); // colégio da Ana
  await assertFails(updateDoc(doc(db, "instituicoes", "i1"), { kits: [{ id: "k01", ant: { valor: 1, parcelas: 1 } }] }));
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
test("funil: a equipe vê e mexe só nos leads livres e nos seus", async () => {
  await semRegra(d => setDoc(doc(d, "leads", "l9"), { nome: "Do Pedro", etapa: "FOLLOW-UP", respEmail: PEDRO, resp: "Pedro" }));
  const db = como(ANA);
  await assertSucceeds(getDoc(doc(db, "leads", "l1"))); // livre
  await assertFails(getDoc(doc(db, "leads", "l9"))); // de outra pessoa
  await assertFails(updateDoc(doc(db, "leads", "l9"), { notas: "x" }));
  await assertSucceeds(getDocs(query(collection(db, "leads"), where("respEmail", "==", ANA))));
  await assertSucceeds(
    getDocs(query(collection(db, "leads"), where("respEmail", "==", ""), where("etapa", "in", ["NOVO LEAD", "FOLLOW-UP"])))
  );
  await assertFails(getDocs(query(collection(db, "leads"), where("etapa", "in", ["NOVO LEAD", "FOLLOW-UP"]))));
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

test("formatura: a equipe registra a venda depois das fotos de quem ainda não comprou, mas não mexe em quem já comprou", async () => {
  const db = como(PEDRO);
  await semRegra(d =>
    setDoc(doc(d, "formandos", "f5"), {
      instId: "i1",
      nome: "SEM KIT",
      status: "semkit",
      valor: 0,
      parcelas: 1,
      pagas: 0,
      pagamentos: [],
      respEmail: PEDRO
    })
  );
  await assertSucceeds(
    updateDoc(doc(db, "formandos", "f5"), {
      status: "ativo",
      kitId: "k04",
      kit: "Kit 04",
      venda: "pos",
      valor: 1100,
      parcelas: 6,
      primeiroVenc: "2026-11-05",
      proxVenc: "2026-11-05",
      vendidoEm: "2026-10-26"
    })
  );
  await assertFails(updateDoc(doc(db, "formandos", "f5"), { valor: 1 })); // agora já comprou
  await assertFails(updateDoc(doc(db, "formandos", "f1"), { entregueEm: "2026-10-26" }));
  await assertFails(updateDoc(doc(db, "formandos", "f1"), { devolucao: { valor: 10 } }));
});
test("valores da turma (kits e contrato) só o admin muda", async () => {
  await assertFails(updateDoc(doc(como(PEDRO), "instituicoes", "i1"), { kits: [{ id: "k04", ant: { valor: 1, parcelas: 1 } }] }));
  await assertFails(updateDoc(doc(como(PEDRO), "instituicoes", "i1"), { contratoTurma: { inicio: "2026-06-05" } }));
  await assertSucceeds(
    updateDoc(doc(como(ADRIANO), "instituicoes", "i1"), { kits: [], contratoTurma: { inicio: "2026-06-05", fotosProntasEm: "2026-12-01" } })
  );
});

test("PR: a equipe inclui aluno à mão na fila ou separado para si, mas não como venda", async () => {
  await assertSucceeds(setDoc(doc(como(ANA), "repasse", "n1"), { nome: "NOVO", ano: 2099, etapa: "NA FILA", resp: "", respEmail: "" }));
  await assertSucceeds(
    setDoc(doc(como(PEDRO), "repasse", "n2"), { nome: "NOVO 2", ano: 2099, etapa: "SEPARADO", resp: "Pedro", respEmail: PEDRO })
  );
  await assertFails(setDoc(doc(como(PEDRO), "repasse", "n3"), { nome: "NOVO 3", ano: 2099, etapa: "PAGO", valor: 350, respEmail: PEDRO }));
  await assertFails(setDoc(doc(como(PEDRO), "repasse", "n4"), { nome: "NOVO 4", ano: 2099, etapa: "SEPARADO", respEmail: ANA }));
  await assertFails(setDoc(doc(como(PEDRO), "repasse", "n5"), { nome: "NOVO 5", ano: 2020, etapa: "NA FILA", respEmail: "" }));
});

test("funil: a equipe não cria lead já fechado nem em nome de outra pessoa", async () => {
  await assertSucceeds(setDoc(doc(como(ANA), "leads", "n1"), { nome: "Novo", etapa: "NOVO LEAD", respEmail: ANA }));
  await assertFails(setDoc(doc(como(ANA), "leads", "n2"), { nome: "Falso", etapa: "FECHADO", valor: 99999, respEmail: ANA }));
  await assertFails(setDoc(doc(como(ANA), "leads", "n3"), { nome: "Outro", etapa: "NOVO LEAD", respEmail: PEDRO }));
  await assertSucceeds(setDoc(doc(como(ADRIANO), "leads", "n4"), { nome: "Venda balcão", etapa: "FECHADO", valor: 450 }));
});

test("funil: venda fechada pela equipe entra a conferir e só o admin confere", async () => {
  await setDoc(doc(como(ADRIANO), "leads", "c1"), { nome: "Cliente", etapa: "PROPOSTA ENVIADA", respEmail: ANA });
  // fechar sem marcar "a conferir" não pode
  await assertFails(updateDoc(doc(como(ANA), "leads", "c1"), { etapa: "FECHADO", valor: 500, fechadoEm: "2026-10-01" }));
  await assertSucceeds(
    updateDoc(doc(como(ANA), "leads", "c1"), { etapa: "FECHADO", valor: 500, fechadoEm: "2026-10-01", conferido: false })
  );
  // a equipe não confere a própria venda nem muda o valor
  await assertFails(updateDoc(doc(como(ANA), "leads", "c1"), { conferido: true }));
  await assertFails(updateDoc(doc(como(ANA), "leads", "c1"), { valor: 5000 }));
  await assertSucceeds(updateDoc(doc(como(ADRIANO), "leads", "c1"), { conferido: true }));
});

test("PR: quem é da Linha de Frente confere se o aluno já existe antes de incluir", async () => {
  // aluno que não existe: pode conferir (para o "+ Aluno" não sobrescrever ninguém)
  await assertSucceeds(getDoc(doc(como(PEDRO), "repasse", "nao-existe")));
  // aluno de ano anterior continua fora do alcance da Linha de Frente
  await semRegra(db => setDoc(doc(db, "repasse", "antigo"), { nome: "X", ano: 2000, etapa: "NA FILA", respEmail: "" }));
  await assertFails(getDoc(doc(como(PEDRO), "repasse", "antigo")));
});

test("erros do app: cada um grava o seu (curto); só o admin lê", async () => {
  const e = { onde: "viewAgenda", msg: "x is undefined", pilha: "", email: PEDRO, tela: "#agenda", app: "teste", em: "2026-10-27" };
  await assertSucceeds(setDoc(doc(como(PEDRO), "erros", "e1"), e));
  await assertFails(setDoc(doc(como(PEDRO), "erros", "e2"), { ...e, email: ANA }));
  await assertFails(setDoc(doc(como(PEDRO), "erros", "e3"), { ...e, msg: "x".repeat(301) }));
  await assertFails(setDoc(doc(como(PEDRO), "erros", "e4"), { ...e, extra: "dado pessoal" }));
  await assertFails(getDoc(doc(como(PEDRO), "erros", "e1")));
  await assertSucceeds(getDoc(doc(como(ADRIANO), "erros", "e1")));
});

test("pedido de aluno repetido: a equipe pede e vê só o seu; só o admin decide", async () => {
  const meu = "pr_r2_pedro-vendas-com",
    ped = { tipo: "pr-repetido", alvoId: "r2", aluno: "Bruno", porEmail: PEDRO, status: "pendente" };
  await assertSucceeds(getDoc(doc(como(PEDRO), "pedidos", meu))); // ainda não existe: pode conferir o seu
  await assertFails(getDoc(doc(como(PEDRO), "pedidos", "pr_r2_ana-equipe-com"))); // o de outra pessoa, não
  await assertSucceeds(setDoc(doc(como(PEDRO), "pedidos", meu), ped));
  await assertFails(setDoc(doc(como(PEDRO), "pedidos", "pr_r9_pedro-vendas-com"), { ...ped, porEmail: ANA }));
  await assertFails(setDoc(doc(como(PEDRO), "pedidos", "pr_r9_ana-equipe-com"), ped));
  await assertFails(setDoc(doc(como(PEDRO), "pedidos", "pr_r8_pedro-vendas-com"), { ...ped, status: "aprovado" }));
  await assertFails(updateDoc(doc(como(PEDRO), "pedidos", meu), { status: "aprovado" }));
  await assertFails(getDoc(doc(como(ANA), "pedidos", meu)));
  // pendente não se "repede"; decidido, sim
  await assertFails(setDoc(doc(como(PEDRO), "pedidos", meu), { ...ped, aluno: "Outro" }));
  await assertSucceeds(updateDoc(doc(como(ADRIANO), "pedidos", meu), { status: "negado" }));
  await assertSucceeds(updateDoc(doc(como(PEDRO), "pedidos", meu), { visto: true }));
  await assertSucceeds(setDoc(doc(como(PEDRO), "pedidos", meu), ped));
  await assertFails(deleteDoc(doc(como(PEDRO), "pedidos", meu)));
  // aviso de aluno que passou para outra pessoa: só o admin cria; o dono do aviso só marca que viu
  const aviso = "aviso_r2_pedro-vendas-com";
  await assertSucceeds(setDoc(doc(como(ADRIANO), "pedidos", aviso), { tipo: "pr-transferido", porEmail: PEDRO, status: "aviso" }));
  await assertFails(updateDoc(doc(como(PEDRO), "pedidos", aviso), { status: "pendente" }));
  await assertSucceeds(updateDoc(doc(como(PEDRO), "pedidos", aviso), { visto: true }));
});

const semearFone = () => semRegra(d => setDoc(doc(d, "fones", "21911112222"), { alunos: { r1: { nome: "LIA", ano: 2025 } } }));
test("índice de telefones 1: a equipe do PR lê; quem não é do PR, não", async () => {
  await semearFone();
  await assertSucceeds(getDoc(doc(como(PEDRO), "fones", "21911112222")));
  await assertFails(getDoc(doc(como(NOVO), "fones", "21911112222")));
});
test("índice de telefones 2: cria um telefone novo", async () => {
  await assertSucceeds(setDoc(doc(como(PEDRO), "fones", "21900000000"), { alunos: { r9: { nome: "LIA", ano: 2026 } } }, { merge: true }));
});
test("índice de telefones 3: acrescenta um aluno num telefone que já existe", async () => {
  await semearFone();
  await assertSucceeds(setDoc(doc(como(PEDRO), "fones", "21911112222"), { alunos: { r9: { nome: "LIA", ano: 2026 } } }, { merge: true }));
});
test("índice de telefones 4: não troca nem apaga", async () => {
  await semearFone();
  await assertFails(setDoc(doc(como(PEDRO), "fones", "21911112222"), { alunos: { r1: { nome: "OUTRA", ano: 2025 } } }, { merge: true }));
  await assertFails(setDoc(doc(como(PEDRO), "fones", "21911112222"), { alunos: {} }));
  await assertFails(deleteDoc(doc(como(PEDRO), "fones", "21911112222")));
});

test("Dashboard: a equipe lê só o próprio desempenho", async () => {
  await semRegra(async d => {
    await setDoc(doc(d, "resumos", "dashboard"), { total: 1 });
    await setDoc(doc(d, "resumos", "pessoa_pedro-vendas-com"), { email: PEDRO });
    await setDoc(doc(d, "resumos", "pessoa_ana-equipe-com"), { email: ANA });
  });
  await assertSucceeds(getDoc(doc(como(PEDRO), "resumos", "pessoa_pedro-vendas-com")));
  await assertFails(getDoc(doc(como(PEDRO), "resumos", "pessoa_ana-equipe-com")));
  await assertFails(getDoc(doc(como(PEDRO), "resumos", "dashboard")));
  await assertFails(setDoc(doc(como(PEDRO), "resumos", "pessoa_pedro-vendas-com"), { email: PEDRO, meses: {} }));
});
test("ID do aluno: quem cadastra aluno reserva o próximo número; o contador só sobe", async () => {
  await semRegra(d => setDoc(doc(d, "ids", "26ALFA"), { ultimo: 5 }));
  const db = como(PEDRO);
  await assertSucceeds(getDoc(doc(db, "ids", "26ALFA")));
  await assertSucceeds(setDoc(doc(db, "ids", "26ALFA"), { ultimo: 6 }));
  await assertFails(setDoc(doc(db, "ids", "26ALFA"), { ultimo: 3 }));
  await assertFails(setDoc(doc(db, "ids", "26ALFA"), { ultimo: 7, outro: 1 }));
  await assertSucceeds(setDoc(doc(db, "ids", "26BETA"), { ultimo: 1 }));
  await assertFails(deleteDoc(doc(db, "ids", "26ALFA")));
  await assertFails(getDoc(doc(como(NOVO), "ids", "26ALFA")));
});

// As mesmas consultas que o app faz para quem é da equipe (se a regra recusar, a pessoa veria erro na tela)
const ANO = new Date().getFullYear();
const c = (db, n) => collection(db, n);
test("ID do ensaio: quem só tem o Funil dá o ID à venda fechada; depois a equipe não troca", async () => {
  const SO_FUNIL = "funil@equipe.com";
  await semRegra(async d => {
    await setDoc(doc(d, "usuarios", SO_FUNIL), { nome: "Fê", papel: "equipe", ativo: true, modulos: ["funil"] });
    await setDoc(doc(d, "leads", "e1"), {
      nome: "Cliente",
      etapa: "FECHADO",
      valor: 500,
      fechadoEm: "2026-10-01",
      conferido: false,
      respEmail: SO_FUNIL
    });
  });
  const db = como(SO_FUNIL);
  await assertSucceeds(getDoc(doc(db, "ids", "ensaio_26EST")));
  await assertSucceeds(setDoc(doc(db, "ids", "ensaio_26EST"), { ultimo: 1 }));
  await assertSucceeds(updateDoc(doc(db, "leads", "e1"), { codigoEnsaio: "26EST-00001" }));
  await assertFails(updateDoc(doc(db, "leads", "e1"), { codigoEnsaio: "26EST-00009" }));
  await assertFails(setDoc(doc(db, "ids", "ensaio_26EST"), { ultimo: 1 }));
  await assertSucceeds(updateDoc(doc(como(ADRIANO), "leads", "e1"), { codigoEnsaio: "26EST-00002" }));
});
test("consultas da equipe 1: Funil (leads livres e os seus)", async () => {
  const db = como(ANA);
  await assertSucceeds(
    getDocs(query(c(db, "leads"), where("respEmail", "==", ""), where("etapa", "in", ["NOVO LEAD", "FOLLOW-UP"]), limit(2000)))
  );
  await assertSucceeds(getDocs(query(c(db, "leads"), where("respEmail", "==", ANA), limit(2000))));
  await assertFails(getDocs(query(c(db, "leads"), where("etapa", "in", ["NOVO LEAD"]), limit(2000))));
});
test("consultas da equipe 2: carteira de colégios, formandos e contagens da tela inicial", async () => {
  for (const em of [PEDRO, FORM]) {
    const db = como(em);
    await assertSucceeds(getDocs(query(c(db, "instituicoes"), where("respEmail", "in", ["", em]), limit(3000))));
    await assertSucceeds(getDocs(query(c(db, "formandos"), where("respEmail", "==", em), limit(3000))));
  }
  // sigla do colégio no "+ Aluno": procura o colégio pelo nome, dentro da carteira
  await assertSucceeds(
    getDocs(query(c(como(PEDRO), "instituicoes"), where("nomeBusca", "==", "ALFA"), where("respEmail", "in", ["", PEDRO]), limit(1)))
  );
  // só formaturas: lê as turmas da carteira (card Formaturas), mas não mexe no cadastro do colégio
  await assertSucceeds(getDoc(doc(como(FORM), "instituicoes", "i2")));
  await assertFails(updateDoc(doc(como(FORM), "instituicoes", "i2"), { notas: "x" }));
  const p = como(PEDRO);
  await assertSucceeds(getCountFromServer(query(c(p, "agenda"), where("status", "==", "pendente"))));
  await assertSucceeds(getDocs(query(c(p, "agenda"), where("data", ">=", "2026-01-01"), orderBy("data"), limit(400))));
  await assertSucceeds(getDocs(query(c(p, "ensaios"), where("data", ">=", "2026-01-01"), orderBy("data"), limit(600))));
  await assertSucceeds(getDocs(query(c(como(ANA), "becas"), where("status", "in", ["reservado", "retirado"]), limit(500))));
  await assertSucceeds(getDocs(query(c(como(ANA), "becas"), where("devolucao", ">=", "2026-01-01"), orderBy("devolucao"), limit(400))));
});
test("consultas da equipe 3: PR da Linha de Frente (só o ano atual)", async () => {
  const db = como(PEDRO);
  await assertSucceeds(
    getDocs(query(c(db, "repasse"), where("ano", "==", ANO), where("etapa", "in", ["SEPARADO", "CONTATADO", "INTERESSADO"]), limit(300)))
  );
  await assertSucceeds(getCountFromServer(query(c(db, "repasse"), where("etapa", "==", "NA FILA"), where("ano", "==", ANO))));
  await assertSucceeds(getDocs(query(c(db, "repasse"), where("nomeBusca", "==", "LIA"), where("ano", "==", ANO), limit(20))));
  await assertSucceeds(getDocs(query(c(db, "repasse"), where("escola", "in", ["ALFA", "Alfa"]), where("ano", "==", ANO), limit(3000))));
  await assertSucceeds(
    getDocs(
      query(c(db, "repasse"), where("ano", "==", ANO), where("etapa", "==", "INCOMPLETO"), where("respEmail", "==", PEDRO), limit(200))
    )
  );
  await assertSucceeds(getDocs(query(c(db, "pedidos"), where("porEmail", "==", PEDRO), limit(30))));
  await assertSucceeds(getDoc(doc(db, "fones", "21911112222")));
  // sem o filtro do ano, a Linha de Frente não lê o PR
  await assertFails(getDocs(query(c(db, "repasse"), where("escola", "in", ["ALFA"]), limit(3000))));
});
test("consultas da equipe 4: Repasse (todos os anos) e ID do aluno", async () => {
  const db = como(ANA);
  await assertSucceeds(getDocs(query(c(db, "repasse"), where("escola", "in", ["ALFA", "Alfa"]), limit(3000))));
  await assertSucceeds(getDocs(query(c(db, "repasse"), where("codigoBusca", "in", ["26ALFA01", "ALFA01"]), limit(30))));
  await assertSucceeds(getDocs(query(c(db, "repasse"), where("followup", "<=", "2026-12-31"), orderBy("followup"), limit(150))));
  await assertSucceeds(setDoc(doc(db, "ids", "26ALFA"), { ultimo: 1 }));
  await assertSucceeds(setDoc(doc(como(FORM), "ids", "26BETA"), { ultimo: 1 }));
});
test("consultas da equipe 5: PR só com os contatos da pessoa (abas e números)", async () => {
  await assertSucceeds(
    getDocs(
      query(
        c(como(ANA), "repasse"),
        where("respEmail", "==", ANA),
        where("etapa", "in", ["SEPARADO", "CONTATADO", "INTERESSADO", "ENTREGUE"]),
        limit(500)
      )
    )
  );
  await assertSucceeds(
    getDocs(
      query(
        c(como(PEDRO), "repasse"),
        where("ano", "==", ANO),
        where("respEmail", "==", PEDRO),
        where("etapa", "in", ["SEPARADO"]),
        limit(300)
      )
    )
  );
});
test("WhatsApp de trabalho: a pessoa pede a troca dos próprios números; só o admin autoriza", async () => {
  const p = como(PEDRO);
  await assertSucceeds(
    setDoc(doc(p, "numeros", PEDRO), { numeros: ["21999998888"], status: "pendente", pedidoEm: "2026-10-27", nome: "Pedro" })
  );
  // não se autoriza sozinho, não pede por outra pessoa e não muda o próprio cadastro
  await assertFails(setDoc(doc(p, "numeros", PEDRO), { numeros: ["21999998888"], status: "aprovado", pedidoEm: "x", nome: "Pedro" }));
  await assertFails(setDoc(doc(p, "numeros", ANA), { numeros: ["21999998888"], status: "pendente", pedidoEm: "x", nome: "Pedro" }));
  await assertFails(updateDoc(doc(p, "usuarios", PEDRO), { numeros: ["21999998888"] }));
  await assertFails(getDoc(doc(p, "numeros", ANA)));
  // o admin autoriza; a pessoa só marca que viu
  await assertSucceeds(updateDoc(doc(como(ADRIANO), "usuarios", PEDRO), { numeros: ["21999998888"] }));
  await assertSucceeds(
    updateDoc(doc(como(ADRIANO), "numeros", PEDRO), { status: "aprovado", decididoEm: "x", decididoPor: "Adriano", visto: false })
  );
  await assertSucceeds(updateDoc(doc(p, "numeros", PEDRO), { visto: true }));
  await assertFails(updateDoc(doc(p, "numeros", PEDRO), { numeros: ["21900000000"] })); // depois de liberado, não troca sozinho
  await assertSucceeds(getDocs(query(c(como(ADRIANO), "numeros"), where("status", "==", "pendente"), limit(50))));
});
