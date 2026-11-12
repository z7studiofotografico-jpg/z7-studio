// Cadastrar aluno (11/11/2026): as regras da tela única, sem tela (testadas em tests/cadastro-regras.test.mjs).
// - o colégio vem do cadastro de Instituições (nunca digitado solto);
// - o ID é ano + sigla do colégio + o número do aluno na escola (26CENBJ-02), e o número é obrigatório;
// - o mesmo aluno (mesmo ID) em vários módulos (becas, PR/Paspatur, Formatura) é um aluno só.
import { siglaDe, fmtCodigo, codigoBusca } from "./aluno-id.js";
import { chave } from "./util.js";

export const siglaDoColegio = inst => String((inst && (inst.sigla || siglaDe(inst.nome || ""))) || "").toUpperCase();
// "26CENBJ-" (o começo do ID, que o app preenche)
export const prefixoId = (ano, inst) => `${String(ano || "").slice(-2)}${siglaDoColegio(inst)}-`;
// número digitado → ID completo; "" se o número não vale
export function idDoAluno(ano, inst, numero) {
  const n = parseInt(String(numero || "").replace(/\D/g, ""), 10);
  const sigla = siglaDoColegio(inst);
  if (!sigla || !n || n < 1 || n > 9999) return "";
  return fmtCodigo(Number(ano), sigla, n);
}

// O que falta para salvar (lista de textos; vazia = pode salvar)
export function faltaParaSalvar(f) {
  const out = [];
  if (!f.inst) out.push("o colégio (cadastrado em Instituições)");
  if (!f.ano || f.ano < 2015 || f.ano > new Date().getFullYear() + 2) out.push("o ano");
  if (!f.codigo) out.push("o número do ID do aluno");
  if (!String(f.nome || "").trim()) out.push("o nome do aluno");
  if (!f.modulos || !f.modulos.length) out.push("o que o aluno contratou");
  if (f.modulos && f.modulos.includes("becas") && !f.becaTipo) out.push("a beca");
  return out;
}

// Achados com o mesmo ID ou nome parecido: [{ modulo, id, nome, codigo, escola, ano, tel }]
// → { mesmoAluno: [...] (mesmo ID e mesmo nome), idDeOutro: {...} (o ID já é de outro nome), parecidos: [...] }
export function conferirRepetido(f, achados) {
  const cb = f.codigo ? codigoBusca(f.codigo) : "";
  const nome = chave(f.nome || "");
  const mesmoId = achados.filter(a => cb && a.codigo && codigoBusca(a.codigo) === cb);
  const mesmoAluno = mesmoId.filter(a => !nome || chave(a.nome) === nome || mesmoNomeCurto(a.nome, f.nome));
  const idDeOutro = nome ? mesmoId.find(a => !mesmoAluno.includes(a)) || null : null;
  const parecidos = achados.filter(a => !mesmoId.includes(a) && nome && chave(a.nome) === nome && Number(a.ano) === Number(f.ano));
  return { mesmoAluno, idDeOutro, parecidos };
}
// "MARIA SILVA" e "Maria da Silva Santos": primeiro e último nome iguais
function mesmoNomeCurto(a, b) {
  const p = s =>
    chave(s)
      .split(/\s+/)
      .filter(w => w.length > 2);
  const x = p(a),
    y = p(b);
  return !!(x.length && y.length && x[0] === y[0] && x[x.length - 1] === y[y.length - 1]);
}
export const NOMES_MODULO = { becas: "Aluguel de becas", pr: "PR", paspatur: "Paspatur", formatura: "Formatura" };
// o módulo de um aluno do PR (Kit Quadro ou Kit Paspatur)
export const moduloPR = d => (d && d.vendaComo === "paspatur" ? "paspatur" : "pr");

// Planilha de backup: linhas com os campos de cada aluno (tudo texto, para colar no Drive)
export function linhasPlanilha(lista, campos) {
  return [campos.map(([, t]) => t), ...lista.map(x => campos.map(([k]) => valorCampo(x, k)))];
}
// contatos em colunas separadas: "c:Mãe:nome", "c:Mãe:tel" (Formando = o aluno; o 1º de cada tipo)
const contatoDe = (x, tipo) => {
  const cs = Array.isArray(x.contatos) ? x.contatos : [];
  const c = cs.find(y => y && y.tipo === tipo);
  if (c) return c;
  // aluguel antigo: só o WhatsApp e o responsável
  if (tipo === "Formando" && !cs.length && x.tel) return { nome: x.nome, tel: x.tel };
  if (tipo === "Responsável" && !cs.length && x.responsavel) return { nome: x.responsavel, tel: "" };
  return null;
};
export const COLUNAS_CONTATOS = ["Mãe", "Pai", "Formando", "Responsável"].flatMap(t => [
  [`c:${t}:nome`, t === "Formando" ? "Aluno (contato)" : t],
  [`c:${t}:tel`, "Telefone " + (t === "Formando" ? "do aluno" : t === "Mãe" ? "da mãe" : t === "Pai" ? "do pai" : "do responsável")]
]);
function valorCampo(x, k) {
  if (k.startsWith("c:")) {
    const [, tipo, campo] = k.split(":");
    const c = contatoDe(x, tipo);
    return c ? c[campo] || "" : "";
  }
  if (k === "vendaComo") return x.vendaComo === "paspatur" ? "Paspatur" : "PR";
  const v = k.split(".").reduce((o, p) => (o && o[p] != null ? o[p] : ""), x);
  if (Array.isArray(v)) return v.map(y => (y && typeof y === "object" ? [y.tipo, y.nome, y.tel].filter(Boolean).join(" ") : y)).join("; ");
  if (v && typeof v === "object") return JSON.stringify(v);
  return v;
}
