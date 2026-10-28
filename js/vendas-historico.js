// Dashboard → 📈 Histórico (só admin): os resumos de cada ano (planilhas "PERCENTUAL PR"), com gráficos.
// Fica guardado em resumos/historico = { anos: { "2021": { ano, colegios: [...], atualizadoEm } }, importadoEm, importadoPor }
// (resumos: só o admin lê e grava). As contas estão em historico-dados.js.
import { el, sheet, field, botoes, carregarLib } from "./ui.js";
import * as U from "./util.js";
import { brl, reais } from "./regras.js";
import { lerPercentual, anoDaPlanilha, resumoDoAno, colegiosNosAnos, destaques } from "./historico-dados.js";

const AZUL = "#2563eb",
  GRAFITE = "#3f4652",
  VERDE = "#1f7a4d",
  LARANJA = "#d97706";
const moeda = c => brl(reais(c || 0));
const pc = v => Math.round((v || 0) * 100) + "%";
let anoSel = null;

// D = { C, caixa, canvas, tabela, lista, registrar(chart) } (peças do Dashboard)
export async function areaHistorico(corpo, D) {
  const { C } = D;
  if (!C.isAdmin) return;
  const topo = el("div", "agact");
  topo.append(U.mkBtn("📥 Importar planilhas PERCENTUAL", "btn-sm btn-primary", () => importar(D, () => areaDeNovo(corpo, D))));
  corpo.append(topo);
  const espera = el("p", "hint", "Carregando o histórico…");
  corpo.append(espera);
  let hs = [];
  try {
    const s = await C.FS.getDoc(C.FS.doc(C.db, "resumos", "historico"));
    hs = Object.values((s.exists() && s.data().anos) || {})
      .filter(h => h && h.ano && Array.isArray(h.colegios))
      .sort((a, b) => a.ano - b.ano);
  } catch (e) {
    espera.textContent = "Não foi possível ler o histórico agora.";
    console.warn("[Z7] histórico", e);
    return;
  }
  espera.remove();
  if (!hs.length) {
    corpo.append(
      el(
        "div",
        "empty",
        "Nenhum ano no histórico ainda. Toque em “📥 Importar planilhas PERCENTUAL” e escolha as planilhas de cada ano (ex.: “2021 - PERCENTUAL PR.xlsx”)."
      )
    );
    return;
  }
  desenhar(corpo, D, hs);
}
function areaDeNovo(corpo, D) {
  D.limpar();
  corpo.innerHTML = "";
  areaHistorico(corpo, D);
}

