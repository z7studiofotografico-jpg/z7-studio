// Dashboard de vendas. Administradores veem tudo; cada pessoa da equipe vê só o próprio desempenho ("Meu desempenho").
// Abre lendo 1 documento (resumos/dashboard), gerado toda madrugada pelo GitHub e sempre que
// alguém toca em "Atualizar agora". O cálculo fica em js/calc.js (o mesmo no app e no script).
// Valores em centavos até a hora de mostrar. Gráficos com Chart.js, carregado só aqui.
import { resumir, periodo as somaPeriodo, comissaoDe, pessoasDoResumo, fatiaDaPessoa, idResumoPessoa, periodoDaPessoa } from "./calc.js";
import { lerFontes } from "./fontes-resumo.js";
import { brl, reais, taxa } from "./regras.js";
import { el, title, carregarLib } from "./ui.js";
import * as U from "./util.js";
import { botaoRelatorio, copiaDaTela } from "./relatorio.js";
let C,
  FS,
  db,
  resumo = null,
  periodo = "mes",
  area = "geral",
  charts = [];
const AREAS = [
  ["geral", "Geral"],
  ["pr", "🖼️ PR"],
  ["form", "🎓 Formaturas"],
  ["funil", "💬 Funil"]
];
const $ = id => document.getElementById(id);
const MESES_C = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PERIODOS = [
  ["mes", "Este mês"],
  ["passado", "Mês passado"],
  ["ano", "Este ano"],
  ["12m", "Últimos 12 meses"]
];
const AZUL = "#2563eb",
  AZUL_CLARO = "rgba(37,99,235,.14)",
  GRAFITE = "#3f4652";
const moeda = c => brl(reais(c)); // recebe centavos

export function init(ctx) {
  C = ctx;
  FS = ctx.FS;
  db = ctx.db;
}
export function hide() {
  charts.forEach(c => c.destroy());
  charts = [];
}
function carregarChart() {
  return carregarLib("chart");
}

export async function show() {
  const v = $("viewVendas");
  v.innerHTML = "";
  if (!C.isAdmin) return mostrarMeu(v);
  const head = el("div", "vhead");
  head.append(el("h2", null, "Dashboard"));
  const bt = U.mkBtn("↻ Atualizar agora", "btn-sm", () => atualizar(bt));
  const hb = el("div", "agact");
  hb.append(
    bt,
    botaoRelatorio(relatorioDash, () => C.me)
  );
  head.append(hb);
  v.append(head);
  // um card de cada vez: cada área tem os seus números, gráfico e equipe
  const abas = el("div", "segs vdareas");
  abas.setAttribute("role", "tablist");
  v.append(abas);
  AREAS.forEach(([k, t]) => {
    const b = el("button", "seg", t);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(area === k));
    b.onclick = () => {
      area = k;
      abas.querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", String(x === b)));
      desenhar();
    };
    abas.append(b);
  });
  const chips = el("div", "chips");
  v.append(chips);
  PERIODOS.forEach(([k, t]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(periodo === k));
    b.onclick = () => {
      periodo = k;
      chips.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      desenhar();
    };
    chips.append(b);
  });
  const corpo = el("div");
  corpo.id = "vdCorpo";
  corpo.append(el("div", "empty", "Carregando…"));
  v.append(corpo);
  carregarChart().catch(e => console.warn("[Z7] gráficos", e));
  try {
    const s = await FS.getDoc(FS.doc(db, "resumos", "dashboard"));
    resumo = s.exists() ? s.data() : null;
    if (!resumo) await atualizar(bt);
    else {
      await carregarChart().catch(() => {});
      desenhar();
    }
  } catch (e) {
    erro(e);
  }
}
function erro(e) {
  console.warn("[Z7] dashboard", e);
  const corpo = $("vdCorpo");
  if (!corpo) return;
  corpo.innerHTML = "";
  const x = el("div", "empty");
  x.append(
    el("strong", null, "Não foi possível carregar"),
    el(
      "span",
      null,
      e && e.code === "permission-denied"
        ? "Só administradores veem o Dashboard. Se você é admin, cole as regras novas do Firebase."
        : "Verifique a internet e tente de novo."
    )
  );
  corpo.append(x);
}

