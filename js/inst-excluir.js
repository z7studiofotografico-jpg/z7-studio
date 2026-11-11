// Excluir instituição (Regra 6 e item 2.1): escolhe só um ANO ou a instituição INTEIRA, mostra antes o que vai ser
// apagado (alunos de Formatura, de PR e de Aluguel, contratos) e oferece "Arquivar" no lugar.
// Admin: apaga de verdade. Equipe: só pede (o Adriano confirma ou devolve). Apaga só o que é deste colégio.
import { el, field, sel, sheet, title } from "./ui.js";
import * as U from "./util.js";
import { anoDaTurma } from "./contrato.js";
import { chaveColegio } from "./historico-dados.js";
import { gruposEscolas } from "./escolas-pr.js";
import { liberar, KINDS_FORMATURA } from "./eventos.js";
import { confirmar, decidir } from "./confirmar.js";

// tudo o que é deste colégio, por módulo e ano: { formandos: [refs], pr: { ano: [refs] }, alugueis: [refs] }
async function levantar(C, it) {
  const { FS, db } = C;
  const out = { formandos: [], pr: {}, alugueis: [], anoTurma: anoDaTurma(it) };
  const q = (col, ...f) => FS.getDocs(FS.query(FS.collection(db, col), ...f, FS.limit(3000)));
  out.formandos = (await q("formandos", FS.where("instId", "==", it.id))).docs;
  try {
    out.alugueis = (
      await q("alugueis", FS.where("instId", "==", it.id), ...(C.isAdmin ? [] : [FS.where("respEmail", "in", ["", C.email])]))
    ).docs;
  } catch (_) {
    out.alugueis = [];
  }
  // PR: alunos ligados pelo nome do colégio (os jeitos de escrever das planilhas viram uma chave só)
  if (C.isAdmin || C.pode("rep")) {
    const m = await FS.getDoc(FS.doc(db, "config", "repasse_meta"));
    const k = chaveColegio(it.nome || "");
    const gr = gruposEscolas(m.exists() ? m.data() : {}).filter(g => g.chave === k);
    for (const g of gr)
      out.pr[g.ano] = (await q("repasse", FS.where("escola", "in", g.nomes.slice(0, 30)), FS.where("ano", "==", g.ano))).docs;
  }
  return out;
}
const anosDe = L => {
  const a = new Set(Object.keys(L.pr).map(Number));
  if (L.anoTurma) a.add(L.anoTurma);
  L.alugueis.forEach(d => d.data().ano && a.add(Number(d.data().ano)));
  return [...a].filter(Boolean).sort((x, y) => y - x);
};
function oQueSai(L, ano) {
  const form = ano ? (L.anoTurma === ano ? L.formandos : []) : L.formandos;
  const pr = ano ? L.pr[ano] || [] : Object.values(L.pr).flat();
  const alu = ano ? L.alugueis.filter(d => Number(d.data().ano) === ano) : L.alugueis;
  return { form, pr, alu };
}
const resumo = (s, inteira) =>
  [
    s.form.length && `${s.form.length} aluno${s.form.length > 1 ? "s" : ""} de Formatura`,
    s.pr.length && `${s.pr.length} aluno${s.pr.length > 1 ? "s" : ""} do PR`,
    s.alu.length && `${s.alu.length} aluguel${s.alu.length > 1 ? "is" : ""} de beca`,
    inteira && "o cadastro do colégio, o contrato e as datas da agenda"
  ]
    .filter(Boolean)
    .join(", ") || "nenhum aluno";

// apaga (admin): o ano ou tudo do colégio, em lotes
export async function apagarInstituicao(C, it, escopo) {
  const { FS, db } = C;
  const L = await levantar(C, it);
  const ano = escopo && escopo.ano ? Number(escopo.ano) : null;
  const s = oQueSai(L, ano);
  const refs = [...s.form, ...s.pr, ...s.alu].map(d => d.ref);
  if (!ano) {
    for (const k of KINDS_FORMATURA) await liberar(it, k);
    await liberar(it, "fotos");
    refs.push(FS.doc(db, "instituicoes", it.id));
  }
  for (let i = 0; i < refs.length; i += 400) {
    const b = FS.writeBatch(db);
    refs.slice(i, i + 400).forEach(r => b.delete(r));
    await b.commit();
  }
  if (ano) await FS.updateDoc(FS.doc(db, "instituicoes", it.id), { excluido: FS.deleteField() }).catch(() => {});
  return refs.length;
}

