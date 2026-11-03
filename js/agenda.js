// Módulo Agendamento: tudo o que está marcado, dia a dia.
// - Colégios: formaturas e dias de fotos (um por dia; a Luciana aprova). Documento agenda/AAAA-MM-DD.
// - Ensaios no estúdio: só os donos marcam (coleção "ensaios"). Pode ter vários por dia;
//   quando o Adriano marca num dia que já tem algo, a Luciana analisa.
// - Compromissos (consulta médica, banco, outros afazeres): na mesma coleção, com kind "pessoal".
//   "Dia inteiro" bloqueia o dia para formatura/dia de fotos. "Particular" mostra só "Ocupado" ao vendedor.
// O vendedor vê tudo (para saber por que o dia está ocupado), mas só os donos marcam e mudam.
// - Visitas do vendedor: vêm do "Voltar para visita" das Instituições. Só informam, não bloqueiam o dia.
// - Feriados: o estúdio não trabalha (bloqueia ensaio e colégio).
// - Entregas: depois do ensaio, acompanha a edição até entregar, com o prazo, e pede a avaliação no Google.
// Partes: agenda-estado.js, agenda-entregas.js, agenda-colegios.js, agenda-ensaios.js, agenda-relatorio.js,
// agenda-form.js (janelas de ensaio e compromisso) e agenda-tempo.js (contas de horário).
import { nomeEvento } from "./eventos.js";
import { agendarColegio } from "./instituicoes-agendar.js";
import { feriado, feriadosEntre } from "./feriados.js";
import { el, title, avisoErro } from "./ui.js";
import * as U from "./util.js";
import { botaoRelatorio } from "./relatorio.js";
import { initForm, openEnsaio, openComp } from "./agenda-form.js";
import { TIPOS_ENSAIO, diaTxt } from "./agenda-tempo.js";
import {
  C,
  FS,
  db,
  col,
  colE,
  privados,
  items,
  ensaios,
  comps,
  visitas,
  becas,
  filtro,
  mesVis,
  selDia,
  mudar,
  iniciar,
  tela,
  $,
  ICO,
  MESES,
  SEMANA,
  quando,
  marco,
  vejoEnsaios,
  vejoVisitas
} from "./agenda-estado.js";
import { cardEntrega, entregasAbertas } from "./agenda-entregas.js";
import { linhaColegio, avisar, cardPedido } from "./agenda-colegios.js";
import { linhaVisita, linhaEnsaio, cardAnalisar, cardRemarcar, linhaComp } from "./agenda-ensaios.js";
import { relatorioAgenda } from "./agenda-relatorio.js";
export { openEnsaio, TIPOS_ENSAIO };
export { ETAPAS_ENTREGA } from "./agenda-estado.js";
let unsubs = [];
export function init(ctx) {
  iniciar(ctx);
  tela.render = render;
  initForm(ctx, () => ({ ensaios, items, comps }));
}

