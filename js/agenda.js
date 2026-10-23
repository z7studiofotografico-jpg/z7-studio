// Módulo Agendamento (primeira parte): compromissos marcados nas Instituições
// (formaturas e dias de fotos no colégio) e a aprovação da Luciana.
// Cada dia tem um documento agenda/AAAA-MM-DD; só quem aprova pode confirmar.
import { avisarColegioPorEmail } from "./instituicoes.js";
let C, FS, db, col, unsub = null, items = [];
const $ = (id) => document.getElementById(id);
const CAMPO = { formatura: "formatura", fotos: "diaFotos" };
const ICO = { formatura: "🎓", fotos: "📸" };
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function title(s){ return String(s || "").toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, w => w.toLowerCase()); }
function diaTxt(d){ const [y, m, dd] = d.split("-").map(Number); const dt = new Date(y, m - 1, dd); return `${SEMANA[dt.getDay()]}, ${C.pad(dd)}/${C.pad(m)}`; }

export function init(ctx){ C = ctx; FS = ctx.FS; db = ctx.db; col = FS.collection(db, "agenda"); }

export function show(){
  const v = $("viewAgenda"); v.innerHTML = "";
  const head = el("div", "vhead"); head.append(el("h2", null, "Agendamento")); v.append(head);
  v.append(el("p", "hint", C.aprovador ? "As datas sugeridas pelo vendedor ficam seguradas até você aprovar ou recusar." : "As datas que você sugere ficam seguradas até a Luciana aprovar."));
  const pend = el("section", "view"); pend.id = "agPend"; v.append(pend);
  const prox = el("section", "view"); prox.id = "agProx"; v.append(prox);
  prox.append(el("div", "empty", "Carregando…"));
  if (unsub) unsub();
  unsub = FS.onSnapshot(FS.query(col, FS.where("data", ">=", C.todayStr()), FS.orderBy("data"), FS.limit(400)), snap => {
    items = snap.docs.map(d => Object.assign({ id: d.id }, d.data())); render();
  }, err => { console.warn(err); C.showNotice(err.code === "permission-denied" ? "Você não tem acesso ao Agendamento." : "Não foi possível carregar a agenda."); });
}
export function hide(){ if (unsub) { unsub(); unsub = null; } }

function render(){
  const pend = $("agPend"), prox = $("agProx"); if (!pend) return;
  pend.innerHTML = ""; prox.innerHTML = "";
  const pendentes = items.filter(x => x.status === "pendente");
  if (pendentes.length) {
    // As datas de um mesmo pedido (dia de fotos + formatura) são aprovadas juntas
    const grupos = {}; pendentes.forEach(x => { const k = x.grupo || x.id; (grupos[k] = grupos[k] || []).push(x); });
    const lista = Object.values(grupos);
    pend.append(el("h3", "grp", `Para aprovar (${lista.length} pedido${lista.length > 1 ? "s" : ""})`));
    const g = el("div", "grid"); lista.forEach(gr => g.append(cardPedido(gr))); pend.append(g);
  }
  prox.append(el("h3", "grp", "Próximos compromissos"));
  if (!items.length) { const e = el("div", "empty"); e.append(el("strong", null, "Nada marcado ainda"), el("span", null, "As formaturas e os dias de fotos marcados nas Instituições aparecem aqui.")); prox.append(e); return; }
  let mes = "";
  const g = el("div", "grid");
  // Para quem aprova, os pendentes já aparecem em "Para aprovar"
  items.filter(x => !(C.aprovador && x.status === "pendente")).forEach(x => {
    const m = x.data.slice(0, 7);
    if (m !== mes) { mes = m; const h = el("h3", "grp", `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`); h.style.gridColumn = "1/-1"; g.append(h); }
    g.append(card(x));
  });
  prox.append(g);
}

function card(x){
  const e = el("article", "card " + (x.status === "confirmado" ? "won" : "today"));
  const top = el("div", "card-top");
  top.append(el("h3", "name", `${diaTxt(x.data)}${x.hora ? " · " + x.hora : ""}`), el("span", "stage", x.status === "confirmado" ? "CONFIRMADO" : "AGUARDANDO"));
  e.append(top);
  e.append(el("div", "meta", ""));
  e.lastChild.append(el("span", "tag svc", `${ICO[x.kind] || "📌"} ${x.tipo || ""}`), el("span", "tag", title(x.instNome)));
  const det = [x.onde && x.onde + (x.local ? " · " + x.local : ""), x.obs, x.pedidoPor && "Pedido por " + C.first(x.pedidoPor), x.aprovadoPor && "Aprovado por " + C.first(x.aprovadoPor)].filter(Boolean).join("\n");
  if (det) e.append(el("p", "notes", det));
  if (x.status === "pendente" && C.aprovador) {
    const act = el("div", "actions");
    act.append(C.mkBtn("✅ Aprovar", "btn-ok", () => aprovar(x)));
    act.append(C.mkBtn("❌ Recusar", "btn-danger", () => recusar(x)));
    e.append(act);
  } else if (x.status === "pendente") e.append(el("p", "wait", "⏳ Aguardando a Luciana aprovar"));
  return e;
}

