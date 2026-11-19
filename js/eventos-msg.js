// As mensagens de erro ao marcar uma data na agenda (saíram de eventos.js em 19/11/2026)
import * as U from "./util.js";

// nomeEvento vem de eventos.js (passado aqui para não depender dele em círculo)
export function msgDaData(e, nomeEvento) {
  if (e.code === "ocupado") return msgOcupado(e, nomeEvento);
  if (e.code === "bloqueado") {
    const x = e.bloqueio || {};
    return `O dia ${U.fmtDate(e.ocupado.data)} está bloqueado: ${x.particular ? "compromisso particular" : x.titulo || "compromisso"}${x.deQuem ? " (" + x.deQuem + ")" : ""}. Escolha outra data.`;
  }
  if (e.code === "confirmado") return "Essa data já foi confirmada pela Luciana. Para mudar, fale com ela.";
  if (e.code === "mesmodia") return "O dia das fotos e o dia da formatura precisam ser dias diferentes.";
  if (e.code === "ordem") return "O dia de medir beca e fazer o ensaio precisa ser ANTES da formatura.";
  return "Não foi possível reservar o dia.";
}
function msgOcupado(e, nomeEvento) {
  const o = e.ocupado || {};
  return `O dia ${U.fmtDate(o.data)}/${String(o.data || "").slice(0, 4)} já está ocupado: ${nomeEvento(o.kind, o.instNome)}${o.hora ? " às " + o.hora : ""} (${o.status === "confirmado" ? "confirmado" : "aguardando a Luciana"}). Escolha outra data.`;
}
