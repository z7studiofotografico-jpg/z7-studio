// 🛍️ Produtos vendidos junto com o aluguel (separado de aluguel-alunos.js pelo limite de linhas)
import { el, title, sheet, botoes } from "./ui.js";
import * as U from "./util.js";
import { brl } from "./regras.js";
import { DO_ALUGUEL } from "./catalogo.js";
import { carregarCatalogo, reservar, desfazerReserva } from "./estoque.js";

// Produtos vendidos junto com o aluguel (item 3.4): reserva no estoque ao incluir; baixa quando retira
export async function produtos(C, a, salvar) {
  let cat;
  try {
    cat = await carregarCatalogo(C);
  } catch (e) {
    return C.handleErr(e);
  }
  sheet("🛍️ Produtos de " + U.first(title(a.nome || "")), (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "O que o aluno levou junto com o aluguel (a foto é tirada no dia de medir a beca). Os preços vêm de Produtos e estoque."
      )
    );
    const atual = {};
    (a.produtos || []).filter(x => x.estado !== "estornado").forEach(x => (atual[x.produto] = (atual[x.produto] || 0) + x.qtd));
    const linhas = DO_ALUGUEL.map(id => cat.find(x => x.id === id))
      .filter(Boolean)
      .map(pr => {
        const r = el("div", "prow");
        const q = el("input");
        q.inputMode = "numeric";
        q.className = "preco";
        q.value = atual[pr.id] || "";
        q.placeholder = "0";
        q.setAttribute("aria-label", "Quantidade de " + pr.nome);
        const baixado = (a.produtos || []).some(x => x.produto === pr.id && x.estado === "baixado");
        q.disabled = baixado;
        r.append(el("span", null, `${pr.nome}${pr.preco ? " · " + brl(pr.preco) : ""}${baixado ? " (já entregue)" : ""}`), q);
        p.append(r);
        return [pr, q];
      });
    const err = el("p", "err");
    err.hidden = true;
    p.append(err, botoes(close, "Salvar produtos"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const novos = [],
        tirar = [],
        poe = [];
      linhas.forEach(([pr, q]) => {
        if (q.disabled) return;
        const n = Math.max(0, parseInt(q.value, 10) || 0),
          antes = (a.produtos || []).filter(x => x.produto === pr.id && x.estado === "reservado").reduce((t, x) => t + x.qtd, 0);
        if (n > antes) poe.push({ produto: pr.id, qtd: n - antes });
        if (n < antes) tirar.push({ produto: pr.id, qtd: antes - n });
        if (n) novos.push({ produto: pr.id, nome: pr.nome, qtd: n, valor: Number(pr.preco) || 0, estado: "reservado", origem: "Aluguel" });
      });
      try {
        if (tirar.length) await desfazerReserva(C, tirar, { ref: "alugueis/" + a.id, modulo: "aluguel" });
        if (poe.length) await reservar(C, poe, { ref: "alugueis/" + a.id, modulo: "aluguel" });
        const ficam = (a.produtos || []).filter(x => x.estado !== "reservado");
        await salvar(a, { produtos: [...ficam, ...novos] }, "Produtos salvos");
        close();
      } catch (e) {
        err.textContent = e.message || String(e);
        err.hidden = false;
      }
    });
  });
}
