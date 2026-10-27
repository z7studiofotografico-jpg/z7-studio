// Agenda: contas de horário (puras, testadas em tests/agenda-tempo.test.mjs).
import * as U from "./util.js";
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const ICO = { formatura: "🎓", fotos: "📸" };
export const TIPOS_ENSAIO = [
  "Formatura individual",
  "Formatura em grupo",
  "Corporativo",
  "Retrato",
  "Infantil",
  "Gestante",
  "Família",
  "Outro"
];

export function diaTxt(d) {
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, dd);
  return `${SEMANA[dt.getDay()]}, ${U.pad(dd)}/${U.pad(m)}`;
}
// "09:30" → 570; sem hora → null (antes virava 00:00 e podia acusar conflito falso de madrugada)
export const min = h => {
  if (!String(h || "").trim()) return null;
  const [a, b] = String(h || "")
    .split(":")
    .map(Number);
  return isNaN(a) ? null : a * 60 + (b || 0);
};
export const hm = m => U.pad(Math.floor(m / 60) % 24) + ":" + U.pad(m % 60);
export const fimDe = e => {
  const i = min(e.hora);
  return i == null ? "" : hm(i + (Number(e.duracao) || 60));
};

export function conflitosEm({ ensaios = [], items = [], comps = [] }, data, hora, duracao, ignora) {
  const i = min(hora),
    f = i == null ? null : i + (Number(duracao) || 60);
  const doDia = ensaios.filter(e => e.data === data && e.id !== ignora && e.status !== "remarcar");
  const encavala =
    i == null
      ? []
      : doDia.filter(e => {
          const a = min(e.hora);
          if (a == null) return false;
          const b = a + (Number(e.duracao) || 60);
          return a < f && i < b;
        });
  const colegio = items.find(x => x.data === data);
  const compDia = comps.filter(c => c.data === data && c.id !== ignora);
  const compBate = compDia.filter(c => {
    if (c.diaInteiro) return true;
    if (i == null) return false;
    const a = min(c.hora);
    if (a == null) return false;
    const b = a + (Number(c.duracao) || 60);
    return a < f && i < b;
  });
  return { doDia, encavala, colegio, compDia, compBate };
}
export function resumoDiaEm(estado, data, ignora, nomeEvento) {
  const { doDia, colegio, compDia } = conflitosEm(estado, data, "", 0, ignora);
  const p = [];
  compDia.forEach(c =>
    p.push(`📌 ${c.titulo || "Compromisso"} (${c.deQuem || ""}) · ${c.diaInteiro ? "dia inteiro" : (c.hora || "") + "–" + fimDe(c)}`)
  );
  if (colegio)
    p.push(
      `${ICO[colegio.kind] || "📌"} ${nomeEvento(colegio.kind, colegio.instNome)}${colegio.status === "pendente" ? " (aguardando)" : ""}`
    );
  doDia
    .slice()
    .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""))
    .forEach(e => p.push(`📷 ${e.hora ? e.hora + "–" + fimDe(e) : "sem hora"} ${U.first(e.cliente)}`));
  return p;
}
export function tipoDoLead(s) {
  s = String(s || "");
  if (/formatura individual/i.test(s)) return "Formatura individual";
  if (/turma/i.test(s)) return "Formatura em grupo";
  return TIPOS_ENSAIO.find(t => t.toLowerCase() === s.toLowerCase()) || "";
}
