// Card Aluguel de becas: para os nossos eventos e para outros eventos.
// Coleção "becas": { cliente, tel, tipoEvento ("nosso" | "outro"), evento, dataEvento, retirada, retiradaHora, devolucao,
//   qtd, itens: { beca, capelo, faixa, jabor }, corFaixa, tamanhos, valor, caucao, pago, formaPag, status, obs }
// Status: reservado → retirado → devolvido (ou cancelado). Retirada e devolução aparecem no Agendamento.
let C, FS, db, col, unsubs = [], lista = [], aba = "proximas";
const $ = (id) => document.getElementById(id);
const n0 = v => Number(v) || 0;
function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function title(s){ return String(s || "").toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, w => w.toLowerCase()); }
let fid = 0;
function field(lbl, i){ const f = el("div", "field"); const l = el("label", null, lbl); i.id = i.id || "bc" + (++fid); l.htmlFor = i.id; f.append(l, i); return f; }
function inp(v, ph, max){ const i = el("input"); i.value = v == null ? "" : v; i.placeholder = ph || ""; i.maxLength = max || 120; return i; }
const ITENS = [["beca", "Beca"], ["capelo", "Capelo"], ["faixa", "Faixa"], ["jabor", "Jabor"]];
const FORMAS = ["Pix", "Cartão", "Link", "Dinheiro", "Boleto"];
const ENDERECO = "Estrada Dr. Rufino Gonçalves Ferreira, 290, Centro, Nilópolis";
const ativo = b => b.status !== "devolvido" && b.status !== "cancelado";
export const atrasada = (b, hoje) => b.status === "retirado" && b.devolucao && b.devolucao < hoje;

export function init(ctx){ C = ctx; FS = ctx.FS; db = ctx.db; col = FS.collection(db, "becas"); }
export function hide(){ unsubs.forEach(u => u()); unsubs = []; }

export function show(){
  const v = $("viewBecas"); v.innerHTML = "";
  const head = el("div", "vhead"); head.append(el("h2", null, "Aluguel de becas"), C.mkBtn("+ Aluguel", "btn-primary btn-sm", () => form())); v.append(head);
  v.append(el("p", "hint", "Para os nossos eventos e para outros eventos. A retirada e a devolução aparecem no Agendamento."));
  const k = el("div", "kpis"); k.id = "bcKpis"; v.append(k);
  const chips = el("div", "chips"); chips.id = "bcChips"; v.append(chips);
  const corpo = el("div", "grid"); corpo.id = "bcLista"; corpo.append(el("div", "empty", "Carregando…")); v.append(corpo);
  hide(); lista = [];
  let a = [], b = [];
  const junta = () => { const m = new Map(); [...a, ...b].forEach(x => m.set(x.id, x)); lista = [...m.values()]; render(); };
  const erro = e => { console.warn(e); if (e.code === "permission-denied") { corpo.innerHTML = ""; corpo.append(el("div", "empty", "Cole as regras novas do Firebase para usar o Aluguel de becas.")); } };
  // Aluguéis recentes e futuros + os que ainda estão fora do estúdio (mesmo antigos)
  unsubs.push(FS.onSnapshot(FS.query(col, FS.where("devolucao", ">=", C.addDays(-60)), FS.orderBy("devolucao"), FS.limit(800)), s => { a = s.docs.map(d => Object.assign({ id: d.id }, d.data())); junta(); }, erro));
  unsubs.push(FS.onSnapshot(FS.query(col, FS.where("status", "==", "retirado"), FS.limit(300)), s => { b = s.docs.map(d => Object.assign({ id: d.id }, d.data())); junta(); }, erro));
}

// Quantas becas estão comprometidas entre duas datas (para conferir o estoque)
function emUso(de, ate, ignora){
  return lista.filter(x => x.id !== ignora && ativo(x) && x.retirada && x.devolucao && x.retirada <= ate && x.devolucao >= de).reduce((s, x) => s + n0(x.qtd), 0);
}

