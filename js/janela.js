// Janela com abas (o mesmo formato da janela do aluno do PR e da janela do colégio), para qualquer lista.
// o = { C, colecao, item, topo(it) → { titulo, sub, selo }, abas: [[chave, nome, desenhar(box, it, fechar)]], lembrar }
// Ouve o documento no banco: o que mudar (aqui ou em outro aparelho) aparece na hora.
import { el, sheet } from "./ui.js";
import * as U from "./util.js";

const ultimaAba = {};

export function abrirJanela(o) {
  let it = o.item;
  let unsub = null;
  const chave = o.lembrar || o.colecao;
  let aba = ultimaAba[chave] && o.abas.some(a => a[0] === ultimaAba[chave]) ? ultimaAba[chave] : o.abas[0][0];
  sheet(
    null,
    (p, close) => {
      p.classList.add("janela-aluno");
      const topo = el("div", "ja-topo");
      const abas = el("div", "ja-abas");
      abas.setAttribute("role", "tablist");
      const corpo = el("div", "ja-corpo");
      p.append(topo, abas, corpo);
      const desenhar = () => {
        const t = o.topo(it);
        topo.innerHTML = "";
        const nome = el("div", "ja-nome");
        nome.append(el("h2", null, t.titulo || "Sem nome"));
        if (t.sub) nome.append(el("small", null, t.sub));
        topo.append(U.mkBtn("‹ Voltar para a lista", "btn-sm", close), nome, el("span", "lc-selo ja-selo", t.selo || ""));
        abas.innerHTML = "";
        o.abas.forEach(([k, nm]) => {
          const b = el("button", "chip", nm);
          b.type = "button";
          b.setAttribute("role", "tab");
          b.setAttribute("aria-selected", String(aba === k));
          b.setAttribute("aria-pressed", String(aba === k));
          b.onclick = () => {
            aba = ultimaAba[chave] = k;
            desenhar();
          };
          abas.append(b);
        });
        corpo.innerHTML = "";
        o.abas.find(a => a[0] === aba)[2](corpo, it, close);
      };
      desenhar();
      try {
        unsub = o.C.FS.onSnapshot(
          o.C.FS.doc(o.C.db, o.colecao, it.id),
          s => {
            if (!s.exists()) return close();
            it = Object.assign({ id: s.id }, s.data());
            // não redesenha enquanto a pessoa escreve
            const ativo = document.activeElement;
            if (ativo && corpo.contains(ativo) && /INPUT|TEXTAREA|SELECT/.test(ativo.tagName)) return;
            desenhar();
          },
          () => {}
        );
      } catch (_) {}
    },
    { div: true, wide: true, onClose: () => unsub && unsub() }
  );
}
