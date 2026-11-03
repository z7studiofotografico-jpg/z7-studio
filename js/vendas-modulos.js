// Dashboard → 🧩 Por módulo (Etapa 7, só admin): um painel para cada módulo e o geral (só ele soma tudo).
// Vendas por mês e por dia, por turma e por caixa, produtos mais vendidos, saídas de produtos, estoque e instituições.
// Abre lendo resumos/modulos; "↻ Recalcular módulos" lê as coleções e grava o resumo de novo (as contas: modulos-calc.js).
import { el } from "./ui.js";
import * as U from "./util.js";
import { brl, reais } from "./regras.js";
import { MODS, resumirModulos, lerFontesModulos } from "./modulos-calc.js";

const AZUL = "#2563eb",
  VERDE = "#1f7a4d";
const moeda = c => brl(reais(c || 0));
const MESES_C = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
let modSel = "geral";
let resumo = null;

// D = { C, caixa, canvas, tabela, lista, registrar(chart), limpar() } (peças do Dashboard)
export async function areaModulos(corpo, D) {
  const { C } = D;
  if (!C.isAdmin) return;
  const topo = el("div", "agact");
  const bt = U.mkBtn("↻ Recalcular módulos", "btn-sm", () => recalcular(corpo, D, bt));
  topo.append(bt);
  corpo.append(topo);
  const espera = el("p", "hint", "Carregando…");
  corpo.append(espera);
  try {
    const s = await C.FS.getDoc(C.FS.doc(C.db, "resumos", "modulos"));
    resumo = s.exists() ? s.data() : null;
  } catch (e) {
    espera.textContent = "Não foi possível ler o resumo dos módulos agora.";
    return console.warn("[Z7] módulos", e);
  }
  if (!corpo.isConnected) return;
  espera.remove();
  if (!resumo) return recalcular(corpo, D, bt);
  desenhar(corpo, D);
}

async function recalcular(corpo, D, bt) {
  const { C } = D;
  bt.disabled = true;
  bt.textContent = "Calculando…";
  try {
    const { FS, db } = C;
    const ler = async (c, filtros) =>
      (await FS.getDocs(FS.query(FS.collection(db, c), ...filtros.map(([a, o, v]) => FS.where(a, o, v))))).docs.map(d =>
        Object.assign({ id: d.id }, d.data())
      );
    resumo = resumirModulos(await lerFontesModulos(ler, U.todayStr()), U.todayStr());
    await FS.setDoc(FS.doc(db, "resumos", "modulos"), resumo);
    D.limpar();
    corpo.textContent = "";
    areaModulos(corpo, D);
  } catch (e) {
    C.handleErr(e);
  } finally {
    bt.disabled = false;
    bt.textContent = "↻ Recalcular módulos";
  }
}

function grafico(D, box, type, labels, datasets, dinheiro) {
  const Chart = window.Chart;
  if (!Chart) return;
  const c = D.canvas(box, 220);
  D.registrar(
    new Chart(c, {
      type,
      data: { labels, datasets },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1 },
          tooltip: { callbacks: { label: x => " " + (dinheiro ? moeda(x.parsed.y) : x.parsed.y) } }
        },
        scales: { y: { beginAtZero: true, ticks: { callback: v => (dinheiro ? moeda(v) : v) } } }
      }
    })
  );
}
const ultimosMeses = (hoje, n) => {
  const y = Number(hoje.slice(0, 4)),
    m = Number(hoje.slice(5, 7));
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - n + i, 1);
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
  });
};
const rotMes = k => MESES_C[Number(k.slice(5, 7)) - 1] + "/" + k.slice(2, 4);

