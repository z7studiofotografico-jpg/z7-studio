// Dashboard de vendas (só administradores).
// Abre lendo 1 documento (resumos/dashboard), gerado toda madrugada pelo GitHub e sempre que
// alguém toca em "Atualizar agora". O cálculo fica em js/calc.js (o mesmo no app e no script).
// Valores em centavos até a hora de mostrar. Gráficos com Chart.js, carregado só aqui.
import { resumir, periodo as somaPeriodo, comissaoDe } from "./calc.js";
import { brl, reais, taxa } from "./regras.js";
import { el, title, carregarLib } from "./ui.js";
let C, FS, db, resumo = null, periodo = "mes", charts = [];
const $ = (id) => document.getElementById(id);
const MESES_C = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PERIODOS = [["mes", "Este mês"], ["passado", "Mês passado"], ["ano", "Este ano"], ["12m", "Últimos 12 meses"]];
const AZUL = "#2563eb", AZUL_CLARO = "rgba(37,99,235,.14)", GRAFITE = "#3f4652";
const moeda = c => brl(reais(c)); // recebe centavos

export function init(ctx){ C = ctx; FS = ctx.FS; db = ctx.db; }
export function hide(){ charts.forEach(c => c.destroy()); charts = []; }
function carregarChart(){ return carregarLib("chart"); }

export async function show(){
  const v = $("viewVendas"); v.innerHTML = "";
  const head = el("div", "vhead"); head.append(el("h2", null, "Dashboard"));
  const bt = C.mkBtn("↻ Atualizar agora", "btn-sm", () => atualizar(bt)); head.append(bt); v.append(head);
  const chips = el("div", "chips"); v.append(chips);
  PERIODOS.forEach(([k, t]) => { const b = el("button", "chip", t); b.type = "button"; b.setAttribute("aria-pressed", String(periodo === k)); b.onclick = () => { periodo = k; chips.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); desenhar(); }; chips.append(b); });
  const corpo = el("div"); corpo.id = "vdCorpo"; corpo.append(el("div", "empty", "Carregando…")); v.append(corpo);
  carregarChart().catch(e => console.warn("[Z7] gráficos", e));
  try {
    const s = await FS.getDoc(FS.doc(db, "resumos", "dashboard"));
    resumo = s.exists() ? s.data() : null;
    if (!resumo) await atualizar(bt); else { await carregarChart().catch(() => {}); desenhar(); }
  } catch (e) { erro(e); }
}
function erro(e){
  console.warn("[Z7] dashboard", e); const corpo = $("vdCorpo"); if (!corpo) return; corpo.innerHTML = "";
  const x = el("div", "empty"); x.append(el("strong", null, "Não foi possível carregar"), el("span", null, e && e.code === "permission-denied" ? "Só administradores veem o Dashboard. Se você é admin, cole as regras novas do Firebase." : "Verifique a internet e tente de novo.")); corpo.append(x);
}

// Lê tudo, recalcula e grava o resumo (as leituras grandes só acontecem aqui)
async function atualizar(bt){
  if (bt) { bt.disabled = true; bt.textContent = "Atualizando…"; }
  try {
    const get = async (q) => (await FS.getDocs(q)).docs.map(d => Object.assign({ id: d.id }, d.data()));
    const col = n => FS.collection(db, n);
    const [leads, prs, forms, insts, ens, becas] = await Promise.all([
      get(FS.query(col("leads"), FS.where("etapa", "==", "FECHADO"))),
      get(FS.query(col("repasse"), FS.where("etapa", "in", ["PAGO", "ENTREGUE"]))),
      get(FS.query(col("formandos"))),
      get(FS.query(col("instituicoes"))),
      get(FS.query(col("ensaios"), FS.where("data", ">=", C.addDays(-730)))),
      get(FS.query(col("becas")))
    ]);
    const porNome = Object.fromEntries(Object.entries(C.usuarios || {}).filter(([, u]) => u.nome).map(([em, u]) => [u.nome, em]));
    resumo = resumir({ leads, prs, forms, insts, ens, becas }, C.todayStr(), porNome);
    await FS.setDoc(FS.doc(db, "resumos", "dashboard"), resumo);
    await carregarChart().catch(() => {});
    desenhar();
  } catch (e) { erro(e); }
  finally { if (bt) { bt.disabled = false; bt.textContent = "↻ Atualizar agora"; } }
}

