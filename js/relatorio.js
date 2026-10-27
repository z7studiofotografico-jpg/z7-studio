// Relatório para imprimir (ou salvar em PDF) de cada card, para levar a uma reunião.
// Cada tela monta o conteúdo com os dados que já estão na tela (a equipe só vê o que é dela) e chama abrirRelatorio.
// conteudo = { titulo, subtitulo, secoes: [{ titulo, nota, kpis: [[rótulo, valor]], tabela: { cols: [...], linhas: [[...]] } }] }
import { el } from "./ui.js";
import * as U from "./util.js";

export function abrirRelatorio(conteudo, quem) {
  fecharRelatorio();
  const r = el("div");
  r.id = "relatorio";
  r.setAttribute("role", "dialog");
  r.setAttribute("aria-label", "Relatório: " + conteudo.titulo);
  const barra = el("div", "rel-barra");
  barra.append(
    U.mkBtn("🖨️ Imprimir ou salvar em PDF", "btn-primary", () => window.print()),
    U.mkBtn("Fechar", "", fecharRelatorio)
  );
  const folha = el("div", "rel-folha");
  const cab = el("div", "rel-cab");
  const agora = new Date();
  cab.append(
    el("div", "rel-marca", "Z7 Studio Fotográfico"),
    el("h1", null, conteudo.titulo),
    el(
      "p",
      "rel-sub",
      [
        conteudo.subtitulo,
        `Gerado em ${U.fmtDate(U.ds(agora))}/${agora.getFullYear()} às ${U.hhmm(agora.toISOString())}`,
        quem ? "por " + quem : ""
      ]
        .filter(Boolean)
        .join(" · ")
    )
  );
  folha.append(cab);
  (conteudo.secoes || []).forEach(s => folha.append(secao(s)));
  r.append(barra, folha);
  document.body.append(r);
  document.body.classList.add("imprimindo");
  return r;
}
export function fecharRelatorio() {
  const r = document.getElementById("relatorio");
  if (r) r.remove();
  document.body.classList.remove("imprimindo");
}
function secao(s) {
  const box = el("section", "rel-secao");
  if (s.titulo) box.append(el("h2", null, s.titulo));
  if (s.nota) box.append(el("p", "rel-nota", s.nota));
  if (s.kpis && s.kpis.length) {
    const k = el("div", "rel-kpis");
    s.kpis.forEach(([rot, val]) => {
      const c = el("div", "rel-kpi");
      c.append(el("small", null, rot), el("b", null, String(val)));
      k.append(c);
    });
    box.append(k);
  }
  if (s.no) box.append(s.no);
  if (s.tabela) {
    const { cols, linhas } = s.tabela;
    if (!linhas.length) box.append(el("p", "rel-nota", s.vazio || "Nada para mostrar."));
    else {
      const t = el("table", "rel-tab"),
        th = el("thead"),
        tr = el("tr");
      cols.forEach(c => tr.append(el("th", null, c)));
      th.append(tr);
      const tb = el("tbody");
      linhas.forEach(l => {
        const x = el("tr");
        l.forEach(v => x.append(el("td", null, v == null ? "" : String(v))));
        tb.append(x);
      });
      t.append(th, tb);
      box.append(t);
    }
  }
  return box;
}
// Cópia de um pedaço da tela para o relatório: gráficos viram imagem e os botões saem
export function copiaDaTela(orig) {
  const c = orig.cloneNode(true);
  c.removeAttribute("id");
  c.querySelectorAll("[id]").forEach(x => x.removeAttribute("id"));
  const telas = orig.querySelectorAll("canvas"),
    copias = c.querySelectorAll("canvas");
  copias.forEach((cv, i) => {
    const img = document.createElement("img");
    try {
      // gráfico ainda animando: desenha o estado final antes de copiar
      const g = window.Chart && window.Chart.getChart && window.Chart.getChart(telas[i]);
      if (g) {
        g.stop();
        g.update("none");
      }
      img.src = telas[i].toDataURL("image/png");
    } catch (e) {
      cv.remove();
      return;
    }
    img.alt = cv.getAttribute("aria-label") || "Gráfico";
    img.className = "rel-graf";
    cv.replaceWith(img);
  });
  c.querySelectorAll("button, input, select, textarea").forEach(x => x.remove());
  c.classList.add("rel-copia");
  return c;
}
// Botão padrão do cabeçalho das telas
export function botaoRelatorio(montar, quem) {
  return U.mkBtn("🖨️ Relatório", "btn-sm", async () => {
    try {
      abrirRelatorio(await montar(), quem && quem());
    } catch (e) {
      console.warn("[Z7] relatório", e);
      U.toast("Não foi possível montar o relatório agora.");
    }
  });
}
// Contagem por chave: [[chave, n], ...] em ordem decrescente
export function contar(lista, fn) {
  const m = {};
  lista.forEach(x => {
    const k = fn(x) || "—";
    m[k] = (m[k] || 0) + 1;
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
