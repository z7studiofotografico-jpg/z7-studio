// Contrato do colégio (Aluguel de becas → Alunos dos colégios → escolher o colégio → "📄 Contrato do colégio").
// Uma janela com: dados do contrato (quem fechou, quem paga, contato do colégio, entrega combinada, pacote padrão),
// dinheiro (recebido no estúdio, falta repassar com o colégio e com o representante, comissão), pagamentos dos alunos
// (quem recebeu cada um), alunos e pacotes (um por um ou vários de uma vez) e o relatório de produção.
// Quem mexe: o admin e o representante que fechou. Cada mudança guarda quem fez e quando. Regras em contrato-colegio-regras.js.
import { el, title, field, inp, inpReais, sel, sheet, botoes, bloco, blocosDesde } from "./ui.js";
import * as U from "./util.js";
import { lerReais, brl } from "./regras.js";
import { confirmar } from "./confirmar.js";
import { abrirRelatorio } from "./relatorio.js";
import { contatoRel, ordemCodigo } from "./aluno-id.js";
import * as R from "./contrato-colegio-regras.js";
import { chipItem, lerQtd } from "./itens-qtd.js";

let C, FS, db;
let stAtual = null; // o contrato aberto (os preços para o valor do pacote)
const agora = () => new Date().toISOString();
const reg = o => ({ o, em: agora(), por: C.me || C.email || "" });
const histMais = (h, o) => [...(h || []), reg(o)].slice(-40);
const dataBR = d => (d ? d.split("-").reverse().join("/") : "");

// Abre a janela do contrato de um colégio e ano
// o = { entrada: true } → abre já com a janela da entrada / antecipação do colégio (botão do Aluguel de becas)
export function abrirContrato(ctx, inst, ano, o = {}) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
  const id = R.idContrato(inst.id, ano);
  const ref = FS.doc(db, "contratosColegio", id);
  const st = { contrato: null, carregou: false, pags: [], alunos: [], marcados: new Set() };
  stAtual = st;
  const unsubs = [];
  sheet(
    "📄 Contrato do colégio",
    (p, close) => {
      p.append(el("p", "hint", `${title(inst.nome || "")} · ${ano}`));
      const corpo = el("div");
      corpo.append(el("div", "empty", "Carregando…"));
      const fechar = U.mkBtn("Fechar", "", close);
      p.append(corpo, fechar);
      let pediuEntrada = !!o.entrada;
      const desenhar = () => {
        render(corpo, st, inst, ano, ref);
        if (st.janela) st.janela();
        if (pediuEntrada && st.contrato) {
          pediuEntrada = false;
          if (st.contrato.quemPaga === "colegio") formPagamento(null, st, ref);
          else formPagamento(null, st, ref, { alunoId: COLEGIO });
        } else if (pediuEntrada && st.carregou) {
          pediuEntrada = false;
          U.toast("Crie o contrato do colégio primeiro.");
        }
      };
      unsubs.push(
        FS.onSnapshot(
          ref,
          s => {
            st.contrato = s.exists() ? Object.assign({ id: s.id }, s.data()) : null;
            st.carregou = true;
            desenhar();
          },
          e => {
            corpo.innerHTML = "";
            corpo.append(
              el(
                "div",
                "empty",
                e && e.code === "permission-denied"
                  ? C.isAdmin
                    ? "Cole as regras novas do Firebase para usar o Contrato do colégio."
                    : "Este contrato foi fechado por outra pessoa da equipe: só ela e o Adriano veem os valores."
                  : "Não foi possível carregar agora."
              )
            );
          }
        ),
        FS.onSnapshot(
          FS.collection(db, "contratosColegio", id, "pagamentos"),
          s => {
            st.pags = s.docs
              .map(d => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
            if (st.carregou) desenhar();
          },
          () => {}
        ),
        FS.onSnapshot(
          // a equipe lê só os alunos dos seus contratos (o dono do aluno = quem fechou o contrato)
          C.isAdmin
            ? FS.query(FS.collection(db, "alugueis"), FS.where("instId", "==", inst.id), FS.limit(2000))
            : FS.query(
                FS.collection(db, "alugueis"),
                FS.where("instId", "==", inst.id),
                FS.where("respEmail", "==", C.email),
                FS.limit(2000)
              ),
          s => {
            st.alunos = s.docs
              .map(d => Object.assign({ id: d.id }, d.data()))
              .filter(a => String(a.ano) === String(ano) && !(a.excluido && a.excluido.em))
              .sort((a, b) => String(a.serie || "").localeCompare(String(b.serie || ""), "pt-BR") || ordemCodigo(a, b));
            if (st.carregou) desenhar();
          },
          () => {}
        )
      );
    },
    { div: true, wide: true, onClose: () => (unsubs.forEach(u => u()), o.aoFechar && o.aoFechar()) }
  );
}

