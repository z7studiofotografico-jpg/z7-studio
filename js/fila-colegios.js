// PR / Formatura: tocar em "Na fila" abre quem são, separados por colégio (12/11/2026).
// Cada colégio mostra quantos estão na fila e com quem; o botão passa o colégio inteiro para alguém da equipe.
import { ordemCodigo } from "./aluno-id.js";
import { el, title, sheet } from "./ui.js";
import * as U from "./util.js";
import { C, FS, col, colNome, ANO, baseSeg, ehFormatura, seg } from "./repasse-estado.js";
import { anosRepasse } from "./repasse-lote.js";

const POR_PAGINA = 50;

// junta por colégio e ano; o maior grupo primeiro
export function gruposDaFila(alunos) {
  const g = new Map();
  alunos.forEach(x => {
    const k = (x.ano || "") + "|" + (x.escola || "Sem colégio");
    if (!g.has(k)) g.set(k, { escola: x.escola || "Sem colégio", ano: x.ano || null, alunos: [], resp: new Map() });
    const o = g.get(k);
    o.alunos.push(x);
    const r = x.resp || "";
    o.resp.set(r, (o.resp.get(r) || 0) + 1);
  });
  return [...g.values()]
    .map(o => ({ ...o, alunos: o.alunos.sort(ordemCodigo) }))
    .sort((a, b) => b.alunos.length - a.alunos.length || a.escola.localeCompare(b.escola));
}
// "sem representante", "Roberto" ou "Roberto (12) e sem representante (3)"
export function textoResp(resp) {
  const nome = r => (r ? U.first(r) : "sem representante");
  const l = [...resp.entries()].sort((a, b) => b[1] - a[1]);
  return l.length === 1 ? nome(l[0][0]) : l.map(([r, n]) => `${nome(r)} (${n})`).join(" e ");
}

export function abrirFilaPorColegio(aoTerminar) {
  sheet("Na fila: por colégio", async (p, close) => {
    p.classList.add("cad");
    const info = el("p", "hint", "Lendo a fila…");
    p.append(info);
    let alunos = [];
    try {
      const anos = ehFormatura() ? [null] : seg === "lf" ? [ANO()] : anosRepasse();
      const qs = await Promise.all(
        anos.map(a => FS.getDocs(FS.query(col, FS.where("etapa", "==", "NA FILA"), ...(a ? [FS.where("ano", "==", a)] : baseSeg()))))
      );
      qs.forEach(q => q.forEach(d => alunos.push({ id: d.id, ...d.data() })));
    } catch (e) {
      info.textContent = "Não foi possível ler a fila agora.";
      return C.handleErr(e);
    }
    alunos = alunos.filter(x => !x.historico);
    const grupos = gruposDaFila(alunos);
    info.textContent = alunos.length
      ? `${alunos.length} alunos esperando, em ${grupos.length} ${grupos.length === 1 ? "colégio" : "colégios"}. Ninguém começou a trabalhar com eles ainda.`
      : "A fila está vazia.";
    grupos.forEach(g => {
      const b = el("div", "cad-parte fila-col");
      const topo = el("div", "fila-topo");
      const nome = el("b", null, (g.ano ? g.ano + " · " : "") + g.escola);
      const sub = el("small", "hint", `${g.alunos.length} ${g.alunos.length === 1 ? "aluno" : "alunos"} · ${textoResp(g.resp)}`);
      const tit = el("div");
      tit.append(nome, el("br"), sub);
      const ver = U.mkBtn("Ver alunos", "btn-sm", () => mostrar());
      const passar = U.mkBtn("📤 Passar o colégio inteiro", "btn-sm btn-primary", () =>
        import("./passar-pr.js")
          .then(m => {
            close();
            m.passarGrupo(C, {
              de: { rotulo: (g.ano ? g.ano + " - " : "") + g.escola, nomes: [g.escola], ano: g.ano },
              colNome: colNome(),
              formatura: ehFormatura(),
              aoTerminar
            });
          })
          .catch(e => C.handleErr(e))
      );
      if (!g.ano) passar.hidden = true;
      const acoes = el("div", "quick");
      acoes.append(ver, passar);
      topo.append(tit, acoes);
      const lista = el("div", "fila-lista");
      b.append(topo, lista);
      let mostrados = 0;
      function mostrar() {
        if (!mostrados) ver.textContent = "Mais alunos";
        g.alunos.slice(mostrados, mostrados + POR_PAGINA).forEach(x =>
          lista.append(
            (() => {
              const d = el("div", "fila-aluno");
              if (x.codigo) d.append(el("span", "lc-id", x.codigo));
              d.append(
                el("span", null, `${title(x.nome || "Sem nome")}${x.turma ? " · " + x.turma : ""}${x.resp ? " · " + U.first(x.resp) : ""}`)
              );
              return d;
            })()
          )
        );
        mostrados += POR_PAGINA;
        if (mostrados >= g.alunos.length) ver.hidden = true;
      }
      p.append(b);
    });
    const fechar = U.mkBtn("Fechar", "", close);
    p.append(fechar);
  });
}
