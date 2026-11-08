// Contrato do colégio (Aluguel de becas → Alunos dos colégios → escolher o colégio → "📄 Contrato do colégio").
// Uma janela com: dados do contrato (quem fechou, quem paga, contato do colégio, entrega combinada, pacote padrão),
// dinheiro (recebido no estúdio, falta repassar com o colégio e com o representante, comissão), pagamentos dos alunos
// (quem recebeu cada um), alunos e pacotes (um por um ou vários de uma vez) e o relatório de produção.
// Quem mexe: o admin e o representante que fechou. Cada mudança guarda quem fez e quando. Regras em contrato-colegio-regras.js.
import { el, title, field, inp, inpReais, sel, sheet, botoes } from "./ui.js";
import * as U from "./util.js";
import { lerReais, brl } from "./regras.js";
import { confirmar } from "./confirmar.js";
import { abrirRelatorio } from "./relatorio.js";
import { contatoRel } from "./aluno-id.js";
import * as R from "./contrato-colegio-regras.js";

let C, FS, db;
const agora = () => new Date().toISOString();
const reg = o => ({ o, em: agora(), por: C.me || C.email || "" });
const histMais = (h, o) => [...(h || []), reg(o)].slice(-40);
const dataBR = d => (d ? d.split("-").reverse().join("/") : "");

