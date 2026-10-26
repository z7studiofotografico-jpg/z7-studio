import { ESTUDIO } from "./mensagens.js";
import { el, title, field, inp, sel, sheet, botoes as actions, carregarLib, emPartes, parseTel } from "./ui.js";
import * as Ev from "./eventos.js";
import { openEvento, reservarVarios, liberar, msgErroData, camposEvento, linhaEvento, produtos, avisarColegioPorEmail } from "./eventos.js";
// (o Agendamento importa estas daqui; continuam disponíveis)
export { KINDS, nomeEvento, avisarColegioPorEmail, painelAvisar, msgWhatsColegio } from "./eventos.js";
// Módulo Instituições: colégio particular, colégio público, colégio profissionalizante e faculdade.
// Primeira versão comum aos 4 tipos: lista, cadastro, registro de visita, próximo passo com data
// (aparece em "Para hoje" e no lembrete das 9h) e importação da planilha.
let C, FS, db, col;
let tipo = "particular", tab = "hoje", items = [], unsub = null;
const $ = (id) => document.getElementById(id);

export const TIPOS = {
  particular: { nome: "Colégio particular", ico: "🏫" },
  publico: { nome: "Colégio público", ico: "🏛️" },
  profissionalizante: { nome: "Colégio profissionalizante", ico: "🛠️" },
  faculdade: { nome: "Faculdade", ico: "🎓" }
};
const ETAPAS = ["A VISITAR", "AGENDAR VISITA", "VISITADO", "PROPOSTA ENVIADA", "FECHADO", "NÃO FECHOU"];
const ABERTAS = ["A VISITAR", "AGENDAR VISITA", "VISITADO", "PROPOSTA ENVIADA"];
export const CARGOS = ["Direção", "Coordenação", "Secretaria", "Recepção", "Comissão de formatura", "Professor(a)", "Outro"];
const FOTOGRAFO = ["Não tem fotógrafo", "Só datas comemorativas", "Já tem empresa de formatura", "Não sei"];
const RESULTADOS = [
  ["Fechou 🎉", "FECHADO"], ["Gostou, vai analisar", "VISITADO"], ["Vai decidir em reunião", "VISITADO"],
  ["Pediu proposta / mostruário", "PROPOSTA ENVIADA"], ["Não falou com quem decide", "AGENDAR VISITA"], ["Não atendeu / fechado", "AGENDAR VISITA"],
  ["Já tem fotógrafo", "NÃO FECHOU"], ["Sem interesse / sem verba", "NÃO FECHOU"]
];
const PASSOS = ["Ligar para agendar", "Chamar no WhatsApp", "Mandar e-mail", "Enviar mostruário", "Voltar para visita", "Esperar reunião"];
// Segmentos que interessam para formatura
const SEGMENTOS = [["pre", "Pré"], ["ano5", "5º ano"], ["ano9", "9º ano"], ["medio", "Ensino médio"]];

// ---------- utilidades ----------
function norm(s){ return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim(); }
function slug(s){ return norm(s).replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase(); }
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
// Preços por tipo de instituição (colégio particular e público têm preços diferentes)



