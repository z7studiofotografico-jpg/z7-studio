import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTel, linhaParaDoc, docId, faltando, slug } from "../js/repasse-dados.js";

test("telefone da planilha: tira o 55, guarda o nome entre parênteses e recusa número curto", () => {
  assert.deepEqual(parseTel("+55 (21) 98888-7777", "Mãe"), { tipo: "Mãe", nome: "", tel: "21988887777" });
  assert.deepEqual(parseTel("21988887777 (Marta)", "Mãe"), { tipo: "Mãe", nome: "Marta", tel: "21988887777" });
  assert.equal(parseTel("12345", "Pai"), null);
});
test("linha da planilha vira aluno: ano pela data do ensaio, mãe primeiro, telefones sem repetir", () => {
  const d = linhaParaDoc({ nome: " Lia ", escola: "Colegio Alfa", data: "10/03/2025", c1: "21911112222", c2: "21911112222 (Rosa)" }, null);
  assert.equal(d.nome, "Lia");
  assert.equal(d.ano, 2025);
  assert.equal(d.contatos.length, 1);
  assert.deepEqual([d.contatos[0].tipo, d.contatos[0].nome], ["Mãe", "Rosa"]);
});
test("identificador estável (reimportar não duplica) e o que falta para entrar na fila", () => {
  const d = { ano: 2025, escola: "Colégio Alfa", codigo: "12", nome: "Lia Souza" };
  assert.equal(docId(d, 0), docId({ ...d }, 99));
  assert.equal(slug("Colégio Alfa"), "colegio-alfa");
  assert.deepEqual(faltando({ escola: "X", ano: 2025, nome: "Lia", contatos: [] }), ["responsável", "telefone"]);
  assert.deepEqual(faltando({ escola: "X", ano: 2025, nome: "Lia", contatos: [{ tipo: "Mãe", nome: "Rosa", tel: "1" }] }), []);
});

test("situação e endereço do cartão do PR", async () => {
  const { situacaoTxt, enderecoTxt } = await import("../js/repasse-dados.js");
  assert.equal(situacaoTxt({ etapa: "CONTATADO", followup: "2026-10-20" }, "late"), "Atrasado desde 20/10");
  assert.equal(situacaoTxt({ etapa: "SEPARADO" }, "none"), "Sem data de contato");
  assert.equal(situacaoTxt({ etapa: "PAGO", pagoEm: "2026-10-01" }, "none"), "Pago em 01/10 · ⚠️ falta combinar entrega ou retirada");
  assert.equal(
    situacaoTxt({ etapa: "PAGO", pagoEm: "2026-10-01", entregaTipo: "Entrega em casa", entregaData: "2026-10-05" }, "none"),
    "Pago em 01/10 · entrega em casa em 05/10 · ⚠️ endereço não confirmado"
  );
  assert.equal(situacaoTxt({ etapa: "NA FILA" }, "none"), "Ainda na fila");
  const end = { rua: "RUA DA PAZ", numero: "10", bairro: "CENTRO", cidade: "NILÓPOLIS" };
  assert.equal(enderecoTxt({ etapa: "PAGO", entregaTipo: "Entrega em casa", endereco: end }), "Rua da Paz, 10 · Centro · Nilópolis");
  assert.equal(enderecoTxt({ etapa: "PAGO", entregaTipo: "Retirada no estúdio", endereco: end }), "");
});

