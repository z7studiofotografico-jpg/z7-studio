// Atividades da equipe (10/11/2026): o que a equipe faz no PR, Paspatur, Formatura e Instituições fica anotado na
// coleção "atividades". O admin vê um número vermelho no botão com o nome dele (topo do app); ao tocar, o resumo do
// dia por pessoa e a lista. "Marcar como visto" zera o número (guardado no aparelho).
import { el, sheet } from "./ui.js";
import * as U from "./util.js";

export const NOMES_LISTA = { pr: "PR", paspatur: "Paspatur", formatura: "Formatura", inst: "Instituições" };
const RESUMO = [
  ["hoje", "para hoje", "para hoje"],
  ["caido", "caído", "caídos"],
  ["interessado", "interessado", "interessados"],
  ["venda", "venda", "vendas"],
  ["visita", "visita", "visitas"]
];

// Gravação de um aluno do PR/Paspatur/Formatura → atividade (ou null). it = como estava; patch = o que mudou.
export function atividadeDoPatch(it, patch, hoje) {
  if (!it || !patch) return null;
  const quem = [title1(it.nome) || "um aluno", it.escola ? `(${title1(it.escola)})` : ""].filter(Boolean).join(" ");
  if (patch.etapa && patch.etapa !== it.etapa) {
    if (patch.etapa === "CAÍDO") return { tipo: "caido", texto: `passou ${quem} para caídos` };
    if (patch.etapa === "INTERESSADO") return { tipo: "interessado", texto: `marcou ${quem} como interessado` };
    if (patch.etapa === "PAGO") return { tipo: "venda", texto: `vendeu para ${quem}` };
  }
  if (patch.followup && patch.followup === hoje && !(it.followup && it.followup <= hoje))
    return { tipo: "hoje", texto: `colocou ${quem} para hoje` };
  return null;
}
function title1(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/(^|\s)\S/g, c => c.toUpperCase())
    .trim();
}

// Só a equipe gera atividade (o admin, e o admin "vendo como" alguém, não)
export function registrarAtividade(C, a) {
  if (!a || !C || C.isAdmin || C.verComo || !C.email) return;
  const d = {
    tipo: String(a.tipo || "").slice(0, 20),
    texto: String(a.texto || "").slice(0, 200),
    n: Math.max(1, Math.min(999, Number(a.n) || 1)),
    lista: String(a.lista || "").slice(0, 20),
    por: String(C.me || "").slice(0, 80),
    email: C.email,
    dia: U.todayStr(),
    em: new Date().toISOString()
  };
  C.FS.addDoc(C.FS.collection(C.db, "atividades"), d).catch(e => console.warn("[Z7] atividade", e));
}

// Resumo do dia por pessoa: [{ por, email, partes: "12 para hoje · 3 caídos", total }]
export function resumoPorPessoa(lista) {
  const m = new Map();
  lista.forEach(a => {
    const k = a.email || a.por;
    const x = m.get(k) || { por: a.por || a.email, email: a.email, conta: {}, total: 0 };
    x.conta[a.tipo] = (x.conta[a.tipo] || 0) + (Number(a.n) || 1);
    x.total += Number(a.n) || 1;
    m.set(k, x);
  });
  return [...m.values()]
    .map(x => ({
      por: x.por,
      email: x.email,
      total: x.total,
      partes: RESUMO.filter(([t]) => x.conta[t])
        .map(([t, um, varios]) => `${x.conta[t]} ${x.conta[t] === 1 ? um : varios}`)
        .join(" · ")
    }))
    .sort((a, b) => b.total - a.total);
}

const VISTO = "z7ativVisto";
const lerVisto = () => {
  try {
    return localStorage.getItem(VISTO) || "";
  } catch (_) {
    return "";
  }
};

