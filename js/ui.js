// Peças de tela usadas por todos os módulos (antes cada arquivo tinha a sua cópia).
export function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
export function title(s){ return String(s || "").toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, w => w.toLowerCase()); }
export const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
let fid = 0;
export function field(lbl, i){ const f = el("div", "field"); const l = el("label", null, lbl); i.id = i.id || "f" + (++fid); l.htmlFor = i.id; f.append(l, i); return f; }
export function inp(v, ph, max){ const i = el("input"); i.value = v == null ? "" : v; i.placeholder = ph || ""; i.maxLength = max || 120; return i; }
// Campo de dinheiro: teclado numérico com vírgula
export function inpReais(v, ph){ const i = inp(v == null || v === "" ? "" : String(v).replace(".", ","), ph || "R$", 12); i.inputMode = "decimal"; return i; }
export function sel(opts, v, vazio){ const s = el("select"); if (vazio != null) { const o = el("option", null, vazio); o.value = ""; s.append(o); } opts.forEach(x => { const [val, txt] = Array.isArray(x) ? x : [x, x]; const o = el("option", null, txt); o.value = val; s.append(o); }); s.value = v || ""; return s; }
// Painel que sobe por cima da tela (formulário). Devolve a função de fechar.
export function sheet(tit, build, opts){
  const sh = el("div", "sheet"); const p = el(opts && opts.div ? "div" : "form", "panel" + (opts && opts.wide ? " wide" : "")); p.autocomplete = "off"; sh.append(p);
  const close = () => { sh.remove(); if (opts && opts.onClose) opts.onClose(); };
  sh.addEventListener("click", ev => { if (ev.target === sh) close(); });
  if (tit) p.append(el("h2", null, tit));
  build(p, close); document.body.append(sh); return close;
}
export function botoes(close, okTxt, cls){
  const a = el("div", "panel-actions"); const sp = el("span"); sp.style.flex = "1";
  const c = el("button", "btn", "Cancelar"); c.type = "button"; c.onclick = close;
  const ok = el("button", "btn " + (cls || "btn-primary"), okTxt); ok.type = "submit"; a.append(sp, c, ok); a.ok = ok; return a;
}
// Abre o WhatsApp com a mensagem pronta (quem envia é sempre a pessoa)
export function wa(tel, msg, toast){
  let d = String(tel || "").replace(/\D/g, ""); if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!d) { if (toast) toast("Sem WhatsApp cadastrado"); return false; }
  window.open(`https://wa.me/${d}?text=${encodeURIComponent(msg)}`, "_blank", "noopener"); return true;
}
// Erro que não pode travar a tela, mas também não pode sumir: registra e, se pedir, avisa
export function avisoErro(e, onde, toast){
  console.warn("[Z7] " + (onde || "erro"), e);
  if (toast) toast(e && e.code === "permission-denied" ? "Sem permissão para " + (onde || "isso") : "Não foi possível " + (onde || "concluir") + ". Tente de novo.");
}
