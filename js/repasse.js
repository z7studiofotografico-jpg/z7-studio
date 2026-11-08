// Módulo PR: venda do Kit Recordação (quadro 30x40 + 2 porta-retratos + fotos digitais) para quem fez o ensaio.
// Duas frentes, separadas pelo ano do ensaio e calculadas na hora (viram sozinhas em 1º de janeiro):
//   • Linha de Frente: ensaios do ano atual
//   • Repasse: ensaios dos anos anteriores
// Trabalha com milhares de contatos, então nunca carrega a coleção inteira:
// cada aba busca só o que precisa (hoje, interessados, pagos, busca).
// Partes: repasse-estado.js (estado e regras do contato), repasse-mensagens.js (textos), repasse-cartao.js (cartão),
// repasse-janelas.js (venda, entrega, notas), repasse-form.js (dados e "+ Aluno"), repasse-lote.js (números e lote).
import { openMockup } from "./mockup.js";
import { el, title, emPartes, clicavel } from "./ui.js";
import * as U from "./util.js";
import { norm } from "./repasse-dados.js";
import { openImport } from "./repasse-import.js";
import { botaoRelatorio, contar } from "./relatorio.js";
import { codigoBusca, pareceCodigo, codigosDaBusca, ordemCodigo, telRelatorio } from "./aluno-id.js";
import { painelPedidos } from "./pedidos.js";
import {
  C,
  FS,
  col,
  tab,
  seg,
  items,
  meta,
  mudarTab,
  mudarSeg,
  precoFaltando,
  mudarItems,
  tela,
  iniciar,
  ANO,
  ABERTAS,
  segNome,
  segsPermitidas,
  baseLF,
  soMinha,
  noSeg,
  status,
  precoTxt,
  tipoPR,
  mudarTipoPR,
  ehFormatura,
  baseSeg,
  colNome,
  metaNome,
  $,
  textoVendasMes
} from "./repasse-estado.js";
// Caídos: o admin vê todos; a equipe, os que ela mesma marcou
const soMinhaCaidos = () => (C.isAdmin ? [] : [FS.where("respEmail", "==", C.email || "")]);
import { card } from "./repasse-cartao.js";
import { sheet, field, actions } from "./repasse-janelas.js";
import { openDados } from "./repasse-form.js";
import { refreshStats, refreshLote, separarLote, loadMeta, pintarEscolas, escolaEscolhida, gruposPR } from "./repasse-lote.js";
export { ETAPAS } from "./repasse-estado.js";
let unsubList = null,
  mounted = false,
  raiz = null; // a tela inteira do PR (fica dentro do card PR ou dentro de Formaturas)

// ---------- tela ----------
export function init(ctx) {
  iniciar(ctx);
  tela.renderList = renderList;
  tela.openTab = openTab;
}

export function show() {
  // card PR: o tipo volta para PR ou Paspatur (o último usado)
  let t = "pr";
  try {
    t = localStorage.getItem("z7tipoPR") === "paspatur" ? "paspatur" : "pr";
  } catch (_) {}
  if (tipoPR !== t) mudarTipoPR(t);
  if (tipoPR === "formatura") mudarTipoPR("pr");
  mostrar($("viewRepasse"));
}
// Formaturas → Linha de Frente / Repasse: o mesmo motor, na coleção da formatura
export function mostrarEm(container, frente) {
  mudarTipoPR("formatura");
  mudarSeg(frente === "rep" ? "rep" : "lf");
  mostrar(container);
}
function mostrar(container) {
  if (!mounted) mount();
  if (raiz.parentNode !== container) container.append(raiz);
  const form = tipoPR === "formatura";
  raiz.querySelector(".vhead").hidden = form;
  $("rTipos").hidden = form;
  $("rSegs").hidden = form;
  $("rGuide").hidden = form;
  const h = raiz.querySelector(".vhead h2");
  if (h) h.textContent = tipoPR === "paspatur" ? "PR · Paspatur" : "PR";
  if (!form) {
    let s0 = seg;
    try {
      s0 = localStorage.getItem("z7seg") || seg;
    } catch (_) {}
    mudarSeg(s0);
  }
  const ok = segsPermitidas();
  if (!ok.includes(seg)) mudarSeg(ok[0] || "lf");
  renderSegs();
  loadMeta().then(refreshStats);
  avisoEdicoes();
  refreshLote();
  openTab(tab);
}

