// Módulo PR: venda do Kit Recordação (quadro 30x40 + 2 porta-retratos + fotos digitais) para quem fez o ensaio.
// Duas frentes, separadas pelo ano do ensaio e calculadas na hora (viram sozinhas em 1º de janeiro):
//   • Linha de Frente: ensaios do ano atual
//   • Repasse: ensaios dos anos anteriores
// Trabalha com milhares de contatos, então nunca carrega a coleção inteira:
// cada aba busca só o que precisa (hoje, interessados, pagos, busca).
import { openMockup, textoEscolha } from "./mockup.js";

let C, FS, db, col;
let tab = "hoje", seg = "lf", items = [], unsubList = null, mounted = false, meta = { escolas: {}, anos: {} };
const ANO = () => new Date().getFullYear();
const ANO_MIN = 2015;
// Em qual frente o formando está. Sem ano (incompleto) aparece nas duas.
function segDe(it){ return !it.ano ? null : it.ano >= ANO() ? "lf" : "rep"; }
function noSeg(it){ const s0 = segDe(it); return !s0 || s0 === seg; }
const segNome = s0 => s0 === "lf" ? "Linha de Frente " + ANO() : "Repasse";
const $ = (id) => document.getElementById(id);

export const ETAPAS = ["INCOMPLETO", "NA FILA", "SEPARADO", "CONTATADO", "INTERESSADO", "PAGO", "ENTREGUE", "NÃO QUER", "SEM CONTATO"];
const ABERTAS = ["SEPARADO", "CONTATADO", "INTERESSADO"];

// ---------- utilidades ----------
function norm(s){ return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim(); }
function slug(s){ return norm(s).replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase(); }
function title(s){ return String(s || "").toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, w => w.toLowerCase()); }
function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function eu(){ const f = C.first(C.me); return f ? (/a$/i.test(f) ? "a " : "o ") + f : "a equipe"; }
function precoTxt(it){
  const P = C.P;
  if (it ? segDe(it) === "lf" : seg === "lf") return P.lfPix ? C.money(P.lfPix) : P.kitPreco ? C.money(P.kitPreco) : "[valor do kit]";
  if (P.kitPromo) return C.money(P.kitPromo); if (P.kitPreco) return C.money(P.kitPreco); return "[valor do kit]";
}
function ofertaTxt(it){
  const P = C.P;
  if (segDe(it) === "lf") {
    const pix = P.lfPix || P.kitPreco; if (!pix) return "Tudo por [valor do kit]";
    return `${C.money(pix)} no Pix` + (P.lfCartao ? ` ou ${C.money(P.lfCartao)} no cartão${P.parcelas ? ` (até ${P.parcelas}x)` : ""}` : "");
  }
  const pix = P.kitPromo || P.kitPreco;
  if (!pix) return "Tudo por [valor do kit]";
  let t = P.kitPreco && P.kitPromo && P.kitPreco > P.kitPromo ? `De ${C.money(P.kitPreco)} por apenas ${C.money(P.kitPromo)} no Pix` : `Tudo por ${C.money(pix)} no Pix`;
  if (P.kitCartao) t += ` ou ${C.money(P.kitCartao)} no cartão${P.parcelas ? ` (até ${P.parcelas}x)` : ""}`;
  return t;
}
function sextaTxt(){ const d = new Date(); const add = (5 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + add); return C.pad(d.getDate()) + "/" + C.pad(d.getMonth() + 1); }
function entregaTxt(){ return C.P.entrega || "em casa ou para retirada no estúdio"; }
function status(it){
  if (it.etapa === "PAGO" || it.etapa === "ENTREGUE") return "won";
  if (!ABERTAS.includes(it.etapa) || !it.followup) return "none";
  const t = C.todayStr(); return it.followup < t ? "late" : it.followup === t ? "today" : "later";
}
function lockInfo(it){
  const a = it.atendendo; if (!a || !a.por || !a.desde) return null;
  const mins = (Date.now() - Date.parse(a.desde)) / 60000; if (!(mins >= 0 && mins <= 30)) return null;
  return { por: a.por, desde: a.desde, mine: a.por === C.me };
}
function contatoPadrao(it){
  const cs = it.contatos || [];
  return cs.find(c => c.tipo === "Mãe") || cs.find(c => c.tipo === "Pai") || cs.find(c => c.tipo === "Formando") || cs[0] || null;
}

// O que não pode faltar para entrar na fila: colégio, ano, aluno, nome de um responsável e 1 telefone.
function faltando(d){
  const f = [];
  if (!String(d.escola || "").trim()) f.push("colégio");
  if (!d.ano) f.push("ano");
  if (!String(d.nome || "").trim()) f.push("nome do aluno");
  const cs = d.contatos || [];
  if (!cs.some(c => c.tipo !== "Formando" && String(c.nome || "").trim()) && !String(d.responsavel || "").trim()) f.push("responsável");
  if (!cs.length) f.push("telefone");
  return f;
}

