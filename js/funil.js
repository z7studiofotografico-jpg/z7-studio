// Funil de vendas: leads do WhatsApp, mensagens prontas, follow-ups e venda.
// Antes ficava dentro do index.html; agora é um módulo como os outros.
import { avisoErro, emPartes, norm } from "./ui.js";
import { campoReais } from "./regras.js";
import { ESTUDIO } from "./mensagens.js";
import * as U from "./util.js";
let C,
  leads = [],
  filter = "ABERTOS",
  editing = null;
const $ = id => document.getElementById(id);
// atalhos para as funções do app (vêm do index.html)
const money = v => U.money(v),
  num = v => U.num(v),
  digits = t => U.digits(t),
  first = n => U.first(n),
  todayStr = () => U.todayStr(),
  addDays = n => U.addDays(n),
  fmtDate = s => U.fmtDate(s),
  hhmm = i => U.hhmm(i),
  ds = d => U.ds(d),
  toast = m => U.toast(m),
  handleErr = e => C.handleErr(e),
  mkBtn = (a, b, c) => U.mkBtn(a, b, c),
  team = () => C.team();
const pv = v => (v ? money(v) : "[valor]");
let db;
const { updateDoc, addDoc, deleteDoc, doc, collection, onSnapshot } = {
  updateDoc: (...a) => C.FS.updateDoc(...a),
  addDoc: (...a) => C.FS.addDoc(...a),
  deleteDoc: (...a) => C.FS.deleteDoc(...a),
  doc: (...a) => C.FS.doc(...a),
  collection: (...a) => C.FS.collection(...a),
  onSnapshot: (...a) => C.FS.onSnapshot(...a)
};
// e-mail de quem tem esse nome na Equipe (o responsável fica guardado pelo e-mail, que não muda)
const emailDe = nome => {
  const e = Object.entries(C.usuarios || {}).find(([, u]) => u.nome === nome);
  return e ? e[0] : "";
};
export const getLeads = () => leads;
export function init(ctx) {
  C = ctx;
  db = ctx.db;
  fill($("fServ"), SERVS);
  fill($("fOrig"), ORIGS);
  fill($("fEtapa"), STAGES);
  ligar();
}
function fill(sel, arr) {
  sel.innerHTML = "";
  arr.forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  });
}
// Lista de responsáveis no formulário
function renderResp() {
  const sel = $("fResp"),
    cur = sel.value;
  sel.innerHTML = "";
  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = "Ninguém";
  sel.appendChild(o0);
  const names = team();
  if (cur && !names.includes(cur)) names.push(cur);
  names.forEach(n => {
    const o = document.createElement("option");
    o.value = n;
    o.textContent = n;
    sel.appendChild(o);
  });
  sel.value = cur;
}
// Para a tela inicial: quantos contatos para hoje e atrasados
export function contagem() {
  const st = leads.map(status);
  return { late: st.filter(s => s === "late").length, today: st.filter(s => s === "today").length };
}
export function parar() {
  if (unsubLeads) {
    unsubLeads();
    unsubLeads = null;
  }
  leads = [];
}
export function fecharForm() {
  closeForm();
}

const STAGES = ["NOVO LEAD", "QUALIFICADO", "PROPOSTA ENVIADA", "FOLLOW-UP", "FECHADO", "PERDIDO"];
const OPEN = ["NOVO LEAD", "QUALIFICADO", "PROPOSTA ENVIADA", "FOLLOW-UP"];
const SERVS = ["Formatura individual (estúdio)", "Formatura individual (externo)", "Turma", "Corporativo", "Retrato", "Outro"];
const ORIGS = ["Meta Ads", "Instagram", "WhatsApp", "Indicação", "Google", "Ex-cliente", "Instituição/Coordenação", "Outro"];

