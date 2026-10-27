// Card Formaturas: tudo dos colégios fechados, separado do PR.
//  - Cobranças: parcelas vencidas e do mês, de todas as turmas, numa lista só
//  - 🎓 Adesão (Kit 01) e 📘 Kits 02 a 05: resumo por colégio
//  - 📸 Depois das fotos: quem ainda não comprou, com a mensagem e a prévia para vender
//  - 📋 Kits e preços: tabela do contrato (antecipado) e preço depois das fotos
//  - Turmas: colégios fechados, com acesso à lista de formandos
// Quem não é administrador vê só as turmas dos colégios que fechou.
import { openTurma, cobrarWa, registrarPagamento, atrasado, oferecerKit, abrirPrevia } from "./turma.js";
import { kitsPadrao, candidatosPosFoto, ehRepasse, anoDaTurma } from "./contrato.js";
import {
  ativo,
  brl,
  somar,
  recebido as recebidoDe,
  emAberto,
  pagasDe,
  nParcelas,
  quitado,
  vencDa,
  valorParcela,
  esperadas,
  ehKit01,
  fimDoMes
} from "./regras.js";
import { el, title, avisoErro, sheet, botoes } from "./ui.js";
import { editorPrecos } from "./precos.js";
import * as Ev from "./eventos.js";
import * as U from "./util.js";
import { botaoRelatorio } from "./relatorio.js";
// Leitura sob demanda: ao abrir, só as parcelas que vencem até o fim do mês (campo proxVenc);
// a lista completa de formandos só é lida quando alguém abre as abas Adesão, Kits ou Turmas.
let C,
  FS,
  db,
  unsubs = [],
  forms = [],
  cobr = [],
  insts = [],
  aba = "cobrancas",
  tudoCarregado = false,
  carregando = false,
  ofertas = [], // formandos só das turmas com fotos prontas (para o aviso), sem ler a coleção inteira
  erroFn = () => {};
const $ = id => document.getElementById(id);
const moeda = brl;

export function init(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
  Ev.init(ctx);
}
export function hide() {
  unsubs.forEach(u => u());
  unsubs = [];
}