// ---------- mensagens prontas ----------
function passo(it, c){
  const F = C.first(title(it.nome));
  const cn = c && c.nome ? C.first(title(c.nome)) : "";
  const oi = cn ? `Olá, ${cn}!` : "Olá!";
  const souEu = `Aqui é ${eu()}, do Z7 Studio Fotográfico 📸`;
  const quem = c && c.tipo === "Formando" ? "o seu ensaio de formatura" : `o ensaio de formatura de ${F}`;
  const onde = segDe(it) === "lf" ? title(it.escola) + ", este ano" : [title(it.escola), it.ano].filter(Boolean).join(", ");
  const t = it.tentativas || 0;
  const encerra = { title: "Encerrar com elegância", msg: `${cn || "Tudo bem"}, vou entender que agora não é o momento e não vou mais te incomodar. Se um dia quiser o quadro ${c && c.tipo === "Formando" ? "da sua formatura" : "de " + F}, é só me chamar aqui! 💛`, then: { etapa: "NÃO QUER", days: -1 } };
  switch (it.etapa) {
    case "SEPARADO": return { title: "1º contato: pedir para mandar a prévia",
      msg: `${oi} Tudo bem? ${souEu}\nNós fizemos ${quem} no colégio${onde ? " (" + onde + ")" : ""}, e as fotos ficaram lindas!\nO Kit Recordação ${c && c.tipo === "Formando" ? "com as suas fotos" : "de " + F} já está pronto aqui no estúdio: quadro 30x40 com moldura preta, 2 porta-retratos e as fotos digitais. Posso te mandar uma foto de como ficou? 😊`,
      then: { etapa: "CONTATADO", days: 2, count: true } };
    case "CONTATADO":
      if (t <= 1) return { title: "2º contato: lembrar com carinho",
        msg: `Oi${cn ? ", " + cn : ""}! Passando só para saber se você viu minha mensagem sobre as fotos do ensaio de formatura${c && c.tipo === "Formando" ? "" : " de " + F} 😊 Posso te mandar a prévia do quadro?`,
        then: { etapa: "CONTATADO", days: 3, count: true } };
      return encerra;
    case "INTERESSADO": {
      const tI = it.tentInteresse || 0;
      if (tI === 0) {

        return { title: "Mandar a prévia e o preço", mockup: true,
          msg: `Olha como fica o Kit Recordação ${c && c.tipo === "Formando" ? "do seu ensaio" : "de " + F}! 😍\n• Quadro 30x40 com moldura preta\n• 2 porta-retratos 15x10\n• As fotos digitais do ensaio\nJá está pronto, é só combinar a entrega! ${ofertaTxt(it)}.\nEntregamos ${entregaTxt()}. Quer que eu separe o seu?`,
          then: { etapa: "INTERESSADO", days: 2, countI: true } };
      }
      if (tI === 1) return C.P.kitFinal && segDe(it) === "rep" ? { title: "Última condição (só para quem já viu a prévia)",
        msg: `Oi${cn ? ", " + cn : ""}! Estamos organizando os kits que ainda estão aqui no estúdio e consegui uma condição especial para o ${c && c.tipo === "Formando" ? "seu" : "de " + F}: ${C.money(C.P.kitFinal)} no Pix, válida até ${sextaTxt()}. Depois disso volta ao valor normal. Quer que eu separe? 😊`,
        then: { etapa: "INTERESSADO", days: 3, countI: true } } : { title: "Follow-up da prévia",
        msg: `Oi${cn ? ", " + cn : ""}! Conseguiu ver a prévia do quadro? Se quiser, separo o seu hoje e já combinamos a entrega 😊`,
        then: { etapa: "INTERESSADO", days: 3, countI: true } };
      return encerra;
    }
    case "PAGO":
      if (!it.entregaTipo || it.entregaTipo.startsWith("A combinar")) return { title: "Perguntar como prefere receber",
        msg: `${cn || "Oi"}, pagamento confirmado, muito obrigado! 💛 Como você prefere receber o kit ${c && c.tipo === "Formando" ? "" : "de " + F + " "}?\n1️⃣ Entregamos na sua casa (me confirma o endereço completo)\n2️⃣ Você retira aqui no estúdio, no dia e horário que for melhor (Estrada Dr. Rufino Gonçalves Ferreira, 290, Centro, Nilópolis, seg. a sáb., das 9h às 19h)`, then: null };
      if ((it.entregaTipo || "").startsWith("Retirada")) {
        if (it.entregaData) return null;
        return { title: "Agendar a retirada no estúdio",
          msg: `${cn || "Oi"}, pagamento confirmado, muito obrigado! 💛 O kit ${c && c.tipo === "Formando" ? "" : "de " + F + " "}fica pronto em poucos dias. Qual dia e horário fica melhor para você retirar aqui no estúdio? Estamos na Estrada Dr. Rufino Gonçalves Ferreira, 290, Centro, Nilópolis (seg. a sáb., das 9h às 19h).`, then: null };
      }
      if (it.enderecoConfirmado) return null;
      return { title: "Confirmar o endereço de entrega",
        msg: `${cn || "Oi"}, pagamento confirmado, muito obrigado! 💛 Para a entrega do kit, me confirma o endereço completo? Rua, número, complemento, bairro, cidade e um ponto de referência.${it.endereco && it.endereco.rua ? "\nNo nosso cadastro está: " + [title(it.endereco.rua) + (it.endereco.numero ? ", " + it.endereco.numero : ""), title(it.endereco.bairro), title(it.endereco.cidade)].filter(Boolean).join(" · ") + ". Continua esse?" : ""}`, then: null };
    case "ENTREGUE": return { title: "Pós-venda: foto na parede e indicação",
      msg: `${cn || "Oi"}, o kit ${c && c.tipo === "Formando" ? "" : "de " + F + " "}chegou direitinho? 💛 Se puder, manda uma foto do quadro na parede, vamos amar ver! E se alguém da família ou algum amigo também se formou, me indica?`,
      then: null };
    default: return null;
  }
}

// ---------- gravação ----------
async function save(it, patch, msg){
  try {
    patch.atualizadoEm = new Date().toISOString();
    await FS.updateDoc(FS.doc(db, "repasse", it.id), patch);
    Object.assign(it, patch);
    if (tab === "buscar") renderList();
    C.toast(msg || "Salvo");
  } catch (e) { C.handleErr(e); }
}
function claim(it){
  if (!C.me) return; const li = lockInfo(it); if (li && li.mine) return;
  save(it, { atendendo: { por: C.me, desde: new Date().toISOString() } }, "O outro aparelho vai ver: " + C.first(C.me) + " está respondendo");
}

// ---------- tela ----------
export function init(ctx){ C = ctx; FS = ctx.FS; db = ctx.db; col = FS.collection(db, "repasse"); try { seg = localStorage.getItem("z7seg") || "lf"; } catch (_) {} }

export function show(){
  if (!mounted) mount();
  renderSegs();
  loadMeta().then(refreshStats); refreshLote(); openTab(tab);
}

function mount(){
  mounted = true;
  const v = $("viewRepasse"); v.innerHTML = "";
  const head = el("div", "vhead");
  head.append(el("h2", null, "PR"));
  const hb = el("div", "quick");
  hb.append(C.mkBtn("🖼️ Prévia e fotos", "", () => openMockup({ preco: precoTxt() })));
  const imp = C.mkBtn("Importar planilha", "", () => openImport()); imp.id = "rImport"; imp.hidden = !C.isAdmin;
  hb.append(imp); head.append(hb); v.append(head);

  const segs = el("div", "segs"); segs.id = "rSegs"; segs.setAttribute("role", "tablist"); v.append(segs);
  const g = el("details", "guide"); g.id = "rGuide";
  g.innerHTML = `<summary>Como funciona o PR</summary><ol>
    <li><b>Linha de Frente</b> são os ensaios deste ano; <b>Repasse</b> são os dos anos anteriores. Em 1º de janeiro tudo vira sozinho: a Linha de Frente do ano que acabou passa para o Repasse.</li>
    <li><b>Separe o seu lote do dia</b> no quadro abaixo. Começamos com poucos contatos por dia para o WhatsApp não bloquear o número.</li>
    <li>Cada cartão mostra <b>para quem mandar</b> (mãe, pai ou formando) e a mensagem pronta. O 1º contato só pede permissão para mandar a prévia.</li>
    <li>Respondeu que quer ver? Toque em <b>Quer ver a prévia</b>, depois em <b>🖼️ Prévia</b>: arraste a foto do formando e o app monta o kit pronto para enviar.</li>
    <li><b>Pagou?</b> Toque em <b>Pagou</b>. O cartão pede para <b>confirmar o endereço</b> (ou agendar a retirada no estúdio) e vai para <b>Entregas</b>, separado por cidade e bairro para montar a rota.</li>
    <li>Cada frente tem o <b>seu próprio número de WhatsApp</b> e o seu limite de contatos por dia (em ⚙️ Ajustes). Nunca use o número do funil.</li></ol>`;
  v.append(g);

  const st = el("section", "stats");
  st.innerHTML = `<div class="stat today"><b id="rsHoje">–</b><small>Para hoje</small></div>
    <div class="stat"><b id="rsFila">–</b><small>Na fila</small></div>
    <div class="stat"><b id="rsInt">–</b><small>Interessados</small></div>
    <div class="stat won"><b id="rsMes">–</b><small>Vendido no mês</small></div>`;
  v.append(st);

  const lote = el("div", "lote"); lote.id = "rLote";
  lote.innerHTML = `<div><b>Seu lote de hoje</b><span id="rLoteTxt">…</span><small class="lnum" id="rLoteNum" hidden></small></div>
    <div class="quick"><select id="rLoteEscola" aria-label="Escola do lote"><option value="">Turmas mais recentes primeiro</option></select>
    <button class="btn btn-primary btn-sm" id="rLoteBtn" type="button">Separar contatos</button></div>`;
  v.append(lote);

  const chips = el("div", "chips"); chips.id = "rChips"; chips.setAttribute("role", "toolbar"); v.append(chips);

  const busca = el("div", "rbusca"); busca.id = "rBusca"; busca.hidden = true;
  busca.innerHTML = `<input class="search" id="rQ" type="search" placeholder="Nome do formando ou telefone" aria-label="Buscar no repasse">
    <select class="search" id="rEscola" aria-label="Filtrar por escola"><option value="">Ou escolha uma escola…</option></select>`;
  v.append(busca);

  const list = el("section", "grid"); list.id = "rList"; list.setAttribute("aria-live", "polite"); v.append(list);

  $("rLoteBtn").onclick = separarLote;
  let tq; $("rQ").addEventListener("input", () => { clearTimeout(tq); tq = setTimeout(buscar, 400); });
  $("rEscola").addEventListener("change", buscar);
  try { if (!localStorage.getItem("z7rguide")) g.open = true; g.addEventListener("toggle", () => { try { localStorage.setItem("z7rguide", "1"); } catch (_) {} }); } catch (_) {}
}

