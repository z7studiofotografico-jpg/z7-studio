// "Quem paga o PR" no cadastro do colégio (só admin): cada aluno (normal) ou o colégio.
// Colégio paga: o aluno do PR daquele colégio (ano atual em diante) entra direto como vendido (pago, para produzir
// e entregar no colégio): não vai para a fila, não tem valor por aluno (o colégio paga o contrato) e não gera comissão.
import { chaveColegio } from "./historico-dados.js";
import { gruposEscolas } from "./escolas-pr.js";

export const QUEM_PAGA = [
  ["aluno", "Cada aluno"],
  ["colegio", "O colégio"]
];
// os campos do aluno vendido pelo colégio
export function vendidoPeloColegio(hoje, email) {
  return {
    etapa: "PAGO",
    pagoEm: hoje,
    valor: 0,
    formaPag: "Colégio",
    colegioPaga: true,
    conferido: true,
    conferidoPor: email || "",
    conferidoEm: hoje,
    entregaTipo: "Entrega no colégio",
    followup: null,
    atendendo: null,
    resp: "",
    respEmail: ""
  };
}
// já comprou ou já está vendido: não muda
const JA = ["PAGO", "ENTREGUE"];
export const passaParaVendido = it => !JA.includes(it.etapa) && !it.historico;

// chaves (nome do colégio sem pontuação/abreviação) dos colégios em que o colégio paga
export async function colegiosQuePagam(FS, db) {
  const s = await FS.getDocs(FS.query(FS.collection(db, "instituicoes"), FS.where("quemPaga", "==", "colegio"), FS.limit(500)));
  return new Set(s.docs.map(d => chaveColegio(d.data().nome || "")).filter(Boolean));
}
// o colégio do aluno está entre os que pagam? (mesma regra de nome parecido)
export function colegioPaga(chaves, escola) {
  const k = chaveColegio(escola || "");
  if (!k) return false;
  for (const c of chaves) if (c === k || k.startsWith(c + " ") || c.startsWith(k + " ")) return true;
  return false;
}

// alunos do PR do colégio (ano escolhido) que ainda não estão vendidos
export async function alunosDoColegioParaVendido(FS, db, nomeColegio, ano) {
  const k = chaveColegio(nomeColegio);
  const meta = (await FS.getDoc(FS.doc(db, "config", "repasse_meta"))).data() || {};
  // mesmo colégio: chave igual, ou uma é o começo da outra ("C E YONNE MARIA SIQUEIRA" e "… SIQUEIRA DE ANDRADE")
  const mesmo = c => !!k && !!c && (c === k || k.startsWith(c + " ") || c.startsWith(k + " "));
  const nomes = gruposEscolas(meta)
    .filter(x => x.ano === ano && mesmo(x.chave))
    .flatMap(x => x.nomes);
  const out = [];
  for (let i = 0; i < nomes.length; i += 30) {
    const s = await FS.getDocs(
      FS.query(FS.collection(db, "repasse"), FS.where("escola", "in", nomes.slice(i, i + 30)), FS.where("ano", "==", ano))
    );
    s.forEach(d => out.push(Object.assign({ id: d.id }, d.data())));
  }
  return out.filter(passaParaVendido);
}

// grava em lotes de 400 (limite do Firebase é 500 por lote)
export async function passarParaVendido(FS, db, alunos, hoje, email) {
  const campos = vendidoPeloColegio(hoje, email);
  for (let i = 0; i < alunos.length; i += 400) {
    const b = FS.writeBatch(db);
    alunos.slice(i, i + 400).forEach(a => b.update(FS.doc(db, "repasse", a.id), Object.assign({}, campos, { atualizadoEm: new Date().toISOString() })));
    await b.commit();
  }
  return alunos.length;
}
