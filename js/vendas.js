// Painel de Vendas (só administradores).
// Junta as vendas reais do app:
//   - Funil de vendas: leads FECHADOS (campo "valor", data "fechadoEm", produto = serviço)
//   - PR: kits PAGOS ou ENTREGUES (valor, "pagoEm"), Linha de Frente ou Repasse
//   - Turmas: formandos dos colégios fechados (valor do kit, parcelas pagas)
//   - Ensaios do estúdio marcados direto na agenda (sem vir do Funil, para não contar duas vezes)
// E a equipe: visitas feitas, visitas marcadas, colégios fechados, vendas e comissão.
// Os gráficos usam o Chart.js (biblioteca leve, carregada só quando o painel abre).
import { formaDe, taxa } from "./comissao.js";
let C, FS, db, dados = null, periodo = "mes", charts = [];
const $ = (id) => document.getElementById(id);
const CHART_URL = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
const MESES_C = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PERIODOS = [["mes", "Este mês"], ["passado", "Mês passado"], ["ano", "Este ano"], ["12m", "Últimos 12 meses"]];
// Cores do painel: azul, grafite e branco (os gráficos seguem o tema claro/escuro do app)
const AZUL = "#2563eb", AZUL_CLARO = "rgba(37,99,235,.14)", GRAFITE = "#3f4652";
const CORES_ORIGEM = { "Funil": "#2563eb", "PR": "#3f4652", "Turmas": "#0ea5e9", "Estúdio": "#94a3b8" };

function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function title(s){ return String(s || "").toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, w => w.toLowerCase()); }
const n0 = v => Number(v) || 0;

export function init(ctx){ C = ctx; FS = ctx.FS; db = ctx.db; }
export function hide(){ charts.forEach(c => c.destroy()); charts = []; }

function carregarChart(){
  if (window.Chart) return Promise.resolve(window.Chart);
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = CHART_URL; s.onload = () => res(window.Chart); s.onerror = rej; document.head.append(s); });
}

export async function show(force){
  const v = $("viewVendas"); v.innerHTML = "";
  const head = el("div", "vhead"); head.append(el("h2", null, "Vendas"));
  head.append(C.mkBtn("↻ Atualizar", "btn-sm", () => show(true))); v.append(head);
  const chips = el("div", "chips"); v.append(chips);
  PERIODOS.forEach(([k, t]) => { const b = el("button", "chip", t); b.type = "button"; b.setAttribute("aria-pressed", String(periodo === k)); b.onclick = () => { periodo = k; chips.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); desenhar(); }; chips.append(b); });
  const corpo = el("div"); corpo.id = "vdCorpo"; v.append(corpo);
  corpo.append(el("div", "empty", "Carregando as vendas…"));
  try {
    if (!dados || force) dados = await buscar();
    await carregarChart().catch(e => { console.warn(e); });
    desenhar();
  } catch (e) { console.warn(e); corpo.innerHTML = ""; const x = el("div", "empty"); x.append(el("strong", null, "Não foi possível carregar"), el("span", null, e.code === "permission-denied" ? "Só administradores veem o painel. Se você é admin, cole as regras novas do Firebase." : "Verifique a internet e tente de novo.")); corpo.append(x); }
}

