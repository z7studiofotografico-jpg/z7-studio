// Item do pacote com a quantidade (17/11/2026): a caixinha do item e, quando marcada, o campo da quantidade ao lado
// (ex.: 2 PR 15x10, 30 fotos 15x10). A quantidade fica presa à caixinha (cb._qtd), então os botões de kit e quem
// lê os itens acham a quantidade sem saber como cada tela montou a sua lista.
import { el } from "./ui.js";

export function chipItem(id, nome, marcado, qtd) {
  const l = el("label", "chk");
  const cb = el("input");
  cb.type = "checkbox";
  cb.checked = !!marcado;
  const t = document.createTextNode(" " + nome);
  const q = el("input", "kit-qtd");
  q.type = "number";
  q.min = "1";
  q.max = "999";
  q.value = String(Number(qtd) || 1);
  q.setAttribute("aria-label", "Quantidade de " + nome);
  q.hidden = !cb.checked;
  cb.addEventListener("change", () => (q.hidden = !cb.checked));
  cb._qtd = q;
  l.append(cb, t, q);
  return { l, cb, t, q };
}
// a quantidade de uma caixinha (1 se não tiver o campo)
export const qtdDe = cb => (cb && cb._qtd ? Math.max(1, parseInt(cb._qtd.value, 10) || 1) : 1);
// { item: quantidade } dos itens marcados com mais de 1; pares = [[id, caixinha, …], …]
export const lerQtd = pares => Object.fromEntries(pares.filter(([, cb]) => cb.checked && qtdDe(cb) > 1).map(([id, cb]) => [id, qtdDe(cb)]));
// põe a quantidade numa caixinha (ex.: ao escolher um kit)
export function porQtd(cb, n) {
  if (!cb || !cb._qtd) return;
  cb._qtd.value = String(Number(n) || 1);
  cb._qtd.hidden = !cb.checked;
}
