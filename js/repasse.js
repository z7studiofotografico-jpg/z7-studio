// Módulo PR: venda do Kit Recordação (quadro 30x40 + 2 porta-retratos + fotos digitais) para quem fez o ensaio.
// Duas frentes, separadas pelo ano do ensaio e calculadas na hora (viram sozinhas em 1º de janeiro):
//   • Linha de Frente: ensaios do ano atual
//   • Repasse: ensaios dos anos anteriores
// Trabalha com milhares de contatos, então nunca carrega a coleção inteira:
// cada aba busca só o que precisa (hoje, interessados, pagos, busca).
import { openMockup, textoEscolha } from "./mockup.js";
import { ESTUDIO } from "./mensagens.js";
import { el, title, emPartes, avisoErro } from "./ui.js";
import * as U from "./util.js";
import { norm, faltando, docId, situacaoTxt, enderecoTxt } from "./repasse-dados.js";
import { openImport } from "./repasse-import.js";
import { procurarRepetido, pedirAluno, painelPedidos, indexarFones } from "./pedidos.js";
// Assumir o contato: quem não é admin só assume o que está sem responsável (ou já é seu)
const assumir = it => (!C.isAdmin && it.respEmail && it.respEmail !== C.email ? {} : { resp: C.me, respEmail: C.email || "" });

let C, FS, db, col;
let tab = "hoje",
  seg = "lf",
  items = [],
  unsubList = null,
  mounted = false,
  meta = { escolas: {}, anos: {} };
const ANO = () => new Date().getFullYear();
const ANO_MIN = 2015;
// Em qual frente o formando está. Sem ano (incompleto) aparece nas duas.
function segDe(it) {
  return !it.ano ? null : it.ano >= ANO() ? "lf" : "rep";
}
function noSeg(it) {
  const s0 = segDe(it);
  return !s0 || s0 === seg;
}
const segNome = s0 => (s0 === "lf" ? "Linha de Frente " + ANO() : "Repasse");
// Quem só tem a Linha de Frente só pode ler ensaios do ano atual (as regras do Firebase também exigem isso),
// então as buscas da Linha de Frente sempre filtram pelo ano.
const segsPermitidas = () => ["lf", "rep"].filter(k => C.pode(k));
const baseLF = () => [FS.where("ano", "==", ANO())];
const $ = id => document.getElementById(id);

export const ETAPAS = ["INCOMPLETO", "NA FILA", "SEPARADO", "CONTATADO", "INTERESSADO", "PAGO", "ENTREGUE", "NÃO QUER", "SEM CONTATO"];
const ABERTAS = ["SEPARADO", "CONTATADO", "INTERESSADO"];

// ---------- utilidades ----------
function eu() {
  const f = U.first(C.me);
  return f ? (/a$/i.test(f) ? "a " : "o ") + f : "a equipe";
}
function precoTxt(it) {
  const P = C.P;
  if (it ? segDe(it) === "lf" : seg === "lf") return P.lfPix ? U.money(P.lfPix) : P.kitPreco ? U.money(P.kitPreco) : "[valor do kit]";
  if (P.kitPromo) return U.money(P.kitPromo);
  if (P.kitPreco) return U.money(P.kitPreco);
  return "[valor do kit]";
}
function ofertaTxt(it) {
  const P = C.P;
  if (segDe(it) === "lf") {
    const pix = P.lfPix || P.kitPreco;
    if (!pix) return "Tudo por [valor do kit]";
    return (
      `${U.money(pix)} no Pix` + (P.lfCartao ? ` ou ${U.money(P.lfCartao)} no cartão${parcDe(it) ? ` (até ${parcDe(it)}x)` : ""}` : "")
    );
  }
  const pix = P.kitPromo || P.kitPreco;
  if (!pix) return "Tudo por [valor do kit]";
  let t =
    P.kitPreco && P.kitPromo && P.kitPreco > P.kitPromo
      ? `De ${U.money(P.kitPreco)} por apenas ${U.money(P.kitPromo)} no Pix`
      : `Tudo por ${U.money(pix)} no Pix`;
  if (P.kitCartao) t += ` ou ${U.money(P.kitCartao)} no cartão${P.parcelas ? ` (até ${P.parcelas}x)` : ""}`;
  return t;
}
// Prazo da última oferta: a próxima sexta que esteja a pelo menos 3 dias de hoje.
// Parcelas no cartão: a Linha de Frente tem o seu próprio número.
function parcDe(it) {
  return it && segDe(it) === "lf" && C.P.lfParcelas ? C.P.lfParcelas : C.P.parcelas;
}
function sextaTxt() {
  const d = new Date();
  let add = (5 - d.getDay() + 7) % 7;
  if (add < 3) add += 7;
  d.setDate(d.getDate() + add);
  return U.pad(d.getDate()) + "/" + U.pad(d.getMonth() + 1);
}
function entregaTxt() {
  return C.P.entrega || "em casa ou para retirada no estúdio";
}
function status(it) {
  if (it.etapa === "PAGO" || it.etapa === "ENTREGUE") return "won";
  if (!ABERTAS.includes(it.etapa) || !it.followup) return "none";
  const t = U.todayStr();
  return it.followup < t ? "late" : it.followup === t ? "today" : "later";
}
function lockInfo(it) {
  const a = it.atendendo;
  if (!a || !a.por || !a.desde) return null;
  const mins = (Date.now() - Date.parse(a.desde)) / 60000;
  if (!(mins >= 0 && mins <= 30)) return null;
  return { por: a.por, desde: a.desde, mine: a.por === C.me };
}
function contatoPadrao(it) {
  const cs = it.contatos || [];
  return cs.find(c => c.tipo === "Mãe") || cs.find(c => c.tipo === "Pai") || cs.find(c => c.tipo === "Formando") || cs[0] || null;
}

