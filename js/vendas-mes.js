// (25/11/2026) Tocar no "Vendido no mês" do PR abre todas as vendas do mês: o total, quanto cada vendedor vendeu,
// PR × Paspatur, a forma de pagamento e a lista (uma linha por aluno, no padrão das listas; tocar abre o aluno).
import { el, title, sheet } from "./ui.js";
import * as U from "./util.js";
import { vendaDe } from "./repasse-estado.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function somar(lista, chave) {
  const m = new Map();
  lista.forEach(x => {
    const k = chave(x) || "—";
    const g = m.get(k) || { n: 0, v: 0 };
    g.n++;
    g.v += Number(x.valor) || 0;
    m.set(k, g);
  });
  return [...m.entries()].sort((a, b) => b[1].v - a[1].v);
}
function quadro(tit, linhas) {
  const t = el("table", "rel-tab");
  const h = el("tr");
  [tit, "Vendas", "Valor"].forEach((c, i) => h.append(el("th", i ? "n" : null, c)));
  t.append(h);
  linhas.forEach(([k, g]) => {
    const r = el("tr");
    r.append(el("td", null, k), el("td", "n", String(g.n)), el("td", "n", U.money(g.v)));
    t.append(r);
  });
  return t;
}

// vm = { n, v, lista } (o mesmo do número do topo); linha = a linha do aluno da lista do PR
export function abrirVendasMes(vm, linha) {
  const lista = (vm.lista || []).slice().sort((a, b) => String(b.pagoEm || "").localeCompare(String(a.pagoEm || "")));
  const hoje = new Date();
  sheet(
    `💰 Vendas de ${MESES[hoje.getMonth()]}`,
    (p, fechar) => {
      p.append(
        el(
          "p",
          "hint",
          `${lista.length} venda${lista.length === 1 ? "" : "s"} pagas neste mês · ${U.money(lista.reduce((a, x) => a + (Number(x.valor) || 0), 0))}`
        )
      );
      if (!lista.length) return p.append(el("p", "hint", "Nenhuma venda paga neste mês ainda."));
      p.append(
        quadro(
          "Vendedor",
          somar(lista, x => title(x.resp || (x.respEmail || "").split("@")[0]) || "Sem vendedor")
        ),
        quadro(
          "Produto",
          somar(lista, x => (vendaDe(x) === "paspatur" ? "Paspatur" : vendaDe(x) === "formatura" ? "Formatura" : "PR"))
        ),
        quadro(
          "Pagamento",
          somar(lista, x => x.formaPag || "")
        )
      );
      const dias = new Map();
      lista.forEach(x => {
        const d = x.pagoEm || "";
        if (!dias.has(d)) dias.set(d, []);
        dias.get(d).push(x);
      });
      const box = el("div", "lc-lista");
      dias.forEach((xs, d) => {
        box.append(
          el(
            "h4",
            "lc-dia",
            `${d ? U.fmtDate(d) : "Sem data"} · ${xs.length} venda${xs.length === 1 ? "" : "s"} · ${U.money(xs.reduce((a, x) => a + (Number(x.valor) || 0), 0))}`
          )
        );
        xs.forEach(x => box.append(linha(x)));
      });
      p.append(box);
      const b = el("button", "btn", "Fechar");
      b.type = "button";
      b.onclick = fechar;
      const act = el("div", "actions");
      act.append(b);
      p.append(act);
    },
    { div: true }
  );
}
