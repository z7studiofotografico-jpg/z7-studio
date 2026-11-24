// Recepcionista do colégio (24/11/2026): quem coloca as becas nos alunos no dia. No Contrato do colégio do Aluguel de
// becas: "Tem recepcionista" / "Não tem", com nome, WhatsApp, valor e quem paga (o colégio, ou dividido entre os
// alunos). O valor soma no total do contrato (e no A receber); o nome sai na faixa do colégio e no topo do relatório.
// contrato.recepcionista = { tem: true|false, nome, tel, valor, quemPaga: "colegio" | "alunos" }
import { el, field, inp, inpReais, sel } from "./ui.js";
import * as U from "./util.js";
import { lerReais, brl } from "./regras.js";

export const QUEM_PAGA_RECEP = [
  ["colegio", "O colégio"],
  ["alunos", "Os alunos (dividido no valor de cada um)"]
];
export const valorRecepcionista = c => (c && c.recepcionista && c.recepcionista.tem ? Number(c.recepcionista.valor) || 0 : 0);
const fone = t => {
  const d = U.digits(t || "");
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : t || "";
};
// texto para a faixa do colégio e o relatório ("" quando ainda não foi informado)
export function textoRecepcionista(c, comValor = true) {
  const r = c && c.recepcionista;
  if (!r || r.tem == null) return "";
  if (!r.tem) return "Recepcionista: não tem";
  return (
    "Recepcionista: " +
    [r.nome || "a confirmar", fone(r.tel)].filter(Boolean).join(" ") +
    (comValor && Number(r.valor) ? ` · ${brl(r.valor)}${r.quemPaga === "alunos" ? " (dividido entre os alunos)" : " (o colégio paga)"}` : "")
  );
}

// o bloco do formulário do contrato
export function campoRecepcionista(x) {
  const r = (x && x.recepcionista) || {};
  const box = el("div");
  let tem = r.tem == null ? null : !!r.tem;
  const bSim = el("button", "chip", "Tem recepcionista");
  const bNao = el("button", "chip", "Não tem");
  [bSim, bNao].forEach(b => (b.type = "button"));
  const nome = inp(r.nome || "", "nome de quem coloca as becas");
  const tel = inp(r.tel || "", "(21) 9…", 30);
  tel.inputMode = "tel";
  const valor = inpReais(r.valor != null ? r.valor : "", "0,00");
  const quem = sel(QUEM_PAGA_RECEP, r.quemPaga || "colegio");
  const det = el("div");
  const l1 = el("div", "row2");
  l1.append(field("Nome", nome), field("WhatsApp", tel));
  const l2 = el("div", "row2");
  l2.append(field("Valor (R$)", valor), field("Quem paga", quem));
  det.append(l1, l2);
  const mostra = () => {
    bSim.setAttribute("aria-pressed", String(tem === true));
    bNao.setAttribute("aria-pressed", String(tem === false));
    det.hidden = tem !== true;
  };
  bSim.onclick = () => ((tem = true), mostra());
  bNao.onclick = () => ((tem = false), mostra());
  const ch = el("div", "chips");
  ch.append(bSim, bNao);
  box.append(el("p", "hint", "Recepcionista para colocar as becas nos alunos (quando o colégio pede)"), ch, det);
  mostra();
  return {
    box,
    ler: () =>
      tem == null
        ? null
        : tem
          ? { tem: true, nome: nome.value.trim(), tel: U.digits(tel.value), valor: lerReais(valor.value) || 0, quemPaga: quem.value }
          : { tem: false }
  };
}