// ---------- mensagens prontas para o WhatsApp ----------
function mensagem(it, c){
  const n = c && c.nome ? C.first(title(c.nome)) : "";
  const oi = n ? `Olá, ${n}!` : "Olá!";
  const nome = title(it.nome);
  const ult = (it.visitas || [])[0];
  const apres = ult && ult.apresentou && ult.apresentou.length ? ` (${ult.apresentou.map(p => p.nome.replace(/ \(.*\)$/, "")).join(", ")})` : "";
  if (it.etapa === "A VISITAR" || it.etapa === "AGENDAR VISITA")
    return `${oi} Aqui é ${eu()}, do ${ESTUDIO.nome} 📸 Trabalhamos com fotos de formatura em escolas da região há mais de 15 anos. Gostaria de agendar uma visita rápida ${it.tipo === "faculdade" ? "com a comissão de formatura" : "ao " + nome} para apresentar os nossos kits. Qual o melhor dia e horário?`;
  if (it.etapa === "VISITADO" || it.etapa === "PROPOSTA ENVIADA")
    return `${oi} Aqui é ${eu()}, do ${ESTUDIO.nome}. Passando para saber se conseguiram conversar sobre a proposta das fotos de formatura${apres}. Posso ajudar com alguma dúvida? 😊`;
  if (it.etapa === "NÃO FECHOU")
    return `${oi} Aqui é ${eu()}, do ${ESTUDIO.nome}. Já conversamos sobre as fotos de formatura${nome ? " do " + nome : ""}. Estamos organizando a agenda de ${new Date().getFullYear() + (new Date().getMonth() >= 8 ? 1 : 0)}: podemos marcar uma visita rápida para mostrar as novidades?`;
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
export function init(ctx){ C = ctx; FS = ctx.FS; db = ctx.db; col = FS.collection(db, "instituicoes"); Ev.init(ctx); }

// Agenda → "+ Agendar colégio": escolhe o colégio e o tipo (dia de fotos do PR ou formatura)
// e abre o mesmo formulário do cartão da instituição (com aprovação da Luciana).
export async function agendarColegio(ctx){
  if (!C) init(ctx);
  let lista = [];
  try { lista = (await FS.getDocs(C.carteira("instituicoes", FS.limit(3000)))).docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR")); }
  catch (e) { C.handleErr(e); return; }
  sheet("Agendar colégio", (p, close) => {
    p.append(el("p", "hint", "Para o dia de fotos no colégio (medir beca e fazer o ensaio do PR) ou para a formatura. A data fica segurada até a Luciana aprovar."));
    const tipoEv = sel([["fotos", "📸 Dia de fotos no colégio (PR)"], ["formatura", "🎓 Formatura"]], "fotos");
    const nome = inp("", "comece a digitar o nome do colégio"); nome.required = true;
    const dl = el("datalist"); dl.id = "agInst" + Date.now(); nome.setAttribute("list", dl.id);
    lista.forEach(i => { const o = el("option"); o.value = title(i.nome); o.label = [TIPOS[i.tipo] && TIPOS[i.tipo].nome, i.etapa].filter(Boolean).join(" · "); dl.append(o); });
    const err = el("p", "err"); err.hidden = true;
    p.append(field("O que vai marcar", tipoEv), field("Colégio", nome), dl);
    // Colégio novo: cadastra aqui mesmo, sem sair da agenda
    const novoBox = el("div", "imp"); novoBox.hidden = true;
    const tipoN = sel(Object.entries(TIPOS).map(([k, t]) => [k, t.nome]), tipo || "particular");
    const bairro = inp("", "bairro"), cidade = inp("", "cidade");
    const contato = inp("", "nome do diretor ou responsável"), cargoC = sel(CARGOS, "Direção"), telC = inp("", "WhatsApp", 20), emailC = inp("", "e-mail", 120); telC.inputMode = "tel"; emailC.type = "email";
    const media = inp("", "ex.: 120", 6); media.inputMode = "numeric";
    const r1 = el("div", "row2"); r1.append(field("Bairro", bairro), field("Cidade", cidade));
    const r2 = el("div", "row2"); r2.append(field("Responsável", contato), field("Cargo", cargoC));
    const r3 = el("div", "row2"); r3.append(field("WhatsApp do responsável", telC), field("E-mail do responsável", emailC));
    novoBox.append(el("p", "hint", "Colégio novo: tipo e média de alunos são obrigatórios. O responsável recebe a confirmação no WhatsApp e no e-mail."), field("Tipo", tipoN), field("Média de alunos", media), r1, r2, r3);
    const btNovo = el("button", "btn btn-sm", "+ Cadastrar colégio novo"); btNovo.type = "button";
    btNovo.onclick = () => { novoBox.hidden = !novoBox.hidden; btNovo.textContent = novoBox.hidden ? "+ Cadastrar colégio novo" : "Escolher da lista"; err.hidden = true; };
    const acha = () => { const alvo = norm(nome.value); if (!alvo) return null; const exato = lista.find(i => norm(i.nome) === alvo); if (exato) return exato; const parc = lista.filter(i => norm(i.nome).includes(alvo)); return parc.length === 1 ? parc[0] : null; };
    // ao digitar um nome que não existe, já oferece o cadastro
    nome.addEventListener("change", () => { if (nome.value.trim() && !acha() && novoBox.hidden) btNovo.onclick(); });
    p.append(btNovo, novoBox, err);
    p.append(actions(close, "Continuar"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault(); err.hidden = true;
      let it = novoBox.hidden ? acha() : null;
      if (!it && novoBox.hidden) { err.textContent = "Não achei esse colégio. Escolha um nome da lista ou toque em “+ Cadastrar colégio novo”."; err.hidden = false; return; }
      if (!it) {
        const nm = nome.value.trim(); if (!nm) { err.textContent = "Escreva o nome do colégio."; err.hidden = false; nome.focus(); return; }
        const nMed = Number(String(media.value).replace(/\D/g, "")) || 0;
        if (!nMed) { err.textContent = "Coloque a média de alunos."; err.hidden = false; media.focus(); return; }
        const repetido = lista.find(i => norm(i.nome) === norm(nm)); if (repetido) { it = repetido; }
        else {
          const tel = parseTel(telC.value);
          const novo = { nome: nm, nomeBusca: norm(nm), tipo: tipoN.value, endereco: { rua: "", numero: "", bairro: bairro.value.trim(), cidade: cidade.value.trim() },
            contatos: (contato.value.trim() || tel || emailC.value.trim()) ? [{ nome: contato.value.trim(), cargo: cargoC.value, tel: tel || telC.value.trim(), email: emailC.value.trim().toLowerCase() }] : [],
            segmentos: {}, mediaAlunos: nMed, alunosEstimado: true, etapa: "A VISITAR", followup: null, visitas: [], tentativas: 0, resp: C.me || "", respEmail: C.email || "",
            criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(), origem: "agenda" };
          try { const ref = await FS.addDoc(col, novo); it = Object.assign({ id: ref.id }, novo); C.toast("Colégio cadastrado"); }
          catch (e) { C.handleErr(e); return; }
        }
      }
      close(); openEvento(it, tipoEv.value);
    });
    setTimeout(() => nome.focus(), 30);
  });
}

export function show(t){
  tipo = t; const T = TIPOS[t];
  const v = $("viewInstTipo"); v.innerHTML = "";
  const head = el("div", "vhead"); head.append(el("h2", null, T.ico + " " + T.nome));
  const hb = el("div", "quick");
  hb.append(C.mkBtn("+ Nova instituição", "btn-primary", () => openForm(null)));
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
  // carteira: o vendedor recebe os colégios livres e os dele (o tipo é filtrado aqui)
  unsub = FS.onSnapshot(C.carteira("instituicoes", FS.where("tipo", "==", t), FS.limit(1500)), snap => {
    items = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(x => x.tipo === t); renderChips(); renderStats(); renderList();
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
  if (k === "meus") return C.ehMeu(i) && (ABERTAS.includes(i.etapa) || pendFotos(i));
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
  emPartes(list, arr, card);
}

function card(it){
  const s = status(it);
  const e = el("article", "card " + (["late", "today", "won"].includes(s) ? s : ""));
  const top = el("div", "card-top"); top.append(el("h3", "name", title(it.nome)), el("span", "stage", it.etapa)); e.append(top);
  const meta = el("div", "meta");
  const ps = it.alunosPorSerie || {};
  const segs = SEGMENTOS.filter(([k]) => (it.segmentos || {})[k] || (k === "pre" && (it.segmentos || {}).infantil)).map(([k, t]) => ps[k] ? `${t}: ${ps[k]}` : t);
  [[C.nomeDe(it) ? "👤 " + C.first(C.nomeDe(it)) : "", ""], [[title(it.endereco?.bairro), title(it.endereco?.cidade)].filter(Boolean).join(" · "), "svc"],
   [segs.join(", "), ""], [it.alunosConfirmados ? `${it.alunosConfirmados} alunos (confirmado)` : it.mediaAlunos ? `~${it.mediaAlunos} alunos (média)` : "", ""], [it.fotografoHoje || "", ""], [it.motivo ? "Motivo: " + it.motivo : "", ""]]
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
    pd.append(el("span", null, `⚠️ Pendência: marcar o dia de medir beca e fazer o ensaio de estúdio no ${title(it.nome)} (em Formaturas → Turmas)`), C.mkBtn("🎓 Abrir Formaturas", "btn-primary", () => { location.hash = "formaturas"; }));
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
  act.append(C.mkBtn("Editar", "", () => openForm(it)));
  e.append(act);
  return e;
}

// ---------- janelinhas ----------
// Atalhos de data do próximo passo
function quandoBtns(target){
  const q = el("div", "quick");
  [["Amanhã", 1], ["Semana que vem", 7], ["Mês que vem", 30], ["Início do ano que vem", "ano"], ["Sem data", -1]].forEach(([t, n]) => {
    const b = el("button", "btn btn-sm", t); b.type = "button";
    b.onclick = () => { target.value = n === -1 ? "" : n === "ano" ? anoQueVem() : C.addDays(n); };
    q.append(b);
  });
  return q;
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
    const fot = sel(FOTOGRAFO, it && it.fotografoHoje, "—"); p.append(field("Fotógrafo hoje", fot));
    // Alunos por série (as séries que formam) e total
    const porSerie = (it && it.alunosPorSerie) || {};
    const segBox = el("div", "series");
    const totTxt = el("p", "hint");
    const segChk = SEGMENTOS.map(([k, t]) => {
      const r = el("div", "prow"); const l = el("label", "chk"); const c = el("input"); c.type = "checkbox";
      c.checked = !!(it && it.segmentos && (it.segmentos[k] || (k === "pre" && it.segmentos.infantil)));
      l.append(c, document.createTextNode(" " + t));
      const q = inp(porSerie[k] || "", "alunos", 5); q.inputMode = "numeric"; q.className = "preco"; q.setAttribute("aria-label", "Alunos no " + t);
      q.addEventListener("input", () => { c.checked = !!Number(q.value); somar(); }); c.addEventListener("change", somar);
      r.append(l, q); segBox.append(r); return [k, c, q];
    });
    const extraQ = inp(it && it.alunosOutros ? it.alunosOutros : "", "outros", 6); extraQ.inputMode = "numeric"; extraQ.className = "preco";
    const rx = el("div", "prow"); rx.append(el("span", null, tipo === "faculdade" || tipo === "profissionalizante" ? "Alunos formando (total)" : "Outras séries / total sem série"), extraQ); segBox.append(rx);
    extraQ.addEventListener("input", somar);
    function somar(){ const t = segChk.reduce((a, [, c, q]) => a + (c.checked ? Number(q.value) || 0 : 0), 0) + (Number(extraQ.value) || 0); totTxt.textContent = t ? `Total: ${t} alunos` : "Coloque quantos alunos tem em cada série."; return t; }
    somar();
    { const f = el("div", "field"); f.append(el("label", null, tipo === "faculdade" || tipo === "profissionalizante" ? "Alunos" : "Séries e alunos"), segBox, totTxt); p.append(f); }
    if (tipo === "faculdade" || tipo === "profissionalizante") segChk.forEach(([, , q]) => { q.closest(".prow").hidden = true; });
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
    // Apagar: o administrador apaga qualquer uma; o vendedor só a que está na conta dele
    if (it && (C.isAdmin || (it.respEmail && it.respEmail === C.email))) { const del = el("button", "btn btn-danger btn-sm", "Apagar instituição"); del.type = "button";
      del.onclick = async () => { if (del.dataset.ok) { try {
        // apaga junto os formandos (e parcelas) da turma, para nada ficar solto no Dashboard
        const q = C.isAdmin ? FS.query(FS.collection(db, "formandos"), FS.where("instId", "==", it.id))
          : FS.query(FS.collection(db, "formandos"), FS.where("instId", "==", it.id), FS.where("respEmail", "==", C.email));
        const fs = (await FS.getDocs(q)).docs;
        if (!C.isAdmin) {
          // dinheiro recebido e data confirmada com o colégio não somem pela mão da equipe
          const pagos = fs.filter(d => { const f = d.data(); return (f.pagas || 0) > 0 || (f.pagamentos || []).length; }).length;
          const confirmada = ["diaFotos", "formatura"].some(k => it[k] && it[k].status === "confirmado");
          if (pagos || confirmada) { C.toast(pagos ? `Tem ${pagos} formando${pagos > 1 ? "s" : ""} com parcela paga: só o administrador pode apagar` : "Tem data confirmada com o colégio: só o administrador pode apagar"); return; }
        }
        await liberar(it, "formatura"); await liberar(it, "fotos");
        for (let i = 0; i < fs.length; i += 400) { const b = FS.writeBatch(db); fs.slice(i, i + 400).forEach(d => b.delete(d.ref)); if (i + 400 >= fs.length) b.delete(FS.doc(db, "instituicoes", it.id)); await b.commit(); }
        if (!fs.length) await FS.deleteDoc(FS.doc(db, "instituicoes", it.id));
        C.toast(fs.length ? `Apagada, com ${fs.length} formando${fs.length > 1 ? "s" : ""}` : "Apagada"); close(); } catch (e) { C.handleErr(e); } } else { del.dataset.ok = 1; del.textContent = "Toque de novo: apaga o colégio e os formandos dele"; } }; p.append(del); }
    p.append(actions(close, "Salvar"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault(); if (!nome.value.trim()) return;
      const tipoK = it ? it.tipo : tipo;
      const contatos = linhas.map(({ nm, cg, tl, em }) => ({ nome: nm.value.trim(), cargo: cg.value, tel: parseTel(tl.value) || tl.value.trim(), email: em.value.trim().toLowerCase() })).filter(c => c.nome || c.tel || c.email);
      const body = { nome: nome.value.trim(), nomeBusca: norm(nome.value), tipo: tipoK, endereco: { rua: rua.value.trim(), numero: num.value.trim(), bairro: bai.value.trim(), cidade: cid.value.trim() },
        mediaAlunos: somar() || null, alunosPorSerie: Object.fromEntries(segChk.map(([k, c, q]) => [k, c.checked ? Number(q.value) || 0 : 0])), alunosOutros: Number(extraQ.value) || 0,
        fotografoHoje: fot.value, segmentos: Object.fromEntries(segChk.map(([k, c]) => [k, c.checked])),
        contatos, email: email.value.trim(), horario: hor.value.trim(), notas: nota.value.trim(), atualizadoEm: new Date().toISOString() };
      try {
        if (it) await FS.updateDoc(FS.doc(db, "instituicoes", it.id), body);
        else await FS.addDoc(col, Object.assign(body, { etapa: "A VISITAR", followup: null, visitas: [], tentativas: 0, resp: C.me, respEmail: C.email || "", criadoEm: new Date().toISOString() }));
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
    p.append(el("h3", null, "O que apresentou"), el("p", "hint", "O valor que aparece é o mínimo. Pode colocar mais alto; mais baixo, não."));
    const prodBox = el("div", "imp"); const prods = [];
    produtos(tipo).forEach(pr => {
      const r = el("div", "prow"); const l = el("label", "chk"); const c = el("input"); c.type = "checkbox"; l.append(c, document.createTextNode(" " + pr.nome));
      const v = inp(pr.preco, pr.preco ? "mín. " + C.money(pr.preco) : "R$", 12); v.inputMode = "decimal"; v.className = "preco"; v.setAttribute("aria-label", "Preço de " + pr.nome);
      v.addEventListener("input", () => { if (v.value) c.checked = true; });
      r.append(l, v); prodBox.append(r); prods.push({ nome: pr.nome, c, v, formatura: pr.formatura, min: Number(pr.preco) || 0 });
    });
    const errProd = el("p", "err"); errProd.hidden = true;
    p.append(prodBox, errProd);
    const fBox = camposEvento("formatura", it.formatura, it.nome); fBox.hidden = true; p.append(fBox);
    // Dia de fotos no colégio (medir beca + ensaio)
    const dfL = el("label", "chk"); const dfC = el("input"); dfC.type = "checkbox"; dfL.append(dfC, document.createTextNode(" 📸 Já combinou o dia de fotos no colégio (medir beca + ensaio)"));
    const dBox = camposEvento("fotos", it.diaFotos, it.nome); dBox.hidden = true; dfC.onchange = () => { dBox.hidden = !dfC.checked; };
    p.append(dfL, dBox);
    const syncF = () => { const fx = prods.find(x => x.formatura && x.c.checked); fBox.hidden = !fx; if (fx) { fBox.onde.value = fx.formatura; dfC.checked = true; dBox.hidden = false; } };
    prods.forEach(x => x.c.addEventListener("change", syncF));
    const res = sel(RESULTADOS.map(r => r[0]), "", "escolha o resultado"); res.required = true; p.append(field("Resultado", res));
    const motivoBox = el("div"); const motivo = inp("", "ex.: já gastaram com outros eventos este ano"); motivoBox.append(field("Motivo de não fechar", motivo)); motivoBox.hidden = true; p.append(motivoBox);
    res.onchange = () => { const et = (RESULTADOS.find(r => r[0] === res.value) || [])[1]; motivoBox.hidden = et !== "NÃO FECHOU"; };
    const passo = sel(PASSOS, "", "próximo passo"); const quando = el("input"); quando.type = "date";
    const qHora = el("input"); qHora.type = "time"; qHora.step = 900;
    const r2 = el("div", "row3"); r2.append(field("Próximo passo", passo), field("Quando", quando), field("Horário (opcional)", qHora)); p.append(r2, quandoBtns(quando));
    p.append(el("p", "hint", "Visita marcada (“Voltar para visita”) aparece no Agendamento, sem bloquear o dia."));
    const obs = el("textarea"); obs.rows = 3; obs.maxLength = 2000; obs.placeholder = "Ex.: pediu retorno dia 16; tem interesse em aluguel de beca"; p.append(field("Observação", obs));
    p.append(actions(close, "Salvar visita"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault(); if (!res.value) return;
      // Preço mínimo: o vendedor pode subir o valor, mas não baixar
      const abaixo = prods.filter(x => x.c.checked && x.min && C.num(x.v.value) < x.min);
      if (abaixo.length) { errProd.textContent = "Abaixo do valor mínimo: " + abaixo.map(x => `${x.nome} (mín. ${C.money(x.min)})`).join(", "); errProd.hidden = false; errProd.scrollIntoView({ block: "center" }); return; }
      errProd.hidden = true;
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
      const visita = { data: data.value, como: como.value, por: C.me || "", porEmail: C.email || "", falouCom: [falou.value.trim(), cargo.value].filter(Boolean).join(" · "), resultado: res.value,
        apresentou: prods.filter(x => x.c.checked).map(x => ({ nome: x.nome, preco: C.num(x.v.value) })), passo: passo.value, quando: quando.value, obs: obs.value.trim(), em: new Date().toISOString() };
      const patch = { etapa, fotografoHoje: fot.value || it.fotografoHoje || "", proximoPasso: passo.value, followup: etapa === "FECHADO" ? null : (quando.value || null), followupHora: etapa === "FECHADO" || !quando.value ? "" : qHora.value,
        atendendo: null, ultimo: { por: C.me || "—", em: new Date().toISOString() } };
      if (etapa === "FECHADO") patch.fechadoEm = C.todayStr();
      if (formatura) patch.formatura = formatura;
      if (diaFotos) patch.diaFotos = diaFotos;
      if (etapa === "NÃO FECHOU") patch.motivo = motivo.value.trim() || res.value;
      const nomeF = falou.value.trim(), telF = parseTel(tel.value);
      close();
      // Transação: lê a versão atual (outra pessoa pode ter registrado uma visita agora) e junta
      try {
        const ref = FS.doc(db, "instituicoes", it.id);
        await FS.runTransaction(db, async tx => {
          const s0 = await tx.get(ref), atual = s0.exists() ? s0.data() : it;
          const p2 = Object.assign({}, patch, { visitas: [visita, ...(atual.visitas || [])].slice(0, 50), atualizadoEm: new Date().toISOString() });
          if (etapa === "AGENDAR VISITA") p2.tentativas = (atual.tentativas || 0) + 1;
          // sem responsável ainda: quem registrou a visita assume
          if (!atual.respEmail && !atual.resp) { p2.resp = C.me || ""; p2.respEmail = C.email || ""; }
          // guarda o contato novo, se veio
          if (nomeF || telF) {
            const lista = (atual.contatos || []).slice(); const i0 = lista.findIndex(c => norm(c.nome) === norm(nomeF) && nomeF);
            if (i0 >= 0) { lista[i0] = Object.assign({}, lista[i0], { cargo: cargo.value || lista[i0].cargo, tel: telF || lista[i0].tel }); }
            else lista.push({ nome: nomeF, cargo: cargo.value, tel: telF });
            p2.contatos = lista;
          }
          tx.update(ref, p2);
        });
        C.toast(etapa === "FECHADO" ? "Fechado! 🎉" : quando.value ? "Retorno em " + C.fmtDate(quando.value) : "Visita registrada");
      } catch (er) { C.handleErr(er); }
    });
  });
}

// ---------- importar planilha ----------
const MAPA = { PRE: "pre", PREESCOLA: "pre", INSTITUICAO: "nome", ESCOLA: "nome", COLEGIO: "nome", INFANTIL: "infantil", FUNDAMENTALI: "fund1", "5ANO": "ano5", FUNDAMENTALII: "fund2", "9ANO": "ano9",
  ENSINOMEDIO: "medio", TELEFONE1: "t1", TELEFONE2: "t2", TELEFONE3: "t3", EMAIL: "email", ENDERECO: "rua", N: "numero", NO: "numero", NUMERO: "numero",
  BAIRRO: "bairro", CIDADE: "cidade", DATADAVISITA: "dataVisita", STATUS: "status", MEDIADEALUNOS: "media", RESPONSAVEL: "responsavel",
  TEMFOTOSDEFORMATURA: "temFotos", DATADAFOTO: "dataFoto", OBSERVACAO: "obs", OBSERVACOES: "obs", OBS: "obs" };
const hkey = h => String(h || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(\d)O?ANO$/, "$1ANO");
function loadXLSX(){ return carregarLib("xlsx"); }
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
            alunosPorSerie: { pre: Number(s(r.infantil) || s(r.pre)) || 0, ano5: Number(s(r.ano5)) || 0, ano9: Number(s(r.ano9)) || 0, medio: Number(s(r.medio)) || 0 },
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
