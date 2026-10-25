// Card Formaturas: tudo dos colégios fechados, separado do PR.
//  - Cobranças: parcelas vencidas e do mês, de todas as turmas, numa lista só
//  - 🎓 Colação de grau e 📘 Álbum de formatura: resumo por colégio
//  - Turmas: colégios fechados, com acesso à lista de formandos
// Quem não é administrador vê só as turmas dos colégios que fechou.
import { setCtx, openTurma, cobrarWa, registrarPagamento, atrasado } from "./turma.js";
import { brl, somar, recebido as recebidoDe, emAberto, pagasDe, nParcelas, quitado, vencDa, valorParcela, esperadas, ehColacao, pagamentosDe, fimDoMes } from "./regras.js";
import { el, title, avisoErro } from "./ui.js";
let C, FS, db, unsubs = [], forms = [], insts = [], aba = "cobrancas";
const $ = (id) => document.getElementById(id);
const moeda = brl;

export function init(ctx){ C = ctx; FS = ctx.FS; db = ctx.db; setCtx(ctx); }
export function hide(){ unsubs.forEach(u => u()); unsubs = []; }

export function show(){
  const v = $("viewFormaturas"); v.innerHTML = "";
  const head = el("div", "vhead"); head.append(el("h2", null, "Formaturas")); v.append(head);
  v.append(el("p", "hint", "Colação de grau e álbum de formatura dos colégios fechados. O PR fica no card próprio."));
  const k = el("div", "kpis"); k.id = "fmKpis"; v.append(k);
  const chips = el("div", "chips"); chips.id = "fmChips"; v.append(chips);
  const corpo = el("div"); corpo.id = "fmCorpo"; corpo.append(el("div", "empty", "Carregando…")); v.append(corpo);
  hide(); forms = []; insts = [];
  const erro = e => { avisoErro(e, "carregar as formaturas"); if (e.code === "permission-denied") { corpo.innerHTML = ""; corpo.append(el("div", "empty", "Cole as regras novas do Firebase para usar o card Formaturas.")); } };
  unsubs.push(FS.onSnapshot(FS.query(FS.collection(db, "formandos"), FS.limit(5000)), s => { forms = s.docs.map(d => Object.assign({ id: d.id }, d.data())); render(); }, erro));
  unsubs.push(FS.onSnapshot(FS.query(FS.collection(db, "instituicoes"), FS.where("etapa", "==", "FECHADO"), FS.limit(500)), s => { insts = s.docs.map(d => Object.assign({ id: d.id }, d.data())); render(); }, erro));
}

// Só as turmas que a pessoa pode ver
function minhasInsts(){ return C.isAdmin ? insts : insts.filter(i => i.respEmail ? i.respEmail === C.email : i.resp === C.me); }
function meusForms(){ const ids = new Set(minhasInsts().map(i => i.id)); return forms.filter(f => f.status !== "desistiu" && (C.isAdmin || ids.has(f.instId) || f.respEmail === C.email)); }

function render(){
  const k = $("fmKpis"), chips = $("fmChips"), corpo = $("fmCorpo"); if (!k) return;
  const fs = meusForms(), hoje = C.todayStr(), mes = hoje.slice(0, 7);
  const col = fs.filter(ehColacao), alb = fs.filter(f => !ehColacao(f));
  const recMes = somar(fs.flatMap(f => pagamentosDe(f).filter(p => String(p.data || "").slice(0, 7) === mes).map(p => p.valor)));
  const atr = fs.filter(atrasado);
  k.innerHTML = "";
  [["Recebido no mês", moeda(recMes)], ["🎓 Colação a receber", moeda(somar(col.map(emAberto)))], ["📘 Álbum a receber", moeda(somar(alb.map(emAberto)))], ["Parcelas atrasadas", String(atr.length)]]
    .forEach(([t, v], i) => { const c = el("div", "kpi" + (i === 3 && atr.length ? " late" : "")); c.append(el("small", null, t), el("b", null, v)); k.append(c); });
  const cob = cobrancas(fs);
  chips.innerHTML = "";
  [["cobrancas", "Cobranças", cob.length], ["colacao", "🎓 Colação", col.length], ["album", "📘 Álbum", alb.length], ["turmas", "Turmas", minhasInsts().length]].forEach(([kk, t, n]) => {
    const b = el("button", "chip", t); b.type = "button"; b.setAttribute("aria-pressed", String(aba === kk)); b.append(el("span", "n", String(n))); b.onclick = () => { aba = kk; render(); }; chips.append(b);
  });
  corpo.innerHTML = "";
  if (aba === "cobrancas") renderCobrancas(corpo, cob);
  else if (aba === "turmas") renderTurmas(corpo);
  else renderContrato(corpo, aba);
}

