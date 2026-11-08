// Lista única do PR (08/11/2026): os alunos da coleção "paspatur" passam para a coleção "repasse", marcados com
// vendaComo: "paspatur". Sem tela: roda no GitHub (Actions → "Juntar Paspatur no PR") e é testado em
// tests/juntar-paspatur.test.mjs. Pode rodar de novo: o que já foi juntado não está mais na coleção paspatur.
//
// O que muda:
//   - cada aluno do Paspatur vira um documento em repasse (mesmo ID; se o ID já existe no PR, ganha "_pas" no fim);
//   - o índice de telefones (fones) aponta para o aluno na lista do PR;
//   - a contagem de alunos por colégio e ano (config/paspatur_meta) soma na do PR (config/repasse_meta);
//   - importações, pedidos de exclusão e avisos de edição que falavam da lista paspatur passam a falar do PR.
// Nada de venda muda: valor, pagamento, responsável e histórico vão iguais.
import { entradasFones } from "../js/pedidos.js";

export const SUFIXO = "_pas";
const somaMapa = (a, b) => {
  const r = Object.assign({}, a || {});
  for (const [k, n] of Object.entries(b || {})) r[k] = (Number(r[k]) || 0) + (Number(n) || 0);
  return r;
};

// fontes = { repasseIds: Set|array, paspatur: [{ id, ...dados }], repMeta, pasMeta, importacoes, exclusoes, edicoes }
export function planejarJuncao(fontes) {
  const noPR = new Set(fontes.repasseIds || []);
  const ops = []; // { col, id, tipo: "s" (set) | "m" (set merge) | "u" (update) | "d" (delete), dados }
  const novoId = {}; // id antigo (paspatur) → id na lista do PR
  const repetidos = []; // mesmo ID nas duas listas
  for (const p of fontes.paspatur || []) {
    const { id, ...dados } = p;
    let alvo = id;
    if (noPR.has(alvo)) {
      repetidos.push({ id, nome: dados.nome || "", escola: dados.escola || "", ano: dados.ano || "" });
      alvo = id + SUFIXO;
      for (let i = 2; noPR.has(alvo); i++) alvo = id + SUFIXO + i;
    }
    noPR.add(alvo);
    novoId[id] = alvo;
    ops.push({ col: "repasse", id: alvo, tipo: "s", dados: Object.assign({}, dados, { vendaComo: "paspatur", juntadoDe: "paspatur" }) });
    entradasFones(alvo, dados).forEach(([t, d]) => ops.push({ col: "fones", id: t, tipo: "m", dados: d }));
  }
  // contagem por colégio e ano: soma a do Paspatur na do PR
  const pm = fontes.pasMeta || {};
  const temMeta = Object.keys(pm.escolas || {}).length || Object.keys(pm.anos || {}).length || Object.keys(pm.escolasAno || {}).length;
  if (temMeta) {
    const rm = fontes.repMeta || {};
    ops.push({
      col: "config",
      id: "repasse_meta",
      tipo: "m",
      dados: {
        escolas: somaMapa(rm.escolas, pm.escolas),
        anos: somaMapa(rm.anos, pm.anos),
        escolasAno: somaMapa(rm.escolasAno, pm.escolasAno)
      }
    });
  }
  // registros que apontam para a lista paspatur
  for (const im of fontes.importacoes || [])
    if (im.col === "paspatur" || im.modulo === "paspatur")
      ops.push({
        col: "importacoes",
        id: im.id,
        tipo: "u",
        dados: { col: "repasse", modulo: "repasse", ...(Array.isArray(im.ids) ? { ids: im.ids.map(x => novoId[x] || x) } : {}) }
      });
  for (const ex of fontes.exclusoes || [])
    if (ex.col === "paspatur") {
      const { id, ...dados } = ex;
      const docId = novoId[ex.docId] || ex.docId;
      // o ID do pedido é "<col>_<aluno>": grava com o nome novo e apaga o antigo
      ops.push({ col: "exclusoes", id: `repasse_${docId}`, tipo: "s", dados: Object.assign({}, dados, { col: "repasse", docId }) });
      ops.push({ col: "exclusoes", id, tipo: "d" });
    }
  for (const ed of fontes.edicoes || [])
    if (ed.col === "paspatur")
      ops.push({ col: "edicoes", id: ed.id, tipo: "u", dados: { col: "repasse", alunoId: novoId[ed.alunoId] || ed.alunoId } });
  // por último, tira os alunos da lista antiga
  for (const p of fontes.paspatur || []) ops.push({ col: "paspatur", id: p.id, tipo: "d" });
  if (temMeta) ops.push({ col: "config", id: "paspatur_meta", tipo: "m", dados: { juntadoNoPR: true } });
  return { ops, novoId, repetidos, alunos: (fontes.paspatur || []).length };
}