export function show() {
  const v = $("viewFormaturas");
  v.innerHTML = "";
  const head = el("div", "vhead");
  head.append(el("h2", null, "Formaturas"));
  // preços mínimos dos kits e da formatura (antes ficavam em Instituições)
  const hb = el("div", "agact");
  hb.append(
    U.mkBtn("+ Formando", "btn-primary btn-sm", () => novoFormando()),
    U.mkBtn("📋 Kits e preços", "btn-sm", () => openKits()),
    U.mkBtn("💲 Preços mínimos", "btn-sm", () => Ev.openPrecos()),
    botaoRelatorio(relatorioFormaturas, () => C.me)
  );
  head.append(hb);
  v.append(head);
  v.append(
    el("p", "hint", "Kits do contrato de formatura (venda antecipada e depois das fotos) dos colégios fechados. O PR fica no card próprio.")
  );
  // Como no PR: Linha de Frente = turmas deste ano; Repasse = turmas de anos anteriores (vira sozinho em 1º de janeiro)
  const segs = el("div", "segs");
  segs.setAttribute("role", "tablist");
  const ano = U.todayStr().slice(0, 4);
  [
    ["lf", "Linha de Frente " + ano, "turmas deste ano"],
    ["rep", "Repasse", "turmas de anos anteriores"]
  ].forEach(([kk, t, sub]) => {
    const b = el("button", "seg");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(seg === kk));
    b.append(el("b", null, t), el("small", null, sub));
    b.onclick = () => {
      seg = kk;
      try {
        localStorage.setItem("z7fmseg", kk);
      } catch (_) {
        /* sem armazenamento: fica só nesta sessão */
      }
      segs.querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", String(x === b)));
      render();
    };
    segs.append(b);
  });
  v.append(segs);
  const k = el("div", "kpis");
  k.id = "fmKpis";
  v.append(k);
  const chips = el("div", "chips");
  chips.id = "fmChips";
  v.append(chips);
  const corpo = el("div");
  corpo.id = "fmCorpo";
  corpo.append(el("div", "empty", "Carregando…"));
  v.append(corpo);
  hide();
  forms = [];
  cobr = [];
  insts = [];
  tudoCarregado = false;
  aba = "cobrancas";
  const erro = e => {
    avisoErro(e, "carregar as formaturas");
    if (e.code === "permission-denied") {
      corpo.innerHTML = "";
      corpo.append(el("div", "empty", "Cole as regras novas do Firebase para usar o card Formaturas."));
    }
  };
  const mapa = s => s.docs.map(d => Object.assign({ id: d.id }, d.data()));
  if (C.isAdmin)
    unsubs.push(
      FS.onSnapshot(
        FS.query(
          FS.collection(db, "formandos"),
          FS.where("proxVenc", ">", ""),
          FS.where("proxVenc", "<=", fimDoMes(U.todayStr())),
          FS.limit(3000)
        ),
        s => {
          cobr = mapa(s);
          render();
        },
        erro
      )
    );
  else
    unsubs.push(
      FS.onSnapshot(
        C.carteira("formandos"),
        s => {
          forms = mapa(s);
          cobr = forms.filter(f => f.proxVenc && f.proxVenc <= fimDoMes(U.todayStr()));
          tudoCarregado = true;
          render();
        },
        erro
      )
    );
  unsubs.push(
    FS.onSnapshot(
      C.carteira("instituicoes", FS.where("etapa", "==", "FECHADO"), FS.limit(500)),
      s => {
        insts = mapa(s).filter(i => i.etapa === "FECHADO");
        // turma com fotos prontas: lê só os formandos dessas turmas, para o aviso de quem pode receber a oferta
        carregarOfertas();
        render();
      },
      erro
    )
  );
  erroFn = erro;
}
// Formandos das turmas com fotos prontas (Linha de Frente), em grupos de 30 turmas por consulta
async function carregarOfertas() {
  if (!C.isAdmin) return; // a equipe já tem os próprios formandos (carteira)
  const ids = insts.filter(i => (i.contratoTurma || {}).fotosProntasEm && !ehRepasse(i, U.todayStr())).map(i => i.id);
  if (!ids.length) {
    ofertas = [];
    return;
  }
  try {
    const grupos = [];
    for (let i = 0; i < ids.length; i += 30) grupos.push(ids.slice(i, i + 30));
    const snaps = await Promise.all(grupos.map(g => FS.getDocs(FS.query(FS.collection(db, "formandos"), FS.where("instId", "in", g)))));
    ofertas = snaps.flatMap(sn => sn.docs.map(d => Object.assign({ id: d.id }, d.data())));
    render();
  } catch (e) {
    avisoErro(e, "ver quem pode receber a oferta");
  }
}
// Abas que precisam de todos os formandos: lê uma vez (sem ficar escutando a coleção inteira)
// e lê de novo quando alguém fecha uma turma, que é onde os formandos mudam.
async function carregarTudo(forcar) {
  if (!C.isAdmin || carregando || (tudoCarregado && !forcar)) return;
  carregando = true;
  try {
    const s = await FS.getDocs(FS.query(FS.collection(db, "formandos"), FS.limit(5000)));
    forms = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
    tudoCarregado = true;
    render();
  } catch (e) {
    erroFn(e);
  } finally {
    carregando = false;
  }
}
// Abre a turma com os kits do tipo de colégio e, ao fechar, atualiza os números
const abrirTurma = (i, novo) =>
  openTurma(
    C,
    i,
    Ev.produtos(i.tipo).filter(x => !x.formatura),
    () => carregarTudo(true),
    { novo: !!novo }
  );

