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

// ---------- excluir e acertar a lista de colégios (a "janela cinza") ----------
export const META_DE = { repasse: "repasse_meta", paspatur: "paspatur_meta", formaturaAlunos: "formatura_meta" };
// tira da lista de escolas os alunos apagados: menos = [{ escola, ano }]
export function metaMenos(meta, menos) {
  const m = {
    escolas: Object.assign({}, meta.escolas),
    anos: Object.assign({}, meta.anos),
    escolasAno: Object.assign({}, meta.escolasAno)
  };
  const tira = (o, k) => {
    if (!k) return;
    o[k] = (Number(o[k]) || 0) - 1;
    if (o[k] <= 0) delete o[k];
  };
  menos.forEach(a => {
    tira(m.escolas, a.escola);
    tira(m.anos, a.ano ? String(a.ano) : "");
    tira(m.escolasAno, a.escola && a.ano ? a.escola + "|" + a.ano : "");
  });
  return m;
}
async function atualizarMeta(C, colNome, menos) {
  const nome = META_DE[colNome];
  if (!nome || !menos.length) return;
  const ref = C.FS.doc(C.db, "config", nome);
  const m = (await C.FS.getDoc(ref)).data() || {};
  await C.FS.setDoc(ref, Object.assign({}, m, metaMenos(m, menos)));
}
// apaga UM aluno (o 🗑️ do cartão) e já tira ele da lista de colégios; no PR, tira também os telefones do índice
export async function apagarAluno(C, colNome, it) {
  const { FS, db } = C;
  const b = FS.writeBatch(db);
  if (colNome === "repasse") {
    const { entradasFones } = await import("./pedidos.js");
    entradasFones(it.id, it).forEach(([t]) => b.set(FS.doc(db, "fones", t), { alunos: { [it.id]: FS.deleteField() } }, { merge: true }));
  }
  b.delete(FS.doc(db, colNome, it.id));
  await b.commit();
  await atualizarMeta(C, colNome, [{ escola: it.escola, ano: it.ano }]).catch(e => console.warn("[Z7] lista de colégios", e));
}
// apaga TODOS os alunos de um colégio e ano (importou o ano errado, turma duplicada…)
export async function excluirColegio(C, { de, colNome, aoTerminar }) {
  const { FS, db } = C;
  const col = FS.collection(db, colNome);
  const docs = [];
  for (let i = 0; i < de.nomes.length; i += 30) {
    const q = await FS.getDocs(FS.query(col, FS.where("escola", "in", de.nomes.slice(i, i + 30)), FS.where("ano", "==", de.ano)));
    q.forEach(d => docs.push(d));
  }
  const vendidos = docs.filter(d => ["PAGO", "ENTREGUE"].includes(d.data().etapa) && !d.data().historico).length;
  if (
    !(await confirmar(
      "Excluir o colégio inteiro?",
      `Apagar os ${docs.length} alunos de “${de.rotulo}”? ` +
        (vendidos ? `⚠️ ${vendidos} deles têm venda registrada no app. ` : "") +
        "O colégio sai da lista. Não dá para desfazer (só pela cópia de segurança).",
      { perigo: true, sim: "Sim, excluir tudo" }
    ))
  )
    return false;
  let feitos = 0;
  const { entradasFones } = colNome === "repasse" ? await import("./pedidos.js") : {};
  for (let i = 0; i < docs.length; i += 200) {
    const b = FS.writeBatch(db);
    docs.slice(i, i + 200).forEach(d => {
      if (entradasFones)
        entradasFones(d.id, d.data()).forEach(([t]) =>
          b.set(FS.doc(db, "fones", t), { alunos: { [d.id]: FS.deleteField() } }, { merge: true })
        );
      b.delete(d.ref);
    });
    await b.commit();
    feitos += Math.min(200, docs.length - i);
  }
  // a lista: esse colégio e ano saem por inteiro (mesmo se a conta estava errada)
  const ref = FS.doc(db, "config", META_DE[colNome]);
  const m = (await FS.getDoc(ref)).data() || {};
  const nova = metaMenos(
    m,
    docs.map(d => ({ escola: d.data().escola, ano: d.data().ano }))
  );
  de.nomes.forEach(n => delete nova.escolasAno[n + "|" + de.ano]);
  await FS.setDoc(ref, Object.assign({}, m, nova));
  U.toast(`${feitos} aluno${feitos === 1 ? "" : "s"} de ${de.rotulo} excluído${feitos === 1 ? "" : "s"} ✅`);
  if (aoTerminar) aoTerminar();
  return true;
}
// confere cada colégio e ano da lista contando os alunos de verdade (tira os que não têm mais ninguém)
export async function acertarLista(C, { colNome, aoTerminar }) {
  const { FS, db } = C;
  const ref = FS.doc(db, "config", META_DE[colNome]);
  const m = (await FS.getDoc(ref)).data() || {};
  const col = FS.collection(db, colNome);
  const escolasAno = {};
  let mudou = 0;
  for (const k of Object.keys(m.escolasAno || {})) {
    const i = k.lastIndexOf("|");
    const escola = k.slice(0, i),
      ano = Number(k.slice(i + 1));
    const n = (await FS.getCountFromServer(FS.query(col, FS.where("escola", "==", escola), FS.where("ano", "==", ano)))).data().count;
    if (n !== Number(m.escolasAno[k])) mudou++;
    if (n) escolasAno[k] = n;
  }
  const escolas = {},
    anos = {};
  Object.entries(escolasAno).forEach(([k, n]) => {
    const i = k.lastIndexOf("|");
    escolas[k.slice(0, i)] = (escolas[k.slice(0, i)] || 0) + n;
    anos[k.slice(i + 1)] = (anos[k.slice(i + 1)] || 0) + n;
  });
  await FS.setDoc(ref, Object.assign({}, m, { escolas, anos, escolasAno }));
  U.toast(
    mudou ? `Lista acertada: ${mudou} colégio${mudou > 1 ? "s" : ""} corrigido${mudou > 1 ? "s" : ""} ✅` : "A lista já estava certa ✅"
  );
  if (aoTerminar) aoTerminar();
}
