// Formaturas: a virada da Linha de Frente para o Repasse é feita à mão, colégio por colégio (Etapa 5).
// A partir de 1º de fevereiro o Adriano vê um aviso com os colégios do ano anterior que ainda não viraram.
// config/formatura_meta: escolasAno (gravado na importação) e viradas = { "<ano>|<chave>": { em, por } }.
import { el, sheet } from "./ui.js";
import * as U from "./util.js";
import { gruposEscolas } from "./escolas-pr.js";
import { confirmar } from "./confirmar.js";

// a partir de 1º de fevereiro: quais anos anteriores olhar (o ano passado e o retrasado)
export function anosParaVirar(hoje = U.todayStr()) {
  const ano = Number(hoje.slice(0, 4)),
    mes = Number(hoje.slice(5, 7));
  return mes < 2 ? [] : [ano - 1, ano - 2];
}

async function lerMeta(C) {
  const s = await C.FS.getDoc(C.FS.doc(C.db, "config", "formatura_meta"));
  return s.exists() ? s.data() : {};
}

export async function avisoVirada(C, caixa) {
  try {
    const { FS, db } = C;
    const col = FS.collection(db, "formaturaAlunos");
    // só contagem, com filtros de igualdade (não precisa de índice novo no Firebase)
    const ns = await Promise.all(
      anosParaVirar().map(a =>
        FS.getCountFromServer(FS.query(col, FS.where("seg", "==", "lf"), FS.where("ano", "==", a))).then(c => c.data().count)
      )
    );
    const n = ns.reduce((x, y) => x + y, 0);
    if (!n) return;
    caixa.hidden = false;
    caixa.textContent = "";
    caixa.append(
      el(
        "b",
        null,
        `⚠️ ${n} aluno${n > 1 ? "s" : ""} de turmas anteriores ainda na Linha de Frente. ` +
          "Já passou de 1º de fevereiro: confira e faça a virada para o Repasse."
      ),
      " ",
      U.mkBtn("🔁 Fazer a virada", "btn-sm", () => abrirVirada(C))
    );
  } catch (_) {}
}

export async function abrirVirada(C) {
  let meta;
  try {
    meta = await lerMeta(C);
  } catch (e) {
    return C.handleErr(e);
  }
  const viradas = meta.viradas || {};
  const grupos = gruposEscolas(meta);
  sheet("Virada para o Repasse", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "Escolha o colégio. Os alunos dele que ainda estão na Linha de Frente passam para o Repasse. " +
          "Ninguém é apagado e o histórico continua igual."
      )
    );
    if (!grupos.length) p.append(el("div", "empty", "Nenhum colégio importado na Formatura ainda."));
    grupos.forEach(g => {
      const linha = el("div", "virada-linha");
      const v = viradas[g.valor];
      linha.append(el("span", null, `${g.rotulo} (${g.n})` + (v ? ` · virou em ${U.fmtDate(v.em)}` : "")));
      if (!v)
        linha.append(
          U.mkBtn("Virou Repasse", "btn-sm", async ev => {
            const ok = await confirmar("Virar para o Repasse?", `Passar os alunos de ${g.rotulo} da Linha de Frente para o Repasse?`);
            if (!ok) return;
            ev.target.disabled = true;
            try {
              const n = await virarColegio(C, g);
              U.toast(`${g.rotulo}: ${n} aluno${n === 1 ? "" : "s"} no Repasse.`);
              close();
            } catch (e) {
              ev.target.disabled = false;
              C.handleErr(e);
            }
          })
        );
      p.append(linha);
    });
  });
}

// todos os alunos daquele colégio e ano com seg "lf" passam para "rep" (em partes de 400 gravações)
export async function virarColegio(C, g) {
  const { FS, db } = C;
  const col = FS.collection(db, "formaturaAlunos");
  let n = 0;
  for (const nome of g.nomes) {
    const s = await FS.getDocs(FS.query(col, FS.where("escola", "==", nome), FS.where("ano", "==", g.ano), FS.where("seg", "==", "lf")));
    for (let i = 0; i < s.docs.length; i += 400) {
      const b = FS.writeBatch(db);
      s.docs
        .slice(i, i + 400)
        .forEach(d => b.update(d.ref, { seg: "rep", viradaEm: U.todayStr(), atualizadoEm: new Date().toISOString() }));
      await b.commit();
    }
    n += s.docs.length;
  }
  await FS.setDoc(
    FS.doc(db, "config", "formatura_meta"),
    { viradas: { [g.valor]: { em: U.todayStr(), por: C.me || "", n } } },
    { merge: true }
  );
  return n;
}
