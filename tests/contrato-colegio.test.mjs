import { test } from "node:test";
import assert from "node:assert/strict";
const R = await import("../js/contrato-colegio-regras.js");

test("pacote: lê a coluna PACOTE da planilha em qualquer ordem e grafia", () => {
  assert.deepEqual(R.lerPacote("CERTIFICADO + CANUDO"), ["certificado", "canudo"]);
  assert.deepEqual(R.lerPacote("canudo, paspatur e certificado"), ["paspatur", "certificado", "canudo"]);
  assert.deepEqual(R.lerPacote("BECA + PASPATUR + CERTIFICADO + CANUDO"), ["beca", "paspatur", "certificado", "canudo"]);
  assert.deepEqual(R.lerPacote("Paspatú/Certificados"), ["paspatur", "certificado"]);
  assert.deepEqual(R.lerPacote(""), []);
  assert.deepEqual(R.lerPacote("foto extra"), []);
});

test("pacote: célula vazia usa o pacote padrão do contrato", () => {
  const c = { pacotePadrao: ["paspatur", "certificado", "canudo"] };
  assert.deepEqual(R.pacoteDoAluno({ pacote: [] }, c), { itens: ["paspatur", "certificado", "canudo"], padrao: true });
  assert.deepEqual(R.pacoteDoAluno({ pacote: ["canudo", "certificado"] }, c), { itens: ["certificado", "canudo"], padrao: false });
});

test("pagamento: onde o dinheiro está", () => {
  assert.equal(R.ondeEsta({ recebidoPor: "estudio" }), "caixa");
  assert.equal(R.ondeEsta({ recebidoPor: "colegio" }), "colegio");
  assert.equal(R.ondeEsta({ recebidoPor: "colegio", repassadoEm: "2026-11-05" }), "caixa");
  assert.equal(R.ondeEsta({ recebidoPor: "representante" }), "representante");
  assert.equal(R.ondeEsta({ recebidoPor: "representante", repasseAvisadoEm: "2026-11-05" }), "avisado");
  assert.equal(R.ondeEsta({ recebidoPor: "representante", repassadoEm: "2026-11-06" }), "caixa");
  assert.equal(R.textoOnde({ recebidoPor: "colegio" }, { contato: { cargo: "Diretor(a)" } }), "Com o diretor");
  assert.equal(R.textoOnde({ recebidoPor: "colegio" }, { contato: { cargo: "Coordenador(a)" } }), "Com o coordenador");
});

test("resumo: falta repassar separado por colégio e representante; comissão só do caixa conferido", () => {
  const pags = [
    { alunoId: "a", valor: 80, recebidoPor: "estudio", forma: "Link", conferido: true },
    { alunoId: "b", valor: 120, recebidoPor: "colegio", forma: "Dinheiro" },
    { alunoId: "c", valor: 150, recebidoPor: "estudio", forma: "Boleto" },
    { alunoId: "d", valor: 120, recebidoPor: "colegio", forma: "Dinheiro", repassadoEm: "2026-11-05", conferido: true },
    { alunoId: "e", valor: 50, recebidoPor: "representante", forma: "Dinheiro", repasseAvisadoEm: "2026-11-07" }
  ];
  const r = R.resumoDinheiro(pags, { quemPaga: "alunos", valor: 150 }, [1, 2, 3, 4, 5], {});
  assert.equal(r.recebido, 520);
  assert.equal(r.caixa, 350);
  assert.equal(r.comColegio, 120);
  assert.equal(r.comRep, 50);
  assert.equal(r.combinado, 750);
  assert.equal(r.falta, 230);
  assert.equal(r.aConferir, 1);
  // Link 13% de 80 = 10,40 + Dinheiro 15% de 120 = 18 → 28,40 (tabela padrão do Álbum de formatura)
  assert.equal(r.comissao, 28.4);
  assert.deepEqual(R.pagoPorAluno(pags).a, 80);
});

test("resumo: quando o colégio paga, o combinado é o total", () => {
  const r = R.resumoDinheiro([], { quemPaga: "colegio", valor: 3000 }, [1, 2], {});
  assert.equal(r.combinado, 3000);
  assert.equal(r.falta, 3000);
});

test("produção: totais por item e quem precisa de foto", () => {
  const c = { pacotePadrao: ["paspatur", "certificado", "canudo"] };
  const al = [
    { nome: "João Lucas", serie: "3001", pacote: ["certificado", "canudo"] },
    { nome: "Miguel Augusto", serie: "3001", pacote: ["paspatur", "certificado", "canudo"] },
    { nome: "Ana Beatriz", serie: "3002", pacote: ["beca", "paspatur", "certificado", "canudo"] },
    { nome: "Pedro Henrique", serie: "3002" }
  ];
  const p = R.producao(al, c);
  assert.deepEqual(p.totais, { beca: 1, paspatur: 3, certificado: 4, canudo: 4 });
  assert.deepEqual(
    p.precisamFoto.map(l => l.aluno.nome),
    ["Miguel Augusto", "Ana Beatriz", "Pedro Henrique"]
  );
});

test("permissões: só o admin ou quem fechou; o representante não confirma o próprio repasse", () => {
  const c = { respEmail: "rep@x.com" };
  assert.equal(R.podeEditar({ isAdmin: false, email: "rep@x.com" }, c), true);
  assert.equal(R.podeEditar({ isAdmin: false, email: "outro@x.com" }, c), false);
  assert.equal(R.podeEditar({ isAdmin: true, email: "adm@x.com" }, c), true);
  assert.equal(R.repPodeMexer({ recebidoPor: "representante", repassadoEm: "2026-11-05" }), false);
  assert.equal(R.repPodeMexer({ recebidoPor: "colegio", repassadoEm: "2026-11-05" }), true);
  assert.equal(R.repPodeMexer({ recebidoPor: "estudio", conferido: true }), false);
});
