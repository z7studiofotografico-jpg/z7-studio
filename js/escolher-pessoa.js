// "👥 Representantes" (11/11/2026): um botão só, em vez de um botão para cada pessoa. Ao tocar, a lista de quem tem
// alguma coisa (com quantos), e a escolhida abre. Usado no PR/Paspatur/Formatura e nas Instituições.
import { el, sheet, title } from "./ui.js";
import * as U from "./util.js";

// o texto do botão: "👥 Representantes (23)" ou, com alguém aberto, "👥 Roberto (19) ▾"
export function rotuloRepresentantes(pessoas, aberta) {
  if (aberta && aberta.email) {
    const p = pessoas.find(x => x.email === aberta.email);
    return `👥 ${U.first(title(aberta.nome || aberta.email))}${p ? ` (${p.n})` : ""} ▾`;
  }
  const total = pessoas.reduce((t, p) => t + (Number(p.n) || 0), 0);
  return `👥 Representantes${pessoas.length ? ` (${total})` : ""}`;
}
// pessoas = [{ email, nome, n }]; escolher(p) recebe { email, nome }; sair() (opcional) volta para a lista normal
export function escolherRepresentante(pessoas, aberta, escolher, o = {}) {
  sheet(
    "👥 Representantes",
    (p, close) => {
      if (!pessoas.length) p.append(el("p", "hint", o.vazio || "Ninguém da equipe com alguma coisa em andamento aqui."));
      else if (o.dica) p.append(el("p", "hint", o.dica));
      const lst = el("div", "chips");
      pessoas.forEach(x => {
        const b = el("button", "chip chip-pessoa", `${title(x.nome || x.email)} (${x.n})`);
        b.type = "button";
        b.setAttribute("aria-pressed", String(!!aberta && aberta.email === x.email));
        b.onclick = () => {
          close();
          escolher({ email: x.email, nome: x.nome });
        };
        lst.append(b);
      });
      p.append(lst);
      const acoes = el("div", "actions");
      if (aberta && aberta.email && o.sair)
        acoes.append(
          U.mkBtn("Ver todos de novo", "", () => {
            close();
            o.sair();
          })
        );
      acoes.append(U.mkBtn("Fechar", "", close));
      p.append(acoes);
    },
    { div: true }
  );
}
