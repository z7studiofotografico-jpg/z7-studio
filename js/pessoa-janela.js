// Janela do representante (admin, 12/11/2026): as etapas em cima com quantos alunos há em cada uma, os alunos
// agrupados por colégio, 50 por página, e a busca em todos os alunos da pessoa. Lê tudo de uma vez (até 3.000,
// fora os entregues, que vêm só ao tocar em "Entregues"): acabou o limite de 300 da lista.
import { ordemCodigo } from "./aluno-id.js";
import { el, title } from "./ui.js";
import * as U from "./util.js";
import { C, FS, col, seg, ABERTAS, baseLF, baseSeg, ehFormatura, pessoaAberta, tela } from "./repasse-estado.js";

const POR_PAGINA = 50;
export const ETAPAS_PESSOA = ["CAÍDO", "INCOMPLETO", "NA FILA", "SEPARADO", "CONTATADO", "INTERESSADO", "PAGO", "NÃO QUER", "SEM CONTATO"];
const base = () => (ehFormatura() ? baseSeg() : seg === "lf" ? baseLF() : []);
// a consulta da aba da pessoa (tudo menos os entregues)
export const consultaPessoa = email =>
  FS.query(col, ...base(), FS.where("respEmail", "==", email), FS.where("etapa", "in", ETAPAS_PESSOA), FS.limit(3000));