function render(){
  const k = $("bcKpis"), chips = $("bcChips"), corpo = $("bcLista"); if (!k) return;
  const hoje = C.todayStr(), em7 = C.addDays(7);
  const fora = lista.filter(x => x.status === "retirado"), atr = lista.filter(x => atrasada(x, hoje));
  const prox = lista.filter(x => x.status === "reservado"), aRec = lista.filter(ativo).reduce((s, x) => s + Math.max(0, n0(x.valor) - n0(x.pago)), 0);
  k.innerHTML = "";
  const est = n0(C.P.estoqueBecas);
  [["Becas fora agora", `${fora.reduce((s, x) => s + n0(x.qtd), 0)}${est ? " de " + est : ""}`], ["Retiradas em 7 dias", String(prox.filter(x => x.retirada <= em7).length)], ["Devoluções atrasadas", String(atr.length)], ["A receber", C.money(Math.round(aRec))]]
    .forEach(([t, v], i) => { const c = el("div", "kpi" + (i === 2 && atr.length ? " late" : "")); c.append(el("small", null, t), el("b", null, v)); k.append(c); });
  const abas = [["proximas", "Reservados", prox.length], ["fora", "Fora do estúdio", fora.length], ["atrasadas", "Atrasados", atr.length], ["devolvidas", "Devolvidos", lista.filter(x => x.status === "devolvido").length], ["todas", "Todos", lista.length]];
  chips.innerHTML = "";
  abas.forEach(([kk, t, n]) => { const b = el("button", "chip", t); b.type = "button"; b.setAttribute("aria-pressed", String(aba === kk)); b.append(el("span", "n", String(n))); b.onclick = () => { aba = kk; render(); }; chips.append(b); });
  let arr = aba === "proximas" ? prox : aba === "fora" ? fora : aba === "atrasadas" ? atr : aba === "devolvidas" ? lista.filter(x => x.status === "devolvido") : lista;
  arr = arr.slice().sort((a, b) => aba === "devolvidas" ? (b.devolucao || "").localeCompare(a.devolucao || "") : ((aba === "fora" || aba === "atrasadas" ? a.devolucao : a.retirada) || "").localeCompare((aba === "fora" || aba === "atrasadas" ? b.devolucao : b.retirada) || ""));
  corpo.innerHTML = "";
  if (!arr.length) { const e = el("div", "empty"); e.append(el("strong", null, aba === "atrasadas" ? "Nenhuma devolução atrasada ✓" : "Nada por aqui"), el("span", null, "Toque em “+ Aluguel” para registrar um aluguel de becas.")); corpo.append(e); return; }
  arr.forEach(x => corpo.append(card(x)));
}