function render(corpo, st, inst, ano, ref) {
  corpo.innerHTML = "";
  const c = st.contrato;
  if (!c) {
    corpo.append(el("p", "hint", "Este colégio ainda não tem contrato neste ano."));
    corpo.append(U.mkBtn("+ Criar contrato", "btn-primary", () => formContrato(null, inst, ano, ref)));
    return;
  }
  const pode = R.podeEditar(C, c);
  // ---- dados do contrato
  const dados = el("div", "vdbox");
  const linha = (rot, val) => {
    const d = el("div");
    d.append(el("small", "hint", rot), el("div", null, val || "—"));
    return d;
  };
  const grade = el("div", "row2");
  const ct = c.contato || {};
  const ent = c.entrega || {};
  grade.append(
    linha("Quem fechou", c.respNome || "—"),
    linha("Quem paga", (R.QUEM_PAGA.find(([k]) => k === c.quemPaga) || [, "—"])[1]),
    linha("Valor do kit por aluno", c.valorKit ? brl(c.valorKit) + (Number(c.parcelas) > 1 ? ` · em ${c.parcelas}x` : "") : ""),
    linha(
      "Entrada",
      c.entrada && c.entrada.valor
        ? `${brl(c.entrada.valor)} por aluno · paga a ${(R.RECEBE.find(([k]) => k === c.entrada.recebe) || [, "?"])[1].toLowerCase()}` +
            (c.valorKit ? ` · falta ${brl(Math.max(0, c.valorKit - c.entrada.valor))} por aluno` : "")
        : ""
    ),
    ...(R.ITENS_PACOTE.some(([k]) => Number((c.precos || {})[k]))
      ? [
          linha(
            "Preço de item vendido à parte",
            R.ITENS_PACOTE.filter(([k]) => Number((c.precos || {})[k]))
              .map(([k, n]) => `${n} ${brl(c.precos[k])}`)
              .join(" · ")
          )
        ]
      : []),
    ...(c.quemPaga === "colegio"
      ? [
          linha("Valor combinado (total)", c.valor ? brl(c.valor) : ""),
          // mesmo com o colégio pagando, o valor de cada aluno (para ter os valores certos)
          linha("Valor por aluno", valorPorAluno(c, st.alunos))
        ]
      : []),
    linha("Quem costuma receber", c.quemPaga === "colegio" ? "—" : (R.RECEBE.find(([k]) => k === c.recebePadrao) || [, "Estúdio"])[1]),
    linha("Contato do colégio", [ct.nome, ct.cargo && ct.cargo.replace("(a)", "").toLowerCase(), ct.tel].filter(Boolean).join(" · ")),
    linha("Entrega combinada", ent.data ? `${dataBR(ent.data)}${ent.com ? " com " + ent.com : ""}` : ""),
    linha("Séries e turmas", R.textoTurmas(c.turmas)),
    linha("O que vem no kit", R.textoPacote(c.pacotePadrao, c.pacotePadraoQtd) || "—"),
    linha("Unidade", c.unidade || "")
  );
  dados.append(grade);
  if (c.obs) dados.append(el("p", "notes", c.obs));
  const acoes = el("div", "actions");
  if (pode) acoes.append(U.mkBtn("Editar contrato", "btn-sm", () => formContrato(c, inst, ano, ref)));
  acoes.append(U.mkBtn("🖨️ Relatório de produção", "btn-sm", () => relProducao(st, inst, ano)));
  if ((c.historico || []).length) {
    const h = el("details", "notes");
    h.append(el("summary", null, "Quem mudou o quê"));
    c.historico
      .slice()
      .reverse()
      .forEach(x => h.append(el("div", null, `${dataBR(String(x.em).slice(0, 10))} · ${x.por}: ${x.o}`)));
    dados.append(acoes, h);
  } else dados.append(acoes);
  corpo.append(dados);
  // ---- dinheiro
  const r = R.resumoDinheiro(st.pags, c, st.alunos, C.P, C.isDono);
  const k = el("div", "kpis");
  const kpi = (t, v, cls) => {
    const b = el("div", "kpi" + (cls ? " " + cls : ""));
    b.append(el("small", null, t), el("b", null, v));
    k.append(b);
  };
  kpi("Recebido no estúdio", brl(r.caixa));
  kpi("Falta repassar · colégio", brl(r.comColegio), r.comColegio ? "late" : "");
  kpi("Falta repassar · representante", brl(r.comRep), r.comRep ? "late" : "");
  kpi("Falta receber", brl(r.falta));
  if (r.semComissao) kpi("Comissão", `sem comissão (fechado por ${U.first(c.respNome || "") || "dono"})`);
  else if (C.isAdmin || c.respEmail === C.email) {
    kpi(`Comissão${c.respNome ? " · " + U.first(c.respNome) : ""}`, brl(r.comissao));
    kpi("Comissão a pagar", brl(r.comissaoAPagar), r.comissaoAPagar ? "late" : "");
  }
  corpo.append(el("h3", null, "Dinheiro"), k);
  if (r.aConferir && C.isAdmin)
    corpo.append(
      el("p", "notice", `⏳ ${r.aConferir} pagamento${r.aConferir > 1 ? "s" : ""} no caixa para conferir (a comissão conta depois).`)
    );
  // ---- pagamentos
  const hp = el("div", "vhead");
  hp.append(el("h3", null, "Pagamentos"));
  // contrato sem preço (cada aluno paga e nenhum item tem valor): não lança pagamento até o Adriano precificar
  const semPrecoC = c.quemPaga !== "colegio" && !R.temPreco(c);
  if (pode && !semPrecoC) hp.append(U.mkBtn("+ Pagamento", "btn-primary btn-sm", () => formPagamento(null, st, ref)));
  if (pode && !semPrecoC && c.quemPaga !== "colegio")
    hp.append(U.mkBtn("💰 Entrada / antecipação do colégio", "btn-sm", () => formPagamento(null, st, ref, { alunoId: COLEGIO })));
  // (23/11/2026) a entrada de todos de uma vez (quem ainda não tem nenhum pagamento lançado)
  if (pode && c.quemPaga !== "colegio" && c.entrada && c.entrada.valor > 0) {
    const pagos = new Set(st.pags.filter(x => !x.excluido).map(x => x.alunoId));
    const semEnt = st.alunos.filter(a => !a.naoParticipa && !pagos.has(a.id));
    if (semEnt.length) hp.append(U.mkBtn(`✅ Lançar a entrada (${semEnt.length})`, "btn-sm", () => lancarEntradas(semEnt, c)));
  }
  corpo.append(hp);
  if (semPrecoC)
    corpo.append(
      el(
        "p",
        "sem-preco",
        `🚫 Colégio sem preço: ${C.isAdmin ? "toque em “Editar contrato” e coloque o preço de cada item" : "o Adriano precisa colocar o preço de cada item"} para liberar os pagamentos.`
      )
    );
  if (!st.pags.length) corpo.append(el("p", "hint", "Nenhum pagamento lançado."));
  st.pags.forEach(pg => corpo.append(linhaPagamento(pg, st, ref, pode)));
  // ---- alunos e pacotes
  const ha = el("div", "vhead");
  ha.append(el("h3", null, `Alunos e pacotes (${st.alunos.length})`));
  if (pode && st.alunos.length)
    ha.append(
      U.mkBtn(st.marcados.size ? `Aplicar pacote a ${st.marcados.size}` : "Aplicar pacote a vários", "btn-sm", () => {
        if (!st.marcados.size) return U.toast("Marque os alunos na lista (ou “Marcar todos”).");
        escolherPacote(`Pacote para ${st.marcados.size} aluno${st.marcados.size > 1 ? "s" : ""}`, [], async (itens, qtd) => {
          await gravarPacotes([...st.marcados], itens, qtd);
          st.marcados.clear();
        });
      })
    );
  corpo.append(ha);
  if (!st.alunos.length)
    corpo.append(el("p", "hint", "Nenhum aluno deste colégio no ano. Importe a planilha (com a coluna PACOTE) ou use “+ Aluno”."));
  else {
    const pago = R.pagoPorAluno(st.pags);
    if (pode) {
      const todos = el("label", "chk");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = st.marcados.size === st.alunos.length;
      cb.onchange = () => {
        st.marcados = new Set(cb.checked ? st.alunos.map(a => a.id) : []);
        render(corpo, st, inst, ano, ref);
      };
      todos.append(cb, document.createTextNode(" Marcar todos"));
      corpo.append(todos);
    }
    const lst = el("div", "lista-compacta");
    st.alunos.forEach(a => {
      const { itens, padrao } = R.pacoteDoAluno(a, c);
      const l = el("div", "lc-linha");
      if (pode) {
        const cb = el("input");
        cb.type = "checkbox";
        cb.checked = st.marcados.has(a.id);
        cb.setAttribute("aria-label", "Marcar " + title(a.nome));
        cb.onchange = () => {
          if (cb.checked) st.marcados.add(a.id);
          else st.marcados.delete(a.id);
          render(corpo, st, inst, ano, ref);
        };
        l.append(cb);
      }
      // tocar no nome abre a janela do aluno (Resumo · Pacote e pagamentos · Histórico)
      const n = el("button", "lc-nome lc-abrir");
      n.type = "button";
      n.onclick = () => janelaAluno(a.id, st, ref, pode);
      if (a.codigo) n.append(el("span", "lc-id", a.codigo));
      n.append(
        el("b", null, title(a.nome || "")),
        el(
          "small",
          null,
          [
            a.serie,
            R.precoAluno(a, c) ? "kit " + brl(R.precoAluno(a, c)) : "",
            pago[a.id] ? "pagou " + brl(pago[a.id]) : "",
            R.precoAluno(a, c) && !a.naoParticipa ? "falta " + brl(Math.max(0, R.precoAluno(a, c) - (pago[a.id] || 0))) : ""
          ]
            .filter(Boolean)
            .join(" · ")
        )
      );
      const it = el("div", "meta");
      itens.forEach(x => it.append(el("span", "tag " + (x === "paspatur" ? "warn" : "svc"), R.nomeItem(x))));
      if (!itens.length) it.append(el("span", "tag", "sem pacote"));
      if (padrao && itens.length) it.append(el("span", "hint", "padrão"));
      l.append(n, it);
      if (pode)
        l.append(
          U.mkBtn("✏️", "btn-sm", () =>
            escolherPacote("Pacote de " + U.first(title(a.nome || "")), padrao ? [] : itens, (x, q) => gravarPacotes([a.id], x, q), {
              atualQtd: padrao ? {} : a.pacoteQtd
            })
          )
        );
      lst.append(l);
    });
    corpo.append(lst);
  }
}

