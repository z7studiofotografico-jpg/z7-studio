// Aluguel de becas → 🖨️ Relatório: antes de gerar, a pessoa escolhe ano, colégio, turma e situação, e se a lista sai
// separada por colégio ou por colégio e turma.
import { title } from "./ui.js";
import * as U from "./util.js";
import { ocultoParaMim } from "./confirmar.js";
import { nomeFaixa, nomeCapelo, usoDosAlunos, tamanhoBeca, idadeBeca, TAMANHOS } from "./becas-estoque.js";
import { pedirFiltros } from "./relatorio.js";
import { contatoRel, ordemCodigo } from "./aluno-id.js";
import { pacoteDoAluno, textoPacote } from "./contrato-colegio-regras.js";
import { cartaoDoTipo } from "./instituicoes-dados.js";
import { brl } from "./regras.js";

export const atrasadoAluguel = (a, hoje = U.todayStr()) =>
  !a.soPaspatur && a.status === "Retirou a beca" && !!a.devolucao && a.devolucao < hoje;

// Relatório: antes de gerar, escolhe ano, colégio, turma, situação e se separa por colégio ou por turma
const SIT_REL = [
  ["", "todas"],
  ["naoParticipa", "não vai participar"],
  ["soPaspatur", "só o Paspatur"],
  ["atrasados", "atrasados na devolução"],
  ["Cadastrado", "cadastrado"],
  ["Beca medida", "beca medida"],
  ["Produtos em produção", "produtos em produção"],
  ["Pronto para retirada", "pronto para entregar"],
  ["Retirou a beca", "retirou a beca (becas fora)"],
  ["Devolvida", "beca devolvida"],
  ["andamento", "em andamento (todos menos devolvida)"]
];
const TIPOS_REL = [
  ["particular", "Particular"],
  ["publico", "Público"],
  ["superior", "Faculdade e curso"]
];
// a situação do aluno no relatório (a mesma do app): não vai participar, só o Paspatur, atrasado ou a etapa
export function situacaoAluguel(a, hoje = U.todayStr()) {
  if (a.naoParticipa) return "Não vai participar da formatura";
  if (atrasadoAluguel(a, hoje)) return "ATRASADO";
  const st = a.status || "Cadastrado";
  return a.semBeca && !a.soPaspatur ? "Sem beca · " + (st === "Retirou a beca" ? "entregue" : st) : a.soPaspatur ? "Só o Paspatur · " + (st === "Retirou a beca" ? "entregue" : st) : st;
}
export function filtrarRelatorio(arr, f, hoje = U.todayStr()) {
  return arr.filter(
    a =>
      (!f.ano || String(a.ano) === String(f.ano)) &&
      (!f.tipo || (f.tipoDe && f.tipoDe(a) === f.tipo)) &&
      (!f.inst || a.instId === f.inst) &&
      (!f.turma || (a.serie || "") === f.turma) &&
      (!f.sit ||
        (f.sit === "atrasados"
          ? atrasadoAluguel(a, hoje)
          : f.sit === "naoParticipa"
            ? !!a.naoParticipa
            : f.sit === "soPaspatur"
              ? !!a.soPaspatur && !a.naoParticipa
              : f.sit === "andamento"
                ? !a.naoParticipa && (a.status || "Cadastrado") !== "Devolvida"
                : !a.naoParticipa && (a.status || "Cadastrado") === f.sit))
  );
}
// insts: as instituições (para o tipo: particular, público, faculdade e curso)
export async function relatorioAluguel(C, lista, filtro, insts = []) {
  const base = lista.filter(a => !ocultoParaMim(C, a));
  const tipoDe = a => cartaoDoTipo((insts.find(i => i.id === a.instId) || {}).tipo || "");
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
      k: "tipo",
      rotulo: "Instituição",
      vazio: "todas (particular, público, faculdade…)",
      padrao: filtro.tipo || "",
      opcoes: () => TIPOS_REL
    },
    {
      k: "inst",
      rotulo: "Colégio",
      vazio: "todos os colégios",
      padrao: filtro.inst,
      opcoes: v => {
        const m = {};
        base
          .filter(a => (!v.ano || String(a.ano) === v.ano) && (!v.tipo || tipoDe(a) === v.tipo))
          .forEach(a => a.instId && (m[a.instId] = title(a.instNome || "")));
        return Object.entries(m).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
      }
    },
    {
      k: "turma",
      rotulo: "Turma",
      vazio: "todas as turmas",
      opcoes: v =>
        unicos(filtrarRelatorio(base, { ano: v.ano, inst: v.inst, tipo: v.tipo, tipoDe }).map(a => a.serie || "")).map(x => [x, x])
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
  const arr = filtrarRelatorio(base, Object.assign({}, f, { tipoDe }), hoje);
  // contrato de cada colégio e ano (id = instId_ano): o kit do aluno sem pacote próprio é o padrão do contrato
  const contratos = {};
  await Promise.all(
    [...new Set(arr.map(a => `${a.instId}_${a.ano}`))].map(id =>
      C.FS.getDoc(C.FS.doc(C.db, "contratosColegio", id))
        .then(s => s.exists() && (contratos[id] = s.data()))
        .catch(() => {})
    )
  );
  // o kit: quem não vai participar não tem kit (não usa o padrão do contrato); só o Paspatur é o Paspatur
  // (23/11/2026) o kit mostra o que foi vendido de verdade (paspatur, canudo, certificado, fotos…); quem é só do
  // Paspatur mostra os itens dele (não "beca adulta sem tamanho")
  const itensDe = a => {
    if (a.naoParticipa) return [];
    const it = pacoteDoAluno(a, contratos[`${a.instId}_${a.ano}`]).itens;
    return a.soPaspatur ? (it.filter(k => k !== "beca" && k !== "pelerine").length ? it.filter(k => k !== "beca" && k !== "pelerine") : ["paspatur"]) : it;
  };
  const kit = a => (a.naoParticipa ? "Sem kit" : textoPacote(itensDe(a), a.pacoteQtd) || "Sem kit");
  const usaBeca = a => !a.naoParticipa && !a.soPaspatur && !a.semBeca && (itensDe(a).some(k => k === "beca" || k === "pelerine") || !!a.becaTipo);
  // nenhum aluno com beca (ex.: contrato só de Paspatur): as colunas de beca e devolução saem do relatório
  const comBeca = arr.some(usaBeca);
  const cols = ["ID", "Aluno", "Contato", "Turma", "Kit", ...(comBeca ? ["Beca", "Faixa / capelo"] : []), "Status", ...(comBeca ? ["Devolução"] : [])];
  const linha = a => [
    a.codigo || "",
    title(a.nome || ""),
    contatoRel(a.tel, ""),
    [a.serie, a.turma].filter(Boolean).join(" · "),
    kit(a),
    ...(comBeca
      ? [
          usaBeca(a) ? (a.becaTipo ? tamanhoBeca(a).replace(" · sem tamanho", " (sem tamanho)") : "a medir") : "—",
          usaBeca(a) ? [a.faixa && nomeFaixa(a.faixa), a.capelo && nomeCapelo(a.capelo)].filter(Boolean).join(" · ") : ""
        ]
      : []),
    situacaoAluguel(a, hoje).replace(/^Só o Paspatur · /, ""),
    ...(comBeca ? [usaBeca(a) && a.devolucao ? U.fmtDate(a.devolucao) : ""] : [])
  ];
  // separa por colégio, ou por colégio e turma (a turma sai em cada linha também)
  const porTurma = f.por === "turma";
  const cs = cols;
  const ln = linha;
  const porCol = {};
  arr.forEach(a => {
    // "5° ano" e "5º ano" são a mesma série (17/11/2026)
    const k = title(a.instNome || "?") + (porTurma ? " · " + (String(a.serie || "").replace(/°/g, "º") || "sem turma") : "");
    (porCol[k] = porCol[k] || []).push(a);
  });
  const u = usoDosAlunos(arr);
  const nomeInst = f.inst ? title((arr[0] || base.find(a => a.instId === f.inst) || {}).instNome || "") : "";
  const sit = (SIT_REL.find(x => x[0] === f.sit) || [])[1];
  return {
    titulo: (comBeca ? "Aluguel de becas" : "Kits do colégio (sem beca)") + " · alunos" + (f.ano ? " · " + f.ano : ""),
    subtitulo: [
      f.tipo ? (TIPOS_REL.find(x => x[0] === f.tipo) || [])[1] : "",
      nomeInst,
      f.turma ? "turma " + f.turma : "",
      f.sit ? "situação: " + sit : ""
    ]
      .filter(Boolean)
      .join(" · "),
    secoes: [
      {
        titulo: "Resumo",
        kpis: [
          ["Alunos", arr.length],
          ...(comBeca
            ? [
                ["Becas reservadas", u.reservado],
                ["Becas fora", u.fora],
                ["Atrasados", arr.filter(a => atrasadoAluguel(a, hoje)).length]
              ]
            : []),
          ["Não vai participar", arr.filter(a => a.naoParticipa).length],
          ["Só o Paspatur", arr.filter(a => a.soPaspatur && !a.naoParticipa).length],
          ["Valor total", brl(arr.filter(a => !a.naoParticipa).reduce((t, a) => t + (Number(a.valor) || 0), 0))]
        ]
      },
      // quantas becas de cada tamanho, infantil e adulto separados
      // (17/11/2026) a pelerine (tamanho único) entra também; quem não vai participar não conta
      ...(arr.some(a => a.tamanho || a.becaTipo === "pelerineAzul")
        ? [
            {
              titulo: "Becas por tamanho",
              tabela: {
                cols: ["Beca", "Tamanho", "Alunos"],
                linhas: Object.entries(
                  arr.reduce((m, a) => {
                    if (a.naoParticipa) return m;
                    const k =
                      a.becaTipo === "pelerineAzul"
                        ? "pelerine|Tamanho único"
                        : a.tamanho
                          ? idadeBeca(a.becaTipo) + "|" + a.tamanho + (a.menosLonga ? "1" : "")
                          : "";
                    if (!k) return m;
                    m[k] = (m[k] || 0) + 1;
                    return m;
                  }, {})
                )
                  .sort((x, y) => {
                    const ord = k => {
                      const [i, t] = k.split("|");
                      return (
                        (i === "infantil" ? 0 : i === "pelerine" ? 200 : 100) +
                        TAMANHOS.findIndex(([z]) => z === t.replace(/1$/, "")) * 2 +
                        (t.endsWith("1") ? 1 : 0)
                      );
                    };
                    return ord(x[0]) - ord(y[0]);
                  })
                  .map(([k, n]) => {
                    const [i, t] = k.split("|");
                    return [i === "infantil" ? "Infantil" : i === "pelerine" ? "Pelerine azul" : "Adulto", t, n];
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