function card(x){
  const hoje = C.todayStr(), at = atrasada(x, hoje);
  const st = x.status === "cancelado" ? "CANCELADO" : x.status === "devolvido" ? "DEVOLVIDO" : at ? "ATRASADO" : x.status === "retirado" ? "FORA DO ESTÚDIO" : "RESERVADO";
  const e = el("article", "card " + (at ? "late" : x.status === "devolvido" ? "won" : x.status === "reservado" && x.retirada <= C.addDays(1) ? "today" : ""));
  const top = el("div", "card-top"); top.append(el("h3", "name", title(x.cliente)), el("span", "stage", st)); e.append(top);
  const meta = el("div", "meta");
  [`👘 ${n0(x.qtd)} beca${n0(x.qtd) !== 1 ? "s" : ""}`, x.tipoEvento === "nosso" ? "Nosso evento" : "Outro evento", x.evento, ITENS.filter(([kk]) => x.itens && x.itens[kk]).map(([, t]) => t).join(" + "), x.corFaixa ? "Faixa " + x.corFaixa : "", x.valor ? C.money(x.valor) : ""]
    .filter(Boolean).forEach((t, i) => meta.append(el("span", "tag" + (i === 0 ? " svc" : ""), t)));
  e.append(meta);
  const datas = [x.retirada && `Retirada ${C.fmtDate(x.retirada)}${x.retiradaHora ? " " + x.retiradaHora : ""}`, x.dataEvento && `Evento ${C.fmtDate(x.dataEvento)}`, x.devolucao && `Devolução ${C.fmtDate(x.devolucao)}`].filter(Boolean).join(" · ");
  e.append(el("div", "fu " + (at ? "late" : ""), at ? `Devolução atrasada desde ${C.fmtDate(x.devolucao)} · ${datas}` : datas));
  const pend = Math.max(0, n0(x.valor) - n0(x.pago));
  const notas = [x.tamanhos && "Tamanhos: " + x.tamanhos, x.caucao ? `Caução: ${C.money(x.caucao)}` : "", n0(x.valor) ? (pend ? `Falta receber ${C.money(pend)}` : "Pago ✓") + (x.formaPag ? ` (${x.formaPag})` : "") : "", x.faltou && "⚠️ Faltou na devolução: " + x.faltou, x.obs].filter(Boolean).join("\n");
  if (notas) e.append(el("p", "notes", notas));
  const act = el("div", "actions");
  if (x.status === "reservado") {
    act.append(C.mkBtn("📦 Retirou", "btn-ok", () => salvar(x, { status: "retirado", retiradoEm: C.todayStr() }, "Marcado como retirado")));
    if (x.tel) act.append(C.mkBtn("📲 Lembrar retirada", "", () => wa(x, `Oi, ${C.first(title(x.cliente))}! Aqui é do Z7 Studio Fotográfico 📸 Passando para lembrar da retirada ${x.qtd > 1 ? "das " + x.qtd + " becas" : "da beca"} ${x.retirada === hoje ? "hoje" : "dia " + C.fmtDate(x.retirada)}${x.retiradaHora ? " às " + x.retiradaHora : ""}, aqui no estúdio: ${ENDERECO}.${pend ? ` Fica faltando ${C.money(pend)}.` : ""} Até lá! 😊`)));
  }
  if (x.status === "retirado") {
    act.append(C.mkBtn("↩️ Devolveu", "btn-ok", () => devolver(x)));
    if (x.tel) act.append(C.mkBtn(at ? "💬 Cobrar devolução" : "📲 Lembrar devolução", at ? "btn-primary" : "", () => wa(x, at
      ? `Oi, ${C.first(title(x.cliente))}! Aqui é do Z7 Studio Fotográfico 📸 A devolução ${x.qtd > 1 ? "das becas" : "da beca"} era dia ${C.fmtDate(x.devolucao)}. Consegue trazer hoje no estúdio? Endereço: ${ENDERECO}. Obrigado! 😊`
      : `Oi, ${C.first(title(x.cliente))}! Aqui é do Z7 Studio Fotográfico 📸 Só lembrando que a devolução ${x.qtd > 1 ? "das becas" : "da beca"} é dia ${C.fmtDate(x.devolucao)}, aqui no estúdio: ${ENDERECO}. Obrigado! 😊`)));
  }
  act.append(C.mkBtn("Editar", "", () => form(x)));
  e.append(act); return e;
}
function wa(x, msg){ const d = C.digits(x.tel); if (!d) { C.toast("Sem WhatsApp cadastrado"); return; } window.open(`https://wa.me/${d}?text=${encodeURIComponent(msg)}`, "_blank", "noopener"); }
async function salvar(x, patch, msg){ try { await FS.updateDoc(FS.doc(db, "becas", x.id), Object.assign(patch, { atualizadoEm: new Date().toISOString() })); C.toast(msg); } catch (e) { C.handleErr(e); } }

function sheet(tit, build){
  const sh = el("div", "sheet"); const p = el("form", "panel"); p.autocomplete = "off"; sh.append(p);
  const close = () => sh.remove(); sh.addEventListener("click", ev => { if (ev.target === sh) close(); });
  p.append(el("h2", null, tit)); build(p, close); document.body.append(sh); return close;
}
function botoes(close, okTxt){ const a = el("div", "panel-actions"); const sp = el("span"); sp.style.flex = "1"; const c = el("button", "btn", "Cancelar"); c.type = "button"; c.onclick = close; const ok = el("button", "btn btn-primary", okTxt); ok.type = "submit"; a.append(sp, c, ok); a.ok = ok; return a; }