export function show() {
  const v = $("viewAgenda");
  v.innerHTML = "";
  const head = el("div", "vhead");
  head.append(el("h2", null, "Agendamento"));
  // Colégio (dia de fotos do PR ou formatura): quem tem Instituições, inclusive o vendedor.
  // Ensaio no estúdio e compromisso: só o Adriano e a Luciana.
  const hb = el("div", "agact");
  if (C.pode("colegios")) hb.append(U.mkBtn("+ Agendar colégio", "btn-verde btn-sm", () => agendarColegio(C)));
  if (marco())
    hb.append(
      U.mkBtn("+ Compromisso", "btn-amarelo btn-sm", () => openComp()),
      U.mkBtn("+ Marcar ensaio", "btn-primary btn-sm", () => openEnsaio())
    );
  hb.append(
    botaoRelatorio(
      () => relatorioAgenda(entradas),
      () => C.me
    )
  );
  // Importação: prévias de qualquer pasta (outros trabalhos), sem mudar o nome de ninguém (Adriano e Luciana)
  if (marco())
    hb.append(
      U.mkBtn("📥 Importação", "btn-azul btn-sm", () =>
        import("./previas-lote.js").then(m => m.abrirPreviasLote(C, { livre: true })).catch(e => C.handleErr(e))
      )
    );
  head.append(hb);
  v.append(head);
  v.append(
    el(
      "p",
      "hint",
      C.aprovador
        ? "As datas de colégio sugeridas pelo vendedor ficam seguradas até você aprovar ou recusar."
        : "As datas de colégio ficam seguradas até a Luciana aprovar."
    )
  );
  const chips = el("div", "chips");
  chips.id = "agChips";
  v.append(chips);
  const cal = el("section", "view");
  cal.id = "agCal";
  v.append(cal);
  const pend = el("section", "view");
  pend.id = "agPend";
  v.append(pend);
  const prox = el("section", "view");
  prox.id = "agProx";
  v.append(prox);
  prox.append(el("div", "empty", "Carregando…"));
  hide();
  mudar({ items: [], ensaios: [], passados: [], comps: [], visitas: [], becas: [] });
  if (!mesVis) mudar({ mesVis: U.todayStr().slice(0, 7) });
  const hoje = U.todayStr();
  const erro = (err, o) => {
    avisoErro(err, "carregar " + o);
    if (err.code === "permission-denied")
      U.showNotice(
        o === "agenda"
          ? "Você não tem acesso ao Agendamento."
          : o === "ensaios"
            ? "Para ver os ensaios, cole as regras novas do Firebase."
            : ""
      );
  };
  unsubs.push(
    FS.onSnapshot(
      FS.query(col, FS.where("data", ">=", hoje), FS.orderBy("data"), FS.limit(400)),
      snap => {
        mudar({ items: snap.docs.map(d => Object.assign({ id: d.id }, d.data())) });
        render();
      },
      e => erro(e, "agenda")
    )
  );
  // Ensaios dos últimos 90 dias também, para acompanhar a entrega das fotos
  if (vejoEnsaios())
    unsubs.push(
      FS.onSnapshot(
        FS.query(colE, FS.where("data", ">=", U.addDays(-90)), FS.orderBy("data"), FS.limit(600)),
        snap => {
          // cancelados saem da agenda; o pedido de exclusão da equipe some para a equipe (o admin vê a pendência)
          const todos = snap.docs
            .map(d => Object.assign({ id: d.id }, d.data(), privados[d.id] || {}))
            .filter(x => x.status !== "cancelado" && !(x.excluido && !C.isAdmin));
          mudar({ ensaios: todos.filter(x => x.kind !== "pessoal" && x.data >= hoje) });
          mudar({ comps: todos.filter(x => x.kind === "pessoal" && x.data >= hoje) });
          mudar({ passados: todos.filter(x => x.kind !== "pessoal" && x.data < hoje && x.status !== "remarcar" && x.status !== "faltou") });
          render();
        },
        e => erro(e, "ensaios")
      )
    );
  // Assunto dos compromissos particulares: só os donos leem (coleção "privado")
  if (marco())
    unsubs.push(
      FS.onSnapshot(
        FS.query(FS.collection(db, "privado"), FS.limit(1000)),
        snap => {
          mudar({ privados: Object.fromEntries(snap.docs.map(d => [d.id, d.data()])) });
          mudar({ comps: comps.map(x => Object.assign({}, x, privados[x.id] || {})) });
          render();
        },
        e => avisoErro(e, "ler os compromissos particulares")
      )
    );
  // Alunos de aluguel dos colégios (Etapa 3): retirada e devolução juntas por colégio e dia, ligadas ao status
  if (C.pode("becas"))
    unsubs.push(
      FS.onSnapshot(
        FS.query(FS.collection(db, "alugueis"), FS.where("devolucao", ">=", hoje), FS.orderBy("devolucao"), FS.limit(1500)),
        snap => {
          becasAlunos = agruparAlunos(snap.docs.map(d => d.data()));
          mudar({ becas: [...becasAvulsas, ...becasAlunos] });
          render();
        },
        e => avisoErro(e, "carregar os alunos de aluguel")
      )
    );
  // Aluguel de becas: retirada e devolução (só informam, não bloqueiam o dia)
  if (C.pode("becas"))
    unsubs.push(
      FS.onSnapshot(
        FS.query(FS.collection(db, "becas"), FS.where("devolucao", ">=", hoje), FS.orderBy("devolucao"), FS.limit(400)),
        snap => {
          becasAvulsas = snap.docs
            .map(d => Object.assign({ id: d.id }, d.data()))
            .filter(x => x.status !== "cancelado" && x.status !== "devolvido");
          mudar({ becas: [...becasAvulsas, ...becasAlunos] });
          render();
        },
        e => avisoErro(e, "carregar as becas")
      )
    );
  if (vejoVisitas())
    unsubs.push(
      FS.onSnapshot(
        C.isAdmin
          ? FS.query(FS.collection(db, "instituicoes"), FS.where("followup", ">=", hoje), FS.orderBy("followup"), FS.limit(400))
          : C.carteira("instituicoes"),
        snap => {
          mudar({
            visitas: snap.docs
              .map(d => Object.assign({ id: d.id }, d.data()))
              .filter(
                x =>
                  x.followup &&
                  x.followup >= hoje &&
                  x.etapa !== "FECHADO" &&
                  x.etapa !== "NÃO FECHOU" &&
                  (x.proximoPasso === "Voltar para visita" || x.followupHora || x.etapa === "AGENDAR VISITA")
              )
          });
          render();
        },
        e => erro(e, "visitas")
      )
    );
}
export function hide() {
  unsubs.forEach(u => u());
  unsubs = [];
}

