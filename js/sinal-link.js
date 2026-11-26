// Sinal do ensaio pelo link do cliente (25/11/2026). Antes era um Pix Copia e Cola fixo: o cliente pagava e ninguém
// sabia de quem era. Agora o botão cria um link da InfinitePay só deste lead (Pix ou cartão). Quando ele paga, o
// app (ou o robô do GitHub, a cada 10 min) acha o lead pelo código e o marca como Fechado, com o sinal pago.
import * as U from "./util.js";
import { API_SITE } from "./site-previas.js";
import { codigoNovo } from "./link-previa.js";
import { noComputador, abrirWhatsAppWeb } from "./enviar-computador.js";

export const mensagemSinal = (valor, url) =>
  `Para reservar a data, o sinal é de ${U.money(valor)}. É só abrir este link e pagar no Pix ou no cartão:\n${url}\n` +
  "O pagamento é pela InfinitePay, seguro, e a confirmação chega para a gente na hora 😊";

// l = lead; o = { tel (só dígitos, com 55), valor (reais), salvar(patch, msg) }
export async function mandarLinkSinal(C, l, o) {
  const valor = Number(o.valor) || 0;
  if (valor < 1) return U.toast("Cadastre o valor do sinal nos Ajustes.");
  const codigo = l.linkSinal || codigoNovo();
  const f = new FormData();
  f.append("c", codigo);
  f.append("valor", String(Math.round(valor * 100)));
  f.append("desc", ("Sinal do ensaio · " + (l.nome || "")).slice(0, 120));
  const t = C.token ? await C.token() : "";
  const r = await fetch(API_SITE + "/cobrar.php", { method: "POST", body: f, headers: { Authorization: "Bearer " + t } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(j.erro || "Não consegui criar o link do sinal (" + r.status + ").");
  if (!l.linkSinal && o.salvar) await o.salvar({ linkSinal: codigo }, "Link do sinal criado");
  const texto = mensagemSinal(valor, j.url);
  try {
    await navigator.clipboard.writeText(texto);
  } catch (_) {
    // sem área de transferência: a mensagem já vai escrita no WhatsApp
  }
  const tel = U.digits(o.tel || "");
  if (noComputador()) abrirWhatsAppWeb(tel, texto);
  else window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  U.toast("Link do sinal na mensagem do WhatsApp (e copiado) ✅");
  return codigo;
}
