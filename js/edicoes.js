// Edições da equipe (pedido do Adriano): quando alguém da equipe corrige os dados ou os contatos de um aluno do PR,
// Paspatur ou Formatura, fica um aviso com QUAL aluno, O QUE mudou e QUEM editou. Só o Adriano vê e marca como visto.
// Coleção "edicoes": { col, alunoId, aluno, escola, ano, campos: [...], por, porEmail, em, visto }
import { el, sheet, title } from "./ui.js";
import * as U from "./util.js";

const NOMES = { repasse: "PR", paspatur: "Paspatur", formaturaAlunos: "Formatura" };
export const textoEdicao = x =>
  `${title(x.aluno || "")} (${NOMES[x.col] || x.col}${x.escola ? " · " + title(x.escola) : ""}${x.ano ? " · " + x.ano : ""}) — editado por ${
    x.por || x.porEmail || "?"
  } em ${U.fmtDate(String(x.em).slice(0, 10))} às ${String(x.em).slice(11, 16)}: ${(x.campos || []).join("; ")}`;

async function pendentes(C) {
  const s = await C.FS.getDocs(C.FS.query(C.FS.collection(C.db, "edicoes"), C.FS.where("visto", "==", false), C.FS.limit(200)));
  return s.docs.map(d => Object.assign({ id: d.id, ref: d.ref }, d.data())).sort((a, b) => String(b.em).localeCompare(String(a.em)));
}
// faixa no topo do PR (só admin): "✏️ 3 edições da equipe para ver"
export async function faixaEdicoes(C, caixa) {
  if (!C.isAdmin || !caixa) return;
  try {
    const l = await pendentes(C);
    caixa.textContent = "";
    caixa.hidden = !l.length;
    if (!l.length) return;
    caixa.append(
      el("b", null, `✏️ ${l.length} edição${l.length > 1 ? "ões" : ""} de dados feita${l.length > 1 ? "s" : ""} pela equipe. `),
      U.mkBtn("Ver quem editou", "btn-sm", () => abrirEdicoes(C, () => faixaEdicoes(C, caixa)))
    );
  } catch (e) {
    console.warn("[Z7] edições", e);
  }
}
export async function abrirEdicoes(C, depois) {
  let l = [];
  try {
    l = await pendentes(C);
  } catch (e) {
    return C.handleErr(e);
  }
  sheet("✏️ Edições da equipe", (p, close) => {
    if (!l.length) p.append(el("div", "empty", "Nenhuma edição nova."));
    const marcar = async xs => {
      const b = C.FS.writeBatch(C.db);
      xs.forEach(x => b.update(x.ref, { visto: true, vistoEm: new Date().toISOString() }));
      await b.commit();
    };
    l.forEach(x => {
      const r = el("div", "virada-linha");
      r.append(
        el("span", null, textoEdicao(x)),
        U.mkBtn("Visto", "btn-sm", async ev => {
          try {
            await marcar([x]);
            ev.target.closest(".virada-linha").remove();
          } catch (e) {
            C.handleErr(e);
          }
        })
      );
      p.append(r);
    });
    const a = el("div", "panel-actions");
    a.append(
      el("span"),
      U.mkBtn("Fechar", "", () => (close(), depois && depois()))
    );
    if (l.length)
      a.append(
        U.mkBtn("Marcar todas como vistas", "btn-primary", async () => {
          try {
            await marcar(l);
            close();
            if (depois) depois();
          } catch (e) {
            C.handleErr(e);
          }
        })
      );
    a.firstChild.style.flex = "1";
    p.append(a);
  });
}
