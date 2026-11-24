// (24/11/2026) Ajustes do aluguel avulso, fora do becas.js:
// - "Voltar: …" desfaz um passo dado sem querer (Retirou → Reservado; Devolveu → Fora do estúdio), com Sim / Não;
// - retirada e devolução no dia do evento (o normal): uma opção marcada que preenche as duas datas com o dia do evento.
import { el } from "./ui.js";
import * as U from "./util.js";
import { confirmar } from "./confirmar.js";

const VOLTA = {
  retirado: ["reservado", "Reservado", { status: "reservado", retiradoEm: "" }],
  devolvido: ["retirado", "Fora do estúdio", { status: "retirado", devolvidoEm: "", faltou: "" }]
};
export function botaoVoltar(x, salvar) {
  const v = VOLTA[x.status];
  if (!v) return null;
  return U.mkBtn("Voltar: " + v[1], "", async () => {
    if (await confirmar("Voltar o aluguel", `Voltar o aluguel de ${x.cliente || "sem nome"} para “${v[1]}”?`))
      salvar(x, Object.assign({}, v[2]), "Voltou para " + v[1].toLowerCase());
  });
}

const somar = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${U.pad(t.getMonth() + 1)}-${U.pad(t.getDate())}`;
};
// Datas do formulário: com "no dia do evento" marcado, retirada = devolução = dia do evento (os dois campos somem);
// desmarcado, a pessoa escolhe (sugere a véspera e o dia seguinte). Devolve a caixa para entrar no formulário.
export function ligarDatas(dEv, ret, dev, x, aoMudar) {
  const box = el("label", "chk");
  const c = el("input");
  c.type = "checkbox";
  c.checked = x ? !!x.dataEvento && x.retirada === x.dataEvento && x.devolucao === x.dataEvento : true;
  box.append(c, " 📅 Retira e devolve no dia do evento");
  const aplicar = () => {
    if (dEv.value && c.checked) ret.value = dev.value = dEv.value;
    else if (dEv.value) {
      if (!ret.value || ret.value === dEv.value) ret.value = somar(dEv.value, -1);
      if (!dev.value || dev.value === dEv.value) dev.value = somar(dEv.value, 1);
    }
    [ret, dev].forEach(i => i.closest(".field") && (i.closest(".field").hidden = c.checked && !!dEv.value));
    aoMudar();
  };
  c.addEventListener("change", aplicar);
  dEv.addEventListener("change", aplicar);
  setTimeout(() => [ret, dev].forEach(i => i.closest(".field") && (i.closest(".field").hidden = c.checked && !!dEv.value)));
  return box;
}
