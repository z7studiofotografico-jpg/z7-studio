// Dashboard por módulo (Etapa 7): o cálculo, sem tela (testado em tests/modulos-calc.test.mjs).
// Cada módulo fica separado (Aluguel, PR, Paspatur, Formatura Linha de Frente, Formatura Repasse e Venda Antecipada);
// só o "geral" soma tudo. Duas visões do dinheiro (item 5.9):
//   por TURMA = ano da turma/fotos do aluno (ex.: turma de 2026, mesmo que tenha pago em 2027);
//   por CAIXA = ano em que o dinheiro entrou (data de cada recebimento).
// Valores em centavos. Gravado em resumos/modulos (o Dashboard abre lendo 1 documento).
import { anoDaTurma } from "./contrato.js";

export const MODS = [
  ["aluguel", "👘 Aluguel de becas"],
  ["pr", "🖼️ PR"],
  ["paspatur", "🎞️ Paspatur"],
  ["flf", "🎓 Formatura · Linha de Frente"],
  ["frep", "🎓 Formatura · Repasse"],
  ["va", "🎓 Venda Antecipada"]
];
const cent = v => Math.round((Number(v) || 0) * 100);
const PAGOS = ["PAGO", "ENTREGUE"];
const RETIROU = ["Retirou a beca", "Devolvida"];

// Uma lista de recebimentos: { mod, data (dia do dinheiro), c (centavos), turma (ano), itens: [{ produto, qtd }] }
export function recebimentos(f) {
  const out = [];
  // lista única (08/11/2026): o Paspatur está no PR, com vendaComo "paspatur" (a coleção antiga fica vazia)
  const pr = (lista, mod) =>
    (lista || [])
      .filter(x => PAGOS.includes(x.etapa) && x.pagoEm && !x.historico && !x.excluido)
      .forEach(x =>
        out.push({
          mod: x.vendaComo === "paspatur" ? "paspatur" : mod,
          data: x.pagoEm,
          c: cent(x.valor),
          turma: Number(x.ano) || 0,
          itens: []
        })
      );
  pr(f.repasse, "pr");
  pr(f.paspatur, "paspatur");
  (f.formaturaAlunos || [])
    .filter(x => PAGOS.includes(x.etapa) && x.pagoEm && !x.historico && !x.excluido)
    .forEach(x =>
      out.push({ mod: x.seg === "rep" ? "frep" : "flf", data: x.pagoEm, c: cent(x.valor), turma: Number(x.ano) || 0, itens: [] })
    );
  // Venda Antecipada: cada parcela recebida entra no caixa do dia em que foi paga
  const insts = Object.fromEntries((f.insts || []).map(i => [i.id, i]));
  (f.formandos || []).forEach(x => {
    const turma = anoDaTurma(insts[x.instId]) || Number(String(x.vendidoEm || "").slice(0, 4)) || 0;
    (Array.isArray(x.pagamentos) ? x.pagamentos : []).forEach(p => {
      if (p && p.data) out.push({ mod: "va", data: p.data, c: cent(p.valor), turma, itens: [] });
    });
  });
  // Aluguel: conta quando o aluno retira a beca (aluguel + produtos que levou)
  (f.alugueis || [])
    .filter(a => RETIROU.includes(a.status) && !a.excluido)
    .forEach(a => {
      const h = (a.historico || []).find(x => x.para === "Retirou a beca");
      const data = String((h && h.em) || a.retirada || a.criadoEm || "").slice(0, 10);
      if (!data) return;
      const prods = (a.produtos || []).filter(p => p.estado !== "estornado");
      const c = cent(a.valor) + prods.reduce((t, p) => t + cent(p.valor) * (Number(p.qtd) || 0), 0);
      out.push({
        mod: "aluguel",
        data,
        c,
        turma: Number(a.ano) || 0,
        itens: prods.map(p => ({ produto: p.produto, qtd: Number(p.qtd) || 0 }))
      });
    });
  return out;
}

