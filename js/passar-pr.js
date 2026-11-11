// "Passar para a equipe" (só admin): dar para alguém da equipe o PR de um colégio num ano (cartão do colégio)
// ou um aluno específico (cartão do aluno no PR). Quem recebe vê os alunos em "A trabalhar", já separados para ele,
// e escolhe quais pôr no "Para hoje" (10/11/2026: antes iam todos para hoje e enchiam também o Para hoje do admin).
import { el, field, sel, sheet, botoes } from "./ui.js";
import * as U from "./util.js";
import { chaveColegio } from "./historico-dados.js";
import { gruposEscolas } from "./escolas-pr.js";

const ANO = () => new Date().getFullYear();
// quem trabalha o PR (Linha de Frente ou Repasse), ativo
export function pessoasPR(C, mods = ["rep", "lf"]) {
  return Object.entries(C.usuarios || {})
    .filter(([, u]) => u && u.ativo !== false && u.papel !== "admin" && (u.modulos || []).some(m => mods.includes(m)))
    .map(([email, u]) => ({ email, nome: u.nome || email }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
const separarPara = (p, ano) => ({
  etapa: "SEPARADO",
  resp: p.nome,
  respEmail: p.email,
  separadoEm: U.todayStr(),
  separadoSeg: ano >= ANO() ? "lf" : "rep",
  followup: null,
  atualizadoEm: new Date().toISOString()
});
function escolherPessoa(C, p, mods) {
  const ps = pessoasPR(C, mods);
  if (!ps.length) {
    p.append(el("p", "wait", "Ninguém da equipe tem este módulo. Libere em Equipe primeiro."));
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
        ? `${alvos.length} aluno${alvos.length > 1 ? "s" : ""} na fila de ${g.rotulo} vão para a pessoa escolhida (entram em "A trabalhar" dela).`
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

// Tela do PR (e da Formatura): passa o colégio e ano escolhido no "Seu lote de hoje" inteiro para alguém da equipe
// (09/11/2026). Na fila: já separado para a pessoa. Em andamento (interessado, prévia, sem resposta…): troca o
// responsável. Pago, entregue, caído, não quer, incompleto e histórico ficam como estão (a venda e a comissão de quem vendeu não mudam).
export function passarGrupo(C, { de, colNome, formatura, aoTerminar }) {
  sheet("📤 Passar o colégio para a equipe", async (p, close) => {
    p.append(el("p", "hint", de.rotulo));
    const pessoa = escolherPessoa(C, p, formatura ? ["formaturas"] : ["rep", "lf"]);
    const info = el("p", "hint", "Contando os alunos…");
    p.append(info, botoes(close, "Passar"));
    const ok = p.querySelector("button[type=submit]");
    ok.disabled = true;
    const { FS, db } = C;
    const col = FS.collection(db, colNome);
    const docs = [];
    try {
      for (let i = 0; i < de.nomes.length; i += 30) {
        const q = await FS.getDocs(FS.query(col, FS.where("escola", "in", de.nomes.slice(i, i + 30)), FS.where("ano", "==", de.ano)));
        q.forEach(d => docs.push(d));
      }
    } catch (e) {
      info.textContent = "Não foi possível ler os alunos agora.";
      return C.handleErr(e);
    }
    const fila = docs.filter(d => !d.data().historico && d.data().etapa === "NA FILA");
    const andando = docs.filter(d => !d.data().historico && ["SEPARADO", "CONTATADO", "INTERESSADO"].includes(d.data().etapa));
    const fora = docs.length - fila.length - andando.length;
    info.textContent =
      `${fila.length} na fila (vão para "A trabalhar" da pessoa) e ${andando.length} em andamento (troca o responsável).` +
      (fora ? ` ${fora} pagos, entregues, caídos ou incompletos ficam como estão.` : "");
    ok.disabled = !(fila.length + andando.length) || !pessoa;
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      const quem = pessoa && pessoa();
      if (!quem) return;
      ok.disabled = true;
      try {
        const agora = new Date().toISOString();
        const tudo = [
          ...fila.map(d => [d, separarPara(quem, de.ano)]),
          ...andando.map(d => [d, { resp: quem.nome, respEmail: quem.email, atualizadoEm: agora }])
        ];
        if (formatura) tudo.forEach(([, patch]) => delete patch.separadoSeg); // a Formatura não usa o ano para a frente
        for (let i = 0; i < tudo.length; i += 400) {
          const b = FS.writeBatch(db);
          tudo.slice(i, i + 400).forEach(([d, patch]) => b.update(d.ref, patch));
          await b.commit();
        }
        U.toast(`${tudo.length} aluno${tudo.length > 1 ? "s" : ""} de ${de.rotulo} passados para ${U.first(quem.nome)} ✅`);
        close();
        if (aoTerminar) aoTerminar();
      } catch (e) {
        ok.disabled = false;
        C.handleErr(e);
      }
    });
  });
}
