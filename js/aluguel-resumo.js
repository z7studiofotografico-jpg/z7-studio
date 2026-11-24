// Aluguel de becas · resumo dos valores (17/11/2026): Valor total (o que os alunos fecharam) e A receber (o total
// menos os pagamentos lançados nos contratos dos colégios), com o filtro de tipo de instituição (particular, público,
// faculdade e curso, ou todas) e o botão de cadastrar uma instituição. Os valores ficam apagados até tocar no olho.
import { textoRecepcionista } from "./recepcionista.js";
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
// (24/11/2026) etiqueta da recepcionista na faixa do colégio (chega depois de ler o contrato)
export function etiquetaRecep(C, id) {
  const t = el("span", "tag");
  t.hidden = true;
  contratoDe(C, id).then(c => {
    const x = textoRecepcionista(c);
    if (x) (t.textContent = "💁 " + x), (t.hidden = false);
  });
  return t;
}
// pagamentos e contrato lidos de novo (depois de lançar uma entrada)
export const limparCacheValores = () => (cache.clear(), cacheC.clear());

// os quadros de valor no topo: Valor total, Recebido, A receber e (admin) Comissão a pagar
// (24/11/2026) o Recebido conta também a entrada / antecipação do colégio (pagamento sem aluno)
export function kpisValores(C, k, alunos) {
  const vai = alunos.filter(a => !a.naoParticipa);
  const total = vai.reduce((t, a) => t + (Number(a.valor) || 0), 0);
  const kT = el("div", "kpi");
  const bT = el("b", null, brl(total));
  kT.append(el("small", null, "Valor total"), bT);
  const bRec = el("b", null, "…");
  const kRec = el("div", "kpi ok");
  kRec.append(el("small", null, "Recebido"), bRec);
  const bR = el("b", null, "…");
  const kR = el("div", "kpi");
  kR.append(el("small", null, "A receber"), bR);
  k.append(kT, kRec, kR);
  const bC = el("b", null, "…");
  const sC = el("small", null, ""); // (24/11/2026) a comissão já paga, embaixo
  if (C.isAdmin) {
    const kC = el("div", "kpi");
    kC.append(el("small", null, "Comissão a pagar"), bC, sC);
    k.append(kC);
  }
  const ids = [...new Set(vai.map(a => `${a.instId}_${a.ano}`))];
  const deles = new Set(vai.map(a => a.id));
  Promise.all(ids.map(id => Promise.all([pagamentosDe(C, id), contratoDe(C, id)]))).then(async ls => {
    const R = C.isAdmin ? await import("./contrato-colegio-regras.js") : null;
    let recebido = 0;
    let comissao = 0;
    let paga = 0;
    let recep = 0; // (24/11/2026) a recepcionista do contrato soma no total
    ls.forEach(([pags, contrato]) => {
      if (contrato && contrato.recepcionista && contrato.recepcionista.tem) recep += Number(contrato.recepcionista.valor) || 0;
      // só os pagamentos dos alunos desta lista (ou do colégio inteiro: entrada, antecipação, colégio que paga)
      const dele = pags.filter(p => !p.excluido && (!p.alunoId || deles.has(p.alunoId)));
      recebido += dele.reduce((t, p) => t + (Number(p.valor) || 0), 0);
      if (R && contrato && !R.semComissao(contrato, C.isDono))
        dele
          .filter(p => R.ondeEsta(p) === "caixa" && p.conferido)
          .forEach(p => {
            const v = R.comissaoPagamento(p, C.P, contrato) / 100;
            if (p.comissaoPagaEm) paga += v;
            else comissao += v;
          });
    });
    bT.textContent = brl(total + recep);
    bRec.textContent = brl(recebido);
    bR.textContent = brl(Math.max(0, total + recep - recebido));
    bC.textContent = brl(comissao);
    sC.textContent = paga ? `já paga: ${brl(paga)}` : "";
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
