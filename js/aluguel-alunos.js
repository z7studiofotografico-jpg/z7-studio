// Aluguel de becas → Alunos dos colégios (Etapa 3). Coleção "alugueis", um documento por aluno:
// { instId, instNome, ano, serie, nome, nomeBusca, tel, responsavel, status, becaTipo, tamanho, menosLonga, faixa, capelo,
//   produtos: [{ produto, nome, qtd, valor, estado: "reservado" | "baixado" | "estornado" }], valor, contratoZerado,
//   retirada, devolucao, historico: [{ de, para, em, por }], obs, importacao, pacote: ["beca", "paspatur", …], unidade }
// O pacote de cada aluno e o Contrato do colégio (quem paga, pagamentos, produção) ficam em contrato-colegio.js.
// Status: Cadastrado → Beca medida (reserva beca, faixa e capelo) → Produtos em produção (se comprou algum) →
// Pronto para retirada → Retirou a beca (baixa o estoque dos produtos) → Devolvida (beca volta ao estoque).
// "Atrasado na devolução": retirou e passou da data de devolução (destaque para o Adriano).
import { ordemCodigo } from "./aluno-id.js";
import { bloco, el, title, field, inp, inpReais, sel, sheet, botoes, wa, clicavel } from "./ui.js";
import * as U from "./util.js";
import { lerReais, brl } from "./regras.js";
import { confirmar, confirmarStatus, excluir, faixaExclusao, ocultoParaMim, perguntarSeEnviou, pedirTexto } from "./confirmar.js";
import {
  BECAS,
  TAMANHOS,
  FAIXAS,
  CAPELOS,
  COM_MENOS_LONGA,
  nomeBeca,
  nomeFaixa,
  nomeCapelo,
  usoDosAlunos,
  faltaParaAluno,
  somarUso,
  tamanhoBeca,
  modeloBeca
} from "./becas-estoque.js";
import { carregarCatalogo, reservar, desfazerReserva, baixar, estornar } from "./estoque.js";
import { DO_ALUGUEL } from "./catalogo.js";
import { ESTUDIO, ENDERECO } from "./mensagens.js";
import { botaoRelatorio } from "./relatorio.js";
import { relatorioAluguel, atrasadoAluguel } from "./aluguel-relatorio.js";
import { ITENS_PACOTE, nomeItem, lerPacote } from "./contrato-colegio-regras.js";
import { linhaGenerica } from "./lista-compacta.js";
import { avisoPrecoAluguel } from "./precos-colegio.js";
import { USO, idUso, ouvirUso, espelhar, donoDoAluguel } from "./becas-uso.js";
import { abrirJanela } from "./janela.js";
import { abaColegio, abaHistorico } from "./aluguel-janela.js";

export const STATUS_ALUGUEL = ["Cadastrado", "Beca medida", "Produtos em produção", "Pronto para retirada", "Retirou a beca", "Devolvida"];
const SERIES = ["Pré", "5º ano", "9º ano", "Ensino médio", "Faculdade", "Curso", "Outra"];
const ANO = () => new Date().getFullYear();
// atrasadoAluguel fica em aluguel-relatorio.js (o relatório também usa); continua exportado daqui
export { atrasadoAluguel };
// próximo e anterior (Produtos em produção só para quem comprou produto)
export function proximoStatus(a) {
  const i = STATUS_ALUGUEL.indexOf(a.status || "Cadastrado");
  let p = STATUS_ALUGUEL[i + 1];
  if (p === "Produtos em produção" && !(a.produtos || []).some(x => x.estado !== "estornado")) p = "Pronto para retirada";
  return p || null;
}
export function anteriorStatus(a) {
  const i = STATUS_ALUGUEL.indexOf(a.status || "Cadastrado");
  let p = STATUS_ALUGUEL[i - 1];
  if (p === "Produtos em produção" && !(a.produtos || []).some(x => x.estado !== "estornado")) p = "Beca medida";
  return i > 0 ? p : null;
}

let C, FS, db, col;
let lista = [],
  insts = [],
  usoAvulsos = { becas: {}, faixas: {}, capelos: {}, tamanhos: {} },
  alunosUso = [], // alunos com beca reservada ou fora, de todos (cópia do estoque)
  filtro = { ano: String(ANO()), inst: "", status: "ativos", q: "" };
const $ = id => document.getElementById(id);

