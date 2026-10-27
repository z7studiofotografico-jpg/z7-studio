// WhatsApp de trabalho.
// - Empresa (Adriano e Luciana): um número para cada frente, em Ajustes: Funil, PR Linha de Frente, PR Repasse e
//   cobrança das formaturas. O app mostra em cada tela qual WhatsApp usar.
// - Equipe: cada representante trabalha com os PRÓPRIOS números (até 3), cadastrados junto com a pessoa em Equipe.
//   Ninguém usa número da empresa nem o de outra pessoa: assim se sabe quem fez cada contato.
// - Em cada tela há o seletor "📱 Use o WhatsApp ▾": vem no número pré-definido e dá para trocar por outro já liberado
//   (ex.: o cliente bloqueou). A escolha fica guardada neste aparelho até trocar de novo.
//   Trocar depois: a pessoa pede em Ajustes; o Adriano ou a Luciana autorizam; ela recebe o aviso no app.
// Coleções: usuarios/{e-mail}.numeros = números liberados; numeros/{e-mail} = pedido de troca
//   { numeros, status: "pendente" | "aprovado" | "recusado", pedidoEm, nome, decididoEm, decididoPor, visto }
import { avisoTel } from "./aluno-id.js";

export const MAX_NUMEROS = 3;
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
// admin = true: a pessoa é admin (pode usar os números da empresa)
export function conferirNumeros(lista, P, outros, admin) {
  const vistos = new Set(),
    numeros = [];
  for (const t of lista || []) {
    if (!String(t || "").trim()) continue;
    const d = normTel(t);
    const a = avisoTel(d);
    if (a && !/fixo/.test(a)) return { numeros, erro: `${fmtTel(t)}: ${a}.` };
    if (!admin && numerosEmpresa(P).includes(d))
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
// (para quem é admin, os outros admins não contam: Adriano e Luciana podem ter os mesmos números da empresa)
export function numerosDosOutros(usuarios, email, admin) {
  const o = {};
  Object.entries(usuarios || {}).forEach(([em, u]) => {
    if (em === email || !u || u.ativo === false || (admin && u.papel === "admin")) return;
    numerosDe(u).forEach(n => (o[n] = u.nome || em));
  });
  return o;
}
// Os WhatsApp que esta pessoa pode usar nesta frente, o pré-definido primeiro:
// admin = o número da empresa daquela frente, os outros números da empresa e os próprios; equipe = os próprios (até 3)
export function opcoesWhats(C, frente) {
  const meus = numerosDe((C.usuarios || {})[C.email]);
  const lista = C.isAdmin ? [numeroEmpresa(C.P, frente), ...numerosEmpresa(C.P), ...meus] : meus;
  return [...new Set(lista.filter(Boolean))];
}
// O número em uso: o que a pessoa escolheu (se ainda é dela) ou o pré-definido
export const escolhido = (opcoes, guardado) => (opcoes.includes(normTel(guardado)) ? normTel(guardado) : opcoes[0] || "");