// Lê tudo, recalcula e grava o resumo (as leituras grandes só acontecem aqui)
async function atualizar(bt) {
  if (bt) {
    bt.disabled = true;
    bt.textContent = "Atualizando…";
  }
  try {
    const ler = async (c, filtros) =>
      (await FS.getDocs(FS.query(FS.collection(db, c), ...filtros.map(([a, o, v]) => FS.where(a, o, v))))).docs.map(d =>
        Object.assign({ id: d.id }, d.data())
      );
    const fontes = await lerFontes(ler, U.todayStr(), Number((C.P || {}).versaoDados) || 0);
    const porNome = Object.fromEntries(
      Object.entries(C.usuarios || {})
        .filter(([, u]) => u.nome)
        .map(([em, u]) => [u.nome, em])
    );
    resumo = resumir(fontes, U.todayStr(), porNome);
    await FS.setDoc(FS.doc(db, "resumos", "dashboard"), resumo);
    // cada pessoa da equipe vê só os próprios números (resumos/pessoa_...)
    const b = FS.writeBatch(db);
    pessoasDoResumo(resumo).forEach(e => b.set(FS.doc(db, "resumos", idResumoPessoa(e)), fatiaDaPessoa(resumo, e)));
    await b.commit();
    await carregarChart().catch(() => {});
    desenhar();
  } catch (e) {
    erro(e);
  } finally {
    if (bt) {
      bt.disabled = false;
      bt.textContent = "↻ Atualizar agora";
    }
  }
}

function mesesDoPeriodo() {
  const t = U.todayStr(),
    y = Number(t.slice(0, 4)),
    m = Number(t.slice(5, 7));
  const mm = (yy, mo) => {
    const d = new Date(yy, mo - 1, 1);
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
  };
  if (periodo === "mes") return [mm(y, m)];
  if (periodo === "passado") return [mm(y, m - 1)];
  if (periodo === "ano") return Array.from({ length: m }, (_, i) => mm(y, i + 1));
  return Array.from({ length: 12 }, (_, i) => mm(y, m - 11 + i));
}
const nomeDe = k => {
  const u = (C.usuarios || {})[k];
  return u && u.nome ? u.nome : k.includes("@") ? k.split("@")[0] : k;
};