function importarAqui() {
  openImport(
    C,
    {
      sheet,
      field,
      actions,
      get meta() {
        return meta;
      }
    },
    () => (loadMeta(), refreshStats())
  );
}
// Formaturas: "Importar planilha" no topo da página grava na lista da formatura (formaturaAlunos)
export async function importarFormatura() {
  if (tipoPR !== "formatura") mudarTipoPR("formatura");
  await loadMeta();
  importarAqui();
}
// Formaturas: ao trocar de aba ou sair do card, para de ouvir a lista
export function parar() {
  if (unsubList) {
    unsubList();
    unsubList = null;
  }
}
// abrir um aluno do PR já na tela certa (Formaturas usa o mesmo cadastro)
export const novoAluno = () => openDados(null);
function mount() {
  mounted = true;
  const v0 = $("viewRepasse");
  v0.innerHTML = "";
  raiz = el("div", "pr-raiz");
  v0.append(raiz);
  const v = raiz;
  const head = el("div", "vhead");
  head.append(el("h2", null, tipoPR === "paspatur" ? "PR · Paspatur" : "PR"));
  const hb = el("div", "quick");
  hb.append(U.mkBtn("+ Aluno", "btn-primary", () => openDados(null)));
  hb.append(U.mkBtn("🖼️ Prévia e fotos", "", () => openMockup({ preco: precoTxt(), toast: U.toast })));
  // admin, no computador: prévias leves com marca d'água de um colégio inteiro (para o representante)
  if (C.isAdmin)
    hb.append(
      U.mkBtn("🗂️ Prévias de um colégio", "", () =>
        import("./previas-lote.js").then(m => m.abrirPreviasLote(C, { col: colNome() })).catch(e => C.handleErr(e))
      ),
      // quem está sem prévia no Drive: já comprou (normal) × falta gerar (com o "📤 Enviar foto")
      U.mkBtn("🔎 Conferir fotos", "", () =>
        import("./conferir-fotos.js").then(m => m.abrirConferirFotos(C, colNome())).catch(e => C.handleErr(e))
      )
    );
  hb.append(botaoRelatorio(relatorioPR, () => C.me));
  const imp = U.mkBtn("Importar planilha", "", () => importarAqui());
  imp.id = "rImport";
  imp.hidden = !C.isAdmin;
  hb.append(imp);
  head.append(hb);
  v.append(head);

  // abas PR e Paspatur (Etapa 4): o mesmo fluxo, listas e preços separados
  const tipos = el("div", "chips tipos-pr");
  tipos.id = "rTipos";
  v.append(tipos);
  const segs = el("div", "segs");
  segs.id = "rSegs";
  segs.setAttribute("role", "tablist");
  v.append(segs);
  const edc = el("p", "notice");
  edc.id = "rEdicoes";
  edc.hidden = true;
  v.append(edc);
  const semP = el("p", "wait");
  semP.id = "rSemPreco";
  semP.hidden = true;
  v.append(semP);
  const g = el("details", "guide");
  g.id = "rGuide";
  g.innerHTML = `<summary>Como funciona o PR</summary><ol>
    <li><b>Linha de Frente</b> são os ensaios deste ano; <b>Repasse</b> são os dos anos anteriores. Em 1º de janeiro tudo vira sozinho: a Linha de Frente do ano que acabou passa para o Repasse.</li>
    <li><b>Separe o seu lote do dia</b> no quadro abaixo: toque em <b>Separar alunos</b> e diga quantos quer. Nunca vem o mesmo aluno duas vezes. Vá com calma nas mensagens novas para o WhatsApp não bloquear o número.</li>
    <li>Cada cartão mostra <b>para quem mandar</b> (mãe, pai ou aluno) e a mensagem pronta. O 1º contato só pede permissão para mandar a prévia.</li>
    <li>Respondeu que quer ver? Toque em <b>Quer ver a prévia</b>, depois em <b>🖼️ Prévia</b>: arraste a foto do aluno e o app monta o kit pronto para enviar.</li>
    <li><b>Pagou?</b> Toque em <b>Pagou</b>. O cartão pede para <b>confirmar o endereço</b> (ou agendar a retirada no estúdio) e vai para <b>Entregas</b>, separado por cidade e bairro para montar a rota.</li>
    <li>Use o <b>WhatsApp mostrado no quadro do lote (📱)</b>: a equipe usa os próprios números de trabalho; o seletor troca por outro já liberado (ex.: o cliente bloqueou). O aviso de contatos por dia muda em ⚙️ Ajustes.</li></ol>`;
  v.append(g);

  const st = el("section", "stats");
  st.innerHTML = `<div class="stat today"><b id="rsHoje">–</b><small>Para hoje</small></div>
    <div class="stat"><b id="rsFila">–</b><small>Na fila</small></div>
    <div class="stat"><b id="rsInt">–</b><small>Interessados</small></div>
    <div class="stat won"><b id="rsMes">–</b><small>Vendido no mês</small></div>`;
  v.append(st);

  const lote = el("div", "lote");
  lote.id = "rLote";
  lote.innerHTML = `<div><b>Seu lote de hoje</b><span id="rLoteTxt">…</span><small class="lnum" id="rLoteNum" hidden></small><p class="wait" id="rLoteAviso" hidden></p></div>
    <div class="lote-esc"><div class="quick"><select id="rLoteEscola" aria-label="Escola do lote"><option value="">Turmas mais recentes primeiro</option></select>
    <button class="btn btn-primary btn-sm" id="rLoteBtn" type="button">Separar contatos</button></div>
    <input id="rLoteBusca" type="search" placeholder="🔎 Procurar colégio (ex.: yonne)" aria-label="Procurar colégio na lista">
    <div class="quick" id="rFerColegio" hidden>
      <button class="btn btn-sm" id="rJuntar" type="button">🔀 Juntar com outro colégio</button>
      <button class="btn btn-sm" id="rVerAlunos" type="button">👥 Ver / excluir alunos</button>
      <button class="btn btn-sm btn-danger" id="rExcluirCol" type="button">🗑️ Excluir colégio inteiro</button>
      <button class="btn btn-sm" id="rAcertar" type="button">🔄 Acertar a lista</button>
    </div></div>`;
  v.append(lote);

  // pedidos de aluno repetido (admin decide; a equipe vê a resposta)
  const ped = el("section", "pedidos");
  ped.id = "rPedidos";
  ped.hidden = true;
  v.append(ped);
  painelPedidos(C, ped);

  const chips = el("div", "chips");
  chips.id = "rChips";
  chips.setAttribute("role", "toolbar");
  v.append(chips);

  const busca = el("div", "rbusca");
  busca.id = "rBusca";
  busca.hidden = true;
  busca.innerHTML = `<input class="search" id="rQ" type="search" placeholder="Nome do aluno ou telefone" aria-label="Buscar no repasse">
    <select class="search" id="rEscola" aria-label="Filtrar por escola"><option value="">Ou escolha uma escola…</option></select>`;
  v.append(busca);

  const list = el("section", "grid");
  list.id = "rList";
  list.setAttribute("aria-live", "polite");
  v.append(list);

  $("rLoteBtn").onclick = separarLote;
  $("rLoteBusca").oninput = () => pintarEscolas();
  let tq;
  $("rQ").addEventListener("input", () => {
    clearTimeout(tq);
    tq = setTimeout(buscar, 400);
  });
  $("rEscola").addEventListener("change", buscar);
  // admin: colégio que veio errado da planilha ("G", "M"…) passa para o colégio certo
  // admin: o colégio escolhido no lote que veio errado da planilha ("G", "M"…) passa para o colégio certo
  $("rFerColegio").hidden = !C.isAdmin;
  const grupoDoLote = () => {
    const de = gruposPR.find(g => g.valor === $("rLoteEscola").value);
    if (!de) U.toast("Escolha primeiro, na lista acima, o colégio (com o ano).");
    return de;
  };
  const depoisDaLista = () => {
    $("rLoteEscola").value = "";
    loadMeta().then(refreshStats);
    openTab(tab);
  };
  // excluir o colégio e ano inteiro (ex.: importou o ano errado e duplicou)
  $("rExcluirCol").onclick = () => {
    const de = grupoDoLote();
    if (de)
      import("./juntar-colegio.js")
        .then(m => m.excluirColegio(C, { de, colNome: colNome(), aoTerminar: depoisDaLista }))
        .catch(e => C.handleErr(e));
  };
  // ver os alunos desse colégio (na Busca) para excluir um por um no 🗑️ do cartão
  $("rVerAlunos").onclick = () => {
    const v = $("rLoteEscola").value;
    if (!grupoDoLote()) return;
    openTab("buscar");
    $("rEscola").value = v;
    buscar();
  };
  // a lista com números errados ou colégio sem ninguém: conta de novo, colégio por colégio
  $("rAcertar").onclick = () =>
    import("./juntar-colegio.js")
      .then(m => m.acertarLista(C, { colNome: colNome(), aoTerminar: depoisDaLista }))
      .catch(e => C.handleErr(e));
  $("rJuntar").onclick = () => {
    const de = gruposPR.find(g => g.valor === $("rLoteEscola").value);
    if (!de) return U.toast("Escolha primeiro, na lista acima, o colégio que veio errado (com o ano).");
    import("./juntar-colegio.js")
      .then(m =>
        m.abrirJuntar(C, {
          grupos: gruposPR,
          de,
          colNome: colNome(),
          metaNome: metaNome(),
          aoTerminar: () => {
            $("rLoteEscola").value = "";
            loadMeta().then(refreshStats);
            openTab(tab);
          }
        })
      )
      .catch(e => C.handleErr(e));
  };
  // números do topo levam para a lista deles
  const irPara = (id, fn) => clicavel($(id).closest(".stat"), fn, "Ver a lista");
  irPara("rsHoje", () => openTab("hoje"));
  irPara("rsInt", () => openTab("interessados"));
  irPara("rsMes", () => openTab("entregas"));
  // a fila é separada no "Seu lote de hoje"
  irPara("rsFila", () => {
    $("rLote").scrollIntoView({ behavior: "smooth", block: "center" });
    $("rLoteBtn").focus();
  });
  try {
    if (!localStorage.getItem("z7rguide")) g.open = true;
    g.addEventListener("toggle", () => {
      try {
        localStorage.setItem("z7rguide", "1");
      } catch (_) {}
    });
  } catch (_) {}
}