export function mostrarAlunos(ctx, v, o) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
  col = FS.collection(db, "alugueis");
  const head = el("div", "vhead");
  head.append(el("h2", null, "Aluguel de becas · alunos"));
  const hb = el("div", "agact");
  hb.append(
    // 11/11/2026: o "+ Aluno" abre a tela única de cadastro (colégio, ID e o que contratou)
    U.mkBtn("+ Aluno", "btn-primary btn-sm", () =>
      import("./cadastro-aluno.js").then(m => m.abrirCadastroAluno(C, { modulo: "becas" })).catch(e => C.handleErr(e))
    ),
    U.mkBtn("📦 Estoque", "btn-sm", () => o.abrirEstoque()),
    U.mkBtn("Importar planilha", "btn-sm", () =>
      import("./aluguel-importar.js").then(m => m.importarAlugueis(C, insts)).catch(e => C.handleErr(e))
    ),
    botaoRelatorio(
      () => relatorioAluguel(C, lista, filtro),
      () => C.me
    ),
    U.mkBtn("⬇️ Planilha", "btn-sm", () =>
      import("./cadastro-aluno.js").then(m => m.baixarPlanilha("aluguel-becas", lista, m.CAMPOS_ALUGUEL)).catch(e => C.handleErr(e))
    )
  );
  head.append(hb);
  v.append(head);
  v.append(
    el(
      "p",
      "hint",
      "Cada aluno ligado à instituição, ao ano e à série. Colégio em que já alugamos becas não é revisitado para outro serviço."
    )
  );
  const k = el("div", "kpis");
  k.id = "alKpis";
  const filtros = el("div", "row3");
  filtros.id = "alFiltros";
  const resumo = el("div", "notice");
  resumo.id = "alResumo";
  resumo.hidden = true;
  const chips = el("div", "chips");
  chips.id = "alChips";
  const q = el("input", "search");
  q.type = "search";
  q.placeholder = "Buscar aluno pelo nome";
  q.setAttribute("aria-label", "Buscar aluno");
  q.value = filtro.q;
  q.oninput = () => {
    filtro.q = q.value;
    render();
  };
  const corpo = el("div", "grid lc-lista");
  corpo.id = "alLista";
  corpo.append(el("div", "empty", "Carregando…"));
  v.append(k, filtros, resumo, chips, q, corpo);
  o.unsubs.push(
    FS.onSnapshot(
      // a equipe: só os alunos dos contratos dela (e os sem contrato) (11/11/2026)
      C.isAdmin ? FS.query(col, FS.limit(5000)) : C.carteira("alugueis"),
      s => {
        lista = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
        render();
      },
      e => {
        corpo.innerHTML = "";
        corpo.append(
          el(
            "div",
            "empty",
            e && e.code === "permission-denied"
              ? "Cole as regras novas do Firebase para usar os alunos de aluguel."
              : "Não foi possível carregar agora."
          )
        );
      }
    )
  );
  // estoque geral: a cópia só com os números de todos os aluguéis (alunos e avulsos), de todos da equipe
  o.unsubs.push(
    ouvirUso(C, u => {
      alunosUso = u.alunos;
      const t = { becas: {}, faixas: {}, capelos: {}, tamanhos: {} };
      u.avulsos.forEach(x => {
        ["becas", "faixas", "capelos"].forEach(kk =>
          Object.entries(x[kk + "Qtd"] || {}).forEach(([z, n]) => (t[kk][z] = (Number(t[kk][z]) || 0) + (Number(n) || 0)))
        );
        Object.entries(x.tamanhosQtd || {}).forEach(([tp, zs]) => {
          const m = (t.tamanhos[tp] = t.tamanhos[tp] || {});
          Object.entries(zs || {}).forEach(([z, n]) => (m[z] = (Number(m[z]) || 0) + (Number(n) || 0)));
        });
      });
      usoAvulsos = t;
    })
  );
  FS.getDocs(C.carteira("instituicoes", FS.limit(1500)))
    .then(s => {
      insts = s.docs
        .map(d => Object.assign({ id: d.id }, d.data()))
        .filter(i => !i.arquivado && !ocultoParaMim(C, i))
        .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
      render();
    })
    .catch(() => {});
}

