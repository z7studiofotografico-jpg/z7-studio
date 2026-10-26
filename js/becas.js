// Card Aluguel de becas: para os nossos eventos e para outros eventos.
// Coleção "becas": { cliente, tel, tipoEvento ("nosso" | "outro"), evento, dataEvento, retirada, retiradaHora, devolucao,
//   qtd (total de becas), becasQtd: { pelerineAzul, infAzul, infPreta, tradPreta, americana }, faixasQtd: { azul, branca, ... }, capelosQtd: { capelo }, tamanhosQtd: { tradPreta: { M: 7, G: 5 }, ... } (por tipo de beca), tamanhos (texto, ex.: "Beca tradicional preta: 7 M, 5 G"; o jabor já vai com a beca), valor, caucao, pago, formaPag, status, obs }
// Status: reservado → retirado → devolvido (ou cancelado). Retirada e devolução aparecem no Agendamento.
import { el, title, field, inp, inpReais, sheet, botoes, wa as abrirWa, avisoErro, gradeQtd } from "./ui.js";
import { ENDERECO, ESTUDIO } from "./mensagens.js";
import { lerReais, centavos, reais, brl } from "./regras.js";
import * as U from "./util.js";
let C,
  FS,
  db,
  col,
  unsubs = [],
  lista = [],
  aba = "proximas";
const $ = id => document.getElementById(id);
const n0 = v => Number(v) || 0;
const ITENS = [
  ["capelo", "Capelo"],
  ["jabor", "Jabor"]
]; // só para aluguéis antigos
export const CAPELOS = [["capelo", "Capelo"]];
// Tamanhos por tipo de beca: { tipo: { tamanho: n } } (ignora o formato antigo, que não separava o tipo)
const porTipo = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v && typeof v === "object"));
const textoTam = t =>
  BECAS.filter(([k]) => somaObj(t[k] || {}))
    .map(
      ([k, nm]) =>
        `${nm}: ${TAMANHOS.filter(([z]) => n0(t[k][z]))
          .map(([z]) => `${t[k][z]} ${z}`)
          .join(", ")}`
    )
    .join("; ");
// Tamanhos de beca que o estúdio tem
export const TAMANHOS = ["PPP", "PP", "P", "M", "G", "GG", "XG", "XXG", "EXG"].map(t => [t, t]);
// Tipos de beca e cores de faixa: cada um tem o seu estoque (definido no botão "📦 Estoque")
export const BECAS = [
  ["pelerineAzul", "Beca pelerine azul"],
  ["infAzul", "Beca infantil azul"],
  ["infPreta", "Beca infantil preta"],
  ["tradPreta", "Beca tradicional preta"],
  ["americana", "Beca americana"]
];
export const FAIXAS = [
  ["azul", "Azul"],
  ["branca", "Branca"],
  ["amarela", "Amarela"],
  ["lilas", "Lilás"],
  ["verde", "Verde"],
  ["laranja", "Laranja"],
  ["rosa", "Rosa"],
  ["vermelha", "Vermelha"]
];
const estoque = () => C.P.estoque || {};
const somaObj = o => Object.values(o || {}).reduce((a, v) => a + n0(v), 0);
const totBecas = x => (x.becasQtd ? somaObj(x.becasQtd) : n0(x.qtd));
const FORMAS = ["Pix", "Cartão", "Link", "Dinheiro", "Boleto"];
const ativo = b => b.status !== "devolvido" && b.status !== "cancelado";
export const atrasada = (b, hoje) => b.status === "retirado" && b.devolucao && b.devolucao < hoje;

export function init(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
  col = FS.collection(db, "becas");
}
export function hide() {
  unsubs.forEach(u => u());
  unsubs = [];
}