// colégio paga: o valor de cada aluno pelos preços dos itens; sem preço, o total dividido pelos alunos que participam
function valorPorAluno(c, alunos) {
  const vai = (alunos || []).filter(a => !a.naoParticipa);
  if (!vai.length) return "";
  const soma = vai.reduce((t, a) => t + (R.precoAluno(a, c) || 0), 0);
  if (soma) return `${brl(soma / vai.length)} em média (${vai.length} alunos, pelos itens de cada um)`;
  return c.valor ? `${brl(c.valor / vai.length)} (${brl(c.valor)} ÷ ${vai.length} alunos)` : "";
}
// o pacote (um aluno ou vários marcados) e o valor de cada um pela tabela de preço do contrato
async function gravarPacotes(ids, itens, qtd = {}, contrato = (stAtual && stAtual.contrato) || {}) {
  try {
    for (let i = 0; i < ids.length; i += 400) {
      const b = FS.writeBatch(db);
      ids.slice(i, i + 400).forEach(id => {
        const patch = { pacote: itens, pacoteQtd: qtd || {}, atualizadoEm: agora() };
        const temPreco = R.temPreco(contrato);
        if (temPreco && C.isAdmin) {
          patch.valor = R.precoAluno(
            { pacote: itens, pacoteQtd: qtd, serie: ((stAtual && stAtual.alunos) || []).find(a => a.id === id)?.serie },
            contrato
          );
          patch.contratoZerado = !patch.valor;
        }
        b.update(FS.doc(db, "alugueis", id), patch);
      });
      await b.commit();
    }
    U.toast(itens.length ? "Pacote salvo" : "Voltou para o pacote padrão");
  } catch (e) {
    C.handleErr(e);
  }
}

