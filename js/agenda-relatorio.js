// Agendamento: relatório do mês para imprimir.
import { nomeEvento } from "./eventos.js";
import { title } from "./ui.js";
import * as U from "./util.js";
import { contatoRel } from "./aluno-id.js";
import { fimDe } from "./agenda-tempo.js";
import { C, filtro, mesVis, marco, MESES, SEMANA } from "./agenda-estado.js";
// Relatório para reunião: tudo do mês que está no calendário, com o filtro escolhido
const NOME_FILTRO = { tudo: "Tudo", colegio: "Colégios", ensaio: "Ensaios", comp: "Compromissos", visita: "Visitas", beca: "Becas" };
// Contato de cada compromisso para o relatório (nome, telefone e e-mail quando tem)
export function contatoRelatorio(it) {
  const x = it.x;
  const c = it.t === "c" ? x.contato || {} : it.t === "v" ? (x.contatos || [])[0] || {} : null;
  if (c) return [c.nome && title(c.nome), contatoRel(c.tel, c.email)].filter(Boolean).join(" · ");
  if (it.t === "e") return marco() ? contatoRel(x.tel, x.email) : "";
  if (it.t === "b") return contatoRel(x.tel, x.email);
  return "";
}
export function linhaRelatorio(it) {
  const x = it.x;
  if (it.t === "c")
    return [nomeEvento(x.kind, x.instNome), [x.hora, x.onde, x.status === "confirmado" ? "Confirmado" : "Aguardando aprovação"]];
  if (it.t === "e")
    return [
      `Ensaio: ${title(x.cliente)}`,
      [x.hora && x.hora + "–" + fimDe(x), x.tipo, marco() ? (x.sinalPago ? "sinal pago" : "sem sinal") : ""]
    ];
  if (it.t === "p") {
    const oculto = x.particular && !marco();
    return [
      oculto ? `${x.deQuem || "Compromisso"}: ocupado` : `${x.titulo || "Compromisso"}${x.deQuem ? " · " + x.deQuem : ""}`,
      [x.diaInteiro ? "Dia inteiro" : x.hora && x.hora + "–" + fimDe(x), !oculto && x.obs]
    ];
  }
  if (it.t === "b")
    return [
      `${it.ret ? "Retirada" : "Devolução"} de becas: ${title(x.cliente)}`,
      [it.ret && x.retiradaHora, `${x.qtd || 1} beca(s)`, x.evento]
    ];
  if (it.t === "f") return [`Feriado: ${x.nome || ""}`, []];
  return [`Visita: ${title(x.nome)}`, [x.followupHora, C.nomeDe(x) && U.first(C.nomeDe(x)), x.proximoPasso]];
}
// entradas(hoje) = o que a tela mostra (vem do agenda.js)
export function relatorioAgenda(entradas) {
  const mes = mesVis || U.todayStr().slice(0, 7);
  const [y, m] = mes.split("-").map(Number);
  const doMes = entradas(U.todayStr()).filter(it => (it.data || "").startsWith(mes));
  const TIPO = { c: "Colégio", e: "Ensaio", p: "Compromisso", b: "Becas", f: "Feriado", v: "Visita" };
  const conta = t => doMes.filter(it => it.t === t).length;
  return {
    titulo: `Agenda de ${MESES[m - 1]} de ${y}`,
    subtitulo: "Mostrando: " + (NOME_FILTRO[filtro] || filtro),
    secoes: [
      {
        titulo: "Resumo do mês",
        kpis: [
          ["Colégios", conta("c")],
          ["Ensaios", conta("e")],
          ["Compromissos", conta("p")],
          ["Visitas", conta("v")],
          ["Becas", conta("b")]
        ].filter(([, n]) => n)
      },
      {
        titulo: "Dia a dia",
        nota: mes === U.todayStr().slice(0, 7) ? "Deste mês, de hoje em diante." : "",
        tabela: {
          cols: ["Dia", "Tipo", "O quê", "Detalhes", "Contato"],
          linhas: doMes.map(it => {
            const [oque, det] = linhaRelatorio(it);
            return [
              `${U.fmtDate(it.data)} (${SEMANA[new Date(it.data + "T12:00").getDay()]})`,
              TIPO[it.t] || "",
              oque,
              det.filter(Boolean).join(" · "),
              contatoRelatorio(it)
            ];
          })
        },
        vazio: "Nada marcado neste mês."
      }
    ]
  };
}