function renderChips() {
  const c = $("agChips");
  if (!c) return;
  c.innerHTML = "";
  const ops = [
    ["tudo", "Tudo", items.length + ensaios.length + comps.length + visitas.length + becas.length],
    ["colegio", "Colégios", items.length]
  ];
  if (vejoEnsaios()) ops.push(["ensaio", "Ensaios", ensaios.length], ["comp", "Compromissos", comps.length]);
  if (vejoVisitas()) ops.push(["visita", "Visitas", visitas.length]);
  if (becas.length) ops.push(["beca", "Becas", becas.length]);
  if (marco()) ops.push(["entrega", "Entregas", entregasAbertas().length]);
  if (ops.length < 3) {
    c.hidden = true;
    return;
  }
  c.hidden = false;
  ops.forEach(([k, t, n]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(filtro === k));
    b.append(el("span", "n", String(n)));
    b.onclick = () => {
      mudar({ filtro: k });
      render();
    };
    c.append(b);
  });
}

function render() {
  const pend = $("agPend"),
    prox = $("agProx");
  if (!pend) return;
  renderChips();
  pend.innerHTML = "";
  prox.innerHTML = "";
  // Para aprovar / analisar (Luciana) e pedidos de remarcar (Adriano)
  const pendentes = items.filter(x => x.status === "pendente");
  const analisar = ensaios.filter(x => x.status === "analisar");
  const remarcar = ensaios.filter(x => x.status === "remarcar");
  const grade = el("div", "grid");
  if (pendentes.length && C.aprovador && (filtro === "tudo" || filtro === "colegio")) {
    const grupos = {};
    pendentes.forEach(x => {
      const k = x.grupo || x.id;
      (grupos[k] = grupos[k] || []).push(x);
    });
    Object.values(grupos).forEach(gr => grade.append(cardPedido(gr)));
  }
  if (C.aprovador && (filtro === "tudo" || filtro === "ensaio")) analisar.forEach(x => grade.append(cardAnalisar(x)));
  if (marco() && (filtro === "tudo" || filtro === "ensaio")) remarcar.forEach(x => grade.append(cardRemarcar(x)));
  // Datas aprovadas que eu agendei e ainda não avisei o colégio
  if (filtro === "tudo" || filtro === "colegio")
    items
      .filter(
        x => x.status === "confirmado" && !x.avisadoWhats && (x.pedidoEmail || "") === C.email && x.contato && x.contato.tel && !C.aprovador
      )
      .forEach(x => {
        const e = el("article", "card today");
        const top = el("div", "card-top");
        top.append(el("h3", "name", title(x.instNome)), el("span", "stage", "APROVADO"));
        e.append(top);
        e.append(
          el(
            "div",
            "fu today",
            `${ICO[x.kind] || "📌"} ${nomeEvento(x.kind, x.instNome)}: ${diaTxt(x.data)}${x.hora ? " às " + x.hora : ""}`
          ),
          el("p", "notes", "A Luciana aprovou. Avise o colégio pelo seu WhatsApp.")
        );
        const act = el("div", "actions");
        act.append(U.mkBtn("📲 Avisar colégio", "btn-verde", () => avisar(x)));
        e.append(act);
        grade.append(e);
      });
  if (grade.children.length) {
    pend.append(
      el("h3", "grp", C.aprovador ? `Para você analisar (${grade.children.length})` : `Precisa de atenção (${grade.children.length})`),
      grade
    );
  }
  // Entregas das fotos (ensaios que já aconteceram)
  if (marco() && (filtro === "tudo" || filtro === "entrega")) {
    const ab = entregasAbertas();
    if (ab.length) {
      const ge = el("div", "grid");
      ab.forEach(x => ge.append(cardEntrega(x)));
      pend.append(el("h3", "grp", `Entregas de fotos (${ab.length})`), ge);
    } else if (filtro === "entrega") pend.append(el("div", "empty", "Nenhuma entrega pendente ✓"));
  }
  if (filtro === "entrega") {
    prox.innerHTML = "";
    $("agCal").innerHTML = "";
    return;
  }

  // Próximos compromissos, dia a dia
  const hoje = U.todayStr();
  const ent = entradas(hoje);
  // Calendário do mês sempre no topo; a lista vem depois (feriados só dos próximos 60 dias)
  const calBox = $("agCal");
  calBox.innerHTML = "";
  renderMes(calBox, ent);
  const ate60 = U.addDays(60);
  const entL = ent.filter(it => it.t !== "f" || it.data <= ate60);
  prox.append(el("h3", "grp", "Próximos compromissos"));
  if (!entL.length) {
    const e = el("div", "empty");
    e.append(
      el("strong", null, "Nada marcado ainda"),
      el(
        "span",
        null,
        vejoEnsaios()
          ? "Toque em “+ Marcar ensaio”. As formaturas e os dias de fotos marcados nas Instituições também aparecem aqui."
          : "As formaturas e os dias de fotos marcados nas Instituições aparecem aqui."
      )
    );
    prox.append(e);
    return;
  }
  const g = el("div", "grid");
  let mes = "",
    dia = "",
    card = null;
  entL.forEach(it => {
    const m = it.data.slice(0, 7);
    if (m !== mes) {
      mes = m;
      const h = el("h3", "grp", `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`);
      h.style.gridColumn = "1/-1";
      g.append(h);
    }
    if (it.data !== dia) {
      dia = it.data;
      card = el("article", "card agdia" + (quando(dia) ? " today" : ""));
      const top = el("div", "card-top");
      top.append(el("h3", "name", diaTxt(dia)));
      if (quando(dia)) top.append(el("span", "stage", quando(dia).toUpperCase()));
      card.append(top);
      g.append(card);
    }
    card.append(linha(it));
  });
  prox.append(g);
}
function linhaBeca(it) {
  const x = it.x,
    r = el("div", "agrow"),
    t = el("div", "agtxt");
  t.append(el("b", null, `${it.ret ? "👘 Retirada" : "↩️ Devolução"} de becas: ${title(x.cliente)}`));
  t.append(
    el(
      "span",
      null,
      [
        `${x.qtd || 1} beca${(x.qtd || 1) > 1 ? "s" : ""}`,
        it.ret && x.retiradaHora,
        x.evento,
        x.dataEvento && "evento " + U.fmtDate(x.dataEvento)
      ]
        .filter(Boolean)
        .join(" · ")
    )
  );
  r.append(t);
  if (C.pode("becas"))
    r.append(
      U.mkBtn("Abrir", "btn-sm", () => {
        C.ir("#becas");
      })
    );
  return r;
}
// Tudo o que aparece na lista e no calendário, conforme o filtro escolhido
function entradas(hoje) {
  const ent = [];
  if (filtro === "tudo" || filtro === "colegio")
    items.filter(x => !(C.aprovador && x.status === "pendente")).forEach(x => ent.push({ data: x.data, hora: "", t: "c", x }));
  if (filtro === "tudo" || filtro === "ensaio")
    ensaios
      .filter(x => x.status !== "remarcar" && !(C.aprovador && x.status === "analisar"))
      .forEach(x => ent.push({ data: x.data, hora: x.hora || "", t: "e", x }));
  if (filtro === "tudo" || filtro === "comp")
    comps.forEach(x => ent.push({ data: x.data, hora: x.diaInteiro ? "" : x.hora || "", t: "p", x }));
  if (filtro === "tudo" || filtro === "visita")
    visitas.forEach(x => ent.push({ data: x.followup, hora: x.followupHora || "99", t: "v", x }));
  if (filtro === "tudo" || filtro === "beca")
    becas.forEach(x => {
      if (x.status === "reservado" && x.retirada && x.retirada >= hoje)
        ent.push({ data: x.retirada, hora: x.retiradaHora || "", t: "b", x, ret: true });
      if (x.devolucao) ent.push({ data: x.devolucao, hora: "98", t: "b", x, ret: false });
    });
  if (filtro === "tudo") feriadosEntre(hoje, U.addDays(400)).forEach(f => ent.push({ data: f.data, hora: "", t: "f", x: f }));
  ent.sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora));
  return ent;
}
function linha(it) {
  return it.t === "b"
    ? linhaBeca(it)
    : it.t === "c"
      ? linhaColegio(it.x)
      : it.t === "e"
        ? linhaEnsaio(it.x)
        : it.t === "p"
          ? linhaComp(it.x)
          : it.t === "f"
            ? linhaFeriado(it.x)
            : linhaVisita(it.x);
}
function linhaFeriado(f) {
  const r = el("div", "agrow");
  const t = el("div", "agtxt");
  t.append(el("b", null, "🚫 Feriado: " + f.nome), el("span", null, "Estúdio fechado"));
  r.append(t, el("span", "tag late", "Fechado"));
  return r;
}
let becasAvulsas = [],
  becasAlunos = [];