const soma = (o, k, v) => (o[k] = (o[k] || 0) + v);
function vazio() {
  return { totalC: 0, n: 0, porMes: {}, porDia: {}, porTurma: {}, porCaixa: {}, produtos: {} };
}
// recebimentos → por módulo e geral; porDia só dos últimos 62 dias (o documento fica pequeno)
export function resumirModulos(f, hoje) {
  const corteDia = (() => {
    const d = new Date(hoje + "T12:00:00");
    d.setDate(d.getDate() - 62);
    return d.toISOString().slice(0, 10);
  })();
  const mods = Object.fromEntries([...MODS.map(([k]) => [k, vazio()]), ["geral", vazio()]]);
  recebimentos(f).forEach(r => {
    [mods[r.mod], mods.geral].forEach(m => {
      m.totalC += r.c;
      m.n++;
      soma(m.porMes, r.data.slice(0, 7), r.c);
      if (r.data >= corteDia) soma(m.porDia, r.data, r.c);
      if (r.turma) soma(m.porTurma, String(r.turma), r.c);
      soma(m.porCaixa, r.data.slice(0, 4), r.c);
      r.itens.forEach(i => soma(m.produtos, i.produto, i.qtd));
    });
  });
  // saídas de produtos (baixas no estoque), por mês e por módulo
  const saidas = { porMes: {}, porMod: {}, porProduto: {} };
  (f.movEstoque || [])
    .filter(m => m.tipo === "baixa" || m.tipo === "baixaDireta")
    .forEach(m => {
      const mes = String(m.em || "").slice(0, 7);
      (m.itens || []).forEach(i => {
        const q = Number(i.qtd) || 0;
        soma(saidas.porMes, mes, q);
        soma(saidas.porProduto, i.produto, q);
        const mod = m.modulo || "outro";
        saidas.porMod[mod] = saidas.porMod[mod] || {};
        soma(saidas.porMod[mod], i.produto, q);
      });
    });
  // estoque agora
  const prods = f.produtos || [];
  const disp = p => Math.max(0, (Number(p.fisico) || 0) - (Number(p.reservado) || 0));
  const estoque = {
    abaixo: prods.filter(p => p.controla && Number(p.minimo) > 0 && disp(p) <= Number(p.minimo)).map(p => p.nome || p.id),
    reservados: prods.filter(p => Number(p.reservado) > 0).length,
    itens: prods
      .filter(p => p.controla && (Number(p.fisico) || Number(p.reservado)))
      .map(p => [p.nome || p.id, Number(p.fisico) || 0, Number(p.reservado) || 0, disp(p)])
  };
  // instituições: fechadas, visitadas e que não fecharam (por mês) + motivos
  const insts = { fechadas: {}, visitadas: {}, naoFecharam: {}, motivos: {}, total: { fechadas: 0, naoFecharam: 0 } };
  (f.insts || []).forEach(i => {
    if (i.fechadoEm) soma(insts.fechadas, String(i.fechadoEm).slice(0, 7), 1);
    if (i.etapa === "FECHADO") insts.total.fechadas++;
    (i.visitas || []).forEach(v => {
      if (v && v.data && /visita/i.test(v.como || "Visita")) soma(insts.visitadas, String(v.data).slice(0, 7), 1);
    });
    if (i.etapa === "NÃO FECHOU") {
      insts.total.naoFecharam++;
      const nf = i.naoFechou || {};
      if (nf.em) soma(insts.naoFecharam, String(nf.em).slice(0, 7), 1);
      soma(insts.motivos, nf.motivo || "Sem motivo", 1);
    }
  });
  return { hoje, geradoEm: new Date().toISOString(), mods, saidas, estoque, insts };
}

// o que ler no banco (o mesmo para o botão do Dashboard); ler(colecao, filtros) → [{ id, ...dados }]
export async function lerFontesModulos(ler, hoje) {
  const d = new Date(hoje + "T12:00:00");
  d.setFullYear(d.getFullYear() - 2);
  const corte = d.toISOString().slice(0, 10);
  const desde = c => [[c, ">=", corte]];
  const [repasse, paspatur, formaturaAlunos, formandos, alugueis, insts, produtos, movEstoque] = await Promise.all([
    ler("repasse", desde("pagoEm")),
    ler("paspatur", desde("pagoEm")),
    ler("formaturaAlunos", desde("pagoEm")),
    ler("formandos", desde("ultimoPag")),
    ler("alugueis", []),
    ler("instituicoes", []),
    ler("produtos", []),
    ler("movEstoque", desde("em"))
  ]);
  return { repasse, paspatur, formaturaAlunos, formandos, alugueis, insts, produtos, movEstoque };
}