test("planilha antiga (2021): TELEFONE 1 aluno, 2 mãe, 3 pai; sem nome vira 'Responsável do aluno Fulano (cadastrado)'; ano escolhido na importação", async () => {
  const { linhaParaDoc, faltando, ehRespCadastro, MAPA, hkey } = await import("../js/repasse-dados.js");
  const cab = [
    "FOTOZOOM",
    "ESCOLA / FAC.",
    "CURSO",
    "STATUS",
    "VENDEDOR",
    "ID",
    "FORMANDO ",
    "DATA ",
    "TELEFONE 1",
    "TELEFONE 2",
    "TELEFONE 3",
    "TELEFONE 4"
  ];
  const cols = cab.map(h => MAPA[hkey(h)] || null);
  const linha = v => {
    const o = {};
    cols.forEach((k, i) => k && o[k] == null && (o[k] = v[i]));
    return o;
  };
  const X = { SSF: { parse_date_code: () => null } };
  const a = linhaParaDoc(
    linha([
      "4821",
      "CIEP 384 GONÇALVES DIAS",
      "3º ANO",
      "-",
      "-",
      "7",
      "TAMARA CORREA",
      "",
      "22 99963-8860",
      "22 99926-6331",
      "22 999831848",
      ""
    ]),
    X,
    2021
  );
  assert.equal(a.ano, 2021);
  assert.deepEqual(
    a.contatos.map(c => [c.tipo, c.nome, c.tel]),
    [
      ["Mãe", "Responsável do aluno Tamara Correa (cadastrado)", "22999266331"],
      ["Pai", "Responsável do aluno Tamara Correa (cadastrado)", "22999831848"],
      ["Formando", "", "22999638860"]
    ]
  );
  assert.deepEqual(faltando(a), []);
  assert.equal(a.codigo, "21CIEP384-07");
  assert.doesNotMatch(a.obs, /FotoZoom|4821/); // o código do FotoZoom não entra
  // DATA de venda em outro ano não muda o ano das fotos escolhido
  const b = linhaParaDoc(
    linha(["", "E.M. ALEXANDRE FARAH", "9 ANO", "VENDIDO", "ROBERTO", "EMAF - 21", "RIANNY VICTORIA", "10/3/2022", "21966472002"]),
    X,
    2021
  );
  assert.equal(b.ano, 2021);
  assert.equal(b.codigo, "21EMAF-21");
  // só o telefone do aluno: entra na fila com o responsável "do cadastro"
  assert.equal(b.responsavel, "Responsável do aluno Rianny Victoria (cadastrado)");
  assert.ok(ehRespCadastro(b.responsavel) && !ehRespCadastro("Marta"));
  assert.deepEqual(faltando(b), []);
  // sem ano escolhido, continua usando a DATA (planilhas do ano atual)
  assert.equal(linhaParaDoc(linha(["", "X", "", "", "", "1", "ANA", "10/3/2022", "21966472002"]), X).ano, 2022);
});

test("histórico da planilha no cartão: status (CAÍDO), observação/motivo, vendedor e pagamento; ignora '-'", async () => {
  const { historicoPlanilha, linhaParaDoc } = await import("../js/repasse-dados.js");
  const d = linhaParaDoc(
    {
      nome: "Ana",
      escola: "X",
      statusOrig: "",
      status: "CAIDO",
      vendedor: "ROBERTO",
      obs: "mãe desempregada",
      motivo: "sem dinheiro",
      pagamento: "-",
      c1: "21988887777"
    },
    null,
    2021
  );
  assert.equal(historicoPlanilha(d), "Status: CAIDO · mãe desempregada · Motivo: sem dinheiro · Vendedor: ROBERTO");
  assert.equal(historicoPlanilha({ statusOrig: "-", obs: "" }), "");
});

test("planilha com colunas deslocadas (STATUS em CURSO), ano no nome do colégio e ENDEREÇO", async () => {
  const { linhaParaDoc } = await import("../js/repasse-dados.js");
  const d = linhaParaDoc(
    {
      escola: "C. E PRESIDENTE DUTRA 2021",
      curso: "VENDIDO",
      status: "ROBERTO",
      vendedor: "ROBERTO",
      codigo: "CEPD - 04",
      nome: "BRUNA",
      c1: "21967841572",
      rua: "AVENIDA FERNANDO TEIXEIRA"
    },
    null,
    2021
  );
  assert.equal(d.statusOrig, "VENDIDO");
  assert.equal(d.curso, "");
  assert.equal(d.escola, "C. E PRESIDENTE DUTRA");
  assert.equal(d.endereco.rua, "AVENIDA FERNANDO TEIXEIRA");
  const e = linhaParaDoc({ escola: "X", curso: "-", status: "CAIDO", nome: "A", c1: "21967841572" }, null, 2021);
  assert.equal(e.statusOrig, "CAIDO");
});