// Botão do admin no topo (btn = o "👤 Adriano"). Liga/desliga sozinho conforme quem está usando (atualizar()).
export function painelAtividades(C, btn) {
  let unsub = null,
    novas = [],
    ligadoPara = "";
  const badge = el("span", "ativ-badge");
  badge.hidden = true;
  const pintar = () => {
    badge.textContent = novas.length > 99 ? "99+" : String(novas.length);
    badge.hidden = !novas.length;
    const nome = (btn.firstChild && btn.firstChild.nodeType === 3 ? btn.firstChild.textContent : "").trim();
    btn.setAttribute("aria-label", novas.length ? `${nome} · ${novas.length} atividades novas da equipe` : nome);
  };
  const ligar = () => {
    if (unsub) unsub();
    // últimos 7 dias, a partir do que já foi visto
    const semana = new Date(Date.now() - 7 * 864e5).toISOString();
    const desde = [lerVisto(), semana].sort().pop();
    unsub = C.FS.onSnapshot(
      C.FS.query(C.FS.collection(C.db, "atividades"), C.FS.where("em", ">", desde), C.FS.orderBy("em", "desc"), C.FS.limit(300)),
      s => {
        novas = s.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(a => a.email !== C.email);
        pintar();
      },
      e => console.warn("[Z7] atividades", e)
    );
  };
  const abrir = async () => {
    if (!C.isAdmin) return;
    // hoje inteiro (mesmo o que já foi visto) para o resumo; as novas ficam marcadas
    let doDia = [];
    try {
      const s = await C.FS.getDocs(C.FS.query(C.FS.collection(C.db, "atividades"), C.FS.where("dia", "==", U.todayStr()), C.FS.limit(500)));
      doDia = s.docs.map(d => d.data()).filter(a => a.email !== C.email);
    } catch (e) {
      console.warn("[Z7] atividades do dia", e);
    }
    sheet(
      "Atividades da equipe",
      (p, close) => {
        const res = resumoPorPessoa(doDia);
        p.append(el("h3", null, "Hoje"));
        if (!res.length) p.append(el("p", "hint", "Ninguém da equipe registrou atividade hoje."));
        res.forEach(r => {
          const l = el("div", "ativ-pessoa");
          l.append(el("b", null, U.first(r.por)), el("small", null, r.partes || `${r.total} atividade${r.total > 1 ? "s" : ""}`));
          p.append(l);
        });
        p.append(el("h3", null, novas.length ? `Novas (${novas.length})` : "Novas"));
        if (!novas.length) p.append(el("p", "hint", "Nada novo desde a última vez que você marcou como visto."));
        const ul = el("ul", "ativ-lista");
        novas.slice(0, 150).forEach(a => {
          const hora = new Date(a.em);
          const hh = (a.dia === U.todayStr() ? "" : U.fmtDate(a.dia) + " ") + (isNaN(hora) ? "" : hora.toTimeString().slice(0, 5));
          ul.append(el("li", null, `${hh} · ${U.first(a.por)} ${a.texto}${a.lista ? ` (${NOMES_LISTA[a.lista] || a.lista})` : ""}`));
        });
        if (novas.length) p.append(ul);
        const ok = U.mkBtn("✓ Marcar como visto", "btn-primary", () => {
          try {
            localStorage.setItem(VISTO, new Date().toISOString());
          } catch (_) {}
          novas = [];
          pintar();
          ligar();
          close();
        });
        ok.disabled = !novas.length;
        const acts = el("div", "actions");
        acts.append(U.mkBtn("Fechar", "", close), ok);
        p.append(acts);
      },
      { div: true }
    );
  };
  return {
    // chamado a cada mudança de perfil (login, "ver como")
    atualizar() {
      const quem = C.isAdmin ? C.email : "";
      if (quem === ligadoPara) return;
      ligadoPara = quem;
      if (unsub) unsub();
      unsub = null;
      novas = [];
      if (quem) {
        btn.classList.add("ativ-btn");
        btn.setAttribute("role", "button");
        btn.tabIndex = 0;
        btn.onclick = abrir;
        btn.onkeydown = ev => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            abrir();
          }
        };
        if (badge.parentNode !== btn) btn.append(badge);
        ligar();
      } else {
        btn.classList.remove("ativ-btn");
        btn.removeAttribute("role");
        btn.removeAttribute("tabindex");
        btn.onclick = null;
        btn.onkeydown = null;
        badge.remove();
      }
      pintar();
    },
    // o texto do botão foi trocado (renderMe): põe o número de volta
    repor() {
      if (ligadoPara && badge.parentNode !== btn) btn.append(badge);
      pintar();
    },
    parar() {
      if (unsub) unsub();
      unsub = null;
      ligadoPara = "";
    }
  };
}
