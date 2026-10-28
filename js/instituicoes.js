// Módulo Instituições: colégio particular, colégio público, colégio profissionalizante e faculdade.
// Partes: instituicoes-dados.js (tipos e regras), instituicoes-estado.js (estado e gravação),
// instituicoes-form.js (cadastro e visita), instituicoes-agendar.js (agendar pelo Agendamento), instituicoes-import.js.
import { el, title, emPartes } from "./ui.js";
import { linhaEvento } from "./eventos.js";
import * as U from "./util.js";
import { openImport } from "./instituicoes-import.js";
import { botaoRelatorio, contar } from "./relatorio.js";
import { contatoRel } from "./aluno-id.js";
import { TIPOS, CARTOES, ETAPAS, ABERTAS, SEGMENTOS, cartaoDoTipo, norm, status, pendFotos } from "./instituicoes-dados.js";
import { C, FS, tipo, items, mudarTipo, mudarItems, iniciar, lockInfo, mensagem, save, claim } from "./instituicoes-estado.js";
import { openForm, openVisita } from "./instituicoes-form.js";
import { cadastroFalta, cadastroPendente } from "./instituicao-cadastro.js";
export { TIPOS, CARTOES, CARGOS, cartaoDoTipo } from "./instituicoes-dados.js";
export { agendarColegio } from "./instituicoes-agendar.js";
// (o Agendamento importa estas daqui; continuam disponíveis)
export { KINDS, nomeEvento, avisarColegioPorEmail, painelAvisar, msgWhatsColegio } from "./eventos.js";
let tab = "hoje",
  unsub = null;
const $ = id => document.getElementById(id);

// ---------- tela ----------
export function init(ctx) {
  iniciar(ctx);
}

export function show(t) {
  t = cartaoDoTipo(t);
  mudarTipo(t);
  const T = CARTOES[t] || CARTOES.particular;
  const v = $("viewInstTipo");
  v.innerHTML = "";
  const head = el("div", "vhead");
  head.append(el("h2", null, T.ico + " " + T.nome));
  const hb = el("div", "quick");
  hb.append(U.mkBtn("+ Nova instituição", "btn-primary", () => openForm(null)));
  if (C.isAdmin) hb.append(U.mkBtn("Importar planilha", "", () => openImport(C, T.tipos, T.nome, items)));
  hb.append(botaoRelatorio(relatorioInst, () => C.me));
  head.append(hb);
  v.append(head);

  const st = el("section", "stats");
  st.innerHTML = `<div class="stat late"><b id="iAtr">–</b><small>Retornos atrasados</small></div>
    <div class="stat today"><b id="iHoje">–</b><small>Para hoje (retornos e pendências)</small></div>
    <div class="stat"><b id="iAbertas">–</b><small>Em andamento</small></div>
    <div class="stat won"><b id="iFech">–</b><small>Fechadas</small></div>`;
  v.append(st);
  const chips = el("div", "chips");
  chips.id = "iChips";
  v.append(chips);
  const q = el("input", "search");
  q.id = "iQ";
  q.type = "search";
  q.placeholder = "Buscar por nome, bairro, cidade ou contato";
  q.setAttribute("aria-label", "Buscar");
  v.append(q);
  q.addEventListener("input", renderList);
  const list = el("section", "grid");
  list.id = "iList";
  v.append(list);
  renderChips();
  list.append(Object.assign(el("div", "empty"), { innerHTML: "<strong>Carregando…</strong>" }));
  if (unsub) unsub();
  // carteira: o vendedor recebe os colégios livres e os dele (o tipo é filtrado aqui)
  unsub = FS.onSnapshot(
    C.carteira("instituicoes", FS.where("tipo", "in", T.tipos), FS.limit(1500)),
    snap => {
      mudarItems(snap.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(x => T.tipos.includes(x.tipo)));
      renderChips();
      renderStats();
      renderList();
    },
    err => {
      console.warn(err);
      U.showNotice(
        err.code === "permission-denied" ? "Você não tem acesso às Instituições." : "Não foi possível carregar. Verifique a internet."
      );
    }
  );
}
export function hide() {
  if (unsub) {
    unsub();
    unsub = null;
  }
}