function renderSegs(){
  const c = $("rSegs"); c.innerHTML = "";
  [["lf", `Linha de Frente ${ANO()}`, "ensaios deste ano"], ["rep", "Repasse", `ensaios até ${ANO() - 1}`]].forEach(([k, t, sub]) => {
    const b = el("button", "seg"); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(seg === k));
    b.append(el("b", null, t), el("small", null, sub));
    b.onclick = () => { if (seg === k) return; seg = k; try { localStorage.setItem("z7seg", k); } catch (_) {} renderSegs(); refreshStats(); refreshLote(); renderList(); };
    c.append(b);
  });
}
function renderChips(){
  const c = $("rChips"); c.innerHTML = "";
  const tabs = [["hoje", "Para hoje"], ["interessados", "Interessados"], ["entregas", "Entregas"], ["buscar", "Buscar"]];
  if (C.isAdmin) tabs.push(["incompletos", "Incompletos"]);
  tabs.forEach(([k, t]) => {
    const b = el("button", "chip", t); b.type = "button"; b.setAttribute("aria-pressed", String(tab === k));
    b.onclick = () => openTab(k); c.append(b);
  });
}

function openTab(k){
  tab = k; renderChips();
  $("rBusca").hidden = k !== "buscar";
  if (unsubList) { unsubList(); unsubList = null; }
  items = []; renderList(true);
  const today = C.todayStr();
  let q = null;
  if (k === "hoje") q = FS.query(col, FS.where("followup", "<=", today), FS.orderBy("followup"), FS.limit(150));
  if (k === "interessados") q = FS.query(col, FS.where("etapa", "==", "INTERESSADO"), FS.limit(200));
  if (k === "entregas") q = FS.query(col, FS.where("etapa", "==", "PAGO"), FS.limit(300));
  if (k === "incompletos") q = FS.query(col, FS.where("etapa", "==", "INCOMPLETO"), FS.limit(200));
  if (q) unsubList = FS.onSnapshot(q, snap => { items = snap.docs.map(d => Object.assign({ id: d.id }, d.data())); renderList(); },
    err => { console.warn(err); C.showNotice("Não foi possível carregar o Repasse. Verifique a internet."); });
  if (k === "buscar") { $("rQ").focus(); buscar(); }
}

async function buscar(){
  if (tab !== "buscar") return;
  const txt = $("rQ").value.trim(), esc = $("rEscola").value;
  let q = null;
  const dg = txt.replace(/\D/g, "");
  if (dg.length >= 8) q = FS.query(col, FS.where("telefones", "array-contains", dg.replace(/^55(?=\d{10,11}$)/, "")), FS.limit(30));
  else if (txt.length >= 2) { const n = norm(txt); q = FS.query(col, FS.orderBy("nomeBusca"), FS.startAt(n), FS.endAt(n + ""), FS.limit(30)); }
  else if (esc) q = FS.query(col, FS.where("escola", "==", esc), FS.limit(500));
  if (!q) { items = []; renderList(false, "Digite pelo menos 2 letras do nome, um telefone, ou escolha uma escola."); return; }
  try {
    const s = await FS.getDocs(q);
    items = s.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    renderList();
  } catch (e) { console.warn(e); C.toast("Não foi possível buscar agora."); }
}

function renderList(loading, emptyMsg){
  const list = $("rList"); list.innerHTML = "";
  if (loading) { const e = el("div", "empty"); e.style.gridColumn = "1/-1"; e.append(el("strong", null, "Carregando…")); list.append(e); return; }
  let arr = tab === "buscar" ? items.slice() : items.filter(noSeg);
  if (tab === "hoje") arr = arr.filter(it => ABERTAS.includes(it.etapa) || it.etapa === "ENTREGUE");
  if (!arr.length) {
    const e = el("div", "empty"); e.style.gridColumn = "1/-1";
    const msgs = { hoje: ["Nada para hoje", "Separe o seu lote do dia no quadro acima para começar."], interessados: ["Nenhum interessado ainda", "Quem responder que quer ver a prévia aparece aqui."], entregas: ["Nenhuma entrega pendente", "Os kits pagos aparecem aqui, separados por cidade e bairro."], incompletos: ["Nenhum cadastro incompleto", "Quem não tiver colégio, ano, nome do aluno, responsável ou telefone aparece aqui para completar."], buscar: ["Nada encontrado", emptyMsg || "Tente outro nome ou telefone."] };
    const [a, b] = msgs[tab] || ["Nada aqui", ""]; e.append(el("strong", null, a), el("span", null, emptyMsg || b)); list.append(e); return;
  }
  if (tab === "hoje") { const rank = { late: 0, today: 1, later: 2, none: 3, won: 4 }; arr.sort((a, b) => rank[status(a)] - rank[status(b)] || (a.followup || "").localeCompare(b.followup || "")); }
  if (tab === "entregas") {
    const grpOf = it => (!it.entregaTipo || it.entregaTipo.startsWith("A combinar")) ? "0 Falta combinar com o cliente" : it.entregaTipo.startsWith("Retirada") ? "1 Retirada no estúdio" : "2 " + [title(it.endereco?.cidade || "Sem cidade"), title(it.endereco?.bairro || "Sem bairro")].join(" · ");
    arr.sort((a, b) => grpOf(a).localeCompare(grpOf(b)) || (a.entregaData || "9").localeCompare(b.entregaData || "9"));
    let last = null;
    arr.forEach(it => {
      const grp = grpOf(it).slice(2);
      if (grp !== last) { const h = el("h3", "grp", grp); h.style.gridColumn = "1/-1"; list.append(h); last = grp; }
      list.append(card(it));
    });
    return;
  }
  arr.forEach(it => list.append(card(it)));
}