export function abrirExcluirInst(C, it) {
  sheet(
    "🗑️ Excluir: " + title(it.nome || ""),
    async (p, close) => {
      const info = el("p", "hint", "Contando o que é deste colégio…");
      p.append(info);
      let L;
      try {
        L = await levantar(C, it);
      } catch (e) {
        info.textContent = "Não foi possível contar agora: " + ((e && e.message) || e);
        return;
      }
      const anos = anosDe(L);
      const oQue = sel([["tudo", "A instituição inteira"], ...anos.map(a => ["ano" + a, `Só o ano ${a}`])], "tudo");
      p.append(field("O que excluir", oQue));
      const det = el("p", "wait");
      p.append(det);
      const pinta = () => {
        const ano = oQue.value === "tudo" ? null : Number(oQue.value.slice(3));
        det.textContent = "Vai ser apagado: " + resumo(oQueSai(L, ano), !ano) + ".";
      };
      oQue.onchange = pinta;
      pinta();
      info.textContent = C.isAdmin
        ? "Confira antes. Se for só para tirar da lista, use “Arquivar”: nada é apagado e dá para trazer de volta."
        : "O pedido vai para o Adriano, que confirma ou devolve. Se for só para tirar da lista, use “Arquivar”.";
      const a = el("div", "panel-actions");
      const arq = U.mkBtn(it.arquivado ? "Desarquivar" : "📦 Arquivar", "", async () => {
        try {
          await C.FS.updateDoc(C.FS.doc(C.db, "instituicoes", it.id), {
            arquivado: !it.arquivado,
            arquivadoEm: new Date().toISOString(),
            arquivadoPor: C.me || ""
          });
          U.toast(it.arquivado ? "Desarquivada" : "Arquivada (aparece em “Todas”)");
          close();
        } catch (e) {
          C.handleErr(e);
        }
      });
      const ex = U.mkBtn(C.isAdmin ? "Excluir" : "Pedir exclusão", "btn-danger", async () => {
        const ano = oQue.value === "tudo" ? null : Number(oQue.value.slice(3));
        const s = oQueSai(L, ano);
        const rot = `${title(it.nome || "")}${ano ? " · ano " + ano : " (inteira)"}`;
        if (
          !(await confirmar(
            "Excluir?",
            `${rot}: vai ser apagado ${resumo(s, !ano)}. ${C.isAdmin ? "Não dá para desfazer." : "O Adriano confirma."}`,
            { perigo: true }
          ))
        )
          return;
        try {
          if (C.isAdmin) {
            const n = await apagarInstituicao(C, it, { ano });
            U.toast(`Excluído (${n} registro${n === 1 ? "" : "s"})`);
          } else {
            const pedido = {
              por: C.me || "",
              porEmail: C.email || "",
              em: new Date().toISOString(),
              escopo: ano ? "ano" : "tudo",
              ano: ano || null
            };
            await C.FS.updateDoc(C.FS.doc(C.db, "instituicoes", it.id), { excluido: pedido });
            await C.FS.setDoc(C.FS.doc(C.db, "exclusoes", "instituicoes_" + it.id), {
              col: "instituicoes",
              docId: it.id,
              rotulo: rot,
              resumo: resumo(s, !ano),
              status: "pendente",
              por: pedido.por,
              porEmail: pedido.porEmail,
              em: pedido.em
            });
            U.toast("Pedido de exclusão enviado ao Adriano");
          }
          close();
        } catch (e) {
          C.handleErr(e);
        }
      });
      const can = U.mkBtn("Cancelar", "", close);
      a.append(can, el("span"), arq, ex);
      a.children[1].style.flex = "1";
      p.append(a);
    },
    { div: true }
  );
}
// Faixa da pendência no card (só admin), com o escopo pedido (ano ou inteira)
export function faixaExclusaoInst(C, it) {
  if (!C.isAdmin || !(it.excluido && it.excluido.em)) return null;
  const x = it.excluido;
  const f = el("div", "pend-exclusao");
  f.append(
    el(
      "b",
      null,
      `🗑️ ${U.first(x.por) || "Alguém da equipe"} pediu para excluir ${x.escopo === "ano" ? "o ano " + x.ano : "a instituição inteira"} (${U.fmtDate(String(x.em).slice(0, 10))})`
    )
  );
  const row = el("div", "row");
  row.append(
    U.mkBtn("Confirmar exclusão", "btn-danger", () =>
      decidir(C, "instituicoes", it, true, () => apagarInstituicao(C, it, x.escopo === "ano" ? { ano: x.ano } : null))
    ),
    U.mkBtn("Devolver ao sistema", "btn-ok", () => decidir(C, "instituicoes", it, false))
  );
  f.append(row);
  return f;
}
