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
import { avisarColegioPorEmail, nomeEvento, agendarColegio, painelAvisar } from "./instituicoes.js";
import { ENDERECO, ESTUDIO } from "./mensagens.js";
import { feriado, feriadosEntre } from "./feriados.js";
import { el, title, field, sheet, botoes, wa, avisoErro } from "./ui.js";
import * as U from "./util.js";
import { initForm, openEnsaio, openComp } from "./agenda-form.js";
import { TIPOS_ENSAIO, diaTxt, fimDe, resumoDiaEm } from "./agenda-tempo.js";
export { openEnsaio, TIPOS_ENSAIO };
let C,
  FS,
  db,
  col,
  colE,
  privados = {};
let unsubs = [],
  items = [],
  ensaios = [],
  passados = [],
  comps = [],
  visitas = [],
  becas = [],
  filtro = "tudo",
  mesVis = "",
  selDia = "";
export const ETAPAS_ENTREGA = ["Ensaio feito", "Fotos escolhidas", "Em edição", "Pronto", "Entregue"];
const $ = id => document.getElementById(id);
const CAMPO = { formatura: "formatura", fotos: "diaFotos" };
const ICO = { formatura: "🎓", fotos: "📸" };
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const resumoDia = (data, ignora) => resumoDiaEm({ ensaios, items, comps }, data, ignora, nomeEvento);
const quando = d => (d === U.todayStr() ? "hoje" : d === U.addDays(1) ? "amanhã" : "");
const vejoEnsaios = () => true;
const marco = () => C.isAdmin;
const vejoVisitas = () => C.pode("colegios");