function card(it){
  const s = status(it);
  const e = el("article", "card " + (["late", "today", "won"].includes(s) ? s : ""));
  const top = el("div", "card-top"); top.append(el("h3", "name", title(it.nome) || "Sem nome"), el("span", "stage", it.etapa)); e.append(top);

  const meta = el("div", "meta");
  [[tab === "buscar" && segDe(it) ? segNome(segDe(it)) : "", "svc"], [it.resp ? "👤 " + C.first(it.resp) : "", ""], [title(it.escola), "svc"], [[it.curso, it.turma].filter(Boolean).join(" · "), ""], [it.ano ? String(it.ano) : "", ""], [it.valor ? C.money(it.valor) : "", ""]]
    .forEach(([v, c]) => { if (v) meta.append(el("span", "tag " + c, v)); });
  e.append(meta);

  // Para quem mandar
  const cs = it.contatos || [];
  let escolhido = contatoPadrao(it);
  const quem = el("div", "quem");
  const ns0 = passo(it, escolhido);
  if (cs.length > 1 && ns0) {
    quem.append(el("small", null, "Mandar para:"));
    cs.forEach(c => {
      const b = el("button", "chip chip-sm", `${c.tipo}${c.nome ? " (" + C.first(title(c.nome)) + ")" : ""}`); b.type = "button";
      b.setAttribute("aria-pressed", String(c === escolhido));
      b.onclick = () => { escolhido = c; quem.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); paintNext(); };
      quem.append(b);
    });
    e.append(quem);
  }
  const tels = el("div", "phone"); tels.textContent = cs.map(c => `${c.tipo}: ${c.tel}`).join(" · ") || "Sem telefone"; e.append(tels);

  if (it.etapa === "INCOMPLETO") e.append(el("p", "wait", "Falta: " + (faltando(it).join(", ") || "conferir dados")));
  const fu = el("div", "fu " + (s === "late" ? "late" : s === "today" ? "today" : it.followup ? "" : "none"));
  if (ABERTAS.includes(it.etapa)) fu.textContent = it.followup ? (s === "late" ? "Atrasado desde " + C.fmtDate(it.followup) : s === "today" ? "Contato para hoje" : "Próximo contato: " + C.fmtDate(it.followup)) : "Sem data de contato";
  else if (it.etapa === "PAGO") {
    const ret = (it.entregaTipo || "").startsWith("Retirada"), comb = !it.entregaTipo || it.entregaTipo.startsWith("A combinar");
    if (comb) fu.textContent = "Pago" + (it.pagoEm ? " em " + C.fmtDate(it.pagoEm) : "") + " · ⚠️ falta combinar entrega ou retirada"; else
    fu.textContent = "Pago" + (it.pagoEm ? " em " + C.fmtDate(it.pagoEm) : "") + (ret ? " · retirada no estúdio" : " · entrega em casa") + (it.entregaData ? " em " + C.fmtDate(it.entregaData) : " · data a combinar") + (!ret && !it.enderecoConfirmado ? " · ⚠️ endereço não confirmado" : "");
  }
  else if (it.etapa === "ENTREGUE") fu.textContent = "Entregue" + (it.entregueEm ? " em " + C.fmtDate(it.entregueEm) : "");
  else fu.textContent = it.etapa === "NA FILA" ? "Ainda na fila" : it.etapa === "INCOMPLETO" ? "Fora da fila até completar" : "Encerrado";
  e.append(fu);

  if (it.etapa === "PAGO" && (it.entregaTipo || "").startsWith("Entrega")) {
    const a = it.endereco || {};
    const end = [a.rua && (title(a.rua) + (a.numero ? ", " + a.numero : "")), a.complemento && title(a.complemento), title(a.bairro), title(a.cidade)].filter(Boolean).join(" · ");
    if (end) e.append(el("p", "notes", "📍 " + end));
  }
  const nt = [it.notas, it.obs && it.obs !== "-" ? "Planilha: " + it.obs : ""].filter(Boolean).join("\n");
  if (nt) e.append(el("p", "notes", nt));
  if (it.ultimo && it.ultimo.em) e.append(el("div", "last", "Último contato: " + (C.first(it.ultimo.por) || "—") + " · " + C.fmtDate(C.ds(new Date(it.ultimo.em))) + " às " + C.hhmm(it.ultimo.em)));

  const li = lockInfo(it);
  if (li) {
    const lk = el("div", "lock " + (li.mine ? "mine" : "other"));
    lk.append(el("span", null, li.mine ? "✋ Você está respondendo (desde " + C.hhmm(li.desde) + ")" : "⚠️ " + C.first(li.por) + " está respondendo desde " + C.hhmm(li.desde)));
    lk.append(li.mine ? C.mkBtn("Liberar", "", () => save(it, { atendendo: null }, "Cartão liberado")) : C.mkBtn("Assumir mesmo assim", "", () => save(it, { atendendo: { por: C.me, desde: new Date().toISOString() } }, "Agora você está respondendo")));
    e.append(lk);
  }
  const blocked = li && !li.mine;

  const box = el("div", "next"); e.append(box);
  const F0 = C.first(title(it.nome));
  function paintNext(){
    box.innerHTML = "";
    const ns = passo(it, escolhido);
    if (!ns) { box.hidden = true; return; }
    box.hidden = false;
    const msg = el("p", null, ns.msg);
    box.append(el("small", null, "Próximo passo: " + ns.title), msg);
    if (blocked) { box.append(el("p", "wait", "Espere " + C.first(li.por) + " terminar, ou toque em “Assumir mesmo assim”.")); return; }
    const row = el("div", "row");
    const d = escolhido ? C.digits(escolhido.tel) : "";
    if (d) { const a = el("a", "btn btn-sm btn-primary", "Abrir no WhatsApp"); a.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(ns.msg); a.target = "_blank"; a.rel = "noopener"; a.addEventListener("click", () => claim(it)); row.append(a); }
    row.append(C.mkBtn("Copiar texto", "", async () => { claim(it); try { await navigator.clipboard.writeText(ns.msg); C.toast("Texto copiado"); } catch (_) { const r = document.createRange(); r.selectNodeContents(msg); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); C.toast("Texto selecionado, copie com o dedo"); } }));
    if (ns.mockup || it.etapa === "INTERESSADO") row.append(C.mkBtn("🖼️ Prévia", "", () => openMockup({ nome: title(it.nome), escola: title(it.escola), preco: precoTxt(it) })));
    if (it.etapa === "INTERESSADO") row.append(C.mkBtn("📷 Fotos para escolher", "", () => openMockup({ nome: title(it.nome), escola: title(it.escola), preco: precoTxt(it), modo: "escolha" })));
    if (it.etapa === "INTERESSADO" && d) { const a3 = el("a", "btn btn-sm", "✍️ Pedir a escolha"); a3.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(textoEscolha(F0)); a3.target = "_blank"; a3.rel = "noopener"; row.append(a3); }
    if (it.etapa === "INTERESSADO" && C.P.linkCartao && d) {
      const lm = `Para pagar no cartão (em até ${C.P.parcelas || "algumas"} vezes), é só usar este link seguro da InfinityPay:\n${C.P.linkCartao}\nDepois me manda o comprovante por aqui 😊 No Pix, a chave é ${C.P.pix || "[chave Pix]"}.`;
      const a2 = el("a", "btn btn-sm", "💳 Mandar link de pagamento"); a2.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(lm); a2.target = "_blank"; a2.rel = "noopener"; row.append(a2);
    }
    if (ns.then) row.append(C.mkBtn("Enviei ✓", "btn-ok", () => {
      const p = { etapa: ns.then.etapa, followup: ns.then.days < 0 ? null : C.addDays(ns.then.days), atendendo: null, ultimo: { por: C.me || "—", em: new Date().toISOString(), para: escolhido ? escolhido.tipo : "" } };
      if (ns.then.count) p.tentativas = (it.tentativas || 0) + 1;
      if (ns.then.countI) p.tentInteresse = (it.tentInteresse || 0) + 1;
      if (!it.resp && C.me) p.resp = C.me;
      save(it, p, p.etapa === "NÃO QUER" ? "Contato encerrado" : "Próximo contato em " + C.fmtDate(p.followup));
    }));
    box.append(row);
  }
  paintNext();

  const act = el("div", "actions");
  if (it.etapa === "INCOMPLETO" || C.isAdmin) act.append(C.mkBtn(it.etapa === "INCOMPLETO" ? "Completar dados" : "Editar dados", it.etapa === "INCOMPLETO" ? "btn-primary" : "", () => openDados(it)));
  if (it.etapa === "NA FILA") act.append(C.mkBtn("Separar para mim", "btn-primary", () => save(it, { etapa: "SEPARADO", resp: C.me, separadoEm: C.todayStr(), separadoSeg: segDe(it) || seg, followup: C.todayStr() }, "Separado para hoje")));
  if (ABERTAS.includes(it.etapa) && !li) act.append(C.mkBtn("✋ Estou respondendo", "", () => claim(it)));
  if (it.etapa === "SEPARADO" || it.etapa === "CONTATADO") act.append(C.mkBtn("Quer ver a prévia ✓", "btn-ok", () => save(it, { etapa: "INTERESSADO", followup: C.todayStr(), tentInteresse: 0 }, "Ótimo! Agora mande a prévia")));
  if (ABERTAS.includes(it.etapa)) {
    act.append(C.mkBtn("Pagou 💰", "btn-ok", () => openPago(it)));
    act.append(C.mkBtn("Remarcar +1d", "", () => save(it, { followup: C.addDays(1) }, "Remarcado para " + C.fmtDate(C.addDays(1)))));
    act.append(C.mkBtn("Não quer", "", () => save(it, { etapa: "NÃO QUER", followup: null, atendendo: null }, "Contato encerrado")));
    act.append(C.mkBtn("Número errado", "", () => save(it, { etapa: "SEM CONTATO", followup: null, atendendo: null }, "Marcado como sem contato")));
  }
  if (it.etapa === "PAGO") act.append(C.mkBtn("📍 Endereço e data", "", () => openEntrega(it)));
  if (it.etapa === "PAGO") act.append(C.mkBtn("Entregue ✓", "btn-ok", () => save(it, { etapa: "ENTREGUE", entregueEm: C.todayStr(), followup: C.addDays(2) }, "Entrega registrada 🎉")));
  if (["NÃO QUER", "SEM CONTATO"].includes(it.etapa)) act.append(C.mkBtn("Reabrir", "", () => save(it, { etapa: "SEPARADO", followup: C.todayStr(), tentativas: 0, tentInteresse: 0, resp: C.me }, "Contato reaberto")));
  if (it.etapa === "ENTREGUE" && it.followup) act.append(C.mkBtn("Concluir", "", () => save(it, { followup: null }, "Concluído")));
  act.append(C.mkBtn("Notas", "", () => openNotas(it)));
  e.append(act);
  return e;
}