// Linha de Frente (turmas deste ano) ou Repasse (anos anteriores)
let seg = (() => {
  try {
    return localStorage.getItem("z7fmseg") || "lf";
  } catch (_) {
    return "lf";
  }
})();
const noSeg = i => (seg === "rep") === ehRepasse(i, U.todayStr());
// "+ Formando" direto no card: escolhe a turma e já abre o cadastro (sem precisar importar planilha)
function novoFormando() {
  const lista = (C.isAdmin ? insts : insts.filter(i => C.ehMeu(i)))
    .slice()
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  if (!lista.length) return U.toast("Nenhum colégio fechado ainda. Feche o colégio em Instituições para criar a turma.");
  if (lista.length === 1) return abrirTurma(lista[0], true);
  sheet("Incluir formando", (p, close) => {
    const s0 = el("select");
    lista.forEach(i => {
      const o = el("option", null, title(i.nome) + (ehRepasse(i, U.todayStr()) ? ` (Repasse ${anoDaTurma(i)})` : ""));
      o.value = i.id;
      s0.append(o);
    });
    const f = el("div", "field");
    const l = el("label", null, "Turma (colégio)");
    s0.id = "fmNovoTurma";
    l.htmlFor = s0.id;
    f.append(l, s0);
    p.append(f);
    p.append(botoes(close, "Continuar"));
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      close();
      abrirTurma(
        lista.find(i => i.id === s0.value),
        true
      );
    });
  });
}
// Só as turmas que a pessoa pode ver, do bloco escolhido
function minhasInsts() {
  return (C.isAdmin ? insts : insts.filter(i => C.ehMeu(i))).filter(noSeg);
}
function meusForms(lista) {
  const ids = new Set(minhasInsts().map(i => i.id)),
    todas = new Set(insts.map(i => i.id));
  return (lista || forms).filter(
    f => ativo(f) && (C.isAdmin || f.respEmail === C.email) && (ids.has(f.instId) || (seg === "lf" && !todas.has(f.instId)))
  );
}

function render() {
  const k = $("fmKpis"),
    chips = $("fmChips"),
    corpo = $("fmCorpo");
  if (!k) return;
  const fs = meusForms(),
    cf = meusForms(cobr);
  const col = fs.filter(ehKit01),
    alb = fs.filter(f => !ehKit01(f));
  const atr = cf.filter(atrasado),
    aVencer = cf.filter(f => !atrasado(f));
  const doMes = somar(cf.map(f => valorParcela(f, pagasDe(f) + 1)));
  k.innerHTML = "";
  const kp = [
    ["Parcelas atrasadas", String(atr.length)],
    ["Vencem até o fim do mês", String(aVencer.length)],
    ["Para receber neste mês", moeda(doMes)]
  ];
  if (tudoCarregado)
    kp.push(["🎓 Adesão a receber", moeda(somar(col.map(emAberto)))], ["📘 Kits a receber", moeda(somar(alb.map(emAberto)))]);
  kp.forEach(([t, v], i) => {
    const c = el("div", "kpi" + (i === 0 && atr.length ? " late" : ""));
    c.append(el("small", null, t), el("b", null, v));
    k.append(c);
  });
  const cob = cobrancas(cf);
  chips.innerHTML = "";
  [
    ["cobrancas", "Cobranças", cob.length],
    ["adesao", "🎓 Adesão (Kit 01)", tudoCarregado ? col.length : ""],
    ["album", "📘 Kits 02 a 05", tudoCarregado ? alb.length : ""],
    [
      "posfoto",
      seg === "rep" ? "🔁 Oferecer no repasse" : "📸 Depois das fotos",
      tudoCarregado || (seg === "lf" && ofertas.length) ? semKit().length : ""
    ],
    ["turmas", "Turmas", minhasInsts().length]
  ].forEach(([kk, t, n]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(aba === kk));
    if (n !== "") b.append(el("span", "n", String(n)));
    b.onclick = () => {
      aba = kk;
      if (kk !== "cobrancas") carregarTudo();
      render();
    };
    chips.append(b);
  });
  corpo.innerHTML = "";
  if (aba !== "cobrancas" && !tudoCarregado) {
    corpo.append(el("div", "empty", "Carregando…"));
    return;
  }
  if (aba === "cobrancas") renderCobrancas(corpo, cob);
  else if (aba === "turmas") renderTurmas(corpo);
  else if (aba === "posfoto") renderPosFoto(corpo);
  else renderContrato(corpo, aba);
  if (aba !== "posfoto" && seg === "lf") avisoOferta(corpo);
}