function filtra(i, k) {
  if (k === "hoje") return ["late", "today"].includes(status(i)) || pendFotos(i);
  if (k === "pend") return pendFotos(i) || (cadastroPendente(i) && (C.isAdmin || C.ehMeu(i)));
  if (k === "meus") return C.ehMeu(i) && (ABERTAS.includes(i.etapa) || pendFotos(i));
  if (k === "todos") return true;
  return i.etapa === k;
}
function renderStats() {
  const st = items.map(status);
  $("iAtr").textContent = st.filter(s => s === "late").length;
  $("iHoje").textContent =
    st.filter(s => s === "today").length + items.filter(i => pendFotos(i) && status(i) !== "today" && status(i) !== "late").length;
  $("iAbertas").textContent = items.filter(i => ABERTAS.includes(i.etapa)).length;
  $("iFech").textContent = items.filter(i => i.etapa === "FECHADO").length;
}
function renderChips() {
  const c = $("iChips");
  if (!c) return;
  c.innerHTML = "";
  const n = k => items.filter(i => filtra(i, k)).length;
  [["hoje", "Para hoje"], ["pend", "⚠️ Pendências"], ["meus", "Só os meus"], ...ETAPAS.map(e => [e, e]), ["todos", "Todas"]].forEach(
    ([k, t]) => {
      const b = el("button", "chip", t);
      b.type = "button";
      b.setAttribute("aria-pressed", String(tab === k));
      const s = el("span", "n", String(n(k)));
      b.append(s);
      b.onclick = () => {
        tab = k;
        renderChips();
        renderList();
      };
      c.append(b);
    }
  );
}
// Aviso no alto da tela: colégios da planilha com o cadastro para completar (o do representante; o admin vê todos)
function avisoCadastro() {
  let a = $("iCadAviso");
  const meus = items.filter(i => cadastroPendente(i) && (C.isAdmin || C.ehMeu(i)));
  if (!meus.length) return a && a.remove();
  if (!a) {
    a = el("div", "notice");
    a.id = "iCadAviso";
    $("iChips").before(a);
  }
  a.innerHTML = "";
  const quem = C.isAdmin ? [...new Set(meus.map(i => U.first(i.resp || "") || "sem responsável"))].join(", ") : "";
  a.append(
    el(
      "span",
      null,
      `📋 ${meus.length} colégio${meus.length > 1 ? "s" : ""} com o cadastro para completar (contato com telefone, nº de alunos e endereço)` +
        (C.isAdmin ? ` · ${quem}` : ". Atualize até completar todos: o Adriano recebe o resumo às 19h.")
    ),
    U.mkBtn("Ver", "btn-sm", () => {
      tab = "pend";
      renderChips();
      renderList();
    })
  );
}
function renderList() {
  avisoCadastro();
  const list = $("iList");
  if (!list) return;
  list.innerHTML = "";
  const q = norm($("iQ").value);
  let arr = items.filter(i => filtra(i, tab));
  if (q)
    arr = arr.filter(i =>
      norm([i.nome, i.endereco?.bairro, i.endereco?.cidade, ...(i.contatos || []).map(c => c.nome)].join(" ")).includes(q)
    );
  const rank = { late: 0, today: 1, later: 2, none: 3, won: 4 };
  arr.sort(
    (a, b) =>
      rank[status(a)] - rank[status(b)] ||
      (a.followup || "9").localeCompare(b.followup || "9") ||
      (a.nome || "").localeCompare(b.nome || "", "pt-BR")
  );
  if (!arr.length) {
    const e = el("div", "empty");
    e.style.gridColumn = "1/-1";
    e.append(
      el("strong", null, items.length ? "Nada aqui" : "Nenhuma instituição cadastrada"),
      el("span", null, items.length ? "Troque o filtro acima." : "Toque em “+ Nova instituição” ou importe a planilha.")
    );
    list.append(e);
    return;
  }
  emPartes(list, arr, card);
}