// Abre a janela do contrato de um colégio e ano
export function abrirContrato(ctx, inst, ano) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
  const id = R.idContrato(inst.id, ano);
  const ref = FS.doc(db, "contratosColegio", id);
  const st = { contrato: null, carregou: false, pags: [], alunos: [], marcados: new Set() };
  const unsubs = [];
  sheet(
    "📄 Contrato do colégio",
    (p, close) => {
      p.append(el("p", "hint", `${title(inst.nome || "")} · ${ano}`));
      const corpo = el("div");
      corpo.append(el("div", "empty", "Carregando…"));
      const fechar = U.mkBtn("Fechar", "", close);
      p.append(corpo, fechar);
      const desenhar = () => render(corpo, st, inst, ano, ref);
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
                  ? "Cole as regras novas do Firebase para usar o Contrato do colégio."
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
          FS.query(FS.collection(db, "alugueis"), FS.where("instId", "==", inst.id), FS.limit(2000)),
          s => {
            st.alunos = s.docs
              .map(d => Object.assign({ id: d.id }, d.data()))
              .filter(a => String(a.ano) === String(ano) && !(a.excluido && a.excluido.em))
              .sort(
                (a, b) =>
                  String(a.serie || "").localeCompare(String(b.serie || ""), "pt-BR") || (a.nome || "").localeCompare(b.nome || "", "pt-BR")
              );
            if (st.carregou) desenhar();
          },
          () => {}
        )
      );
    },
    { div: true, wide: true, onClose: () => unsubs.forEach(u => u()) }
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
    linha(
      "Preço por item",
      R.ITENS_PACOTE.filter(([k]) => Number((c.precos || {})[k]))
        .map(([k, n]) => `${n} ${brl(c.precos[k])}`)
        .join(" · ") + (Number(c.parcelas) > 1 ? ` · em ${c.parcelas}x` : "")
    ),
    ...(c.quemPaga === "colegio" ? [linha("Valor combinado (total)", c.valor ? brl(c.valor) : "")] : []),
    linha("Quem costuma receber", c.quemPaga === "colegio" ? "—" : (R.RECEBE.find(([k]) => k === c.recebePadrao) || [, "Estúdio"])[1]),
    linha("Contato do colégio", [ct.nome, ct.cargo && ct.cargo.replace("(a)", "").toLowerCase(), ct.tel].filter(Boolean).join(" · ")),
    linha("Entrega combinada", ent.data ? `${dataBR(ent.data)}${ent.com ? " com " + ent.com : ""}` : ""),
    linha("Pacote padrão", R.textoPacote(c.pacotePadrao) || "—"),
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
  const r = R.resumoDinheiro(st.pags, c, st.alunos, C.P);
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
  if (C.isAdmin || c.respEmail === C.email) kpi(`Comissão${c.respNome ? " · " + U.first(c.respNome) : ""}`, brl(r.comissao));
  corpo.append(el("h3", null, "Dinheiro"), k);
  if (r.aConferir && C.isAdmin)
    corpo.append(
      el("p", "notice", `⏳ ${r.aConferir} pagamento${r.aConferir > 1 ? "s" : ""} no caixa para conferir (a comissão conta depois).`)
    );
  // ---- pagamentos
  const hp = el("div", "vhead");
  hp.append(el("h3", null, "Pagamentos"));
  if (pode) hp.append(U.mkBtn("+ Pagamento", "btn-primary btn-sm", () => formPagamento(null, st, ref)));
  corpo.append(hp);
  if (!st.pags.length) corpo.append(el("p", "hint", "Nenhum pagamento lançado."));
  st.pags.forEach(pg => corpo.append(linhaPagamento(pg, st, ref, pode)));
  // ---- alunos e pacotes
  const ha = el("div", "vhead");
  ha.append(el("h3", null, `Alunos e pacotes (${st.alunos.length})`));
  if (pode && st.alunos.length)
    ha.append(
      U.mkBtn(st.marcados.size ? `Aplicar pacote a ${st.marcados.size}` : "Aplicar pacote a vários", "btn-sm", () => {
        if (!st.marcados.size) return U.toast("Marque os alunos na lista (ou “Marcar todos”).");
        escolherPacote(`Pacote para ${st.marcados.size} aluno${st.marcados.size > 1 ? "s" : ""}`, [], async itens => {
          await gravarPacotes([...st.marcados], itens);
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
      const n = el("div", "lc-nome");
      n.append(
        el("b", null, title(a.nome || "")),
        el(
          "small",
          null,
          [a.serie, R.precoAluno(a, c) ? "pacote " + brl(R.precoAluno(a, c)) : "", pago[a.id] ? "pagou " + brl(pago[a.id]) : ""]
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
            escolherPacote("Pacote de " + U.first(title(a.nome || "")), padrao ? [] : itens, x => gravarPacotes([a.id], x))
          )
        );
      lst.append(l);
    });
    corpo.append(lst);
  }
}

async function gravarPacotes(ids, itens) {
  try {
    for (let i = 0; i < ids.length; i += 400) {
      const b = FS.writeBatch(db);
      ids.slice(i, i + 400).forEach(id => b.update(FS.doc(db, "alugueis", id), { pacote: itens, atualizadoEm: agora() }));
      await b.commit();
    }
    U.toast(itens.length ? "Pacote salvo" : "Voltou para o pacote padrão");
  } catch (e) {
    C.handleErr(e);
  }
}

// Escolher os itens do pacote (nenhum marcado = pacote padrão do contrato)
function escolherPacote(tit, atual, aoSalvar, { padraoTxt = "Nenhum marcado = pacote padrão do contrato." } = {}) {
  sheet(tit, (p, close) => {
    p.append(el("p", "hint", padraoTxt));
    const caixas = R.ITENS_PACOTE.map(([k, nome]) => {
      const l = el("label", "chk");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = (atual || []).includes(k);
      l.append(cb, document.createTextNode(" " + nome));
      p.append(l);
      return [k, cb];
    });
    p.append(botoes(close, "Salvar"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      await aoSalvar(caixas.filter(([, cb]) => cb.checked).map(([k]) => k));
      close();
    });
  });
}

// Cadastro / edição do contrato
function formContrato(c, inst, ano, ref) {
  const x = c || {};
  const admin = C.isAdmin;
  sheet(c ? "Editar contrato" : "Novo contrato do colégio", (p, close) => {
    p.append(el("p", "hint", `${title(inst.nome || "")} · ${ano}`));
    // quem fechou: o admin escolhe; quem é da equipe fecha em nome próprio
    const pessoas = Object.entries(C.usuarios || {})
      .filter(([, u]) => u && u.ativo !== false && u.nome)
      .map(([em, u]) => [em, u.nome])
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
    if (C.email && !pessoas.some(([em]) => em === C.email)) pessoas.unshift([C.email, C.me || C.email]);
    const sResp = sel(pessoas, x.respEmail || C.email || "", "quem fechou");
    sResp.required = true;
    sResp.disabled = !admin;
    const quem = sel(R.QUEM_PAGA, x.quemPaga || "alunos");
    const recebe = sel(R.RECEBE, x.recebePadrao || "estudio");
    const valor = inpReais(x.valor != null ? x.valor : "", "0,00");
    const parc = inp(String(x.parcelas || 1), "1", 2);
    parc.inputMode = "numeric";
    // preço de cada item: o valor do aluno é a soma dos itens do pacote dele (e a comissão sai item por item)
    const precos = el("div", "row2");
    const precoCx = R.ITENS_PACOTE.map(([k, n]) => {
      const i = inpReais((x.precos || {})[k] != null ? x.precos[k] : "", "0,00");
      precos.append(field(n + " (R$)", i));
      return [k, i];
    });
    if (c && !admin) {
      quem.disabled = true;
      valor.disabled = true;
      parc.disabled = true;
      precoCx.forEach(([, i]) => (i.disabled = true));
    }
    const fValor = field("Valor total (o colégio paga)", valor);
    const fRecebe = field("Quem costuma receber", recebe);
    const sync = () => {
      fValor.hidden = quem.value !== "colegio";
      fRecebe.hidden = quem.value === "colegio";
    };
    quem.onchange = sync;
    sync();
    const r1 = el("div", "row2");
    r1.append(field("Quem fechou", sResp), field("Quem paga", quem));
    const r2 = el("div", "row3");
    r2.append(field("Parcelas", parc), fRecebe, fValor);
    const ct = x.contato || {};
    const cNome = inp(ct.nome || "", "nome");
    const cCargo = sel(R.CARGOS, ct.cargo || "Diretor(a)");
    const cTel = inp(ct.tel || "", "(21) 9…", 30);
    cTel.inputMode = "tel";
    const r3 = el("div", "row3");
    r3.append(field("Contato do colégio", cNome), field("Cargo", cCargo), field("WhatsApp", cTel));
    const en = x.entrega || {};
    const eData = el("input");
    eData.type = "date";
    eData.value = en.data || "";
    const eCom = inp(en.com || "", "ex.: Márcia (coordenadora)");
    const r4 = el("div", "row2");
    r4.append(field("Entrega combinada (dia/mês/ano)", eData), field("Combinada com", eCom));
    const unidade = inp(x.unidade || "", "se o colégio tiver mais de uma");
    const obs = el("textarea");
    obs.rows = 2;
    obs.maxLength = 600;
    obs.value = x.obs || "";
    const pacote = el("div", "chips");
    const caixas = R.ITENS_PACOTE.map(([k, nome]) => {
      const l = el("label", "chk");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = (x.pacotePadrao || ["paspatur", "certificado", "canudo"]).includes(k);
      l.append(cb, document.createTextNode(" " + nome));
      pacote.append(l);
      return [k, cb];
    });
    const err = el("p", "err");
    err.hidden = true;
    p.append(
      r1,
      field("Preço de cada item (o aluno paga a soma do pacote dele)", precos),
      r2,
      r3,
      r4,
      field("Pacote padrão (quem não tiver PACOTE na planilha)", pacote),
      field("Unidade", unidade),
      field("Observação", obs),
      err,
      botoes(close, c ? "Salvar" : "Criar contrato")
    );
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const nomeResp = (pessoas.find(([em]) => em === sResp.value) || [, ""])[1];
      if (!sResp.value) {
        err.textContent = "Escolha quem fechou.";
        err.hidden = false;
        return;
      }
      if (cTel.value && U.digits(cTel.value).length < 10) {
        err.textContent = "WhatsApp do contato incompleto (DDD + número).";
        err.hidden = false;
        return;
      }
      const body = {
        recebePadrao: quem.value === "colegio" ? "colegio" : recebe.value,
        contato: { nome: cNome.value.trim(), cargo: cCargo.value, tel: U.digits(cTel.value) },
        entrega: { data: eData.value, com: eCom.value.trim() },
        pacotePadrao: caixas.filter(([, cb]) => cb.checked).map(([k]) => k),
        unidade: unidade.value.trim(),
        obs: obs.value.trim(),
        atualizadoEm: agora()
      };
      if (!c || admin)
        Object.assign(body, {
          respEmail: sResp.value,
          respNome: nomeResp,
          quemPaga: quem.value,
          valor: quem.value === "colegio" ? lerReais(valor.value) || 0 : 0,
          precos: Object.fromEntries(precoCx.map(([k, i]) => [k, lerReais(i.value) || 0])),
          parcelas: Math.max(1, parseInt(parc.value, 10) || 1)
        });
      try {
        if (c) {
          const mud = [];
          if (body.entrega.data !== (en.data || "") || body.entrega.com !== (en.com || ""))
            mud.push("entrega " + dataBR(body.entrega.data));
          if (body.valor != null && Number(body.valor) !== Number(x.valor || 0)) mud.push("valor " + brl(body.valor));
          if (body.precos && JSON.stringify(body.precos) !== JSON.stringify(x.precos || {})) mud.push("preços dos itens");
          if (body.quemPaga && body.quemPaga !== x.quemPaga) mud.push("quem paga");
          if (body.respEmail && body.respEmail !== x.respEmail) mud.push("quem fechou: " + nomeResp);
          if (body.contato.nome !== (ct.nome || "") || body.contato.tel !== (ct.tel || "")) mud.push("contato");
          if (R.textoPacote(body.pacotePadrao) !== R.textoPacote(x.pacotePadrao)) mud.push("pacote padrão");
          body.historico = histMais(x.historico, "editou o contrato" + (mud.length ? " (" + mud.join(", ") + ")" : ""));
          await FS.updateDoc(ref, body);
        } else
          await FS.setDoc(
            ref,
            Object.assign(body, {
              instId: inst.id,
              instNome: inst.nome || "",
              ano: Number(ano),
              criadoEm: agora(),
              criadoPor: C.me || "",
              historico: [reg("criou o contrato")]
            })
          );
        U.toast(c ? "Contrato salvo" : "Contrato criado ✅");
        close();
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}

// Uma linha de pagamento, com os botões que a pessoa pode usar
function linhaPagamento(pg, st, ref, pode) {
  const c = st.contrato;
  const onde = R.ondeEsta(pg);
  const l = el("div", "lc-linha lc-pag");
  const n = el("div", "lc-nome");
  n.append(
    el("b", null, `${pg.alunoNome ? title(pg.alunoNome) : c.quemPaga === "colegio" ? "Colégio" : "—"} · ${brl(pg.valor)}`),
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
  if (pode && (C.isAdmin || R.repPodeMexer(pg))) ac.append(U.mkBtn("Editar", "btn-sm", () => formPagamento(pg, st, ref)));
  if (ac.childNodes.length) l.append(ac);
  if ((pg.historico || []).length) l.title = pg.historico.map(h => `${dataBR(String(h.em).slice(0, 10))} · ${h.por}: ${h.o}`).join("\n");
  return l;
}

// Lançar / editar um pagamento
function formPagamento(pg, st, ref) {
  const c = st.contrato;
  const x = pg || {};
  sheet(pg ? "Editar pagamento" : "Novo pagamento", (p, close) => {
    const porAluno = c.quemPaga !== "colegio";
    const sAluno = sel(
      st.alunos.map(a => [a.id, `${title(a.nome || "")}${a.serie ? " · " + a.serie : ""}`]),
      x.alunoId || "",
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
    p.append(r1, r2, field("Comprovante", comp), lOk);
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
      if (porAluno && !al) {
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
            cols: ["Aluno", "Turma", "Colégio", "Unidade", "Itens", "Foto", "Contato"],
            linhas: pr.linhas.map(l => [
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
                nota: pr.precisamFoto.map(l => title(l.aluno.nome || "")).join(", ")
              }
            ]
          : [])
      ]
    },
    C.me
  );
}