function status(l) {
  if (l.etapa === "FECHADO") return "won";
  if (!OPEN.includes(l.etapa) || !l.followup) return "none";
  const t = todayStr();
  return l.followup < t ? "late" : l.followup === t ? "today" : "later";
}
function lockInfo(l) {
  const a = l.atendendo;
  if (!a || !a.por || !a.desde) return null;
  const mins = (Date.now() - Date.parse(a.desde)) / 60000;
  if (!(mins >= 0 && mins <= 30)) return null;
  return { por: a.por, desde: a.desde, mine: a.por === C.me };
}

// ---------- mensagens prontas ----------
function nextStep(l) {
  const n = first(l.nome),
    turma = l.servico === "Turma",
    corp = l.servico === "Corporativo";
  const valor = l.valor ? money(l.valor) : pv(C.P.individual);
  const t = l.tentativas || 0;
  switch (l.etapa) {
    case "NOVO LEAD":
      return {
        title: "Qualificar: descobrir o que a pessoa precisa",
        msg: `Olá, ${n}! Que bom ter você aqui 😊 Sou ${first(C.me) ? (/a$/i.test(first(C.me)) ? "a " : "o ") + first(C.me) : "do time"}, do ${ESTUDIO.curto}.\nO orçamento é só para você ou para a sua turma? E qual a data da sua colação?`,
        then: { etapa: "QUALIFICADO", days: 1 }
      };
    case "QUALIFICADO":
      if (turma)
        return {
          title: "Coletar dados da turma",
          msg: `Perfeito, ${n}! Para montar o orçamento da turma, me diga:\n• Instituição\n• Curso\n• Quantidade de alunos\n• Mês previsto para as fotos`,
          then: { etapa: "PROPOSTA ENVIADA", days: 1 }
        };
      if (corp)
        return {
          title: "Entender o trabalho corporativo",
          msg: `Perfeito, ${n}! Para te passar o orçamento: quantas pessoas serão fotografadas, as fotos são para site/LinkedIn ou evento, e qual a data ideal?`,
          then: { etapa: "PROPOSTA ENVIADA", days: 1 }
        };
      return {
        title: "Enviar o valor em texto (sem PDF)",
        msg: `${n}, o ensaio de formatura no estúdio fica ${valor}, com cerca de ${C.P.fotos || 30} fotos tratadas entregues em até ${C.P.prazo || 15} dias.\nJá estão inclusos: beca, cadeira, 2 fundos, acessórios, fotos com família (até 4 pessoas) e pet.\nPara reservar a data, o sinal é de ${pv(C.P.sinal)} via Pix. Qual dia fica melhor para você?`,
        then: { etapa: "PROPOSTA ENVIADA", days: 1 }
      };
    case "PROPOSTA ENVIADA":
      return {
        title: "1º follow-up (tirar dúvida)",
        msg: `Oi, ${n}! Conseguiu ver o orçamento? Ficou alguma dúvida que eu possa te ajudar a resolver?`,
        then: { etapa: "FOLLOW-UP", days: 2, count: true }
      };
    case "FOLLOW-UP":
      if (t <= 1)
        return {
          title: "2º follow-up (oferecer data)",
          msg: `${n}, separei algumas datas livres para o seu ensaio. Quer que eu te mostre? Se vier com colegas no mesmo dia, cada um paga ${pv(C.P.g36)} (de 3 a 6 formandos).`,
          then: { etapa: "FOLLOW-UP", days: 4, count: true }
        };
      return {
        title: "3º follow-up (encerrar com elegância)",
        msg: `${n}, vou entender que agora não é o momento e não vou mais te incomodar. Quando quiser, é só me chamar! 😊`,
        then: { etapa: "PERDIDO", days: -1, count: true }
      };
    case "FECHADO":
      return {
        title: "Pós-venda: pedir depoimento e indicação",
        msg: `${n}, que bom que você gostou das fotos! 💛 Pode me mandar um áudio ou texto curto contando como foi a experiência? E se algum colega também vai se formar, me indica? Vou adorar fotografar.`,
        then: null
      };
    default:
      return null;
  }
}

