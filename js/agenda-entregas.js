// Agendamento: entregas das fotos (da sessão até entregar, com o prazo) e o pedido de avaliação no Google.
import { el, title, wa, avisoErro } from "./ui.js";
import * as U from "./util.js";
import { C, FS, db, passados, ETAPAS_ENTREGA } from "./agenda-estado.js";
import { confirmar, confirmarStatus, excluir, faixaExclusao } from "./confirmar.js";
export function etapaEntrega(x) {
  return (x.entrega && x.entrega.etapa) || "Ensaio feito";
}
export function entregasAbertas() {
  return passados
    .filter(
      x => etapaEntrega(x) !== "Entregue" || (C.P.linkAvaliacao && !x.avaliacaoPedida && x.entrega.em && x.entrega.em <= U.addDays(-3))
    )
    .sort((a, b) => prazoDe(a).localeCompare(prazoDe(b)));
}
export function prazoDe(x) {
  const [y, m, d] = x.data.split("-").map(Number);
  const dt = new Date(y, m - 1, d + (Number(C.P.prazo) || 15));
  return `${dt.getFullYear()}-${U.pad(dt.getMonth() + 1)}-${U.pad(dt.getDate())}`;
}
export function diasAte(d) {
  const [y, m, dd] = d.split("-").map(Number);
  const [a, b, c] = U.todayStr().split("-").map(Number);
  return Math.round((new Date(y, m - 1, dd) - new Date(a, b - 1, c)) / 864e5);
}
export function cardEntrega(x) {
  const et = etapaEntrega(x),
    entregue = et === "Entregue";
  const pz = prazoDe(x),
    falta = diasAte(pz);
  const cls = entregue ? "won" : falta < 0 ? "late" : falta <= 3 ? "today" : "";
  const e = el("article", "card " + cls);
  const fx = faixaExclusao(C, "ensaios", x);
  if (fx) e.append(fx);
  const top = el("div", "card-top");
  top.append(el("h3", "name", `📷 ${title(x.cliente)}`), el("span", "stage", entregue ? "AVALIAÇÃO" : et.toUpperCase()));
  e.append(top);
  e.append(el("div", "meta"));
  e.lastChild.append(el("span", "tag svc", x.tipo || "Ensaio"), el("span", "tag", "Ensaio em " + U.fmtDate(x.data)));
  if (!entregue) {
    e.append(
      el(
        "div",
        "fu " + (falta < 0 ? "late" : falta <= 3 ? "today" : ""),
        falta < 0
          ? `Atrasado ${-falta} dia${falta < -1 ? "s" : ""} (prazo era ${U.fmtDate(pz)})`
          : falta === 0
            ? "Prazo de entrega: hoje"
            : `Faltam ${falta} dia${falta > 1 ? "s" : ""} para entregar (até ${U.fmtDate(pz)})`
      )
    );
    const passos = el("div", "passos");
    const i = ETAPAS_ENTREGA.indexOf(et);
    ETAPAS_ENTREGA.forEach((p, k) => passos.append(el("span", k <= i ? "on" : "", p)));
    e.append(passos);
  } else e.append(el("div", "fu", `Entregue em ${U.fmtDate(x.entrega.em)}. Hora de pedir a avaliação no Google ⭐`));
  const act = el("div", "actions");
  if (!entregue) {
    const i = ETAPAS_ENTREGA.indexOf(et),
      prox = ETAPAS_ENTREGA[i + 1],
      ant = ETAPAS_ENTREGA[i - 1];
    if (prox === "Entregue" && x.tel)
      act.append(
        U.mkBtn("📲 Avisar que está pronto", "", () =>
          abrirWa(
            x.tel,
            `Oi, ${U.first(title(x.cliente))}! Suas fotos do ensaio estão prontas 🎉📸 Quer que eu envie por aqui ou prefere buscar no estúdio?`
          )
        )
      );
    // barra fixa na base do card: Avançar, Voltar, Cliente faltou e Cancelar (sempre com Sim / Não)
    const base = el("div", "acao-base");
    base.append(U.mkBtn(prox === "Entregue" ? "✅ Entregue" : "Avançar: " + prox, "btn-ok", () => mudarEntrega(x, et, prox)));
    if (ant) base.append(U.mkBtn("Voltar: " + ant, "", () => mudarEntrega(x, et, ant)));
    if (et === "Ensaio feito")
      base.append(
        U.mkBtn("Cliente faltou", "", async () => {
          if (!(await confirmar("Cliente faltou?", `Marcar que ${U.first(title(x.cliente))} faltou ao ensaio de ${U.fmtDate(x.data)}?`)))
            return;
          try {
            await FS.updateDoc(FS.doc(db, "ensaios", x.id), { status: "faltou" });
            U.toast("Marcado como falta");
          } catch (er) {
            C.handleErr(er);
          }
        })
      );
    base.append(U.mkBtn("Cancelar", "btn-danger", () => cancelarAgendamento(x)));
    e.append(act.children.length ? act : el("span"), base);
    return e;
  } else {
    act.append(
      U.mkBtn("⭐ Pedir avaliação", "btn-primary", async () => {
        abrirWa(
          x.tel,
          `Oi, ${U.first(title(x.cliente))}! Que bom que você fez o seu ensaio com a gente 💛 Se puder, deixa uma avaliação rapidinha no Google? Ajuda muito o nosso estúdio: ${C.P.linkAvaliacao}`
        );
        try {
          await FS.updateDoc(FS.doc(db, "ensaios", x.id), { avaliacaoPedida: true, avaliacaoEm: U.todayStr() });
        } catch (er) {
          avisoErro(er, "marcar a avaliação como pedida", U.toast);
        }
      })
    );
    act.append(
      U.mkBtn("Não pedir", "", async () => {
        try {
          await FS.updateDoc(FS.doc(db, "ensaios", x.id), { avaliacaoPedida: true, avaliacaoEm: "" });
        } catch (er) {
          C.handleErr(er);
        }
      })
    );
  }
  e.append(act);
  return e;
}
// Avançar ou voltar a etapa da entrega, com a pergunta "Mudar de X para Y?"
export async function mudarEntrega(x, de, para) {
  if (await confirmarStatus(de, para)) avancarEntrega(x, para);
}
// Cancelar o agendamento: o admin cancela; a equipe só pede (o Adriano confirma)
export async function cancelarAgendamento(x) {
  if (C.isAdmin) {
    if (
      !(await confirmar(
        "Cancelar o agendamento?",
        `Tem certeza que deseja cancelar este agendamento (${title(x.cliente || "")}, ${U.fmtDate(x.data)})?`,
        { perigo: true }
      ))
    )
      return;
    try {
      await FS.updateDoc(FS.doc(db, "ensaios", x.id), {
        status: "cancelado",
        canceladoEm: new Date().toISOString(),
        canceladoPor: C.me || ""
      });
      U.toast("Agendamento cancelado");
    } catch (e) {
      C.handleErr(e);
    }
    return;
  }
  excluir(C, {
    col: "ensaios",
    id: x.id,
    rotulo: `Agendamento de ${title(x.cliente || "")} em ${U.fmtDate(x.data)}`,
    titulo: "Cancelar o agendamento?"
  });
}
export async function avancarEntrega(x, etapa) {
  try {
    await FS.updateDoc(FS.doc(db, "ensaios", x.id), { entrega: { etapa, em: U.todayStr(), por: C.me || "" } });
    U.toast(etapa === "Entregue" ? "Entregue ✅ Em 3 dias o app lembra de pedir a avaliação" : "Agora: " + etapa);
  } catch (e) {
    C.handleErr(e);
  }
}
const abrirWa = (tel, msg) => wa(tel, msg, U.toast);
