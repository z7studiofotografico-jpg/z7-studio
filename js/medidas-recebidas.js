// (24/11/2026) Medidas que o cliente manda pela página aberta medidas.html?a=<id do aluguel>.
// Coleção "medidasBeca": { aluguelId, nome, tipo ("adulto" | "infantil"), manga, comp, larg, tamanho, em }.
// Qualquer um cria (só para um aluguel que existe, ver firestore.rules); só a Luciana e o Adriano leem e apagam.
// No aluguel: a lista de quem mandou e o botão que põe os tamanhos recebidos no aluguel (tamanhosQtd e o texto).
import { el, title } from "./ui.js";
import * as U from "./util.js";
import { BECAS, TAMANHOS } from "./becas-estoque.js";

const ORDEM = TAMANHOS.map(([t]) => t);
const pos = t => (ORDEM.indexOf(t) < 0 ? 99 : ORDEM.indexOf(t));

let todas = [];
export function ouvirMedidas(C, aoMudar) {
  if (!C.isAdmin) return () => {};
  return C.FS.onSnapshot(
    C.FS.query(C.FS.collection(C.db, "medidasBeca"), C.FS.orderBy("em", "desc"), C.FS.limit(500)),
    s => {
      todas = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      aoMudar();
    },
    () => {}
  );
}
export const medidasDo = x => todas.filter(m => m.aluguelId === x.id);

// o tipo de beca do aluguel que recebe a medida (infantil → a beca infantil do aluguel; adulto → a outra)
function tipoDoAluguel(x, m) {
  const tem = BECAS.map(([k]) => k).filter(k => Number((x.becasQtd || {})[k]));
  const inf = m.tipo === "infantil";
  return tem.find(k => /^inf/.test(k) === inf && k !== "pelerineAzul") || tem[0] || "";
}
// tamanhos que as medidas recebidas dão, por tipo de beca: { tradPreta: { M: 2, G: 1 } }
export function tamanhosRecebidos(x) {
  const r = {};
  for (const m of medidasDo(x)) {
    const k = tipoDoAluguel(x, m);
    if (!k || !m.tamanho || m.tamanho === "?") continue;
    r[k] = r[k] || {};
    r[k][m.tamanho] = (r[k][m.tamanho] || 0) + 1;
  }
  return r;
}
const textoTam = (q, nomeBeca) =>
  Object.entries(q)
    .map(
      ([k, t]) =>
        `${nomeBeca(k)}: ${Object.entries(t)
          .sort((a, b) => pos(a[0]) - pos(b[0]))
          .map(([s, n]) => `${n} ${s}`)
          .join(", ")}`
    )
    .join("; ");

// o quadro dentro do cartão do aluguel (só aparece se alguém mandou medidas)
export function blocoMedidas(x, salvar) {
  const ms = medidasDo(x);
  if (!ms.length) return null;
  const box = el("div", "notes");
  box.append(el("b", null, `📏 Medidas recebidas pelo link (${ms.length}):`));
  ms.forEach(m =>
    box.append(
      el(
        "div",
        null,
        `${title(m.nome || "Sem nome")}: ${m.tamanho === "?" ? "acima da tabela" : m.tamanho} (${m.tipo}; manga ${m.manga}, comp. ${m.comp}${m.larg ? ", larg. " + m.larg : ""})`
      )
    )
  );
  const q = tamanhosRecebidos(x);
  const nomeBeca = k => (BECAS.find(([b]) => b === k) || [k, k])[1];
  if (Object.keys(q).length) {
    const novo = Object.assign({}, x.tamanhosQtd || {}, q);
    const txt = textoTam(novo, nomeBeca);
    if (txt !== (x.tamanhos || ""))
      box.append(
        U.mkBtn(
          `✅ Usar os tamanhos recebidos (${ms.length} de ${Object.values(x.becasQtd || {}).reduce((a, b) => a + (Number(b) || 0), 0)} becas)`,
          "btn-sm btn-ok",
          () => salvar(x, { tamanhosQtd: novo, tamanhos: txt }, "Tamanhos do aluguel atualizados pelas medidas")
        )
      );
    else box.append(el("div", "hint", "✓ Os tamanhos do aluguel já são os das medidas recebidas."));
  }
  return box;
}