// apaga os alunos do colégio e ano escolhidos; quem tem beca fora ou produto reservado/baixado fica (para não
// bagunçar o estoque) e o app avisa quantos ficaram
async function excluirDoColegio(lst) {
  const presos = lst.filter(
    a => a.status === "Retirou a beca" || (a.produtos || []).some(p => p.estado === "reservado" || p.estado === "baixado")
  );
  const vai = lst.filter(a => !presos.includes(a));
  if (!vai.length) return U.toast("Todos esses alunos têm beca fora ou produto no estoque: exclua um por um.");
  const ok = await confirmar(
    "Excluir os alunos deste colégio?",
    `Apagar ${vai.length} aluno${vai.length === 1 ? "" : "s"} (${title(lst[0].instNome || "")}, ${filtro.ano || "todos os anos"})?` +
      (presos.length ? ` ${presos.length} com beca fora ou produto no estoque ficam (exclua um por um).` : "") +
      " Não dá para desfazer.",
    { perigo: true, sim: "Sim, excluir" }
  );
  if (!ok) return;
  try {
    for (let i = 0; i < vai.length; i += 400) {
      const b = FS.writeBatch(db);
      vai.slice(i, i + 400).forEach(a => {
        b.delete(FS.doc(db, "alugueis", a.id));
        b.delete(FS.doc(db, USO, idUso("aluno", a.id))); // a cópia do estoque
      });
      await b.commit();
    }
    U.toast(`${vai.length} aluno${vai.length === 1 ? "" : "s"} excluído${vai.length === 1 ? "" : "s"} ✅`);
  } catch (e) {
    C.handleErr(e);
  }
}
function render() {
  const corpo = $("alLista");
  if (!corpo) return;
  const hoje = U.todayStr();
  const vis = lista.filter(a => !ocultoParaMim(C, a));
  const doAno = vis.filter(a => !filtro.ano || String(a.ano) === filtro.ano);
  const doCol = doAno.filter(a => !filtro.inst || a.instId === filtro.inst);
  // números do topo
  const k = $("alKpis");
  k.innerHTML = "";
  const u = usoDosAlunos(doAno);
  const atr = doAno.filter(a => atrasadoAluguel(a, hoje));
  [
    ["Alunos", String(doAno.length)],
    ["Becas reservadas", String(u.reservado)],
    ["Becas fora", String(u.fora)],
    ["Atrasados na devolução", String(atr.length)]
  ].forEach(([t, val], i) => {
    const c = el("div", "kpi" + (i === 3 && atr.length ? " late" : ""));
    c.append(el("small", null, t), el("b", null, val));
    clicavel(c, () => {
      filtro.status = ["ativos", "Beca medida", "Retirou a beca", "atrasados"][i];
      render();
    });
    k.append(c);
  });
  // filtros: ano e colégio
  const f = $("alFiltros");
  f.innerHTML = "";
  const anos = [...new Set([String(ANO()), ...vis.map(a => String(a.ano || ""))].filter(Boolean))].sort().reverse();
  const sAno = sel(
    anos.map(a => [a, a]),
    filtro.ano,
    "todos os anos"
  );
  sAno.onchange = () => {
    filtro.ano = sAno.value;
    render();
  };
  const cont = {};
  doAno.forEach(a => (cont[a.instId] = (cont[a.instId] || 0) + 1));
  const opcoes = Object.keys(cont).map(id => [id, `${title((lista.find(a => a.instId === id) || {}).instNome || "?")} (${cont[id]})`]);
  const sInst = sel(
    opcoes.sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
    filtro.inst,
    "todos os colégios"
  );
  sInst.onchange = () => {
    filtro.inst = sInst.value;
    render();
  };
  f.append(field("Ano", sAno), field("Colégio", sInst));
  // resumo do colégio: quantos alugaram, situação na instituição
  const r = $("alResumo");
  if (filtro.inst) {
    const inst = insts.find(i => i.id === filtro.inst) || {};
    const st = {};
    doCol.forEach(a => (st[a.status || "Cadastrado"] = (st[a.status || "Cadastrado"] || 0) + 1));
    r.hidden = false;
    r.textContent =
      `🏫 ${title(inst.nome || (doCol[0] || {}).instNome || "")}: ${doCol.length} aluno${doCol.length === 1 ? "" : "s"} alugaram` +
      (inst.etapa ? ` · instituição: ${inst.etapa.toLowerCase()}` : "") +
      (inst.ultimo || (inst.visitas || []).length
        ? ` · visitada${(inst.visitas || [])[0] && inst.visitas[0].data ? " em " + U.fmtDate(inst.visitas[0].data) : ""}`
        : " · sem visita registrada") +
      " · " +
      Object.entries(st)
        .map(([s0, n]) => `${n} ${s0.toLowerCase()}`)
        .join(", ");
    r.append(
      " ",
      U.mkBtn("📄 Contrato do colégio", "btn-primary btn-sm", () =>
        import("./contrato-colegio.js")
          .then(m =>
            m.abrirContrato(C, Object.assign({ id: filtro.inst, nome: (doCol[0] || {}).instNome || "" }, inst), filtro.ano || String(ANO()))
          )
          .catch(e => C.handleErr(e))
      )
    );
    // admin: excluir os alunos desse colégio e ano (importou errado, turma duplicada…)
    if (C.isAdmin)
      r.append(
        " ",
        U.mkBtn("🗑️ Excluir alunos deste colégio", "btn-danger btn-sm", () => excluirDoColegio(doCol))
      );
  } else r.hidden = true;
  // status
  const chips = $("alChips");
  chips.innerHTML = "";
  const abas = [
    ["ativos", "Em andamento", a => a.status !== "Devolvida"],
    ["atrasados", "⚠️ Atrasados", a => atrasadoAluguel(a, hoje)],
    ...STATUS_ALUGUEL.map(s0 => [s0, s0, a => (a.status || "Cadastrado") === s0]),
    ["todos", "Todos", () => true]
  ];
  abas.forEach(([kk, t, fn]) => {
    const b = el("button", "chip" + (kk === "atrasados" ? " ch-nao" : ""), t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(filtro.status === kk));
    b.append(el("span", "n", String(doCol.filter(fn).length)));
    b.onclick = () => {
      filtro.status = kk;
      render();
    };
    chips.append(b);
  });
  const fn = (abas.find(a => a[0] === filtro.status) || abas[0])[2];
  const q = U.chave(filtro.q);
  const arr = doCol
    .filter(fn)
    .filter(a => !q || U.chave([a.nome, a.codigo].join(" ")).includes(q))
    .sort(
      (a, b) =>
        Number(atrasadoAluguel(b, hoje)) - Number(atrasadoAluguel(a, hoje)) ||
        (a.instNome || "").localeCompare(b.instNome || "") ||
        ordemCodigo(a, b)
    );
  corpo.innerHTML = "";
  if (!arr.length) {
    const e = el("div", "empty");
    e.append(el("strong", null, "Nenhum aluno aqui"), el("span", null, "Toque em “+ Aluno” ou importe a planilha do colégio."));
    corpo.append(e);
    return;
  }
  arr.slice(0, 400).forEach(a => corpo.append(linha(a)));
  if (arr.length > 400) corpo.append(el("p", "hint", `Mostrando 400 de ${arr.length}. Escolha um colégio para ver os outros.`));
}

