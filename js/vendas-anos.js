// Dashboard → PR: "PR por ano das fotos" (só admin). Para cada ano: quantos alunos foram fotografados,
// quantos compraram (inclusive o histórico importado das planilhas antigas: VENDIDO), a conversão
// e quantos ainda estão na fila do Repasse. Usa só contagens no servidor (não baixa os alunos).
// Quem veio da planilha sem nenhum telefone (etapa "SEM TELEFONE") fica FORA das contas:
// aparece só na coluna "Sem telefone" e no quadro por colégio, para a equipe ficar atenta a pegar o número.
import { el } from "./ui.js";
import { chaveColegio } from "./historico-dados.js";

const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
export function prPorAno(corpo, C, caixa, tabela) {
  if (!C.isAdmin) return;
  const box = caixa(
    corpo,
    "PR por ano das fotos",
    "Fotografados × compraram (com o histórico das planilhas antigas). Quem veio sem telefone não entra nas contas."
  );
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
          const [todos, compraram, fila, semTel] = await Promise.all([
            conta(ano),
            conta(ano, FS.where("etapa", "in", ["PAGO", "ENTREGUE"])),
            conta(ano, FS.where("etapa", "==", "NA FILA")),
            conta(ano, FS.where("etapa", "==", "SEM TELEFONE"))
          ]);
          return { a, total: todos - semTel, compraram, fila, semTel, todos };
        })
      );
      espera.remove();
      const soma = k => linhas.reduce((t, x) => t + x[k], 0);
      const linha = (rot, x) => [rot, x.total, x.compraram, pct(x.compraram, x.total), x.fila, `${x.semTel} (${pct(x.semTel, x.todos)})`];
      const todas = linhas.map(x => linha(String(x.a), x));
      if (linhas.length > 1)
        todas.push(
          linha("Geral", {
            total: soma("total"),
            compraram: soma("compraram"),
            fila: soma("fila"),
            semTel: soma("semTel"),
            todos: soma("todos")
          })
        );
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
            "Sem telefone = alunos que vieram da planilha sem nenhum número. Não entram em Fotografados nem na conversão; a % é sobre todos os alunos da planilha daquele ano."
          )
        );
      if (soma("semTel")) await semTelefonePorColegio(corpo, C, caixa, tabela);
    } catch (e) {
      console.warn("[Z7] PR por ano", e);
      espera.textContent = "Não foi possível contar agora.";
    }
  })();
}

// Quantos vieram sem telefone em cada colégio e ano (para cobrar a ficha completa no dia das fotos)
async function semTelefonePorColegio(corpo, C, caixa, tabela) {
  const { FS, db } = C;
  const s = await FS.getDocs(FS.query(FS.collection(db, "repasse"), FS.where("etapa", "==", "SEM TELEFONE"), FS.limit(3000)));
  const m = new Map(),
    anos = new Set();
  s.forEach(d => {
    const x = d.data();
    const esc = String(x.escola || "(sem colégio)").trim();
    const k = chaveColegio(esc) || esc; // "C.M CYRO MONTEIRO" e "CYRO MONTEIRO" são o mesmo colégio
    const a = Number(x.ano) || 0;
    anos.add(a);
    const r = m.get(k) || { esc, ano: a, total: 0, anos: {} };
    if (a >= r.ano) Object.assign(r, { esc, ano: a }); // o nome mais recente
    r.total++;
    r.anos[a] = (r.anos[a] || 0) + 1;
    m.set(k, r);
  });
  const ord = [...anos].sort((a, b) => b - a);
  const box = caixa(corpo, "Sem telefone por colégio", "Alunos que vieram da planilha sem nenhum número, por ano das fotos");
  tabela(
    box,
    ["Colégio", ...ord.map(String), "Total"],
    [...m.values()]
      .sort((a, b) => b.total - a.total || a.esc.localeCompare(b.esc, "pt-BR"))
      .map(r => [r.esc, ...ord.map(a => r.anos[a] || "—"), r.total])
  );
}
