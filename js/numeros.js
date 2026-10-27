// WhatsApp de trabalho.
// - Empresa (Adriano e Luciana): um número para cada frente, em Ajustes: Funil, PR Linha de Frente, PR Repasse e
//   cobrança das formaturas. O app mostra em cada tela qual WhatsApp usar.
// - Equipe: cada representante trabalha com os PRÓPRIOS números (até 4), cadastrados junto com a pessoa em Equipe.
//   Ninguém usa número da empresa nem o de outra pessoa: assim se sabe quem fez cada contato.
//   Trocar depois: a pessoa pede em Ajustes; o Adriano ou a Luciana autorizam; ela recebe o aviso no app.
// Coleções: usuarios/{e-mail}.numeros = números liberados; numeros/{e-mail} = pedido de troca
//   { numeros, status: "pendente" | "aprovado" | "recusado", pedidoEm, nome, decididoEm, decididoPor, visto }
import { avisoTel } from "./aluno-id.js";

export const MAX_NUMEROS = 4;
// Números da empresa que já vêm preenchidos em Ajustes (o admin pode trocar)
export const EMPRESA_PADRAO = { funilNumero: "21998817771", cobrancaNumero: "21997597605" };
export const FRENTES = {
  funil: { chave: "funilNumero", nome: "Funil de vendas" },
  lf: { chave: "lfNumero", nome: "PR · Linha de Frente" },
  rep: { chave: "repNumero", nome: "PR · Repasse" },
  cobranca: { chave: "cobrancaNumero", nome: "Cobrança das formaturas" }
};

// Só os dígitos, com DDD e sem o 55 (sem DDD, é do Rio: 21)
export function normTel(t) {
  let d = String(t || "").replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(d)) d = d.slice(2);
  if (d.length === 8 || d.length === 9) d = "21" + d;
  return d;
}
export function fmtTel(t) {
  const d = normTel(t);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(t || "");
}
export const numeroEmpresa = (P, frente) => {
  const k = (FRENTES[frente] || {}).chave;
  return normTel((P || {})[k] || EMPRESA_PADRAO[k] || "");
};
export const numerosEmpresa = P =>
  Object.keys(FRENTES)
    .map(f => numeroEmpresa(P, f))
    .filter(Boolean);
// Números liberados de uma pessoa
export const numerosDe = u => ((u && u.numeros) || []).map(normTel).filter(Boolean);

// Confere a lista de números de uma pessoa: devolve { numeros (normalizados, sem repetir), erro }.
// Bloqueia número da empresa e número que já é de outra pessoa (cada um com o seu).
// outros = { "21999998888": "Ana Vendedora", ... } (os números das outras pessoas)
export function conferirNumeros(lista, P, outros) {
  const vistos = new Set(),
    numeros = [];
  for (const t of lista || []) {
    if (!String(t || "").trim()) continue;
    const d = normTel(t);
    const a = avisoTel(d);
    if (a && !/fixo/.test(a)) return { numeros, erro: `${fmtTel(t)}: ${a}.` };
    if (numerosEmpresa(P).includes(d))
      return { numeros, erro: `${fmtTel(d)} é número da empresa (Adriano e Luciana). Use o seu número de trabalho.` };
    if ((outros || {})[d]) return { numeros, erro: `${fmtTel(d)} já é de ${outros[d]}. Cada pessoa trabalha com o próprio número.` };
    if (!vistos.has(d)) {
      vistos.add(d);
      numeros.push(d);
    }
  }
  if (numeros.length > MAX_NUMEROS) return { numeros, erro: `No máximo ${MAX_NUMEROS} números por pessoa.` };
  return { numeros, erro: "" };
}
// Os números das outras pessoas (para não repetir), a partir dos cadastros
export function numerosDosOutros(usuarios, email) {
  const o = {};
  Object.entries(usuarios || {}).forEach(([em, u]) => {
    if (em === email || !u || u.ativo === false) return;
    numerosDe(u).forEach(n => (o[n] = u.nome || em));
  });
  return o;
}
// Qual WhatsApp usar nesta frente: admin = o da empresa; equipe = os próprios
export function whatsDaVez(C, frente) {
  if (C.isAdmin) {
    const n = numeroEmpresa(C.P, frente);
    return n ? [n] : [];
  }
  return numerosDe((C.usuarios || {})[C.email]);
}
export function textoUse(C, frente) {
  const ns = whatsDaVez(C, frente);
  if (C.isAdmin) return ns.length ? `📱 Use o WhatsApp da empresa ${fmtTel(ns[0])}` : "";
  if (!ns.length) return "⚠️ Você ainda não tem WhatsApp de trabalho liberado. Peça em ⚙️ Ajustes → Meus WhatsApp de trabalho.";
  return `📱 Use o seu WhatsApp de trabalho: ${ns.map(fmtTel).join(" ou ")}`;
}
