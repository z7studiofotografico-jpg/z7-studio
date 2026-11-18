// Venda Antecipada → Linha de Frente (18/11/2026): quem não comprou kit de fotos (só o Kit 01, ou ainda nada) vai
// para a Linha de Frente só quando o Adriano/Luciana mandar (botão na turma), normalmente depois da formatura.
// Até lá fica na Venda Antecipada. O aluno mandado fica marcado (lfEnviadoEm) e não vai de novo.
import { el, title, sheet, botoes } from "./ui.js";
import * as U from "./util.js";
import { codigoBusca } from "./aluno-id.js";

// formando → aluno da Linha de Frente (o mesmo formato do "+ Aluno" da Formatura)
export function docLinhaDeFrente(f, inst, ano, agora) {
  const contatos = (f.contatos && f.contatos.length ? f.contatos : f.tel ? [{ tipo: "Formando", nome: f.nome, tel: f.tel }] : []).map(
    c => ({ tipo: c.tipo, nome: c.nome || "", tel: c.tel })
  );
  return {
    nome: f.nome,
    nomeBusca: U.chave(f.nome),
    escola: inst.nome || f.instNome || "",
    instId: inst.id,
    ano,
    codigo: f.codigo || "",
    codigoBusca: codigoBusca(f.codigo || ""),
    curso: "",
    turma: f.serie || "",
    sala: f.sala || "",
    responsavel: f.responsavel || "",
    contatos,
    telefones: contatos.map(c => c.tel),
    dataEnsaio: "",
    endereco: f.endereco || {},
    obs: f.kit ? `Venda Antecipada: ${String(f.kit).split(" · ")[0]}` : "Venda Antecipada: ainda não comprou",
    etapa: contatos.length ? "NA FILA" : "INCOMPLETO",
    followup: null,
    tentativas: 0,
    tentInteresse: 0,
    resp: "",
    respEmail: "",
    seg: ano >= new Date().getFullYear() ? "lf" : "rep",
    vaFormandoId: f.id,
    importadoEm: agora,
    atualizadoEm: agora,
    incluidoPor: ""
  };
}

// candidatos = formandos da turma que podem ir (candidatosPosFoto), ainda não mandados
export function mandarParaLF(C, inst, candidatos, depois = () => {}) {
  const { FS, db } = C;
  const l = candidatos.filter(f => !f.lfEnviadoEm);
  sheet("Mandar para a Linha de Frente", (p, close) => {
    p.append(
      el(
        "p",
        "hint",
        `${l.length} aluno${l.length === 1 ? "" : "s"} de ${title(inst.nome)} sem kit de fotos (só o Kit 01, ou ainda nada) vão para a Linha de Frente, para a venda depois das fotos. Na Venda Antecipada eles continuam, com o que falta pagar do Kit 01.`
      )
    );
    const ul = el("div", "notes");
    l.forEach(f => ul.append(el("div", null, `${f.codigo ? f.codigo + " · " : ""}${title(f.nome)}`)));
    p.append(ul);
    const a = botoes(close, `Mandar ${l.length}`);
    p.append(a);
    p.addEventListener("submit", async ev => {
      ev.preventDefault();
      a.ok.disabled = true;
      try {
        const agora = new Date().toISOString();
        const { docId } = await import("./repasse-dados.js");
        const ano = Number((l.find(f => f.ano) || {}).ano) || new Date().getFullYear();
        for (let i = 0; i < l.length; i += 200) {
          const b = FS.writeBatch(db);
          l.slice(i, i + 200).forEach((f, k) => {
            const d = Object.assign(docLinhaDeFrente(f, inst, ano, agora), { incluidoPor: C.email || "" });
            b.set(FS.doc(db, "formaturaAlunos", docId(d, i + k)), d, { merge: true });
            b.update(FS.doc(db, "formandos", f.id), { lfEnviadoEm: agora, atualizadoEm: agora });
          });
          await b.commit();
        }
        close();
        U.toast(`${l.length} na Linha de Frente`);
        depois();
      } catch (e) {
        a.ok.disabled = false;
        C.handleErr(e);
      }
    });
  });
}
