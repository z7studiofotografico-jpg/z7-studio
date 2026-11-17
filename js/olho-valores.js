// 👁 Valores escondidos (17/11/2026): todo valor em R$ do app fica apagado até tocar no olho (no topo). Vale para o
// admin e para a equipe, em todas as telas, sem precisar mexer em cada uma: um observador acha os textos com "R$"
// e põe cada valor num <span class="vlr">. A escolha fica guardada neste aparelho. Na impressão os valores saem.
const CHAVE = "z7verValores";
const RE = /R\$\s?-?[\d.]+(?:,\d{2})?/g;
const PULAR = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CANVAS", "SVG"]);

export const verValores = () => {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch (_) {
    return false;
  }
};
function aplicar(ver) {
  document.body.classList.toggle("ver-valores", ver);
  const b = document.getElementById("btnOlho");
  if (b) {
    b.textContent = ver ? "👁" : "🙈";
    b.setAttribute("aria-pressed", String(ver));
    b.title = ver ? "Esconder os valores" : "Mostrar os valores";
    b.setAttribute("aria-label", b.title);
  }
}
// põe os valores de um texto em <span class="vlr">
function marcarTexto(n) {
  const t = n.nodeValue;
  if (!t || t.indexOf("R$") < 0) return;
  const p = n.parentNode;
  if (!p || PULAR.has(p.nodeName) || (p.classList && p.classList.contains("vlr")) || p.closest("[data-sem-olho]")) return;
  RE.lastIndex = 0;
  if (!RE.test(t)) return;
  RE.lastIndex = 0;
  const frag = document.createDocumentFragment();
  let i = 0,
    m;
  while ((m = RE.exec(t))) {
    if (m.index > i) frag.append(t.slice(i, m.index));
    const s = document.createElement("span");
    s.className = "vlr";
    s.textContent = m[0];
    frag.append(s);
    i = m.index + m[0].length;
  }
  if (i < t.length) frag.append(t.slice(i));
  p.replaceChild(frag, n);
}
function varrer(raiz) {
  if (!raiz) return;
  if (raiz.nodeType === 3) return marcarTexto(raiz);
  if (raiz.nodeType !== 1 || PULAR.has(raiz.nodeName)) return;
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const nos = [];
  while (w.nextNode()) nos.push(w.currentNode);
  nos.forEach(marcarTexto);
}
export function ligarOlho() {
  const b = document.getElementById("btnOlho");
  if (b)
    b.onclick = () => {
      const ver = !verValores();
      try {
        localStorage.setItem(CHAVE, ver ? "1" : "0");
      } catch (_) {}
      aplicar(ver);
    };
  aplicar(verValores());
  varrer(document.body);
  new MutationObserver(ms =>
    ms.forEach(m => {
      if (m.type === "characterData") marcarTexto(m.target);
      else m.addedNodes.forEach(varrer);
    })
  ).observe(document.body, { childList: true, subtree: true, characterData: true });
}
