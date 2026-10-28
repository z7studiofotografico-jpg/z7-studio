// Dashboard → PR: "PR por ano das fotos" (só admin). Para cada ano: quantos alunos foram fotografados,
// quantos compraram (inclusive o histórico importado das planilhas antigas: VENDIDO), a conversão
// e quantos ainda estão na fila do Repasse. Usa só contagens no servidor (não baixa os alunos).
import { el } from "./ui.js";

const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
export function prPorAno(corpo, C, caixa, tabela) {
  if (!C.isAdmin) return;
  const box = caixa(corpo, "PR por ano das fotos", "Fotografados × compraram (com o histórico das planilhas antigas)");
  const espera = el("p", "hint", "Contando…");
  box.append(espera);
  (async () => {
    const { FS, db } = C;
    const col = FS.collection(db, "repasse");
    const conta = async (...f) => (await FS.getCountFromServer(FS.query(col, ...f))).data().count;
    try {
      const meta = await FS.getDoc(FS.doc(db, "config", "repasse_meta"));
      const anos = Object.keys((meta.exists() && meta.data().anos) || {})
        .map(Number)
        .filter(Boolean)
        .sort((a, b) => b - a);
      const linhas = await Promise.all(
        anos.map(async a => {
          const ano = FS.where("ano", "==", a);
          const [total, compraram, fila, semTel] = await Promise.all([
            conta(ano),
            conta(ano, FS.where("etapa", "in", ["PAGO", "ENTREGUE"])),
            conta(ano, FS.where("etapa", "==", "NA FILA")),
            conta(ano, FS.where("semTelefone", "==", true))
          ]);
          return { a, total, compraram, fila, semTel };
        })
      );
      espera.remove();
      const soma = k => linhas.reduce((t, x) => t + x[k], 0);
      const linha = (rot, x) => [rot, x.total, x.compraram, pct(x.compraram, x.total), x.fila, `${x.semTel} (${pct(x.semTel, x.total)})`];
      const todas = linhas.map(x => linha(String(x.a), x));
      if (linhas.length > 1)
        todas.push(linha("Geral", { total: soma("total"), compraram: soma("compraram"), fila: soma("fila"), semTel: soma("semTel") }));
      tabela(
        box,
        ["Ano das fotos", "Fotografados", "Compraram", "Conversão", "Na fila do Repasse", "Sem telefone"],
        todas,
        "Nenhum ano importado ainda."
      );
      if (linhas.length)
        box.append(
          el(
            "p",
            "hint",
            "Sem telefone = alunos que vieram da planilha sem nenhum número: não entram na fila nem nos Incompletos, só contam aqui."
          )
        );
    } catch (e) {
      console.warn("[Z7] PR por ano", e);
      espera.textContent = "Não foi possível contar agora.";
    }
  })();
}
