// Aluguel de becas → 🖨️ Relatório: antes de gerar, a pessoa escolhe ano, colégio, turma e situação, e se a lista sai
// separada por colégio ou por colégio e turma.
import { title } from "./ui.js";
import * as U from "./util.js";
import { ocultoParaMim } from "./confirmar.js";
import { nomeFaixa, nomeCapelo, usoDosAlunos, tamanhoBeca, idadeBeca, TAMANHOS } from "./becas-estoque.js";
import { pedirFiltros } from "./relatorio.js";
import { contatoRel, ordemCodigo } from "./aluno-id.js";
import { pacoteDoAluno, nomeItem } from "./contrato-colegio-regras.js";

export const atrasadoAluguel = (a, hoje = U.todayStr()) => a.status === "Retirou a beca" && !!a.devolucao && a.devolucao < hoje;

// Relatório: antes de gerar, escolhe ano, colégio, turma, situação e se separa por colégio ou por turma
const SIT_REL = [
  ["", "todas"],
  ["andamento", "em andamento"],
  ["atrasados", "atrasados na devolução"],
  ["Cadastrado", "cadastrado"],
  ["Beca medida", "beca medida"],
  ["Pronto para retirada", "pronto para retirada"],
  ["Retirou a beca", "retirou a beca"],
  ["Devolvida", "devolvida"]
];
export function filtrarRelatorio(arr, f, hoje = U.todayStr()) {
  return arr.filter(
    a =>
      (!f.ano || String(a.ano) === String(f.ano)) &&
      (!f.inst || a.instId === f.inst) &&
      (!f.turma || (a.serie || "") === f.turma) &&
      (!f.sit ||
        (f.sit === "atrasados"
          ? atrasadoAluguel(a, hoje)
          : f.sit === "andamento"
            ? (a.status || "Cadastrado") !== "Devolvida"
            : (a.status || "Cadastrado") === f.sit))
  );
}
export async function relatorioAluguel(C, lista, filtro) {
  const base = lista.filter(a => !ocultoParaMim(C, a));
  const unicos = xs => [...new Set(xs.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));
  const f = await pedirFiltros("🖨️ Relatório do Aluguel de becas", [
    {
      k: "ano",
      rotulo: "Ano",
      vazio: "todos os anos",
      padrao: filtro.ano,
      opcoes: () => unicos(base.map(a => String(a.ano || ""))).map(x => [x, x])
    },
    {
      k: "inst",
      rotulo: "Colégio",
      vazio: "todos os colégios",
      padrao: filtro.inst,
      opcoes: v => {
        const m = {};
        base.filter(a => !v.ano || String(a.ano) === v.ano).forEach(a => a.instId && (m[a.instId] = title(a.instNome || "")));
        return Object.entries(m).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
      }
    },
    {
      k: "turma",
      rotulo: "Turma",
      vazio: "todas as turmas",
      opcoes: v => unicos(filtrarRelatorio(base, { ano: v.ano, inst: v.inst }).map(a => a.serie || "")).map(x => [x, x])
    },
    { k: "sit", rotulo: "Situação", opcoes: () => SIT_REL },
    {
      k: "por",
      rotulo: "Separar a lista por",
      padrao: "turma",
      opcoes: () => [
        ["turma", "colégio e turma"],
        ["colegio", "colégio"]
      ]
    }
  ]);
  if (!f) return null;
  const hoje = U.todayStr();
  const arr = filtrarRelatorio(base, f, hoje);
  // contrato de cada colégio e ano (id = instId_ano): o kit do aluno sem pacote próprio é o padrão do contrato
  const contratos = {};
  await Promise.all(
    [...new Set(arr.map(a => `${a.instId}_${a.ano}`))].map(id =>
      C.FS.getDoc(C.FS.doc(C.db, "contratosColegio", id))
        .then(s => s.exists() && (contratos[id] = s.data()))
        .catch(() => {})
    )
  );
  const kit = a => pacoteDoAluno(a, contratos[`${a.instId}_${a.ano}`]).itens.map(nomeItem).join(" + ") || "—";
  const cols = ["ID", "Aluno", "Contato", "Turma", "Kit", "Beca", "Faixa / capelo", "Status", "Devolução"];
  const linha = a => [
    a.codigo || "",
    title(a.nome || ""),
    contatoRel(a.tel, ""),
    a.serie || "",
    kit(a),
    a.becaTipo ? tamanhoBeca(a).replace(" · sem tamanho", " (sem tamanho)") : "—",
    [a.faixa && nomeFaixa(a.faixa), a.capelo && nomeCapelo(a.capelo)].filter(Boolean).join(" · "),
    atrasadoAluguel(a, hoje) ? "ATRASADO" : a.status || "Cadastrado",
    a.devolucao ? U.fmtDate(a.devolucao) : ""
  ];
  // separa por colégio, ou por colégio e turma (a turma sai em cada linha também)
  const porTurma = f.por === "turma";
  const cs = cols;
  const ln = linha;
  const porCol = {};
  arr.forEach(a => {
    const k = title(a.instNome || "?") + (porTurma ? " · " + (a.serie || "sem turma") : "");
    (porCol[k] = porCol[k] || []).push(a);
  });
  const u = usoDosAlunos(arr);
  const nomeInst = f.inst ? title((arr[0] || base.find(a => a.instId === f.inst) || {}).instNome || "") : "";
  const sit = (SIT_REL.find(x => x[0] === f.sit) || [])[1];
  return {
    titulo: "Aluguel de becas · alunos" + (f.ano ? " · " + f.ano : ""),
    subtitulo: [nomeInst, f.turma ? "turma " + f.turma : "", f.sit ? "situação: " + sit : ""].filter(Boolean).join(" · "),
    secoes: [
      {
        titulo: "Resumo",
        kpis: [
          ["Alunos", arr.length],
          ["Becas reservadas", u.reservado],
          ["Becas fora", u.fora],
          ["Atrasados", arr.filter(a => atrasadoAluguel(a, hoje)).length]
        ]
      },
      // quantas becas de cada tamanho, infantil e adulto separados
      ...(arr.some(a => a.tamanho)
        ? [
            {
              titulo: "Becas por tamanho",
              tabela: {
                cols: ["Beca", "Tamanho", "Alunos"],
                linhas: Object.entries(
                  arr.reduce((m, a) => {
                    if (!a.tamanho) return m;
                    const k = idadeBeca(a.becaTipo) + "|" + a.tamanho + (a.menosLonga ? "1" : "");
                    m[k] = (m[k] || 0) + 1;
                    return m;
                  }, {})
                )
                  .sort((x, y) => {
                    const ord = k => {
                      const [i, t] = k.split("|");
                      return (
                        (i === "infantil" ? 0 : 100) +
                        TAMANHOS.findIndex(([z]) => z === t.replace(/1$/, "")) * 2 +
                        (t.endsWith("1") ? 1 : 0)
                      );
                    };
                    return ord(x[0]) - ord(y[0]);
                  })
                  .map(([k, n]) => {
                    const [i, t] = k.split("|");
                    return [i === "infantil" ? "Infantil" : "Adulto", t, n];
                  })
              }
            }
          ]
        : []),
      ...(arr.length ? [] : [{ titulo: "Nenhum aluno com esses filtros", nota: "Volte e escolha outro colégio, turma ou situação." }]),
      ...Object.entries(porCol)
        .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
        .map(([c, l]) => ({
          titulo: title(c),
          nota: `${l.length} aluno${l.length === 1 ? "" : "s"}`,
          tabela: { cols: cs, linhas: l.sort(ordemCodigo).map(ln) }
        }))
    ]
  };
}