// Lista compacta (o mesmo formato do PR, Formatura e Instituições): uma linha por aluno; tocar abre a janela
// Cores: vermelho atrasado na devolução · amarelo pronto para retirada · azul com a beca · verde devolvida · cinza o resto
export function corAluguel(a, hoje = U.todayStr()) {
  if (atrasadoAluguel(a, hoje)) return "vermelho";
  const st = a.status || "Cadastrado";
  if (st === "Devolvida") return "verde";
  if (st === "Retirou a beca") return "azul";
  if (st === "Pronto para retirada") return "amarelo";
  return "cinza";
}
const becaTxt = a => (a.becaTipo ? `👘 Beca ${tamanhoBeca(a).replace(/^\w/, c => c.toLowerCase())} · ${modeloBeca(a.becaTipo)}` : "");
function passoAluguel(a, hoje) {
  if (atrasadoAluguel(a, hoje)) return "⚠️ Devolução atrasada desde " + U.fmtDate(a.devolucao);
  const st = a.status || "Cadastrado";
  if (st === "Retirou a beca" && a.devolucao) return "Devolver até " + U.fmtDate(a.devolucao);
  if (st === "Pronto para retirada") return "Retirar" + (a.retirada ? " dia " + U.fmtDate(a.retirada) : "");
  const prox = proximoStatus(a);
  return prox ? "Próximo: " + prox : "";
}
function linha(a) {
  const hoje = U.todayStr();
  const at = atrasadoAluguel(a, hoje);
  return linhaGenerica({
    id: a.id,
    cor: corAluguel(a, hoje),
    idAluno: a.codigo,
    titulo: title(a.nome || ""),
    sub: [title(a.instNome || ""), [a.ano, a.serie].filter(Boolean).join(" · "), becaTxt(a)].filter(Boolean).join(" · "),
    passo: passoAluguel(a, hoje),
    passoCls: at ? "late" : (a.status || "") === "Pronto para retirada" ? "today" : "",
    selo: at ? "ATRASADO" : (a.status || "Cadastrado").toUpperCase(),
    card: () => card(a),
    abrir: () => janela(a)
  });
}
// janela do aluno do aluguel: Resumo (o cartão completo) · Colégio (informações e o Contrato do colégio) · Histórico
function janela(a0) {
  abrirJanela({
    C,
    colecao: "alugueis",
    item: a0,
    topo: a => ({
      titulo: title(a.nome || ""),
      sub: [title(a.instNome || ""), [a.ano, a.serie].filter(Boolean).join(" · ")].filter(Boolean).join(" · "),
      selo: atrasadoAluguel(a) ? "ATRASADO" : (a.status || "Cadastrado").toUpperCase()
    }),
    abas: [
      ["resumo", "Resumo", (box, a) => box.append(card(a))],
      [
        "colegio",
        "Colégio e contrato",
        (box, a, fechar) =>
          abaColegio(box, a, {
            C,
            inst: insts.find(i => i.id === a.instId),
            doCol: lista.filter(x => x.instId === a.instId && String(x.ano) === String(a.ano)),
            verColegio: () => {
              filtro.inst = a.instId || "";
              filtro.ano = String(a.ano || "");
              fechar();
              render();
            }
          })
      ],
      ["historico", "Histórico", abaHistorico]
    ]
  });
}
function card(a) {
  const hoje = U.todayStr();
  const at = atrasadoAluguel(a, hoje);
  const st = a.status || "Cadastrado";
  const e = el("article", "card " + (at ? "late" : st === "Devolvida" ? "won" : st === "Pronto para retirada" ? "today" : ""));
  const fx = faixaExclusao(C, "alugueis", a);
  if (fx) e.append(fx);
  const top = el("div", "card-top");
  const bx = el("button", "btn-excluir", "🗑️");
  bx.type = "button";
  bx.title = "Excluir aluno";
  bx.setAttribute("aria-label", "Excluir aluno");
  bx.onclick = () =>
    excluir(C, { col: "alugueis", id: a.id, rotulo: `Aluguel de ${title(a.nome)} (${title(a.instNome || "")} ${a.ano || ""})` }).then(
      ok => ok && espelhar(C, "aluno", a.id, null) // não conta mais no estoque
    );
  top.append(el("h3", "name", title(a.nome || "")), el("span", "stage", at ? "ATRASADO NA DEVOLUÇÃO" : st.toUpperCase()), bx);
  avisoPrecoAluguel(C, a).then(av => av && e.insertBefore(av, e.firstChild));
  e.append(top);
  const meta = el("div", "meta");
  [
    [`🏫 ${title(a.instNome || "")}`, "svc"],
    [[a.ano, a.serie].filter(Boolean).join(" · "), ""],
    [
      a.becaTipo
        ? `👘 ${nomeBeca(a.becaTipo).replace("Beca ", "")}${a.tamanho ? " " + a.tamanho + (a.menosLonga ? "1 (menos longa)" : "") : " · sem tamanho"}`
        : "",
      ""
    ],
    [a.faixa ? "Faixa " + nomeFaixa(a.faixa).toLowerCase() : "", ""],
    [a.capelo ? nomeCapelo(a.capelo) : "", ""],
    [a.contratoZerado ? "Contrato zerado (R$ 0,00)" : a.valor ? brl(a.valor) : "", ""],
    ...lerPacote(a.pacote || []).map(x => ["📦 " + nomeItem(x), x === "paspatur" ? "warn" : "ok"])
  ].forEach(([t, c]) => t && meta.append(el("span", "tag " + c, t)));
  e.append(meta);
  const prods = (a.produtos || []).filter(p => p.estado !== "estornado");
  if (prods.length)
    e.append(el("p", "notes", "Produtos: " + prods.map(p => `${p.qtd}× ${p.nome}${p.estado === "baixado" ? " ✓" : ""}`).join(", ")));
  const datas = [a.retirada && "Retirada " + U.fmtDate(a.retirada), a.devolucao && "Devolução " + U.fmtDate(a.devolucao)]
    .filter(Boolean)
    .join(" · ");
  if (datas || at) e.append(el("div", "fu " + (at ? "late" : ""), at ? `⚠️ Devolução atrasada desde ${U.fmtDate(a.devolucao)}` : datas));
  if (a.obs) e.append(el("p", "notes", a.obs));
  const act = el("div", "actions");
  act.append(
    U.mkBtn("🛍️ Produtos", "", () => produtos(a)),
    U.mkBtn("Editar", "", () => form(a)),
    U.mkBtn("🆘 Ajuda de vendas", "", () =>
      import("./ajuda-vendas.js")
        .then(m =>
          m.abrirAjuda(C, {
            card: "aluguel",
            aluno: a.nome,
            colegio: a.instNome,
            contato: a.responsavel,
            precoModulo: a.valor ? brl(a.valor) : ""
          })
        )
        .catch(e => C.handleErr(e))
    )
  );
  if (a.tel && (st === "Pronto para retirada" || at))
    act.append(
      U.mkBtn(at ? "💬 Cobrar devolução" : "📲 Avisar que está pronto", at ? "btn-primary" : "", () => {
        wa(
          a.tel,
          at
            ? `Oi! Aqui é do ${ESTUDIO.nome} 📸 A devolução da beca de ${U.first(title(a.nome))} era dia ${U.fmtDate(a.devolucao)}. Consegue trazer no estúdio? ${ENDERECO}. Obrigado! 😊`
            : `Oi! Aqui é do ${ESTUDIO.nome} 📸 A beca de ${U.first(title(a.nome))}${prods.length ? " e os produtos" : ""} já estão prontos para retirada${a.retirada ? " dia " + U.fmtDate(a.retirada) : ""}. ${ENDERECO}. 😊`,
          U.toast
        );
        perguntarSeEnviou(() => salvar(a, { avisadoEm: new Date().toISOString() }, "Anotado"));
      })
    );
  e.append(act);
  // barra de status: Avançar e Voltar (com Sim / Não)
  const base = el("div", "acao-base");
  const prox = proximoStatus(a),
    ant = anteriorStatus(a);
  if (prox) base.append(U.mkBtn("Avançar: " + prox, "btn-ok", () => mudarStatus(a, prox)));
  if (ant) base.append(U.mkBtn("Voltar: " + ant, "", () => mudarStatus(a, ant)));
  e.append(base);
  return e;
}

