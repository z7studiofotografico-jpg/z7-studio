// PR · aba Provável venda (24/11/2026): uma agenda pela data e hora do retorno marcado (📅 Data de retorno),
// o mais perto primeiro, separada por dia (atrasados, hoje, próximos). Quem ainda não tem o retorno marcado fica no
// topo, para o representante marcar.
import { el } from "./ui.js";
import * as U from "./util.js";

const quando = it => (it.retorno && it.retorno.data && it.retorno.hora ? `${it.retorno.data}T${it.retorno.hora}` : "");

export function renderProvavel(list, arr, linha, ordem) {
  arr.sort((a, b) => (quando(a) || "0").localeCompare(quando(b) || "0") || ordem(a, b));
  const hoje = U.todayStr();
  const grp = it => {
    const q = quando(it);
    if (!q) return "⚠️ Sem data de retorno: toque no aluno e marque o dia e a hora";
    const d = q.slice(0, 10);
    const dia = `${U.fmtDate(d)}/${d.slice(0, 4)}`;
    return d < hoje ? `🔴 Atrasados · ${dia}` : d === hoje ? `📅 Hoje · ${dia}` : `📅 ${dia}`;
  };
  let last = null;
  arr.forEach(it => {
    const g = grp(it);
    if (g !== last) {
      const h = el("h3", "grp", g);
      h.style.gridColumn = "1/-1";
      list.append(h);
      last = g;
    }
    list.append(linha(it));
  });
}