// ---------- janelinhas (pagou / notas) ----------
function sheet(titleTxt, build){
  const sh = el("div", "sheet"); const p = el("form", "panel"); p.autocomplete = "off";
  p.append(el("h2", null, titleTxt)); sh.append(p);
  const close = () => sh.remove();
  sh.addEventListener("click", ev => { if (ev.target === sh) close(); });
  build(p, close); document.body.append(sh);
  const f = p.querySelector("input,textarea,select"); if (f) setTimeout(() => f.focus(), 30);
  return close;
}
function field(lbl, inp){ const f = el("div", "field"); const l = el("label", null, lbl); inp.id = "x" + Math.random().toString(36).slice(2, 8); l.htmlFor = inp.id; f.append(l, inp); return f; }
function actions(close, okTxt){ const a = el("div", "panel-actions"); a.append(el("span")); a.lastChild.style.flex = "1"; const c = C.mkBtn("Cancelar", "", close); c.classList.remove("btn-sm"); const ok = el("button", "btn btn-primary", okTxt); ok.type = "submit"; a.append(c, ok); return a; }

function openPago(it){
  sheet("Registrar venda", (p, close) => {
    p.append(el("p", "hint", title(it.nome) + " · " + title(it.escola)));
    const v = el("input"); v.inputMode = "decimal"; v.value = it.valor || (segDe(it) === "lf" ? (C.P.lfPix || C.P.kitPreco) : ((it.tentInteresse >= 2 && C.P.kitFinal) || C.P.kitPromo || C.P.kitPreco)) || "";
    const fp = el("select"); ["Pix", "Cartão (link InfinityPay)", "Dinheiro", "Outro"].forEach(x => { const o = el("option", null, x); o.value = x; fp.append(o); });
    const r = el("div", "row2"); r.append(field("Valor (R$)", v), field("Pagamento", fp)); p.append(r);
    p.append(entregaCampos(p, it));
    p.append(actions(close, "Salvar venda"));
    p.addEventListener("submit", ev => {
      ev.preventDefault(); close();
      save(it, Object.assign({ etapa: "PAGO", valor: C.num(v.value), formaPag: fp.value, pagoEm: C.todayStr(), followup: null, atendendo: null, resp: it.resp || C.me }, p._entrega()), "Venda registrada 🎉");
    });
  });
}
function openEntrega(it){
  sheet("Entrega", (p, close) => {
    p.append(el("p", "hint", title(it.nome)));
    p.append(entregaCampos(p, it), actions(close, "Salvar"));
    p.addEventListener("submit", ev => { ev.preventDefault(); close(); save(it, p._entrega(), "Entrega atualizada"); });
  });
}
// Campos de entrega: tipo, data agendada e endereço (vem da planilha, mas precisa ser confirmado com o cliente).
function entregaCampos(p, it){
  const box = el("div", "imp");
  const en = el("select"); ["A combinar com o cliente", "Entrega em casa", "Retirada no estúdio (agendada)"].forEach(x => { const o = el("option", null, x); o.value = x; en.append(o); });
  if (it.entregaTipo) en.value = it.entregaTipo.startsWith("Retirada") ? "Retirada no estúdio (agendada)" : it.entregaTipo.startsWith("A combinar") ? "A combinar com o cliente" : "Entrega em casa";
  const dt = el("input"); dt.type = "date"; dt.value = it.entregaData || "";
  const r1 = el("div", "row2"); r1.append(field("Entrega", en), field("Data combinada (se já tiver)", dt)); box.append(r1);
  const a = it.endereco || {};
  const mk = (val, ph) => { const i = el("input"); i.value = val || ""; i.placeholder = ph || ""; i.maxLength = 120; return i; };
  const rua = mk(title(a.rua)), num = mk(a.numero), comp = mk(title(a.complemento)), bai = mk(title(a.bairro)), cid = mk(title(a.cidade)), ref = mk(a.referencia, "ponto de referência");
  const end = el("div", "imp");
  const r2 = el("div", "row2"); r2.append(field("Rua", rua), field("Número", num));
  const r3 = el("div", "row2"); r3.append(field("Complemento", comp), field("Bairro", bai));
  const r4 = el("div", "row2"); r4.append(field("Cidade", cid), field("Referência", ref));
  const conf = el("label", "chk"); const cc = el("input"); cc.type = "checkbox"; cc.checked = !!it.enderecoConfirmado; conf.append(cc, document.createTextNode(" Endereço confirmado com o cliente"));
  end.append(el("p", "hint", "O endereço da planilha pode estar desatualizado. Confirme com o cliente antes de sair para entregar."), r2, r3, r4, conf);
  box.append(end);
  const sync = () => { end.hidden = en.value !== "Entrega em casa"; }; en.onchange = sync; sync();
  p._entrega = () => {
    const casa = en.value === "Entrega em casa";
    const o = { entregaTipo: en.value, entregaData: dt.value || "" };
    if (casa) { o.endereco = { rua: rua.value.trim(), numero: num.value.trim(), complemento: comp.value.trim(), bairro: bai.value.trim(), cidade: cid.value.trim(), referencia: ref.value.trim() }; o.enderecoConfirmado = cc.checked; }
    return o;
  };
  return box;
}
function openDados(it){
  sheet("Dados do formando", (p, close) => {
    const mk = (v, ph) => { const i = el("input"); i.value = v || ""; i.placeholder = ph || ""; i.maxLength = 120; return i; };
    const nome = mk(title(it.nome)), escola = mk(title(it.escola)), ano = mk(it.ano || "", "2025"); ano.inputMode = "numeric";
    const r1 = el("div", "row2"); r1.append(field("Colégio", escola), field("Ano", ano));
    p.append(field("Nome do aluno", nome), r1);
    p.append(el("h3", null, "Contatos"));
    const linhas = [];
    const lista = el("div", "imp"); p.append(lista);
    const addLinha = (c = { tipo: "Mãe", nome: "", tel: "" }) => {
      const tp = el("select"); ["Mãe", "Pai", "Responsável", "Formando", "Telefone", "Outro"].forEach(x => { const o = el("option", null, x); o.value = x; tp.append(o); }); tp.value = c.tipo || "Outro";
      const nm = mk(title(c.nome), "nome"); const tl = mk(c.tel, "21 99999-9999"); tl.inputMode = "tel";
      const row = el("div", "row3"); row.append(field("Quem", tp), field("Nome", nm), field("WhatsApp", tl));
      lista.append(row); linhas.push({ tp, nm, tl });
    };
    (it.contatos && it.contatos.length ? it.contatos : [{}]).forEach(addLinha);
    const add = C.mkBtn("+ Adicionar contato", "", () => addLinha()); p.append(add);
    const erro = el("p", "err"); erro.hidden = true; p.append(erro);
    p.append(actions(close, "Salvar"));
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      const cs = []; const vistos = new Set();
      linhas.forEach(({ tp, nm, tl }) => {
        const d = tl.value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
        if (d.length >= 10 && d.length <= 11 && !vistos.has(d)) { vistos.add(d); cs.push({ tipo: tp.value, nome: nm.value.trim(), tel: d }); }
      });
      const patch = { nome: nome.value.trim(), nomeBusca: norm(nome.value), escola: escola.value.trim(), ano: Number(ano.value) || null, contatos: cs, telefones: cs.map(c => c.tel) };
      const falta = faltando(patch);
      if (it.etapa === "INCOMPLETO" || it.etapa === "NA FILA") patch.etapa = falta.length ? "INCOMPLETO" : "NA FILA";
      close();
      save(it, patch, falta.length ? "Salvo. Ainda falta: " + falta.join(", ") : (it.etapa === "INCOMPLETO" ? "Completo! Entrou na fila ✅" : "Dados salvos"));
    });
  });
}
function openNotas(it){
  sheet("Notas", (p, close) => {
    p.append(el("p", "hint", title(it.nome)));
    const t = el("textarea"); t.rows = 4; t.maxLength = 1500; t.value = it.notas || "";
    const tel = el("input"); tel.inputMode = "tel"; tel.placeholder = "21 99999-9999";
    p.append(field("Anotações", t), field("Adicionar outro WhatsApp (opcional)", tel), actions(close, "Salvar"));
    p.addEventListener("submit", ev => {
      ev.preventDefault(); close();
      const patch = { notas: t.value.trim() };
      const d = tel.value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
      if (d.length >= 10) { patch.contatos = [...(it.contatos || []), { tipo: "Outro", nome: "", tel: d }]; patch.telefones = [...new Set([...(it.telefones || []), d])]; }
      save(it, patch, "Notas salvas");
    });
  });
}