function renderTipos() {
  const c = $("rTipos");
  if (!c) return;
  c.innerHTML = "";
  [
    ["pr", "🖼️ PR"],
    ["paspatur", "🎞️ Paspatur"]
  ].forEach(([k, t]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(tipoPR === k));
    b.onclick = () => {
      if (tipoPR === k) return;
      mudarTipoPR(k);
      const h = document.querySelector("#viewRepasse .vhead h2");
      if (h) h.textContent = k === "paspatur" ? "PR · Paspatur" : "PR";
      renderTipos();
      loadMeta().then(refreshStats);
      refreshLote();
      openTab(tab);
    };
    c.append(b);
  });
}
function renderSegs() {
  renderTipos();
  const c = $("rSegs");
  c.innerHTML = "";
  [
    ["lf", `Linha de Frente ${ANO()}`, "ensaios deste ano"],
    ["rep", "Repasse", `ensaios até ${ANO() - 1}`]
  ]
    .filter(([k]) => C.pode(k))
    .forEach(([k, t, sub]) => {
      const b = el("button", "seg");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(seg === k));
      b.append(el("b", null, t), el("small", null, sub));
      b.onclick = () => {
        if (seg === k) return;
        mudarSeg(k);
        try {
          localStorage.setItem("z7seg", k);
        } catch (_) {}
        renderSegs();
        pintarEscolas();
        refreshStats();
        refreshLote();
        openTab(tab);
      };
      c.append(b);
    });
}
function renderChips() {
  const c = $("rChips");
  c.innerHTML = "";
  const tabs = [
    ["hoje", "Para hoje"],
    ["interessados", "Interessados"],
    ["entregas", "Entregas"],
    ["buscar", "Buscar"]
  ];
  if (C.isAdmin) tabs.push(["conferir", "A conferir"], ["incompletos", "Incompletos"]);
  else tabs.push(["incompletos", "Meus incompletos"]);
  // PR, Paspatur e Formatura: quem não vai querer (Caído), com o motivo; só o Adriano resgata para nova negociação
  tabs.push(["caidos", "Caídos"]);
  // vendidos (entregues): só para consulta; não aparecem na busca nem nas outras abas. A equipe vê só as vendas dela
  tabs.push(["vendidos", C.isAdmin ? "Vendidos" : "Minhas vendas"]);
  tabs.forEach(([k, t]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(tab === k));
    b.onclick = () => openTab(k);
    c.append(b);
  });
}