function card(it) {
  const s = status(it);
  const e = el("article", "card " + (["late", "today", "won"].includes(s) ? s : ""));
  const top = el("div", "card-top");
  top.append(el("h3", "name", title(it.nome)), el("span", "stage", it.etapa));
  e.append(top);
  const meta = el("div", "meta");
  const ps = it.alunosPorSerie || {};
  const segs = SEGMENTOS.filter(([k]) => (it.segmentos || {})[k] || (k === "pre" && (it.segmentos || {}).infantil)).map(([k, t]) =>
    ps[k] ? `${t}: ${ps[k]}` : t
  );
  [
    [C.nomeDe(it) ? "👤 " + U.first(C.nomeDe(it)) : "", ""],
    [[title(it.endereco?.bairro), title(it.endereco?.cidade)].filter(Boolean).join(" · "), "svc"],
    [segs.join(", "), ""],
    [it.alunosConfirmados ? `${it.alunosConfirmados} alunos (confirmado)` : it.mediaAlunos ? `~${it.mediaAlunos} alunos (média)` : "", ""],
    [it.fotografoHoje || "", ""],
    [it.motivo ? "Motivo: " + it.motivo : "", ""]
  ].forEach(([v, c]) => {
    if (v) meta.append(el("span", "tag " + c, v));
  });
  e.append(meta);
  const cs = it.contatos || [];
  if (cs.length)
    e.append(el("div", "phone", cs.map(c => [c.nome && title(c.nome), c.cargo, c.tel].filter(Boolean).join(" · ")).join("  |  ")));
  const fu = el("div", "fu " + (s === "late" ? "late" : s === "today" ? "today" : it.followup ? "" : "none"));
  fu.textContent =
    it.etapa === "FECHADO"
      ? "Fechado" + (it.fechadoEm ? " em " + U.fmtDate(it.fechadoEm) : "")
      : it.followup
        ? (s === "late"
            ? "Atrasado desde " + U.fmtDate(it.followup)
            : s === "today"
              ? "Retorno hoje"
              : "Retorno em " +
                U.fmtDate(it.followup) +
                (it.followup.slice(0, 4) !== U.todayStr().slice(0, 4) ? "/" + it.followup.slice(0, 4) : "")) +
          (it.proximoPasso ? " · " + it.proximoPasso : "")
        : "Sem data de retorno";
  e.append(fu);
  ["fotos", "formatura"].forEach(k => {
    const l = linhaEvento(it, k);
    if (l) e.append(l);
  });
  if (cadastroPendente(it)) e.append(el("p", "wait", "📋 Falta no cadastro: " + cadastroFalta(it).join(", ")));
  if (pendFotos(it)) {
    const pd = el("div", "lock other");
    pd.append(
      el(
        "span",
        null,
        `⚠️ Pendência: marcar o dia de medir beca e fazer o ensaio de estúdio no ${title(it.nome)} (em Formaturas → Turmas)`
      ),
      U.mkBtn("🎓 Abrir Formaturas", "btn-primary", () => {
        C.ir("#formaturas");
      })
    );
    e.append(pd);
  }
  if (it.avisoEmail && it.avisoEmail.em)
    e.append(
      el(
        "div",
        "last",
        `📧 Datas enviadas por e-mail para ${it.avisoEmail.para.join(", ")} em ${U.fmtDate(U.ds(new Date(it.avisoEmail.em)))}`
      )
    );
  const ult = (it.visitas || [])[0];
  if (ult) {
    const linhas = [
      `${U.fmtDate(ult.data)}${ult.data && ult.data.slice(0, 4) !== U.todayStr().slice(0, 4) ? "/" + ult.data.slice(0, 4) : ""} · ${ult.por ? U.first(ult.por) : "planilha"}${ult.falouCom ? " falou com " + ult.falouCom : ""}${ult.resultado ? " · " + ult.resultado : ""}`
    ];
    if (ult.apresentou && ult.apresentou.length)
      linhas.push("Apresentou: " + ult.apresentou.map(p => `${p.nome} ${U.money(p.preco)}`).join(", "));
    if (ult.obs) linhas.push(ult.obs);
    // sem data (veio da planilha): mostra só a observação
    if (!ult.data && !ult.por) linhas.shift();
    e.append(el("p", "notes", (ult.data || ult.por ? "Última visita: " : "📝 ") + linhas.join("\n")));
    if ((it.visitas || []).length > 1) {
      const d = el("details", "hist");
      d.append(el("summary", null, `Ver as ${it.visitas.length} visitas`));
      it.visitas
        .slice(1)
        .forEach(x =>
          d.append(
            el(
              "p",
              "notes",
              `${x.data || ""} · ${x.por ? U.first(x.por) : "planilha"}${x.resultado ? " · " + x.resultado : ""}${x.obs ? "\n" + x.obs : ""}`
            )
          )
        );
      e.append(d);
    }
  }
  const li = lockInfo(it);
  if (li) {
    const lk = el("div", "lock " + (li.mine ? "mine" : "other"));
    lk.append(el("span", null, li.mine ? "✋ Você está atendendo" : "⚠️ " + U.first(li.por) + " está atendendo desde " + U.hhmm(li.desde)));
    lk.append(
      li.mine
        ? U.mkBtn("Liberar", "", () => save(it, { atendendo: null }, "Liberado"))
        : U.mkBtn("Assumir mesmo assim", "", () =>
            save(it, { atendendo: { por: C.me, desde: new Date().toISOString() } }, "Agora você está atendendo")
          )
    );
    e.append(lk);
  }
  // Mensagem pronta para o contato
  const m = mensagem(it, cs.find(c => c.nome && c.tel) || cs[0]);
  if (m && !(li && !li.mine)) {
    const box = el("div", "next");
    box.append(el("small", null, "Mensagem pronta"), el("p", null, m));
    const row = el("div", "row");
    cs.filter(c => c.tel)
      .slice(0, 3)
      .forEach(c => {
        const a = el("a", "btn btn-sm btn-primary", "WhatsApp" + (c.nome ? " " + U.first(title(c.nome)) : c.cargo ? " " + c.cargo : ""));
        a.href = "https://wa.me/" + U.digits(c.tel) + "?text=" + encodeURIComponent(mensagem(it, c));
        a.target = "_blank";
        a.rel = "noopener";
        a.addEventListener("click", () => claim(it));
        row.append(a);
      });
    row.append(
      U.mkBtn("Copiar texto", "", async () => {
        try {
          await navigator.clipboard.writeText(m);
          U.toast("Texto copiado");
        } catch (_) {
          U.toast("Não consegui copiar");
        }
      })
    );
    box.append(row);
    e.append(box);
  }
  const act = el("div", "actions");
  act.append(U.mkBtn("📝 Registrar visita / contato", "btn-primary", () => openVisita(it)));
  if (it.etapa !== "FECHADO")
    act.append(U.mkBtn("Remarcar +7d", "", () => save(it, { followup: U.addDays(7) }, "Retorno em " + U.fmtDate(U.addDays(7)))));
  if (!li && it.etapa !== "FECHADO") act.append(U.mkBtn("✋ Estou atendendo", "", () => claim(it)));
  act.append(U.mkBtn("Editar", "", () => openForm(it)));
  e.append(act);
  return e;
}

