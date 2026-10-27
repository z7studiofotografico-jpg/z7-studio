// Editor de preços dos kits (o mesmo para a tabela padrão e para a tabela de uma turma).
// Três preços por kit: antecipado (contrato), depois das fotos (Linha de Frente) e repasse (turmas de anos anteriores).
import { el, inp, inpReais } from "./ui.js";
import { lerReais, brl, dividir } from "./regras.js";

export const COLUNAS_PRECO = [
  ["ant", "Antecipado"],
  ["pos", "Depois das fotos"],
  ["rep", "Repasse"]
];

// Lê um preço digitado; o antecipado sempre tem ao menos 1 parcela, os outros ficam zerados se vazios
export function lerPreco(valorTxt, parcelasTxt, q) {
  const valor = lerReais(valorTxt);
  return { valor, parcelas: valor || q === "ant" ? Math.max(1, parseInt(parcelasTxt, 10) || 1) : 0 };
}
export function mesmoPreco(x, y) {
  return (
    Math.round((Number((x || {}).valor) || 0) * 100) === Math.round((Number((y || {}).valor) || 0) * 100) &&
    (Number((x || {}).parcelas) || 0) === (Number((y || {}).parcelas) || 0)
  );
}
// Texto "10x de R$ 85,00" (ou "—")
export function textoPreco(p) {
  const val = Number((p || {}).valor) || 0,
    n = Math.max(1, Number((p || {}).parcelas) || 1);
  return val ? `${n}x de ${brl(dividir(val, n).pop())}` : "—";
}

// Monta os campos dentro de "p" e devolve { ler() → [{ id, nome, ant, pos, rep }], linhas }.
// opcoes: { padrao (tabela para mostrar ao lado, na turma), sufixo (aria-label), bloqueado }
export function editorPrecos(p, kits, opcoes = {}) {
  const { padrao, sufixo = "", bloqueado = false } = opcoes;
  const linhas = kits.map(k => {
    const b = padrao ? padrao.find(x => x.id === k.id) || k : null;
    const f = el("div", "field");
    f.append(el("label", null, k.nome));
    const r = el("div", "row3"),
      ins = {};
    COLUNAS_PRECO.forEach(([q, nomeQ]) => {
      const v = inpReais((k[q] || {}).valor || ""),
        n = inp((k[q] || {}).parcelas || "", "1", 3);
      n.inputMode = "numeric";
      v.setAttribute("aria-label", `${k.nome} · valor ${nomeQ.toLowerCase()}${sufixo}`);
      n.setAttribute("aria-label", `${k.nome} · parcelas ${nomeQ.toLowerCase()}${sufixo}`);
      [v, n].forEach(i => (i.disabled = bloqueado));
      const c = el("div", "field");
      c.append(
        el("small", null, b ? `${nomeQ} (padrão: ${b[q] && Number(b[q].valor) ? textoPreco(b[q]) : "—"})` : nomeQ + ": valor e parcelas"),
        v,
        n
      );
      r.append(c);
      ins[q] = { v, n };
    });
    const info = el("p", "hint");
    const upd = () => {
      info.textContent = COLUNAS_PRECO.map(([q, nomeQ]) => `${nomeQ} ${textoPreco(lerPreco(ins[q].v.value, ins[q].n.value, q))}`).join(
        " · "
      );
    };
    Object.values(ins).forEach(({ v, n }) => [v, n].forEach(i => i.addEventListener("input", upd)));
    upd();
    f.append(r, info);
    p.append(f);
    return { k, b, ins };
  });
  const ler = () =>
    linhas.map(({ k, ins }) => {
      const o = { id: k.id, nome: k.nome };
      COLUNAS_PRECO.forEach(([q]) => (o[q] = lerPreco(ins[q].v.value, ins[q].n.value, q)));
      return o;
    });
  return { linhas, ler };
}

// Tabela da turma: guarda só o que difere da tabela padrão
export function soDiferencas(lidos, padrao) {
  return lidos
    .map(k => {
      const b = padrao.find(x => x.id === k.id) || {},
        o = { id: k.id };
      COLUNAS_PRECO.forEach(([q]) => {
        if (!mesmoPreco(k[q], b[q])) o[q] = k[q];
      });
      return o;
    })
    .filter(o => o.ant || o.pos || o.rep);
}
