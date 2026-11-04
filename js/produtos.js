// Card "Produtos e estoque" (Etapa 6): o catálogo único (preço, preço mínimo, custo, quem produz, ficha de insumos)
// e o estoque de cada item: Disponível = Físico − Reservado. Entrada de compra e estorno (com motivo) ficam no
// registro de movimentos (movEstoque). Ninguém muda a quantidade à mão: só por entrada, reserva, baixa ou estorno.
// Preços e ficha: só o administrador. A equipe com o módulo vê o estoque e lança entradas.
import { el, sheet, field, title, clicavel } from "./ui.js";
import * as U from "./util.js";
import { brl } from "./regras.js";
import { disponivel, precisaComprar, custoReal, margem } from "./catalogo.js";
import { carregarCatalogo, entrada, estornar } from "./estoque.js";
import { botaoRelatorio } from "./relatorio.js";
import { confirmar } from "./confirmar.js";

let C,
  cat = [],
  filtro = "venda",
  busca = "";
const $ = id => document.getElementById(id);
const n0 = v => Number(v) || 0;
const qtd = v => String(Math.round(n0(v) * 100) / 100).replace(".", ",");
const lerNum = v =>
  n0(
    String(v || "")
      .replace(/\./g, "")
      .replace(",", ".")
  );

export function init(ctx) {
  C = ctx;
}
export function hide() {}

