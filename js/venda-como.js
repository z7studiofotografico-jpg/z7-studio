// Chave PR / Paspatur do aluno (lista única, 08/11/2026). Qualquer pessoa da equipe troca, com a pergunta
// "Deseja vender como …?"; o preço, as mensagens e a comissão passam a seguir o novo tipo (campo vendaComo).
// Depois de pago, só o admin troca (a venda já registrada continua com o valor gravado).
import { el, title } from "./ui.js";
import * as U from "./util.js";
import { C, vendaDe, NOME_VENDA, precoTxt, save, ehFormatura } from "./repasse-estado.js";

const PAGOS = ["PAGO", "ENTREGUE"];
export const podeTrocar = it => !ehFormatura() && (C.isAdmin || !PAGOS.includes(it.etapa));

// muda o tipo de venda do aluno (com a confirmação); devolve true se trocou
export async function trocarVenda(it, para) {
  if (ehFormatura() || vendaDe(it) === para) return false;
  if (!podeTrocar(it)) {
    U.toast("Já está pago: só o Adriano ou a Luciana podem trocar.");
    return false;
  }
  const de = vendaDe(it);
  const antes = precoTxt(it);
  const depois = precoTxt(Object.assign({}, it, { vendaComo: para }));
  const { confirmar } = await import("./confirmar.js");
  const texto =
    `${U.first(title(it.nome)) || "O aluno"} passa de ${NOME_VENDA[de]} para ${NOME_VENDA[para]}. ` +
    (antes !== depois ? `O valor muda de ${antes} para ${depois}. ` : "") +
    (PAGOS.includes(it.etapa) ? "A venda já registrada continua com o valor gravado." : "As mensagens já saem com o novo valor.");
  if (!(await confirmar(`Deseja vender como ${NOME_VENDA[para]}?`, texto, { sim: "Sim, trocar", nao: "Não" }))) return false;
  await save(it, { vendaComo: para }, `Agora é ${NOME_VENDA[para]}`);
  return true;
}

// a chave na tela: [🖼️ PR] [🎞️ Paspatur]
export function chaveVenda(it, aoTrocar) {
  const box = el("div", "chips venda-como");
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "Vender como");
  box.append(el("small", null, "Vender como:"));
  const pode = podeTrocar(it);
  [
    ["pr", "🖼️ PR"],
    ["paspatur", "🎞️ Paspatur"]
  ].forEach(([k, t]) => {
    const b = el("button", "chip chip-sm", t);
    b.type = "button";
    const sim = vendaDe(it) === k;
    b.setAttribute("aria-pressed", String(sim));
    if (!sim) {
      b.disabled = !pode;
      if (!pode) b.title = "Já está pago: só o Adriano ou a Luciana podem trocar";
      b.onclick = async () => {
        if ((await trocarVenda(it, k)) && aoTrocar) aoTrocar();
      };
    }
    box.append(b);
  });
  return box;
}
