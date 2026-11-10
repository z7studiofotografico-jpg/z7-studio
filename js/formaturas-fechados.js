// Formaturas → Venda Antecipada → "🏫 Colégios fechados": uma linha por colégio fechado (o mesmo formato do PR,
// Instituições e Aluguel de becas). Tocar abre a janela do colégio: Resumo (o cartão da turma, com todos os botões) ·
// Alunos (cada formando com o kit, as parcelas e o que falta pagar) · Datas (dia de fotos e formaturas).
import { el, title } from "./ui.js";
import * as U from "./util.js";
import * as Ev from "./eventos.js";
import { linhaGenerica } from "./lista-compacta.js";
import { abrirJanela } from "./janela.js";
import { brl, emAberto, pagasDe, nParcelas, quitado, ehKit01 } from "./regras.js";
import { atrasado } from "./turma.js";

let busca = "";
const moeda = v => brl(v || 0);

// o = { C, insts, formsDe(i), resumo(i, fs), card(i, fs), abrirTurma(i) }
export function renderFechados(corpo, o) {
  const todos = o.insts.slice().sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  if (!todos.length) {
    const e = el("div", "empty");
    e.append(
      el("strong", null, "Nenhum colégio fechado ainda"),
      el("span", null, "Quando uma instituição vira FECHADO, o colégio e os alunos aparecem aqui.")
    );
    corpo.append(e);
    return;
  }
  // resumo de todos os colégios fechados
  const tot = todos.map(i => o.resumo(i, o.formsDe(i)));
  const soma = k => tot.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  corpo.append(
    el(
      "p",
      "hint",
      `${todos.length} colégio${todos.length === 1 ? "" : "s"} fechado${todos.length === 1 ? "" : "s"} · ${soma("n")} aluno${soma("n") === 1 ? "" : "s"} · vendido ${moeda(soma("vend"))} · recebido ${moeda(soma("rec"))} · em aberto ${moeda(soma("aberto"))}`
    )
  );
  const q = el("input", "search");
  q.type = "search";
  q.placeholder = "Buscar colégio";
  q.setAttribute("aria-label", "Buscar colégio fechado");
  q.value = busca;
  const lista = el("div", "grid lc-lista");
  const pintar = () => {
    lista.innerHTML = "";
    const n = U.chave(busca);
    const arr = todos.filter(i => !n || U.chave(i.nome).includes(n));
    if (!arr.length) lista.append(el("div", "empty", "Nenhum colégio com esse nome."));
    arr.forEach(i => lista.append(linhaColegio(i, o)));
  };
  q.oninput = () => {
    busca = q.value;
    pintar();
  };
  corpo.append(q, lista);
  pintar();
}

function proxData(i) {
  const hoje = U.todayStr();
  const fs = Ev.formaturasDe(i).map(k => i[k].data);
  const futuras = [i.diaFotos && i.diaFotos.status !== "recusado" ? i.diaFotos.data : "", ...fs].filter(d => d && d >= hoje).sort();
  return futuras[0] || "";
}

function linhaColegio(i, o) {
  const fs = o.formsDe(i),
    r = o.resumo(i, fs);
  const pd = proxData(i);
  return linhaGenerica({
    id: "fm_" + i.id,
    cor: r.atr ? "vermelho" : r.n && !r.aberto ? "verde" : "azul",
    titulo: title(i.nome),
    sub: [
      `${r.n} aluno${r.n === 1 ? "" : "s"}`,
      `🎓 ${fs.filter(ehKit01).length} adesão`,
      `📘 ${fs.filter(f => !ehKit01(f)).length} kits`,
      o.C.nomeDe(i) ? "👤 " + U.first(o.C.nomeDe(i)) : ""
    ]
      .filter(Boolean)
      .join(" · "),
    passo:
      (r.atr ? `⚠️ ${r.atr} com parcela atrasada · ` : "") +
      `em aberto ${moeda(r.aberto)}` +
      (pd ? ` · próxima data ${U.fmtDate(pd)}` : ""),
    passoCls: r.atr ? "late" : "",
    selo: "FECHADO",
    card: () => o.card(i, fs),
    abrir: () => janela(i, o)
  });
}

function janela(i0, o) {
  abrirJanela({
    C: o.C,
    colecao: "instituicoes",
    item: i0,
    lembrar: "fechados",
    topo: i => ({
      titulo: title(i.nome),
      sub: [o.C.nomeDe(i) ? "👤 " + U.first(o.C.nomeDe(i)) : "", i.fechadoEm ? "fechado em " + U.fmtDate(i.fechadoEm) : ""]
        .filter(Boolean)
        .join(" · "),
      selo: "FECHADO"
    }),
    abas: [
      ["resumo", "Resumo", (box, i) => box.append(o.card(i, o.formsDe(i)))],
      ["alunos", "Alunos", (box, i) => abaAlunos(box, i, o)],
      ["datas", "Datas", abaDatas]
    ]
  });
}

function abaAlunos(box, i, o) {
  const fs = o
    .formsDe(i)
    .slice()
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  const r = o.resumo(i, fs);
  box.append(
    el(
      "p",
      "hint",
      `${r.n} aluno${r.n === 1 ? "" : "s"} · vendido ${moeda(r.vend)} · recebido ${moeda(r.rec)} · em aberto ${moeda(r.aberto)}`
    ),
    U.mkBtn("👥 Abrir alunos e parcelas (cadastrar, pagar, editar)", "btn-primary", () => o.abrirTurma(i))
  );
  if (!fs.length) return box.append(el("div", "empty", "Nenhum aluno cadastrado nesta turma ainda."));
  const l = el("div", "grid lc-lista");
  fs.forEach(f => {
    const at = atrasado(f),
      ok = quitado(f);
    const linha = el("div", "lc-linha lc-" + (at ? "vermelho" : ok ? "verde" : "azul"));
    const nm = el("div", "lc-nome");
    nm.append(
      el("b", null, title(f.nome) || "Sem nome"),
      el(
        "small",
        null,
        [f.kit, f.contrato === "colacao" ? "colação" : "", `${pagasDe(f)}/${nParcelas(f)} parcelas`].filter(Boolean).join(" · ")
      ),
      el("small", "lc-passo" + (at ? " late" : ""), ok ? "Quitado" : (at ? "⚠️ Atrasado · " : "") + "em aberto " + moeda(emAberto(f)))
    );
    linha.append(nm, el("span", "lc-selo", ok ? "QUITADO" : at ? "ATRASADO" : "PAGANDO"));
    l.append(linha);
  });
  box.append(l);
}

function abaDatas(box, i) {
  ["fotos", ...Ev.KINDS_FORMATURA].forEach(k => {
    const ln = Ev.linhaEvento(i, k);
    if (ln) box.append(ln);
  });
  const row = el("div", "actions");
  row.append(
    U.mkBtn("🎓 Formatura", "", () => Ev.openEvento(i, "formatura")),
    U.mkBtn("📸 Dia de fotos", "", () => Ev.openEvento(i, "fotos"))
  );
  const outra = Ev.formaturasDe(i).length ? Ev.proxFormatura(i) : null;
  if (outra) row.append(U.mkBtn("🎓 + Outra formatura", "", () => Ev.openEvento(i, outra)));
  box.append(row);
}
