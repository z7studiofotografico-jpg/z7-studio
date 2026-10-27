// Agendamento: estado compartilhado pelas partes da tela (lista, calendário, entregas, colégios, ensaios, relatório).
// As partes leem as variáveis daqui (acompanham as mudanças); só o agenda.js muda, pela função mudar().
import * as U from "./util.js";
import { nomeEvento } from "./eventos.js";
import { resumoDiaEm } from "./agenda-tempo.js";
export let C, FS, db, col, colE;
export let privados = {},
  items = [],
  ensaios = [],
  passados = [],
  comps = [],
  visitas = [],
  becas = [],
  filtro = "tudo",
  mesVis = "",
  selDia = "";
// mudar({ items, ensaios, ... }): troca só o que vier
export function mudar(o) {
  if ("privados" in o) privados = o.privados;
  if ("items" in o) items = o.items;
  if ("ensaios" in o) ensaios = o.ensaios;
  if ("passados" in o) passados = o.passados;
  if ("comps" in o) comps = o.comps;
  if ("visitas" in o) visitas = o.visitas;
  if ("becas" in o) becas = o.becas;
  if ("filtro" in o) filtro = o.filtro;
  if ("mesVis" in o) mesVis = o.mesVis;
  if ("selDia" in o) selDia = o.selDia;
}
export function iniciar(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
  col = FS.collection(db, "agenda");
  colE = FS.collection(db, "ensaios");
}
// Ligação com a tela principal (agenda.js preenche): quem grava ou muda algo pede para redesenhar
export const tela = { render() {} };
export const ETAPAS_ENTREGA = ["Ensaio feito", "Fotos escolhidas", "Em edição", "Pronto", "Entregue"];
export const $ = id => document.getElementById(id);
export const CAMPO = { formatura: "formatura", fotos: "diaFotos" };
export const ICO = { formatura: "🎓", fotos: "📸" };
export const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro"
];
export const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const resumoDia = (data, ignora) => resumoDiaEm({ ensaios, items, comps }, data, ignora, nomeEvento);
export const quando = d => (d === U.todayStr() ? "hoje" : d === U.addDays(1) ? "amanhã" : "");
export const vejoEnsaios = () => true;
export const marco = () => C.isAdmin;
export const vejoVisitas = () => C.pode("colegios");