function desenhar() {
  hide();
  const corpo = $("vdCorpo");
  if (!corpo || !resumo) return;
  corpo.innerHTML = "";
  const nomeP = PERIODOS.find(p => p[0] === periodo)[1];
  const p = somaPeriodo(resumo, mesesDoPeriodo());
  if (!resumo.agora && area !== "geral") {
    corpo.append(el("p", "wait", "Toque em ↻ Atualizar agora para calcular os números de cada card."));
    return;
  }
  if (area === "pr") return areaPR(corpo, p, nomeP);
  if (area === "form") return areaForm(corpo, p, nomeP);
  if (area === "funil") return areaFunil(corpo, p, nomeP);
  const k = el("div", "kpis");
  [
    ["Total de vendas", moeda(p.total)],
    ["Pedidos", String(p.n)],
    ["Ticket médio", p.n ? moeda(Math.round(p.total / p.n)) : "—"],
    ["A receber das formaturas", brl(resumo.aReceber || 0)]
  ].forEach(([t, v]) => {
    const c = el("div", "kpi");
    c.append(el("small", null, t), el("b", null, v));
    k.append(c);
  });
  corpo.append(k);
  if (!Object.keys(resumo.meses || {}).length)
    corpo.append(
      el(
        "p",
        "hint",
        "Ainda não há vendas registradas. Elas aparecem aqui quando um lead do Funil é marcado como Fechado, um kit do PR é pago, um formando entra numa turma, um aluguel de becas tem valor ou um ensaio do estúdio tem valor."
      )
    );

  // Evolução dos últimos 12 meses
  const doze = (() => {
    const s = periodo;
    periodo = "12m";
    const r = mesesDoPeriodo();
    periodo = s;
    return r;
  })();
  const porMes = doze.map(m => (resumo.meses[m] || {}).total || 0);
  const g1 = caixa(corpo, "Evolução das vendas mensais", "Últimos 12 meses, todas as origens");
  const top = Object.entries(p.produto)
    .sort((a, b) => b[1].v - a[1].v)
    .slice(0, 8);
  const g2 = caixa(corpo, "Produtos mais vendidos", nomeP + " · em R$");
  const g3 = caixa(corpo, "De onde vêm as vendas", nomeP);
  const lst = el("div", "vdlist");
  Object.entries(p.origem)
    .sort((a, b) => b[1].v - a[1].v)
    .forEach(([o, v]) => {
      const r = el("div", "vdrow");
      r.append(el("span", null, `${o} · ${v.n} pedido${v.n > 1 ? "s" : ""}`), el("b", null, moeda(v.v)));
      lst.append(r);
    });
  if (!lst.children.length) lst.append(el("p", "hint", "Sem vendas no período."));
  g3.append(lst);

  const Chart = window.Chart;
  if (Chart) {
    const cs = getComputedStyle(document.body),
      fg = cs.getPropertyValue("--muted").trim() || "#6b6670",
      grid = cs.getPropertyValue("--line").trim() || "#dedadb";
    Chart.defaults.color = fg;
    Chart.defaults.font.family = cs.fontFamily;
    const eixo = v => "R$ " + (v >= 1000 ? (v / 1000).toLocaleString("pt-BR") + " mil" : v.toLocaleString("pt-BR"));
    charts.push(
      new Chart(canvas(g1), {
        type: "line",
        data: {
          labels: doze.map(m => MESES_C[Number(m.slice(5)) - 1] + "/" + m.slice(2, 4)),
          datasets: [
            {
              label: "Vendas",
              data: porMes.map(reais),
              borderColor: AZUL,
              backgroundColor: AZUL_CLARO,
              fill: true,
              tension: 0.3,
              cubicInterpolationMode: "monotone",
              pointRadius: 3,
              pointBackgroundColor: AZUL
            }
          ]
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => " " + brl(c.parsed.y) } } },
          scales: { y: { beginAtZero: true, grid: { color: grid }, ticks: { callback: eixo } }, x: { grid: { display: false } } }
        }
      })
    );
    if (top.length)
      charts.push(
        new Chart(canvas(g2, Math.max(180, top.length * 38)), {
          type: "bar",
          data: {
            labels: top.map(([n]) => n),
            datasets: [
              {
                label: "Vendas",
                data: top.map(([, x]) => reais(x.v)),
                backgroundColor: top.map((_, i) => (i === 0 ? AZUL : GRAFITE)),
                borderRadius: 6
              }
            ]
          },
          options: {
            indexAxis: "y",
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: { label: c => ` ${brl(c.parsed.x)} · ${top[c.dataIndex][1].n} pedido${top[c.dataIndex][1].n > 1 ? "s" : ""}` }
              }
            },
            scales: { x: { beginAtZero: true, grid: { color: grid }, ticks: { callback: eixo } }, y: { grid: { display: false } } }
          }
        })
      );
    else g2.append(el("p", "hint", "Sem vendas no período."));
  } else {
    const l1 = el("div", "vdlist");
    doze.forEach((m, i) => {
      const r = el("div", "vdrow");
      r.append(el("span", null, MESES_C[Number(m.slice(5)) - 1] + "/" + m.slice(2, 4)), el("b", null, moeda(porMes[i])));
      l1.append(r);
    });
    g1.append(l1);
    const l2 = el("div", "vdlist");
    top.forEach(([n, x]) => {
      const r = el("div", "vdrow");
      r.append(el("span", null, `${n} · ${x.n}`), el("b", null, moeda(x.v)));
      l2.append(r);
    });
    g2.append(l2);
  }
  equipe(corpo, p, nomeP);
  const quando = resumo.geradoEm ? new Date(resumo.geradoEm) : null;
  corpo.append(
    el(
      "p",
      "hint",
      quando ? `Números de ${quando.toLocaleDateString("pt-BR")} às ${U.hhmm(resumo.geradoEm)}. Toque em ↻ para atualizar agora.` : ""
    )
  );
}
function caixa(pai, tit, sub) {
  const b = el("section", "vdbox");
  b.append(el("h3", null, tit));
  if (sub) b.append(el("small", null, sub));
  pai.append(b);
  return b;
}
function canvas(box, h) {
  const w = el("div", "vdchart");
  w.style.height = (h || 240) + "px";
  const c = el("canvas");
  c.setAttribute("role", "img");
  c.setAttribute("aria-label", box.querySelector("h3").textContent);
  w.append(c);
  box.append(w);
  return c;
}