export function init(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
  col = FS.collection(db, "agenda");
  colE = FS.collection(db, "ensaios");
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
  if (hb.children.length) head.append(hb);
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
  items = [];
  ensaios = [];
  passados = [];
  comps = [];
  visitas = [];
  becas = [];
  if (!mesVis) mesVis = U.todayStr().slice(0, 7);
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
        items = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
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
          const todos = snap.docs.map(d => Object.assign({ id: d.id }, d.data(), privados[d.id] || {}));
          ensaios = todos.filter(x => x.kind !== "pessoal" && x.data >= hoje);
          comps = todos.filter(x => x.kind === "pessoal" && x.data >= hoje);
          passados = todos.filter(x => x.kind !== "pessoal" && x.data < hoje && x.status !== "remarcar" && x.status !== "faltou");
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
          privados = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
          comps = comps.map(x => Object.assign({}, x, privados[x.id] || {}));
          render();
        },
        e => avisoErro(e, "ler os compromissos particulares")
      )
    );
  // Aluguel de becas: retirada e devolução (só informam, não bloqueiam o dia)
  if (C.pode("becas"))
    unsubs.push(
      FS.onSnapshot(
        FS.query(FS.collection(db, "becas"), FS.where("devolucao", ">=", hoje), FS.orderBy("devolucao"), FS.limit(400)),
        snap => {
          becas = snap.docs
            .map(d => Object.assign({ id: d.id }, d.data()))
            .filter(x => x.status !== "cancelado" && x.status !== "devolvido");
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
          visitas = snap.docs
            .map(d => Object.assign({ id: d.id }, d.data()))
            .filter(
              x =>
                x.followup &&
                x.followup >= hoje &&
                x.etapa !== "FECHADO" &&
                x.etapa !== "NÃO FECHOU" &&
                (x.proximoPasso === "Voltar para visita" || x.followupHora || x.etapa === "AGENDAR VISITA")
            );
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
      filtro = k;
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
  const hoje = U.todayStr();
  if (filtro === "tudo" || filtro === "beca")
    becas.forEach(x => {
      if (x.status === "reservado" && x.retirada && x.retirada >= hoje)
        ent.push({ data: x.retirada, hora: x.retiradaHora || "", t: "b", x, ret: true });
      if (x.devolucao) ent.push({ data: x.devolucao, hora: "98", t: "b", x, ret: false });
    });
  if (filtro === "tudo") feriadosEntre(hoje, U.addDays(400)).forEach(f => ent.push({ data: f.data, hora: "", t: "f", x: f }));
  ent.sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora));
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
const icone = it =>
  it.t === "b"
    ? it.ret
      ? "👘"
      : "↩️"
    : it.t === "c"
      ? ICO[it.x.kind] || "📌"
      : it.t === "e"
        ? "📷"
        : it.t === "p"
          ? it.x.diaInteiro
            ? "⛔"
            : "📌"
          : it.t === "f"
            ? "🚫"
            : "🚗";

// ---------- Calendário do mês ----------
function renderMes(box, ent) {
  const hoje = U.todayStr();
  const [y, m] = mesVis.split("-").map(Number);
  const nav = el("div", "calnav");
  const ant = U.mkBtn("‹", "btn-sm", () => {
    const d = new Date(y, m - 2, 1);
    mesVis = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
    selDia = "";
    render();
  });
  ant.disabled = mesVis <= hoje.slice(0, 7);
  ant.setAttribute("aria-label", "Mês anterior");
  const prx = U.mkBtn("›", "btn-sm", () => {
    const d = new Date(y, m, 1);
    mesVis = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
    selDia = "";
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
    const ics = {};
    lst.forEach(it => {
      const k = icone(it);
      ics[k] = (ics[k] || 0) + 1;
    });
    Object.entries(ics)
      .slice(0, 4)
      .forEach(([k, n]) => b.append(el("span", "ic", n > 1 ? k + n : k)));
    b.setAttribute("aria-label", `${diaTxt(ds)}: ${lst.length ? lst.length + " compromisso" + (lst.length > 1 ? "s" : "") : "livre"}`);
    b.onclick = () => {
      selDia = selDia === ds ? "" : ds;
      render();
    };
    cal.append(b);
  }
  box.append(cal);
  box.append(
    el(
      "p",
      "hint",
      "🎓 formatura · 📸 dia de fotos · 📷 ensaio · 📌 compromisso · ⛔ dia bloqueado · 🚗 visita · 👘 retirada de becas · ↩️ devolução · 🚫 feriado. Toque no dia para ver."
    )
  );
  if (selDia) {
    const card = el("article", "card agdia");
    const top = el("div", "card-top");
    top.append(el("h3", "name", diaTxt(selDia)));
    card.append(top);
    const lst = porDia[selDia] || [];
    if (!lst.length) card.append(el("p", "hint", selDia < hoje ? "Dia que já passou." : "Dia livre ✅"));
    lst.forEach(it => card.append(linha(it)));
    if (marco() && selDia >= hoje && !feriado(selDia)) {
      const a = el("div", "actions");
      a.append(
        U.mkBtn("+ Ensaio neste dia", "btn-sm btn-primary", () => openEnsaio(null, { data: selDia })),
        U.mkBtn("+ Compromisso", "btn-sm", () => openComp(null, selDia))
      );
      card.append(a);
    }
    box.append(card);
  }
}

// ---------- Entregas das fotos ----------
function etapaEntrega(x) {
  return (x.entrega && x.entrega.etapa) || "Ensaio feito";
}
function entregasAbertas() {
  return passados
    .filter(
      x => etapaEntrega(x) !== "Entregue" || (C.P.linkAvaliacao && !x.avaliacaoPedida && x.entrega.em && x.entrega.em <= U.addDays(-3))
    )
    .sort((a, b) => prazoDe(a).localeCompare(prazoDe(b)));
}
function prazoDe(x) {
  const [y, m, d] = x.data.split("-").map(Number);
  const dt = new Date(y, m - 1, d + (Number(C.P.prazo) || 15));
  return `${dt.getFullYear()}-${U.pad(dt.getMonth() + 1)}-${U.pad(dt.getDate())}`;
}
function diasAte(d) {
  const [y, m, dd] = d.split("-").map(Number);
  const [a, b, c] = U.todayStr().split("-").map(Number);
  return Math.round((new Date(y, m - 1, dd) - new Date(a, b - 1, c)) / 864e5);
}
function cardEntrega(x) {
  const et = etapaEntrega(x),
    entregue = et === "Entregue";
  const pz = prazoDe(x),
    falta = diasAte(pz);
  const cls = entregue ? "won" : falta < 0 ? "late" : falta <= 3 ? "today" : "";
  const e = el("article", "card " + cls);
  const top = el("div", "card-top");
  top.append(el("h3", "name", `📷 ${title(x.cliente)}`), el("span", "stage", entregue ? "AVALIAÇÃO" : et.toUpperCase()));
  e.append(top);
  e.append(el("div", "meta"));
  e.lastChild.append(el("span", "tag svc", x.tipo || "Ensaio"), el("span", "tag", "Ensaio em " + U.fmtDate(x.data)));
  if (!entregue) {
    e.append(
      el(
        "div",
        "fu " + (falta < 0 ? "late" : falta <= 3 ? "today" : ""),
        falta < 0
          ? `Atrasado ${-falta} dia${falta < -1 ? "s" : ""} (prazo era ${U.fmtDate(pz)})`
          : falta === 0
            ? "Prazo de entrega: hoje"
            : `Faltam ${falta} dia${falta > 1 ? "s" : ""} para entregar (até ${U.fmtDate(pz)})`
      )
    );
    const passos = el("div", "passos");
    const i = ETAPAS_ENTREGA.indexOf(et);
    ETAPAS_ENTREGA.forEach((p, k) => passos.append(el("span", k <= i ? "on" : "", p)));
    e.append(passos);
  } else e.append(el("div", "fu", `Entregue em ${U.fmtDate(x.entrega.em)}. Hora de pedir a avaliação no Google ⭐`));
  const act = el("div", "actions");
  if (!entregue) {
    const i = ETAPAS_ENTREGA.indexOf(et),
      prox = ETAPAS_ENTREGA[i + 1];
    act.append(U.mkBtn(prox === "Entregue" ? "✅ Entregue" : "Avançar: " + prox, "btn-ok", () => avancarEntrega(x, prox)));
    if (prox === "Entregue" && x.tel)
      act.append(
        U.mkBtn("📲 Avisar que está pronto", "", () =>
          abrirWa(
            x.tel,
            `Oi, ${U.first(title(x.cliente))}! Suas fotos do ensaio estão prontas 🎉📸 Quer que eu envie por aqui ou prefere buscar no estúdio?`
          )
        )
      );
    if (et === "Ensaio feito")
      act.append(
        U.mkBtn("Cliente faltou", "", async () => {
          try {
            await FS.updateDoc(FS.doc(db, "ensaios", x.id), { status: "faltou" });
            U.toast("Marcado como falta");
          } catch (er) {
            C.handleErr(er);
          }
        })
      );
  } else {
    act.append(
      U.mkBtn("⭐ Pedir avaliação", "btn-primary", async () => {
        abrirWa(
          x.tel,
          `Oi, ${U.first(title(x.cliente))}! Que bom que você fez o seu ensaio com a gente 💛 Se puder, deixa uma avaliação rapidinha no Google? Ajuda muito o nosso estúdio: ${C.P.linkAvaliacao}`
        );
        try {
          await FS.updateDoc(FS.doc(db, "ensaios", x.id), { avaliacaoPedida: true, avaliacaoEm: U.todayStr() });
        } catch (er) {
          avisoErro(er, "marcar a avaliação como pedida", U.toast);
        }
      })
    );
    act.append(
      U.mkBtn("Não pedir", "", async () => {
        try {
          await FS.updateDoc(FS.doc(db, "ensaios", x.id), { avaliacaoPedida: true, avaliacaoEm: "" });
        } catch (er) {
          C.handleErr(er);
        }
      })
    );
  }
  e.append(act);
  return e;
}
async function avancarEntrega(x, etapa) {
  try {
    await FS.updateDoc(FS.doc(db, "ensaios", x.id), { entrega: { etapa, em: U.todayStr(), por: C.me || "" } });
    U.toast(etapa === "Entregue" ? "Entregue ✅ Em 3 dias o app lembra de pedir a avaliação" : "Agora: " + etapa);
  } catch (e) {
    C.handleErr(e);
  }
}
const abrirWa = (tel, msg) => wa(tel, msg, U.toast);

// ---------- Colégios ----------
function linhaColegio(x) {
  const r = el("div", "agrow");
  const t = el("div", "agtxt");
  t.append(el("b", null, `${ICO[x.kind] || "📌"} ${nomeEvento(x.kind, x.instNome)}`));
  const det = [x.hora, x.onde && x.onde + (x.local ? " · " + x.local : "")].filter(Boolean).join(" · ");
  if (det) t.append(el("span", null, det));
  if (x.status === "pendente") t.append(el("span", "wait", "⏳ Aguardando a Luciana aprovar"));
  if (x.contato && (x.contato.nome || x.contato.tel))
    t.append(
      el(
        "span",
        null,
        `👤 ${[x.contato.nome && title(x.contato.nome), x.contato.cargo].filter(Boolean).join(" · ")}${x.alunos ? ` · ~${x.alunos} alunos` : ""}`
      )
    );
  const fim = el("div", "agact");
  fim.append(el("span", "tag " + (x.status === "confirmado" ? "ok" : "svc"), x.status === "confirmado" ? "Confirmado" : "Aguardando"));
  // A mensagem sai do WhatsApp de quem agendou: só essa pessoa tem o botão
  const meu = (x.pedidoEmail || "") === C.email;
  if (x.contato && x.contato.tel && meu)
    fim.append(
      U.mkBtn(
        x.status === "confirmado" && !x.avisadoWhats ? "📲 Avisar colégio" : "📲 Avisar",
        x.status === "confirmado" && !x.avisadoWhats ? "btn-verde btn-sm" : "btn-sm",
        () => avisar(x)
      )
    );
  else if (x.status === "confirmado" && x.contato && x.contato.tel && !x.avisadoWhats && x.pedidoPor)
    t.append(el("span", "wait", `📲 ${U.first(x.pedidoPor)} vai avisar o colégio`));
  r.append(t, fim);
  return r;
}
// Abre a mensagem pronta e, se a data já está confirmada, marca que o colégio foi avisado
function avisar(arg, extra) {
  const lst = Array.isArray(arg) ? arg : [arg],
    x = lst[0];
  painelAvisar(C, x.instNome, lst, x.contato, x.alunos, extra, async () => {
    const conf = lst.filter(y => y.status === "confirmado");
    if (!conf.length) return;
    try {
      const b = FS.writeBatch(db);
      conf.forEach(y => b.update(FS.doc(db, "agenda", y.id), { avisadoWhats: true, avisadoEm: new Date().toISOString() }));
      await b.commit();
    } catch (e) {
      avisoErro(e, "marcar o colégio como avisado");
    }
  });
}
function cardPedido(gr) {
  gr.sort((a, b) => a.data.localeCompare(b.data));
  const x0 = gr[0];
  const e = el("article", "card today");
  const top = el("div", "card-top");
  top.append(el("h3", "name", title(x0.instNome)), el("span", "stage", "APROVAR"));
  e.append(top);
  gr.forEach(x =>
    e.append(
      el(
        "div",
        "fu today",
        `${ICO[x.kind] || "📌"} ${nomeEvento(x.kind, x.instNome)}: ${diaTxt(x.data)}/${x.data.slice(0, 4)}${x.hora ? " às " + x.hora : ""}${x.onde ? " · " + x.onde : ""}${x.local ? " (" + x.local + ")" : ""}`
      )
    )
  );
  const outros = gr.map(x => ensaios.filter(y => y.data === x.data && y.status !== "remarcar")).flat();
  if (outros.length)
    e.append(
      el(
        "p",
        "wait",
        "⚠️ Nesse dia já tem ensaio no estúdio: " + outros.map(y => `${y.hora || "sem hora"} ${U.first(y.cliente)}`).join(", ")
      )
    );
  const cps = gr.map(x => comps.filter(y => y.data === x.data)).flat();
  if (cps.length)
    e.append(
      el(
        "p",
        "wait",
        "⚠️ Compromisso nesse dia: " +
          cps.map(y => `${y.titulo || "Compromisso"} (${y.deQuem || ""}) ${y.diaInteiro ? "dia inteiro" : y.hora}`).join(", ")
      )
    );
  const det = [gr.map(x => x.obs).filter(Boolean)[0], x0.pedidoPor && "Pedido por " + U.first(x0.pedidoPor)].filter(Boolean).join("\n");
  if (det) e.append(el("p", "notes", det));
  const act = el("div", "actions");
  act.append(U.mkBtn(gr.length > 1 ? "✅ Aprovar as " + gr.length + " datas" : "✅ Aprovar", "btn-ok", () => aprovarGrupo(gr)));
  act.append(U.mkBtn("❌ Recusar", "btn-danger", () => recusar(gr)));
  e.append(act);
  return e;
}
async function aprovarGrupo(gr) {
  try {
    const agora = new Date().toISOString();
    // agenda e instituição mudam juntas (ou nenhuma muda)
    const b = FS.writeBatch(db);
    for (const x of gr) {
      b.update(FS.doc(db, "agenda", x.id), { status: "confirmado", aprovadoPor: C.me || "", aprovadoEm: agora });
      if (x.instId && CAMPO[x.kind])
        b.update(FS.doc(db, "instituicoes", x.instId), { [CAMPO[x.kind] + ".status"]: "confirmado", atualizadoEm: agora });
    }
    await b.commit();
    let n = 0;
    try {
      n = await avisarColegioPorEmail(gr[0].instId, C);
    } catch (e) {
      avisoErro(e, "preparar o e-mail para o colégio", U.toast);
    }
    const txt = `Aprovado ✅${n ? ` · e-mail com as datas vai para ${n} contato${n > 1 ? "s" : ""}` : " · o colégio não tem e-mail cadastrado"}`;
    // quem agendou recebe o aviso para mandar a confirmação do próprio WhatsApp
    const meus = gr.filter(x => (x.pedidoEmail || "") === C.email && x.contato && x.contato.tel);
    if (meus.length)
      avisar(
        meus.map(x => Object.assign({}, x, { status: "confirmado" })),
        txt
      );
    else U.toast(txt + (gr[0].pedidoPor ? ` · ${U.first(gr[0].pedidoPor)} avisa o colégio pelo WhatsApp` : ""));
  } catch (e) {
    C.handleErr(e);
  }
}

function recusar(arg) {
  const gr = Array.isArray(arg) ? arg : [arg],
    x = gr[0];
  sheet(gr.length > 1 ? "Recusar as datas" : "Recusar data", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        `${title(x.instNome)} · ${gr.map(g => nomeEvento(g.kind, g.instNome) + " " + diaTxt(g.data)).join(" + ")}. ${gr.length > 1 ? "Os dias ficam" : "O dia fica"} livre${gr.length > 1 ? "s" : ""} de novo.`
      )
    );
    const mot = el("input");
    mot.maxLength = 200;
    mot.placeholder = "ex.: já tenho ensaio nesse dia";
    const sug = el("input");
    sug.type = "date";
    sug.min = U.todayStr();
    p.append(
      field("Motivo", mot),
      field(gr.length > 1 ? "Sugerir outro dia para a formatura (opcional)" : "Sugerir outro dia (opcional)", sug),
      botoes(close, "Recusar e liberar o dia", "btn-danger")
    );
    setTimeout(() => mot.focus(), 30);
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      close();
      try {
        const b = FS.writeBatch(db);
        for (const y of gr) {
          b.delete(FS.doc(db, "agenda", y.id));
          if (y.instId && CAMPO[y.kind]) {
            const k = CAMPO[y.kind];
            b.update(FS.doc(db, "instituicoes", y.instId), {
              [k + ".status"]: "recusado",
              [k + ".motivoRecusa"]: mot.value.trim(),
              [k + ".sugestao"]: y.kind === "formatura" || gr.length === 1 ? sug.value || "" : "",
              atualizadoEm: new Date().toISOString()
            });
          }
        }
        await b.commit();
        U.toast(gr.length > 1 ? "Datas recusadas. Os dias ficaram livres." : "Data recusada. O dia ficou livre.");
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}

// ---------- Visitas do vendedor (só informam) ----------
function linhaVisita(x) {
  const r = el("div", "agrow");
  const t = el("div", "agtxt");
  t.append(
    el(
      "b",
      null,
      `🚗 ${x.proximoPasso === "Voltar para visita" || x.etapa === "AGENDAR VISITA" ? "Visita" : x.proximoPasso || "Retorno"}: ${title(x.nome)}`
    )
  );
  const det = [
    x.followupHora,
    C.nomeDe(x) && "👤 " + U.first(C.nomeDe(x)),
    x.proximoPasso && x.proximoPasso !== "Voltar para visita" ? x.proximoPasso : ""
  ]
    .filter(Boolean)
    .join(" · ");
  if (det) t.append(el("span", null, det));
  r.append(t, el("span", "tag", "Visita"));
  return r;
}

// ---------- Ensaios no estúdio ----------
function linhaEnsaio(x) {
  const r = el("div", "agrow");
  const t = el("div", "agtxt");
  t.append(el("b", null, `📷 ${x.hora ? x.hora + "–" + fimDe(x) : "Sem horário"} · ${title(x.cliente)}`));
  t.append(el("span", null, [x.tipo, marco() ? (x.sinalPago ? "💰 sinal pago" : "⚠️ sem sinal") : "", x.obs].filter(Boolean).join(" · ")));
  if (x.status === "analisar")
    t.append(el("span", "wait", "⏳ A Luciana vai analisar: " + (x.conflito || "o dia já tem outro compromisso")));
  if (!marco()) {
    r.append(t, el("span", "tag", "Estúdio"));
    return r;
  }
  const act = el("div", "agact");
  const q = quando(x.data);
  if (x.tel && (q || !x.lembrado)) {
    const b = U.mkBtn(x.lembrado ? "✓ Lembrado" : "📲 Lembrar", x.lembrado ? "btn-sm" : q ? "btn-sm btn-ok" : "btn-sm", () => lembrar(x));
    b.title = "Abre o WhatsApp com a mensagem de lembrete pronta";
    act.append(b);
  }
  act.append(U.mkBtn("Editar", "btn-sm", () => openEnsaio(x)));
  r.append(t, act);
  return r;
}
function cardAnalisar(x) {
  const e = el("article", "card today");
  const top = el("div", "card-top");
  top.append(el("h3", "name", `📷 ${title(x.cliente)}`), el("span", "stage", "ANALISAR"));
  e.append(top);
  e.append(
    el(
      "div",
      "fu today",
      `${diaTxt(x.data)}/${x.data.slice(0, 4)} · ${x.hora ? x.hora + "–" + fimDe(x) : "sem horário"} · ${x.tipo || "Ensaio"}`
    )
  );
  const dia = resumoDia(x.data, x.id);
  e.append(
    el(
      "p",
      "notes",
      (dia.length ? "Nesse dia também:\n" + dia.join("\n") : "") +
        (x.marcadoPor ? `\nMarcado por ${U.first(x.marcadoPor)}` : "") +
        (x.obs ? "\n" + x.obs : "")
    )
  );
  const act = el("div", "actions");
  act.append(
    U.mkBtn("✅ Pode marcar", "btn-ok", async () => {
      try {
        await FS.updateDoc(FS.doc(db, "ensaios", x.id), {
          status: "confirmado",
          analisadoPor: C.me || "",
          analisadoEm: new Date().toISOString()
        });
        U.toast("Ensaio confirmado ✅");
      } catch (er) {
        C.handleErr(er);
      }
    })
  );
  act.append(U.mkBtn("❌ Não dá", "btn-danger", () => naoDa(x)));
  e.append(act);
  return e;
}
function naoDa(x) {
  sheet("Não dá nesse horário", (p, close) => {
    p.append(el("p", "hint", `${title(x.cliente)} · ${diaTxt(x.data)} ${x.hora || ""}. O Adriano vê o motivo e remarca com o cliente.`));
    const mot = el("input");
    mot.maxLength = 200;
    mot.placeholder = "ex.: tenho formatura à noite, melhor de manhã";
    p.append(field("Motivo / sugestão", mot), botoes(close, "Pedir para remarcar", "btn-danger"));
    setTimeout(() => mot.focus(), 30);
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      close();
      try {
        await FS.updateDoc(FS.doc(db, "ensaios", x.id), {
          status: "remarcar",
          motivo: mot.value.trim(),
          analisadoPor: C.me || "",
          analisadoEm: new Date().toISOString()
        });
        U.toast("Pedido de remarcar enviado");
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}
function cardRemarcar(x) {
  const e = el("article", "card late");
  const top = el("div", "card-top");
  top.append(el("h3", "name", `📷 ${title(x.cliente)}`), el("span", "stage", "REMARCAR"));
  e.append(top);
  e.append(el("div", "fu late", `${diaTxt(x.data)} · ${x.hora || "sem horário"} · ${x.tipo || "Ensaio"}`));
  e.append(
    el("p", "notes", `${x.analisadoPor ? U.first(x.analisadoPor) : "A Luciana"} pediu para remarcar${x.motivo ? ": " + x.motivo : "."}`)
  );
  const act = el("div", "actions");
  act.append(U.mkBtn("Remarcar", "btn-primary", () => openEnsaio(x)));
  if (x.tel) act.append(U.mkBtn("💬 WhatsApp", "", () => window.open("https://wa.me/" + U.digits(x.tel), "_blank", "noopener")));
  e.append(act);
  return e;
}
function msgLembrete(x) {
  const q = quando(x.data);
  const dia = q ? `${q} (${diaTxt(x.data)})` : diaTxt(x.data);
  return `Olá, ${U.first(title(x.cliente))}! Aqui é do ${ESTUDIO.nome} 📸\nPassando para lembrar do seu ensaio ${dia}${x.hora ? " às " + x.hora : ""}, aqui no estúdio: ${ENDERECO}.\nSe tiver algum imprevisto, é só me avisar por aqui. Até lá! 😊`;
}
async function lembrar(x) {
  const tel = U.digits(x.tel);
  if (!tel) {
    U.toast("Esse ensaio está sem WhatsApp");
    return;
  }
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgLembrete(x))}`, "_blank", "noopener");
  if (!x.lembrado) {
    try {
      await FS.updateDoc(FS.doc(db, "ensaios", x.id), { lembrado: true, lembradoEm: new Date().toISOString(), lembradoPor: C.me || "" });
    } catch (e) {
      avisoErro(e, "marcar como lembrado");
    }
  }
}

// ---------- Compromissos (consulta médica, outros afazeres) ----------
function linhaComp(x) {
  const r = el("div", "agrow");
  const t = el("div", "agtxt");
  const oculto = x.particular && !marco();
  t.append(
    el(
      "b",
      null,
      oculto ? `🔒 ${x.deQuem || "Compromisso"}: ocupado` : `📌 ${x.titulo || "Compromisso"}${x.deQuem ? " · " + x.deQuem : ""}`
    )
  );
  t.append(
    el(
      "span",
      null,
      [
        x.diaInteiro ? "Dia inteiro" : x.hora ? x.hora + "–" + fimDe(x) : "",
        !oculto && x.obs,
        x.particular && marco() ? "🔒 particular" : ""
      ]
        .filter(Boolean)
        .join(" · ")
    )
  );
  if (!marco()) {
    r.append(t, el("span", "tag " + (x.diaInteiro ? "late" : ""), x.diaInteiro ? "Dia bloqueado" : "Ocupado"));
    return r;
  }
  const act = el("div", "agact");
  if (x.diaInteiro) act.append(el("span", "tag late", "Dia bloqueado"));
  act.append(U.mkBtn("Editar", "btn-sm", () => openComp(x)));
  r.append(t, act);
  return r;
}
// Para o cartão da tela inicial
export async function contarPendentes(ctx) {
  const s = await ctx.FS.getDocs(
    ctx.FS.query(ctx.FS.collection(ctx.db, "agenda"), ctx.FS.where("status", "==", "pendente"), ctx.FS.limit(200))
  );
  return s.size;
}
