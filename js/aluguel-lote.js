// ⏩ Avançar o colégio inteiro (Aluguel de becas, 13/11/2026): quando vamos ao colégio medimos todo mundo, então
// passa todos de uma etapa para a próxima de uma vez (ex.: Cadastrado → Beca medida), sem ir de 1 em 1.
// Só para a frente e uma etapa por vez. Quem não dá para passar (sem tamanho, sem estoque) fica de fora e aparece na lista.
import { el, title, sheet } from "./ui.js";
import * as U from "./util.js";
import { confirmar } from "./confirmar.js";
import { STATUS_ALUGUEL, proximoStatus } from "./aluguel-alunos.js";

// as etapas que têm alunos no colégio: [de, para, alunos]
export function etapasDoColegio(alunos) {
  const m = new Map();
  alunos.forEach(a => {
    const de = a.status || "Cadastrado";
    const para = proximoStatus(a);
    if (!para) return;
    const k = de + "→" + para;
    if (!m.has(k)) m.set(k, [de, para, []]);
    m.get(k)[2].push(a);
  });
  return [...m.values()].sort((x, y) => STATUS_ALUGUEL.indexOf(x[0]) - STATUS_ALUGUEL.indexOf(y[0]));
}

export function avancarColegio(C, alunos, mudarStatus) {
  const etapas = etapasDoColegio(alunos);
  const nome = title((alunos[0] || {}).instNome || "Colégio");
  sheet("⏩ Avançar o colégio inteiro", (p, close) => {
    p.append(el("p", "hint", `${nome}: escolha a etapa. Todos os alunos dela passam para a próxima de uma vez.`));
    if (!etapas.length) {
      p.append(el("p", "empty", "Nenhum aluno para avançar."), U.mkBtn("Fechar", "", close));
      return;
    }
    const lista = el("div", "lote-etapas");
    const msg = el("div");
    etapas.forEach(([de, para, als]) => {
      const b = U.mkBtn(`${de} (${als.length}) → ${para}`, "btn-primary", async () => {
        const ok = await confirmar(`Passar ${als.length} alunos?`, `De “${de}” para “${para}”: ${nome}.`, {
          sim: "Sim, passar todos",
          nao: "Não"
        });
        if (!ok) return;
        lista.querySelectorAll("button").forEach(x => (x.disabled = true));
        const pulados = [];
        let feitos = 0;
        for (const a of [...als].sort((x, y) =>
          String(x.codigo || x.nome).localeCompare(String(y.codigo || y.nome), "pt-BR", { numeric: true })
        )) {
          msg.textContent = `Passando ${feitos + pulados.length + 1} de ${als.length}…`;
          const r = await mudarStatus(a, para, true);
          if (r === "ok") feitos++;
          else pulados.push(`${a.codigo ? a.codigo + " · " : ""}${title(a.nome)}: ${r}`);
        }
        msg.textContent = "";
        msg.append(el("p", "notice", `✅ ${feitos} aluno${feitos === 1 ? "" : "s"} em “${para}”.`));
        if (pulados.length) {
          msg.append(el("p", "hint", `⚠️ ${pulados.length} ficaram em “${de}” (abra e acerte cada um):`));
          const ul = el("ul");
          pulados.forEach(t => ul.append(el("li", null, t)));
          msg.append(ul);
        }
      });
      lista.append(b);
    });
    p.append(lista, msg, U.mkBtn("Fechar", "", close));
  });
}
