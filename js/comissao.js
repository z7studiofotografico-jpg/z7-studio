// Comissão do vendedor: depende da linha (PR ou Formatura) e da forma de pagamento.
// Os percentuais padrão abaixo podem ser mudados em Ajustes (ficam em config/app → comissao).
export const FORMAS = ["Pix", "Cartão", "Recorrente", "Link", "Dinheiro", "Boleto"];
export const PADRAO = {
  pr:   { "Cartão": 20, "Recorrente": 17, "Link": 17, "Dinheiro": 20, "Pix": 20, "Boleto": 9.5 },
  form: { "Cartão": 15, "Recorrente": 13, "Link": 13, "Dinheiro": 15, "Pix": 15, "Boleto": 9.5 }
};
// Converte o texto gravado (inclusive os antigos, como "Cartão (link InfinityPay)") numa das formas
export function formaDe(s){
  const t = String(s || "").toLowerCase();
  if (/recorr/.test(t)) return "Recorrente";
  if (/link|infinit/.test(t)) return "Link";
  if (/cart/.test(t)) return "Cartão";
  if (/pix/.test(t)) return "Pix";
  if (/dinheiro|esp[eé]cie/.test(t)) return "Dinheiro";
  if (/boleto/.test(t)) return "Boleto";
  return "";
}
export function taxa(P, linha, forma){
  const cfg = (P && P.comissao) || {};
  const v = cfg[linha] && cfg[linha][forma];
  return v != null && v !== "" ? Number(v) : (PADRAO[linha] || {})[forma] || 0;
}
