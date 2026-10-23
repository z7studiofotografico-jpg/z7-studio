// Módulo Instituições: colégio particular, colégio público, colégio profissionalizante e faculdade.
// Primeira versão comum aos 4 tipos: lista, cadastro, registro de visita, próximo passo com data
// (aparece em "Para hoje" e no lembrete das 9h) e importação da planilha.
let C, FS, db, col;
let tipo = "particular", tab = "hoje", items = [], unsub = null, filtroEtapa = "";
const $ = (id) => document.getElementById(id);

export const TIPOS = {
  particular: { nome: "Colégio particular", ico: "🏫" },
  publico: { nome: "Colégio público", ico: "🏛️" },
  profissionalizante: { nome: "Colégio profissionalizante", ico: "🛠️" },
  faculdade: { nome: "Faculdade", ico: "🎓" }
};
const ETAPAS = ["A VISITAR", "AGENDAR VISITA", "VISITADO", "PROPOSTA ENVIADA", "FECHADO", "NÃO FECHOU"];
const ABERTAS = ["A VISITAR", "AGENDAR VISITA", "VISITADO", "PROPOSTA ENVIADA"];
const CARGOS = ["Direção", "Coordenação", "Secretaria", "Recepção", "Comissão de formatura", "Professor(a)", "Outro"];
const FOTOGRAFO = ["Não tem fotógrafo", "Só datas comemorativas", "Já tem empresa de formatura", "Não sei"];
const RESULTADOS = [
  ["Fechou 🎉", "FECHADO"], ["Gostou, vai analisar", "VISITADO"], ["Vai decidir em reunião", "VISITADO"],
  ["Pediu proposta / mostruário", "PROPOSTA ENVIADA"], ["Não falou com quem decide", "AGENDAR VISITA"], ["Não atendeu / fechado", "AGENDAR VISITA"],
  ["Já tem fotógrafo", "NÃO FECHOU"], ["Sem interesse / sem verba", "NÃO FECHOU"]
];
const PASSOS = ["Ligar para agendar", "Chamar no WhatsApp", "Mandar e-mail", "Enviar mostruário", "Voltar para visita", "Esperar reunião"];
// Kits e serviços oferecidos aos colégios (público e particular). Os preços ficam em "Preços dos kits".
const PRODUTOS_PADRAO = [
  { nome: "Canudo personalizado" }, { nome: "Aluguel de beca completa" }, { nome: "Kit Paspatur" },
  { nome: "Kit Quadro + PR" }, { nome: "Álbum" },
  { nome: "Formatura no colégio", formatura: "Colégio" }, { nome: "Formatura no salão", formatura: "Salão" }
];

// Segmentos que interessam para formatura
const SEGMENTOS = [["pre", "Pré"], ["ano5", "5º ano"], ["ano9", "9º ano"], ["medio", "Ensino médio"]];

// ---------- utilidades ----------
function norm(s){ return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim(); }
function slug(s){ return norm(s).replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase(); }
function title(s){ return String(s || "").toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, w => w.toLowerCase()); }
function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function eu(){ const f = C.first(C.me); return f ? (/a$/i.test(f) ? "a " : "o ") + f : "a equipe"; }
function status(it){
  if (it.etapa === "FECHADO") return "won";
  if (!it.followup) return "none";
  const t = C.todayStr(); return it.followup < t ? "late" : it.followup === t ? "today" : "later";
}
function lockInfo(it){
  const a = it.atendendo; if (!a || !a.por || !a.desde) return null;
  const mins = (Date.now() - Date.parse(a.desde)) / 60000; if (!(mins >= 0 && mins <= 30)) return null;
  return { por: a.por, desde: a.desde, mine: a.por === C.me };
}
function anoQueVem(){ return (new Date().getFullYear() + 1) + "-02-02"; }
function produtos(){ const pr = C.P.precosInst || {}; return PRODUTOS_PADRAO.map(x => Object.assign({}, x, { preco: pr[x.nome] || "" })); }

