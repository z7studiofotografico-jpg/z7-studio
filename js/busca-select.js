// 🔎 Procurar nas listas longas (17/11/2026): toda lista de escolher (select) com muitas opções, em qualquer janela
// do app, ganha logo abaixo um campo para digitar. Digitando um pedaço do nome ou um número ("336", "yonne",
// "abdias"), aparecem só as opções que batem; tocando numa delas (ou Enter na primeira), a lista fica escolhida,
// como se tivesse escolhido nela. Não precisa mais rolar a lista de 60 colégios.
const MINIMO = 12; // a partir de quantas opções aparece o campo

// "C.E. João Paulo II" → "c e joao paulo ii" (sem acento, sem pontuação)
export const normalizar = s =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// as opções que batem com o que foi digitado (todas as palavras, em qualquer ordem)
export function filtrarOpcoes(opcoes, texto) {
  const q = normalizar(texto).split(" ").filter(Boolean);
  if (!q.length) return [];
  return opcoes.filter(o => {
    const t = " " + normalizar(o.texto) + " ";
    return q.every(p => (/^\d+$/.test(p) ? new RegExp("[^0-9]" + p + "[^0-9]").test(t) || t.includes(p) : t.includes(p)));
  });
}

function escolher(sel, valor) {
  sel.value = valor;
  sel.dispatchEvent(new Event("input", { bubbles: true }));
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

// 17/11/2026: lista de colégio ou instituição ganha o campo mesmo curta (todo lugar que escolhe o colégio)
const COLEGIO = /col[ée]gio|institui|escola|faculdade/i;
export function ehDeColegio(sel) {
  const rotulos = [sel.getAttribute("aria-label"), sel.id, sel.name, sel.options[0] && sel.options[0].textContent];
  (sel.labels ? [...sel.labels] : []).forEach(l => rotulos.push(l.textContent));
  const campo = sel.closest(".field, label");
  if (campo) {
    const l = campo.tagName === "LABEL" ? campo : campo.querySelector("label");
    if (l) rotulos.push(l.textContent);
  }
  const ant = sel.previousElementSibling;
  if (ant && /^(LABEL|SPAN|B|SMALL|H\d)$/.test(ant.tagName)) rotulos.push(ant.textContent);
  return rotulos.some(t => COLEGIO.test(String(t || "")));
}

function enfeitar(sel) {
  if (!sel) return;
  if (sel.dataset.busca || sel.multiple || sel.dataset.semBusca !== undefined) return;
  if (sel.options.length < MINIMO && !(sel.options.length >= 2 && ehDeColegio(sel))) return;
  sel.dataset.busca = "1";
  const caixa = document.createElement("div");
  caixa.className = "sel-busca";
  const inp = document.createElement("input");
  inp.type = "search";
  inp.placeholder = "🔎 Digite o nome ou o número para achar";
  inp.setAttribute("aria-label", "Procurar na lista");
  inp.autocomplete = "off";
  const lista = document.createElement("div");
  lista.className = "sel-busca-lista";
  lista.hidden = true;
  caixa.append(inp, lista);
  sel.after(caixa);
  let achados = [];
  const fechar = () => {
    lista.hidden = true;
    lista.textContent = "";
  };
  const pegar = o => {
    escolher(sel, o.valor);
    inp.value = "";
    fechar();
    sel.focus();
  };
  inp.addEventListener("input", () => {
    const ops = [...sel.options].filter(o => !o.disabled && o.value !== "").map(o => ({ valor: o.value, texto: o.textContent }));
    achados = filtrarOpcoes(ops, inp.value);
    lista.textContent = "";
    if (!inp.value.trim()) return fechar();
    if (!achados.length) {
      const v = document.createElement("div");
      v.className = "sel-busca-vazio";
      v.textContent = "Nada com esse nome ou número.";
      lista.append(v);
    }
    achados.slice(0, 40).forEach(o => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = o.texto;
      b.addEventListener("mousedown", e => e.preventDefault());
      b.addEventListener("click", () => pegar(o));
      lista.append(b);
    });
    lista.hidden = false;
  });
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter" && achados.length) {
      e.preventDefault();
      pegar(achados[0]);
    } else if (e.key === "Escape") {
      inp.value = "";
      fechar();
    }
  });
  inp.addEventListener("blur", () => setTimeout(fechar, 150));
}

let ligado = false;
export function ligarBuscaSelect(raiz = document.body) {
  if (ligado) return;
  ligado = true;
  const varrer = n => {
    if (!n || n.nodeType !== 1) return;
    if (n.tagName === "SELECT") enfeitar(n);
    else if (n.tagName === "OPTION" && n.parentElement) enfeitar(n.closest("select"));
    else n.querySelectorAll && n.querySelectorAll("select").forEach(enfeitar);
  };
  varrer(raiz);
  // as listas aparecem (e ganham opções) a toda hora: confere o que entrou
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(varrer))).observe(raiz, { childList: true, subtree: true });
}