// as etapas (chips): [chave, nome, filtro]
export function chipsPessoa(hoje) {
  const aberto = it => ABERTAS.includes(it.etapa);
  const deHoje = it => aberto(it) && it.followup && it.followup <= hoje;
  return [
    ["caidos", "Caídos", it => it.etapa === "CAÍDO"],
    ["incompletos", "Incompletos", it => it.etapa === "INCOMPLETO"],
    ["trabalhar", "A trabalhar", it => aberto(it) && !deHoje(it)],
    ["hoje", "Para hoje", deHoje],
    ["interessados", "Interessados", it => it.etapa === "INTERESSADO"],
    ["conferir", "A conferir", it => ["PAGO", "ENTREGUE"].includes(it.etapa) && it.conferido === false],
    ["vender", "Vendido/entregar", it => it.etapa === "PAGO"],
    ["entregues", "Entregues", it => it.etapa === "ENTREGUE"]
  ];
}
// colégio por colégio (o maior primeiro); dentro, pelo ID (sem ID, por nome no fim)
export function porColegio(arr) {
  const g = new Map();
  arr.forEach(it => {
    const k = (it.ano ? it.ano + " · " : "") + (it.escola || "Sem colégio");
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(it);
  });
  return [...g.entries()].map(([k, l]) => [k, l.sort(ordemCodigo)]).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

const st = { email: "", etapa: "hoje", pagina: 0, busca: null, entregues: null, nEntregues: null, carregando: false };
function zerar(email) {
  Object.assign(st, { email, etapa: "hoje", pagina: 0, entregues: null, nEntregues: null, carregando: false });
  if (st.busca) st.busca.value = "";
  // quantos entregues (sem ler todos)
  FS.getCountFromServer(FS.query(col, ...base(), FS.where("respEmail", "==", email), FS.where("etapa", "==", "ENTREGUE")))
    .then(s => {
      if (st.email !== email) return;
      st.nEntregues = s.data().count;
      tela.renderList();
    })
    .catch(e => console.warn("[Z7] entregues da pessoa", e));
}
function carregarEntregues() {
  if (st.entregues || st.carregando) return;
  st.carregando = true;
  const email = st.email;
  FS.getDocs(FS.query(col, ...base(), FS.where("respEmail", "==", email), FS.where("etapa", "==", "ENTREGUE"), FS.limit(3000)))
    .then(s => {
      if (st.email !== email) return;
      st.entregues = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      st.carregando = false;
      tela.renderList();
    })
    .catch(e => {
      st.carregando = false;
      C.handleErr(e);
    });
}

export function renderPessoa(list, arr, linha) {
  if (st.email !== pessoaAberta.email) zerar(pessoaAberta.email);
  const nome = U.first(title(pessoaAberta.nome)),
    hoje = U.todayStr();
  const todos = arr.concat(st.entregues || []);
  const chips = chipsPessoa(hoje);
  const conta = k => {
    const f = chips.find(c => c[0] === k)[2];
    if (k === "entregues" && !st.entregues) return st.nEntregues;
    return todos.filter(f).length;
  };
  const cheio = el("div", "pessoa-topo");
  cheio.style.gridColumn = "1/-1";
  const n = k => conta(k) ?? "…";
  cheio.append(
    el(
      "p",
      "notes",
      `${nome}: ${n("hoje")} para hoje · ${n("trabalhar")} a trabalhar · ${n("caidos")} caídos · ${todos.length + (st.entregues ? 0 : st.nEntregues || 0)} no total`
    )
  );
  // busca em todos os alunos da pessoa (fica a mesma caixa entre um desenho e outro: não perde o que foi digitado)
  if (!st.busca) {
    st.busca = el("input", "pessoa-busca");
    st.busca.type = "search";
    st.busca.placeholder = "Procurar aluno, colégio ou ID";
    st.busca.setAttribute("aria-label", "Procurar nos alunos da pessoa");
    st.busca.oninput = () => {
      st.pagina = 0;
      tela.renderList();
      st.busca.focus();
    };
  }
  const barra = el("div", "chips pessoa-chips");
  chips.forEach(([k, rot]) => {
    const b = el("button", "chip" + (k === st.etapa ? " on" : ""), `${rot} (${n(k)})`);
    b.type = "button";
    b.setAttribute("aria-pressed", String(k === st.etapa));
    b.onclick = () => {
      st.etapa = k;
      st.pagina = 0;
      if (st.busca) st.busca.value = "";
      if (k === "entregues" || k === "conferir") carregarEntregues();
      tela.renderList();
    };
    barra.append(b);
  });
  cheio.append(st.busca, barra);
  list.append(cheio);
  // a lista: busca (em todos) ou a etapa escolhida
  const q = U.chave(st.busca.value || "").trim();
  const filtro = chips.find(c => c[0] === st.etapa)[2];
  const mostrar = q
    ? todos.filter(it => U.chave([it.nome, it.escola, it.codigo].join(" ")).includes(q))
    : st.etapa === "entregues" && !st.entregues
      ? null
      : todos.filter(filtro);
  const aviso = t => {
    const p = el("p", "hint", t);
    p.style.gridColumn = "1/-1";
    list.append(p);
  };
  if (!mostrar) return aviso("Carregando os entregues…");
  if (!mostrar.length) return aviso(q ? "Nada encontrado nos alunos de " + nome + "." : "Nenhum aluno nesta etapa.");
  // página de 50, sem quebrar a ordem dos colégios
  const plano = porColegio(mostrar).flatMap(([k, l]) => l.map((it, i) => ({ k, it, i, n: l.length })));
  const paginas = Math.ceil(plano.length / POR_PAGINA);
  st.pagina = Math.min(st.pagina, paginas - 1);
  const pedaco = plano.slice(st.pagina * POR_PAGINA, (st.pagina + 1) * POR_PAGINA);
  pedaco.forEach((x, j) => {
    if (j === 0 || pedaco[j - 1].k !== x.k) {
      const h = el("h3", "grp", `${x.k} (${x.n})`);
      h.style.gridColumn = "1/-1";
      list.append(h);
    }
    list.append(linha(x.it));
  });
  if (paginas > 1) {
    const pg = el("div", "pessoa-paginas");
    pg.style.gridColumn = "1/-1";
    const ant = U.mkBtn("← Anterior", "btn-sm", () => {
      st.pagina--;
      tela.renderList();
      list.scrollIntoView({ block: "start" });
    });
    const prox = U.mkBtn("Próxima →", "btn-sm", () => {
      st.pagina++;
      tela.renderList();
      list.scrollIntoView({ block: "start" });
    });
    ant.disabled = st.pagina === 0;
    prox.disabled = st.pagina >= paginas - 1;
    pg.append(ant, el("span", "hint", `Página ${st.pagina + 1} de ${paginas}`), prox);
    list.append(pg);
  }
}
