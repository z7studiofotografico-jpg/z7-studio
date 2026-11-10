// Aluguel de becas: abas da janela do aluno (Colégio e contrato · Histórico). O Resumo é o cartão de aluguel-alunos.js.
import { el, title } from "./ui.js";
import * as U from "./util.js";

export function abaColegio(box, a, { C, inst, doCol, verColegio }) {
  box.append(el("h3", null, "🏫 " + title(a.instNome || (inst && inst.nome) || "Colégio")));
  if (inst) {
    const meta = el("div", "meta");
    [
      inst.etapa ? "Instituição: " + inst.etapa.toLowerCase() : "",
      [title(inst.endereco?.bairro), title(inst.endereco?.cidade)].filter(Boolean).join(" · "),
      C.nomeDe(inst) ? "👤 " + U.first(C.nomeDe(inst)) : ""
    ].forEach(t => t && meta.append(el("span", "tag", t)));
    box.append(meta);
    const cs = (inst.contatos || []).filter(c => c.nome || c.tel);
    if (cs.length)
      box.append(el("div", "phone", cs.map(c => [c.nome && title(c.nome), c.cargo, c.tel].filter(Boolean).join(" · ")).join("  |  ")));
  }
  box.append(el("p", "hint", `${doCol.length} aluno${doCol.length === 1 ? "" : "s"} deste colégio alugaram becas em ${a.ano || "—"}.`));
  box.append(
    el("p", "hint", "O Contrato do colégio guarda quem paga, o valor, as parcelas, o pacote de cada aluno e a produção."),
    U.mkBtn("📄 Abrir o Contrato do colégio", "btn-primary", () =>
      import("./contrato-colegio.js")
        .then(m =>
          m.abrirContrato(C, Object.assign({ id: a.instId, nome: a.instNome || "" }, inst || {}), String(a.ano || new Date().getFullYear()))
        )
        .catch(e => C.handleErr(e))
    ),
    U.mkBtn("Ver só os alunos deste colégio", "", verColegio)
  );
}
export function abaHistorico(box, a) {
  const h = (a.historico || []).slice().reverse();
  if (a.criadoEm || a.importacao)
    h.push({ txt: a.importacao ? "Veio da planilha" : "Cadastrado", em: a.criadoEm || (a.importacao && a.importacao.em) || "" });
  if (!h.length) return box.append(el("div", "empty", "Nada registrado ainda."));
  h.forEach(x =>
    box.append(
      el(
        "p",
        "notes",
        [
          x.em ? U.fmtDate(String(x.em).slice(0, 10)) + "/" + String(x.em).slice(0, 4) : "",
          x.txt || [x.de, x.para].filter(Boolean).join(" → "),
          x.por ? U.first(x.por) : ""
        ]
          .filter(Boolean)
          .join(" · ")
      )
    )
  );
}
