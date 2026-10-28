import { test } from "node:test";
import assert from "node:assert/strict";
import { planejar } from "../js/migracao.js";

test("atualização dos dados antigos: responsável por e-mail, parcelas, privado e busca do funil", () => {
  const emailDe = n => ({ "Pedro Vendedor": "pedro@x.com" })[n] || "";
  const { ops, conta } = planejar(
    {
      instituicoes: [{ id: "i1", resp: "Pedro Vendedor" }, { id: "i2" }, { id: "i3", respEmail: "ana@x.com" }],
      formandos: [{ id: "f1", instId: "i1", valor: 850, parcelas: 10, pagas: 1, primeiroVenc: "2026-01-10" }],
      repasse: [{ id: "r1", resp: "Pedro Vendedor" }],
      agenda: [{ id: "2026-11-10", pedidoPor: "Pedro Vendedor" }],
      ensaios: [{ id: "c1", kind: "pessoal", particular: true, titulo: "Consulta médica" }],
      leads: [{ id: "l1", nome: "Érica Souza", resp: "Pedro Vendedor" }]
    },
    emailDe
  );
  const de = (col, id) => ops.filter(o => o.col === col && o.id === id).map(o => o.dados);
  assert.deepEqual(de("instituicoes", "i1"), [{ respEmail: "pedro@x.com" }]);
  assert.deepEqual(de("instituicoes", "i2"), [{ respEmail: "" }]);
  assert.equal(de("instituicoes", "i3").length, 0);
  const f = de("formandos", "f1")[0];
  assert.equal(f.respEmail, "pedro@x.com");
  assert.equal(f.pagas, 1);
  assert.equal(f.pagamentos.length, 1);
  assert.match(f.proxVenc, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(de("repasse", "r1"), [{ respEmail: "pedro@x.com" }]);
  assert.deepEqual(de("agenda", "2026-11-10"), [{ pedidoEmail: "pedro@x.com" }]);
  assert.equal(de("privado", "c1")[0].titulo, "Consulta médica");
  assert.deepEqual(de("ensaios", "c1"), [{ titulo: "", obs: "" }]);
  assert.deepEqual(de("leads", "l1"), [{ nomeBusca: "ERICA SOUZA", respEmail: "pedro@x.com" }]);
  assert.equal(conta.formandos, 1);
  // rodar de novo sobre o resultado não muda nada
  const depois = planejar(
    {
      instituicoes: [{ id: "i1", respEmail: "pedro@x.com" }],
      leads: [{ id: "l1", nome: "Érica Souza", nomeBusca: "ERICA SOUZA", respEmail: "" }]
    },
    emailDe
  );
  assert.equal(depois.ops.length, 0);
});

test("v6: Kit 01 vira 'adesao' e o preço antigo de colação da turma vira o Kit 01 da tabela da turma", () => {
  const { ops, conta } = planejar(
    {
      instituicoes: [
        { id: "i1", respEmail: "", colacao: { valor: 90, parcelas: 3 } },
        { id: "i2", respEmail: "", colacao: { valor: 90 }, kits: [{ id: "k01", ant: { valor: 70, parcelas: 1 } }] },
        { id: "i3", respEmail: "" }
      ],
      formandos: [
        { id: "f1", contrato: "colacao", respEmail: "", pagamentos: [], proxVenc: "" },
        { id: "f2", contrato: "album", status: "semkit", respEmail: "", pagamentos: [], proxVenc: "" }
      ]
    },
    () => ""
  );
  const op = (col, id) => ops.find(o => o.col === col && o.id === id);
  assert.deepEqual(op("instituicoes", "i1").dados.kits, [{ id: "k01", ant: { valor: 90, parcelas: 3 } }]);
  assert.deepEqual(op("instituicoes", "i1").apagar, ["colacao"]);
  assert.equal(op("instituicoes", "i2").dados.kits, undefined); // a tabela da turma já tinha o Kit 01
  assert.deepEqual(op("instituicoes", "i2").apagar, ["colacao"]);
  assert.equal(op("instituicoes", "i3"), undefined);
  assert.equal(op("formandos", "f1").dados.contrato, "adesao");
  assert.equal(op("formandos", "f2"), undefined);
  assert.equal(conta["formandos antigos sem kit (não mudados)"], 1);
});

test("v7: guarda a data do último pagamento (para o resumo não ler todos os formandos)", () => {
  const { ops } = planejar(
    {
      formandos: [
        {
          id: "f1",
          respEmail: "",
          proxVenc: "",
          pagamentos: [
            { data: "2025-03-05", valor: 1 },
            { data: "2025-05-05", valor: 1 }
          ]
        },
        { id: "f2", respEmail: "", proxVenc: "", pagamentos: [{ data: "2025-03-05", valor: 1 }], ultimoPag: "2025-03-05" },
        { id: "f3", respEmail: "", proxVenc: "", pagamentos: [] }
      ]
    },
    () => ""
  );
  const de = id => (ops.find(o => o.col === "formandos" && o.id === id) || {}).dados;
  assert.equal(de("f1").ultimoPag, "2025-05-05");
  assert.equal(de("f2"), undefined);
  assert.equal(de("f3"), undefined);
});

test("v7: nome de busca no formato único (maiúsculas) em leads e instituições", () => {
  const { ops } = planejar(
    {
      instituicoes: [{ id: "i1", respEmail: "", nome: "Colégio Ação", nomeBusca: "colegio acao" }],
      leads: [{ id: "l1", respEmail: "", nome: "Érica  Souza", nomeBusca: "erica  souza" }]
    },
    () => ""
  );
  const de = (c, id) => (ops.find(o => o.col === c && o.id === id) || {}).dados;
  assert.equal(de("instituicoes", "i1").nomeBusca, "COLEGIO ACAO");
  assert.equal(de("leads", "l1").nomeBusca, "ERICA SOUZA");
});

test("v8: índice de telefones do PR (e não regrava o que já está igual)", () => {
  const repasse = [
    { id: "r1", nome: "Lia", ano: 2025, contatos: [{ tel: "21911112222" }], respEmail: "" },
    { id: "r2", nome: "Rui", ano: 2026, telefones: ["21911112222", "21933334444"], respEmail: "" }
  ];
  const { ops } = planejar({ repasse }, () => "");
  const f = ops.filter(o => o.col === "fones");
  assert.deepEqual(f.find(o => o.id === "21911112222").dados.alunos, {
    r1: { nome: "LIA", ano: 2025, escola: "" },
    r2: { nome: "RUI", ano: 2026, escola: "" }
  });
  const fones = f.map(o => ({ id: o.id, alunos: o.dados.alunos }));
  assert.equal(planejar({ repasse, fones }, () => "").ops.filter(o => o.col === "fones").length, 0);
});

test("v9: ID do aluno do PR ganha o ano na frente e o formato de busca (só quando falta ou mudou)", async () => {
  const { planejar } = await import("../js/migracao.js");
  const repasse = [
    { id: "a", codigo: "CEPNCP - 1", ano: 2026 },
    { id: "b", codigo: "26CEPNCP-02", codigoBusca: "26CEPNCP02", ano: 2026 },
    { id: "c", codigo: "" },
    { id: "d", codigo: "CEPNCP - 03", ano: 2025, codigoOrig: "CEPNCP - 03" }
  ];
  const { ops } = planejar({ repasse }, () => "");
  const pr = ops.filter(o => o.col === "repasse");
  assert.deepEqual(
    pr.map(o => [o.id, o.dados]),
    [
      ["a", { codigo: "26CEPNCP-01", codigoOrig: "CEPNCP - 1", codigoBusca: "26CEPNCP01" }],
      ["d", { codigo: "25CEPNCP-03", codigoBusca: "25CEPNCP03" }]
    ]
  );
});

test("responsável antigo: acha pelo nome completo, pelo e-mail ou pelo primeiro nome (se só um tem)", async () => {
  const { criarEmailDe, relatorioResponsaveis, planejar } = await import("../js/migracao.js");
  const usuarios = [
    { id: "pedro@x.com", nome: "Pedro Vendedor" },
    { id: "ana@x.com", nome: "Ana Souza" },
    { id: "ana2@x.com", nome: "Ana Lima" }
  ];
  const { emailDe, comoAchou } = criarEmailDe(usuarios, [{ email: "Dono@x.com", nome: "Adriano" }]);
  assert.equal(emailDe("PEDRO VENDEDOR"), "pedro@x.com");
  assert.equal(comoAchou("pedro vendedor"), "nome completo");
  assert.equal(emailDe("Pedro"), "pedro@x.com");
  assert.equal(comoAchou("Pedro"), "primeiro nome");
  assert.equal(emailDe("Ana"), ""); // duas Anas: não chuta
  assert.equal(emailDe("ana@x.com"), "ana@x.com");
  assert.equal(emailDe("Adriano"), "dono@x.com");
  assert.equal(emailDe("Zé Antigo"), "");
  const cols = {
    repasse: [
      { id: "r1", resp: "Pedro" },
      { id: "r2", resp: "Zé Antigo" },
      { id: "r3", resp: "Zé Antigo" },
      { id: "r4", resp: "Pedro", respEmail: "pedro@x.com" }
    ],
    leads: [{ id: "l1", resp: "Ana" }]
  };
  const rel = relatorioResponsaveis(cols, emailDe, comoAchou);
  assert.deepEqual(
    rel.map(r => [r.nome, r.email, r.registros]),
    [
      ["Zé Antigo", "", 2],
      ["Ana", "", 1],
      ["Pedro", "pedro@x.com", 1]
    ]
  );
  // o plano liga o PR pelo primeiro nome e deixa sem e-mail quem não achou
  const ops = planejar(cols, emailDe).ops.filter(o => o.col === "repasse");
  assert.deepEqual(
    ops.map(o => [o.id, o.dados.respEmail]),
    [["r1", "pedro@x.com"]]
  );
});

test("v10: WhatsApp da empresa corrigido e ID das vendas de ensaio já fechadas", () => {
  const { ops, conta } = planejar(
    {
      config: [{ id: "app", lfNumero: "(21) 97105-9512", repNumero: "(21) 3774-0000", funilNumero: "", cobrancaNumero: "21997597605" }],
      ids: [{ id: "ensaio_26EST", ultimo: 3 }],
      leads: [
        {
          id: "b",
          nome: "B",
          nomeBusca: "B",
          respEmail: "",
          etapa: "FECHADO",
          servico: "Formatura individual (estúdio)",
          fechadoEm: "2026-10-05"
        },
        {
          id: "a",
          nome: "A",
          nomeBusca: "A",
          respEmail: "",
          etapa: "FECHADO",
          servico: "Formatura individual (estúdio)",
          fechadoEm: "2026-10-01"
        },
        { id: "c", nome: "C", nomeBusca: "C", respEmail: "", etapa: "FECHADO", servico: "Corporativo", fechadoEm: "2025-03-01" },
        { id: "d", nome: "D", nomeBusca: "D", respEmail: "", etapa: "FECHADO", servico: "Turma", fechadoEm: "2026-03-01" },
        {
          id: "e",
          nome: "E",
          nomeBusca: "E",
          respEmail: "",
          etapa: "FECHADO",
          servico: "Corporativo",
          codigoEnsaio: "26COP-00001",
          fechadoEm: "2026-03-01"
        }
      ]
    },
    () => ""
  );
  const cfg = ops.find(o => o.col === "config");
  assert.deepEqual(cfg.dados, { lfNumero: "", repNumero: "(21) 3743-0000", funilNumero: "(21) 99881-7771" });
  const cod = Object.fromEntries(ops.filter(o => o.col === "leads").map(o => [o.id, o.dados.codigoEnsaio]));
  assert.deepEqual(cod, { a: "26EST-00004", b: "26EST-00005", c: "25COP-00001" });
  assert.deepEqual(
    ops.filter(o => o.col === "ids").map(o => [o.id, o.dados.ultimo]),
    [
      ["ensaio_25COP", 1],
      ["ensaio_26EST", 5]
    ]
  );
  assert.equal(conta["ID dos ensaios"], 3);
});

test("v11: aluno do PR importado sem telefone sai dos Incompletos e só conta no Dashboard", () => {
  const { ops } = planejar(
    {
      repasse: [
        { id: "a", etapa: "INCOMPLETO", importadoEm: "x", respEmail: "", contatos: [] },
        { id: "b", etapa: "INCOMPLETO", importadoEm: "x", respEmail: "", contatos: [{ tel: "21999990000" }] },
        { id: "c", etapa: "INCOMPLETO", respEmail: "eq@z7.com", contatos: [] },
        { id: "d", etapa: "ENTREGUE", historico: true, importadoEm: "x", contatos: [] },
        { id: "e", etapa: "SEM TELEFONE", semTelefone: true, contatos: [] },
        { id: "f", etapa: "INCOMPLETO", contatos: [] }
      ]
    },
    () => ""
  );
  const rep = Object.fromEntries(ops.filter(o => o.col === "repasse").map(o => [o.id, o.dados]));
  assert.deepEqual(rep.a, { etapa: "SEM TELEFONE", semTelefone: true, followup: null });
  assert.deepEqual(rep.d, { semTelefone: true });
  assert.deepEqual(rep.f, { etapa: "SEM TELEFONE", semTelefone: true, followup: null });
  assert.equal(rep.b, undefined);
  assert.equal(rep.c, undefined);
  assert.equal(rep.e, undefined);
});

test("v12: colégios das planilhas: João Paulo II e CIEP 156 do Adriano, o resto do Roberto com cadastro pendente", () => {
  const v = [{ obs: "Já trabalhamos (PR) nos anos 2022.", origem: "planilha" }];
  const base = {
    tipo: "publico",
    importadoEm: "x",
    visitas: v,
    resp: "",
    respEmail: "",
    segmentos: { pre: false, ano5: false, ano9: false, medio: false }
  };
  const emailDe = n => ({ Adriano: "adriano@z7.com", Roberto: "roberto@z7.com" })[n] || "";
  const { ops } = planejar(
    {
      instituicoes: [
        Object.assign({ id: "jp", nome: "C.E. João Paulo II" }, base),
        Object.assign({ id: "c225", nome: "CIEP 225 Mário Quintana" }, base),
        Object.assign({ id: "w", nome: "Waldemar Raythe" }, base),
        Object.assign({ id: "cm", nome: "E.M. Cyro Monteiro" }, base),
        { id: "outro", tipo: "publico", nome: "C.E. Alfa", resp: "Ana", respEmail: "ana@z7.com" }
      ],
      repasse: [
        { id: "p1", etapa: "SEM TELEFONE", escola: "E. M. MARIO PIRAGIBE", contatos: [], semTelefone: true },
        { id: "p2", etapa: "SEM TELEFONE", escola: "CIEP 225", contatos: [], semTelefone: true }
      ]
    },
    emailDe
  );
  const de = Object.fromEntries(ops.map(o => [o.col + "/" + o.id, o.dados]));
  assert.equal(de["instituicoes/jp"].respEmail, "adriano@z7.com");
  assert.equal(de["instituicoes/jp"].cadastroPendente, undefined);
  assert.equal(de["instituicoes/jp"].segmentos.medio, true);
  assert.equal(de["instituicoes/c225"].respEmail, "roberto@z7.com");
  assert.equal(de["instituicoes/c225"].cadastroPendente, true);
  assert.equal(de["instituicoes/w"].nome, "C.E. Waldemar Raythe");
  assert.equal(de["instituicoes/cm"].segmentos.ano9, true);
  assert.equal(de["instituicoes/outro"], undefined);
  assert.deepEqual(de["repasse/p1"], { semTelOk: true });
  assert.equal(de["repasse/p2"], undefined);
  // Roberto ainda não cadastrado: fica com o nome (livre) e pega o e-mail quando rodar de novo
  const { ops: ops2 } = planejar({ instituicoes: [Object.assign({ id: "c", nome: "CIEP 1" }, base)] }, () => "");
  assert.equal(ops2[0].dados.resp, "Roberto");
  assert.equal(ops2[0].dados.respEmail, undefined);
  assert.equal(ops2[0].dados.cadastroPendente, true);
});