// ---------- gravação ----------
async function save(id, patch, msg) {
  try {
    patch.atualizadoEm = new Date().toISOString();
    await updateDoc(doc(db, "leads", id), patch);
    toast(msg || "Salvo");
  } catch (e) {
    handleErr(e);
  }
}
function claim(l) {
  if (!C.me) return;
  const li = lockInfo(l);
  if (li && li.mine) return;
  save(l.id, { atendendo: { por: C.me, desde: new Date().toISOString() } }, "O outro aparelho vai ver: " + C.me + " está respondendo");
}

function renderChips() {
  const c = $("chips");
  c.innerHTML = "";
  const counts = {
    ABERTOS: leads.filter(l => OPEN.includes(l.etapa)).length,
    TODOS: leads.length,
    MEUS: leads.filter(l => C.ehMeu(l) && OPEN.includes(l.etapa)).length
  };
  STAGES.forEach(s => (counts[s] = leads.filter(l => l.etapa === s).length));
  ["ABERTOS", "MEUS", ...STAGES, "TODOS"].forEach(k => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.setAttribute("aria-pressed", String(filter === k));
    b.textContent = k === "ABERTOS" ? "Em aberto" : k === "TODOS" ? "Todos" : k === "MEUS" ? "Só os meus" : k;
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = counts[k];
    b.appendChild(n);
    b.onclick = () => {
      filter = k;
      render();
    };
    c.appendChild(b);
  });
}
function renderStats() {
  const st = leads.map(status);
  const late = st.filter(s => s === "late").length,
    today = st.filter(s => s === "today").length;
  $("sLate").textContent = late;
  $("sToday").textContent = today;
  $("sOpen").textContent = leads.filter(l => OPEN.includes(l.etapa)).length;
  const ym = todayStr().slice(0, 7);
  $("sWon").textContent = money(
    leads.filter(l => l.etapa === "FECHADO" && (l.fechadoEm || "").slice(0, 7) === ym).reduce((a, l) => a + (Number(l.valor) || 0), 0)
  );
  try {
    if ("setAppBadge" in navigator) {
      late + today ? navigator.setAppBadge(late + today) : navigator.clearAppBadge();
    }
  } catch (_) {}
}

