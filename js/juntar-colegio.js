// PR, Paspatur e Formatura (só o Adriano): "🔀 Juntar com outro colégio". Quando a planilha veio com o colégio errado
// (ex.: "G" e "M", que eram o tamanho da beca, no lugar de "C.E. Roberto Lyra"), passa os alunos daquele colégio e ano
// para o colégio certo e acerta a lista de escolas. Nada é apagado.
import { el, sheet } from "./ui.js";
import * as U from "./util.js";
import { confirmar } from "./confirmar.js";

// a lista de escolas (meta) depois de juntar: os nomes de "de" (naquele ano) passam a contar em "para"
export function metaJuntada(meta, de, para) {
  const m = {
    escolas: Object.assign({}, meta.escolas),
    anos: Object.assign({}, meta.anos),
    escolasAno: Object.assign({}, meta.escolasAno)
  };
  let n = 0;
  de.nomes.forEach(nome => {
    const k = nome + "|" + de.ano;
    const q = Number(m.escolasAno[k]) || 0;
    if (!q) return;
    n += q;
    delete m.escolasAno[k];
    m.escolas[nome] = (Number(m.escolas[nome]) || 0) - q;
    if (m.escolas[nome] <= 0) delete m.escolas[nome];
  });
  const alvo = para.nomes[0];
  m.escolasAno[alvo + "|" + para.ano] = (Number(m.escolasAno[alvo + "|" + para.ano]) || 0) + n;
  m.escolas[alvo] = (Number(m.escolas[alvo]) || 0) + n;
  if (de.ano !== para.ano) {
    m.anos[de.ano] = Math.max(0, (Number(m.anos[de.ano]) || 0) - n);
    m.anos[para.ano] = (Number(m.anos[para.ano]) || 0) + n;
  }
  return m;
}

// C = contexto; grupos = lista de escolas (gruposPR); de = o grupo escolhido; colNome/metaNome = a lista atual
export function abrirJuntar(C, { grupos, de, colNome, metaNome, aoTerminar }) {
  const outros = grupos.filter(g => g.valor !== de.valor);
  if (!outros.length) return U.toast("Não há outro colégio para juntar.");
  sheet("🔀 Juntar com outro colégio", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        `Os ${de.n} alunos de “${de.rotulo}” passam para o colégio escolhido abaixo. Nada é apagado; só o nome do colégio muda.`
      )
    );
    const s = el("select");
    s.setAttribute("aria-label", "Colégio certo");
    outros
      .slice()
      .sort((a, b) => (b.ano === de.ano) - (a.ano === de.ano) || b.ano - a.ano || a.nome.localeCompare(b.nome, "pt-BR"))
      .forEach(g => {
        const o = el("option", null, `${g.rotulo} (${g.n})`);
        o.value = g.valor;
        s.append(o);
      });
    const f = el("div", "field");
    const l = el("label", null, "Colégio certo");
    s.id = "juntarPara";
    l.htmlFor = s.id;
    f.append(l, s);
    const a = el("div", "panel-actions");
    const ok = el("button", "btn btn-primary", "Juntar");
    ok.type = "submit";
    a.append(el("span"), U.mkBtn("Cancelar", "", close), ok);
    a.firstChild.style.flex = "1";
    p.append(f, a);
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const para = outros.find(g => g.valor === s.value);
      if (!(await confirmar("Juntar os colégios?", `Passar os ${de.n} alunos de “${de.rotulo}” para “${para.rotulo}”?`))) return;
      ok.disabled = true;
      try {
        const { FS, db } = C;
        const col = FS.collection(db, colNome);
        let n = 0;
        for (let i = 0; i < de.nomes.length; i += 30) {
          const q = await FS.getDocs(FS.query(col, FS.where("escola", "in", de.nomes.slice(i, i + 30)), FS.where("ano", "==", de.ano)));
          for (let k = 0; k < q.docs.length; k += 400) {
            const b = FS.writeBatch(db);
            q.docs.slice(k, k + 400).forEach(d =>
              b.update(d.ref, {
                escola: para.nomes[0],
                ano: para.ano,
                escolaAntes: d.data().escola,
                atualizadoEm: new Date().toISOString()
              })
            );
            await b.commit();
          }
          n += q.size;
        }
        const ref = FS.doc(db, "config", metaNome);
        const m = (await FS.getDoc(ref)).data() || {};
        await FS.setDoc(ref, Object.assign({}, m, metaJuntada(m, de, para)));
        U.toast(`${n} aluno${n === 1 ? "" : "s"} passaram para ${para.rotulo} ✅`);
        close();
        if (aoTerminar) aoTerminar();
      } catch (e) {
        ok.disabled = false;
        C.handleErr(e);
      }
    });
  });
}
