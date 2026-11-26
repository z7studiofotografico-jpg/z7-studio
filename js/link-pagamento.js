// Link de pagamento de um aluno (25/11/2026). Antes, sem o link da prévia, o "💳 Mandar link de pagamento" mandava o
// link fixo da InfinitePay, que não diz quem pagou: a família pagava e o aluno continuava como Provável venda.
// Agora o botão sempre usa a página do aluno no site (z7studio.com.br/previa/?c=…), com as fotos quando houver e o
// botão Pagar. O aviso da InfinitePay chega com o código do aluno e ele vira Pago sozinho.
import * as U from "./util.js";
import { mandarLinkPrevia } from "./link-previa.js";
import { fotosDoAlunoNoSite } from "./site-previas.js";

export function mensagemPagamento(it, codigo, o = {}) {
  const valores = [o.pixVal ? U.money(o.pixVal) + " no Pix" : "", o.valCartao ? U.money(o.valCartao) + " no cartão, " + o.parc : ""]
    .filter(Boolean)
    .join(" ou ");
  return (
    `Para pagar, é só abrir este link e tocar em *Pagar*${valores ? ` (${valores})` : ""}:\n` +
    `https://z7studio.com.br/previa/?c=${codigo}\n` +
    "O pagamento é pela InfinitePay, seguro, e a confirmação chega para a gente na hora 😊"
  );
}

// o = { tel, precoTxt, cartaoTxt, pixVal, valCartao, parc, salvar(patch, msg) }
export async function mandarLinkPagamento(C, it, o) {
  if (!o.precoTxt || /\[/.test(o.precoTxt)) return U.toast("Cadastre o preço do colégio antes de mandar o link de pagamento.");
  const r = (await fotosDoAlunoNoSite(C, it)) || { folhas: [], fotos: [] };
  return mandarLinkPrevia(C, it, r, Object.assign({}, o, { semFotos: true, mensagem: codigo => mensagemPagamento(it, codigo, o) }));
}
