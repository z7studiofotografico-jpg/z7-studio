// Contrato do colégio (Aluguel de becas → Alunos dos colégios): regras sem tela, usadas pelo app e pelos testes.
// Coleção "contratosColegio", um documento por colégio e ano (id = instId_ano):
// { instId, instNome, ano, unidade, respEmail, respNome (quem fechou), quemPaga: "colegio" | "alunos",
//   recebePadrao: "estudio" | "colegio" | "representante", precos: { beca, paspatur, certificado, canudo } (preço de cada
//   item; o valor do aluno é a soma dos itens do pacote dele), valor (total, quando o colégio paga tudo), parcelas,
//   contato: { nome, cargo, tel }, entrega: { data, com }, pacotePadrao: [itens], obs, historico: [{ o, em, por }] }
// Pagamentos em contratosColegio/{id}/pagamentos, um documento por pagamento:
// { alunoId, alunoNome, valor, data, recebidoPor, forma, comprovante, comprovanteOk, repasseAvisadoEm, repassadoEm,
//   repassadoPor, conferido, por, porEmail, criadoEm, historico, itens: { item: preço } (o que o pagamento paga) }
// Quem recebeu fica em cada pagamento (o contrato misto se resolve sozinho). Dinheiro com o colégio ou com o
// representante aparece em "Falta repassar" até o repasse. O representante marca que o colégio repassou; o dinheiro
// que está com ele mesmo só o admin confirma. Comissão de quem fechou: item por item (porcentagem de cada item nos
// Ajustes); cada pagamento é dividido entre os itens na proporção dos preços e conta quando está no caixa e foi
// conferido pelo admin, como no PR. Pagamento antigo sem itens usa a taxa do Álbum de formatura.
import { centavos, reais, taxa, formaDe } from "./regras.js";
import { chave } from "./util.js";

export const ITENS_PACOTE = [
  ["beca", "Beca"],
  ["paspatur", "Paspatur"],
  ["certificado", "Certificado"],
  ["canudo", "Canudo"]
];
export const nomeItem = id => (ITENS_PACOTE.find(([k]) => k === id) || [id, id])[1];
export const QUEM_PAGA = [
  ["colegio", "O colégio paga tudo"],
  ["alunos", "Cada aluno paga"]
];
export const RECEBE = [
  ["estudio", "Estúdio"],
  ["colegio", "Contato do colégio"],
  ["representante", "Representante"]
];
export const CARGOS = ["Diretor(a)", "Coordenador(a)", "Secretaria", "Comercial", "Outro"];
export const FORMAS_CONTRATO = ["Dinheiro", "Pix", "Link", "Cartão", "Boleto"];

export const idContrato = (instId, ano) => `${instId}_${ano}`;

// "BECA + PASPATUR + CANUDO + CERTIFICADO", "paspatur, canudo", "beca/certificado" → itens na ordem da lista.
// Célula vazia → [] (o aluno fica com o pacote padrão do contrato). Palavra que não é item fica de fora.
export function lerPacote(v) {
  if (Array.isArray(v)) return ITENS_PACOTE.map(([k]) => k).filter(k => v.includes(k));
  const partes = chave(v)
    .toLowerCase()
    .split(/[+,;/]|\be\b/)
    .map(s => s.trim())
    .filter(Boolean);
  const achou = new Set();
  partes.forEach(p => {
    if (/^beca/.test(p)) achou.add("beca");
    else if (/^pasp/.test(p)) achou.add("paspatur");
    else if (/^certif/.test(p)) achou.add("certificado");
    else if (/^canud/.test(p)) achou.add("canudo");
  });
  return ITENS_PACOTE.map(([k]) => k).filter(k => achou.has(k));
}
export const textoPacote = itens => (itens || []).map(nomeItem).join(" + ");

// Pacote do aluno: o dele (se tiver) ou o padrão do contrato
export function pacoteDoAluno(a, contrato) {
  const proprio = lerPacote((a && a.pacote) || []);
  if (proprio.length) return { itens: proprio, padrao: false };
  return { itens: lerPacote((contrato && contrato.pacotePadrao) || []), padrao: true };
}

// Preço do pacote de um aluno (soma dos itens); 0 quando o contrato não tem preço por item
export function precoAluno(a, contrato) {
  const pr = (contrato && contrato.precos) || {};
  return reais(pacoteDoAluno(a, contrato).itens.reduce((t, k) => t + centavos(pr[k] || 0), 0));
}
// O que um pagamento paga, item por item ({ item: preço }): do aluno, ou de todos quando o colégio paga
export function itensDoPagamento(aluno, contrato, alunos) {
  const pr = (contrato && contrato.precos) || {};
  const lista = aluno ? [aluno] : alunos || [];
  const out = {};
  lista.forEach(a =>
    pacoteDoAluno(a, contrato).itens.forEach(k => {
      if (centavos(pr[k])) out[k] = reais(centavos(out[k] || 0) + centavos(pr[k]));
    })
  );
  return out;
}
// Divide o pagamento entre os itens na proporção dos preços ({ item: centavos }); null sem itens
export function baseItens(p) {
  const it = Object.entries((p && p.itens) || {}).filter(([, v]) => centavos(v) > 0);
  const tot = it.reduce((t, [, v]) => t + centavos(v), 0);
  if (!tot) return null;
  const vc = centavos(p.valor);
  const out = {};
  let usado = 0;
  it.forEach(([k, v], i) => {
    const c = i === it.length - 1 ? vc - usado : Math.round((vc * centavos(v)) / tot);
    out[k] = c;
    usado += c;
  });
  return out;
}
// Comissão de um pagamento, em centavos
export function comissaoPagamento(p, P) {
  const b = baseItens(p);
  if (b) return Object.entries(b).reduce((t, [k, c]) => t + Math.round((c * taxa(P, "contrato", k)) / 100), 0);
  return Math.round((centavos(p.valor) * taxa(P, "form", formaDe(p.forma) || "Dinheiro")) / 100);
}