function equipe(corpo, p, nomeP) {
  const comiss = new Set((C.vendedoresEmails || []).map(e => e.toLowerCase()));
  const nomesVend = new Set(C.vendedores || []);
  if (resumo.aConferir)
    corpo.append(
      el(
        "p",
        "wait",
        `⏳ ${resumo.aConferir} venda${resumo.aConferir > 1 ? "s" : ""} do PR a conferir: a comissão delas entra depois da conferência (PR → A conferir).`
      )
    );
  const box = caixa(corpo, "Equipe", nomeP + " · comissão: PR sobre a venda; kits da formatura sobre as parcelas pagas no período");
  const tb = el("div", "vdtab");
  const head = el("div", "vdtr th");
  ["Pessoa", "Visitas feitas", "Visitas marcadas", "Colégios fechados", "Vendas", "Comissão"].forEach(t =>
    head.append(el("span", null, t))
  );
  tb.append(head);
  const marc = {};
  (resumo.marcadas || []).forEach(x => {
    marc[x.por] = (marc[x.por] || 0) + 1;
  });
  const pessoas = new Set([...Object.keys(p.pessoas), ...Object.keys(marc)]);
  [...pessoas]
    .filter(Boolean)
    .sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), "pt-BR"))
    .forEach(kp => {
      const x = p.pessoas[kp] || { vend: 0, visitas: 0, fechados: 0, com: {} };
      const ehVend = comiss.has(kp) || nomesVend.has(kp);
      const c = comissaoDe(x, (l, f) => taxa(C.P, l, f));
      if (!x.vend && !x.visitas && !x.fechados && !marc[kp] && !c.total) return;
      const r = el("div", "vdtr");
      [
        U.first(nomeDe(kp)),
        x.visitas,
        marc[kp] || 0,
        x.fechados,
        moeda(x.vend),
        ehVend ? moeda(c.total) + (c.semForma ? " (há venda sem forma de pagamento)" : "") : "—"
      ].forEach((t, i) => {
        const s = el("span", null, String(t));
        s.dataset.l = ["", "Visitas feitas", "Visitas marcadas", "Colégios fechados", "Vendas", "Comissão"][i];
        r.append(s);
      });
      tb.append(r);
    });
  if (tb.children.length === 1) tb.append(el("p", "hint", "Sem movimento da equipe no período."));
  box.append(tb);
  const marcadas = resumo.marcadas || [];
  const vb = caixa(corpo, `Visitas marcadas (${marcadas.length})`, "Próximas visitas aos colégios");
  const l = el("div", "vdlist");
  marcadas
    .filter(x => x.data >= U.todayStr())
    .slice(0, 15)
    .forEach(x => {
      const r = el("div", "vdrow");
      r.append(
        el("span", null, `${U.fmtDate(x.data)}${x.hora ? " " + x.hora : ""} · ${title(x.inst)}`),
        el("b", null, x.por ? U.first(nomeDe(x.por)) : "—")
      );
      l.append(r);
    });
  if (!l.children.length)
    l.append(el("p", "hint", "Nenhuma visita marcada. Quando o vendedor registra “Voltar para visita” com data, ela aparece aqui."));
  vb.append(l);
}

