// Instituições: tipos, cartões, etapas e as regras puras (sem banco nem tela).
import * as U from "./util.js";
export const TIPOS = {
  particular: { nome: "Colégio particular", ico: "🏫" },
  publico: { nome: "Colégio público", ico: "🏛️" },
  profissionalizante: { nome: "Curso profissionalizante", ico: "🛠️" },
  faculdade: { nome: "Faculdade", ico: "🎓" }
};
// Cartões da tela Instituições: faculdade e curso profissionalizante ficam no mesmo cartão
// (as informações são as mesmas); no cadastro escolhe qual dos dois é.
export const CARTOES = {
  particular: { nome: "Colégio particular", ico: "🏫", tipos: ["particular"] },
  publico: { nome: "Colégio público", ico: "🏛️", tipos: ["publico"] },
  superior: { nome: "Faculdade e curso profissionalizante", ico: "🎓", tipos: ["faculdade", "profissionalizante"] }
};
export const cartaoDoTipo = t => (t === "faculdade" || t === "profissionalizante" ? "superior" : t);
export const semSeries = t => t === "faculdade" || t === "profissionalizante" || t === "superior";
export const ETAPAS = ["A VISITAR", "AGENDAR VISITA", "VISITADO", "PROPOSTA ENVIADA", "FECHADO", "NÃO FECHOU"];
export const ABERTAS = ["A VISITAR", "AGENDAR VISITA", "VISITADO", "PROPOSTA ENVIADA"];
export const CARGOS = ["Direção", "Coordenação", "Secretaria", "Recepção", "Comissão de formatura", "Professor(a)", "Outro"];
export const FOTOGRAFO = ["Não tem fotógrafo", "Só datas comemorativas", "Já tem empresa de formatura", "Não sei"];
export const RESULTADOS = [
  ["Fechou 🎉", "FECHADO"],
  ["Gostou, vai analisar", "VISITADO"],
  ["Vai decidir em reunião", "VISITADO"],
  ["Pediu proposta / mostruário", "PROPOSTA ENVIADA"],
  ["Não falou com quem decide", "AGENDAR VISITA"],
  ["Não atendeu / fechado", "AGENDAR VISITA"],
  ["Já tem fotógrafo", "NÃO FECHOU"],
  ["Sem interesse / sem verba", "NÃO FECHOU"]
];
export const PASSOS = [
  "Ligar para agendar",
  "Chamar no WhatsApp",
  "Mandar e-mail",
  "Enviar mostruário",
  "Voltar para visita",
  "Esperar reunião"
];
// Segmentos que interessam para formatura
export const SEGMENTOS = [
  ["pre", "Pré"],
  ["ano5", "5º ano"],
  ["ano9", "9º ano"],
  ["medio", "Ensino médio"]
];

export const norm = U.chave;
export function status(it) {
  if (it.etapa === "FECHADO") return "won";
  if (!it.followup) return "none";
  const t = U.todayStr();
  return it.followup < t ? "late" : it.followup === t ? "today" : "later";
}
export function anoQueVem() {
  return new Date().getFullYear() + 1 + "-02-02";
}
// Pendência: formatura marcada sem o dia de medir beca + ensaio
export function pendFotos(it) {
  const f = it.formatura,
    d = it.diaFotos;
  return !!(f && f.data && f.status !== "recusado" && !(d && d.data && d.status !== "recusado"));
}
