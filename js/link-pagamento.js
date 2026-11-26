// Link de pagamento de um aluno (25/11/2026). Antes, sem o link da prévia, o "💳 Mandar link de pagamento" mandava o
// link fixo da InfinitePay, que não diz quem pagou: a família pagava e o aluno continuava como Provável venda.
// Agora o botão sempre usa a página do aluno no site (z7studio.com.br/previa/?c=…), com as fotos quando houver e o
// botão Pagar. O aviso da InfinitePay chega com o código do aluno e ele vira Pago sozinho.
import * as U from "./util.js";
import { mandarLinkPrevia } from "./link-previa.js";
import { fotosParaLink } from "./fotos-aluno.js";

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

// (26/11/2026) a foto com a ficha nunca vai para o cliente. Nas prévias geradas com a ficha (a 1ª foto de cada aluno),
// tira a 1ª; nas geradas depois que a ficha passou a sair sozinha (o colégio tem fichas guardadas), não há o que tirar.
// E, por garantia, o app procura o papel branco da ficha nas 3 primeiras fotos que sobraram.
async function semFichaAsync(C, it, r) {
  const fotos = (r.fotos || []).slice();
  if (fotos.length < 2) return r;
  let fichaSaiu = false;
  try {
    const s = await C.FS.getDocs(
      C.FS.query(
        C.FS.collection(C.db, "fichas"),
        C.FS.where("escola", "==", it.escola || ""),
        C.FS.where("ano", "==", Number(it.ano) || null),
        C.FS.limit(1)
      )
    );
    fichaSaiu = !s.empty;
  } catch (e) {
    console.warn("[Z7] fichas do colégio", e);
  }
  if (!fichaSaiu) fotos.shift();
  try {
    const { fotoDaFicha } = await import("./fichas.js");
    for (let i = 0; i < Math.min(3, fotos.length); i++) {
      const u = /^https:/.test(fotos[i].id) ? fotos[i].id : "https://z7studio.com.br/previas/" + fotos[i].id + ".jpg";
      const b = await fetch(u).then(x => (x.ok ? x.blob() : null));
      if (b && (await fotoDaFicha(b)).achou) fotos.splice(i--, 1);
    }
  } catch (e) {
    console.warn("[Z7] procurar a ficha nas fotos", e);
  }
  return Object.assign({}, r, { fotos });
}
const semFicha = semFichaAsync;

// o = { tel, precoTxt, cartaoTxt, pixVal, valCartao, parc, salvar(patch, msg) }
export async function mandarLinkPagamento(C, it, o) {
  if (!o.precoTxt || /\[/.test(o.precoTxt)) return U.toast("Cadastre o preço do colégio antes de mandar o link de pagamento.");
  // as fotos da prévia do aluno (as mesmas da janela dele: site ou Drive); sem prévia, a página vai só com o Pagar
  const r = await semFicha(C, it, (await fotosParaLink(C, it)) || { folhas: [], fotos: [] });
  return mandarLinkPrevia(C, it, r, Object.assign({}, o, { semFotos: true, mensagem: codigo => mensagemPagamento(it, codigo, o) }));
}