// Parcelas atrasadas e as que vencem até o fim do mês
function cobrancas(fs){
  const fim = fimDoMes(C.todayStr());
  return fs.filter(f => !quitado(f) && f.primeiroVenc && vencDa(f, pagasDe(f) + 1) <= fim)
    .map(f => ({ f, venc: vencDa(f, pagasDe(f) + 1) })).sort((a, b) => a.venc.localeCompare(b.venc) || (a.f.nome || "").localeCompare(b.f.nome || ""));
}
function renderCobrancas(corpo, cob){
  if (!cob.length) { const e = el("div", "empty"); e.append(el("strong", null, "Nenhuma parcela para cobrar este mês ✓"), el("span", null, "Aqui aparecem as parcelas atrasadas e as que vencem até o fim do mês, de todas as turmas.")); corpo.append(e); return; }
  const g = el("div", "grid");
  cob.forEach(({ f, venc }) => {
    const at = atrasado(f);
    const e = el("article", "card " + (at ? "late" : "today"));
    const top = el("div", "card-top"); top.append(el("h3", "name", title(f.nome)), el("span", "stage", at ? "ATRASADO" : "VENCE " + C.fmtDate(venc))); e.append(top);
    const meta = el("div", "meta"); [title(f.instNome), ehColacao(f) ? "🎓 Colação de grau" : "📘 " + (f.kit || "Álbum de formatura"), f.serie].filter(Boolean).forEach((t, i) => meta.append(el("span", "tag" + (i === 1 ? " svc" : ""), t))); e.append(meta);
    const pg = pagasDe(f), emAtraso = esperadas(f, C.todayStr()) - pg;
    e.append(el("div", "fu " + (at ? "late" : "today"), `Parcela ${pg + 1}/${nParcelas(f)} · ${moeda(valorParcela(f, pg + 1))} · ${at ? "venceu" : "vence"} ${C.fmtDate(venc)}` + (at && emAtraso > 1 ? ` · ${emAtraso} em atraso` : "")));
    const act = el("div", "actions");
    if (C.isAdmin) act.append(C.mkBtn("✅ Parcela paga", "btn-ok", () => registrarPagamento(f).catch(er => C.handleErr(er))));
    if (f.tel) act.append(C.mkBtn("💬 Cobrar", at ? "btn-primary" : "", () => cobrarWa(f)));
    const inst = insts.find(i => i.id === f.instId); if (inst) act.append(C.mkBtn("Ver turma", "", () => openTurma(C, inst, [])));
    e.append(act); g.append(e);
  });
  corpo.append(g);
}