// Relatório para reunião: situação das instituições deste cartão (a equipe vê só a carteira dela)
function relatorioInst() {
  const T = CARTOES[tipo] || CARTOES.particular;
  const doisTipos = T.tipos.length > 1;
  const st = items.map(status);
  const abertas = items.filter(i => ABERTAS.includes(i.etapa)),
    fechadas = items.filter(i => i.etapa === "FECHADO");
  const rank = { late: 0, today: 1, later: 2, none: 3, won: 4 };
  const ordem = (a, b) =>
    rank[status(a)] - rank[status(b)] ||
    (a.followup || "9").localeCompare(b.followup || "9") ||
    (a.nome || "").localeCompare(b.nome || "", "pt-BR");
  const alunos = i => i.alunosConfirmados || (i.mediaAlunos ? "~" + i.mediaAlunos : "");
  const lugar = i => [title(i.endereco?.bairro), title(i.endereco?.cidade)].filter(Boolean).join(" · ");
  const tipoTxt = i => (doisTipos ? [(TIPOS[i.tipo] || {}).nome || ""] : []);
  // contatos do colégio: nome, cargo, telefone e e-mail
  const contatos = i =>
    (i.contatos || [])
      .map(c => [c.nome && title(c.nome), c.cargo, contatoRel(c.tel, c.email)].filter(Boolean).join(" · "))
      .concat(i.email ? [i.email] : [])
      .join(" / ");
  const dataEv = (i, k) => (i[k] && i[k].data && i[k].status !== "recusado" ? U.fmtDate(i[k].data) : "");
  return {
    titulo: T.nome,
    subtitulo: C.isAdmin ? "" : "Só a sua carteira e as livres",
    secoes: [
      {
        titulo: "Resumo",
        kpis: [
          ["Retornos atrasados", st.filter(x => x === "late").length],
          ["Retornos para hoje", st.filter(x => x === "today").length],
          ["Em andamento", abertas.length],
          ["Fechadas", fechadas.length],
          ["Pendências de fotos", items.filter(pendFotos).length]
        ]
      },
      {
        titulo: "Por etapa",
        tabela: { cols: ["Etapa", "Instituições"], linhas: contar(items, i => i.etapa) },
        vazio: "Nenhuma instituição cadastrada."
      },
      {
        titulo: "Em andamento",
        tabela: {
          cols: [
            "Instituição",
            ...(doisTipos ? ["Tipo"] : []),
            "Etapa",
            "Onde",
            "Responsável",
            "Próximo passo",
            "Retorno",
            "Alunos",
            "Contatos"
          ],
          linhas: abertas
            .slice()
            .sort(ordem)
            .map(i => [
              title(i.nome),
              ...tipoTxt(i),
              i.etapa,
              lugar(i),
              C.nomeDe(i) ? U.first(C.nomeDe(i)) : "Livre",
              i.proximoPasso || "",
              i.followup ? U.fmtDate(i.followup) + (status(i) === "late" ? " (atrasado)" : "") : "",
              alunos(i),
              contatos(i)
            ])
        },
        vazio: "Nenhuma em andamento."
      },
      {
        titulo: "Fechadas",
        tabela: {
          cols: [
            "Instituição",
            ...(doisTipos ? ["Tipo"] : []),
            "Responsável",
            "Fechado em",
            "Dia de fotos",
            "Formatura",
            "Alunos",
            "Contatos"
          ],
          linhas: fechadas
            .slice()
            .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"))
            .map(i => [
              title(i.nome),
              ...tipoTxt(i),
              C.nomeDe(i) ? U.first(C.nomeDe(i)) : "",
              i.fechadoEm ? U.fmtDate(i.fechadoEm) + "/" + i.fechadoEm.slice(0, 4) : "",
              dataEv(i, "diaFotos"),
              dataEv(i, "formatura"),
              alunos(i),
              contatos(i)
            ])
        },
        vazio: "Nenhuma fechada ainda."
      }
    ]
  };
}