// ---------- números do topo e lote ----------
async function refreshStats(){
  const today = C.todayStr(), mes = today.slice(0, 8) + "01", Y = ANO();
  const set = (id, v) => { const x = $(id); if (x) x.textContent = v; };
  try {
    const [h, i, m] = await Promise.all([
      FS.getDocs(FS.query(col, FS.where("followup", "<=", today), FS.limit(300))),
      FS.getDocs(FS.query(col, FS.where("etapa", "==", "INTERESSADO"), FS.limit(300))),
      FS.getDocs(FS.query(col, FS.where("pagoEm", ">=", mes), FS.limit(500)))
    ]);
    const docs = s0 => s0.docs.map(d => d.data()).filter(noSeg);
    set("rsHoje", docs(h).filter(x => ABERTAS.includes(x.etapa)).length);
    set("rsInt", docs(i).length);
    set("rsMes", C.money(docs(m).reduce((a, x) => a + (Number(x.valor) || 0), 0)));
    // Fila: conta por ano (só filtros de igualdade, não precisa de índice extra no Firebase)
    const anos = seg === "lf" ? [Y, Y + 1] : anosRepasse();
    const cs = await Promise.all(anos.map(a => FS.getCountFromServer(FS.query(col, FS.where("etapa", "==", "NA FILA"), FS.where("ano", "==", a)))));
    set("rsFila", cs.reduce((a, c) => a + c.data().count, 0));
  } catch (e) { console.warn(e); }
}
function anosRepasse(){
  const Y = ANO(), conhecidos = Object.keys(meta.anos || {}).map(Number).filter(a => a && a < Y);
  const de = conhecidos.length ? Math.min(...conhecidos) : ANO_MIN;
  const out = []; for (let a = Y - 1; a >= de; a--) out.push(a); return out;
}
const limiteSeg = () => (seg === "lf" ? C.P.lfLoteDia : C.P.loteDia) || 20;
const numeroSeg = () => (seg === "lf" ? C.P.lfNumero : C.P.repNumero) || "";
async function refreshLote(){
  const lim = limiteSeg();
  try {
    const c = await FS.getCountFromServer(FS.query(col, FS.where("resp", "==", C.me), FS.where("separadoEm", "==", C.todayStr()), FS.where("separadoSeg", "==", seg)));
    const n = c.data().count, falta = Math.max(0, lim - n);
    $("rLoteTxt").textContent = n ? ` ${n} de ${lim} separados hoje.` + (falta ? ` Ainda pode separar ${falta}.` : " Lote completo ✓") : ` Separe até ${lim} contatos novos hoje.`;
    $("rLoteBtn").disabled = !falta; $("rLoteBtn").textContent = falta ? `Separar ${falta} contato${falta > 1 ? "s" : ""}` : "Lote completo";
    $("rLoteBtn").dataset.falta = falta;
    const n0 = numeroSeg(); $("rLoteNum").textContent = n0 ? `📱 Use o WhatsApp ${n0}` : ""; $("rLoteNum").hidden = !n0;
  } catch (e) { console.warn(e); $("rLoteTxt").textContent = " Não foi possível contar agora."; }
}
async function separarLote(){
  let falta = Number($("rLoteBtn").dataset.falta || 0); if (!falta || !C.me) return;
  const esc = $("rLoteEscola").value;
  const anos = seg === "lf" ? [ANO(), ANO() + 1] : anosRepasse(); // Repasse: do ano mais recente para o mais antigo
  $("rLoteBtn").disabled = true;
  try {
    const pegos = [];
    for (const a of anos) {
      if (falta <= 0) break;
      const filtros = [FS.where("etapa", "==", "NA FILA"), FS.where("ano", "==", a)]; if (esc) filtros.push(FS.where("escola", "==", esc));
      const s0 = await FS.getDocs(FS.query(col, ...filtros, FS.orderBy(FS.documentId()), FS.limit(falta)));
      s0.docs.forEach(d => pegos.push(d)); falta -= s0.size;
    }
    if (!pegos.length) { C.toast(esc ? "Essa escola não tem mais ninguém na fila." : "A fila acabou! 🎉"); return; }
    const b = FS.writeBatch(db), hoje = C.todayStr();
    pegos.forEach(d => b.update(d.ref, { etapa: "SEPARADO", resp: C.me, separadoEm: hoje, separadoSeg: seg, followup: hoje, atualizadoEm: new Date().toISOString() }));
    await b.commit();
    C.toast(`${pegos.length} contato${pegos.length > 1 ? "s" : ""} separado${pegos.length > 1 ? "s" : ""} para você hoje`);
    refreshLote(); refreshStats(); if (tab !== "hoje") openTab("hoje");
  } catch (e) { C.handleErr(e); } finally { $("rLoteBtn").disabled = false; }
}
async function loadMeta(){
  try {
    const s = await FS.getDoc(FS.doc(db, "config", "repasse_meta"));
    meta = s.exists() ? Object.assign({ escolas: {}, anos: {} }, s.data()) : { escolas: {}, anos: {} };
    const names = Object.keys(meta.escolas || {}).sort((a, b) => a.localeCompare(b, "pt-BR"));
    ["rLoteEscola", "rEscola"].forEach(id => {
      const sel = $(id); const cur = sel.value; const first0 = sel.options[0];
      sel.innerHTML = ""; sel.append(first0);
      names.forEach(n => { const o = el("option", null, `${title(n)} (${meta.escolas[n]})`); o.value = n; sel.append(o); });
      sel.value = cur;
    });
    const imp = $("rImport"); if (imp) imp.hidden = !C.isAdmin;
  } catch (_) {}
}