function card(l) {
  const s = status(l);
  const el = document.createElement("article");
  el.className = "card " + (["late", "today", "won"].includes(s) ? s : "");
  const top = document.createElement("div");
  top.className = "card-top";
  const h = document.createElement("h3");
  h.className = "name";
  h.textContent = l.nome || "Sem nome";
  const sg = document.createElement("span");
  sg.className = "stage";
  sg.textContent = l.etapa;
  top.append(h, sg);
  el.appendChild(top);

  const meta = document.createElement("div");
  meta.className = "meta";
  [
    [C.nomeDe(l) ? "👤 " + first(C.nomeDe(l)) : "", ""],
    [l.servico, "svc"],
    [l.origem, ""],
    [l.valor ? money(l.valor) : "", ""],
    [l.tentativas ? l.tentativas + "º follow-up feito" : "", ""]
  ].forEach(([v, c]) => {
    if (v) {
      const t = document.createElement("span");
      t.className = "tag " + c;
      t.textContent = v;
      meta.appendChild(t);
    }
  });
  el.appendChild(meta);
  if (l.telefone) {
    const p = document.createElement("div");
    p.className = "phone";
    p.textContent = l.telefone;
    el.appendChild(p);
  }

  const fu = document.createElement("div");
  fu.className = "fu " + (s === "late" ? "late" : s === "today" ? "today" : l.followup ? "" : "none");
  if (OPEN.includes(l.etapa))
    fu.textContent = l.followup
      ? s === "late"
        ? "Atrasado desde " + fmtDate(l.followup)
        : s === "today"
          ? "Contato para hoje"
          : "Próximo contato: " + fmtDate(l.followup)
      : "Sem data de contato";
  else
    fu.textContent =
      l.etapa === "FECHADO"
        ? "Fechado" + (l.fechadoEm ? " em " + fmtDate(l.fechadoEm) : "") + (l.conferido === false ? " · ⏳ a conferir" : "")
        : "Encerrado";
  el.appendChild(fu);
  if (l.notas) {
    const n = document.createElement("p");
    n.className = "notes";
    n.textContent = l.notas;
    el.appendChild(n);
  }
  if (l.ultimo && l.ultimo.em) {
    const u = document.createElement("div");
    u.className = "last";
    u.textContent =
      "Último contato: " + (first(l.ultimo.por) || "—") + " · " + fmtDate(ds(new Date(l.ultimo.em))) + " às " + hhmm(l.ultimo.em);
    el.appendChild(u);
  }

  const li = lockInfo(l);
  if (li) {
    const lk = document.createElement("div");
    lk.className = "lock " + (li.mine ? "mine" : "other");
    const t = document.createElement("span");
    t.textContent = li.mine
      ? "✋ Você está respondendo (desde " + hhmm(li.desde) + ")"
      : "⚠️ " + first(li.por) + " está respondendo desde " + hhmm(li.desde);
    lk.appendChild(t);
    if (li.mine) lk.appendChild(mkBtn("Liberar", "", () => save(l.id, { atendendo: null }, "Cartão liberado")));
    else
      lk.appendChild(
        mkBtn("Assumir mesmo assim", "", () => {
          if (!C.me) return;
          save(l.id, { atendendo: { por: C.me, desde: new Date().toISOString() } }, "Agora você está respondendo");
        })
      );
    el.appendChild(lk);
  }
  const blocked = li && !li.mine;

  const ns = nextStep(l);
  if (ns) {
    const box = document.createElement("div");
    box.className = "next";
    const sm = document.createElement("small");
    sm.textContent = "Próximo passo: " + ns.title;
    const msg = document.createElement("p");
    msg.textContent = ns.msg;
    if (blocked) {
      const w = document.createElement("p");
      w.className = "wait";
      w.textContent = "Espere " + first(li.por) + " terminar, ou toque em “Assumir mesmo assim”.";
      box.append(sm, msg, w);
    } else {
      const row = document.createElement("div");
      row.className = "row";
      const d = digits(l.telefone);
      if (d) {
        const a = document.createElement("a");
        a.className = "btn btn-sm btn-primary";
        a.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(ns.msg);
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Abrir no WhatsApp";
        a.addEventListener("click", () => claim(l));
        row.appendChild(a);
      }
      row.appendChild(
        mkBtn("Copiar texto", "", async () => {
          claim(l);
          try {
            await navigator.clipboard.writeText(ns.msg);
            toast("Texto copiado");
          } catch (_) {
            const r = document.createRange();
            r.selectNodeContents(msg);
            const sel = getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
            toast("Texto selecionado, copie com o dedo");
          }
        })
      );
      if (C.P.pixSinal && d && ["QUALIFICADO", "PROPOSTA ENVIADA", "FOLLOW-UP"].includes(l.etapa)) {
        const pm = `Para reservar a data, o sinal${C.P.sinal ? ` é de ${money(C.P.sinal)}` : ""} no Pix: abra o app do seu banco, escolha *Pix Copia e Cola* e cole o código que vou mandar na próxima mensagem 👇 Depois me manda o comprovante por aqui 😊`;
        const a4 = document.createElement("a");
        a4.className = "btn btn-sm";
        a4.textContent = "💠 Pix do sinal";
        a4.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(pm);
        a4.target = "_blank";
        a4.rel = "noopener";
        row.appendChild(a4);
        const a5 = document.createElement("a");
        a5.className = "btn btn-sm";
        a5.textContent = "📋 Código Pix";
        a5.href = "https://wa.me/" + d + "?text=" + encodeURIComponent(C.P.pixSinal);
        a5.target = "_blank";
        a5.rel = "noopener";
        row.appendChild(a5);
      }
      if (ns.then)
        row.appendChild(
          mkBtn("Enviei ✓", "btn-ok", () => {
            const p = {
              etapa: ns.then.etapa,
              followup: ns.then.days < 0 ? "" : addDays(ns.then.days),
              atendendo: null,
              ultimo: { por: C.me || "—", em: new Date().toISOString() }
            };
            if (ns.then.count) p.tentativas = (l.tentativas || 0) + 1;
            if (!l.resp && C.me) {
              p.resp = C.me;
              p.respEmail = C.email || "";
            }
            save(l.id, p, p.etapa === "PERDIDO" ? "Lead encerrado" : "Próximo contato em " + fmtDate(p.followup));
          })
        );
      box.append(sm, msg, row);
    }
    el.appendChild(box);
  }

  const act = document.createElement("div");
  act.className = "actions";
  if (OPEN.includes(l.etapa) && !li) act.appendChild(mkBtn("✋ Estou respondendo", "", () => claim(l)));
  if (OPEN.includes(l.etapa)) {
    act.appendChild(mkBtn("Fechou", "btn-ok", () => openForm(l, { etapa: "FECHADO" })));
    act.appendChild(mkBtn("Remarcar +1d", "", () => save(l.id, { followup: addDays(1) }, "Remarcado para " + fmtDate(addDays(1)))));
    act.appendChild(mkBtn("Perdido", "", () => save(l.id, { etapa: "PERDIDO", followup: "", atendendo: null }, "Lead encerrado")));
  } else if (l.etapa === "PERDIDO") {
    act.appendChild(mkBtn("Reabrir", "", () => save(l.id, { etapa: "FOLLOW-UP", followup: todayStr(), tentativas: 0 }, "Lead reaberto")));
  }
  if (C.isAdmin && l.etapa === "FECHADO" && l.conferido === false)
    act.appendChild(mkBtn("✔ Conferir venda", "btn-ok", () => save(l.id, { conferido: true }, "Venda conferida: já conta no Dashboard")));
  if (C.isAdmin && l.etapa !== "PERDIDO") act.appendChild(mkBtn("📅 Marcar ensaio", "", () => marcarEnsaio(l)));
  act.appendChild(mkBtn("Editar", "", () => openForm(l)));
  el.appendChild(act);
  return el;
}

