// Funções puras usadas por todas as telas: datas, dinheiro, telefone, aviso rápido e botão.
// Cada tela importa daqui (antes tudo passava pelo objeto "ctx" do index.html).
import { brl, lerReais } from "./regras.js";
export const pad = n => String(n).padStart(2, "0");
// Data local no formato AAAA-MM-DD
export const ds = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const todayStr = () => ds(new Date());
export function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ds(d);
}
export function fmtDate(s) {
  if (!s) return "";
  const [, m, d] = s.split("-");
  return d + "/" + m;
}
export function hhmm(iso) {
  const d = new Date(iso);
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}
// Dinheiro no padrão brasileiro (contas em centavos ficam em regras.js)
export const money = brl;
export const num = lerReais;
// Telefone com 55 na frente, para o wa.me
export function digits(t) {
  let d = (t || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d;
}
export function first(n) {
  return (n || "").trim().split(/\s+/)[0] || "";
}
const $ = id => document.getElementById(id);
export function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    t.hidden = true;
  }, 2400);
}
export function showNotice(t) {
  const n = $("notice");
  if (!n) return;
  n.textContent = t;
  n.hidden = !t;
}
export function mkBtn(text, cls, fn) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn btn-sm " + (cls || "");
  b.textContent = text;
  b.onclick = fn;
  return b;
}