// ---------- números de cada card ----------
const pct = (a, b) => (b ? Math.round((a * 100) / b) + "%" : "—");
function kpis(corpo, lista) {
  const k = el("div", "kpis");
  lista.forEach(([t, v, cls]) => {
    const c = el("div", "kpi" + (cls ? " " + cls : ""));
    c.append(el("small", null, t), el("b", null, v));
    k.append(c);
  });
  corpo.append(k);
}
// Gráfico de barras dos 12 meses de uma área (ou lista, se o Chart.js não carregou)
function evolucao(corpo, titulo, sub, valorDoMes, ehDinheiro) {
  const doze = (() => {
    const s0 = periodo;
    periodo = "12m";
    const r = mesesDoPeriodo();
    periodo = s0;
    return r;
  })();
  const dados = doze.map(m => valorDoMes(resumo.meses[m] || {}));
  const box = caixa(corpo, titulo, sub),
    Chart = window.Chart,
    rot = doze.map(m => MESES_C[Number(m.slice(5)) - 1] + "/" + m.slice(2, 4));
  if (Chart) {
    charts.push(
      new Chart(canvas(box), {
        type: "bar",
        data: {
          labels: rot,
          datasets: [
            {
              data: dados.map(v => (ehDinheiro ? reais(v) : v)),
              backgroundColor: dados.map((_, i) => (i === dados.length - 1 ? AZUL : GRAFITE)),
              borderRadius: 5
            }
          ]
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => " " + (ehDinheiro ? brl(c.parsed.y) : c.parsed.y) } }
          },
          scales: {
            y: { beginAtZero: true, ticks: ehDinheiro ? { callback: v => "R$ " + v.toLocaleString("pt-BR") } : { precision: 0 } },
            x: { grid: { display: false } }
          }
        }
      })
    );
  } else {
    const l = el("div", "vdlist");
    rot.forEach((r, i) => {
      const x = el("div", "vdrow");
      x.append(el("span", null, r), el("b", null, ehDinheiro ? moeda(dados[i]) : String(dados[i])));
      l.append(x);
    });
    box.append(l);
  }
}
function lista(box, linhas, vazio) {
  const l = el("div", "vdlist");
  linhas.forEach(([a, b]) => {
    const r = el("div", "vdrow");
    r.append(el("span", null, a), el("b", null, b));
    l.append(r);
  });
  if (!linhas.length) l.append(el("p", "hint", vazio || "Sem dados no período."));
  box.append(l);
}
function tabela(box, cols, linhas, vazio) {
  const tb = el("div", "vdtab");
  const h = el("div", "vdtr th");
  cols.forEach(t => h.append(el("span", null, t)));
  tb.append(h);
  linhas.forEach(cs => {
    const r = el("div", "vdtr");
    cs.forEach((t, i) => {
      const s0 = el("span", null, String(t));
      s0.dataset.l = i ? cols[i] : "";
      r.append(s0);
    });
    tb.append(r);
  });
  if (!linhas.length) tb.append(el("p", "hint", vazio || "Sem movimento no período."));
  box.append(tb);
}
const ordemNome = (a, b) => nomeDe(a[0]).localeCompare(nomeDe(b[0]), "pt-BR");
const comissaoLinhas = (x, linhas) => {
  const so = { com: Object.fromEntries(Object.entries(x.com || {}).filter(([k]) => linhas.includes(k.split("|")[0]))) };
  return comissaoDe(so, (l, f) => taxa(C.P, l, f)).total;
};

