// Acertar os IDs e os nomes dos colégios do PR (09/11/2026). Pedido da Luciana:
//   - a sigla perdia o E de C.E. / E.M. (26CNB-02 → 26CENBJ-02, 25MAN-01 → 25EMAN-01);
//   - IDs antigos sem o ano ("EMCM 73", "CERF 52") ganham o ano do aluno (23EMCM-73, 23CERF-52);
//   - o nome do colégio fica o do cadastro de Instituições ("C.E. Nuta Bartlet" → "C.E. Nuta Bartlet James").
// O número do aluno não muda (as fotos no Drive são achadas pelo nome e pelo número). Sem tela: roda no GitHub
// (Actions → "Acertar IDs dos colégios") e é testado em tests/acertar-ids.test.mjs. Pode rodar de novo.
import { fmtCodigo, codigoBusca } from "../js/aluno-id.js";
import { nomeDoColegio, siglaDoColegio } from "../js/colegio-nome.js";

// número do aluno no ID ("26CNB-02", "EMCM 73", "25CM-01", "7"); null se não tiver
export const numeroDoId = c => {
  const m = String(c || "")
    .trim()
    .match(/^(?:\d{2})?(?:[A-Za-z][A-Za-z0-9]*)?\s*-?\s*(\d{1,4})$/);
  return m ? Number(m[1]) : null;
};

// alunos = [{ id, escola, ano, codigo, escolaOrig? }]; insts = [{ nome, sigla }]; contadores = { "26CENBJ": ultimo }
// apelidos = { "nome antigo": "nome do cadastro" } (o que a Luciana disse que é o mesmo colégio)
export function planejarIds(alunos, insts, contadores = {}, apelidos = {}) {
  const ops = [];
  const grupos = {}; // "escola antiga|nova|ano" → { de, para, ano, siglaDe, siglaPara, n }
  const maior = {}; // "26CENBJ" → maior número
  const meta = { escolas: {}, anos: {}, escolasAno: {} };
  for (const a of alunos) {
    const escola = String(a.escola || "").trim();
    const base = apelidos[escola] || escola;
    const nova = nomeDoColegio(base, insts);
    const sig = siglaDoColegio(base, insts);
    const n = numeroDoId(a.codigo);
    const ano = Number(a.ano) || 0;
    const codigo = n != null && sig && ano ? fmtCodigo(ano, sig, n) : a.codigo || "";
    const patch = {};
    if (nova && nova !== escola) {
      patch.escola = nova;
      if (!a.escolaOrig) patch.escolaOrig = escola; // a importação acha o aluno pelo nome que veio da planilha
    }
    if (codigo && codigo !== a.codigo) Object.assign(patch, { codigo, codigoBusca: codigoBusca(codigo), codigoAntigo: a.codigo || "" });
    if (Object.keys(patch).length) {
      ops.push({ col: "repasse", id: a.id, tipo: "u", dados: patch });
      const sigAntiga = (String(a.codigo || "").match(/^(?:\d{2})?([A-Za-z]+)/) || [])[1] || "—";
      const k = `${escola}|${nova}|${ano}`;
      const g = (grupos[k] = grupos[k] || { de: escola, para: nova, ano, siglaDe: sigAntiga.toUpperCase(), siglaPara: sig, n: 0 });
      g.n++;
    }
    if (n != null && sig && ano) {
      const c = String(ano).slice(-2) + sig;
      maior[c] = Math.max(maior[c] || 0, n);
    }
    // contagem por colégio e ano, com o nome novo (igual ao "Acertar a lista")
    const e = nova || escola;
    if (e && ano) {
      meta.escolasAno[`${e}|${ano}`] = (meta.escolasAno[`${e}|${ano}`] || 0) + 1;
      meta.escolas[e] = (meta.escolas[e] || 0) + 1;
      meta.anos[ano] = (meta.anos[ano] || 0) + 1;
    }
  }
  // o próximo aluno incluído à mão continua a numeração da sigla nova
  for (const [c, n] of Object.entries(maior))
    if (n > (Number(contadores[c]) || 0)) ops.push({ col: "ids", id: c, tipo: "m", dados: { ultimo: n } });
  if (ops.some(o => o.col === "repasse")) ops.push({ col: "config", id: "repasse_meta", tipo: "m", dados: meta });
  return { ops, grupos: Object.values(grupos), alunos: ops.filter(o => o.col === "repasse").length };
}