// ---------- compromissos na agenda (formatura e dia de fotos) ----------
// Cada dia só tem UM compromisso: o documento agenda/AAAA-MM-DD guarda quem ocupou o dia.
// O vendedor sugere a data (fica "pendente", o dia já fica segurado) e só a Luciana confirma.
export const KINDS = {
  formatura: { campo: "formatura", nome: "Formatura", ico: "🎓" },
  fotos: { campo: "diaFotos", nome: "Dia de fotos no colégio", ico: "📸" }
};
const STATUS_TXT = { pendente: "⏳ aguardando a Luciana", confirmado: "✅ confirmado", recusado: "❌ recusado" };
// Reserva um ou mais dias de uma vez (ex.: dia de fotos + formatura). Tudo ou nada.
async function reservarVarios(it, pares){
  for (const [kind, f] of pares) { const atual = it[KINDS[kind].campo];
    if (atual && atual.status === "confirmado" && !C.aprovador && atual.data !== f.data) { const e = new Error("confirmado"); e.code = "confirmado"; throw e; } }
  const datas = pares.map(([, f]) => f.data); if (new Set(datas).size !== datas.length) { const e = new Error("mesmo dia"); e.code = "mesmodia"; throw e; }
  const status = C.aprovador ? "confirmado" : "pendente", grupo = it.id + "_" + Date.now(), agora = new Date().toISOString();
  await FS.runTransaction(db, async tx => {
    const leit = [];
    for (const [kind, f] of pares) {
      const atual = it[KINDS[kind].campo];
      const novo = FS.doc(db, "agenda", f.data);
      const antigo = atual && atual.data && atual.data !== f.data && atual.status !== "recusado" ? FS.doc(db, "agenda", atual.data) : null;
      leit.push({ kind, f, novo, antigo, s0: await tx.get(novo), s1: antigo ? await tx.get(antigo) : null });
    }
    for (const x of leit) if (x.s0.exists() && !(x.s0.data().instId === it.id && x.s0.data().kind === x.kind)) { const e = new Error("ocupado"); e.code = "ocupado"; e.ocupado = x.s0.data(); throw e; }
    for (const x of leit) {
      if (x.s1 && x.s1.exists() && x.s1.data().instId === it.id && x.s1.data().kind === x.kind) tx.delete(x.antigo);
      tx.set(x.novo, { data: x.f.data, hora: x.f.hora || "", kind: x.kind, tipo: KINDS[x.kind].nome, local: x.f.local || "", onde: x.f.onde || "", obs: x.f.obs || "", status, grupo,
        instId: it.id, instNome: it.nome, instTipo: it.tipo, pedidoPor: C.me || "", em: agora,
        ...(status === "confirmado" ? { aprovadoPor: C.me || "", aprovadoEm: agora } : {}) });
    }
  });
  return { status, grupo };
}
async function reservar(it, kind, f){ return (await reservarVarios(it, [[kind, f]])).status; }
async function liberar(it, kind){
  const ev = it[KINDS[kind].campo]; if (!ev || !ev.data || ev.status === "recusado") return;
  const ref = FS.doc(db, "agenda", ev.data);
  await FS.runTransaction(db, async tx => { const s0 = await tx.get(ref); if (s0.exists() && s0.data().instId === it.id && s0.data().kind === kind) tx.delete(ref); });
}
function msgErroData(e){
  if (e.code === "ocupado") return msgOcupado(e);
  if (e.code === "confirmado") return "Essa data já foi confirmada pela Luciana. Para mudar, fale com ela.";
  if (e.code === "mesmodia") return "O dia das fotos e o dia da formatura precisam ser dias diferentes.";
  if (e.code === "ordem") return "O dia de medir beca e fazer o ensaio precisa ser ANTES da formatura.";
  return "Não foi possível reservar o dia.";
}
function msgOcupado(e){ const o = e.ocupado || {}; return `O dia ${C.fmtDate(o.data)}/${String(o.data || "").slice(0, 4)} já está ocupado: ${o.tipo || "compromisso"} de ${title(o.instNome)}${o.hora ? " às " + o.hora : ""} (${o.status === "confirmado" ? "confirmado" : "aguardando a Luciana"}). Escolha outra data.`; }
function camposEvento(kind, f){
  const K = KINDS[kind], box = el("div", "imp");
  const data = el("input"); data.type = "date"; data.value = (f && f.status !== "recusado" && f.data) || ""; data.min = C.todayStr();
  const hora = el("input"); hora.type = "time"; hora.value = (f && f.hora) || "";
  const r1 = el("div", "row2"); r1.append(field(kind === "formatura" ? "Dia da formatura" : "Dia das fotos", data), field("Horário", hora));
  box.append(el("h3", null, K.ico + " " + K.nome), el("p", "hint", (C.aprovador ? "Você confirma direto." : "A data fica segurada e vai para a Luciana aprovar.") + " Cada dia só pode ter um compromisso."), r1);
  let onde = null, local = null, obs = null;
  if (kind === "formatura") {
    onde = sel(["Colégio", "Salão"], (f && f.onde) || "Colégio"); local = inp(f && f.local, "nome do salão ou endereço");
    const r2 = el("div", "row2"); r2.append(field("Onde", onde), field("Local", local)); box.append(r2);
  } else {
    obs = inp((f && f.obs) || "Medir beca + ensaio de estúdio no colégio", "o que vai ser feito", 200); box.append(field("O que vai ser feito", obs));
  }
  if (f && f.status === "recusado") box.append(el("p", "wait", `A Luciana recusou o dia ${C.fmtDate(f.data)}${f.motivoRecusa ? ": " + f.motivoRecusa : ""}${f.sugestao ? ` · sugeriu ${C.fmtDate(f.sugestao)}` : ""}`));
  const err = el("p", "err"); err.hidden = true; box.append(err);
  box.valor = () => ({ data: data.value, hora: hora.value, onde: onde ? onde.value : "", local: local ? local.value.trim() : "", obs: obs ? obs.value.trim() : "" });
  box.erro = t => { err.textContent = t; err.hidden = !t; if (t) err.scrollIntoView({ block: "center" }); };
  box.onde = onde;
  return box;
}
// Quando as datas são confirmadas, o colégio recebe um e-mail (instituição + responsáveis com e-mail).
// O app só coloca o e-mail na fila; quem envia é o GitHub, a cada 15 minutos, pelo Gmail do estúdio.
export async function avisarColegioPorEmail(instId, ctx){
  const c = ctx || C; const F = c.FS;
  const s0 = await F.getDoc(F.doc(c.db, "instituicoes", instId)); if (!s0.exists()) return 0;
  const it = s0.data();
  const para = [...new Set([it.email, ...(it.contatos || []).map(x => x.email)].map(x => String(x || "").trim().toLowerCase()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))];
  if (!para.length) return 0;
  const sem = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const dia = d => { const [y, m, dd] = d.split("-").map(Number); return `${sem[new Date(y, m - 1, dd).getDay()]}, ${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`; };
  const lin = [];
  if (it.diaFotos && it.diaFotos.status === "confirmado") lin.push(`📸 Medição de beca e ensaio de estúdio no colégio: ${dia(it.diaFotos.data)}${it.diaFotos.hora ? " às " + it.diaFotos.hora : ""}`);
  if (it.formatura && it.formatura.status === "confirmado") lin.push(`🎓 Formatura: ${dia(it.formatura.data)}${it.formatura.hora ? " às " + it.formatura.hora : ""}${it.formatura.onde ? " · " + (it.formatura.onde === "Salão" ? "no salão" : "no colégio") : ""}${it.formatura.local ? " (" + it.formatura.local + ")" : ""}`);
  if (!lin.length) return 0;
  const nome = title(it.nome);
  await F.addDoc(F.collection(c.db, "emails"), {
    para, instId, instNome: it.nome, status: "pendente", criadoEm: new Date().toISOString(), por: c.me || "",
    assunto: `Z7 Studio · Datas confirmadas · ${nome}`,
    texto: `Olá!\n\nConfirmamos com o ${nome} as datas das fotos de formatura:\n\n${lin.join("\n")}\n\nQualquer dúvida, é só responder este e-mail.\n\nAtenciosamente,\nZ7 Studio Fotográfico\nEstrada Dr. Rufino Gonçalves Ferreira, 290, Centro, Nilópolis/RJ`
  });
  await F.updateDoc(F.doc(c.db, "instituicoes", instId), { avisoEmail: { para, em: new Date().toISOString() } }).catch(() => {});
  return para.length;
}
function linhaEvento(it, kind){
  const ev = it[KINDS[kind].campo]; if (!ev || !ev.data) return null;
  const K = KINDS[kind];
  const t = ev.status === "recusado"
    ? `${K.ico} ${K.nome}: ${STATUS_TXT.recusado} o dia ${C.fmtDate(ev.data)}${ev.motivoRecusa ? " (" + ev.motivoRecusa + ")" : ""}${ev.sugestao ? " · sugeriu " + C.fmtDate(ev.sugestao) : ""}`
    : `${K.ico} ${K.nome} ${C.fmtDate(ev.data)}/${ev.data.slice(0, 4)}${ev.hora ? " às " + ev.hora : ""}${ev.onde ? " · " + ev.onde : ""}${ev.local ? " (" + ev.local + ")" : ""} · ${STATUS_TXT[ev.status] || STATUS_TXT.pendente}`;
  return el("div", "fu " + (ev.status === "confirmado" ? "ok" : ev.status === "recusado" ? "late" : "today"), t);
}
function parseTel(v){ const d = String(v || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""); return d.length >= 10 && d.length <= 11 ? d : ""; }