function areaPR(corpo, p, nomeP) {
  const R = p.pr || {},
    lf = R.lf || {},
    rp = R.rep || {};
  if (resumo.aConferir)
    corpo.append(
      el(
        "p",
        "wait",
        `⏳ ${resumo.aConferir} venda${resumo.aConferir > 1 ? "s" : ""} do PR a conferir: a comissão delas entra depois da conferência (PR → A conferir).`
      )
    );
  kpis(corpo, [
    ["Vendido no PR", moeda(R.v || 0)],
    ["Kits vendidos", String(R.n || 0)],
    ["Ticket médio", R.n ? moeda(Math.round(R.v / R.n)) : "—"],
    ["Contatos separados", String(R.separados || 0)],
    ["Conversão (vendas ÷ separados)", pct(R.n || 0, R.separados || 0)]
  ]);
  const b1 = caixa(corpo, "Linha de Frente × Repasse", nomeP);
  lista(b1, [
    [
      `Linha de Frente · ${lf.n || 0} kit${lf.n === 1 ? "" : "s"} · ${lf.sep || 0} separados · conversão ${pct(lf.n || 0, lf.sep || 0)}`,
      moeda(lf.v || 0)
    ],
    [
      `Repasse · ${rp.n || 0} kit${rp.n === 1 ? "" : "s"} · ${rp.sep || 0} separados · conversão ${pct(rp.n || 0, rp.sep || 0)}`,
      moeda(rp.v || 0)
    ]
  ]);
  const b2 = caixa(corpo, "Forma de pagamento", nomeP);
  lista(
    b2,
    Object.entries(R.forma || {})
      .sort((a, b) => b[1].v - a[1].v)
      .map(([f, x]) => [`${f} · ${x.n}`, moeda(x.v)])
  );
  evolucao(corpo, "PR mês a mês", "Últimos 12 meses, em R$", m => (m.pr || {}).v || 0, true);
  const b3 = caixa(corpo, "Equipe no PR", nomeP + " · comissão sobre a venda conferida");
  const vend = new Set((C.vendedoresEmails || []).map(e => e.toLowerCase()));
  tabela(
    b3,
    ["Pessoa", "Separados", "Kits", "Vendido", "Conversão", "Comissão"],
    Object.entries(R.pessoas || {})
      .sort(ordemNome)
      .map(([k, x]) => [
        U.first(nomeDe(k)),
        x.sep || 0,
        x.n || 0,
        moeda(x.v || 0),
        pct(x.n || 0, x.sep || 0),
        vend.has(k) ? moeda(comissaoLinhas(p.pessoas[k] || {}, ["pr"])) : "—"
      ])
  );
}

function areaForm(corpo, p, nomeP) {
  const F = p.form || {},
    A = (resumo.agora || {}).form || {},
    vc = F.vendCol || {},
    va = F.vendAlb || {};
  kpis(corpo, [
    ["Colégios fechados", String(F.colegios || 0)],
    ["Vendido · adesão (Kit 01)", `${moeda(vc.v || 0)} (${vc.n || 0})`],
    ["Vendido · kits 02 a 05", `${moeda(va.v || 0)} (${va.n || 0})`],
    ["Recebido no período", moeda((F.recCol || 0) + (F.recAlb || 0))]
  ]);
  kpis(corpo, [
    ["A receber · adesão", moeda(A.aReceberCol || 0)],
    ["A receber · kits", moeda(A.aReceberAlb || 0)],
    ["Formandos com parcela atrasada", String(A.atrasados || 0), A.atrasados ? "late" : ""],
    ["Em aberto desses atrasados", moeda(A.atrasadoValor || 0)]
  ]);
  corpo.append(el("p", "hint", "A receber e atrasados são de hoje (não dependem do período)."));
  const vAnt = F.vendAnt || {},
    vPos = F.vendPos || {},
    vRep = F.vendRep || {};
  const b0 = caixa(corpo, "Antecipado × depois das fotos × repasse", nomeP + " · vendas de kits");
  lista(b0, [
    [`Antecipado (contrato) · ${vAnt.n || 0}`, moeda(vAnt.v || 0)],
    [`Depois das fotos · ${vPos.n || 0}`, moeda(vPos.v || 0)],
    [`Repasse (turmas de anos anteriores) · ${vRep.n || 0}`, moeda(vRep.v || 0)]
  ]);
  const b1 = caixa(corpo, "Recebido por contrato", nomeP);
  lista(b1, [
    ["🎓 Adesão · Kit 01 (parcelas pagas)", moeda(F.recCol || 0)],
    ["📘 Kits 02 a 05 (parcelas pagas)", moeda(F.recAlb || 0)],
    [`↩️ Devolvido (desistência e reprovação) · ${F.devolvidoN || 0}`, "− " + moeda(F.devolvido || 0)],
    ["= Ficou no caixa", moeda((F.recCol || 0) + (F.recAlb || 0) - (F.devolvido || 0))]
  ]);
  evolucao(
    corpo,
    "Parcelas recebidas mês a mês",
    "Últimos 12 meses, adesão + kits",
    m => ((m.form || {}).recCol || 0) + ((m.form || {}).recAlb || 0),
    true
  );
  const b2 = caixa(corpo, "Equipe nas formaturas", nomeP + " · comissão sobre as parcelas pagas");
  const vend = new Set((C.vendedoresEmails || []).map(e => e.toLowerCase()));
  tabela(
    b2,
    ["Pessoa", "Colégios fechados", "Vendido", "Recebido", "Comissão"],
    Object.entries(F.pessoas || {})
      .sort(ordemNome)
      .map(([k, x]) => [
        U.first(nomeDe(k)),
        x.colegios || 0,
        moeda(x.vend || 0),
        moeda(x.rec || 0),
        vend.has(k) ? moeda(comissaoLinhas(p.pessoas[k] || {}, ["form", "adesao"])) : "—"
      ])
  );
}

