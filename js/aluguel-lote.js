// ⏩ Avançar o colégio inteiro (Aluguel de becas, 13/11/2026): quando vamos ao colégio medimos todo mundo, então
// passa todos de uma etapa para a próxima de uma vez (ex.: Cadastrado → Beca medida), sem ir de 1 em 1.
// Só para a frente e uma etapa por vez. Quem não dá para passar (sem tamanho, sem estoque) fica de fora e aparece na lista.
import { el, title, sheet } from "./ui.js";
import * as U from "./util.js";
import { confirmar } from "./confirmar.js";
import { USO, idUso } from "./becas-uso.js";
import { STATUS_ALUGUEL, proximoStatus, anteriorStatus } from "./aluguel-alunos.js";

// as etapas que têm alunos no colégio: [de, para, alunos]
export function etapasDoColegio(alunos, voltar = false) {
  const m = new Map();
  alunos.forEach(a => {
    if (a.naoParticipa) return; // não vai participar da formatura: fica fora
    const de = a.status || "Cadastrado";
    const para = voltar ? anteriorStatus(a) : proximoStatus(a);
    if (!para) return;
    const k = de + "→" + para;
    if (!m.has(k)) m.set(k, [de, para, []]);
    m.get(k)[2].push(a);
  });
  return [...m.values()].sort((x, y) => STATUS_ALUGUEL.indexOf(x[0]) - STATUS_ALUGUEL.indexOf(y[0]));
}

export function avancarColegio(C, alunos, mudarStatus, voltar = false) {
  const etapas = etapasDoColegio(alunos, voltar);
  const nome = title((alunos[0] || {}).instNome || "Colégio");
  sheet(voltar ? "⏪ Voltar o colégio inteiro" : "⏩ Avançar o colégio inteiro", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        `${nome}: escolha a etapa. Todos os alunos dela ${voltar ? "voltam para a anterior" : "passam para a próxima"} de uma vez.`
      )
    );
    if (!etapas.length) {
      p.append(el("p", "empty", voltar ? "Nenhum aluno para voltar." : "Nenhum aluno para avançar."), U.mkBtn("Fechar", "", close));
      return;
    }
    const lista = el("div", "lote-etapas");
    const msg = el("div");
    etapas.forEach(([de, para, als]) => {
      const b = U.mkBtn(`${de} (${als.length}) → ${para}`, "btn-primary", async () => {
        const ok = await confirmar(`${voltar ? "Voltar" : "Passar"} ${als.length} alunos?`, `De “${de}” para “${para}”: ${nome}.`, {
          sim: voltar ? "Sim, voltar todos" : "Sim, passar todos",
          nao: "Não"
        });
        if (!ok) return;
        lista.querySelectorAll("button").forEach(x => (x.disabled = true));
        const pulados = [];
        let feitos = 0;
        for (const a of [...als].sort((x, y) =>
          String(x.codigo || x.nome).localeCompare(String(y.codigo || y.nome), "pt-BR", { numeric: true })
        )) {
          msg.textContent = `Passando ${feitos + pulados.length + 1} de ${als.length}…`;
          const r = await mudarStatus(a, para, true);
          if (r === "ok") feitos++;
          else pulados.push(`${a.codigo ? a.codigo + " · " : ""}${title(a.nome)}: ${r}`);
        }
        msg.textContent = "";
        msg.append(el("p", "notice", `✅ ${feitos} aluno${feitos === 1 ? "" : "s"} em “${para}”.`));
        if (pulados.length) {
          msg.append(el("p", "hint", `⚠️ ${pulados.length} ficaram em “${de}” (abra e acerte cada um):`));
          const ul = el("ul");
          pulados.forEach(t => ul.append(el("li", null, t)));
          msg.append(ul);
        }
      });
      lista.append(b);
    });
    p.append(lista, msg, U.mkBtn("Fechar", "", close));
  });
}

// marca (ou desmarca) quem não vai participar da formatura: fica só com o Paspatur, sem beca reservada
export async function naoParticipa(C, a, sim, salvar) {
  const titulo = sim ? "Não vai participar da formatura?" : "Vai participar da formatura?";
  const texto = sim
    ? `${title(a.nome)} não aluga a beca e fica só com o Paspatur (a beca reservada volta para o estoque).`
    : `${title(a.nome)} volta para Cadastrado, para medir a beca.`;
  if (!(await confirmar(titulo, texto, { sim: "Sim", nao: "Não" }))) return;
  let preco = 0;
  try {
    const c = await C.FS.getDoc(C.FS.doc(C.db, "contratosColegio", `${a.instId}_${Number(a.ano)}`));
    preco = Number(((c.exists() && c.data().precos) || {}).paspatur) || 0;
  } catch (_) {}
  const de = a.status || "Cadastrado";
  const patch = sim
    ? { naoParticipa: true, status: "Cadastrado", pacote: ["paspatur"], valor: preco || a.valor || 0, contratoZerado: false }
    : { naoParticipa: false, status: "Cadastrado" };
  patch.historico = [
    ...(a.historico || []),
    { de, para: sim ? "Não vai participar (só o Paspatur)" : "Vai participar", em: new Date().toISOString(), por: C.me || "" }
  ].slice(-30);
  return salvar(a, patch, sim ? "Marcado: só o Paspatur" : "Voltou para Cadastrado");
}

// apaga os alunos do colégio e ano escolhidos; quem tem beca fora ou produto reservado/baixado fica (para não
// bagunçar o estoque) e o app avisa quantos ficaram
export async function excluirDoColegio(C, lst, ano) {
  const { FS, db } = C;
  const presos = lst.filter(
    a => a.status === "Retirou a beca" || (a.produtos || []).some(p => p.estado === "reservado" || p.estado === "baixado")
  );
  const vai = lst.filter(a => !presos.includes(a));
  if (!vai.length) return U.toast("Todos esses alunos têm beca fora ou produto no estoque: exclua um por um.");
  const ok = await confirmar(
    "Excluir os alunos deste colégio?",
    `Apagar ${vai.length} aluno${vai.length === 1 ? "" : "s"} (${title(lst[0].instNome || "")}, ${ano || "todos os anos"})?` +
      (presos.length ? ` ${presos.length} com beca fora ou produto no estoque ficam (exclua um por um).` : "") +
      " Não dá para desfazer.",
    { perigo: true, sim: "Sim, excluir" }
  );
  if (!ok) return;
  try {
    for (let i = 0; i < vai.length; i += 400) {
      const b = FS.writeBatch(db);
      vai.slice(i, i + 400).forEach(a => {
        b.delete(FS.doc(db, "alugueis", a.id));
        b.delete(FS.doc(db, USO, idUso("aluno", a.id))); // a cópia do estoque
      });
      await b.commit();
    }
    U.toast(`${vai.length} aluno${vai.length === 1 ? "" : "s"} excluído${vai.length === 1 ? "" : "s"} ✅`);
  } catch (e) {
    C.handleErr(e);
  }
}