// um item por colégio e dia: "C.E. Alfa (12 alunos)"; some da retirada quando todos já retiraram
function agruparAlunos(lst) {
  const g = {};
  lst
    .filter(a => !a.excluido && a.status !== "Devolvida")
    .forEach(a => {
      const k = (a.instId || a.instNome) + "|" + (a.retirada || "") + "|" + (a.devolucao || "");
      const x = (g[k] = g[k] || {
        id: "al_" + k,
        cliente: a.instNome || "Colégio",
        qtd: 0,
        retirada: "",
        devolucao: a.devolucao,
        evento: "alunos do colégio",
        aRetirar: 0
      });
      x.qtd++;
      if (a.status !== "Retirou a beca") {
        x.aRetirar++;
        x.retirada = a.retirada || "";
      }
    });
  return Object.values(g);
}
// Tipos de evento: ícone + nome + cor (a mesma na legenda, no calendário e na lista do dia)
export const TIPOS_EVENTO = {
  formatura: { ico: "🎓", nome: "Formatura", cor: "ev-formatura" },
  fotos: { ico: "📸", nome: "Dia de fotos", cor: "ev-fotos" },
  paspatur: { ico: "🎞️", nome: "Paspatur no colégio", cor: "ev-paspatur" },
  becasCol: { ico: "👘", nome: "Becas no colégio", cor: "ev-becascol" },
  ensaio: { ico: "📷", nome: "Ensaio", cor: "ev-ensaio" },
  comp: { ico: "📌", nome: "Compromisso", cor: "ev-comp" },
  bloqueio: { ico: "⛔", nome: "Dia bloqueado", cor: "ev-bloqueio" },
  visita: { ico: "🚗", nome: "Visita", cor: "ev-visita" },
  retirada: { ico: "👘", nome: "Retirada de becas", cor: "ev-retirada" },
  devolucao: { ico: "↩️", nome: "Devolução", cor: "ev-devolucao" },
  feriado: { ico: "🚫", nome: "Feriado", cor: "ev-feriado" }
};
const tipoDe = it =>
  it.t === "b"
    ? it.ret
      ? "retirada"
      : "devolucao"
    : it.t === "c"
      ? it.x.kind === "formatura"
        ? "formatura"
        : it.x.kind === "fotos"
          ? "fotos"
          : it.x.kind === "paspatur"
            ? "paspatur"
            : it.x.kind === "becas"
              ? "becasCol"
              : "comp"
      : it.t === "e"
        ? "ensaio"
        : it.t === "p"
          ? it.x.diaInteiro
            ? "bloqueio"
            : "comp"
          : it.t === "f"
            ? "feriado"
            : "visita";