export function show() {
  const v = $("viewBecas");
  v.innerHTML = "";
  const head = el("div", "vhead");
  head.append(el("h2", null, "Aluguel de becas"));
  const hb = el("div", "agact");
  hb.append(
    U.mkBtn("📦 Estoque", "btn-sm", () => openEstoque()),
    U.mkBtn("+ Aluguel", "btn-primary btn-sm", () => form())
  );
  head.append(hb);
  v.append(head);
  v.append(el("p", "hint", "Para os nossos eventos e para outros eventos. A retirada e a devolução aparecem no Agendamento."));
  const k = el("div", "kpis");
  k.id = "bcKpis";
  v.append(k);
  const chips = el("div", "chips");
  chips.id = "bcChips";
  v.append(chips);
  const corpo = el("div", "grid");
  corpo.id = "bcLista";
  corpo.append(el("div", "empty", "Carregando…"));
  v.append(corpo);
  hide();
  lista = [];
  let a = [],
    b = [];
  const junta = () => {
    const m = new Map();
    [...a, ...b].forEach(x => m.set(x.id, x));
    lista = [...m.values()];
    render();
  };
  const erro = e => {
    avisoErro(e, "carregar os aluguéis");
    if (e.code === "permission-denied") {
      corpo.innerHTML = "";
      corpo.append(el("div", "empty", "Cole as regras novas do Firebase para usar o Aluguel de becas."));
    }
  };
  // Aluguéis recentes e futuros + os que ainda estão fora do estúdio (mesmo antigos)
  unsubs.push(
    FS.onSnapshot(
      FS.query(col, FS.where("devolucao", ">=", U.addDays(-60)), FS.orderBy("devolucao"), FS.limit(800)),
      s => {
        a = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
        junta();
      },
      erro
    )
  );
  unsubs.push(
    FS.onSnapshot(
      FS.query(col, FS.where("status", "==", "retirado"), FS.limit(300)),
      s => {
        b = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
        junta();
      },
      erro
    )
  );
}

// Quantas becas estão comprometidas entre duas datas (para conferir o estoque)
function emUso(de, ate, ignora) {
  const out = { becas: {}, faixas: {}, capelos: {}, tamanhos: {} };
  lista
    .filter(x => x.id !== ignora && ativo(x) && x.retirada && x.devolucao && x.retirada <= ate && x.devolucao >= de)
    .forEach(x => {
      Object.entries(x.becasQtd || {}).forEach(([k, v]) => {
        out.becas[k] = (out.becas[k] || 0) + n0(v);
      });
      Object.entries(x.faixasQtd || {}).forEach(([k, v]) => {
        out.faixas[k] = (out.faixas[k] || 0) + n0(v);
      });
      Object.entries(x.capelosQtd || {}).forEach(([k, v]) => {
        out.capelos[k] = (out.capelos[k] || 0) + n0(v);
      });
      Object.entries(porTipo(x.tamanhosQtd)).forEach(([tp, zs]) => {
        const o = (out.tamanhos[tp] = out.tamanhos[tp] || {});
        Object.entries(zs).forEach(([z, v]) => {
          o[z] = (o[z] || 0) + n0(v);
        });
      });
    });
  return out;
}

function render() {
  const k = $("bcKpis"),
    chips = $("bcChips"),
    corpo = $("bcLista");
  if (!k) return;
  const hoje = U.todayStr(),
    em7 = U.addDays(7);
  const fora = lista.filter(x => x.status === "retirado"),
    atr = lista.filter(x => atrasada(x, hoje));
  const prox = lista.filter(x => x.status === "reservado"),
    aRec = reais(lista.filter(ativo).reduce((s, x) => s + centavos(falta(x)), 0));
  k.innerHTML = "";
  const est = somaObj(estoque().becas);
  [
    ["Becas fora agora", `${fora.reduce((s, x) => s + totBecas(x), 0)}${est ? " de " + est : ""}`],
    ["Retiradas em 7 dias", String(prox.filter(x => x.retirada <= em7).length)],
    ["Devoluções atrasadas", String(atr.length)],
    ["A receber", brl(aRec)]
  ].forEach(([t, v], i) => {
    const c = el("div", "kpi" + (i === 2 && atr.length ? " late" : ""));
    c.append(el("small", null, t), el("b", null, v));
    k.append(c);
  });
  const abas = [
    ["proximas", "Reservados", prox.length],
    ["fora", "Fora do estúdio", fora.length],
    ["atrasadas", "Atrasados", atr.length],
    ["devolvidas", "Devolvidos", lista.filter(x => x.status === "devolvido").length],
    ["todas", "Todos", lista.length]
  ];
  chips.innerHTML = "";
  abas.forEach(([kk, t, n]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(aba === kk));
    b.append(el("span", "n", String(n)));
    b.onclick = () => {
      aba = kk;
      render();
    };
    chips.append(b);
  });
  let arr =
    aba === "proximas"
      ? prox
      : aba === "fora"
        ? fora
        : aba === "atrasadas"
          ? atr
          : aba === "devolvidas"
            ? lista.filter(x => x.status === "devolvido")
            : lista;
  arr = arr
    .slice()
    .sort((a, b) =>
      aba === "devolvidas"
        ? (b.devolucao || "").localeCompare(a.devolucao || "")
        : ((aba === "fora" || aba === "atrasadas" ? a.devolucao : a.retirada) || "").localeCompare(
            (aba === "fora" || aba === "atrasadas" ? b.devolucao : b.retirada) || ""
          )
    );
  corpo.innerHTML = "";
  if (!arr.length) {
    const e = el("div", "empty");
    e.append(
      el("strong", null, aba === "atrasadas" ? "Nenhuma devolução atrasada ✓" : "Nada por aqui"),
      el("span", null, "Toque em “+ Aluguel” para registrar um aluguel de becas.")
    );
    corpo.append(e);
    return;
  }
  arr.forEach(x => corpo.append(card(x)));
}

