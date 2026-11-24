// ⏩ Avançar o colégio inteiro (Aluguel de becas, 13/11/2026): quando vamos ao colégio medimos todo mundo, então
// passa todos de uma etapa para a próxima de uma vez (ex.: Cadastrado → Beca medida), sem ir de 1 em 1.
// Só para a frente e uma etapa por vez. Quem não dá para passar (sem tamanho, sem estoque) fica de fora e aparece na lista.
import { el, title, sheet } from "./ui.js";
import * as U from "./util.js";
import { confirmar } from "./confirmar.js";
import { USO, idUso } from "./becas-uso.js";
import { STATUS_ALUGUEL, proximoStatus, anteriorStatus, faltaNoDia } from "./aluguel-alunos.js";

// as etapas que têm alunos no colégio: [de, para, alunos]
export function etapasDoColegio(alunos, voltar = false) {
  const m = new Map();
  alunos.forEach(a => {
    if (a.naoParticipa) return; // não vai participar da formatura: fica fora
    const st = a.status || "Cadastrado";
    const para = voltar ? anteriorStatus(a) : proximoStatus(a);
    if (!para) return;
    // quem é só do Paspatur aparece separado (vai direto para a produção)
    const de = a.soPaspatur && st === "Cadastrado" ? "Só o Paspatur" : st;
    const k = de + "→" + para;
    if (!m.has(k)) m.set(k, [de, para, []]);
    m.get(k)[2].push(a);
  });
  const ordem = x => (x === "Só o Paspatur" ? 0.5 : STATUS_ALUGUEL.indexOf(x));
  return [...m.values()].sort((x, y) => ordem(x[0]) - ordem(y[0]));
}