// Situação de um pagamento: onde o dinheiro está agora
// "caixa" (no estúdio), "colegio" (com o contato do colégio), "representante" (com o representante),
// "avisado" (o representante avisou que repassou, falta o admin confirmar)
export function ondeEsta(p) {
  if (!p) return "caixa";
  if (p.recebidoPor === "colegio") return p.repassadoEm ? "caixa" : "colegio";
  if (p.recebidoPor === "representante") return p.repassadoEm ? "caixa" : p.repasseAvisadoEm ? "avisado" : "representante";
  return "caixa";
}
export function textoOnde(p, contrato) {
  const o = ondeEsta(p);
  const cargo = (contrato && contrato.contato && contrato.contato.cargo) || "colégio";
  if (o === "colegio") return "Com o " + (/^diretor/i.test(cargo) ? "diretor" : cargo.replace(/\(a\)/, "").toLowerCase());
  if (o === "representante") return "Com o representante";
  if (o === "avisado") return "Repasse avisado · falta confirmar";
  return p && p.repassadoEm ? "Repassado" : "No caixa";
}

// Totais do contrato (centavos internos, reais na saída)
export function resumoDinheiro(pags, contrato, alunos, P) {
  const lst = (pags || []).filter(p => p && !p.excluido);
  const soma = f => reais(lst.filter(f).reduce((t, p) => t + centavos(p.valor), 0));
  const caixa = soma(p => ondeEsta(p) === "caixa");
  const comColegio = soma(p => ondeEsta(p) === "colegio");
  const comRep = soma(p => ["representante", "avisado"].includes(ondeEsta(p)));
  const recebido = soma(() => true);
  const c = contrato || {};
  const nAlunos = (alunos || []).length;
  const temPrecos = Object.values(c.precos || {}).some(v => centavos(v));
  const combinado =
    c.quemPaga === "colegio"
      ? Number(c.valor) || 0
      : temPrecos
        ? reais((alunos || []).reduce((t, a) => t + centavos(precoAluno(a, c)), 0))
        : reais(centavos(c.valor) * nAlunos);
  // comissão item por item, sobre o que está no caixa e conferido
  const comissao = reais(lst.filter(p => ondeEsta(p) === "caixa" && p.conferido).reduce((t, p) => t + comissaoPagamento(p, P), 0));
  return {
    recebido,
    caixa,
    comColegio,
    comRep,
    combinado,
    falta: Math.max(0, reais(centavos(combinado) - centavos(recebido))),
    aConferir: lst.filter(p => ondeEsta(p) === "caixa" && !p.conferido).length,
    comissao
  };
}

// Quanto cada aluno já pagou (para a lista do contrato)
export function pagoPorAluno(pags) {
  const m = {};
  (pags || [])
    .filter(p => p && !p.excluido && p.alunoId)
    .forEach(p => (m[p.alunoId] = reais(centavos(m[p.alunoId] || 0) + centavos(p.valor))));
  return m;
}

// Relatório de produção: totais por item e quem precisa de foto (tem paspatur)
export function producao(alunos, contrato) {
  const tot = Object.fromEntries(ITENS_PACOTE.map(([k]) => [k, 0]));
  const linhas = (alunos || [])
    .slice()
    .sort(
      (a, b) =>
        String(a.serie || "").localeCompare(String(b.serie || ""), "pt-BR") ||
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
    )
    .map(a => {
      const { itens, padrao } = pacoteDoAluno(a, contrato);
      itens.forEach(k => tot[k]++);
      return { aluno: a, itens, padrao, foto: itens.includes("paspatur") };
    });
  return { totais: tot, linhas, precisamFoto: linhas.filter(l => l.foto) };
}

// Quem pode mexer: admin, ou o representante que fechou o contrato
export const podeEditar = (C, contrato) => !!C && (C.isAdmin || (!!contrato && !!contrato.respEmail && contrato.respEmail === C.email));
// O representante não muda o valor, as parcelas nem quem fechou; isso é do admin
export const CAMPOS_SO_ADMIN = ["valor", "precos", "parcelas", "respEmail", "respNome", "quemPaga"];
// Pagamento: o representante não confirma o repasse do dinheiro que está com ele, nem confere
export function repPodeMexer(p) {
  if (!p) return true;
  if (p.conferido) return false;
  if (p.recebidoPor === "representante" && p.repassadoEm) return false;
  return true;
}
