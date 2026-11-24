// Relatório para imprimir (ou salvar em PDF) de cada card, para levar a uma reunião.
// Cada tela monta o conteúdo com os dados que já estão na tela (a equipe só vê o que é dela) e chama abrirRelatorio.
// conteudo = { titulo, subtitulo, secoes: [{ titulo, nota, kpis: [[rótulo, valor]], tabela: { cols: [...], linhas: [[...]] } }] }
import { el, sheet, field, sel } from "./ui.js";
import * as U from "./util.js";

export function abrirRelatorio(conteudo, quem) {
  fecharRelatorio();
  const r = el("div");
  r.id = "relatorio";
  r.setAttribute("role", "dialog");
  r.setAttribute("aria-label", "Relatório: " + conteudo.titulo);
  const barra = el("div", "rel-barra");
  // 17/11/2026: na hora de imprimir (ou salvar em PDF), escolhe a folha: deitada (paisagem) ou em pé (retrato).
  // A tela já mostra a folha do jeito que vai sair: tabela larga (7 colunas ou mais) começa deitada
  const largo = (conteudo.secoes || []).some(x => x.tabela && x.tabela.cols && x.tabela.cols.length >= 7);
  const imprimir = pais => {
    folhaDeitada(r, pais);
    setTimeout(() => window.print(), 50);
  };
  // (17/11/2026) a ordem das linhas, escolhida na hora (como a folha): ID, nome (A-Z) ou turma
  const ordem = ordemDasTabelas(conteudo);
  if (ordem) barra.append(ordem.caixa);
  barra.append(
    U.mkBtn("🖨️ Imprimir · folha deitada", largo ? "btn-primary" : "", () => imprimir(true)),
    U.mkBtn("🖨️ Imprimir · folha em pé", largo ? "" : "btn-primary", () => imprimir(false)),
    U.mkBtn("Fechar", "", fecharRelatorio)
  );
  const folha = el("div", "rel-folha");
  const cab = el("div", "rel-cab");
  const agora = new Date();
  cab.append(
    el("div", "rel-marca", "Z7 Studio Fotográfico"),
    el("h1", null, conteudo.titulo),
    el(
      "p",
      "rel-sub",
      [
        conteudo.subtitulo,
        `Gerado em ${U.fmtDate(U.ds(agora))}/${agora.getFullYear()} às ${U.hhmm(agora.toISOString())}`,
        quem ? "por " + quem : ""
      ]
        .filter(Boolean)
        .join(" · ")
    )
  );
  folha.append(cab);
  const corpo = el("div");
  // (23/11/2026) ✂️ o que sai: cada parte do relatório liga/desliga, e "sem valores" tira tudo que é R$ (ex.: a
  // lista para o diretor do colégio). A escolha não sai na folha.
  const esc = escolherPartes(conteudo, () => desenhar());
  barra.prepend(esc.caixa);
  const desenhar = () =>
    corpo.replaceChildren(
      ...(conteudo.secoes || []).filter((s, i) => !esc.fora.has(i)).map(s => secao(esc.limpar(ordem ? ordem.aplicar(s) : s)))
    );
  if (ordem) ordem.mudou = desenhar;
  desenhar();
  folha.append(corpo);
  r.append(barra, folha);
  folhaDeitada(r, largo);
  document.body.append(r);
  document.body.classList.add("imprimindo");
  return r;
}
// ✂️ Escolher o que sai no relatório: as partes (seções) e "sem valores (R$)"
const DINHEIRO_COL = /^(valor|vendido|recebido|em aberto|pago|a receber|comiss[ãa]o|pre[çc]o)/i;
const temReais = v => /R\$\s?-?\d/.test(String(v == null ? "" : v));
export function semValores(s) {
  const out = Object.assign({}, s);
  if (s.kpis) out.kpis = s.kpis.filter(([, val]) => !temReais(val));
  if (s.tabela && s.tabela.cols) {
    const { cols, linhas } = s.tabela;
    const tira = cols.map((c, i) => linhas.some(l => temReais(l[i])) || DINHEIRO_COL.test(String(c)));
    out.tabela = { cols: cols.filter((_, i) => !tira[i]), linhas: linhas.map(l => l.filter((_, i) => !tira[i])) };
  }
  return out;
}
function escolherPartes(conteudo, mudou) {
  const fora = new Set();
  let sem = false;
  const caixa = el("details", "rel-escolha");
  caixa.append(el("summary", null, "✂️ O que sai"));
  const box = el("div", "rel-escolha-box");
  (conteudo.secoes || []).forEach((s, i) => {
    if (!s.titulo) return;
    const l = el("label", "chk");
    const cb = el("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.onchange = () => (cb.checked ? fora.delete(i) : fora.add(i), mudou());
    l.append(cb, document.createTextNode(" " + s.titulo));
    box.append(l);
  });
  const temDinheiro = (conteudo.secoes || []).some(
    s => (s.kpis || []).some(([, v]) => temReais(v)) || ((s.tabela || {}).linhas || []).some(l => l.some(temReais))
  );
  if (temDinheiro) {
    const l = el("label", "chk rel-sem-valor");
    const cb = el("input");
    cb.type = "checkbox";
    cb.onchange = () => ((sem = cb.checked), mudou());
    l.append(cb, document.createTextNode(" 🙈 Sem valores (R$) — ex.: para entregar ao diretor"));
    box.append(l);
  }
  caixa.append(box);
  return { caixa, fora, limpar: s => (sem ? semValores(s) : s) };
}
// a página da impressora: deitada (paisagem) ou em pé, com margem pequena
function folhaDeitada(r, pais) {
  r.classList.toggle("rel-paisagem", pais);
  let st = document.getElementById("relPagina");
  if (!st) {
    st = document.createElement("style");
    st.id = "relPagina";
    document.head.append(st);
  }
  st.textContent = `@media print{@page{size:A4 ${pais ? "landscape" : "portrait"};margin:9mm}}`;
}
export function fecharRelatorio() {
  const s = document.getElementById("relPagina");
  if (s) s.remove();
  const r = document.getElementById("relatorio");
  if (r) r.remove();
  document.body.classList.remove("imprimindo");
}
// As ordens possíveis, pelas colunas das tabelas: ID, nome do aluno (A-Z) e turma (depois o nome)
const COL_ID = /^(id|c[oó]d(igo)?\.?)$/i;
const COL_NOME = /^(aluno|nome|formando|cliente)$/i;
const COL_TURMA = /^(turma|s[eé]rie|turma \/ s[eé]rie)$/i;
const cmp = (a, b) => String(a == null ? "" : a).localeCompare(String(b == null ? "" : b), "pt-BR", { numeric: true, sensitivity: "base" });
function ordemDasTabelas(conteudo) {
  const tabs = (conteudo.secoes || []).filter(s => s.tabela && s.tabela.cols && s.tabela.linhas.length > 1);
  const tem = re => tabs.some(s => s.tabela.cols.some(c => re.test(String(c).trim())));
  const ops = [["", "Como veio"]];
  if (tem(COL_ID)) ops.push(["id", "Número do ID"]);
  if (tem(COL_NOME)) ops.push(["nome", "Nome (A-Z)"]);
  if (tem(COL_TURMA)) ops.push(["turma", "Turma, depois o nome"]);
  if (ops.length < 2) return null;
  let atual = "";
  try {
    atual = localStorage.getItem("z7RelOrdem") || "";
  } catch (_) {}
  if (!ops.some(([v]) => v === atual)) atual = "";
  const s0 = sel(ops, atual);
  s0.setAttribute("aria-label", "Ordem das linhas");
  const caixa = el("label", "rel-ordem");
  caixa.append(document.createTextNode("↕️ Ordem: "), s0);
  const o = {
    caixa,
    mudou: () => {},
    aplicar: s => {
      if (!atual || !s.tabela || !s.tabela.linhas) return s;
      const cols = s.tabela.cols.map(c => String(c).trim());
      const i = re => cols.findIndex(c => re.test(c));
      const iId = i(COL_ID),
        iNome = i(COL_NOME),
        iTurma = i(COL_TURMA);
      const chaves = atual === "id" ? [iId, iNome] : atual === "nome" ? [iNome, iId] : [iTurma, iNome, iId];
      if (chaves[0] < 0) return s;
      const linhas = s.tabela.linhas.slice().sort((a, b) => {
        for (const k of chaves) {
          if (k < 0) continue;
          const c = cmp(a[k], b[k]);
          if (c) return c;
        }
        return 0;
      });
      return Object.assign({}, s, { tabela: Object.assign({}, s.tabela, { linhas }) });
    }
  };
  s0.addEventListener("change", () => {
    atual = s0.value;
    try {
      localStorage.setItem("z7RelOrdem", atual);
    } catch (_) {}
    o.mudou();
  });
  return o;
}
function secao(s) {
  const box = el("section", "rel-secao");
  if (s.titulo) box.append(el("h2", null, s.titulo));
  if (s.nota) box.append(el("p", "rel-nota", s.nota));
  if (s.kpis && s.kpis.length) {
    const k = el("div", "rel-kpis");
    s.kpis.forEach(([rot, val]) => {
      const c = el("div", "rel-kpi");
      c.append(el("small", null, rot), el("b", null, String(val)));
      k.append(c);
    });
    box.append(k);
  }
  if (s.no) box.append(s.no);
  if (s.tabela) {
    const { cols, linhas } = s.tabela;
    if (!linhas.length) box.append(el("p", "rel-nota", s.vazio || "Nada para mostrar."));
    else {
      const t = el("table", "rel-tab"),
        th = el("thead"),
        tr = el("tr");
      cols.forEach(c => tr.append(el("th", null, c)));
      th.append(tr);
      const tb = el("tbody");
      linhas.forEach(l => {
        const x = el("tr");
        // texto curto (ID, ano, data, valor) não quebra no meio
        l.forEach(v => {
          const t = v == null ? "" : String(v);
          x.append(el("td", t.length <= 12 ? "curto" : null, t));
        });
        tb.append(x);
      });
      t.append(th, tb);
      box.append(t);
    }
  }
  return box;
}
// Cópia de um pedaço da tela para o relatório: gráficos viram imagem e os botões saem
export function copiaDaTela(orig) {
  const c = orig.cloneNode(true);
  c.removeAttribute("id");
  c.querySelectorAll("[id]").forEach(x => x.removeAttribute("id"));
  const telas = orig.querySelectorAll("canvas"),
    copias = c.querySelectorAll("canvas");
  copias.forEach((cv, i) => {
    const img = document.createElement("img");
    try {
      // gráfico ainda animando: desenha o estado final antes de copiar
      const g = window.Chart && window.Chart.getChart && window.Chart.getChart(telas[i]);
      if (g) {
        g.stop();
        g.update("none");
      }
      img.src = telas[i].toDataURL("image/png");
    } catch (e) {
      cv.remove();
      return;
    }
    img.alt = cv.getAttribute("aria-label") || "Gráfico";
    img.className = "rel-graf";
    cv.replaceWith(img);
  });
  c.querySelectorAll("button, input, select, textarea").forEach(x => x.remove());
  c.classList.add("rel-copia");
  return c;
}
// Botão padrão do cabeçalho das telas
export function botaoRelatorio(montar, quem) {
  return U.mkBtn("🖨️ Relatório", "btn-sm", async () => {
    try {
      const conteudo = await montar();
      if (!conteudo) return; // a pessoa fechou a escolha dos filtros
      abrirRelatorio(conteudo, quem && quem());
    } catch (e) {
      console.warn("[Z7] relatório", e);
      U.toast("Não foi possível montar o relatório agora.");
    }
  });
}
// Contagem por chave: [[chave, n], ...] em ordem decrescente
export function contar(lista, fn) {
  const m = {};
  lista.forEach(x => {
    const k = fn(x) || "—";
    m[k] = (m[k] || 0) + 1;
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

// Antes de gerar: escolher os filtros do relatório (ex.: ano, colégio, turma, situação, separar por).
// campos = [{ k, rotulo, opcoes(valores) → [[valor, texto]], padrao, vazio }]: as opções são montadas de novo a cada
// mudança, então a lista de turmas acompanha o colégio escolhido. Devolve os valores, ou null se a pessoa fechou.
export function pedirFiltros(titulo, campos) {
  return new Promise(resolve => {
    let feito = false;
    const close = sheet(
      titulo,
      (p, fechar) => {
        const v = {};
        campos.forEach(c => (v[c.k] = c.padrao || ""));
        const caixas = el("div");
        const pintar = () => {
          caixas.innerHTML = "";
          campos.forEach(c => {
            const ops = c.opcoes(v);
            if (v[c.k] && !ops.some(o => String(o[0]) === String(v[c.k])))
              v[c.k] = c.padrao && ops.some(o => o[0] === c.padrao) ? c.padrao : "";
            const s = sel(ops, v[c.k], c.vazio == null ? undefined : c.vazio);
            s.onchange = () => {
              v[c.k] = s.value;
              pintar();
            };
            caixas.append(field(c.rotulo, s));
          });
        };
        pintar();
        const ok = el("button", "btn-primary", "🖨️ Gerar relatório");
        ok.type = "submit";
        const acoes = el("div", "actions");
        acoes.append(ok, U.mkBtn("Cancelar", "", fechar));
        p.append(caixas, acoes);
        p.onsubmit = e => {
          e.preventDefault();
          feito = true;
          fechar();
          resolve(Object.assign({}, v));
        };
      },
      { onClose: () => !feito && resolve(null) }
    );
    return close;
  });
}