export function avancarColegio(C, alunos, mudarStatus, voltar = false, abrirEstoque = null) {
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
    // 17/11/2026: Cadastrado → Só o Paspatur (o colégio inteiro, ou quem ainda está em Cadastrado); avançando de
    // novo, eles vão para a produção
    const paraPas = voltar ? [] : alunos.filter(a => !a.naoParticipa && !a.soPaspatur && (a.status || "Cadastrado") === "Cadastrado");
    if (paraPas.length) {
      const b = U.mkBtn(`Cadastrado (${paraPas.length}) → Só o Paspatur`, "btn-amarelo", async () => {
        const ok = await confirmar(
          `Passar ${paraPas.length} alunos para Só o Paspatur?`,
          `${nome}: ficam só com o Paspatur, sem beca. Avançando de novo, vão para a produção.`,
          { sim: "Sim, passar todos", nao: "Não" }
        );
        if (!ok) return;
        lista.querySelectorAll("button").forEach(x => (x.disabled = true));
        let feitos = 0;
        for (const a of paraPas) {
          msg.textContent = `Passando ${feitos + 1} de ${paraPas.length}…`;
          try {
            await C.FS.updateDoc(C.FS.doc(C.db, "alugueis", a.id), await patchParticipacao(C, a, "paspatur"));
            feitos++;
          } catch (e) {
            console.warn("[Z7] só o paspatur", e);
          }
        }
        msg.textContent = "";
        msg.append(
          el("p", "notice", `✅ ${feitos} aluno${feitos === 1 ? "" : "s"} em “Só o Paspatur”. Para mandar para a produção, avance de novo.`)
        );
      });
      lista.append(b);
    }
    etapas.forEach(([de, para, als]) => {
      const b = U.mkBtn(`${de} (${als.length}) → ${para}`, "btn-primary", async () => {
        const ok = await confirmar(`${voltar ? "Voltar" : "Passar"} ${als.length} alunos?`, `De “${de}” para “${para}”: ${nome}.`, {
          sim: voltar ? "Sim, voltar todos" : "Sim, passar todos",
          nao: "Não"
        });
        if (!ok) return;
        if (
          para === "Produtos em produção" &&
          !(await confirmar("As fotos já foram tiradas?", `Os ${als.length} alunos vão para a produção. As fotos deles já foram tiradas?`, {
            sim: "Sim, já tiramos",
            nao: "Ainda não"
          }))
        )
          return U.toast("Tire as fotos antes de mandar para a produção.");
        lista.querySelectorAll("button").forEach(x => (x.disabled = true));
        const pulados = [];
        const travados = []; // (24/11/2026) sem estoque no dia: para sugerir a troca de tamanho
        let feitos = 0;
        for (const a of [...als].sort((x, y) =>
          String(x.codigo || x.nome).localeCompare(String(y.codigo || y.nome), "pt-BR", { numeric: true })
        )) {
          msg.textContent = `Passando ${feitos + pulados.length + 1} de ${als.length}…`;
          const r = await mudarStatus(a, para, true);
          // (24/11/2026) a próxima conta do estoque já vê este aluno reservado (sem esperar a lista atualizar):
          // antes, no "Avançar o colégio inteiro", dois alunos podiam pegar a última beca do mesmo tamanho
          if (r === "ok") a.status = para;
          if (r === "ok") feitos++;
          else pulados.push(`${a.codigo ? a.codigo + " · " : ""}${title(a.nome)}: ${r}`);
          if (/^sem estoque/.test(String(r))) travados.push(a);
        }
        msg.textContent = "";
        msg.append(el("p", "notice", `✅ ${feitos} aluno${feitos === 1 ? "" : "s"} em “${para}”.`));
        if (pulados.length) {
          msg.append(el("p", "hint", `⚠️ ${pulados.length} ficaram em “${de}” (abra e acerte cada um):`));
          const ul = el("ul");
          pulados.forEach(t => ul.append(el("li", null, t)));
          msg.append(ul);
          // (24/11/2026) o estoque é o limite: sugere o tamanho mais perto com beca livre e troca com um toque
          if (travados.length) await sugerirTrocas(C, travados, para, mudarStatus, msg);
          // (23/11/2026) travou por estoque: leva direto para o estoque daquele dia
          const sem = pulados.find(t => /sem estoque no dia (\d\d)\/(\d\d)/.test(t));
          if (sem && abrirEstoque) {
            const [, dd, mm] = sem.match(/sem estoque no dia (\d\d)\/(\d\d)/);
            const ano = String((alunos[0] || {}).ano || new Date().getFullYear());
            msg.append(
              el("p", "notice", "Alguns travaram por falta de beca no dia. Quer ver o estoque desse dia para entender?"),
              U.mkBtn("📦 Abrir o estoque do dia " + dd + "/" + mm, "btn-primary", () => {
                close();
                abrirEstoque(`${ano}-${mm}-${dd}`, `${pulados.length} aluno(s) de ${nome} travaram por falta de estoque.`);
              })
            );
          }
        }
      });
      lista.append(b);
    });
    p.append(lista, msg, U.mkBtn("Fechar", "", close));
  });
}