async function salvar(a, patch, msg) {
  try {
    await FS.updateDoc(FS.doc(db, "alugueis", a.id), Object.assign({ atualizadoEm: new Date().toISOString() }, patch));
    espelhar(C, "aluno", a.id, Object.assign({}, a, patch));
    if (msg) U.toast(msg);
    return true;
  } catch (e) {
    C.handleErr(e);
    return false;
  }
}
const itensProd = a => (a.produtos || []).filter(p => p.estado === "reservado").map(p => ({ produto: p.produto, qtd: p.qtd }));

// Mudar o status (com a pergunta "Mudar de X para Y?") e o que isso faz no estoque
export async function mudarStatus(a, para) {
  const de = a.status || "Cadastrado";
  const iDe = STATUS_ALUGUEL.indexOf(de),
    iPara = STATUS_ALUGUEL.indexOf(para);
  if (iPara >= STATUS_ALUGUEL.indexOf("Beca medida") && (!a.becaTipo || !a.tamanho)) {
    U.toast("Antes, coloque o tipo e o tamanho da beca (Editar).");
    return form(a);
  }
  // reservar a beca: confere se tem livre (sem contar o próprio aluno)
  if (iDe < 1 && iPara >= 1) {
    const uso = somarUso(usoAvulsos, usoDosAlunos(alunosUso.filter(x => x.id !== a.id)));
    const falta = faltaParaAluno(C.P.estoque || {}, uso, a);
    if (falta.length) {
      await confirmar(
        "Sem estoque",
        "Não tem livre: " + falta.join(", ") + ". Troque o tamanho/faixa/capelo (Editar) ou confira o estoque.",
        { sim: "Entendi", nao: "Fechar" }
      );
      return;
    }
  }
  let motivo = "";
  // voltar de "Retirou a beca": os produtos já baixados voltam por estorno, com motivo
  const voltaBaixa =
    iDe >= STATUS_ALUGUEL.indexOf("Retirou a beca") &&
    iPara < STATUS_ALUGUEL.indexOf("Retirou a beca") &&
    (a.produtos || []).some(p => p.estado === "baixado");
  if (voltaBaixa) {
    motivo =
      (await pedirTexto(
        `Voltar de “${de}” para “${para}”?`,
        "Os produtos já tiveram baixa no estoque. Qual o motivo de voltar? (fica registrado no estorno)"
      )) || "";
    if (!motivo) return;
  } else if (!(await confirmarStatus(de, para))) return;
  const patch = {
    status: para,
    historico: [...(a.historico || []), { de, para, em: new Date().toISOString(), por: C.me || "" }].slice(-30)
  };
  try {
    if (para === "Retirou a beca") {
      const it = itensProd(a);
      if (it.length) await baixar(C, it, { ref: "alugueis/" + a.id, modulo: "aluguel" });
      patch.produtos = (a.produtos || []).map(p => (p.estado === "reservado" ? Object.assign({}, p, { estado: "baixado" }) : p));
      patch.retiradoEm = U.todayStr();
    }
    if (voltaBaixa) {
      const it = (a.produtos || []).filter(p => p.estado === "baixado").map(p => ({ produto: p.produto, qtd: p.qtd }));
      await estornar(C, it, { ref: "alugueis/" + a.id, modulo: "aluguel", motivo });
      // volta a ficar reservado (a venda continua)
      await reservar(C, it, { ref: "alugueis/" + a.id, modulo: "aluguel" }).catch(() => {});
      patch.produtos = (a.produtos || []).map(p => (p.estado === "baixado" ? Object.assign({}, p, { estado: "reservado" }) : p));
    }
    if (para === "Devolvida") patch.devolvidoEm = U.todayStr();
    // a transação confere que ninguém mudou o status ao mesmo tempo (beca devolvida duas vezes não conta duas vezes)
    const ref = FS.doc(db, "alugueis", a.id);
    await FS.runTransaction(db, async tx => {
      const s = await tx.get(ref);
      if (!s.exists() || (s.data().status || "Cadastrado") !== de)
        throw Object.assign(new Error("O status deste aluno acabou de mudar. Confira e tente de novo."), { code: "mudou" });
      tx.update(ref, Object.assign({ atualizadoEm: new Date().toISOString() }, patch));
    });
    espelhar(C, "aluno", a.id, Object.assign({}, a, patch, { status: para }));
    U.toast("Agora: " + para);
  } catch (e) {
    if (e && (e.code === "mudou" || e.code === "sem-estoque")) U.toast(e.message);
    else C.handleErr(e);
  }
}