// ---------- mensagens prontas ----------
function passo(it, c) {
  const F = U.first(title(it.nome));
  const cn = c && c.nome ? U.first(title(c.nome)) : "";
  const oi = cn ? `Olá, ${cn}!` : "Olá!";
  const souEu = `Aqui é ${eu()}, do ${ESTUDIO.nome} 📸`;
  const quem = c && c.tipo === "Formando" ? "o seu ensaio de formatura" : `o ensaio de formatura de ${F}`;
  const onde = segDe(it) === "lf" ? title(it.escola) + ", este ano" : [title(it.escola), it.ano].filter(Boolean).join(", ");
  const t = it.tentativas || 0;
  const encerra = {
    title: "Encerrar com elegância",
    msg: `${cn || "Tudo bem"}, vou entender que agora não é o momento e não vou mais te incomodar. Se um dia quiser o quadro ${c && c.tipo === "Formando" ? "da sua formatura" : "de " + F}, é só me chamar aqui! 💛`,
    then: { etapa: "NÃO QUER", days: -1 }
  };
  switch (it.etapa) {
    case "SEPARADO":
      return {
        title: "1º contato: pedir para mandar a prévia",
        msg: `${oi} Tudo bem? ${souEu}\nNós fizemos ${quem} no colégio${onde ? " (" + onde + ")" : ""}, e as fotos ficaram lindas!\nO Kit Recordação ${c && c.tipo === "Formando" ? "com as suas fotos" : "de " + F} já está pronto aqui no estúdio: quadro 30x40 com moldura preta, 2 porta-retratos e as fotos digitais. Posso te mandar uma foto de como ficou? 😊`,
        then: { etapa: "CONTATADO", days: 2, count: true }
      };
    case "CONTATADO":
      if (t <= 1)
        return {
          title: "2º contato: lembrar com carinho",
          msg: `Oi${cn ? ", " + cn : ""}! Passando só para saber se você viu minha mensagem sobre as fotos do ensaio de formatura${c && c.tipo === "Formando" ? "" : " de " + F} 😊 Posso te mandar a prévia do quadro?`,
          then: { etapa: "CONTATADO", days: 3, count: true }
        };
      return encerra;
    case "INTERESSADO": {
      const tI = it.tentInteresse || 0;
      if (tI === 0) {
        return {
          title: "Mandar a prévia e o preço",
          mockup: true,
          msg: `Olha como fica o Kit Recordação ${c && c.tipo === "Formando" ? "do seu ensaio" : "de " + F}! 😍\n• Quadro 30x40 com moldura preta\n• 2 porta-retratos 15x10\n• As fotos digitais do ensaio\nJá está pronto, é só combinar a entrega! ${ofertaTxt(it)}.\nEntregamos ${entregaTxt()}. Quer que eu separe o seu?`,
          then: { etapa: "INTERESSADO", days: 2, countI: true }
        };
      }
      if (tI === 1)
        return C.P.kitFinal && segDe(it) === "rep"
          ? {
              title: "Última condição (só para quem já viu a prévia)",
              msg: `Oi${cn ? ", " + cn : ""}! Estamos organizando os kits que ainda estão aqui no estúdio e consegui uma condição especial para o ${c && c.tipo === "Formando" ? "seu kit" : "kit de " + F}: ${U.money(C.P.kitFinal)} no Pix${C.P.linkCartaoFinal ? ` ou no cartão${C.P.parcelas ? ` (até ${C.P.parcelas}x)` : ""}` : ""}, válida até ${sextaTxt()}. Depois disso volta ao valor normal. Quer que eu separe? 😊`,
              then: { etapa: "INTERESSADO", days: 3, countI: true }
            }
          : {
              title: "Follow-up da prévia",
              msg: `Oi${cn ? ", " + cn : ""}! Conseguiu ver a prévia do quadro? Se quiser, separo o seu hoje e já combinamos a entrega 😊`,
              then: { etapa: "INTERESSADO", days: 3, countI: true }
            };
      return encerra;
    }
    case "PAGO":
      if (!it.entregaTipo || it.entregaTipo.startsWith("A combinar"))
        return {
          title: "Perguntar como prefere receber",
          msg: `${cn || "Oi"}, pagamento confirmado, muito obrigado! 💛 Como você prefere receber o kit ${c && c.tipo === "Formando" ? "" : "de " + F + " "}?\n1️⃣ Entregamos na sua casa (me confirma o endereço completo)\n2️⃣ Você retira aqui no estúdio, no dia e horário que for melhor (${ESTUDIO.endereco}, ${ESTUDIO.horario})`,
          then: null
        };
      if ((it.entregaTipo || "").startsWith("Retirada")) {
        if (it.entregaData) return null;
        return {
          title: "Agendar a retirada no estúdio",
          msg: `${cn || "Oi"}, pagamento confirmado, muito obrigado! 💛 O kit ${c && c.tipo === "Formando" ? "" : "de " + F + " "}fica pronto em poucos dias. Qual dia e horário fica melhor para você retirar aqui no estúdio? Estamos na ${ESTUDIO.endereco} (${ESTUDIO.horario}).`,
          then: null
        };
      }
      if (it.enderecoConfirmado) return null;
      return {
        title: "Confirmar o endereço de entrega",
        msg: `${cn || "Oi"}, pagamento confirmado, muito obrigado! 💛 Para a entrega do kit, me confirma o endereço completo? Rua, número, complemento, bairro, cidade e um ponto de referência.${it.endereco && it.endereco.rua ? "\nNo nosso cadastro está: " + [title(it.endereco.rua) + (it.endereco.numero ? ", " + it.endereco.numero : ""), title(it.endereco.bairro), title(it.endereco.cidade)].filter(Boolean).join(" · ") + ". Continua esse?" : ""}`,
        then: null
      };
    case "ENTREGUE":
      return {
        title: "Pós-venda: foto na parede e indicação",
        msg: `${cn || "Oi"}, o kit ${c && c.tipo === "Formando" ? "" : "de " + F + " "}chegou direitinho? 💛 Se puder, manda uma foto do quadro na parede, vamos amar ver! E se alguém da família ou algum amigo também se formou, me indica?`,
        then: null
      };
    default:
      return null;
  }
}

// ---------- gravação ----------
async function save(it, patch, msg) {
  try {
    patch.atualizadoEm = new Date().toISOString();
    await FS.updateDoc(FS.doc(db, "repasse", it.id), patch);
    Object.assign(it, patch);
    if (tab === "buscar") renderList();
    U.toast(msg || "Salvo");
  } catch (e) {
    C.handleErr(e);
  }
}
function claim(it) {
  if (!C.me) return;
  const li = lockInfo(it);
  if (li && li.mine) return;
  save(
    it,
    { atendendo: { por: C.me, desde: new Date().toISOString() } },
    "O outro aparelho vai ver: " + U.first(C.me) + " está respondendo"
  );
}

// ---------- tela ----------
export function init(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
  col = FS.collection(db, "repasse");
  try {
    seg = localStorage.getItem("z7seg") || "lf";
  } catch (_) {}
}

export function show() {
  if (!mounted) mount();
  const ok = segsPermitidas();
  if (!ok.includes(seg)) seg = ok[0] || "lf";
  renderSegs();
  loadMeta().then(refreshStats);
  refreshLote();
  openTab(tab);
}

