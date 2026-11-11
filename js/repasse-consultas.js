// PR / Paspatur / Formatura: a consulta do Firebase de cada aba (saiu do repasse.js em 11/11/2026).
// A equipe vê só os contatos dela (soMinha); a busca continua mostrando todos, para achar o aluno.
import { C, FS, col, seg, ABERTAS, baseLF, baseSeg, soMinha, ehFormatura, pessoaAberta } from "./repasse-estado.js";
import { emAndamento } from "./repasse-equipe.js";
import * as U from "./util.js";

export const LIMITE_ENTREGUES = 300;
// Caídos: o admin vê todos; a equipe, os que ela mesma marcou
const soMinhaCaidos = () => (C.isAdmin ? [] : [FS.where("respEmail", "==", C.email || "")]);

export function consultaDaAba(k, todosEntregues = false) {
  const today = U.todayStr();
  let q = null;
  if (k === "trabalhar") q = emAndamento(C.email || "");
  if (k === "equipe" && C.isAdmin && pessoaAberta.email) q = emAndamento(pessoaAberta.email, [...ABERTAS, "CAÍDO"]);
  if (seg === "lf") {
    if (k === "hoje") q = FS.query(col, ...baseLF(), ...soMinha(), FS.where("etapa", "in", ABERTAS), FS.limit(300));
    if (k === "interessados") q = FS.query(col, ...baseLF(), ...soMinha(), FS.where("etapa", "==", "INTERESSADO"), FS.limit(200));
    if (k === "entregas") q = FS.query(col, ...baseLF(), ...soMinha(), FS.where("etapa", "==", "PAGO"), FS.limit(300));
  } else {
    if (k === "hoje")
      q = C.isAdmin
        ? FS.query(col, FS.where("followup", "<=", today), FS.orderBy("followup"), FS.limit(150))
        : FS.query(col, ...soMinha(), FS.where("etapa", "in", ABERTAS), FS.limit(500));
    if (k === "interessados") q = FS.query(col, ...soMinha(), FS.where("etapa", "==", "INTERESSADO"), FS.limit(200));
    if (k === "entregas") q = FS.query(col, ...soMinha(), FS.where("etapa", "==", "PAGO"), FS.limit(300));
  }
  if (k === "incompletos")
    q = C.isAdmin
      ? FS.query(col, FS.where("etapa", "==", "INCOMPLETO"), FS.limit(200))
      : FS.query(
          col,
          ...(seg === "lf" ? baseLF() : []),
          FS.where("etapa", "==", "INCOMPLETO"),
          FS.where("respEmail", "==", C.email || ""),
          FS.limit(200)
        );
  if (k === "vendidos")
    q = C.isAdmin
      ? // só consulta: 300 por vez (o PR já passa de 1.000 entregues e cada abertura lia tudo); "Ver todos" lê até 5.000
        FS.query(
          col,
          FS.where("etapa", "==", "ENTREGUE"),
          ...(ehFormatura() ? baseSeg() : seg === "lf" ? baseLF() : []),
          FS.limit(todosEntregues ? 5000 : LIMITE_ENTREGUES)
        )
      : FS.query(
          col,
          ...(seg === "lf" ? baseLF() : []),
          FS.where("etapa", "==", "ENTREGUE"),
          FS.where("respEmail", "==", C.email || ""),
          FS.limit(500)
        );
  if (k === "conferir") q = FS.query(col, FS.where("conferido", "==", false), FS.limit(300));
  if (k === "caidos")
    q = FS.query(
      col,
      FS.where("etapa", "==", "CAÍDO"),
      ...(ehFormatura() ? baseSeg() : seg === "lf" ? baseLF() : []),
      ...soMinhaCaidos(),
      FS.limit(500)
    );
  return q;
}