// Escolher os itens do pacote (nenhum marcado = pacote padrão do contrato), com os kits do colégio
const formContrato = (...a) => import("./contrato-form.js").then(m => (m.usar(C), m.formContrato(...a))).catch(e => C.handleErr(e));
const lancarEntradas = (...a) => import("./contrato-form.js").then(m => (m.usar(C), m.lancarEntradas(...a))).catch(e => C.handleErr(e));
const escolherPacote = (tit, atual, aoSalvar, o = {}) =>
  import("./contrato-kits.js").then(m =>
    m.escolherPacote(tit, atual, aoSalvar, Object.assign({ contrato: stAtual && stAtual.contrato }, o))
  );

// Uma linha de pagamento, com os botões que a pessoa pode usar
function linhaPagamento(pg, st, ref, pode) {
  const c = st.contrato;
  const onde = R.ondeEsta(pg);
  const l = el("div", "lc-linha lc-pag");
  const n = el("div", "lc-nome");
  n.append(
    el(
      "b",
      null,
      `${pg.alunoNome ? title(pg.alunoNome) : pg.tipo === "antecipacao" ? "Colégio · entrada / antecipação" : c.quemPaga === "colegio" ? "Colégio" : "—"} · ${brl(pg.valor)}`
    ),
    el(
      "small",
      null,
      [
        dataBR(pg.data),
        (R.RECEBE.find(([k]) => k === pg.recebidoPor) || [, ""])[1] + (pg.forma ? " · " + pg.forma.toLowerCase() : ""),
        pg.comprovanteOk ? "comprovante ✓" : "",
        pg.comprovante || ""
      ]
        .filter(Boolean)
        .join(" · ")
    )
  );
  const cls = onde === "caixa" ? (pg.conferido ? "ok" : "") : "warn";
  const txt =
    R.textoOnde(pg, c) +
    (onde === "caixa" && pg.repassadoEm ? " " + dataBR(pg.repassadoEm) : "") +
    (onde === "caixa" && !pg.conferido ? " · a conferir" : "");
  l.append(n, el("span", "tag " + cls, txt));
  const ac = el("div", "meta");
  const ehRep = !C.isAdmin;
  const pagRef = FS.doc(db, "contratosColegio", c.id, "pagamentos", pg.id);
  const muda = async (patch, o, msg) => {
    try {
      await FS.updateDoc(pagRef, Object.assign(patch, { atualizadoEm: agora(), historico: histMais(pg.historico, o) }));
      U.toast(msg);
    } catch (e) {
      C.handleErr(e);
    }
  };
  if (pode && onde === "colegio")
    ac.append(
      U.mkBtn("Colégio repassou", "btn-sm btn-ok", async () => {
        if (await confirmar("O colégio repassou?", `Marcar ${brl(pg.valor)} como repassado ao estúdio hoje?`))
          muda({ repassadoEm: U.todayStr(), repassadoPor: C.me || "" }, "marcou repassado pelo colégio", "Marcado como repassado");
      })
    );
  if (pode && onde === "representante" && ehRep)
    ac.append(
      U.mkBtn("Avisar que repassei", "btn-sm", () =>
        muda({ repasseAvisadoEm: U.todayStr() }, "avisou que repassou", "Avisado: falta o admin confirmar")
      )
    );
  if (C.isAdmin && (onde === "representante" || onde === "avisado"))
    ac.append(
      U.mkBtn("Confirmar repasse", "btn-sm btn-ok", async () => {
        if (await confirmar("Recebeu do representante?", `Confirmar que ${brl(pg.valor)} chegou ao estúdio?`))
          muda({ repassadoEm: U.todayStr(), repassadoPor: C.me || "" }, "confirmou o repasse do representante", "Repasse confirmado");
      })
    );
  if (C.isAdmin && onde === "caixa")
    ac.append(
      U.mkBtn(pg.conferido ? "Desfazer conferido" : "Conferir", "btn-sm" + (pg.conferido ? "" : " btn-ok"), () =>
        muda(
          { conferido: !pg.conferido },
          pg.conferido ? "desfez a conferência" : "conferiu",
          pg.conferido ? "Voltou para a conferir" : "Conferido ✅"
        )
      )
    );
  // (24/11/2026) comissão de cada pagamento conferido: a pagar → "Paguei a comissão" (só o admin)
  const com = !R.semComissao(c, C.isDono) && onde === "caixa" && pg.conferido ? R.comissaoPagamento(pg, C.P, c) / 100 : 0;
  if (com > 0) {
    l.append(el("span", "tag " + (pg.comissaoPagaEm ? "ok" : "warn"), `comissão ${brl(com)} ${pg.comissaoPagaEm ? "paga " + dataBR(pg.comissaoPagaEm) : "a pagar"}`));
    if (C.isAdmin)
      ac.append(
        U.mkBtn(pg.comissaoPagaEm ? "Desfazer comissão paga" : "Paguei a comissão", "btn-sm" + (pg.comissaoPagaEm ? "" : " btn-ok"), async () => {
          if (!pg.comissaoPagaEm && !(await confirmar("Pagou a comissão?", `Marcar a comissão de ${brl(com)} como paga hoje?`))) return;
          muda(
            pg.comissaoPagaEm ? { comissaoPagaEm: "", comissaoPagaPor: "" } : { comissaoPagaEm: U.todayStr(), comissaoPagaPor: C.me || "" },
            pg.comissaoPagaEm ? "desfez a comissão paga" : `pagou a comissão (${brl(com)})`,
            pg.comissaoPagaEm ? "Comissão voltou para a pagar" : "Comissão marcada como paga ✅"
          );
        })
      );
  }
  if (pode && (C.isAdmin || R.repPodeMexer(pg))) ac.append(U.mkBtn("Editar", "btn-sm", () => formPagamento(pg, st, ref)));
  if (ac.childNodes.length) l.append(ac);
  if ((pg.historico || []).length) l.title = pg.historico.map(h => `${dataBR(String(h.em).slice(0, 10))} · ${h.por}: ${h.o}`).join("\n");
  return l;
}

