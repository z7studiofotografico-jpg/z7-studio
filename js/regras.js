// Regras de negócio do Z7 Studio, num lugar só. Sem nada de tela: o app (navegador)
// e os scripts do GitHub (lembrete, resumo) importam este mesmo arquivo.
//
// DINHEIRO: as contas são feitas em CENTAVOS inteiros (sem erro de arredondamento).
// No banco o valor continua em reais, sempre com no máximo 2 casas (ex.: 133.34).

// ---------- Dinheiro (real e centavos) ----------
// Lê o que a pessoa digitou no padrão brasileiro e devolve centavos.
// "1.350,50" → 135050 · "1350" → 135000 · "9,5" → 950 · "9.5" → 950 · "41.000" → 4100000 · "R$ 85" → 8500
export function centavos(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) : 0;
  let s = String(v ?? "")
    .trim()
    .replace(/\s|R\$|%/gi, "");
  if (!s) return 0;
  const neg = s.startsWith("-");
  s = s.replace(/^-/, "");
  if (s.includes(","))
    s = s.replace(/\./g, "").replace(",", "."); // vírgula = centavos; pontos = milhar
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // só pontos em grupos de 3 = milhar
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return (neg ? -1 : 1) * Math.round(n * 100);
}
// Centavos → reais (número com no máximo 2 casas, para gravar no banco)
export const reais = c => Math.round(Number(c) || 0) / 100;
// Lê o valor digitado e devolve reais já arredondados ao centavo
export const lerReais = v => reais(centavos(v));
// Formata sempre com centavos: R$ 1.350,50 · R$ 400,00
export function brl(v) {
  const c = Math.round((Number(v) || 0) * 100);
  return "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// Valor digitado num campo → "1.350,50" (completa os centavos). Texto que não é número fica como está.
export function campoReais(v) {
  const t = String(v ?? "").trim();
  if (!t) return "";
  if (!/^-?(R\$)?\s*[\d.,\s]+$/i.test(t) || !/\d/.test(t)) return t;
  return (centavos(t) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// Divide um total em n parcelas sem perder centavo: 400,00 em 3x → [133,34; 133,33; 133,33]
export function dividir(totalReais, n) {
  n = Math.max(1, Math.floor(Number(n) || 1));
  const t = centavos(totalReais),
    base = Math.floor(t / n),
    resto = t - base * n;
  return Array.from({ length: n }, (_, i) => reais(base + (i < resto ? 1 : 0)));
}
// Porcentagem de um valor, em reais arredondados ao centavo (ex.: comissão)
export const pct = (valorReais, p) => reais(Math.round((centavos(valorReais) * (Number(p) || 0)) / 100));
// Soma em centavos e devolve reais
export const somar = lst => reais(lst.reduce((a, v) => a + centavos(v), 0));

// ---------- Datas (texto AAAA-MM-DD, sem fuso) ----------
const p2 = n => String(n).padStart(2, "0");
export const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export function somaDias(dataIso, n) {
  const [y, m, d] = dataIso.split("-").map(Number);
  return iso(new Date(y, m - 1, d + n));
}
export function fimDoMes(dataIso) {
  const [y, m] = dataIso.split("-").map(Number);
  return iso(new Date(y, m, 0));
}
// Mesmo dia, n meses depois; se o mês não tem esse dia (31 em fevereiro), usa o último dia do mês
export function somaMeses(dataIso, n) {
  const [y, m, d] = dataIso.split("-").map(Number);
  const alvo = new Date(y, m - 1 + n, 1),
    ult = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ult));
  return iso(alvo);
}

// ---------- Parcelas (formandos: álbum de formatura e colação de grau) ----------
// Fonte única: a lista de pagamentos [{ data, valor, por }]. "pagas" é só a quantidade dessa lista.
// Registros antigos sem a lista: cada parcela paga conta na data da venda.
export function pagamentosDe(f) {
  if (Array.isArray(f.pagamentos)) return f.pagamentos;
  const n = Math.min(Number(f.pagas) || 0, Number(f.parcelas) || 1),
    vals = dividir(f.valor, f.parcelas);
  return Array.from({ length: n }, (_, i) => ({ data: f.vendidoEm || "", valor: vals[i] }));
}
export const pagasDe = f => pagamentosDe(f).length;
export const nParcelas = f => Math.max(1, Number(f.parcelas) || 1);
export const quitado = f => pagasDe(f) >= nParcelas(f);
export const valorParcela = (f, n) => dividir(f.valor, nParcelas(f))[Math.max(0, Math.min(n, nParcelas(f)) - 1)] || 0;
export const recebido = f => somar(pagamentosDe(f).map(p => p.valor));
export const emAberto = f => reais(centavos(f.valor) - centavos(recebido(f)));
// Vencimento da parcela n (1, 2, 3...): todo mês no mesmo dia do 1º vencimento
export const vencDa = (f, n) => (f.primeiroVenc ? somaMeses(f.primeiroVenc, n - 1) : "");
// Quantas parcelas já venceram (vencimento ANTES de hoje; no dia do vencimento ainda não está atrasada)
export function esperadas(f, hoje) {
  if (!f.primeiroVenc) return 0;
  let k = 0;
  while (k < nParcelas(f) && vencDa(f, k + 1) < hoje) k++;
  return k;
}
// Situação do formando: "ativo" = comprou; "semkit" = ainda não comprou (venda depois das fotos); "desistiu"; "reprovou"
export const SITUACOES = { ativo: "Comprou", semkit: "Ainda não comprou", desistiu: "Desistiu", reprovou: "Reprovou" };
export const ativo = f => !["desistiu", "reprovou", "semkit"].includes(f.status);
export const atrasado = (f, hoje) => ativo(f) && !quitado(f) && esperadas(f, hoje) > pagasDe(f);
// Próximo vencimento em aberto ("" quando quitado ou desistiu): fica gravado para buscas rápidas
export const proxVenc = f => (!ativo(f) || quitado(f) || !f.primeiroVenc ? "" : vencDa(f, pagasDe(f) + 1));
export const ehColacao = f => f.contrato === "colacao";

// ---------- Comissão do vendedor ----------
// PR: sobre a venda. Álbum de formatura e colação de grau: sobre cada parcela paga.
export const FORMAS = ["Pix", "Cartão", "Link", "Recorrente", "Dinheiro", "Boleto"];
export const COMISSAO_PADRAO = {
  pr: { Cartão: 20, Recorrente: 17, Link: 17, Dinheiro: 20, Pix: 20, Boleto: 9.5 },
  form: { Cartão: 15, Recorrente: 13, Link: 13, Dinheiro: 15, Pix: 15, Boleto: 9.5 },
  colacao: 20
};
export function formaDe(s) {
  const t = String(s || "").toLowerCase();
  if (/recorr/.test(t)) return "Recorrente";
  if (/link|infinit/.test(t)) return "Link";
  if (/cart/.test(t)) return "Cartão";
  if (/pix/.test(t)) return "Pix";
  if (/dinheiro|esp[eé]cie/.test(t)) return "Dinheiro";
  if (/boleto/.test(t)) return "Boleto";
  return "";
}
export function taxa(P, linha, forma) {
  const cfg = (P && P.comissao) || {};
  if (linha === "colacao") return cfg.colacao != null && cfg.colacao !== "" ? Number(cfg.colacao) : COMISSAO_PADRAO.colacao;
  const v = cfg[linha] && cfg[linha][forma];
  return v != null && v !== "" ? Number(v) : (COMISSAO_PADRAO[linha] || {})[forma] || 0;
}

// ---------- Status (evita erro de digitação espalhado) ----------
export const LEAD = { FECHADO: "FECHADO", PERDIDO: "PERDIDO" };
export const INST = { FECHADO: "FECHADO", NAO_FECHOU: "NÃO FECHOU", AGENDAR_VISITA: "AGENDAR VISITA" };
export const PR = { PAGO: "PAGO", ENTREGUE: "ENTREGUE" };
export const AGENDA = { PENDENTE: "pendente", CONFIRMADO: "confirmado", RECUSADO: "recusado" };
export const BECA = { RESERVADO: "reservado", RETIRADO: "retirado", DEVOLVIDO: "devolvido", CANCELADO: "cancelado" };
export const ENSAIO = { ANALISAR: "analisar", REMARCAR: "remarcar", CONFIRMADO: "confirmado", FALTOU: "faltou" };