function resumoInst(i, lst){
  return { n: lst.length, vend: somar(lst.map(f => f.valor)), rec: somar(lst.map(recebidoDe)), aberto: somar(lst.map(emAberto)), atr: lst.filter(atrasado).length };
}
function renderContrato(corpo, tipo){
  const colacao = tipo === "colacao";
  corpo.append(el("p", "hint", colacao ? "Contrato individual por aluno, pago no boleto. O valor de cada turma é definido pelo Adriano dentro da turma (🎓 Valor da colação)." : "Kits do álbum de formatura (Kit 01 a Kit 05 e outros)."));
  const g = el("div", "grid"); let algum = false;
  minhasInsts().forEach(i => {
    const lst = meusForms().filter(f => f.instId === i.id && (colacao ? ehColacao(f) : !ehColacao(f)));
    if (!lst.length && !(colacao && i.colacao && i.colacao.valor)) return;
    algum = true;
    const r = resumoInst(i, lst);
    const e = el("article", "card " + (r.atr ? "late" : ""));
    const top = el("div", "card-top"); top.append(el("h3", "name", title(i.nome)), el("span", "stage", `${r.n} aluno${r.n !== 1 ? "s" : ""}`)); e.append(top);
    const meta = el("div", "meta");
    if (colacao && i.colacao && i.colacao.valor) meta.append(el("span", "tag svc", `${moeda(i.colacao.valor)} em ${i.colacao.parcelas || 1}x`));
    if (i.formatura && i.formatura.data && i.formatura.status !== "recusado") meta.append(el("span", "tag", `🎓 ${C.fmtDate(i.formatura.data)}/${i.formatura.data.slice(0, 4)}`));
    if (!colacao) { const kits = {}; lst.forEach(f => { const kk = (f.kit || "Outro").split(" · ")[0]; kits[kk] = (kits[kk] || 0) + 1; }); Object.entries(kits).forEach(([kk, n]) => meta.append(el("span", "tag", `${kk}: ${n}`))); }
    e.append(meta);
    e.append(el("div", "fu" + (r.atr ? " late" : ""), `Vendido ${moeda(r.vend)} · recebido ${moeda(r.rec)} · em aberto ${moeda(r.aberto)}${r.atr ? ` · ${r.atr} atrasado${r.atr > 1 ? "s" : ""}` : ""}`));
    const act = el("div", "actions"); act.append(C.mkBtn("Abrir turma", "btn-primary", () => openTurma(C, i, []))); e.append(act);
    g.append(e);
  });
  if (!algum) { const e = el("div", "empty"); e.append(el("strong", null, colacao ? "Nenhuma colação de grau ainda" : "Nenhum álbum vendido ainda"), el("span", null, "Abra a turma do colégio fechado (aba Turmas) e inclua os formandos.")); corpo.append(e); return; }
  corpo.append(g);
}
function renderTurmas(corpo){
  const lst = minhasInsts();
  if (!lst.length) { const e = el("div", "empty"); e.append(el("strong", null, "Nenhum colégio fechado ainda"), el("span", null, "Quando uma instituição vira FECHADO, a turma aparece aqui.")); corpo.append(e); return; }
  const g = el("div", "grid");
  lst.slice().sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR")).forEach(i => {
    const fs = meusForms().filter(f => f.instId === i.id), r = resumoInst(i, fs);
    const e = el("article", "card" + (r.atr ? " late" : ""));
    const top = el("div", "card-top"); top.append(el("h3", "name", title(i.nome)), el("span", "stage", `${r.n} formando${r.n !== 1 ? "s" : ""}`)); e.append(top);
    const meta = el("div", "meta");
    [`🎓 ${fs.filter(ehColacao).length} colação`, `📘 ${fs.filter(f => !ehColacao(f)).length} álbum`, i.resp ? "👤 " + C.first(i.resp) : "", i.fechadoEm ? "Fechado em " + C.fmtDate(i.fechadoEm) : ""].filter(Boolean).forEach(t => meta.append(el("span", "tag", t)));
    e.append(meta);
    e.append(el("div", "fu" + (r.atr ? " late" : ""), `Vendido ${moeda(r.vend)} · recebido ${moeda(r.rec)} · em aberto ${moeda(r.aberto)}`));
    const act = el("div", "actions"); act.append(C.mkBtn("👥 Formandos e parcelas", "btn-primary", () => openTurma(C, i, []))); e.append(act);
    g.append(e);
  });
  corpo.append(g);
}