// Parcelas atrasadas e as que vencem até o fim do mês
function cobrancas(fs) {
  const fim = fimDoMes(U.todayStr());
  return fs
    .filter(f => !quitado(f) && f.primeiroVenc && vencDa(f, pagasDe(f) + 1) <= fim)
    .map(f => ({ f, venc: vencDa(f, pagasDe(f) + 1) }))
    .sort((a, b) => a.venc.localeCompare(b.venc) || (a.f.nome || "").localeCompare(b.f.nome || ""));
}
function renderCobrancas(corpo, cob) {
  if (!cob.length) {
    const e = el("div", "empty");
    e.append(
      el("strong", null, "Nenhuma parcela para cobrar este mês ✓"),
      el("span", null, "Aqui aparecem as parcelas atrasadas e as que vencem até o fim do mês, de todas as turmas.")
    );
    corpo.append(e);
    return;
  }
  const g = el("div", "grid");
  cob.forEach(({ f, venc }) => {
    const at = atrasado(f);
    const e = el("article", "card " + (at ? "late" : "today"));
    const top = el("div", "card-top");
    top.append(el("h3", "name", title(f.nome)), el("span", "stage", at ? "ATRASADO" : "VENCE " + U.fmtDate(venc)));
    e.append(top);
    const meta = el("div", "meta");
    [title(f.instNome), (ehKit01(f) ? "🎓 " : "📘 ") + (f.kit || (ehKit01(f) ? "Kit 01 · adesão" : "Kit")), f.serie]
      .filter(Boolean)
      .forEach((t, i) => meta.append(el("span", "tag" + (i === 1 ? " svc" : ""), t)));
    e.append(meta);
    const pg = pagasDe(f),
      emAtraso = esperadas(f, U.todayStr()) - pg;
    e.append(
      el(
        "div",
        "fu " + (at ? "late" : "today"),
        `Parcela ${pg + 1}/${nParcelas(f)} · ${moeda(valorParcela(f, pg + 1))} · ${at ? "venceu" : "vence"} ${U.fmtDate(venc)}` +
          (at && emAtraso > 1 ? ` · ${emAtraso} em atraso` : "")
      )
    );
    const act = el("div", "actions");
    if (C.isAdmin) act.append(U.mkBtn("✅ Parcela paga", "btn-ok", () => registrarPagamento(C, f).catch(er => C.handleErr(er))));
    if (f.tel) act.append(U.mkBtn("💬 Cobrar", at ? "btn-primary" : "", () => cobrarWa(C, f)));
    const inst = insts.find(i => i.id === f.instId);
    if (inst) act.append(U.mkBtn("Ver turma", "", () => abrirTurma(inst)));
    e.append(act);
    g.append(e);
  });
  corpo.append(g);
}