function mount() {
  mounted = true;
  const v = $("viewRepasse");
  v.innerHTML = "";
  const head = el("div", "vhead");
  head.append(el("h2", null, "PR"));
  const hb = el("div", "quick");
  hb.append(U.mkBtn("+ Aluno", "btn-primary", () => openDados(null)));
  hb.append(U.mkBtn("🖼️ Prévia e fotos", "", () => openMockup({ preco: precoTxt(), toast: U.toast })));
  const imp = U.mkBtn("Importar planilha", "", () => openImport(C, { sheet, field, actions, meta }, () => (loadMeta(), refreshStats())));
  imp.id = "rImport";
  imp.hidden = !C.isAdmin;
  hb.append(imp);
  head.append(hb);
  v.append(head);

  const segs = el("div", "segs");
  segs.id = "rSegs";
  segs.setAttribute("role", "tablist");
  v.append(segs);
  const g = el("details", "guide");
  g.id = "rGuide";
  g.innerHTML = `<summary>Como funciona o PR</summary><ol>
    <li><b>Linha de Frente</b> são os ensaios deste ano; <b>Repasse</b> são os dos anos anteriores. Em 1º de janeiro tudo vira sozinho: a Linha de Frente do ano que acabou passa para o Repasse.</li>
    <li><b>Separe o seu lote do dia</b> no quadro abaixo. O app não trava: separa 10 por vez e avisa quando você passar de 25 no dia na Linha de Frente ou de 20 no Repasse (os números mudam em ⚙️ Ajustes), para o WhatsApp não bloquear o número.</li>
    <li>Cada cartão mostra <b>para quem mandar</b> (mãe, pai ou formando) e a mensagem pronta. O 1º contato só pede permissão para mandar a prévia.</li>
    <li>Respondeu que quer ver? Toque em <b>Quer ver a prévia</b>, depois em <b>🖼️ Prévia</b>: arraste a foto do formando e o app monta o kit pronto para enviar.</li>
    <li><b>Pagou?</b> Toque em <b>Pagou</b>. O cartão pede para <b>confirmar o endereço</b> (ou agendar a retirada no estúdio) e vai para <b>Entregas</b>, separado por cidade e bairro para montar a rota.</li>
    <li>Cada frente tem o <b>seu próprio número de WhatsApp</b> e o seu aviso de contatos por dia (em ⚙️ Ajustes). Nunca use o número do funil.</li></ol>`;
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
    <div class="quick"><select id="rLoteEscola" aria-label="Escola do lote"><option value="">Turmas mais recentes primeiro</option></select>
    <button class="btn btn-primary btn-sm" id="rLoteBtn" type="button">Separar contatos</button></div>`;
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
  busca.innerHTML = `<input class="search" id="rQ" type="search" placeholder="Nome do formando ou telefone" aria-label="Buscar no repasse">
    <select class="search" id="rEscola" aria-label="Filtrar por escola"><option value="">Ou escolha uma escola…</option></select>`;
  v.append(busca);

  const list = el("section", "grid");
  list.id = "rList";
  list.setAttribute("aria-live", "polite");
  v.append(list);

  $("rLoteBtn").onclick = separarLote;
  let tq;
  $("rQ").addEventListener("input", () => {
    clearTimeout(tq);
    tq = setTimeout(buscar, 400);
  });
  $("rEscola").addEventListener("change", buscar);
  try {
    if (!localStorage.getItem("z7rguide")) g.open = true;
    g.addEventListener("toggle", () => {
      try {
        localStorage.setItem("z7rguide", "1");
      } catch (_) {}
    });
  } catch (_) {}
}

function renderSegs() {
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
        seg = k;
        try {
          localStorage.setItem("z7seg", k);
        } catch (_) {}
        renderSegs();
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
  tabs.forEach(([k, t]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(tab === k));
    b.onclick = () => openTab(k);
    c.append(b);
  });
}

function openTab(k) {
  tab = k;
  renderChips();
  $("rBusca").hidden = k !== "buscar";
  if (unsubList) {
    unsubList();
    unsubList = null;
  }
  items = [];
  renderList(true);
  const today = U.todayStr();
  let q = null;
  if (seg === "lf") {
    if (k === "hoje") q = FS.query(col, ...baseLF(), FS.where("etapa", "in", [...ABERTAS, "ENTREGUE"]), FS.limit(300));
    if (k === "interessados") q = FS.query(col, ...baseLF(), FS.where("etapa", "==", "INTERESSADO"), FS.limit(200));
    if (k === "entregas") q = FS.query(col, ...baseLF(), FS.where("etapa", "==", "PAGO"), FS.limit(300));
  } else {
    if (k === "hoje") q = FS.query(col, FS.where("followup", "<=", today), FS.orderBy("followup"), FS.limit(150));
    if (k === "interessados") q = FS.query(col, FS.where("etapa", "==", "INTERESSADO"), FS.limit(200));
    if (k === "entregas") q = FS.query(col, FS.where("etapa", "==", "PAGO"), FS.limit(300));
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
  if (k === "conferir") q = FS.query(col, FS.where("conferido", "==", false), FS.limit(300));
  if (q)
    unsubList = FS.onSnapshot(
      q,
      snap => {
        items = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
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
async function buscar() {
  if (tab !== "buscar") return;
  const txt = $("rQ").value.trim(),
    esc = $("rEscola").value;
  if (!C.pode("rep")) {
    // Só Linha de Frente: carrega os ensaios do ano (uma vez a cada 10 min) e filtra aqui.
    if (!txt && !esc) {
      items = [];
      renderList(false, "Digite pelo menos 2 letras do nome, um telefone, ou escolha uma escola.");
      return;
    }
    try {
      if (Date.now() - cacheLF.at > 600000) {
        const s0 = await FS.getDocs(FS.query(col, ...baseLF(), FS.limit(3000)));
        cacheLF = { at: Date.now(), docs: s0.docs.map(d => Object.assign({ id: d.id }, d.data())) };
      }
      const n = norm(txt),
        dg = txt.replace(/\D/g, "");
      items = cacheLF.docs
        .filter(
          it =>
            (!esc || it.escola === esc) &&
            (!txt || (dg.length >= 8 ? (it.telefones || []).some(t => t.includes(dg.slice(-8))) : (it.nomeBusca || "").includes(n)))
        )
        .slice(0, 100)
        .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
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
  else if (txt.length >= 2) {
    const n = norm(txt);
    q = FS.query(col, FS.orderBy("nomeBusca"), FS.startAt(n), FS.endAt(n + ""), FS.limit(30));
  } else if (esc) q = FS.query(col, FS.where("escola", "==", esc), FS.limit(500));
  if (!q) {
    items = [];
    renderList(false, "Digite pelo menos 2 letras do nome, um telefone, ou escolha uma escola.");
    return;
  }
  try {
    const s = await FS.getDocs(q);
    items = s.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    renderList();
  } catch (e) {
    console.warn(e);
    U.toast("Não foi possível buscar agora.");
  }
}

function renderList(loading, emptyMsg) {
  const list = $("rList");
  list.innerHTML = "";
  if (loading) {
    const e = el("div", "empty");
    e.style.gridColumn = "1/-1";
    e.append(el("strong", null, "Carregando…"));
    list.append(e);
    return;
  }
  let arr = tab === "buscar" ? items.slice() : items.filter(noSeg);
  if (tab === "hoje") {
    const t0 = U.todayStr();
    arr = arr.filter(it => (ABERTAS.includes(it.etapa) || it.etapa === "ENTREGUE") && it.followup && it.followup <= t0);
  }
  if (!arr.length) {
    const e = el("div", "empty");
    e.style.gridColumn = "1/-1";
    const msgs = {
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

function card(it) {
  const s = status(it);
  const e = el("article", "card " + (["late", "today", "won"].includes(s) ? s : ""));
  const top = el("div", "card-top");
  top.append(el("h3", "name", title(it.nome) || "Sem nome"), el("span", "stage", it.etapa));
  e.append(top);

  const meta = el("div", "meta");
  [
    [tab === "buscar" && segDe(it) ? segNome(segDe(it)) : "", "svc"],
    [C.nomeDe(it) ? "👤 " + U.first(C.nomeDe(it)) : "", ""],
    [title(it.escola), "svc"],
    [[it.curso, it.turma].filter(Boolean).join(" · "), ""],
    [it.ano ? String(it.ano) : "", ""],
    [it.valor ? U.money(it.valor) : "", ""]
  ].forEach(([v, c]) => {
    if (v) meta.append(el("span", "tag " + c, v));
  });
  e.append(meta);

  // Para quem mandar
  const cs = it.contatos || [];
  let escolhido = contatoPadrao(it);
  const quem = el("div", "quem");
  const ns0 = passo(it, escolhido);
  if (cs.length > 1 && ns0) {
    quem.append(el("small", null, "Mandar para:"));
    cs.forEach(c => {
      const b = el("button", "chip chip-sm", `${c.tipo}${c.nome ? " (" + U.first(title(c.nome)) + ")" : ""}`);
      b.type = "button";
      b.setAttribute("aria-pressed", String(c === escolhido));
      b.onclick = () => {
        escolhido = c;
        quem.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        paintNext();
      };
      quem.append(b);
    });
    e.append(quem);
  }
  const tels = el("div", "phone");
  tels.textContent = cs.map(c => `${c.tipo}: ${c.tel}`).join(" · ") || "Sem telefone";
  e.append(tels);

  if (it.etapa === "INCOMPLETO") e.append(el("p", "wait", "Falta: " + (faltando(it).join(", ") || "conferir dados")));
  const fu = el("div", "fu " + (s === "late" ? "late" : s === "today" ? "today" : it.followup ? "" : "none"));
  fu.textContent = situacaoTxt(it, s);
  e.append(fu);
  const end = enderecoTxt(it);
  if (end) e.append(el("p", "notes", "📍 " + end));
  const nt = [it.notas, it.obs && it.obs !== "-" ? "Planilha: " + it.obs : ""].filter(Boolean).join("\n");
  if (nt) e.append(el("p", "notes", nt));
  if (it.ultimo && it.ultimo.em)
    e.append(
      el(
        "div",
        "last",
        "Último contato: " +
          (U.first(it.ultimo.por) || "—") +
          " · " +
          U.fmtDate(U.ds(new Date(it.ultimo.em))) +
          " às " +
          U.hhmm(it.ultimo.em)
      )
    );

  const li = lockInfo(it);
  if (li) e.append(travaDoCartao(it, li));
  const blocked = li && !li.mine;

  const box = el("div", "next");
  e.append(box);
  const paintNext = () => desenharProximo(box, it, escolhido, blocked, li);
  paintNext();

  e.append(acoesDoCartao(it, li, e));
  return e;
}

// Próximo passo do contato: a mensagem pronta para quem foi escolhido e os botões de enviar
function desenharProximo(box, it, escolhido, blocked, li) {
  const F0 = U.first(title(it.nome));
  box.innerHTML = "";
  const ns = passo(it, escolhido);
  if (!ns) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const msg = el("p", null, ns.msg);
  box.append(el("small", null, "Próximo passo: " + ns.title), msg);
  if (blocked) {
    box.append(el("p", "wait", "Espere " + U.first(li.por) + " terminar, ou toque em “Assumir mesmo assim”."));
    return;
  }
  const row = el("div", "row");
  const d = escolhido ? U.digits(escolhido.tel) : "";
  if (d) {
    const a = el("a", "btn btn-sm btn-primary", "Abrir no WhatsApp");
    a.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(ns.msg);
    a.target = "_blank";
    a.rel = "noopener";
    a.addEventListener("click", () => claim(it));
    row.append(a);
  }
  row.append(
    U.mkBtn("Copiar texto", "", async () => {
      claim(it);
      try {
        await navigator.clipboard.writeText(ns.msg);
        U.toast("Texto copiado");
      } catch (_) {
        const r = document.createRange();
        r.selectNodeContents(msg);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        U.toast("Texto selecionado, copie com o dedo");
      }
    })
  );
  if (ns.mockup || it.etapa === "INTERESSADO")
    row.append(
      U.mkBtn("🖼️ Prévia", "", () => openMockup({ nome: title(it.nome), escola: title(it.escola), preco: precoTxt(it), toast: U.toast }))
    );
  if (it.etapa === "INTERESSADO")
    row.append(
      U.mkBtn("📷 Fotos para escolher", "", () =>
        openMockup({ nome: title(it.nome), escola: title(it.escola), preco: precoTxt(it), modo: "escolha" })
      )
    );
  if (it.etapa === "INTERESSADO" && d) {
    const a3 = el("a", "btn btn-sm", "✍️ Pedir a escolha");
    a3.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(textoEscolha(F0));
    a3.target = "_blank";
    a3.rel = "noopener";
    row.append(a3);
  }
  // Depois que a última oferta foi enviada (Repasse), o link do cartão passa a ser o da última oferta.
  const ultimaOferta = segDe(it) === "rep" && C.P.kitFinal && (it.tentInteresse || 0) >= 2;
  const ultima = ultimaOferta && C.P.linkCartaoFinal;
  // Pix Copia e Cola com o valor certo para o momento da conversa
  const pixCod = segDe(it) === "lf" ? C.P.pixLF : ultimaOferta ? C.P.pixFinal : C.P.pixRep;
  const pixVal = segDe(it) === "lf" ? C.P.lfPix || C.P.kitPreco : ultimaOferta ? C.P.kitFinal : C.P.kitPromo || C.P.kitPreco;
  const link = ultima ? C.P.linkCartaoFinal : segDe(it) === "lf" ? C.P.linkCartaoLF || C.P.linkCartao : C.P.linkCartao;
  const valCartao = ultima ? C.P.kitFinal : segDe(it) === "lf" ? C.P.lfCartao : C.P.kitCartao;
  if (it.etapa === "INTERESSADO" && link && d) {
    const pc = parcDe(it);
    const lm = `Para pagar no cartão${valCartao ? ` (${U.money(valCartao)}` + (pc ? `, em até ${pc}x sem juros)` : ")") : pc ? ` (em até ${pc}x sem juros)` : ""}, é só usar este link seguro da InfinitePay:\n${link}\nDepois me manda o comprovante por aqui 😊${pixCod ? " Se preferir Pix, é só me avisar que te mando o código." : C.P.pix ? ` No Pix${pixVal ? ` (${U.money(pixVal)})` : ""}, a chave é ${C.P.pix}.` : ""}`;
    const a2 = el("a", "btn btn-sm", ultima ? "💳 Link da última oferta" : "💳 Mandar link de pagamento");
    a2.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(lm);
    a2.target = "_blank";
    a2.rel = "noopener";
    row.append(a2);
  }
  if (it.etapa === "INTERESSADO" && pixCod && d) {
    const pm = `Para pagar no Pix${pixVal ? ` (${U.money(pixVal)})` : ""}: abra o app do seu banco, escolha *Pix Copia e Cola* e cole o código que vou mandar na próxima mensagem 👇 Depois me manda o comprovante por aqui 😊`;
    const a4 = el("a", "btn btn-sm", `💠 Pix ${pixVal ? U.money(pixVal) : ""}`.trim());
    a4.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(pm);
    a4.target = "_blank";
    a4.rel = "noopener";
    row.append(a4);
    const a5 = el("a", "btn btn-sm", "📋 Código Pix");
    a5.title = "Manda só o código, para o cliente copiar fácil";
    a5.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(pixCod);
    a5.target = "_blank";
    a5.rel = "noopener";
    row.append(a5);
  }
  if (ns.then)
    row.append(
      U.mkBtn("Enviei ✓", "btn-ok", () => {
        const p = {
          etapa: ns.then.etapa,
          followup: ns.then.days < 0 ? null : U.addDays(ns.then.days),
          atendendo: null,
          ultimo: { por: C.me || "—", em: new Date().toISOString(), para: escolhido ? escolhido.tipo : "" }
        };
        if (ns.then.count) p.tentativas = (it.tentativas || 0) + 1;
        if (ns.then.countI) p.tentInteresse = (it.tentInteresse || 0) + 1;
        if (!it.resp && !it.respEmail && C.me) Object.assign(p, assumir(it));
        save(it, p, p.etapa === "NÃO QUER" ? "Contato encerrado" : "Próximo contato em " + U.fmtDate(p.followup));
      })
    );
  box.append(row);
}
// Quem está respondendo este contato agora (evita duas pessoas mandando mensagem para a mesma família)
function travaDoCartao(it, li) {
  const lk = el("div", "lock " + (li.mine ? "mine" : "other"));
  lk.append(
    el(
      "span",
      null,
      li.mine
        ? "✋ Você está respondendo (desde " + U.hhmm(li.desde) + ")"
        : "⚠️ " + U.first(li.por) + " está respondendo desde " + U.hhmm(li.desde)
    )
  );
  lk.append(
    li.mine
      ? U.mkBtn("Liberar", "", () => save(it, { atendendo: null }, "Cartão liberado"))
      : U.mkBtn("Assumir mesmo assim", "", () =>
          save(it, { atendendo: { por: C.me, desde: new Date().toISOString() } }, "Agora você está respondendo")
        )
  );
  return lk;
}
// Botões do cartão conforme a etapa (e: o cartão, para o aviso de venda a conferir)
function acoesDoCartao(it, li, e) {
  const act = el("div", "actions");
  if (it.etapa === "INCOMPLETO" || C.isAdmin)
    act.append(
      U.mkBtn(it.etapa === "INCOMPLETO" ? "Completar dados" : "Editar dados", it.etapa === "INCOMPLETO" ? "btn-primary" : "", () =>
        openDados(it)
      )
    );
  if (it.etapa === "NA FILA")
    act.append(
      U.mkBtn("Separar para mim", "btn-primary", () =>
        save(
          it,
          { etapa: "SEPARADO", ...assumir(it), separadoEm: U.todayStr(), separadoSeg: segDe(it) || seg, followup: U.todayStr() },
          "Separado para hoje"
        )
      )
    );
  if (ABERTAS.includes(it.etapa) && !li) act.append(U.mkBtn("✋ Estou respondendo", "", () => claim(it)));
  if (it.etapa === "SEPARADO" || it.etapa === "CONTATADO")
    act.append(
      U.mkBtn("Quer ver a prévia ✓", "btn-ok", () =>
        save(it, { etapa: "INTERESSADO", followup: U.todayStr(), tentInteresse: 0 }, "Ótimo! Agora mande a prévia")
      )
    );
  if (ABERTAS.includes(it.etapa)) {
    act.append(U.mkBtn("Pagou 💰", "btn-ok", () => openPago(it)));
    act.append(U.mkBtn("Remarcar +1d", "", () => save(it, { followup: U.addDays(1) }, "Remarcado para " + U.fmtDate(U.addDays(1)))));
    act.append(U.mkBtn("Não quer", "", () => save(it, { etapa: "NÃO QUER", followup: null, atendendo: null }, "Contato encerrado")));
    act.append(
      U.mkBtn("Número errado", "", () => save(it, { etapa: "SEM CONTATO", followup: null, atendendo: null }, "Marcado como sem contato"))
    );
  }
  if ((it.etapa === "PAGO" || it.etapa === "ENTREGUE") && it.conferido === false) {
    e.append(
      el(
        "p",
        "wait",
        `⏳ Venda a conferir: ${U.money(it.valor)} · ${it.formaPag || ""}${it.valorForaTabela ? " · valor fora da tabela" : ""}${it.comprovante ? " · " + it.comprovante : ""}`
      )
    );
    if (C.isAdmin)
      act.append(
        U.mkBtn("✔ Conferir venda", "btn-verde", () =>
          save(it, { conferido: true, conferidoPor: C.email || "", conferidoEm: U.todayStr() }, "Venda conferida ✔")
        )
      );
  }
  if (it.etapa === "PAGO") act.append(U.mkBtn("📍 Endereço e data", "", () => openEntrega(it)));
  if (it.etapa === "PAGO")
    act.append(
      U.mkBtn("Entregue ✓", "btn-ok", () =>
        save(it, { etapa: "ENTREGUE", entregueEm: U.todayStr(), followup: U.addDays(2) }, "Entrega registrada 🎉")
      )
    );
  if (["NÃO QUER", "SEM CONTATO"].includes(it.etapa))
    act.append(
      U.mkBtn("Reabrir", "", () =>
        save(it, { etapa: "SEPARADO", followup: U.todayStr(), tentativas: 0, tentInteresse: 0, ...assumir(it) }, "Contato reaberto")
      )
    );
  if (it.etapa === "ENTREGUE" && it.followup) act.append(U.mkBtn("Concluir", "", () => save(it, { followup: null }, "Concluído")));
  act.append(U.mkBtn("Notas", "", () => openNotas(it)));
  return act;
}

// ---------- janelinhas (pagou / notas) ----------
function sheet(titleTxt, build) {
  const sh = el("div", "sheet");
  const p = el("form", "panel");
  p.autocomplete = "off";
  p.append(el("h2", null, titleTxt));
  sh.append(p);
  const close = () => sh.remove();
  sh.addEventListener("click", ev => {
    if (ev.target === sh) close();
  });
  build(p, close);
  document.body.append(sh);
  const f = p.querySelector("input,textarea,select");
  if (f) setTimeout(() => f.focus(), 30);
  return close;
}
function field(lbl, inp) {
  const f = el("div", "field");
  const l = el("label", null, lbl);
  inp.id = "x" + Math.random().toString(36).slice(2, 8);
  l.htmlFor = inp.id;
  f.append(l, inp);
  return f;
}
function actions(close, okTxt) {
  const a = el("div", "panel-actions");
  a.append(el("span"));
  a.lastChild.style.flex = "1";
  const c = U.mkBtn("Cancelar", "", close);
  c.classList.remove("btn-sm");
  const ok = el("button", "btn btn-primary", okTxt);
  ok.type = "submit";
  a.append(c, ok);
  return a;
}

function openPago(it) {
  sheet("Registrar venda", (p, close) => {
    p.append(el("p", "hint", title(it.nome) + " · " + title(it.escola)));
    // Valor sai da tabela de preços (Ajustes); "outro valor" fica marcado para conferência
    const P = C.P,
      lf = segDe(it) === "lf";
    const tabela = (
      lf
        ? [
            ["Pix", P.lfPix],
            ["Cartão", P.lfCartao]
          ]
        : [
            ["Pix", P.kitPromo || P.kitPreco],
            ["Cartão", P.kitCartao],
            ["Última oferta", P.kitFinal],
            ["Preço cheio", P.kitPreco]
          ]
    )
      .filter(([, x]) => Number(x))
      .map(([t, x]) => [String(x), `${U.money(x)} · ${t}`]);
    const vs = el("select");
    [...tabela, ["outro", "Outro valor…"]].forEach(([val, t]) => {
      const o = el("option", null, t);
      o.value = val;
      vs.append(o);
    });
    const sugerido = String(
      it.valor || (lf ? P.lfPix || P.kitPreco : (it.tentInteresse >= 2 && P.kitFinal) || P.kitPromo || P.kitPreco) || ""
    );
    vs.value = tabela.some(([x]) => x === sugerido) ? sugerido : tabela[0] ? tabela[0][0] : "outro";
    const v = el("input");
    v.inputMode = "decimal";
    v.placeholder = "R$";
    v.hidden = vs.value !== "outro";
    vs.onchange = () => {
      v.hidden = vs.value !== "outro";
      if (!v.hidden) v.focus();
    };
    const fp = el("select");
    ["Pix", "Cartão", "Link", "Recorrente", "Dinheiro", "Boleto", "Outro"].forEach(x => {
      const o = el("option", null, x);
      o.value = x;
      fp.append(o);
    });
    const vbox = el("div");
    vbox.append(vs, v);
    const r = el("div", "row2");
    r.append(field("Valor", vbox), field("Pagamento", fp));
    p.append(r);
    const comp = el("input");
    comp.maxLength = 120;
    comp.placeholder = "ex.: Pix de Maria às 14h, ou nº do comprovante";
    p.append(field("Comprovante", comp));
    if (!C.isAdmin)
      p.append(
        el("p", "hint", "A venda entra como “a conferir”. A comissão conta depois que o Adriano ou a Luciana conferem o comprovante.")
      );
    p.append(entregaCampos(p, it));
    p.append(actions(close, "Salvar venda"));
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      const valor = vs.value === "outro" ? U.num(v.value) : Number(vs.value);
      if (!valor) {
        v.hidden = false;
        v.focus();
        return;
      }
      close();
      save(
        it,
        Object.assign(
          {
            etapa: "PAGO",
            valor,
            formaPag: fp.value,
            comprovante: comp.value.trim(),
            valorForaTabela: vs.value === "outro",
            conferido: !!C.isAdmin,
            ...(C.isAdmin ? { conferidoPor: C.email || "", conferidoEm: U.todayStr() } : {}),
            pagoEm: U.todayStr(),
            followup: null,
            atendendo: null,
            ...(it.resp || it.respEmail ? {} : assumir(it))
          },
          p._entrega()
        ),
        C.isAdmin ? "Venda registrada 🎉" : "Venda registrada 🎉 · aguardando conferência"
      );
    });
  });
}
function openEntrega(it) {
  sheet("Entrega", (p, close) => {
    p.append(el("p", "hint", title(it.nome)));
    p.append(entregaCampos(p, it), actions(close, "Salvar"));
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      close();
      save(it, p._entrega(), "Entrega atualizada");
    });
  });
}
// Campos de entrega: tipo, data agendada e endereço (vem da planilha, mas precisa ser confirmado com o cliente).
function entregaCampos(p, it) {
  const box = el("div", "imp");
  const en = el("select");
  ["A combinar com o cliente", "Entrega em casa", "Retirada no estúdio (agendada)"].forEach(x => {
    const o = el("option", null, x);
    o.value = x;
    en.append(o);
  });
  if (it.entregaTipo)
    en.value = it.entregaTipo.startsWith("Retirada")
      ? "Retirada no estúdio (agendada)"
      : it.entregaTipo.startsWith("A combinar")
        ? "A combinar com o cliente"
        : "Entrega em casa";
  const dt = el("input");
  dt.type = "date";
  dt.value = it.entregaData || "";
  const r1 = el("div", "row2");
  r1.append(field("Entrega", en), field("Data combinada (se já tiver)", dt));
  box.append(r1);
  const a = it.endereco || {};
  const mk = (val, ph) => {
    const i = el("input");
    i.value = val || "";
    i.placeholder = ph || "";
    i.maxLength = 120;
    return i;
  };
  const rua = mk(title(a.rua)),
    num = mk(a.numero),
    comp = mk(title(a.complemento)),
    bai = mk(title(a.bairro)),
    cid = mk(title(a.cidade)),
    ref = mk(a.referencia, "ponto de referência");
  const end = el("div", "imp");
  const r2 = el("div", "row2");
  r2.append(field("Rua", rua), field("Número", num));
  const r3 = el("div", "row2");
  r3.append(field("Complemento", comp), field("Bairro", bai));
  const r4 = el("div", "row2");
  r4.append(field("Cidade", cid), field("Referência", ref));
  const conf = el("label", "chk");
  const cc = el("input");
  cc.type = "checkbox";
  cc.checked = !!it.enderecoConfirmado;
  conf.append(cc, document.createTextNode(" Endereço confirmado com o cliente"));
  end.append(
    el("p", "hint", "O endereço da planilha pode estar desatualizado. Confirme com o cliente antes de sair para entregar."),
    r2,
    r3,
    r4,
    conf
  );
  box.append(end);
  const sync = () => {
    end.hidden = en.value !== "Entrega em casa";
  };
  en.onchange = sync;
  sync();
  p._entrega = () => {
    const casa = en.value === "Entrega em casa";
    const o = { entregaTipo: en.value, entregaData: dt.value || "" };
    if (casa) {
      o.endereco = {
        rua: rua.value.trim(),
        numero: num.value.trim(),
        complemento: comp.value.trim(),
        bairro: bai.value.trim(),
        cidade: cid.value.trim(),
        referencia: ref.value.trim()
      };
      o.enderecoConfirmado = cc.checked;
    }
    return o;
  };
  return box;
}
// Dados do formando; sem "it" = aluno novo incluído à mão (sem planilha)
function openDados(it) {
  const novo = !it;
  it = it || { nome: "", escola: "", ano: seg === "lf" ? ANO() : ANO() - 1, contatos: [] };
  sheet(novo ? "Incluir aluno no PR" : "Dados do formando", (p, close) => {
    const mk = (v, ph) => {
      const i = el("input");
      i.value = v || "";
      i.placeholder = ph || "";
      i.maxLength = 120;
      return i;
    };
    const nome = mk(title(it.nome)),
      escola = mk(title(it.escola)),
      ano = mk(it.ano || "", "2025");
    ano.inputMode = "numeric";
    const r1 = el("div", "row2");
    r1.append(field("Colégio", escola), field("Ano", ano));
    p.append(field("Nome do aluno", nome), r1);
    // colégios que já existem no PR (para escrever igual)
    const dlE = el("datalist");
    dlE.id = "rEscolas" + Date.now();
    Object.keys(meta.escolas || {}).forEach(n => {
      const o = el("option");
      o.value = title(n);
      dlE.append(o);
    });
    escola.setAttribute("list", dlE.id);
    p.append(dlE);
    let curso = null,
      turma = null;
    if (novo) {
      nome.required = true;
      curso = mk("", "ex.: Ensino Médio");
      turma = mk("", "ex.: 3001");
      const r2 = el("div", "row2");
      r2.append(field("Curso / série", curso), field("Turma", turma));
      p.append(r2);
    }
    p.append(el("h3", null, "Contatos"));
    const linhas = [];
    const lista = el("div", "imp");
    p.append(lista);
    const addLinha = (c = { tipo: "Mãe", nome: "", tel: "" }) => {
      const tp = el("select");
      ["Mãe", "Pai", "Responsável", "Formando", "Telefone", "Outro"].forEach(x => {
        const o = el("option", null, x);
        o.value = x;
        tp.append(o);
      });
      tp.value = c.tipo || "Outro";
      const nm = mk(title(c.nome), "nome");
      const tl = mk(c.tel, "21 99999-9999");
      tl.inputMode = "tel";
      const row = el("div", "row3");
      row.append(field("Quem", tp), field("Nome", nm), field("WhatsApp", tl));
      lista.append(row);
      linhas.push({ tp, nm, tl });
    };
    (it.contatos && it.contatos.length ? it.contatos : [novo ? { tipo: "Mãe" } : {}]).forEach(addLinha);
    const add = U.mkBtn("+ Adicionar contato", "", () => addLinha());
    p.append(add);
    // quem é da equipe trabalha o que cadastrou: o aluno entra direto na carteira de quem incluiu
    if (novo && !C.isAdmin)
      p.append(
        el(
          "p",
          "hint",
          "O aluno entra na sua lista (Para hoje). Se ele já estiver no PR, o Adriano ou a Luciana decidem se passa para você."
        )
      );
    const erro = el("p", "err");
    erro.hidden = true;
    p.append(erro);
    p.append(actions(close, "Salvar"));
    // aluno novo: entra na fila (ou já separado para quem incluiu), como se tivesse vindo da planilha
    async function criar(d, falta) {
      if (!d.nome) {
        erro.textContent = "Coloque o nome do aluno.";
        erro.hidden = false;
        return;
      }
      const agora = new Date().toISOString(),
        hoje = U.todayStr(),
        daEquipe = !C.isAdmin,
        meu = daEquipe && !falta.length;
      const docNovo = Object.assign(d, {
        curso: curso ? curso.value.trim() : "",
        turma: turma ? turma.value.trim() : "",
        dataEnsaio: "",
        endereco: {},
        obs: "",
        etapa: falta.length ? "INCOMPLETO" : meu ? "SEPARADO" : "NA FILA",
        followup: meu ? hoje : null,
        tentativas: 0,
        tentInteresse: 0,
        resp: daEquipe ? C.me || "" : "",
        respEmail: daEquipe ? C.email || "" : "",
        ...(meu ? { separadoEm: hoje, separadoSeg: d.ano >= ANO() ? "lf" : "rep" } : {}),
        manual: true,
        incluidoPor: C.email || "",
        importadoEm: agora,
        atualizadoEm: agora
      });
      // aluno que já está no PR: não grava por cima. A equipe manda um pedido para o admin decidir.
      const repetido = async r => {
        if (C.isAdmin) {
          const troca = (r.comparacao || {}).trocouColegio
            ? ` Atenção: parece que trocou de colégio (${title(r.escola)} → ${title(docNovo.escola)}).`
            : "";
          erro.textContent = `${title(r.nome)} já está no PR (${title(r.escola)}${r.ano ? ", " + r.ano : ""}). Procure pela busca.${troca}`;
          erro.hidden = false;
          return;
        }
        if (r.respEmail && r.respEmail === C.email) {
          erro.textContent = `${title(r.nome)} já está na sua lista. Procure pela busca.`;
          erro.hidden = false;
          return;
        }
        const aviso = await pedirAluno(C, r, docNovo);
        close();
        U.toast(aviso);
      };
      try {
        const achado = await procurarRepetido(C, docNovo);
        if (achado) return await repetido(achado);
        // cria só se ainda não existe (transação): nunca sobrescreve um aluno que já está no PR
        const ref = FS.doc(db, "repasse", docId(docNovo, Date.now()));
        const existente = await FS.runTransaction(db, async tx => {
          const s0 = await tx.get(ref);
          if (s0.exists()) return Object.assign({ id: ref.id }, s0.data());
          tx.set(ref, docNovo);
          indexarFones(FS, db, tx, ref.id, docNovo); // telefones no índice: acha a família depois, em outro ano ou colégio
          return null;
        });
        if (existente) return await repetido(existente);
        close();
        U.toast(
          falta.length
            ? "Incluído. Ainda falta: " + falta.join(", ") + (C.isAdmin ? " (aba Incompletos)" : " (aba Meus incompletos)")
            : meu
              ? "Incluído e separado para você ✅"
              : "Incluído na fila ✅"
        );
        refreshStats();
        refreshLote();
        openTab(meu ? "hoje" : falta.length ? "incompletos" : tab);
      } catch (e) {
        C.handleErr(e);
      }
    }
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      const cs = [];
      const vistos = new Set();
      linhas.forEach(({ tp, nm, tl }) => {
        const d = tl.value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
        if (d.length >= 10 && d.length <= 11 && !vistos.has(d)) {
          vistos.add(d);
          cs.push({ tipo: tp.value, nome: nm.value.trim(), tel: d });
        }
      });
      const patch = {
        nome: nome.value.trim(),
        nomeBusca: norm(nome.value),
        escola: escola.value.trim(),
        ano: Number(ano.value) || null,
        contatos: cs,
        telefones: cs.map(c => c.tel)
      };
      const falta = faltando(patch);
      if (novo) {
        // falta algo (ex.: nome da mãe)? avisa antes; tocando de novo, salva assim mesmo (vai para Incompletos)
        if (falta.length && !p._mesmoAssim) {
          p._mesmoAssim = true;
          erro.textContent = `Falta: ${falta.join(", ")}. Complete, ou toque em Salvar de novo para incluir assim mesmo (fica em Incompletos até completar).`;
          erro.hidden = false;
          return;
        }
        return criar(patch, falta);
      }
      if (it.etapa === "INCOMPLETO" || it.etapa === "NA FILA") {
        // aluno de alguém da equipe: completo, volta para a lista dessa pessoa; sem dono, vai para a fila
        const dono = it.etapa === "INCOMPLETO" && it.respEmail;
        patch.etapa = falta.length ? "INCOMPLETO" : dono ? "SEPARADO" : "NA FILA";
        if (!falta.length && dono)
          Object.assign(patch, { followup: U.todayStr(), separadoEm: it.separadoEm || U.todayStr(), separadoSeg: segDe(it) });
      }
      close();
      // telefone novo entra no índice (para achar a família depois); se falhar, não atrapalha o salvar
      const novosTels = patch.telefones.filter(t => !(it.telefones || []).includes(t));
      if (novosTels.length) {
        const b = FS.writeBatch(db);
        indexarFones(FS, db, b, it.id, Object.assign({}, it, patch, { telefones: novosTels, contatos: [] }));
        b.commit().catch(e => console.warn("[Z7] índice de telefones", e));
      }
      save(
        it,
        patch,
        falta.length
          ? "Salvo. Ainda falta: " + falta.join(", ")
          : it.etapa === "INCOMPLETO"
            ? "Completo! Entrou na fila ✅"
            : "Dados salvos"
      );
    });
  });
}
function openNotas(it) {
  sheet("Notas", (p, close) => {
    p.append(el("p", "hint", title(it.nome)));
    const t = el("textarea");
    t.rows = 4;
    t.maxLength = 1500;
    t.value = it.notas || "";
    const tel = el("input");
    tel.inputMode = "tel";
    tel.placeholder = "21 99999-9999";
    p.append(field("Anotações", t), field("Adicionar outro WhatsApp (opcional)", tel), actions(close, "Salvar"));
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      close();
      const patch = { notas: t.value.trim() };
      const d = tel.value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
      if (d.length >= 10) {
        patch.contatos = [...(it.contatos || []), { tipo: "Outro", nome: "", tel: d }];
        patch.telefones = [...new Set([...(it.telefones || []), d])];
      }
      save(it, patch, "Notas salvas");
    });
  });
}

// ---------- números do topo e lote ----------
async function refreshStats() {
  const today = U.todayStr(),
    mes = today.slice(0, 8) + "01",
    Y = ANO();
  const set = (id, v) => {
    const x = $(id);
    if (x) x.textContent = v;
  };
  try {
    const lf = seg === "lf";
    const [h, i, m] = await Promise.all(
      lf
        ? [
            FS.getDocs(FS.query(col, ...baseLF(), FS.where("etapa", "in", ABERTAS), FS.limit(300))),
            FS.getDocs(FS.query(col, ...baseLF(), FS.where("etapa", "==", "INTERESSADO"), FS.limit(300))),
            FS.getDocs(FS.query(col, ...baseLF(), FS.where("etapa", "in", ["PAGO", "ENTREGUE"]), FS.limit(1000)))
          ]
        : [
            FS.getDocs(FS.query(col, FS.where("followup", "<=", today), FS.limit(300))),
            FS.getDocs(FS.query(col, FS.where("etapa", "==", "INTERESSADO"), FS.limit(300))),
            FS.getDocs(FS.query(col, FS.where("pagoEm", ">=", mes), FS.limit(500)))
          ]
    );
    const docs = s0 => s0.docs.map(d => d.data()).filter(noSeg);
    set("rsHoje", docs(h).filter(x => ABERTAS.includes(x.etapa) && x.followup && x.followup <= today).length);
    set("rsInt", docs(i).length);
    set(
      "rsMes",
      U.money(
        docs(m)
          .filter(x => (x.pagoEm || "") >= mes)
          .reduce((a, x) => a + (Number(x.valor) || 0), 0)
      )
    );
    // Fila: conta por ano (só filtros de igualdade, não precisa de índice extra no Firebase)
    const anos = seg === "lf" ? [Y] : anosRepasse();
    const cs = await Promise.all(
      anos.map(a => FS.getCountFromServer(FS.query(col, FS.where("etapa", "==", "NA FILA"), FS.where("ano", "==", a))))
    );
    set(
      "rsFila",
      cs.reduce((a, c) => a + c.data().count, 0)
    );
  } catch (e) {
    console.warn(e);
  }
}
function anosRepasse() {
  const Y = ANO(),
    conhecidos = Object.keys(meta.anos || {})
      .map(Number)
      .filter(a => a && a < Y);
  const de = conhecidos.length ? Math.min(...conhecidos) : ANO_MIN;
  const out = [];
  for (let a = Y - 1; a >= de; a--) out.push(a);
  return out;
}
// Não há limite: o app só avisa quando a pessoa passa do número de Ajustes (padrão: Linha de Frente 25, Repasse 20 por dia)
const avisoSeg = () => (seg === "lf" ? C.P.lfAvisoDia || 25 : C.P.avisoDia || 20);
const POR_VEZ = 10; // quantos contatos cada toque separa
const numeroSeg = () => (seg === "lf" ? C.P.lfNumero : C.P.repNumero) || "";
async function refreshLote() {
  const av = avisoSeg();
  try {
    const c = await FS.getCountFromServer(
      FS.query(
        col,
        FS.where("resp", "==", C.me),
        FS.where("separadoEm", "==", U.todayStr()),
        FS.where("separadoSeg", "==", seg),
        ...(seg === "lf" ? baseLF() : [])
      )
    );
    const n = c.data().count;
    $("rLoteTxt").textContent = n
      ? ` ${n} separado${n > 1 ? "s" : ""} hoje.`
      : ` Separe os contatos novos de hoje (o ideal é até ${av} por dia).`;
    const alerta = $("rLoteAviso");
    alerta.hidden = n < av;
    alerta.textContent = `⚠️ Você já separou ${n} contatos hoje (o combinado é até ${av}). Mandar muitas mensagens novas no mesmo dia pode fazer o WhatsApp bloquear o número. Pode continuar, mas vá com calma.`;
    $("rLote").classList.toggle("lote-aviso", n >= av);
    $("rLoteBtn").disabled = false;
    $("rLoteBtn").textContent = n ? `Separar mais ${POR_VEZ}` : `Separar ${POR_VEZ} contatos`;
    $("rLoteBtn").dataset.n = n;
    const n0 = numeroSeg();
    $("rLoteNum").textContent = n0 ? `📱 Use o WhatsApp ${n0}` : "";
    $("rLoteNum").hidden = !n0;
  } catch (e) {
    console.warn(e);
    $("rLoteTxt").textContent = " Não foi possível contar agora.";
  }
}
async function separarLote() {
  if (!C.me) return;
  const ja = Number($("rLoteBtn").dataset.n || 0),
    av = avisoSeg();
  let falta = POR_VEZ;
  const esc = $("rLoteEscola").value;
  const anos = seg === "lf" ? [ANO()] : anosRepasse(); // Repasse: do ano mais recente para o mais antigo
  $("rLoteBtn").disabled = true;
  try {
    // candidatos: um pouco mais que o necessário, porque outra pessoa pode pegar alguns ao mesmo tempo
    const cand = [];
    for (const a of anos) {
      if (cand.length >= falta * 2) break;
      const filtros = [FS.where("etapa", "==", "NA FILA"), FS.where("ano", "==", a)];
      if (esc) filtros.push(FS.where("escola", "==", esc));
      const s0 = await FS.getDocs(FS.query(col, ...filtros, FS.orderBy(FS.documentId()), FS.limit(falta * 2 - cand.length)));
      s0.docs.forEach(d => cand.push(d.ref));
    }
    if (!cand.length) {
      U.toast(esc ? "Essa escola não tem mais ninguém na fila." : "A fila acabou! 🎉");
      return;
    }
    // transação: só fica com quem ainda está NA FILA (dois vendedores nunca pegam o mesmo contato)
    const hoje = U.todayStr(),
      agora = new Date().toISOString();
    const pegos = await FS.runTransaction(db, async tx => {
      const lidos = [];
      for (const r of cand) lidos.push(await tx.get(r));
      const livres = lidos.filter(d => d.exists() && d.data().etapa === "NA FILA").slice(0, falta);
      livres.forEach(d =>
        tx.update(d.ref, {
          etapa: "SEPARADO",
          resp: C.me,
          respEmail: C.email || "",
          separadoEm: hoje,
          separadoSeg: seg,
          followup: hoje,
          atualizadoEm: agora
        })
      );
      return livres;
    });
    if (!pegos.length) {
      U.toast("Outra pessoa separou esses contatos agora. Toque de novo.");
      refreshLote();
      return;
    }
    const total = ja + pegos.length;
    U.toast(
      `${pegos.length} contato${pegos.length > 1 ? "s" : ""} separado${pegos.length > 1 ? "s" : ""} para você hoje` +
        (total >= av ? ` · ⚠️ já são ${total} hoje (combinado: até ${av})` : "")
    );
    refreshLote();
    refreshStats();
    if (tab !== "hoje") openTab("hoje");
  } catch (e) {
    C.handleErr(e);
  } finally {
    $("rLoteBtn").disabled = false;
  }
}
async function loadMeta() {
  try {
    const s = await FS.getDoc(FS.doc(db, "config", "repasse_meta"));
    meta = s.exists() ? Object.assign({ escolas: {}, anos: {} }, s.data()) : { escolas: {}, anos: {} };
    const names = Object.keys(meta.escolas || {}).sort((a, b) => a.localeCompare(b, "pt-BR"));
    ["rLoteEscola", "rEscola"].forEach(id => {
      const sel = $(id);
      const cur = sel.value;
      const first0 = sel.options[0];
      sel.innerHTML = "";
      sel.append(first0);
      names.forEach(n => {
        const o = el("option", null, `${title(n)} (${meta.escolas[n]})`);
        o.value = n;
        sel.append(o);
      });
      sel.value = cur;
    });
    const imp = $("rImport");
    if (imp) imp.hidden = !C.isAdmin;
  } catch (e) {
    avisoErro(e, "carregar a lista de escolas", U.toast);
  }
}
