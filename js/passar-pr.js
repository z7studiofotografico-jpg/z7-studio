// "Passar para a equipe" (só admin): dar para alguém da equipe o PR de um colégio num ano (cartão do colégio)
// ou um aluno específico (cartão do aluno no PR). Quem recebe vê os alunos em "Para hoje", já separados para ele.
import { el, field, sel, sheet, botoes } from "./ui.js";
import * as U from "./util.js";
import { chaveColegio } from "./historico-dados.js";
import { gruposEscolas } from "./escolas-pr.js";

const ANO = () => new Date().getFullYear();
// quem trabalha o PR (Linha de Frente ou Repasse), ativo
export function pessoasPR(C) {
  return Object.entries(C.usuarios || {})
    .filter(([, u]) => u && u.ativo !== false && u.papel !== "admin" && (u.modulos || []).some(m => m === "rep" || m === "lf"))
    .map(([email, u]) => ({ email, nome: u.nome || email }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
const separarPara = (p, ano) => ({
  etapa: "SEPARADO",
  resp: p.nome,
  respEmail: p.email,
  separadoEm: U.todayStr(),
  separadoSeg: ano >= ANO() ? "lf" : "rep",
  followup: U.todayStr(),
  atualizadoEm: new Date().toISOString()
});
function escolherPessoa(C, p) {
  const ps = pessoasPR(C);
  if (!ps.length) {
    p.append(el("p", "wait", "Ninguém da equipe tem o PR (Linha de Frente ou Repasse). Libere em Equipe primeiro."));
    return null;
  }
  const s = sel(
    ps.map(x => [x.email, x.nome]),
    ps[0].email
  );
  p.append(field("Para quem", s));
  return () => ps.find(x => x.email === s.value);
}

// Cartão do colégio: escolhe o ano e a pessoa; passa todos os alunos daquele ano que estão na fila
export function passarColegio(C, inst) {
  sheet("📤 Passar o PR para a equipe", async (p, close) => {
    p.append(el("p", "hint", inst.nome));
    const espera = el("p", "hint", "Procurando os alunos deste colégio…");
    p.append(espera);
    const { FS, db } = C;
    const col = FS.collection(db, "repasse");
    let grupos = [];
    try {
      const m = await FS.getDoc(FS.doc(db, "config", "repasse_meta"));
      const k = chaveColegio(inst.nome);
      grupos = gruposEscolas(m.exists() ? m.data() : {}, { [k]: inst.nome }).filter(g => g.chave === k);
    } catch (e) {
      espera.textContent = "Não foi possível ler o PR agora.";
      return;
    }
    espera.remove();
    if (!grupos.length) {
      p.append(
        el("p", "wait", "Nenhum aluno do PR deste colégio (ou a lista por ano ainda não foi atualizada)."),
        U.mkBtn("Fechar", "", close)
      );
      return;
    }
    const sAno = sel(
      grupos.map(g => [g.valor, `${g.ano} · ${g.n} aluno${g.n > 1 ? "s" : ""}`]),
      grupos[0].valor
    );
    p.append(field("Ano das fotos", sAno));
    const pessoa = escolherPessoa(C, p);
    const info = el("p", "hint");
    p.append(info, botoes(close, "Passar"));
    const ok = p.querySelector("button[type=submit]");
    let alvos = [];
    const contar = async () => {
      const g = grupos.find(x => x.valor === sAno.value);
      ok.disabled = true;
      info.textContent = "Contando quem está na fila…";
      const s = await FS.getDocs(
        FS.query(
          col,
          FS.where("escola", "in", g.nomes.slice(0, 30)),
          FS.where("ano", "==", g.ano),
          FS.where("etapa", "==", "NA FILA"),
          FS.limit(1000)
        )
      );
      alvos = s.docs;
      info.textContent = alvos.length
        ? `${alvos.length} aluno${alvos.length > 1 ? "s" : ""} na fila de ${g.rotulo} vão para a pessoa escolhida (entram em "Para hoje" dela).`
        : `Ninguém na fila de ${g.rotulo}: os alunos já foram separados ou compraram.`;
      ok.disabled = !alvos.length || !pessoa;
    };
    sAno.onchange = () => contar().catch(e => C.handleErr(e));
    contar().catch(e => C.handleErr(e));
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const quem = pessoa && pessoa();
      const g = grupos.find(x => x.valor === sAno.value);
      if (!quem || !alvos.length) return;
      ok.disabled = true;
      try {
        for (let i = 0; i < alvos.length; i += 400) {
          const b = FS.writeBatch(db);
          alvos.slice(i, i + 400).forEach(d => b.update(d.ref, separarPara(quem, g.ano)));
          await b.commit();
        }
        U.toast(`${alvos.length} aluno${alvos.length > 1 ? "s" : ""} de ${g.rotulo} passados para ${U.first(quem.nome)} ✅`);
        close();
      } catch (e) {
        ok.disabled = false;
        C.handleErr(e);
      }
    });
  });
}

// Cartão do aluno no PR: passa este aluno para alguém da equipe. salvar(patch, mensagem) grava no aluno.
export function passarAluno(C, it, salvar) {
  sheet("📤 Passar este aluno para a equipe", (p, close) => {
    p.append(el("p", "hint", `${it.nome || ""}${it.escola ? " · " + it.escola : ""}${it.ano ? " · " + it.ano : ""}`));
    const pessoa = escolherPessoa(C, p);
    p.append(botoes(close, "Passar"));
    p.addEventListener("submit", ev => {
      ev.preventDefault();
      const quem = pessoa && pessoa();
      if (!quem) return;
      // na fila (ou sem dono): já separado para a pessoa; em andamento: só troca o responsável
      const patch = ["NA FILA", "SEPARADO"].includes(it.etapa)
        ? separarPara(quem, it.ano || ANO())
        : { resp: quem.nome, respEmail: quem.email, atualizadoEm: new Date().toISOString() };
      salvar(patch, "Passado para " + U.first(quem.nome));
      close();
    });
  });
}
