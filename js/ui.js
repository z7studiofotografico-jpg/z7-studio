import { campoReais } from "./regras.js";
// Peças de tela usadas por todos os módulos (antes cada arquivo tinha a sua cópia).
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
export function title(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(Da|De|Do|Das|Dos|E)\b/g, w => w.toLowerCase());
}
export const norm = s =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
let fid = 0;
export function field(lbl, i) {
  const f = el("div", "field");
  const l = el("label", null, lbl);
  i.id = i.id || "f" + ++fid;
  l.htmlFor = i.id;
  f.append(l, i);
  return f;
}
export function inp(v, ph, max) {
  const i = el("input");
  i.value = v == null ? "" : v;
  i.placeholder = ph || "";
  i.maxLength = max || 120;
  return i;
}
// Campo de dinheiro: teclado numérico com vírgula
export function inpReais(v, ph) {
  const i = inp(v == null || v === "" ? "" : campoReais(typeof v === "number" ? v.toFixed(2).replace(".", ",") : v), ph || "R$", 14);
  i.inputMode = "decimal";
  return i;
}
export function sel(opts, v, vazio) {
  const s = el("select");
  if (vazio != null) {
    const o = el("option", null, vazio);
    o.value = "";
    s.append(o);
  }
  opts.forEach(x => {
    const [val, txt] = Array.isArray(x) ? x : [x, x];
    const o = el("option", null, txt);
    o.value = val;
    s.append(o);
  });
  s.value = v || "";
  return s;
}
// Painel que sobe por cima da tela (formulário). Devolve a função de fechar.
export function sheet(tit, build, opts) {
  const sh = el("div", "sheet");
  const p = el(opts && opts.div ? "div" : "form", "panel" + (opts && opts.wide ? " wide" : ""));
  p.autocomplete = "off";
  sh.append(p);
  const close = () => {
    sh.remove();
    if (opts && opts.onClose) opts.onClose();
  };
  sh.addEventListener("click", ev => {
    if (ev.target === sh) close();
  });
  if (tit) p.append(el("h2", null, tit));
  build(p, close);
  document.body.append(sh);
  return close;
}
export function botoes(close, okTxt, cls) {
  const a = el("div", "panel-actions");
  const sp = el("span");
  sp.style.flex = "1";
  const c = el("button", "btn", "Cancelar");
  c.type = "button";
  c.onclick = close;
  const ok = el("button", "btn " + (cls || "btn-primary"), okTxt);
  ok.type = "submit";
  a.append(sp, c, ok);
  a.ok = ok;
  return a;
}
// Abre o WhatsApp com a mensagem pronta (quem envia é sempre a pessoa)
export function wa(tel, msg, toast) {
  let d = String(tel || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!d) {
    if (toast) toast("Sem WhatsApp cadastrado");
    return false;
  }
  window.open(`https://wa.me/${d}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  return true;
}
// Erro que não pode travar a tela, mas também não pode sumir: registra e, se pedir, avisa
export function avisoErro(e, onde, toast) {
  console.warn("[Z7] " + (onde || "erro"), e);
  if (toast)
    toast(
      e && e.code === "permission-denied"
        ? "Sem permissão para " + (onde || "isso")
        : "Não foi possível " + (onde || "concluir") + ". Tente de novo."
    );
}

// Bibliotecas de fora, com conferência de integridade (se o arquivo for adulterado, o navegador recusa)
const LIBS = {
  xlsx: {
    url: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    sri: "sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw",
    global: "XLSX"
  },
  chart: {
    url: "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js",
    sri: "sha384-dug+JxfBvklEQdJ4AYuBBAIScUz0bVN73xpy273gcAwHjb3qI0fXmuYNaNfdyYJG",
    global: "Chart"
  }
};
const carregando = {};
export function carregarLib(nome) {
  const L = LIBS[nome];
  if (window[L.global]) return Promise.resolve(window[L.global]);
  // se o jsDelivr falhar, tenta o unpkg (mesmo arquivo do npm, mesma conferência)
  const tentar = url =>
    new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = url;
      s.integrity = L.sri;
      s.crossOrigin = "anonymous";
      s.onload = () => res(window[L.global]);
      s.onerror = e => {
        s.remove();
        rej(e);
      };
      document.head.append(s);
    });
  return (carregando[nome] =
    carregando[nome] ||
    tentar(L.url)
      .catch(() => tentar(L.url.replace("https://cdn.jsdelivr.net/npm/", "https://unpkg.com/")))
      .catch(e => {
        delete carregando[nome];
        throw e;
      }));
}

// Lista longa: mostra os primeiros itens e um botão "Mostrar mais" (o celular não trava com centenas de cartões)
export function emPartes(box, itens, desenhar, passo) {
  passo = passo || 40;
  let n = 0;
  const mais = el("button", "btn mostrar-mais");
  mais.type = "button";
  const lote = () => {
    itens.slice(n, n + passo).forEach(x => {
      const c = desenhar(x);
      if (c) box.append(c);
    });
    n += passo;
    const resta = itens.length - n;
    mais.remove();
    if (resta > 0) {
      mais.textContent = `Mostrar mais (${resta})`;
      box.append(mais);
    }
  };
  mais.onclick = lote;
  lote();
}

// Todo campo de dinheiro (teclado decimal, que não seja porcentagem) mostra e completa os centavos: 500 → 500,00
const ehDinheiro = i => i && i.tagName === "INPUT" && i.inputMode === "decimal" && !i.dataset.pct;
export function formatarCampos(raiz) {
  (raiz || document).querySelectorAll('input[inputmode="decimal"]').forEach(i => {
    if (ehDinheiro(i) && i !== document.activeElement) i.value = campoReais(i.value);
  });
}
let ligado = false;
export function ligarCamposReais() {
  if (ligado || typeof document === "undefined") return;
  ligado = true;
  document.addEventListener("focusout", e => {
    if (ehDinheiro(e.target)) e.target.value = campoReais(e.target.value);
  });
  // campos criados depois (formulários que abrem) já aparecem com ",00"
  new MutationObserver(ms =>
    ms.forEach(m =>
      m.addedNodes.forEach(n => {
        if (n.nodeType === 1) {
          if (ehDinheiro(n)) n.value = campoReais(n.value);
          else formatarCampos(n);
        }
      })
    )
  ).observe(document.body, { childList: true, subtree: true });
}

// Telefone brasileiro só com dígitos (DDD + número), ou "" se não for válido
export function parseTel(v) {
  const d = String(v || "")
    .replace(/\D/g, "")
    .replace(/^55(?=\d{10,11}$)/, "");
  return d.length >= 10 && d.length <= 11 ? d : "";
}

// Grade de quantidades (uma caixinha por item): usada no estoque e no aluguel de becas.
// tipos = [[chave, nome]]; atual = { chave: n }. Devolve { box, ins: [[chave, input]] }.
export function gradeQtd(tipos, atual, opts = {}) {
  const box = el("div", "estgrid");
  const ins = tipos.map(([k, t]) => {
    const r = el("div", "prow");
    const q = inp((atual || {})[k] || "", "0", opts.max || 4);
    q.inputMode = "numeric";
    q.className = "preco";
    q.disabled = !!opts.disabled;
    q.setAttribute("aria-label", opts.rotulo ? opts.rotulo(k, t) : t);
    r.append(el("span", null, opts.texto ? opts.texto(k, t) : t), q);
    if (opts.aoMudar) q.addEventListener("change", opts.aoMudar);
    box.append(r);
    return [k, q];
  });
  return { box, ins };
}