function desenhar(corpo, D, hs) {
  const { caixa, tabela } = D;
  const rs = hs.map(resumoDoAno);
  const ult = hs[hs.length - 1];
  // 1) os anos lado a lado
  const b1 = caixa(corpo, "Ano a ano", "PR + formatura · conversão = vendas ÷ alunos fotografados");
  tabela(
    b1,
    ["Ano", "Alunos", "Vendas", "Conversão", "Faturamento", "Ticket", "R$ por aluno", "PR", "Formatura"],
    rs.map((r, i) => [
      String(r.ano) + (hs[i].atualizadoEm && i === hs.length - 1 ? ` (até ${U.fmtDate(hs[i].atualizadoEm)})` : ""),
      r.geral.alunos,
      r.geral.vendas,
      pc(r.geral.conversao),
      moeda(r.geral.total),
      moeda(r.geral.ticket),
      moeda(r.geral.porAluno),
      moeda(r.pr.total),
      moeda(r.formatura.total)
    ])
  );
  const anos = rs.map(r => String(r.ano));
  // 2) faturamento por ano (PR × formatura)
  grafico(D, caixa(corpo, "Faturamento por ano", "PR × formatura, em R$"), {
    type: "bar",
    data: {
      labels: anos,
      datasets: [
        { label: "PR", data: rs.map(r => reais(r.pr.total)), backgroundColor: AZUL, borderRadius: 4 },
        { label: "Formatura", data: rs.map(r => reais(r.formatura.total)), backgroundColor: GRAFITE, borderRadius: 4 }
      ]
    },
    options: {
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { callback: v => "R$ " + v.toLocaleString("pt-BR") } }
      }
    },
    dinheiro: true
  });
  // 3) conversão por ano
  grafico(D, caixa(corpo, "Conversão por ano", "% dos alunos fotografados que compraram"), {
    type: "line",
    data: {
      labels: anos,
      datasets: [
        {
          label: "Geral",
          data: rs.map(r => Math.round(r.geral.conversao * 100)),
          borderColor: VERDE,
          backgroundColor: VERDE,
          tension: 0.25
        },
        {
          label: "PR",
          data: rs.map(r => (r.pr.alunos ? Math.round(r.pr.conversao * 100) : null)),
          borderColor: AZUL,
          backgroundColor: AZUL,
          tension: 0.25
        },
        {
          label: "Formatura",
          data: rs.map(r => (r.formatura.alunos ? Math.round(r.formatura.conversao * 100) : null)),
          borderColor: GRAFITE,
          backgroundColor: GRAFITE,
          tension: 0.25
        }
      ]
    },
    options: { scales: { y: { beginAtZero: true, ticks: { callback: v => v + "%" } } } },
    sufixo: "%"
  });
  // 4) forma de pagamento por ano (% do faturamento)
  const fp = (r, k) => (r.geral.total ? Math.round((r.geral[k] / r.geral.total) * 100) : 0);
  grafico(D, caixa(corpo, "Forma de pagamento por ano", "% do faturamento"), {
    type: "bar",
    data: {
      labels: anos,
      datasets: [
        { label: "Cartão", data: rs.map(r => fp(r, "cartao")), backgroundColor: AZUL },
        { label: "Boleto", data: rs.map(r => fp(r, "boleto")), backgroundColor: LARANJA },
        { label: "Dinheiro/Pix", data: rs.map(r => fp(r, "dinheiro")), backgroundColor: VERDE }
      ]
    },
    options: {
      scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, max: 100, ticks: { callback: v => v + "%" } } }
    },
    sufixo: "%"
  });
  // 5) o mesmo colégio em vários anos (PR)
  const rep = colegiosNosAnos(hs);
  if (rep.length) {
    const b5 = caixa(corpo, "O mesmo colégio em vários anos (PR)", "vendas / alunos e conversão em cada ano");
    tabela(
      b5,
      ["Colégio", ...anos],
      rep.map(x => [
        x.nome,
        ...anos.map(a => (x.anos[a] ? `${x.anos[a].vendas}/${x.anos[a].alunos} · ${pc(x.anos[a].vendas / (x.anos[a].alunos || 1))}` : "—"))
      ])
    );
  }
  // 6) um ano em detalhe
  if (!anoSel || !hs.some(h => h.ano === anoSel)) anoSel = ult.ano;
  const chips = el("div", "chips");
  hs.forEach(h => {
    const b = el("button", "chip", String(h.ano));
    b.type = "button";
    b.setAttribute("aria-pressed", String(h.ano === anoSel));
    b.onclick = () => {
      anoSel = h.ano;
      corpo.innerHTML = "";
      D.limpar();
      desenhar(corpo, D, hs);
      document.getElementById("histAno") && document.getElementById("histAno").scrollIntoView({ block: "start" });
    };
    chips.append(b);
  });
  const tit = el("h3", "grp", "Um ano em detalhe");
  tit.id = "histAno";
  corpo.append(tit, chips);
  const h = hs.find(x => x.ano === anoSel),
    ant = hs.filter(x => x.ano < anoSel).pop();
  const b6 = caixa(
    corpo,
    `${anoSel} · destaques`,
    h.atualizadoEm ? "planilha atualizada em " + U.fmtDate(h.atualizadoEm) + "/" + h.atualizadoEm.slice(0, 4) : ""
  );
  D.lista(
    b6,
    destaques(h, ant).map(t => [t, ""]),
    "Sem destaques."
  );
  const ord = h.colegios.filter(c => c.alunos).sort((a, b) => b.vendas / b.alunos - a.vendas / a.alunos);
  grafico(D, caixa(corpo, `${anoSel} · conversão por colégio`, "azul = PR · cinza = formatura"), {
    type: "bar",
    altura: Math.max(240, ord.length * 26),
    data: {
      labels: ord.map(c => c.nome.slice(0, 32)),
      datasets: [
        {
          data: ord.map(c => Math.round((c.vendas / c.alunos) * 100)),
          backgroundColor: ord.map(c => (c.tipo === "pr" ? AZUL : GRAFITE)),
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%" } }, y: { grid: { display: false } } }
    },
    sufixo: "%"
  });
  const b7 = caixa(corpo, `${anoSel} · colégios`, "do que mais converteu ao que menos converteu");
  tabela(
    b7,
    ["Colégio", "Tipo", "Alunos", "Vendas", "Conversão", "Ticket", "R$ por aluno", "Total", "Obs."],
    ord.map(c => [
      c.nome + (c.turma ? ` (turma ${c.turma})` : ""),
      c.tipo === "pr" ? "PR" : "Formatura",
      c.alunos,
      c.vendas,
      pc(c.vendas / c.alunos),
      c.vendas ? moeda(Math.round(c.total / c.vendas)) : "—",
      moeda(Math.round(c.total / c.alunos)),
      moeda(c.total),
      [c.devolucoes ? c.devolucoes + " devolução(ões)" : "", c.beca ? "beca " + moeda(c.beca) : "", c.obs || ""]
        .filter(Boolean)
        .join(" · ") || "—"
    ])
  );
}

// Um gráfico do Chart.js (ou nada, se a biblioteca não carregou: as tabelas já mostram os números)
function grafico(D, box, cfg) {
  const Chart = window.Chart;
  if (!Chart) return;
  const c = D.canvas(box, cfg.altura || 240);
  const fmt = v => (v == null ? "—" : cfg.dinheiro ? brl(v) : v + (cfg.sufixo || ""));
  const eixo = cfg.options && cfg.options.indexAxis === "y" ? "x" : "y";
  const plugins = Object.assign(
    { tooltip: { callbacks: { label: x => ` ${x.dataset.label ? x.dataset.label + ": " : ""}${fmt(x.parsed[eixo])}` } } },
    (cfg.options || {}).plugins
  );
  D.registrar(
    new Chart(c, { type: cfg.type, data: cfg.data, options: Object.assign({ maintainAspectRatio: false }, cfg.options, { plugins }) })
  );
}

// Importar as planilhas PERCENTUAL (uma ou várias; o ano vem do nome do arquivo ou da aba)
function importar(D, aoTerminar) {
  const { C } = D;
  sheet("Importar planilhas PERCENTUAL", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        "Escolha as planilhas “PERCENTUAL” de cada ano (pode selecionar várias). O ano vem do nome do arquivo (ex.: “2023 - PERCENTUAL PR.xlsx”). Importar o mesmo ano de novo substitui os números daquele ano."
      )
    );
    const inp = el("input");
    inp.type = "file";
    inp.accept = ".xlsx,.xls,.csv";
    inp.multiple = true;
    p.append(field("Planilhas", inp));
    const out = el("div", "imp");
    p.append(out, botoes(close, "Salvar no histórico"));
    const ok = p.querySelector("button[type=submit]");
    ok.disabled = true;
    let lidos = [];
    inp.onchange = async () => {
      out.innerHTML = "";
      ok.disabled = true;
      lidos = [];
      try {
        const X = await carregarLib("xlsx");
        for (const f of inp.files) {
          const wb = X.read(await f.arrayBuffer(), { type: "array", cellDates: true, codepage: 65001 });
          const ano = anoDaPlanilha(f.name, wb.SheetNames);
          if (!ano) {
            out.append(el("p", "err", `${f.name}: não achei o ano no nome do arquivo (ex.: “2023 - PERCENTUAL PR.xlsx”).`));
            continue;
          }
          const h = lerPercentual(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true }), ano);
          const r = resumoDoAno(h).geral;
          lidos.push(h);
          out.append(
            el(
              "p",
              null,
              `${ano}: ${h.colegios.length} colégios · ${r.alunos} alunos · ${r.vendas} vendas (${pc(r.conversao)}) · ${moeda(r.total)}`
            )
          );
        }
        ok.disabled = !lidos.length;
      } catch (e) {
        out.append(el("p", "err", "Não consegui ler: " + (e.message || e)));
      }
    };
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      if (!lidos.length) return;
      ok.disabled = true;
      try {
        const anos = {};
        lidos.forEach(h => (anos[h.ano] = h));
        await C.FS.setDoc(
          C.FS.doc(C.db, "resumos", "historico"),
          { anos, importadoEm: new Date().toISOString(), importadoPor: C.me || C.email || "" },
          { merge: true }
        );
        U.toast(`Histórico salvo: ${Object.keys(anos).sort().join(", ")} ✅`);
        close();
        aoTerminar();
      } catch (e) {
        ok.disabled = false;
        C.handleErr(e);
      }
    });
  });
}