function mesesDoPeriodo(){
  const t = C.todayStr(), y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7));
  const mm = (yy, mo) => { const d = new Date(yy, mo - 1, 1); return `${d.getFullYear()}-${C.pad(d.getMonth() + 1)}`; };
  if (periodo === "mes") return [mm(y, m)];
  if (periodo === "passado") return [mm(y, m - 1)];
  if (periodo === "ano") return Array.from({ length: m }, (_, i) => mm(y, i + 1));
  return Array.from({ length: 12 }, (_, i) => mm(y, m - 11 + i));
}
const nomeDe = k => { const u = (C.usuarios || {})[k]; return u && u.nome ? u.nome : k.includes("@") ? k.split("@")[0] : k; };

function desenhar(){
  hide();
  const corpo = $("vdCorpo"); if (!corpo || !resumo) return; corpo.innerHTML = "";
  const nomeP = PERIODOS.find(p => p[0] === periodo)[1];
  const p = somaPeriodo(resumo, mesesDoPeriodo());
  const k = el("div", "kpis");
  [["Total de vendas", moeda(p.total)], ["Pedidos", String(p.n)], ["Ticket médio", p.n ? moeda(Math.round(p.total / p.n)) : "—"], ["A receber das formaturas", brl(resumo.aReceber || 0)]]
    .forEach(([t, v]) => { const c = el("div", "kpi"); c.append(el("small", null, t), el("b", null, v)); k.append(c); });
  corpo.append(k);
  if (!Object.keys(resumo.meses || {}).length) corpo.append(el("p", "hint", "Ainda não há vendas registradas. Elas aparecem aqui quando um lead do Funil é marcado como Fechado, um kit do PR é pago, um formando entra numa turma, um aluguel de becas tem valor ou um ensaio do estúdio tem valor."));

  // Evolução dos últimos 12 meses
  const doze = (() => { const s = periodo; periodo = "12m"; const r = mesesDoPeriodo(); periodo = s; return r; })();
  const porMes = doze.map(m => (resumo.meses[m] || {}).total || 0);
  const g1 = caixa(corpo, "Evolução das vendas mensais", "Últimos 12 meses, todas as origens");
  const top = Object.entries(p.produto).sort((a, b) => b[1].v - a[1].v).slice(0, 8);
  const g2 = caixa(corpo, "Produtos mais vendidos", nomeP + " · em R$");
  const g3 = caixa(corpo, "De onde vêm as vendas", nomeP);
  const lst = el("div", "vdlist");
  Object.entries(p.origem).sort((a, b) => b[1].v - a[1].v).forEach(([o, v]) => { const r = el("div", "vdrow"); r.append(el("span", null, `${o} · ${v.n} pedido${v.n > 1 ? "s" : ""}`), el("b", null, moeda(v.v))); lst.append(r); });
  if (!lst.children.length) lst.append(el("p", "hint", "Sem vendas no período."));
  g3.append(lst);

  const Chart = window.Chart;
  if (Chart) {
    const cs = getComputedStyle(document.body), fg = cs.getPropertyValue("--muted").trim() || "#6b6670", grid = cs.getPropertyValue("--line").trim() || "#dedadb";
    Chart.defaults.color = fg; Chart.defaults.font.family = cs.fontFamily;
    const eixo = v => "R$ " + (v >= 1000 ? (v / 1000).toLocaleString("pt-BR") + " mil" : v.toLocaleString("pt-BR"));
    charts.push(new Chart(canvas(g1), { type: "line",
      data: { labels: doze.map(m => MESES_C[Number(m.slice(5)) - 1] + "/" + m.slice(2, 4)), datasets: [{ label: "Vendas", data: porMes.map(reais), borderColor: AZUL, backgroundColor: AZUL_CLARO, fill: true, tension: .3, cubicInterpolationMode: "monotone", pointRadius: 3, pointBackgroundColor: AZUL }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => " " + brl(c.parsed.y) } } }, scales: { y: { beginAtZero: true, grid: { color: grid }, ticks: { callback: eixo } }, x: { grid: { display: false } } } } }));
    if (top.length) charts.push(new Chart(canvas(g2, Math.max(180, top.length * 38)), { type: "bar",
      data: { labels: top.map(([n]) => n), datasets: [{ label: "Vendas", data: top.map(([, x]) => reais(x.v)), backgroundColor: top.map((_, i) => i === 0 ? AZUL : GRAFITE), borderRadius: 6 }] },
      options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${brl(c.parsed.x)} · ${top[c.dataIndex][1].n} pedido${top[c.dataIndex][1].n > 1 ? "s" : ""}` } } }, scales: { x: { beginAtZero: true, grid: { color: grid }, ticks: { callback: eixo } }, y: { grid: { display: false } } } } }));
    else g2.append(el("p", "hint", "Sem vendas no período."));
  } else {
    const l1 = el("div", "vdlist"); doze.forEach((m, i) => { const r = el("div", "vdrow"); r.append(el("span", null, MESES_C[Number(m.slice(5)) - 1] + "/" + m.slice(2, 4)), el("b", null, moeda(porMes[i]))); l1.append(r); }); g1.append(l1);
    const l2 = el("div", "vdlist"); top.forEach(([n, x]) => { const r = el("div", "vdrow"); r.append(el("span", null, `${n} · ${x.n}`), el("b", null, moeda(x.v))); l2.append(r); }); g2.append(l2);
  }
  equipe(corpo, p, nomeP);
  const quando = resumo.geradoEm ? new Date(resumo.geradoEm) : null;
  corpo.append(el("p", "hint", quando ? `Números de ${quando.toLocaleDateString("pt-BR")} às ${C.hhmm(resumo.geradoEm)}. Toque em ↻ para atualizar agora.` : ""));
}
function caixa(pai, tit, sub){ const b = el("section", "vdbox"); b.append(el("h3", null, tit)); if (sub) b.append(el("small", null, sub)); pai.append(b); return b; }
function canvas(box, h){ const w = el("div", "vdchart"); w.style.height = (h || 240) + "px"; const c = el("canvas"); c.setAttribute("role", "img"); c.setAttribute("aria-label", box.querySelector("h3").textContent); w.append(c); box.append(w); return c; }

function equipe(corpo, p, nomeP){
  const comiss = new Set((C.vendedoresEmails || []).map(e => e.toLowerCase()));
  const nomesVend = new Set(C.vendedores || []);
  if (resumo.aConferir) corpo.append(el("p", "wait", `⏳ ${resumo.aConferir} venda${resumo.aConferir > 1 ? "s" : ""} do PR a conferir: a comissão delas entra depois da conferência (PR → A conferir).`));
  const box = caixa(corpo, "Equipe", nomeP + " · comissão: PR sobre a venda; Álbum de formatura e Colação de grau sobre as parcelas pagas no período");
  const tb = el("div", "vdtab");
  const head = el("div", "vdtr th"); ["Pessoa", "Visitas feitas", "Visitas marcadas", "Colégios fechados", "Vendas", "Comissão"].forEach(t => head.append(el("span", null, t))); tb.append(head);
  const marc = {}; (resumo.marcadas || []).forEach(x => { marc[x.por] = (marc[x.por] || 0) + 1; });
  const pessoas = new Set([...Object.keys(p.pessoas), ...Object.keys(marc)]);
  [...pessoas].filter(Boolean).sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), "pt-BR")).forEach(kp => {
    const x = p.pessoas[kp] || { vend: 0, visitas: 0, fechados: 0, com: {} };
    const ehVend = comiss.has(kp) || nomesVend.has(kp);
    const c = comissaoDe(x, (l, f) => taxa(C.P, l, f));
    if (!x.vend && !x.visitas && !x.fechados && !marc[kp] && !c.total) return;
    const r = el("div", "vdtr");
    [C.first(nomeDe(kp)), x.visitas, marc[kp] || 0, x.fechados, moeda(x.vend), ehVend ? moeda(c.total) + (c.semForma ? " (há venda sem forma de pagamento)" : "") : "—"]
      .forEach((t, i) => { const s = el("span", null, String(t)); s.dataset.l = ["", "Visitas feitas", "Visitas marcadas", "Colégios fechados", "Vendas", "Comissão"][i]; r.append(s); });
    tb.append(r);
  });
  if (tb.children.length === 1) tb.append(el("p", "hint", "Sem movimento da equipe no período."));
  box.append(tb);
  const marcadas = resumo.marcadas || [];
  const vb = caixa(corpo, `Visitas marcadas (${marcadas.length})`, "Próximas visitas aos colégios");
  const l = el("div", "vdlist");
  marcadas.filter(x => x.data >= C.todayStr()).slice(0, 15).forEach(x => { const r = el("div", "vdrow"); r.append(el("span", null, `${C.fmtDate(x.data)}${x.hora ? " " + x.hora : ""} · ${title(x.inst)}`), el("b", null, x.por ? C.first(nomeDe(x.por)) : "—")); l.append(r); });
  if (!l.children.length) l.append(el("p", "hint", "Nenhuma visita marcada. Quando o vendedor registra “Voltar para visita” com data, ela aparece aqui."));
  vb.append(l);
}