// ---------- 1. Buscar os dados reais ----------
// Cada venda vira { data: "AAAA-MM-DD", valor, produto, origem, resp }.
async function buscar(){
  const get = async (q) => { try { return (await FS.getDocs(q)).docs.map(d => Object.assign({ id: d.id }, d.data())); } catch (e) { console.warn(e); if (e.code === "permission-denied" && q._obrig) throw e; return []; } };
  const [leads, prs, forms, insts, ens] = await Promise.all([
    get(FS.query(FS.collection(db, "leads"), FS.where("etapa", "==", "FECHADO"), FS.limit(3000))),
    get(FS.query(FS.collection(db, "repasse"), FS.where("etapa", "in", ["PAGO", "ENTREGUE"]), FS.limit(5000))),
    get(FS.query(FS.collection(db, "formandos"), FS.limit(5000))),
    get(FS.query(FS.collection(db, "instituicoes"), FS.limit(3000))),
    get(FS.query(FS.collection(db, "ensaios"), FS.where("data", ">=", C.addDays(-400)), FS.limit(3000)))
  ]);
  const vendas = [];
  leads.forEach(l => vendas.push({ data: l.fechadoEm || String(l.criadoEm || "").slice(0, 10), valor: n0(l.valor), produto: l.servico || "Ensaio", origem: "Funil", resp: l.resp || "" }));
  prs.forEach(r => { const d = r.pagoEm || ""; vendas.push({ data: d, valor: n0(r.valor), produto: Number(r.ano) >= Number(d.slice(0, 4)) ? "Kit PR · Linha de Frente" : "Kit PR · Repasse", origem: "PR", resp: r.resp || "", linha: "pr", forma: formaDe(r.formaPag) }); });
  const instPorId = Object.fromEntries(insts.map(i => [i.id, i]));
  forms.filter(f => f.status !== "desistiu").forEach(f => vendas.push({ data: f.vendidoEm || String(f.criadoEm || "").slice(0, 10), valor: n0(f.valor), produto: f.kit || "Kit formatura", origem: "Turmas", linha: "form", forma: formaDe(f.formaPag),
    resp: f.resp || (instPorId[f.instId] || {}).resp || "", recebido: n0(f.valor) * Math.min(n0(f.pagas), n0(f.parcelas) || 1) / (n0(f.parcelas) || 1) }));
  ens.filter(e => e.kind !== "pessoal" && !e.leadId && n0(e.valor) && e.status !== "faltou" && e.data <= C.todayStr())
    .forEach(e => vendas.push({ data: e.data, valor: n0(e.valor), produto: e.tipo || "Ensaio", origem: "Estúdio", resp: e.marcadoPor || "" }));
  // Equipe: visitas feitas, visitas marcadas e colégios fechados
  const visitas = [], marcadas = [], fechados = [];
  insts.forEach(i => {
    (i.visitas || []).forEach(v => { if (v.data) visitas.push({ data: v.data, por: v.por || "", inst: i.nome, como: v.como || "" }); });
    if (i.etapa === "FECHADO" && i.fechadoEm) fechados.push({ data: i.fechadoEm, por: i.resp || "", inst: i.nome });
    if (i.followup && i.followup >= C.todayStr() && i.etapa !== "FECHADO" && i.etapa !== "NÃO FECHOU" && (i.proximoPasso === "Voltar para visita" || i.etapa === "AGENDAR VISITA" || i.followupHora))
      marcadas.push({ data: i.followup, hora: i.followupHora || "", por: i.resp || "", inst: i.nome });
  });
  marcadas.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  // Comissão: PR sobre a venda; Formatura sobre cada parcela paga, na data em que foi paga
  const comissoes = [];
  prs.forEach(r => comissoes.push({ data: r.pagoEm || "", base: n0(r.valor), linha: "pr", forma: formaDe(r.formaPag), resp: r.resp || "" }));
  forms.filter(f => f.status !== "desistiu").forEach(f => {
    const resp = f.resp || (instPorId[f.instId] || {}).resp || "", forma = formaDe(f.formaPag), pv = n0(f.valor) / (n0(f.parcelas) || 1);
    const pags = Array.isArray(f.pagamentos) ? f.pagamentos : Array.from({ length: Math.min(n0(f.pagas), n0(f.parcelas) || 1) }, () => ({ data: f.vendidoEm || "", valor: pv }));
    pags.forEach(p => comissoes.push({ data: p.data || f.vendidoEm || "", base: n0(p.valor), linha: "form", forma, resp }));
  });
  return { vendas: vendas.filter(x => x.data), comissoes: comissoes.filter(x => x.data), visitas, marcadas, fechados, carregadoEm: new Date() };
}

// ---------- 2. Período escolhido ----------
function faixa(){
  const t = C.todayStr(), y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7));
  if (periodo === "mes") return [t.slice(0, 7) + "-01", t];
  if (periodo === "passado") { const d = new Date(y, m - 2, 1), f = new Date(y, m - 1, 0); return [`${d.getFullYear()}-${C.pad(d.getMonth() + 1)}-01`, `${f.getFullYear()}-${C.pad(f.getMonth() + 1)}-${C.pad(f.getDate())}`]; }
  if (periodo === "ano") return [`${y}-01-01`, t];
  const d = new Date(y, m - 12, 1); return [`${d.getFullYear()}-${C.pad(d.getMonth() + 1)}-01`, t];
}
const dentro = (d, [a, b]) => d >= a && d <= b;
const moeda = v => C.money(Math.round(v));