function areaFunil(corpo, p, nomeP) {
  const F = p.funil || {},
    A = (resumo.agora || {}).funil || {};
  if (resumo.aConferirFunil)
    corpo.append(
      el(
        "p",
        "wait",
        `⏳ ${resumo.aConferirFunil} venda${resumo.aConferirFunil > 1 ? "s" : ""} do Funil a conferir: só entra${resumo.aConferirFunil > 1 ? "m" : ""} nos números depois da conferência (Funil → card da venda → ✔ Conferir venda).`
      )
    );
  kpis(corpo, [
    ["Leads novos", String(F.criados || 0)],
    ["Vendas fechadas", String(F.fechados || 0)],
    ["Conversão", pct(F.fechados || 0, F.criados || 0)],
    ["Vendido", moeda(F.v || 0)],
    ["Perdidos", String(F.perdidos || 0)]
  ]);
  kpis(corpo, [
    ["Em aberto agora", String(A.abertos || 0)],
    ["Contatos atrasados", String(A.atrasados || 0), A.atrasados ? "late" : ""],
    ["Em negociação", moeda(A.emNegociacao || 0)]
  ]);
  const b1 = caixa(corpo, "De onde vêm os leads", nomeP + " · conversão por origem");
  lista(
    b1,
    Object.entries(F.origem || {})
      .sort((a, b) => (b[1].criados || 0) - (a[1].criados || 0))
      .map(([o, x]) => [
        `${o} · ${x.criados || 0} lead${x.criados === 1 ? "" : "s"} · ${x.fechados || 0} venda${x.fechados === 1 ? "" : "s"} · ${pct(x.fechados || 0, x.criados || 0)}`,
        moeda(x.v || 0)
      ])
  );
  const b2 = caixa(corpo, "O que mais vende", nomeP);
  lista(
    b2,
    Object.entries(F.servico || {})
      .sort((a, b) => b[1].v - a[1].v)
      .map(([sv, x]) => [`${sv} · ${x.n}`, moeda(x.v)])
  );
  evolucao(corpo, "Leads novos mês a mês", "Últimos 12 meses", m => (m.funil || {}).criados || 0, false);
  const b3 = caixa(corpo, "Equipe no Funil", nomeP);
  tabela(
    b3,
    ["Pessoa", "Vendas", "Vendido", "Ticket médio"],
    Object.entries(F.pessoas || {})
      .sort(ordemNome)
      .map(([k, x]) => [U.first(nomeDe(k)), x.fechados || 0, moeda(x.v || 0), x.fechados ? moeda(Math.round(x.v / x.fechados)) : "—"])
  );
}