// ---------- mensagens prontas para o WhatsApp ----------
function mensagem(it, c){
  const n = c && c.nome ? C.first(title(c.nome)) : "";
  const oi = n ? `Olá, ${n}!` : "Olá!";
  const nome = title(it.nome);
  const ult = (it.visitas || [])[0];
  const apres = ult && ult.apresentou && ult.apresentou.length ? ` (${ult.apresentou.map(p => p.nome.replace(/ \(.*\)$/, "")).join(", ")})` : "";
  if (it.etapa === "A VISITAR" || it.etapa === "AGENDAR VISITA")
    return `${oi} Aqui é ${eu()}, do Z7 Studio Fotográfico 📸 Trabalhamos com fotos de formatura em escolas da região há mais de 15 anos. Gostaria de agendar uma visita rápida ${it.tipo === "faculdade" ? "com a comissão de formatura" : "ao " + nome} para apresentar os nossos kits. Qual o melhor dia e horário?`;
  if (it.etapa === "VISITADO" || it.etapa === "PROPOSTA ENVIADA")
    return `${oi} Aqui é ${eu()}, do Z7 Studio Fotográfico. Passando para saber se conseguiram conversar sobre a proposta das fotos de formatura${apres}. Posso ajudar com alguma dúvida? 😊`;
  if (it.etapa === "NÃO FECHOU")
    return `${oi} Aqui é ${eu()}, do Z7 Studio Fotográfico. Já conversamos sobre as fotos de formatura${nome ? " do " + nome : ""}. Estamos organizando a agenda de ${new Date().getFullYear() + (new Date().getMonth() >= 8 ? 1 : 0)}: podemos marcar uma visita rápida para mostrar as novidades?`;
  return "";
}

// ---------- gravação ----------
async function save(it, patch, msg){
  try {
    patch.atualizadoEm = new Date().toISOString();
    await FS.updateDoc(FS.doc(db, "instituicoes", it.id), patch);
    C.toast(msg || "Salvo");
  } catch (e) { C.handleErr(e); }
}
function claim(it){
  if (!C.me) return; const li = lockInfo(it); if (li && li.mine) return;
  save(it, { atendendo: { por: C.me, desde: new Date().toISOString() } }, "O outro aparelho vai ver: " + C.first(C.me) + " está atendendo");
}

// ---------- tela ----------
export function init(ctx){ C = ctx; FS = ctx.FS; db = ctx.db; col = FS.collection(db, "instituicoes"); }

export function show(t){
  tipo = t; const T = TIPOS[t];
  const v = $("viewInstTipo"); v.innerHTML = "";
  const head = el("div", "vhead"); head.append(el("h2", null, T.ico + " " + T.nome));
  const hb = el("div", "quick");
  hb.append(C.mkBtn("+ Nova instituição", "btn-primary", () => openForm(null)));
  if (C.isAdmin) hb.append(C.mkBtn("Preços dos kits", "", () => openPrecos()));
  if (C.isAdmin) hb.append(C.mkBtn("Importar planilha", "", () => openImport()));
  head.append(hb); v.append(head);

  const st = el("section", "stats");
  st.innerHTML = `<div class="stat late"><b id="iAtr">–</b><small>Retornos atrasados</small></div>
    <div class="stat today"><b id="iHoje">–</b><small>Para hoje (retornos e pendências)</small></div>
    <div class="stat"><b id="iAbertas">–</b><small>Em andamento</small></div>
    <div class="stat won"><b id="iFech">–</b><small>Fechadas</small></div>`;
  v.append(st);
  const chips = el("div", "chips"); chips.id = "iChips"; v.append(chips);
  const q = el("input", "search"); q.id = "iQ"; q.type = "search"; q.placeholder = "Buscar por nome, bairro, cidade ou contato"; q.setAttribute("aria-label", "Buscar"); v.append(q);
  q.addEventListener("input", renderList);
  const list = el("section", "grid"); list.id = "iList"; v.append(list);
  renderChips();
  list.append(Object.assign(el("div", "empty"), { innerHTML: "<strong>Carregando…</strong>" }));
  if (unsub) unsub();
  unsub = FS.onSnapshot(FS.query(col, FS.where("tipo", "==", t), FS.limit(1500)), snap => {
    items = snap.docs.map(d => Object.assign({ id: d.id }, d.data())); renderChips(); renderStats(); renderList();
  }, err => { console.warn(err); C.showNotice(err.code === "permission-denied" ? "Você não tem acesso às Instituições." : "Não foi possível carregar. Verifique a internet."); });
}
export function hide(){ if (unsub) { unsub(); unsub = null; } }