// nome curto do evento no quadradinho do dia (quem ou o quê)
const nomeCurto = it => {
  const x = it.x || {};
  const n =
    it.t === "c"
      ? x.instNome
      : it.t === "e" || it.t === "b"
        ? x.cliente
        : it.t === "p"
          ? x.particular && !marco()
            ? x.deQuem || "Ocupado"
            : x.titulo
          : it.t === "f"
            ? x.nome
            : x.nome;
  return title(String(n || TIPOS_EVENTO[tipoDe(it)].nome))
    .split(" ")
    .slice(0, 2)
    .join(" ");
};
function legendaEventos() {
  const l = el("div", "ev-legenda");
  Object.values(TIPOS_EVENTO).forEach(t => l.append(el("span", "ev " + t.cor, `${t.ico} ${t.nome}`)));
  return l;
}

// ---------- Calendário do mês ----------
function renderMes(box, ent) {
  const hoje = U.todayStr();
  const [y, m] = mesVis.split("-").map(Number);
  const nav = el("div", "calnav");
  const ant = U.mkBtn("‹", "btn-sm", () => {
    const d = new Date(y, m - 2, 1);
    mudar({ mesVis: `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`, selDia: "" });
    render();
  });
  ant.disabled = mesVis <= hoje.slice(0, 7);
  ant.setAttribute("aria-label", "Mês anterior");
  const prx = U.mkBtn("›", "btn-sm", () => {
    const d = new Date(y, m, 1);
    mudar({ mesVis: `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`, selDia: "" });
    render();
  });
  prx.setAttribute("aria-label", "Próximo mês");
  nav.append(ant, el("h3", "grp", `${MESES[m - 1]} ${y}`), prx);
  box.append(nav);
  const porDia = {};
  ent.forEach(it => {
    (porDia[it.data] = porDia[it.data] || []).push(it);
  });
  const cal = el("div", "cal");
  SEMANA.forEach(s => cal.append(el("span", "wd", s)));
  const ini = new Date(y, m - 1, 1).getDay(),
    dias = new Date(y, m, 0).getDate();
  for (let i = 0; i < ini; i++) cal.append(el("span", "d out"));
  for (let d = 1; d <= dias; d++) {
    const ds = `${y}-${U.pad(m)}-${U.pad(d)}`,
      lst = porDia[ds] || [];
    const b = el(
      "button",
      "d" + (ds === hoje ? " hoje" : "") + (feriado(ds) ? " fer" : "") + (ds < hoje ? " pas" : "") + (ds === selDia ? " sel" : "")
    );
    b.type = "button";
    b.append(el("b", null, String(d)));
    // vários eventos no mesmo dia: os 3 primeiros (ícone + nome, com a cor do tipo) e "+N" para o resto
    lst.slice(0, 3).forEach(it => {
      const t = TIPOS_EVENTO[tipoDe(it)];
      b.append(el("span", "ev " + t.cor, `${t.ico} ${nomeCurto(it)}`));
    });
    if (lst.length > 3) b.append(el("span", "ev mais", `+${lst.length - 3}`));
    b.setAttribute("aria-label", `${diaTxt(ds)}: ${lst.length ? lst.length + " compromisso" + (lst.length > 1 ? "s" : "") : "livre"}`);
    b.onclick = () => {
      mudar({ selDia: selDia === ds ? "" : ds });
      render();
    };
    cal.append(b);
  }
  box.append(cal);
  box.append(legendaEventos(), el("p", "hint", "Toque no dia para ver a lista completa."));
  if (selDia) {
    const card = el("article", "card agdia");
    const top = el("div", "card-top");
    top.append(el("h3", "name", diaTxt(selDia)));
    card.append(top);
    const lst = porDia[selDia] || [];
    if (!lst.length) card.append(el("p", "hint", selDia < hoje ? "Dia que já passou." : "Dia livre ✅"));
    lst.forEach(it => {
      const l = linha(it);
      l.classList.add("ev-linha", TIPOS_EVENTO[tipoDe(it)].cor);
      card.append(l);
    });
    // feriado só avisa (aparece no dia), não bloqueia: dá para marcar qualquer coisa
    if (selDia >= hoje && (marco() || C.pode("colegios"))) {
      const a = el("div", "actions");
      const dia = selDia;
      // colégio (dia de fotos ou formatura): quem tem Instituições; ensaio e compromisso: só o Adriano e a Luciana
      if (C.pode("colegios")) a.append(U.mkBtn("+ Colégio neste dia", "btn-sm btn-verde", () => agendarColegio(C, dia)));
      if (marco())
        a.append(
          U.mkBtn("+ Ensaio neste dia", "btn-sm btn-primary", () => openEnsaio(null, { data: dia })),
          U.mkBtn("+ Compromisso", "btn-sm", () => openComp(null, dia))
        );
      card.append(a);
    }
    box.append(card);
  }
}

// Para o cartão da tela inicial
export async function contarPendentes(ctx) {
  const s = await ctx.FS.getDocs(
    ctx.FS.query(ctx.FS.collection(ctx.db, "agenda"), ctx.FS.where("status", "==", "pendente"), ctx.FS.limit(200))
  );
  return s.size;
}
