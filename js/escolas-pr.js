// PR: as escolas da lista "Escola do lote" e da busca, uma linha por colégio e ANO ("2026 - C.E. João Cardoso"),
// juntando os jeitos diferentes de escrever o mesmo colégio nas planilhas ("C.E C.E JOÃO CARDOSO", "e.e.joao Cardoso").
// meta.escolasAno = { "<escola como veio>|<ano>": quantos } (gravado na importação e na atualização de dados v12).
import { chaveColegio } from "./historico-dados.js";
import { title } from "./ui.js";

// nome para mostrar: o do cadastro de Instituições (quando existe) ou o jeito mais comum da planilha, arrumado
export function nomeDaEscola(variantes, nomeCadastro) {
  if (nomeCadastro) return nomeCadastro;
  const [maisComum] = Object.entries(variantes).sort((a, b) => b[1] - a[1])[0] || [""];
  return title(
    String(maisComum)
      .replace(/^((?:C\.?\s*E\.?|E\.?\s*E\.?)\s*)+/i, m => (/^E/i.test(m) ? "E.E. " : "C.E. "))
      .replace(/\s+/g, " ")
      .trim()
  );
}

// grupos = [{ valor: "2026|JOAO CARDOSO", ano, chave, rotulo, n, nomes: [...] }], do ano mais recente ao mais antigo
// cadastro = { chave: nome no cadastro }; filtroAno(ano) = quais anos entram (Linha de Frente: este ano; Repasse: os anteriores)
export function gruposEscolas(meta, cadastro = {}, filtroAno = () => true) {
  const m = new Map();
  for (const [k, n] of Object.entries((meta && meta.escolasAno) || {})) {
    const i = k.lastIndexOf("|");
    const escola = k.slice(0, i),
      ano = Number(k.slice(i + 1));
    if (!escola || !ano || !filtroAno(ano)) continue;
    const chave = chaveColegio(escola) || escola.toUpperCase();
    const id = ano + "|" + chave;
    const g = m.get(id) || { valor: id, ano, chave, n: 0, variantes: {} };
    g.n += Number(n) || 0;
    g.variantes[escola] = (g.variantes[escola] || 0) + (Number(n) || 0);
    m.set(id, g);
  }
  return [...m.values()]
    .map(g => {
      const nome = nomeDaEscola(g.variantes, cadastro[g.chave]);
      return { valor: g.valor, ano: g.ano, chave: g.chave, n: g.n, nome, rotulo: `${g.ano} - ${nome}`, nomes: Object.keys(g.variantes) };
    })
    .sort((a, b) => b.ano - a.ano || a.nome.localeCompare(b.nome, "pt-BR"));
}
// o que foi escolhido na lista: { ano, nomes } (nomes = como está gravado nos alunos, até 30 para a consulta)
export function escolhaDe(valor, grupos) {
  const g = (grupos || []).find(x => x.valor === valor);
  return g ? { ano: g.ano, nomes: g.nomes.slice(0, 30), rotulo: g.rotulo } : null;
}
// conta por "escola|ano" (para gravar em meta.escolasAno)
export function contarEscolasAno(alunos) {
  const c = {};
  for (const a of alunos) if (a && a.escola && a.ano) c[a.escola + "|" + a.ano] = (c[a.escola + "|" + a.ano] || 0) + 1;
  return c;
}
