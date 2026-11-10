// Nome certo do colégio pelo cadastro de Instituições (09/11/2026). Na importação e na correção dos IDs, o nome que
// veio da planilha ("C.E NUTA BARTLET") é trocado pelo do cadastro ("C.E. Nuta Bartlet James"), senão o mesmo
// colégio vira dois, com IDs diferentes, e o aluno não bate com a instituição.
// Bate quando as palavras do nome da planilha aparecem, na mesma ordem, no nome do cadastro (sem C.E., E.M.,
// Professor, de, da…) e o tipo não briga (estadual × municipal). Só troca quando há um único colégio que bate.
// Sem tela: testado em tests/colegio-nome.test.mjs.
import { chaveColegio } from "./historico-dados.js";
import { siglaDe } from "./aluno-id.js";

const pal = n => chaveColegio(n).split(" ").filter(Boolean);
// estadual (CE…) ou municipal (EM…) pela abreviação do começo; "" quando o nome não diz
const rede = n => {
  const s = siglaDe(n);
  return /^CE/.test(s) ? "e" : /^EM/.test(s) ? "m" : "";
};
const emOrdem = (a, b) => {
  let j = 0;
  for (const w of b) if (j < a.length && w === a[j]) j++;
  return j === a.length;
};
// insts = [{ nome, sigla? }]; devolve a instituição do cadastro ou null
export function colegioNoCadastro(nome, insts) {
  const p = pal(nome);
  if (!p.length) return null;
  const r = rede(nome);
  const lista = (insts || []).filter(i => i && i.nome);
  const iguais = lista.filter(i => chaveColegio(i.nome) === p.join(" ") && (!r || !rede(i.nome) || rede(i.nome) === r));
  if (iguais.length === 1) return iguais[0];
  if (iguais.length > 1) return null;
  // nome mais curto que o do cadastro: precisa de pelo menos 2 palavras (ou o CIEP com número)
  if (p.length < 2 && !/^CIEP \d+$/.test(p.join(" "))) return null;
  const batem = lista.filter(i => {
    const q = pal(i.nome);
    return q.length > p.length && emOrdem(p, q) && (!r || !rede(i.nome) || rede(i.nome) === r);
  });
  return batem.length === 1 ? batem[0] : null;
}
// sigla do colégio: a do cadastro (se a Luciana escolheu uma) ou a das iniciais do nome certo
export const siglaDoColegio = (nome, insts) => {
  const i = colegioNoCadastro(nome, insts);
  return (i && i.sigla) || siglaDe(i ? i.nome : nome);
};
// nome certo (o do cadastro) ou o mesmo nome
export const nomeDoColegio = (nome, insts) => {
  const i = colegioNoCadastro(nome, insts);
  return i ? i.nome : String(nome || "").trim();
};