function card(x) {
  const hoje = U.todayStr(),
    at = atrasada(x, hoje);
  const st =
    x.status === "cancelado"
      ? "CANCELADO"
      : x.status === "devolvido"
        ? "DEVOLVIDO"
        : at
          ? "ATRASADO"
          : x.status === "retirado"
            ? "FORA DO ESTÚDIO"
            : "RESERVADO";
  const e = el(
    "article",
    "card " + (at ? "late" : x.status === "devolvido" ? "won" : x.status === "reservado" && x.retirada <= U.addDays(1) ? "today" : "")
  );
  const top = el("div", "card-top");
  top.append(el("h3", "name", title(x.cliente)), el("span", "stage", st));
  e.append(top);
  const meta = el("div", "meta");
  [
    `👘 ${totBecas(x)} beca${totBecas(x) !== 1 ? "s" : ""}`,
    x.tipoEvento === "nosso" ? "Nosso evento" : "Outro evento",
    x.evento,
    ...BECAS.filter(([k]) => n0((x.becasQtd || {})[k])).map(([k, t]) => `${t.replace("Beca ", "")}: ${x.becasQtd[k]}`),
    ...FAIXAS.filter(([k]) => n0((x.faixasQtd || {})[k])).map(([k, t]) => `Faixa ${t.toLowerCase()}: ${x.faixasQtd[k]}`),
    n0((x.capelosQtd || {}).capelo) ? `Capelo: ${x.capelosQtd.capelo}` : "",
    x.capelosQtd
      ? ""
      : ITENS.filter(([kk]) => x.itens && x.itens[kk])
          .map(([, t]) => t)
          .join(" + "),
    x.corFaixa ? "Faixa " + x.corFaixa : "",
    x.valor ? brl(x.valor) : ""
  ]
    .filter(Boolean)
    .forEach((t, i) => meta.append(el("span", "tag" + (i === 0 ? " svc" : ""), t)));
  e.append(meta);
  const datas = [
    x.retirada && `Retirada ${U.fmtDate(x.retirada)}${x.retiradaHora ? " " + x.retiradaHora : ""}`,
    x.dataEvento && `Evento ${U.fmtDate(x.dataEvento)}`,
    x.devolucao && `Devolução ${U.fmtDate(x.devolucao)}`
  ]
    .filter(Boolean)
    .join(" · ");
  e.append(el("div", "fu " + (at ? "late" : ""), at ? `Devolução atrasada desde ${U.fmtDate(x.devolucao)} · ${datas}` : datas));
  const pend = falta(x);
  const notas = [
    x.tamanhos && "Tamanhos: " + x.tamanhos,
    x.caucao ? `Caução: ${brl(x.caucao)}` : "",
    n0(x.valor) ? (pend ? `Falta receber ${brl(pend)}` : "Pago ✓") + (x.formaPag ? ` (${x.formaPag})` : "") : "",
    x.faltou && "⚠️ Faltou na devolução: " + x.faltou,
    x.obs
  ]
    .filter(Boolean)
    .join("\n");
  if (notas) e.append(el("p", "notes", notas));
  const act = el("div", "actions");
  if (x.status === "reservado") {
    act.append(U.mkBtn("📦 Retirou", "btn-ok", () => salvar(x, { status: "retirado", retiradoEm: U.todayStr() }, "Marcado como retirado")));
    if (x.tel)
      act.append(
        U.mkBtn("📲 Lembrar retirada", "", () =>
          wa(
            x,
            `Oi, ${U.first(title(x.cliente))}! Aqui é do ${ESTUDIO.nome} 📸 Passando para lembrar da retirada ${totBecas(x) > 1 ? "das " + totBecas(x) + " becas" : "da beca"} ${x.retirada === hoje ? "hoje" : "dia " + U.fmtDate(x.retirada)}${x.retiradaHora ? " às " + x.retiradaHora : ""}, aqui no estúdio: ${ENDERECO}.${pend ? ` Fica faltando ${brl(pend)}.` : ""} Até lá! 😊`
          )
        )
      );
  }
  if (x.status === "retirado") {
    act.append(U.mkBtn("↩️ Devolveu", "btn-ok", () => devolver(x)));
    if (x.tel)
      act.append(
        U.mkBtn(at ? "💬 Cobrar devolução" : "📲 Lembrar devolução", at ? "btn-primary" : "", () =>
          wa(
            x,
            at
              ? `Oi, ${U.first(title(x.cliente))}! Aqui é do ${ESTUDIO.nome} 📸 A devolução ${totBecas(x) > 1 ? "das becas" : "da beca"} era dia ${U.fmtDate(x.devolucao)}. Consegue trazer hoje no estúdio? Endereço: ${ENDERECO}. Obrigado! 😊`
              : `Oi, ${U.first(title(x.cliente))}! Aqui é do ${ESTUDIO.nome} 📸 Só lembrando que a devolução ${totBecas(x) > 1 ? "das becas" : "da beca"} é dia ${U.fmtDate(x.devolucao)}, aqui no estúdio: ${ENDERECO}. Obrigado! 😊`
          )
        )
      );
  }
  act.append(U.mkBtn("Editar", "", () => form(x)));
  e.append(act);
  return e;
}
const wa = (x, msg) => abrirWa(x.tel, msg, U.toast);
// quanto falta receber, em reais (conta em centavos)
const falta = x => reais(Math.max(0, centavos(x.valor) - centavos(x.pago)));
async function salvar(x, patch, msg) {
  try {
    await FS.updateDoc(FS.doc(db, "becas", x.id), Object.assign(patch, { atualizadoEm: new Date().toISOString() }));
    U.toast(msg);
  } catch (e) {
    C.handleErr(e);
  }
}

