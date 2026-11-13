// Lista compacta do PR, Paspatur e Formatura: uma linha por aluno (barra de cor da situação, nome, ID,
// colégio · turma · ano, próximo passo e o selo da situação). Tocar na linha abre a janela do aluno (o.abrir), com
// abas e tudo do aluno. Sem o.abrir (ou nos testes antigos, com window.__z7CartaoNaLista), o cartão abre embaixo.
// Cores: verde entregue · azul pago (entregar) · amarelo interessado · cinza na fila / em contato · vermelho atrasado.
import { el, title } from "./ui.js";

const abertos = new Set();

export function corDe(it, s) {
  const e = it && it.etapa;
  if (e === "ENTREGUE") return "verde";
  if (e === "PAGO") return "azul";
  if (["CAÍDO", "NÃO QUER", "SEM CONTATO"].includes(e)) return "fim";
  if (s === "late") return "vermelho";
  if (e === "INTERESSADO") return "amarelo";
  return "cinza";
}

// it = aluno; o = { card, status, situacao, abrir, selo } (funções do PR; selo: etiqueta ao lado do ID, ex.: Paspatur)
export function linhaCompacta(it, o) {
  const s = o.status(it);
  const box = el("div", "lc-item");
  const l = el("button", "lc-linha lc-" + corDe(it, s));
  l.type = "button";
  const nome = el("div", "lc-nome");
  // o ID vem em cima do nome, um pouco maior: é ele que separa os alunos (padrão de todas as listas)
  if (it.codigo) nome.append(el("span", "lc-id", it.codigo));
  const t = el("b", null, title(it.nome) || "Sem nome");
  nome.append(t);
  const selo = o.selo ? o.selo(it) : "";
  if (selo) {
    const tags = el("span", "lc-tags");
    tags.append(el("span", "tag pas", selo));
    nome.append(tags);
  }
  nome.append(el("small", null, [title(it.escola), [it.curso, it.turma].filter(Boolean).join(" "), it.ano].filter(Boolean).join(" · ")));
  const passo = el("small", "lc-passo" + (s === "late" ? " late" : s === "today" ? " today" : ""), o.situacao(it, s));
  nome.append(passo);
  l.append(nome, el("span", "lc-selo", it.etapa || ""));
  box.append(l);
  let cartao = null;
  const abrir = sim => {
    l.setAttribute("aria-expanded", String(sim));
    if (sim) {
      abertos.add(it.id);
      cartao = o.card(it);
      cartao.classList.add("lc-cartao");
      box.append(cartao);
    } else {
      abertos.delete(it.id);
      if (cartao) cartao.remove();
      cartao = null;
    }
  };
  const naLista = !o.abrir || (typeof window !== "undefined" && window.__z7CartaoNaLista);
  l.onclick = () => (naLista ? abrir(!cartao) : o.abrir(it));
  if (naLista) abrir(abertos.has(it.id));
  else l.setAttribute("aria-haspopup", "dialog");
  return box;
}

// Linha compacta de qualquer lista (Aluguel de becas e as próximas): o mesmo desenho e o mesmo jeito de abrir.
// o = { id, cor, idAluno (ID em cima do nome), titulo, tags: [texto], sub, passo, passoCls ("late" | "today" | ""), selo, card(), abrir() }
export function linhaGenerica(o) {
  const box = el("div", "lc-item");
  const l = el("button", "lc-linha lc-" + (o.cor || "cinza"));
  l.type = "button";
  const nome = el("div", "lc-nome");
  if (o.idAluno) nome.append(el("span", "lc-id", o.idAluno));
  nome.append(el("b", null, o.titulo || "Sem nome"));
  const tags = (o.tags || []).filter(Boolean);
  if (tags.length) {
    const t = el("span", "lc-tags");
    tags.forEach(x => t.append(el("span", "tag id", x)));
    nome.append(t);
  }
  if (o.sub) nome.append(el("small", null, o.sub));
  if (o.passo) nome.append(el("small", "lc-passo" + (o.passoCls ? " " + o.passoCls : ""), o.passo));
  l.append(nome, el("span", "lc-selo", o.selo || ""));
  box.append(l);
  let cartao = null;
  const abrir = sim => {
    l.setAttribute("aria-expanded", String(sim));
    if (sim) {
      abertos.add(o.id);
      cartao = o.card();
      cartao.classList.add("lc-cartao");
      box.append(cartao);
    } else {
      abertos.delete(o.id);
      if (cartao) cartao.remove();
      cartao = null;
    }
  };
  const naLista = !o.abrir || (typeof window !== "undefined" && window.__z7CartaoNaLista);
  l.onclick = () => (naLista ? abrir(!cartao) : o.abrir());
  if (naLista) abrir(abertos.has(o.id));
  else l.setAttribute("aria-haspopup", "dialog");
  return box;
}