// Abre a agenda já com o cliente do Funil preenchido
async function marcarEnsaio(l) {
  try {
    await C.abrirEnsaio({
      cliente: l.nome || "",
      tel: l.telefone || "",
      servico: l.servico || "",
      leadId: l.id,
      valor: l.valor || "",
      sinalPago: l.etapa === "FECHADO"
    });
  } catch (e) {
    avisoErro(e, "abrir a agenda", toast);
  }
}
// Busca pelo nome no servidor, para achar também leads fechados ou perdidos há mais de 60 dias
const antigos = new Map();
let ultimaBusca = "",
  timerBusca = null;
function buscarNoServidor(q) {
  const nq = norm(q);
  if (nq.length < 3 || nq === ultimaBusca) return;
  clearTimeout(timerBusca);
  timerBusca = setTimeout(async () => {
    ultimaBusca = nq;
    try {
      const { query, where, limit, getDocs } = C.FS;
      const s = await getDocs(
        query(collection(db, "leads"), where("nomeBusca", ">=", nq), where("nomeBusca", "<=", nq + "\uf8ff"), limit(20))
      );
      let novos = 0;
      s.docs.forEach(d => {
        if (!antigos.has(d.id)) novos++;
        antigos.set(d.id, Object.assign({ id: d.id }, d.data()));
      });
      if (novos) render();
    } catch (e) {
      avisoErro(e, "buscar leads antigos");
    }
  }, 400);
}
export function render() {
  if (!$("list")) return;
  renderChips();
  renderStats();
  const q = $("q").value.trim().toLowerCase();
  buscarNoServidor(q);
  // na busca entram também os leads antigos achados no servidor (a lista só carrega abertos + últimos 60 dias)
  const base = q ? leads.concat([...antigos.values()].filter(a => !leads.some(l => l.id === a.id))) : leads;
  // com busca, procura em todas as etapas (quem digita um nome quer achar a pessoa, esteja onde estiver)
  let arr = base.filter(l =>
    q || filter === "TODOS"
      ? true
      : filter === "ABERTOS"
        ? OPEN.includes(l.etapa)
        : filter === "MEUS"
          ? C.ehMeu(l) && OPEN.includes(l.etapa)
          : l.etapa === filter
  );
  if (q) arr = arr.filter(l => norm([l.nome, l.telefone, l.notas, l.servico, l.origem, l.resp].join(" ")).includes(norm(q)));
  const rank = { late: 0, today: 1, later: 2, none: 3, won: 4 };
  arr.sort(
    (a, b) =>
      rank[status(a)] - rank[status(b)] ||
      ((a.followup || "9") < (b.followup || "9") ? -1 : (a.followup || "9") > (b.followup || "9") ? 1 : 0) ||
      ((b.criadoEm || "") > (a.criadoEm || "") ? 1 : -1)
  );
  const list = $("list");
  list.innerHTML = "";
  if (!arr.length) {
    const e = document.createElement("div");
    e.className = "empty";
    e.style.gridColumn = "1/-1";
    const s = document.createElement("strong");
    s.textContent = leads.length ? "Nada nesta etapa" : "Nenhum lead ainda";
    const p = document.createElement("span");
    p.textContent = leads.length
      ? "Troque o filtro acima ou cadastre um contato novo."
      : "Toque em “+ Novo lead” quando alguém chamar no WhatsApp pedindo orçamento.";
    e.append(s, p);
    list.appendChild(e);
    return;
  }
  emPartes(list, arr, card);
}

