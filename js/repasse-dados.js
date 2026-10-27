// PR: dados puros (sem tela): normalização, identificador do documento, leitura das linhas da planilha
// e o que falta para um aluno entrar na fila. Testado em tests/repasse-dados.test.mjs.
import * as U from "./util.js";
import { title } from "./ui.js";

export const norm = U.chave,
  slug = U.slug;

// O que não pode faltar para entrar na fila: colégio, ano, aluno, nome de um responsável e 1 telefone.
export function faltando(d) {
  const f = [];
  if (!String(d.escola || "").trim()) f.push("colégio");
  if (!d.ano) f.push("ano");
  if (!String(d.nome || "").trim()) f.push("nome do aluno");
  const cs = d.contatos || [];
  if (!cs.some(c => c.tipo !== "Formando" && String(c.nome || "").trim()) && !String(d.responsavel || "").trim()) f.push("responsável");
  if (!cs.length) f.push("telefone");
  return f;
}

export const MAPA = {
  ESCOLAFAC: "escola",
  ESCOLA: "escola",
  CURSO: "curso",
  TURMA: "turma",
  STATUS: "status",
  VENDEDOR: "vendedor",
  ID: "codigo",
  FORMANDO: "nome",
  DATA: "data",
  CELULAR1: "c1",
  CEL1: "c1",
  CEL2MAE: "c2",
  CELULAR2MAE: "c2",
  CEL3PAI: "c3",
  CELULAR3PAI: "c3",
  TELEFONE4: "c4",
  TEL4: "c4",
  EMAIL: "email",
  PAGAMENTO: "pagamento",
  FOTOS: "fotos",
  RUA: "rua",
  N: "numero",
  NO: "numero",
  NUMERO: "numero",
  COMPLEMENTO: "complemento",
  BAIRRO: "bairro",
  CIDADE: "cidade",
  OBS: "obs",
  OBSERVACAO: "obs",
  OBSERVACOES: "obs"
};
export const hkey = h =>
  String(h || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export function parseTel(v, tipo) {
  if (v == null || v === "") return null;
  const raw = String(v);
  let d = raw.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length < 10 || d.length > 11) return null;
  const nm = (raw.match(/\(([^)]+)\)/) || [])[1] || raw.replace(/[\d()+\-./]/g, "").trim();
  return { tipo, nome: nm && /\p{L}/u.test(nm) ? nm.trim() : "", tel: d };
}
export function parseData(v, X) {
  if (!v) return "";
  if (v instanceof Date && !isNaN(v)) return U.ds(v);
  if (typeof v === "number") {
    const p = X.SSF.parse_date_code(v);
    return p ? `${p.y}-${U.pad(p.m)}-${U.pad(p.d)}` : "";
  }
  const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${U.pad(m[2])}-${U.pad(m[1])}`;
  }
  return "";
}
export function linhaParaDoc(r, X) {
  const dataEnsaio = parseData(r.data, X);
  const ano = dataEnsaio ? Number(dataEnsaio.slice(0, 4)) : null;
  const contatos = [parseTel(r.c2, "Mãe"), parseTel(r.c3, "Pai"), parseTel(r.c1, "Formando"), parseTel(r.c4, "Telefone")].filter(Boolean);
  const vistos = new Set();
  const cs = contatos.filter(c => !vistos.has(c.tel) && vistos.add(c.tel));
  const s = v => (v == null ? "" : String(v).trim());
  return {
    nome: s(r.nome),
    nomeBusca: norm(r.nome),
    escola: s(r.escola),
    curso: s(r.curso),
    turma: s(r.turma),
    statusOrig: s(r.status),
    vendedor: s(r.vendedor),
    codigo: s(r.codigo),
    dataEnsaio,
    ano,
    contatos: cs,
    telefones: cs.map(c => c.tel),
    email: s(r.email).toLowerCase(),
    pagamentoOrig: s(r.pagamento),
    fotosOrig: s(r.fotos),
    endereco: { rua: s(r.rua), numero: s(r.numero), complemento: s(r.complemento), bairro: s(r.bairro), cidade: s(r.cidade) },
    obs: s(r.obs)
  };
}
export function docId(d, i) {
  return [
    String(9999 - (d.ano || 0)).padStart(4, "0"),
    slug(d.escola).slice(0, 24) || "sem-escola",
    slug(d.codigo).slice(0, 24) || "x",
    slug(d.nome).slice(0, 32) || "r" + i
  ].join("_");
}

// Texto da situação no cartão do PR (s = status do contato: "late", "today", "later" ou "none")
export function situacaoTxt(it, s) {
  const ABERTAS = ["SEPARADO", "CONTATADO", "INTERESSADO"];
  const dia = d => (d ? d.slice(8, 10) + "/" + d.slice(5, 7) : "");
  if (ABERTAS.includes(it.etapa))
    return it.followup
      ? s === "late"
        ? "Atrasado desde " + dia(it.followup)
        : s === "today"
          ? "Contato para hoje"
          : "Próximo contato: " + dia(it.followup)
      : "Sem data de contato";
  if (it.etapa === "PAGO") {
    const ret = (it.entregaTipo || "").startsWith("Retirada"),
      comb = !it.entregaTipo || it.entregaTipo.startsWith("A combinar"),
      pago = "Pago" + (it.pagoEm ? " em " + dia(it.pagoEm) : "");
    if (comb) return pago + " · ⚠️ falta combinar entrega ou retirada";
    return (
      pago +
      (ret ? " · retirada no estúdio" : " · entrega em casa") +
      (it.entregaData ? " em " + dia(it.entregaData) : " · data a combinar") +
      (!ret && !it.enderecoConfirmado ? " · ⚠️ endereço não confirmado" : "")
    );
  }
  if (it.etapa === "ENTREGUE") return "Entregue" + (it.entregueEm ? " em " + dia(it.entregueEm) : "");
  return it.etapa === "NA FILA" ? "Ainda na fila" : it.etapa === "INCOMPLETO" ? "Fora da fila até completar" : "Encerrado";
}
// Endereço de entrega numa linha (só quando pagou e vai receber em casa)
export function enderecoTxt(it) {
  if (it.etapa !== "PAGO" || !(it.entregaTipo || "").startsWith("Entrega")) return "";
  const a = it.endereco || {},
    t = title;
  return [a.rua && t(a.rua) + (a.numero ? ", " + a.numero : ""), a.complemento && t(a.complemento), t(a.bairro), t(a.cidade)]
    .filter(Boolean)
    .join(" · ");
}