function resumoInst(i, lst) {
  return {
    n: lst.length,
    vend: somar(lst.map(f => f.valor)),
    rec: somar(lst.map(recebidoDe)),
    aberto: somar(lst.map(emAberto)),
    atr: lst.filter(atrasado).length
  };
}
function renderContrato(corpo, tipo) {
  const adesao = tipo === "adesao";
  corpo.append(
    el(
      "p",
      "hint",
      adesao
        ? "Kit 01 (beca + canudo) é a adesão da formatura. A comissão é sobre cada parcela paga (taxa em Ajustes)."
        : "Kits 02 a 05 do contrato (e outros kits). Preços em “📋 Kits e preços”."
    )
  );
  const g = el("div", "grid");
  let algum = false;
  minhasInsts().forEach(i => {
    const lst = meusForms().filter(f => f.instId === i.id && (adesao ? ehKit01(f) : !ehKit01(f)));
    if (!lst.length) return;
    algum = true;
    const r = resumoInst(i, lst);
    const e = el("article", "card " + (r.atr ? "late" : ""));
    const top = el("div", "card-top");
    top.append(el("h3", "name", title(i.nome)), el("span", "stage", `${r.n} aluno${r.n !== 1 ? "s" : ""}`));
    e.append(top);
    const meta = el("div", "meta");
    if (i.formatura && i.formatura.data && i.formatura.status !== "recusado")
      meta.append(el("span", "tag", `🎓 ${U.fmtDate(i.formatura.data)}/${i.formatura.data.slice(0, 4)}`));
    if (!adesao) {
      const kits = {};
      lst.forEach(f => {
        const kk = (f.kit || "Outro").split(" · ")[0];
        kits[kk] = (kits[kk] || 0) + 1;
      });
      Object.entries(kits).forEach(([kk, n]) => meta.append(el("span", "tag", `${kk}: ${n}`)));
    }
    e.append(meta);
    e.append(
      el(
        "div",
        "fu" + (r.atr ? " late" : ""),
        `Vendido ${moeda(r.vend)} · recebido ${moeda(r.rec)} · em aberto ${moeda(r.aberto)}${r.atr ? ` · ${r.atr} atrasado${r.atr > 1 ? "s" : ""}` : ""}`
      )
    );
    const act = el("div", "actions");
    act.append(U.mkBtn("Abrir turma", "btn-primary", () => abrirTurma(i)));
    e.append(act);
    g.append(e);
  });
  if (!algum) {
    const e = el("div", "empty");
    e.append(
      el("strong", null, adesao ? "Nenhuma adesão (Kit 01) ainda" : "Nenhum kit vendido ainda"),
      el("span", null, "Abra a turma do colégio fechado (aba Turmas) e inclua os formandos.")
    );
    corpo.append(e);
    return;
  }
  corpo.append(g);
}
function renderTurmas(corpo) {
  const lst = minhasInsts();
  if (!lst.length) {
    const e = el("div", "empty");
    e.append(
      el("strong", null, "Nenhum colégio fechado ainda"),
      el("span", null, "Quando uma instituição vira FECHADO, a turma aparece aqui.")
    );
    corpo.append(e);
    return;
  }
  const g = el("div", "grid");
  lst
    .slice()
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"))
    .forEach(i => {
      const fs = meusForms().filter(f => f.instId === i.id),
        r = resumoInst(i, fs);
      const e = el("article", "card" + (r.atr ? " late" : ""));
      const top = el("div", "card-top");
      top.append(el("h3", "name", title(i.nome)), el("span", "stage", `${r.n} formando${r.n !== 1 ? "s" : ""}`));
      e.append(top);
      const meta = el("div", "meta");
      [
        `🎓 ${fs.filter(ehKit01).length} adesão`,
        `📘 ${fs.filter(f => !ehKit01(f)).length} kits`,
        C.nomeDe(i) ? "👤 " + U.first(C.nomeDe(i)) : "",
        i.fechadoEm ? "Fechado em " + U.fmtDate(i.fechadoEm) : ""
      ]
        .filter(Boolean)
        .forEach(t => meta.append(el("span", "tag", t)));
      e.append(meta);
      e.append(
        el("div", "fu" + (r.atr ? " late" : ""), `Vendido ${moeda(r.vend)} · recebido ${moeda(r.rec)} · em aberto ${moeda(r.aberto)}`)
      );
      // datas da formatura e do dia de fotos (antes ficavam no cartão da instituição)
      ["fotos", "formatura"].forEach(kk => {
        const l = Ev.linhaEvento(i, kk);
        if (l) e.append(l);
      });
      const act = el("div", "actions");
      act.append(
        U.mkBtn("👥 Formandos e parcelas", "btn-primary", () => abrirTurma(i)),
        U.mkBtn("🎓 Formatura", "", () => Ev.openEvento(i, "formatura")),
        U.mkBtn("📸 Dia de fotos", "", () => Ev.openEvento(i, "fotos"))
      );
      e.append(act);
      g.append(e);
    });
  corpo.append(g);
}