function avisoEdicoes() {
  if (C.isAdmin) import("./edicoes.js").then(m => m.faixaEdicoes(C, $("rEdicoes"))).catch(() => {});
}
function avisoPreco() {
  const x = $("rSemPreco");
  if (!x) return;
  const t = precoFaltando();
  x.textContent = t;
  x.hidden = !t;
}
function openTab(k) {
  avisoPreco();
  mudarTab(k);
  renderChips();
  $("rBusca").hidden = k !== "buscar";
  if (unsubList) {
    unsubList();
    unsubList = null;
  }
  mudarItems([]);
  renderList(true);
  const today = U.todayStr();
  let q = null;
  // a equipe vê só os contatos dela (soMinha); a busca continua mostrando todos, para achar o aluno
  if (seg === "lf") {
    if (k === "hoje") q = FS.query(col, ...baseLF(), ...soMinha(), FS.where("etapa", "in", [...ABERTAS, "ENTREGUE"]), FS.limit(300));
    if (k === "interessados") q = FS.query(col, ...baseLF(), ...soMinha(), FS.where("etapa", "==", "INTERESSADO"), FS.limit(200));
    if (k === "entregas") q = FS.query(col, ...baseLF(), ...soMinha(), FS.where("etapa", "==", "PAGO"), FS.limit(300));
  } else {
    if (k === "hoje")
      q = C.isAdmin
        ? FS.query(col, FS.where("followup", "<=", today), FS.orderBy("followup"), FS.limit(150))
        : FS.query(col, ...soMinha(), FS.where("etapa", "in", [...ABERTAS, "ENTREGUE"]), FS.limit(500));
    if (k === "interessados") q = FS.query(col, ...soMinha(), FS.where("etapa", "==", "INTERESSADO"), FS.limit(200));
    if (k === "entregas") q = FS.query(col, ...soMinha(), FS.where("etapa", "==", "PAGO"), FS.limit(300));
  }
  if (k === "incompletos")
    q = C.isAdmin
      ? FS.query(col, FS.where("etapa", "==", "INCOMPLETO"), FS.limit(200))
      : FS.query(
          col,
          ...(seg === "lf" ? baseLF() : []),
          FS.where("etapa", "==", "INCOMPLETO"),
          FS.where("respEmail", "==", C.email || ""),
          FS.limit(200)
        );
  if (k === "vendidos")
    q = C.isAdmin
      ? FS.query(col, FS.where("etapa", "==", "ENTREGUE"), ...(ehFormatura() ? baseSeg() : seg === "lf" ? baseLF() : []), FS.limit(1000))
      : FS.query(
          col,
          ...(seg === "lf" ? baseLF() : []),
          FS.where("etapa", "==", "ENTREGUE"),
          FS.where("respEmail", "==", C.email || ""),
          FS.limit(500)
        );
  if (k === "conferir") q = FS.query(col, FS.where("conferido", "==", false), FS.limit(300));
  if (k === "caidos")
    q = FS.query(
      col,
      FS.where("etapa", "==", "CAÍDO"),
      ...(ehFormatura() ? baseSeg() : seg === "lf" ? baseLF() : []),
      ...soMinhaCaidos(),
      FS.limit(500)
    );
  if (q)
    unsubList = FS.onSnapshot(
      q,
      snap => {
        mudarItems(snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
        renderList();
      },
      err => {
        console.warn(err);
        U.showNotice("Não foi possível carregar o Repasse. Verifique a internet.");
      }
    );
  if (k === "buscar") {
    $("rQ").focus();
    buscar();
  }
}

let cacheLF = { at: 0, docs: [] };
// escola escolhida: na ordem do ID (como na separação das fotos); senão, por nome
const porNome = (a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR");
const ordemBusca = porEscola => (porEscola ? (a, b) => (a.ano || 0) - (b.ano || 0) || ordemCodigo(a, b) : porNome);

async function buscar() {
  if (tab !== "buscar") return;
  const txt = $("rQ").value.trim(),
    esc = $("rEscola").value,
    escE = escolaEscolhida(esc); // { ano, nomes } do colégio escolhido (uma linha por colégio e ano)
  const daEscola = it => !escE || ((!escE.ano || it.ano === escE.ano) && escE.nomes.includes(it.escola));
  if (!C.pode("rep") && !ehFormatura()) {
    // Só Linha de Frente: carrega os ensaios do ano (uma vez a cada 10 min) e filtra aqui.
    if (!txt && !esc) {
      mudarItems([]);
      renderList(false, "Digite pelo menos 2 letras do nome, um telefone, ou escolha uma escola.");
      return;
    }
    try {
      if (Date.now() - cacheLF.at > 600000) {
        const s0 = await FS.getDocs(FS.query(col, ...baseLF(), FS.limit(3000)));
        cacheLF = { at: Date.now(), docs: s0.docs.map(d => Object.assign({ id: d.id }, d.data())) };
      }
      const n = norm(txt),
        dg = txt.replace(/\D/g, ""),
        cods = pareceCodigo(txt) ? codigosDaBusca(txt, [ANO()]) : [];
      mudarItems(
        cacheLF.docs
          .filter(
            it =>
              daEscola(it) &&
              (!txt ||
                (cods.length && cods.includes(codigoBusca(it.codigo))) ||
                (dg.length >= 8 ? (it.telefones || []).some(t => t.includes(dg.slice(-8))) : (it.nomeBusca || "").includes(n)))
          )
          .slice(0, esc ? 1000 : 100)
          .sort(ordemBusca(esc))
      );
      renderList();
    } catch (e) {
      console.warn(e);
      U.toast("Não foi possível buscar agora.");
    }
    return;
  }
  let q = null;
  const dg = txt.replace(/\D/g, "");
  if (dg.length >= 8) q = FS.query(col, FS.where("telefones", "array-contains", dg.replace(/^55(?=\d{10,11}$)/, "")), FS.limit(30));
  else if (pareceCodigo(txt))
    q = FS.query(
      col,
      FS.where(
        "codigoBusca",
        "in",
        codigosDaBusca(
          txt,
          Array.from({ length: 12 }, (_, i) => ANO() - i)
        )
      ),
      FS.limit(30)
    );
  else if (txt.length >= 2) {
    const n = norm(txt);
    q = FS.query(col, FS.orderBy("nomeBusca"), FS.startAt(n), FS.endAt(n + ""), FS.limit(30));
  } else if (escE)
    q = FS.query(
      col,
      escE.nomes.length > 1 ? FS.where("escola", "in", escE.nomes) : FS.where("escola", "==", escE.nomes[0]),
      ...(escE.ano ? [FS.where("ano", "==", escE.ano)] : []),
      FS.limit(500)
    );
  if (!q) {
    mudarItems([]);
    renderList(false, "Digite pelo menos 2 letras do nome, um telefone, ou escolha uma escola.");
    return;
  }
  try {
    const s = await FS.getDocs(q);
    mudarItems(s.docs.map(d => Object.assign({ id: d.id }, d.data())).sort(ordemBusca(esc && !txt)));
    renderList();
  } catch (e) {
    console.warn(e);
    U.toast("Não foi possível buscar agora.");
  }
}

// Os contatos que a aba mostra (a lista e o relatório usam a mesma regra)
function naTela() {
  // pedido de exclusão: a equipe não vê mais; o admin vê com a pendência na frente
  let arr = (tab === "buscar" ? items.slice() : items.filter(noSeg)).filter(it => C.isAdmin || !(it.excluido && it.excluido.em));
  // quem já comprou (entregue) fica só na aba Vendidos; em "A conferir" continua, senão a venda entregue
  // antes da conferência sumiria e a comissão nunca seria confirmada
  if (tab !== "vendidos" && tab !== "conferir") arr = arr.filter(it => it.etapa !== "ENTREGUE");
  if (tab === "hoje") {
    const t0 = U.todayStr();
    arr = arr.filter(it => ABERTAS.includes(it.etapa) && it.followup && it.followup <= t0);
  }
  return arr;
}
function renderList(loading, emptyMsg) {
  const list = $("rList");
  if (!list) return; // (Formaturas: a tela saiu do ar)
  list.innerHTML = "";
  if (loading) {
    const e = el("div", "empty");
    e.style.gridColumn = "1/-1";
    e.append(el("strong", null, "Carregando…"));
    list.append(e);
    return;
  }
  const arr = naTela();
  if (tab === "vendidos") {
    // total do mês (quantidade e valor pagos no mês, entregues ou não) no topo de Vendidos / Minhas vendas
    const t = el("div", "notes vend-mes", textoVendasMes());
    t.id = "rVendMes";
    t.style.gridColumn = "1/-1";
    list.append(t);
  }
  if (!arr.length) {
    const e = el("div", "empty");
    e.style.gridColumn = "1/-1";
    const msgs = {
      vendidos: ["Nenhuma venda entregue ainda", "Quem comprou e já recebeu o kit aparece aqui, só para consulta."],
      conferir: ["Nenhuma venda para conferir ✓", "As vendas registradas pela equipe aparecem aqui até você conferir o comprovante."],
      hoje: ["Nada para hoje", "Separe o seu lote do dia no quadro acima para começar."],
      interessados: ["Nenhum interessado ainda", "Quem responder que quer ver a prévia aparece aqui."],
      entregas: ["Nenhuma entrega pendente", "Os kits pagos aparecem aqui, separados por cidade e bairro."],
      incompletos: [
        "Nenhum cadastro incompleto",
        "Quem não tiver colégio, ano, nome do aluno, responsável ou telefone aparece aqui para completar."
      ],
      buscar: ["Nada encontrado", emptyMsg || "Tente outro nome ou telefone."]
    };
    const [a, b] = msgs[tab] || ["Nada aqui", ""];
    e.append(el("strong", null, a), el("span", null, emptyMsg || b));
    list.append(e);
    return;
  }
  if (tab === "hoje") {
    const rank = { late: 0, today: 1, later: 2, none: 3, won: 4 };
    arr.sort((a, b) => rank[status(a)] - rank[status(b)] || (a.followup || "").localeCompare(b.followup || ""));
  }
  if (tab === "entregas") {
    const grpOf = it =>
      !it.entregaTipo || it.entregaTipo.startsWith("A combinar")
        ? "0 Falta combinar com o cliente"
        : it.entregaTipo.startsWith("Retirada")
          ? "1 Retirada no estúdio"
          : it.entregaTipo.startsWith("Entrega no colégio")
            ? "1 No colégio · " + title(it.escola || "Sem colégio")
          : "2 " + [title(it.endereco?.cidade || "Sem cidade"), title(it.endereco?.bairro || "Sem bairro")].join(" · ");
    arr.sort((a, b) => grpOf(a).localeCompare(grpOf(b)) || (a.entregaData || "9").localeCompare(b.entregaData || "9"));
    let last = null;
    arr.forEach(it => {
      const grp = grpOf(it).slice(2);
      if (grp !== last) {
        const h = el("h3", "grp", grp);
        h.style.gridColumn = "1/-1";
        list.append(h);
        last = grp;
      }
      list.append(card(it));
    });
    return;
  }
  emPartes(list, arr, card);
}

// ---------- relatório para imprimir (a aba aberta, com os números do topo) ----------
const NOMES_ABA = {
  hoje: "Para hoje",
  interessados: "Interessados",
  entregas: "Entregas",
  buscar: "Busca",
  conferir: "A conferir",
  incompletos: "Incompletos",
  vendidos: "Vendidos"
};
// (Formaturas usa o mesmo relatório nas abas Linha de Frente e Repasse)
export function relatorioPR() {
  const txt = id => ($(id) ? $(id).textContent : "–");
  const dataBR = d => (d ? U.fmtDate(d) + "/" + String(d).slice(0, 4) : "");
  const esc = $("rEscola") ? $("rEscola").value : "";
  // escola escolhida na busca: lista na ordem do ID (para a separação das fotos)
  const lista = naTela().sort(
    tab === "buscar" && esc ? ordemBusca(true) : (a, b) => String(a.followup || "9").localeCompare(String(b.followup || "9"))
  );
  const tels = x =>
    [...(x.contatos || []).map(c => (c.tipo ? c.tipo + ": " : "") + telRelatorio(c.tel)), x.email || ""].filter(Boolean).join(" / ");
  return {
    titulo: "PR · " + segNome(seg),
    subtitulo:
      "Aba " +
      (NOMES_ABA[tab] || tab) +
      (tab === "buscar" && esc ? " · " + escolaEscolhida(esc).rotulo : "") +
      (C.isAdmin ? "" : " · os contatos que você vê"),
    secoes: [
      {
        titulo: "Números",
        kpis: [
          ["Para hoje", txt("rsHoje")],
          ["Na fila", txt("rsFila")],
          ["Interessados", txt("rsInt")],
          ["Vendido no mês", txt("rsMes")]
        ]
      },
      {
        titulo: "Por etapa (" + (NOMES_ABA[tab] || tab) + ")",
        tabela: { cols: ["Etapa", "Contatos"], linhas: contar(lista, x => x.etapa) }
      },
      {
        titulo: "Contatos (" + lista.length + ")",
        tabela: {
          cols: ["ID", "Aluno", "Colégio", "Ano", "Etapa", "Responsável", "Próximo contato", "Telefones e e-mail"],
          linhas: lista.map(x => [
            x.codigo || "",
            title(x.nome),
            title(x.escola),
            x.ano || "",
            x.etapa,
            C.nomeDe(x) || "—",
            dataBR(x.followup),
            tels(x)
          ])
        },
        vazio: "Nenhum contato nesta aba."
      }
    ]
  };
}