function devolver(x){
  sheet("Devolução · " + title(x.cliente), (p, close) => {
    p.append(el("p", "hint", `${n0(x.qtd)} beca${n0(x.qtd) !== 1 ? "s" : ""} · ${ITENS.filter(([kk]) => x.itens && x.itens[kk]).map(([, t]) => t).join(" + ") || "beca"}`));
    const tudoL = el("label", "chk"); const tudo = el("input"); tudo.type = "checkbox"; tudo.checked = true; tudoL.append(tudo, document.createTextNode(" Devolveu tudo, em bom estado")); p.append(tudoL);
    const falt = inp("", "ex.: 1 capelo, faixa manchada"); const fb = field("O que faltou ou voltou com problema", falt); fb.hidden = true; p.append(fb);
    tudo.onchange = () => { fb.hidden = tudo.checked; };
    const pend = Math.max(0, n0(x.valor) - n0(x.pago));
    const pg = el("label", "chk"); const pgC = el("input"); pgC.type = "checkbox"; pg.append(pgC, document.createTextNode(` Recebeu o que faltava (${C.money(pend)})`)); if (pend) p.append(pg);
    p.append(botoes(close, "Confirmar devolução"));
    p.addEventListener("submit", ev => {
      ev.preventDefault(); close();
      const patch = { status: "devolvido", devolvidoEm: C.todayStr(), faltou: tudo.checked ? "" : falt.value.trim() || "a conferir" };
      if (pgC.checked) patch.pago = n0(x.valor);
      salvar(x, patch, tudo.checked ? "Devolvido ✅" : "Devolvido com pendência");
    });
  });
}