export const FILTROS = [
  ["venda", "Produtos de venda"],
  ["insumo", "Insumos"],
  ["comprar", "⚠️ Comprar"],
  ["todos", "Todos"]
];
export function filtrar(lista, f, q = "") {
  const k = U.chave(q);
  return lista
    .filter(p => (f === "todos" ? true : f === "comprar" ? precisaComprar(p) : p.categoria === f))
    .filter(p => !k || U.chave(p.nome + " " + (p.grupo || "")).includes(k))
    .sort((a, b) => (a.grupo || "").localeCompare(b.grupo || "", "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function show() {
  const v = $("viewProdutos");
  v.innerHTML = "";
  const head = el("div", "vhead");
  head.append(el("h2", null, "Produtos e estoque"));
  const hb = el("div", "agact");
  if (C.isAdmin) hb.append(U.mkBtn("+ Produto", "btn-primary btn-sm", () => editar(null)));
  hb.append(U.mkBtn("📥 Entrada de compra", "btn-sm", () => movimento("entrada")));
  if (C.isAdmin)
    hb.append(
      U.mkBtn("↩️ Estorno", "btn-sm", () => movimento("estorno")),
      U.mkBtn("🧾 Movimentos", "btn-sm", () => movimentos())
    );
  hb.append(botaoRelatorio(relatorio, () => C.me));
  head.append(hb);
  v.append(head);
  v.append(
    el("p", "hint", "Disponível = físico − reservado. O estoque só muda por entrada, reserva, baixa na entrega ou estorno com motivo.")
  );
  const k = el("div", "kpis");
  k.id = "pdKpis";
  const chips = el("div", "chips");
  chips.id = "pdChips";
  const q = el("input");
  q.type = "search";
  q.placeholder = "Buscar produto ou insumo";
  q.setAttribute("aria-label", "Buscar produto ou insumo");
  q.value = busca;
  q.oninput = () => {
    busca = q.value;
    pintar();
  };
  const corpo = el("div");
  corpo.id = "pdCorpo";
  corpo.append(el("div", "empty", "Carregando…"));
  v.append(k, chips, q, corpo);
  try {
    cat = await carregarCatalogo(C);
  } catch (e) {
    corpo.textContent = "";
    corpo.append(el("div", "empty", "Não foi possível carregar o catálogo. Cole as regras novas do Firebase e tente de novo."));
    return C.handleErr(e);
  }
  pintar();
}

function pintar() {
  const k = $("pdKpis"),
    chips = $("pdChips"),
    corpo = $("pdCorpo");
  if (!k) return;
  k.textContent = "";
  const comprar = cat.filter(precisaComprar).length;
  const reservados = cat.filter(p => p.controla && n0(p.reservado) > 0).length;
  [
    ["Produtos de venda", cat.filter(p => p.categoria === "venda").length],
    ["Insumos", cat.filter(p => p.categoria === "insumo").length],
    ["Com reserva", reservados],
    ["Abaixo do mínimo", comprar]
  ].forEach(([r, n]) => {
    const c = el("div", "kpi" + (r === "Abaixo do mínimo" && n ? " late" : ""));
    c.append(el("small", null, r), el("b", null, String(n)));
    clicavel(c, () => {
      filtro = { "Produtos de venda": "venda", Insumos: "insumo", "Com reserva": "todos", "Abaixo do mínimo": "comprar" }[r];
      pintar();
    });
    k.append(c);
  });
  chips.textContent = "";
  FILTROS.forEach(([f, t]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(filtro === f));
    b.onclick = () => {
      filtro = f;
      pintar();
    };
    chips.append(b);
  });
  corpo.textContent = "";
  const lista = filtrar(cat, filtro, busca);
  if (!lista.length) return corpo.append(el("div", "empty", filtro === "comprar" ? "Nada abaixo do mínimo ✓" : "Nada aqui."));
  let grupo = null;
  lista.forEach(p => {
    if (p.grupo !== grupo) {
      grupo = p.grupo;
      corpo.append(el("h3", "pd-grupo", grupo || "Outros"));
    }
    corpo.append(cartao(p));
  });
}

function cartao(p) {
  const c = el("article", "card" + (precisaComprar(p) ? " pd-comprar" : ""));
  const top = el("div", "card-top");
  top.append(el("b", null, p.nome));
  if (p.produzidoPor) top.append(el("span", "tag", p.produzidoPor === "laboratório" ? "🏭 laboratório" : "🏠 estúdio"));
  c.append(top);
  if (p.controla) {
    const est = el("div", "pd-est");
    [
      ["Físico", qtd(p.fisico)],
      ["Reservado", qtd(p.reservado)],
      ["Disponível", qtd(disponivel(p))]
    ].forEach(([r, val]) => {
      const x = el("span");
      x.append(el("small", null, r + " "), el("b", null, val));
      est.append(x);
    });
    if (n0(p.minimo)) est.append(el("small", "hint", `mínimo ${qtd(p.minimo)} ${p.unidade || "un."}`));
    c.append(est);
    if (precisaComprar(p)) c.append(el("div", "fu late", "⚠️ Comprar: chegou no estoque mínimo"));
  } else c.append(el("small", "hint", "Sem estoque próprio: na venda, baixa os insumos da ficha."));
  if (C.isAdmin && p.categoria === "venda") {
    const m = margem(p, cat);
    c.append(
      el(
        "div",
        "fu",
        `Preço ${brl(n0(p.preco))} · mínimo ${brl(n0(p.precoMin))} · custo real ${brl(custoReal(p, cat))}` +
          (m != null ? ` · margem ${m}%` : "")
      )
    );
  }
  if (C.isAdmin && p.categoria === "insumo") c.append(el("div", "fu", `Custo ${brl(n0(p.custo))} por ${p.unidade || "unidade"}`));
  if ((p.ficha || []).length) {
    const d = el("details", "notes");
    d.append(el("summary", null, `Ficha (${p.ficha.length} insumo${p.ficha.length > 1 ? "s" : ""})`));
    const nomes = Object.fromEntries(cat.map(x => [x.id, x.nome]));
    p.ficha.forEach(f => d.append(el("div", null, `${qtd(f.qtd)} × ${nomes[f.insumo] || f.insumo}`)));
    c.append(d);
  }
  const act = el("div", "actions");
  if (p.controla) act.append(U.mkBtn("📥 Entrada", "", () => movimento("entrada", p)));
  if (C.isAdmin) act.append(U.mkBtn("✏️ Editar", "", () => editar(p)));
  if (act.childNodes.length) c.append(act);
  return c;
}

// Entrada (compra) ou estorno (volta ao estoque, com motivo obrigatório)
function movimento(tipo, p0) {
  const itens = cat.filter(p => (tipo === "entrada" ? p.controla : p.controla || (p.ficha || []).length));
  if (!itens.length) return U.toast("Nenhum item com estoque.");
  sheet(tipo === "entrada" ? "Entrada de compra" : "Estorno (volta ao estoque)", (pn, close) => {
    const s0 = el("select");
    itens.forEach(p => {
      const o = el("option", null, `${p.nome} (disp. ${qtd(disponivel(p))})`);
      o.value = p.id;
      s0.append(o);
    });
    if (p0) s0.value = p0.id;
    const q = el("input");
    q.inputMode = "decimal";
    q.required = true;
    q.placeholder = "0";
    const mot = el("input");
    mot.placeholder = tipo === "entrada" ? "ex.: nota 1234, fornecedor" : "por que voltou? (obrigatório)";
    mot.required = tipo === "estorno";
    pn.append(field("Item", s0), field("Quantidade", q), field(tipo === "entrada" ? "Observação" : "Motivo do estorno", mot));
    const a = el("div", "panel-actions");
    const ok = el("button", "btn btn-primary", tipo === "entrada" ? "Dar entrada" : "Estornar");
    ok.type = "submit";
    a.append(el("span"), U.mkBtn("Cancelar", "", close), ok);
    a.firstChild.style.flex = "1";
    pn.append(a);
    pn.addEventListener("submit", async ev => {
      ev.preventDefault();
      const n = lerNum(q.value);
      if (n <= 0) return U.toast("Coloque a quantidade.");
      if (tipo === "estorno" && !mot.value.trim()) return U.toast("O estorno precisa de um motivo.");
      const p = cat.find(x => x.id === s0.value);
      if (!(await confirmar(tipo === "entrada" ? "Dar entrada?" : "Estornar?", `${qtd(n)} × ${p.nome}`))) return;
      ok.disabled = true;
      try {
        const o = { modulo: "produtos", motivo: mot.value.trim() };
        const r = tipo === "entrada" ? await entrada(C, [{ produto: p.id, qtd: n }], o) : await estornar(C, [{ produto: p.id, qtd: n }], o);
        U.toast(
          (tipo === "entrada" ? "Entrada registrada ✅" : "Estorno registrado ✅") + (r.avisos.length ? " · " + r.avisos.join("; ") : "")
        );
        close();
        show();
      } catch (e) {
        ok.disabled = false;
        if (e.code === "sem-estoque") U.toast(e.message);
        else C.handleErr(e);
      }
    });
    setTimeout(() => q.focus(), 30);
  });
}

// Cadastro do produto (só admin): preço, preço mínimo, custo, quem produz, estoque mínimo e ficha de insumos
function editar(p) {
  const novo = !p;
  p = p || { categoria: "venda", controla: true, ficha: [], grupo: "" };
  sheet(novo ? "Novo produto" : "Editar · " + p.nome, (pn, close) => {
    const nome = el("input");
    nome.value = p.nome || "";
    nome.required = true;
    const grupo = el("input");
    grupo.value = p.grupo || "";
    const catg = el("select");
    [
      ["venda", "Produto de venda"],
      ["insumo", "Insumo"]
    ].forEach(([k, t]) => {
      const o = el("option", null, t);
      o.value = k;
      catg.append(o);
    });
    catg.value = p.categoria || "venda";
    const din = v => {
      const i = el("input");
      i.inputMode = "decimal";
      i.value = n0(v) ? String(n0(v).toFixed(2)).replace(".", ",") : "";
      return i;
    };
    const preco = din(p.preco),
      precoMin = din(p.precoMin),
      custo = din(p.custo);
    const prod = el("select");
    ["estúdio", "laboratório"].forEach(t => {
      const o = el("option", null, t);
      o.value = t;
      prod.append(o);
    });
    prod.value = p.produzidoPor || "estúdio";
    const ctrl = el("input");
    ctrl.type = "checkbox";
    ctrl.checked = p.controla !== false;
    const lc = el("label", "chk");
    lc.append(ctrl, " Tem estoque físico (contar unidades)");
    const minimo = el("input");
    minimo.inputMode = "decimal";
    minimo.value = n0(p.minimo) ? qtd(p.minimo) : "";
    const unidade = el("input");
    unidade.value = p.unidade || "";
    unidade.placeholder = "un., folha, ml…";
    const r1 = el("div", "row2"),
      r2 = el("div", "row3"),
      r3 = el("div", "row2");
    r1.append(field("Nome", nome), field("Grupo", grupo));
    r2.append(field("Preço (R$)", preco), field("Preço mínimo (R$)", precoMin), field("Custo (R$)", custo));
    r3.append(field("Estoque mínimo (avisar compra)", minimo), field("Unidade", unidade));
    pn.append(r1, field("Tipo", catg), r2, field("Quem produz", prod), lc, r3);
    // ficha: insumos consumidos por unidade vendida
    const insumos = cat.filter(x => x.categoria === "insumo" || x.controla).filter(x => x.id !== p.id);
    const fichaBox = el("div");
    let ficha = (p.ficha || []).map(f => Object.assign({}, f));
    const pintarFicha = () => {
      fichaBox.textContent = "";
      ficha.forEach((f, i) => {
        const l = el("div", "row2");
        const s = el("select");
        insumos.forEach(x => {
          const o = el("option", null, x.nome);
          o.value = x.id;
          s.append(o);
        });
        s.value = f.insumo;
        s.onchange = () => (f.insumo = s.value);
        s.setAttribute("aria-label", "Insumo");
        const qq = el("input");
        qq.inputMode = "decimal";
        qq.value = qtd(f.qtd);
        qq.setAttribute("aria-label", "Quantidade por unidade");
        qq.oninput = () => (f.qtd = lerNum(qq.value));
        const tira = U.mkBtn("✕", "btn-danger", () => {
          ficha.splice(i, 1);
          pintarFicha();
        });
        tira.setAttribute("aria-label", "Tirar este insumo");
        const box = el("div", "pd-ficha-q");
        box.append(qq, tira);
        l.append(s, box);
        fichaBox.append(l);
      });
    };
    pintarFicha();
    const det = el("details", "notes");
    det.open = !!ficha.length;
    det.append(
      el("summary", null, "Ficha de insumos (consumo por unidade vendida)"),
      fichaBox,
      U.mkBtn("+ Insumo", "", () => {
        if (!insumos.length) return;
        ficha.push({ insumo: insumos[0].id, qtd: 1 });
        pintarFicha();
      })
    );
    pn.append(det);
    const a = el("div", "panel-actions");
    const ok = el("button", "btn btn-primary", "Salvar");
    ok.type = "submit";
    a.append(el("span"), U.mkBtn("Cancelar", "", close), ok);
    a.firstChild.style.flex = "1";
    pn.append(a);
    pn.addEventListener("submit", async ev => {
      ev.preventDefault();
      if (!nome.value.trim()) return;
      const pr = lerNum(preco.value),
        pm = lerNum(precoMin.value);
      if (pm && pr && pm > pr) return U.toast("O preço mínimo não pode ser maior que o preço.");
      const id = novo ? "p_" + U.chave(nome.value).toLowerCase().replace(/\s+/g, "_").slice(0, 40) + "_" + Date.now().toString(36) : p.id;
      const dados = {
        nome: nome.value.trim(),
        grupo: grupo.value.trim() || "Outros",
        categoria: catg.value,
        preco: pr,
        precoMin: pm,
        custo: lerNum(custo.value),
        produzidoPor: prod.value,
        controla: ctrl.checked,
        minimo: lerNum(minimo.value),
        unidade: unidade.value.trim(),
        ficha: ficha.filter(f => f.insumo && n0(f.qtd) > 0).map(f => ({ insumo: f.insumo, qtd: n0(f.qtd) })),
        atualizadoEm: new Date().toISOString()
      };
      ok.disabled = true;
      try {
        await C.FS.setDoc(C.FS.doc(C.db, "produtos", id), dados, { merge: true });
        U.toast(novo ? "Produto cadastrado ✅" : "Produto salvo ✅");
        close();
        show();
      } catch (e) {
        ok.disabled = false;
        C.handleErr(e);
      }
    });
  });
}

// Últimos movimentos do estoque (só admin)
async function movimentos() {
  let docs = [];
  try {
    const s = await C.FS.getDocs(C.FS.query(C.FS.collection(C.db, "movEstoque"), C.FS.orderBy("em", "desc"), C.FS.limit(100)));
    docs = s.docs.map(d => d.data());
  } catch (e) {
    return C.handleErr(e);
  }
  const nomes = Object.fromEntries(cat.map(x => [x.id, x.nome]));
  const TIPOS = {
    entrada: "📥 Entrada",
    reserva: "🔒 Reserva",
    desfaz: "🔓 Desfez reserva",
    baixa: "✅ Baixa",
    baixaDireta: "✅ Baixa",
    estorno: "↩️ Estorno"
  };
  sheet("Movimentos do estoque", (pn, close) => {
    if (!docs.length) pn.append(el("div", "empty", "Nenhum movimento ainda."));
    docs.forEach(m => {
      const l = el("div", "virada-linha");
      l.append(
        el(
          "span",
          null,
          `${TIPOS[m.tipo] || m.tipo} · ${(m.itens || []).map(i => `${qtd(i.qtd)} × ${nomes[i.produto] || i.produto}`).join(", ")}`
        ),
        el(
          "small",
          "hint",
          `${U.fmtDate(String(m.em).slice(0, 10))} · ${m.por || ""}${m.modulo ? " · " + m.modulo : ""}${m.motivo ? " · " + m.motivo : ""}`
        )
      );
      pn.append(l);
    });
    const a = el("div", "panel-actions");
    a.append(el("span"), U.mkBtn("Fechar", "", close));
    a.firstChild.style.flex = "1";
    pn.append(a);
  });
}

export function relatorio() {
  const linha = p => [
    title(p.nome),
    p.controla ? qtd(p.fisico) : "—",
    p.controla ? qtd(p.reservado) : "—",
    p.controla ? qtd(disponivel(p)) : "—",
    precisaComprar(p) ? "⚠️ comprar" : ""
  ];
  const cols = ["Item", "Físico", "Reservado", "Disponível", ""];
  const venda = filtrar(cat, "venda");
  const secoes = [
    { titulo: "Produtos de venda", tabela: { cols, linhas: venda.map(linha) } },
    { titulo: "Insumos", tabela: { cols, linhas: filtrar(cat, "insumo").map(linha) } }
  ];
  if (C.isAdmin)
    secoes.push({
      titulo: "Preços e margem",
      tabela: {
        cols: ["Produto", "Preço", "Mínimo", "Custo real", "Margem"],
        linhas: venda.map(p => {
          const m = margem(p, cat);
          return [title(p.nome), brl(n0(p.preco)), brl(n0(p.precoMin)), brl(custoReal(p, cat)), m != null ? m + "%" : "—"];
        })
      }
    });
  return { titulo: "Produtos e estoque", subtitulo: `${cat.filter(precisaComprar).length} abaixo do mínimo`, secoes };
}