// ---------- venda depois das fotos ----------
// Quem tem só o Kit 01, nas turmas com as fotos prontas (o Adriano ou a Luciana marcam em "📅 Contrato da turma")
// No Repasse: quem ficou só com o Kit 01 nas turmas de anos anteriores (não precisa marcar fotos prontas)
function semKit() {
  const out = [];
  insts.filter(noSeg).forEach(i => {
    if (seg === "lf" && !(i.contratoTurma || {}).fotosProntasEm) return;
    // admin sem a lista completa carregada usa só as turmas com oferta (Linha de Frente)
    const fonte = C.isAdmin && !tudoCarregado ? ofertas : forms;
    const daTurma = fonte.filter(f => f.instId === i.id && (C.isAdmin || f.respEmail === C.email));
    candidatosPosFoto(daTurma).forEach(f => out.push(f));
  });
  return out;
}
// Aviso no topo: "Pode oferecer para N alunos do Colégio X"
function avisoOferta(corpo) {
  if (C.isAdmin ? !tudoCarregado && !ofertas.length : !tudoCarregado) return;
  const porInst = {};
  semKit().forEach(f => {
    porInst[f.instId] = (porInst[f.instId] || 0) + 1;
  });
  Object.entries(porInst).forEach(([id, n]) => {
    const i = insts.find(x => x.id === id) || {};
    const b = el("div", "wait");
    b.append(
      document.createTextNode(`📸 Fotos prontas: pode oferecer os kits para ${n} aluno${n > 1 ? "s" : ""} do ${title(i.nome || "")}. `)
    );
    b.append(
      U.mkBtn("Ver quem", "btn-sm", () => {
        aba = "posfoto";
        render();
      })
    );
    corpo.prepend(b);
  });
}
function renderPosFoto(corpo) {
  corpo.append(
    el(
      "p",
      "hint",
      seg === "rep"
        ? "Repasse: quem ficou só com o Kit 01 nas turmas de anos anteriores. Mande a prévia e os kits no preço de repasse. Quando comprar, toque em “Abrir turma” → 🛒 Comprou kit."
        : "Quem tem só o Kit 01, nas turmas com as fotos prontas: mande a prévia e os kits no preço depois das fotos. Quando comprar, toque em “Abrir turma” → 🛒 Comprou kit."
    )
  );
  const lst = semKit().sort((a, b) => (a.instNome || "").localeCompare(b.instNome || "") || (a.nome || "").localeCompare(b.nome || ""));
  if (!lst.length) {
    const e = el("div", "empty");
    e.append(
      el("strong", null, "Ninguém para oferecer agora"),
      el(
        "span",
        null,
        seg === "rep"
          ? "Aqui aparecem os alunos de turmas de anos anteriores que ficaram só com o Kit 01."
          : "Quando as fotos de uma turma ficarem prontas, marque em Turmas → Formandos → 📅 Contrato da turma → 📸 Fotos prontas."
      )
    );
    corpo.append(e);
    return;
  }
  const g = el("div", "grid");
  lst.forEach(f => {
    const inst = insts.find(i => i.id === f.instId) || { id: f.instId, nome: f.instNome };
    const pr = (inst.contratoTurma || {}).fotosProntasEm;
    const e = el("article", "card today");
    const top = el("div", "card-top");
    top.append(
      el("h3", "name", title(f.nome)),
      el("span", "stage", seg === "rep" ? "REPASSE " + anoDaTurma(inst) : pr ? "FOTOS PRONTAS " + U.fmtDate(pr) : "OFERECER")
    );
    e.append(top);
    const meta = el("div", "meta");
    [title(f.instNome), f.kit || "Kit 01", f.serie, f.tel].filter(Boolean).forEach(t => meta.append(el("span", "tag", t)));
    e.append(meta);
    const act = el("div", "actions");
    if (f.tel) act.append(U.mkBtn("💬 Oferecer kit", "btn-primary", () => oferecerKit(C, inst, f)));
    act.append(U.mkBtn("🖼️ Prévia", "", () => abrirPrevia(C, inst, f)));
    if (insts.find(i => i.id === f.instId)) act.append(U.mkBtn("Abrir turma", "", () => abrirTurma(inst)));
    e.append(act);
    g.append(e);
  });
  corpo.append(g);
}