// ---------- importar planilha ----------
const MAPA = { ESCOLAFAC: "escola", ESCOLA: "escola", CURSO: "curso", TURMA: "turma", STATUS: "status", VENDEDOR: "vendedor", ID: "codigo",
  FORMANDO: "nome", DATA: "data", CELULAR1: "c1", CEL1: "c1", CEL2MAE: "c2", CELULAR2MAE: "c2", CEL3PAI: "c3", CELULAR3PAI: "c3", TELEFONE4: "c4", TEL4: "c4",
  EMAIL: "email", PAGAMENTO: "pagamento", FOTOS: "fotos", RUA: "rua", N: "numero", NO: "numero", NUMERO: "numero", COMPLEMENTO: "complemento",
  BAIRRO: "bairro", CIDADE: "cidade", OBS: "obs", OBSERVACAO: "obs", OBSERVACOES: "obs" };
const hkey = h => String(h || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function loadXLSX(){
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = () => res(window.XLSX); s.onerror = rej; document.head.append(s); });
}
function parseTel(v, tipo){
  if (v == null || v === "") return null;
  const raw = String(v);
  let d = raw.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length < 10 || d.length > 11) return null;
  const nm = (raw.match(/\(([^)]+)\)/) || [])[1] || raw.replace(/[\d()+\-./]/g, "").trim();
  return { tipo, nome: nm && /\p{L}/u.test(nm) ? nm.trim() : "", tel: d };
}
function parseData(v, X){
  if (!v) return "";
  if (v instanceof Date && !isNaN(v)) return C.ds(v);
  if (typeof v === "number") { const p = X.SSF.parse_date_code(v); return p ? `${p.y}-${C.pad(p.m)}-${C.pad(p.d)}` : ""; }
  const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${C.pad(m[2])}-${C.pad(m[1])}`; }
  return "";
}
function linhaParaDoc(r, X){
  const dataEnsaio = parseData(r.data, X);
  const ano = dataEnsaio ? Number(dataEnsaio.slice(0, 4)) : null;
  const contatos = [parseTel(r.c2, "Mãe"), parseTel(r.c3, "Pai"), parseTel(r.c1, "Formando"), parseTel(r.c4, "Telefone")].filter(Boolean);
  const vistos = new Set(); const cs = contatos.filter(c => !vistos.has(c.tel) && vistos.add(c.tel));
  const s = v => (v == null ? "" : String(v).trim());
  return {
    nome: s(r.nome), nomeBusca: norm(r.nome), escola: s(r.escola), curso: s(r.curso), turma: s(r.turma), statusOrig: s(r.status), vendedor: s(r.vendedor), codigo: s(r.codigo),
    dataEnsaio, ano, contatos: cs, telefones: cs.map(c => c.tel), email: s(r.email).toLowerCase(), pagamentoOrig: s(r.pagamento), fotosOrig: s(r.fotos),
    endereco: { rua: s(r.rua), numero: s(r.numero), complemento: s(r.complemento), bairro: s(r.bairro), cidade: s(r.cidade) }, obs: s(r.obs)
  };
}
function docId(d, i){ return [String(9999 - (d.ano || 0)).padStart(4, "0"), slug(d.escola).slice(0, 24) || "sem-escola", slug(d.codigo).slice(0, 24) || "x", slug(d.nome).slice(0, 32) || "r" + i].join("_"); }

function openImport(){
  if (!C.isAdmin) return;
  sheet("Importar planilha", (p, close) => {
    p.append(el("p", "hint", "Escolha o arquivo Excel (.xlsx) ou CSV com as colunas da planilha de formandos. Os dados vão direto do seu aparelho para o banco do app."));
    const inp = el("input"); inp.type = "file"; inp.accept = ".xlsx,.xls,.csv"; p.append(field("Arquivo", inp));
    const out = el("div", "imp"); p.append(out);
    const acts = actions(close, "Importar"); const ok = acts.querySelector("button[type=submit]"); ok.disabled = true; p.append(acts);
    let rows = [];
    inp.onchange = async () => {
      out.innerHTML = ""; ok.disabled = true; rows = [];
      const f = inp.files[0]; if (!f) return;
      out.append(el("p", "hint", "Lendo a planilha…"));
      try {
        const X = await loadXLSX();
        const wb = X.read(await f.arrayBuffer(), { type: "array", cellDates: true });
        const sh = wb.Sheets[wb.SheetNames[0]];
        const m = X.utils.sheet_to_json(sh, { header: 1, defval: "", raw: true });
        const hi = m.findIndex(r => r.some(c => hkey(c) === "FORMANDO"));
        if (hi < 0) throw new Error("Não achei a coluna FORMANDO na primeira aba.");
        const cols = m[hi].map(h => MAPA[hkey(h)] || null);
        for (const r of m.slice(hi + 1)) {
          const o = {}; cols.forEach((k, i) => { if (k && o[k] == null) o[k] = r[i]; });
          if (!String(o.nome || "").trim()) continue;
          rows.push(linhaParaDoc(o, X));
        }
        out.innerHTML = "";
        const incompletos = rows.filter(r => faltando(r).length);
        out.append(el("p", null, `${rows.length} formandos encontrados: ${rows.length - incompletos.length} completos e ${incompletos.length} incompletos.`));
        if (incompletos.length) {
          const cont = {}; incompletos.forEach(r => faltando(r).forEach(f => { cont[f] = (cont[f] || 0) + 1; }));
          out.append(el("p", "hint", "Os incompletos não entram na fila: ficam na aba Incompletos para vocês completarem. Falta " + Object.entries(cont).map(([f, n]) => `${f} em ${n}`).join(", ") + "."));
        }
        const porStatus = {}; rows.forEach(r => { const k = r.statusOrig || "(vazio)"; porStatus[k] = (porStatus[k] || 0) + 1; });
        out.append(el("p", "hint", "Quais STATUS entram no Repasse? Deixe marcado só quem NÃO comprou (CAÍDO). Quem está como VENDIDO já tem o kit."));
        const box = el("div", "quick");
        const temCaido = Object.keys(porStatus).some(k => /CA[IÍ]D/i.test(norm(k)));
        Object.entries(porStatus).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
          const l = el("label", "chk"); const c = el("input"); c.type = "checkbox"; c.checked = temCaido ? /CAID/.test(norm(k)) : true; c.value = k; l.append(c, document.createTextNode(` ${k} (${n})`)); box.append(l);
        });
        out.append(box);
        const porAno = {}; rows.forEach(r => { const k = r.ano || "sem data"; porAno[k] = (porAno[k] || 0) + 1; });
        out.append(el("p", "hint", "Por ano: " + Object.entries(porAno).sort().reverse().map(([a, n]) => `${a}: ${n}`).join(" · ")));
        ok.disabled = false;
      } catch (e) { out.innerHTML = ""; out.append(el("p", "err", "Não consegui ler o arquivo: " + (e.message || e))); }
    };
    p.addEventListener("submit", async ev => {
      ev.preventDefault(); if (!rows.length) return;
      const okStatus = new Set([...out.querySelectorAll("input[type=checkbox]")].filter(c => c.checked).map(c => c.value));
      const sel = rows.filter(r => okStatus.has(r.statusOrig || "(vazio)"));
      ok.disabled = true; inp.disabled = true;
      const prog = el("p", "hint", "Preparando…"); out.append(prog);
      try {
        // Quem já existe mantém a etapa e o histórico; só os dados da planilha são atualizados.
        const exist = new Set();
        const cnt = await FS.getCountFromServer(col);
        if (cnt.data().count) { prog.textContent = "Conferindo quem já está no app…"; (await FS.getDocs(col)).docs.forEach(d => exist.add(d.id)); }
        const ids = new Set(); const agora = new Date().toISOString(); let novos = 0, atual = 0;
        const escolas = Object.assign({}, meta.escolas || {}), anos = Object.assign({}, meta.anos || {});
        const ops = sel.map((d, i) => {
          let id = docId(d, i); while (ids.has(id)) id += "-" + i; ids.add(id);
          if (exist.has(id)) { atual++; return [id, Object.assign({}, d, { atualizadoEm: agora }), true]; }
          novos++; if (d.escola) escolas[d.escola] = (escolas[d.escola] || 0) + 1; if (d.ano) anos[d.ano] = (anos[d.ano] || 0) + 1;
          return [id, Object.assign({}, d, { etapa: faltando(d).length ? "INCOMPLETO" : "NA FILA", followup: null, tentativas: 0, tentInteresse: 0, resp: "", importadoEm: agora, atualizadoEm: agora }), false];
        });
        for (let i = 0; i < ops.length; i += 400) {
          const b = FS.writeBatch(db);
          ops.slice(i, i + 400).forEach(([id, data, merge]) => merge ? b.set(FS.doc(db, "repasse", id), data, { merge: true }) : b.set(FS.doc(db, "repasse", id), data));
          await b.commit();
          prog.textContent = `Importando… ${Math.min(i + 400, ops.length)} de ${ops.length}`;
        }
        await FS.setDoc(FS.doc(db, "config", "repasse_meta"), { escolas, anos, importadoEm: agora }, { merge: true });
        const nInc = ops.filter(([, d, m]) => !m && d.etapa === "INCOMPLETO").length;
        prog.textContent = `Pronto! ${novos - nInc} novos na fila${nInc ? `, ${nInc} na aba Incompletos` : ""}${atual ? ` e ${atual} atualizados` : ""}.`;
        C.toast("Planilha importada ✅");
        loadMeta(); refreshStats();
        const fechar = C.mkBtn("Fechar", "btn-primary", close); out.append(fechar);
      } catch (e) { console.warn(e); prog.textContent = ""; out.append(el("p", "err", e.code === "permission-denied" ? "Só administradores podem importar." : "A importação parou no meio. Pode importar o mesmo arquivo de novo: quem já entrou não é duplicado.")); ok.disabled = false; inp.disabled = false; }
    });
  });
}