function cardPedido(gr){
  gr.sort((a, b) => a.data.localeCompare(b.data));
  const x0 = gr[0];
  const e = el("article", "card today");
  const top = el("div", "card-top"); top.append(el("h3", "name", title(x0.instNome)), el("span", "stage", "AGUARDANDO")); e.append(top);
  gr.forEach(x => e.append(el("div", "fu today", `${ICO[x.kind] || "📌"} ${x.tipo}: ${diaTxt(x.data)}/${x.data.slice(0, 4)}${x.hora ? " às " + x.hora : ""}${x.onde ? " · " + x.onde : ""}${x.local ? " (" + x.local + ")" : ""}`)));
  const det = [gr.map(x => x.obs).filter(Boolean)[0], x0.pedidoPor && "Pedido por " + C.first(x0.pedidoPor)].filter(Boolean).join("\n");
  if (det) e.append(el("p", "notes", det));
  if (C.aprovador) {
    const act = el("div", "actions");
    act.append(C.mkBtn(gr.length > 1 ? "✅ Aprovar as " + gr.length + " datas" : "✅ Aprovar", "btn-ok", () => aprovarGrupo(gr)));
    act.append(C.mkBtn("❌ Recusar", "btn-danger", () => recusar(gr)));
    e.append(act);
  } else e.append(el("p", "wait", "⏳ Aguardando a Luciana aprovar"));
  return e;
}
async function aprovarGrupo(gr){
  try {
    const agora = new Date().toISOString();
    for (const x of gr) {
      await FS.updateDoc(FS.doc(db, "agenda", x.id), { status: "confirmado", aprovadoPor: C.me || "", aprovadoEm: agora });
      if (x.instId && CAMPO[x.kind]) await FS.updateDoc(FS.doc(db, "instituicoes", x.instId), { [CAMPO[x.kind] + ".status"]: "confirmado", atualizadoEm: agora }).catch(() => {});
    }
    let n = 0; try { n = await avisarColegioPorEmail(gr[0].instId, C); } catch (e) { console.warn(e); }
    C.toast(`Aprovado ✅${n ? ` · e-mail com as datas vai para ${n} contato${n > 1 ? "s" : ""}` : " · o colégio não tem e-mail cadastrado"}`);
  } catch (e) { C.handleErr(e); }
}
async function aprovar(x){
  try {
    const agora = new Date().toISOString();
    await FS.updateDoc(FS.doc(db, "agenda", x.id), { status: "confirmado", aprovadoPor: C.me || "", aprovadoEm: agora });
    if (x.instId && CAMPO[x.kind]) await FS.updateDoc(FS.doc(db, "instituicoes", x.instId), { [CAMPO[x.kind] + ".status"]: "confirmado", atualizadoEm: agora }).catch(() => {});
    C.toast(`Aprovado: ${x.tipo} em ${C.fmtDate(x.data)}`);
  } catch (e) { C.handleErr(e); }
}

function recusar(arg){
  const gr = Array.isArray(arg) ? arg : [arg], x = gr[0];
  const sh = el("div", "sheet"); const p = el("form", "panel"); sh.append(p);
  const close = () => sh.remove(); sh.addEventListener("click", ev => { if (ev.target === sh) close(); });
  p.append(el("h2", null, gr.length > 1 ? "Recusar as datas" : "Recusar data"), el("p", "hint", `${title(x.instNome)} · ${gr.map(g => g.tipo + " " + diaTxt(g.data)).join(" + ")}. ${gr.length > 1 ? "Os dias ficam" : "O dia fica"} livre${gr.length > 1 ? "s" : ""} de novo.`));
  const mot = el("input"); mot.id = "agMot"; mot.maxLength = 200; mot.placeholder = "ex.: já tenho ensaio nesse dia";
  const sug = el("input"); sug.id = "agSug"; sug.type = "date"; sug.min = C.todayStr();
  const f1 = el("div", "field"); const l1 = el("label", null, "Motivo"); l1.htmlFor = "agMot"; f1.append(l1, mot);
  const f2 = el("div", "field"); const l2 = el("label", null, gr.length > 1 ? "Sugerir outro dia para a formatura (opcional)" : "Sugerir outro dia (opcional)"); l2.htmlFor = "agSug"; f2.append(l2, sug);
  const a = el("div", "panel-actions"); const sp = el("span"); sp.style.flex = "1"; const c = el("button", "btn", "Cancelar"); c.type = "button"; c.onclick = close;
  const ok = el("button", "btn btn-danger", "Recusar e liberar o dia"); ok.type = "submit"; a.append(sp, c, ok);
  p.append(f1, f2, a); document.body.append(sh); setTimeout(() => mot.focus(), 30);
  p.addEventListener("submit", async ev => {
    ev.preventDefault(); close();
    try {
      for (const y of gr) {
        await FS.deleteDoc(FS.doc(db, "agenda", y.id));
        if (y.instId && CAMPO[y.kind]) {
          const k = CAMPO[y.kind];
          await FS.updateDoc(FS.doc(db, "instituicoes", y.instId), { [k + ".status"]: "recusado", [k + ".motivoRecusa"]: mot.value.trim(), [k + ".sugestao"]: y.kind === "formatura" || gr.length === 1 ? (sug.value || "") : "", atualizadoEm: new Date().toISOString() }).catch(() => {});
        }
      }
      C.toast(gr.length > 1 ? "Datas recusadas. Os dias ficaram livres." : "Data recusada. O dia ficou livre.");
    } catch (e) { C.handleErr(e); }
  });
}

// Quantos compromissos esperam aprovação (para o cartão da tela inicial)
export async function contarPendentes(ctx){
  const s = await ctx.FS.getDocs(ctx.FS.query(ctx.FS.collection(ctx.db, "agenda"), ctx.FS.where("status", "==", "pendente"), ctx.FS.limit(200)));
  return s.size;
}
