// Aluguel de becas · resumo dos valores (17/11/2026): Valor total (o que os alunos fecharam) e A receber (o total
// menos os pagamentos lançados nos contratos dos colégios), com o filtro de tipo de instituição (particular, público,
// faculdade e curso, ou todas) e o botão de cadastrar uma instituição. Os valores ficam apagados até tocar no olho.
import { el, sheet } from "./ui.js";
import * as U from "./util.js";
import { brl } from "./regras.js";
import { cartaoDoTipo, CARTOES } from "./instituicoes-dados.js";

export const TIPOS_FILTRO = [
  ["particular", "🏫 Particular"],
  ["publico", "🏛️ Público"],
  ["superior", "🎓 Faculdade e curso"]
];
// o tipo da instituição do aluno (particular, publico, superior)
export const tipoDoAluno = (a, insts) => cartaoDoTipo((insts.find(i => i.id === a.instId) || {}).tipo || "");

// pagamentos de cada contrato (colégio e ano), guardados por alguns minutos para não ler toda hora
const cache = new Map();
function pagamentosDe(C, id) {
  const c = cache.get(id);
  if (c && Date.now() - c.em < 3 * 60 * 1000) return c.p;
  const p = C.FS.getDocs(C.FS.collection(C.db, "contratosColegio", id, "pagamentos"))
    .then(s => s.docs.map(d => d.data()))
    .catch(() => []);
  cache.set(id, { em: Date.now(), p });
  return p;
}

// o contrato do colégio (para a comissão), guardado junto com os pagamentos
const cacheC = new Map();
function contratoDe(C, id) {
  const c = cacheC.get(id);
  if (c && Date.now() - c.em < 3 * 60 * 1000) return c.p;
  const p = C.FS.getDoc(C.FS.doc(C.db, "contratosColegio", id))
    .then(s => (s.exists() ? s.data() : null))
    .catch(() => null);
  cacheC.set(id, { em: Date.now(), p });
  return p;
}
// pagamentos e contrato lidos de novo (depois de lançar uma entrada)
export const limparCacheValores = () => (cache.clear(), cacheC.clear());

// os quadros de valor no topo: Valor total, Recebido, A receber e (admin) Comissão a pagar
// (24/11/2026) o Recebido conta também a entrada / antecipação do colégio (pagamento sem aluno)
export function kpisValores(C, k, alunos) {
  const vai = alunos.filter(a => !a.naoParticipa);
  const total = vai.reduce((t, a) => t + (Number(a.valor) || 0), 0);
  const kT = el("div", "kpi");
  kT.append(el("small", null, "Valor total"), el("b", null, brl(total)));
  const bRec = el("b", null, "…");
  const kRec = el("div", "kpi ok");
  kRec.append(el("small", null, "Recebido"), bRec);
  const bR = el("b", null, "…");
  const kR = el("div", "kpi");
  kR.append(el("small", null, "A receber"), bR);
  k.append(kT, kRec, kR);
  const bC = el("b", null, "…");
  if (C.isAdmin) {
    const kC = el("div", "kpi");
    kC.append(el("small", null, "Comissão a pagar"), bC);
    k.append(kC);
  }
  const ids = [...new Set(vai.map(a => `${a.instId}_${a.ano}`))];
  const deles = new Set(vai.map(a => a.id));
  Promise.all(ids.map(id => Promise.all([pagamentosDe(C, id), C.isAdmin ? contratoDe(C, id) : null]))).then(async ls => {
    const R = C.isAdmin ? await import("./contrato-colegio-regras.js") : null;
    let recebido = 0;
    let comissao = 0;
    ls.forEach(([pags, contrato]) => {
      // só os pagamentos dos alunos desta lista (ou do colégio inteiro: entrada, antecipação, colégio que paga)
      const dele = pags.filter(p => !p.excluido && (!p.alunoId || deles.has(p.alunoId)));
      recebido += dele.reduce((t, p) => t + (Number(p.valor) || 0), 0);
      if (R && contrato && !R.semComissao(contrato, C.isDono))
        comissao += dele
          .filter(p => R.ondeEsta(p) === "caixa" && p.conferido && !p.comissaoPagaEm)
          .reduce((t, p) => t + R.comissaoPagamento(p, C.P, contrato) / 100, 0);
    });
    bRec.textContent = brl(recebido);
    bR.textContent = brl(Math.max(0, total - recebido));
    bC.textContent = brl(comissao);
  });
}

// botão "+ Instituição": escolhe particular, público ou faculdade e curso, e abre o mesmo cadastro das Instituições
export function botaoNovaInstituicao(C) {
  return U.mkBtn("🏫 + Instituição", "btn-sm", () =>
    sheet("Cadastrar instituição", (p, close) => {
      p.append(el("p", "hint", "Qual o tipo da instituição?"));
      const a = el("div", "actions");
      Object.entries(CARTOES).forEach(([k, t]) =>
        a.append(
          U.mkBtn(`${t.ico} ${t.nome}`, "btn-primary", () => {
            close();
            import("./instituicoes.js").then(m => m.novaInstituicao(C, k)).catch(e => C.handleErr(e));
          })
        )
      );
      p.append(a, U.mkBtn("Cancelar", "", close));
    })
  );
}
