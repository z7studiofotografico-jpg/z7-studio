// Venda Antecipada · régua de cobrança (18/11/2026), sem tela (testado em tests/va-regua.test.mjs).
// Cada parcela em aberto passa por lembretes em dias certos, contados do vencimento (dia 05):
//   3 dias antes · no dia · 3 dias depois · 10 dias depois · e depois, de 7 em 7 dias, até pagar.
// O lembrete enviado fica no formando (lembretes: [{ parcela, etapa, em, por }]): o mesmo lembrete não aparece
// de novo, e o que ficou para trás (um dia sem mandar) aparece até ser mandado.
import { vencDa, pagasDe, nParcelas, quitado, ativo, somaDias } from "./regras.js";
import { el } from "./ui.js";

export const ETAPAS = [
  { k: "d-3", dia: -3, txt: "vence em 3 dias" },
  { k: "d0", dia: 0, txt: "vence hoje" },
  { k: "d+3", dia: 3, txt: "3 dias de atraso" },
  { k: "d+10", dia: 10, txt: "10 dias de atraso" }
];
const dias = (de, ate) => {
  const [a, b, c] = de.split("-").map(Number),
    [x, y, z] = ate.split("-").map(Number);
  return Math.round((Date.UTC(x, y - 1, z) - Date.UTC(a, b - 1, c)) / 864e5);
};

// a etapa da régua em que a parcela em aberto está hoje (a última que já chegou), ou null
export function etapaHoje(f, hoje) {
  if (!ativo(f) || quitado(f) || !f.primeiroVenc) return null;
  const parcela = pagasDe(f) + 1;
  if (parcela > nParcelas(f)) return null;
  const venc = vencDa(f, parcela);
  const d = dias(venc, hoje);
  let et = null;
  ETAPAS.forEach(e => {
    if (d >= e.dia) et = e;
  });
  if (d > 10) {
    const n = 10 + Math.floor((d - 10) / 7) * 7;
    if (n > 10) et = { k: "d+" + n, dia: n, txt: `${d} dias de atraso` };
    else et = Object.assign({}, et, { txt: `${d} dias de atraso` });
  }
  if (!et) return null;
  const enviado = (f.lembretes || []).some(l => l.parcela === parcela && l.etapa === et.k);
  return { parcela, venc, atraso: d, etapa: et.k, txt: et.txt, enviado, proxima: proximaEtapa(venc, d) };
}
// o dia do próximo lembrete (para mostrar "próximo lembrete em…")
function proximaEtapa(venc, d) {
  const e = ETAPAS.find(x => x.dia > d);
  if (e) return somaDias(venc, e.dia);
  return somaDias(venc, 10 + (Math.floor((d - 10) / 7) + 1) * 7);
}
// quem precisa de lembrete hoje (etapa chegou e ainda não foi mandado)
export const paraMandarHoje = (lista, hoje) =>
  lista.filter(f => {
    const e = etapaHoje(f, hoje);
    return e && !e.enviado;
  });

// Cobranças (card Formaturas): os botões "📣 Lembretes de hoje" / "Todas do mês" em cima da lista.
// Devolve a lista a mostrar, ou null quando já escreveu o aviso de que hoje não tem lembrete.
export function filtroLembretes(corpo, cob, hoje, soHoje, mudar) {
  if (!cob.length) return cob;
  const deHoje = cob.filter(({ f }) => {
    const e = etapaHoje(f, hoje);
    return e && !e.enviado;
  });
  const fil = el("div", "chips");
  [
    [true, "📣 Lembretes de hoje", deHoje.length],
    [false, "Todas do mês", cob.length]
  ].forEach(([v, t, n]) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.setAttribute("aria-pressed", String(soHoje === v));
    b.append(el("span", "n", String(n)));
    b.onclick = () => mudar(v);
    fil.append(b);
  });
  corpo.append(fil);
  if (!soHoje) return cob;
  if (!deHoje.length) {
    corpo.append(el("div", "empty", "Nenhum lembrete para mandar hoje ✓ (os próximos aparecem sozinhos no dia certo)"));
    return null;
  }
  return deHoje;
}
