// Turma de um colégio FECHADO: formandos, kits (Kit 01 = adesão; Kits 02 a 05), parcelas e cobrança.
// Coleção "formandos": { instId, instNome, nome, tel, serie, contrato, kit, valor, parcelas, primeiroVenc, formaPag,
//   pagamentos: [{ data, valor, por }], pagas (= quantidade de pagamentos), proxVenc, status, resp, respEmail, vendidoEm }
// Regras de parcela e dinheiro: js/regras.js. Só o administrador registra pagamento e muda valores.
import { linhasRetorno, abrirRetorno } from "./retorno.js";
import {
  brl,
  dividir,
  pagamentosDe,
  pagasDe,
  nParcelas,
  quitado,
  atrasado as atrasadoEm,
  vencDa,
  valorParcela,
  recebido,
  emAberto,
  somar,
  proxVenc,
  ehKit01,
  ativo,
  SITUACOES
} from "./regras.js";
import {
  kitsDe,
  ehAdesao,
  ehRepasse,
  anoDaTurma,
  previsaoEntrega,
  quitadoEm,
  diferencasDaTurma,
  candidatosPosFoto,
  MINIMO_FORMANDOS
} from "./contrato.js";
import { msgCobranca, msgOfertaKit } from "./mensagens.js";
import { contratoTurma, kitsTurma, importarFormandos } from "./turma-ajustes.js";
import { el, title, norm, inp, sheet, wa, avisoErro, emPartes } from "./ui.js";
import * as U from "./util.js";
import { ordemCodigo, avisoTel, telRelatorio, contatoRel } from "./aluno-id.js";
import { abrirRelatorio } from "./relatorio.js";
import { formFormando } from "./turma-formando.js";
let C,
  FS,
  db,
  unsub = null;
const hoje = () => U.todayStr();
export const atrasado = f => atrasadoEm(f, hoje());
export { quitado, ehKit01, vencDa };

// guarda o contexto para as funções internas desta tela; toda função exportada recebe o ctx e chama usar(ctx),
// então nenhuma depende de outra ter sido chamada antes
function usar(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
}

// Registra a próxima parcela paga numa transação (duas pessoas ao mesmo tempo não se atropelam)
export async function registrarPagamento(ctx, f) {
  usar(ctx);
  const ref = FS.doc(db, "formandos", f.id);
  const r = await FS.runTransaction(db, async tx => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("não encontrado");
    const atual = Object.assign({ id: f.id }, s.data());
    if (quitado(atual)) return { ja: true, n: pagasDe(atual) };
    const lst = pagamentosDe(atual).slice(),
      n = lst.length + 1;
    lst.push({ data: hoje(), valor: valorParcela(atual, n), por: C.email || "" });
    const novo = Object.assign({}, atual, { pagamentos: lst });
    tx.update(ref, {
      pagamentos: lst,
      pagas: lst.length,
      proxVenc: proxVenc(novo),
      ultimoPag: hoje(),
      atualizadoEm: new Date().toISOString()
    });
    return { n };
  });
  U.toast(r.ja ? "Esse formando já está quitado" : `Parcela ${r.n} de ${U.first(title(f.nome))} registrada`);
}
// Desfaz o último pagamento (lançado por engano)

