// Kits do colégio e comissão de quem fechou, no Contrato do colégio (17/11/2026).
// Kit = pacote com nome e preço fechado, às vezes de uma turma só (ex.: "Kit 1 · 5º ano: pelerine + canudo +
// certificado + foto 21x15 = R$ 95"). O aluno com os itens de um kit paga o preço do kit (contrato-colegio-regras.js).
// Comissão: % do total, para quem fechou (ex.: 20%); vazia = as taxas por item dos Ajustes.
import { el, field, sheet, botoes } from "./ui.js";
import * as U from "./util.js";
import { ITENS_PACOTE, kitsDo, nomeKit, textoPacote } from "./contrato-colegio-regras.js";

const reais = v => {
  const n = Number(
    String(v || "")
      .replace(/\./g, "")
      .replace(",", ".")
  );
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

// o bloco do formulário: comissão + kits. Devolve { box, ler() → { comissaoPct, kits } }
export function editorKits(x, admin, o = {}) {
  const box = el("div", "kits-editor");
  const pct = el("input");
  pct.inputMode = "decimal";
  pct.placeholder = "ex.: 20";
  pct.value = x && x.comissaoPct ? String(x.comissaoPct).replace(".", ",") : "";
  pct.disabled = !admin;
  pct.setAttribute("aria-label", "Comissão %");
  if (!o.semComissao) box.append(field("Comissão do representante (% do total; vazio = as taxas dos Ajustes)", pct));
  const lista = el("div", "kits-lista");
  const linhas = [];
  const somas = [];
  const add = (k = {}) => {
    const r = el("div", "kit-linha");
    const nome = el("input");
    nome.placeholder = "Kit 1";
    nome.value = k.nome || "";
    nome.setAttribute("aria-label", "Nome do kit");
    const serie = el("input");
    serie.placeholder = "turma (ex.: 9º ano) ou vazio = todas";
    serie.value = k.serie || "";
    serie.setAttribute("aria-label", "Turma do kit");
    const valor = el("input");
    valor.inputMode = "decimal";
    valor.placeholder = "R$";
    valor.value = k.valor ? String(k.valor).replace(".", ",") : "";
    valor.setAttribute("aria-label", "Preço do kit");
    const topo = el("div", "row3");
    topo.append(field("Nome do kit", nome), field("Turma do kit", serie), field("Preço do kit", valor));
    const chips = el("div", "chips");
    // cada item com a quantidade (ex.: 2 PR 15x10), que aparece quando o item está marcado (17/11/2026)
    const qs = {};
    const cx = ITENS_PACOTE.map(([id, n]) => {
      const l = el("label", "chk");
      const c = el("input");
      c.type = "checkbox";
      c.checked = (k.itens || []).includes(id);
      const q = el("input", "kit-qtd");
      q.type = "number";
      q.min = "1";
      q.max = "999";
      q.value = String(Number((k.qtd || {})[id]) || 1);
      q.setAttribute("aria-label", "Quantidade de " + n);
      q.hidden = !c.checked;
      c.addEventListener("change", () => (q.hidden = !c.checked));
      qs[id] = q;
      l.append(c, document.createTextNode(" " + n), q);
      chips.append(l);
      return [id, c];
    });
    const qtdDe = id => Math.max(1, parseInt(qs[id].value, 10) || 1);
    const tirar = U.mkBtn("✕ Tirar este kit", "btn-sm", () => {
      r.remove();
      linhas.splice(linhas.indexOf(item), 1);
    });
    // as duas frentes (17/11/2026): com os preços avulsos na tela, o kit mostra a soma dos itens marcados
    // e "Usar a soma" põe essa soma no preço do kit (dá para mudar depois, ex.: um desconto no kit)
    const soma = el("div", "kit-soma hint");
    const somar = () => {
      const pr = o.precos ? o.precos() : {};
      return reais(cx.filter(([, c]) => c.checked).reduce((t, [id]) => t + (Number(pr[id]) || 0) * qtdDe(id), 0));
    };
    const usar = U.mkBtn("= Usar a soma no preço do kit", "btn-sm", () => {
      valor.value = String(somar().toFixed(2)).replace(".", ",");
    });
    const mostrarSoma = () => {
      const v = somar();
      soma.replaceChildren(
        document.createTextNode(v ? `Soma dos itens avulsos: R$ ${v.toFixed(2).replace(".", ",")} ` : ""),
        ...(v && admin ? [usar] : [])
      );
    };
    cx.forEach(([, c]) => c.addEventListener("change", mostrarSoma));
    Object.values(qs).forEach(q => q.addEventListener("input", mostrarSoma));
    somas.push(mostrarSoma);
    if (o.precos) mostrarSoma();
    r.append(topo, chips, ...(o.precos ? [soma] : []), tirar);
    [nome, serie, valor, ...cx.map(([, c]) => c), ...Object.values(qs), tirar].forEach(i => (i.disabled = !admin));
    const item = { nome, serie, valor, cx, qtdDe };
    linhas.push(item);
    lista.append(r);
  };
  kitsDo(x).forEach(add);
  box.append(el("b", null, "Kits do colégio"), lista);
  if (admin) box.append(U.mkBtn("+ Kit", "btn-sm", () => add()));
  return {
    box,
    atualizarSomas: () => somas.forEach(f => f()),
    ler: () => ({
      ...(o.semComissao ? {} : { comissaoPct: reais(pct.value) || 0 }),
      kits: linhas
        .map(l => ({
          nome: l.nome.value.trim(),
          serie: l.serie.value.trim(),
          valor: reais(l.valor.value),
          itens: l.cx.filter(([, c]) => c.checked).map(([id]) => id),
          qtd: Object.fromEntries(l.cx.filter(([id, c]) => c.checked && l.qtdDe(id) > 1).map(([id]) => [id, l.qtdDe(id)]))
        }))
        .filter(k => k.nome && k.itens.length)
    })
  };
}

// botões de kit para escolher o pacote de um aluno (marca os itens do kit nas caixas)
export function botoesKits(contrato, serie, caixas, depois) {
  const kits = kitsDo(contrato).filter(
    k => !k.serie || !serie || U.chave(k.serie).replace(/\W/g, "") === U.chave(serie).replace(/\W/g, "")
  );
  const box = el("div", "chips kits-botoes");
  kits.forEach(k => {
    const b = U.mkBtn(`📦 ${nomeKit(k)} · ${U.money(k.valor)}`, "btn-sm", () => {
      caixas.forEach(([id, c]) => (c.checked = k.itens.includes(id)));
      if (depois) depois(k);
    });
    b.title = textoPacote(k.itens, k.qtd);
    box.append(b);
  });
  return box;
}

// Escolher os itens do pacote de um aluno (ou de vários), com os botões dos kits do colégio em cima
export function escolherPacote(tit, atual, aoSalvar, { padraoTxt = "Nenhum marcado = pacote padrão do contrato.", contrato = null } = {}) {
  sheet(tit, (p, close) => {
    p.append(el("p", "hint", padraoTxt));
    const caixas = ITENS_PACOTE.map(([k, nome]) => {
      const l = el("label", "chk");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = (atual || []).includes(k);
      l.append(cb, document.createTextNode(" " + nome));
      return [k, cb, l];
    });
    if (kitsDo(contrato).length) p.append(botoesKits(contrato, "", caixas));
    caixas.forEach(([, , l]) => p.append(l));
    p.append(botoes(close, "Salvar"));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      await aoSalvar(caixas.filter(([, cb]) => cb.checked).map(([k]) => k));
      close();
    });
  });
}