// Produtos vendidos junto com o aluguel (item 3.4): reserva no estoque ao incluir; baixa quando retira
async function produtos(a) {
  let cat;
  try {
    cat = await carregarCatalogo(C);
  } catch (e) {
    return C.handleErr(e);
  }
  sheet("🛍️ Produtos de " + U.first(title(a.nome || "")), (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "O que o aluno levou junto com o aluguel (a foto é tirada no dia de medir a beca). Os preços vêm de Produtos e estoque."
      )
    );
    const atual = {};
    (a.produtos || []).filter(x => x.estado !== "estornado").forEach(x => (atual[x.produto] = (atual[x.produto] || 0) + x.qtd));
    const linhas = DO_ALUGUEL.map(id => cat.find(x => x.id === id))
      .filter(Boolean)
      .map(pr => {
        const r = el("div", "prow");
        const q = el("input");
        q.inputMode = "numeric";
        q.className = "preco";
        q.value = atual[pr.id] || "";
        q.placeholder = "0";
        q.setAttribute("aria-label", "Quantidade de " + pr.nome);
        const baixado = (a.produtos || []).some(x => x.produto === pr.id && x.estado === "baixado");
        q.disabled = baixado;
        r.append(el("span", null, `${pr.nome}${pr.preco ? " · " + brl(pr.preco) : ""}${baixado ? " (já entregue)" : ""}`), q);
        p.append(r);
        return [pr, q];
      });
    const err = el("p", "err");
    err.hidden = true;
    p.append(err, botoes(close, "Salvar produtos"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const novos = [],
        tirar = [],
        poe = [];
      linhas.forEach(([pr, q]) => {
        if (q.disabled) return;
        const n = Math.max(0, parseInt(q.value, 10) || 0),
          antes = (a.produtos || []).filter(x => x.produto === pr.id && x.estado === "reservado").reduce((t, x) => t + x.qtd, 0);
        if (n > antes) poe.push({ produto: pr.id, qtd: n - antes });
        if (n < antes) tirar.push({ produto: pr.id, qtd: antes - n });
        if (n) novos.push({ produto: pr.id, nome: pr.nome, qtd: n, valor: Number(pr.preco) || 0, estado: "reservado", origem: "Aluguel" });
      });
      try {
        if (tirar.length) await desfazerReserva(C, tirar, { ref: "alugueis/" + a.id, modulo: "aluguel" });
        if (poe.length) await reservar(C, poe, { ref: "alugueis/" + a.id, modulo: "aluguel" });
        const ficam = (a.produtos || []).filter(x => x.estado !== "reservado");
        await salvar(a, { produtos: [...ficam, ...novos] }, "Produtos salvos");
        close();
      } catch (e) {
        err.textContent = e.message || String(e);
        err.hidden = false;
      }
    });
  });
}