// Mensagem de cobrança no WhatsApp (usada aqui e no card Formaturas)
// Formaturas: "Pediu contato depois" no formando (motivo + data). Usado aqui e nas cobranças.
export function retornoFormando(ctx, f) {
  abrirRetorno(ctx, f, patch =>
    ctx.FS.updateDoc(ctx.FS.doc(ctx.db, "formandos", f.id), Object.assign(patch, { atualizadoEm: new Date().toISOString() })).then(() =>
      U.toast("Anotado: falar de novo em " + U.fmtDate(patch.retorno.data))
    )
  );
}
export function cobrarWa(ctx, f) {
  usar(ctx);
  const prox = pagasDe(f) + 1,
    venc = vencDa(f, prox),
    col = ehKit01(f);
  const item = col ? "da adesão da formatura (Kit 01)" : `do ${f.kit || "kit da formatura"}`;
  const pagar = f.formaPag === "Boleto" ? "\nO pagamento é pelo boleto." : C.P.pix ? `\nChave Pix: ${C.P.pix}` : "";
  const msg = msgCobranca({
    nome: title(f.nome),
    parcela: `${prox}/${nParcelas(f)}`,
    item,
    valor: brl(valorParcela(f, prox)),
    venc: venc ? U.fmtDate(venc) : "",
    atrasada: atrasado(f),
    pagar
  });
  wa(f.tel, msg, U.toast);
}
// Mensagem para quem tem só o Kit 01: as fotos ficaram prontas, kits no preço depois das fotos (tabela da turma)
// Kits no preço depois das fotos (tabela da turma), uma linha por kit
export function linhasKitsPos(P, inst) {
  // turma de ano anterior: preço de repasse
  const q = ehRepasse(inst, hoje()) ? "rep" : "pos";
  return kitsDe(P, inst)
    .filter(k => !ehAdesao(k.id) && k[q] && Number(k[q].valor))
    .map(k => {
      const n = Math.max(1, Number(k[q].parcelas) || 1);
      return `• ${k.nome}: ${n > 1 ? `${n}x de ${brl(dividir(k[q].valor, n)[n - 1])} (${brl(k[q].valor)})` : brl(k[q].valor)}`;
    });
}
// Prévia da formatura (todas as fotos do kit e prévia do álbum), com os kits na mensagem
export async function abrirPrevia(ctx, inst, f) {
  usar(ctx);
  try {
    const { openPrevia } = await import("./previa.js");
    openPrevia({
      nome: title(f.nome),
      escola: title(inst.nome || f.instNome || ""),
      kits: linhasKitsPos(C.P, inst).join("\n"),
      toast: U.toast
    });
  } catch (e) {
    avisoErro(e, "abrir a prévia", U.toast);
  }
}
export function oferecerKit(ctx, inst, f) {
  usar(ctx);
  const rep = ehRepasse(inst, hoje()),
    lin = linhasKitsPos(C.P, inst);
  if (!lin.length) return U.toast(`Defina os preços ${rep ? "de repasse" : "depois das fotos"} em “📋 Kits e preços” (card Formaturas)`);
  const msg = msgOfertaKit({ nome: title(f.nome), escola: title(inst.nome), linhas: lin, repasse: rep, ano: anoDaTurma(inst) });
  wa(f.tel, msg, U.toast);
}
// opcoes.novo = abre já com o formulário de formando novo (botão "+ Formando" do card Formaturas)
// o formulário do formando fica em turma-formando.js
const abrirFormando = (T, f, preset) => formFormando(C, T, f, preset);
export function openTurma(ctx, inst, kits, aoFechar, opcoes) {
  usar(ctx);
  const col = FS.collection(db, "formandos");
  // a turma aberta: o que as partes da tela (lista, cartões, formulário, relatório) compartilham
  const T = { inst, opcoes: opcoes || {}, lista: [], filtro: "todos", busca: "" };
  const close = sheet(
    null,
    (p, fechar) => {
      const head = el("div", "vhead");
      head.append(el("h2", null, "Formandos · " + title(T.inst.nome)), U.mkBtn("Fechar", "btn-sm", fechar));
      p.append(head);
      T.resumo = el("div", "kpis");
      p.append(T.resumo);
      // Quantidade de alunos: começa pela média (combinada com o colégio); depois das fotos confirma a certa
      T.qtdBox = el("div", "notes");
      p.append(T.qtdBox);
      const bar = el("div", "actions");
      bar.append(U.mkBtn("+ Formando", "btn-primary", () => abrirFormando(T)));
      bar.append(U.mkBtn("🖨️ Lista da turma", "", () => abrirRelatorio(relatorioTurma(T), C.me)));
      if (C.isAdmin) bar.append(U.mkBtn("Importar planilha", "", () => importarFormandos(C, T.inst, T.lista)));
      if (C.isAdmin)
        bar.append(
          U.mkBtn("📅 Contrato da turma", "", () => contratoTurma(C, T.inst, () => desenhar(T))),
          U.mkBtn("📋 Kits desta turma", "", () => kitsTurma(C, T.inst, () => desenhar(T)))
        );
      p.append(bar);
      if (!C.isAdmin)
        p.append(el("p", "hint", "Você cadastra os formandos. Pagamentos e valores são lançados pelo Adriano ou pela Luciana."));
      T.chips = el("div", "T.chips");
      p.append(T.chips);
      const q = inp("", "Buscar nome ou telefone");
      q.type = "search";
      q.className = "search";
      q.oninput = () => {
        T.busca = norm(q.value);
        desenhar(T);
      };
      p.append(q);
      T.lst = el("div", "grid");
      p.append(T.lst);
      if (T.opcoes.novo) setTimeout(() => abrirFormando(T), 0);
      unsub = FS.onSnapshot(
        C.isAdmin ? FS.query(col, FS.where("instId", "==", T.inst.id), FS.limit(2000)) : C.carteira("formandos"),
        snap => {
          T.lista = snap.docs
            .map(d => Object.assign({ id: d.id }, d.data()))
            .filter(f => f.instId === T.inst.id)
            .sort(ordemCodigo); // na ordem do ID (como na separação das fotos); sem ID, por nome no fim
          desenhar(T);
        },
        e => {
          avisoErro(e, "carregar os formandos");
          T.lst.innerHTML = "";
          T.lst.append(
            el(
              "div",
              "empty",
              e.code === "permission-denied"
                ? "Cole as regras novas do Firebase para usar a lista de formandos."
                : "Não foi possível carregar."
            )
          );
        }
      );
    },
    {
      div: true,
      wide: true,
      onClose: () => {
        if (unsub) {
          unsub();
          unsub = null;
        }
        if (aoFechar) aoFechar();
      }
    }
  );
  return close;
}
function desenhar(T) {
  const ativos = T.lista.filter(ativo),
    semKit = candidatosPosFoto(T.lista),
    candSet = new Set(semKit), // calculado uma vez por desenho (antes era por cartão: travava turmas grandes)
    sairam = T.lista.filter(f => f.status === "desistiu" || f.status === "reprovou"),
    atr = ativos.filter(atrasado);
  const nomesUnicos = new Set(T.lista.filter(f => !sairam.includes(f)).map(f => norm(f.nome))).size;
  T.qtdBox.innerHTML = "";
  T.qtdBox.append(
    document.createTextNode(
      T.inst.alunosConfirmados
        ? `Alunos confirmados: ${T.inst.alunosConfirmados} · cadastrados aqui: ${nomesUnicos}`
        : `Previsão de alunos (média): ${T.inst.mediaAlunos ? "~" + T.inst.mediaAlunos : "não informada"} · cadastrados aqui: ${nomesUnicos}`
    )
  );
  // confirmar a quantidade muda o cadastro do colégio: só quem cuida dos colégios (ou o admin)
  if (nomesUnicos && nomesUnicos !== T.inst.alunosConfirmados && (C.isAdmin || C.pode("colegios"))) {
    const b = U.mkBtn(`✔ Confirmar quantidade certa: ${nomesUnicos} alunos`, "btn-verde", async () => {
      try {
        await FS.updateDoc(FS.doc(db, "instituicoes", T.inst.id), {
          alunosConfirmados: nomesUnicos,
          alunosEstimado: false,
          alunosConfirmadosEm: hoje(),
          atualizadoEm: new Date().toISOString()
        });
        T.inst.alunosConfirmados = nomesUnicos;
        U.toast("Quantidade de alunos confirmada");
        desenhar(T);
      } catch (e) {
        C.handleErr(e);
      }
    });
    b.style.marginLeft = "8px";
    T.qtdBox.append(b);
  }
  // contrato item 4.3: mínimo de 30 formandos na solenidade
  const total = T.inst.alunosConfirmados || nomesUnicos;
  if (total && total < MINIMO_FORMANDOS)
    T.qtdBox.append(
      el(
        "p",
        "wait",
        `⚠️ Turma com ${total} formandos: o contrato pede no mínimo ${MINIMO_FORMANDOS}. Renegociar com o colégio (item 4.3).`
      )
    );
  const ct = T.inst.contratoTurma || {};
  // valores e vezes desta turma (aviso), marcando o que é diferente da tabela padrão
  const dif = diferencasDaTurma(C.P, T.inst),
    kt = kitsDe(C.P, T.inst).filter(k => Number(k.ant.valor));
  const av = el("div", dif.length ? "wait" : "notes");
  av.append(el("b", null, dif.length ? "⚠️ Valores desta turma (diferentes da tabela padrão):" : "Valores desta turma (tabela padrão):"));
  kt.forEach(k => {
    const n = Math.max(1, Number(k.ant.parcelas) || 1),
      px = q => {
        const nn = Math.max(1, Number((k[q] || {}).parcelas) || 1);
        return Number((k[q] || {}).valor) ? `${nn}x de ${brl(dividir(k[q].valor, nn)[nn - 1])}` : "";
      };
    const txt =
      `${k.nome.split(" · ")[0]}: ${n}x de ${brl(dividir(k.ant.valor, n)[n - 1])} (${brl(k.ant.valor)})` +
      (px("pos") ? ` · depois das fotos ${px("pos")}` : "") +
      (px("rep") ? ` · repasse ${px("rep")}` : "");
    const mudou = dif.some(d => d.startsWith(k.id + "|"));
    av.append(el("div", null, (mudou ? "✏️ " : "• ") + txt));
  });
  T.qtdBox.append(av);
  if (ehRepasse(T.inst, hoje()))
    T.qtdBox.append(
      el(
        "p",
        "hint",
        `🔁 Turma de ${anoDaTurma(T.inst)} (Repasse): quem ficou só com o Kit 01 pode receber a oferta no preço de repasse (${semKit.length}).`
      )
    );
  else if (ct.fotosProntasEm)
    T.qtdBox.append(
      el(
        "p",
        "hint",
        `📸 Fotos prontas desde ${U.fmtDate(ct.fotosProntasEm)}: pode oferecer os kits para quem tem só o Kit 01 (${semKit.length}).`
      )
    );
  T.qtdBox.append(
    el(
      "p",
      "hint",
      ct.inicio
        ? `Contrato da turma: parcelas todo dia 05 a partir de ${U.fmtDate(ct.inicio)}/${ct.inicio.slice(0, 4)}. Quem entra depois paga em menos parcelas e termina junto.`
        : "Contrato da turma: 1º vencimento ainda não definido (o Adriano define em “📅 Contrato da turma”). Até lá, começa no próximo dia 05."
    )
  );
  const ant = ativos.filter(f => f.venda !== "pos").length,
    pos = ativos.filter(f => f.venda === "pos").length;
  const vendido = somar(ativos.map(f => f.valor)),
    rec = somar(ativos.map(recebido));
  T.resumo.innerHTML = "";
  [
    ["Formandos", String(nomesUnicos)],
    ["Antecipado · depois das fotos", `${ant} · ${pos}`],
    ["Só Kit 01 (oferecer depois)", String(semKit.length)],
    ["Vendido", brl(vendido)],
    ["Recebido", brl(rec)],
    ["Em aberto", brl(somar(ativos.map(emAberto)))],
    ["Atrasados", String(atr.length)]
  ].forEach(([t, v], i) => {
    const c = el("div", "kpi" + (i === 6 && atr.length ? " late" : ""));
    c.append(el("small", null, t), el("b", null, v));
    T.resumo.append(c);
  });
  T.chips.innerHTML = "";
  [
    ["todos", "Todos", T.lista.length - sairam.length],
    ["atrasados", "Atrasados", atr.length],
    ["aberto", "Em dia", ativos.filter(f => !quitado(f) && !atrasado(f)).length],
    ["quitados", "Quitados", ativos.filter(quitado).length],
    ["semkit", "📸 Só Kit 01", semKit.length],
    ["adesao", "🎓 Adesão (Kit 01)", ativos.filter(ehKit01).length],
    ["kits", "📘 Kits 02 a 05", ativos.filter(f => !ehKit01(f)).length],
    ["sairam", "Desistiram / reprovaram", sairam.length]
  ].forEach(([k, t, n]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(T.filtro === k));
    b.append(el("span", "n", String(n)));
    b.onclick = () => {
      T.filtro = k;
      desenhar(T);
    };
    T.chips.append(b);
  });
  const passa = f =>
    ({
      todos: !sairam.includes(f),
      atrasados: ativo(f) && atrasado(f),
      quitados: ativo(f) && quitado(f),
      aberto: ativo(f) && !quitado(f) && !atrasado(f),
      semkit: candSet.has(f),
      adesao: ativo(f) && ehKit01(f),
      kits: ativo(f) && !ehKit01(f),
      sairam: sairam.includes(f)
    })[T.filtro];
  let arr = T.lista.filter(passa);
  if (T.busca)
    arr = arr.filter(
      f =>
        norm(f.nome + " " + f.tel + " " + f.serie + " " + (f.codigo || "")).includes(T.busca) ||
        (T.busca.replace(/\D/g, "") &&
          String(f.tel || "")
            .replace(/\D/g, "")
            .includes(T.busca.replace(/\D/g, "")))
    );
  T.lst.innerHTML = "";
  if (!T.lista.length) {
    const e = el("div", "empty");
    e.append(
      el("strong", null, "Nenhum formando ainda"),
      el("span", null, "Toque em “+ Formando”" + (C.isAdmin ? " ou importe a planilha da turma." : "."))
    );
    T.lst.append(e);
    return;
  }
  if (!arr.length) {
    T.lst.append(el("div", "empty", "Ninguém nesse filtro."));
    return;
  }
  emPartes(T.lst, arr, f => card(T, f, candSet));
}
function card(T, f, candSet) {
  const cand = candSet.has(f),
    prontas = !!(T.inst.contratoTurma || {}).fotosProntasEm || ehRepasse(T.inst, hoje());
  const comprou = ativo(f),
    sem = f.status === "semkit",
    saiu = !comprou && !sem;
  const at = comprou && atrasado(f),
    q0 = comprou && quitado(f),
    pg = pagasDe(f),
    np = nParcelas(f);
  const e = el("article", "card " + (saiu ? "" : at ? "late" : q0 ? "won" : sem ? "today" : ""));
  const top = el("div", "card-top");
  top.append(
    el("h3", "name", title(f.nome)),
    el(
      "span",
      "stage",
      saiu
        ? SITUACOES[f.status].toUpperCase()
        : sem
          ? "AINDA NÃO COMPROU"
          : f.entregueEm
            ? "ENTREGUE"
            : q0
              ? "QUITADO"
              : at
                ? "ATRASADO"
                : "EM DIA"
    )
  );
  e.append(top);
  const meta = el("div", "meta");
  if (f.codigo) meta.append(el("span", "tag id", "🆔 " + f.codigo));
  [
    f.serie,
    sem ? "" : f.kit || (ehKit01(f) ? "Kit 01 · Beca + canudo (adesão)" : "Kit"),
    comprou ? (f.venda === "pos" ? "Depois das fotos" : "Antecipado") : "",
    f.valor && !sem ? brl(f.valor) : "",
    comprou ? f.formaPag : "",
    f.tel
  ]
    .filter(Boolean)
    .forEach((t, i) => meta.append(el("span", "tag" + (i === 1 ? " svc" : ""), t)));
  const aTel = avisoTel(f.tel);
  if (aTel && !/fixo/.test(aTel)) meta.append(el("span", "tag warn", "⚠️ Telefone a conferir: " + aTel));
  e.append(meta);
  if (comprou)
    e.append(
      el(
        "div",
        "fu " + (at ? "late" : ""),
        q0
          ? `${np}/${np} parcelas pagas ✓`
          : `${pg}/${np} pagas · ${brl(valorParcela(f, pg + 1))} por parcela` +
              (f.primeiroVenc ? ` · ${at ? "venceu" : "vence"} ${U.fmtDate(vencDa(f, pg + 1))}` : "")
      )
    );
  // entrega: só com o contrato quitado (item 4.4), em até 120 dias úteis (item 3.1)
  if (q0)
    e.append(
      el(
        "div",
        "fu ok",
        f.entregueEm
          ? `📦 Entregue em ${U.fmtDate(f.entregueEm)}/${f.entregueEm.slice(0, 4)}`
          : `📦 Quitado em ${U.fmtDate(quitadoEm(f))} · entrega até ${U.fmtDate(previsaoEntrega(f))}/${previsaoEntrega(f).slice(0, 4)}`
      )
    );
  if (saiu && f.devolucao) e.append(el("div", "fu", `↩️ Devolução: ${brl(f.devolucao.valor)} (${f.devolucao.regra})`));
  if (f.obs) e.append(el("p", "notes", f.obs));
  linhasRetorno(f).forEach(x => e.append(x));
  const act = el("div", "actions");
  if (C.isAdmin && comprou && !q0)
    act.append(U.mkBtn("✅ Parcela paga", "btn-ok", () => registrarPagamento(C, f).catch(er => C.handleErr(er))));
  if (comprou && !q0 && f.tel) act.append(U.mkBtn("💬 Cobrar", at ? "btn-primary" : "", () => cobrarWa(C, f)));
  // pediu para pagar/falar outro dia: motivo + data (fica no histórico do formando)
  if ((comprou && !q0) || sem) act.append(U.mkBtn("📅 Pediu contato depois", "", () => retornoFormando(C, f)));
  if (C.isAdmin && q0 && !f.entregueEm)
    act.append(
      U.mkBtn("📦 Marcar entregue", "btn-verde", () =>
        FS.updateDoc(FS.doc(db, "formandos", f.id), { entregueEm: hoje(), atualizadoEm: new Date().toISOString() })
          .then(() => U.toast("Entrega registrada"))
          .catch(er => C.handleErr(er))
      )
    );
  // venda depois das fotos: quem tem só o Kit 01, quando as fotos ficaram prontas
  if (cand && prontas && f.tel) act.append(U.mkBtn("💬 Oferecer kit", "btn-primary", () => oferecerKit(C, T.inst, f)));
  if (cand && prontas) act.append(U.mkBtn("🖼️ Prévia", "", () => abrirPrevia(C, T.inst, f)));
  const vendaOferta = ehRepasse(T.inst, hoje()) ? "rep" : "pos";
  if (cand && prontas)
    act.append(
      U.mkBtn("🛒 Comprou kit", "btn-ok", () =>
        sem ? abrirFormando(T, f, { venda: vendaOferta }) : abrirFormando(T, null, { venda: vendaOferta, base: f })
      )
    );
  act.append(U.mkBtn("Editar", "", () => abrirFormando(T, f)));
  e.append(act);
  return e;
}

