// Aluguel de becas · janela "Becas fora" (24/11/2026): tocar no quadro "Becas fora" mostra o que está fora agora,
// os alunos que retiraram a beca (na mesma linha padrão da lista, com o "Devolver até") e os agendamentos de becas
// dos colégios. Quem passou da devolução vem primeiro, em vermelho (o quadro "Atrasados na devolução" saiu do topo).
import { el, sheet, title } from "./ui.js";
import * as U from "./util.js";
import { nomeBeca } from "./becas-estoque.js";

export function abrirBecasFora(doAno, evsAno, cobre, hoje, linha) {
  const alunos = doAno.filter(a => a.status === "Retirou a beca" && !a.soPaspatur && !a.naoParticipa && !cobre.has(a.instId));
  const eventos = evsAno.filter(e => e.retirada <= hoje && !(e.devolucao && e.devolucao < hoje));
  const atrasado = d => !!d && d < hoje;
  const al = alunos.slice().sort((a, b) => String(a.devolucao || "9").localeCompare(String(b.devolucao || "9")));
  const evs = eventos.slice().sort((a, b) => String(a.devolucao || "9").localeCompare(String(b.devolucao || "9")));
  const nAtr = al.filter(a => atrasado(a.devolucao)).length + evs.filter(e => atrasado(e.devolucao)).length;
  const totEv = e => Object.values(e.becasQtd || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  sheet(
    "👘 Becas fora",
    (p, close) => {
      const n = al.length + evs.reduce((t, e) => t + totEv(e), 0);
      const txt =
        `${n} beca${n === 1 ? "" : "s"} fora agora` + (nAtr ? ` · ⚠️ ${nAtr} passa${nAtr === 1 ? "ou" : "ram"} da devolução` : "");
      p.append(el("p", "hint", txt));
      if (evs.length) {
        p.append(el("h3", null, "Agendamentos dos colégios"));
        evs.forEach(e => {
          const d = el("div", "lc-linha lc-" + (atrasado(e.devolucao) ? "vermelho" : "cinza"));
          const n = el("div", "lc-nome");
          n.append(
            el("b", null, title(e.instNome || "")),
            el(
              "small",
              null,
              Object.entries(e.becasQtd || {})
                .filter(([, v]) => Number(v) > 0)
                .map(([k, v]) => `${v} ${nomeBeca(k)}`)
                .join(" · ")
            ),
            el(
              "small",
              atrasado(e.devolucao) ? "lc-passo late" : "lc-passo",
              `Saiu ${e.retirada ? U.fmtDate(e.retirada) : "—"} · ${atrasado(e.devolucao) ? "⚠️ devolução atrasada desde " : "devolver até "}${e.devolucao ? U.fmtDate(e.devolucao) : "—"}`
            )
          );
          d.append(n, el("span", "lc-selo", `${totEv(e)} becas`));
          p.append(d);
        });
      }
      p.append(el("h3", null, `Alunos com a beca (${al.length})`));
      if (!al.length) p.append(el("p", "hint", "Nenhum aluno com a beca agora."));
      al.forEach(a => p.append(linha(a)));
      p.append(U.mkBtn("Fechar", "", close));
    },
    { div: true, wide: true }
  );
}