function desenhar(corpo, D) {
  const { caixa, tabela, lista } = D;
  const chips = el("div", "chips");
  [["geral", "Geral (tudo junto)"], ...MODS, ["produtos", "📦 Produtos e estoque"], ["inst", "🏫 Instituições"]].forEach(([k, t]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(modSel === k));
    b.onclick = () => {
      modSel = k;
      D.limpar();
      corpo.textContent = "";
      areaModulos(corpo, D);
    };
    chips.append(b);
  });
  corpo.append(chips);
  const hoje = resumo.hoje || U.todayStr();
  corpo.append(
    el(
      "p",
      "hint",
      `Números de ${U.fmtDate(String(resumo.geradoEm || "").slice(0, 10))}. Cada módulo é separado; só o Geral soma tudo. Toque em ↻ para recalcular.`
    )
  );
  if (modSel === "produtos") return produtos(corpo, D);
  if (modSel === "inst") return instituicoes(corpo, D, hoje);
  const m = (resumo.mods || {})[modSel];
  if (!m) return corpo.append(el("div", "empty", "Sem dados ainda."));
  const k = el("div", "kpis");
  const mes = hoje.slice(0, 7),
    ano = hoje.slice(0, 4);
  [
    ["Recebido no mês", moeda(m.porMes[mes])],
    ["Recebido no ano (caixa)", moeda(m.porCaixa[ano])],
    ["Vendas registradas", String(m.n)],
    ["Ticket médio", moeda(m.n ? Math.round(m.totalC / m.n) : 0)]
  ].forEach(([t, v]) => {
    const c = el("div", "kpi");
    c.append(el("small", null, t), el("b", null, v));
    k.append(c);
  });
  corpo.append(k);
  const meses = ultimosMeses(hoje, 12);
  const b1 = caixa(corpo, "Vendas por mês", "dinheiro recebido em cada mês (últimos 12)");
  grafico(
    D,
    b1,
    "bar",
    meses.map(rotMes),
    [{ label: "Recebido", data: meses.map(x => reais(m.porMes[x] || 0)), backgroundColor: AZUL }],
    true
  );
  const dias = Object.keys(m.porDia || {})
    .sort()
    .slice(-31);
  const b2 = caixa(corpo, "Vendas por dia", "últimos 31 dias com movimento");
  if (dias.length)
    grafico(
      D,
      b2,
      "line",
      dias.map(U.fmtDate),
      [{ label: "Recebido", data: dias.map(x => reais(m.porDia[x])), borderColor: VERDE, tension: 0.25 }],
      true
    );
  else b2.append(el("p", "hint", "Sem vendas nos últimos dias."));
  // as duas visões do dinheiro (item 5.9)
  const anos = [...new Set([...Object.keys(m.porTurma || {}), ...Object.keys(m.porCaixa || {})])].sort().reverse();
  const b3 = caixa(corpo, "Por turma × por caixa", "turma = ano da turma/fotos do aluno · caixa = ano em que o dinheiro entrou");
  tabela(
    b3,
    ["Ano", "Por turma", "Por caixa"],
    anos.map(a => [a, moeda(m.porTurma[a]), moeda(m.porCaixa[a])])
  );
  if (Object.keys(m.produtos || {}).length) {
    const b4 = caixa(corpo, "Produtos mais vendidos", "quantidade");
    lista(b4, maisVendidos(m.produtos));
  }
}
const nomeProd = id =>
  String(id)
    .replace(/^foto_/, "Foto ")
    .replace(/_/g, " ");
const maisVendidos = o =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([p, q]) => [nomeProd(p), String(q)]);

function produtos(corpo, D) {
  const { caixa, tabela, lista } = D;
  const s = resumo.saidas || {},
    e = resumo.estoque || {};
  const b1 = caixa(corpo, "Saídas de produtos por mês", "baixas no estoque (entregas)");
  const meses = Object.keys(s.porMes || {})
    .sort()
    .slice(-12);
  if (meses.length)
    grafico(D, b1, "bar", meses.map(rotMes), [{ label: "Unidades", data: meses.map(x => s.porMes[x]), backgroundColor: AZUL }], false);
  else b1.append(el("p", "hint", "Nenhuma saída registrada ainda."));
  lista(caixa(corpo, "Produtos mais vendidos (todas as saídas)", ""), maisVendidos(s.porProduto || {}), "Nenhuma saída ainda.");
  const porMod = s.porMod || {};
  Object.keys(porMod).forEach(mod => lista(caixa(corpo, "Saídas · " + mod, "separado por módulo"), maisVendidos(porMod[mod])));
  const b3 = caixa(corpo, "Estoque agora", `${(e.abaixo || []).length} abaixo do mínimo · ${e.reservados || 0} com reserva`);
  tabela(
    b3,
    ["Item", "Físico", "Reservado", "Disponível"],
    (e.itens || []).map(x => x),
    "Nenhum item com estoque lançado."
  );
  if ((e.abaixo || []).length)
    lista(
      caixa(corpo, "⚠️ Comprar", "chegou no estoque mínimo"),
      e.abaixo.map(n => [n, ""])
    );
}

function instituicoes(corpo, D, hoje) {
  const { caixa, lista } = D;
  const I = resumo.insts || {};
  const k = el("div", "kpis");
  [
    ["Fechadas (total)", (I.total || {}).fechadas || 0],
    ["Não fecharam (total)", (I.total || {}).naoFecharam || 0]
  ].forEach(([t, v]) => {
    const c = el("div", "kpi");
    c.append(el("small", null, t), el("b", null, String(v)));
    k.append(c);
  });
  corpo.append(k);
  const meses = ultimosMeses(hoje, 12);
  const b = caixa(corpo, "Visitadas, fechadas e que não fecharam", "por mês (últimos 12)");
  grafico(
    D,
    b,
    "bar",
    meses.map(rotMes),
    [
      { label: "Visitadas", data: meses.map(x => (I.visitadas || {})[x] || 0), backgroundColor: "#94a3b8" },
      { label: "Fechadas", data: meses.map(x => (I.fechadas || {})[x] || 0), backgroundColor: VERDE },
      { label: "Não fecharam", data: meses.map(x => (I.naoFecharam || {})[x] || 0), backgroundColor: "#b91c1c" }
    ],
    false
  );
  lista(
    caixa(corpo, "Por que não fecharam", "motivos anotados no “❌ Não fechou”"),
    Object.entries(I.motivos || {})
      .sort((a, b2) => b2[1] - a[1])
      .map(([m, n]) => [m, String(n)]),
    "Nenhum colégio marcado como “Não fechou”."
  );
}