// Lista da turma para imprimir: um aluno por linha (com todos os kits), na ordem do ID
function relatorioTurma(T) {
  const alunos = {};
  T.lista
    .filter(f => f.status !== "desistiu" && f.status !== "reprovou")
    .forEach(f => {
      const k = U.chave(f.nome);
      const a = (alunos[k] = alunos[k] || {
        nome: f.nome,
        codigo: "",
        tel: "",
        email: "",
        serie: "",
        kits: [],
        aberto: 0,
        atr: false
      });
      a.email = a.email || f.email || "";
      a.codigo = a.codigo || f.codigo || "";
      a.tel = a.tel || f.tel || "";
      a.serie = a.serie || f.serie || "";
      if (f.status === "semkit") a.kits.push("ainda não comprou");
      else {
        a.kits.push((f.kit || "Kit").split(" · ")[0]);
        a.aberto += emAberto(f);
        a.atr = a.atr || atrasado(f);
      }
    });
  const arr = Object.values(alunos).sort(ordemCodigo);
  const ruins = arr.filter(a => avisoTel(a.tel) && !/fixo/.test(avisoTel(a.tel)));
  return {
    titulo: "Turma · " + title(T.inst.nome),
    subtitulo: [
      T.inst.formatura && T.inst.formatura.data
        ? "Formatura " + U.fmtDate(T.inst.formatura.data) + "/" + T.inst.formatura.data.slice(0, 4)
        : "",
      arr.length + (arr.length === 1 ? " aluno" : " alunos")
    ]
      .filter(Boolean)
      .join(" · "),
    secoes: [
      {
        titulo: "Alunos",
        tabela: {
          cols: ["ID", "Formando", "Série", "Telefone / e-mail", "Kits", "Em aberto"],
          linhas: arr.map(a => [
            a.codigo,
            title(a.nome),
            a.serie,
            contatoRel(a.tel, a.email),
            a.kits.join(", "),
            a.aberto ? brl(a.aberto) + (a.atr ? " (atrasado)" : "") : "—"
          ])
        },
        vazio: "Nenhum formando cadastrado."
      },
      ...(ruins.length
        ? [
            {
              titulo: "Telefones a conferir (" + ruins.length + ")",
              nota: "Estes números com certeza têm erro (DDD que não existe, celular sem o 9, número repetido). Peça o número certo.",
              tabela: { cols: ["ID", "Formando", "Telefone"], linhas: ruins.map(a => [a.codigo, title(a.nome), telRelatorio(a.tel)]) }
            }
          ]
        : [])
    ]
  };
}
