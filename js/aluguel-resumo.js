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

// os dois quadros de valor no topo (o A receber chega depois de ler os pagamentos)
export function kpisValores(C, k, alunos) {
  const vai = alunos.filter(a => !a.naoParticipa);
  const total = vai.reduce((t, a) => t + (Number(a.valor) || 0), 0);
  const kT = el("div", "kpi");
  kT.append(el("small", null, "Valor total"), el("b", null, brl(total)));
  const bR = el("b", null, "…");
  const kR = el("div", "kpi");
  kR.append(el("small", null, "A receber"), bR);
  k.append(kT, kR);
  const ids = [...new Set(vai.map(a => `${a.instId}_${a.ano}`))];
  const deles = new Set(vai.map(a => a.id));
  Promise.all(ids.map(id => pagamentosDe(C, id))).then(ls => {
    // só os pagamentos dos alunos desta lista (ou do colégio inteiro, quando o colégio paga)
    const recebido = ls.flat().reduce((t, p) => t + (!p.alunoId || deles.has(p.alunoId) ? Number(p.valor) || 0 : 0), 0);
    bR.textContent = brl(Math.max(0, total - recebido));
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