function devolver(x) {
  sheet("Devolução · " + title(x.cliente), (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        `${totBecas(x)} beca${totBecas(x) !== 1 ? "s" : ""} · ${[...BECAS.filter(([k]) => n0((x.becasQtd || {})[k])).map(([k, t]) => `${x.becasQtd[k]} ${t.toLowerCase()}`), ...FAIXAS.filter(([k]) => n0((x.faixasQtd || {})[k])).map(([k, t]) => `${x.faixasQtd[k]} faixa ${t.toLowerCase()}`), ...(n0((x.capelosQtd || {}).capelo) ? [`${x.capelosQtd.capelo} capelo${x.capelosQtd.capelo > 1 ? "s" : ""}`] : [])].join(", ")}`
      )
    );
    const tudoL = el("label", "chk");
    const tudo = el("input");
    tudo.type = "checkbox";
    tudo.checked = true;
    tudoL.append(tudo, document.createTextNode(" Devolveu tudo, em bom estado"));
    p.append(tudoL);
    const falt = inp("", "ex.: 1 capelo, faixa manchada");
    const fb = field("O que faltou ou voltou com problema", falt);
    fb.hidden = true;
    p.append(fb);
    tudo.onchange = () => {
      fb.hidden = tudo.checked;
    };
    const pend = falta(x);
    const pg = el("label", "chk");
    const pgC = el("input");
    pgC.type = "checkbox";
    pg.append(pgC, document.createTextNode(` Recebeu o que faltava (${brl(pend)})`));
    if (pend) p.append(pg);
    p.append(botoes(close, "Confirmar devolução"));
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      close();
      const patch = { status: "devolvido", devolvidoEm: U.todayStr(), faltou: tudo.checked ? "" : falt.value.trim() || "a conferir" };
      if (pgC.checked) patch.pago = lerReais(x.valor);
      salvar(x, patch, tudo.checked ? "Devolvido ✅" : "Devolvido com pendência");
    });
  });
}