// ---------- Meu desempenho (equipe): só os números da própria pessoa ----------
async function mostrarMeu(v) {
  const head = el("div", "vhead");
  head.append(el("h2", null, "Meu desempenho"));
  head.append(botaoRelatorio(relatorioDash, () => C.me));
  v.append(head);
  const chips = el("div", "chips");
  v.append(chips);
  const corpo = el("div");
  corpo.id = "vdCorpo";
  corpo.append(el("div", "empty", "Carregando…"));
  v.append(corpo);
  let fatia = null,
    falhou = false;
  const desenharMeu = () => {
    corpo.innerHTML = "";
    if (falhou) {
      corpo.append(el("div", "empty", "Não foi possível carregar os seus números agora. Verifique a internet e abra de novo."));
      return;
    }
    if (!fatia) {
      corpo.append(
        el(
          "div",
          "empty",
          "Ainda não há números seus. Eles aparecem aqui no dia seguinte à sua primeira venda, visita ou contato separado (o resumo é feito toda madrugada)."
        )
      );
      return;
    }
    const nomeP = PERIODOS.find(p => p[0] === periodo)[1];
    const p = periodoDaPessoa(fatia, mesesDoPeriodo());
    const ps = p.pessoa,
      pr = p.pr,
      fo = p.form,
      fu = p.funil;
    const com = comissaoDe(ps, (l, f) => taxa(C.P, l, f));
    kpis(corpo, [
      ["Vendido por você", moeda(ps.vend || 0)],
      ["Sua comissão (estimada)", moeda(com.total)],
      ["Visitas feitas", String(ps.visitas || 0)],
      ["Colégios fechados", String(ps.fechados || 0)]
    ]);
    corpo.append(el("p", "hint", `${nomeP} · comissão do PR sobre a venda conferida; das formaturas, sobre as parcelas pagas.`));
    const b1 = caixa(corpo, "🖼️ PR", nomeP);
    lista(b1, [
      ["Contatos separados", String(pr.sep || 0)],
      [`Vendas · ${pr.n || 0}`, moeda(pr.v || 0)],
      ["Conversão (vendas ÷ separados)", pr.sep ? Math.round(((pr.n || 0) * 100) / pr.sep) + "%" : "—"]
    ]);
    const b2 = caixa(corpo, "🎓 Formaturas", nomeP);
    lista(b2, [
      ["Kits vendidos", moeda(fo.vend || 0)],
      ["Parcelas recebidas das suas turmas", moeda(fo.rec || 0)],
      ["Colégios fechados", String(fo.colegios || 0)]
    ]);
    const b3 = caixa(corpo, "💬 Funil", nomeP);
    lista(b3, [[`Vendas fechadas · ${fu.fechados || 0}`, moeda(fu.v || 0)]]);
    // mês a mês (12 meses)
    const s0 = periodo;
    periodo = "12m";
    const doze = mesesDoPeriodo();
    periodo = s0;
    const b4 = caixa(corpo, "Mês a mês", "Últimos 12 meses · vendido por você");
    lista(
      b4,
      doze
        .slice()
        .reverse()
        .map(m => {
          const x = (fatia.meses[m] || {}).pessoa || {};
          return [`${MESES_C[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`, moeda(x.vend || 0)];
        })
    );
    if ((fatia.marcadas || []).length) {
      const b5 = caixa(corpo, "📅 Suas visitas marcadas", "");
      lista(
        b5,
        fatia.marcadas.map(x => [`${U.fmtDate(x.data)}${x.hora ? " às " + x.hora : ""}`, title(x.inst)])
      );
    }
    if (fatia.geradoEm)
      corpo.append(
        el("p", "hint", "Números atualizados em " + U.fmtDate(fatia.geradoEm.slice(0, 10)) + " às " + U.hhmm(fatia.geradoEm) + ".")
      );
  };
  PERIODOS.forEach(([k, t]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(periodo === k));
    b.onclick = () => {
      periodo = k;
      chips.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      desenharMeu();
    };
    chips.append(b);
  });
  try {
    const s = await FS.getDoc(FS.doc(db, "resumos", idResumoPessoa(C.email)));
    fatia = s.exists() ? s.data() : null;
  } catch (e) {
    console.warn("[Z7] meu desempenho", e);
    falhou = true;
  }
  desenharMeu();
}

// Relatório para reunião: o que está na tela (área e período escolhidos), com os gráficos como imagem
function relatorioDash() {
  const corpo = $("vdCorpo");
  if (!corpo) throw new Error("dashboard ainda não abriu");
  const nomeP = (PERIODOS.find(p => p[0] === periodo) || [])[1] || "";
  const nomeA = C.isAdmin ? (AREAS.find(a => a[0] === area) || [])[1] || "" : "";
  return {
    titulo: C.isAdmin ? "Dashboard" + (nomeA ? " · " + nomeA : "") : "Meu desempenho",
    subtitulo: nomeP,
    secoes: [{ no: copiaDaTela(corpo) }]
  };
}