// ---------- 3. Desenhar o painel ----------
function desenhar(){
  hide();
  const corpo = $("vdCorpo"); if (!corpo || !dados) return; corpo.innerHTML = "";
  const fx = faixa(), vs = dados.vendas.filter(x => dentro(x.data, fx));
  const total = vs.reduce((a, x) => a + x.valor, 0), pedidos = vs.length, ticket = pedidos ? total / pedidos : 0;
  const turmas = dados.vendas.filter(x => x.origem === "Turmas"), aReceber = turmas.reduce((a, x) => a + x.valor - (x.recebido || 0), 0);

  // KPIs
  const k = el("div", "kpis");
  [["Total de vendas", moeda(total)], ["Pedidos", String(pedidos)], ["Ticket médio", pedidos ? moeda(ticket) : "—"], ["A receber das turmas", moeda(aReceber)]]
    .forEach(([t, v]) => { const c = el("div", "kpi"); c.append(el("small", null, t), el("b", null, v)); k.append(c); });
  corpo.append(k);
  if (!dados.vendas.length) corpo.append(el("p", "hint", "Ainda não há vendas registradas. Elas aparecem aqui quando um lead do Funil é marcado como Fechado, um kit do PR é pago, um formando entra numa turma ou um ensaio do estúdio tem valor."));

  // Gráfico de linha: evolução mensal (últimos 12 meses)
  const meses = []; { const t = C.todayStr(); const y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7)); for (let i = 11; i >= 0; i--) { const d = new Date(y, m - 1 - i, 1); meses.push(`${d.getFullYear()}-${C.pad(d.getMonth() + 1)}`); } }
  const porMes = meses.map(mm => dados.vendas.filter(x => x.data.slice(0, 7) === mm).reduce((a, x) => a + x.valor, 0));
  const g1 = caixa(corpo, "Evolução das vendas mensais", "Últimos 12 meses, todas as origens");
  // Produtos mais vendidos no período
  const prod = {}; vs.forEach(x => { const p = prod[x.produto] = prod[x.produto] || { v: 0, n: 0 }; p.v += x.valor; p.n++; });
  const top = Object.entries(prod).sort((a, b) => b[1].v - a[1].v).slice(0, 8);
  const g2 = caixa(corpo, "Produtos mais vendidos", PERIODOS.find(p => p[0] === periodo)[1] + " · em R$");
  // Por origem
  const org = {}; vs.forEach(x => { org[x.origem] = (org[x.origem] || 0) + x.valor; });
  const g3 = caixa(corpo, "De onde vêm as vendas", PERIODOS.find(p => p[0] === periodo)[1]);
  const lst = el("div", "vdlist");
  Object.entries(org).sort((a, b) => b[1] - a[1]).forEach(([o, v]) => { const r = el("div", "vdrow"); const n = vs.filter(x => x.origem === o).length; r.append(el("span", null, `${o} · ${n} pedido${n > 1 ? "s" : ""}`), el("b", null, moeda(v))); lst.append(r); });
  if (!lst.children.length) lst.append(el("p", "hint", "Sem vendas no período."));
  g3.append(lst);

  const Chart = window.Chart;
  if (Chart) {
    const cs = getComputedStyle(document.body), fg = cs.getPropertyValue("--muted").trim() || "#6b6670", grid = cs.getPropertyValue("--line").trim() || "#dedadb";
    Chart.defaults.color = fg; Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    const tip = { callbacks: { label: c => " " + moeda(c.parsed.y != null && c.chart.config.type === "line" ? c.parsed.y : c.parsed.x) } };
    charts.push(new Chart(canvas(g1), { type: "line",
      data: { labels: meses.map(mm => MESES_C[Number(mm.slice(5)) - 1] + "/" + mm.slice(2, 4)), datasets: [{ label: "Vendas", data: porMes, borderColor: AZUL, backgroundColor: AZUL_CLARO, fill: true, tension: .3, cubicInterpolationMode: "monotone", pointRadius: 3, pointBackgroundColor: AZUL }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales: { y: { beginAtZero: true, grid: { color: grid }, ticks: { callback: v => "R$ " + (v >= 1000 ? (v / 1000).toLocaleString("pt-BR") + " mil" : v) } }, x: { grid: { display: false } } } } }));
    if (top.length) charts.push(new Chart(canvas(g2, Math.max(180, top.length * 38)), { type: "bar",
      data: { labels: top.map(([p]) => p), datasets: [{ label: "Vendas", data: top.map(([, x]) => x.v), backgroundColor: top.map((_, i) => i === 0 ? AZUL : GRAFITE), borderRadius: 6 }] },
      options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${moeda(c.parsed.x)} · ${top[c.dataIndex][1].n} pedido${top[c.dataIndex][1].n > 1 ? "s" : ""}` } } }, scales: { x: { beginAtZero: true, grid: { color: grid }, ticks: { callback: v => "R$ " + (v >= 1000 ? v / 1000 + " mil" : v) } }, y: { grid: { display: false } } } } }));
    else g2.append(el("p", "hint", "Sem vendas no período."));
  } else {
    // Sem internet para a biblioteca de gráficos: mostra em lista
    const l1 = el("div", "vdlist"); meses.forEach((mm, i) => { const r = el("div", "vdrow"); r.append(el("span", null, MESES_C[Number(mm.slice(5)) - 1] + "/" + mm.slice(2, 4)), el("b", null, moeda(porMes[i]))); l1.append(r); }); g1.append(l1);
    const l2 = el("div", "vdlist"); top.forEach(([p, x]) => { const r = el("div", "vdrow"); r.append(el("span", null, `${p} · ${x.n}`), el("b", null, moeda(x.v))); l2.append(r); }); g2.append(l2);
  }

  // Equipe: visitas, colégios fechados, vendas e comissão
  equipe(corpo, fx, vs);
  corpo.append(el("p", "hint", "Atualizado às " + C.hhmm(dados.carregadoEm.toISOString()) + ". Toque em ↻ para buscar de novo."));
}
function caixa(pai, tit, sub){ const b = el("section", "vdbox"); b.append(el("h3", null, tit)); if (sub) b.append(el("small", null, sub)); pai.append(b); return b; }
function canvas(box, h){ const w = el("div", "vdchart"); w.style.height = (h || 240) + "px"; const c = el("canvas"); c.setAttribute("role", "img"); c.setAttribute("aria-label", box.querySelector("h3").textContent); w.append(c); box.append(w); return c; }

function equipe(corpo, fx, vs){
  const comiss = new Set(C.vendedores || []);
  // Comissão: soma venda a venda, pela linha (PR ou Formatura) e forma de pagamento
  const cs = dados.comissoes.filter(x => dentro(x.data, fx));
  const comDe = nm => cs.filter(x => x.resp === nm).reduce((a, x) => a + x.base * taxa(C.P, x.linha, x.forma) / 100, 0);
  const semForma = nm => cs.filter(x => x.resp === nm && !x.forma).length;
  const nomes = new Set([...(C.team() || []), ...vs.map(x => x.resp), ...dados.visitas.filter(x => dentro(x.data, fx)).map(x => x.por), ...dados.marcadas.map(x => x.por)].filter(Boolean));
  const box = caixa(corpo, "Equipe", PERIODOS.find(p => p[0] === periodo)[1] + " · comissão: PR sobre a venda, Formatura sobre as parcelas pagas no período");
  const tb = el("div", "vdtab");
  const head = el("div", "vdtr th"); ["Pessoa", "Visitas feitas", "Visitas marcadas", "Colégios fechados", "Vendas", "Comissão"].forEach(t => head.append(el("span", null, t))); tb.append(head);
  [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")).forEach(nm => {
    const vend = vs.filter(x => x.resp === nm).reduce((a, x) => a + x.valor, 0);
    const vf = dados.visitas.filter(x => x.por === nm && dentro(x.data, fx) && /visita/i.test(x.como || "Visita")).length;
    const vm = dados.marcadas.filter(x => x.por === nm).length;
    const cf = dados.fechados.filter(x => x.por === nm && dentro(x.data, fx)).length;
    if (!vend && !vf && !vm && !cf && !comDe(nm)) return;
    const r = el("div", "vdtr");
    [C.first(nm), vf, vm, cf, moeda(vend), comiss.has(nm) ? moeda(comDe(nm)) + (semForma(nm) ? ` (${semForma(nm)} sem forma de pagamento)` : "") : "—"].forEach((t, i) => { const s = el("span", null, String(t)); s.dataset.l = ["", "Visitas feitas", "Visitas marcadas", "Colégios fechados", "Vendas", "Comissão"][i]; r.append(s); });
    tb.append(r);
  });
  if (tb.children.length === 1) tb.append(el("p", "hint", "Sem movimento da equipe no período."));
  box.append(tb);
  // Próximas visitas marcadas
  const vb = caixa(corpo, `Visitas marcadas (${dados.marcadas.length})`, "Próximas visitas aos colégios");
  const l = el("div", "vdlist");
  dados.marcadas.slice(0, 15).forEach(x => { const r = el("div", "vdrow"); r.append(el("span", null, `${C.fmtDate(x.data)}${x.hora ? " " + x.hora : ""} · ${title(x.inst)}`), el("b", null, x.por ? C.first(x.por) : "—")); l.append(r); });
  if (!dados.marcadas.length) l.append(el("p", "hint", "Nenhuma visita marcada. Quando o vendedor registra “Voltar para visita” com data, ela aparece aqui."));
  vb.append(l);
}