// ---------- formulário de lead ----------
function openForm(l, preset) {
  editing = l || null;
  preset = preset || {};
  $("formTitle").textContent = preset.etapa === "FECHADO" ? "Registrar venda" : l ? "Editar lead" : "Novo lead";
  $("fNome").value = l?.nome || "";
  $("fTel").value = l?.telefone || "";
  $("fValor").value = campoReais(l?.valor ? String(l.valor).replace(".", ",") : "");
  $("fServ").value = l?.servico || SERVS[0];
  $("fOrig").value = l?.origem || "WhatsApp";
  $("fEtapa").value = preset.etapa || l?.etapa || "NOVO LEAD";
  $("fFu").value = l ? l.followup || "" : todayStr();
  $("fNotas").value = l?.notas || "";
  renderResp();
  $("fResp").value = l ? l.resp || "" : C.me || "";
  // a equipe não apaga lead, não troca o responsável de lead de outra pessoa e não mexe no valor de venda fechada
  const fechado = !!l && l.etapa === "FECHADO",
    deOutro = !!l && !!l.respEmail && l.respEmail !== C.email;
  $("fResp").disabled = !C.isAdmin && deOutro;
  ["fValor", "fEtapa"].forEach(id => {
    $(id).disabled = !C.isAdmin && fechado;
  });
  // lead novo da equipe não nasce como venda: primeiro salva, depois "Fechou"
  [...$("fEtapa").options].forEach(o => {
    if (o.value === "FECHADO") o.disabled = !C.isAdmin && !l;
  });
  $("btnDel").hidden = !l || !C.isAdmin;
  $("confirmDel").hidden = true;
  $("sheet").hidden = false;
  setTimeout(() => (preset.etapa === "FECHADO" ? $("fValor") : $("fNome")).focus(), 30);
}
function closeForm() {
  $("sheet").hidden = true;
  editing = null;
}