// Pendência: formatura marcada sem o dia de medir beca + ensaio
function pendFotos(it){
  const f = it.formatura, d = it.diaFotos;
  return !!(f && f.data && f.status !== "recusado" && !(d && d.data && d.status !== "recusado"));
}
function filtra(i, k){
  if (k === "hoje") return ["late", "today"].includes(status(i)) || pendFotos(i);
  if (k === "pend") return pendFotos(i);
  if (k === "meus") return i.resp === C.me && (ABERTAS.includes(i.etapa) || pendFotos(i));
  if (k === "todos") return true;
  return i.etapa === k;
}
function renderStats(){
  const st = items.map(status);
  $("iAtr").textContent = st.filter(s => s === "late").length;
  $("iHoje").textContent = st.filter(s => s === "today").length + items.filter(i => pendFotos(i) && status(i) !== "today" && status(i) !== "late").length;
  $("iAbertas").textContent = items.filter(i => ABERTAS.includes(i.etapa)).length;
  $("iFech").textContent = items.filter(i => i.etapa === "FECHADO").length;
}
function renderChips(){
  const c = $("iChips"); if (!c) return; c.innerHTML = "";
  const n = k => items.filter(i => filtra(i, k)).length;
  [["hoje", "Para hoje"], ["pend", "⚠️ Pendências"], ["meus", "Só os meus"], ...ETAPAS.map(e => [e, e]), ["todos", "Todas"]].forEach(([k, t]) => {
    const b = el("button", "chip", t); b.type = "button"; b.setAttribute("aria-pressed", String(tab === k));
    const s = el("span", "n", String(n(k))); b.append(s);
    b.onclick = () => { tab = k; renderChips(); renderList(); }; c.append(b);
  });
}
function renderList(){
  const list = $("iList"); if (!list) return; list.innerHTML = "";
  const q = norm($("iQ").value);
  let arr = items.filter(i => filtra(i, tab));
  if (q) arr = arr.filter(i => norm([i.nome, i.endereco?.bairro, i.endereco?.cidade, ...(i.contatos || []).map(c => c.nome)].join(" ")).includes(q));
  const rank = { late: 0, today: 1, later: 2, none: 3, won: 4 };
  arr.sort((a, b) => rank[status(a)] - rank[status(b)] || (a.followup || "9").localeCompare(b.followup || "9") || (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  if (!arr.length) {
    const e = el("div", "empty"); e.style.gridColumn = "1/-1";
    e.append(el("strong", null, items.length ? "Nada aqui" : "Nenhuma instituição cadastrada"),
      el("span", null, items.length ? "Troque o filtro acima." : "Toque em “+ Nova instituição” ou importe a planilha."));
    list.append(e); return;
  }
  arr.slice(0, 300).forEach(i => list.append(card(i)));
}

function card(it){
  const s = status(it);
  const e = el("article", "card " + (["late", "today", "won"].includes(s) ? s : ""));
  const top = el("div", "card-top"); top.append(el("h3", "name", title(it.nome)), el("span", "stage", it.etapa)); e.append(top);
  const meta = el("div", "meta");
  const segs = SEGMENTOS.filter(([k]) => (it.segmentos || {})[k] || (k === "pre" && (it.segmentos || {}).infantil)).map(([, t]) => t);
  [[it.resp ? "👤 " + C.first(it.resp) : "", ""], [[title(it.endereco?.bairro), title(it.endereco?.cidade)].filter(Boolean).join(" · "), "svc"],
   [segs.join(", "), ""], [it.mediaAlunos ? `~${it.mediaAlunos} alunos` : "", ""], [it.fotografoHoje || "", ""], [it.motivo ? "Motivo: " + it.motivo : "", ""]]
    .forEach(([v, c]) => { if (v) meta.append(el("span", "tag " + c, v)); });
  e.append(meta);
  const cs = it.contatos || [];
  if (cs.length) e.append(el("div", "phone", cs.map(c => [c.nome && title(c.nome), c.cargo, c.tel].filter(Boolean).join(" · ")).join("  |  ")));
  const fu = el("div", "fu " + (s === "late" ? "late" : s === "today" ? "today" : it.followup ? "" : "none"));
  fu.textContent = it.etapa === "FECHADO" ? "Fechado" + (it.fechadoEm ? " em " + C.fmtDate(it.fechadoEm) : "")
    : it.followup ? (s === "late" ? "Atrasado desde " + C.fmtDate(it.followup) : s === "today" ? "Retorno hoje" : "Retorno em " + C.fmtDate(it.followup) + (it.followup.slice(0, 4) !== C.todayStr().slice(0, 4) ? "/" + it.followup.slice(0, 4) : "")) + (it.proximoPasso ? " · " + it.proximoPasso : "")
    : "Sem data de retorno";
  e.append(fu);
  ["fotos", "formatura"].forEach(k => { const l = linhaEvento(it, k); if (l) e.append(l); });
  if (pendFotos(it)) {
    const pd = el("div", "lock other");
    pd.append(el("span", null, "⚠️ Pendência: marcar o dia de medir beca e fazer o ensaio de estúdio"), C.mkBtn("📸 Marcar agora", "btn-primary", () => openEvento(it, "fotos")));
    e.append(pd);
  }
  if (it.avisoEmail && it.avisoEmail.em) e.append(el("div", "last", `📧 Datas enviadas por e-mail para ${it.avisoEmail.para.join(", ")} em ${C.fmtDate(C.ds(new Date(it.avisoEmail.em)))}`));
  const ult = (it.visitas || [])[0];
  if (ult) {
    const linhas = [`${C.fmtDate(ult.data)}${ult.data && ult.data.slice(0, 4) !== C.todayStr().slice(0, 4) ? "/" + ult.data.slice(0, 4) : ""} · ${ult.por ? C.first(ult.por) : "planilha"}${ult.falouCom ? " falou com " + ult.falouCom : ""}${ult.resultado ? " · " + ult.resultado : ""}`];
    if (ult.apresentou && ult.apresentou.length) linhas.push("Apresentou: " + ult.apresentou.map(p => `${p.nome} ${C.money(p.preco)}`).join(", "));
    if (ult.obs) linhas.push(ult.obs);
    e.append(el("p", "notes", "Última visita: " + linhas.join("\n")));
    if ((it.visitas || []).length > 1) {
      const d = el("details", "hist"); d.append(el("summary", null, `Ver as ${it.visitas.length} visitas`));
      it.visitas.slice(1).forEach(x => d.append(el("p", "notes", `${x.data || ""} · ${x.por ? C.first(x.por) : "planilha"}${x.resultado ? " · " + x.resultado : ""}${x.obs ? "\n" + x.obs : ""}`)));
      e.append(d);
    }
  }
  const li = lockInfo(it);
  if (li) {
    const lk = el("div", "lock " + (li.mine ? "mine" : "other"));
    lk.append(el("span", null, li.mine ? "✋ Você está atendendo" : "⚠️ " + C.first(li.por) + " está atendendo desde " + C.hhmm(li.desde)));
    lk.append(li.mine ? C.mkBtn("Liberar", "", () => save(it, { atendendo: null }, "Liberado")) : C.mkBtn("Assumir mesmo assim", "", () => save(it, { atendendo: { por: C.me, desde: new Date().toISOString() } }, "Agora você está atendendo")));
    e.append(lk);
  }
  // Mensagem pronta para o contato
  const m = mensagem(it, cs.find(c => c.nome && c.tel) || cs[0]);
  if (m && !(li && !li.mine)) {
    const box = el("div", "next"); box.append(el("small", null, "Mensagem pronta"), el("p", null, m));
    const row = el("div", "row");
    cs.filter(c => c.tel).slice(0, 3).forEach(c => {
      const a = el("a", "btn btn-sm btn-primary", "WhatsApp" + (c.nome ? " " + C.first(title(c.nome)) : c.cargo ? " " + c.cargo : ""));
      a.href = "https://wa.me/" + C.digits(c.tel) + "?text=" + encodeURIComponent(mensagem(it, c)); a.target = "_blank"; a.rel = "noopener"; a.addEventListener("click", () => claim(it)); row.append(a);
    });
    row.append(C.mkBtn("Copiar texto", "", async () => { try { await navigator.clipboard.writeText(m); C.toast("Texto copiado"); } catch (_) { C.toast("Não consegui copiar"); } }));
    box.append(row); e.append(box);
  }
  const act = el("div", "actions");
  act.append(C.mkBtn("📝 Registrar visita / contato", "btn-primary", () => openVisita(it)));
  if (it.etapa !== "FECHADO") act.append(C.mkBtn("Remarcar +7d", "", () => save(it, { followup: C.addDays(7) }, "Retorno em " + C.fmtDate(C.addDays(7)))));
  if (!li && it.etapa !== "FECHADO") act.append(C.mkBtn("✋ Estou atendendo", "", () => claim(it)));
  act.append(C.mkBtn("🎓 Formatura", "", () => openEvento(it, "formatura")));
  act.append(C.mkBtn("📸 Dia de fotos", "", () => openEvento(it, "fotos")));
  act.append(C.mkBtn("Editar", "", () => openForm(it)));
  e.append(act);
  return e;
}

// ---------- janelinhas ----------
function sheet(titleTxt, build){
  const sh = el("div", "sheet"); const p = el("form", "panel"); p.autocomplete = "off";
  p.append(el("h2", null, titleTxt)); sh.append(p);
  const close = () => sh.remove();
  sh.addEventListener("click", ev => { if (ev.target === sh) close(); });
  build(p, close); document.body.append(sh);
  return close;
}
let fid = 0;
function field(lbl, inp){ const f = el("div", "field"); const l = el("label", null, lbl); inp.id = inp.id || "if" + (++fid); l.htmlFor = inp.id; f.append(l, inp); return f; }
function inp(v, ph, max){ const i = el("input"); i.value = v == null ? "" : v; i.placeholder = ph || ""; i.maxLength = max || 120; return i; }
function sel(opts, v, vazio){ const s = el("select"); if (vazio != null) { const o = el("option", null, vazio); o.value = ""; s.append(o); } opts.forEach(x => { const o = el("option", null, x); o.value = x; s.append(o); }); s.value = v || ""; return s; }
function actions(close, okTxt){ const a = el("div", "panel-actions"); const sp = el("span"); sp.style.flex = "1"; const c = el("button", "btn", "Cancelar"); c.type = "button"; c.onclick = close; const ok = el("button", "btn btn-primary", okTxt); ok.type = "submit"; a.append(sp, c, ok); return a; }
function quandoBtns(target){
  const q = el("div", "quick");
  [["Amanhã", 1], ["Semana que vem", 7], ["Mês que vem", 30], ["Início do ano que vem", "ano"], ["Sem data", -1]].forEach(([t, n]) => {
    const b = el("button", "btn btn-sm", t); b.type = "button";
    b.onclick = () => { target.value = n === -1 ? "" : n === "ano" ? anoQueVem() : C.addDays(n); };
    q.append(b);
  });
  return q;
}

function openEvento(it, kind){
  const K = KINDS[kind], ev = it[K.campo], fot = it.diaFotos;
  const comFotos = kind === "formatura"; // formatura sempre leva junto o dia de medir beca + ensaio
  sheet(K.nome + " · " + title(it.nome), (p, close) => {
    const travado = !C.aprovador && ev && ev.status === "confirmado" && (!comFotos || (fot && fot.status === "confirmado"));
    if (travado) {
      [["fotos", fot], [kind, ev]].forEach(([k, x]) => { if (x && x.data && (k === kind || comFotos)) p.append(el("p", null, `${KINDS[k].ico} ${KINDS[k].nome}: ${C.fmtDate(x.data)}/${x.data.slice(0, 4)}${x.hora ? " às " + x.hora : ""} · ✅ confirmado`)); });
      p.append(el("p", "hint", "Confirmado pela Luciana. Para mudar ou desmarcar, fale com ela."));
      const a = el("div", "panel-actions"); const ok = el("button", "btn btn-primary", "Fechar"); ok.type = "button"; ok.onclick = close; a.append(ok); p.append(a); return;
    }
    const dBox = comFotos ? camposEvento("fotos", fot) : null;
    if (dBox) { p.append(el("p", "hint", "Lembrete: a formatura costuma ter 2 dias. Primeiro medir beca e fazer o ensaio de estúdio no colégio, depois a formatura. Se ainda não combinou o dia das fotos, pode deixar em branco.")); p.append(dBox); }
    let avisado = false;
    const box = camposEvento(kind, ev); p.append(box);
    if (ev && ev.data && ev.status !== "recusado") {
      const lib = el("button", "btn btn-danger btn-sm", comFotos ? "Desmarcar formatura e dia de fotos (libera os dias)" : "Desmarcar (libera o dia)"); lib.type = "button";
      lib.onclick = async () => { try { await liberar(it, kind); if (comFotos) await liberar(it, "fotos");
        await FS.updateDoc(FS.doc(db, "instituicoes", it.id), Object.assign({ [K.campo]: null, atualizadoEm: new Date().toISOString() }, comFotos ? { diaFotos: null } : {})); C.toast("Desmarcado"); close(); } catch (e) { C.handleErr(e); } };
      p.append(lib);
    }
    p.append(actions(close, C.aprovador ? "Confirmar datas" : "Mandar para a Luciana aprovar"));
    p.addEventListener("submit", async evt => {
      evt.preventDefault();
      const f = box.valor(), fd = dBox ? dBox.valor() : null;
      if (!f.data) { box.erro("Escolha o dia."); return; }
      // Sugestão (não obrigatório): lembra o vendedor do dia de medir beca + ensaio
      if (dBox && !fd.data && !avisado) { avisado = true; dBox.erro("Não esqueça do dia de medir beca e fazer o ensaio! Se ainda não combinou, toque de novo para salvar só a formatura."); p.querySelector("button[type=submit]").textContent = "Salvar só a formatura"; return; }
      try {
        if (fd && fd.data && fd.data >= f.data) { const e = new Error("ordem"); e.code = "ordem"; throw e; }
        const pares = fd && fd.data ? [["fotos", fd], [kind, f]] : [[kind, f]];
        const r = await reservarVarios(it, pares);
        const patch = { [K.campo]: Object.assign(f, { status: r.status, grupo: r.grupo, pedidoPor: C.me || "" }), atualizadoEm: new Date().toISOString() };
        if (fd && fd.data) patch.diaFotos = Object.assign(fd, { status: r.status, grupo: r.grupo, pedidoPor: C.me || "" });
        await FS.updateDoc(FS.doc(db, "instituicoes", it.id), patch);
        if (r.status === "confirmado") await avisarColegioPorEmail(it.id);
        C.toast(r.status === "confirmado" ? "Datas confirmadas" : "Dias segurados. Aguardando a Luciana aprovar."); close();
      } catch (e) { (e.code === "ocupado" && dBox && e.ocupado && fd && e.ocupado.data === fd.data ? dBox : box).erro(msgErroData(e)); if (!e.code) console.warn(e); }
    });
  });
}
function openPrecos(){
  sheet("Preços dos kits", (p, close) => {
    p.append(el("p", "hint", "Esses valores aparecem prontos na hora de registrar a visita (dá para mudar na hora)."));
    const ins = PRODUTOS_PADRAO.map(x => { const i = inp((C.P.precosInst || {})[x.nome] || "", "R$", 10); i.inputMode = "decimal"; p.append(field(x.nome, i)); return [x.nome, i]; });
    p.append(actions(close, "Salvar preços"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      try { await FS.setDoc(FS.doc(db, "config", "app"), { precosInst: Object.fromEntries(ins.map(([n, i]) => [n, C.num(i.value)])) }, { merge: true }); C.toast("Preços salvos"); close(); }
      catch (e) { C.handleErr(e); }
    });
  });
}
function openForm(it){
  sheet(it ? "Editar instituição" : "Nova instituição · " + TIPOS[tipo].nome, (p, close) => {
    const nome = inp(it ? title(it.nome) : "", "Nome da instituição"); nome.required = true;
    // O tipo vem do cartão que foi aberto: não precisa escolher.
    p.append(field("Nome", nome));
    const a = (it && it.endereco) || {};
    const rua = inp(title(a.rua)), num = inp(a.numero, "", 20), bai = inp(title(a.bairro)), cid = inp(title(a.cidade));
    const r1 = el("div", "row2"); r1.append(field("Endereço", rua), field("Número", num));
    const r2 = el("div", "row2"); r2.append(field("Bairro", bai), field("Cidade", cid));
    p.append(r1, r2);
    const media = inp(it ? it.mediaAlunos : "", "ex.: 120", 10); media.inputMode = "numeric";
    const fot = sel(FOTOGRAFO, it && it.fotografoHoje, "—");
    const r3 = el("div", "row2"); r3.append(field("Média de alunos", media), field("Fotógrafo hoje", fot)); p.append(r3);
    const segBox = el("div", "quick");
    const segChk = SEGMENTOS.map(([k, t]) => { const l = el("label", "chk"); const c = el("input"); c.type = "checkbox"; c.checked = !!(it && it.segmentos && (it.segmentos[k] || (k === "pre" && it.segmentos.infantil))); l.append(c, document.createTextNode(" " + t)); segBox.append(l); return [k, c]; });
    if (tipo !== "faculdade") { const f = el("div", "field"); f.append(el("label", null, "Segmentos"), segBox); p.append(f); }
    p.append(el("h3", null, "Contatos"));
    const lista = el("div", "imp"); p.append(lista); const linhas = [];
    const addC = (c = {}) => { const nm = inp(title(c.nome), "nome"), cg = sel(CARGOS, c.cargo, "cargo"), tl = inp(c.tel, "21 99999-9999", 20), em = inp(c.email, "e-mail (recebe as datas)"); tl.inputMode = "tel"; em.type = "email";
      const r = el("div", "row3"); r.append(field("Nome", nm), field("Cargo", cg), field("Telefone / WhatsApp", tl)); const r2 = el("div", "row2"); r2.append(field("E-mail", em));
      lista.append(r, r2); linhas.push({ nm, cg, tl, em }); };
    ((it && it.contatos && it.contatos.length) ? it.contatos : [{}]).forEach(addC);
    const add = el("button", "btn btn-sm", "+ Adicionar contato"); add.type = "button"; add.onclick = () => addC(); p.append(add);
    const email = inp(it && it.email, "e-mail da instituição (recebe as datas confirmadas)"); p.append(field("E-mail da instituição", email));
    const hor = inp(it && it.horario, "ex.: só funciona à tarde"); p.append(field("Melhor horário para contato", hor));
    const nota = el("textarea"); nota.rows = 3; nota.maxLength = 2000; nota.value = (it && it.notas) || ""; p.append(field("Anotações gerais", nota));
    if (it && C.isAdmin) { const del = el("button", "btn btn-danger btn-sm", "Apagar instituição"); del.type = "button";
      del.onclick = async () => { if (del.dataset.ok) { try { await liberar(it, "formatura"); await liberar(it, "fotos"); await FS.deleteDoc(FS.doc(db, "instituicoes", it.id)); C.toast("Apagada"); close(); } catch (e) { C.handleErr(e); } } else { del.dataset.ok = 1; del.textContent = "Toque de novo para apagar de vez"; } }; p.append(del); }
    p.append(actions(close, "Salvar"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault(); if (!nome.value.trim()) return;
      const tipoK = it ? it.tipo : tipo;
      const contatos = linhas.map(({ nm, cg, tl, em }) => ({ nome: nm.value.trim(), cargo: cg.value, tel: parseTel(tl.value) || tl.value.trim(), email: em.value.trim().toLowerCase() })).filter(c => c.nome || c.tel || c.email);
      const body = { nome: nome.value.trim(), nomeBusca: norm(nome.value), tipo: tipoK, endereco: { rua: rua.value.trim(), numero: num.value.trim(), bairro: bai.value.trim(), cidade: cid.value.trim() },
        mediaAlunos: Number(media.value) || null, fotografoHoje: fot.value, segmentos: Object.fromEntries(segChk.map(([k, c]) => [k, c.checked])),
        contatos, email: email.value.trim(), horario: hor.value.trim(), notas: nota.value.trim(), atualizadoEm: new Date().toISOString() };
      try {
        if (it) await FS.updateDoc(FS.doc(db, "instituicoes", it.id), body);
        else await FS.addDoc(col, Object.assign(body, { etapa: "A VISITAR", followup: null, visitas: [], tentativas: 0, resp: C.me, criadoEm: new Date().toISOString() }));
        C.toast("Salvo"); close();
      } catch (e) { C.handleErr(e); }
    });
  });
}

function openVisita(it){
  sheet("Registrar visita / contato", (p, close) => {
    p.append(el("p", "hint", title(it.nome)));
    const data = el("input"); data.type = "date"; data.value = C.todayStr();
    const como = sel(["Visita presencial", "Ligação", "WhatsApp", "E-mail"], "Visita presencial");
    const r0 = el("div", "row2"); r0.append(field("Data", data), field("Como foi", como)); p.append(r0);
    const cs = it.contatos || [];
    const falou = inp("", "nome de quem atendeu"); const cargo = sel(CARGOS, "", "cargo"); const tel = inp("", "WhatsApp (se tiver)", 20); tel.inputMode = "tel";
    if (cs[0]) { falou.value = title(cs[0].nome); cargo.value = cs[0].cargo || ""; }
    const r1 = el("div", "row3"); r1.append(field("Com quem falou", falou), field("Cargo", cargo), field("Telefone novo", tel)); p.append(r1);
    const fot = sel(FOTOGRAFO, it.fotografoHoje, "—"); p.append(field("Fotógrafo hoje", fot));
    // O que foi apresentado: toca no produto, o preço vem pronto e dá para mudar
    p.append(el("h3", null, "O que apresentou"));
    const prodBox = el("div", "imp"); const prods = [];
    produtos().forEach(pr => {
      const r = el("div", "prow"); const l = el("label", "chk"); const c = el("input"); c.type = "checkbox"; l.append(c, document.createTextNode(" " + pr.nome));
      const v = inp(pr.preco, "R$", 10); v.inputMode = "decimal"; v.className = "preco"; v.setAttribute("aria-label", "Preço de " + pr.nome);
      r.append(l, v); prodBox.append(r); prods.push({ nome: pr.nome, c, v, formatura: pr.formatura });
    });
    p.append(prodBox);
    const fBox = camposEvento("formatura", it.formatura); fBox.hidden = true; p.append(fBox);
    // Dia de fotos no colégio (medir beca + ensaio)
    const dfL = el("label", "chk"); const dfC = el("input"); dfC.type = "checkbox"; dfL.append(dfC, document.createTextNode(" 📸 Já combinou o dia de fotos no colégio (medir beca + ensaio)"));
    const dBox = camposEvento("fotos", it.diaFotos); dBox.hidden = true; dfC.onchange = () => { dBox.hidden = !dfC.checked; };
    p.append(dfL, dBox);
    const syncF = () => { const fx = prods.find(x => x.formatura && x.c.checked); fBox.hidden = !fx; if (fx) { fBox.onde.value = fx.formatura; dfC.checked = true; dBox.hidden = false; } };
    prods.forEach(x => x.c.addEventListener("change", syncF));
    const res = sel(RESULTADOS.map(r => r[0]), "", "escolha o resultado"); res.required = true; p.append(field("Resultado", res));
    const motivoBox = el("div"); const motivo = inp("", "ex.: já gastaram com outros eventos este ano"); motivoBox.append(field("Motivo de não fechar", motivo)); motivoBox.hidden = true; p.append(motivoBox);
    res.onchange = () => { const et = (RESULTADOS.find(r => r[0] === res.value) || [])[1]; motivoBox.hidden = et !== "NÃO FECHOU"; };
    const passo = sel(PASSOS, "", "próximo passo"); const quando = el("input"); quando.type = "date";
    const r2 = el("div", "row2"); r2.append(field("Próximo passo", passo), field("Quando", quando)); p.append(r2, quandoBtns(quando));
    const obs = el("textarea"); obs.rows = 3; obs.maxLength = 2000; obs.placeholder = "Ex.: pediu retorno dia 16; tem interesse em aluguel de beca"; p.append(field("Observação", obs));
    p.append(actions(close, "Salvar visita"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault(); if (!res.value) return;
      const etapa = (RESULTADOS.find(r => r[0] === res.value) || [])[1] || it.etapa;
      // Formatura com data: reserva o dia antes de salvar (bloqueia se já estiver ocupado)
      let formatura = null, diaFotos = null;
      const fv = !fBox.hidden ? fBox.valor() : null, dv = dfC.checked ? dBox.valor() : null;
      if (fv && fv.data && !(dv && dv.data) && !p._avisado) { p._avisado = true; dBox.hidden = false; dfC.checked = true; dBox.erro("Não esqueça do dia de medir beca e fazer o ensaio! Se ainda não combinou, toque em salvar de novo."); return; }
      if (fv && fv.data && dv && dv.data && dv.data >= fv.data) { dBox.erro(msgErroData({ code: "ordem" })); return; }
      const pares = [dv && dv.data ? ["fotos", dv] : null, fv && fv.data ? ["formatura", fv] : null].filter(Boolean);
      if (pares.length) {
        try {
          const r = await reservarVarios(it, pares);
          if (dv && dv.data) diaFotos = Object.assign(dv, { status: r.status, grupo: r.grupo, pedidoPor: C.me || "" });
          if (fv && fv.data) formatura = Object.assign(fv, { status: r.status, grupo: r.grupo, pedidoPor: C.me || "" });
          if (r.status === "confirmado") setTimeout(() => avisarColegioPorEmail(it.id), 800);
        } catch (e) { (e.code === "ocupado" && e.ocupado && dv && e.ocupado.data === dv.data ? dBox : fBox.hidden ? dBox : fBox).erro(msgErroData(e)); return; }
      }
      const visita = { data: data.value, como: como.value, por: C.me || "", falouCom: [falou.value.trim(), cargo.value].filter(Boolean).join(" · "), resultado: res.value,
        apresentou: prods.filter(x => x.c.checked).map(x => ({ nome: x.nome, preco: C.num(x.v.value) })), passo: passo.value, quando: quando.value, obs: obs.value.trim(), em: new Date().toISOString() };
      const patch = { etapa, visitas: [visita, ...(it.visitas || [])].slice(0, 50), fotografoHoje: fot.value || it.fotografoHoje || "", proximoPasso: passo.value, followup: etapa === "FECHADO" ? null : (quando.value || null),
        atendendo: null, ultimo: { por: C.me || "—", em: new Date().toISOString() }, resp: it.resp || C.me };
      if (etapa === "FECHADO") patch.fechadoEm = C.todayStr();
      if (formatura) patch.formatura = formatura;
      if (diaFotos) patch.diaFotos = diaFotos;
      if (etapa === "NÃO FECHOU") patch.motivo = motivo.value.trim() || res.value;
      if (etapa === "AGENDAR VISITA") patch.tentativas = (it.tentativas || 0) + 1;
      // guarda o contato novo, se veio
      const nomeF = falou.value.trim(), telF = parseTel(tel.value);
      if (nomeF || telF) {
        const lista = (it.contatos || []).slice(); const i0 = lista.findIndex(c => norm(c.nome) === norm(nomeF) && nomeF);
        if (i0 >= 0) { lista[i0] = Object.assign({}, lista[i0], { cargo: cargo.value || lista[i0].cargo, tel: telF || lista[i0].tel }); }
        else lista.push({ nome: nomeF, cargo: cargo.value, tel: telF });
        patch.contatos = lista;
      }
      close(); save(it, patch, etapa === "FECHADO" ? "Fechado! 🎉" : quando.value ? "Retorno em " + C.fmtDate(quando.value) : "Visita registrada");
    });
  });
}

// ---------- importar planilha ----------
const MAPA = { PRE: "pre", PREESCOLA: "pre", INSTITUICAO: "nome", ESCOLA: "nome", COLEGIO: "nome", INFANTIL: "infantil", FUNDAMENTALI: "fund1", "5ANO": "ano5", FUNDAMENTALII: "fund2", "9ANO": "ano9",
  ENSINOMEDIO: "medio", TELEFONE1: "t1", TELEFONE2: "t2", TELEFONE3: "t3", EMAIL: "email", ENDERECO: "rua", N: "numero", NO: "numero", NUMERO: "numero",
  BAIRRO: "bairro", CIDADE: "cidade", DATADAVISITA: "dataVisita", STATUS: "status", MEDIADEALUNOS: "media", RESPONSAVEL: "responsavel",
  TEMFOTOSDEFORMATURA: "temFotos", DATADAFOTO: "dataFoto", OBSERVACAO: "obs", OBSERVACOES: "obs", OBS: "obs" };
const hkey = h => String(h || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(\d)O?ANO$/, "$1ANO");
function loadXLSX(){
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = () => res(window.XLSX); s.onerror = rej; document.head.append(s); });
}
function dataISO(v, X){
  if (!v) return "";
  if (v instanceof Date && !isNaN(v)) return C.ds(v);
  if (typeof v === "number") { const p0 = X.SSF.parse_date_code(v); return p0 ? `${p0.y}-${C.pad(p0.m)}-${C.pad(p0.d)}` : ""; }
  const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${C.pad(m[2])}-${C.pad(m[1])}`;
  return "";
}
function openImport(){
  sheet("Importar planilha · " + TIPOS[tipo].nome, (p, close) => {
    p.append(el("p", "hint", "Escolha o Excel (.xlsx). Todas as linhas da aba escolhida entram como “" + TIPOS[tipo].nome + "”. Quem já existe é atualizado, sem duplicar."));
    const f = el("input"); f.type = "file"; f.accept = ".xlsx,.xls,.csv"; p.append(field("Arquivo", f));
    const aba = el("select"); aba.hidden = true; const fAba = field("Aba da planilha", aba); fAba.hidden = true; p.append(fAba);
    const out = el("div", "imp"); p.append(out);
    const acts = actions(close, "Importar"); const ok = acts.querySelector("button[type=submit]"); ok.disabled = true; p.append(acts);
    let wb = null, X = null, rows = [];
    const ler = () => {
      out.innerHTML = ""; rows = []; ok.disabled = true;
      const m = X.utils.sheet_to_json(wb.Sheets[aba.value], { header: 1, defval: "", raw: true });
      const hi = m.findIndex(r => r.some(c => ["INSTITUICAO", "ESCOLA", "COLEGIO"].includes(hkey(c))));
      if (hi < 0) { out.append(el("p", "err", "Não achei a coluna INSTITUIÇÃO nessa aba.")); return; }
      const cols = m[hi].map(h => MAPA[hkey(h)] || null);
      for (const r of m.slice(hi + 1)) {
        const o = {}; cols.forEach((k, i) => { if (k && (o[k] == null || o[k] === "")) o[k] = r[i]; });
        if (!String(o.nome || "").trim()) continue;
        rows.push(o);
      }
      const visitados = rows.filter(r => dataISO(r.dataVisita, X) || String(r.obs || "").trim()).length;
      out.append(el("p", null, `${rows.length} instituições encontradas (${visitados} já visitadas ou com observação).`));
      const st = {}; rows.forEach(r => { const k = String(r.status || "(vazio)").trim() || "(vazio)"; st[k] = (st[k] || 0) + 1; });
      out.append(el("p", "hint", "STATUS na planilha: " + Object.entries(st).map(([k, n]) => `${k} (${n})`).join(" · ")));
      ok.disabled = !rows.length;
    };
    f.onchange = async () => {
      out.innerHTML = ""; const file = f.files[0]; if (!file) return;
      try {
        X = await loadXLSX(); wb = X.read(await file.arrayBuffer(), { type: "array", cellDates: true });
        aba.innerHTML = ""; wb.SheetNames.forEach(n => { const o = el("option", null, n); o.value = n; aba.append(o); });
        aba.hidden = false; fAba.hidden = wb.SheetNames.length < 2; aba.onchange = ler; ler();
      } catch (e) { out.append(el("p", "err", "Não consegui ler o arquivo.")); }
    };
    p.addEventListener("submit", async ev => {
      ev.preventDefault(); if (!rows.length) return; ok.disabled = true;
      const prog = el("p", "hint", "Importando…"); out.append(prog);
      try {
        const exist = new Map(items.map(i => [i.id, i]));
        const agora = new Date().toISOString(); let novos = 0, atual = 0; const ids = new Set();
        const ops = rows.map((r, i) => {
          const s = v => (v == null ? "" : String(v).trim());
          const sim = v => /^(X|SIM|S|OK|1|TEM)$/i.test(s(v)) || Number(s(v)) > 0;
          const contatos = [];
          [r.t1, r.t2, r.t3].forEach((t, k) => { const tel = parseTel(t); if (tel || s(t)) contatos.push({ nome: k === 0 ? s(r.responsavel) : "", cargo: "", tel: tel || s(t) }); });
          if (!contatos.length && s(r.responsavel)) contatos.push({ nome: s(r.responsavel), cargo: "", tel: "" });
          const dv = dataISO(r.dataVisita, X), st = norm(r.status);
          const etapa = /FECH/.test(st) ? "FECHADO" : /NAO|PERD|SEM INTERESSE/.test(st) ? "NÃO FECHOU" : dv || s(r.obs) ? "VISITADO" : "A VISITAR";
          const base = { nome: s(r.nome), nomeBusca: norm(r.nome), tipo,
            segmentos: { pre: sim(r.infantil) || sim(r.pre), ano5: sim(r.ano5), ano9: sim(r.ano9), medio: sim(r.medio) },
            segmentosOrig: { infantil: s(r.infantil), fund1: s(r.fund1), ano5: s(r.ano5), fund2: s(r.fund2), ano9: s(r.ano9), medio: s(r.medio) },
            contatos, email: s(r.email).toLowerCase(), endereco: { rua: s(r.rua), numero: s(r.numero), bairro: s(r.bairro), cidade: s(r.cidade) },
            statusOrig: s(r.status), mediaAlunos: Number(String(r.media).replace(/\D/g, "")) || null, temFotosOrig: s(r.temFotos), dataFoto: dataISO(r.dataFoto, X), atualizadoEm: agora };
          let id = [tipo, slug(r.nome).slice(0, 60) || "inst", slug(r.bairro).slice(0, 24)].filter(Boolean).join("_"); while (ids.has(id)) id += "-" + i; ids.add(id);
          if (exist.has(id)) { atual++; return [id, base, true]; }
          novos++;
          const visitas = (dv || s(r.obs)) ? [{ data: dv, por: "", resultado: s(r.status), obs: s(r.obs), origem: "planilha" }] : [];
          return [id, Object.assign(base, { etapa, followup: null, visitas, tentativas: (s(r.obs).match(/TENTEI LIGAR/gi) || []).length, resp: "", importadoEm: agora }), false];
        });
        for (let i = 0; i < ops.length; i += 400) {
          const b = FS.writeBatch(db);
          ops.slice(i, i + 400).forEach(([id, data, merge]) => merge ? b.set(FS.doc(db, "instituicoes", id), data, { merge: true }) : b.set(FS.doc(db, "instituicoes", id), data));
          await b.commit(); prog.textContent = `Importando… ${Math.min(i + 400, ops.length)} de ${ops.length}`;
        }
        prog.textContent = `Pronto! ${novos} novas${atual ? ` e ${atual} atualizadas` : ""}.`;
        C.toast("Planilha importada ✅");
        const fc = el("button", "btn btn-primary", "Fechar"); fc.type = "button"; fc.onclick = close; out.append(fc);
      } catch (e) { console.warn(e); prog.textContent = ""; out.append(el("p", "err", e.code === "permission-denied" ? "Só administradores podem importar." : "A importação parou. Pode importar de novo: ninguém é duplicado.")); ok.disabled = false; }
    });
  });
}