// Estoque por tipo de beca e cor de faixa (salvo em Ajustes / config). Mostra o que está fora agora.
function openEstoque() {
  sheet("📦 Estoque de becas, faixas, capelos e tamanhos", (p, close) => {
    const E = estoque(),
      hoje = U.todayStr(),
      u = emUso(hoje, hoje);
    p.append(
      el(
        "p",
        "hint",
        C.isAdmin
          ? "Quantas peças vocês têm de cada tipo. O app usa isso para avisar quando faltar num período."
          : "Só administradores mudam o estoque."
      )
    );
    const tab = (titulo, tipos, atual, fora) => {
      const f = el("div", "field");
      f.append(el("label", null, titulo));
      const g = gradeQtd(tipos, atual, {
        max: 5,
        disabled: !C.isAdmin,
        rotulo: (k, t) => "Estoque " + t,
        texto: (k, t) => t + (n0(fora[k]) ? ` · ${n0(fora[k])} fora hoje` : "")
      });
      f.append(g.box);
      p.append(f);
      return g.ins;
    };
    const iB = tab("Becas (o jabor vai junto)", BECAS, E.becas, u.becas),
      iF = tab("Faixas", FAIXAS, E.faixas, u.faixas),
      iC = tab("Capelos", CAPELOS, E.capelos, u.capelos);
    // Tamanhos de cada tipo de beca
    const ET = porTipo(E.tamanhos),
      UT = u.tamanhos;
    {
      const f = el("div", "field");
      f.append(el("label", null, "Tamanhos de cada beca (PPP a EXG)"));
      p.append(f);
    }
    const iT = BECAS.map(([tp, nm]) => {
      const d = el("details", "tamtipo"),
        sm = el("summary");
      d.append(sm);
      const g = gradeQtd(TAMANHOS, ET[tp], {
        disabled: !C.isAdmin,
        rotulo: z => `Estoque ${nm} ${z}`,
        texto: z => z + (n0((UT[tp] || {})[z]) ? ` · ${n0(UT[tp][z])} fora` : "")
      });
      d.append(g.box);
      const ins = g.ins;
      const total = iB.find(([k]) => k === tp)[1];
      const resumo = () => {
        const t = ins.reduce((a, [, q]) => a + n0(q.value), 0),
          b = n0(total.value);
        sm.textContent = `${nm}: ${t ? `${t} de ${b} com tamanho${t === b ? " ✅" : t > b ? " ⚠️ passou do total" : ""}` : "sem tamanhos"}`;
      };
      [...ins.map(([, q]) => q), total].forEach(q => q.addEventListener("input", resumo));
      resumo();
      p.append(d);
      return [tp, ins];
    });
    p.append(
      el(
        "p",
        "hint",
        "Beca americana: deixe 0 até chegar. O app avisa se alguém tentar alugar. Tamanhos: abra cada beca e coloque quantas tem de cada tamanho; beca sem tamanhos preenchidos não é conferida por tamanho."
      )
    );
    p.append(botoes(close, "Salvar estoque"));
    if (!C.isAdmin) p.querySelector("button[type=submit]").hidden = true;
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      if (!C.isAdmin) return;
      const novo = {
        becas: Object.fromEntries(iB.map(([k, q]) => [k, n0(q.value)])),
        faixas: Object.fromEntries(iF.map(([k, q]) => [k, n0(q.value)])),
        capelos: Object.fromEntries(iC.map(([k, q]) => [k, n0(q.value)])),
        tamanhos: Object.fromEntries(
          iT
            .map(([tp, ins]) => [tp, Object.fromEntries(ins.map(([z, q]) => [z, n0(q.value)]).filter(([, v]) => v))])
            .filter(([, o]) => Object.keys(o).length)
        )
      };
      try {
        await FS.setDoc(FS.doc(db, "config", "app"), { estoque: novo }, { merge: true });
        C.P.estoque = novo;
        close();
        U.toast("Estoque salvo");
        render();
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}

export function form(x, pre) {
  pre = pre || {};
  sheet(x ? "Editar aluguel" : "Novo aluguel de becas", (p, close) => {
    const cli = inp(x ? x.cliente : pre.cliente || "", "nome de quem aluga");
    cli.required = true;
    const tel = inp(x ? x.tel : "", "(21) 9…", 30);
    tel.inputMode = "tel";
    const r1 = el("div", "row2");
    r1.append(field("Cliente", cli), field("WhatsApp", tel));
    p.append(r1);
    const tipo = el("select");
    [
      ["outro", "Outro evento"],
      ["nosso", "Nosso evento (Z7)"]
    ].forEach(([v, t]) => {
      const o = el("option", null, t);
      o.value = v;
      tipo.append(o);
    });
    tipo.value = x ? x.tipoEvento || "outro" : pre.tipoEvento || "outro";
    const ev = inp(x ? x.evento : pre.evento || "", "ex.: Colação Colégio Alfa, Igreja X");
    const dl = el("datalist");
    dl.id = "bcEv" + Date.now();
    ev.setAttribute("list", dl.id);
    if (C.pode("colegios"))
      FS.getDocs(C.carteira("instituicoes", FS.where("etapa", "==", "FECHADO"), FS.limit(300)))
        .then(s =>
          s.docs
            .filter(d => d.data().etapa === "FECHADO")
            .forEach(d => {
              const o = el("option");
              o.value = title(d.data().nome);
              dl.append(o);
            })
        )
        .catch(e => avisoErro(e, "listar os colégios"));
    const r2 = el("div", "row2");
    r2.append(field("Tipo", tipo), field("Evento / local", ev));
    p.append(r2, dl);
    const dEv = el("input");
    dEv.type = "date";
    dEv.value = x ? x.dataEvento || "" : pre.dataEvento || "";
    const ret = el("input");
    ret.type = "date";
    ret.required = true;
    ret.value = x ? x.retirada || "" : pre.retirada || "";
    const retH = el("input");
    retH.type = "time";
    retH.step = 900;
    retH.value = x ? x.retiradaHora || "" : "";
    const dev = el("input");
    dev.type = "date";
    dev.required = true;
    dev.value = x ? x.devolucao || "" : "";
    const r3 = el("div", "row2");
    r3.append(field("Retirada", ret), field("Horário da retirada", retH));
    const r4 = el("div", "row2");
    r4.append(field("Data do evento", dEv), field("Devolução", dev));
    p.append(r3, r4);
    dEv.addEventListener("change", () => {
      if (dEv.value && !dev.value) {
        const [y, m, d] = dEv.value.split("-").map(Number);
        const t = new Date(y, m - 1, d + 1);
        dev.value = `${t.getFullYear()}-${U.pad(t.getMonth() + 1)}-${U.pad(t.getDate())}`;
      }
      if (dEv.value && !ret.value) {
        const [y, m, d] = dEv.value.split("-").map(Number);
        const t = new Date(y, m - 1, d - 1);
        ret.value = `${t.getFullYear()}-${U.pad(t.getMonth() + 1)}-${U.pad(t.getDate())}`;
      }
      checa();
    });
    // Quantidade por tipo de beca e por cor de faixa
    const grade = (titulo, tipos, atual, sufixo) => {
      const f = el("div", "field");
      f.append(el("label", null, titulo));
      const g = gradeQtd(tipos, atual, { rotulo: (k, t) => t + sufixo, aoMudar: () => checa() });
      f.append(g.box);
      p.append(f);
      return g.ins;
    };
    const qB = grade("Becas", BECAS, x ? x.becasQtd || (x.qtd ? { tradPreta: x.qtd } : {}) : pre.becasQtd, "");
    const qF = grade("Faixas", FAIXAS, x ? x.faixasQtd : pre.faixasQtd, " (faixa)");
    const qC = grade(
      "Capelos",
      CAPELOS,
      x ? x.capelosQtd || (x.itens && x.itens.capelo ? { capelo: totBecas(x) } : {}) : pre.capelosQtd,
      " (quantidade)"
    );
    p.append(el("p", "hint", "O jabor já vai com a beca. Capelo tem estoque próprio e pode ser alugado sozinho."));
    const valObj = ins => Object.fromEntries(ins.map(([k, q]) => [k, n0(q.value)]).filter(([, v]) => v));
    // Tamanhos: para cada tipo de beca escolhido, quantas de cada tamanho
    const atualT = porTipo(x ? x.tamanhosQtd : pre.tamanhosQtd);
    const blocoT = el("div");
    p.append(blocoT);
    const qT = BECAS.map(([tp, nm]) => {
      const f = el("div", "field");
      const lb = el("label");
      f.append(lb);
      const g = gradeQtd(TAMANHOS, atualT[tp], { rotulo: z => `${z} (${nm.toLowerCase()})`, aoMudar: () => checa() });
      f.append(g.box);
      const ins = g.ins;
      const total = qB.find(([k]) => k === tp)[1];
      const atualiza = () => {
        const b = n0(total.value),
          t = ins.reduce((a, [, q]) => a + n0(q.value), 0);
        f.hidden = !b && !t;
        lb.textContent = `Tamanhos · ${nm}: ${t} de ${b}${t === b && b ? " ✅" : t > b ? " ⚠️ passou" : ""}`;
      };
      [...ins.map(([, q]) => q), total].forEach(q => q.addEventListener("input", atualiza));
      atualiza();
      blocoT.append(f);
      return [tp, nm, ins];
    });
    if (x && x.tamanhos && !Object.keys(atualT).length) p.append(el("p", "hint", "Anotado antes: " + x.tamanhos));
    const val = inpReais(x ? x.valor : ""),
      pago = inpReais(x ? x.pago : ""),
      cau = inpReais(x ? x.caucao : "");
    // depois de registrado, só o admin muda valor e caução (o "já pago" a equipe só aumenta)
    if (x && !C.isAdmin) {
      val.disabled = true;
      cau.disabled = true;
    }
    const r6 = el("div", "row3");
    r6.append(field("Valor total", val), field("Já pago", pago), field("Caução", cau));
    p.append(r6);
    const fp = el("select");
    [["", "forma de pagamento"], ...FORMAS.map(f => [f, f])].forEach(([v, t]) => {
      const o = el("option", null, t);
      o.value = v;
      fp.append(o);
    });
    fp.value = x ? x.formaPag || "" : "";
    p.append(field("Pagamento", fp));
    const obs = el("textarea");
    obs.rows = 2;
    obs.maxLength = 600;
    obs.value = x ? x.obs || "" : "";
    p.append(field("Observação", obs));
    const info = el("p", "notes");
    info.hidden = true;
    p.append(info);
    const err = el("p", "err");
    err.hidden = true;
    p.append(err);
    // Confere o estoque de cada tipo no período
    function faltas() {
      if (!ret.value || !dev.value) return [];
      const u = emUso(ret.value, dev.value, x && x.id),
        E = estoque(),
        out = [];
      qB.forEach(([k, q]) => {
        const pede = n0(q.value);
        if (!pede) return;
        const tem = n0((E.becas || {})[k]),
          livre = tem - n0(u.becas[k]);
        if (pede > livre)
          out.push(
            `${BECAS.find(b => b[0] === k)[1]}: pediu ${pede}, livres ${Math.max(0, livre)}${tem ? "" : " (sem estoque cadastrado)"}`
          );
      });
      qF.forEach(([k, q]) => {
        const pede = n0(q.value);
        if (!pede) return;
        const tem = n0((E.faixas || {})[k]),
          livre = tem - n0(u.faixas[k]);
        if (pede > livre)
          out.push(
            `Faixa ${FAIXAS.find(b => b[0] === k)[1].toLowerCase()}: pediu ${pede}, livres ${Math.max(0, livre)}${tem ? "" : " (sem estoque cadastrado)"}`
          );
      });
      qC.forEach(([k, q]) => {
        const pede = n0(q.value);
        if (!pede) return;
        const tem = n0((E.capelos || {})[k]),
          livre = tem - n0(u.capelos[k]);
        if (pede > livre) out.push(`Capelo: pediu ${pede}, livres ${Math.max(0, livre)}${tem ? "" : " (sem estoque cadastrado)"}`);
      });
      // tamanho só é conferido se o estoque de tamanhos foi preenchido
      const ET = porTipo(E.tamanhos);
      qT.forEach(([tp, nm, ins]) => {
        if (!somaObj(ET[tp] || {})) return;
        ins.forEach(([z, q]) => {
          const pede = n0(q.value);
          if (!pede) return;
          const livre = n0(ET[tp][z]) - n0((u.tamanhos[tp] || {})[z]);
          if (pede > livre) out.push(`${nm} ${z}: pediu ${pede}, livres ${Math.max(0, livre)}`);
        });
      });
      return out;
    }
    function checa() {
      if (!err || !info) return;
      err.hidden = true;
      p._ok = false;
      if (!ret.value || !dev.value) {
        info.hidden = true;
        return;
      }
      const f = faltas();
      info.textContent = f.length ? "⚠️ Falta no estoque nesse período:\n" + f.join("\n") : "Estoque OK para esse período ✅";
      info.hidden = false;
    }
    [ret, dev].forEach(i => i.addEventListener("change", checa));
    if (x) checa();
    const a = botoes(close, x ? "Salvar" : "Registrar aluguel");
    if (x && x.status !== "cancelado") {
      const cb = el("button", "btn btn-danger", "Cancelar aluguel");
      cb.type = "button";
      a.prepend(cb);
      cb.onclick = () => {
        if (!p._can) {
          p._can = true;
          cb.textContent = "Toque de novo";
          return;
        }
        close();
        salvar(x, { status: "cancelado" }, "Aluguel cancelado");
      };
    }
    p.append(a);
    p.addEventListener("submit", async ev2 => {
      ev2.preventDefault();
      if (x && !C.isAdmin && lerReais(pago.value) < (Number(x.pago) || 0)) {
        err.textContent = "O valor já pago não pode diminuir. Peça para um administrador corrigir.";
        err.hidden = false;
        return;
      }
      if (dev.value < ret.value) {
        err.textContent = "A devolução precisa ser depois da retirada.";
        err.hidden = false;
        return;
      }
      const becasQtd = valObj(qB),
        faixasQtd = valObj(qF),
        capelosQtd = valObj(qC),
        q = somaObj(becasQtd);
      if (!q && !somaObj(faixasQtd) && !somaObj(capelosQtd)) {
        err.textContent = "Coloque a quantidade de becas, faixas ou capelos.";
        err.hidden = false;
        return;
      }
      const tamanhosQtd = Object.fromEntries(qT.map(([tp, , ins]) => [tp, valObj(ins)]).filter(([, o]) => Object.keys(o).length));
      const passou = qT.find(([tp]) => somaObj(tamanhosQtd[tp] || {}) > n0(becasQtd[tp]));
      if (passou) {
        err.textContent = `${passou[1]}: os tamanhos somam ${somaObj(tamanhosQtd[passou[0]])}, mas são ${n0(becasQtd[passou[0]])}.`;
        err.hidden = false;
        return;
      }
      const nt = Object.keys(tamanhosQtd).length;
      const f = faltas();
      if (f.length && !p._ok) {
        p._ok = true;
        a.ok.textContent = "Registrar mesmo assim";
        err.textContent = "Não tem o suficiente no estoque: " + f.join("; ") + ". Toque de novo para registrar mesmo assim.";
        err.hidden = false;
        return;
      }
      const body = {
        cliente: cli.value.trim(),
        tel: tel.value.trim(),
        tipoEvento: tipo.value,
        evento: ev.value.trim(),
        dataEvento: dEv.value,
        retirada: ret.value,
        retiradaHora: retH.value,
        devolucao: dev.value,
        qtd: q,
        becasQtd,
        faixasQtd,
        capelosQtd,
        tamanhosQtd,
        tamanhos: nt ? textoTam(tamanhosQtd) : (x && x.tamanhos) || "",
        valor: lerReais(val.value),
        pago: lerReais(pago.value),
        caucao: lerReais(cau.value),
        formaPag: fp.value,
        obs: obs.value.trim(),
        atualizadoEm: new Date().toISOString()
      };
      try {
        if (x) await FS.updateDoc(FS.doc(db, "becas", x.id), body);
        else
          await FS.addDoc(
            col,
            Object.assign(body, { status: "reservado", criadoEm: new Date().toISOString(), por: C.me || "", porEmail: C.email || "" })
          );
        close();
        U.toast(x ? "Aluguel salvo" : `Aluguel registrado: retirada ${U.fmtDate(ret.value)}`);
      } catch (e) {
        C.handleErr(e);
      }
    });
    setTimeout(() => cli.focus(), 30);
  });
}