// valor do seletor de aluno para a entrada / antecipação do colégio (pagamento sem aluno)
const COLEGIO = "__colegio";
// Lançar / editar um pagamento
function formPagamento(pg, st, ref, pre = {}) {
  const c = st.contrato;
  const x = pg || pre;
  sheet(pg ? "Editar pagamento" : "Novo pagamento", (p, close) => {
    const porAluno = c.quemPaga !== "colegio";
    const sAluno = sel(
      [
        ...(porAluno ? [[COLEGIO, "🏫 Colégio · entrada / antecipação (sem aluno)"]] : []),
        ...st.alunos.map(a => [a.id, `${a.codigo ? a.codigo + " · " : ""}${title(a.nome || "")}${a.serie ? " · " + a.serie : ""}`])
      ],
      x.alunoId || (pg && pg.tipo === "antecipacao" ? COLEGIO : ""),
      "escolha o aluno"
    );
    sAluno.required = porAluno;
    const valor = inpReais(x.valor != null ? x.valor : "", "0,00");
    const sugerir = () => {
      const a = st.alunos.find(y => y.id === sAluno.value);
      const tot = porAluno ? (a ? R.precoAluno(a, c) : 0) : Number(c.valor) || 0;
      if (!pg && tot) valor.value = (Math.round((tot / Math.max(1, Number(c.parcelas) || 1)) * 100) / 100).toFixed(2).replace(".", ",");
    };
    sAluno.addEventListener("change", sugerir);
    sugerir();
    valor.required = true;
    const data = el("input");
    data.type = "date";
    data.value = x.data || U.todayStr();
    data.max = U.todayStr();
    const forma = sel(R.FORMAS_CONTRATO, x.forma || "Dinheiro");
    const recebe = sel(R.RECEBE, x.recebidoPor || (porAluno ? c.recebePadrao || "estudio" : "estudio"));
    const comp = inp(x.comprovante || "", "ex.: Pix de Maria às 14h, ou nº do comprovante", 160);
    const lOk = el("label", "chk");
    const ok = el("input");
    ok.type = "checkbox";
    ok.checked = !!x.comprovanteOk;
    lOk.append(ok, document.createTextNode(" Comprovante recebido"));
    // dinheiro que já está com o representante e foi confirmado: só o admin muda
    if (pg && !C.isAdmin && pg.recebidoPor === "representante") {
      recebe.disabled = true;
      valor.disabled = true;
    }
    const r1 = el("div", "row2");
    if (porAluno) r1.append(field("Aluno", sAluno));
    r1.append(field("Valor", valor));
    const r2 = el("div", "row3");
    r2.append(field("Data", data), field("Forma", forma), field("Quem recebeu", recebe));
    const err = el("p", "err");
    err.hidden = true;
    const fComp = field("Comprovante", comp);
    p.append(r1, r2, fComp, lOk);
    // (24/11/2026) blocos numerados, no padrão do Cadastrar aluno
    blocosDesde(p, [
      [r1, porAluno ? "Aluno e valor" : "Valor"],
      [r2, "Quando, como e quem recebeu"],
      [fComp, "Comprovante"]
    ]);
    if (pg && C.isAdmin) {
      const apagar = U.mkBtn("🗑️ Apagar pagamento", "btn-danger btn-sm", async () => {
        if (
          !(await confirmar("Apagar este pagamento?", `${brl(pg.valor)} de ${dataBR(pg.data)}. Não dá para desfazer.`, {
            perigo: true,
            sim: "Sim, apagar"
          }))
        )
          return;
        try {
          await FS.deleteDoc(FS.doc(db, "contratosColegio", c.id, "pagamentos", pg.id));
          U.toast("Pagamento apagado");
          close();
        } catch (e) {
          C.handleErr(e);
        }
      });
      p.append(apagar);
    }
    p.append(err, botoes(close, pg ? "Salvar" : "Lançar pagamento"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const v = lerReais(valor.value);
      if (!v || v <= 0) {
        err.textContent = "Coloque o valor.";
        err.hidden = false;
        return;
      }
      const al = st.alunos.find(a => a.id === sAluno.value);
      const antecipa = sAluno.value === COLEGIO;
      if (porAluno && !al && !antecipa) {
        err.textContent = "Escolha o aluno.";
        err.hidden = false;
        return;
      }
      const body = {
        alunoId: al ? al.id : "",
        alunoNome: al ? al.nome || "" : "",
        valor: v,
        data: data.value || U.todayStr(),
        forma: forma.value,
        recebidoPor: recebe.value,
        comprovante: comp.value.trim(),
        comprovanteOk: ok.checked,
        // o que este pagamento paga, item por item (base da comissão)
        itens: R.itensDoPagamento(al || null, c, st.alunos),
        tipo: antecipa ? "antecipacao" : "",
        atualizadoEm: agora()
      };
      try {
        if (pg) {
          if (pg.recebidoPor !== body.recebidoPor) Object.assign(body, { repassadoEm: "", repasseAvisadoEm: "", repassadoPor: "" });
          body.historico = histMais(
            pg.historico,
            `editou (${brl(v)}, ${(R.RECEBE.find(([k]) => k === body.recebidoPor) || [, ""])[1].toLowerCase()})`
          );
          await FS.updateDoc(FS.doc(db, "contratosColegio", c.id, "pagamentos", pg.id), body);
        } else
          await FS.addDoc(
            FS.collection(db, "contratosColegio", c.id, "pagamentos"),
            Object.assign(body, {
              conferido: false,
              repassadoEm: "",
              repasseAvisadoEm: "",
              repassadoPor: "",
              por: C.me || "",
              porEmail: C.email || "",
              criadoEm: agora(),
              historico: [reg(`lançou ${brl(v)}`)]
            })
          );
        U.toast(pg ? "Pagamento salvo" : "Pagamento lançado ✅");
        close();
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}

// Relatório de produção: colégio, unidade, quem fechou e a entrega no topo; um aluno por linha com os itens; totais;
// quem tem paspatur sai como "precisa de foto"
function relProducao(st, inst, ano) {
  const c = st.contrato || {};
  const pr = R.producao(st.alunos, c);
  const ct = c.contato || {};
  const ent = c.entrega || {};
  abrirRelatorio(
    {
      titulo: `Produção · ${title(inst.nome || "")}${c.unidade ? " · " + c.unidade : ""} · ${ano}`,
      subtitulo: [
        c.respNome ? "Representante: " + c.respNome : "",
        ent.data ? `Entrega ${dataBR(ent.data)}${ent.com ? " com " + ent.com : ""}` : "",
        ct.nome ? `Contato: ${ct.nome}${ct.cargo ? " (" + ct.cargo.replace("(a)", "").toLowerCase() + ")" : ""}` : ""
      ]
        .filter(Boolean)
        .join(" · "),
      secoes: [
        { titulo: "Totais", kpis: [["Alunos", pr.linhas.length], ...R.ITENS_PACOTE.map(([k, n]) => [n, pr.totais[k]])] },
        {
          titulo: "Alunos",
          tabela: {
            cols: ["ID", "Aluno", "Turma", "Colégio", "Unidade", "Itens", "Foto", "Contato"],
            linhas: pr.linhas.map(l => [
              l.aluno.codigo || "",
              title(l.aluno.nome || ""),
              l.aluno.serie || "",
              title(inst.nome || ""),
              l.aluno.unidade || c.unidade || "",
              R.textoPacote(l.itens) || "—",
              l.foto ? "PRECISA DE FOTO" : "",
              contatoRel(l.aluno.tel, "")
            ])
          }
        },
        ...(pr.precisamFoto.length
          ? [
              {
                titulo: `Precisam de foto (paspatur): ${pr.precisamFoto.length}`,
                nota: pr.precisamFoto.map(l => (l.aluno.codigo ? l.aluno.codigo + " " : "") + title(l.aluno.nome || "")).join(", ")
              }
            ]
          : [])
      ]
    },
    C.me
  );
}

// Janela do aluno do contrato: abas Resumo · Pacote e pagamentos · Histórico (atualiza junto com o contrato)
const ABAS_CT = [
  ["resumo", "Resumo"],
  ["pacote", "Pacote e pagamentos"],
  ["historico", "Histórico"]
];
let abaCt = "resumo";
function janelaAluno(id, st, ref, pode) {
  sheet(
    null,
    (p, close) => {
      p.classList.add("janela-aluno");
      const topo = el("div", "ja-topo"),
        abas = el("div", "ja-abas"),
        corpo = el("div", "ja-corpo");
      abas.setAttribute("role", "tablist");
      p.append(topo, abas, corpo);
      const desenhar = () => {
        const a = st.alunos.find(x => x.id === id);
        if (!a) return close();
        const c = st.contrato || {};
        const pags = st.pags.filter(x => x.alunoId === id);
        topo.innerHTML = "";
        const nome = el("div", "ja-nome");
        if (a.codigo) nome.append(el("span", "lc-id", a.codigo));
        nome.append(
          el("h2", null, title(a.nome || "")),
          el("small", null, [title(a.instNome || ""), a.unidade || c.unidade, a.serie, a.ano].filter(Boolean).join(" · "))
        );
        topo.append(U.mkBtn("‹ Voltar ao contrato", "btn-sm", close), nome, el("span", "lc-selo ja-selo", a.status || "Cadastrado"));
        abas.innerHTML = "";
        ABAS_CT.forEach(([k, t]) => {
          const b = el("button", "chip", t);
          b.type = "button";
          b.setAttribute("role", "tab");
          b.setAttribute("aria-selected", String(abaCt === k));
          b.setAttribute("aria-pressed", String(abaCt === k));
          b.onclick = () => {
            abaCt = k;
            desenhar();
          };
          abas.append(b);
        });
        corpo.innerHTML = "";
        const dados = el("div", "ja-dados");
        const linha = (rot, val) => {
          if (!val) return;
          const d = el("div");
          d.append(el("small", null, rot), el("span", null, val));
          dados.append(d);
        };
        const { itens, padrao, qtd } = R.pacoteDoAluno(a, c);
        if (abaCt === "resumo") {
          linha("WhatsApp", a.tel ? a.tel.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3") : "sem telefone");
          linha("Responsável", a.responsavel || "");
          linha("Pacote", (R.textoPacote(itens, qtd) || "sem pacote") + (padrao && itens.length ? " (padrão)" : ""));
          linha(
            "Beca",
            [a.tamanho ? "tamanho " + a.tamanho + (a.menosLonga ? "1" : "") : "", a.faixa ? "faixa" : "", a.capelo ? "capelo" : ""]
              .filter(Boolean)
              .join(" · ")
          );
          linha("Situação do aluguel", a.status || "Cadastrado");
          linha("Retirada · devolução", [dataBR(a.retirada), dataBR(a.devolucao)].filter(Boolean).join(" · "));
          linha("Observação", a.obs || "");
          corpo.append(dados);
          if (itens.includes("paspatur")) corpo.append(el("p", "wait", "📷 Tem paspatur: precisa de foto do ensaio."));
          const ac = el("div", "actions");
          if (a.tel) {
            const w = el("a", "btn btn-sm btn-primary", "Abrir no WhatsApp");
            w.href = "https://wa.me/55" + U.digits(a.tel);
            w.target = "_blank";
            w.rel = "noopener";
            ac.append(w);
          }
          corpo.append(ac);
        } else if (abaCt === "pacote") {
          const r0 = R.precoAluno(a, c);
          const pago = pags.reduce((t, x) => t + Math.round(Number(x.valor || 0) * 100), 0) / 100;
          linha("Itens", (R.textoPacote(itens, qtd) || "sem pacote") + (padrao && itens.length ? " (padrão do contrato)" : ""));
          linha("Valor do pacote", r0 ? brl(r0) : "");
          linha("Já pagou", brl(pago));
          linha("Falta", r0 ? brl(Math.max(0, r0 - pago)) : "");
          corpo.append(dados);
          const ac = el("div", "actions");
          if (pode) {
            ac.append(
              U.mkBtn("✏️ Mudar pacote", "btn-sm", () =>
                escolherPacote("Pacote de " + U.first(title(a.nome || "")), padrao ? [] : itens, (x, q) => gravarPacotes([a.id], x, q), {
                  atualQtd: padrao ? {} : a.pacoteQtd
                })
              )
            );
            if (c.quemPaga !== "colegio" && R.temPreco(c))
              ac.append(U.mkBtn("+ Pagamento", "btn-primary btn-sm", () => formPagamento(null, st, ref, { alunoId: a.id })));
          }
          corpo.append(ac, el("h3", null, "Pagamentos"));
          if (!pags.length) corpo.append(el("p", "hint", "Nenhum pagamento deste aluno."));
          pags.forEach(pg => corpo.append(linhaPagamento(pg, st, ref, pode)));
        } else {
          const ev = [];
          (a.historico || []).forEach(h => ev.push([h.em, `${h.de} → ${h.para}${h.por ? " (" + U.first(h.por) + ")" : ""}`]));
          pags.forEach(pg =>
            (pg.historico || []).forEach(h =>
              ev.push([h.em, `Pagamento ${brl(pg.valor)}: ${h.o}${h.por ? " (" + U.first(h.por) + ")" : ""}`])
            )
          );
          if (a.criadoEm) ev.push([a.criadoEm, "Cadastrado"]);
          ev.sort((x, y) => String(y[0]).localeCompare(String(x[0])));
          const l = el("div", "ja-linha-tempo");
          ev.forEach(([d, t]) => {
            const x = el("div");
            x.append(el("small", null, dataBR(String(d).slice(0, 10))), el("span", null, t));
            l.append(x);
          });
          if (!ev.length) l.append(el("p", "hint", "Nada registrado ainda."));
          corpo.append(l);
        }
      };
      st.janela = desenhar;
      desenhar();
    },
    { div: true, wide: true, onClose: () => (st.janela = null) }
  );
}