// Cadastro / edição do aluno de aluguel
export function form(a, pre = {}) {
  sheet(a ? "Editar aluno de aluguel" : "Novo aluno de aluguel", (p, close) => {
    const x = a || pre;
    const sInst = sel(
      insts.map(i => [i.id, title(i.nome)]),
      x.instId || filtro.inst || "",
      "escolha a instituição"
    );
    sInst.required = true;
    const ano = inp(String(x.ano || filtro.ano || ANO()), "ano", 4);
    ano.inputMode = "numeric";
    const serie = sel(SERIES, x.serie || "", "série");
    const r0 = el("div", "row3");
    r0.append(field("Instituição", sInst), field("Ano", ano), field("Série", serie));
    const nome = inp(x.nome ? title(x.nome) : "", "nome do aluno");
    nome.required = true;
    const tel = inp(x.tel || "", "(21) 9…", 30);
    tel.inputMode = "tel";
    const resp = inp(x.responsavel || "", "responsável (se for menor)");
    const r1 = el("div", "row3");
    r1.append(field("Aluno", nome), field("WhatsApp", tel), field("Responsável", resp));
    const tipo = sel(BECAS, x.becaTipo || "tradPreta");
    const tam = sel(TAMANHOS, x.tamanho || "", "tamanho");
    const ml = el("input");
    ml.type = "checkbox";
    ml.checked = !!x.menosLonga;
    const lMl = el("label", "chk");
    lMl.append(ml, document.createTextNode(" Menos longa (P1, M1…)"));
    const syncMl = () => {
      lMl.hidden = !COM_MENOS_LONGA.includes(tipo.value);
      if (lMl.hidden) ml.checked = false;
    };
    tipo.onchange = syncMl;
    syncMl();
    const r2 = el("div", "row3");
    r2.append(field("Beca", tipo), field("Tamanho", tam), lMl);
    const faixa = sel(FAIXAS, x.faixa || "", "sem faixa");
    const capelo = sel(CAPELOS, x.capelo || "", "sem capelo");
    const r3 = el("div", "row2");
    r3.append(field("Faixa", faixa), field("Capelo", capelo));
    const valor = inpReais(x.valor != null ? x.valor : "", "0,00");
    const zer = el("input");
    zer.type = "checkbox";
    zer.checked = !!x.contratoZerado;
    const lZer = el("label", "chk");
    lZer.append(zer, document.createTextNode(" Contrato zerado (beca emprestada, R$ 0,00)"));
    zer.onchange = () => {
      if (zer.checked) valor.value = "0,00";
      valor.disabled = zer.checked;
    };
    valor.disabled = zer.checked;
    const r4 = el("div", "row2");
    r4.append(field("Valor do aluguel", valor), lZer);
    const ret = el("input");
    ret.type = "date";
    ret.value = x.retirada || "";
    const dev = el("input");
    dev.type = "date";
    dev.value = x.devolucao || "";
    const r5 = el("div", "row2");
    r5.append(field("Retirada", ret), field("Devolução", dev));
    const obs = el("textarea");
    obs.rows = 2;
    obs.maxLength = 600;
    obs.value = x.obs || "";
    // pacote do contrato do colégio (nenhum marcado = pacote padrão do contrato)
    const pac = el("div", "chips");
    const pacCx = ITENS_PACOTE.map(([k, n]) => {
      const l = el("label", "chk");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = lerPacote(x.pacote || []).includes(k);
      l.append(cb, document.createTextNode(" " + n));
      pac.append(l);
      return [k, cb, l, n];
    });
    // preços do contrato deste colégio e ano: aparecem ao lado de cada item, e o valor é a soma do que for marcado
    // (o pai pode comprar só o Paspatur, só o Canudo, só o aluguel ou o kit inteiro)
    let precos = null;
    const somar = () => {
      if (!precos || zer.disabled) return;
      const total = pacCx.filter(([, cb]) => cb.checked).reduce((t, [k]) => t + (Number(precos[k]) || 0), 0);
      zer.checked = false;
      valor.disabled = false;
      valor.value = total.toFixed(2).replace(".", ",");
    };
    const lerPrecos = async () => {
      precos = null;
      pacCx.forEach(([, , l, n]) => (l.lastChild.textContent = " " + n));
      if (!sInst.value || !ano.value) return;
      try {
        const s = await C.FS.getDoc(C.FS.doc(C.db, "contratosColegio", `${sInst.value}_${Number(ano.value)}`));
        const pr = (s.exists() && s.data().precos) || {};
        if (!Object.values(pr).some(v => Number(v) > 0)) return;
        precos = pr;
        pacCx.forEach(([k, , l, n]) => (l.lastChild.textContent = ` ${n}${Number(pr[k]) ? " · " + brl(pr[k]) : ""}`));
      } catch (_) {}
    };
    pacCx.forEach(([, cb]) => cb.addEventListener("change", somar));
    sInst.addEventListener("change", lerPrecos);
    ano.addEventListener("change", lerPrecos);
    lerPrecos();
    // o admin muda o valor; a equipe só cadastra
    if (a && !C.isAdmin) {
      valor.disabled = true;
      zer.disabled = true;
    }
    const err = el("p", "err");
    err.hidden = true;
    // blocos numerados, no padrão do Cadastrar aluno (11/11/2026)
    const b1 = bloco(1, "Colégio"),
      b2 = bloco(2, "Aluno"),
      b3 = bloco(3, "Beca e valor"),
      b4 = bloco(4, "Datas, pacote e observação");
    b1.append(r0);
    b2.append(r1);
    b3.append(r2, r3, r4);
    b4.append(r5, field("Pacote (vazio = padrão do contrato)", pac), field("Observação", obs));
    p.classList.add("cad");
    p.append(b1, b2, b3, b4, err, botoes(close, a ? "Salvar" : "Cadastrar"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const inst = insts.find(i => i.id === sInst.value);
      if (!inst || !nome.value.trim()) return;
      const anoN = parseInt(ano.value, 10);
      if (!anoN || anoN < 2015 || anoN > ANO() + 2) {
        err.textContent = "Ano inválido.";
        err.hidden = false;
        return;
      }
      const body = {
        instId: inst.id,
        instNome: inst.nome || "",
        ano: anoN,
        serie: serie.value,
        nome: nome.value.trim(),
        nomeBusca: U.chave(nome.value),
        tel: U.digits(tel.value),
        responsavel: resp.value.trim(),
        becaTipo: tipo.value,
        tamanho: tam.value,
        menosLonga: ml.checked,
        faixa: faixa.value,
        capelo: capelo.value,
        retirada: ret.value,
        devolucao: dev.value,
        obs: obs.value.trim(),
        pacote: pacCx.filter(([, cb]) => cb.checked).map(([k]) => k),
        atualizadoEm: new Date().toISOString()
      };
      if (!a || C.isAdmin) Object.assign(body, { valor: zer.checked ? 0 : lerReais(valor.value), contratoZerado: zer.checked });
      try {
        // já reservado: a troca de tamanho/faixa/capelo também precisa ter livre
        if (a && STATUS_ALUGUEL.indexOf(a.status) >= 1 && a.status !== "Devolvida") {
          const uso = somarUso(usoAvulsos, usoDosAlunos(alunosUso.filter(y => y.id !== a.id)));
          const falta = faltaParaAluno(C.P.estoque || {}, uso, body);
          if (falta.length) {
            err.textContent = "Não tem livre: " + falta.join(", ");
            err.hidden = false;
            return;
          }
        }
        if (a) {
          await FS.updateDoc(FS.doc(db, "alugueis", a.id), body);
          espelhar(C, "aluno", a.id, Object.assign({}, a, body));
        } else
          await FS.addDoc(
            col,
            Object.assign(body, {
              status: "Cadastrado",
              produtos: [],
              historico: [],
              criadoEm: new Date().toISOString(),
              criadoPor: C.me || "",
              criadoPorEmail: C.email || "",
              respEmail: await donoDoAluguel(C, inst.id, anoN) // fica com quem fechou o contrato do colégio
            })
          );
        U.toast(a ? "Salvo" : "Aluno cadastrado");
        close();
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}