// ---------- tabela de kits (contrato) ----------
// Três preços por kit (editor em js/precos.js, o mesmo da tabela da turma)
function openKits() {
  const kits = kitsPadrao(C.P);
  sheet("Kits e preços (tabela padrão)", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "Tabela padrão para todas as turmas (cada turma pode ter a sua em Formandos → 📋 Kits desta turma). Antecipado = preço do contrato, até o dia da formatura. Depois das fotos = valor a mais para quem tem só o Kit 01. Repasse = preço para quem ficou só com o Kit 01 em turmas de anos anteriores. Deixe em branco o que não é oferecido."
      )
    );
    const ed = editorPrecos(p, kits, { bloqueado: !C.isAdmin });
    const a = botoes(close, "Salvar tabela");
    if (!C.isAdmin) a.ok.hidden = true;
    p.append(a);
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      if (!C.isAdmin) return;
      const nova = ed.ler();
      try {
        await FS.setDoc(FS.doc(db, "config", "app"), { kitsFormatura: nova }, { merge: true });
        C.P.kitsFormatura = nova;
        close();
        U.toast("Tabela de kits salva");
      } catch (e) {
        C.handleErr(e);
      }
    });
  });
}

// Relatório para reunião: números das turmas do bloco escolhido e as cobranças em atraso
async function relatorioFormaturas() {
  await carregarTudo();
  const turmas = minhasInsts(),
    fs = meusForms(),
    cf = meusForms(cobr);
  const tot = resumoInst(null, fs);
  const linhas = turmas
    .map(i => [
      i,
      resumoInst(
        i,
        fs.filter(f => f.instId === i.id)
      )
    ])
    .sort((a, b) => b[1].vend - a[1].vend)
    .map(([i, r]) => [title(i.nome), r.n, moeda(r.vend), moeda(r.rec), moeda(r.aberto), r.atr || ""]);
  const atr = cobrancas(cf).filter(({ f }) => atrasado(f));
  return {
    titulo: "Formaturas",
    subtitulo: seg === "rep" ? "Repasse (turmas de anos anteriores)" : "Linha de Frente (turmas deste ano)",
    secoes: [
      {
        titulo: "Resumo",
        kpis: [
          ["Turmas", turmas.length],
          ["Formandos com kit", tot.n],
          ["Vendido", moeda(tot.vend)],
          ["Recebido", moeda(tot.rec)],
          ["A receber", moeda(tot.aberto)],
          ["Parcelas atrasadas", atr.length]
        ]
      },
      {
        titulo: "Por turma",
        tabela: { cols: ["Colégio", "Kits", "Vendido", "Recebido", "Em aberto", "Atrasados"], linhas },
        vazio: "Nenhuma turma neste bloco."
      },
      {
        titulo: "Cobranças em atraso",
        tabela: {
          cols: ["Formando", "Colégio", "Kit", "Parcela", "Valor", "Venceu"],
          linhas: atr.map(({ f, venc }) => [
            title(f.nome),
            title(f.instNome),
            f.kit || (ehKit01(f) ? "Kit 01" : "Kit"),
            `${pagasDe(f) + 1}/${nParcelas(f)}`,
            moeda(valorParcela(f, pagasDe(f) + 1)),
            U.fmtDate(venc)
          ])
        },
        vazio: "Nenhuma parcela atrasada. 🎉"
      }
    ]
  };
}