export function form(x, pre){
  pre = pre || {};
  sheet(x ? "Editar aluguel" : "Novo aluguel de becas", (p, close) => {
    const cli = inp(x ? x.cliente : pre.cliente || "", "nome de quem aluga"); cli.required = true;
    const tel = inp(x ? x.tel : "", "(21) 9…", 30); tel.inputMode = "tel";
    const r1 = el("div", "row2"); r1.append(field("Cliente", cli), field("WhatsApp", tel)); p.append(r1);
    const tipo = el("select"); [["outro", "Outro evento"], ["nosso", "Nosso evento (Z7)"]].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; tipo.append(o); }); tipo.value = x ? x.tipoEvento || "outro" : pre.tipoEvento || "outro";
    const ev = inp(x ? x.evento : pre.evento || "", "ex.: Colação Colégio Alfa, Igreja X"); const dl = el("datalist"); dl.id = "bcEv" + (++fid); ev.setAttribute("list", dl.id);
    if (C.pode("colegios")) FS.getDocs(FS.query(FS.collection(db, "instituicoes"), FS.where("etapa", "==", "FECHADO"), FS.limit(300))).then(s => s.docs.forEach(d => { const o = el("option"); o.value = title(d.data().nome); dl.append(o); })).catch(() => {});
    const r2 = el("div", "row2"); r2.append(field("Tipo", tipo), field("Evento / local", ev)); p.append(r2, dl);
    const dEv = el("input"); dEv.type = "date"; dEv.value = x ? x.dataEvento || "" : pre.dataEvento || "";
    const ret = el("input"); ret.type = "date"; ret.required = true; ret.value = x ? x.retirada || "" : pre.retirada || "";
    const retH = el("input"); retH.type = "time"; retH.step = 900; retH.value = x ? x.retiradaHora || "" : "";
    const dev = el("input"); dev.type = "date"; dev.required = true; dev.value = x ? x.devolucao || "" : "";
    const r3 = el("div", "row2"); r3.append(field("Retirada", ret), field("Horário da retirada", retH));
    const r4 = el("div", "row2"); r4.append(field("Data do evento", dEv), field("Devolução", dev)); p.append(r3, r4);
    dEv.addEventListener("change", () => { if (dEv.value && !dev.value) { const [y, m, d] = dEv.value.split("-").map(Number); const t = new Date(y, m - 1, d + 1); dev.value = `${t.getFullYear()}-${C.pad(t.getMonth() + 1)}-${C.pad(t.getDate())}`; } if (dEv.value && !ret.value) { const [y, m, d] = dEv.value.split("-").map(Number); const t = new Date(y, m - 1, d - 1); ret.value = `${t.getFullYear()}-${C.pad(t.getMonth() + 1)}-${C.pad(t.getDate())}`; } checa(); });
    const qtd = inp(x ? x.qtd : pre.qtd || "1", "1", 4); qtd.inputMode = "numeric";
    const cor = inp(x ? x.corFaixa : "", "ex.: azul royal", 40);
    const r5 = el("div", "row2"); r5.append(field("Quantidade de becas", qtd), field("Cor da faixa", cor)); p.append(r5);
    const itBox = el("div", "quick"); const its = ITENS.map(([kk, t]) => { const l = el("label", "chk"); const c = el("input"); c.type = "checkbox"; c.checked = x ? !!(x.itens && x.itens[kk]) : kk === "beca" || kk === "capelo" || kk === "faixa"; l.append(c, document.createTextNode(" " + t)); itBox.append(l); return [kk, c]; });
    { const f = el("div", "field"); f.append(el("label", null, "Itens"), itBox); p.append(f); }
    const tam = inp(x ? x.tamanhos : "", "ex.: 3 P, 5 M, 2 G", 200); p.append(field("Tamanhos", tam));
    const val = inp(x ? x.valor || "" : "", "R$", 10); val.inputMode = "decimal";
    const pago = inp(x ? x.pago || "" : "", "R$", 10); pago.inputMode = "decimal";
    const cau = inp(x ? x.caucao || "" : "", "R$", 10); cau.inputMode = "decimal";
    const r6 = el("div", "row3"); r6.append(field("Valor total", val), field("Já pago", pago), field("Caução", cau)); p.append(r6);
    const fp = el("select"); [["", "forma de pagamento"], ...FORMAS.map(f => [f, f])].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; fp.append(o); }); fp.value = x ? x.formaPag || "" : "";
    p.append(field("Pagamento", fp));
    const obs = el("textarea"); obs.rows = 2; obs.maxLength = 600; obs.value = x ? x.obs || "" : ""; p.append(field("Observação", obs));
    const info = el("p", "notes"); info.hidden = true; p.append(info);
    const err = el("p", "err"); err.hidden = true; p.append(err);
    function checa(){
      err.hidden = true; p._ok = false;
      if (!ret.value || !dev.value) { info.hidden = true; return; }
      const usado = emUso(ret.value, dev.value, x && x.id), est = n0(C.P.estoqueBecas);
      info.textContent = est ? `Nesse período já estão comprometidas ${usado} de ${est} becas. Livres: ${Math.max(0, est - usado)}.` : `Nesse período já estão comprometidas ${usado} becas. (Coloque o estoque em Ajustes para o app conferir.)`;
      info.hidden = false;
    }
    [ret, dev, qtd].forEach(i => i.addEventListener("change", checa)); if (x) checa();
    const a = botoes(close, x ? "Salvar" : "Registrar aluguel");
    if (x && x.status !== "cancelado") { const cb = el("button", "btn btn-danger", "Cancelar aluguel"); cb.type = "button"; a.prepend(cb); cb.onclick = () => { if (!p._can) { p._can = true; cb.textContent = "Toque de novo"; return; } close(); salvar(x, { status: "cancelado" }, "Aluguel cancelado"); }; }
    p.append(a);
    p.addEventListener("submit", async ev2 => {
      ev2.preventDefault();
      if (dev.value < ret.value) { err.textContent = "A devolução precisa ser depois da retirada."; err.hidden = false; return; }
      const est = n0(C.P.estoqueBecas), usado = emUso(ret.value, dev.value, x && x.id), q = n0(qtd.value) || 1;
      if (est && usado + q > est && !p._ok) { p._ok = true; a.ok.textContent = "Registrar mesmo assim"; err.textContent = `Não tem becas suficientes: ${usado} já comprometidas + ${q} = ${usado + q}, e o estoque é ${est}. Toque de novo para registrar mesmo assim.`; err.hidden = false; return; }
      const body = { cliente: cli.value.trim(), tel: tel.value.trim(), tipoEvento: tipo.value, evento: ev.value.trim(), dataEvento: dEv.value, retirada: ret.value, retiradaHora: retH.value, devolucao: dev.value,
        qtd: q, itens: Object.fromEntries(its.map(([kk, c]) => [kk, c.checked])), corFaixa: cor.value.trim(), tamanhos: tam.value.trim(), valor: C.num(val.value), pago: C.num(pago.value), caucao: C.num(cau.value), formaPag: fp.value, obs: obs.value.trim(), atualizadoEm: new Date().toISOString() };
      try {
        if (x) await FS.updateDoc(FS.doc(db, "becas", x.id), body);
        else await FS.addDoc(col, Object.assign(body, { status: "reservado", criadoEm: new Date().toISOString(), por: C.me || "" }));
        close(); C.toast(x ? "Aluguel salvo" : `Aluguel registrado: retirada ${C.fmtDate(ret.value)}`);
      } catch (e) { C.handleErr(e); }
    });
    setTimeout(() => cli.focus(), 30);
  });
}