// (23/11/2026) janela "sem estoque nesse dia" com o botão para abrir o estoque daquele dia
// a lista de trocas sugeridas (um de cada vez, para cada troca já contar na próxima) e o botão de trocar todas
async function sugerirTrocas(C, travados, para, mudarStatus, msg) {
  const T = await import("./aluguel-troca.js");
  const sug = [];
  for (const a of travados) {
    const z = T.sugerirTamanho(a, faltaNoDia);
    if (z) sug.push([a, z]);
  }
  if (!sug.length) return msg.append(el("p", "hint", "Não tem outro tamanho livre nessa beca: acerte o estoque ou troque a beca."));
  const ul = el("ul");
  sug.forEach(([a, z]) => ul.append(el("li", null, `${a.codigo ? a.codigo + " · " : ""}${title(a.nome)}: ${a.tamanho} → ${z}`)));
  const btn = U.mkBtn(`🔁 Trocar o tamanho de ${sug.length} e avançar`, "btn-primary", async () => {
    btn.disabled = true;
    let ok = 0;
    const nao = [];
    // um por vez: a sugestão é refeita na hora, já com as trocas anteriores contando no estoque
    for (const [a] of sug) {
      const z = T.sugerirTamanho(a, faltaNoDia);
      const r = z ? await T.trocarEAvancar(C, a, z, para, mudarStatus) : "sem tamanho livre";
      if (r === "ok") ok++;
      else nao.push(`${title(a.nome)}: ${r}`);
    }
    msg.append(el("p", "notice", `✅ ${ok} trocado${ok === 1 ? "" : "s"} de tamanho e em “${para}”.` + (nao.length ? ` Ficaram: ${nao.join("; ")}` : "")));
  });
  msg.append(el("p", "notice", "💡 O estoque é o limite. Sugestão de troca de tamanho (o mais perto com beca livre):"), ul, btn);
}
export async function avisoSemEstoque(dia, falta, abrirEstoque, a = null, para = "", C = null) {
  const txt = `No dia ${dia.slice(8, 10)}/${dia.slice(5, 7)} não tem livre: ${falta.join(", ")}.`;
  // (24/11/2026) o estoque é o limite: sugere o tamanho mais perto que tem livre e troca com um toque
  const T = a && para && C ? await import("./aluguel-troca.js") : null;
  const z = T ? T.sugerirTamanho(a, faltaNoDia) : "";
  if (z) {
    const sim = await confirmar("Sem estoque nesse dia", `${txt} Tem ${z} livre: trocar ${title(a.nome)} de ${a.tamanho} para ${z}?`, {
      sim: `🔁 Trocar para ${z}`,
      nao: "Não trocar"
    });
    if (!sim) return;
    const { mudarStatus } = await import("./aluguel-alunos.js");
    const r = await T.trocarEAvancar(C, a, z, para, mudarStatus);
    return U.toast(r === "ok" ? `Trocado para ${z} e reservado ✅` : String(r));
  }
  const ver = await confirmar("Sem estoque nesse dia", txt + " Quer abrir o estoque para ver o que está acontecendo?", {
    sim: "📦 Abrir o estoque",
    nao: "Fechar"
  });
  if (ver && abrirEstoque) abrirEstoque(dia, txt);
}

// Não vai participar (fez a foto, não vai à formatura) · Só o Paspatur (os pais só querem o Paspatur) · Vai participar
// (aluga a beca). Os dois primeiros não reservam beca; a beca reservada volta para o estoque.
const MODOS = {
  nao: ["Não vai participar da formatura?", "não vai à formatura: fica sem kit (se depois quiser o Paspatur, toque em Só o Paspatur)."],
  paspatur: ["Só o Paspatur?", "fica só com o Paspatur, sem beca: vai direto para a produção quando avançar."],
  vai: ["Vai participar da formatura?", "volta para Cadastrado, para medir a beca."]
};
export async function participacao(C, a, modo, salvar) {
  const [titulo, texto] = MODOS[modo];
  if (!(await confirmar(titulo, `${title(a.nome)} ${texto}`, { sim: "Sim", nao: "Não" }))) return;
  const nome = { nao: "Não vai participar", paspatur: "Só o Paspatur", vai: "Vai participar" }[modo];
  return salvar(a, await patchParticipacao(C, a, modo), "Marcado: " + nome);
}
// os preços do contrato do colégio (guardados enquanto o app está aberto: o lote não lê de novo para cada aluno)
const precosContrato = new Map();
async function precosDe(C, a) {
  const k = `${a.instId}_${Number(a.ano)}`;
  if (!precosContrato.has(k))
    precosContrato.set(
      k,
      C.FS.getDoc(C.FS.doc(C.db, "contratosColegio", k))
        .then(c => (c.exists() && c.data().precos) || {})
        .catch(() => ({}))
    );
  return precosContrato.get(k);
}
export async function patchParticipacao(C, a, modo) {
  const pr = await precosDe(C, a);
  const de = a.status || "Cadastrado";
  const vPas = Number(pr.paspatur) || 0;
  const patch =
    modo === "nao"
      ? { naoParticipa: true, soPaspatur: false, status: "Cadastrado", pacote: [], valor: 0, contratoZerado: true }
      : modo === "paspatur"
        ? { naoParticipa: false, soPaspatur: true, status: "Cadastrado", pacote: ["paspatur"], valor: vPas, contratoZerado: !vPas }
        : { naoParticipa: false, soPaspatur: false, status: "Cadastrado" };
  const nome = { nao: "Não vai participar", paspatur: "Só o Paspatur", vai: "Vai participar" }[modo];
  patch.historico = [...(a.historico || []), { de, para: nome, em: new Date().toISOString(), por: C.me || "" }].slice(-30);
  return patch;
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
