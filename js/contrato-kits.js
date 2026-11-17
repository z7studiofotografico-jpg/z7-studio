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
export function editorKits(x, admin) {
  const box = el("div", "kits-editor");
  const pct = el("input");
  pct.inputMode = "decimal";
  pct.placeholder = "ex.: 20";
  pct.value = x && x.comissaoPct ? String(x.comissaoPct).replace(".", ",") : "";
  pct.disabled = !admin;
  pct.setAttribute("aria-label", "Comissão %");
  box.append(field("Comissão do representante (% do total; vazio = as taxas dos Ajustes)", pct));
  const lista = el("div", "kits-lista");
  const linhas = [];
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
    const cx = ITENS_PACOTE.map(([id, n]) => {
      const l = el("label", "chk");
      const c = el("input");
      c.type = "checkbox";
      c.checked = (k.itens || []).includes(id);
      l.append(c, document.createTextNode(" " + n));
      chips.append(l);
      return [id, c];
    });
    const tirar = U.mkBtn("✕ Tirar este kit", "btn-sm", () => {
      r.remove();
      linhas.splice(linhas.indexOf(item), 1);
    });
    r.append(topo, chips, tirar);
    [nome, serie, valor, ...cx.map(([, c]) => c), tirar].forEach(i => (i.disabled = !admin));
    const item = { nome, serie, valor, cx };
    linhas.push(item);
    lista.append(r);
  };
  kitsDo(x).forEach(add);
  box.append(el("b", null, "Kits do colégio"), lista);
  if (admin) box.append(U.mkBtn("+ Kit", "btn-sm", () => add()));
  return {
    box,
    ler: () => ({
      comissaoPct: reais(pct.value) || 0,
      kits: linhas
        .map(l => ({
          nome: l.nome.value.trim(),
          serie: l.serie.value.trim(),
          valor: reais(l.valor.value),
          itens: l.cx.filter(([, c]) => c.checked).map(([id]) => id)
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
    b.title = textoPacote(k.itens);
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
