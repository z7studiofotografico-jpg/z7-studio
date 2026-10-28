// Cadastro dos colégios que vieram das planilhas (marcados com cadastroPendente): o representante completa
// contato com telefone, número de alunos e endereço. Enquanto faltar algo, aparece o aviso na tela dele e
// o Adriano recebe o resumo às 19h (scripts/pendencias.mjs). Sem tela aqui: usado no app e no script.
const digitos = v => String(v || "").replace(/\D/g, "");

// O que falta no cadastro (lista vazia = completo)
export function cadastroFalta(it) {
  const f = [];
  if (!(it.contatos || []).some(c => digitos(c && c.tel).length >= 10)) f.push("contato com telefone");
  if (!(Number(it.mediaAlunos) > 0)) f.push("nº de alunos");
  if (!String((it.endereco || {}).rua || "").trim()) f.push("endereço");
  return f;
}
// Colégio marcado para completar e que ainda não está completo
export const cadastroPendente = it => !!(it && it.cadastroPendente) && cadastroFalta(it).length > 0;

// Tipo pelo nome (combinado em 28/10/2026): colégio de 3º ano é CIEP ou C.E.; de 9º ano é E.M.
export function segmentoPeloNome(nome) {
  const n = String(nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  if (/\bE\.?\s*M\.?(?=\s)|\bGET\b|ESCOLA MUNICIPAL/.test(n)) return "ano9";
  if (/\bCIEP\b|\bC\.?\s*E\.?(?=\s)|COLEGIO ESTADUAL|\bE\.?\s*E\.?(?=\s)/.test(n)) return "medio";
  return "";
}
