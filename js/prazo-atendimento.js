// ⏳ O prazo do atendimento (17/11/2026). Quando a prévia vai para a família, ela fica com o representante por 3 dias
// (até o fim do 3º dia). O prazo aparece grande na imagem do kit e na página da prévia, para a família decidir logo.
// O representante pode dar mais dias ("+1 dia"). O preço não muda depois do prazo: o texto diz só até quando vai o
// atendimento, nunca que o valor acaba.
import * as U from "./util.js";
import { el } from "./ui.js";

export const DIAS_PRAZO = 3;
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// o fim do dia, daqui a n dias
export function fimDoDia(base, n) {
  const d = new Date(base.getTime() + n * 864e5);
  d.setHours(23, 59, 0, 0);
  return d;
}
export const prazoDe = it => (it && it.prazoAtendimento ? new Date(it.prazoAtendimento) : null);
// "sex, 20/11"
export const prazoCurto = d =>
  `${SEMANA[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

// o prazo vale? se não tem (ou já passou), começa agora com 3 dias. Devolve { prazo, patch } (patch = o que gravar)
export function prazoParaMandar(it, agora = new Date()) {
  const p = prazoDe(it);
  if (p && p > agora) return { prazo: p, patch: null };
  const novo = fimDoDia(agora, DIAS_PRAZO - 1);
  return { prazo: novo, patch: { prazoAtendimento: novo.toISOString() } };
}

// mais dias: conta a partir do prazo (ou de hoje, se já passou)
export function maisDias(it, n, agora = new Date()) {
  const p = prazoDe(it);
  const base = p && p > agora ? p : agora;
  return fimDoDia(base, n);
}

// grava no aluno e no link da prévia (a página do site mostra o mesmo prazo)
export async function gravarPrazo(C, it, prazo, salvar, msg) {
  const iso = prazo.toISOString();
  if (it.linkPrevia)
    await C.FS.updateDoc(C.FS.doc(C.db, "previasSite", it.linkPrevia), { prazo: iso }).catch(e => console.warn("[Z7] prazo no link", e));
  if (salvar) await salvar({ prazoAtendimento: iso }, msg);
}

// a linha no cartão do aluno: "⏳ Atendimento até sex, 20/11 · faltam 2 dias" + "+1 dia" e "+3 dias"
export function linhaPrazo(C, it, salvar) {
  const p = prazoDe(it);
  const box = el("div", "prazo-linha");
  if (!p) return box;
  const agora = new Date();
  const dias = Math.ceil((p - agora) / 864e5);
  const venceu = p < agora;
  box.append(
    el(
      "span",
      venceu ? "prazo-chip venceu" : "prazo-chip",
      venceu
        ? `⏳ Prazo da família venceu (${prazoCurto(p)})`
        : `⏳ Atendimento até ${prazoCurto(p)} · ${dias <= 1 ? "último dia" : "faltam " + dias + " dias"}`
    )
  );
  [1, 3].forEach(n =>
    box.append(
      U.mkBtn(`+${n} dia${n > 1 ? "s" : ""}`, "btn-sm", async () => {
        const novo = maisDias(it, n);
        await gravarPrazo(C, it, novo, salvar, `Atendimento até ${prazoCurto(novo)} ✅`);
      })
    )
  );
  return box;
}