// O funil só é carregado para quem tem permissão.
// Para não ler o histórico inteiro: os leads em aberto + os mexidos nos últimos 60 dias.
let unsubLeads = null;
export const DIAS_HISTORICO = 60;
export function syncLeads() {
  const ok = C.pode("funil");
  if (ok && !unsubLeads) {
    const { query, where, limit } = C.FS,
      c = collection(db, "leads"),
      partes = { abertos: [], recentes: [] };
    const juntar = () => {
      const m = new Map();
      [...partes.abertos, ...partes.recentes].forEach(l => m.set(l.id, l));
      leads = [...m.values()];
      render();
      C.aoMudarLeads();
    };
    const ouvir = (nome, q) =>
      onSnapshot(
        q,
        snap => {
          partes[nome] = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
          juntar();
        },
        err => {
          if (err.code !== "permission-denied") U.showNotice("A conexão caiu. Feche e abra o app de novo.");
        }
      );
    const desde = new Date(Date.now() - DIAS_HISTORICO * 864e5).toISOString();
    const u1 = ouvir("abertos", query(c, where("etapa", "in", OPEN), limit(2000)));
    const u2 = ouvir("recentes", query(c, where("atualizadoEm", ">=", desde), limit(2000)));
    unsubLeads = () => {
      u1();
      u2();
    };
  }
  if (!ok && unsubLeads) {
    unsubLeads();
    unsubLeads = null;
    leads = [];
    render();
  }
}

function ligar() {
  $("btnNew").onclick = () => openForm(null);
  $("btnCancel").onclick = closeForm;
  $("sheet").addEventListener("click", e => {
    if (e.target === $("sheet")) closeForm();
  });
  document.querySelectorAll("[data-add]").forEach(
    b =>
      (b.onclick = () => {
        const n = +b.dataset.add;
        $("fFu").value = n < 0 ? "" : addDays(n);
      })
  );
  $("btnDel").onclick = () => {
    $("confirmDel").hidden = false;
  };
  $("delNo").onclick = () => {
    $("confirmDel").hidden = true;
  };
  $("delYes").onclick = async () => {
    if (!editing) return;
    try {
      await deleteDoc(doc(db, "leads", editing.id));
      toast("Lead apagado");
      closeForm();
    } catch (e) {
      handleErr(e);
    }
  };
  $("q").addEventListener("input", render);
  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const nome = $("fNome").value.trim();
    if (!nome) {
      $("fNome").focus();
      return;
    }
    const etapa = $("fEtapa").value;
    const body = {
      nome,
      telefone: $("fTel").value.trim(),
      valor: num($("fValor").value),
      servico: $("fServ").value,
      origem: $("fOrig").value,
      etapa,
      followup: OPEN.includes(etapa) ? $("fFu").value : "",
      notas: $("fNotas").value.trim(),
      resp: $("fResp").value,
      respEmail: emailDe($("fResp").value),
      nomeBusca: norm(nome),
      atualizadoEm: new Date().toISOString()
    };
    $("btnSave").disabled = true;
    try {
      if (editing) {
        if (etapa === "FECHADO") {
          if (editing.etapa !== "FECHADO" || C.isAdmin) body.fechadoEm = editing.fechadoEm || todayStr();
          // venda fechada pela equipe entra "a conferir" (só conta no Dashboard depois que o admin confere)
          if (editing.etapa !== "FECHADO") body.conferido = !!C.isAdmin;
          body.atendendo = null;
        }
        await updateDoc(doc(db, "leads", editing.id), body);
      } else {
        body.criadoEm = new Date().toISOString();
        body.tentativas = 0;
        if (etapa === "FECHADO") {
          if (!C.isAdmin) {
            toast("Salve o lead primeiro e depois toque em “Fechou” no card dele.");
            return;
          }
          body.fechadoEm = todayStr();
          body.conferido = true;
        }
        await addDoc(collection(db, "leads"), body);
      }
      toast(etapa === "FECHADO" ? "Venda registrada 🎉" : "Lead salvo");
      closeForm();
    } catch (err) {
      handleErr(err);
    } finally {
      $("btnSave").disabled = false;
    }
  });
}
